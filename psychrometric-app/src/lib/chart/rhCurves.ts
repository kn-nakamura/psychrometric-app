import { PsychrometricCalculator } from '../psychrometric/properties';
import { TEMP_RANGE, CHART_CONSTANTS, STANDARD_PRESSURE } from '../psychrometric/constants';

export interface Point {
  x: number; // 温度 [°C]
  y: number; // 絶対湿度 [kg/kg']
}

/**
 * 相対湿度曲線を生成
 */
export class RHCurveGenerator {
  
  /**
   * 指定した相対湿度の曲線を生成
   * 
   * @param rh 相対湿度 [%]
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @param step 温度刻み [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 曲線の座標点配列
   */
  static generate(
    rh: number,
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX,
    step: number = 0.5,
    pressure: number = STANDARD_PRESSURE
  ): Point[] {
    
    const points: Point[] = [];
    
    for (let temp = tempMin; temp <= tempMax; temp += step) {
      try {
        const humidity = PsychrometricCalculator.absoluteHumidity(
          temp,
          rh,
          pressure
        );
        
        // 物理的に妥当な範囲かチェック
        if (humidity >= 0 && humidity <= 0.05) {
          points.push({ x: temp, y: humidity });
        }
      } catch (error) {
        // エラーが発生した場合はスキップ
        continue;
      }
    }
    
    return points;
  }
  
  /**
   * 標準的な相対湿度曲線セットを生成
   * 
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @returns 複数のRH曲線
   */
  static generateStandardSet(
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX
  ): Map<number, Point[]> {
    
    const curves = new Map<number, Point[]>();
    
    // 10%, 20%, ..., 100% の曲線を生成
    for (let rh = CHART_CONSTANTS.RH_LINE_INTERVAL; 
         rh <= 100; 
         rh += CHART_CONSTANTS.RH_LINE_INTERVAL) {
      
      const points = this.generate(rh, tempMin, tempMax);
      curves.set(rh, points);
    }
    
    return curves;
  }
  
  /**
   * 飽和曲線（RH=100%）を生成
   * 
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @returns 飽和曲線の座標点
   */
  static generateSaturationCurve(
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX
  ): Point[] {
    
    return this.generate(100, tempMin, tempMax, 0.2);
  }
}
