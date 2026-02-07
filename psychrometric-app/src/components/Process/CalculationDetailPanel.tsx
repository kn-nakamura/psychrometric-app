import React, { useMemo } from 'react';
import { Process } from '@/types/process';
import { StatePoint } from '@/types/psychrometric';
import { CoilCapacityCalculator } from '@/lib/equipment/coilCapacity';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { ChevronDown } from 'lucide-react';

interface CalculationDetailPanelProps {
  process: Process;
  fromPoint: StatePoint | undefined;
  toPoint: StatePoint | undefined;
}

export const CalculationDetailPanel: React.FC<CalculationDetailPanelProps> = ({
  process,
  fromPoint,
  toPoint,
}) => {
  const [expanded, setExpanded] = React.useState(true);

  const calculationDetails = useMemo(() => {
    if (!fromPoint || !toPoint) return null;

    const fromTemp = fromPoint.dryBulbTemp ?? 0;
    const fromRH = fromPoint.relativeHumidity ?? 0;
    const toTemp = toPoint.dryBulbTemp ?? 0;
    const toRH = toPoint.relativeHumidity ?? 0;

    const details: any = {
      type: process.type,
      fromPoint: {
        name: fromPoint.name,
        temp: fromTemp.toFixed(2),
        rh: fromRH.toFixed(2),
        humidity: fromPoint.humidity?.toFixed(6),
        enthalpy: fromPoint.enthalpy?.toFixed(2),
      },
      toPoint: {
        name: toPoint.name,
        temp: toTemp.toFixed(2),
        rh: toRH.toFixed(2),
        humidity: toPoint.humidity?.toFixed(6),
        enthalpy: toPoint.enthalpy?.toFixed(2),
      },
    };

    // 計算結果を取得
    if (fromPoint.airflow && toPoint.airflow) {
      const capacity = CoilCapacityCalculator.calculate(fromPoint, toPoint, fromPoint.airflow);
      details.capacity = capacity;
    }

    return details;
  }, [fromPoint, toPoint, process.type]);

  if (!calculationDetails) {
    return (
      <div className="p-4 text-sm text-gray-500">
        計算詳細を表示するには、状態点が必要です
      </div>
    );
  }

  const renderCalculationFormula = () => {
    switch (process.type) {
      case 'heating':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">加熱プロセス</h4>
            <p className="text-xs text-gray-600">定絶対湿度での加熱</p>
            <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
              <div>
                <span className="font-mono">x = {calculationDetails.fromPoint.humidity}</span>
                <span className="text-gray-500 ml-2">(一定)</span>
              </div>
              <InlineMath math={`\\Delta T = ${calculationDetails.toPoint.temp} - ${calculationDetails.fromPoint.temp} = ${(parseFloat(calculationDetails.toPoint.temp) - parseFloat(calculationDetails.fromPoint.temp)).toFixed(2)}°C`} />
              <BlockMath math={`Q = \\dot{m} \\cdot c_p \\cdot \\Delta T`} />
            </div>
          </div>
        );

      case 'cooling':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">冷却プロセス</h4>
            <p className="text-xs text-gray-600">等焓線に沿った冷却</p>
            <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
              <InlineMath math={`h = ${calculationDetails.fromPoint.enthalpy}`} />
              <span className="text-gray-500">(一定のエンタルピー)</span>
              {calculationDetails.capacity && (
                <>
                  <BlockMath math={`Q_t = \\dot{m} \\cdot (h_2 - h_1)`} />
                  <div>
                    <span className="font-mono">
                      Q_t = {calculationDetails.capacity.totalCapacity?.toFixed(2)} kW
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 'humidifying':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">加湿プロセス</h4>
            <p className="text-xs text-gray-600">絶対湿度の増加</p>
            <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
              <InlineMath math={`\\Delta x = ${calculationDetails.toPoint.humidity} - ${calculationDetails.fromPoint.humidity}`} />
              <BlockMath math={`\\dot{m}_{water} = \\dot{m}_{air} \\cdot \\Delta x`} />
            </div>
          </div>
        );

      case 'mixing':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">混合プロセス</h4>
            <p className="text-xs text-gray-600">複数の空気流を混合</p>
            <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
              <BlockMath math={`\\dot{m}_{total} = \\dot{m}_1 + \\dot{m}_2 + ...`} />
              <BlockMath math={`T_{mixed} = \\frac{\\sum \\dot{m}_i T_i}{\\dot{m}_{total}}`} />
              <BlockMath math={`x_{mixed} = \\frac{\\sum \\dot{m}_i x_i}{\\dot{m}_{total}}`} />
            </div>
          </div>
        );

      case 'heatExchange':
        return (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">全熱交換</h4>
            <p className="text-xs text-gray-600">エネルギー回収</p>
            <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
              <BlockMath math={`\\eta = \\frac{T_{in} - T_{out}}{T_{in} - T_{ref}}`} />
              <p className="text-gray-600 mt-2">
                全熱交換効率: {process.parameters?.heatExchangeEfficiency ? `${process.parameters.heatExchangeEfficiency.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-xs text-gray-500">
            {process.type} プロセスの計算詳細
          </div>
        );
    }
  };

  return (
    <div className="border rounded-lg bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 border-b"
      >
        <h3 className="font-semibold text-sm">計算プロセス</h3>
        <ChevronDown
          size={16}
          className={`transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      {expanded && (
        <div className="p-4 space-y-4 text-sm max-h-96 overflow-y-auto">
          {/* 状態点情報 */}
          <div className="grid grid-cols-2 gap-2 text-xs border-b pb-3">
            <div>
              <p className="font-semibold text-gray-700">入口: {calculationDetails.fromPoint.name}</p>
              <div className="text-gray-600 space-y-1 mt-1">
                <div>T: {calculationDetails.fromPoint.temp}°C</div>
                <div>RH: {calculationDetails.fromPoint.rh}%</div>
                <div>x: {calculationDetails.fromPoint.humidity} kg/kg'</div>
                <div>h: {calculationDetails.fromPoint.enthalpy} kJ/kg'</div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-700">出口: {calculationDetails.toPoint.name}</p>
              <div className="text-gray-600 space-y-1 mt-1">
                <div>T: {calculationDetails.toPoint.temp}°C</div>
                <div>RH: {calculationDetails.toPoint.rh}%</div>
                <div>x: {calculationDetails.toPoint.humidity} kg/kg'</div>
                <div>h: {calculationDetails.toPoint.enthalpy} kJ/kg'</div>
              </div>
            </div>
          </div>

          {/* 計算式 */}
          <div className="border-b pb-3">
            {renderCalculationFormula()}
          </div>

          {/* 計算結果 */}
          {calculationDetails.capacity && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">計算結果</h4>
              <div className="bg-blue-50 p-3 rounded text-xs space-y-1 border border-blue-200">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-600">全熱量:</span>
                    <span className="font-mono ml-2 text-blue-700">
                      {calculationDetails.capacity.totalCapacity?.toFixed(2)} kW
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">顕熱量:</span>
                    <span className="font-mono ml-2 text-blue-700">
                      {calculationDetails.capacity.sensibleCapacity?.toFixed(2)} kW
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">潜熱量:</span>
                    <span className="font-mono ml-2 text-blue-700">
                      {calculationDetails.capacity.latentCapacity?.toFixed(2)} kW
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">SHF:</span>
                    <span className="font-mono ml-2 text-blue-700">
                      {(calculationDetails.capacity.SHF ?? 0).toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
