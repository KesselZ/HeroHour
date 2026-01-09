import { modifierManager } from '../systems/ModifierManager.js';
import { SkillRegistry } from '../data/SkillRegistry.js';
import { BUILDING_REGISTRY, BLUEPRINTS } from '../data/BuildingData.js';

/**
 * 城镇类：现在它通过 blueprintId 彻底解决了“出身”问题
 */
export class City {
    constructor(id, name, owner = 'player', type = 'main_city', blueprintId = 'chunyang') {
        this.id = id;
        this.name = name;
        this.owner = owner; 
        this.side = owner; // 统一 side 命名，对接 ModifierManager
        this.type = type;
        this.blueprintId = blueprintId; // 核心：这座城市的“出身蓝图”
        this.x = 0;
        this.z = 0;
        
        // 只存储建筑的等级数据
        this.buildingLevels = {
            'town_hall': 1,
            'market': 1,
            'barracks': 1
        };

        this.availableUnits = { 'melee': 8, 'ranged': 5 };
        
        // --- 核心重构：初始产出注册为基础 Modifier ---
        this._initBaseProduction();
    }

    /**
     * 初始化城市的初始产出修正
     */
    _initBaseProduction() {
        // 核心对齐：上调初始总收入 (基础 + 初始建筑) 为 500金 / 300木
        // 初始建筑 Lv.1 议政厅提供 200金, Lv.1 市场提供 100金和 50木
        // 因此基础产出设为：200金，250木 (总计 500/300)
        modifierManager.addModifier({
            id: `city_${this.id}_base_gold`,
            side: this.side,
            targetUnit: this,
            stat: 'gold_income',
            offset: 200,
            source: 'city_base'
        });
        modifierManager.addModifier({
            id: `city_${this.id}_base_wood`,
            side: this.side,
            targetUnit: this,
            stat: 'wood_income',
            offset: 250,
            source: 'city_base'
        });
    }

    /**
     * 获取城市当前产出 (通过 ModifierManager 计算)
     */
    getGoldIncome() {
        return Math.floor(modifierManager.getModifiedValue(this, 'final_gold_income', 0));
    }

    getWoodIncome() {
        return Math.floor(modifierManager.getModifiedValue(this, 'final_wood_income', 0));
    }

    /**
     * 获取建筑的动态最大等级
     * 针对门派技能建筑，最大等级 = 对应等级的技能总数
     */
    getBuildingMaxLevel(buildingId) {
        const meta = BUILDING_REGISTRY[buildingId];
        if (!meta) return 0;

        // 如果是门派招式研习建筑 (如 sect_chunyang_basic)
        if (buildingId.startsWith('sect_')) {
            const parts = buildingId.split('_');
            const sectId = parts[1];
            const levelType = parts[2];
            
            const levelMap = {
                'basic': '初级',
                'advanced': '高级',
                'ultimate': '绝技'
            };
            
            const stats = SkillRegistry.getSectSkillStats(sectId);
            const levelKey = levelMap[levelType];
            
            if (levelKey && stats[levelKey] !== undefined) {
                // 核心逻辑：该等级有几个技能，建筑最高就能升到几级
                return stats[levelKey];
            }
        }

        // 默认返回配置中的固定值
        return meta.maxLevel;
    }

    /**
     * 核心算法：计算建筑升级至下一级所需的资源成本
     * @param {string} buildingId 建筑ID
     * @param {number} currentLevel 当前等级
     * @returns {Object} { gold, wood }
     */
    calculateUpgradeCost(buildingId, currentLevel) {
        const meta = BUILDING_REGISTRY[buildingId];
        if (!meta) return { gold: 0, wood: 0 };
        
        const base = meta.cost; // 基础价格 (Lv.1 的价格)
        const growth = meta.costGrowth || { type: 'linear', increment: { gold: 100, wood: 50 } }; 
        
        // 我们要升到的目标等级
        const targetLevel = currentLevel + 1;
        
        // 第一级永远使用基准价格
        let costResult = { ...base };

        if (targetLevel > 1) {
            if (growth.type === 'linear') {
                const inc = growth.increment || { gold: 100, wood: 50 };
                costResult = {
                    gold: base.gold + (targetLevel - 1) * (inc.gold || 0),
                    wood: base.wood + (targetLevel - 1) * (inc.wood || 0)
                };
            } else if (growth.type === 'exponential') {
                const multiplier = Math.pow(growth.factor || 1.5, targetLevel - 1);
                costResult = {
                    gold: Math.ceil((base.gold * multiplier) / 50) * 50,
                    wood: Math.ceil((base.wood * multiplier) / 50) * 50
                };
            }
        }

        // 核心改动：奇穴效果 - 以物易物 (降低木材消耗)
        costResult.wood = Math.ceil(modifierManager.getModifiedValue({ side: 'player' }, 'building_wood_cost', costResult.wood));

        return costResult;
    }

