/**
 * 空調プロセスの種類
 */
export type ProcessType =
  | 'heating'        // 加熱
  | 'cooling'        // 冷却
  | 'humidifying'    // 加湿
  | 'dehumidifying'  // 除湿
  | 'mixing'         // 混合
  | 'heatExchange'   // 全熱交換
  | 'fanHeating'     // ファン発熱
  | 'airSupply';     // 空調吹き出し

/**
 * プロセス
 */
export interface Process {
  id: string;
  name: string;
  type: ProcessType;
  season: 'summer' | 'winter' | 'both';
  order: number; // 実行順序
  
  // 入力・出力の状態点
  fromPointId: string;
  toPointId: string;
  
  // プロセス固有のパラメータ
  parameters: ProcessParameters;
  
  // 計算結果
  results?: ProcessResults;
}

/**
 * プロセスパラメータ
 */
export interface ProcessParameters {
  // 共通
  airflow?: number;           // 風量 [m³/h]
  
  // 加熱・冷却
  capacity?: number;          // 能力 [kW]
  SHF?: number;              // 顕熱比 [-]
  waterTempDiff?: number;     // 温度差 [℃] (default: 7)
  waterFlowRate?: number;     // 水量 [L/min]
  
  // 加湿
  humidifyingCapacity?: number; // 加湿量 [kg/h]
  humidifierType?: 'steam' | 'water'; // 加湿方式
  
  // 混合
  mixingRatios?: {
    stream1: { pointId: string; airflow?: number; ratio?: number };
    stream2: { pointId: string; airflow?: number; ratio?: number };
  };
  
  // 全熱交換
  heatExchangeEfficiency?: number;    // 全熱交換効率 [%]
  sensibleEfficiency?: number;        // 顕熱交換効率 [%]
  latentEfficiency?: number;          // 潜熱交換効率 [%]
  exhaustPointId?: string;            // 排気側の状態点
  supplyAirflow?: number;             // 供給側（外気）風量 [m³/h]
  exhaustAirflow?: number;            // 排気側風量 [m³/h]
  supplyAirflowIn?: number;           // 供給側（外気）入口風量 [m³/h]
  supplyAirflowOut?: number;          // 供給側（外気）出口風量 [m³/h]
  exhaustAirflowIn?: number;          // 排気側入口風量 [m³/h]
  exhaustAirflowOut?: number;         // 排気側出口風量 [m³/h]
  
  // ファン
  fanPower?: number;          // ファン動力 [kW]
  fanEfficiency?: number;     // ファン効率 [%]
}

/**
 * プロセス計算結果
 */
export interface ProcessResults {
  // 熱量
  sensibleHeat?: number;      // 顕熱 [kW]
  latentHeat?: number;        // 潜熱 [kW]
  totalHeat?: number;         // 全熱 [kW]
  
  // エンタルピー差
  enthalpyDiff?: number;      // [kJ/kg']
  
  // 湿度変化
  humidityDiff?: number;      // [kg/kg']
  
  // 温度変化
  temperatureDiff?: number;   // [°C]
}
