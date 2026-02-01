import { StatePoint } from '@/types/psychrometric';
import { ProcessResults } from '@/types/process';
import { StatePointConverter } from '../psychrometric/conversions';
import { PsychrometricCalculator } from '../psychrometric/properties';
import { STANDARD_PRESSURE } from '../psychrometric/constants';

/**
 * 全熱交換プロセスの計算
 * 
 * 特徴:
 * - 外気と排気の間でエンタルピーを交換
 * - 全熱交換効率、顕熱交換効率、潜熱交換効率を考慮
 * - 風量が異なる場合は効率補正が必要
 */
export class HeatExchangeProcess {
  private static getEffectiveAirflow(inlet: number, outlet?: number): number {
    if (!Number.isFinite(inlet) || inlet <= 0) return 0;
    if (!Number.isFinite(outlet) || outlet <= 0) return inlet;
    return Math.min(inlet, outlet);
  }

  private static getAirflowRatio(airflow1: number, airflow2: number): number {
    const maxFlow = Math.max(airflow1, airflow2);
    if (maxFlow <= 0) return 0;
    return Math.min(airflow1, airflow2) / maxFlow;
  }
  
  /**
   * 全熱交換器の計算（全熱交換効率のみ指定）
   * 
   * @param outdoorAir 外気状態点
   * @param exhaustAir 排気状態点
   * @param oaAirflow 外気風量 [m³/h]
   * @param eaAirflow 排気風量 [m³/h]
   * @param efficiency 全熱交換効率 [%]
   * @param pressure 大気圧 [kPa]
   * @returns 処理後外気と計算結果
   */
  static calculateTotalHeat(
    outdoorAir: StatePoint,
    exhaustAir: StatePoint,
    oaAirflowIn: number,
    oaAirflowOut: number,
    eaAirflowIn: number,
    eaAirflowOut: number,
    efficiency: number,
    pressure: number = STANDARD_PRESSURE
  ): { supplyAir: Partial<StatePoint>; results: ProcessResults } {
    
    // 風量比による効率補正
    const effectiveSupplyAirflow = this.getEffectiveAirflow(oaAirflowIn, oaAirflowOut);
    const effectiveExhaustAirflow = this.getEffectiveAirflow(eaAirflowIn, eaAirflowOut);
    const airflowRatio = this.getAirflowRatio(effectiveSupplyAirflow, effectiveExhaustAirflow);
    const effectiveEfficiency = (efficiency / 100) * airflowRatio;
    
    // エンタルピー交換
    const oaEnthalpy = outdoorAir.enthalpy!;
    const eaEnthalpy = exhaustAir.enthalpy!;
    
    // 処理後外気のエンタルピー
    // h_sa = h_oa + ε × (h_ea - h_oa)
    const saEnthalpy = oaEnthalpy + effectiveEfficiency * (eaEnthalpy - oaEnthalpy);
    
    // 絶対湿度も同様に交換
    const oaHumidity = outdoorAir.humidity!;
    const eaHumidity = exhaustAir.humidity!;
    
    const saHumidity = oaHumidity + effectiveEfficiency * (eaHumidity - oaHumidity);
    
    // 処理後外気の状態点
    const supplyAir = StatePointConverter.fromEnthalpyAndHumidity(
      saEnthalpy,
      saHumidity,
      pressure
    );
    
    // 交換熱量を計算
    const density = PsychrometricCalculator.airDensity(
      outdoorAir.dryBulbTemp!,
      outdoorAir.humidity!,
      pressure
    );
    const massFlow = effectiveSupplyAirflow * density;
    
    const enthalpyDiff = saEnthalpy - oaEnthalpy;
    const exchangedHeat = (massFlow * enthalpyDiff) / 3600; // [kW]
    
    const temperatureDiff = supplyAir.dryBulbTemp! - outdoorAir.dryBulbTemp!;
    const humidityDiff = saHumidity - oaHumidity;
    
    const results: ProcessResults = {
      totalHeat: exchangedHeat,
      sensibleHeat: 0, // 後で計算可能
      latentHeat: 0,   // 後で計算可能
      enthalpyDiff,
      temperatureDiff,
      humidityDiff,
    };
    
    return { supplyAir, results };
  }
  
