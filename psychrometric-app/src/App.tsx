import { useState } from 'react';
import { useProjectStore } from './store/projectStore';
import { PsychrometricChart } from './components/Chart/PsychrometricChart';
import { StatePointConverter } from './lib/psychrometric/conversions';

function App() {
  const {
    statePoints,
    processes,
    activeSeason,
    selectedPointId,
    designConditions,
    addStatePoint,
    updateStatePoint,
    setSelectedPoint,
    setActiveSeason,
  } = useProjectStore();
  
  const [showAddPoint, setShowAddPoint] = useState(false);
  const [newPointTemp, setNewPointTemp] = useState('25');
  const [newPointRH, setNewPointRH] = useState('60');
  const [newPointName, setNewPointName] = useState('');
  
  // 状態点の追加
  const handleAddPoint = () => {
    const temp = parseFloat(newPointTemp);
    const rh = parseFloat(newPointRH);
    
    if (isNaN(temp) || isNaN(rh)) {
      alert('温度と相対湿度を正しく入力してください');
      return;
    }
    
    const stateData = StatePointConverter.fromDryBulbAndRH(temp, rh);
    
    const newPoint = {
      id: `point-${Date.now()}`,
      name: newPointName || `Point ${statePoints.length + 1}`,
      season: activeSeason as 'summer' | 'winter' | 'both',
      order: statePoints.length,
      ...stateData,
    };
    
    addStatePoint(newPoint);
    setShowAddPoint(false);
    setNewPointName('');
  };
  
  // 状態点の移動（ドラッグ）
  const handlePointMove = (pointId: string, temp: number, humidity: number) => {
    const stateData = StatePointConverter.fromDryBulbAndHumidity(temp, humidity);
    updateStatePoint(pointId, stateData);
  };
  
  // プリセット：夏季外気条件を追加
  const addSummerOutdoor = () => {
    const { outdoor } = designConditions;
    const stateData = StatePointConverter.fromDryBulbAndRH(
      outdoor.summer.dryBulbTemp,
      outdoor.summer.relativeHumidity
    );
    
    addStatePoint({
      id: `point-${Date.now()}`,
      name: '外気(夏)',
      season: 'summer',
      order: statePoints.length,
      ...stateData,
    });
  };
  
  // プリセット：夏季室内条件を追加
  const addSummerIndoor = () => {
    const { indoor } = designConditions;
    const stateData = StatePointConverter.fromDryBulbAndRH(
      indoor.summer.dryBulbTemp,
      indoor.summer.relativeHumidity
    );
    
    addStatePoint({
      id: `point-${Date.now()}`,
      name: '室内(夏)',
      season: 'summer',
      order: statePoints.length,
      ...stateData,
    });
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            空気線図アプリケーション
          </h1>
          <p className="text-gray-600">
            {designConditions.project.name} - {designConditions.project.location}
          </p>
        </div>
        
        <div className="grid grid-cols-12 gap-4">
          {/* 左パネル */}
          <div className="col-span-3 space-y-4">
            {/* 季節切替 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold mb-3">表示モード</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveSeason('summer')}
                  className={`flex-1 py-2 px-3 rounded ${
                    activeSeason === 'summer'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  夏季
                </button>
                <button
                  onClick={() => setActiveSeason('winter')}
                  className={`flex-1 py-2 px-3 rounded ${
                    activeSeason === 'winter'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  冬季
                </button>
                <button
                  onClick={() => setActiveSeason('both')}
                  className={`flex-1 py-2 px-3 rounded ${
                    activeSeason === 'both'
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  両方
                </button>
              </div>
            </div>
            
            {/* 状態点追加 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold mb-3">状態点の追加</h2>
              
              {/* プリセットボタン */}
              <div className="space-y-2 mb-4">
                <button
                  onClick={addSummerOutdoor}
                  className="w-full py-2 px-3 bg-orange-100 hover:bg-orange-200 rounded text-sm"
                >
                  夏季外気条件
                </button>
                <button
                  onClick={addSummerIndoor}
                  className="w-full py-2 px-3 bg-green-100 hover:bg-green-200 rounded text-sm"
                >
                  夏季室内条件
                </button>
              </div>
              
              <button
                onClick={() => setShowAddPoint(!showAddPoint)}
                className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                カスタム追加
              </button>
              
              {showAddPoint && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="名前"
                    value={newPointName}
                    onChange={(e) => setNewPointName(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <input
                    type="number"
                    placeholder="温度 (°C)"
                    value={newPointTemp}
                    onChange={(e) => setNewPointTemp(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <input
                    type="number"
                    placeholder="相対湿度 (%)"
                    value={newPointRH}
                    onChange={(e) => setNewPointRH(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <button
                    onClick={handleAddPoint}
                    className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    追加
                  </button>
                </div>
              )}
            </div>
            
            {/* 状態点リスト */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-bold mb-3">状態点一覧</h2>
              <div className="space-y-2">
                {statePoints.length === 0 ? (
                  <p className="text-gray-500 text-sm">状態点がありません</p>
                ) : (
                  statePoints.map((point) => (
                    <div
                      key={point.id}
                      onClick={() => setSelectedPoint(point.id)}
                      className={`p-2 rounded cursor-pointer ${
                        selectedPointId === point.id
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-semibold text-sm">{point.name}</div>
                      <div className="text-xs text-gray-600">
                        {point.dryBulbTemp?.toFixed(1)}°C, 
                        RH {point.relativeHumidity?.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        x={point.humidity?.toFixed(4)} kg/kg'
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* 中央 - チャート */}
          <div className="col-span-9">
            <div className="bg-white rounded-lg shadow p-4">
              <PsychrometricChart
                width={1000}
                height={700}
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
              <h2 className="font-bold mb-3">設計条件</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h3 className="font-semibold mb-2">外気条件</h3>
                  <p>夏季: {designConditions.outdoor.summer.dryBulbTemp}°C, RH{designConditions.outdoor.summer.relativeHumidity}%</p>
                  <p>冬季: {designConditions.outdoor.winter.dryBulbTemp}°C, RH{designConditions.outdoor.winter.relativeHumidity}%</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">室内条件</h3>
                  <p>夏季: {designConditions.indoor.summer.dryBulbTemp}°C, RH{designConditions.indoor.summer.relativeHumidity}%</p>
                  <p>冬季: {designConditions.indoor.winter.dryBulbTemp}°C, RH{designConditions.indoor.winter.relativeHumidity}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
