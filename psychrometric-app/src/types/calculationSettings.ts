export interface TetensCoefficients {
  A: number;
  B: number;
  C: number;
}

export interface PsychrometricConstants {
  standardPressure: number;
  cpAir: number;
  cpVapor: number;
  latentHeat0c: number;
  molecularWeightRatio: number;
  rAir: number;
  wetBulbCoefficient: number;
  convergenceTolerance: number;
  maxIterations: number;
  tetensWater: TetensCoefficients;
  tetensIce: TetensCoefficients;
}

export interface CalculationSettings {
  constants: PsychrometricConstants;
}
