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
}

export const ExportDialog = ({
  onClose,
  canvasRef,
  designConditions,
  statePoints,
  processes,
}: ExportDialogProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'png' | null>(null);

  const A4_SIZE_MM = { width: 297, height: 210 };
  const A4_DPI = 600; // Increased DPI for better quality

  const mmToPx = (mm: number) => Math.round((mm / 25.4) * A4_DPI);

  const formatNumber = (value?: number, digits = 1) =>
    value === undefined || Number.isNaN(value) ? '-' : value.toFixed(digits);

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ) => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const buildA4Canvas = (chartCanvas: HTMLCanvasElement) => {
    const a4Canvas = document.createElement('canvas');
    a4Canvas.width = mmToPx(A4_SIZE_MM.width);
    a4Canvas.height = mmToPx(A4_SIZE_MM.height);

    const ctx = a4Canvas.getContext('2d');
    if (!ctx) {
      throw new Error('キャンバスの生成に失敗しました');
    }

    const marginMm = 12;
    const headerHeightMm = 16;
    const chartAreaHeightMm = 110;
    const sectionGapMm = 6;
    const columnGapMm = 6;

    const marginPx = mmToPx(marginMm);
    const headerHeightPx = mmToPx(headerHeightMm);
    const chartAreaHeightPx = mmToPx(chartAreaHeightMm);
    const sectionGapPx = mmToPx(sectionGapMm);
    const columnGapPx = mmToPx(columnGapMm);

    const contentWidthPx = a4Canvas.width - marginPx * 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, a4Canvas.width, a4Canvas.height);

    ctx.fillStyle = '#111827';
    ctx.font = `${mmToPx(4)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    ctx.fillText(designConditions.project.name || '空気線図', marginPx, marginPx);

    ctx.font = `${mmToPx(2.8)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
    const infoLines = [
      `場所: ${designConditions.project.location || '-'}`,
      `日付: ${designConditions.project.date || '-'}`,
    ];
    if (designConditions.project.designer) {
      infoLines.push(`設計者: ${designConditions.project.designer}`);
    }
    infoLines.forEach((line, index) => {
      ctx.fillText(line, marginPx, marginPx + mmToPx(6) + index * mmToPx(4));
    });

    const chartWidthPx = contentWidthPx;
    const chartHeightPx = Math.min(
      (chartCanvas.height / chartCanvas.width) * chartWidthPx,
      chartAreaHeightPx
    );
    const chartX = marginPx;
    const chartY = marginPx + headerHeightPx;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(chartCanvas, chartX, chartY, chartWidthPx, chartHeightPx);

    const sectionStartY = chartY + chartHeightPx + sectionGapPx;
    const sectionBottom = a4Canvas.height - marginPx;
    const columnWidthPx =
      (contentWidthPx - columnGapPx * 2) / 3;

    const drawSection = (title: string, lines: string[], startX: number) => {
      let y = sectionStartY;
      ctx.fillStyle = '#111827';
      ctx.font = `${mmToPx(3.2)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
      ctx.fillText(title, startX, y);
      y += mmToPx(4.5);

      ctx.font = `${mmToPx(2.6)}px "Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;
      lines.forEach((line) => {
        if (y > sectionBottom) {
          return;
        }
        wrapText(ctx, line, columnWidthPx).forEach((wrappedLine) => {
          if (y > sectionBottom) {
            return;
          }
          ctx.fillText(wrappedLine, startX, y);
          y += mmToPx(3.8);
        });
      });
    };

    const designLines = [
      `外気(夏): 乾球 ${formatNumber(
        designConditions.outdoor.summer.dryBulbTemp
      )}℃ / RH ${formatNumber(
        designConditions.outdoor.summer.relativeHumidity,
        0
      )}%`,
      `外気(冬): 乾球 ${formatNumber(
        designConditions.outdoor.winter.dryBulbTemp
      )}℃ / RH ${formatNumber(
        designConditions.outdoor.winter.relativeHumidity,
        0
      )}%`,
      `室内(夏): 乾球 ${formatNumber(
        designConditions.indoor.summer.dryBulbTemp
      )}℃ / RH ${formatNumber(
        designConditions.indoor.summer.relativeHumidity,
        0
      )}%`,
      `室内(冬): 乾球 ${formatNumber(
        designConditions.indoor.winter.dryBulbTemp
      )}℃ / RH ${formatNumber(
        designConditions.indoor.winter.relativeHumidity,
        0
      )}%`,
      `風量: 供給 ${formatNumber(designConditions.airflow.supplyAir, 0)} m³/h`,
      `外気 ${formatNumber(designConditions.airflow.outdoorAir, 0)} m³/h`,
      `還気 ${formatNumber(designConditions.airflow.returnAir, 0)} m³/h`,
      `排気 ${formatNumber(designConditions.airflow.exhaustAir, 0)} m³/h`,
    ];

    const statePointLines = statePoints.map(
      (point, index) =>
        `${index + 1}. ${point.name}: ${formatNumber(
          point.dryBulbTemp
        )}℃, ${formatNumber(point.relativeHumidity, 0)}%RH`
    );

    const processLines =
      processes.length > 0
        ? processes.flatMap((process) => {
            const fromPoint = statePoints.find(
              (p) => p.id === process.fromPointId
            );
            const toPoint = statePoints.find((p) => p.id === process.toPointId);
            const lines = [`${process.name}: ${fromPoint?.name || '?'} → ${toPoint?.name || '?'}`];

            // Add detailed parameters
            if (fromPoint && toPoint && fromPoint.enthalpy && toPoint.enthalpy) {
              const enthalpyDiff = toPoint.enthalpy - fromPoint.enthalpy;
              const humidityDiff = (toPoint.humidity || 0) - (fromPoint.humidity || 0);
              const tempDiff = (toPoint.dryBulbTemp || 0) - (fromPoint.dryBulbTemp || 0);

              if (process.parameters.airflow) {
                const totalCapacity = (enthalpyDiff * process.parameters.airflow * 1.2) / 3600;
                lines.push(`  全熱: ${Math.abs(totalCapacity).toFixed(2)} kW`);
                lines.push(`  比エンタルピー差: ${enthalpyDiff.toFixed(2)} kJ/kg'`);

                if (humidityDiff !== 0) {
                  const moistureAmount = Math.abs(humidityDiff) * process.parameters.airflow * 1.2;
                  lines.push(`  ${humidityDiff < 0 ? '除湿量' : '加湿量'}: ${moistureAmount.toFixed(2)} L/h`);
                }
              }

              if (tempDiff !== 0) {
                lines.push(`  温度差: ${tempDiff.toFixed(1)}°C`);
              }
            }

            if (process.parameters.airflow) {
              lines.push(`  風量: ${process.parameters.airflow.toFixed(0)} m³/h`);
            }

            if (process.parameters.capacity) {
              lines.push(`  能力: ${process.parameters.capacity.toFixed(1)} kW`);
            }

            if (process.parameters.heatExchangeEfficiency) {
              lines.push(`  全熱交換効率: ${process.parameters.heatExchangeEfficiency.toFixed(0)}%`);
            }

            return lines;
          })
        : ['プロセスは登録されていません'];

    drawSection('設計条件', designLines, marginPx);
    drawSection(
      '状態点',
      statePointLines.length > 0 ? statePointLines : ['状態点がありません'],
      marginPx + columnWidthPx + columnGapPx
    );
    drawSection(
      'プロセス',
      processLines,
      marginPx + (columnWidthPx + columnGapPx) * 2
    );

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

      const pdf = new jsPDF('landscape', 'mm', 'a4');

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
