import { useState } from 'react';
import { X, FileImage, FileText, Loader2 } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { DesignConditions } from '@/types/designConditions';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';
import { renderPsychrometricChart } from '@/components/Chart/PsychrometricChart';
import { CoilCapacityCalculator } from '@/lib/equipment/coilCapacity';

interface ExportDialogProps {
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  designConditions: DesignConditions;
  statePoints: StatePoint[];
  processes: Process[];
  activeSeason: 'summer' | 'winter' | 'both';
}

const NOTO_SANS_JP_FONT_PATH = '/fonts/NotoSansJP-Regular.ttf';
let notoSansJpFontDataPromise: Promise<Uint8Array | null> | null = null;

const loadNotoSansJpFontData = async (): Promise<Uint8Array | null> => {
  if (!notoSansJpFontDataPromise) {
    notoSansJpFontDataPromise = fetch(NOTO_SANS_JP_FONT_PATH)
      .then((response) => {
        if (!response.ok) {
          console.warn('フォントの取得に失敗しました。標準フォントを使用します。');
          return null;
        }
        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!buffer || buffer.byteLength < 10000) {
          console.warn('フォントデータが無効です。標準フォントを使用します。');
          return null;
        }
        return new Uint8Array(buffer);
      })
      .catch((error) => {
        console.warn('フォント読み込みエラー:', error);
        notoSansJpFontDataPromise = null;
        return null;
      });
  }
  return notoSansJpFontDataPromise;
};

