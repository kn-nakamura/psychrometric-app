/**
 * 空気の状態点を表す型
 * 2つのパラメータが与えられれば、他のすべての物性値を計算可能
 */
export interface StatePoint {
  id: string;
  name: string;
  season: 'summer' | 'winter' | 'both';
  order: number; // プロセスの順序
  
  // 入力可能なパラメータ（いずれか2つを指定）
  dryBulbTemp?: number;      // 乾球温度 [°C]
  wetBulbTemp?: number;      // 湿球温度 [°C]
  relativeHumidity?: number; // 相対湿度 [%]
  humidity?: number;         // 絶対湿度 [kg/kg']
  
  // 計算により導出される値
  enthalpy?: number;        // エンタルピー [kJ/kg']
  dewPoint?: number;        // 露点温度 [°C]
  specificVolume?: number;  // 比体積 [m³/kg']
  
  // 表示用の色（季節やプロセスごとに変える）
  color?: string;
}

/**
 * 状態点の入力タイプ
 */
export type StatePointInputType =
  | 'dryBulb-relativeHumidity'
  | 'dryBulb-wetBulb'
  | 'dryBulb-humidity'
  | 'dryBulb-enthalpy';

/**
 * 状態点の検証結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
