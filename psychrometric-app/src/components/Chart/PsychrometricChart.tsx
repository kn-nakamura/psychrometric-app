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
  range?: ChartRange;
  selectedPointId?: string | null;
  draggablePointId?: string | null;
  onPointClick?: (pointId: string) => void;
  onBackgroundClick?: () => void;
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
  range?: ChartRange;
}

interface RenderPsychrometricChartContextOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  statePoints: StatePoint[];
  processes: Process[];
  activeSeason: 'summer' | 'winter' | 'both';
  selectedPointId?: string | null;
  range?: ChartRange;
}

const getDefaultResolutionScale = () => {
  if (typeof window === 'undefined') {
    return 1.25;
  }
  return 1.25 * (window.devicePixelRatio || 1);
};

const drawPsychrometricChart = ({
  ctx,
  width,
  height,
  statePoints,
  processes,
  activeSeason,
  selectedPointId,
  range,
}: RenderPsychrometricChartContextOptions) => {
  const chartConfig = createDynamicChartConfig(width, height, statePoints);
  const chartRange = range ?? chartConfig.range;
  const coordinates = new ChartCoordinates(chartConfig.dimensions, chartRange);

  // クリア
  ctx.clearRect(0, 0, width, height);

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // グリッド線を描画
  drawGrid(ctx, coordinates, chartRange);

  // 相対湿度曲線を描画
  drawRHCurves(ctx, coordinates, chartRange);

  // 湿球温度線を描画（薄く）
  drawWetBulbCurves(ctx, coordinates, chartRange);

  // エンタルピー線を描画（薄く）
  drawEnthalpyCurves(ctx, coordinates, chartRange);

  // プロセス線を描画
  drawProcesses(ctx, coordinates, processes, statePoints, activeSeason);

  // 状態点を描画
  drawStatePoints(ctx, coordinates, statePoints, activeSeason, selectedPointId);
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
  range,
}: RenderPsychrometricChartOptions) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const scaledWidth = Math.max(1, Math.round(width * resolutionScale));
  const scaledHeight = Math.max(1, Math.round(height * resolutionScale));
  if (canvas.width !== scaledWidth) {
    canvas.width = scaledWidth;
  }
  if (canvas.height !== scaledHeight) {
    canvas.height = scaledHeight;
  }
  ctx.setTransform(resolutionScale, 0, 0, resolutionScale, 0, 0);

  drawPsychrometricChart({
    ctx,
    width,
    height,
    statePoints,
    processes,
    activeSeason,
    selectedPointId,
    range,
  });
};

export const renderPsychrometricChartToContext = ({
  ctx,
  width,
  height,
  statePoints,
  processes,
  activeSeason,
  selectedPointId,
  range,
}: RenderPsychrometricChartContextOptions) => {
  drawPsychrometricChart({
    ctx,
    width,
    height,
    statePoints,
    processes,
    activeSeason,
    selectedPointId,
    range,
  });
};

export const PsychrometricChart = forwardRef<PsychrometricChartRef, PsychrometricChartProps>(({
  width = 1000,
  height = 700,
  statePoints,
  processes,
  activeSeason,
  range,
  selectedPointId,
  draggablePointId,
  onPointClick,
  onBackgroundClick,
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
  useEffect(() => {
    if (draggablePointId !== draggedPointId) {
      setIsDragging(false);
      setDraggedPointId(null);
    }
  }, [draggablePointId, draggedPointId]);

  // 座標変換の設定 - 状態点に基づいて動的に範囲を調整
  const chartConfig = useMemo(() => {
    const config = createDynamicChartConfig(width, height, statePoints);
    return {
      ...config,
      range: range ?? config.range,
    };
  }, [width, height, range, statePoints]);
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
      range: chartConfig.range,
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
      onPointClick?.(clickedPoint.id);
      if (draggablePointId === clickedPoint.id) {
        setIsDragging(true);
        setDraggedPointId(clickedPoint.id);
      }
    } else {
      onBackgroundClick?.();
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
        cursor: isDragging ? 'grabbing' : draggablePointId ? 'grab' : 'default',
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
