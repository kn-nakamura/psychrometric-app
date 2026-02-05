import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';
import { ChartCoordinates, ChartRange, createDynamicChartConfig } from '@/lib/chart/coordinates';
import { RHCurveGenerator } from '@/lib/chart/rhCurves';
import { WetBulbCurveGenerator, EnthalpyCurveGenerator } from '@/lib/chart/curves';

interface PsychrometricChartProps {
  width?: number;
  height?: number;
  statePoints: StatePoint[];
  processes: Process[];
  activeSeason: 'summer' | 'winter' | 'both';
  selectedPointId?: string | null;
  onPointClick?: (pointId: string) => void;
  onPointMove?: (pointId: string, temp: number, humidity: number) => void;
}

export interface PsychrometricChartRef {
  getCanvas: () => HTMLCanvasElement | null;
}

interface RenderPsychrometricChartOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  statePoints: StatePoint[];
  processes: Process[];
  activeSeason: 'summer' | 'winter' | 'both';
  selectedPointId?: string | null;
  resolutionScale?: number;
}

interface RenderPsychrometricChartSvgOptions {
  width: number;
  height: number;
  statePoints: StatePoint[];
  processes: Process[];
  activeSeason: 'summer' | 'winter' | 'both';
  selectedPointId?: string | null;
}

const getDefaultResolutionScale = () => {
  if (typeof window === 'undefined') {
    return 1.25;
  }
  return 1.25 * (window.devicePixelRatio || 1);
};

export const renderPsychrometricChart = ({
  canvas,
  width,
  height,
  statePoints,
  processes,
  activeSeason,
  selectedPointId,
  resolutionScale = getDefaultResolutionScale(),
}: RenderPsychrometricChartOptions) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const chartConfig = createDynamicChartConfig(width, height, statePoints);
  const coordinates = new ChartCoordinates(chartConfig.dimensions, chartConfig.range);

  const scaledWidth = Math.max(1, Math.round(width * resolutionScale));
  const scaledHeight = Math.max(1, Math.round(height * resolutionScale));
  if (canvas.width !== scaledWidth) {
    canvas.width = scaledWidth;
  }
  if (canvas.height !== scaledHeight) {
    canvas.height = scaledHeight;
  }
  ctx.setTransform(resolutionScale, 0, 0, resolutionScale, 0, 0);

  // クリア
  ctx.clearRect(0, 0, width, height);

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // グリッド線を描画
  drawGrid(ctx, coordinates, chartConfig.range);

  // 相対湿度曲線を描画
  drawRHCurves(ctx, coordinates, chartConfig.range);

  // 湿球温度線を描画（薄く）
  drawWetBulbCurves(ctx, coordinates, chartConfig.range);

  // エンタルピー線を描画（薄く）
  drawEnthalpyCurves(ctx, coordinates, chartConfig.range);

  // プロセス線を描画
  drawProcesses(ctx, coordinates, processes, statePoints, activeSeason);

  // 状態点を描画
  drawStatePoints(ctx, coordinates, statePoints, activeSeason, selectedPointId);
};

