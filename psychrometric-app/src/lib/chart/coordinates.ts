/**
 * 空気線図の座標変換
 * 
 * 実際の物性値（温度、絶対湿度）と
 * Canvas上のピクセル座標を相互変換
 */

export interface ChartDimensions {
  width: number;         // Canvas幅 [px]
  height: number;        // Canvas高さ [px]
  marginTop: number;     // 上マージン [px]
  marginRight: number;   // 右マージン [px]
  marginBottom: number;  // 下マージン [px]
  marginLeft: number;    // 左マージン [px]
}

export interface ChartRange {
  tempMin: number;       // 最低温度 [°C]
  tempMax: number;       // 最高温度 [°C]
  humidityMin: number;   // 最低絶対湿度 [kg/kg']
  humidityMax: number;   // 最高絶対湿度 [kg/kg']
}

export class ChartCoordinates {
  private dimensions: ChartDimensions;
  private range: ChartRange;
  
  constructor(dimensions: ChartDimensions, range: ChartRange) {
    this.dimensions = dimensions;
    this.range = range;
  }
  
  /**
   * プロット領域の幅を取得
   */
  get plotWidth(): number {
    return this.dimensions.width - this.dimensions.marginLeft - this.dimensions.marginRight;
  }
  
  /**
   * プロット領域の高さを取得
   */
  get plotHeight(): number {
    return this.dimensions.height - this.dimensions.marginTop - this.dimensions.marginBottom;
  }
  
  /**
   * 温度から X 座標に変換
   * 
   * @param temp 温度 [°C]
   * @returns X座標 [px]
   */
  tempToX(temp: number): number {
    const { tempMin, tempMax } = this.range;
    const { marginLeft } = this.dimensions;
    
    const ratio = (temp - tempMin) / (tempMax - tempMin);
    return marginLeft + ratio * this.plotWidth;
  }
  
  /**
   * X 座標から温度に変換
   * 
   * @param x X座標 [px]
   * @returns 温度 [°C]
   */
  xToTemp(x: number): number {
    const { tempMin, tempMax } = this.range;
    const { marginLeft } = this.dimensions;
    
    const ratio = (x - marginLeft) / this.plotWidth;
    return tempMin + ratio * (tempMax - tempMin);
  }
  
  /**
   * 絶対湿度から Y 座標に変換
   * 
   * @param humidity 絶対湿度 [kg/kg']
   * @returns Y座標 [px]
   */
  humidityToY(humidity: number): number {
    const { humidityMin, humidityMax } = this.range;
    const { marginTop } = this.dimensions;
    
    const ratio = (humidity - humidityMin) / (humidityMax - humidityMin);
    // Y軸は下が原点なので反転
    return this.dimensions.height - marginTop - ratio * this.plotHeight;
  }
  
  /**
   * Y 座標から絶対湿度に変換
   * 
   * @param y Y座標 [px]
   * @returns 絶対湿度 [kg/kg']
   */
  yToHumidity(y: number): number {
    const { humidityMin, humidityMax } = this.range;
    const { marginTop } = this.dimensions;
    
    // Y軸は下が原点なので反転
    const ratio = (this.dimensions.height - marginTop - y) / this.plotHeight;
    return humidityMin + ratio * (humidityMax - humidityMin);
  }
  
  /**
   * 物性値座標からCanvas座標に変換
   * 
   * @param temp 温度 [°C]
   * @param humidity 絶対湿度 [kg/kg']
   * @returns Canvas座標 {x, y} [px]
   */
  toCanvas(temp: number, humidity: number): { x: number; y: number } {
    return {
      x: this.tempToX(temp),
      y: this.humidityToY(humidity),
    };
  }
  
  /**
   * Canvas座標から物性値座標に変換
   * 
   * @param x X座標 [px]
   * @param y Y座標 [px]
   * @returns 物性値座標 {temp, humidity}
   */
  fromCanvas(x: number, y: number): { temp: number; humidity: number } {
    return {
      temp: this.xToTemp(x),
      humidity: this.yToHumidity(y),
    };
  }
  
  /**
   * マウス座標が有効なプロット領域内かチェック
   * 
   * @param x マウスX座標 [px]
   * @param y マウスY座標 [px]
   * @returns プロット領域内ならtrue
   */
  isInsidePlotArea(x: number, y: number): boolean {
    const { marginLeft, marginTop, width, height, marginRight, marginBottom } = this.dimensions;
    
    return (
      x >= marginLeft &&
      x <= width - marginRight &&
      y >= marginTop &&
      y <= height - marginBottom
    );
  }
  
  /**
   * 2点間の距離を計算（Canvas座標）
   * 
   * @param x1 点1のX座標
   * @param y1 点1のY座標
   * @param x2 点2のX座標
   * @param y2 点2のY座標
   * @returns 距離 [px]
   */
  distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
}

/**
 * デフォルトのチャート設定を生成
 * 
 * @param width Canvas幅
 * @param height Canvas高さ
 * @returns チャート設定
 */
export function createDefaultChartConfig(
  width: number,
  height: number
): { dimensions: ChartDimensions; range: ChartRange } {

  return {
    dimensions: {
      width,
      height,
      marginTop: 40,
      marginRight: 60,
      marginBottom: 60,
      marginLeft: 60,
    },
    range: {
      tempMin: -5,
      tempMax: 45,
      humidityMin: 0,
      humidityMax: 0.035,
    },
  };
}

/**
 * 状態点を含む動的なチャート設定を生成
 *
 * @param width Canvas幅
 * @param height Canvas高さ
 * @param points 状態点の配列（温度と湿度を含む）
 * @returns チャート設定
 */
export function createDynamicChartConfig(
  width: number,
  height: number,
  points: Array<{ dryBulbTemp?: number; humidity?: number }>
): { dimensions: ChartDimensions; range: ChartRange } {
  const defaultConfig = createDefaultChartConfig(width, height);

  // デフォルト範囲
  let tempMin = defaultConfig.range.tempMin;
  let tempMax = defaultConfig.range.tempMax;
  let humidityMin = defaultConfig.range.humidityMin;
  let humidityMax = defaultConfig.range.humidityMax;

  // 状態点を確認して範囲を拡張
  for (const point of points) {
    if (typeof point.dryBulbTemp === 'number') {
      if (point.dryBulbTemp < tempMin) {
        tempMin = Math.floor(point.dryBulbTemp / 5) * 5 - 5;
      }
      if (point.dryBulbTemp > tempMax) {
        tempMax = Math.ceil(point.dryBulbTemp / 5) * 5 + 5;
      }
    }
    if (typeof point.humidity === 'number') {
      if (point.humidity < humidityMin) {
        humidityMin = Math.floor(point.humidity / 0.005) * 0.005;
      }
      if (point.humidity > humidityMax) {
        humidityMax = Math.ceil(point.humidity / 0.005) * 0.005 + 0.005;
      }
    }
  }

  return {
    dimensions: defaultConfig.dimensions,
    range: {
      tempMin,
      tempMax,
      humidityMin,
      humidityMax,
    },
  };
}
