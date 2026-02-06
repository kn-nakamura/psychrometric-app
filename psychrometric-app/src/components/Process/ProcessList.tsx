import { Trash2, Edit2, GripVertical, ArrowRight, ChevronUp, ChevronDown } from 'lucide-react';
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
  onReorderProcesses,
}: ProcessListProps) => {
  const filteredPoints = statePoints.filter((point) => {
    if (activeSeason === 'both') return true;
    return point.season === activeSeason || point.season === 'both';
  });
  const sortedPoints = [...filteredPoints].sort((a, b) => a.order - b.order);
  const getPointLabel = (point: StatePoint, index: number): string => {
    let summerCount = 0;
    let winterCount = 0;
    for (let i = 0; i <= index; i++) {
      const p = sortedPoints[i];
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
      const p = sortedPoints[i];
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
  const pointLabelMap = new Map(
    sortedPoints.map((point, index) => [point.id, getPointLabel(point, index)])
  );

  // 季節フィルター
  const filteredProcesses = processes.filter((process) => {
    if (activeSeason === 'both') return true;
    return process.season === activeSeason || process.season === 'both';
  });

  // 順番でソート
  const sortedProcesses = [...filteredProcesses].sort((a, b) => a.order - b.order);

  const handleMoveUp = (e: React.MouseEvent, processId: string) => {
    e.stopPropagation();
    const index = processes.findIndex((process) => process.id === processId);
    if (index > 0) {
      onReorderProcesses(index, index - 1);
    }
  };

  const handleMoveDown = (e: React.MouseEvent, processId: string) => {
    e.stopPropagation();
    const index = processes.findIndex((process) => process.id === processId);
    if (index < processes.length - 1) {
      onReorderProcesses(index, index + 1);
    }
  };

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
        状態点を1つ以上追加してからプロセスを追加してください。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sortedProcesses.map((process, index) => {
        const fromPoint = statePoints.find((p) => p.id === process.fromPointId);
        const toPoint = statePoints.find((p) => p.id === process.toPointId);
        const fromPointLabel = fromPoint ? pointLabelMap.get(fromPoint.id) : undefined;
        const toPointLabel = toPoint ? pointLabelMap.get(toPoint.id) : undefined;
        const labelSeason =
          fromPoint?.season ?? toPoint?.season ?? (activeSeason === 'both' ? 'both' : activeSeason);
        const labelClassName =
          labelSeason === 'summer'
            ? 'bg-blue-600 text-white'
            : labelSeason === 'winter'
            ? 'bg-red-600 text-white'
            : 'bg-purple-600 text-white';
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
        const airflowDetails: string[] = [];
        if (typeof process.parameters.airflow === 'number') {
          airflowDetails.push(`風量: ${process.parameters.airflow.toFixed(0)} m³/h`);
        }
        if (typeof process.parameters.supplyAirflow === 'number') {
          airflowDetails.push(`外気側風量: ${process.parameters.supplyAirflow.toFixed(0)} m³/h`);
        }
        if (typeof process.parameters.exhaustAirflow === 'number') {
          airflowDetails.push(`排気側風量: ${process.parameters.exhaustAirflow.toFixed(0)} m³/h`);
        }
        if (process.type === 'mixing') {
          const stream1Airflow = process.parameters.mixingRatios?.stream1.airflow;
          const stream2Airflow = process.parameters.mixingRatios?.stream2.airflow;
          if (typeof stream1Airflow === 'number') {
            airflowDetails.push(`混合流1風量: ${stream1Airflow.toFixed(0)} m³/h`);
          }
          if (typeof stream2Airflow === 'number') {
            airflowDetails.push(`混合流2風量: ${stream2Airflow.toFixed(0)} m³/h`);
          }
        }

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
              <div className="flex flex-col gap-1">
                <button
                  onClick={(e) => handleMoveUp(e, process.id)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="上に移動"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleMoveDown(e, process.id)}
                  disabled={index === sortedProcesses.length - 1}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="下に移動"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-sm px-2 py-0.5 rounded ${labelClassName}`}>
                    {fromPointLabel || '—'}→{toPointLabel || '—'}
                  </span>
                  <span className="font-semibold text-gray-900">{process.name}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
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
                {(capacity || airflowDetails.length > 0) && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {capacity && (
                      <>
                        <div>全熱: {formatSignedHeat(capacity.totalCapacity)} kW</div>
                        <div>顕熱: {formatSignedHeat(capacity.sensibleCapacity)} kW</div>
                        <div>潜熱: {formatSignedHeat(capacity.latentCapacity)} kW</div>
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
                      </>
                    )}
                    {airflowDetails.length > 0 && (
                      <div className="col-span-2 space-y-0.5">
                        {airflowDetails.map((detail) => (
                          <div key={detail}>{detail}</div>
                        ))}
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
