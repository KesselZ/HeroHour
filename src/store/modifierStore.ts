import { create } from 'zustand';

export interface Modifier {
  id: string;
  side?: string;
  unitType?: string;
  stat: string;
  source?: string;
  targetUnit?: any;
  multiplier: number;
  offset: number;
  startTime?: number;
  duration?: number | null;
  onCleanup?: (() => void) | null;
  // 兼容性字段
  type?: string;
  method?: string;
  value?: number;
}

interface ModifierState {
  modifiers: Modifier[];
  // 核心操作：同步底层引擎的数据
  syncModifiers: (modifiers: Modifier[]) => void;
  // 辅助操作：仅用于 React 内部逻辑（如果有的话）
  addModifier: (mod: Modifier) => void;
  removeModifier: (id: string) => void;
}

/**
 * Modifier 状态中心 (Zustand)
 * 职责：作为 ModifierManager 的响应式镜像，驱动 React UI 的数值实时刷新
 */
export const useModifierStore = create<ModifierState>((set) => ({
  modifiers: [],

  syncModifiers: (modifiers) => set({ 
    // 使用浅拷贝触发 React 响应
    modifiers: [...modifiers] 
  }),

  addModifier: (mod) => set((state) => ({
    modifiers: [...state.modifiers.filter(m => m.id !== mod.id), mod]
  })),

  removeModifier: (id) => set((state) => ({
    modifiers: state.modifiers.filter(m => m.id !== id)
  })),
}));