export const renderPsychrometricChartToSvg = ({
  width,
  height,
  statePoints,
  processes,
  activeSeason,
  selectedPointId,
}: RenderPsychrometricChartSvgOptions) => {
  const chartConfig = createDynamicChartConfig(width, height, statePoints);
  const coordinates = new ChartCoordinates(chartConfig.dimensions, chartConfig.range);
  const svgParts: string[] = [];
  const fmt = (value: number) => Number(value.toFixed(2)).toString();
  const escapeText = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const add = (markup: string) => {
    svgParts.push(markup);
  };

  const svgLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    strokeWidth: number,
    dash?: number[]
  ) => {
    const dashAttr = dash && dash.length > 0 ? ` stroke-dasharray="${dash.join(',')}"` : '';
    add(
      `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />`
    );
  };

  const svgPolyline = (
    points: Array<{ x: number; y: number }>,
    stroke: string,
    strokeWidth: number,
    dash?: number[]
  ) => {
    if (points.length === 0) return;
    const dashAttr = dash && dash.length > 0 ? ` stroke-dasharray="${dash.join(',')}"` : '';
    const pointsAttr = points.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(' ');
    add(
      `<polyline points="${pointsAttr}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr} />`
    );
  };

  const svgText = (
    text: string,
    x: number,
    y: number,
    options: {
      fill: string;
      fontSize: number;
      fontWeight?: string;
      textAnchor?: 'start' | 'middle' | 'end';
      dominantBaseline?: 'auto' | 'middle' | 'hanging' | 'alphabetic';
    }
  ) => {
    add(
      `<text x="${fmt(x)}" y="${fmt(y)}" fill="${options.fill}" font-size="${options.fontSize}" font-family="sans-serif"${options.fontWeight ? ` font-weight="${options.fontWeight}"` : ''}${
        options.textAnchor ? ` text-anchor="${options.textAnchor}"` : ''
      }${options.dominantBaseline ? ` dominant-baseline="${options.dominantBaseline}"` : ''}>${escapeText(text)}</text>`
    );
  };

  const svgCircle = (
    cx: number,
    cy: number,
    r: number,
    fill: string,
    stroke?: string,
    strokeWidth?: number
  ) => {
    add(
      `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${fill}"${
        stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth ?? 1}"` : ''
      } />`
    );
  };

  const svgArrow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    strokeWidth: number,
    offsetFromEnd = 12
  ) => {
    const headLength = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const endX = x2 - offsetFromEnd * Math.cos(angle);
    const endY = y2 - offsetFromEnd * Math.sin(angle);
    svgLine(
      endX,
      endY,
      endX - headLength * Math.cos(angle - Math.PI / 6),
      endY - headLength * Math.sin(angle - Math.PI / 6),
      stroke,
      strokeWidth
    );
    svgLine(
      endX,
      endY,
      endX - headLength * Math.cos(angle + Math.PI / 6),
      endY - headLength * Math.sin(angle + Math.PI / 6),
      stroke,
      strokeWidth
    );
  };

  add(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );
  add('<rect width="100%" height="100%" fill="#ffffff" />');

  for (let temp = Math.ceil(chartConfig.range.tempMin / 5) * 5; temp <= chartConfig.range.tempMax; temp += 5) {
    const x = coordinates.tempToX(temp);
    const y1 = coordinates.humidityToY(chartConfig.range.humidityMin);
    const y2 = coordinates.humidityToY(chartConfig.range.humidityMax);
    svgLine(x, y1, x, y2, '#e0e0e0', 1);
    svgText(`${temp}°C`, x, y1 + 20, { fill: '#666', fontSize: 10, textAnchor: 'middle' });
  }

  for (let h = 0; h <= chartConfig.range.humidityMax; h += 0.005) {
    const y = coordinates.humidityToY(h);
    const x1 = coordinates.tempToX(chartConfig.range.tempMin);
    const x2 = coordinates.tempToX(chartConfig.range.tempMax);
    svgLine(x1, y, x2, y, '#e0e0e0', 1);
    const gPerKg = h * 1000;
    svgText(`${gPerKg.toFixed(0)} g/kg'`, x1 - 10, y + 4, {
      fill: '#666',
      fontSize: 10,
      textAnchor: 'end',
    });
  }

  const rhCurves = RHCurveGenerator.generateStandardSet(
    chartConfig.range.tempMin,
    chartConfig.range.tempMax
  );
  rhCurves.forEach((points, rh) => {
    const stroke = rh === 100 ? '#d96b1a' : '#f28c28';
    const strokeWidth = rh === 100 ? 2 : 1;
    const clippedPoints = points.filter(
      (point) =>
        point.x >= chartConfig.range.tempMin &&
        point.x <= chartConfig.range.tempMax &&
        point.y >= chartConfig.range.humidityMin &&
        point.y <= chartConfig.range.humidityMax
    );
    const polylinePoints = clippedPoints.map((point) => coordinates.toCanvas(point.x, point.y));
    svgPolyline(polylinePoints, stroke, strokeWidth);
    if (clippedPoints.length > 0 && rh % 20 === 0) {
      const lastPoint = clippedPoints[clippedPoints.length - 1];
      const { x, y } = coordinates.toCanvas(lastPoint.x, lastPoint.y);
      svgText(`${rh}%`, x + 5, y, { fill: '#d96b1a', fontSize: 9 });
    }
  });

  const wbCurves = WetBulbCurveGenerator.generateStandardSet(
    chartConfig.range.tempMin,
    chartConfig.range.tempMax
  );
  wbCurves.forEach((points) => {
    const clippedPoints = points.filter(
      (point) =>
        point.x >= chartConfig.range.tempMin &&
        point.x <= chartConfig.range.tempMax &&
        point.y >= chartConfig.range.humidityMin &&
        point.y <= chartConfig.range.humidityMax
    );
    const polylinePoints = clippedPoints.map((point) => coordinates.toCanvas(point.x, point.y));
    svgPolyline(polylinePoints, '#dddddd', 0.5);
  });

  const hCurves = EnthalpyCurveGenerator.generateStandardSet(
    chartConfig.range.tempMin,
    chartConfig.range.tempMax
  );
  hCurves.forEach((points) => {
    const clippedPoints = points.filter(
      (point) =>
        point.x >= chartConfig.range.tempMin &&
        point.x <= chartConfig.range.tempMax &&
        point.y >= chartConfig.range.humidityMin &&
        point.y <= chartConfig.range.humidityMax
    );
    const polylinePoints = clippedPoints.map((point) => coordinates.toCanvas(point.x, point.y));
    svgPolyline(polylinePoints, '#eeeeee', 0.5);
  });

  processes.forEach((process) => {
    if (activeSeason !== 'both' && process.season !== 'both' && process.season !== activeSeason) {
      return;
    }

    const fromPoint = statePoints.find((point) => point.id === process.fromPointId);
    const toPoint = statePoints.find((point) => point.id === process.toPointId);
    if (!fromPoint || !toPoint || !fromPoint.dryBulbTemp || !fromPoint.humidity) return;
    if (!toPoint.dryBulbTemp || !toPoint.humidity) return;

    const from = coordinates.toCanvas(fromPoint.dryBulbTemp, fromPoint.humidity);
    const to = coordinates.toCanvas(toPoint.dryBulbTemp, toPoint.humidity);
    const stroke =
      process.season === 'summer'
        ? '#4dabf7'
        : process.season === 'winter'
        ? '#ff6b6b'
        : '#6b7280';

    if (process.type === 'mixing') {
      const stream1Id = process.parameters.mixingRatios?.stream1.pointId ?? process.fromPointId;
      const stream2Id = process.parameters.mixingRatios?.stream2.pointId;
      const stream1Point = statePoints.find((point) => point.id === stream1Id);
      const stream2Point = statePoints.find((point) => point.id === stream2Id);
      if (!stream1Point || !stream2Point) return;
      if (!stream1Point.dryBulbTemp || !stream1Point.humidity) return;
      if (!stream2Point.dryBulbTemp || !stream2Point.humidity) return;
      const stream1 = coordinates.toCanvas(stream1Point.dryBulbTemp, stream1Point.humidity);
      const stream2 = coordinates.toCanvas(stream2Point.dryBulbTemp, stream2Point.humidity);

      svgLine(stream1.x, stream1.y, to.x, to.y, stroke, 3, [5, 5]);
      svgLine(stream2.x, stream2.y, to.x, to.y, stroke, 3, [5, 5]);
      svgArrow(stream1.x, stream1.y, to.x, to.y, stroke, 3);
      svgArrow(stream2.x, stream2.y, to.x, to.y, stroke, 3);

      if (typeof stream1Point.airflow === 'number' && typeof stream2Point.airflow === 'number') {
        const totalAirflow = stream1Point.airflow + stream2Point.airflow;
        svgText(`${totalAirflow.toFixed(0)} m³/h`, to.x + 10, to.y + 12, {
          fill: '#333',
          fontSize: 9,
        });
      }
      return;
    }

    if (process.type === 'heatExchange') {
      const exhaustPointId = process.parameters.exhaustPointId;
      const exhaustPoint = statePoints.find((point) => point.id === exhaustPointId);
      if (exhaustPoint && exhaustPoint.dryBulbTemp && exhaustPoint.humidity) {
        const exhaustCanvas = coordinates.toCanvas(exhaustPoint.dryBulbTemp, exhaustPoint.humidity);
        svgLine(exhaustCanvas.x, exhaustCanvas.y, to.x, to.y, stroke, 2, [2, 4]);
      }
    }

    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const offsetDistance = 12;
    const fromOffsetX = from.x + offsetDistance * Math.cos(angle);
    const fromOffsetY = from.y + offsetDistance * Math.sin(angle);
    const toOffsetX = to.x - offsetDistance * Math.cos(angle);
    const toOffsetY = to.y - offsetDistance * Math.sin(angle);
    svgLine(fromOffsetX, fromOffsetY, toOffsetX, toOffsetY, stroke, 3, [5, 5]);
    svgArrow(from.x, from.y, to.x, to.y, stroke, 3);
  });

  const filteredPoints = statePoints
    .filter((point) => {
      if (activeSeason !== 'both' && point.season !== 'both' && point.season !== activeSeason) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);
  let summerIndex = 1;
  let winterIndex = 1;
  filteredPoints.forEach((point) => {
    if (!point.dryBulbTemp || !point.humidity) return;
    const { x, y } = coordinates.toCanvas(point.dryBulbTemp, point.humidity);
    const defaultPointColor =
      point.season === 'summer' ? '#4dabf7' : point.season === 'winter' ? '#ff6b6b' : '#6b7280';
    const pointColor = point.color || defaultPointColor;
    let label = '';
    if (point.season === 'summer') {
      label = `C${summerIndex}`;
      summerIndex++;
    } else if (point.season === 'winter') {
      label = `H${winterIndex}`;
      winterIndex++;
    } else {
      if (activeSeason === 'summer') {
        label = `C${summerIndex}`;
        summerIndex++;
      } else if (activeSeason === 'winter') {
        label = `H${winterIndex}`;
        winterIndex++;
      } else {
        label = point.name.substring(0, 3);
      }
    }
    const pointRadius = selectedPointId === point.id ? 6 : 5;
    svgCircle(x, y, pointRadius, pointColor, selectedPointId === point.id ? '#000' : undefined, 2);
    svgText(label, x + 8, y, {
      fill: pointColor,
      fontSize: 10,
      fontWeight: 'bold',
      textAnchor: 'start',
      dominantBaseline: 'middle',
    });
  });

  add('</svg>');
  return svgParts.join('');
};

