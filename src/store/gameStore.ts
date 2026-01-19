import { create } from 'zustand';

interface GameResources {
  gold: number;
  wood: number;
}

interface GameTime {
  year: number;
  season: string;
  progress: number; // 0-100
}

interface WeatherInfo {
  type: 'none' | 'rain' | 'snow';
  intensity: 'light' | 'medium' | 'heavy';
  name: string;
}

interface BuildingInfo {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  category: 'economy' | 'military' | 'magic';
  cost: { gold: number; wood: number };
  description: string;
  icon: string;
}

interface RecruitInfo {
  type: string;
  name: string;
  cost: number;
  icon: string;
}

interface CityInfo {
  id: string;
  name: string;
  type: string;
  isMainCity: boolean;
  isPhysicalVisit: boolean;
  income: { gold: number; wood: number };
  buildings: {
    economy: BuildingInfo[];
    military: BuildingInfo[];
    magic: BuildingInfo[];
  };
  garrison: Record<string, number>;
  recruits: RecruitInfo[];
}

interface EnemyInfo {
  id: string;
  name: string;
  title: string;
}

interface DraftOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'legendary' | 'epic' | 'rare' | 'common';
}

interface SettlementData {
  title: string;
  isVictory: boolean;
  xpGained: number;
  level: number;
  xpProgress: number; // 0-100
  losses: Array<{ name: string; loss: number; icon: string }>;
}

interface GameState {
  resources: GameResources;
  time: GameTime;
  weather: WeatherInfo;
  city: CityInfo;
  startEnemies: EnemyInfo[];
  draftOptions: DraftOption[];
  settlement: SettlementData | null;
  
  // 游戏阶段控制
  currentPhase: 'menu' | 'loading' | 'world' | 'battle';
  setPhase: (phase: 'menu' | 'loading' | 'world' | 'battle') => void;
  
  // Loading 状态
  loading: {
    visible: boolean;
    progress: number;
    text: string;
    tip: string;
  };
  setLoading: (loading: Partial<GameState['loading']>) => void;

  // 游戏控制
  isPaused: boolean;
  timeScale: number;
  setPaused: (paused: boolean) => void;
  setTimeScale: (scale: number) => void;

  updateResources: (resources: GameResources) => void;
  // ... 其他方法保持不变
}

/**
 * 游戏全局状态中心 (Zustand)
 * 职责：作为原生 JS 引擎与 React UI 之间的桥梁
 */
export const useGameStore = create<GameState>((set) => ({
  resources: { gold: 0, wood: 0 },
  time: { year: 1, season: '春', progress: 0 },
  weather: { type: 'none', intensity: 'medium', name: '晴' },
  city: { 
    id: 'main_city_1',
    name: '稻香村', 
    type: 'main_city', 
    isMainCity: true,
    isPhysicalVisit: false,
    income: { gold: 0, wood: 0 },
    buildings: { economy: [], military: [], magic: [] },
    garrison: {},
    recruits: []
  },
  startEnemies: [],
  draftOptions: [],
  settlement: null,

  // Loading 初始状态
  loading: {
    visible: true, // 初始显示
    progress: 0,
    text: '0%',
    tip: '首次访问需要下载游戏资源，请耐心等待'
  },
  setLoading: (loadingData) => set((state) => ({
    loading: { ...state.loading, ...loadingData }
  })),

  // 游戏控制逻辑
  isPaused: false,
  timeScale: 1.0,
  setPaused: (paused) => set({ isPaused: paused }),
  setTimeScale: (scale) => set({ timeScale: scale }),

  updateResources: (resources) => set({ resources }),
  updateTime: (time) => set({ time }),
  updateWeather: (weatherData) => set((state) => ({
    weather: { ...state.weather, ...weatherData }
  })),
  updateCity: (cityData) => set((state) => ({ 
    city: { ...state.city, ...cityData } 
  })),
  setStartEnemies: (enemies) => set({ startEnemies: enemies }),
  setDraftOptions: (options) => set({ draftOptions: options }),
  setSettlement: (data) => set({ settlement: data }),

  currentPhase: 'menu',
  setPhase: (phase) => set({ currentPhase: phase }),
}));