    /**
     * 校验建筑是否满足解锁条件
     */
    checkBuildingRequirements(buildingId) {
        const meta = BUILDING_REGISTRY[buildingId];
        if (!meta || !meta.requirements) return { met: true };

        for (const req of meta.requirements) {
            const currentLevel = this.buildingLevels[req.id] || 0;
            if (currentLevel < req.level) {
                const reqMeta = BUILDING_REGISTRY[req.id];
                return { 
                    met: false, 
                    reason: `需要 ${reqMeta ? reqMeta.name : req.id} 达到 Lv.${req.level}` 
                    };
            }
        }
        return { met: true };
    }

    /**
     * 动态获取当前城市所有的建筑列表
     */
    getAvailableBuildings() {
        const list = { economy: [], military: [], magic: [] };
        const blueprint = BLUEPRINTS[this.blueprintId] || BLUEPRINTS['chunyang'];
        
        // 核心获取：当前全局已解锁的科技
        const buildingManager = window.worldManager?.buildingManager;

        blueprint.forEach(id => {
            const meta = BUILDING_REGISTRY[id];
            
            // 核心 Roguelike 过滤：只有基础建筑，或者已在全局解锁的建筑才显示在建设列表
            const isUnlocked = buildingManager ? buildingManager.isTechUnlocked(id) : true;
            
            if (meta && (meta.isDefault || isUnlocked)) {
                const currentLevel = this.buildingLevels[id] || 0;
                const reqStatus = this.checkBuildingRequirements(id);
                list[meta.category].push({ 
                    id, 
                    ...meta, 
                    maxLevel: this.getBuildingMaxLevel(id), // 使用动态最大等级
                    level: currentLevel,
                    cost: this.calculateUpgradeCost(id, currentLevel), // 动态计算升级成本
                    unlockStatus: reqStatus // 包含解锁状态和原因
                });
            }
        });

        return list;
    }

    /**
     * 升级建筑逻辑
     */
    upgradeBuilding(buildingId) {
        const meta = BUILDING_REGISTRY[buildingId];
        const currentLevel = this.buildingLevels[buildingId] || 0;
        const maxLevel = this.getBuildingMaxLevel(buildingId); // 获取动态最大等级
        
        if (meta && currentLevel < maxLevel) {
            this.buildingLevels[buildingId] = currentLevel + 1;
            this._applyEffect(buildingId, this.buildingLevels[buildingId]);
            return true;
        }
        return false;
    }

    /**
     * 效果分发器 (仅处理一次性即时效果)
     * 持久性属性加成现在统一由 WorldManager.syncBuildingsToModifiers 处理
     */
    _applyEffect(id, level) {
        console.log(`%c[建设] %c${id} 升级至 Lv.${level}`, 'color: #a68b44; font-weight: bold', 'color: #fff');
        
        // 我们需要访问 worldManager，为了避免循环引用，我们通过全局或者动态 import
        // 这里假设 worldManager 会被挂载到 window 或者我们可以动态获取
        // 实际上在原代码中它是直接引用的全局 worldManager
        // 为了安全迁移，我们暂时使用全局引用，或者在 WorldManager 初始化后注入
        
        const wm = window.worldManager; 
        if (!wm) {
            console.warn('worldManager not found when applying building effect');
            return;
        }

        // --- 仅处理即时效果 (如获得技能) ---
        if (id === 'spell_altar') {
            wm.grantRandomSkill({ ignoreSect: true });
        } else if (id.startsWith('sect_')) {
            const parts = id.split('_');
            const sectId = parts[1];
            const levelType = parts[2]; // basic, advanced, ultimate
            
            const levelMap = {
                'basic': '初级',
                'advanced': '高级',
                'ultimate': '绝技'
            };
            
            wm.grantRandomSkill({ 
                sect: sectId, 
                level: levelMap[levelType],
                forceSect: true 
            });
        }

        // --- 核心：主动触发一次全量同步，确保新等级效果立即生效 ---
        wm.syncBuildingsToModifiers();
        wm.updateHUD(); // 同时刷新显示
    }

    isBuildingBuilt(buildingId) {
        return (this.buildingLevels[buildingId] || 0) > 0;
    }

    getIconKey() {
        return this.type;
    }

    /**
     * 获取城镇基础产出
     */
    getTotalProduction() {
        // 注意：原代码中使用了 this.production.gold，但 City 类中似乎没定义 production 属性
        // 而是通过 ModifierManager 处理。这里修正为返回基础值或通过方法获取。
        return { 
            gold: this.getGoldIncome(), 
            wood: this.getWoodIncome() 
        };
    }
}

