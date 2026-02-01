import {
  STANDARD_PRESSURE,
  CP_AIR,
  CP_VAPOR,
  LATENT_HEAT_0C,
  MOLECULAR_WEIGHT_RATIO,
  R_AIR,
  WET_BULB_COEFFICIENT,
  CONVERGENCE_TOLERANCE,
  MAX_ITERATIONS,
} from './constants';
import {
  saturationPressure,
  saturationPressureDerivative,
  vaporPressure,
  relativeHumidity as calcRelativeHumidity,
  dewPointTemperature,
} from './saturation';

/**
 * 空気物性計算クラス
 */
export class PsychrometricCalculator {
  
  /**
   * 絶対湿度を計算
   * 
   * @param temp 乾球温度 [°C]
   * @param rh 相対湿度 [%]
   * @param pressure 大気圧 [kPa]
   * @returns 絶対湿度 [kg/kg']
   * 
   * 式: x = 0.622 × (φ × Ps) / (P - φ × Ps)
   */
  static absoluteHumidity(
    temp: number,
    rh: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    const pv = vaporPressure(temp, rh);
    
    // x = ε × Pv / (P - Pv)
    // ε = 0.622 (分子量比)
    const humidity = MOLECULAR_WEIGHT_RATIO * pv / (pressure - pv);
    
    return humidity;
  }
  
  /**
   * 絶対湿度から相対湿度を計算
   * 
   * @param temp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 相対湿度 [%]
   */
  static relativeHumidity(
    temp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    // x = ε × Pv / (P - Pv) より
    // Pv = x × P / (ε + x)
    const pv = humidity * pressure / (MOLECULAR_WEIGHT_RATIO + humidity);
    
    return calcRelativeHumidity(temp, pv);
  }
  
  /**
   * エンタルピーを計算
   * 
   * @param temp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @returns エンタルピー [kJ/kg']
   * 
   * 式: h = cp,a × t + x × (L0 + cp,v × t)
   * cp,a: 乾き空気の定圧比熱 = 1.006 kJ/(kg·K)
   * cp,v: 水蒸気の定圧比熱 = 1.805 kJ/(kg·K)
   * L0: 0°Cにおける蒸発潜熱 = 2501 kJ/kg
   */
  static enthalpy(temp: number, humidity: number): number {
    const h = CP_AIR * temp + humidity * (LATENT_HEAT_0C + CP_VAPOR * temp);
    return h;
  }
  
  /**
   * エンタルピーと絶対湿度から乾球温度を逆算
   * 
   * @param enthalpy エンタルピー [kJ/kg']
   * @param humidity 絶対湿度 [kg/kg']
   * @returns 乾球温度 [°C]
   */
  static temperatureFromEnthalpy(enthalpy: number, humidity: number): number {
    // h = cp,a × t + x × (L0 + cp,v × t)
    // h = cp,a × t + x × L0 + x × cp,v × t
    // h - x × L0 = t × (cp,a + x × cp,v)
    // t = (h - x × L0) / (cp,a + x × cp,v)
    
    const temp = (enthalpy - humidity * LATENT_HEAT_0C) / 
                 (CP_AIR + humidity * CP_VAPOR);
    
    return temp;
  }
  
  /**
   * 湿球温度を計算（反復法）
   * 
   * @param dryTemp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 湿球温度 [°C]
   * 
   * 理論:
   * 湿球温度計の熱収支式を解く
   * (Ps,wb - Pv) = (t - twb) / (A × (2501 + 1.805 × twb))
   * A = 0.000662 (湿球温度計定数)
   */
  static wetBulbTemperature(
    dryTemp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    // 初期推定値（露点温度を使用）
    const pv = humidity * pressure / (MOLECULAR_WEIGHT_RATIO + humidity);
    let twb = dewPointTemperature(pv);
    
    // Newton-Raphson法で反復計算
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const ps_wb = saturationPressure(twb);
      const dps_dt = saturationPressureDerivative(twb);
      
      // 熱収支式
      const f = (ps_wb - pv) - 
                (dryTemp - twb) / 
                (WET_BULB_COEFFICIENT * (LATENT_HEAT_0C + CP_VAPOR * twb));
      
      // 微分
      const df = dps_dt + 
                 1 / (WET_BULB_COEFFICIENT * (LATENT_HEAT_0C + CP_VAPOR * twb)) +
                 (dryTemp - twb) * CP_VAPOR / 
                 (WET_BULB_COEFFICIENT * Math.pow(LATENT_HEAT_0C + CP_VAPOR * twb, 2));
      
      // 更新
      const delta = f / df;
      twb -= delta;
      
      // 収束判定
      if (Math.abs(delta) < CONVERGENCE_TOLERANCE) {
        break;
      }
    }
    
    return twb;
  }
  
  /**
   * 湿球温度から絶対湿度を計算（反復法）
   * 
   * @param dryTemp 乾球温度 [°C]
   * @param wetTemp 湿球温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 絶対湿度 [kg/kg']
   */
  static humidityFromWetBulb(
    dryTemp: number,
    wetTemp: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    const ps_wb = saturationPressure(wetTemp);
    
    // 簡易式（Carrier式）
    // x = ((2501 - 2.381 × twb) × x_wb - 1.006 × (t - twb)) / (2501 + 1.805 × t - 4.186 × twb)
    // x_wb: 湿球温度における飽和絶対湿度
    
    const x_wb = MOLECULAR_WEIGHT_RATIO * ps_wb / (pressure - ps_wb);
    
    const humidity = 
      ((LATENT_HEAT_0C - 2.381 * wetTemp) * x_wb - CP_AIR * (dryTemp - wetTemp)) /
      (LATENT_HEAT_0C + CP_VAPOR * dryTemp - 4.186 * wetTemp);
    
    return Math.max(0, humidity); // 負の値にならないように
  }
  
  /**
   * 露点温度を計算
   * 
   * @param temp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 露点温度 [°C]
   */
  static dewPoint(
    temp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    const pv = humidity * pressure / (MOLECULAR_WEIGHT_RATIO + humidity);
    return dewPointTemperature(pv);
  }
  
  /**
   * 比体積を計算
   * 
   * @param temp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 比体積 [m³/kg']
   * 
   * 式: v = R × T × (1 + 1.608 × x) / P
   * R: 乾き空気の気体定数 = 0.287 kJ/(kg·K)
   * T: 絶対温度 [K]
   */
  static specificVolume(
    temp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    const T = temp + 273.15; // [K]
    
    // v = R × T × (1 + 1.608 × x) / P
    const volume = R_AIR * T * (1 + 1.608 * humidity) / pressure;
    
    return volume;
  }
  
  /**
   * 空気密度を計算
   * 
   * @param temp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 空気密度 [kg/m³]
   */
  static airDensity(
    temp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): number {
    const volume = this.specificVolume(temp, humidity, pressure);
    return 1 / volume;
  }
}
