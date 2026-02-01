import { X } from 'lucide-react';

interface ExportDialogProps {
  onClose: () => void;
}

export const ExportDialog = ({ onClose }: ExportDialogProps) => {
  
  const handleExportPDF = () => {
    alert('PDF出力機能は開発中です');
  };
  
  const handleExportPNG = () => {
    alert('PNG出力機能は開発中です');
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">エクスポート</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
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
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
            >
              <div className="font-semibold">PDFファイル</div>
              <div className="text-sm text-blue-100">空気線図と設計条件表を含む</div>
            </button>
            
            <button
              onClick={handleExportPNG}
              className="w-full px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors text-left"
            >
              <div className="font-semibold">PNG画像</div>
              <div className="text-sm text-gray-600">空気線図のみ</div>
            </button>
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
