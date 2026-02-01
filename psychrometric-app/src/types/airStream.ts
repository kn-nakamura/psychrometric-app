/**
 * 空気の流れの種類
 */
export type AirStreamType =
  | 'OA'    // 外気 (Outdoor Air)
  | 'SA'    // 給気 (Supply Air)
  | 'RA'    // 還気 (Return Air)
  | 'EA'    // 排気 (Exhaust Air)
  | 'REA'   // 還気排気 (Return Exhaust Air)
  | 'TEA'   // トイレ排気 (Toilet Exhaust Air)
  | 'Mixed' // 混合空気
  | 'Intermediate'; // 中間状態

/**
 * 空気の流れ
 */
export interface AirStream {
  id: string;
  name: string;
  type: AirStreamType;
  airflow: number;        // 風量 [m³/h]
  massFlow?: number;      // 質量流量 [kg/h] (計算値)
  statePointId: string;   // 紐づく状態点のID
  season: 'summer' | 'winter' | 'both';
}

/**
 * 風量バランスの検証結果
 */
export interface AirflowBalance {
  totalSupply: number;    // 総給気量 [m³/h]
  totalExhaust: number;   // 総排気量 [m³/h]
  totalIntake: number;    // 総取入外気量 [m³/h]
  totalReturn: number;    // 総還気量 [m³/h]
  isBalanced: boolean;
  errors: string[];
  warnings: string[];
}
