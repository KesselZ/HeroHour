import * as THREE from 'three';

/**
 * 战场单位的精简逻辑状态
 * 用于 React 渲染层订阅
 */
export interface UnitState {
    id: string;
    type: string;
    side: 'player' | 'enemy';
    position: THREE.Vector3;
    rotation: number;
    health: number;
    maxHealth: number;
    shield: number;
    isDead: boolean;
    isAttacking: boolean;
    lastAttackTime: number;
}

/**
 * 战场全局数据
 */
export interface BattleState {
    units: Map<string, UnitState>;
    isActive: boolean;
    isDeployment: boolean;
    winner: 'player' | 'enemy' | null;
}

