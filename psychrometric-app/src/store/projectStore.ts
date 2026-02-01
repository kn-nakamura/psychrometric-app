import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';
import { DesignConditions } from '@/types/designConditions';
import {
  DEFAULT_PSYCHROMETRIC_CONSTANTS,
  resolvePsychrometricConstants,
} from '@/lib/psychrometric/constants';

interface ProjectState {
  // 設計条件
  designConditions: DesignConditions;
  
  // 状態点
  statePoints: StatePoint[];
  
  // プロセス
  processes: Process[];
  
  // 表示モード
  activeSeason: 'summer' | 'winter' | 'both';
  
  // 選択状態
  selectedPointId: string | null;
  selectedProcessId: string | null;
  
  // アクション
  setDesignConditions: (conditions: Partial<DesignConditions>) => void;
  
  // 状態点の操作
  addStatePoint: (point: StatePoint) => void;
  updateStatePoint: (id: string, updates: Partial<StatePoint>) => void;
  deleteStatePoint: (id: string) => void;
  reorderStatePoints: (startIndex: number, endIndex: number) => void;
  
  // プロセスの操作
  addProcess: (process: Process) => void;
  updateProcess: (id: string, updates: Partial<Process>) => void;
  deleteProcess: (id: string) => void;
  reorderProcesses: (startIndex: number, endIndex: number) => void;
  
  // 表示制御
  setActiveSeason: (season: 'summer' | 'winter' | 'both') => void;
  setSelectedPoint: (id: string | null) => void;
  setSelectedProcess: (id: string | null) => void;
  
  // プロジェクト全体
  resetProject: () => void;
  loadProject: (data: Partial<ProjectState>) => void;
}

// 初期設計条件
const initialDesignConditions: DesignConditions = {
  project: {
    name: '新規プロジェクト',
    location: '東京',
    designer: '',
    date: new Date().toISOString().split('T')[0],
  },
  outdoor: {
    summer: {
      dryBulbTemp: 33.2,
      relativeHumidity: 50,
    },
    winter: {
      dryBulbTemp: -3.6,
      relativeHumidity: 54,
    },
    pressure: 101.325,
  },
  indoor: {
    summer: {
      dryBulbTemp: 26,
      relativeHumidity: 50,
    },
    winter: {
      dryBulbTemp: 22,
      relativeHumidity: 40,
    },
  },
  airflow: {
    supplyAir: 1000,
    supplyAirName: '給気量',
    outdoorAir: 300,
    outdoorAirName: '外気量',
    returnAir: 700,
    returnAirName: '還気量',
    exhaustAir: 300,
    exhaustAirName: '排気量',
  },
  equipment: {},
  calculation: {
    constants: { ...DEFAULT_PSYCHROMETRIC_CONSTANTS },
  },
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      // 初期状態
      designConditions: initialDesignConditions,
      statePoints: [],
      processes: [],
      activeSeason: 'summer',
      selectedPointId: null,
      selectedProcessId: null,

      // 設計条件の更新
      setDesignConditions: (conditions) =>
        set((state) => ({
          designConditions: {
            ...state.designConditions,
            ...conditions,
            calculation: conditions.calculation
              ? {
                  ...state.designConditions.calculation,
                  ...conditions.calculation,
                  constants: resolvePsychrometricConstants({
                    ...state.designConditions.calculation.constants,
                    ...conditions.calculation.constants,
                    tetensWater: {
                      ...state.designConditions.calculation.constants.tetensWater,
                      ...conditions.calculation.constants.tetensWater,
                    },
                    tetensIce: {
                      ...state.designConditions.calculation.constants.tetensIce,
                      ...conditions.calculation.constants.tetensIce,
                    },
                  }),
                }
              : state.designConditions.calculation,
          },
        })),

      // 状態点の追加
      addStatePoint: (point) =>
        set((state) => ({
          statePoints: [...state.statePoints, point],
        })),

      // 状態点の更新
      updateStatePoint: (id, updates) =>
        set((state) => ({
          statePoints: state.statePoints.map((point) =>
            point.id === id ? { ...point, ...updates } : point
          ),
        })),

      // 状態点の削除
      deleteStatePoint: (id) =>
        set((state) => ({
          statePoints: state.statePoints.filter((point) => point.id !== id),
          // 関連するプロセスも削除
          processes: state.processes.filter(
            (process) => process.fromPointId !== id && process.toPointId !== id
          ),
          selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
        })),

      // 状態点の順序変更
      reorderStatePoints: (startIndex, endIndex) =>
        set((state) => {
          const points = Array.from(state.statePoints);
          const [removed] = points.splice(startIndex, 1);
          points.splice(endIndex, 0, removed);

          // order を更新
          return {
            statePoints: points.map((point, index) => ({
              ...point,
              order: index,
            })),
          };
        }),

      // プロセスの追加
      addProcess: (process) =>
        set((state) => ({
          processes: [...state.processes, process],
        })),

      // プロセスの更新
      updateProcess: (id, updates) =>
        set((state) => ({
          processes: state.processes.map((process) =>
            process.id === id ? { ...process, ...updates } : process
          ),
        })),

      // プロセスの削除
      deleteProcess: (id) =>
        set((state) => ({
          processes: state.processes.filter((process) => process.id !== id),
          selectedProcessId: state.selectedProcessId === id ? null : state.selectedProcessId,
        })),

      // プロセスの順序変更
      reorderProcesses: (startIndex, endIndex) =>
        set((state) => {
          const processes = Array.from(state.processes);
          const [removed] = processes.splice(startIndex, 1);
          processes.splice(endIndex, 0, removed);

          return {
            processes: processes.map((process, index) => ({
              ...process,
              order: index,
            })),
          };
        }),

      // 表示季節の設定
      setActiveSeason: (season) => set({ activeSeason: season }),

      // 選択状態点の設定
      setSelectedPoint: (id) => set({ selectedPointId: id }),

      // 選択プロセスの設定
      setSelectedProcess: (id) => set({ selectedProcessId: id }),

      // プロジェクトのリセット
      resetProject: () =>
        set({
          designConditions: initialDesignConditions,
          statePoints: [],
          processes: [],
          activeSeason: 'summer',
          selectedPointId: null,
          selectedProcessId: null,
        }),

      // プロジェクトの読み込み
      loadProject: (data) =>
        set((state) => ({
          ...state,
          ...data,
        })),
    }),
    {
      name: 'psychrometric-project-storage',
      // 選択状態はセッション内でのみ有効なので永続化しない
      partialize: (state) => ({
        designConditions: state.designConditions,
        statePoints: state.statePoints,
        processes: state.processes,
        activeSeason: state.activeSeason,
      }),
    }
  )
);
