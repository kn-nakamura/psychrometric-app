import { StatePoint } from '@/types/psychrometric';
import { PsychrometricCalculator } from './properties';
import { STANDARD_PRESSURE } from './constants';

/**
 * 状態点の相互変換を行うクラス
 * 2つのパラメータから残りすべての物性値を計算
 */
export class StatePointConverter {
  
  /**
   * 乾球温度と相対湿度から状態点を完全に決定
   * 
   * @param dryBulbTemp 乾球温度 [°C]
   * @param relativeHumidity 相対湿度 [%]
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromDryBulbAndRH(
    dryBulbTemp: number,
    relativeHumidity: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // 絶対湿度を計算
    const humidity = PsychrometricCalculator.absoluteHumidity(
      dryBulbTemp,
      relativeHumidity,
      pressure
    );
    
    // エンタルピーを計算
    const enthalpy = PsychrometricCalculator.enthalpy(dryBulbTemp, humidity);
    
    // 湿球温度を計算
    const wetBulbTemp = PsychrometricCalculator.wetBulbTemperature(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // 露点温度を計算
    const dewPoint = PsychrometricCalculator.dewPoint(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // 比体積を計算
    const specificVolume = PsychrometricCalculator.specificVolume(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    return {
      dryBulbTemp,
      relativeHumidity,
      humidity,
      enthalpy,
      wetBulbTemp,
      dewPoint,
      specificVolume,
    };
  }
  
  /**
   * 乾球温度と湿球温度から状態点を完全に決定
   * 
   * @param dryBulbTemp 乾球温度 [°C]
   * @param wetBulbTemp 湿球温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromDryBulbAndWetBulb(
    dryBulbTemp: number,
    wetBulbTemp: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // 湿球温度から絶対湿度を計算
    const humidity = PsychrometricCalculator.humidityFromWetBulb(
      dryBulbTemp,
      wetBulbTemp,
      pressure
    );
    
    // 相対湿度を計算
    const relativeHumidity = PsychrometricCalculator.relativeHumidity(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // エンタルピーを計算
    const enthalpy = PsychrometricCalculator.enthalpy(dryBulbTemp, humidity);
    
    // 露点温度を計算
    const dewPoint = PsychrometricCalculator.dewPoint(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // 比体積を計算
    const specificVolume = PsychrometricCalculator.specificVolume(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    return {
      dryBulbTemp,
      wetBulbTemp,
      relativeHumidity,
      humidity,
      enthalpy,
      dewPoint,
      specificVolume,
    };
  }
  
  /**
   * 乾球温度と絶対湿度から状態点を完全に決定
   * 
   * @param dryBulbTemp 乾球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromDryBulbAndHumidity(
    dryBulbTemp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // 相対湿度を計算
    const relativeHumidity = PsychrometricCalculator.relativeHumidity(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // エンタルピーを計算
    const enthalpy = PsychrometricCalculator.enthalpy(dryBulbTemp, humidity);
    
    // 湿球温度を計算
    const wetBulbTemp = PsychrometricCalculator.wetBulbTemperature(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // 露点温度を計算
    const dewPoint = PsychrometricCalculator.dewPoint(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    // 比体積を計算
    const specificVolume = PsychrometricCalculator.specificVolume(
      dryBulbTemp,
      humidity,
      pressure
    );
    
    return {
      dryBulbTemp,
      humidity,
      relativeHumidity,
      enthalpy,
      wetBulbTemp,
      dewPoint,
      specificVolume,
    };
  }
  
  /**
   * エンタルピーと絶対湿度から状態点を完全に決定
   * 
   * @param enthalpy エンタルピー [kJ/kg']
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromEnthalpyAndHumidity(
    enthalpy: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // エンタルピーと絶対湿度から乾球温度を逆算
    const dryBulbTemp = PsychrometricCalculator.temperatureFromEnthalpy(
      enthalpy,
      humidity
    );
    
    // 残りのパラメータを計算
    return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
  }
  
  /**
   * 状態点を完全な形に補完
   * 不足している物性値を計算で補う
   * 
   * @param partial 部分的な状態点
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static completeStatePoint(
    partial: Partial<StatePoint>,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // 乾球温度 + 相対湿度
    if (partial.dryBulbTemp !== undefined && partial.relativeHumidity !== undefined) {
      return this.fromDryBulbAndRH(
        partial.dryBulbTemp,
        partial.relativeHumidity,
        pressure
      );
    }
    
    // 乾球温度 + 湿球温度
    if (partial.dryBulbTemp !== undefined && partial.wetBulbTemp !== undefined) {
      return this.fromDryBulbAndWetBulb(
        partial.dryBulbTemp,
        partial.wetBulbTemp,
        pressure
      );
    }
    
    // 乾球温度 + 絶対湿度
    if (partial.dryBulbTemp !== undefined && partial.humidity !== undefined) {
      return this.fromDryBulbAndHumidity(
        partial.dryBulbTemp,
        partial.humidity,
        pressure
      );
    }
    
    // エンタルピー + 絶対湿度
    if (partial.enthalpy !== undefined && partial.humidity !== undefined) {
      return this.fromEnthalpyAndHumidity(
        partial.enthalpy,
        partial.humidity,
        pressure
      );
    }
    
    // 十分な情報がない場合はそのまま返す
    return partial;
  }
}
