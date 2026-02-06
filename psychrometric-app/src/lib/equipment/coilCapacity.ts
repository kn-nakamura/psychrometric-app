import { StatePoint } from '@/types/psychrometric';
import type { PsychrometricConstants } from '@/types/calculationSettings';
import { resolvePsychrometricConstants } from '../psychrometric/constants';
import { calculateSHF } from '../sign';
import { splitCapacity } from '../capacity';
import { massFlowFromAirflow } from '../airflow';
import { enthalpy } from '../psychrometrics';

/**
 * コイル能力計算
 * 
 * 用途:
 * - 加熱コイル（温水、蒸気、電気）
 * - 冷却コイル（冷水、DX）
 */
export class CoilCapacityCalculator {
  
  /**
   * 前後の状態点から必要なコイル能力を計算
   * 
   * @param inletPoint 入口状態点
   * @param outletPoint 出口状態点
   * @param airflow 風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns コイル能力と詳細
   */
  static calculate(
    inletPoint: StatePoint,
    outletPoint: StatePoint,
    airflow: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): {
    totalCapacity: number;      // 全熱容量 [kW]
    sensibleCapacity: number;   // 顕熱容量 [kW]
    latentCapacity: number;     // 潜熱容量 [kW]
    SHF: number | null;         // 顕熱比 [-]
    temperatureDiff: number;    // 温度差 [°C]
    humidityDiff: number;       // 絶対湿度差 [kg/kg']
    enthalpyDiff: number;       // エンタルピー差 [kJ/kg']
    massFlow: number;           // 質量流量 [kgDA/s]
  } {
    
    // 質量流量を計算 [kgDA/s]
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    const massFlow = massFlowFromAirflow(airflow, inletPoint, effectivePressure);
    
    // エンタルピー差
    const enthalpyDiff =
      enthalpy(outletPoint.dryBulbTemp!, outletPoint.humidity!) -
      enthalpy(inletPoint.dryBulbTemp!, inletPoint.humidity!);
    
    // 温度差
    const temperatureDiff = outletPoint.dryBulbTemp! - inletPoint.dryBulbTemp!;
    
    // 絶対湿度差
    const humidityDiff = outletPoint.humidity! - inletPoint.humidity!;
    
    const { totalKw, sensibleKw, latentKw } = splitCapacity(
      massFlow,
      {
        dryBulbTemp: inletPoint.dryBulbTemp!,
        humidity: inletPoint.humidity!,
      },
      {
        dryBulbTemp: outletPoint.dryBulbTemp!,
        humidity: outletPoint.humidity!,
      }
    );
    
    const SHF = calculateSHF(sensibleKw, totalKw);
    
    return {
      totalCapacity: totalKw,
      sensibleCapacity: sensibleKw,
      latentCapacity: latentKw,
      SHF,
      temperatureDiff,
      humidityDiff,
      enthalpyDiff,
      massFlow,
    };
  }
  
  /**
   * 冷却コイルの能力計算（詳細版）
   * 
   * @param inletPoint 入口状態点
   * @param outletPoint 出口状態点
   * @param airflow 風量 [m³/h]
   * @param waterFlowRate 冷水流量 [L/min]
   * @param inletWaterTemp 入口冷水温度 [°C]
   * @param outletWaterTemp 出口冷水温度 [°C]
   * @returns コイル能力と水側熱量のバランス確認
   */
  static calculateCoolingCoil(
    inletPoint: StatePoint,
    outletPoint: StatePoint,
    airflow: number,
    waterFlowRate?: number,
    inletWaterTemp?: number,
    outletWaterTemp?: number,
    constants?: Partial<PsychrometricConstants>
  ): {
    airSideCapacity: number;    // 空気側熱量 [kW]
    waterSideCapacity?: number; // 水側熱量 [kW]
    heatBalance?: number;       // 熱収支差 [%]
    sensibleCapacity: number;
    latentCapacity: number;
    SHF: number | null;
    condensateRemoval: number;  // 除湿水量 [L/h]
  } {
    
    const airSide = this.calculate(inletPoint, outletPoint, airflow, undefined, constants);
    
    // 除湿水量 [L/h]
    // 密度を1kg/L と仮定
    const condensateRemoval = airSide.massFlow * 3600 * Math.abs(airSide.humidityDiff);
    
    let waterSideCapacity: number | undefined;
    let heatBalance: number | undefined;
    
    // 水側熱量を計算（データがある場合）
    if (waterFlowRate && inletWaterTemp !== undefined && outletWaterTemp !== undefined) {
      // 水側熱量 [kW]
      // Q_w = ρ × V × cp × Δt / 60
      // ρ: 水の密度 ≈ 1 kg/L
      // V: 流量 [L/min]
      // cp: 水の比熱 ≈ 4.186 kJ/(kg·K)
      const waterTempDiff = outletWaterTemp - inletWaterTemp;
      waterSideCapacity = (waterFlowRate * 4.186 * waterTempDiff) / 60;
      
      // 熱収支確認 [%] (水側 + 空気側 = 0 が理想)
      heatBalance =
        Math.abs((waterSideCapacity + airSide.totalCapacity) / Math.max(Math.abs(airSide.totalCapacity), 1e-6)) *
        100;
    }
    
    return {
      airSideCapacity: airSide.totalCapacity,
      waterSideCapacity,
      heatBalance,
      sensibleCapacity: airSide.sensibleCapacity,
      latentCapacity: airSide.latentCapacity,
      SHF: airSide.SHF,
      condensateRemoval,
    };
  }
  
