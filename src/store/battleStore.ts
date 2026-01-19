import { create } from 'zustand';

interface BattleUnit {
  type: string;
  count: number;
  deployed: number;
  icon: string;
}

interface BattleSkill {
  id: string;
  name: string;
  icon: string;
  cost: number;
  cooldown: number;
  remainingCD: number;
  category: string;
  description: string;
  isReady: boolean;
}

interface BattleState {
  isActive: boolean;
  isDeployment: boolean;
  mp: number;
  maxMp: number;
  units: Record<string, BattleUnit>;
  skills: BattleSkill[];
  selectedUnitType: string | null;
  activeSkillId: string | null;
  
  // Actions
  setBattleActive: (active: boolean) => void;
  setDeploymentPhase: (isDeployment: boolean) => void;
  updateMp: (mp: number, maxMp: number) => void;
  setUnits: (units: Record<string, BattleUnit>) => void;
  updateUnitDeployed: (type: string, deployed: number) => void;
  setSkills: (skills: BattleSkill[]) => void;
  updateSkillCD: (skillId: string, remainingCD: number, isReady: boolean) => void;
  setSelectedUnitType: (type: string | null) => void;
  setActiveSkillId: (skillId: string | null) => void;
}

export const useBattleStore = create<BattleState>((set) => ({
  isActive: false,
  isDeployment: true,
  mp: 0,
  maxMp: 0,
  units: {},
  skills: [],
  selectedUnitType: null,
  activeSkillId: null,

  setBattleActive: (active) => set({ isActive: active }),
  setDeploymentPhase: (isDeployment) => set({ isDeployment }),
  updateMp: (mp, maxMp) => set({ mp, maxMp }),
  setUnits: (units) => set({ units }),
  updateUnitDeployed: (type, deployed) => set((state) => ({
    units: {
      ...state.units,
      [type]: { ...state.units[type], deployed }
    }
  })),
  setSkills: (skills) => set({ skills }),
  updateSkillCD: (skillId, remainingCD, isReady) => set((state) => ({
    skills: state.skills.map(s => 
      s.id === skillId ? { ...s, remainingCD, isReady } : s
    )
  })),
  setSelectedUnitType: (type) => set({ selectedUnitType: type }),
  setActiveSkillId: (skillId) => set({ activeSkillId: skillId }),
}));
