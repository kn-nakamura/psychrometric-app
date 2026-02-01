import type { PsychrometricConstants } from '@/types/calculationSettings';
import { resolvePsychrometricConstants } from './constants';
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
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    const pv = vaporPressure(temp, rh, resolved);
    
    // x = ε × Pv / (P - Pv)
    // ε = 0.622 (分子量比)
    const humidity =
      resolved.molecularWeightRatio * pv / (effectivePressure - pv);
    
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
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    // x = ε × Pv / (P - Pv) より
    // Pv = x × P / (ε + x)
    const pv = humidity * effectivePressure / (resolved.molecularWeightRatio + humidity);
    
    return calcRelativeHumidity(temp, pv, resolved);
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
  static enthalpy(
    temp: number,
    humidity: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const h =
      resolved.cpAir * temp + humidity * (resolved.latentHeat0c + resolved.cpVapor * temp);
    return h;
  }
  
  /**
   * エンタルピーと絶対湿度から乾球温度を逆算
   * 
   * @param enthalpy エンタルピー [kJ/kg']
   * @param humidity 絶対湿度 [kg/kg']
   * @returns 乾球温度 [°C]
   */
  static temperatureFromEnthalpy(
    enthalpy: number,
    humidity: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    // h = cp,a × t + x × (L0 + cp,v × t)
    // h = cp,a × t + x × L0 + x × cp,v × t
    // h - x × L0 = t × (cp,a + x × cp,v)
    // t = (h - x × L0) / (cp,a + x × cp,v)
    
    const resolved = resolvePsychrometricConstants(constants);
    const temp = (enthalpy - humidity * resolved.latentHeat0c) /
                 (resolved.cpAir + humidity * resolved.cpVapor);
    
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
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    // 初期推定値（露点温度を使用）
    const pv =
      humidity * effectivePressure / (resolved.molecularWeightRatio + humidity);
    let twb = dewPointTemperature(pv, resolved);
    
    // Newton-Raphson法で反復計算
    for (let i = 0; i < resolved.maxIterations; i++) {
      const ps_wb = saturationPressure(twb, resolved);
      const dps_dt = saturationPressureDerivative(twb, resolved);
      
      // 熱収支式
      const f = (ps_wb - pv) - 
                (dryTemp - twb) / 
                (resolved.wetBulbCoefficient *
                  (resolved.latentHeat0c + resolved.cpVapor * twb));
      
      // 微分
      const df = dps_dt + 
                 1 / (resolved.wetBulbCoefficient *
                  (resolved.latentHeat0c + resolved.cpVapor * twb)) +
                 (dryTemp - twb) * resolved.cpVapor /
                 (resolved.wetBulbCoefficient *
                  Math.pow(resolved.latentHeat0c + resolved.cpVapor * twb, 2));
      
      // 更新
      const delta = f / df;
      twb -= delta;
      
      // 収束判定
      if (Math.abs(delta) < resolved.convergenceTolerance) {
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
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    const ps_wb = saturationPressure(wetTemp, resolved);
    
    // 簡易式（Carrier式）
    // x = ((2501 - 2.381 × twb) × x_wb - 1.006 × (t - twb)) / (2501 + 1.805 × t - 4.186 × twb)
    // x_wb: 湿球温度における飽和絶対湿度
    
    const x_wb =
      resolved.molecularWeightRatio * ps_wb / (effectivePressure - ps_wb);
    
    const humidity = 
      ((resolved.latentHeat0c - 2.381 * wetTemp) * x_wb -
        resolved.cpAir * (dryTemp - wetTemp)) /
      (resolved.latentHeat0c + resolved.cpVapor * dryTemp - 4.186 * wetTemp);
    
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
    _temp: number,
    humidity: number,
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    const pv =
      humidity * effectivePressure / (resolved.molecularWeightRatio + humidity);
    return dewPointTemperature(pv, resolved);
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
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const resolved = resolvePsychrometricConstants(constants);
    const effectivePressure = pressure ?? resolved.standardPressure;
    const T = temp + 273.15; // [K]
    
    // v = R × T × (1 + 1.608 × x) / P
    const volume = resolved.rAir * T * (1 + 1.608 * humidity) / effectivePressure;
    
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
    pressure?: number,
    constants?: Partial<PsychrometricConstants>
  ): number {
    const volume = this.specificVolume(temp, humidity, pressure, constants);
    return 1 / volume;
  }
}