export const ExportDialog = ({
  onClose,
  canvasRef,
  designConditions,
  statePoints,
  processes,
  activeSeason,
}: ExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'png' | null>(null);

  // A4縦向き (mm)
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const A4_DPI = 96; // Webビュー相当の解像度で軽量化

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * A4_DPI);
  const mmToPt = (mm: number) => mm * 2.83465;
  const formatNumber = (value?: number, digits = 1) =>
    value === undefined || Number.isNaN(value) ? '-' : value.toFixed(digits);

  const processTypeLabels: Record<Process['type'], string> = {
    heating: '加熱',
    cooling: '冷却',
    humidifying: '加湿',
    dehumidifying: '除湿',
    mixing: '混合',
    heatExchange: '全熱交換',
    fanHeating: 'ファン発熱',
    airSupply: '空調吹き出し',
  };

  const seasonLabel = (season: Process['season'] | StatePoint['season']) =>
    season === 'summer' ? '夏' : season === 'winter' ? '冬' : '通年';

  // Filter state points by active season
  const filteredStatePoints = statePoints
    .filter((point) => {
      if (activeSeason === 'both') return true;
      return point.season === activeSeason || point.season === 'both';
    })
    .sort((a, b) => a.order - b.order);

  // Filter processes by active season
  const filteredProcesses = processes.filter((process) => {
    if (activeSeason === 'both') return true;
    return process.season === activeSeason || process.season === 'both';
  });

  // Generate labels for state points (C1, C2 for summer, H1, H2 for winter)
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
    } else if (point.season === 'winter') {
      return `H${winterCount}`;
    } else {
      let bothSummerCount = 0;
      let bothWinterCount = 0;
      for (let i = 0; i <= index; i++) {
        const p = filteredStatePoints[i];
        if (p.season === 'summer' || p.season === 'both') bothSummerCount++;
        if (p.season === 'winter' || p.season === 'both') bothWinterCount++;
      }
      if (activeSeason === 'summer') {
        return `C${bothSummerCount}`;
      } else if (activeSeason === 'winter') {
        return `H${bothWinterCount}`;
      }
      return `C${bothSummerCount}/H${bothWinterCount}`;
    }
  };

  // Helper function to get label for a state point by ID
  const getPointLabelById = (pointId: string): string => {
    const pointIndex = filteredStatePoints.findIndex((p) => p.id === pointId);
    if (pointIndex === -1) return '?';
    const point = filteredStatePoints[pointIndex];
    return getPointLabel(point, pointIndex);
  };

  const calculateProcessCapacity = (process: Process, points: StatePoint[]) => {
    const fromPoint = points.find((p) => p.id === process.fromPointId);
    const toPoint = points.find((p) => p.id === process.toPointId);
    if (!fromPoint || !toPoint) return null;
    if (!fromPoint.enthalpy || !toPoint.enthalpy) return null;
    const airflow = process.parameters.airflow || 1000;
    try {
      return CoilCapacityCalculator.calculate(
        fromPoint as StatePoint,
        toPoint as StatePoint,
        airflow
      );
    } catch {
      return null;
    }
  };

  const getMixingAirflowTotal = (process: Process, points: StatePoint[]) => {
    const stream1Id =
      process.parameters.mixingRatios?.stream1.pointId ?? process.fromPointId;
    const stream2Id = process.parameters.mixingRatios?.stream2.pointId;
    const stream1Point = points.find((p) => p.id === stream1Id);
    const stream2Point = points.find((p) => p.id === stream2Id);
    if (typeof stream1Point?.airflow !== 'number' || typeof stream2Point?.airflow !== 'number') {
      return undefined;
    }
    return stream1Point.airflow + stream2Point.airflow;
  };

  const renderPdfPages = async (chartCanvas: HTMLCanvasElement) => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    let bodyFont: PDFFont | undefined;
    let boldFont: PDFFont | undefined;
    const fontData = await loadNotoSansJpFontData();
    if (fontData) {
      try {
        bodyFont = await pdfDoc.embedFont(fontData);
        boldFont = bodyFont;
      } catch (error) {
        console.warn('フォント埋め込みエラー:', error);
        bodyFont = undefined;
        boldFont = undefined;
      }
    }

    if (!bodyFont || !boldFont) {
      bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    const resolvedBodyFont = bodyFont;
    const resolvedBoldFont = boldFont;

    const rgbFrom255 = (r: number, g: number, b: number) => rgb(r / 255, g / 255, b / 255);
    const drawText = (
      page: PDFPage,
      text: string,
      xMm: number,
      yMm: number,
      sizeMm: number,
      {
        font = resolvedBodyFont,
        color = rgbFrom255(17, 24, 39),
        align = 'left',
      }: { font?: PDFFont; color?: ReturnType<typeof rgb>; align?: 'left' | 'center' } = {}
    ) => {
      const sizePt = mmToPt(sizeMm);
      const textWidth = font.widthOfTextAtSize(text, sizePt);
      let x = mmToPt(xMm);
      if (align === 'center') {
        x -= textWidth / 2;
      }
      const y = page.getHeight() - mmToPt(yMm) - sizePt;
      page.drawText(text, {
        x,
        y,
        size: sizePt,
        font,
        color,
      });
    };

    const drawRect = (
      page: PDFPage,
      xMm: number,
      yMm: number,
      widthMm: number,
      heightMm: number,
      {
        color,
        borderColor,
        borderWidthMm = 0.2,
      }: { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidthMm?: number } = {}
    ) => {
      const x = mmToPt(xMm);
      const y = page.getHeight() - mmToPt(yMm) - mmToPt(heightMm);
      page.drawRectangle({
        x,
        y,
        width: mmToPt(widthMm),
        height: mmToPt(heightMm),
        color,
        borderColor,
        borderWidth: borderColor ? mmToPt(borderWidthMm) : undefined,
      });
    };

    const formatAirflow = (airflow?: number) =>
      typeof airflow === 'number' ? `${airflow.toFixed(0)} m³/h` : '-';

    const marginMm = 8;
    const headerHeightMm = 14;
    const chartTopMm = marginMm + headerHeightMm + 2;
    const chartHeightMm = 120;
    const bottomSectionStartMm = chartTopMm + chartHeightMm + 6;
    const contentWidthMm = A4_WIDTH_MM - marginMm * 2;

    const chartWidthMm = contentWidthMm;
    const chartAspectRatio = chartCanvas.width / chartCanvas.height;
    let drawChartWidthMm = chartWidthMm;
    let drawChartHeightMm = chartWidthMm / chartAspectRatio;
    if (drawChartHeightMm > chartHeightMm) {
      drawChartHeightMm = chartHeightMm;
      drawChartWidthMm = chartHeightMm * chartAspectRatio;
    }
    const chartXOffset = marginMm + (chartWidthMm - drawChartWidthMm) / 2;
    const chartRenderWidth = Math.round((drawChartWidthMm / 25.4) * A4_DPI);
    const chartRenderHeight = Math.round((drawChartHeightMm / 25.4) * A4_DPI);
    const chartRenderCanvas = document.createElement('canvas');
    chartRenderCanvas.width = chartRenderWidth;
    chartRenderCanvas.height = chartRenderHeight;
    renderPsychrometricChart({
      canvas: chartRenderCanvas,
      width: chartRenderWidth,
      height: chartRenderHeight,
      statePoints: filteredStatePoints,
      processes: filteredProcesses,
      activeSeason,
      resolutionScale: 1,
    });
    const chartImageDataUrl = chartRenderCanvas.toDataURL('image/png', 1.0);
    const chartImageBytes = await fetch(chartImageDataUrl).then((response) => response.arrayBuffer());
    const chartImage = await pdfDoc.embedPng(chartImageBytes);

    const createPage = () =>
      pdfDoc.addPage([mmToPt(A4_WIDTH_MM), mmToPt(A4_HEIGHT_MM)]);

    const drawPageBackground = (page: PDFPage) => {
      drawRect(page, 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, { color: rgbFrom255(255, 255, 255) });
    };

    const drawStatePointCard = (
      page: PDFPage,
      point: StatePoint,
      index: number,
      x: number,
      y: number
    ) => {
      const label = getPointLabel(point, index);
      const seasonColor =
        point.season === 'summer' ? [59, 130, 246] :
        point.season === 'winter' ? [239, 68, 68] : [139, 92, 246];
      const seasonRgb = rgbFrom255(seasonColor[0], seasonColor[1], seasonColor[2]);

      drawRect(page, x, y, 6, 3.5, { color: seasonRgb });

      drawText(page, label, x + 3, y + 2.3, 1.9, {
        font: resolvedBoldFont,
        color: rgbFrom255(255, 255, 255),
        align: 'center',
      });

      drawText(page, point.name, x + 7, y + 2.2, 2.1, { font: resolvedBoldFont });

      const propTextLine1 = `温度: ${formatNumber(point.dryBulbTemp)}°C | RH: ${formatNumber(point.relativeHumidity, 0)}% | 絶対湿度: ${formatNumber(point.humidity, 4)} kg/kg'`;
      const propTextLine2 = `エンタルピー: ${formatNumber(point.enthalpy)} kJ/kg' | 風量: ${formatAirflow(point.airflow)} | 季節: ${seasonLabel(point.season)}`;
      drawText(page, propTextLine1, x + 7, y + 4.8, 1.6, { color: rgbFrom255(107, 114, 128) });
      drawText(page, propTextLine2, x + 7, y + 7, 1.6, { color: rgbFrom255(107, 114, 128) });
    };

    const drawProcessCard = (
      page: PDFPage,
      process: Process,
      x: number,
      y: number
    ) => {
      const fromPoint = filteredStatePoints.find((p) => p.id === process.fromPointId);
      const toPoint = filteredStatePoints.find((p) => p.id === process.toPointId);
      const detailLines: string[] = [
        `種別: ${processTypeLabels[process.type]} | 季節: ${seasonLabel(process.season)}`,
        `状態点: ${fromPoint?.name || '不明'} → ${toPoint?.name || '不明'}`,
      ];
      const mixingAirflowTotal = getMixingAirflowTotal(process, filteredStatePoints);
      if (process.type === 'mixing' && mixingAirflowTotal !== undefined) {
        detailLines.push(`混合後風量: ${mixingAirflowTotal.toFixed(0)} m³/h`);
      }
      const capacity = calculateProcessCapacity(process, filteredStatePoints);
      if (capacity) {
        detailLines.push(
          `全熱: ${Math.abs(capacity.totalCapacity).toFixed(2)} kW | 顕熱: ${Math.abs(capacity.sensibleCapacity).toFixed(2)} kW | 潜熱: ${Math.abs(capacity.latentCapacity).toFixed(2)} kW`
        );
        detailLines.push(
          `SHF: ${capacity.SHF.toFixed(2)} | 温度差: ${capacity.temperatureDiff.toFixed(1)}°C | 湿度差: ${(capacity.humidityDiff * 1000).toFixed(2)} g/kg'`
        );
        detailLines.push(`比エンタルピー差: ${capacity.enthalpyDiff.toFixed(2)} kJ/kg'`);
        if (process.parameters.airflow && capacity.humidityDiff !== 0) {
          detailLines.push(
            `${capacity.humidityDiff < 0 ? '除湿量' : '加湿量'}: ${(Math.abs(capacity.humidityDiff) * process.parameters.airflow * 1.2).toFixed(2)} L/h`
          );
        }
        if (process.type === 'heating' || process.type === 'cooling') {
          const waterTempDiff = process.parameters.waterTempDiff || 7;
          const waterFlowRate = (Math.abs(capacity.totalCapacity) * 60) / (4.186 * waterTempDiff);
          detailLines.push(
            `水温度差: ${waterTempDiff.toFixed(1)}℃ | 水量: ${waterFlowRate.toFixed(2)} L/min`
          );
        }
      }

      const processLineHeight = 2.4;
      const processHeaderHeight = 5;
      const processCardHeight = processHeaderHeight + detailLines.length * processLineHeight + 1;

      const seasonColor =
        process.season === 'summer' ? [59, 130, 246] :
        process.season === 'winter' ? [239, 68, 68] : [139, 92, 246];
      const seasonRgb = rgbFrom255(seasonColor[0], seasonColor[1], seasonColor[2]);

      drawRect(page, x, y, 1, processCardHeight - 1, { color: seasonRgb });

      drawText(page, process.name, x + 2.5, y + 2.4, 2.1, { font: resolvedBoldFont });

      const fromLabel = getPointLabelById(process.fromPointId);
      const toLabel = getPointLabelById(process.toPointId);
      drawText(page, `${fromLabel} → ${toLabel}`, x + 2.5, y + 4.4, 1.7, {
        color: rgbFrom255(107, 114, 128),
      });

      detailLines.forEach((line, lineIndex) => {
        drawText(page, line, x + 2.5, y + 6.4 + lineIndex * processLineHeight, 1.6, {
          color: rgbFrom255(107, 114, 128),
        });
      });

      return processCardHeight;
    };

    const page = createPage();
    drawPageBackground(page);

    const headerY = marginMm;
    drawText(page, designConditions.project.name || '空気線図', marginMm, headerY + 4, 4.5, {
      font: resolvedBoldFont,
    });

    const projectInfo = [
      designConditions.project.location,
      designConditions.project.date,
      designConditions.project.designer,
    ].filter(Boolean).join(' | ');
    drawText(page, projectInfo || '-', marginMm, headerY + 7.5, 2.2, {
      color: rgbFrom255(107, 114, 128),
    });

    const conditionsX = marginMm + contentWidthMm * 0.45;
    const conditionsWidth = contentWidthMm * 0.55;
    drawText(page, '設計条件', conditionsX, headerY + 2, 2.2, {
      font: resolvedBoldFont,
      color: rgbFrom255(55, 65, 81),
    });

    const col1X = conditionsX;
    const col2X = conditionsX + conditionsWidth / 3;
    const col3X = conditionsX + (conditionsWidth / 3) * 2;
    const condRowHeight = 2.2;

    drawText(page, '外気条件', col1X, headerY + 4.5, 1.7, {
      font: resolvedBoldFont,
      color: rgbFrom255(55, 65, 81),
    });
    drawText(
      page,
      `夏: ${formatNumber(designConditions.outdoor.summer.dryBulbTemp)}°C / ${formatNumber(designConditions.outdoor.summer.relativeHumidity, 0)}%`,
      col1X,
      headerY + 4.5 + condRowHeight,
      1.6,
      { color: rgbFrom255(75, 85, 99) }
    );
    drawText(
      page,
      `冬: ${formatNumber(designConditions.outdoor.winter.dryBulbTemp)}°C / ${formatNumber(designConditions.outdoor.winter.relativeHumidity, 0)}%`,
      col1X,
      headerY + 4.5 + condRowHeight * 2,
      1.6,
      { color: rgbFrom255(75, 85, 99) }
    );

    drawText(page, '室内条件', col2X, headerY + 4.5, 1.7, {
      font: resolvedBoldFont,
      color: rgbFrom255(55, 65, 81),
    });
    drawText(
      page,
      `夏: ${formatNumber(designConditions.indoor.summer.dryBulbTemp)}°C / ${formatNumber(designConditions.indoor.summer.relativeHumidity, 0)}%`,
      col2X,
      headerY + 4.5 + condRowHeight,
      1.6,
      { color: rgbFrom255(75, 85, 99) }
    );
    drawText(
      page,
      `冬: ${formatNumber(designConditions.indoor.winter.dryBulbTemp)}°C / ${formatNumber(designConditions.indoor.winter.relativeHumidity, 0)}%`,
      col2X,
      headerY + 4.5 + condRowHeight * 2,
      1.6,
      { color: rgbFrom255(75, 85, 99) }
    );

    drawText(page, '風量', col3X, headerY + 4.5, 1.7, {
      font: resolvedBoldFont,
      color: rgbFrom255(55, 65, 81),
    });
    drawText(
      page,
      `供給: ${formatNumber(designConditions.airflow.supplyAir, 0)} m³/h`,
      col3X,
      headerY + 4.5 + condRowHeight,
      1.6,
      { color: rgbFrom255(75, 85, 99) }
    );
    drawText(
      page,
      `外気: ${formatNumber(designConditions.airflow.outdoorAir, 0)} m³/h`,
      col3X,
      headerY + 4.5 + condRowHeight * 2,
      1.6,
      { color: rgbFrom255(75, 85, 99) }
    );

    const chartY = chartTopMm;
    drawRect(page, marginMm, chartY, chartWidthMm, chartHeightMm, {
      borderColor: rgbFrom255(229, 231, 235),
      borderWidthMm: 0.3,
    });
    const chartDrawY = chartY + (chartHeightMm - drawChartHeightMm) / 2;
    page.drawImage(chartImage, {
      x: mmToPt(chartXOffset),
      y: page.getHeight() - mmToPt(chartDrawY) - mmToPt(drawChartHeightMm),
      width: mmToPt(drawChartWidthMm),
      height: mmToPt(drawChartHeightMm),
    });

    const bottomY = bottomSectionStartMm;
    const halfWidth = contentWidthMm / 2 - 2;
    let statePointY = bottomY;
    drawText(page, '状態点', marginMm, statePointY + 2.5, 2.8, { font: resolvedBoldFont });
    statePointY += 5;

    const statePointCardHeight = 9;
    const statePointMaxY = A4_HEIGHT_MM - marginMm;
    const statePointOverflow: StatePoint[] = [];

    filteredStatePoints.forEach((point, index) => {
      if (statePointY + statePointCardHeight > statePointMaxY) {
        statePointOverflow.push(point);
        return;
      }
      drawStatePointCard(page, point, index, marginMm, statePointY);
      statePointY += statePointCardHeight;
    });

    const processX = marginMm + halfWidth + 4;
    let processY = bottomY;
    const processMaxY = A4_HEIGHT_MM - marginMm;
    const processOverflow: Process[] = [];

    if (filteredProcesses.length > 0) {
      drawText(page, 'プロセス', processX, processY + 2.5, 2.8, { font: resolvedBoldFont });
      processY += 5;
    }

    filteredProcesses.forEach((process) => {
      const fromPoint = filteredStatePoints.find((p) => p.id === process.fromPointId);
      const toPoint = filteredStatePoints.find((p) => p.id === process.toPointId);
      const detailLines: string[] = [
        `種別: ${processTypeLabels[process.type]} | 季節: ${seasonLabel(process.season)}`,
        `状態点: ${fromPoint?.name || '不明'} → ${toPoint?.name || '不明'}`,
      ];
      const mixingAirflowTotal = getMixingAirflowTotal(process, filteredStatePoints);
      if (process.type === 'mixing' && mixingAirflowTotal !== undefined) {
        detailLines.push(`混合後風量: ${mixingAirflowTotal.toFixed(0)} m³/h`);
      }
      const capacity = calculateProcessCapacity(process, filteredStatePoints);
      if (capacity) {
        detailLines.push(
          `全熱: ${Math.abs(capacity.totalCapacity).toFixed(2)} kW | 顕熱: ${Math.abs(capacity.sensibleCapacity).toFixed(2)} kW | 潜熱: ${Math.abs(capacity.latentCapacity).toFixed(2)} kW`
        );
        detailLines.push(
          `SHF: ${capacity.SHF.toFixed(2)} | 温度差: ${capacity.temperatureDiff.toFixed(1)}°C | 湿度差: ${(capacity.humidityDiff * 1000).toFixed(2)} g/kg'`
        );
        detailLines.push(`比エンタルピー差: ${capacity.enthalpyDiff.toFixed(2)} kJ/kg'`);
        if (process.parameters.airflow && capacity.humidityDiff !== 0) {
          detailLines.push(
            `${capacity.humidityDiff < 0 ? '除湿量' : '加湿量'}: ${(Math.abs(capacity.humidityDiff) * process.parameters.airflow * 1.2).toFixed(2)} L/h`
          );
        }
        if (process.type === 'heating' || process.type === 'cooling') {
          const waterTempDiff = process.parameters.waterTempDiff || 7;
          const waterFlowRate = (Math.abs(capacity.totalCapacity) * 60) / (4.186 * waterTempDiff);
          detailLines.push(
            `水温度差: ${waterTempDiff.toFixed(1)}℃ | 水量: ${waterFlowRate.toFixed(2)} L/min`
          );
        }
      }

      const processLineHeight = 2.4;
      const processHeaderHeight = 5;
      const processCardHeight = processHeaderHeight + detailLines.length * processLineHeight + 1;
      if (processY + processCardHeight > processMaxY) {
        processOverflow.push(process);
        return;
      }
      processY += drawProcessCard(page, process, processX, processY);
    });

    if (statePointOverflow.length > 0 || processOverflow.length > 0) {
      const page2 = createPage();
      drawPageBackground(page2);

      drawText(
        page2,
        `${designConditions.project.name || '空気線図'} - 続き`,
        marginMm,
        marginMm + 3,
        3.2,
        { font: resolvedBoldFont }
      );

      let currentY = marginMm + 8;

      if (statePointOverflow.length > 0) {
        drawText(page2, '状態点 (続き)', marginMm, currentY + 2.5, 2.8, { font: resolvedBoldFont });
        currentY += 5;

        statePointOverflow.forEach((point) => {
          const origIndex = filteredStatePoints.findIndex((p) => p.id === point.id);
          drawStatePointCard(page2, point, origIndex, marginMm, currentY);
          currentY += statePointCardHeight;
        });

        currentY += 5;
      }

      if (processOverflow.length > 0) {
        drawText(page2, 'プロセス (続き)', marginMm, currentY + 2.5, 2.8, { font: resolvedBoldFont });
        currentY += 5;

        processOverflow.forEach((process) => {
          currentY += drawProcessCard(page2, process, marginMm, currentY);
        });
      }
    }

    return pdfDoc.save();
  };

  const buildA4Pages = (chartCanvas: HTMLCanvasElement): HTMLCanvasElement[] => {
    const pages: HTMLCanvasElement[] = [];

    // 設定値 (mm)
    const marginMm = 8;
    const headerHeightMm = 14;
    const chartTopMm = marginMm + headerHeightMm + 2;
    const chartHeightMm = 120; // グラフ領域の高さ
    const bottomSectionStartMm = chartTopMm + chartHeightMm + 6;

    const marginPx = mmToPx(marginMm);
    const pageWidthPx = mmToPx(A4_WIDTH_MM);
    const pageHeightPx = mmToPx(A4_HEIGHT_MM);
    const contentWidthPx = pageWidthPx - marginPx * 2;

    // ========================================
    // 1ページ目作成
    // ========================================
    const page1 = document.createElement('canvas');
    page1.width = pageWidthPx;
    page1.height = pageHeightPx;
    const ctx1 = page1.getContext('2d');
    if (!ctx1) throw new Error('キャンバスの生成に失敗しました');

    // 背景（白）
    ctx1.fillStyle = '#ffffff';
    ctx1.fillRect(0, 0, pageWidthPx, pageHeightPx);

    // ヘッダー: プロジェクト名（左）と設計条件（右）
    const headerY = mmToPx(marginMm);

    // プロジェクト名
    ctx1.fillStyle = '#111827';
    ctx1.font = `bold ${mmToPx(4.5)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx1.textAlign = 'left';
    ctx1.fillText(designConditions.project.name || '空気線図', marginPx, headerY + mmToPx(4));

    // プロジェクト情報（サブタイトル）
    ctx1.font = `${mmToPx(2.2)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx1.fillStyle = '#6b7280';
    const projectInfo = [
      designConditions.project.location,
      designConditions.project.date,
      designConditions.project.designer,
    ].filter(Boolean).join(' | ');
    ctx1.fillText(projectInfo || '-', marginPx, headerY + mmToPx(7.5));

    // 設計条件（右側）
    const conditionsX = marginPx + contentWidthPx * 0.45;
    const conditionsWidth = contentWidthPx * 0.55;
    ctx1.font = `bold ${mmToPx(2.2)}px "Noto Sans JP", sans-serif`;
    ctx1.fillStyle = '#374151';
    ctx1.textAlign = 'left';
    ctx1.fillText('設計条件', conditionsX, headerY + mmToPx(2));

    ctx1.font = `${mmToPx(1.8)}px sans-serif`;
    ctx1.fillStyle = '#4b5563';

    const col1X = conditionsX;
    const col2X = conditionsX + conditionsWidth / 3;
    const col3X = conditionsX + (conditionsWidth / 3) * 2;
    const condRowHeight = mmToPx(2.2);

    // 外気条件
    ctx1.font = `bold ${mmToPx(1.7)}px sans-serif`;
    ctx1.fillText('外気条件', col1X, headerY + mmToPx(4.5));
    ctx1.font = `${mmToPx(1.6)}px sans-serif`;
    ctx1.fillText(
      `夏: ${formatNumber(designConditions.outdoor.summer.dryBulbTemp)}°C / ${formatNumber(designConditions.outdoor.summer.relativeHumidity, 0)}%`,
      col1X,
      headerY + mmToPx(4.5) + condRowHeight
    );
    ctx1.fillText(
      `冬: ${formatNumber(designConditions.outdoor.winter.dryBulbTemp)}°C / ${formatNumber(designConditions.outdoor.winter.relativeHumidity, 0)}%`,
      col1X,
      headerY + mmToPx(4.5) + condRowHeight * 2
    );

    // 室内条件
    ctx1.font = `bold ${mmToPx(1.7)}px sans-serif`;
    ctx1.fillText('室内条件', col2X, headerY + mmToPx(4.5));
    ctx1.font = `${mmToPx(1.6)}px sans-serif`;
    ctx1.fillText(
      `夏: ${formatNumber(designConditions.indoor.summer.dryBulbTemp)}°C / ${formatNumber(designConditions.indoor.summer.relativeHumidity, 0)}%`,
      col2X,
      headerY + mmToPx(4.5) + condRowHeight
    );
    ctx1.fillText(
      `冬: ${formatNumber(designConditions.indoor.winter.dryBulbTemp)}°C / ${formatNumber(designConditions.indoor.winter.relativeHumidity, 0)}%`,
      col2X,
      headerY + mmToPx(4.5) + condRowHeight * 2
    );

    // 風量
    ctx1.font = `bold ${mmToPx(1.7)}px sans-serif`;
    ctx1.fillText('風量', col3X, headerY + mmToPx(4.5));
    ctx1.font = `${mmToPx(1.6)}px sans-serif`;
    ctx1.fillText(
      `供給: ${formatNumber(designConditions.airflow.supplyAir, 0)} m³/h`,
      col3X,
      headerY + mmToPx(4.5) + condRowHeight
    );
    ctx1.fillText(
      `外気: ${formatNumber(designConditions.airflow.outdoorAir, 0)} m³/h`,
      col3X,
      headerY + mmToPx(4.5) + condRowHeight * 2
    );

    // チャート描画（上半分）
    const chartY = mmToPx(chartTopMm);
    const chartWidthPx = contentWidthPx;
    const chartHeightPx = mmToPx(chartHeightMm);
    const chartAspectRatio = chartCanvas.width / chartCanvas.height;
    let drawChartWidth = chartWidthPx;
    let drawChartHeight = chartWidthPx / chartAspectRatio;

    if (drawChartHeight > chartHeightPx) {
      drawChartHeight = chartHeightPx;
      drawChartWidth = chartHeightPx * chartAspectRatio;
    }

    const chartXOffset = marginPx + (chartWidthPx - drawChartWidth) / 2;

    // チャート枠
    ctx1.strokeStyle = '#e5e7eb';
    ctx1.lineWidth = 1;
    ctx1.strokeRect(marginPx, chartY, chartWidthPx, chartHeightPx);

    // チャート描画 (PDF用にPC相当の解像度で再レンダリング)
    const chartRenderWidth = Math.round(drawChartWidth);
    const chartRenderHeight = Math.round(drawChartHeight);
    const chartRenderCanvas = document.createElement('canvas');
    chartRenderCanvas.width = chartRenderWidth;
    chartRenderCanvas.height = chartRenderHeight;
    renderPsychrometricChart({
      canvas: chartRenderCanvas,
      width: chartRenderWidth,
      height: chartRenderHeight,
      statePoints: filteredStatePoints,
      processes: filteredProcesses,
      activeSeason,
      resolutionScale: 1,
    });

    ctx1.imageSmoothingEnabled = true;
    ctx1.imageSmoothingQuality = 'high';
    ctx1.drawImage(
      chartRenderCanvas,
      chartXOffset,
      chartY + (chartHeightPx - drawChartHeight) / 2,
      drawChartWidth,
      drawChartHeight
    );

    // 下半分のレイアウト
    const bottomY = mmToPx(bottomSectionStartMm);
    const halfWidth = contentWidthPx / 2 - mmToPx(2);

    // ========================================
    // 状態点セクション（左半分）
    // ========================================
    let statePointY = bottomY;
    ctx1.fillStyle = '#111827';
    ctx1.font = `bold ${mmToPx(2.8)}px "Noto Sans JP", sans-serif`;
    ctx1.textAlign = 'left';
    ctx1.fillText('状態点', marginPx, statePointY + mmToPx(2.5));
    statePointY += mmToPx(5);

    // 状態点テーブルヘッダー
    const statePointCardHeight = mmToPx(9);
    const statePointMaxY = pageHeightPx - marginPx;
    const statePointOverflow: StatePoint[] = [];

    filteredStatePoints.forEach((point, index) => {
      if (statePointY + statePointCardHeight > statePointMaxY) {
        statePointOverflow.push(point);
        return;
      }

      const label = getPointLabel(point, index);
      const seasonColor =
        point.season === 'summer' ? '#3b82f6' :
        point.season === 'winter' ? '#ef4444' : '#8b5cf6';

      // バッジ
      ctx1.fillStyle = seasonColor;
      ctx1.beginPath();
      ctx1.roundRect(marginPx, statePointY, mmToPx(6), mmToPx(3.5), mmToPx(0.5));
      ctx1.fill();

      ctx1.fillStyle = '#ffffff';
      ctx1.font = `bold ${mmToPx(1.9)}px sans-serif`;
      ctx1.textAlign = 'center';
      ctx1.fillText(label, marginPx + mmToPx(3), statePointY + mmToPx(2.3));
      ctx1.textAlign = 'left';

      // 名前と物性値
      ctx1.fillStyle = '#111827';
      ctx1.font = `bold ${mmToPx(2.1)}px "Noto Sans JP", sans-serif`;
      ctx1.fillText(point.name, marginPx + mmToPx(7), statePointY + mmToPx(2.2));

      ctx1.fillStyle = '#6b7280';
      ctx1.font = `${mmToPx(1.6)}px sans-serif`;
      const airflowText =
        typeof point.airflow === 'number' ? `${point.airflow.toFixed(0)} m³/h` : '-';
      const propTextLine1 = `温度: ${formatNumber(point.dryBulbTemp)}°C | RH: ${formatNumber(point.relativeHumidity, 0)}% | 絶対湿度: ${formatNumber(point.humidity, 4)} kg/kg'`;
      const propTextLine2 = `エンタルピー: ${formatNumber(point.enthalpy)} kJ/kg' | 風量: ${airflowText} | 季節: ${seasonLabel(point.season)}`;
      ctx1.fillText(propTextLine1, marginPx + mmToPx(7), statePointY + mmToPx(4.8));
      ctx1.fillText(propTextLine2, marginPx + mmToPx(7), statePointY + mmToPx(7));

      statePointY += statePointCardHeight;
    });

    // ========================================
    // プロセスセクション（右半分）
    // ========================================
    const processX = marginPx + halfWidth + mmToPx(4);
    let processY = bottomY;
    ctx1.fillStyle = '#111827';
    ctx1.textAlign = 'left';
    if (filteredProcesses.length > 0) {
      ctx1.font = `bold ${mmToPx(2.8)}px "Noto Sans JP", sans-serif`;
      ctx1.fillText('プロセス', processX, processY + mmToPx(2.5));
      processY += mmToPx(5);
    }

    const processLineHeight = mmToPx(2.4);
    const processHeaderHeight = mmToPx(5);
    const processMaxY = pageHeightPx - marginPx;
    const processOverflow: Process[] = [];

    filteredProcesses.forEach((process) => {
      const fromPoint = filteredStatePoints.find((p) => p.id === process.fromPointId);
      const toPoint = filteredStatePoints.find((p) => p.id === process.toPointId);
      const detailLines: string[] = [
        `種別: ${processTypeLabels[process.type]} | 季節: ${seasonLabel(process.season)}`,
        `状態点: ${fromPoint?.name || '不明'} → ${toPoint?.name || '不明'}`,
      ];
      const mixingAirflowTotal = getMixingAirflowTotal(process, filteredStatePoints);
      if (process.type === 'mixing' && mixingAirflowTotal !== undefined) {
        detailLines.push(`混合後風量: ${mixingAirflowTotal.toFixed(0)} m³/h`);
      }
      const capacity = calculateProcessCapacity(process, filteredStatePoints);
      if (capacity) {
        detailLines.push(
          `全熱: ${Math.abs(capacity.totalCapacity).toFixed(2)} kW | 顕熱: ${Math.abs(capacity.sensibleCapacity).toFixed(2)} kW | 潜熱: ${Math.abs(capacity.latentCapacity).toFixed(2)} kW`
        );
        detailLines.push(
          `SHF: ${capacity.SHF.toFixed(2)} | 温度差: ${capacity.temperatureDiff.toFixed(1)}°C | 湿度差: ${(capacity.humidityDiff * 1000).toFixed(2)} g/kg'`
        );
        detailLines.push(`比エンタルピー差: ${capacity.enthalpyDiff.toFixed(2)} kJ/kg'`);
        if (process.parameters.airflow && capacity.humidityDiff !== 0) {
          detailLines.push(
            `${capacity.humidityDiff < 0 ? '除湿量' : '加湿量'}: ${(Math.abs(capacity.humidityDiff) * process.parameters.airflow * 1.2).toFixed(2)} L/h`
          );
        }
        if (process.type === 'heating' || process.type === 'cooling') {
          const waterTempDiff = process.parameters.waterTempDiff || 7;
          const waterFlowRate = (Math.abs(capacity.totalCapacity) * 60) / (4.186 * waterTempDiff);
          detailLines.push(
            `水温度差: ${waterTempDiff.toFixed(1)}℃ | 水量: ${waterFlowRate.toFixed(2)} L/min`
          );
        }
      }

      const processCardHeight = processHeaderHeight + detailLines.length * processLineHeight + mmToPx(1);
      if (processY + processCardHeight > processMaxY) {
        processOverflow.push(process);
        return;
      }

      const fromLabel = getPointLabelById(process.fromPointId);
      const toLabel = getPointLabelById(process.toPointId);

      const seasonColor =
        process.season === 'summer' ? '#3b82f6' :
        process.season === 'winter' ? '#ef4444' : '#8b5cf6';

      // カラーバー
      ctx1.fillStyle = seasonColor;
      ctx1.fillRect(processX, processY, mmToPx(1), processCardHeight - mmToPx(1));

      // プロセス名
      ctx1.fillStyle = '#111827';
      ctx1.font = `bold ${mmToPx(2.1)}px "Noto Sans JP", sans-serif`;
      ctx1.fillText(process.name, processX + mmToPx(2.5), processY + mmToPx(2.4));

      // 遷移ラベル
      ctx1.fillStyle = '#6b7280';
      ctx1.font = `${mmToPx(1.7)}px sans-serif`;
      ctx1.fillText(`${fromLabel} → ${toLabel}`, processX + mmToPx(2.5), processY + mmToPx(4.4));

      // 詳細情報
      ctx1.font = `${mmToPx(1.6)}px sans-serif`;
      detailLines.forEach((line, lineIndex) => {
        ctx1.fillText(
          line,
          processX + mmToPx(2.5),
          processY + mmToPx(6.4) + lineIndex * processLineHeight
        );
      });

      processY += processCardHeight;
    });

    pages.push(page1);

    // ========================================
    // 2ページ目以降（オーバーフロー分）
    // ========================================
    if (statePointOverflow.length > 0 || processOverflow.length > 0) {
      const page2 = document.createElement('canvas');
      page2.width = pageWidthPx;
      page2.height = pageHeightPx;
      const ctx2 = page2.getContext('2d');
      if (!ctx2) throw new Error('キャンバスの生成に失敗しました');

      // 背景
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, pageWidthPx, pageHeightPx);

      // ヘッダー
      ctx2.fillStyle = '#111827';
      ctx2.font = `bold ${mmToPx(3.2)}px "Noto Sans JP", sans-serif`;
      ctx2.textAlign = 'left';
      ctx2.fillText(`${designConditions.project.name || '空気線図'} - 続き`, marginPx, marginPx + mmToPx(3));

      let currentY = marginPx + mmToPx(8);

      // 残りの状態点
      if (statePointOverflow.length > 0) {
        ctx2.fillStyle = '#111827';
        ctx2.font = `bold ${mmToPx(2.8)}px "Noto Sans JP", sans-serif`;
        ctx2.fillText('状態点 (続き)', marginPx, currentY + mmToPx(2.5));
        currentY += mmToPx(5);

        statePointOverflow.forEach((point) => {
          const origIndex = filteredStatePoints.findIndex((p) => p.id === point.id);
          const label = getPointLabel(point, origIndex);
          const seasonColor =
            point.season === 'summer' ? '#3b82f6' :
            point.season === 'winter' ? '#ef4444' : '#8b5cf6';

          ctx2.fillStyle = seasonColor;
          ctx2.beginPath();
          ctx2.roundRect(marginPx, currentY, mmToPx(6), mmToPx(3.5), mmToPx(0.5));
          ctx2.fill();

          ctx2.fillStyle = '#ffffff';
          ctx2.font = `bold ${mmToPx(1.9)}px sans-serif`;
          ctx2.textAlign = 'center';
          ctx2.fillText(label, marginPx + mmToPx(3), currentY + mmToPx(2.3));
          ctx2.textAlign = 'left';

          ctx2.fillStyle = '#111827';
          ctx2.font = `bold ${mmToPx(2.1)}px "Noto Sans JP", sans-serif`;
          ctx2.fillText(point.name, marginPx + mmToPx(7), currentY + mmToPx(2.2));

          ctx2.fillStyle = '#6b7280';
          ctx2.font = `${mmToPx(1.6)}px sans-serif`;
          const airflowText =
            typeof point.airflow === 'number' ? `${point.airflow.toFixed(0)} m³/h` : '-';
          const propTextLine1 = `温度: ${formatNumber(point.dryBulbTemp)}°C | RH: ${formatNumber(point.relativeHumidity, 0)}% | 絶対湿度: ${formatNumber(point.humidity, 4)} kg/kg'`;
          const propTextLine2 = `エンタルピー: ${formatNumber(point.enthalpy)} kJ/kg' | 風量: ${airflowText} | 季節: ${seasonLabel(point.season)}`;
          ctx2.fillText(propTextLine1, marginPx + mmToPx(7), currentY + mmToPx(4.8));
          ctx2.fillText(propTextLine2, marginPx + mmToPx(7), currentY + mmToPx(7));

          currentY += statePointCardHeight;
        });

        currentY += mmToPx(5);
      }

      // 残りのプロセス
      if (processOverflow.length > 0) {
        ctx2.fillStyle = '#111827';
        ctx2.font = `bold ${mmToPx(2.8)}px "Noto Sans JP", sans-serif`;
        ctx2.fillText('プロセス (続き)', marginPx, currentY + mmToPx(2.5));
        currentY += mmToPx(5);

        processOverflow.forEach((process) => {
          const fromPoint = filteredStatePoints.find((p) => p.id === process.fromPointId);
          const toPoint = filteredStatePoints.find((p) => p.id === process.toPointId);
          const fromLabel = getPointLabelById(process.fromPointId);
          const toLabel = getPointLabelById(process.toPointId);
          const detailLines: string[] = [
            `種別: ${processTypeLabels[process.type]} | 季節: ${seasonLabel(process.season)}`,
            `状態点: ${fromPoint?.name || '不明'} → ${toPoint?.name || '不明'}`,
          ];
          const mixingAirflowTotal = getMixingAirflowTotal(process, filteredStatePoints);
          if (process.type === 'mixing' && mixingAirflowTotal !== undefined) {
            detailLines.push(`混合後風量: ${mixingAirflowTotal.toFixed(0)} m³/h`);
          }
          const capacity = calculateProcessCapacity(process, filteredStatePoints);
          if (capacity) {
            detailLines.push(
              `全熱: ${Math.abs(capacity.totalCapacity).toFixed(2)} kW | 顕熱: ${Math.abs(capacity.sensibleCapacity).toFixed(2)} kW | 潜熱: ${Math.abs(capacity.latentCapacity).toFixed(2)} kW`
            );
            detailLines.push(
              `SHF: ${capacity.SHF.toFixed(2)} | 温度差: ${capacity.temperatureDiff.toFixed(1)}°C | 湿度差: ${(capacity.humidityDiff * 1000).toFixed(2)} g/kg'`
            );
            detailLines.push(`比エンタルピー差: ${capacity.enthalpyDiff.toFixed(2)} kJ/kg'`);
            if (process.parameters.airflow && capacity.humidityDiff !== 0) {
              detailLines.push(
                `${capacity.humidityDiff < 0 ? '除湿量' : '加湿量'}: ${(Math.abs(capacity.humidityDiff) * process.parameters.airflow * 1.2).toFixed(2)} L/h`
              );
            }
            if (process.type === 'heating' || process.type === 'cooling') {
              const waterTempDiff = process.parameters.waterTempDiff || 7;
              const waterFlowRate = (Math.abs(capacity.totalCapacity) * 60) / (4.186 * waterTempDiff);
              detailLines.push(
                `水温度差: ${waterTempDiff.toFixed(1)}℃ | 水量: ${waterFlowRate.toFixed(2)} L/min`
              );
            }
          }

          const processCardHeight = processHeaderHeight + detailLines.length * processLineHeight + mmToPx(1);

          const seasonColor =
            process.season === 'summer' ? '#3b82f6' :
            process.season === 'winter' ? '#ef4444' : '#8b5cf6';

          ctx2.fillStyle = seasonColor;
          ctx2.fillRect(marginPx, currentY, mmToPx(1), processCardHeight - mmToPx(1));

          ctx2.fillStyle = '#111827';
          ctx2.font = `bold ${mmToPx(2.1)}px "Noto Sans JP", sans-serif`;
          ctx2.fillText(process.name, marginPx + mmToPx(2.5), currentY + mmToPx(2.4));

          ctx2.fillStyle = '#6b7280';
          ctx2.font = `${mmToPx(1.7)}px sans-serif`;
          ctx2.fillText(`${fromLabel} → ${toLabel}`, marginPx + mmToPx(2.5), currentY + mmToPx(4.4));

          ctx2.font = `${mmToPx(1.6)}px sans-serif`;
          detailLines.forEach((line, lineIndex) => {
            ctx2.fillText(
              line,
              marginPx + mmToPx(2.5),
              currentY + mmToPx(6.4) + lineIndex * processLineHeight
            );
          });

          currentY += processCardHeight;
        });
      }

      pages.push(page2);
    }

    return pages;
  };

  const handleExportPNG = async () => {
    if (!canvasRef.current) {
      alert('チャートが見つかりません');
      return;
    }

    setIsExporting(true);
    setExportType('png');

    try {
      const canvas = canvasRef.current;
      const pages = buildA4Pages(canvas);
      const dataUrl = pages[0].toDataURL('image/png');

      // ダウンロードリンクを作成
      const link = document.createElement('a');
      link.download = `psychrometric-chart-${designConditions.project.name}.png`;
      link.href = dataUrl;
      link.click();

      onClose();
    } catch (error) {
      console.error('PNG export failed:', error);
      alert('PNG出力に失敗しました');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportPDF = async () => {
    if (!canvasRef.current) {
      alert('チャートが見つかりません');
      return;
    }

    setIsExporting(true);
    setExportType('pdf');

    try {
      const canvas = canvasRef.current;

      // キャンバスが有効かチェック
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('チャートの描画領域が無効です');
      }

      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const pdfBytes = await renderPdfPages(canvas);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      if (pdfBlob.size === 0) {
        throw new Error('PDFの生成に失敗しました');
      }

      const blobUrl = URL.createObjectURL(pdfBlob);
      const newWindow = window.open(blobUrl, '_blank');

      // ポップアップブロック対策: 新しいウィンドウが開けなかった場合はダウンロード
      if (!newWindow) {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `psychrometric-chart-${designConditions.project.name || 'export'}.pdf`;
        link.click();
      }

      onClose();
    } catch (error) {
      console.error('PDF export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'PDF出力に失敗しました';
      alert(`PDF出力エラー: ${errorMessage}`);
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">エクスポート</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isExporting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            空気線図と設計条件を含むファイルを出力できます。
          </p>

          <div className="space-y-3">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {isExporting && exportType === 'pdf' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <div>
                <div className="font-semibold">PDFファイル（新しいウィンドウで開く）</div>
                <div className="text-sm text-blue-100">
                  空気線図と設計条件・状態点・プロセスを含む
                </div>
              </div>
            </button>

            <button
              onClick={handleExportPNG}
              disabled={isExporting}
              className="w-full px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
            >
              {isExporting && exportType === 'png' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileImage className="w-5 h-5" />
              )}
              <div>
                <div className="font-semibold">PNG画像</div>
                <div className="text-sm text-gray-600">
                  空気線図と状態点・プロセスを含む
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
