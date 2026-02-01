import { useAppStore } from '@/store/appStore';

export const DesignConditionsPanel = () => {
  const { designConditions } = useAppStore();
  
  return (
    <div className="space-y-4">
      {/* プロジェクト情報 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">プロジェクト情報</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <label className="text-gray-600">プロジェクト名</label>
            <div className="font-medium">{designConditions.project.name}</div>
          </div>
          <div>
            <label className="text-gray-600">場所</label>
            <div className="font-medium">{designConditions.project.location}</div>
          </div>
        </div>
      </div>
      
      {/* 外気条件 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">外気条件</h4>
        <div className="space-y-2">
          <div>
            <div className="text-xs text-orange-600 font-medium mb-1">夏季</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">温度:</span>{' '}
                <span className="font-medium">{designConditions.outdoor.summer.dryBulbTemp}°C</span>
              </div>
              <div>
                <span className="text-gray-600">RH:</span>{' '}
                <span className="font-medium">{designConditions.outdoor.summer.relativeHumidity}%</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-blue-600 font-medium mb-1">冬季</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">温度:</span>{' '}
                <span className="font-medium">{designConditions.outdoor.winter.dryBulbTemp}°C</span>
              </div>
              <div>
                <span className="text-gray-600">RH:</span>{' '}
                <span className="font-medium">{designConditions.outdoor.winter.relativeHumidity}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 室内条件 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">室内条件</h4>
        <div className="space-y-2">
          <div>
            <div className="text-xs text-orange-600 font-medium mb-1">夏季</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">温度:</span>{' '}
                <span className="font-medium">{designConditions.indoor.summer.dryBulbTemp}°C</span>
              </div>
              <div>
                <span className="text-gray-600">RH:</span>{' '}
                <span className="font-medium">{designConditions.indoor.summer.relativeHumidity}%</span>
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-blue-600 font-medium mb-1">冬季</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">温度:</span>{' '}
                <span className="font-medium">{designConditions.indoor.winter.dryBulbTemp}°C</span>
              </div>
              <div>
                <span className="text-gray-600">RH:</span>{' '}
                <span className="font-medium">{designConditions.indoor.winter.relativeHumidity}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 風量条件 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">風量条件</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">{designConditions.airflow.supplyAirName}:</span>{' '}
            <span className="font-medium">{designConditions.airflow.supplyAir} m³/h</span>
          </div>
          <div>
            <span className="text-gray-600">{designConditions.airflow.outdoorAirName}:</span>{' '}
            <span className="font-medium">{designConditions.airflow.outdoorAir} m³/h</span>
          </div>
          <div>
            <span className="text-gray-600">{designConditions.airflow.returnAirName}:</span>{' '}
            <span className="font-medium">{designConditions.airflow.returnAir} m³/h</span>
          </div>
          <div>
            <span className="text-gray-600">{designConditions.airflow.exhaustAirName}:</span>{' '}
            <span className="font-medium">{designConditions.airflow.exhaustAir} m³/h</span>
          </div>
        </div>
      </div>
    </div>
  );
};
