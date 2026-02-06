import { enthalpy, cpMoistAir } from './psychrometrics';

interface CapacityInputPoint {
  dryBulbTemp: number;
  humidity: number;
}

interface CapacitySplit {
  totalKw: number;
  sensibleKw: number;
  latentKw: number;
  enthalpyDiff: number;
}

export const splitCapacity = (
  massFlowKgDaS: number,
  inlet: CapacityInputPoint,
  outlet: CapacityInputPoint
): CapacitySplit => {
  const h1 = enthalpy(inlet.dryBulbTemp, inlet.humidity);
  const h2 = enthalpy(outlet.dryBulbTemp, outlet.humidity);
  const enthalpyDiff = h2 - h1;
  const totalKw = massFlowKgDaS * enthalpyDiff;
  const humidityAverage = (inlet.humidity + outlet.humidity) / 2;
  const cpMoist = cpMoistAir(humidityAverage);
  const sensibleKw = massFlowKgDaS * cpMoist * (outlet.dryBulbTemp - inlet.dryBulbTemp);
  const latentKw = totalKw - sensibleKw;

  return {
    totalKw,
    sensibleKw,
    latentKw,
    enthalpyDiff,
  };
};
