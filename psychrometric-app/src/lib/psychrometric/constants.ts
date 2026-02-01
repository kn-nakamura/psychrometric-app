import type { PsychrometricConstants } from '@/types/calculationSettings';

/**
 * 空気調和計算で使用する物性値定数
 */

/**
 * 標準大気圧 [kPa]
 */
export const STANDARD_PRESSURE = 101.325;

/**
 * 乾き空気の定圧比熱 [kJ/(kg·K)]
 */
export const CP_AIR = 1.006;

/**
 * 水蒸気の定圧比熱 [kJ/(kg·K)]
 */
export const CP_VAPOR = 1.805;

/**
 * 0°Cにおける水の蒸発潜熱 [kJ/kg]
 */
export const LATENT_HEAT_0C = 2501;

/**
 * 水蒸気と乾き空気の分子量比 [-]
 */
export const MOLECULAR_WEIGHT_RATIO = 0.622;

/**
 * 乾き空気の気体定数 [kJ/(kg·K)]
 */
export const R_AIR = 0.287;

/**
 * 絶対零度 [°C]
 */
export const ABSOLUTE_ZERO = -273.15;

/**
 * 計算用の温度範囲 [°C]
 */
export const TEMP_RANGE = {
  MIN: -20,
  MAX: 50,
} as const;

/**
 * 相対湿度の範囲 [%]
 */
export const RH_RANGE = {
  MIN: 0,
  MAX: 100,
} as const;

/**
 * 計算精度（反復計算の収束判定）
 */
export const CONVERGENCE_TOLERANCE = 0.001;

/**
 * 反復計算の最大回数
 */
export const MAX_ITERATIONS = 100;

/**
 * 湿球温度計算用の係数
 * 湿球温度計の熱収支式で使用
 */
export const WET_BULB_COEFFICIENT = 0.000662;

/**
 * Tetensの式の係数（飽和水蒸気圧計算用）
 * Ps = A × exp(B × t / (C + t))
 * 
 * 水面上（0°C以上）の係数
 */
export const TETENS_WATER = {
  A: 0.61078,  // [kPa]
  B: 17.27,    // [-]
  C: 237.3,    // [°C]
} as const;

/**
 * 氷面上（0°C未満）の係数
 */
export const TETENS_ICE = {
  A: 0.61078,  // [kPa]
  B: 21.875,   // [-]
  C: 265.5,    // [°C]
} as const;

/**
 * 空気密度の標準値 [kg/m³]
 * 20°C, 50%RH時の近似値
 */
export const AIR_DENSITY_STANDARD = 1.2;

/**
 * グラフ描画用の定数
 */
export const CHART_CONSTANTS = {
  // 相対湿度線を引く間隔 [%]
  RH_LINE_INTERVAL: 10,
  
  // 湿球温度線を引く間隔 [°C]
  WET_BULB_INTERVAL: 2,
  
  // エンタルピー線を引く間隔 [kJ/kg']
  ENTHALPY_INTERVAL: 10,
  
  // 比体積線を引く間隔 [m³/kg']
  SPECIFIC_VOLUME_INTERVAL: 0.01,
  
  // グリッド線の温度間隔 [°C]
  TEMP_GRID_INTERVAL: 5,
  
  // グリッド線の湿度間隔 [kg/kg']
  HUMIDITY_GRID_INTERVAL: 0.002,
} as const;

export const DEFAULT_PSYCHROMETRIC_CONSTANTS: PsychrometricConstants = {
  standardPressure: STANDARD_PRESSURE,
  cpAir: CP_AIR,
  cpVapor: CP_VAPOR,
  latentHeat0c: LATENT_HEAT_0C,
  molecularWeightRatio: MOLECULAR_WEIGHT_RATIO,
  rAir: R_AIR,
  wetBulbCoefficient: WET_BULB_COEFFICIENT,
  convergenceTolerance: CONVERGENCE_TOLERANCE,
  maxIterations: MAX_ITERATIONS,
  tetensWater: { ...TETENS_WATER },
  tetensIce: { ...TETENS_ICE },
};

export const resolvePsychrometricConstants = (
  constants?: Partial<PsychrometricConstants>
): PsychrometricConstants => ({
  ...DEFAULT_PSYCHROMETRIC_CONSTANTS,
  ...constants,
  tetensWater: {
    ...DEFAULT_PSYCHROMETRIC_CONSTANTS.tetensWater,
    ...constants?.tetensWater,
  },
  tetensIce: {
    ...DEFAULT_PSYCHROMETRIC_CONSTANTS.tetensIce,
    ...constants?.tetensIce,
  },
});
