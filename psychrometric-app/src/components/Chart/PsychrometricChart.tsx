import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useMemo } from 'react';
import type { PointerEvent } from 'react';
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

declare global {
  interface Window {
    Plotly?: {
      newPlot: (
        root: HTMLElement,
        data: unknown[],
        layout: Record<string, unknown>,
        config?: Record<string, unknown>
      ) => Promise<unknown>;
      react: (
        root: HTMLElement,
        data: unknown[],
        layout: Record<string, unknown>,
        config?: Record<string, unknown>
      ) => Promise<unknown>;
      purge: (root: HTMLElement) => void;
    };
  }
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
  const plotContainerRef = useRef<HTMLDivElement>(null);

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

  const filteredStatePoints = useMemo(
    () =>
      statePoints
        .filter((point) => {
          if (activeSeason === 'both') return true;
          return point.season === activeSeason || point.season === 'both';
        })
        .sort((a, b) => a.order - b.order),
    [statePoints, activeSeason]
  );

  const getPointLabel = (point: StatePoint, index: number): string => {
    let summerCount = 0;
    let winterCount = 0;
    for (let i = 0; i <= index; i++) {
      const p = filteredStatePoints[i];
      if (p.season === 'summer') summerCount++;
      else if (p.season === 'winter') winterCount++;
    }

    if (point.season === 'summer') {
      return `C${summerCount}`;
    }
    if (point.season === 'winter') {
      return `H${winterCount}`;
    }

    let bothSummerCount = 0;
    let bothWinterCount = 0;
    for (let i = 0; i <= index; i++) {
      const p = filteredStatePoints[i];
      if (p.season === 'summer' || p.season === 'both') bothSummerCount++;
      if (p.season === 'winter' || p.season === 'both') bothWinterCount++;
    }
    if (activeSeason === 'summer') {
      return `C${bothSummerCount}`;
    }
    if (activeSeason === 'winter') {
      return `H${bothWinterCount}`;
    }
    return `C${bothSummerCount}/H${bothWinterCount}`;
  };

  const getProcessColor = (season: Process['season']) =>
    season === 'summer' ? '#4dabf7' : season === 'winter' ? '#ff6b6b' : '#6b7280';

  const plotData = useMemo(() => {
    const data: Record<string, unknown>[] = [];
    const annotations: Record<string, unknown>[] = [];
    const { range } = chartConfig;
    const formatValue = (value: number | undefined, fractionDigits = 1) => {
      if (typeof value !== 'number') return '-';
      return value.toFixed(fractionDigits);
    };

    const addLineTrace = (
      points: { x: number; y: number }[],
      line: { color: string; width: number; dash?: string }
    ) => {
      if (points.length === 0) return;
      data.push({
        type: 'scatter',
        mode: 'lines',
        x: points.map((point) => point.x),
        y: points.map((point) => point.y),
        line,
        hoverinfo: 'skip',
        showlegend: false,
      });
    };

    const clipPoints = (points: { x: number; y: number }[]) =>
      points.filter(
        (point) =>
          point.x >= range.tempMin &&
          point.x <= range.tempMax &&
          point.y >= range.humidityMin &&
          point.y <= range.humidityMax
      );

    // Relative humidity curves
    const rhCurves = RHCurveGenerator.generateStandardSet(range.tempMin, range.tempMax);
    rhCurves.forEach((points, rh) => {
      const clippedPoints = clipPoints(points);
      const lineColor = rh === 100 ? '#d96b1a' : '#f28c28';
      const lineWidth = rh === 100 ? 2 : 1;
      addLineTrace(clippedPoints, { color: lineColor, width: lineWidth });

      if (clippedPoints.length > 0 && rh % 20 === 0) {
        const lastPoint = clippedPoints[clippedPoints.length - 1];
        annotations.push({
          x: lastPoint.x,
          y: lastPoint.y,
          text: `${rh}%`,
          showarrow: false,
          font: { size: 9, color: '#d96b1a' },
          xanchor: 'left',
        });
      }
    });

    // Wet bulb curves
    const wbCurves = WetBulbCurveGenerator.generateStandardSet(range.tempMin, range.tempMax);
    wbCurves.forEach((points) => {
      const clippedPoints = clipPoints(points);
      addLineTrace(clippedPoints, { color: '#dddddd', width: 0.5 });
    });

    // Enthalpy curves
    const hCurves = EnthalpyCurveGenerator.generateStandardSet(range.tempMin, range.tempMax);
    hCurves.forEach((points) => {
      const clippedPoints = clipPoints(points);
      addLineTrace(clippedPoints, { color: '#eeeeee', width: 0.5 });
    });

    // Process lines
    processes.forEach((process) => {
      if (activeSeason !== 'both' && process.season !== 'both' && process.season !== activeSeason) {
        return;
      }
      const fromPoint = statePoints.find((p) => p.id === process.fromPointId);
      const toPoint = statePoints.find((p) => p.id === process.toPointId);
      if (!fromPoint || !toPoint) return;
      if (!fromPoint.dryBulbTemp || !fromPoint.humidity) return;
      if (!toPoint.dryBulbTemp || !toPoint.humidity) return;
      const color = getProcessColor(process.season);

      const addArrow = (from: StatePoint, to: StatePoint) => {
        annotations.push({
          x: to.dryBulbTemp ?? 0,
          y: to.humidity ?? 0,
          ax: from.dryBulbTemp ?? 0,
          ay: from.humidity ?? 0,
          xref: 'x',
          yref: 'y',
          axref: 'x',
          ayref: 'y',
          showarrow: true,
          arrowhead: 2,
          arrowsize: 1,
          arrowwidth: 1.5,
          arrowcolor: color,
        });
      };

      if (process.type === 'mixing') {
        const stream1Id = process.parameters.mixingRatios?.stream1.pointId ?? process.fromPointId;
        const stream2Id = process.parameters.mixingRatios?.stream2.pointId;
        const stream1Point = statePoints.find((p) => p.id === stream1Id);
        const stream2Point = statePoints.find((p) => p.id === stream2Id);
        if (!stream1Point || !stream2Point) return;
        if (!stream1Point.dryBulbTemp || !stream1Point.humidity) return;
        if (!stream2Point.dryBulbTemp || !stream2Point.humidity) return;

        addLineTrace(
          [
            { x: stream1Point.dryBulbTemp, y: stream1Point.humidity },
            { x: toPoint.dryBulbTemp, y: toPoint.humidity },
          ],
          { color, width: 3, dash: 'dash' }
        );
        addLineTrace(
          [
            { x: stream2Point.dryBulbTemp, y: stream2Point.humidity },
            { x: toPoint.dryBulbTemp, y: toPoint.humidity },
          ],
          { color, width: 3, dash: 'dash' }
        );
        addArrow(stream1Point, toPoint);
        addArrow(stream2Point, toPoint);
        return;
      }

      if (process.type === 'heatExchange') {
        const exhaustPointId = process.parameters.exhaustPointId;
        const exhaustPoint = statePoints.find((p) => p.id === exhaustPointId);
        if (exhaustPoint && exhaustPoint.dryBulbTemp && exhaustPoint.humidity) {
          addLineTrace(
            [
              { x: exhaustPoint.dryBulbTemp, y: exhaustPoint.humidity },
              { x: toPoint.dryBulbTemp, y: toPoint.humidity },
            ],
            { color, width: 2, dash: 'dot' }
          );
        }
      }

      addLineTrace(
        [
          { x: fromPoint.dryBulbTemp, y: fromPoint.humidity },
          { x: toPoint.dryBulbTemp, y: toPoint.humidity },
        ],
        { color, width: 3, dash: 'dash' }
      );
      addArrow(fromPoint, toPoint);
    });

    // State points
    filteredStatePoints.forEach((point, index) => {
      if (!point.dryBulbTemp || !point.humidity) return;
      const label = getPointLabel(point, index);
      const defaultPointColor =
        point.season === 'summer' ? '#4dabf7' : point.season === 'winter' ? '#ff6b6b' : '#6b7280';
      const pointColor = point.color || defaultPointColor;
      const isSelected = selectedPointId === point.id;
      const hoverLines = [
        `${point.name || label}`,
        `乾球温度: ${formatValue(point.dryBulbTemp, 1)}°C`,
        `相対湿度: ${formatValue(point.relativeHumidity, 0)}%`,
        `絶対湿度: ${formatValue(point.humidity, 4)} kg/kg'`,
        `エンタルピー: ${formatValue(point.enthalpy, 1)} kJ/kg'`,
        `露点温度: ${formatValue(point.dewPoint, 1)}°C`,
      ];
      if (typeof point.airflow === 'number') {
        hoverLines.push(`風量: ${formatValue(point.airflow, 0)} m³/h`);
      }

      data.push({
        type: 'scatter',
        mode: 'markers+text',
        x: [point.dryBulbTemp],
        y: [point.humidity],
        text: [label],
        textposition: 'middle right',
        textfont: { color: pointColor, size: 10 },
        marker: {
          size: isSelected ? 12 : 10,
          color: pointColor,
          line: {
            color: isSelected ? '#000' : pointColor,
            width: isSelected ? 2 : 0,
          },
        },
        hoverinfo: 'text',
        hovertext: [hoverLines.join('<br>')],
        showlegend: false,
      });
    });

    return { data, annotations };
  }, [chartConfig, statePoints, processes, activeSeason, filteredStatePoints, selectedPointId]);

  const plotLayout = useMemo<Record<string, unknown>>(() => {
    const { range, dimensions } = chartConfig;
    const tickVals: number[] = [];
    const tickText: string[] = [];
    for (let h = 0; h <= range.humidityMax + 0.0001; h += 0.005) {
      if (h < range.humidityMin - 0.0001) continue;
      tickVals.push(Number(h.toFixed(3)));
      tickText.push(`${Math.round(h * 1000)}`);
    }

    return {
      width,
      height,
      margin: {
        l: dimensions.marginLeft,
        r: dimensions.marginRight,
        t: dimensions.marginTop,
        b: dimensions.marginBottom,
      },
      paper_bgcolor: '#ffffff',
      plot_bgcolor: '#ffffff',
      xaxis: {
        range: [range.tempMin, range.tempMax],
        dtick: 5,
        ticks: 'outside',
        showgrid: true,
        gridcolor: '#e0e0e0',
        zeroline: false,
        fixedrange: true,
        tickfont: { size: 10, color: '#666' },
        title: { text: '乾球温度 (°C)', font: { size: 11, color: '#444' } },
      },
      yaxis: {
        range: [range.humidityMin, range.humidityMax],
        tickmode: 'array',
        tickvals: tickVals,
        ticktext: tickText,
        side: 'right',
        ticklabelposition: 'outside right',
        ticks: 'outside',
        showgrid: true,
        gridcolor: '#e0e0e0',
        zeroline: false,
        fixedrange: true,
        tickfont: { size: 10, color: '#666' },
        title: { text: "絶対湿度 (g/kg')", font: { size: 11, color: '#444' } },
      },
      dragmode: false,
      hovermode: 'closest',
      showlegend: false,
    };
  }, [chartConfig, width, height]);

  const loadPlotly = useMemo(
    () => () =>
      new Promise<void>((resolve, reject) => {
        if (window.Plotly) {
          resolve();
          return;
        }
        const existingScript = document.getElementById('plotly-script');
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve());
          existingScript.addEventListener('error', () => reject(new Error('Plotly load failed')));
          return;
        }
        const script = document.createElement('script');
        script.id = 'plotly-script';
        script.src = 'https://cdn.plot.ly/plotly-2.27.0.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Plotly load failed'));
        document.body.appendChild(script);
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const renderPlot = async () => {
      try {
        await loadPlotly();
        if (cancelled) return;
        if (!window.Plotly || !plotContainerRef.current) return;
        const layout = {
          ...plotLayout,
          annotations: plotData.annotations,
        };
        await window.Plotly.react(plotContainerRef.current, plotData.data, layout, {
          displayModeBar: false,
          scrollZoom: false,
          doubleClick: false,
          responsive: true,
        });
      } catch (error) {
        console.error('Plotly load/render failed:', error);
      }
    };
    renderPlot();

    return () => {
      cancelled = true;
      if (plotContainerRef.current && window.Plotly) {
        window.Plotly.purge(plotContainerRef.current);
      }
    };
  }, [loadPlotly, plotData, plotLayout]);

  const selectedPoint = useMemo(() => {
    if (!selectedPointId) return null;
    const point = statePoints.find((item) => item.id === selectedPointId);
    if (!point) return null;
    if (activeSeason !== 'both' && point.season !== 'both' && point.season !== activeSeason) {
      return null;
    }
    return point;
  }, [activeSeason, selectedPointId, statePoints]);

  const selectedPointPosition = useMemo(() => {
    if (!selectedPoint || typeof selectedPoint.dryBulbTemp !== 'number') return null;
    if (typeof selectedPoint.humidity !== 'number') return null;
    return coordinates.toCanvas(selectedPoint.dryBulbTemp, selectedPoint.humidity);
  }, [coordinates, selectedPoint]);

  const selectedPointLabel = useMemo(() => {
    if (!selectedPointId) return '';
    const index = filteredStatePoints.findIndex((point) => point.id === selectedPointId);
    if (index < 0) return '';
    return getPointLabel(filteredStatePoints[index], index);
  }, [filteredStatePoints, getPointLabel, selectedPointId]);
  
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
    const container = plotContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (!point) return;

    // クリックされた状態点を探す
    const clickedPoint = findPointAt(point.x, point.y, statePoints, activeSeason, coordinates);
    if (clickedPoint) {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      setDraggedPointId(clickedPoint.id);
      onPointClick?.(clickedPoint.id);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !draggedPointId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = getCanvasPoint(event.clientX, event.clientY);
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

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
    setDraggedPointId(null);
  };
  
  return (
    <div className="relative h-full w-full">
      <div
        ref={plotContainerRef}
        className="h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: isDragging ? 'none' : 'auto' }}
      />
      {selectedPoint && selectedPointPosition && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs text-gray-700 shadow-lg"
          style={{
            left: selectedPointPosition.x + 12,
            top: selectedPointPosition.y - 12,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-semibold text-gray-900">
            {selectedPoint.name || selectedPointLabel}
          </div>
          <div>乾球温度: {selectedPoint.dryBulbTemp?.toFixed(1)}°C</div>
          <div>相対湿度: {selectedPoint.relativeHumidity?.toFixed(0)}%</div>
          <div>絶対湿度: {selectedPoint.humidity?.toFixed(4)} kg/kg'</div>
          <div>エンタルピー: {selectedPoint.enthalpy?.toFixed(1)} kJ/kg'</div>
          <div>露点温度: {selectedPoint.dewPoint?.toFixed(1)}°C</div>
          <div>
            風量:{' '}
            {typeof selectedPoint.airflow === 'number'
              ? `${selectedPoint.airflow.toFixed(0)} m³/h`
              : '-'}
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          cursor: isDragging ? 'grabbing' : 'default',
          width: '100%',
          height: '100%',
          display: 'block',
          position: 'absolute',
          inset: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
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

  // 横線（絶対湿度）- 数値のみ表示
  for (let h = 0; h <= range.humidityMax; h += 0.005) {
    const y = coordinates.humidityToY(h);
    const x1 = coordinates.tempToX(range.tempMin);
    const x2 = coordinates.tempToX(range.tempMax);

    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    // ラベル - 数値のみ (kg/kg' × 1000)
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const gPerKg = h * 1000;
    ctx.fillText(`${gPerKg.toFixed(0)}`, x2 - 10, y + 4);
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
