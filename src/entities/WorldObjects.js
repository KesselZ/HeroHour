import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { worldManager } from '../core/WorldManager.js';
import { timeManager } from '../core/TimeManager.js';

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
            // 核心修复：仅在大世界物体生成时，将锚点设为底部偏上 (0.1)
            if (this.mesh instanceof THREE.Sprite) {
                this.mesh.center.set(0.5, 0.1);
            }
            this.mesh.position.set(this.x, this.getElevation(), this.z);
            scene.add(this.mesh);
        }
    }

    createMesh() {
        // 子类实现具体创建逻辑，默认创建一个占位符或根据 type 创建
        return null;
    }

    getElevation() {
        return 0; // 既然锚点已调至底部，位置高度应设为 0 以便贴地
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

    /**
     * 获取浮动框信息
     */
    getTooltipData() {
        return null; // 默认不显示
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

    getTooltipData() {
        const names = {
            'gold_pile': '金币堆',
            'chest': '宝箱',
            'wood_pile': '木材堆'
        };
        return {
            name: names[this.pickupType] || '未知物品',
            level: '类别',
            maxLevel: '可收集资源'
        };
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
        
        // 克隆配置并应用随时间增长的战力缩放
        const scaledPoints = Math.floor((this.config.totalPoints || 0) * timeManager.getPowerMultiplier());
        const scaledConfig = {
            ...this.config,
            totalPoints: scaledPoints
        };

        const playerPower = worldManager.getPlayerTotalPower();
        const ratio = playerPower / scaledPoints;

        // 如果难度为“简单” (ratio > 1.5)，弹出跳过确认
        if (ratio > 1.5) {
            worldScene.showSkipBattleDialog(scaledConfig, scaledPoints, 
                // 取消：正常开战
                () => {
                    this._startBattle(worldScene, scaledConfig);
                },
                // 确认：直接结算
                () => {
                    const result = worldManager.simulateSimpleBattle(scaledConfig, scaledPoints);
                    worldScene.showSimpleSettlement(result);
                }
            );
            return false;
        }

        return this._startBattle(worldScene, scaledConfig);
    }

    /**
     * 内部方法：执行正常的开战流程
     */
    _startBattle(worldScene, scaledConfig) {
        window.dispatchEvent(new CustomEvent('start-battle', { detail: scaledConfig }));
        worldScene.stop();
        return false;
    }

    getTooltipData() {
        const template = worldManager.enemyTemplates[this.templateId || 'bandits'];
        const scaledPoints = Math.floor((this.config.totalPoints || 0) * timeManager.getPowerMultiplier());
        const playerPower = worldManager.getPlayerTotalPower();
        
        let difficulty = '地狱';
        let color = '#ff0000';
        
        const ratio = playerPower / scaledPoints;
        if (ratio > 1.5) {
            difficulty = '简单';
            color = '#00ff00';
        } else if (ratio >= 1.1) {
            difficulty = '普通';
            color = '#ffff00';
        } else if (ratio >= 0.8) {
            difficulty = '挑战';
            color = '#d4af37'; // 武侠金
        } else if (ratio >= 0.5) {
            difficulty = '困难';
            color = '#ffaa00';
        }

        return {
            name: template ? template.name : '未知敌人',
            level: '预计难度',
            maxLevel: difficulty,
            color: color
        };
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
        return spriteFactory.createUnitSprite('main_city');
    }

    getElevation() {
        return 0; // 城市贴地
    }

    onInteract(worldScene) {
        const cityData = worldManager.cities[this.id];
        if (!cityData) return false;

        if (cityData.owner === 'player') {
            // 访问自己的城市：补满侠客状态 (内力和气血)
            const hero = worldManager.heroData;
            if (hero.mpCurrent < hero.mpMax || hero.hpCurrent < hero.hpMax) {
                hero.mpCurrent = hero.mpMax;
                hero.hpCurrent = hero.hpMax;
                worldManager.showNotification(`回到 ${cityData.name}，侠客状态已补满`);
                window.dispatchEvent(new CustomEvent('hero-stats-changed'));
            }

            if (worldScene.activeCityId !== this.id) {
                worldScene.openTownManagement(this.id, true); // 亲自到场访问
                worldScene.activeCityId = this.id;
            }
        } else {
            // 敌方势力主城：触发攻城战
            const faction = worldManager.factions[cityData.owner];
            const heroInfo = worldManager.availableHeroes[faction?.heroId];
            
            worldManager.showNotification(`正在对 ${cityData.name} 发起攻城战！`);
            worldManager.mapState.pendingBattleEnemyId = this.id;

            // 攻城战配置：极高战力，且兵种池固定为该门派
            const siegeConfig = {
                name: `${cityData.name} 守军`,
                // 核心重构：根据主城所属英雄，配置该门派的全系兵种池
                unitPool: this._getSectUnitPool(faction?.heroId),
                // 统一攻城战难度：基础战力由 200 上调至 250，并随时间系数缩放
                totalPoints: Math.floor(250 * timeManager.getPowerMultiplier()), 
                isCitySiege: true, // 标记为攻城战
                cityId: this.id
            };

            window.dispatchEvent(new CustomEvent('start-battle', { detail: siegeConfig }));
            worldScene.stop();
        }
        return false;
    }

    /**
     * 获取对应门派的全系兵种池
     * @param {string} heroId 英雄ID
     */
    _getSectUnitPool(heroId) {
        const pools = {
            'liwangsheng': [
                'chunyang', 'cy_twin_blade', 'cy_sword_array', 
                'cy_zixia_disciple', 'cy_taixu_disciple'
            ],
            'lichengen': [
                'tiance', 'tc_crossbow', 'tc_banner', 'tc_dual_blade', 
                'tc_halberdier', 'tc_shield_vanguard', 'tc_mounted_crossbow', 
                'tc_heavy_cavalry'
            ],
            'yeying': [
                'cangjian', 'cj_retainer', 'cj_wenshui', 'cj_shanju', 
                'cj_xinjian', 'cj_golden_guard', 'cj_elder'
            ]
        };
        return pools[heroId] || ['melee', 'ranged']; // 兜底返回基础兵种
    }

    onExitRange(worldScene) {
        if (worldScene.activeCityId === this.id) {
            worldScene.closeTownManagement();
        }
    }

    getTooltipData() {
        const cityData = worldManager.cities[this.id];
        const owner = cityData ? cityData.owner : 'unknown';
        const factionColor = worldManager.getFactionColor(owner);
        
        let ownerName = '未知势力';
        if (owner === 'player') {
            ownerName = '你的领地';
        } else if (worldManager.factions[owner]) {
            ownerName = worldManager.factions[owner].name;
        }

        return {
            name: cityData ? cityData.name : '城镇',
            level: '归属势力',
            maxLevel: ownerName,
            color: factionColor
        };
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
        return 0;
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

    getTooltipData() {
        const owner = this.config.owner || 'none';
        const ownerFaction = worldManager.factions[owner];
        const ownerName = owner === 'none' ? '无人占领' : (ownerFaction ? ownerFaction.name : '未知势力');
        const factionColor = (owner === 'none') ? '#888888' : worldManager.getFactionColor(owner);
        const typeName = this.buildingType === 'gold_mine' ? '金矿' : '锯木厂';
        
        return {
            name: typeName,
            level: '当前归属',
            maxLevel: ownerName,
            color: factionColor
        };
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

