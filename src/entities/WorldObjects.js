import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { worldManager } from '../core/WorldManager.js';

/**
 * 大世界物体的基类
 */
export class WorldObject {
    constructor(data) {
        this.id = data.id;
        this.type = data.type;
        this.x = data.x;
        this.z = data.z;
        this.config = data.config || {};
        
        this.mesh = null;
        this.isInteractable = false;
        this.interactionRadius = 1.0;
    }

    /**
     * 创建视觉对象并添加到场景
     */
    spawn(scene) {
        this.mesh = this.createMesh();
        if (this.mesh) {
            this.mesh.position.set(this.x, this.getElevation(), this.z);
            scene.add(this.mesh);
        }
    }

    createMesh() {
        // 子类实现具体创建逻辑，默认创建一个占位符或根据 type 创建
        return null;
    }

    getElevation() {
        return 0.8; // 默认悬浮高度
    }

    /**
     * 每帧更新（如果需要）
     */
    update(deltaTime, playerPos) {
        // 子类可以实现逻辑
    }

    /**
     * 交互触发时的逻辑
     * @param {WorldScene} worldScene 传入场景实例以便调用其方法
     */
    onInteract(worldScene) {
        // 子类实现
    }

    /**
     * 检查是否可以交互
     */
    canInteract(playerPos) {
        if (!this.isInteractable || !this.mesh) return false;
        const dist = playerPos.distanceTo(this.mesh.position);
        return dist < this.interactionRadius;
    }

    removeFromScene(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
        }
    }
}

/**
 * 装饰性物体（不可交互，如树木、草丛）
 */
export class DecorationObject extends WorldObject {
    constructor(data) {
        super(data);
        this.spriteKey = data.spriteKey;
        this.isInteractable = false;
    }

    createMesh() {
        return spriteFactory.createUnitSprite(this.spriteKey);
    }
}

/**
 * 可捡起物体（如金币、木材）
 */
export class PickupObject extends WorldObject {
    constructor(data) {
        super(data);
        this.pickupType = data.pickupType;
        this.isInteractable = true;
        this.interactionRadius = 1.2;
    }

    createMesh() {
        return spriteFactory.createUnitSprite(this.pickupType);
    }

    onInteract(worldScene) {
        worldManager.handlePickup(this.pickupType);
        worldManager.removeEntity(this.id);
        this.removeFromScene(worldScene.scene);
        return true; // 表示已移除
    }
}

/**
 * 敌人组物体
 */
export class EnemyGroupObject extends WorldObject {
    constructor(data) {
        super(data);
        this.templateId = data.templateId;
        this.isInteractable = true;
        this.interactionRadius = 1.5;
    }

    createMesh() {
        const template = worldManager.enemyTemplates[this.templateId || 'bandits'];
        const icon = template ? template.overworldIcon : 'bandit';
        return spriteFactory.createUnitSprite(icon);
    }

    onInteract(worldScene) {
        worldManager.mapState.pendingBattleEnemyId = this.id;
        window.dispatchEvent(new CustomEvent('start-battle', { detail: this.config }));
        worldScene.stop();
        return false; // 不直接移除，战斗结束后再处理
    }
}

/**
 * 城市/城镇物体
 */
export class CityObject extends WorldObject {
    constructor(data) {
        super(data);
        this.isInteractable = true;
        this.interactionRadius = 3.0;
    }

    createMesh() {
        const city = spriteFactory.createUnitSprite('main_city');
        city.center.set(0.5, 0); // 城市底部对齐
        return city;
    }

    getElevation() {
        return 0; // 城市贴地
    }

    onInteract(worldScene) {
        if (worldScene.activeCityId !== this.id) {
            worldScene.openTownManagement(this.id);
            worldScene.activeCityId = this.id;
        }
        return false;
    }

    onExitRange(worldScene) {
        if (worldScene.activeCityId === this.id) {
            worldScene.closeTownManagement();
        }
    }
}

/**
 * 占领建筑（如金矿、锯木厂）
 */
export class CapturedBuildingObject extends WorldObject {
    constructor(data) {
        super(data);
        this.spriteKey = data.spriteKey;
        this.buildingType = data.buildingType;
        this.isInteractable = true;
        this.interactionRadius = 2.0;
    }

    createMesh() {
        return spriteFactory.createUnitSprite(this.spriteKey);
    }

    getElevation() {
        return 1.2;
    }

    onInteract(worldScene) {
        worldManager.handleCapture({
            id: this.id,
            type: 'captured_building',
            config: this.config,
            mesh: this.mesh
        });
        return false;
    }
}

/**
 * 工厂函数：根据数据类型创建对应的物体实例
 */
export function createWorldObject(data) {
    switch (data.type) {
        case 'city':
            return new CityObject(data);
        case 'enemy_group':
            return new EnemyGroupObject(data);
        case 'decoration':
            return new DecorationObject(data);
        case 'pickup':
            return new PickupObject(data);
        case 'captured_building':
            return new CapturedBuildingObject(data);
        default:
            console.warn(`Unknown world object type: ${data.type}`);
            return new WorldObject(data);
    }
}