export const PsychrometricChart = forwardRef<PsychrometricChartRef, PsychrometricChartProps>(({
  width = 1000,
  height = 700,
  statePoints,
  processes,
  activeSeason,
  selectedPointId,
  onPointClick,
  onPointMove,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 親コンポーネントからcanvasにアクセスできるようにする
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [draggedPointId, setDraggedPointId] = useState<string | null>(null);
  const resolutionScale = useMemo(() => {
    return getDefaultResolutionScale();
  }, []);

  // 座標変換の設定 - 状態点に基づいて動的に範囲を調整
  const chartConfig = useMemo(() => {
    return createDynamicChartConfig(width, height, statePoints);
  }, [width, height, statePoints]);
  const coordinates = useMemo(() => {
    return new ChartCoordinates(chartConfig.dimensions, chartConfig.range);
  }, [chartConfig]);
  
  // チャートの描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderPsychrometricChart({
      canvas,
      width,
      height,
      statePoints,
      processes,
      activeSeason,
      selectedPointId,
      resolutionScale,
    });

  }, [
    statePoints,
    processes,
    activeSeason,
    selectedPointId,
    width,
    height,
    coordinates,
    chartConfig.range,
    resolutionScale,
  ]);
  
  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    const point = getCanvasPoint(clientX, clientY);
    if (!point) return;

    // クリックされた状態点を探す
    const clickedPoint = findPointAt(point.x, point.y, statePoints, activeSeason, coordinates);
    if (clickedPoint) {
      setIsDragging(true);
      setDraggedPointId(clickedPoint.id);
      onPointClick?.(clickedPoint.id);
    }
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDragging || !draggedPointId) return;
    const point = getCanvasPoint(clientX, clientY);
    if (!point) return;

    // 座標変換
    const { temp, humidity } = coordinates.fromCanvas(point.x, point.y);

    // 範囲チェック
    if (
      temp >= chartConfig.range.tempMin &&
      temp <= chartConfig.range.tempMax &&
      humidity >= chartConfig.range.humidityMin &&
      humidity <= chartConfig.range.humidityMax
    ) {
      onPointMove?.(draggedPointId, temp, humidity);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setDraggedPointId(null);
  };
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
      onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
      onTouchStart={(e) => {
        if (e.touches.length === 0) return;
        e.preventDefault();
        const touch = e.touches[0];
        handlePointerDown(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        if (e.touches.length === 0) return;
        e.preventDefault();
        const touch = e.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
      }}
      onTouchEnd={handlePointerUp}
      onTouchCancel={handlePointerUp}
      style={{
        cursor: isDragging ? 'grabbing' : 'default',
        border: '1px solid #ddd',
        width: '100%',
        height: '100%',
        touchAction: 'none',
        display: 'block',
      }}
    />
  );
});

