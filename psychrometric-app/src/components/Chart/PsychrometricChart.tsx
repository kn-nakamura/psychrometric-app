import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';
import { ChartCoordinates, createDefaultChartConfig } from '@/lib/chart/coordinates';
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
  
  // 座標変換の設定
  const chartConfig = createDefaultChartConfig(width, height);
  const coordinates = new ChartCoordinates(chartConfig.dimensions, chartConfig.range);
  
  // チャートの描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // クリア
    ctx.clearRect(0, 0, width, height);
    
    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // グリッド線を描画
    drawGrid(ctx, coordinates, chartConfig.range);
    
    // 相対湿度曲線を描画
    drawRHCurves(ctx, coordinates);
    
    // 湿球温度線を描画（薄く）
    drawWetBulbCurves(ctx, coordinates);
    
    // エンタルピー線を描画（薄く）
    drawEnthalpyCurves(ctx, coordinates);
    
    // プロセス線を描画
    drawProcesses(ctx, coordinates, processes, statePoints, activeSeason);
    
    // 状態点を描画
    drawStatePoints(ctx, coordinates, statePoints, activeSeason, selectedPointId);
    
  }, [statePoints, processes, activeSeason, selectedPointId, width, height]);
  
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
        height: 'auto',
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
  range: any
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
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${temp}°C`, x, y1 + 20);
  }
  
  // 横線（絶対湿度）
  for (let h = 0; h <= range.humidityMax; h += 0.005) {
    const y = coordinates.humidityToY(h);
    const x1 = coordinates.tempToX(range.tempMin);
    const x2 = coordinates.tempToX(range.tempMax);
    
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    
    // ラベル
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(h.toFixed(3), x1 - 10, y + 4);
  }
}

function drawRHCurves(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates
) {
  const rhCurves = RHCurveGenerator.generateStandardSet();
  
  rhCurves.forEach((points, rh) => {
    ctx.strokeStyle = rh === 100 ? '#0066cc' : '#99ccff';
    ctx.lineWidth = rh === 100 ? 2 : 1;
    
    ctx.beginPath();
    points.forEach((point, index) => {
      const { x, y } = coordinates.toCanvas(point.x, point.y);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // ラベル
    if (points.length > 0 && rh % 20 === 0) {
      const lastPoint = points[points.length - 1];
      const { x, y } = coordinates.toCanvas(lastPoint.x, lastPoint.y);
      ctx.fillStyle = '#0066cc';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${rh}%`, x + 5, y);
    }
  });
}

function drawWetBulbCurves(
  ctx: CanvasRenderingContext2D,
  coordinates: ChartCoordinates
) {
  const wbCurves = WetBulbCurveGenerator.generateStandardSet();
  
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 0.5;
  
  wbCurves.forEach((points) => {
    ctx.beginPath();
    points.forEach((point, index) => {
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
  coordinates: ChartCoordinates
) {
  const hCurves = EnthalpyCurveGenerator.generateStandardSet();
  
  ctx.strokeStyle = '#eeeeee';
  ctx.lineWidth = 0.5;
  
  hCurves.forEach((points) => {
    ctx.beginPath();
    points.forEach((point, index) => {
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
  points.forEach((point) => {
    // 季節フィルター
    if (activeSeason !== 'both' && point.season !== 'both' && point.season !== activeSeason) {
      return;
    }
    
    if (!point.dryBulbTemp || !point.humidity) return;
    
    const { x, y } = coordinates.toCanvas(point.dryBulbTemp, point.humidity);
    
    // 点を描画
    ctx.fillStyle = point.color || (point.season === 'summer' ? '#ff6b6b' : '#4dabf7');
    ctx.beginPath();
    ctx.arc(x, y, selectedId === point.id ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();
    
    // 選択された点は外枠を描画
    if (selectedId === point.id) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    // ラベル
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(point.name, x + 10, y - 10);
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
    ctx.strokeStyle = process.season === 'summer' ? '#ff6b6b' : '#4dabf7';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
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
  y2: number
) {
  const headLength = 10;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - Math.PI / 6),
    y2 - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + Math.PI / 6),
    y2 - headLength * Math.sin(angle + Math.PI / 6)
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
