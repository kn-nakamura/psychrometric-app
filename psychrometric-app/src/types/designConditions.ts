import { CalculationSettings } from './calculationSettings';

/**
 * プロジェクト情報
 */
export interface ProjectInfo {
  name: string;
  location: string;
  designer: string;
  date: string;
  description?: string;
}

/**
 * 外気条件
 */
export interface OutdoorConditions {
  summer: {
    dryBulbTemp: number;     // 乾球温度 [°C]
    relativeHumidity: number; // 相対湿度 [%]
    wetBulbTemp?: number;     // 湿球温度 [°C]
  };
  winter: {
    dryBulbTemp: number;
    relativeHumidity: number;
    wetBulbTemp?: number;
  };
  pressure: number;          // 大気圧 [kPa] (通常101.325)
}

/**
 * 室内条件
 */
export interface IndoorConditions {
  summer: {
    dryBulbTemp: number;
    relativeHumidity: number;
  };
  winter: {
    dryBulbTemp: number;
    relativeHumidity: number;
  };
}

/**
 * 風量条件
 */
export interface AirflowConditions {
  supplyAir: number;        // 給気量 [m³/h]
  supplyAirName: string;    // 給気量のパラメーター名
  outdoorAir: number;       // 外気量 [m³/h]
  outdoorAirName: string;   // 外気量のパラメーター名
  returnAir: number;        // 還気量 [m³/h]
  returnAirName: string;    // 還気量のパラメーター名
  exhaustAir: number;       // 排気量 [m³/h]
  exhaustAirName: string;   // 排気量のパラメーター名
  toiletExhaust?: number;   // トイレ排気量 [m³/h]
}

/**
 * 機器仕様
 */
export interface EquipmentSpecifications {
  heatExchanger?: {
    type: string;
    efficiency?: number;      // [%] 旧フィールド互換
    efficiencySummer?: number; // [%]
    efficiencyWinter?: number; // [%]
    sensibleEfficiency?: number;
    latentEfficiency?: number;
  };
  heatingCoil?: {
    type: string;            // 'hot water' | 'electric' | 'steam'
    capacity: number;        // [kW]
    enteringWaterTemp?: number;
    leavingWaterTemp?: number;
  };
  coolingCoil?: {
    type: string;            // 'chilled water' | 'DX'
    capacity: number;        // [kW]
    SHF: number;            // 顕熱比
    enteringWaterTemp?: number;
    leavingWaterTemp?: number;
  };
  humidifier?: {
    type: string;            // 'steam' | 'water spray' | 'ultrasonic'
    capacity: number;        // [kg/h]
  };
  fan?: {
    type: string;            // 'centrifugal' | 'axial'
    power: number;          // [kW]
    staticPressure: number; // [Pa]
    efficiency: number;     // [%]
  };
}

/**
 * 設計条件（全体）
 */
export interface DesignConditions {
  project: ProjectInfo;
  outdoor: OutdoorConditions;
  indoor: IndoorConditions;
  airflow: AirflowConditions;
  equipment: EquipmentSpecifications;
  calculation: CalculationSettings;
}
