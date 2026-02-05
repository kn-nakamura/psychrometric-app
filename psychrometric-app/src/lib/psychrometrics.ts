export const CP_DA = 1.006; // [kJ/(kgDA·K)]
export const CP_V = 1.86; // [kJ/(kgWV·K)]
export const L0 = 2501; // [kJ/kgWV]
export const R_DA = 0.287042; // [kPa·m3/(kg·K)]

export const enthalpy = (dryBulbC: number, humidityRatio: number): number =>
  CP_DA * dryBulbC + humidityRatio * (L0 + CP_V * dryBulbC);

export const humidityRatioFromEnthalpy = (dryBulbC: number, h: number): number =>
  (h - CP_DA * dryBulbC) / (L0 + CP_V * dryBulbC);

export const cpMoistAir = (humidityRatioAverage: number): number =>
  CP_DA + humidityRatioAverage * CP_V;

export const specificVolume = (
  dryBulbC: number,
  humidityRatio: number,
  pressureKpa: number = 101.325
): number => {
  const tempK = dryBulbC + 273.15;
  return (R_DA * tempK * (1 + 1.6078 * humidityRatio)) / pressureKpa;
};
