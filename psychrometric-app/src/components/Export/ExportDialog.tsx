import { useState } from 'react';
import { X, FileImage, FileText, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { DesignConditions } from '@/types/designConditions';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';

interface ExportDialogProps {
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  designConditions: DesignConditions;
  statePoints: StatePoint[];
  processes: Process[];
  activeSeason: 'summer' | 'winter' | 'both';
}

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

  // A4縦向き
  const A4_SIZE_MM = { width: 210, height: 297 };
  const A4_DPI = 600; // Increased DPI for better quality

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * A4_DPI);

  const formatNumber = (value?: number, digits = 1) =>
    value === undefined || Number.isNaN(value) ? '-' : value.toFixed(digits);

  const buildA4Canvas = (chartCanvas: HTMLCanvasElement) => {
    const a4Canvas = document.createElement('canvas');
    a4Canvas.width = mmToPx(A4_SIZE_MM.width);
    a4Canvas.height = mmToPx(A4_SIZE_MM.height);

    const ctx = a4Canvas.getContext('2d');
    if (!ctx) {
      throw new Error('キャンバスの生成に失敗しました');
    }

    const marginMm = 10;
    const headerHeightMm = 18;
    const sectionGapMm = 5;
    const cardPaddingMm = 4;
    const cardGapMm = 3;

    const marginPx = mmToPx(marginMm);
    const headerHeightPx = mmToPx(headerHeightMm);
    const sectionGapPx = mmToPx(sectionGapMm);
    const cardPaddingPx = mmToPx(cardPaddingMm);
    const cardGapPx = mmToPx(cardGapMm);

    const contentWidthPx = a4Canvas.width - marginPx * 2;

    // 背景（薄いグレー）
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, a4Canvas.width, a4Canvas.height);

    // ヘッダー背景（白）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, a4Canvas.width, mmToPx(headerHeightMm + marginMm));

    // プロジェクト名
    ctx.fillStyle = '#111827';
    ctx.font = `bold ${mmToPx(5)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillText(designConditions.project.name || '空気線図', marginPx, marginPx + mmToPx(5));

    // プロジェクト情報
    ctx.font = `${mmToPx(2.8)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillStyle = '#6b7280';
    const projectInfo = [
      designConditions.project.location,
      designConditions.project.date,
      designConditions.project.designer,
    ].filter(Boolean).join(' | ');
    ctx.fillText(projectInfo || '-', marginPx, marginPx + mmToPx(10));

    // チャート領域（カード風）
    const chartCardY = marginPx + headerHeightPx;
    const chartAspectRatio = chartCanvas.width / chartCanvas.height;
    const chartWidthPx = contentWidthPx;
    const chartHeightPx = chartWidthPx / chartAspectRatio;
    const chartCardHeightPx = chartHeightPx + cardPaddingPx * 2;

    // チャートカード背景
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(marginPx, chartCardY, contentWidthPx, chartCardHeightPx, mmToPx(2));
    ctx.fill();

    // チャート描画
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      chartCanvas,
      marginPx + cardPaddingPx,
      chartCardY + cardPaddingPx,
      chartWidthPx - cardPaddingPx * 2,
      chartHeightPx
    );

    // Filter state points by active season
    const filteredStatePoints = statePoints
      .filter((point) => {
        if (activeSeason === 'both') return true;
        return point.season === activeSeason || point.season === 'both';
      })
      .sort((a, b) => a.order - b.order);

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

    // 状態点セクション
    let currentY = chartCardY + chartCardHeightPx + sectionGapPx;

    // 状態点タイトル
    ctx.fillStyle = '#111827';
    ctx.font = `bold ${mmToPx(3.5)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillText('状態点', marginPx, currentY + mmToPx(3));
    currentY += mmToPx(6);

    // 状態点カード
    const statePointCardHeight = mmToPx(14);
    filteredStatePoints.forEach((point, index) => {
      if (currentY + statePointCardHeight > a4Canvas.height - marginPx) return;

      const label = getPointLabel(point, index);
      const seasonColor =
        point.season === 'summer' ? '#3b82f6' :
        point.season === 'winter' ? '#ef4444' : '#8b5cf6';

      // カード背景
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(marginPx, currentY, contentWidthPx, statePointCardHeight, mmToPx(1.5));
      ctx.fill();

      // ラベルバッジ
      ctx.fillStyle = seasonColor;
      ctx.beginPath();
      ctx.roundRect(marginPx + cardPaddingPx, currentY + mmToPx(3), mmToPx(10), mmToPx(5), mmToPx(1));
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${mmToPx(2.8)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, marginPx + cardPaddingPx + mmToPx(5), currentY + mmToPx(6.2));
      ctx.textAlign = 'left';

      // 名前
      ctx.fillStyle = '#111827';
      ctx.font = `bold ${mmToPx(3)}px "Noto Sans JP", sans-serif`;
      ctx.fillText(point.name, marginPx + cardPaddingPx + mmToPx(13), currentY + mmToPx(6));

      // 物性値
      ctx.fillStyle = '#6b7280';
      ctx.font = `${mmToPx(2.5)}px sans-serif`;
      const propText = `${formatNumber(point.dryBulbTemp)}°C | ${formatNumber(point.relativeHumidity, 0)}%RH | ${formatNumber(point.humidity, 4)} kg/kg' | ${formatNumber(point.enthalpy)} kJ/kg'`;
      ctx.fillText(propText, marginPx + cardPaddingPx + mmToPx(13), currentY + mmToPx(10.5));

      currentY += statePointCardHeight + cardGapPx;
    });

    // プロセスセクション
    currentY += sectionGapPx;

    // Filter processes by active season
    const filteredProcesses = processes.filter((process) => {
      if (activeSeason === 'both') return true;
      return process.season === activeSeason || process.season === 'both';
    });

    if (filteredProcesses.length > 0 && currentY + mmToPx(10) < a4Canvas.height - marginPx) {
      // プロセスタイトル
      ctx.fillStyle = '#111827';
      ctx.font = `bold ${mmToPx(3.5)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
      ctx.fillText('プロセス', marginPx, currentY + mmToPx(3));
      currentY += mmToPx(6);

      // Helper function to get label for a state point by ID
      const getPointLabelById = (pointId: string): string => {
        const pointIndex = filteredStatePoints.findIndex((p) => p.id === pointId);
        if (pointIndex === -1) return '?';
        const point = filteredStatePoints[pointIndex];
        return `${getPointLabel(point, pointIndex)}`;
      };

      const processCardHeight = mmToPx(18);
      filteredProcesses.forEach((process) => {
        if (currentY + processCardHeight > a4Canvas.height - marginPx) return;

        const fromPoint = filteredStatePoints.find((p) => p.id === process.fromPointId);
        const toPoint = filteredStatePoints.find((p) => p.id === process.toPointId);
        const fromLabel = getPointLabelById(process.fromPointId);
        const toLabel = getPointLabelById(process.toPointId);

        const seasonColor =
          process.season === 'summer' ? '#3b82f6' :
          process.season === 'winter' ? '#ef4444' : '#8b5cf6';

        // カード背景
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(marginPx, currentY, contentWidthPx, processCardHeight, mmToPx(1.5));
        ctx.fill();

        // 左側のカラーバー
        ctx.fillStyle = seasonColor;
        ctx.beginPath();
        ctx.roundRect(marginPx, currentY, mmToPx(1.5), processCardHeight, mmToPx(1.5));
        ctx.fill();

        // プロセス名と矢印
        ctx.fillStyle = '#111827';
        ctx.font = `bold ${mmToPx(3)}px "Noto Sans JP", sans-serif`;
        ctx.fillText(`${process.name}`, marginPx + cardPaddingPx + mmToPx(3), currentY + mmToPx(5.5));

        ctx.fillStyle = '#6b7280';
        ctx.font = `${mmToPx(2.8)}px sans-serif`;
        ctx.fillText(`${fromLabel} → ${toLabel}`, marginPx + cardPaddingPx + mmToPx(3), currentY + mmToPx(10));

        // 詳細情報
        if (fromPoint && toPoint && fromPoint.enthalpy && toPoint.enthalpy) {
          const enthalpyDiff = toPoint.enthalpy - fromPoint.enthalpy;
          const humidityDiff = (toPoint.humidity || 0) - (fromPoint.humidity || 0);

          let detailText = '';
          if (process.parameters.airflow) {
            const totalCapacity = (enthalpyDiff * process.parameters.airflow * 1.2) / 3600;
            detailText = `全熱: ${Math.abs(totalCapacity).toFixed(2)} kW`;
            if (humidityDiff !== 0) {
              const moistureAmount = Math.abs(humidityDiff) * process.parameters.airflow * 1.2;
              detailText += ` | ${humidityDiff < 0 ? '除湿' : '加湿'}: ${moistureAmount.toFixed(2)} L/h`;
            }
          }
          if (process.parameters.heatExchangeEfficiency) {
            detailText += (detailText ? ' | ' : '') + `効率: ${process.parameters.heatExchangeEfficiency.toFixed(0)}%`;
          }
          ctx.fillText(detailText, marginPx + cardPaddingPx + mmToPx(3), currentY + mmToPx(14.5));
        }

        currentY += processCardHeight + cardGapPx;
      });
    }

    // 設計条件セクション（下部に配置）
    currentY += sectionGapPx;

    if (currentY + mmToPx(25) < a4Canvas.height - marginPx) {
      ctx.fillStyle = '#111827';
      ctx.font = `bold ${mmToPx(3.5)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
      ctx.fillText('設計条件', marginPx, currentY + mmToPx(3));
      currentY += mmToPx(6);

      // 設計条件カード
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(marginPx, currentY, contentWidthPx, mmToPx(20), mmToPx(1.5));
      ctx.fill();

      ctx.fillStyle = '#374151';
      ctx.font = `${mmToPx(2.5)}px "Noto Sans JP", sans-serif`;

      const col1X = marginPx + cardPaddingPx;
      const col2X = marginPx + contentWidthPx / 3;
      const col3X = marginPx + (contentWidthPx / 3) * 2;
      const rowHeight = mmToPx(4);

      // 外気条件
      ctx.font = `bold ${mmToPx(2.5)}px "Noto Sans JP", sans-serif`;
      ctx.fillText('外気条件', col1X, currentY + mmToPx(4));
      ctx.font = `${mmToPx(2.3)}px sans-serif`;
      ctx.fillText(
        `夏: ${formatNumber(designConditions.outdoor.summer.dryBulbTemp)}°C / ${formatNumber(designConditions.outdoor.summer.relativeHumidity, 0)}%`,
        col1X,
        currentY + mmToPx(4) + rowHeight
      );
      ctx.fillText(
        `冬: ${formatNumber(designConditions.outdoor.winter.dryBulbTemp)}°C / ${formatNumber(designConditions.outdoor.winter.relativeHumidity, 0)}%`,
        col1X,
        currentY + mmToPx(4) + rowHeight * 2
      );

      // 室内条件
      ctx.font = `bold ${mmToPx(2.5)}px "Noto Sans JP", sans-serif`;
      ctx.fillText('室内条件', col2X, currentY + mmToPx(4));
      ctx.font = `${mmToPx(2.3)}px sans-serif`;
      ctx.fillText(
        `夏: ${formatNumber(designConditions.indoor.summer.dryBulbTemp)}°C / ${formatNumber(designConditions.indoor.summer.relativeHumidity, 0)}%`,
        col2X,
        currentY + mmToPx(4) + rowHeight
      );
      ctx.fillText(
        `冬: ${formatNumber(designConditions.indoor.winter.dryBulbTemp)}°C / ${formatNumber(designConditions.indoor.winter.relativeHumidity, 0)}%`,
        col2X,
        currentY + mmToPx(4) + rowHeight * 2
      );

      // 風量
      ctx.font = `bold ${mmToPx(2.5)}px "Noto Sans JP", sans-serif`;
      ctx.fillText('風量', col3X, currentY + mmToPx(4));
      ctx.font = `${mmToPx(2.3)}px sans-serif`;
      ctx.fillText(
        `供給: ${formatNumber(designConditions.airflow.supplyAir, 0)} m³/h`,
        col3X,
        currentY + mmToPx(4) + rowHeight
      );
      ctx.fillText(
        `外気: ${formatNumber(designConditions.airflow.outdoorAir, 0)} m³/h`,
        col3X,
        currentY + mmToPx(4) + rowHeight * 2
      );
    }

    return a4Canvas;
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
      const exportCanvas = buildA4Canvas(canvas);
      const dataUrl = exportCanvas.toDataURL('image/png');

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
      const exportCanvas = buildA4Canvas(canvas);
      const chartImage = exportCanvas.toDataURL('image/png');

      const pdf = new jsPDF('portrait', 'mm', 'a4');

      // Calculate proper aspect ratio to avoid stretching
      const canvasAspectRatio = exportCanvas.width / exportCanvas.height;
      const pdfAspectRatio = A4_SIZE_MM.width / A4_SIZE_MM.height;

      let imgWidth = A4_SIZE_MM.width;
      let imgHeight = A4_SIZE_MM.height;

      if (canvasAspectRatio > pdfAspectRatio) {
        // Canvas is wider than PDF page
        imgHeight = A4_SIZE_MM.width / canvasAspectRatio;
      } else {
        // Canvas is taller than PDF page
        imgWidth = A4_SIZE_MM.height * canvasAspectRatio;
      }

      // Center the image on the page
      const xOffset = (A4_SIZE_MM.width - imgWidth) / 2;
      const yOffset = (A4_SIZE_MM.height - imgHeight) / 2;

      pdf.addImage(
        chartImage,
        'PNG',
        xOffset,
        yOffset,
        imgWidth,
        imgHeight
      );

      // PDFを保存
      pdf.save(`psychrometric-chart-${designConditions.project.name}.pdf`);

      onClose();
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF出力に失敗しました');
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
                <div className="font-semibold">PDFファイル</div>
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
