import { useAppStore } from '@/store/appStore';

export const EquipmentSummary = () => {
  const { designConditions } = useAppStore();
  const { equipment } = designConditions;
  
  const hasEquipment = Object.keys(equipment).length > 0;
  
  if (!hasEquipment) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        機器情報がありません
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* 全熱交換器 */}
      {equipment.heatExchanger && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-semibold text-gray-900 mb-2">全熱交換器</h5>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">型式:</span>
              <span className="font-medium">{equipment.heatExchanger.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">全熱交換効率:</span>
              <span className="font-medium">{equipment.heatExchanger.efficiency}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 加熱コイル */}
      {equipment.heatingCoil && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-semibold text-gray-900 mb-2">加熱コイル</h5>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">方式:</span>
              <span className="font-medium">{equipment.heatingCoil.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">能力:</span>
              <span className="font-medium">{equipment.heatingCoil.capacity} kW</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 冷却コイル */}
      {equipment.coolingCoil && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-semibold text-gray-900 mb-2">冷却コイル</h5>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">方式:</span>
              <span className="font-medium">{equipment.coolingCoil.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">能力:</span>
              <span className="font-medium">{equipment.coolingCoil.capacity} kW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SHF:</span>
              <span className="font-medium">{equipment.coolingCoil.SHF}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* 加湿器 */}
      {equipment.humidifier && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-semibold text-gray-900 mb-2">加湿器</h5>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">方式:</span>
              <span className="font-medium">{equipment.humidifier.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">能力:</span>
              <span className="font-medium">{equipment.humidifier.capacity} kg/h</span>
            </div>
          </div>
        </div>
      )}
      
      {/* ファン */}
      {equipment.fan && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <h5 className="text-sm font-semibold text-gray-900 mb-2">ファン</h5>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">型式:</span>
              <span className="font-medium">{equipment.fan.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">動力:</span>
              <span className="font-medium">{equipment.fan.power} kW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">静圧:</span>
              <span className="font-medium">{equipment.fan.staticPressure} Pa</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
