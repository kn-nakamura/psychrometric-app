import { useState, useRef } from 'react';
import { X, Save, FolderOpen, Download, Upload, Loader2 } from 'lucide-react';
import { DesignConditions } from '@/types/designConditions';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';

interface ProjectData {
  version: string;
  exportedAt: string;
  designConditions: DesignConditions;
  statePoints: StatePoint[];
  processes: Process[];
}

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  designConditions: DesignConditions;
  statePoints: StatePoint[];
  processes: Process[];
  onLoadProject: (data: {
    designConditions: DesignConditions;
    statePoints: StatePoint[];
    processes: Process[];
  }) => void;
}

const PROJECT_VERSION = '1.0';

export const ProjectManager = ({
  isOpen,
  onClose,
  designConditions,
  statePoints,
  processes,
  onLoadProject,
}: ProjectManagerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveProject = () => {
    const projectData: ProjectData = {
      version: PROJECT_VERSION,
      exportedAt: new Date().toISOString(),
      designConditions,
      statePoints,
      processes,
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.download = `${designConditions.project.name}.psychro.json`;
    link.href = url;
    link.click();

    URL.revokeObjectURL(url);
    onClose();
  };

  const handleLoadProjectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ProjectData;

      // バリデーション
      if (!data.version || !data.designConditions || !data.statePoints) {
        throw new Error('無効なプロジェクトファイルです');
      }

      onLoadProject({
        designConditions: data.designConditions,
        statePoints: data.statePoints,
        processes: data.processes || [],
      });

      onClose();
    } catch (err) {
      console.error('Failed to load project:', err);
      setError(
        err instanceof Error ? err.message : 'プロジェクトの読み込みに失敗しました'
      );
    } finally {
      setIsLoading(false);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveToLocalStorage = () => {
    const projectData: ProjectData = {
      version: PROJECT_VERSION,
      exportedAt: new Date().toISOString(),
      designConditions,
      statePoints,
      processes,
    };

    try {
      localStorage.setItem('psychrometric-project', JSON.stringify(projectData));
      alert('ブラウザに保存しました');
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      alert('保存に失敗しました');
    }
  };

  const handleLoadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('psychrometric-project');
      if (!saved) {
        alert('保存されたプロジェクトがありません');
        return;
      }

      const data = JSON.parse(saved) as ProjectData;

      onLoadProject({
        designConditions: data.designConditions,
        statePoints: data.statePoints,
        processes: data.processes || [],
      });

      onClose();
    } catch (err) {
      console.error('Failed to load from localStorage:', err);
      alert('読み込みに失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">プロジェクト管理</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 現在のプロジェクト情報 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">現在のプロジェクト</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>名前: {designConditions.project.name}</div>
              <div>場所: {designConditions.project.location}</div>
              <div>状態点: {statePoints.length}個</div>
              <div>プロセス: {processes.length}個</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ファイルへの保存・読み込み */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">ファイル</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveProject}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>保存</span>
              </button>
              <button
                onClick={handleLoadProjectClick}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>読み込み</span>
              </button>
            </div>
          </div>

          {/* ブラウザへの保存・読み込み */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">ブラウザストレージ</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveToLocalStorage}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>保存</span>
              </button>
              <button
                onClick={handleLoadFromLocalStorage}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>復元</span>
              </button>
            </div>
            <p className="text-xs text-gray-500">
              ブラウザに一時的に保存します。ブラウザのデータをクリアすると消去されます。
            </p>
          </div>

          {/* 隠しファイル入力 */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,.psychro.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
