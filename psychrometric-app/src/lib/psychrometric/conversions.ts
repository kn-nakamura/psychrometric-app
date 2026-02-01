import { StatePoint, StatePointValueKey } from '@/types/psychrometric';
import { PsychrometricCalculator } from './properties';
import { CP_AIR, CP_VAPOR, LATENT_HEAT_0C, STANDARD_PRESSURE } from './constants';

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
   * 乾球温度とエンタルピーから状態点を完全に決定
   *
   * @param dryBulbTemp 乾球温度 [°C]
   * @param enthalpy エンタルピー [kJ/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromDryBulbAndEnthalpy(
    dryBulbTemp: number,
    enthalpy: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // h = cp,a × t + x × (L0 + cp,v × t) より
    const humidity =
      (enthalpy - CP_AIR * dryBulbTemp) /
      (LATENT_HEAT_0C + CP_VAPOR * dryBulbTemp);

    return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
  }

  /**
   * 乾球温度と露点温度から状態点を完全に決定
   *
   * @param dryBulbTemp 乾球温度 [°C]
   * @param dewPoint 露点温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromDryBulbAndDewPoint(
    dryBulbTemp: number,
    dewPoint: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    // 露点温度における飽和水蒸気圧から絶対湿度を計算
    const humidity = PsychrometricCalculator.absoluteHumidity(
      dewPoint,
      100,
      pressure
    );

    return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
  }

  /**
   * 湿球温度と相対湿度から状態点を完全に決定
   *
   * @param wetBulbTemp 湿球温度 [°C]
   * @param relativeHumidity 相対湿度 [%]
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromWetBulbAndRH(
    wetBulbTemp: number,
    relativeHumidity: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const dryBulbTemp = this.solveDryBulbFromWetBulbAndRH(
      wetBulbTemp,
      relativeHumidity,
      pressure
    );

    return this.fromDryBulbAndWetBulb(dryBulbTemp, wetBulbTemp, pressure);
  }

  /**
   * 湿球温度と絶対湿度から状態点を完全に決定
   *
   * @param wetBulbTemp 湿球温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromWetBulbAndHumidity(
    wetBulbTemp: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const dryBulbTemp = this.solveDryBulbFromWetBulbAndHumidity(
      wetBulbTemp,
      humidity,
      pressure
    );

    return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
  }

  /**
   * 湿球温度とエンタルピーから状態点を完全に決定
   *
   * @param wetBulbTemp 湿球温度 [°C]
   * @param enthalpy エンタルピー [kJ/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromWetBulbAndEnthalpy(
    wetBulbTemp: number,
    enthalpy: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const dryBulbTemp = this.solveDryBulbFromWetBulbAndEnthalpy(
      wetBulbTemp,
      enthalpy,
      pressure
    );
    const humidity = PsychrometricCalculator.humidityFromWetBulb(
      dryBulbTemp,
      wetBulbTemp,
      pressure
    );

    return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
  }

  /**
   * 相対湿度と絶対湿度から状態点を完全に決定
   *
   * @param relativeHumidity 相対湿度 [%]
   * @param humidity 絶対湿度 [kg/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromRHAndHumidity(
    relativeHumidity: number,
    humidity: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const dryBulbTemp = this.solveDryBulbFromHumidityAndRH(
      humidity,
      relativeHumidity,
      pressure
    );

    return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
  }

  /**
   * 相対湿度とエンタルピーから状態点を完全に決定
   *
   * @param relativeHumidity 相対湿度 [%]
   * @param enthalpy エンタルピー [kJ/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromRHAndEnthalpy(
    relativeHumidity: number,
    enthalpy: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const dryBulbTemp = this.solveDryBulbFromEnthalpyAndRH(
      enthalpy,
      relativeHumidity,
      pressure
    );

    return this.fromDryBulbAndRH(dryBulbTemp, relativeHumidity, pressure);
  }

  /**
   * 相対湿度と露点温度から状態点を完全に決定
   *
   * @param relativeHumidity 相対湿度 [%]
   * @param dewPoint 露点温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromRHAndDewPoint(
    relativeHumidity: number,
    dewPoint: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const humidity = PsychrometricCalculator.absoluteHumidity(dewPoint, 100, pressure);
    return this.fromRHAndHumidity(relativeHumidity, humidity, pressure);
  }

  /**
   * 絶対湿度とエンタルピーから状態点を完全に決定
   *
   * @param humidity 絶対湿度 [kg/kg']
   * @param enthalpy エンタルピー [kJ/kg']
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromHumidityAndEnthalpy(
    humidity: number,
    enthalpy: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    return this.fromEnthalpyAndHumidity(enthalpy, humidity, pressure);
  }

  /**
   * エンタルピーと露点温度から状態点を完全に決定
   *
   * @param enthalpy エンタルピー [kJ/kg']
   * @param dewPoint 露点温度 [°C]
   * @param pressure 大気圧 [kPa]
   * @returns 完全な状態点
   */
  static fromEnthalpyAndDewPoint(
    enthalpy: number,
    dewPoint: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    const humidity = PsychrometricCalculator.absoluteHumidity(dewPoint, 100, pressure);
    return this.fromEnthalpyAndHumidity(enthalpy, humidity, pressure);
  }

  static fromTwoValues(
    typeA: StatePointValueKey,
    valueA: number,
    typeB: StatePointValueKey,
    valueB: number,
    pressure: number = STANDARD_PRESSURE
  ): Partial<StatePoint> {
    if (typeA === typeB) {
      throw new Error('同じ項目を2つ指定することはできません');
    }

    const values: Partial<Record<StatePointValueKey, number>> = {
      [typeA]: valueA,
      [typeB]: valueB,
    };

    const dryBulbTemp = values.dryBulbTemp;
    const wetBulbTemp = values.wetBulbTemp;
    const relativeHumidity = values.relativeHumidity;
    const humidity = values.humidity;
    const enthalpy = values.enthalpy;
    const dewPoint = values.dewPoint;

    if (dryBulbTemp !== undefined && relativeHumidity !== undefined) {
      return this.fromDryBulbAndRH(dryBulbTemp, relativeHumidity, pressure);
    }

    if (dryBulbTemp !== undefined && wetBulbTemp !== undefined) {
      return this.fromDryBulbAndWetBulb(dryBulbTemp, wetBulbTemp, pressure);
    }

    if (dryBulbTemp !== undefined && humidity !== undefined) {
      return this.fromDryBulbAndHumidity(dryBulbTemp, humidity, pressure);
    }

    if (dryBulbTemp !== undefined && enthalpy !== undefined) {
      return this.fromDryBulbAndEnthalpy(dryBulbTemp, enthalpy, pressure);
    }

    if (dryBulbTemp !== undefined && dewPoint !== undefined) {
      return this.fromDryBulbAndDewPoint(dryBulbTemp, dewPoint, pressure);
    }

    if (wetBulbTemp !== undefined && relativeHumidity !== undefined) {
      return this.fromWetBulbAndRH(wetBulbTemp, relativeHumidity, pressure);
    }

    if (wetBulbTemp !== undefined && humidity !== undefined) {
      return this.fromWetBulbAndHumidity(wetBulbTemp, humidity, pressure);
    }

    if (wetBulbTemp !== undefined && enthalpy !== undefined) {
      return this.fromWetBulbAndEnthalpy(wetBulbTemp, enthalpy, pressure);
    }

    if (wetBulbTemp !== undefined && dewPoint !== undefined) {
      const derivedHumidity = PsychrometricCalculator.absoluteHumidity(
        dewPoint,
        100,
        pressure
      );
      return this.fromWetBulbAndHumidity(wetBulbTemp, derivedHumidity, pressure);
    }

    if (relativeHumidity !== undefined && humidity !== undefined) {
      return this.fromRHAndHumidity(relativeHumidity, humidity, pressure);
    }

    if (relativeHumidity !== undefined && enthalpy !== undefined) {
      return this.fromRHAndEnthalpy(relativeHumidity, enthalpy, pressure);
    }

    if (relativeHumidity !== undefined && dewPoint !== undefined) {
      return this.fromRHAndDewPoint(relativeHumidity, dewPoint, pressure);
    }

    if (humidity !== undefined && enthalpy !== undefined) {
      return this.fromEnthalpyAndHumidity(enthalpy, humidity, pressure);
    }

    if (humidity !== undefined && dewPoint !== undefined) {
      return this.fromDryBulbAndDewPoint(dewPoint, dewPoint, pressure);
    }

    if (enthalpy !== undefined && dewPoint !== undefined) {
      return this.fromEnthalpyAndDewPoint(enthalpy, dewPoint, pressure);
    }

    throw new Error('指定された組み合わせでは状態点を計算できません');
  }

  private static solveDryBulbFromHumidityAndRH(
    humidity: number,
    relativeHumidity: number,
    pressure: number
  ): number {
    let low = -50;
    let high = 100;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const rh = PsychrometricCalculator.relativeHumidity(mid, humidity, pressure);
      if (rh > relativeHumidity) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
  }

  private static solveDryBulbFromEnthalpyAndRH(
    enthalpy: number,
    relativeHumidity: number,
    pressure: number
  ): number {
    let low = -50;
    let high = 100;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const humidity = PsychrometricCalculator.absoluteHumidity(
        mid,
        relativeHumidity,
        pressure
      );
      const h = PsychrometricCalculator.enthalpy(mid, humidity);
      if (h > enthalpy) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
  }

  private static solveDryBulbFromWetBulbAndRH(
    wetBulbTemp: number,
    relativeHumidity: number,
    pressure: number
  ): number {
    let low = wetBulbTemp;
    let high = wetBulbTemp + 80;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const humidity = PsychrometricCalculator.humidityFromWetBulb(
        mid,
        wetBulbTemp,
        pressure
      );
      const rh = PsychrometricCalculator.relativeHumidity(mid, humidity, pressure);
      if (rh > relativeHumidity) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
  }

  private static solveDryBulbFromWetBulbAndHumidity(
    wetBulbTemp: number,
    humidity: number,
    pressure: number
  ): number {
    let low = wetBulbTemp;
    let high = wetBulbTemp + 80;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const guessHumidity = PsychrometricCalculator.humidityFromWetBulb(
        mid,
        wetBulbTemp,
        pressure
      );
      if (guessHumidity > humidity) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
  }

  private static solveDryBulbFromWetBulbAndEnthalpy(
    wetBulbTemp: number,
    enthalpy: number,
    pressure: number
  ): number {
    let low = wetBulbTemp;
    let high = wetBulbTemp + 80;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      const humidity = PsychrometricCalculator.humidityFromWetBulb(
        mid,
        wetBulbTemp,
        pressure
      );
      const h = PsychrometricCalculator.enthalpy(mid, humidity);
      if (h > enthalpy) {
        high = mid;
      } else {
        low = mid;
      }
    }
    return (low + high) / 2;
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

    // 乾球温度 + エンタルピー
    if (partial.dryBulbTemp !== undefined && partial.enthalpy !== undefined) {
      return this.fromDryBulbAndEnthalpy(
        partial.dryBulbTemp,
        partial.enthalpy,
        pressure
      );
    }

    // 乾球温度 + 露点温度
    if (partial.dryBulbTemp !== undefined && partial.dewPoint !== undefined) {
      return this.fromDryBulbAndDewPoint(
        partial.dryBulbTemp,
        partial.dewPoint,
        pressure
      );
    }

    // 湿球温度 + 相対湿度
    if (partial.wetBulbTemp !== undefined && partial.relativeHumidity !== undefined) {
      return this.fromWetBulbAndRH(
        partial.wetBulbTemp,
        partial.relativeHumidity,
        pressure
      );
    }

    // 湿球温度 + 絶対湿度
    if (partial.wetBulbTemp !== undefined && partial.humidity !== undefined) {
      return this.fromWetBulbAndHumidity(
        partial.wetBulbTemp,
        partial.humidity,
        pressure
      );
    }

    // 湿球温度 + エンタルピー
    if (partial.wetBulbTemp !== undefined && partial.enthalpy !== undefined) {
      return this.fromWetBulbAndEnthalpy(
        partial.wetBulbTemp,
        partial.enthalpy,
        pressure
      );
    }

    // 相対湿度 + 絶対湿度
    if (partial.relativeHumidity !== undefined && partial.humidity !== undefined) {
      return this.fromRHAndHumidity(
        partial.relativeHumidity,
        partial.humidity,
        pressure
      );
    }

    // 相対湿度 + エンタルピー
    if (partial.relativeHumidity !== undefined && partial.enthalpy !== undefined) {
      return this.fromRHAndEnthalpy(
        partial.relativeHumidity,
        partial.enthalpy,
        pressure
      );
    }

    // 相対湿度 + 露点温度
    if (partial.relativeHumidity !== undefined && partial.dewPoint !== undefined) {
      return this.fromRHAndDewPoint(
        partial.relativeHumidity,
        partial.dewPoint,
        pressure
      );
    }

    // エンタルピー + 露点温度
    if (partial.enthalpy !== undefined && partial.dewPoint !== undefined) {
      return this.fromEnthalpyAndDewPoint(
        partial.enthalpy,
        partial.dewPoint,
        pressure
      );
    }
    
    // 十分な情報がない場合はそのまま返す
    return partial;
  }
}
