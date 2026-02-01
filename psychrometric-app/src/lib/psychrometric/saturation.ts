import { TETENS_WATER, TETENS_ICE } from './constants';

/**
 * 飽和水蒸気圧を計算（Tetensの式）
 * 
 * @param temp 温度 [°C]
 * @returns 飽和水蒸気圧 [kPa]
 * 
 * 理論：
 * - 0°C以上: 水面上の飽和水蒸気圧
 * - 0°C未満: 氷面上の飽和水蒸気圧
 * 
 * 式: Ps = A × exp(B × t / (C + t))
 */
export function saturationPressure(temp: number): number {
  // 温度によって係数を切り替え
  const coeffs = temp >= 0 ? TETENS_WATER : TETENS_ICE;
  
  const { A, B, C } = coeffs;
  
  // Tetensの式
  const ps = A * Math.exp((B * temp) / (C + temp));
  
  return ps;
}

/**
 * 飽和水蒸気圧の微分値を計算
 * 湿球温度の反復計算で使用
 * 
 * @param temp 温度 [°C]
 * @returns dPs/dt [kPa/°C]
 */
export function saturationPressureDerivative(temp: number): number {
  const coeffs = temp >= 0 ? TETENS_WATER : TETENS_ICE;
  const { A, B, C } = coeffs;
  
  const ps = saturationPressure(temp);
  
  // d(Ps)/dt = Ps × B × C / (C + t)²
  const derivative = ps * B * C / Math.pow(C + temp, 2);
  
  return derivative;
}

/**
 * 部分水蒸気圧を計算
 * 
 * @param temp 温度 [°C]
 * @param rh 相対湿度 [%]
 * @returns 部分水蒸気圧 [kPa]
 */
export function vaporPressure(temp: number, rh: number): number {
  const ps = saturationPressure(temp);
  
  // Pv = φ × Ps
  // φ: 相対湿度 (0-1)
  const pv = (rh / 100) * ps;
  
  return pv;
}

/**
 * 相対湿度を計算
 * 
 * @param temp 温度 [°C]
 * @param pv 部分水蒸気圧 [kPa]
 * @returns 相対湿度 [%]
 */
export function relativeHumidity(temp: number, pv: number): number {
  const ps = saturationPressure(temp);
  
  // φ = Pv / Ps
  const rh = (pv / ps) * 100;
  
  // 範囲チェック（数値誤差対策）
  return Math.min(Math.max(rh, 0), 100);
}

/**
 * 露点温度を計算
 * 飽和水蒸気圧の逆関数（近似式）
 * 
 * @param pv 部分水蒸気圧 [kPa]
 * @returns 露点温度 [°C]
 */
export function dewPointTemperature(pv: number): number {
  // 簡易的な逆計算（水面上の式を使用）
  const { A, B, C } = TETENS_WATER;
  
  // Tetensの式の逆関数
  // t = C × ln(Pv/A) / (B - ln(Pv/A))
  const lnRatio = Math.log(pv / A);
  const tdew = (C * lnRatio) / (B - lnRatio);
  
  return tdew;
}
