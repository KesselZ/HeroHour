import { create } from 'zustand';

type PanelType = 'heroStats' | 'townManagement' | 'skillLearn' | 'howToPlay' | 'talent' | 'loadSave' | 'saveGame' | 'worldEventHistory' | 'teleport' | 'gameStart' | 'buildingDraft' | 'pauseMenu' | 'battleSettlement' | 'escapeConfirm' | 'skipBattle' | 'mainMenu' | 'characterSelect' | 'difficultySelect' | null;

interface UIState {
  activePanel: PanelType;
  openPanel: (panel: PanelType) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelType) => void;
  
  // Tooltip 状态
  tooltip: {
    visible: boolean;
    data: any;
    x: number;
    y: number;
  };
  showTooltip: (data: any, x: number, y: number) => void;
  hideTooltip: () => void;

  // Notification 状态
  notifications: Array<{ id: string; text: string }>;
  addNotification: (text: string) => void;
  removeNotification: (id: string) => void;

  // Action Hint 状态 (跟随鼠标的操作提示)
  actionHint: {
    visible: boolean;
    text: string;
    x: number;
    y: number;
  };
  showActionHint: (text: string, x?: number, y?: number) => void;
  hideActionHint: () => void;
  updateActionHintPos: (x: number, y: number) => void;

  // Floating Text 状态
  floatingTexts: Array<{ id: string; text: string; x: number; y: number; color: string }>;
  addFloatingText: (text: string, x: number, y: number, color: string) => void;

  // Performance 状态 (仅开发模式有用)
  perfData: {
    fps: number;
    drawCalls: number;
    triangles: number;
    totalUnits?: number;
    activeVFX?: number;
    logicTime?: number;
    renderTime?: number;
  };
  updatePerfData: (data: Partial<UIState['perfData']>) => void;
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

  // Tooltip 逻辑
  tooltip: {
    visible: false,
    data: null,
    x: 0,
    y: 0
  },

  showTooltip: (data, x, y) => set({ 
    tooltip: { visible: true, data, x, y } 
  }),

  hideTooltip: () => set((state) => ({ 
    tooltip: { ...state.tooltip, visible: false } 
  })),

  // Notification 逻辑
  notifications: [],
  addNotification: (text) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { id, text }]
    }));
    
    // 3秒后自动移除
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
      }));
    }, 3000);
  },
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  // Action Hint 逻辑
  actionHint: {
    visible: false,
    text: '',
    x: 0,
    y: 0
  },
  showActionHint: (text, x, y) => set((state) => ({
    actionHint: { 
      visible: true, 
      text, 
      x: x !== undefined ? x : state.actionHint.x, 
      y: y !== undefined ? y : state.actionHint.y 
    }
  })),
  hideActionHint: () => set((state) => ({
    actionHint: { ...state.actionHint, visible: false }
  })),
  updateActionHintPos: (x, y) => set((state) => ({
    actionHint: { ...state.actionHint, x, y }
  })),

  // Floating Text 逻辑
  floatingTexts: [],
  addFloatingText: (text, x, y, color) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      floatingTexts: [...state.floatingTexts, { id, text, x, y, color }]
    }));
    
    setTimeout(() => {
      set((state) => ({
        floatingTexts: state.floatingTexts.filter(t => t.id !== id)
      }));
    }, 1500);
  },

  // Performance 逻辑
  perfData: {
    fps: 0,
    drawCalls: 0,
    triangles: 0
  },
  updatePerfData: (data) => set((state) => ({
    perfData: { ...state.perfData, ...data }
  })),
}));
