export type Point = { x: number; y: number };

export function pointShape(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  options?: { lineColor?: string; fillColor?: string }
) {
  return {
    type: 'circle' as const,
    xref: 'x' as const,
    yref: 'y' as const,
    x0: x - radiusX,
    x1: x + radiusX,
    y0: y - radiusY,
    y1: y + radiusY,
    line: { width: 1, color: options?.lineColor ?? '#111' },
    fillcolor: options?.fillColor ?? 'rgba(0,0,0,0.2)',
  };
}

export function centerFromCircleShape(shape: { x0: number; x1: number; y0: number; y1: number }) {
  return {
    x: (shape.x0 + shape.x1) / 2,
    y: (shape.y0 + shape.y1) / 2,
  };
}
