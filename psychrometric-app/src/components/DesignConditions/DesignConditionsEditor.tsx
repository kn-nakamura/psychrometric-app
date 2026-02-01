import { useState } from 'react';
import { X, Building2, Thermometer, Wind, Settings, Calculator } from 'lucide-react';
import { DesignConditions } from '@/types/designConditions';

interface DesignConditionsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  designConditions: DesignConditions;
  onSave: (conditions: DesignConditions) => void;
}

type TabType = 'project' | 'outdoor' | 'indoor' | 'airflow' | 'equipment' | 'calculation';

export const DesignConditionsEditor = ({
  isOpen,
  onClose,
  designConditions,
  onSave,
}: DesignConditionsEditorProps) => {
  const [activeTab, setActiveTab] = useState<TabType>('project');
  const [conditions, setConditions] = useState<DesignConditions>(designConditions);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(conditions);
    onClose();
  };

  const updateProject = (field: string, value: string) => {
    setConditions((prev) => ({
      ...prev,
      project: { ...prev.project, [field]: value },
    }));
  };

  const updateOutdoor = (
    season: 'summer' | 'winter',
    field: string,
    value: number
  ) => {
    setConditions((prev) => ({
      ...prev,
      outdoor: {
        ...prev.outdoor,
        [season]: { ...prev.outdoor[season], [field]: value },
      },
    }));
  };

  const updateIndoor = (
    season: 'summer' | 'winter',
    field: string,
    value: number
  ) => {
    setConditions((prev) => ({
      ...prev,
      indoor: {
        ...prev.indoor,
        [season]: { ...prev.indoor[season], [field]: value },
      },
    }));
  };

  const updateAirflow = (field: string, value: number | string) => {
    setConditions((prev) => ({
      ...prev,
      airflow: { ...prev.airflow, [field]: value },
    }));
  };

  const updateCalculationConstant = (
    field: keyof DesignConditions['calculation']['constants'],
    value: number
  ) => {
    setConditions((prev) => ({
      ...prev,
      calculation: {
        ...prev.calculation,
        constants: {
          ...prev.calculation.constants,
          [field]: value,
        },
      },
    }));
  };

  const updateTetensConstant = (
    target: 'tetensWater' | 'tetensIce',
    field: 'A' | 'B' | 'C',
    value: number
  ) => {
    setConditions((prev) => ({
      ...prev,
      calculation: {
        ...prev.calculation,
        constants: {
          ...prev.calculation.constants,
          [target]: {
            ...prev.calculation.constants[target],
            [field]: value,
          },
        },
      },
    }));
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'project', label: 'プロジェクト', icon: <Building2 className="w-4 h-4" /> },
    { id: 'outdoor', label: '外気条件', icon: <Thermometer className="w-4 h-4" /> },
    { id: 'indoor', label: '室内条件', icon: <Thermometer className="w-4 h-4" /> },
    { id: 'airflow', label: '風量', icon: <Wind className="w-4 h-4" /> },
    { id: 'equipment', label: '機器', icon: <Settings className="w-4 h-4" /> },
    { id: 'calculation', label: '計算設定', icon: <Calculator className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">設計条件の編集</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* タブ */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* プロジェクト情報 */}
          {activeTab === 'project' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  プロジェクト名
                </label>
                <input
                  type="text"
                  value={conditions.project.name}
                  onChange={(e) => updateProject('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  所在地
                </label>
                <input
                  type="text"
                  value={conditions.project.location}
                  onChange={(e) => updateProject('location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  設計者
                </label>
                <input
                  type="text"
                  value={conditions.project.designer}
                  onChange={(e) => updateProject('designer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  設計日
                </label>
                <input
                  type="date"
                  value={conditions.project.date}
                  onChange={(e) => updateProject('date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備考
                </label>
                <textarea
                  value={conditions.project.description || ''}
                  onChange={(e) => updateProject('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* 外気条件 */}
          {activeTab === 'outdoor' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  夏季外気条件
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      乾球温度 [°C]
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={conditions.outdoor.summer.dryBulbTemp}
                      onChange={(e) =>
                        updateOutdoor('summer', 'dryBulbTemp', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      相対湿度 [%]
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={conditions.outdoor.summer.relativeHumidity}
                      onChange={(e) =>
                        updateOutdoor('summer', 'relativeHumidity', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  冬季外気条件
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      乾球温度 [°C]
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={conditions.outdoor.winter.dryBulbTemp}
                      onChange={(e) =>
                        updateOutdoor('winter', 'dryBulbTemp', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      相対湿度 [%]
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={conditions.outdoor.winter.relativeHumidity}
                      onChange={(e) =>
                        updateOutdoor('winter', 'relativeHumidity', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  大気圧 [kPa]
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={conditions.outdoor.pressure}
                  onChange={(e) =>
                    setConditions((prev) => ({
                      ...prev,
                      outdoor: { ...prev.outdoor, pressure: parseFloat(e.target.value) },
                    }))
                  }
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* 室内条件 */}
          {activeTab === 'indoor' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  夏季室内条件
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      乾球温度 [°C]
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={conditions.indoor.summer.dryBulbTemp}
                      onChange={(e) =>
                        updateIndoor('summer', 'dryBulbTemp', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      相対湿度 [%]
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={conditions.indoor.summer.relativeHumidity}
                      onChange={(e) =>
                        updateIndoor('summer', 'relativeHumidity', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  冬季室内条件
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      乾球温度 [°C]
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={conditions.indoor.winter.dryBulbTemp}
                      onChange={(e) =>
                        updateIndoor('winter', 'dryBulbTemp', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      相対湿度 [%]
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={conditions.indoor.winter.relativeHumidity}
                      onChange={(e) =>
                        updateIndoor('winter', 'relativeHumidity', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 風量条件 */}
          {activeTab === 'airflow' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      給気量パラメーター名
                    </label>
                    <input
                      type="text"
                      value={conditions.airflow.supplyAirName}
                      onChange={(e) => updateAirflow('supplyAirName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      給気量 [m³/h]
                    </label>
                    <input
                      type="number"
                      value={conditions.airflow.supplyAir}
                      onChange={(e) => updateAirflow('supplyAir', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      外気量パラメーター名
                    </label>
                    <input
                      type="text"
                      value={conditions.airflow.outdoorAirName}
                      onChange={(e) => updateAirflow('outdoorAirName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      外気量 [m³/h]
                    </label>
                    <input
                      type="number"
                      value={conditions.airflow.outdoorAir}
                      onChange={(e) => updateAirflow('outdoorAir', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      還気量パラメーター名
                    </label>
                    <input
                      type="text"
                      value={conditions.airflow.returnAirName}
                      onChange={(e) => updateAirflow('returnAirName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      還気量 [m³/h]
                    </label>
                    <input
                      type="number"
                      value={conditions.airflow.returnAir}
                      onChange={(e) => updateAirflow('returnAir', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      排気量パラメーター名
                    </label>
                    <input
                      type="text"
                      value={conditions.airflow.exhaustAirName}
                      onChange={(e) => updateAirflow('exhaustAirName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      排気量 [m³/h]
                    </label>
                    <input
                      type="number"
                      value={conditions.airflow.exhaustAir}
                      onChange={(e) => updateAirflow('exhaustAir', parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">風量バランス</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    外気比: {((conditions.airflow.outdoorAir / conditions.airflow.supplyAir) * 100).toFixed(1)}%
                  </div>
                  <div>
                    給気 - 排気: {conditions.airflow.supplyAir - conditions.airflow.exhaustAir} m³/h
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 機器仕様 */}
          {activeTab === 'equipment' && (
            <div className="space-y-6">
              <p className="text-sm text-gray-500">
                機器仕様はプロセスの計算結果から自動的に更新されます。
              </p>

              {/* 全熱交換器 */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">全熱交換器</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">型式</label>
                    <input
                      type="text"
                      value={conditions.equipment.heatExchanger?.type || ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            heatExchanger: {
                              ...prev.equipment.heatExchanger,
                              type: e.target.value,
                              efficiencySummer: prev.equipment.heatExchanger?.efficiencySummer ?? 65,
                              efficiencyWinter: prev.equipment.heatExchanger?.efficiencyWinter ?? 65,
                            },
                          },
                        }))
                      }
                      placeholder="例: 回転式"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">夏季 全熱交換効率 [%]</label>
                    <input
                      type="number"
                      value={conditions.equipment.heatExchanger?.efficiencySummer ?? ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            heatExchanger: {
                              ...prev.equipment.heatExchanger,
                              type: prev.equipment.heatExchanger?.type || '',
                              efficiencySummer: parseFloat(e.target.value),
                            },
                          },
                        }))
                      }
                      placeholder="65"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">冬季 全熱交換効率 [%]</label>
                    <input
                      type="number"
                      value={conditions.equipment.heatExchanger?.efficiencyWinter ?? ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            heatExchanger: {
                              ...prev.equipment.heatExchanger,
                              type: prev.equipment.heatExchanger?.type || '',
                              efficiencyWinter: parseFloat(e.target.value),
                            },
                          },
                        }))
                      }
                      placeholder="65"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 加熱コイル */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">加熱コイル</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">方式</label>
                    <select
                      value={conditions.equipment.heatingCoil?.type || ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            heatingCoil: {
                              ...prev.equipment.heatingCoil,
                              type: e.target.value,
                              capacity: prev.equipment.heatingCoil?.capacity || 0,
                            },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">選択してください</option>
                      <option value="hot water">温水</option>
                      <option value="electric">電気</option>
                      <option value="steam">蒸気</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">能力 [kW]</label>
                    <input
                      type="number"
                      value={conditions.equipment.heatingCoil?.capacity || ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            heatingCoil: {
                              ...prev.equipment.heatingCoil,
                              type: prev.equipment.heatingCoil?.type || '',
                              capacity: parseFloat(e.target.value),
                            },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 冷却コイル */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">冷却コイル</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">方式</label>
                    <select
                      value={conditions.equipment.coolingCoil?.type || ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            coolingCoil: {
                              ...prev.equipment.coolingCoil,
                              type: e.target.value,
                              capacity: prev.equipment.coolingCoil?.capacity || 0,
                              SHF: prev.equipment.coolingCoil?.SHF || 0.8,
                            },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">選択してください</option>
                      <option value="chilled water">冷水</option>
                      <option value="DX">DX</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">能力 [kW]</label>
                    <input
                      type="number"
                      value={conditions.equipment.coolingCoil?.capacity || ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            coolingCoil: {
                              ...prev.equipment.coolingCoil,
                              type: prev.equipment.coolingCoil?.type || '',
                              capacity: parseFloat(e.target.value),
                              SHF: prev.equipment.coolingCoil?.SHF || 0.8,
                            },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">SHF</label>
                    <input
                      type="number"
                      step="0.01"
                      value={conditions.equipment.coolingCoil?.SHF || ''}
                      onChange={(e) =>
                        setConditions((prev) => ({
                          ...prev,
                          equipment: {
                            ...prev.equipment,
                            coolingCoil: {
                              ...prev.equipment.coolingCoil,
                              type: prev.equipment.coolingCoil?.type || '',
                              capacity: prev.equipment.coolingCoil?.capacity || 0,
                              SHF: parseFloat(e.target.value),
                            },
                          },
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 計算設定 */}
          {activeTab === 'calculation' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">計算ロジック</h4>
                <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                  <li>
                    飽和水蒸気圧はTetensの式（Ps = A × exp(B × t / (C + t))）で算出。
                  </li>
                  <li>
                    絶対湿度は x = ε × Pv / (P - Pv) を用い、相対湿度から部分水蒸気圧を算出。
                  </li>
                  <li>
                    エンタルピーは h = cp,a × t + x × (L0 + cp,v × t) を使用。
                  </li>
                  <li>
                    湿球温度は熱収支式をNewton-Raphson法で反復計算。
                  </li>
                </ul>
                <p className="text-xs text-gray-500">
                  下記の定数を変更すると、状態点計算やプロセス計算の結果に反映されます。
                </p>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">基本定数</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">標準大気圧 [kPa]</label>
                    <input
                      type="number"
                      step="0.001"
                      value={conditions.calculation.constants.standardPressure}
                      onChange={(e) =>
                        updateCalculationConstant('standardPressure', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      乾き空気の定圧比熱 [kJ/(kg·K)]
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={conditions.calculation.constants.cpAir}
                      onChange={(e) =>
                        updateCalculationConstant('cpAir', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      水蒸気の定圧比熱 [kJ/(kg·K)]
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={conditions.calculation.constants.cpVapor}
                      onChange={(e) =>
                        updateCalculationConstant('cpVapor', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      0°C蒸発潜熱 [kJ/kg]
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={conditions.calculation.constants.latentHeat0c}
                      onChange={(e) =>
                        updateCalculationConstant('latentHeat0c', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">分子量比 [-]</label>
                    <input
                      type="number"
                      step="0.001"
                      value={conditions.calculation.constants.molecularWeightRatio}
                      onChange={(e) =>
                        updateCalculationConstant(
                          'molecularWeightRatio',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      乾き空気の気体定数 [kJ/(kg·K)]
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={conditions.calculation.constants.rAir}
                      onChange={(e) =>
                        updateCalculationConstant('rAir', parseFloat(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      湿球温度計定数
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={conditions.calculation.constants.wetBulbCoefficient}
                      onChange={(e) =>
                        updateCalculationConstant(
                          'wetBulbCoefficient',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">収束判定値</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={conditions.calculation.constants.convergenceTolerance}
                      onChange={(e) =>
                        updateCalculationConstant(
                          'convergenceTolerance',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">最大反復回数</label>
                    <input
                      type="number"
                      step="1"
                      value={conditions.calculation.constants.maxIterations}
                      onChange={(e) =>
                        updateCalculationConstant(
                          'maxIterations',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <h4 className="text-sm font-semibold text-gray-900">Tetens係数</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">水面上 (0°C以上)</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">A [kPa]</label>
                        <input
                          type="number"
                          step="0.00001"
                          value={conditions.calculation.constants.tetensWater.A}
                          onChange={(e) =>
                            updateTetensConstant('tetensWater', 'A', parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">B</label>
                        <input
                          type="number"
                          step="0.001"
                          value={conditions.calculation.constants.tetensWater.B}
                          onChange={(e) =>
                            updateTetensConstant('tetensWater', 'B', parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">C [°C]</label>
                        <input
                          type="number"
                          step="0.01"
                          value={conditions.calculation.constants.tetensWater.C}
                          onChange={(e) =>
                            updateTetensConstant('tetensWater', 'C', parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">氷面上 (0°C未満)</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">A [kPa]</label>
                        <input
                          type="number"
                          step="0.00001"
                          value={conditions.calculation.constants.tetensIce.A}
                          onChange={(e) =>
                            updateTetensConstant('tetensIce', 'A', parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">B</label>
                        <input
                          type="number"
                          step="0.001"
                          value={conditions.calculation.constants.tetensIce.B}
                          onChange={(e) =>
                            updateTetensConstant('tetensIce', 'B', parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">C [°C]</label>
                        <input
                          type="number"
                          step="0.01"
                          value={conditions.calculation.constants.tetensIce.C}
                          onChange={(e) =>
                            updateTetensConstant('tetensIce', 'C', parseFloat(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
