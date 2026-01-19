import { create } from 'zustand';

type PanelType = 'heroStats' | 'townManagement' | 'skillLearn' | 'howToPlay' | 'talent' | 'loadSave' | 'saveGame' | 'worldEventHistory' | 'teleport' | 'gameStart' | 'buildingDraft' | 'pauseMenu' | 'battleSettlement' | 'escapeConfirm' | 'skipBattle' | 'mainMenu' | 'characterSelect' | 'difficultySelect' | null;

interface UIState {
  activePanel: PanelType;
  openPanel: (panel: PanelType) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelType) => void;
}

/**
 * 全局 UI 状态中心 (Zustand)
 * 职责：管理所有全屏/大型面板的显示隐藏，确保面板互斥逻辑（一次只开一个）
 */
export const useUIStore = create<UIState>((set) => ({
  activePanel: null,
  
  openPanel: (panel) => set({ activePanel: panel }),
  
  closePanel: () => set({ activePanel: null }),
  
  togglePanel: (panel) => set((state) => ({ 
    activePanel: state.activePanel === panel ? null : panel 
  })),
}));
