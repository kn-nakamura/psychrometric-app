import { create } from 'zustand';
import { StatePoint } from '@/types/psychrometric';
import { Process } from '@/types/process';
import { DesignConditions } from '@/types/designConditions';
import { StatePointConverter } from '@/lib/psychrometric/conversions';

/**
 * アプリケーションの状態
 */
interface AppState {
  // プロジェクト情報
  designConditions: DesignConditions;
  
  // 状態点のリスト
  statePoints: StatePoint[];
  
  // プロセスのリスト
  processes: Process[];
  
  // 現在表示している季節
  currentSeason: 'summer' | 'winter' | 'both';
  
  // 選択中の状態点
  selectedPointId: string | null;
  
  // 選択中のプロセス
  selectedProcessId: string | null;
}

/**
 * アプリケーションのアクション
 */
interface AppActions {
  // 設計条件の更新
  updateDesignConditions: (conditions: Partial<DesignConditions>) => void;
  
  // 状態点の操作
  addStatePoint: (point: Omit<StatePoint, 'id' | 'order'>) => void;
  updateStatePoint: (id: string, updates: Partial<StatePoint>) => void;
  deleteStatePoint: (id: string) => void;
  reorderStatePoints: (startIndex: number, endIndex: number) => void;
  
  // プロセスの操作
  addProcess: (process: Omit<Process, 'id' | 'order'>) => void;
  updateProcess: (id: string, updates: Partial<Process>) => void;
  deleteProcess: (id: string) => void;
  reorderProcesses: (startIndex: number, endIndex: number) => void;
  
  // 表示設定
  setCurrentSeason: (season: 'summer' | 'winter' | 'both') => void;
  setSelectedPoint: (id: string | null) => void;
  setSelectedProcess: (id: string | null) => void;
  
  // ユーティリティ
  getStatePointById: (id: string) => StatePoint | undefined;
  getProcessById: (id: string) => Process | undefined;
}

type AppStore = AppState & AppActions;

/**
 * 初期設計条件
 */
const initialDesignConditions: DesignConditions = {
  project: {
    name: '新規プロジェクト',
    location: '東京',
    designer: '',
    date: new Date().toISOString().split('T')[0],
  },
  outdoor: {
    summer: {
      dryBulbTemp: 35,
      relativeHumidity: 40,
    },
    winter: {
      dryBulbTemp: 5,
      relativeHumidity: 50,
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
};

/**
 * Zustandストアの作成
 */
export const useAppStore = create<AppStore>((set, get) => ({
  // 初期状態
  designConditions: initialDesignConditions,
  statePoints: [],
  processes: [],
  currentSeason: 'summer',
  selectedPointId: null,
  selectedProcessId: null,
  
  // 設計条件の更新
  updateDesignConditions: (conditions) => {
    set((state) => ({
      designConditions: {
        ...state.designConditions,
        ...conditions,
        project: { ...state.designConditions.project, ...conditions.project },
        outdoor: { ...state.designConditions.outdoor, ...conditions.outdoor },
        indoor: { ...state.designConditions.indoor, ...conditions.indoor },
        airflow: { ...state.designConditions.airflow, ...conditions.airflow },
        equipment: { ...state.designConditions.equipment, ...conditions.equipment },
      },
    }));
  },
  
  // 状態点の追加
  addStatePoint: (point) => {
    set((state) => {
      const maxOrder = state.statePoints.reduce(
        (max, p) => Math.max(max, p.order),
        0
      );
      
      // 状態点を完全な形に変換
      const completed = StatePointConverter.completeStatePoint(point);
      
      const newPoint: StatePoint = {
        ...point,
        ...completed,
        id: `point_${Date.now()}`,
        order: maxOrder + 1,
      };
      
      return {
        statePoints: [...state.statePoints, newPoint],
      };
    });
  },
  
  // 状態点の更新
  updateStatePoint: (id, updates) => {
    set((state) => ({
      statePoints: state.statePoints.map((point) =>
        point.id === id
          ? {
              ...point,
              ...updates,
              ...StatePointConverter.completeStatePoint({
                ...point,
                ...updates,
              }),
            }
          : point
      ),
    }));
  },
  
  // 状態点の削除
  deleteStatePoint: (id) => {
    set((state) => ({
      statePoints: state.statePoints.filter((p) => p.id !== id),
      // 関連するプロセスも削除
      processes: state.processes.filter(
        (proc) => proc.fromPointId !== id && proc.toPointId !== id
      ),
      selectedPointId: state.selectedPointId === id ? null : state.selectedPointId,
    }));
  },
  
  // 状態点の並び替え
  reorderStatePoints: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.statePoints);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // order を振り直す
      return {
        statePoints: result.map((point, index) => ({
          ...point,
          order: index + 1,
        })),
      };
    });
  },
  
  // プロセスの追加
  addProcess: (process) => {
    set((state) => {
      const maxOrder = state.processes.reduce(
        (max, p) => Math.max(max, p.order),
        0
      );
      
      const newProcess: Process = {
        ...process,
        id: `process_${Date.now()}`,
        order: maxOrder + 1,
      };
      
      return {
        processes: [...state.processes, newProcess],
      };
    });
  },
  
  // プロセスの更新
  updateProcess: (id, updates) => {
    set((state) => ({
      processes: state.processes.map((process) =>
        process.id === id ? { ...process, ...updates } : process
      ),
    }));
  },
  
  // プロセスの削除
  deleteProcess: (id) => {
    set((state) => ({
      processes: state.processes.filter((p) => p.id !== id),
      selectedProcessId: state.selectedProcessId === id ? null : state.selectedProcessId,
    }));
  },
  
  // プロセスの並び替え
  reorderProcesses: (startIndex, endIndex) => {
    set((state) => {
      const result = Array.from(state.processes);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      
      // order を振り直す
      return {
        processes: result.map((process, index) => ({
          ...process,
          order: index + 1,
        })),
      };
    });
  },
  
  // 表示季節の設定
  setCurrentSeason: (season) => {
    set({ currentSeason: season });
  },
  
  // 選択中の状態点を設定
  setSelectedPoint: (id) => {
    set({ selectedPointId: id });
  },
  
  // 選択中のプロセスを設定
  setSelectedProcess: (id) => {
    set({ selectedProcessId: id });
  },
  
  // IDから状態点を取得
  getStatePointById: (id) => {
    return get().statePoints.find((p) => p.id === id);
  },
  
  // IDからプロセスを取得
  getProcessById: (id) => {
    return get().processes.find((p) => p.id === id);
  },
}));
