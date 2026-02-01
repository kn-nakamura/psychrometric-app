import { PsychrometricCalculator } from '../psychrometric/properties';
import { TEMP_RANGE, CHART_CONSTANTS, STANDARD_PRESSURE } from '../psychrometric/constants';
import { Point } from './rhCurves';

/**
 * 湿球温度曲線を生成
 */
export class WetBulbCurveGenerator {
  
  /**
   * 指定した湿球温度の曲線を生成
   * 
   * @param wetBulbTemp 湿球温度 [°C]
   * @param tempMin 最低乾球温度 [°C]
   * @param tempMax 最高乾球温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 曲線の座標点配列
   */
  static generate(
    wetBulbTemp: number,
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX,
    pressure: number = STANDARD_PRESSURE
  ): Point[] {
    
    const points: Point[] = [];
    
    // 湿球温度は乾球温度以下なので、wetBulbTemp以上の温度で計算
    const startTemp = Math.max(tempMin, wetBulbTemp);
    
    for (let dryTemp = startTemp; dryTemp <= tempMax; dryTemp += 0.5) {
      try {
        // 乾球温度と湿球温度から絶対湿度を計算
        const humidity = PsychrometricCalculator.humidityFromWetBulb(
          dryTemp,
          wetBulbTemp,
          pressure
        );
        
        if (humidity >= 0 && humidity <= 0.05) {
          points.push({ x: dryTemp, y: humidity });
        }
      } catch (error) {
        continue;
      }
    }
    
    return points;
  }
  
  /**
   * 標準的な湿球温度曲線セットを生成
   * 
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @returns 複数の湿球温度曲線
   */
  static generateStandardSet(
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX
  ): Map<number, Point[]> {
    
    const curves = new Map<number, Point[]>();
    
    // 2°C刻みで湿球温度曲線を生成
    for (let wb = tempMin; 
         wb <= tempMax; 
         wb += CHART_CONSTANTS.WET_BULB_INTERVAL) {
      
      const points = this.generate(wb, tempMin, tempMax);
      if (points.length > 0) {
        curves.set(wb, points);
      }
    }
    
    return curves;
  }
}

/**
 * エンタルピー曲線を生成
 */
export class EnthalpyCurveGenerator {
  
  /**
   * 指定したエンタルピーの曲線を生成
   * 
   * @param enthalpy エンタルピー [kJ/kg']
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 曲線の座標点配列
   */
  static generate(
    enthalpy: number,
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX,
    pressure: number = STANDARD_PRESSURE
  ): Point[] {
    
    const points: Point[] = [];
    
    // エンタルピー一定の曲線を、絶対湿度を変化させて計算
    // h = cp × t + x × (L0 + cpv × t)
    // より x = (h - cp × t) / (L0 + cpv × t)
    
    for (let temp = tempMin; temp <= tempMax; temp += 0.5) {
      try {
        // エンタルピーと温度から絶対湿度を逆算
        // h = 1.006 × t + x × (2501 + 1.805 × t)
        // x = (h - 1.006 × t) / (2501 + 1.805 × t)
        
        const humidity = (enthalpy - 1.006 * temp) / (2501 + 1.805 * temp);
        
        if (humidity >= 0 && humidity <= 0.05) {
          // この点が物理的に妥当か確認（飽和以下か）
          const saturatedHumidity = PsychrometricCalculator.absoluteHumidity(
            temp,
            100,
            pressure
          );
          
          if (humidity <= saturatedHumidity * 1.01) { // 若干のマージン
            points.push({ x: temp, y: humidity });
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return points;
  }
  
  /**
   * 標準的なエンタルピー曲線セットを生成
   * 
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @returns 複数のエンタルピー曲線
   */
  static generateStandardSet(
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX
  ): Map<number, Point[]> {
    
    const curves = new Map<number, Point[]>();
    
    // 10 kJ/kg' 刻みでエンタルピー曲線を生成
    for (let h = 0; 
         h <= 120; 
         h += CHART_CONSTANTS.ENTHALPY_INTERVAL) {
      
      const points = this.generate(h, tempMin, tempMax);
      if (points.length > 0) {
        curves.set(h, points);
      }
    }
    
    return curves;
  }
}

/**
 * 比体積曲線を生成
 */
export class SpecificVolumeCurveGenerator {
  
  /**
   * 指定した比体積の曲線を生成
   * 
   * @param volume 比体積 [m³/kg']
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 曲線の座標点配列
   */
  static generate(
    volume: number,
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX,
    pressure: number = STANDARD_PRESSURE
  ): Point[] {
    
    const points: Point[] = [];
    
    // 比体積一定の曲線
    // v = R × T × (1 + 1.608 × x) / P
    // x = (v × P / (R × T) - 1) / 1.608
    
    for (let temp = tempMin; temp <= tempMax; temp += 0.5) {
      try {
        const T = temp + 273.15; // [K]
        const R = 0.287; // [kJ/(kg·K)]
        
        const humidity = (volume * pressure / (R * T) - 1) / 1.608;
        
        if (humidity >= 0 && humidity <= 0.05) {
          const saturatedHumidity = PsychrometricCalculator.absoluteHumidity(
            temp,
            100,
            pressure
          );
          
          if (humidity <= saturatedHumidity * 1.01) {
            points.push({ x: temp, y: humidity });
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return points;
  }
  
  /**
   * 標準的な比体積曲線セットを生成
   * 
   * @param tempMin 最低温度 [°C]
   * @param tempMax 最高温度 [°C]
   * @returns 複数の比体積曲線
   */
  static generateStandardSet(
    tempMin: number = TEMP_RANGE.MIN,
    tempMax: number = TEMP_RANGE.MAX
  ): Map<number, Point[]> {
    
    const curves = new Map<number, Point[]>();
    
    // 0.01 m³/kg' 刻みで比体積曲線を生成
    for (let v = 0.80; 
         v <= 0.95; 
         v += CHART_CONSTANTS.SPECIFIC_VOLUME_INTERVAL) {
      
      const points = this.generate(v, tempMin, tempMax);
      if (points.length > 0) {
        curves.set(Number(v.toFixed(3)), points);
      }
    }
    
    return curves;
  }
}