PsychrometricChart.displayName = 'PsychrometricChart';

// ========================================
// 描画ヘルパー関数
// ========================================

function drawGrid(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates,
  range: ChartRange
) {
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;

  // 縦線（温度）
  for (let temp = Math.ceil(range.tempMin / 5) * 5; temp <= range.tempMax; temp += 5) {
    const x = coordinates.tempToX(temp);
    const y1 = coordinates.humidityToY(range.humidityMin);
    const y2 = coordinates.humidityToY(range.humidityMax);

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();

    // ラベル
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${temp}°C`, x, y1 + 20);
  }

  // 横線（絶対湿度）- g/kg' 形式で表示
  for (let h = 0; h <= range.humidityMax; h += 0.005) {
    const y = coordinates.humidityToY(h);
    const x1 = coordinates.tempToX(range.tempMin);
    const x2 = coordinates.tempToX(range.tempMax);

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    // ラベル - g/kg' 形式 (kg/kg' × 1000 = g/kg')
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const gPerKg = h * 1000;
    ctx.fillText(`${gPerKg.toFixed(0)} g/kg'`, x1 - 10, y + 4);
  }
}

function drawRHCurves(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates,
  range: ChartRange
) {
  const rhCurves = RHCurveGenerator.generateStandardSet(range.tempMin, range.tempMax);

  // オレンジがかった茶色系の色
  const curveColor = '#f28c28'; // オレンジ系
  const saturationColor = '#d96b1a'; // 濃いオレンジ

  rhCurves.forEach((points, rh) => {
    ctx.strokeStyle = rh === 100 ? saturationColor : curveColor;
    ctx.lineWidth = rh === 100 ? 2 : 1;

    // 範囲内のポイントのみをフィルタリング
    const clippedPoints = points.filter(
      (point) =>
        point.x >= range.tempMin &&
        point.x <= range.tempMax &&
        point.y >= range.humidityMin &&
        point.y <= range.humidityMax
    );

    if (clippedPoints.length === 0) return;

    ctx.beginPath();
    clippedPoints.forEach((point, index) => {
      const { x, y } = coordinates.toCanvas(point.x, point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // ラベル
    if (clippedPoints.length > 0 && rh % 20 === 0) {
      const lastPoint = clippedPoints[clippedPoints.length - 1];
      const { x, y } = coordinates.toCanvas(lastPoint.x, lastPoint.y);
      ctx.fillStyle = saturationColor;
      ctx.font = '9px sans-serif';
      ctx.fillText(`${rh}%`, x + 5, y);
    }
  });
}

function drawWetBulbCurves(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates,
  range: ChartRange
) {
  const wbCurves = WetBulbCurveGenerator.generateStandardSet(range.tempMin, range.tempMax);

  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 0.5;

  wbCurves.forEach((points) => {
    // 範囲内のポイントのみをフィルタリング
    const clippedPoints = points.filter(
      (point) =>
        point.x >= range.tempMin &&
        point.x <= range.tempMax &&
        point.y >= range.humidityMin &&
        point.y <= range.humidityMax
    );

    if (clippedPoints.length === 0) return;

    ctx.beginPath();
    clippedPoints.forEach((point, index) => {
      const { x, y } = coordinates.toCanvas(point.x, point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  });
}

function drawEnthalpyCurves(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates,
  range: ChartRange
) {
  const hCurves = EnthalpyCurveGenerator.generateStandardSet(range.tempMin, range.tempMax);

  ctx.strokeStyle = '#eeeeee';
  ctx.lineWidth = 0.5;

  hCurves.forEach((points) => {
    // 範囲内のポイントのみをフィルタリング
    const clippedPoints = points.filter(
      (point) =>
        point.x >= range.tempMin &&
        point.x <= range.tempMax &&
        point.y >= range.humidityMin &&
        point.y <= range.humidityMax
    );

    if (clippedPoints.length === 0) return;

    ctx.beginPath();
    clippedPoints.forEach((point, index) => {
      const { x, y } = coordinates.toCanvas(point.x, point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  });
}

function drawStatePoints(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates,
  points: StatePoint[],
  activeSeason: string,
  selectedId?: string | null
) {
  // Filter and sort points by order for proper numbering
  const filteredPoints = points
    .filter(point => {
      if (activeSeason !== 'both' && point.season !== 'both' && point.season !== activeSeason) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.order - b.order);

  // Create index mapping for each season
  let summerIndex = 1;
  let winterIndex = 1;

  filteredPoints.forEach((point) => {
    if (!point.dryBulbTemp || !point.humidity) return;

    const { x, y } = coordinates.toCanvas(point.dryBulbTemp, point.humidity);

    // 点の色
    const defaultPointColor =
      point.season === 'summer' ? '#4dabf7' : point.season === 'winter' ? '#ff6b6b' : '#6b7280';
    const pointColor = point.color || defaultPointColor;

    // Generate label based on season and index
    let label = '';
    if (point.season === 'summer') {
      label = `C${summerIndex}`;
      summerIndex++;
    } else if (point.season === 'winter') {
      label = `H${winterIndex}`;
      winterIndex++;
    } else {
      // For 'both' season
      if (activeSeason === 'summer') {
        label = `C${summerIndex}`;
        summerIndex++;
      } else if (activeSeason === 'winter') {
        label = `H${winterIndex}`;
        winterIndex++;
      } else {
        label = point.name.substring(0, 3);
      }
    }

    // 小さいポイントを描画
    const pointRadius = selectedId === point.id ? 6 : 5;
    ctx.fillStyle = pointColor;
    ctx.beginPath();
    ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
    ctx.fill();

    // 選択された点は外枠を描画
    if (selectedId === point.id) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ラベルを右横に表示
    ctx.fillStyle = pointColor;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 8, y);
  });
}

function drawProcesses(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates,
  processes: Process[],
  points: StatePoint[],
  activeSeason: string
) {
  processes.forEach((process) => {
    // 季節フィルター
    if (activeSeason !== 'both' && process.season !== 'both' && process.season !== activeSeason) {
      return;
    }
    
    const fromPoint = points.find((p) => p.id === process.fromPointId);
    const toPoint = points.find((p) => p.id === process.toPointId);
    
    if (!fromPoint || !toPoint) return;
    if (!fromPoint.dryBulbTemp || !fromPoint.humidity) return;
    if (!toPoint.dryBulbTemp || !toPoint.humidity) return;
    
    const from = coordinates.toCanvas(fromPoint.dryBulbTemp, fromPoint.humidity);
    const to = coordinates.toCanvas(toPoint.dryBulbTemp, toPoint.humidity);
    
    // プロセス線を描画
    ctx.strokeStyle =
      process.season === 'summer'
        ? '#4dabf7'
        : process.season === 'winter'
        ? '#ff6b6b'
        : '#6b7280';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    if (process.type === 'mixing') {
      const stream1Id = process.parameters.mixingRatios?.stream1.pointId ?? process.fromPointId;
      const stream2Id = process.parameters.mixingRatios?.stream2.pointId;
      const stream1Point = points.find((p) => p.id === stream1Id);
      const stream2Point = points.find((p) => p.id === stream2Id);
      if (!stream1Point || !stream2Point) return;
      if (!stream1Point.dryBulbTemp || !stream1Point.humidity) return;
      if (!stream2Point.dryBulbTemp || !stream2Point.humidity) return;
      const stream1 = coordinates.toCanvas(stream1Point.dryBulbTemp, stream1Point.humidity);
      const stream2 = coordinates.toCanvas(stream2Point.dryBulbTemp, stream2Point.humidity);

      ctx.beginPath();
      ctx.moveTo(stream1.x, stream1.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(stream2.x, stream2.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      ctx.setLineDash([]);
      drawArrow(ctx, stream1.x, stream1.y, to.x, to.y);
      drawArrow(ctx, stream2.x, stream2.y, to.x, to.y);

      if (typeof stream1Point.airflow === 'number' && typeof stream2Point.airflow === 'number') {
        const totalAirflow = stream1Point.airflow + stream2Point.airflow;
        ctx.fillStyle = '#333';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${totalAirflow.toFixed(0)} m³/h`, to.x + 10, to.y + 12);
      }
      return;
    }

    if (process.type === 'heatExchange') {
      const exhaustPointId = process.parameters.exhaustPointId;
      const exhaustPoint = points.find((p) => p.id === exhaustPointId);
      if (exhaustPoint && exhaustPoint.dryBulbTemp && exhaustPoint.humidity) {
        const exhaustCanvas = coordinates.toCanvas(exhaustPoint.dryBulbTemp, exhaustPoint.humidity);

        // Draw connection line from exhaust point to heat exchanger output (no arrow)
        ctx.strokeStyle =
          process.season === 'summer'
            ? '#4dabf7'
            : process.season === 'winter'
            ? '#ff6b6b'
            : '#6b7280';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 4]); // Dotted line to distinguish from main process flow

        ctx.beginPath();
        ctx.moveTo(exhaustCanvas.x, exhaustCanvas.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        ctx.setLineDash([5, 5]); // Return to dashed line for main flow
      }
    }

    // Offset the line from the points
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const offsetDistance = 12; // Distance to offset from point centers
    const fromOffsetX = from.x + offsetDistance * Math.cos(angle);
    const fromOffsetY = from.y + offsetDistance * Math.sin(angle);
    const toOffsetX = to.x - offsetDistance * Math.cos(angle);
    const toOffsetY = to.y - offsetDistance * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(fromOffsetX, fromOffsetY);
    ctx.lineTo(toOffsetX, toOffsetY);
    ctx.stroke();

    ctx.setLineDash([]);

    // 矢印を描画
    drawArrow(ctx, from.x, from.y, to.x, to.y);
  });
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offsetFromEnd: number = 12 // Offset from the end point to avoid overlapping with point marker
) {
  const headLength = 10;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Calculate the offset end point
  const endX = x2 - offsetFromEnd * Math.cos(angle);
  const endY = y2 - offsetFromEnd * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(angle - Math.PI / 6),
    endY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(angle + Math.PI / 6),
    endY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.stroke();
}

function findPointAt(
  x: number,
  y: number,
  points: StatePoint[],
  activeSeason: string,
  coordinates: ChartCoordinates
): StatePoint | null {
  const threshold = 10; // px
  
  for (const point of points) {
    if (activeSeason !== 'both' && point.season !== 'both' && point.season !== activeSeason) {
      continue;
    }
    
    if (!point.dryBulbTemp || !point.humidity) continue;
    
    const { x: px, y: py } = coordinates.toCanvas(point.dryBulbTemp, point.humidity);
    const distance = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2));
    
    if (distance <= threshold) {
      return point;
    }
  }
  
  return null;
}
