import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ProcessType, Process, ProcessParameters } from '@/types/process';
import { StatePoint } from '@/types/psychrometric';
import { DesignConditions } from '@/types/designConditions';

interface ProcessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (process: Omit<Process, 'id' | 'order'>) => void;
  statePoints: StatePoint[];
  activeSeason: 'summer' | 'winter' | 'both';
  designConditions: DesignConditions;
  editingProcess?: Process | null;
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

// Define the order of process types
const processTypeOrder: ProcessType[] = [
  'cooling',
  'heating',
  'dehumidifying',
  'humidifying',
  'mixing',
  'heatExchange',
  'fanHeating',
  'airSupply',
];

export const ProcessDialog = ({
  isOpen,
  onClose,
  onSave,
  statePoints,
  activeSeason,
  designConditions,
  editingProcess,
}: ProcessDialogProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProcessType>('cooling');
  const [fromPointId, setFromPointId] = useState('');
  const [toPointId, setToPointId] = useState('');
  const [toPointMode, setToPointMode] = useState<'manual' | 'auto'>('manual');
  const [season, setSeason] = useState<'summer' | 'winter' | 'both'>(activeSeason);
  const [parameters, setParameters] = useState<ProcessParameters>({
    airflow: 1000,
  });

  // 編集モード時に初期値を設定
  useEffect(() => {
    if (editingProcess) {
      setName(editingProcess.name);
      setType(editingProcess.type);
      setFromPointId(editingProcess.fromPointId);
      setToPointId(editingProcess.toPointId);
      setToPointMode(editingProcess.parameters.autoCalculateToPoint ? 'auto' : 'manual');
      setSeason(editingProcess.season);
      setParameters(editingProcess.parameters);
    } else {
      setName('');
      setType('cooling');
      setFromPointId(statePoints.length > 0 ? statePoints[0].id : '');
      setToPointId(statePoints.length > 1 ? statePoints[1].id : '');
      setToPointMode('manual');
      setSeason(activeSeason);
      setParameters({ airflow: 1000 });
    }
  }, [editingProcess, statePoints, activeSeason, isOpen]);

  useEffect(() => {
    if (type !== 'mixing') return;
    setParameters((prev) => {
      const baseAirflow = prev.airflow ?? 1000;
      const ratio1 = prev.mixingRatios?.stream1.ratio ?? 0.5;
      const fallbackAirflow1 = baseAirflow * Math.max(0, Math.min(1, ratio1));
      const fallbackAirflow2 = Math.max(0, baseAirflow - fallbackAirflow1);
      const stream1PointId = prev.mixingRatios?.stream1.pointId ?? fromPointId;
      const stream2PointId =
        prev.mixingRatios?.stream2.pointId ??
        statePoints.find((point) => point.id !== stream1PointId)?.id ??
        '';
      const stream1Point = statePoints.find((point) => point.id === stream1PointId);
      const stream2Point = statePoints.find((point) => point.id === stream2PointId);
      const resolvedStream1Airflow =
        prev.mixingRatios?.stream1.airflow ??
        stream1Point?.airflow ??
        (stream1Point?.airflowSource
          ? designConditions.airflow[stream1Point.airflowSource]
          : undefined) ??
        fallbackAirflow1;
      const resolvedStream2Airflow =
        prev.mixingRatios?.stream2.airflow ??
        stream2Point?.airflow ??
        (stream2Point?.airflowSource
          ? designConditions.airflow[stream2Point.airflowSource]
          : undefined) ??
        fallbackAirflow2;
      return {
        ...prev,
        mixingRatios: {
          stream1: { pointId: stream1PointId, airflow: resolvedStream1Airflow },
          stream2: {
            pointId: stream2PointId,
            airflow: resolvedStream2Airflow,
          },
        },
      };
    });
  }, [type, fromPointId, statePoints, designConditions]);

  useEffect(() => {
    if (type !== 'heatExchange') return;
    setParameters((prev) => {
      const baseAirflow = prev.airflow ?? 1000;
      const defaultSupplyAirflow = designConditions.airflow.outdoorAir ?? baseAirflow;
      const defaultExhaustAirflow =
        designConditions.airflow.exhaustAir ?? designConditions.airflow.outdoorAir ?? baseAirflow;
      const supplyAirflow =
        prev.supplyAirflow ?? prev.supplyAirflowIn ?? prev.supplyAirflowOut ?? defaultSupplyAirflow;
      const exhaustAirflow =
        prev.exhaustAirflow ??
        prev.exhaustAirflowIn ??
        prev.exhaustAirflowOut ??
        defaultExhaustAirflow;
      const exhaustPointId =
        prev.exhaustPointId ??
        statePoints.find((point) => point.id !== fromPointId)?.id ??
        '';
      const outdoorPoint = statePoints.find((point) => point.id === fromPointId);
      const exhaustPoint = statePoints.find((point) => point.id === exhaustPointId);
      const resolvedSupply =
        outdoorPoint?.airflow ??
        (outdoorPoint?.airflowSource
          ? designConditions.airflow[outdoorPoint.airflowSource]
          : undefined);
      const resolvedExhaust =
        exhaustPoint?.airflow ??
        (exhaustPoint?.airflowSource === 'exhaustAir'
          ? designConditions.airflow.exhaustAir
          : undefined);
      return {
        ...prev,
        supplyAirflow: resolvedSupply ?? supplyAirflow,
        exhaustAirflow: resolvedExhaust ?? exhaustAirflow,
        exhaustPointId,
      };
    });
  }, [type, fromPointId, statePoints, designConditions]);

  useEffect(() => {
    if (type !== 'heatExchange') return;
    setParameters((prev) => {
      if (prev.heatExchangeEfficiency !== undefined) {
        return prev;
      }
      const defaultEfficiency =
        season === 'winter'
          ? designConditions.equipment.heatExchanger?.efficiencyWinter ??
            designConditions.equipment.heatExchanger?.efficiency
          : designConditions.equipment.heatExchanger?.efficiencySummer ??
            designConditions.equipment.heatExchanger?.efficiency;
      return {
        ...prev,
        heatExchangeEfficiency: defaultEfficiency ?? 65,
      };
    });
  }, [type, season, designConditions]);

  useEffect(() => {
    if (type !== 'cooling' && type !== 'heating') {
      setToPointMode('manual');
    }
  }, [type]);

  if (!isOpen) return null;

  const parseOptionalNumber = (value: string) =>
    value === '' ? undefined : Number.parseFloat(value);

  const handleSave = () => {
    const resolvedName = name.trim() || processTypeLabels[type];
    const sanitizedParameters: ProcessParameters = {
      ...parameters,
      capacity:
        parameters.capacity !== undefined ? Math.abs(parameters.capacity) : parameters.capacity,
      autoCalculateToPoint:
        type === 'cooling' || type === 'heating' ? toPointMode === 'auto' : undefined,
    };
    if (
      !fromPointId ||
      (!toPointId &&
        type !== 'mixing' &&
        type !== 'heatExchange' &&
        !(
          (type === 'cooling' && toPointMode === 'auto') ||
          (type === 'heating' && toPointMode === 'auto')
        ))
    ) {
      alert('始点と終点を選択してください');
      return;
    }
    if (
      type !== 'mixing' &&
      type !== 'heatExchange' &&
      !(
        (type === 'cooling' && toPointMode === 'auto') ||
        (type === 'heating' && toPointMode === 'auto')
      ) &&
      fromPointId === toPointId
    ) {
      alert('始点と終点は異なる状態点を選択してください');
      return;
    }
    if (type === 'cooling' && toPointMode === 'auto' && !parameters.capacity) {
      alert('終点の自動計算には能力欄に数値を入力してください');
      return;
    }
    if (type === 'heating' && toPointMode === 'auto' && !parameters.capacity) {
      alert('終点の自動計算には能力欄に数値を入力してください');
      return;
    }
    if (type === 'cooling' && toPointMode === 'auto' && parameters.coolingOutletRH === undefined) {
      alert('終点の自動計算には冷却コイル出口条件を入力してください');
      return;
    }
    if (type === 'mixing') {
      const stream2Id = parameters.mixingRatios?.stream2.pointId;
      const stream1Airflow = parameters.mixingRatios?.stream1.airflow;
      const stream2Airflow = parameters.mixingRatios?.stream2.airflow;
      if (!stream2Id) {
        alert('混合流2の状態点を選択してください');
        return;
      }
      if (stream2Id === fromPointId) {
        alert('混合流2は混合流1と異なる状態点を選択してください');
        return;
      }
      if (!stream1Airflow || !stream2Airflow || stream1Airflow <= 0 || stream2Airflow <= 0) {
        alert('混合流の風量を正しく入力してください');
        return;
      }
    }
    if (type === 'heatExchange') {
      const exhaustPointId = parameters.exhaustPointId;
      if (!exhaustPointId) {
        alert('排気側の状態点を選択してください');
        return;
      }
      if (exhaustPointId === fromPointId) {
        alert('排気側は外気側と異なる状態点を選択してください');
        return;
      }
      const airflowValues = [
        parameters.supplyAirflow,
        parameters.exhaustAirflow,
        parameters.supplyAirflowIn,
        parameters.supplyAirflowOut,
        parameters.exhaustAirflowIn,
        parameters.exhaustAirflowOut,
      ];
      if (airflowValues.some((value) => value !== undefined && value <= 0)) {
        alert('全熱交換器の風量を正しく入力してください');
        return;
      }
    }

    onSave({
      name: resolvedName,
      type,
      season,
      fromPointId,
      toPointId,
      parameters: sanitizedParameters,
    });

    onClose();
  };

  const handleParameterChange = (
    key: keyof ProcessParameters,
    value: number | string | undefined
  ) => {
    setParameters((prev) => {
      if (key === 'exhaustPointId') {
        const exhaustPoint = statePoints.find((point) => point.id === value);
        const resolvedExhaust =
          exhaustPoint?.airflow ??
          (exhaustPoint?.airflowSource
            ? designConditions.airflow[exhaustPoint.airflowSource]
            : undefined);
        return {
          ...prev,
          exhaustPointId: value as string,
          exhaustAirflow: resolvedExhaust ?? prev.exhaustAirflow,
        };
      }
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  const handleMixingStreamChange = (streamKey: 'stream1' | 'stream2', pointId: string) => {
    setParameters((prev) => {
      const streamPoint = statePoints.find((point) => point.id === pointId);
      const resolvedAirflow =
        streamPoint?.airflow ??
        (streamPoint?.airflowSource
          ? designConditions.airflow[streamPoint.airflowSource]
          : undefined);
      return {
        ...prev,
        mixingRatios: {
          stream1: {
            pointId: streamKey === 'stream1' ? pointId : prev.mixingRatios?.stream1.pointId ?? fromPointId,
            airflow:
              streamKey === 'stream1'
                ? resolvedAirflow ?? prev.mixingRatios?.stream1.airflow ?? prev.airflow ?? 500
                : prev.mixingRatios?.stream1.airflow ?? prev.airflow ?? 500,
          },
          stream2: {
            pointId: streamKey === 'stream2' ? pointId : prev.mixingRatios?.stream2.pointId ?? '',
            airflow:
              streamKey === 'stream2'
                ? resolvedAirflow ?? prev.mixingRatios?.stream2.airflow ?? prev.airflow ?? 500
                : prev.mixingRatios?.stream2.airflow ?? prev.airflow ?? 500,
          },
        },
      };
    });
  };

  const handleMixingAirflowChange = (
    streamKey: 'stream1' | 'stream2',
    value: number | undefined
  ) => {
    setParameters((prev) => ({
      ...prev,
      mixingRatios: {
        stream1: {
          pointId: prev.mixingRatios?.stream1.pointId ?? fromPointId,
          airflow:
            streamKey === 'stream1'
              ? value
              : prev.mixingRatios?.stream1.airflow ?? prev.airflow ?? 500,
        },
        stream2: {
          pointId: prev.mixingRatios?.stream2.pointId ?? '',
          airflow:
            streamKey === 'stream2'
              ? value
              : prev.mixingRatios?.stream2.airflow ?? prev.airflow ?? 500,
        },
      },
    }));
  };

  // 季節に応じてフィルターされた状態点
  const filteredPoints = statePoints.filter((point) => {
    if (season === 'both') return true;
    return point.season === season || point.season === 'both';
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingProcess ? 'プロセスの編集' : 'プロセスの追加'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 名前 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 冷却コイル"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* プロセスタイプ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              プロセスタイプ
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProcessType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {processTypeOrder.map((value) => (
                <option key={value} value={value}>
                  {processTypeLabels[value]}
                </option>
              ))}
            </select>
          </div>

          {/* 季節 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              適用季節
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSeason('summer')}
                className={`flex-1 py-2 px-3 rounded ${
                  season === 'summer'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                夏季
              </button>
              <button
                onClick={() => setSeason('winter')}
                className={`flex-1 py-2 px-3 rounded ${
                  season === 'winter'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                冬季
              </button>
              <button
                onClick={() => setSeason('both')}
                className={`flex-1 py-2 px-3 rounded ${
                  season === 'both'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                通年
              </button>
            </div>
          </div>

          {/* 始点 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {type === 'mixing' ? '混合流1' : type === 'heatExchange' ? '外気' : '始点（入口）'}
            </label>
            <select
              value={fromPointId}
              onChange={(e) => {
                const nextId = e.target.value;
                setFromPointId(nextId);
                if (type === 'mixing') {
                  handleMixingStreamChange('stream1', nextId);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">選択してください</option>
              {filteredPoints.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.name} ({point.dryBulbTemp?.toFixed(1)}°C, RH{point.relativeHumidity?.toFixed(0)}%)
                </option>
              ))}
            </select>
          </div>

          {/* 終点 */}
          {type === 'mixing' || type === 'heatExchange' ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {type === 'mixing'
                ? '混合点は保存時に自動で追加されます。'
                : '全熱交換器出口は保存時に自動で追加されます。'}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  終点（出口）
                </label>
                {(type === 'cooling' || type === 'heating') && (
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="toPointMode"
                        value="manual"
                        checked={toPointMode === 'manual'}
                        onChange={() => {
                          setToPointMode('manual');
                          setParameters((prev) => ({
                            ...prev,
                            capacity: undefined,
                            coolingOutletRH: type === 'cooling' ? undefined : prev.coolingOutletRH,
                          }));
                          if (!toPointId && filteredPoints[0]) {
                            setToPointId(filteredPoints[0].id);
                          }
                        }}
                      />
                      選択
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="toPointMode"
                        value="auto"
                        checked={toPointMode === 'auto'}
                        onChange={() => {
                          setToPointMode('auto');
                          setToPointId('');
                        }}
                      />
                      自動計算
                    </label>
                  </div>
                )}
              </div>
              {(type === 'cooling' || type === 'heating') && toPointMode === 'auto' ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  {type === 'cooling'
                    ? '能力と冷却コイル出口条件から終点を自動計算します。'
                    : '能力から終点を自動計算します（絶対湿度一定で温度上昇）。'}
                </div>
              ) : (
                <select
                  value={toPointId}
                  onChange={(e) => setToPointId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">選択してください</option>
                  {filteredPoints.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.name} ({point.dryBulbTemp?.toFixed(1)}°C, RH{point.relativeHumidity?.toFixed(0)}%)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* プロセスパラメータ */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">パラメータ</h4>

            {/* 風量（共通） */}
            {type !== 'mixing' && type !== 'heatExchange' && (
              <div className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">
                  風量 [m³/h]
                </label>
                <input
                  type="number"
                  value={parameters.airflow || ''}
                  onChange={(e) =>
                    handleParameterChange('airflow', parseOptionalNumber(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            {/* タイプ別パラメータ */}
            {(type === 'heating' || type === 'cooling') && (
              <>
                {(type === 'heating' || (type === 'cooling' && toPointMode === 'auto')) && (
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">
                      能力 [kW]
                      {type === 'heating' && toPointMode !== 'auto' ? '（オプション）' : ''}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={parameters.capacity || ''}
                      onChange={(e) =>
                        handleParameterChange('capacity', parseOptionalNumber(e.target.value))
                      }
                      placeholder={
                        type === 'heating' && toPointMode !== 'auto' ? '自動計算' : '必須入力'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
                {type === 'cooling' && toPointMode === 'auto' && (
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">
                      冷却コイル出口条件（相対湿度）[%]
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={parameters.coolingOutletRH || ''}
                      onChange={(e) =>
                        handleParameterChange(
                          'coolingOutletRH',
                          parseOptionalNumber(e.target.value)
                        )
                      }
                      placeholder="必須入力"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    {type === 'cooling' ? '冷水温度差 [℃]' : '温水温度差 [℃]'}
                  </label>
                  <input
                    type="number"
                    value={parameters.waterTempDiff ?? 7}
                    onChange={(e) =>
                      handleParameterChange('waterTempDiff', parseOptionalNumber(e.target.value))
                    }
                    placeholder="7"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    入口と出口の水温度差（デフォルト: 7℃）
                  </p>
                </div>
              </>
            )}

            {type === 'humidifying' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    加湿量 [kg/h]
                  </label>
                    <input
                      type="number"
                      value={parameters.humidifyingCapacity || ''}
                      onChange={(e) =>
                        handleParameterChange(
                          'humidifyingCapacity',
                          parseOptionalNumber(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    加湿方式
                  </label>
                  <select
                    value={parameters.humidifierType || 'steam'}
                    onChange={(e) => handleParameterChange('humidifierType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="steam">蒸気加湿</option>
                    <option value="water">水加湿</option>
                  </select>
                </div>
              </>
            )}

            {type === 'heatExchange' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    全熱交換効率 [%]（終点側基準）
                  </label>
                    <input
                      type="number"
                      value={parameters.heatExchangeEfficiency || ''}
                      onChange={(e) =>
                        handleParameterChange(
                          'heatExchangeEfficiency',
                          parseOptionalNumber(e.target.value)
                        )
                      }
                      placeholder="例: 65"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    室内空気
                  </label>
                  <select
                    value={parameters.exhaustPointId || ''}
                    onChange={(e) => handleParameterChange('exhaustPointId', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {filteredPoints.map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.name} ({point.dryBulbTemp?.toFixed(1)}°C, RH{point.relativeHumidity?.toFixed(0)}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    外気側風量 [m³/h]
                  </label>
                    <input
                      type="number"
                      value={parameters.supplyAirflow ?? ''}
                      onChange={(e) =>
                        handleParameterChange('supplyAirflow', parseOptionalNumber(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    排気側風量 [m³/h]
                  </label>
                    <input
                      type="number"
                      value={parameters.exhaustAirflow ?? ''}
                      onChange={(e) =>
                        handleParameterChange('exhaustAirflow', parseOptionalNumber(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
              </>
            )}

            {type === 'mixing' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    混合流2（還気など）
                  </label>
                  <select
                    value={parameters.mixingRatios?.stream2.pointId || ''}
                    onChange={(e) => handleMixingStreamChange('stream2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">選択してください</option>
                    {filteredPoints.map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.name} ({point.dryBulbTemp?.toFixed(1)}°C, RH{point.relativeHumidity?.toFixed(0)}%)
                      </option>
                    ))}
                    </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    混合流1の風量 [m³/h]
                  </label>
                    <input
                      type="number"
                      value={parameters.mixingRatios?.stream1.airflow ?? ''}
                      onChange={(e) =>
                        handleMixingAirflowChange(
                          'stream1',
                          parseOptionalNumber(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    混合流2の風量 [m³/h]
                  </label>
                    <input
                      type="number"
                      value={parameters.mixingRatios?.stream2.airflow ?? ''}
                      onChange={(e) =>
                        handleMixingAirflowChange(
                          'stream2',
                          parseOptionalNumber(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
              </>
            )}

            {type === 'fanHeating' && (
              <>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    ファン動力 [kW]
                  </label>
                    <input
                      type="number"
                      value={parameters.fanPower || ''}
                      onChange={(e) =>
                        handleParameterChange('fanPower', parseOptionalNumber(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    ファン効率 [%]
                  </label>
                    <input
                      type="number"
                      value={parameters.fanEfficiency || ''}
                      onChange={(e) =>
                        handleParameterChange('fanEfficiency', parseOptionalNumber(e.target.value))
                      }
                      placeholder="例: 70"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
              </>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {editingProcess ? '更新' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
};
