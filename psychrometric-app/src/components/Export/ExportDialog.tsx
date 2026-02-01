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

  const handleExportPNG = async () => {
    if (!canvasRef.current) {
      alert('チャートが見つかりません');
      return;
    }

    setIsExporting(true);
    setExportType('png');

    try {
      const canvas = canvasRef.current;
      const dataUrl = canvas.toDataURL('image/png');

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
      const chartImage = canvas.toDataURL('image/png');

      // A4横向きでPDFを作成
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageHeight = pdf.internal.pageSize.getHeight();

      // タイトル
      pdf.setFontSize(16);
      pdf.text(designConditions.project.name, 14, 15);

      pdf.setFontSize(10);
      pdf.text(`Location: ${designConditions.project.location}`, 14, 22);
      pdf.text(`Date: ${designConditions.project.date}`, 14, 27);
      if (designConditions.project.designer) {
        pdf.text(`Designer: ${designConditions.project.designer}`, 14, 32);
      }

      // チャート画像を追加
      const chartWidth = 180;
      const chartHeight = (canvas.height / canvas.width) * chartWidth;
      pdf.addImage(chartImage, 'PNG', 14, 38, chartWidth, Math.min(chartHeight, 100));

      // 設計条件テーブル
      const tableY = 145;
      pdf.setFontSize(12);
      pdf.text('Design Conditions', 14, tableY);

      pdf.setFontSize(9);
      let y = tableY + 8;

      // 外気条件
      pdf.text('Outdoor Conditions:', 14, y);
      y += 5;
      pdf.text(
        `  Summer: ${designConditions.outdoor.summer.dryBulbTemp}C DB, ${designConditions.outdoor.summer.relativeHumidity}% RH`,
        14,
        y
      );
      y += 4;
      pdf.text(
        `  Winter: ${designConditions.outdoor.winter.dryBulbTemp}C DB, ${designConditions.outdoor.winter.relativeHumidity}% RH`,
        14,
        y
      );
      y += 6;

      // 室内条件
      pdf.text('Indoor Conditions:', 14, y);
      y += 5;
      pdf.text(
        `  Summer: ${designConditions.indoor.summer.dryBulbTemp}C DB, ${designConditions.indoor.summer.relativeHumidity}% RH`,
        14,
        y
      );
      y += 4;
      pdf.text(
        `  Winter: ${designConditions.indoor.winter.dryBulbTemp}C DB, ${designConditions.indoor.winter.relativeHumidity}% RH`,
        14,
        y
      );
      y += 6;

      // 風量条件
      pdf.text('Airflow:', 14, y);
      y += 5;
      pdf.text(
        `  Supply: ${designConditions.airflow.supplyAir} m3/h, OA: ${designConditions.airflow.outdoorAir} m3/h`,
        14,
        y
      );

      // 状態点リスト（右側）
      const rightColumnX = 150;
      y = tableY + 8;
      pdf.setFontSize(12);
      pdf.text('State Points', rightColumnX, tableY);

      pdf.setFontSize(9);
      statePoints.forEach((point, index) => {
        if (y > pageHeight - 20) return;
        pdf.text(
          `${index + 1}. ${point.name}: ${point.dryBulbTemp?.toFixed(1)}C, ${point.relativeHumidity?.toFixed(0)}% RH`,
          rightColumnX,
          y
        );
        y += 4;
      });

      // プロセスリスト
      if (processes.length > 0) {
        y += 4;
        pdf.setFontSize(12);
        pdf.text('Processes', rightColumnX, y);
        y += 6;

        pdf.setFontSize(9);
        processes.forEach((process) => {
          if (y > pageHeight - 10) return;
          const fromPoint = statePoints.find((p) => p.id === process.fromPointId);
          const toPoint = statePoints.find((p) => p.id === process.toPointId);
          pdf.text(
            `${process.name}: ${fromPoint?.name || '?'} -> ${toPoint?.name || '?'}`,
            rightColumnX,
            y
          );
          y += 4;
        });
      }

      // フッター
      pdf.setFontSize(8);
      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        14,
        pageHeight - 5
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
                <div className="text-sm text-blue-100">空気線図と設計条件表を含む</div>
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
                <div className="text-sm text-gray-600">空気線図のみ</div>
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
