import { useAppStore } from '@/store/appStore';
import { Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

export const StatePointList = () => {
  const {
    statePoints,
    currentSeason,
    selectedPointId,
    setSelectedPoint,
    deleteStatePoint,
    reorderStatePoints,
  } = useAppStore();
  
  // 現在の季節に応じてフィルター
  const filteredPoints = statePoints.filter((point) => {
    if (currentSeason === 'both') return true;
    return point.season === currentSeason || point.season === 'both';
  });
  
  // 順番にソート
  const sortedPoints = [...filteredPoints].sort((a, b) => a.order - b.order);

  // Generate labels for each point (C1, C2 for summer, H1, H2 for winter)
  const getPointLabel = (point: typeof sortedPoints[0], index: number): string => {
    // Count how many points of each season appear before this point
    let summerCount = 0;
    let winterCount = 0;
    for (let i = 0; i <= index; i++) {
      const p = sortedPoints[i];
      if (p.season === 'summer') summerCount++;
      else if (p.season === 'winter') winterCount++;
    }

    if (point.season === 'summer') {
      return `C${summerCount}`;
    } else if (point.season === 'winter') {
      return `H${winterCount}`;
    } else {
      // For 'both' season, use both labels based on current position
      let bothSummerCount = 0;
      let bothWinterCount = 0;
      for (let i = 0; i <= index; i++) {
        const p = sortedPoints[i];
        if (p.season === 'summer' || p.season === 'both') bothSummerCount++;
        if (p.season === 'winter' || p.season === 'both') bothWinterCount++;
      }
      if (currentSeason === 'summer') {
        return `C${bothSummerCount}`;
      } else if (currentSeason === 'winter') {
        return `H${bothWinterCount}`;
      }
      return `C${bothSummerCount}/H${bothWinterCount}`;
    }
  };

  const handleMoveUp = (e: React.MouseEvent, pointId: string) => {
    e.stopPropagation();
    const index = statePoints.findIndex((p) => p.id === pointId);
    if (index > 0) {
      reorderStatePoints(index, index - 1);
    }
  };

  const handleMoveDown = (e: React.MouseEvent, pointId: string) => {
    e.stopPropagation();
    const index = statePoints.findIndex((p) => p.id === pointId);
    if (index < statePoints.length - 1) {
      reorderStatePoints(index, index + 1);
    }
  };

  if (sortedPoints.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        状態点がありません。「追加」ボタンから状態点を追加してください。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedPoints.map((point, index) => (
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
            <div className="flex flex-col gap-1">
              <button
                onClick={(e) => handleMoveUp(e, point.id)}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="上に移動"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleMoveDown(e, point.id)}
                disabled={index === sortedPoints.length - 1}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="下に移動"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <GripVertical className="w-4 h-4 text-gray-400" />

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm px-2 py-0.5 rounded ${
                  point.season === 'summer'
                    ? 'bg-blue-600 text-white'
                    : point.season === 'winter'
                    ? 'bg-red-600 text-white'
                    : 'bg-purple-600 text-white'
                }`}>{getPointLabel(point, index)}</span>
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

              <div className="mt-1 grid w-full grid-cols-1 gap-x-4 text-sm text-gray-600 sm:grid-cols-2">
                <div>温度: {point.dryBulbTemp?.toFixed(1)}°C</div>
                <div>RH: {point.relativeHumidity?.toFixed(0)}%</div>
                <div>絶対湿度: {point.humidity?.toFixed(4)} kg/kg'</div>
                <div>エンタルピー: {point.enthalpy?.toFixed(1)} kJ/kg'</div>
                <div>
                  風量:{' '}
                  {typeof point.airflow === 'number'
                    ? `${point.airflow.toFixed(0)} m³/h`
                    : '-'}
                </div>
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
