import { useAppStore } from '@/store/appStore';
import { Trash2, GripVertical } from 'lucide-react';

export const StatePointList = () => {
  const {
    statePoints,
    currentSeason,
    selectedPointId,
    setSelectedPoint,
    deleteStatePoint,
  } = useAppStore();
  
  // 現在の季節に応じてフィルター
  const filteredPoints = statePoints.filter((point) => {
    if (currentSeason === 'both') return true;
    return point.season === currentSeason || point.season === 'both';
  });
  
  // 順番にソート
  const sortedPoints = [...filteredPoints].sort((a, b) => a.order - b.order);
  
  if (sortedPoints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        状態点がありません。「追加」ボタンから状態点を追加してください。
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      {sortedPoints.map((point) => (
        <div
          key={point.id}
          onClick={() => setSelectedPoint(point.id)}
          className={`p-3 rounded-lg border cursor-pointer transition-all ${
            selectedPointId === point.id
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{point.order}.</span>
                <span className="font-medium text-gray-900">{point.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    point.season === 'summer'
                      ? 'bg-blue-100 text-blue-700'
                      : point.season === 'winter'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {point.season === 'summer' ? '夏' : point.season === 'winter' ? '冬' : '通年'}
                </span>
              </div>
              
              <div className="mt-1 text-sm text-gray-600 grid grid-cols-2 gap-x-4">
                <div>温度: {point.dryBulbTemp?.toFixed(1)}°C</div>
                <div>RH: {point.relativeHumidity?.toFixed(0)}%</div>
                <div>絶対湿度: {point.humidity?.toFixed(4)} kg/kg'</div>
                <div>エンタルピー: {point.enthalpy?.toFixed(1)} kJ/kg'</div>
              </div>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteStatePoint(point.id);
              }}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
