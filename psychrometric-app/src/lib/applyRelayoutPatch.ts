export function applyRelayoutPatch<T extends Record<string, unknown>>(
  layout: T,
  relayoutData: Record<string, unknown>
): T {
  const next = { ...layout } as T & { shapes?: Array<Record<string, unknown>> };
  const shapes = Array.isArray(next.shapes) ? next.shapes.map((shape) => ({ ...shape })) : [];
  next.shapes = shapes;

  Object.entries(relayoutData || {}).forEach(([key, value]) => {
    const match = /^shapes\[(\d+)\]\.(x0|x1|y0|y1)$/.exec(key);
    if (match) {
      const index = Number(match[1]);
      const prop = match[2];
      if (!shapes[index]) {
        shapes[index] = {};
      }
      shapes[index][prop] = value;
      return;
    }

    if (key === 'shapes' && Array.isArray(value)) {
      next.shapes = value;
    }
  });

  return next as T;
}
