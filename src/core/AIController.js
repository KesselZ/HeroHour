import { worldManager } from './WorldManager.js';
import { mapGenerator } from './MapGenerator.js';
import { timeManager } from './TimeManager.js';

/**
 * AIController: 具备领地扩张意识的高性能大脑
 */
export class AIController {
    constructor(owner) {
        this.owner = owner;
        this.factionId = owner.factionId;
        
        this.state = 'WANDER';
        this.decisionTimer = Math.random(); 
        this.DECISION_INTERVAL = 1.0; 
        
        // 核心：寻找据点位置
        this.homePos = this._findHomePos();
        
        // 领地参数
        this.baseRadius = 50; 
        this.growthRate = 10; // 每个季度领地扩张 10 米
        
        this.memory = {
            targetEntityId: null
        };
    }

    /**
     * 获取当前领地半径 (随季度增长)
     */
    _getCurrentTerritoryRadius() {
        // 使用 TimeManager 的全局季度进度
        const seasonsPassed = timeManager.getGlobalProgress();
        return this.baseRadius + seasonsPassed * this.growthRate;
    }

    _findHomePos() {
        const faction = worldManager.factions[this.factionId];
        if (faction && faction.cities && faction.cities.length > 0) {
            const city = worldManager.cities[faction.cities[0]];
            if (city) return { x: city.x, z: city.z };
        }
        return { x: this.owner.x, z: this.owner.z }; // 兜底：以出生点为准
    }

    update(deltaTime) {
        if (worldManager.constructor.DEBUG.DISABLE_AI) return;
        if (!this.owner || !this.owner.mesh) return;

        this.decisionTimer -= deltaTime;
        if (this.decisionTimer <= 0) {
            this._makeDecision();
            this.decisionTimer = this.DECISION_INTERVAL;
        }

        this._executeState(deltaTime);
    }

    _makeDecision() {
        const playerPos = worldManager.mapState.playerPos; 

        // 优先级 1：生存
        if (this._isUnderThreat(playerPos)) {
            this._switchState('FLEE');
            return;
        }

        // 优先级 2：领地内资源采集
        const nearbyResource = this._scanNearbyInterests();
        if (nearbyResource) {
            this._switchState('SEEK_RESOURCE', nearbyResource);
            return;
        }

        // 优先级 3：保底游走 (仅在领地内游走)
        if (this.state !== 'WANDER' || (!this.owner.isMoving && this.owner.currentPath.length === 0)) {
            this._switchState('WANDER');
        }
    }

    _scanNearbyInterests() {
        const entities = worldManager.mapState.entities;
        const currentRadius = this._getCurrentTerritoryRadius();
        let bestTarget = null;
        let minDistToHero = Infinity;

        for (const entity of entities) {
            if (entity.isRemoved) continue;

            // 核心逻辑：资源是否在【据点领地】范围内？
            const distToHome = Math.sqrt(Math.pow(entity.x - this.homePos.x, 2) + Math.pow(entity.z - this.homePos.z, 2));
            if (distToHome > currentRadius) continue;

            // 识别感兴趣的类型
            const isResource = entity.type === 'pickup' || entity.type === 'captured_building';
            if (!isResource) continue;

            // 检查所有权 (矿产类)
            if (entity.type === 'captured_building' && entity.owner === this.factionId) continue;

            // 在符合领地条件的资源中，找离【英雄】最近的
            const distToHero = this._getDistTo(entity.x, entity.z);
            if (distToHero < minDistToHero) {
                minDistToHero = distToHero;
                bestTarget = entity;
            }
        }
        return bestTarget;
    }

    _executeState(deltaTime) {
        if (this.state === 'SEEK_RESOURCE' && this.memory.targetEntityId) {
            // 获取实体的 Object 实例（如果它还在场景中的话）
            const targetId = this.memory.targetEntityId;
            const worldScene = this.owner.worldScene || window.worldScene; // 确保能拿到场景引用
            
            // 找到对应的 WorldObject 实例
            const targetObj = worldScene?.worldObjects?.get(targetId);
            
            if (targetObj && !targetObj.isRemoved) {
                if (this._getDistTo(targetObj.x, targetObj.z) < 1.5) {
                    // 【核心统一】：让 AI 也调用物体的 onInteract
                    targetObj.onInteract(worldScene, this.factionId);
                    this._switchState('IDLE');
                }
            } else {
                this._switchState('WANDER');
            }
        }
    }

    _switchState(newState, targetData = null) {
        if (this.state === newState && newState !== 'WANDER') return;
        this.state = newState;
        
        switch (newState) {
            case 'FLEE':
                this.memory.targetEntityId = null;
                this._startFlee();
                break;
            case 'SEEK_RESOURCE':
                this.memory.targetEntityId = targetData.id;
                this.owner.moveTo(targetData.x, targetData.z);
                break;
            case 'WANDER':
                this.memory.targetEntityId = null;
                this._startWander();
                break;
            case 'IDLE':
                this.memory.targetEntityId = null;
                this.owner.currentPath = [];
                break;
        }
    }

    _isUnderThreat(playerPos) {
        return playerPos ? this._getDistTo(playerPos.x, playerPos.z) < 8 : false;
    }

    _startWander() {
        if (this.owner.isMoving) return;
        const currentRadius = this._getCurrentTerritoryRadius();
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 10;
        
        let tx = this.owner.x + Math.cos(angle) * dist;
        let tz = this.owner.z + Math.sin(angle) * dist;

        // 游走限制：不能走出领地
        const distToHome = Math.sqrt(Math.pow(tx - this.homePos.x, 2) + Math.pow(tz - this.homePos.z, 2));
        if (distToHome > currentRadius) {
            // 如果出界了，往家中心走
            const backAngle = Math.atan2(this.homePos.z - this.owner.z, this.homePos.x - this.owner.x);
            tx = this.owner.x + Math.cos(backAngle) * 8;
            tz = this.owner.z + Math.sin(backAngle) * 8;
        }

        if (mapGenerator.isPassable(tx, tz)) {
            this.owner.moveTo(tx, tz);
        }
    }

    _startFlee() {
        const playerPos = worldManager.mapState.playerPos;
        const angle = Math.atan2(this.owner.z - playerPos.z, this.owner.x - playerPos.x);
        const tx = this.owner.x + Math.cos(angle) * 15;
        const tz = this.owner.z + Math.sin(angle) * 15;
        if (mapGenerator.isPassable(tx, tz)) {
            this.owner.moveTo(tx, tz);
        }
    }

    _getDistTo(tx, tz) {
        return Math.sqrt(Math.pow(this.owner.x - tx, 2) + Math.pow(this.owner.z - tz, 2));
    }
}