  /**
   * 全熱交換器の計算（顕熱・潜熱効率を個別指定）
   * 
   * @param outdoorAir 外気状態点
   * @param exhaustAir 排気状態点
   * @param oaAirflow 外気風量 [m³/h]
   * @param eaAirflow 排気風量 [m³/h]
   * @param sensibleEfficiency 顕熱交換効率 [%]
   * @param latentEfficiency 潜熱交換効率 [%]
   * @param pressure 大気圧 [kPa]
   * @returns 処理後外気と計算結果
   */
  static calculateSeparateEfficiency(
    outdoorAir: StatePoint,
    exhaustAir: StatePoint,
    oaAirflowIn: number,
    oaAirflowOut: number,
    eaAirflowIn: number,
    eaAirflowOut: number,
    sensibleEfficiency: number,
    latentEfficiency: number,
    pressure: number = STANDARD_PRESSURE
  ): { supplyAir: Partial<StatePoint>; results: ProcessResults } {
    
    // 風量比による効率補正
    const effectiveSupplyAirflow = this.getEffectiveAirflow(oaAirflowIn, oaAirflowOut);
    const effectiveExhaustAirflow = this.getEffectiveAirflow(eaAirflowIn, eaAirflowOut);
    const airflowRatio = this.getAirflowRatio(effectiveSupplyAirflow, effectiveExhaustAirflow);
    const effectiveSensible = (sensibleEfficiency / 100) * airflowRatio;
    const effectiveLatent = (latentEfficiency / 100) * airflowRatio;
    
    // 温度交換（顕熱）
    const oaTemp = outdoorAir.dryBulbTemp!;
    const eaTemp = exhaustAir.dryBulbTemp!;
    
    const saTemp = oaTemp + effectiveSensible * (eaTemp - oaTemp);
    
    // 絶対湿度交換（潜熱）
    const oaHumidity = outdoorAir.humidity!;
    const eaHumidity = exhaustAir.humidity!;
    
    const saHumidity = oaHumidity + effectiveLatent * (eaHumidity - oaHumidity);
    
    // 処理後外気の状態点
    const supplyAir = StatePointConverter.fromDryBulbAndHumidity(
      saTemp,
      saHumidity,
      pressure
    );
    
    // 交換熱量を計算
    const density = PsychrometricCalculator.airDensity(
      outdoorAir.dryBulbTemp!,
      outdoorAir.humidity!,
      pressure
    );
    const massFlow = effectiveSupplyAirflow * density;
    
    const temperatureDiff = saTemp - oaTemp;
    const humidityDiff = saHumidity - oaHumidity;
    const enthalpyDiff = supplyAir.enthalpy! - outdoorAir.enthalpy!;
    
    // 顕熱・潜熱を個別に計算
    const sensibleHeat = (massFlow * 1.006 * temperatureDiff) / 3600; // [kW]
    const latentHeat = (massFlow * 2501 * humidityDiff) / 3600;       // [kW]
    
    const results: ProcessResults = {
      sensibleHeat,
      latentHeat,
      totalHeat: sensibleHeat + latentHeat,
      enthalpyDiff,
      temperatureDiff,
      humidityDiff,
    };
    
    return { supplyAir, results };
  }
  
  /**
   * 排気側の状態も計算（双方向の熱交換）
   * 
   * @param outdoorAir 外気状態点
   * @param exhaustAir 排気（室内空気）状態点
   * @param oaAirflow 外気風量 [m³/h]
   * @param eaAirflow 排気風量 [m³/h]
   * @param efficiency 全熱交換効率 [%]
   * @param pressure 大気圧 [kPa]
   * @returns 処理後外気と処理後排気
   */
  static calculateBothSides(
    outdoorAir: StatePoint,
    exhaustAir: StatePoint,
    oaAirflowIn: number,
    oaAirflowOut: number,
    eaAirflowIn: number,
    eaAirflowOut: number,
    efficiency: number,
    pressure: number = STANDARD_PRESSURE
  ): {
    supplyAir: Partial<StatePoint>;
    exhaustOut: Partial<StatePoint>;
    results: ProcessResults;
  } {
    
    // 給気側（外気→処理後外気）
    const { supplyAir, results } = this.calculateTotalHeat(
      outdoorAir,
      exhaustAir,
      oaAirflowIn,
      oaAirflowOut,
      eaAirflowIn,
      eaAirflowOut,
      efficiency,
      pressure
    );
    
    // 排気側（室内空気→処理後排気）
    // 熱の移動は逆向き
    const effectiveSupplyAirflow = this.getEffectiveAirflow(oaAirflowIn, oaAirflowOut);
    const effectiveExhaustAirflow = this.getEffectiveAirflow(eaAirflowIn, eaAirflowOut);
    const airflowRatio = this.getAirflowRatio(effectiveSupplyAirflow, effectiveExhaustAirflow);
    const effectiveEfficiency = (efficiency / 100) * airflowRatio;
    
    const eaEnthalpy = exhaustAir.enthalpy!;
    const oaEnthalpy = outdoorAir.enthalpy!;
    
    // 処理後排気のエンタルピー
    // h_eo = h_ea - ε × (h_ea - h_oa)
    const eoEnthalpy = eaEnthalpy - effectiveEfficiency * (eaEnthalpy - oaEnthalpy);
    
    const eaHumidity = exhaustAir.humidity!;
    const oaHumidity = outdoorAir.humidity!;
    
    const eoHumidity = eaHumidity - effectiveEfficiency * (eaHumidity - oaHumidity);
    
    const exhaustOut = StatePointConverter.fromEnthalpyAndHumidity(
      eoEnthalpy,
      eoHumidity,
      pressure
    );
    
    return { supplyAir, exhaustOut, results };
  }
  
  /**
   * 必要な全熱交換効率を逆算
   * 
   * @param outdoorAir 外気状態点
   * @param exhaustAir 排気状態点
   * @param targetSupplyAir 目標給気状態点
   * @returns 必要な全熱交換効率 [%]
   */
  static calculateRequiredEfficiency(
    outdoorAir: StatePoint,
    exhaustAir: StatePoint,
    targetSupplyAir: StatePoint
  ): number {
    
    // ε = (h_target - h_oa) / (h_ea - h_oa)
    const efficiency = 
      (targetSupplyAir.enthalpy! - outdoorAir.enthalpy!) /
      (exhaustAir.enthalpy! - outdoorAir.enthalpy!) * 100;
    
    // 0-100%の範囲にクリップ
    return Math.max(0, Math.min(100, efficiency));
  }
}
