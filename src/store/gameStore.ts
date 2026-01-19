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
  updateResources: (resources: GameResources) => void;
  updateTime: (time: GameTime) => void;
  updateWeather: (weather: Partial<WeatherInfo>) => void;
  updateCity: (city: Partial<CityInfo>) => void;
  setStartEnemies: (enemies: EnemyInfo[]) => void;
  setDraftOptions: (options: DraftOption[]) => void;
  setSettlement: (data: SettlementData | null) => void;
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
}));
