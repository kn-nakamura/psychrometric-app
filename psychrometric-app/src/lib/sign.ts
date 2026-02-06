export type OperationMode = 'cooling' | 'heating';

export const toSignedCapacity = (mode: OperationMode, magnitudeKw: number): number => {
  const value = Math.abs(magnitudeKw);
  return mode === 'cooling' ? -value : value;
};

export const toDisplayMagnitude = (signedKw: number): number => Math.abs(signedKw);

export const inferModeFromSigned = (signedKw: number): OperationMode =>
  signedKw < 0 ? 'cooling' : 'heating';

export const calculateSHF = (
  sensibleKw: number,
  totalKw: number,
  eps: number = 1e-6
): number | null => {
  const totalMagnitude = Math.abs(totalKw);
  if (totalMagnitude <= eps) return null;
  const ratio = Math.abs(sensibleKw) / Math.max(totalMagnitude, eps);
  return Math.max(0, Math.min(1, ratio));
};
