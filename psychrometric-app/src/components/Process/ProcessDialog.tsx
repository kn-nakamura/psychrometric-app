import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ProcessType, Process, ProcessParameters } from '@/types/process';
import { StatePoint } from '@/types/psychrometric';

interface ProcessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (process: Omit<Process, 'id' | 'order'>) => void;
  statePoints: StatePoint[];
  activeSeason: 'summer' | 'winter' | 'both';
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

export const ProcessDialog = ({
  isOpen,
  onClose,
  onSave,
  statePoints,
  activeSeason,
  editingProcess,
}: ProcessDialogProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProcessType>('heating');
  const [fromPointId, setFromPointId] = useState('');
  const [toPointId, setToPointId] = useState('');
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
      setSeason(editingProcess.season);
      setParameters(editingProcess.parameters);
    } else {
      setName('');
      setType('heating');
      setFromPointId(statePoints.length > 0 ? statePoints[0].id : '');
      setToPointId(statePoints.length > 1 ? statePoints[1].id : '');
      setSeason(activeSeason);
      setParameters({ airflow: 1000 });
    }
  }, [editingProcess, statePoints, activeSeason, isOpen]);

  useEffect(() => {
    if (type !== 'mixing') return;
    setParameters((prev) => {
      const ratio1 = prev.mixingRatios?.stream1.ratio ?? 0.5;
      const stream1PointId = prev.mixingRatios?.stream1.pointId ?? fromPointId;
      const stream2PointId =
        prev.mixingRatios?.stream2.pointId ??
        statePoints.find((point) => point.id !== stream1PointId)?.id ??
        '';
      return {
        ...prev,
        mixingRatios: {
          stream1: { pointId: stream1PointId, ratio: ratio1 },
          stream2: { pointId: stream2PointId, ratio: 1 - ratio1 },
        },
      };
    });
  }, [type, fromPointId, statePoints]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) {
      alert('名前を入力してください');
      return;
    }
    if (!fromPointId || (!toPointId && type !== 'mixing')) {
      alert('始点と終点を選択してください');
      return;
    }
    if (type !== 'mixing' && fromPointId === toPointId) {
      alert('始点と終点は異なる状態点を選択してください');
      return;
    }
    if (type === 'mixing') {
      const stream2Id = parameters.mixingRatios?.stream2.pointId;
      if (!stream2Id) {
        alert('混合流2の状態点を選択してください');
        return;
      }
      if (stream2Id === fromPointId) {
        alert('混合流2は混合流1と異なる状態点を選択してください');
        return;
      }
    }

    onSave({
      name: name.trim(),
      type,
      season,
      fromPointId,
      toPointId,
      parameters,
    });

    onClose();
  };

  const handleParameterChange = (key: keyof ProcessParameters, value: number | string) => {
    setParameters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleMixingRatioChange = (value: number) => {
    const ratio1 = Math.max(0, Math.min(1, value / 100));
    setParameters((prev) => ({
      ...prev,
      mixingRatios: {
        stream1: {
          pointId: prev.mixingRatios?.stream1.pointId ?? fromPointId,
          ratio: ratio1,
        },
        stream2: {
          pointId: prev.mixingRatios?.stream2.pointId ?? '',
          ratio: 1 - ratio1,
        },
      },
    }));
  };

  const handleMixingStreamChange = (streamKey: 'stream1' | 'stream2', pointId: string) => {
    setParameters((prev) => {
      const ratio1 = prev.mixingRatios?.stream1.ratio ?? 0.5;
      return {
        ...prev,
        mixingRatios: {
          stream1: {
            pointId: streamKey === 'stream1' ? pointId : prev.mixingRatios?.stream1.pointId ?? fromPointId,
            ratio: ratio1,
          },
          stream2: {
            pointId: streamKey === 'stream2' ? pointId : prev.mixingRatios?.stream2.pointId ?? '',
            ratio: 1 - ratio1,
          },
        },
      };
    });
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
              {Object.entries(processTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                夏季
              </button>
              <button
                onClick={() => setSeason('winter')}
                className={`flex-1 py-2 px-3 rounded ${
                  season === 'winter'
                    ? 'bg-blue-500 text-white'
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
              始点（入口）
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
          {type === 'mixing' ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              混合点は保存時に自動で追加されます。
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終点（出口）
              </label>
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
            </div>
          )}

          {/* プロセスパラメータ */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">パラメータ</h4>

            {/* 風量（共通） */}
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">
                風量 [m³/h]
              </label>
              <input
                type="number"
                value={parameters.airflow || ''}
                onChange={(e) => handleParameterChange('airflow', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* タイプ別パラメータ */}
            {(type === 'heating' || type === 'cooling') && (
              <>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    能力 [kW]（オプション）
                  </label>
                  <input
                    type="number"
                    value={parameters.capacity || ''}
                    onChange={(e) => handleParameterChange('capacity', parseFloat(e.target.value))}
                    placeholder="自動計算"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {type === 'cooling' && (
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">
                      顕熱比 SHF [-]
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={parameters.SHF || ''}
                      onChange={(e) => handleParameterChange('SHF', parseFloat(e.target.value))}
                      placeholder="0.0 - 1.0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
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
                    onChange={(e) => handleParameterChange('humidifyingCapacity', parseFloat(e.target.value))}
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
              <div className="mb-3">
                <label className="block text-sm text-gray-600 mb-1">
                  全熱交換効率 [%]
                </label>
                <input
                  type="number"
                  value={parameters.heatExchangeEfficiency || ''}
                  onChange={(e) => handleParameterChange('heatExchangeEfficiency', parseFloat(e.target.value))}
                  placeholder="例: 65"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
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
                    空気比率（混合流1の割合）[%]
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={
                      parameters.mixingRatios?.stream1.ratio !== undefined
                        ? Math.round(parameters.mixingRatios.stream1.ratio * 100)
                        : 50
                    }
                    onChange={(e) => handleMixingRatioChange(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    混合流2の割合: {Math.round((parameters.mixingRatios?.stream2.ratio ?? 0.5) * 100)}%
                  </p>
                </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    全熱交換効率 [%]（外気側の前処理）
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={parameters.heatExchangeEfficiency || ''}
                    onChange={(e) => handleParameterChange('heatExchangeEfficiency', parseFloat(e.target.value))}
                    placeholder="例: 65"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    排気側の状態点（全熱交換器）
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
                    onChange={(e) => handleParameterChange('fanPower', parseFloat(e.target.value))}
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
                    onChange={(e) => handleParameterChange('fanEfficiency', parseFloat(e.target.value))}
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
