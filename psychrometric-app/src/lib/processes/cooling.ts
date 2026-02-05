import { StatePoint } from '@/types/psychrometric';
import type { PsychrometricConstants } from '@/types/calculationSettings';
import { ProcessResults } from '@/types/process';
import { StatePointConverter } from '../psychrometric/conversions';
import { PsychrometricCalculator } from '../psychrometric/properties';
import { resolvePsychrometricConstants } from '../psychrometric/constants';

/**
 * 冷却・除湿プロセスの計算
 * 
 * 特徴:
 * - SHF(顕熱比)によって除湿量が決まる
 * - SHF = 1.0: 顕熱のみの冷却（絶対湿度変化なし）
 * - SHF < 1.0: 除湿を伴う冷却
 */
export class CoolingProcess {
  
  /**
   * 冷却能力とSHFから出口状態を計算
   * 
   * @param fromPoint 入口状態点
   * @param coolingCapacity 冷却能力 [kW] (正の値)
   * @param SHF 顕熱比 [-] (0.5〜1.0)
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   */
  static calculateByCapacityAndSHF(
    fromPoint: StatePoint,
    coolingCapacity: number,
    SHF: number,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 質量流量を計算 [kg/h]
    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density;
    
    // 全熱量（エンタルピー差） [kJ/kg']
    const totalEnthalpyDiff = (coolingCapacity * 3600) / massFlow;
    
    // 顕熱と潜熱に分解
    const sensibleHeat = coolingCapacity * SHF;
    const latentHeat = coolingCapacity * (1 - SHF);
    
    // 温度差 [°C]
    // 顕熱: Q_s = cp × Δt × G
    // Δt = Q_s / (cp × G) × 3600
    const temperatureDiff = (sensibleHeat * 3600) / (resolved.cpAir * massFlow);
    
    // 絶対湿度差 [kg/kg']
    // 潜熱: Q_l = L0 × Δx × G
    // Δx = Q_l / (L0 × G) × 3600
    const humidityDiff = (latentHeat * 3600) / (resolved.latentHeat0c * massFlow);
    
    // 出口状態
    const toTemp = fromPoint.dryBulbTemp! - temperatureDiff;
    const toHumidity = fromPoint.humidity! - humidityDiff;
    
    // 状態点を完成
    const toPoint = StatePointConverter.fromDryBulbAndHumidity(
      toTemp,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    // 計算結果
    const results: ProcessResults = {
      sensibleHeat,
      latentHeat,
      totalHeat: coolingCapacity,
      enthalpyDiff: -totalEnthalpyDiff, // 冷却なので負の値
      humidityDiff: -humidityDiff,      // 除湿なので負の値
      temperatureDiff: -temperatureDiff, // 冷却なので負の値
    };
    
    return { toPoint, results };
  }

  /**
   * 冷却能力と出口相対湿度から出口状態を計算
   *
   * @param fromPoint 入口状態点
   * @param coolingCapacity 冷却能力 [kW] (正の値)
   * @param outletRH 出口相対湿度 [%]
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   */
  static calculateByCapacityAndOutletRH(
    fromPoint: StatePoint,
    coolingCapacity: number,
    outletRH: number,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;

    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density;
    const totalEnthalpyDiff = (coolingCapacity * 3600) / massFlow;
    const fromRH = fromPoint.relativeHumidity ?? outletRH;

    let sensibleTargetPoint: Partial<StatePoint> = fromPoint;
    let enthalpyDropToRH = 0;
    if (outletRH > fromRH) {
      sensibleTargetPoint = StatePointConverter.fromRHAndHumidity(
        outletRH,
        fromPoint.humidity!,
        effectivePressure,
        resolved
      );
      enthalpyDropToRH = Math.max(
        0,
        fromPoint.enthalpy! - sensibleTargetPoint.enthalpy!
      );
    }

    let toPoint: Partial<StatePoint>;
    if (totalEnthalpyDiff <= enthalpyDropToRH + 1e-6) {
      const targetEnthalpy = fromPoint.enthalpy! - totalEnthalpyDiff;
      toPoint = StatePointConverter.fromEnthalpyAndHumidity(
        targetEnthalpy,
        fromPoint.humidity!,
        effectivePressure,
        resolved
      );
    } else {
      const remainingEnthalpyDiff = totalEnthalpyDiff - enthalpyDropToRH;
      const targetEnthalpy = sensibleTargetPoint.enthalpy! - remainingEnthalpyDiff;
      toPoint = StatePointConverter.fromRHAndEnthalpy(
        outletRH,
        targetEnthalpy,
        effectivePressure,
        resolved
      );
    }

    const enthalpyDiff = fromPoint.enthalpy! - toPoint.enthalpy!;
    const temperatureDiff = fromPoint.dryBulbTemp! - toPoint.dryBulbTemp!;
    const humidityDiff = fromPoint.humidity! - toPoint.humidity!;
    const sensibleHeat = (massFlow * resolved.cpAir * temperatureDiff) / 3600;
    const latentHeat = (massFlow * resolved.latentHeat0c * humidityDiff) / 3600;

    const results: ProcessResults = {
      sensibleHeat,
      latentHeat,
      totalHeat: coolingCapacity,
      enthalpyDiff: -enthalpyDiff,
      humidityDiff: -humidityDiff,
      temperatureDiff: -temperatureDiff,
    };

    return { toPoint, results };
  }
  
  /**
   * 出口温度と相対湿度から冷却能力を計算
   * 
   * @param fromPoint 入口状態点
   * @param toTemp 出口温度 [°C]
   * @param toRH 出口相対湿度 [%]
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   */
  static calculateByOutletCondition(
    fromPoint: StatePoint,
    toTemp: number,
    toRH: number,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 出口状態点を計算
    const toPoint = StatePointConverter.fromDryBulbAndRH(
      toTemp,
      toRH,
      effectivePressure,
      resolved
    );
    
    // エンタルピー差
    const enthalpyDiff = fromPoint.enthalpy! - toPoint.enthalpy!;
    
    // 温度差
    const temperatureDiff = fromPoint.dryBulbTemp! - toTemp;
    
    // 絶対湿度差
    const humidityDiff = fromPoint.humidity! - toPoint.humidity!;
    
    // 質量流量
    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density;
    
    // 冷却能力 [kW]
    const coolingCapacity = (massFlow * enthalpyDiff) / 3600;
    
    // 顕熱 [kW]
    const sensibleHeat = (massFlow * resolved.cpAir * temperatureDiff) / 3600;
    
    // 潜熱 [kW]
    const latentHeat = (massFlow * resolved.latentHeat0c * humidityDiff) / 3600;
    
    // 計算結果
    const results: ProcessResults = {
      sensibleHeat,
      latentHeat,
      totalHeat: coolingCapacity,
      enthalpyDiff: -enthalpyDiff,
      humidityDiff: -humidityDiff,
      temperatureDiff: -temperatureDiff,
    };
    
    return { toPoint, results };
  }
  
  /**
   * コイル表面温度を考慮した冷却計算（装置露点温度法）
   * 
   * @param fromPoint 入口状態点
   * @param apparatusDewPoint 装置露点温度 [°C]
   * @param bypassFactor バイパスファクター [-] (0.1〜0.3程度)
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   */
  static calculateByApparatusDewPoint(
    fromPoint: StatePoint,
    apparatusDewPoint: number,
    bypassFactor: number,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 装置露点における飽和状態
    const adpState = StatePointConverter.fromDryBulbAndRH(
      apparatusDewPoint,
      100,
      effectivePressure,
      resolved
    );
    
    // バイパスファクターを考慮した出口状態
    // h_out = h_in - (1 - BF) × (h_in - h_adp)
    // x_out = x_in - (1 - BF) × (x_in - x_adp)
    
    const toEnthalpy = fromPoint.enthalpy! - 
                       (1 - bypassFactor) * (fromPoint.enthalpy! - adpState.enthalpy!);
    
    const toHumidity = fromPoint.humidity! - 
                       (1 - bypassFactor) * (fromPoint.humidity! - adpState.humidity!);
    
    // 出口状態点
    const toPoint = StatePointConverter.fromEnthalpyAndHumidity(
      toEnthalpy,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    // エンタルピー差
    const enthalpyDiff = fromPoint.enthalpy! - toPoint.enthalpy!;
    
    // 質量流量
    const density = PsychrometricCalculator.airDensity(
      fromPoint.dryBulbTemp!,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const massFlow = airflow * density;
    
    // 冷却能力
    const coolingCapacity = (massFlow * enthalpyDiff) / 3600;
    
    // 温度差・湿度差
    const temperatureDiff = fromPoint.dryBulbTemp! - toPoint.dryBulbTemp!;
    const humidityDiff = fromPoint.humidity! - toPoint.humidity!;
    
    // 顕熱・潜熱
    const sensibleHeat = (massFlow * resolved.cpAir * temperatureDiff) / 3600;
    const latentHeat = (massFlow * resolved.latentHeat0c * humidityDiff) / 3600;
    
    const results: ProcessResults = {
      sensibleHeat,
      latentHeat,
      totalHeat: coolingCapacity,
      enthalpyDiff: -enthalpyDiff,
      humidityDiff: -humidityDiff,
      temperatureDiff: -temperatureDiff,
    };
    
    return { toPoint, results };
  }
}
