import { useEffect, useRef, useState } from 'react';
import { Plus, Settings, Download, FolderOpen, Edit2, Trash2 } from 'lucide-react';
import { useProjectStore } from './store/projectStore';
import { PsychrometricChart, PsychrometricChartRef } from './components/Chart/PsychrometricChart';
import { ProcessDialog } from './components/Process/ProcessDialog';
import { ProcessList } from './components/Process/ProcessList';
import { DesignConditionsEditor } from './components/DesignConditions/DesignConditionsEditor';
import { ExportDialog } from './components/Export/ExportDialog';
import { ProjectManager } from './components/Project/ProjectManager';
import { StatePointConverter } from './lib/psychrometric/conversions';
import { STANDARD_PRESSURE } from './lib/psychrometric/constants';
import { MixingProcess } from './lib/processes/mixing';
import { Process } from './types/process';
import { DesignConditions } from './types/designConditions';
import { StatePoint, StatePointValueKey } from './types/psychrometric';

const STATE_POINT_INPUT_OPTIONS: Array<{
  key: StatePointValueKey;
  label: string;
  unit: string;
  placeholder: string;
  step: number;
  min?: number;
  max?: number;
}> = [
  {
    key: 'dryBulbTemp',
    label: '乾球温度',
    unit: '°C',
    placeholder: '乾球温度',
    step: 0.1,
  },
  {
    key: 'wetBulbTemp',
    label: '湿球温度',
    unit: '°C',
    placeholder: '湿球温度',
    step: 0.1,
  },
  {
    key: 'relativeHumidity',
    label: '相対湿度',
    unit: '%',
    placeholder: '相対湿度',
    step: 0.1,
    min: 0,
    max: 100,
  },
  {
    key: 'humidity',
    label: '絶対湿度',
    unit: "kg/kg'",
    placeholder: '絶対湿度',
    step: 0.0001,
    min: 0,
  },
  {
    key: 'enthalpy',
    label: 'エンタルピー',
    unit: "kJ/kg'",
    placeholder: 'エンタルピー',
    step: 0.1,
  },
  {
    key: 'dewPoint',
    label: '露点温度',
    unit: '°C',
    placeholder: '露点温度',
    step: 0.1,
  },
];

const isValidNumericInput = (value: string) => /^-?\d*\.?\d*$/.test(value);

const formatPointValue = (point: StatePoint, key: StatePointValueKey) => {
  const value = point[key as keyof StatePoint];
  if (typeof value !== 'number') {
    return '';
  }
  return value.toString();
};

