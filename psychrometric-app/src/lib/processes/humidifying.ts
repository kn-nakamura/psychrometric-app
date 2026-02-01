import { StatePoint } from '@/types/psychrometric';
import type { PsychrometricConstants } from '@/types/calculationSettings';
import { ProcessResults } from '@/types/process';
import { StatePointConverter } from '../psychrometric/conversions';
import { PsychrometricCalculator } from '../psychrometric/properties';
import { resolvePsychrometricConstants } from '../psychrometric/constants';

/**
 * 加湿プロセスの計算
 * 
 * 加湿方式:
 * 1. 水噴霧加湿（断熱加湿）- エンタルピーほぼ一定
 * 2. 蒸気加湿 - 温度上昇を伴う
 * 3. 気化式加湿 - 断熱加湿に近い
 */
export class HumidifyingProcess {
  
  /**
   * 水噴霧加湿（断熱加湿）の計算
   * 
   * @param fromPoint 入口状態点
   * @param humidifyingCapacity 加湿量 [kg/h]
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   * 
   * 理論:
   * - エンタルピーはほぼ一定（厳密には水の温度分だけ変化）
   * - 絶対湿度が増加
   * - 温度は若干低下（蒸発潜熱を奪うため）
   */
  static calculateWaterSpray(
    fromPoint: StatePoint,
    humidifyingCapacity: number,
    airflow: number,
    waterTemp: number = 15, // 水温 [°C]
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 質量流量を計算
    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density; // [kg/h]
    
    // 絶対湿度の増加量 [kg/kg']
    const humidityIncrease = humidifyingCapacity / massFlow;
    
    // 出口の絶対湿度
    const toHumidity = fromPoint.humidity! + humidityIncrease;
    
    // 水の顕熱を考慮したエンタルピー変化
    // Δh = c_w × t_w × Δx
    // c_w: 水の比熱 ≈ 4.186 kJ/(kg·K)
    const waterEnthalpy = 4.186 * waterTemp * humidityIncrease;
    const toEnthalpy = fromPoint.enthalpy! + waterEnthalpy;
    
    // 出口状態点
    const toPoint = StatePointConverter.fromEnthalpyAndHumidity(
      toEnthalpy,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    // 温度変化
    const temperatureDiff = toPoint.dryBulbTemp! - fromPoint.dryBulbTemp!;
    
    // 計算結果
    const results: ProcessResults = {
      totalHeat: 0, // 断熱加湿なので外部からの熱供給なし
      sensibleHeat: 0,
      latentHeat: 0,
      enthalpyDiff: toEnthalpy - fromPoint.enthalpy!,
      humidityDiff: humidityIncrease,
      temperatureDiff,
    };
    
    return { toPoint, results };
  }
  
  /**
   * 蒸気加湿の計算
   * 
   * @param fromPoint 入口状態点
   * @param humidifyingCapacity 加湿量 [kg/h]
   * @param airflow 風量 [m³/h]
   * @param steamTemp 蒸気温度 [°C] (通常100-120°C)
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   * 
   * 理論:
   * - 蒸気の持つ顕熱と潜熱が空気に加わる
   * - 温度が上昇
   * - 絶対湿度が増加
   */
  static calculateSteam(
    fromPoint: StatePoint,
    humidifyingCapacity: number,
    airflow: number,
    steamTemp: number = 100,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 質量流量を計算
    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density; // [kg/h]
    
    // 絶対湿度の増加量
    const humidityIncrease = humidifyingCapacity / massFlow;
    const toHumidity = fromPoint.humidity! + humidityIncrease;
    
    // 蒸気のエンタルピー [kJ/kg]
    // h_steam = L0 + cp,v × t_steam
    const steamEnthalpy = resolved.latentHeat0c + resolved.cpVapor * steamTemp;
    
    // 空気のエンタルピー増加
    const enthalpyIncrease = steamEnthalpy * humidityIncrease;
    const toEnthalpy = fromPoint.enthalpy! + enthalpyIncrease;
    
    // 出口状態点
    const toPoint = StatePointConverter.fromEnthalpyAndHumidity(
      toEnthalpy,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    // 温度変化
    const temperatureDiff = toPoint.dryBulbTemp! - fromPoint.dryBulbTemp!;
    
    // 加湿熱量 [kW]
    const humidifyingHeat = (massFlow * enthalpyIncrease) / 3600;
    
    // 計算結果
    const results: ProcessResults = {
      totalHeat: humidifyingHeat,
      sensibleHeat: humidifyingHeat, // 蒸気加湿は顕熱として現れる
      latentHeat: 0,
      enthalpyDiff: enthalpyIncrease,
      humidityDiff: humidityIncrease,
      temperatureDiff,
    };
    
    return { toPoint, results };
  }
  
  /**
   * 目標相対湿度から必要加湿量を計算
   * 
   * @param fromPoint 入口状態点
   * @param targetRH 目標相対湿度 [%]
   * @param airflow 風量 [m³/h]
   * @param humidifierType 加湿方式
   * @param pressure 大気圧 [kPa]
   * @returns 必要加湿量と出口状態点
   */
  static calculateRequiredCapacity(
    fromPoint: StatePoint,
    targetRH: number,
    airflow: number,
    humidifierType: 'water' | 'steam' = 'water',
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { capacity: number; toPoint: Partial<StatePoint> } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 断熱加湿の場合、エンタルピー一定で相対湿度を上げる
    const targetHumidity = PsychrometricCalculator.absoluteHumidity(
      fromPoint.dryBulbTemp!,
      targetRH,
      effectivePressure,
      resolved
    );
    
    // より正確には、エンタルピー一定で絶対湿度を増やした時の温度を求める
    let toPoint: Partial<StatePoint>;
    
    if (humidifierType === 'water') {
      // 水噴霧：エンタルピーほぼ一定
      toPoint = StatePointConverter.fromEnthalpyAndHumidity(
        fromPoint.enthalpy!,
        targetHumidity,
        effectivePressure,
        resolved
      );
    } else {
      // 蒸気加湿：温度がほぼ一定（若干上昇）
      toPoint = StatePointConverter.fromDryBulbAndHumidity(
        fromPoint.dryBulbTemp!,
        targetHumidity,
        effectivePressure,
        resolved
      );
    }
    
    // 必要加湿量 [kg/h]
    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density;
    const capacity = massFlow * (targetHumidity - fromPoint.humidity!);
    
    return { capacity, toPoint };
  }
  
  /**
   * 気化式加湿（エンタルピー一定）
   * 水噴霧加湿と同様の計算
   * 
   * @param fromPoint 入口状態点
   * @param targetRH 目標相対湿度 [%]
   * @param efficiency 加湿効率 [%] (通常60-90%)
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点
   */
  static calculateEvaporative(
    fromPoint: StatePoint,
    _targetRH: number,
    efficiency: number = 80,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): Partial<StatePoint> {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 理論的な飽和状態（エンタルピー一定、RH100%）
    const saturatedState = StatePointConverter.fromDryBulbAndRH(
      fromPoint.wetBulbTemp!, // 湿球温度まで冷却される
      100,
      effectivePressure,
      resolved
    );
    
    // 効率を考慮した実際の状態
    // エンタルピー一定のまま、効率分だけ湿球温度に近づく
    const effectiveEfficiency = efficiency / 100;
    
    const toHumidity = fromPoint.humidity! + 
      effectiveEfficiency * (saturatedState.humidity! - fromPoint.humidity!);
    
    const toPoint = StatePointConverter.fromEnthalpyAndHumidity(
      fromPoint.enthalpy!,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    return toPoint;
  }
}
