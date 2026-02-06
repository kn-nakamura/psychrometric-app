import { Trash2, Edit2, GripVertical, ArrowRight } from 'lucide-react';
import { Process, ProcessType } from '@/types/process';
import { StatePoint } from '@/types/psychrometric';
import { CoilCapacityCalculator } from '@/lib/equipment/coilCapacity';
import { inferModeFromSigned } from '@/lib/sign';

interface ProcessListProps {
  processes: Process[];
  statePoints: StatePoint[];
  activeSeason: 'summer' | 'winter' | 'both';
  selectedProcessId: string | null;
  onSelectProcess: (id: string | null) => void;
  onEditProcess: (process: Process) => void;
  onDeleteProcess: (id: string) => void;
  onReorderProcesses: (startIndex: number, endIndex: number) => void;
}

const processTypeLabels: Record<ProcessType, string> = {
  heating: '加熱',
  cooling: '冷却',
  humidifying: '加湿',
  dehumidifying: '除湿',
  mixing: '混合',
  heatExchange: '全熱交換',
  fanHeating: 'ファン発熱',
  airSupply: '空調吹き出し',
};

const processTypeColors: Record<ProcessType, string> = {
  heating: 'bg-red-100 text-red-700',
  cooling: 'bg-blue-100 text-blue-700',
  humidifying: 'bg-cyan-100 text-cyan-700',
  dehumidifying: 'bg-yellow-100 text-yellow-700',
  mixing: 'bg-purple-100 text-purple-700',
  heatExchange: 'bg-green-100 text-green-700',
  fanHeating: 'bg-orange-100 text-orange-700',
  airSupply: 'bg-emerald-100 text-emerald-700',
};

export const ProcessList = ({
  processes,
  statePoints,
  activeSeason,
  selectedProcessId,
  onSelectProcess,
  onEditProcess,
  onDeleteProcess,
}: ProcessListProps) => {
  // 季節フィルター
  const filteredProcesses = processes.filter((process) => {
    if (activeSeason === 'both') return true;
    return process.season === activeSeason || process.season === 'both';
  });

  // 順番でソート
  const sortedProcesses = [...filteredProcesses].sort((a, b) => a.order - b.order);

  // 能力を計算
  const calculateCapacity = (process: Process) => {
    const fromPoint = statePoints.find((p) => p.id === process.fromPointId);
    const toPoint = statePoints.find((p) => p.id === process.toPointId);

    if (!fromPoint || !toPoint) return null;
    if (!fromPoint.enthalpy || !toPoint.enthalpy) return null;

    const airflow = process.parameters.airflow || 1000;

    try {
      const result = CoilCapacityCalculator.calculate(
        fromPoint as StatePoint,
        toPoint as StatePoint,
        airflow
      );
      return result;
    } catch {
      return null;
    }
  };
  const formatSHF = (value: number | null | undefined) =>
    value === null || value === undefined ? '—' : value.toFixed(2);
  const formatSignedHeat = (value: number) => {
    if (Object.is(value, -0)) {
      return '0.00';
    }
    if (value > 0) {
      return `+${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  };

  if (sortedProcesses.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 text-sm">
        プロセスがありません。
        <br />
        状態点を2つ以上追加してからプロセスを追加してください。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedProcesses.map((process) => {
        const fromPoint = statePoints.find((p) => p.id === process.fromPointId);
        const toPoint = statePoints.find((p) => p.id === process.toPointId);
        const capacity = calculateCapacity(process);
        const inferredMode = capacity ? inferModeFromSigned(capacity.totalCapacity) : null;
        const modeMismatch =
          capacity &&
          (process.type === 'heating' || process.type === 'cooling') &&
          ((process.type === 'heating' && inferredMode === 'cooling') ||
            (process.type === 'cooling' && inferredMode === 'heating'));
        const stream1Id =
          process.parameters.mixingRatios?.stream1.pointId ?? process.fromPointId;
        const stream2Id = process.parameters.mixingRatios?.stream2.pointId;
        const stream1Point = statePoints.find((p) => p.id === stream1Id);
        const stream2Point = statePoints.find((p) => p.id === stream2Id);
        const mixingAirflowTotal =
          typeof stream1Point?.airflow === 'number' && typeof stream2Point?.airflow === 'number'
            ? stream1Point.airflow + stream2Point.airflow
            : undefined;

        return (
          <div
            key={process.id}
            onClick={() => onSelectProcess(process.id)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedProcessId === process.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{process.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${processTypeColors[process.type]}`}
                  >
                    {processTypeLabels[process.type]}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      process.season === 'summer'
                        ? 'bg-blue-100 text-blue-700'
                        : process.season === 'winter'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {process.season === 'summer' ? '夏' : process.season === 'winter' ? '冬' : '通年'}
                  </span>
                </div>

                {/* 状態点表示 */}
                <div className="mt-1 flex items-center text-sm text-gray-600">
                  <span className="truncate">{fromPoint?.name || '不明'}</span>
                  <ArrowRight className="w-4 h-4 mx-1 flex-shrink-0" />
                  <span className="truncate">{toPoint?.name || '不明'}</span>
                </div>

                {process.type === 'mixing' && mixingAirflowTotal !== undefined && (
                  <div className="mt-1 text-xs text-gray-600">
                    混合後風量: {mixingAirflowTotal.toFixed(0)} m³/h
                  </div>
                )}

                {/* 能力表示 */}
                {capacity && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <div>全熱: {Math.abs(capacity.totalCapacity).toFixed(2)} kW</div>
                    <div>顕熱: {formatSignedHeat(capacity.sensibleCapacity)} kW</div>
                    <div>潜熱: {formatSignedHeat(capacity.latentCapacity)} kW</div>
                    <div>SHF: {formatSHF(capacity.SHF)}</div>
                    <div>温度差: {capacity.temperatureDiff.toFixed(1)}°C</div>
                    <div>湿度差: {(capacity.humidityDiff * 1000).toFixed(2)} g/kg'</div>
                    <div>比エンタルピー差: {capacity.enthalpyDiff.toFixed(2)} kJ/kg'</div>
                    {process.parameters.airflow && capacity.humidityDiff !== 0 && (
                      <div>
                        {capacity.humidityDiff < 0 ? '除湿量' : '加湿量'}:{' '}
                        {(Math.abs(capacity.humidityDiff) * process.parameters.airflow * 1.2).toFixed(2)} L/h
                      </div>
                    )}
                    {(process.type === 'heating' || process.type === 'cooling') && (
                      <>
                        {(() => {
                          const waterTempDiff = process.parameters.waterTempDiff || 7;
                          const waterFlowRate = (Math.abs(capacity.totalCapacity) * 60) / (4.186 * waterTempDiff);
                          return (
                            <>
                              <div>水温度差: {waterTempDiff.toFixed(1)}℃</div>
                              <div>水量: {waterFlowRate.toFixed(2)} L/min</div>
                            </>
                          );
                        })()}
                      </>
                    )}
                    {modeMismatch && (
                      <div className="col-span-2 text-amber-600">
                        警告: 運転モードと計算結果が一致しません（結果は
                        {inferredMode === 'cooling' ? '冷却' : '加熱'}）。
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditProcess(process);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`プロセス「${process.name}」を削除しますか？`)) {
                      onDeleteProcess(process.id);
                    }
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
