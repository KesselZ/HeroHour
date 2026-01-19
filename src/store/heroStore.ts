import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface HeroStats {
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  xp: number;
  xpMax: number;
  level: number;
  // 基础潜能
  morale: number;
  leadership: number;
  power: number;
  spells: number;
  haste: number;
  speed: number;
  primaryStatName: string;
  skills: string[]; // 已习得招式的 ID 列表
  army: Record<string, number>;
  currentLeadership: number;
}

interface HeroData {
  id: string;
  name: string;
  title: string;
  stats: HeroStats;
  talentPoints: number;
  hasAvailableTalents: boolean;
  talents: Record<string, number>; // 新增：已激活的奇穴等级映射
}

interface HeroState {
  hero: HeroData;
  updateHero: (data: Partial<HeroData>) => void;
  updateStats: (stats: Partial<HeroStats>) => void;
  updateArmy: (army: Record<string, number>) => void;
}

/**
 * 英雄状态中心 (Zustand)
 * 职责：管理英雄的实时战斗属性和 UI 表现数据
 */
export const useHeroStore = create<HeroState>()(
  subscribeWithSelector((set) => ({
  hero: {
    id: 'liwangsheng',
    name: '李忘生',
    title: '纯阳掌门',
    talentPoints: 0,
    hasAvailableTalents: false,
    talents: {},
    stats: {
      hp: 500,
      hpMax: 500,
      mp: 100,
      mpMax: 100,
      xp: 0,
      xpMax: 120,
      level: 1,
      morale: 0,
      leadership: 0,
      power: 0,
      spells: 0,
      haste: 0,
      speed: 0,
      primaryStatName: '力道',
      skills: [],
      army: {},
      currentLeadership: 0
    }
  },
  updateHero: (data) => set((state) => {
    const nextHero = { ...state.hero, ...data };
    if (data.talentPoints !== undefined) {
      nextHero.hasAvailableTalents = data.talentPoints > 0;
    }
    return { hero: nextHero };
  }),
    updateStats: (stats) => set((state) => ({
    hero: {
      ...state.hero,
      stats: { ...state.hero.stats, ...stats }
    }
  })),
  updateArmy: (army) => set((state) => ({
    hero: {
      ...state.hero,
      stats: { ...state.hero.stats, army: { ...army } }
    }
  }))
})));
