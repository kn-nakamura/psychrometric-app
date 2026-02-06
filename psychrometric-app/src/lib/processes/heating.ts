import { StatePoint } from '@/types/psychrometric';
import type { PsychrometricConstants } from '@/types/calculationSettings';
import { ProcessResults } from '@/types/process';
import { StatePointConverter } from '../psychrometric/conversions';
import { resolvePsychrometricConstants } from '../psychrometric/constants';
import { toSignedCapacity } from '../sign';
import { massFlowFromAirflow } from '../airflow';
import { enthalpy } from '../psychrometrics';
import { splitCapacity } from '../capacity';

/**
 * 加熱プロセスの計算
 * 
 * 特徴:
 * - 絶対湿度は変化しない（水平線）
 * - 温度とエンタルピーが上昇
 * - 相対湿度は低下
 */
export class HeatingProcess {
  
  /**
   * 加熱能力から出口状態を計算
   * 
   * @param fromPoint 入口状態点
   * @param heatingCapacity 加熱能力 [kW]
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   */
  static calculateByCapacity(
    fromPoint: StatePoint,
    heatingCapacity: number,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 質量流量を計算 [kg/h]
    const massFlow = massFlowFromAirflow(airflow, fromPoint, effectivePressure);
    if (massFlow <= 0) {
      throw new Error('Invalid airflow for heating calculation.');
    }
    
    // エンタルピー差を計算 [kJ/kg']
    // Q[kW] = G[kg/h] × Δh[kJ/kg'] / 3600
    // Δh = Q × 3600 / G
    const totalHeat = toSignedCapacity('heating', heatingCapacity);
    const enthalpyDiff = totalHeat / massFlow;
    
    // 出口エンタルピー
    const toEnthalpy = enthalpy(fromPoint.dryBulbTemp!, fromPoint.humidity!) + enthalpyDiff;
    
    // 絶対湿度は変化しない
    const toHumidity = fromPoint.humidity!;
    
    // 状態点を完成
    const toPoint = StatePointConverter.fromEnthalpyAndHumidity(
      toEnthalpy,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    // 温度差
    const temperatureDiff = toPoint.dryBulbTemp! - fromPoint.dryBulbTemp!;
    
    // 計算結果
    const results: ProcessResults = {
      sensibleHeat: totalHeat,  // 加熱は100%顕熱
      latentHeat: 0,
      totalHeat,
      enthalpyDiff,
      humidityDiff: 0,  // 絶対湿度変化なし
      temperatureDiff,
    };
    
    return { toPoint, results };
  }
  
  /**
   * 出口温度から加熱能力を計算
   * 
   * @param fromPoint 入口状態点
   * @param toTemp 出口温度 [°C]
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 出口状態点と計算結果
   */
  static calculateByTemperature(
    fromPoint: StatePoint,
    toTemp: number,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): { toPoint: Partial<StatePoint>; results: ProcessResults } {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    
    // 絶対湿度は変化しない
    const toHumidity = fromPoint.humidity!;
    
    // 出口状態点を計算
    const toPoint = StatePointConverter.fromDryBulbAndHumidity(
      toTemp,
      toHumidity,
      effectivePressure,
      resolved
    );
    
    // エンタルピー差
    const enthalpyDiff = enthalpy(toPoint.dryBulbTemp!, toPoint.humidity!) -
      enthalpy(fromPoint.dryBulbTemp!, fromPoint.humidity!);
    
    // 質量流量
    const massFlow = massFlowFromAirflow(airflow, fromPoint, effectivePressure);
    
    const { totalKw, sensibleKw, latentKw } = splitCapacity(
      massFlow,
      {
        dryBulbTemp: fromPoint.dryBulbTemp!,
        humidity: fromPoint.humidity!,
      },
      {
        dryBulbTemp: toPoint.dryBulbTemp!,
        humidity: toPoint.humidity!,
      }
    );
    
    // 温度差
    const temperatureDiff = toTemp - fromPoint.dryBulbTemp!;
    
    // 計算結果
    const results: ProcessResults = {
      sensibleHeat: sensibleKw,
      latentHeat: latentKw,
      totalHeat: totalKw,
      enthalpyDiff,
      humidityDiff: 0,
      temperatureDiff,
    };
    
    return { toPoint, results };
  }
}
