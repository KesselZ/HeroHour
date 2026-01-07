import { worldManager } from './WorldManager.js';
import { mapGenerator } from './MapGenerator.js';

/**
 * AIController: 极简高性能敌方英雄大脑
 */
export class AIController {
    constructor(owner) {
        this.owner = owner;
        this.factionId = owner.factionId;
        
        this.state = 'WANDER';
        
        // 性能核心：决策计时器
        this.decisionTimer = Math.random(); // 随机偏移，避免多个 AI 在同一帧同时思考
        this.DECISION_INTERVAL = 1.0; // 每 1 秒思考一次
        
        this.memory = {
            targetPos: null,
            targetEntityId: null
        };
    }

    update(deltaTime) {
        // 全局开关检查
        if (worldManager.constructor.DEBUG.DISABLE_AI) return;
        if (!this.owner || !this.owner.mesh) return;

        // 1. 处理决策计时器
        this.decisionTimer -= deltaTime;
        if (this.decisionTimer <= 0) {
            this._makeDecision();
            this.decisionTimer = this.DECISION_INTERVAL;
        }

        // 2. 状态执行 (仅处理简单的逻辑同步，不涉及重计算)
        this._executeState(deltaTime);
    }

    /**
     * 核心决策逻辑：每秒执行一次
     * 优先级：生存 > 攻城 > 狩猎 > 发育 > 游走
     */
    _makeDecision() {
        // 模拟感知：获取场景中的玩家（这部分开销很低，只是读取位置）
        // 注意：这里实际运行中需要从 worldScene 获取，目前先做占位逻辑
        const playerPos = worldManager.mapState.playerPos; 

        // --- 优先级 1：生存 (逃跑) ---
        if (this._isUnderThreat(playerPos)) {
            this._switchState('FLEE');
            return;
        }

        // --- 优先级 2：攻城 (待实现) ---
        // if (this._canSiege()) { this._switchState('SIEGE'); return; }

        // --- 优先级 3：狩猎 (待实现) ---
        // if (this._canHunt()) { this._switchState('HUNT'); return; }

        // --- 优先级 4：占领资源 ---
        const nearbyResource = this._scanNearbyInterests();
        if (nearbyResource) {
            this._switchState('SEEK_RESOURCE', nearbyResource);
            return;
        }

        // --- 优先级 5：保底游走 ---
        if (this.state !== 'WANDER' || (!this.owner.isMoving && this.owner.currentPath.length === 0)) {
            this._switchState('WANDER');
        }
    }

    _executeState(deltaTime) {
        // 目前大部分移动逻辑已经由 MovableWorldObject 处理
        // 大脑只需要在目标丢失或到达时做微调
    }

    _switchState(newState, targetData = null) {
        if (this.state === newState && newState !== 'WANDER') return;
        
        this.state = newState;
        
        switch (newState) {
            case 'FLEE':
                this._startFlee();
                break;
            case 'SEEK_RESOURCE':
                this._startSeek(targetData);
                break;
            case 'WANDER':
                this._startWander();
                break;
        }
    }

    // --- 内部行为实现 ---

    _isUnderThreat(playerPos) {
        if (!playerPos) return false;
        const dist = Math.sqrt(Math.pow(this.owner.x - playerPos.x, 2) + Math.pow(this.owner.z - playerPos.z, 2));
        return dist < 8; // 8米内感受到威胁
    }

    _scanNearbyInterests() {
        // 这里的开销取决于实体数量，目前先返回空以保持极简
        return null; 
    }

    _startWander() {
        if (this.owner.isMoving) return;
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 10;
        const tx = this.owner.x + Math.cos(angle) * dist;
        const tz = this.owner.z + Math.sin(angle) * dist;
        if (mapGenerator.isPassable(tx, tz)) {
            this.owner.moveTo(tx, tz);
        }
    }

    _startFlee() {
        // 往反方向跑
        const playerPos = worldManager.mapState.playerPos;
        const angle = Math.atan2(this.owner.z - playerPos.z, this.owner.x - playerPos.x);
        const tx = this.owner.x + Math.cos(angle) * 15;
        const tz = this.owner.z + Math.sin(angle) * 15;
        if (mapGenerator.isPassable(tx, tz)) {
            this.owner.moveTo(tx, tz);
        }
    }

    _startSeek(resource) {
        if (resource) this.owner.moveTo(resource.x, resource.z);
    }
}