  /**
   * 加熱コイルの能力計算（詳細版）
   * 
   * @param inletPoint 入口状態点
   * @param outletPoint 出口状態点
   * @param airflow 風量 [m³/h]
   * @param waterFlowRate 温水流量 [L/min]
   * @param inletWaterTemp 入口温水温度 [°C]
   * @param outletWaterTemp 出口温水温度 [°C]
   * @returns コイル能力と水側熱量のバランス確認
   */
  static calculateHeatingCoil(
    inletPoint: StatePoint,
    outletPoint: StatePoint,
    airflow: number,
    waterFlowRate?: number,
    inletWaterTemp?: number,
    outletWaterTemp?: number,
    constants?: Partial<PsychrometricConstants>
  ): {
    airSideCapacity: number;    // 空気側熱量 [kW]
    waterSideCapacity?: number; // 水側熱量 [kW]
    heatBalance?: number;       // 熱収支差 [%]
  } {
    
    const airSide = this.calculate(inletPoint, outletPoint, airflow, undefined, constants);
    
    let waterSideCapacity: number | undefined;
    let heatBalance: number | undefined;
    
    // 水側熱量を計算（データがある場合）
    if (waterFlowRate && inletWaterTemp !== undefined && outletWaterTemp !== undefined) {
      const waterTempDiff = outletWaterTemp - inletWaterTemp;
      waterSideCapacity = (waterFlowRate * 4.186 * waterTempDiff) / 60;
      
      // 熱収支確認 (水側 + 空気側 = 0 が理想)
      heatBalance =
        Math.abs((waterSideCapacity + airSide.totalCapacity) / Math.max(Math.abs(airSide.totalCapacity), 1e-6)) *
        100;
    }
    
    return {
      airSideCapacity: airSide.totalCapacity,
      waterSideCapacity,
      heatBalance,
    };
  }
  
  /**
   * 必要な水流量を計算
   * 
   * @param capacity 必要能力 [kW]
   * @param inletWaterTemp 入口水温 [°C]
   * @param outletWaterTemp 出口水温 [°C]
   * @returns 必要水流量 [L/min]
   */
  static calculateRequiredWaterFlow(
    capacity: number,
    inletWaterTemp: number,
    outletWaterTemp: number
  ): number {
    
    // Q = ρ × V × cp × Δt / 60
    // V = Q × 60 / (ρ × cp × Δt)
    
    const tempDiff = Math.abs(inletWaterTemp - outletWaterTemp);
    const waterFlow = (Math.abs(capacity) * 60) / (4.186 * tempDiff);
    
    return waterFlow;
  }
  
  /**
   * コイル列数の推定（簡易計算）
   * 
   * @param capacity 必要能力 [kW]
   * @param airflow 風量 [m³/h]
   * @param faceVelocity 面風速 [m/s]
   * @returns 推定列数
   */
  static estimateCoilRows(
    capacity: number,
    airflow: number,
    faceVelocity: number = 2.5
  ): number {
    
    // コイル面積 [m²]
    const faceArea = (airflow / 3600) / faceVelocity;
    
    // 熱負荷密度 [kW/m²]
    const heatFluxDensity = Math.abs(capacity) / faceArea;
    
    // 1列あたり約5-8 kW/m² と仮定
    const rowCapacity = 6.5; // [kW/m²]
    const rows = Math.ceil(heatFluxDensity / rowCapacity);
    
    return Math.max(1, Math.min(rows, 8)); // 1-8列の範囲
  }
}
