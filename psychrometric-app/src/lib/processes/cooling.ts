import { StatePoint } from '@/types/psychrometric';
import type { PsychrometricConstants } from '@/types/calculationSettings';
import { ProcessResults } from '@/types/process';
import { StatePointConverter } from '../psychrometric/conversions';
import { resolvePsychrometricConstants } from '../psychrometric/constants';
import { toSignedCapacity } from '../sign';
import { splitCapacity } from '../capacity';
import { massFlowFromAirflow } from '../airflow';
import { enthalpy } from '../psychrometrics';

/**
 * 冷却・除湿プロセスの計算
 * 
 * 特徴:
 * - 冷却能力と出口相対湿度から状態点を計算
 */
export class CoolingProcess {
  
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
    
    // 質量流量を計算 [kg/h]
    const massFlow = massFlowFromAirflow(airflow, fromPoint, effectivePressure);
    if (massFlow <= 0) {
      throw new Error('Invalid airflow for cooling calculation.');
    }
    
    const totalHeat = toSignedCapacity('cooling', coolingCapacity);
    
    // 全熱量（エンタルピー差） [kJ/kg']
    const totalEnthalpyDiff = totalHeat / massFlow;
    const fromEnthalpy = enthalpy(fromPoint.dryBulbTemp!, fromPoint.humidity!);
    const targetEnthalpy = fromEnthalpy + totalEnthalpyDiff;

    const outletRHPointAtSameHumidity = StatePointConverter.fromRHAndHumidity(
      outletRH,
      fromPoint.humidity!,
      effectivePressure,
      resolved
    );
    const enthalpyAtOutletRH = enthalpy(
      outletRHPointAtSameHumidity.dryBulbTemp!,
      outletRHPointAtSameHumidity.humidity!
    );

    const requiresLatentCooling = targetEnthalpy <= enthalpyAtOutletRH;

    const toPoint = requiresLatentCooling
      ? StatePointConverter.fromRHAndEnthalpy(
          outletRH,
          targetEnthalpy,
          effectivePressure,
          resolved
        )
      : StatePointConverter.fromHumidityAndEnthalpy(
          fromPoint.humidity!,
          targetEnthalpy,
          effectivePressure,
          resolved
        );

    const humidityDiff = toPoint.humidity! - fromPoint.humidity!;
    const temperatureDiff = toPoint.dryBulbTemp! - fromPoint.dryBulbTemp!;

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
    
    // 計算結果
    const results: ProcessResults = {
      sensibleHeat: sensibleKw,
      latentHeat: latentKw,
      totalHeat: totalKw,
      enthalpyDiff: totalEnthalpyDiff,
      humidityDiff,
      temperatureDiff,
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
    const enthalpyDiff = enthalpy(toPoint.dryBulbTemp!, toPoint.humidity!) -
      enthalpy(fromPoint.dryBulbTemp!, fromPoint.humidity!);
    
    // 温度差
    const temperatureDiff = toTemp - fromPoint.dryBulbTemp!;
    
    // 絶対湿度差
    const humidityDiff = toPoint.humidity! - fromPoint.humidity!;
    
    // 質量流量
    const massFlow = massFlowFromAirflow(airflow, fromPoint, effectivePressure);
    
    // 冷却能力 [kW]
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
    
    // 計算結果
    const results: ProcessResults = {
      sensibleHeat: sensibleKw,
      latentHeat: latentKw,
      totalHeat: totalKw,
      enthalpyDiff,
      humidityDiff,
      temperatureDiff,
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
    
    const fromEnthalpy = enthalpy(fromPoint.dryBulbTemp!, fromPoint.humidity!);
    const adpEnthalpy = enthalpy(adpState.dryBulbTemp!, adpState.humidity!);
    const toEnthalpy = fromEnthalpy -
                       (1 - bypassFactor) * (fromEnthalpy - adpEnthalpy);
    
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
    const enthalpyDiff = enthalpy(toPoint.dryBulbTemp!, toPoint.humidity!) -
      enthalpy(fromPoint.dryBulbTemp!, fromPoint.humidity!);
    
    // 質量流量
    const massFlow = massFlowFromAirflow(airflow, fromPoint, effectivePressure);
    
    // 冷却能力
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
    
    // 温度差・湿度差
    const temperatureDiff = toPoint.dryBulbTemp! - fromPoint.dryBulbTemp!;
    const humidityDiff = toPoint.humidity! - fromPoint.humidity!;
    
    const results: ProcessResults = {
      sensibleHeat: sensibleKw,
      latentHeat: latentKw,
      totalHeat: totalKw,
      enthalpyDiff,
      humidityDiff,
      temperatureDiff,
    };
    
    return { toPoint, results };
  }
}
