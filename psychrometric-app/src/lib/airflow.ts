import { StatePoint } from '@/types/psychrometric';
import { specificVolume } from './psychrometrics';

export const massFlowFromAirflow = (
  airflowM3h: number,
  point: Pick<StatePoint, 'dryBulbTemp' | 'humidity'>,
  pressureKpa: number = 101.325
): number => {
  if (!Number.isFinite(airflowM3h) || airflowM3h <= 0) return 0;
  if (point.dryBulbTemp === undefined || point.humidity === undefined) return 0;
  const v = specificVolume(point.dryBulbTemp, point.humidity, pressureKpa);
  if (!Number.isFinite(v) || v <= 0) return 0;
  const vdot = airflowM3h / 3600;
  return vdot / v;
};