function App() {
  const {
    statePoints,
    processes,
    activeSeason,
    selectedPointId,
    selectedProcessId,
    designConditions,
    addStatePoint,
    updateStatePoint,
    deleteStatePoint,
    addProcess,
    updateProcess,
    deleteProcess,
    setSelectedPoint,
    setSelectedProcess,
    setActiveSeason,
    setDesignConditions,
    loadProject,
  } = useProjectStore();

  // Chart ref for export
  const chartRef = useRef<PsychrometricChartRef>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const inputTypeAInitialized = useRef(false);
  const inputTypeBInitialized = useRef(false);

  // Dialog states
  const [showAddPoint, setShowAddPoint] = useState(false);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);

  // Process editing state
  const [editingProcess, setEditingProcess] = useState<Process | null>(null);

  // New point form state
  const [inputTypeA, setInputTypeA] = useState<StatePointValueKey>('dryBulbTemp');
  const [inputTypeB, setInputTypeB] = useState<StatePointValueKey>('relativeHumidity');
  const [inputValueA, setInputValueA] = useState('25');
  const [inputValueB, setInputValueB] = useState('60');
  const [newPointName, setNewPointName] = useState('');
  const [newPointSeason, setNewPointSeason] = useState<'summer' | 'winter' | 'both'>(activeSeason);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [editingPointSnapshot, setEditingPointSnapshot] = useState<StatePoint | null>(null);
  const [copySourceA, setCopySourceA] = useState('');
  const [copySourceB, setCopySourceB] = useState('');

  // Active tab for sidebar
  const [activeTab, setActiveTab] = useState<'points' | 'processes'>('points');
  const [chartSize, setChartSize] = useState({ width: 900, height: 600 });
  const inputOptionA =
    STATE_POINT_INPUT_OPTIONS.find((option) => option.key === inputTypeA) ??
    STATE_POINT_INPUT_OPTIONS[0];
  const inputOptionB =
    STATE_POINT_INPUT_OPTIONS.find((option) => option.key === inputTypeB) ??
    STATE_POINT_INPUT_OPTIONS[1];

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const updateSize = () => {
      const width = Math.max(320, Math.floor(container.clientWidth));
      const height = Math.max(320, Math.floor(width * 0.65));
      setChartSize({ width, height });
    };

    updateSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inputTypeAInitialized.current) {
      inputTypeAInitialized.current = true;
      return;
    }
    if (editingPointSnapshot) {
      setInputValueA(formatPointValue(editingPointSnapshot, inputTypeA));
      return;
    }
    setInputValueA('');
  }, [inputTypeA, editingPointSnapshot]);

  useEffect(() => {
    if (!inputTypeBInitialized.current) {
      inputTypeBInitialized.current = true;
      return;
    }
    if (editingPointSnapshot) {
      setInputValueB(formatPointValue(editingPointSnapshot, inputTypeB));
      return;
    }
    setInputValueB('');
  }, [inputTypeB, editingPointSnapshot]);

  const resetPointForm = () => {
    setNewPointName('');
    setNewPointSeason(activeSeason);
    setInputTypeA('dryBulbTemp');
    setInputTypeB('relativeHumidity');
    setInputValueA('25');
    setInputValueB('60');
    setEditingPointId(null);
    setEditingPointSnapshot(null);
    setCopySourceA('');
    setCopySourceB('');
  };

  // 状態点の追加
  const handleAddPoint = () => {
    const valueA = parseFloat(inputValueA);
    const valueB = parseFloat(inputValueB);

    if (isNaN(valueA) || isNaN(valueB)) {
      alert('入力値を正しく入力してください');
      return;
    }
    if (
      (inputOptionA.min !== undefined && valueA < inputOptionA.min) ||
      (inputOptionA.max !== undefined && valueA > inputOptionA.max)
    ) {
      alert(`${inputOptionA.label}の入力範囲を確認してください`);
      return;
    }
    if (
      (inputOptionB.min !== undefined && valueB < inputOptionB.min) ||
      (inputOptionB.max !== undefined && valueB > inputOptionB.max)
    ) {
      alert(`${inputOptionB.label}の入力範囲を確認してください`);
      return;
    }

    if (inputTypeA === inputTypeB) {
      alert('異なる2つの項目を選択してください');
      return;
    }

    const pressure = designConditions.outdoor.pressure ?? STANDARD_PRESSURE;

    if (
      (inputTypeA === 'dewPoint' && inputTypeB === 'humidity') ||
      (inputTypeA === 'humidity' && inputTypeB === 'dewPoint')
    ) {
      alert('露点温度と絶対湿度だけでは状態点を特定できません。別の組み合わせを選択してください。');
      return;
    }

    let stateData: ReturnType<typeof StatePointConverter.fromTwoValues>;
    try {
      stateData = StatePointConverter.fromTwoValues(
        inputTypeA,
        valueA,
        inputTypeB,
        valueB,
        pressure
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : '状態点を計算できません');
      return;
    }

    if (editingPointId) {
      updateStatePoint(editingPointId, {
        name: newPointName || `Point ${statePoints.length}`,
        season: newPointSeason,
        ...stateData,
      });
    } else {
      const newPoint = {
        id: `point-${Date.now()}`,
        name: newPointName || `Point ${statePoints.length + 1}`,
        season: newPointSeason,
        order: statePoints.length,
        ...stateData,
      };

      addStatePoint(newPoint);
    }
    setShowAddPoint(false);
    resetPointForm();
  };

  const handleNumericInput = (
    value: string,
    setter: (nextValue: string) => void
  ) => {
    const normalized = value.replace(/,/g, '');
    if (normalized === '' || isValidNumericInput(normalized)) {
      setter(normalized);
    }
  };

  const copyPointValue = (
    sourceId: string,
    valueKey: StatePointValueKey,
    setter: (nextValue: string) => void
  ) => {
    if (!sourceId) {
      alert('コピー元の状態点を選択してください');
      return;
    }
    const sourcePoint = statePoints.find((point) => point.id === sourceId);
    if (!sourcePoint) {
      alert('コピー元の状態点が見つかりません');
      return;
    }
    const sourceValue = sourcePoint[valueKey as keyof StatePoint];
    if (typeof sourceValue !== 'number') {
      alert('コピー元の値が取得できません');
      return;
    }
    setter(sourceValue.toString());
  };

  const startEditPoint = (pointId: string) => {
    const point = statePoints.find((item) => item.id === pointId);
    if (!point) return;
    setEditingPointId(pointId);
    setEditingPointSnapshot(point);
    setShowAddPoint(true);
    setNewPointName(point.name);
    setNewPointSeason(point.season);
    setInputTypeA('dryBulbTemp');
    setInputTypeB('relativeHumidity');
    setInputValueA(point.dryBulbTemp?.toString() ?? '');
    setInputValueB(point.relativeHumidity?.toString() ?? '');
  };

  const cancelEditPoint = () => {
    setShowAddPoint(false);
    resetPointForm();
  };

  // 状態点の移動（ドラッグ）
  const handlePointMove = (pointId: string, temp: number, humidity: number) => {
    const stateData = StatePointConverter.fromDryBulbAndHumidity(temp, humidity);
    updateStatePoint(pointId, stateData);
  };

  // プリセット条件の追加
  const addPresetPoint = (
    name: string,
    season: 'summer' | 'winter',
    temp: number,
    rh: number
  ) => {
    const stateData = StatePointConverter.fromDryBulbAndRH(temp, rh);
    addStatePoint({
      id: `point-${Date.now()}`,
      name,
      season,
      order: statePoints.length,
      ...stateData,
    });
  };

  // プロセスの保存
  const handleSaveProcess = (processData: Omit<Process, 'id' | 'order'>) => {
    let resolvedProcessData = processData;
    if (processData.type === 'mixing') {
      const stream1Id =
        processData.parameters.mixingRatios?.stream1.pointId ?? processData.fromPointId;
      const stream2Id = processData.parameters.mixingRatios?.stream2.pointId;
      const stream1 = statePoints.find((point) => point.id === stream1Id);
      const stream2 = statePoints.find((point) => point.id === stream2Id);
      const defaultTotalAirflow = processData.parameters.airflow ?? 1000;
      const ratio1 =
        processData.parameters.mixingRatios?.stream1.ratio ??
        processData.parameters.mixingRatios?.stream2.ratio ??
        0.5;
      const fallbackAirflow1 = defaultTotalAirflow * Math.max(0, Math.min(1, ratio1));
      const fallbackAirflow2 = Math.max(0, defaultTotalAirflow - fallbackAirflow1);
      const airflow1 = processData.parameters.mixingRatios?.stream1.airflow ?? fallbackAirflow1;
      const airflow2 = processData.parameters.mixingRatios?.stream2.airflow ?? fallbackAirflow2;
      const exhaustPoint = processData.parameters.exhaustPointId
        ? statePoints.find((point) => point.id === processData.parameters.exhaustPointId)
        : undefined;

      if (stream1 && stream2) {
        const pressure = designConditions.outdoor.pressure ?? STANDARD_PRESSURE;
        const efficiency = processData.parameters.heatExchangeEfficiency ?? 0;
        const mixedPoint =
          efficiency > 0 && exhaustPoint
            ? MixingProcess.mixWithHeatExchange(
                stream1,
                stream2,
                airflow1,
                airflow2,
                efficiency,
                exhaustPoint,
                pressure
              ).mixedPoint
            : MixingProcess.mixTwoStreams(stream1, airflow1, stream2, airflow2, pressure)
                .mixedPoint;
        const newPointId = `point-${Date.now()}`;
        addStatePoint({
          id: newPointId,
          name: `${processData.name} 混合点`,
          season: processData.season,
          order: statePoints.length,
          ...mixedPoint,
        });
        resolvedProcessData = {
          ...processData,
          toPointId: newPointId,
        };
      }
    }

    if (editingProcess) {
      updateProcess(editingProcess.id, resolvedProcessData);
    } else {
      addProcess({
        id: `process-${Date.now()}`,
        order: processes.length,
        ...resolvedProcessData,
      } as Process);
    }
    if (processData.type === 'mixing') {
      setSelectedPoint(resolvedProcessData.toPointId);
    }

    setEditingProcess(null);
  };

  // プロセスの編集開始
  const handleEditProcess = (process: Process) => {
    setEditingProcess(process);
    setShowProcessDialog(true);
  };

  // 設計条件の保存
  const handleSaveDesignConditions = (conditions: DesignConditions) => {
    setDesignConditions(conditions);
  };

  // プロジェクトの読み込み
  const handleLoadProject = (data: {
    designConditions: DesignConditions;
    statePoints: typeof statePoints;
    processes: typeof processes;
  }) => {
    loadProject(data);
  };

  // Canvas refを取得
  const getCanvasRef = () => {
    return { current: chartRef.current?.getCanvas() || null };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-full mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">
              空気線図アプリケーション
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              {designConditions.project.name} - {designConditions.project.location}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              onClick={() => setShowDesignEditor(true)}
              className="flex items-center gap-2 px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">設計条件</span>
            </button>
            <button
              onClick={() => setShowProjectManager(true)}
              className="flex items-center gap-2 px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">プロジェクト</span>
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-2 px-2.5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">エクスポート</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* 左サイドバー */}
        <aside className="w-full lg:w-80 bg-white border-r border-gray-200 lg:h-[calc(100vh-60px)] overflow-y-auto">
          {/* 季節切替 */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-sm text-gray-700 mb-2">表示モード</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveSeason('summer')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                  activeSeason === 'summer'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                夏季
              </button>
              <button
                onClick={() => setActiveSeason('winter')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                  activeSeason === 'winter'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                冬季
              </button>
              <button
                onClick={() => setActiveSeason('both')}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                  activeSeason === 'both'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                両方
              </button>
            </div>
          </div>

          {/* タブ切替 */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'points'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              状態点
            </button>
            <button
              onClick={() => setActiveTab('processes')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'processes'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              プロセス
            </button>
          </div>

          {/* 状態点タブ */}
          {activeTab === 'points' && (
            <div className="p-4">
              {/* プリセットボタン */}
              <div className="space-y-2 mb-4">
                <h3 className="text-sm font-medium text-gray-700">プリセット追加</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      addPresetPoint(
                        '外気(夏)',
                        'summer',
                        designConditions.outdoor.summer.dryBulbTemp,
                        designConditions.outdoor.summer.relativeHumidity
                      )
                    }
                    className="py-2 px-3 bg-blue-100 hover:bg-blue-200 rounded text-sm text-blue-800"
                  >
                    夏季外気
                  </button>
                  <button
                    onClick={() =>
                      addPresetPoint(
                        '室内(夏)',
                        'summer',
                        designConditions.indoor.summer.dryBulbTemp,
                        designConditions.indoor.summer.relativeHumidity
                      )
                    }
                    className="py-2 px-3 bg-sky-100 hover:bg-sky-200 rounded text-sm text-sky-800"
                  >
                    夏季室内
                  </button>
                  <button
                    onClick={() =>
                      addPresetPoint(
                        '外気(冬)',
                        'winter',
                        designConditions.outdoor.winter.dryBulbTemp,
                        designConditions.outdoor.winter.relativeHumidity
                      )
                    }
                    className="py-2 px-3 bg-red-100 hover:bg-red-200 rounded text-sm text-red-800"
                  >
                    冬季外気
                  </button>
                  <button
                    onClick={() =>
                      addPresetPoint(
                        '室内(冬)',
                        'winter',
                        designConditions.indoor.winter.dryBulbTemp,
                        designConditions.indoor.winter.relativeHumidity
                      )
                    }
                    className="py-2 px-3 bg-rose-100 hover:bg-rose-200 rounded text-sm text-rose-800"
                  >
                    冬季室内
                  </button>
                </div>
              </div>

              {/* カスタム追加ボタン */}
              <button
                onClick={() => {
                  if (showAddPoint) {
                    resetPointForm();
                  }
                  setShowAddPoint(!showAddPoint);
                }}
                className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                カスタム追加
              </button>

              {/* カスタム追加フォーム */}
              {showAddPoint && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                  <input
                    type="text"
                    placeholder="名前"
                    value={newPointName}
                    onChange={(e) => setNewPointName(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                  <div className="grid grid-cols-1 gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center">
                      <select
                        value={inputTypeA}
                        onChange={(e) => setInputTypeA(e.target.value as StatePointValueKey)}
                        className="px-3 py-2 border rounded text-sm bg-white"
                      >
                        {STATE_POINT_INPUT_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={inputOptionA.placeholder}
                          value={inputValueA}
                          onChange={(e) => handleNumericInput(e.target.value, setInputValueA)}
                          className="flex-1 px-3 py-2 border rounded text-sm"
                        />
                        <span className="text-xs text-gray-500 min-w-[56px] text-right">
                          {inputOptionA.unit}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center">
                      <span className="text-xs text-gray-500">コピー元</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={copySourceA}
                          onChange={(e) => setCopySourceA(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded text-xs bg-white"
                        >
                          <option value="">状態点を選択</option>
                          {statePoints.map((point) => (
                            <option key={point.id} value={point.id}>
                              {point.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => copyPointValue(copySourceA, inputTypeA, setInputValueA)}
                          className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          値をコピー
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center">
                      <select
                        value={inputTypeB}
                        onChange={(e) => setInputTypeB(e.target.value as StatePointValueKey)}
                        className="px-3 py-2 border rounded text-sm bg-white"
                      >
                        {STATE_POINT_INPUT_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder={inputOptionB.placeholder}
                          value={inputValueB}
                          onChange={(e) => handleNumericInput(e.target.value, setInputValueB)}
                          className="flex-1 px-3 py-2 border rounded text-sm"
                        />
                        <span className="text-xs text-gray-500 min-w-[56px] text-right">
                          {inputOptionB.unit}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 items-center">
                      <span className="text-xs text-gray-500">コピー元</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={copySourceB}
                          onChange={(e) => setCopySourceB(e.target.value)}
                          className="flex-1 px-3 py-2 border rounded text-xs bg-white"
                        >
                          <option value="">状態点を選択</option>
                          {statePoints.map((point) => (
                            <option key={point.id} value={point.id}>
                              {point.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => copyPointValue(copySourceB, inputTypeB, setInputValueB)}
                          className="px-3 py-2 text-xs bg-gray-200 hover:bg-gray-300 rounded"
                        >
                          値をコピー
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      選択した2項目の入力値から他の物性値を計算します。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setNewPointSeason('summer')}
                      className={`flex-1 py-1.5 text-xs rounded ${
                        newPointSeason === 'summer'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200'
                      }`}
                    >
                      夏
                    </button>
                    <button
                      onClick={() => setNewPointSeason('winter')}
                      className={`flex-1 py-1.5 text-xs rounded ${
                        newPointSeason === 'winter'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200'
                      }`}
                    >
                      冬
                    </button>
                    <button
                      onClick={() => setNewPointSeason('both')}
                      className={`flex-1 py-1.5 text-xs rounded ${
                        newPointSeason === 'both'
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-200'
                      }`}
                    >
                      通年
                    </button>
                  </div>
                  <button
                    onClick={handleAddPoint}
                    className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                  >
                    {editingPointId ? '更新' : '追加'}
                  </button>
                  {editingPointId && (
                    <button
                      onClick={cancelEditPoint}
                      className="w-full py-2 px-4 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                    >
                      キャンセル
                    </button>
                  )}
                </div>
              )}

              {/* 状態点リスト */}
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-gray-700">
                  状態点一覧 ({statePoints.length}個)
                </h3>
                {statePoints.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    状態点がありません
                  </p>
                ) : (
                  statePoints
                    .filter((point) => {
                      if (activeSeason === 'both') return true;
                      return point.season === activeSeason || point.season === 'both';
                    })
                    .map((point) => (
                      <div
                        key={point.id}
                        onClick={() => setSelectedPoint(point.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedPointId === point.id
                            ? 'bg-blue-50 border-2 border-blue-500'
                            : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{point.name}</span>
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  point.season === 'summer'
                                    ? 'bg-blue-100 text-blue-700'
                                    : point.season === 'winter'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-purple-100 text-purple-700'
                                }`}
                              >
                                {point.season === 'summer'
                                  ? '夏'
                                  : point.season === 'winter'
                                  ? '冬'
                                  : '通年'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                              <div>
                                乾球温度: {point.dryBulbTemp?.toFixed(1) ?? '-'}°C
                              </div>
                              <div>
                                湿球温度: {point.wetBulbTemp?.toFixed(1) ?? '-'}°C
                              </div>
                              <div>
                                相対湿度: {point.relativeHumidity?.toFixed(0) ?? '-'}%
                              </div>
                              <div>
                                絶対湿度: {point.humidity?.toFixed(4) ?? '-'} kg/kg'
                              </div>
                              <div>
                                エンタルピー: {point.enthalpy?.toFixed(1) ?? '-'} kJ/kg'
                              </div>
                              <div>
                                露点温度: {point.dewPoint?.toFixed(1) ?? '-'}°C
                              </div>
                              <div>
                                比体積: {point.specificVolume?.toFixed(3) ?? '-'} m³/kg'
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditPoint(point.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`「${point.name}」を削除しますか？`)) {
                                  deleteStatePoint(point.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* プロセスタブ */}
          {activeTab === 'processes' && (
            <div className="p-4">
              <button
                onClick={() => {
                  setEditingProcess(null);
                  setShowProcessDialog(true);
                }}
                disabled={statePoints.length < 2}
                className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                プロセス追加
              </button>
              {statePoints.length < 2 && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  プロセスを追加するには状態点が2つ以上必要です
                </p>
              )}

              <div className="mt-4">
                <ProcessList
                  processes={processes}
                  statePoints={statePoints}
                  activeSeason={activeSeason}
                  selectedProcessId={selectedProcessId}
                  onSelectProcess={setSelectedProcess}
                  onEditProcess={handleEditProcess}
                  onDeleteProcess={deleteProcess}
                  onReorderProcesses={() => {}}
                />
              </div>
            </div>
          )}
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 p-4 overflow-auto">
          <div
            className="bg-white rounded-lg shadow p-4 overflow-x-auto"
            ref={chartContainerRef}
          >
            <PsychrometricChart
              ref={chartRef}
              width={chartSize.width}
              height={chartSize.height}
              statePoints={statePoints}
              processes={processes}
              activeSeason={activeSeason}
              selectedPointId={selectedPointId}
              onPointClick={setSelectedPoint}
              onPointMove={handlePointMove}
            />
          </div>

          {/* 設計条件表示 */}
          <div className="bg-white rounded-lg shadow p-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">設計条件</h2>
              <button
                onClick={() => setShowDesignEditor(true)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" />
                編集
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">外気条件</h3>
                <div className="text-gray-600 space-y-1">
                  <p>
                    夏季: {designConditions.outdoor.summer.dryBulbTemp}°C, RH
                    {designConditions.outdoor.summer.relativeHumidity}%
                  </p>
                  <p>
                    冬季: {designConditions.outdoor.winter.dryBulbTemp}°C, RH
                    {designConditions.outdoor.winter.relativeHumidity}%
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">室内条件</h3>
                <div className="text-gray-600 space-y-1">
                  <p>
                    夏季: {designConditions.indoor.summer.dryBulbTemp}°C, RH
                    {designConditions.indoor.summer.relativeHumidity}%
                  </p>
                  <p>
                    冬季: {designConditions.indoor.winter.dryBulbTemp}°C, RH
                    {designConditions.indoor.winter.relativeHumidity}%
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">風量</h3>
                <div className="text-gray-600 space-y-1">
                  <p>給気: {designConditions.airflow.supplyAir} m³/h</p>
                  <p>外気: {designConditions.airflow.outdoorAir} m³/h</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ダイアログ */}
      <ProcessDialog
        isOpen={showProcessDialog}
        onClose={() => {
          setShowProcessDialog(false);
          setEditingProcess(null);
        }}
        onSave={handleSaveProcess}
        statePoints={statePoints}
        activeSeason={activeSeason}
        editingProcess={editingProcess}
      />

      <DesignConditionsEditor
        isOpen={showDesignEditor}
        onClose={() => setShowDesignEditor(false)}
        designConditions={designConditions}
        onSave={handleSaveDesignConditions}
      />

      {showExportDialog && (
        <ExportDialog
          onClose={() => setShowExportDialog(false)}
          canvasRef={getCanvasRef()}
          designConditions={designConditions}
          statePoints={statePoints}
          processes={processes}
        />
      )}

      <ProjectManager
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        designConditions={designConditions}
        statePoints={statePoints}
        processes={processes}
        onLoadProject={handleLoadProject}
      />
    </div>
  );
}

export default App;
