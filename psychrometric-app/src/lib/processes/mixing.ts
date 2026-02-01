import { StatePoint } from '@/types/psychrometric';
import { ProcessResults } from '@/types/process';
import { StatePointConverter } from '../psychrometric/conversions';
import { PsychrometricCalculator } from '../psychrometric/properties';
import { STANDARD_PRESSURE } from '../psychrometric/constants';
import { HeatExchangeProcess } from './heatExchange';

/**
 * 混合プロセスの計算
 * 
 * 特徴:
 * - 2つ以上の空気流を混合
 * - エンタルピーと絶対湿度の風量加重平均
 * - 混合点は直線上に位置
 */
export class MixingProcess {
  
  /**
   * 2つの空気流を混合
   * 
   * @param point1 空気流1の状態点
   * @param airflow1 空気流1の風量 [m³/h]
   * @param point2 空気流2の状態点
   * @param airflow2 空気流2の風量 [m³/h]
   * @param pressure 大気圧 [kPa]
   * @returns 混合後の状態点と計算結果
   */
  static mixTwoStreams(
    point1: StatePoint,
    airflow1: number,
    point2: StatePoint,
    airflow2: number,
    pressure: number = STANDARD_PRESSURE
  ): { mixedPoint: Partial<StatePoint>; results: ProcessResults } {
    
    // 質量流量を計算
    const density1 = PsychrometricCalculator.airDensity(
      point1.dryBulbTemp!,
      point1.humidity!,
      pressure
    );
    const massFlow1 = airflow1 * density1; // [kg/h]
    
    const density2 = PsychrometricCalculator.airDensity(
      point2.dryBulbTemp!,
      point2.humidity!,
      pressure
    );
    const massFlow2 = airflow2 * density2; // [kg/h]
    
    const totalMassFlow = massFlow1 + massFlow2;
    
    // エンタルピーの加重平均
    const mixedEnthalpy = 
      (massFlow1 * point1.enthalpy! + massFlow2 * point2.enthalpy!) / totalMassFlow;
    
    // 絶対湿度の加重平均
    const mixedHumidity = 
      (massFlow1 * point1.humidity! + massFlow2 * point2.humidity!) / totalMassFlow;
    
    // 混合後の状態点を計算
    const mixedPoint = StatePointConverter.fromEnthalpyAndHumidity(
      mixedEnthalpy,
      mixedHumidity,
      pressure
    );
    
    // 計算結果
    const results: ProcessResults = {
      totalHeat: 0, // 混合は熱の出入りなし
      sensibleHeat: 0,
      latentHeat: 0,
      enthalpyDiff: 0,
      humidityDiff: 0,
      temperatureDiff: 0,
    };
    
    return { mixedPoint, results };
  }
  
  /**
   * 複数の空気流を混合
   * 
   * @param streams 空気流の配列 {point, airflow}
   * @param pressure 大気圧 [kPa]
   * @returns 混合後の状態点
   */
  static mixMultipleStreams(
    streams: Array<{ point: StatePoint; airflow: number }>,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    
    if (streams.length === 0) {
      throw new Error('混合する空気流が指定されていません');
    }
    
    if (streams.length === 1) {
      return streams[0].point;
    }
    
    // 各流れの質量流量を計算
    const massFlows = streams.map(({ point, airflow }) => {
      const density = PsychrometricCalculator.airDensity(
        point.dryBulbTemp!,
        point.humidity!,
        pressure
      );
      return airflow * density;
    });
    
    const totalMassFlow = massFlows.reduce((sum, mf) => sum + mf, 0);
    
    // エンタルピーの加重平均
    const mixedEnthalpy = streams.reduce((sum, { point }, index) => {
      return sum + massFlows[index] * point.enthalpy!;
    }, 0) / totalMassFlow;
    
    // 絶対湿度の加重平均
    const mixedHumidity = streams.reduce((sum, { point }, index) => {
      return sum + massFlows[index] * point.humidity!;
    }, 0) / totalMassFlow;
    
    // 混合後の状態点
    return StatePointConverter.fromEnthalpyAndHumidity(
      mixedEnthalpy,
      mixedHumidity,
      pressure
    );
  }
  
  /**
   * 混合比率を指定して混合
   * 
   * @param point1 空気流1の状態点
   * @param point2 空気流2の状態点
   * @param ratio1 空気流1の比率 (0-1)
   * @param pressure 大気圧 [kPa]
   * @returns 混合後の状態点
   * 
   * 例: ratio1=0.3 → 30%がpoint1, 70%がpoint2
   */
  static mixByRatio(
    point1: StatePoint,
    point2: StatePoint,
    ratio1: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    
    const ratio2 = 1 - ratio1;
    
    // エンタルピーの加重平均
    const mixedEnthalpy = ratio1 * point1.enthalpy! + ratio2 * point2.enthalpy!;
    
    // 絶対湿度の加重平均
    const mixedHumidity = ratio1 * point1.humidity! + ratio2 * point2.humidity!;
    
    // 混合後の状態点
    return StatePointConverter.fromEnthalpyAndHumidity(
      mixedEnthalpy,
      mixedHumidity,
      pressure
    );
  }

  /**
   * 全熱交換器を考慮した混合
   *
   * @param stream1 外気などの混合流1
   * @param stream2 混合流2（還気など）
   * @param ratio1 stream1の比率 (0-1)
   * @param heatExchangeEfficiency 全熱交換効率 [%]
   * @param exhaustPoint 排気側状態点
   * @param pressure 大気圧 [kPa]
   * @returns 混合後の状態点と計算結果
   */
  static mixWithHeatExchange(
    stream1: StatePoint,
    stream2: StatePoint,
    ratio1: number,
    heatExchangeEfficiency: number,
    exhaustPoint: StatePoint,
    pressure: number = STANDARD_PRESSURE
  ): { mixedPoint: Partial<StatePoint>; results: ProcessResults } {
    const normalizedRatio1 = Math.max(0, Math.min(1, ratio1));
    const ratio2 = Math.max(0, Math.min(1, 1 - normalizedRatio1));
    const { supplyAir } = HeatExchangeProcess.calculateTotalHeat(
      stream1,
      exhaustPoint,
      normalizedRatio1,
      ratio2,
      heatExchangeEfficiency,
      pressure
    );

    return this.mixTwoStreams(
      supplyAir as StatePoint,
      normalizedRatio1,
      stream2,
      ratio2,
      pressure
    );
  }
  
  /**
   * 混合比を逆算（目標状態から必要な混合比を求める）
   * 
   * @param point1 空気流1の状態点
   * @param point2 空気流2の状態点
   * @param targetPoint 目標状態点
   * @returns 空気流1の必要比率
   */
  static calculateRequiredRatio(
    point1: StatePoint,
    point2: StatePoint,
    targetPoint: StatePoint
  ): number {
    
    // エンタルピーを基準に計算
    // h_target = ratio1 × h1 + (1 - ratio1) × h2
    // h_target = ratio1 × h1 + h2 - ratio1 × h2
    // h_target - h2 = ratio1 × (h1 - h2)
    // ratio1 = (h_target - h2) / (h1 - h2)
    
    const ratio1 = 
      (targetPoint.enthalpy! - point2.enthalpy!) / 
      (point1.enthalpy! - point2.enthalpy!);
    
    // 0-1の範囲にクリップ
    return Math.max(0, Math.min(1, ratio1));
  }
}
