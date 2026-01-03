import { modifierManager } from './ModifierManager.js';
import { SkillRegistry } from './SkillRegistry.js';
import { audioManager } from './AudioManager.js';
import { talentManager } from './TalentManager.js';
import { timeManager } from './TimeManager.js';
import { UNIT_STATS_DATA, UNIT_COSTS, HERO_IDENTITY } from '../data/UnitStatsData.js';

/**
 * 1. 建筑全量注册表：定义所有建筑的元数据
 * 这种方式将数据与逻辑彻底分离，以后增加建筑只需在此处添加
 */
const BUILDING_REGISTRY = {
    'town_hall': { name: '议政厅', category: 'economy', maxLevel: 3, icon: 'main_city', cost: { gold: 500, wood: 100 }, description: '大权统筹：提升每季度的税收金钱产出。', costGrowth: { type: 'linear', increment: { gold: 500, wood: 100 } } },
    'market': { name: '市场', category: 'economy', maxLevel: 3, icon: 'merchant_guild', cost: { gold: 300, wood: 50 }, description: '互通有无：提高城镇的金钱与木材产出效率。', costGrowth: { type: 'linear', increment: { gold: 200, wood: 50 } } },
    'inn': { name: '悦来客栈', category: 'economy', maxLevel: 3, icon: 'pagoda_library', cost: { gold: 800, wood: 400 }, description: '每级增加全军 10% 的阅历获取速度。', costGrowth: { type: 'linear', increment: { gold: 400, wood: 200 } } },
    'bank': { name: '大通钱庄', category: 'economy', maxLevel: 2, icon: 'imperial_treasury', cost: { gold: 1500, wood: 300 }, description: '提升该城镇 20% 的金钱产出。', costGrowth: { type: 'exponential', factor: 1.5 } },
    'trade_post': { name: '马帮驿站', category: 'economy', maxLevel: 3, icon: 'distillery_v2', cost: { gold: 1000, wood: 600 }, description: '增加城镇木材产出，并降低全军招募成本 5%。', costGrowth: { type: 'linear', increment: { gold: 500, wood: 300 } } },
    
    // 军事建筑：根据兵种强度（招募成本与统御占用）重新平衡
    'barracks': { name: '兵营', category: 'military', maxLevel: 5, icon: 'melee', cost: { gold: 400, wood: 150 }, description: '解锁近战兵种，随后每级增加全军近战兵种 10% 生命。', costGrowth: { type: 'linear', increment: { gold: 150, wood: 50 } } },
    'archery_range': { name: '靶场', category: 'military', maxLevel: 5, icon: 'archer', cost: { gold: 500, wood: 250 }, description: '解锁远程兵种，随后每级增加全军远程兵种 10% 伤害。', requirements: [{ id: 'barracks', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 200, wood: 100 } } },
    
    // 高级兵种建筑：价格按强度阶梯式上升
    'medical_pavilion': { name: '万花医馆', category: 'military', maxLevel: 5, icon: 'healer', cost: { gold: 700, wood: 350 }, description: '解锁万花兵种，随后每级增加全军万花系 10% 气血与疗效。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 300, wood: 150 } } },
    'martial_shrine': { name: '苍云讲武堂', category: 'military', maxLevel: 5, icon: 'cangyun', cost: { gold: 700, wood: 350 }, description: '解锁苍云兵种，随后每级增加全军苍云系 10% 生命与防御。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 300, wood: 150 } } },
    'mage_guild': { name: '纯阳道场', category: 'military', maxLevel: 5, icon: 'chunyang', cost: { gold: 600, wood: 300 }, description: '解锁纯阳兵种，随后每级增加全军纯阳系 10% 属性。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 250, wood: 125 } } },
    'stable': { name: '天策马厩', category: 'military', maxLevel: 5, icon: 'tiance', cost: { gold: 1100, wood: 600 }, description: '解锁天策兵种，随后每级增加全军天策系 10% 伤害与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 500, wood: 300 } } },
    'sword_forge': { name: '藏剑剑庐', category: 'military', maxLevel: 5, icon: 'cangjian', cost: { gold: 800, wood: 400 }, description: '解锁藏剑兵种，随后每级增加全军藏剑系 10% 伤害与生命。', requirements: [{ id: 'archery_range', level: 1 }], costGrowth: { type: 'linear', increment: { gold: 400, wood: 200 } } },
    
    // 特殊建筑：移除不必要的条件，平衡价格
    'spell_altar': { name: '功法祭坛', category: 'magic', maxLevel: 3, icon: 'spell_altar_v2', cost: { gold: 1500, wood: 800 }, description: '博采众长：每级随机感悟全江湖招式。', costGrowth: { type: 'exponential', factor: 1.8 } },
    'treasure_pavilion': { name: '藏宝阁', category: 'economy', maxLevel: 1, icon: 'treasure_pavilion_v2', cost: { gold: 3000, wood: 1500 }, description: '琳琅满目：极其罕见的珍宝汇聚之地。', costGrowth: { type: 'constant' } },
    'clinic': { name: '医馆', category: 'magic', maxLevel: 1, icon: 'clinic_v3', cost: { gold: 1000, wood: 500 }, description: '仁心仁术：战场上死去的士兵有 20% 概率伤愈归队，减少损耗。', costGrowth: { type: 'constant' } },

    // 纯阳：招式研习 (层层递进解锁)
    'sect_chunyang_basic': { name: '两仪馆', category: 'magic', maxLevel: 2, icon: 'sect_chunyang_v3', cost: { gold: 400, wood: 200 }, description: '纯阳基础：感悟纯阳【初级】招式。', costGrowth: { type: 'constant' } },
    'sect_chunyang_advanced': { name: '太极殿', category: 'magic', maxLevel: 5, icon: 'sect_chunyang_v3', cost: { gold: 800, wood: 500 }, description: '纯阳进阶：感悟纯阳【高级】招式。', requirements: [{ id: 'sect_chunyang_basic', level: 1 }], costGrowth: { type: 'constant' } },
    'sect_chunyang_ultimate': { name: '纯阳宫', category: 'magic', maxLevel: 1, icon: 'sect_chunyang_v3', cost: { gold: 1500, wood: 1200 }, description: '纯阳绝学：感悟纯阳【绝技】招式。', requirements: [{ id: 'sect_chunyang_advanced', level: 1 }], costGrowth: { type: 'constant' } },

    // 天策：招式研习
    'sect_tiance_basic': { name: '演武场', category: 'magic', maxLevel: 2, icon: 'dummy_training', cost: { gold: 400, wood: 200 }, description: '天策基础：感悟天策【初级】招式。', costGrowth: { type: 'constant' } },
    'sect_tiance_advanced': { name: '凌烟阁', category: 'magic', maxLevel: 5, icon: 'dummy_training', cost: { gold: 800, wood: 500 }, description: '天策进阶：感悟天策【高级】招式。', requirements: [{ id: 'sect_tiance_basic', level: 1 }], costGrowth: { type: 'constant' } },
    'sect_tiance_ultimate': { name: '天策府', category: 'magic', maxLevel: 1, icon: 'dummy_training', cost: { gold: 1500, wood: 1200 }, description: '天策绝学：感悟天策【绝技】招式。', requirements: [{ id: 'sect_tiance_advanced', level: 1 }], costGrowth: { type: 'constant' } },

    // 藏剑：招式研习
    'sect_cangjian_basic': { name: '问水亭', category: 'magic', maxLevel: 2, icon: 'sect_cangjian_v3', cost: { gold: 400, wood: 200 }, description: '藏剑基础：感悟藏剑【初级】招式。', costGrowth: { type: 'constant' } },
    'sect_cangjian_advanced': { name: '山外山', category: 'magic', maxLevel: 5, icon: 'sect_cangjian_v3', cost: { gold: 800, wood: 500 }, description: '藏剑进阶：感悟藏剑【高级】招式。', requirements: [{ id: 'sect_cangjian_basic', level: 1 }], costGrowth: { type: 'constant' } },
    'sect_cangjian_ultimate': { name: '藏剑庐', category: 'magic', maxLevel: 1, icon: 'sect_cangjian_v3', cost: { gold: 1500, wood: 1200 }, description: '藏剑绝学：感悟藏剑【绝技】招式。', requirements: [{ id: 'sect_cangjian_advanced', level: 1 }], costGrowth: { type: 'constant' } }
};

/**
 * 2. 门派蓝图：定义每个门派出身的城市所拥有的建筑列表
 */
const BLUEPRINTS = {
    'chunyang': ['town_hall', 'market', 'inn', 'bank', 'trade_post', 'medical_pavilion', 'barracks', 'archery_range', 'stable', 'sword_forge', 'martial_shrine', 'mage_guild', 'spell_altar', 'sect_chunyang_basic', 'sect_chunyang_advanced', 'sect_chunyang_ultimate', 'clinic'],
    'tiance': ['town_hall', 'market', 'inn', 'bank', 'trade_post', 'barracks', 'archery_range', 'stable', 'sword_forge', 'martial_shrine', 'mage_guild', 'spell_altar', 'sect_tiance_basic', 'sect_tiance_advanced', 'sect_tiance_ultimate', 'medical_pavilion', 'clinic'],
    'cangjian': ['town_hall', 'market', 'inn', 'bank', 'trade_post', 'barracks', 'archery_range', 'stable', 'sword_forge', 'martial_shrine', 'mage_guild', 'spell_altar', 'sect_cangjian_basic', 'sect_cangjian_advanced', 'sect_cangjian_ultimate', 'medical_pavilion', 'clinic']
};

/**
 * 3. 兵种属性与说明注册表：全游戏唯一的兵种属性配置中心
 */
const UNIT_STATS_DATA_INTERNAL = UNIT_STATS_DATA;

/**
 * 城镇类：现在它通过 blueprintId 彻底解决了“出身”问题
 */
class City {
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
        // 优雅实现：直接将计算好的木材成本扔进中转站，返还扣除后的最终成本
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
     * 基于城市自身的 blueprintId，与当前 owner 无关，实现了“夺城而不改制”的战略感
     */
    getAvailableBuildings() {
        const list = { economy: [], military: [], magic: [] };
        const blueprint = BLUEPRINTS[this.blueprintId] || BLUEPRINTS['chunyang'];
        
        blueprint.forEach(id => {
            const meta = BUILDING_REGISTRY[id];
            if (meta) {
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
        
        // --- 仅处理即时效果 (如获得技能) ---
        if (id === 'spell_altar') {
            worldManager.grantRandomSkill({ ignoreSect: true });
        } else if (id.startsWith('sect_')) {
            const parts = id.split('_');
            const sectId = parts[1];
            const levelType = parts[2]; // basic, advanced, ultimate
            
            const levelMap = {
                'basic': '初级',
                'advanced': '高级',
                'ultimate': '绝技'
            };
            
            worldManager.grantRandomSkill({ 
                sect: sectId, 
                level: levelMap[levelType],
                forceSect: true 
            });
        }

        // --- 核心：主动触发一次全量同步，确保新等级效果立即生效 ---
        worldManager.syncBuildingsToModifiers();
        worldManager.updateHUD(); // 同时刷新显示
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
        return { 
            gold: this.production.gold, 
            wood: this.production.wood 
        };
    }
}

/**
 * 大世界数据管理器 (单例)
 * 负责追踪资源、英雄兵力、城镇兵力
 */
export class WorldManager {
    /**
     * 全局调试配置中心 (唯一控制台)
     * 职责：统一管理所有测试相关的 Hack 开关，保证生产环境一键切换
     */
    static DEBUG = {
        // 智能开关：开发模式 (npm run dev) 下自动开启，生产模式 (npm run build) 下自动关闭
        ENABLED: import.meta.env.DEV,
        REVEAL_MAP: import.meta.env.DEV,         // 自动揭开全图迷雾
        SHOW_INFLUENCE: import.meta.env.DEV,     // 在小地图显示势力范围 (影响力热力图)
        SHOW_POIS: import.meta.env.DEV,          // 显示所有资源点/兴趣点标记
        LICHENGEN_GOD_MODE: import.meta.env.DEV, // 李承恩起始获得全兵种各 2 个 + 无限统御
        START_RESOURCES: import.meta.env.DEV,    // 初始金钱 10000，木头 5000
        SHOW_MOTION_DEBUG: false                 // 运动调试日志：默认依然关闭，除非手动开启
    };

    constructor() {
        // 核心修复：显式指定 Side (针对专家建议 Point 1)
        // 这样当 WorldManager 调用 getModifiedValue 时，能正确匹配 side: 'player' 的全局修正
        this.side = 'player'; 

        // 0. 势力定义
        this.availableHeroes = {};
        for (const id in HERO_IDENTITY) {
            const identity = HERO_IDENTITY[id];
            const blueprint = UNIT_STATS_DATA[id];
            this.availableHeroes[id] = {
                name: blueprint.name,
                title: id === 'liwangsheng' ? '纯阳掌门' : (id === 'lichengen' ? '天策府统领' : '藏剑大庄主'),
                icon: id === 'yeying' ? 'cangjian' : id,
                sect: id === 'liwangsheng' ? 'chunyang' : (id === 'lichengen' ? 'tiance' : 'cangjian'),
                color: id === 'liwangsheng' ? '#44ccff' : (id === 'lichengen' ? '#ff4444' : '#ffcc00'),
                primaryStat: identity.primaryStat
            };
        }

        this.factions = {}; // 记录所有势力数据 { factionId: { heroId, cities: [], army: {} } }

        // 1. 基础资源 (初始资源调低，增加探索动力)
        // 调试模式下大幅提升初始资源
        const isCheat = WorldManager.DEBUG.ENABLED && WorldManager.DEBUG.START_RESOURCES;
        this.resources = {
            gold: isCheat ? 10000 : 1000,
            wood: isCheat ? 5000 : 500
        };

        // 2. 英雄数据 (持久化状态 - 初始值仅作为结构定义)
        this.heroData = {
            id: 'liwangsheng', 
            level: 1,
            xp: 0,
            xpMax: 120,
            hpMax: 0,
            hpCurrent: 0,
            mpMax: 0,
            mpCurrent: 0,
            talentPoints: isCheat ? 99 : 3,
            talents: {},
            pendingLevelUps: 0,
            skills: [],
            stats: {
                morale: 0,
                power: 0,
                spells: 0,
                qinggong: 0,
                battleSpeed: 0,
                haste: 0,
                leadership: 0,
            }
        };

        this.heroArmy = {}; // 初始为空，由 initHeroArmy 初始化

        // 3. 城镇中的兵力与建设
        this.cities = {
            'main_city_1': new City('main_city_1', '稻香村', 'player', 'main_city', 'chunyang')
        };

        // 4. 地图持久化状态
        this.mapState = {
            isGenerated: false,
            grid: [],           // 地形网格
            heightMap: [],      // 原始高度图 (噪声原值)
            entities: [],       // 大世界物体 { id, type, x, z, config, isRemoved }
            playerPos: { x: 0, z: 0 }, // 记录玩家位置
            exploredMap: null,  // 新增：小地图探索迷雾数据 (Uint8Array)
            interactionLocks: new Set(), // 新增：全局交互锁，确保战斗回来后状态保留
            pendingBattleEnemyId: null,   // 新增：正在进行的战斗目标 ID
            influenceCenters: [] // 新增：势力影响力中心 [{type, faction, x, z, strength}]
        };

        // 5. 占领建筑状态 (已整合进 entities，保留此数组用于快速结算收益)
        this.capturedBuildings = []; 
        
        // 5.5 当前对手信息 (用于开局展示)
        this.currentAIFactions = [];

        // 6. 兵种价格定义
        this.unitCosts = UNIT_COSTS;

        // 5. 敌人组模板定义 (数据驱动模式)
        this.enemyTemplates = {
            'woodland_critters': {
                name: '林间小生灵',
                overworldIcon: 'deer', 
                unitPool: ['deer', 'pheasant', 'bats', 'snake'], 
                basePoints: 15,        
                baseWeight: 15, // 大幅调低全图基础权重
                isBasic: true,
                description: '林间出没的各种小动物，几乎没有威胁，是新手练手的好对象。'
            },
            'fierce_beasts': {
                name: '深山猛兽',
                overworldIcon: 'tiger', 
                unitPool: ['wild_boar', 'wolf', 'tiger', 'bear'], 
                basePoints: 40,        
                baseWeight: 80,
                isBasic: true,
                description: '饥肠辘辘的猛兽，拥有极强的爆发力和野性。'
            },
            'rebels': {
                name: '狼牙叛军',
                overworldIcon: 'rebel_soldier', 
                unitPool: ['rebel_soldier', 'rebel_axeman', 'heavy_knight'],
                basePoints: 60,
                baseWeight: 45,
                description: '训练有素的叛军正规军，装备精良，极难对付。'
            },
            'bandits': {
                name: '山贼草寇',
                overworldIcon: 'bandit',
                unitPool: ['bandit', 'bandit_archer', 'snake'],
                basePoints: 40,
                baseWeight: 75,
                isBasic: true,
                description: '盘踞在要道上的山贼，数量众多，擅长埋伏。'
            },
            'shadow_sect': {
                name: '影之教派',
                overworldIcon: 'shadow_ninja', 
                unitPool: ['shadow_ninja', 'assassin_monk', 'zombie'],
                basePoints: 85,
                baseWeight: 30,
                description: '神秘的影之组织，成员全是顶尖刺客和诡异的毒尸。'
            },
            'bandit_outpost': {
                name: '山贼前哨',
                overworldIcon: 'bandit_archer',
                unitPool: ['bandit_archer', 'bandit', 'wolf'],
                basePoints: 30,
                baseWeight: 10, // 大幅调低全图基础权重
                isBasic: true,
                description: '山贼设立的前哨站，由弓手和驯服的野狼守卫。'
            },
            'plague_carriers': {
                name: '瘟疫传播者',
                overworldIcon: 'zombie',
                unitPool: ['zombie', 'bats', 'snake'],
                basePoints: 50,
                baseWeight: 25,
                description: '散发着腐烂气息的毒尸和成群的毒虫，令人不寒而栗。'
            },
            'chunyang_changge': {
                name: '纯阳长歌众',
                overworldIcon: 'liwangsheng', 
                unitPool: ['chunyang', 'ranged'],
                basePoints: 70,
                baseWeight: 0.1, // 从 0 改为 0.1，允许极低概率全图偶遇
                sectHero: 'liwangsheng', 
                description: '纯阳与长歌的弟子结伴而行，攻守兼备。'
            },
            'tiance_disciples_group': {
                name: '天策弟子',
                overworldIcon: 'melee', 
                unitPool: ['tiance', 'melee'],
                basePoints: 70,
                baseWeight: 0.1, 
                sectHero: 'lichengen', 
                description: '天策府的精锐小队，包含强悍的骑兵和坚韧的步兵。'
            },
            'cangjian_disciples_group': {
                name: '藏剑弟子',
                overworldIcon: 'cangjian', 
                unitPool: ['cangjian', 'melee'],
                basePoints: 70,
                baseWeight: 0.1,
                sectHero: 'yeying', 
                description: '西子湖畔藏剑山庄的弟子，擅长剑法。'
            },
            
            // --- 天一教势力组 (基于 enemy4.png) ---
            'tianyi_scouts': {
                name: '天一教巡逻队',
                overworldIcon: 'tianyi_guard',
                unitPool: ['tianyi_guard', 'tianyi_crossbowman', 'tianyi_venom_zombie', 'tianyi_apothecary'],
                basePoints: 55,
                baseWeight: 1, // 大幅降低基础权重，使其仅在势力范围内出没
                description: '天一教在野外的基础巡逻队，由教卫和毒尸组成。'
            },
            'tianyi_venom_lab': {
                name: '天一教炼毒场',
                overworldIcon: 'tianyi_apothecary', 
                unitPool: ['tianyi_apothecary', 'tianyi_venom_zombie', 'tianyi_shadow_guard'], 
                basePoints: 80,        
                baseWeight: 0.5,
                description: '天一教炼制毒药的秘密场所，守备森严，毒气弥漫。'
            },
            'tianyi_altar': {
                name: '天一教祭坛',
                overworldIcon: 'tianyi_priest', 
                unitPool: ['tianyi_priest', 'tianyi_guard', 'tianyi_elder'], 
                basePoints: 110,        
                baseWeight: 0.2,
                description: '天一教进行诡异祭祀的地方，祭司与长老亲自坐镇。'
            },
            'tianyi_core_forces': {
                name: '天一教核心主力',
                overworldIcon: 'tianyi_abomination', 
                unitPool: ['tianyi_abomination', 'tianyi_elder', 'tianyi_shadow_guard'], 
                basePoints: 160,        
                baseWeight: 0.1,
                description: '天一教最恐怖的作战单位集结，包括巨大的缝合怪与高阶影卫。'
            },

            // --- 神策军势力组 (基于 enemy3.png) ---
            'shence_patrol': {
                name: '神策军巡逻队',
                overworldIcon: 'shence_infantry',
                unitPool: ['shence_infantry', 'shence_crossbowman', 'shence_shieldguard', 'shence_bannerman'],
                basePoints: 75,
                baseWeight: 1,
                description: '神策军的基础巡逻力量，守卫严密，不容侵犯。'
            },
            'shence_vanguard': {
                name: '神策军先锋营',
                overworldIcon: 'shence_cavalry', 
                unitPool: ['shence_cavalry', 'shence_infantry', 'shence_assassin'], 
                basePoints: 110,        
                baseWeight: 0.5,
                description: '神策军的突击部队，骑兵冲锋配合刺客突袭，极具杀伤力。'
            },
            'shence_oversight': {
                name: '神策督战小队',
                overworldIcon: 'shence_overseer', 
                unitPool: ['shence_overseer', 'shence_bannerman', 'shence_shieldguard', 'shence_crossbowman'], 
                basePoints: 150,        
                baseWeight: 0.2,
                description: '由督军指挥的精英小队，军旗所指，军心震荡。'
            },
            'shence_imperial_guards': {
                name: '神策禁卫禁军',
                overworldIcon: 'shence_iron_pagoda', 
                unitPool: ['shence_iron_pagoda', 'shence_overseer', 'shence_cavalry', 'shence_bannerman'], 
                basePoints: 250,        
                baseWeight: 0.1,
                description: '神策军中最强悍的力量，重型铁甲与指挥官的完美配合。'
            },

            // --- 红衣教势力组 (基于 enemy5.png) ---
            'red_cult_zealots': {
                name: '红衣教狂热者',
                overworldIcon: 'red_cult_acolyte',
                unitPool: ['red_cult_acolyte', 'red_cult_enforcer', 'red_cult_archer', 'red_cult_priestess'],
                basePoints: 60,
                baseWeight: 1,
                description: '红衣教的基础部队，由武者带领狂热信徒组成。'
            },
            'red_cult_inquisition': {
                name: '红衣教审判廷',
                overworldIcon: 'red_cult_executioner', 
                unitPool: ['red_cult_executioner', 'red_cult_enforcer', 'red_cult_assassin'], 
                basePoints: 100,        
                baseWeight: 0.5,
                description: '红衣教的审判力量，红衣武者负责快速突进。'
            },
            'red_cult_ritual': {
                name: '红衣教祭祀仪式',
                overworldIcon: 'red_cult_high_priestess', 
                unitPool: ['red_cult_high_priestess', 'red_cult_firemage', 'red_cult_priestess'], 
                basePoints: 140,        
                baseWeight: 0.2,
                description: '正在进行神秘仪式的红衣教高层，魔法火力极强。'
            },
            'red_cult_conflagration': {
                name: '红衣教焚世军',
                overworldIcon: 'red_cult_high_priestess', 
                unitPool: ['red_cult_high_priestess', 'red_cult_firemage', 'red_cult_executioner', 'red_cult_assassin'], 
                basePoints: 220,        
                baseWeight: 0.1,
                description: '红衣教最狂暴的部队，所到之处皆为焦土。'
            },
            'chunyang_rogues': {
                name: '纯阳巡山弟子',
                overworldIcon: 'cy_taixu_disciple',
                unitPool: ['cy_twin_blade', 'cy_taixu_disciple', 'cy_zixia_disciple'],
                basePoints: 80,
                baseWeight: 0.1,
                sectHero: 'liwangsheng',
                description: '在门派周围巡视的纯阳弟子，对擅闯者绝不留情。'
            },
            'chunyang_trial': {
                name: '纯阳真传高手',
                overworldIcon: 'cy_sword_array',
                unitPool: ['cy_twin_blade', 'cy_sword_array', 'cy_zixia_disciple', 'cy_taixu_disciple'],
                basePoints: 120,
                baseWeight: 0.1,
                sectHero: 'liwangsheng',
                description: '由数位真传弟子组成的精锐小队，剑法超群，是极大的威胁。'
            },
            'cangjian_patrol': {
                name: '藏剑巡山弟子',
                overworldIcon: 'cj_wenshui',
                unitPool: ['cj_retainer', 'cj_wenshui', 'cj_golden_guard'],
                basePoints: 80,
                baseWeight: 0.1,
                sectHero: 'yeying',
                description: '在西湖边巡视的藏剑弟子，个个身姿轻盈，剑法凌厉。'
            },
            'cangjian_master': {
                name: '藏剑真传高手',
                overworldIcon: 'cj_elder',
                unitPool: ['cj_shanju', 'cj_xinjian', 'cj_elder'],
                basePoints: 150,
                baseWeight: 0.1,
                sectHero: 'yeying',
                description: '由藏剑山庄真传弟子和长老组成的精锐，重剑无锋，大巧不工。'
            }
        };
    }

    /**
     * 初始化英雄起始兵力
     * 职责：确保不同英雄、不同模式下的开局兵力配置高度统一且数据驱动
     */
    initHeroArmy(heroId) {
        // 1. 定义标准开局 (Source of Truth for normal gameplay)
        const standardStart = {
            'melee': 4,
            'ranged': 3
        };

        // 2. 调试模式判定
        const useDebugArmy = WorldManager.DEBUG.ENABLED && 
                             WorldManager.DEBUG.LICHENGEN_GOD_MODE && 
                             heroId === 'lichengen';

        if (useDebugArmy) {
            console.log("%c[DEBUG] %c李承恩神将模式激活：获得全兵种各 2 名，统御上限解锁", "color: #ff4444; font-weight: bold", "color: #fff");
            
            const godArmy = {};
            // 遍历所有合法兵种
            for (const type in UNIT_STATS_DATA) {
                // 排除非战斗兵种的 ID (即排除英雄本人)
                if (!['liwangsheng', 'lichengen', 'yeying'].includes(type)) {
                    godArmy[type] = 2;
                }
            }
            this.heroArmy = godArmy;
            
            // 暴力解锁统御上限，保证能带下
            this.heroData.stats.leadership = 999;
        } else {
            // 正常逻辑：应用标准开局
            this.heroArmy = { ...standardStart };
        }
    }

    /**
     * 获取全图探索数据 (用于调试模式)
     */
    revealFullMap() {
        if (!this.mapState.exploredMap) return;
        this.mapState.exploredMap.fill(1);
    }

    /**
     * 工业级动态权重系统：完全基于“影响力中心”的热力图算法
     * 优雅地处理玩家中心、门派中心、邪恶中心之间的权重过渡
     */
    getDynamicEnemyType(worldX, worldZ) {
        const weights = {};
        const centers = this.mapState.influenceCenters || [];
        
        // --- 1. 计算全图基础权重叠加 ---
        for (const [id, template] of Object.entries(this.enemyTemplates)) {
            let baseW = template.baseWeight || 0;
            if (baseW <= 0 && !template.sectHero) continue;

            let weightBonus = 0;
            let suppressionFactor = 1.0;

            centers.forEach(center => {
                const dist = Math.sqrt(Math.pow(worldX - center.x, 2) + Math.pow(worldZ - center.z, 2));
                if (dist > center.radius) return;

                // 使用余弦衰减函数 (更平滑的边缘过渡)
                const influence = 0.5 * (1 + Math.cos(Math.PI * (dist / center.radius))); // 1.0(中心) -> 0.0(边缘)
                const power = center.strength * influence;

                if (center.type === 'player_home') {
                    // 玩家出生点附近：大幅加成简单怪，剧烈压制强力怪
                    if (template.isBasic) {
                        weightBonus += power;
                    } else {
                        suppressionFactor *= Math.pow(1 - influence, 2); // 二次方压制
                    }
                } 
                else if (center.type === 'sect') {
                    // 门派城市附近：仅加成对应门派的兵种
                    if (template.sectHero === center.factionHero) {
                        weightBonus += power;
                    }
                } 
                else if (center.type === 'evil') {
                    // 邪恶据点附近：加成属于该势力的整组怪物
                    // 逻辑：检查 template ID 是否以 center.faction 开头 (如 tianyi_scouts 匹配 tianyi)
                    if (id.startsWith(center.faction)) {
                        weightBonus += power;
                    } else if (!template.isBasic) {
                        // 邪恶据点核心区也会排斥其他势力的强力怪，形成单一势力区
                        suppressionFactor *= (1 - influence * 0.8);
                    }
                }
            });

            // 最终权重 = (基础权重 + 所有中心加成) * 所有中心的压制系数
            weights[id] = (baseW + weightBonus) * suppressionFactor;
        }

        return this.weightedRandomSelect(weights);
    }

    /**
     * 通用的加权随机选择算法
     */
    weightedRandomSelect(weights) {
        const entries = Object.entries(weights);
        if (entries.length === 0) return 'bandits'; // 兜底

        const totalWeight = entries.reduce((sum, [_, w]) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (const [id, weight] of entries) {
            if (random < weight) return id;
            random -= weight;
        }
        return entries[0][0];
    }

    /**
     * 获取局部生成密度乘子 (1.0 - 4.0)
     * 职责：根据势力影响力动态调整物体的疏密程度
     */
    getDensityMultiplier(worldX, worldZ) {
        let multiplier = 1.0;
        const centers = (this.mapState && this.mapState.influenceCenters) || [];
        
        centers.forEach(center => {
            const dist = Math.sqrt(Math.pow(worldX - center.x, 2) + Math.pow(worldZ - center.z, 2));
            if (dist > center.radius) return;

            // 计算平滑的影响力系数 (1.0 -> 0.0)
            const influence = 0.5 * (1 + Math.cos(Math.PI * (dist / center.radius)));
            
            // 强度叠加：根据中心类型增加密度
            if (center.type === 'sect') multiplier += influence * 1.5; // 门派最高 +1.5 (共 2.5倍)
            else if (center.type === 'evil') multiplier += influence * 3.0; // 邪恶据点最高 +3.0 (共 4.0倍)
            else if (center.type === 'player_home') multiplier += influence * 0.5; // 新手村最高 +0.5 (共 1.5倍)
        });

        return Math.min(4.0, multiplier); // 严格限制最高 4 倍
    }

    /**
     * 获取指定城镇当前可用的招募列表（根据建筑是否建造判定解锁）
     */
    getAvailableRecruits(cityId = 'main_city_1') {
        const city = this.cities[cityId];
        const allPossibleUnits = [
            { type: 'melee', requiredBuilding: 'barracks' },
            { type: 'ranged', requiredBuilding: 'barracks' },
            { type: 'archer', requiredBuilding: 'archery_range' },
            { type: 'tiance', requiredBuilding: 'stable' },
            { type: 'chunyang', requiredBuilding: 'mage_guild' },
            { type: 'cangjian', requiredBuilding: 'sword_forge' },
            { type: 'cangyun', requiredBuilding: 'martial_shrine' },
            { type: 'healer', requiredBuilding: 'medical_pavilion' }
        ];

        return allPossibleUnits.filter(unit => {
            if (!unit.requiredBuilding) return true;
            return city.isBuildingBuilt(unit.requiredBuilding);
        });
    }

    /**
     * 获取全局总产出及其明细
     */
    getGlobalProduction() {
        let totalGold = 0;
        let totalWood = 0;
        const breakdown = {
            cities: [],
            mines: { gold: 0, wood: 0, count: { gold_mine: 0, sawmill: 0 } }
        };

        // 1. 统计所有玩家城镇的产出
        for (const cityId in this.cities) {
            const city = this.cities[cityId];
            if (city.owner === 'player') {
                const finalGold = city.getGoldIncome();
                const finalWood = city.getWoodIncome();
                totalGold += finalGold;
                totalWood += finalWood;
                breakdown.cities.push({
                    name: city.name,
                    gold: finalGold,
                    wood: finalWood
                });
            }
        }

        // 2. 统计所有已占领矿产的收益 (接入 ModifierManager 以支持全局加成)
        this.capturedBuildings.forEach(b => {
            if (b.owner === 'player') {
                const dummy = { side: 'player', type: b.type };
                if (b.type === 'gold_mine') {
                    // 基础金矿产量 150，支持全局百分比加成
                    const mineGold = Math.floor(modifierManager.getModifiedValue(dummy, 'final_gold_income', 150));
                    totalGold += mineGold;
                    breakdown.mines.gold += mineGold;
                    breakdown.mines.count.gold_mine++;
                } else if (b.type === 'sawmill') {
                    // 基础伐木场产量 80
                    const mineWood = Math.floor(modifierManager.getModifiedValue(dummy, 'final_wood_income', 80));
                    totalWood += mineWood;
                    breakdown.mines.wood += mineWood;
                    breakdown.mines.count.sawmill++;
                }
            }
        });

        return {
            gold: totalGold,
            wood: totalWood,
            breakdown
        };
    }

    /**
     * 资源产出 Tick：根据所有城镇的产出增加全局资源
     */
    processResourceProduction() {
        const prodData = this.getGlobalProduction();
        
        if (prodData.gold > 0) this.addGold(prodData.gold);
        if (prodData.wood > 0) this.addWood(prodData.wood);
        
        // 核心改动：奇穴效果 - 气吞山河 (季节更替回蓝)
        const mpRegenMult = modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'season_mp_regen', 0);
        if (mpRegenMult > 0) {
            const recoverAmount = Math.floor(this.heroData.mpMax * mpRegenMult);
            this.heroData.mpCurrent = Math.min(this.heroData.mpMax, this.heroData.mpCurrent + recoverAmount);
            this.showNotification(`气吞山河：由于时节更替，内力恢复了 ${recoverAmount} 点`);
        }

        console.log(`%c[季度结算] %c总收入金钱 +${prodData.gold}, 木材 +${prodData.wood}`, 'color: #557755; font-weight: bold', 'color: #fff');
    }

    /**
     * 判断玩家是否物理处于某个城市的位置
     * 职责：统一的地理位置校验，用于决定是否能进行“领兵”、“直接入队”等亲临操作
     */
    isPlayerAtCity(cityId) {
        const city = this.cities[cityId];
        if (!city) return false;
        
        const pPos = this.mapState.playerPos;
        if (!pPos) return false;

        const dist = Math.sqrt(Math.pow(pPos.x - city.x, 2) + Math.pow(pPos.z - city.z, 2));
        
        // 5.0 为标准交互半径
        return dist <= 5.0; 
    }

    /**
     * 获取单位的统御占用 (考虑奇穴减费)
     */
    getUnitCost(type) {
        const baseCost = this.unitCosts[type]?.cost || 0;
        // 获取针对该单位或军队的减费修正
        // 核心修复：明确传出 isHero: false，确保 army 目标的修正能准确匹配
        const minus = modifierManager.getModifiedValue({ side: 'player', type: type, isHero: false }, 'elite_cost_minus', 0);
        
        // 规则：只有基础占用 >= 4 的精锐单位享受减费
        if (baseCost >= 4 && minus > 0) {
            return Math.max(1, baseCost - Math.floor(minus));
        }
        return baseCost;
    }

    /**
     * 获取招募金钱消耗 (包含全局修正)
     */
    getRecruitGoldCost(type) {
        const baseCost = this.unitCosts[type]?.gold || 0;
        return Math.ceil(modifierManager.getModifiedValue({ side: 'player', type: type }, 'recruit_cost', baseCost));
    }

    /**
     * 获取单位的中文名称 (带缓存逻辑)
     */
    getUnitDisplayName(type) {
        const stats = UNIT_STATS_DATA[type];
        if (stats && stats.name) return stats.name;
        
        // 兜底方案
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    /**
     * 招募士兵到指定城市
     * @param {string} type 兵种类型
     * @param {string} cityId 城市 ID
     */
    recruitUnit(type, cityId = 'main_city_1') {
        const unitLeadershipCost = this.getUnitCost(type);
        const finalCost = this.getRecruitGoldCost(type);
        
        if (this.spendGold(finalCost)) {
            // 优雅的自动判定：如果人在现场且统御足够，直接入队
            const canTakeNow = this.isPlayerAtCity(cityId) && 
                               (this.getHeroCurrentLeadership() + unitLeadershipCost <= this.getHeroMaxLeadership());

            if (canTakeNow) {
                this.heroArmy[type] = (this.heroArmy[type] || 0) + 1;
                const unitName = this.getUnitDisplayName(type);
                console.log(`%c[招募] %c【${unitName}】已直接加入英雄队伍`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
            } else {
                const city = this.cities[cityId];
                city.availableUnits[type] = (city.availableUnits[type] || 0) + 1;
                const unitName = this.getUnitDisplayName(type);
                console.log(`%c[招募] %c【${unitName}】已进入城市 ${city.name} 预备役`, 'color: #5b8a8a', 'color: #fff');
            }

            this.updateHUD();
            return true;
        }
        return false;
    }

    /**
     * 将城市中的所有士兵转移到英雄身上 (受统御力限制)
     * 改进版：采用轮询机制，尽量让每一类兵种都能领到一点，而不是优先领满某一类
     */
    collectAllFromCity(cityId = 'main_city_1') {
        // 核心安全性校验：必须人在现场
        if (!this.isPlayerAtCity(cityId)) {
            console.warn(`[调兵] 失败：玩家未处于城市 ${cityId} 的地理范围内`);
            return;
        }

        const city = this.cities[cityId];
        let count = 0;
        let leadershipGained = 0;
        
        const currentLeadership = this.getHeroCurrentLeadership();
        const maxLeadership = this.getHeroMaxLeadership();
        let remainingLeadership = maxLeadership - currentLeadership;

        // 获取所有有余量且有成本的兵种
        const types = Object.keys(city.availableUnits).filter(type => {
            const amount = city.availableUnits[type];
            const unitCost = this.getUnitCost(type);
            return amount > 0 && unitCost > 0;
        });

        if (types.length === 0) return;

        // 轮询分配：每次尝试领取 1 个单位，直到领不动或领完为止
        let changed = true;
        while (changed && remainingLeadership > 0) {
            changed = false;
            for (const type of types) {
                const amount = city.availableUnits[type];
                if (amount <= 0) continue;

                const unitCost = this.getUnitCost(type);
                if (remainingLeadership >= unitCost) {
                    this.heroArmy[type] = (this.heroArmy[type] || 0) + 1;
                    city.availableUnits[type] -= 1;
                    count += 1;
                    leadershipGained += unitCost;
                    remainingLeadership -= unitCost;
                    changed = true;
                }
            }
        }

        if (count > 0) {
            console.log(`%c[调兵] %c英雄从 ${city.name} 智能领取了 ${count} 名士兵 (总占用: ${leadershipGained})`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
        } else if (Object.values(city.availableUnits).some(v => v > 0)) {
            this.showNotification("统御占用已达上限，无法领取更多士兵！");
        }
        this.updateHUD();
    }

    /**
     * 将英雄队伍中的所有士兵转移到城市 (全部驻守)
     */
    depositAllToCity(cityId = 'main_city_1') {
        let count = 0;
        for (const type in this.heroArmy) {
            const amount = this.heroArmy[type];
            if (amount > 0) {
                this.transferToCity(type, amount, cityId);
                count += amount;
            }
        }
        if (count > 0) {
            console.log(`%c[调兵] %c英雄将 ${count} 名士兵遣回驻守`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
        }
        this.updateHUD();
    }

    /**
     * 初始化或获取地图数据
     * @param {Object} generator 地图生成器实例 (由 Scene 传入)
     */
    getOrGenerateWorld(generator) {
        if (this.mapState.isGenerated) {
            return this.mapState;
        }

        console.log("%c[系统] 正在生成全新的江湖地图...", "color: #5b8a8a; font-weight: bold");
        
        const size = 400; 
        const grid = generator.generate(size);
        const entities = [];
        const halfSize = size / 2;

        // --- 1. 势力初始化逻辑 ---
        const playerHeroId = this.heroData.id;
        const playerHeroInfo = this.availableHeroes[playerHeroId] || { name: '未知侠客' };
        
        // 初始化玩家势力
        this.factions['player'] = {
            id: 'player',
            name: playerHeroInfo.name, // 直接使用人名
            heroId: playerHeroId,
            isPlayer: true,
            cities: ['main_city_1']
        };

        // 识别潜在对手 (排除玩家选中的)
        const opponentPool = Object.keys(this.availableHeroes).filter(id => id !== playerHeroId);
        
        // 随机选择两个对手
        const shuffledPool = [...opponentPool].sort(() => Math.random() - 0.5);
        const aiHeroes = shuffledPool.slice(0, 2);
        
        // 记录对手信息以便 UI 展示
        this.currentAIFactions = aiHeroes.map(id => ({
            id: id,
            name: this.availableHeroes[id].name,
            title: this.availableHeroes[id].title
        }));

        aiHeroes.forEach((aiHeroId, index) => {
            const aiHeroInfo = this.availableHeroes[aiHeroId];
            const factionId = `ai_faction_${index + 1}`;
            const cityId = `ai_city_${index + 1}`;

            this.factions[factionId] = {
                id: factionId,
                name: aiHeroInfo.name,
                heroId: aiHeroId,
                isPlayer: false,
                cities: [cityId]
            };

            const aiCity = new City(cityId, `${aiHeroInfo.name}的据点`, factionId, 'main_city', aiHeroInfo.sect);
            // 稍后在 POI 逻辑中分配位置
            this.cities[cityId] = aiCity;
        });

        // --- 2. 放置主城逻辑 ---
        if (generator.pois && generator.pois.length > 0) {
            // 核心优化：不再随机选取，而是计算间距最大的 POI 分布
            // 势力总数 = 玩家(1) + AI(aiHeroes.length)
            const factionCount = 1 + aiHeroes.length;
            const spreadPois = this._selectSpreadPOIs(generator.pois, Math.min(factionCount, generator.pois.length));

            // 分配玩家出生点 (从 spreadPois 中取第一个)
            const playerPoi = spreadPois[0];
            const px = playerPoi.x - halfSize;
            const pz = playerPoi.z - halfSize;
            this.mapState.playerPos = { x: px, z: pz };
            
            const pCity = this.cities['main_city_1'];
            pCity.name = "稻香村"; 
            pCity.x = px;
            pCity.z = pz;
            const playerSect = this.availableHeroes[this.heroData.id]?.sect || 'chunyang';
            pCity.blueprintId = playerSect;
            
            entities.push({ 
                id: 'main_city_1', 
                type: 'city', 
                x: px, 
                z: pz 
            });

            // 分配 AI 出生点 (从 spreadPois 中取剩余的)
            aiHeroes.forEach((aiHeroId, index) => {
                const factionId = `ai_faction_${index + 1}`;
                const cityId = `ai_city_${index + 1}`;
                
                // 如果 POI 不够分，则循环利用或采取其他策略，确保不报错
                const poiIndex = (index + 1) < spreadPois.length ? (index + 1) : (index % spreadPois.length);
                const aiPoi = spreadPois[poiIndex];
                const ax = aiPoi.x - halfSize;
                const az = aiPoi.z - halfSize;
                
                const aiCity = this.cities[cityId];
                aiCity.x = ax;
                aiCity.z = az;

                entities.push({ 
                    id: cityId, 
                    type: 'city', 
                    x: ax, 
                    z: az 
                });
            });

            // --- 2.5 挑选并放置邪恶势力据点 ---
            // 从三大邪恶势力中挑选 2 个，放置在远离玩家的空余 POI
            const evilFactions = ['tianyi', 'shence', 'red_cult'];
            const chosenEvils = [...evilFactions].sort(() => Math.random() - 0.5).slice(0, 2);
            
            // 过滤掉已被主城占用的 POI
            const remainingPois = generator.pois.filter(poi => {
                const wx = poi.x - halfSize;
                const wz = poi.z - halfSize;
                // 检查是否与现有城市重叠
                return !Object.values(this.cities).some(c => c.x === wx && c.z === wz);
            });

            chosenEvils.forEach((factionId, index) => {
                // 寻找距离玩家最远的空余 POI
                const playerPos = this.mapState.playerPos;
                remainingPois.sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.x - halfSize - playerPos.x, 2) + Math.pow(a.z - halfSize - playerPos.z, 2));
                    const distB = Math.sqrt(Math.pow(b.x - halfSize - playerPos.x, 2) + Math.pow(b.z - halfSize - playerPos.z, 2));
                    return distB - distA; // 降序，最远的在前
                });

                if (remainingPois.length > 0) {
                    const targetPoi = remainingPois.shift();
                    const ex = targetPoi.x - halfSize;
                    const ez = targetPoi.z - halfSize;
                    
                    const factionNames = { 'tianyi': '天一教总坛', 'shence': '神策军营', 'red_cult': '红衣教祭坛' };
                    const iconKeys = { 'tianyi': 'tianyi_abomination', 'shence': 'shence_iron_pagoda', 'red_cult': 'red_cult_high_priestess' };

                    entities.push({
                        id: `evil_base_${factionId}`,
                        type: 'decoration', // 暂时作为装饰物展示，后期可扩展为特殊交互点
                        spriteKey: iconKeys[factionId],
                        x: ex, z: ez,
                        scale: 2.5,
                        config: { isEvilBase: true, faction: factionId, name: factionNames[factionId] }
                    });

                    console.log(`%c[势力] %c${factionNames[factionId]} 已在偏远地区 POI (${ex}, ${ez}) 扎根`, 'color: #ff4444; font-weight: bold', 'color: #fff');
                }
            });
        } else {
            // 兜底逻辑：如果地图上一个 POI 都没找到（理论上不应该），随机找一个草地
            console.warn("[WorldManager] 未能找到任何 POI 候选点，启动兜底随机出生逻辑");
            let found = false;
            for (let retry = 0; retry < 100; retry++) {
                const rx = Math.floor(Math.random() * size);
                const rz = Math.floor(Math.random() * size);
                if (generator.grid[rz][rx] === 'grass') {
                    const px = rx - halfSize;
                    const pz = rz - halfSize;
                    this.mapState.playerPos = { x: px, z: pz };
                    
                    const pCity = this.cities['main_city_1'];
                    pCity.x = px;
                    pCity.z = pz;
                    entities.push({ id: 'main_city_1', type: 'city', x: px, z: pz });
                    found = true;
                    break;
                }
            }
            if (!found) {
                // 极端兜底：强制中心点
                this.mapState.playerPos = { x: 0, z: 0 };
            }
        }

        // --- 3. 核心重构：构建全图影响力中心缓存 (Influence Centers) ---
        // 在生成随机实体前初始化，确保 getDynamicEnemyType 能读取到热力图数据
        this.mapState.influenceCenters = [];
        
        // A. 玩家主城 (提供简单怪加成)
        this.mapState.influenceCenters.push({
            type: 'player_home',
            x: this.mapState.playerPos.x,
            z: this.mapState.playerPos.z,
            strength: 1500, 
            radius: 50
        });

        // B. AI 门派城市 (提供对应门派兵加成)
        Object.values(this.cities).forEach(city => {
            if (city.owner !== 'player') {
                const faction = this.factions[city.owner];
                this.mapState.influenceCenters.push({
                    type: 'sect',
                    factionHero: faction?.heroId,
                    x: city.x,
                    z: city.z,
                    strength: 1000,
                    radius: 40
                });
            }
        });

        // C. 邪恶势力据点 (提供整套势力怪加成)
        entities.forEach(ent => {
            if (ent.config && ent.config.isEvilBase) {
                this.mapState.influenceCenters.push({
                    type: 'evil',
                    faction: ent.config.faction,
                    x: ent.x,
                    z: ent.z,
                    strength: 1200,
                    radius: 60
                });
            }
        });

        // --- 4. 随机实体生成 (回归：优雅的网格随机采样) ---
        // 这种方式能带来比泊松采样更自然的疏密变化，同时保留了新系统的所有特性
        const occupied = new Uint8Array(size * size); 
        const playerSpawnX = this.mapState.playerPos.x;
        const playerSpawnZ = this.mapState.playerPos.z;

        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                // 1. 基础合法性检查
                if (!generator.isSafeGrass(x, z)) continue;

                // 2. 邻域互斥检查 (升级：扩大至 2 格半径，增加稀疏感)
                let hasAdjacent = false;
                for (let dz = -2; dz <= 2; dz++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        if (dx === 0 && dz === 0) continue;
                        const nx = x + dx, nz = z + dz;
                        if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
                            if (occupied[nz * size + nx]) { hasAdjacent = true; break; }
                        }
                    }
                    if (hasAdjacent) break;
                }
                if (hasAdjacent) continue;

                const worldX = x - halfSize;
                const worldZ = z - halfSize;

                // 3. 安全区检查 (半径 3)
                const distToPlayer = Math.sqrt(Math.pow(worldX - playerSpawnX, 2) + Math.pow(worldZ - playerSpawnZ, 2));
                let inCitySafetyZone = distToPlayer < 3;
                if (!inCitySafetyZone) {
                    for (const cityId in this.cities) {
                        const city = this.cities[cityId];
                        if (Math.sqrt(Math.pow(worldX - city.x, 2) + Math.pow(worldZ - city.z, 2)) < 3) {
                            inCitySafetyZone = true; break;
                        }
                    }
                }
                if (inCitySafetyZone) continue;

                // 4. 核心逻辑：结合动态密度进行概率判定
                const roll = Math.random();
                const density = this.getDensityMultiplier(worldX, worldZ);
                
                // 老版本基础概率对齐：敌人 0.25%，总概率 1.7%
                const enemyProb = 0.0025 * density;

                let placed = false;
                if (roll < 0.002) {
                    entities.push({ id: `gold_${x}_${z}`, type: 'pickup', pickupType: 'gold_pile', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.003) {
                    entities.push({ id: `chest_${x}_${z}`, type: 'pickup', pickupType: 'chest', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.005) {
                    entities.push({ id: `wood_${x}_${z}`, type: 'pickup', pickupType: 'wood_pile', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.0055) {
                    const bType = Math.random() > 0.5 ? 'gold_mine' : 'sawmill';
                    entities.push({ 
                        id: `${bType}_${x}_${z}`, type: 'captured_building', 
                        spriteKey: bType === 'gold_mine' ? 'gold_mine_v2' : 'sawmill_v2',
                        buildingType: bType, x: worldX, z: worldZ,
                        config: { owner: 'none', type: bType }
                    });
                    placed = true;
                } else if (roll < 0.0055 + enemyProb) {
                    const tId = this.getDynamicEnemyType(worldX, worldZ);
                    const template = this.enemyTemplates[tId];
                    const points = Math.max(1, Math.floor(template.basePoints * (0.95 + Math.random() * 0.1)));
                    entities.push({ 
                        id: `enemy_${x}_${z}`, type: 'enemy_group', templateId: tId, x: worldX, z: worldZ,
                        config: { name: template.name, unitPool: template.unitPool, totalPoints: points }
                    });
                    placed = true;
                } else if (roll < 0.0055 + enemyProb + 0.007) {
                    entities.push({ id: `tree_${x}_${z}`, type: 'decoration', spriteKey: 'tree', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.0055 + enemyProb + 0.009) {
                    entities.push({ id: `house_${x}_${z}`, type: 'decoration', spriteKey: 'house_1', x: worldX, z: worldZ });
                    placed = true;
                }

                if (placed) occupied[z * size + x] = 1;
            }
        }

        // --- 5. 自动分配周边矿产逻辑 (圈地系统) ---
        // 规则：50米范围内的矿产自动归属于最近的敌方主城。
        // 注意：此逻辑不对玩家生效，玩家需要手动跑位占领以保留探索感。
        entities.forEach(entity => {
            if (entity.type === 'captured_building') {
                let closestCity = null;
                let minDist = 50; 

                Object.values(this.cities).forEach(city => {
                    // 核心修改：仅对非玩家城市（AI 势力）生效
                    if (city.owner === 'player') return;

                    const d = Math.sqrt(Math.pow(entity.x - city.x, 2) + Math.pow(entity.z - city.z, 2));
                    if (d < minDist) {
                        minDist = d;
                        closestCity = city;
                    }
                });

                if (closestCity) {
                    entity.config.owner = closestCity.owner;
                    // AI 矿产不需要推入 player 的结算数组，AI 势力目前不走玩家同款结算逻辑
                    console.log(`%c[圈地] %c${entity.config.type} 已划归至敌方据点 ${closestCity.name} 名下`, 'color: #888; font-style: italic', 'color: #fff');
                }
            }
        });

        // 记录状态
        this.mapState.isGenerated = true;
        this.mapState.grid = grid;
        this.mapState.heightMap = generator.heightMap;
        this.mapState.entities = entities;
        this.mapState.size = size;

        // 初始化全黑的探索迷雾 (0: 未探索, 1: 已探索)
        this.mapState.exploredMap = new Uint8Array(size * size);

        return this.mapState;
    }

    /**
     * 处理攻城战胜利后的城市占领
     * @param {string} cityId 
     */
    captureCity(cityId) {
        const city = this.cities[cityId];
        if (!city) return;

        const oldOwner = city.owner;
        const oldFaction = this.factions[oldOwner];
        const oldHeroId = oldFaction ? oldFaction.heroId : null;

        city.owner = 'player';
        // 备注：学院建筑会自动随 owner 变更而动态切换显示逻辑
        
        // 更新势力的城市列表
        if (oldFaction) {
            oldFaction.cities = oldFaction.cities.filter(id => id !== cityId);
        }
        
        if (!this.factions['player'].cities.includes(cityId)) {
            this.factions['player'].cities.push(cityId);
        }

        // --- 核心改动 1：移除地图上对应门派的弟子野怪 ---
        if (oldHeroId) {
            // 找到所有绑定到该英雄的敌人模板 ID
            const templateIdsToRemove = Object.entries(this.enemyTemplates)
                .filter(([_, t]) => t.sectHero === oldHeroId)
                .map(([id, _]) => id);

            this.mapState.entities.forEach(entity => {
                if (entity.type === 'enemy_group' && templateIdsToRemove.includes(entity.templateId)) {
                    entity.isRemoved = true; // 标记为逻辑移除
                }
            });
            
            // 派发事件让场景层立即清除对应 Mesh
            window.dispatchEvent(new CustomEvent('sect-monsters-cleared', { detail: { templateIds: templateIdsToRemove } }));
        }

        // --- 核心改动 2：接收该势力名下的所有产业 (矿产等) ---
        this.mapState.entities.forEach(entity => {
            if (entity.type === 'captured_building' && entity.config.owner === oldOwner) {
                entity.config.owner = 'player';
                
                // 同步更新 capturedBuildings 数组以便收益计算
                const recorded = this.capturedBuildings.find(b => b.id === entity.id);
                if (recorded) {
                    recorded.owner = 'player';
                } else {
                    this.capturedBuildings.push({
                        id: entity.id,
                        type: entity.config.type,
                        owner: 'player'
                    });
                }
            }
        });

        this.showNotification(`成功收复了 ${city.name}！其势力范围内的野怪已溃散，产业已归收。`);
        console.log(`%c[攻城胜利] %c${city.name} 及其附属产业现在归属于玩家势力`, 'color: #00ff00; font-weight: bold', 'color: #fff');

        // 检查是否所有敌方主城都被占领
        this.checkVictoryCondition();
    }

    /**
     * 检查是否达成最终胜利（消灭所有 AI 势力）
     */
    checkVictoryCondition() {
        const remainingAiCities = Object.values(this.cities).filter(c => c.owner !== 'player');
        
        if (remainingAiCities.length === 0) {
            setTimeout(() => {
                alert("恭喜！你已统一江湖，消灭了所有割据势力，达成最终胜利！");
                // 可以在这里触发更复杂的胜利 UI 或返回主菜单
            }, 1000);
        }
    }

    /**
     * 获取指定势力的颜色
     */
    getFactionColor(factionId) {
        const faction = this.factions[factionId];
        if (!faction) return '#888888'; // 默认灰色 (中立)
        
        const heroInfo = this.availableHeroes[faction.heroId];
        return heroInfo ? heroInfo.color : '#ffffff';
    }

    /**
     * 获取玩家当前队伍的总战斗力
     */
    getPlayerTotalPower() {
        let total = 0;
        
        // 1. 计算士兵战力
        for (const type in this.heroArmy) {
            const count = this.heroArmy[type];
            if (count > 0 && this.unitCosts[type]) {
                // 核心修复：使用 getUnitCost 以包含天赋减费
                total += count * this.getUnitCost(type);
            }
        }

        // 2. 计算主将战力：固定为 15 点，不随等级增加
        total += 15;

        return total;
    }

    /**
     * 更新实体状态（例如被捡走）
     */
    removeEntity(id) {
        const entity = this.mapState.entities.find(e => e.id === id);
        if (entity) {
            entity.isRemoved = true;
            console.log(`%c[逻辑同步] 实体 ${id} 已从地图逻辑中移除`, "color: #888");
        }
    }

    /**
     * 将所有城市的所有建筑效果全量同步到 ModifierManager
     * 职责：Single Source of Truth，彻底解决建筑加成在资源更新时消失的问题
     */
    syncBuildingsToModifiers() {
        modifierManager.removeModifiersBySource('building');
        modifierManager.removeModifiersBySource('city_base'); // 核心新增：确保基础产出也能在 clear 后恢复

        for (const cityId in this.cities) {
            const city = this.cities[cityId];
            const side = city.owner;
            if (side !== 'player') continue; // 目前主要处理玩家建筑

            // --- 0. 基础产出同步 ---
            city._initBaseProduction();

            for (const [id, level] of Object.entries(city.buildingLevels)) {
                if (level <= 0) continue;

                // --- 1. 经济类建筑 ---
                if (id === 'town_hall') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_town_hall_gold`,
                        side: side, targetUnit: city, stat: 'gold_income',
                        offset: level * 200, source: 'building'
                    });
                } else if (id === 'market') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_market_gold`,
                        side: side, targetUnit: city, stat: 'gold_income',
                        offset: level * 100, source: 'building'
                    });
                    modifierManager.addModifier({
                        id: `city_${cityId}_market_wood`,
                        side: side, targetUnit: city, stat: 'wood_income',
                        offset: level * 50, source: 'building'
                    });
                } else if (id === 'bank') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_bank_bonus`,
                        side: side, targetUnit: city, stat: 'gold_income',
                        multiplier: 1.0 + (level * 0.20), source: 'building'
                    });
                } else if (id === 'trade_post') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_trade_post_wood`,
                        side: side, targetUnit: city, stat: 'wood_income',
                        offset: level * 80, source: 'building'
                    });
                    modifierManager.addModifier({ 
                        id: `city_${cityId}_recruit_discount`, 
                        side: 'player', stat: 'recruit_cost', 
                        multiplier: 1.0 - (level * 0.05), source: 'building'
                    });
                } else if (id === 'inn') {
                    modifierManager.addModifier({ 
                        id: `city_${cityId}_xp_bonus`, 
                        side: 'player', stat: 'xp_gain', 
                        multiplier: 1.0 + (level * 0.10), source: 'building'
                    });
                }

                // --- 2. 军事类建筑 ---
                const milMultiplier = 1.0 + Math.max(0, (level - 1) * 0.10);
                switch (id) {
                    case 'barracks':
                        modifierManager.addModifier({ id: `city_${cityId}_melee_hp`, side: 'player', unitType: 'melee', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'archery_range':
                        modifierManager.addModifier({ id: `city_${cityId}_ranged_dmg`, side: 'player', unitType: 'ranged', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'stable':
                        modifierManager.addModifier({ id: `city_${cityId}_tiance_bonus`, side: 'player', unitType: 'tiance', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `city_${cityId}_tiance_hp`, side: 'player', unitType: 'tiance', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'sword_forge':
                        modifierManager.addModifier({ id: `city_${cityId}_cangjian_bonus`, side: 'player', unitType: 'cangjian', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `city_${cityId}_cangjian_hp`, side: 'player', unitType: 'cangjian', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'martial_shrine':
                        modifierManager.addModifier({ id: `city_${cityId}_cangyun_hp`, side: 'player', unitType: 'cangyun', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `city_${cityId}_cangyun_def`, side: 'player', unitType: 'cangyun', stat: 'damageReduction', offset: Math.max(0, (level - 1) * 0.10), source: 'building' });
                        break;
                    case 'mage_guild':
                        modifierManager.addModifier({ id: `city_${cityId}_chunyang_bonus`, side: 'player', unitType: 'chunyang', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'medical_pavilion':
                        modifierManager.addModifier({ id: `city_${cityId}_healer_hp`, side: 'player', unitType: 'healer', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `city_${cityId}_healer_bonus`, side: 'player', unitType: 'healer', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'clinic':
                        modifierManager.addModifier({ id: `city_${cityId}_clinic_survival`, side: 'player', stat: 'survival_rate', offset: level * 0.20, source: 'building' });
                        break;
                }
            }
        }
    }

    /**
     * 更新玩家位置存档
     */
    savePlayerPos(x, z) {
        this.mapState.playerPos = { x, z };
    }

    /**
     * 显示全局通知气泡
     * @param {string} message 消息内容
     */
    showNotification(message) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.innerText = message;

        // 限制最大显示数量，防止刷屏
        if (container.children.length >= 3) {
            container.removeChild(container.firstChild);
        }

        container.appendChild(notification);

        // 4秒后自动移除（与 CSS 动画时长匹配）
        setTimeout(() => {
            if (notification.parentNode) {
                container.removeChild(notification);
            }
        }, 4000);
    }

    /**
     * 处理捡起大世界物品的通用接口
     * @param {string} itemType 物品类型 ('gold_pile', 'chest' 等)
     * @returns {Object} 获得的奖励描述
     */
    handlePickup(itemType) {
        let reward = { gold: 0, wood: 0, xp: 0 };
        let msg = "";

        // 获取当前战力/时间缩放系数 (每季度增加 4%)
        const powerMult = timeManager.getPowerMultiplier();

        // 获取奇穴加成：赏金猎人 (拾取翻倍)
        const dummyHero = this.getPlayerHeroDummy();
        switch (itemType) {
            case 'gold_pile':
                const rawGold = (Math.floor(Math.random() * 51) + 200) * powerMult; // 200-250 金币 * 缩放
                reward.gold = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawGold));
                msg = `捡到了一堆金币，获得 ${reward.gold} 💰`;
                break;
            case 'chest':
                // 宝箱给金币和木材
                const rawChestGold = (Math.floor(Math.random() * 101) + 400) * powerMult; // 400-500 * 缩放
                const rawChestWood = (Math.floor(Math.random() * 101) + 200) * powerMult; // 200-300 * 缩放
                reward.gold = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawChestGold));
                reward.wood = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawChestWood));
                msg = `开启了宝箱，获得 ${reward.gold} 💰 和 ${reward.wood} 🪵`;
                reward.xp = 30; // 奖励丰厚，多给点经验
                break;
            case 'wood_pile':
                const rawWood = (Math.floor(Math.random() * 61) + 90) * powerMult; // 90-150 * 缩放
                reward.wood = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawWood));
                msg = `捡到了木材堆，获得 ${reward.wood} 🪵`;
                break;
        }

        if (reward.gold > 0) this.addGold(reward.gold);
        if (reward.wood > 0) this.addWood(reward.wood);
        if (reward.xp > 0) this.gainXP(reward.xp);

        if (msg) {
            console.log(`%c[交互] %c${msg}`, 'color: #ffcc00; font-weight: bold', 'color: #fff');
        }

        return reward;
    }

    /**
     * 处理占领大世界建筑的接口
     * @param {Object} buildingItem 交互项
     */
    /**
     * 重构后的势力分配逻辑：
     * 1. 在全图范围内寻找 count 个彼此距离最远的点
     * 2. 这里的 allPois 已经是按平原质量（半径）降序排列的，我们加入随机种子点和全局洗牌
     */
    _selectSpreadPOIs(allPois, count) {
        if (allPois.length <= count) {
            // 如果点数不够，先拷贝一份再洗牌返回
            const shuffled = [...allPois];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }

        const selected = [];
        
        // 1. 锚点随机化：从前 40% 的优质 POI 中随机选一个作为起始“种子”
        // 这样既保证了地盘质量，又保证了位置的随机性
        const seedIdx = Math.floor(Math.random() * Math.min(allPois.length, Math.ceil(allPois.length * 0.4)));
        selected.push(allPois[seedIdx]);

        // 2. 使用 Max-Min 算法迭代寻找剩余的点
        // 确保后续每一个加入的点，都离当前已选点集最远 (全局互斥)
        while (selected.length < count) {
            let bestCandidate = null;
            let maxMinDist = -1;

            for (let i = 0; i < allPois.length; i++) {
                const poi = allPois[i];
                if (selected.includes(poi)) continue;

                // 计算该候选点到已选集合中所有点的最小距离
                let minDist = Infinity;
                for (const s of selected) {
                    const d = Math.sqrt(Math.pow(poi.x - s.x, 2) + Math.pow(poi.z - s.z, 2));
                    if (d < minDist) minDist = d;
                }

                // 寻找那个让“最小距离”最大的点
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestCandidate = poi;
                }
            }

            if (bestCandidate) selected.push(bestCandidate);
            else break;
        }

        // 3. 核心变动：全局随机洗牌！
        // 虽然选出的 count 个点彼此最远，但顺序原本是有规律的。
        // 通过洗牌，让“谁拿第一个点”完全随机，实现主角与 AI 的地位平等。
        for (let i = selected.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selected[i], selected[j]] = [selected[j], selected[i]];
        }

        return selected;
    }

    /**
     * 处理野外矿产/建筑的占领逻辑
     */
    handleCapture(buildingItem, newOwner = 'player') {
        const { id, config } = buildingItem;
        
        // 如果已经是该势力的，直接返回
        if (config.owner === newOwner) return;

        // 占领逻辑
        config.owner = newOwner;
        
        // 更新记录列表
        let recorded = this.capturedBuildings.find(b => b.id === id);
        if (recorded) {
            recorded.owner = newOwner;
        } else {
            this.capturedBuildings.push({
                id: id,
                type: config.type,
                owner: newOwner
            });
        }

        const name = config.type === 'gold_mine' ? '金矿' : '伐木场';
        const ownerName = newOwner === 'player' ? '玩家' : (this.factions[newOwner]?.name || '敌方');
        
        if (newOwner === 'player') {
            this.showNotification(`成功占领了${name}！每季度将产出额外资源。`);
            
            // 播放占领音效
            if (config.type === 'gold_mine') {
                audioManager.play('capture_gold_mine');
            } else if (config.type === 'sawmill') {
                audioManager.play('capture_sawmill');
            }
        }
        
        console.log(`%c[占领] %c${name} (${id}) 现在归属于 ${ownerName}`, 'color: #00ff00; font-weight: bold', 'color: #fff');
        
        // 触发 UI 刷新或特效
        window.dispatchEvent(new CustomEvent('building-captured', { detail: { id, type: config.type, owner: newOwner } }));
    }

    /**
     * 核心 API：随机授予英雄技能
     * @param {Object} options { sect: '门派名', level: '初级|高级|绝技', count: 1, pool: ['skill_id_1', ...], ignoreSect: boolean, forceSect: boolean }
     */
    async grantRandomSkill(options = {}) {
        const { SkillRegistry, SectSkills } = await import('./SkillSystem.js');
        const heroData = this.heroData;
        
        // 1. 确定备选池
        let candidateIds = [];
        
        if (options.pool) {
            candidateIds = options.pool;
        } else if (options.ignoreSect) {
            // 忽略门派：直接使用全局全池，但排除辅助函数
            candidateIds = Object.keys(SkillRegistry).filter(id => typeof SkillRegistry[id] !== 'function');
        } else if (options.sect) {
            // 门派池
            candidateIds = SectSkills[options.sect] || [];
        } else {
            // 默认兜底：英雄所属门派
            const heroSect = this.availableHeroes[heroData.id]?.sect || 'chunyang';
            candidateIds = SectSkills[heroSect] || [];
        }

        // 2. 过滤掉已经拥有的，并根据等级过滤
        let availablePool = candidateIds.filter(id => {
            const skill = SkillRegistry[id];
            if (!skill || heroData.skills.includes(id)) return false;
            if (options.level && skill.level !== options.level) return false;
            return true;
        });

        // 3. 智能回退机制：如果不是强制门派且没有特定等级要求，且备选池已空，则尝试全局池
        if (availablePool.length === 0 && !options.forceSect && !options.level) {
            candidateIds = Object.keys(SkillRegistry).filter(id => typeof SkillRegistry[id] !== 'function');
            availablePool = candidateIds.filter(id => !heroData.skills.includes(id));
        }

        if (availablePool.length === 0) {
            this.showNotification("侠客已学贯古今，参透了世间所有的招式。");
            return null;
        }

        // 4. 随机抽取
        const count = options.count || 1;
        const selected = [];
        for (let i = 0; i < count && availablePool.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePool.length);
            const skillId = availablePool.splice(randomIndex, 1)[0];
            selected.push(skillId);
            
            heroData.skills.push(skillId);
            const skill = SkillRegistry[skillId];
            this.showNotification(`感悟成功！获得了新招式：【${skill.name}】`);
            console.log(`%c[技能获得] %c侠客感悟了招式: ${skill.name} (${skillId})`, 'color: #ff00ff; font-weight: bold', 'color: #fff');
        }

        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
        return selected;
    }

    /**
     * 模拟简单战斗的结算逻辑
     * @param {Object} enemyConfig 敌人配置
     * @param {number} scaledPoints 敌人战力
     * @returns {Object} { isVictory: true, settlementChanges, xpGained, xpBefore, xpMaxBefore, levelBefore, xpAfter, xpMaxAfter, levelAfter }
     */
    simulateSimpleBattle(enemyConfig, scaledPoints) {
        const playerPower = this.getPlayerTotalPower();
        const ratio = playerPower / (scaledPoints || 1);

        // 1. 计算总兵力
        let totalCount = 0;
        const armyList = []; // [{type, count, cost}]
        for (const type in this.heroArmy) {
            const count = this.heroArmy[type];
            if (count > 0) {
                totalCount += count;
                // 核心重构：使用统御占用 (Leadership Cost) 而不是招募金币
                const cost = this.getUnitCost(type);
                armyList.push({ type, count, cost });
            }
        }

        // 2. 计算浮动损失 (最高 5%)
        // 线性浮动逻辑：比值为 1.5 (判定简单的门槛) 时损失 5%，比值达到 5.0 (绝对压制) 时损失 0%
        const minRatio = 1.5;
        const maxRatio = 5.0;
        const maxLossRate = 0.05;
        
        const t = Math.max(0, Math.min(1, (ratio - minRatio) / (maxRatio - minRatio)));
        const lossRate = maxLossRate * (1 - t);

        // 核心重构：基于“统御价值”的确定性损失逻辑 (反向取整)
        // 1. 先计算出队伍的总统御价值和理论损失的统御量
        let totalArmyValue = 0;
        let minUnitCost = Infinity;
        for (const item of armyList) {
            totalArmyValue += item.count * item.cost;
            if (item.cost < minUnitCost) minUnitCost = item.cost;
        }

        const theoreticalLeadershipLoss = totalArmyValue * lossRate;

        // 2. 如果理论损失的统御量，连队伍里统御占用最少的兵都“扣不起”，则直接判定为零损耗
        let targetLoss = 0;
        if (theoreticalLeadershipLoss >= minUnitCost) {
            // 如果够扣，则按照比例计算具体的损失人数
            targetLoss = Math.round(totalCount * lossRate);
        } else {
            console.log(`%c[自动战斗] %c理论损失统御(${theoreticalLeadershipLoss.toFixed(2)}) 低于最小单位占用(${minUnitCost})，判定为无损！`, 'color: #4CAF50', 'color: #888');
        }

        const armyChanges = {};
        const settlementChanges = []; // [{type, loss, gain}]
        
        // 按价格从低到高排序
        armyList.sort((a, b) => a.cost - b.cost);

        const survivalRate = modifierManager.getModifiedValue({ side: 'player' }, 'survival_rate', 0);

        for (const item of armyList) {
            if (targetLoss <= 0) break;

            const lossAmount = Math.min(item.count, targetLoss);
            targetLoss -= lossAmount;

            // 医疗救回逻辑
            let saved = 0;
            for (let i = 0; i < lossAmount; i++) {
                if (Math.random() < survivalRate) {
                    saved++;
                }
            }

            const finalLoss = lossAmount - saved;
            
            if (lossAmount > 0) {
                settlementChanges.push({
                    type: item.type,
                    loss: -lossAmount,
                    gain: saved
                });
            }

            if (finalLoss > 0) {
                armyChanges[item.type] = -finalLoss;
            }
        }

        // 3. 更新兵力
        this.updateHeroArmy(armyChanges);

        // 4. 计算阅历 (参考 BattleScene.js 逻辑)
        const xpGained = Math.floor(scaledPoints * 4 * (1.0 + timeManager.getGlobalProgress() * 0.05));
        
        const data = this.heroData;
        const xpBefore = data.xp;
        const xpMaxBefore = data.xpMax;
        const levelBefore = data.level;
        
        this.gainXP(xpGained);

        const xpAfter = data.xp;
        const xpMaxAfter = data.xpMax;
        const levelAfter = data.level;

        return {
            isVictory: true,
            settlementChanges,
            xpGained,
            xpBefore,
            xpMaxBefore,
            levelBefore,
            xpAfter,
            xpMaxAfter,
            levelAfter,
            enemyConfig
        };
    }

    updateHUD() {
        // 核心改动：在 HUD 更新前，同步建筑效果，确保显示的属性（如招募价格）是最新的
        this.syncBuildingsToModifiers();

        const resources = ['gold', 'wood'];
        resources.forEach(res => {
            const el = document.getElementById(`world-${res}`);
            if (el) el.innerText = this.resources[res];
        });
    }

    /**
     * 更新英雄队伍兵力 (例如战斗损耗)
     * @param {Object} changes 兵力变动，如 { melee: -2, archer: -1 }
     */
    updateHeroArmy(changes) {
        let changed = false;
        for (const type in changes) {
            if (this.heroArmy[type] !== undefined || changes[type] > 0) {
                const oldValue = this.heroArmy[type] || 0;
                this.heroArmy[type] = Math.max(0, oldValue + changes[type]);
                if (this.heroArmy[type] !== oldValue) {
                    changed = true;
                    const unitName = this.getUnitDisplayName(type);
                    const diff = changes[type];
                    const sign = diff > 0 ? '+' : '';
                    console.log(`%c[兵力变动] %c【${unitName}】 ${sign}${diff}`, diff > 0 ? 'color: #44ff44' : 'color: #ff4444', 'color: #fff');
                }
            }
        }
        if (changed) {
            this.updateHUD();
        }
    }

    /**
     * 增加金钱接口
     */
    addGold(amount) {
        if (amount <= 0) return;
        this.resources.gold += amount;
        this.updateHUD();
        this.triggerResourceAnimation('gold');
        
        audioManager.play('source_gold');
        
        // 派发事件供大世界显示飘字
        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'gold', amount: amount } 
        }));
    }

    /**
     * 增加木材接口
     */
    addWood(amount) {
        if (amount <= 0) return;
        this.resources.wood += amount;
        this.updateHUD();
        this.triggerResourceAnimation('wood');

        audioManager.play('source_wood');

        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'wood', amount: amount } 
        }));
    }

    /**
     * 消耗金钱接口
     */
    spendGold(amount) {
        if (this.resources.gold >= amount) {
            this.resources.gold -= amount;
            this.updateHUD();
            return true;
        }
        return false;
    }

    /**
     * 消耗木材接口
     */
    spendWood(amount) {
        if (this.resources.wood >= amount) {
            this.resources.wood -= amount;
            this.updateHUD();
            return true;
        }
        return false;
    }

    /**
     * 检查资源是否足够
     */
    hasResources(costs) {
        const goldNeeded = costs.gold || 0;
        const woodNeeded = costs.wood || 0;
        return this.resources.gold >= goldNeeded && this.resources.wood >= woodNeeded;
    }

    /**
     * 同时消耗多种资源 (原子操作，要么全扣，要么不扣)
     */
    spendResources(costs) {
        if (this.hasResources(costs)) {
            if (costs.gold) this.resources.gold -= costs.gold;
            if (costs.wood) this.resources.wood -= costs.wood;
            this.updateHUD();
            return true;
        }
        return false;
    }

    /**
     * 英雄获得经验并处理升级
     */
    /**
     * 计算指定等级升到下一级所需的总经验 (核心公式重构)
     * 公式：xpMax = floor(120 + 80*(level-1) + 40*(level-1)^1.3)
     */
    getNextLevelXP(level) {
        if (level < 1) return 120;
        const L = level - 1;
        return Math.floor(120 + 80 * L + 40 * Math.pow(L, 1.3));
    }

    gainXP(amount) {
        if (amount <= 0) return;
        
        // 应用全局阅历获取加成 (来自悦来客栈等)
        const bonusAmount = Math.ceil(modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'xp_gain', amount));
        const finalAmount = bonusAmount;

        const data = this.heroData;
        data.xp += finalAmount;
        
        // 派发事件供大世界显示飘字
        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'xp', amount: finalAmount } 
        }));
        
        while (data.xp >= data.xpMax) {
            data.xp -= data.xpMax;
            data.level++;
            
            // 使用新公式计算下一级经验
            data.xpMax = this.getNextLevelXP(data.level);
            
            // --- 属性固定成长系统 ---
            const s = data.stats;
            s.power += 4;          // 每级力道/身法降低到 +4
            s.spells += 2;         // 侠客功法 (技能强度)
            s.morale += 2;         // 统帅军队 (+2%)
            s.leadership += 6;     // 带兵上限每级 +6
            // s.speed 保持不变
            s.haste += 0.01;       // 招式调息 (每级 1%，不再在数据源层级截断，由 ModifierManager 统一出口截断)
            
            // 核心重构：刷新所有基于属性的修正器，并更新 hpMax/mpMax
            this.refreshHeroStats();

            // 升级不再自动补满生命和内力
            // data.hpCurrent = data.hpMax;
            // data.mpCurrent = data.mpMax; 

            data.talentPoints++; // 每升一级获得 1 点奇穴点数
            data.pendingLevelUps++; // 核心：增加待播放反馈计数

            console.log(`%c[升级] %c英雄升到了第 ${data.level} 级！获得 1 点奇穴点数。`, 'color: #00ff00; font-weight: bold', 'color: #fff');
            
            // 派发升级事件 (供 UI 表现使用)
            window.dispatchEvent(new CustomEvent('hero-level-up'));
        }
        
        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
    }

    /**
     * 触发 UI 动画反馈
     */
    triggerResourceAnimation(type) {
        const el = document.getElementById(`world-${type}`);
        if (!el) return;
        
        const parent = el.closest('.res-item');
        if (!parent) return;

        // 移除旧动画类并强制重绘
        parent.classList.remove('res-update-anim');
        void parent.offsetWidth; 
        parent.classList.add('res-update-anim');
    }

    /**
     * 获取兵种详情（包含名称、配置及修正后的真实数据）
     */
    /**
     * 获取英雄初始身份数据
     */
    getHeroIdentity(heroId) {
        return HERO_IDENTITY[heroId];
    }

    /**
     * 获取当前英雄的所有固有特性
     */
    getHeroTraits(heroId) {
        const identity = HERO_IDENTITY[heroId];
        return identity ? identity.traits : [];
    }

    /**
     * 获取兵种蓝图 (基础属性 + 英雄成长)
     * 职责：专供战斗单位构造函数使用，作为计算基准，不包含全局 Buff
     */
    getUnitBlueprint(type) {
        const baseBlueprint = UNIT_STATS_DATA_INTERNAL[type];
        // 核心修复：蓝图层级就使用 getUnitCost，确保所有由此创建的单位 (BaseUnit) 初始 cost 正确
        const cost = this.getUnitCost(type);

        // 基础数据克隆
        let stats = baseBlueprint ? { ...baseBlueprint, cost } : { 
            name: type, hp: 0, atk: 0, speed: 0, attackSpeed: 1000, cost 
        };

        // --- 英雄基础蓝图 (返回 1 级原始数值，成长由 ModifierManager 处理) ---
        if (this.heroData && this.heroData.id === type) {
            const identity = this.getHeroIdentity(type);
            const cb = identity.combatBase;

            stats.hp = cb.hpBase;
            stats.mp = this._getHeroBaseStat(type, 'mpBase', 80); 
            stats.atk = cb.atk;
            // 核心修复：英雄进入战斗后的基础移速单位应与普通士兵 (4.0 左右) 匹配，使用英雄自身的局内移速
            stats.speed = this.heroData.stats.battleSpeed || 4.0; 
        }

        return stats;
    }

    /**
     * 获取兵种最终详情 (蓝图 + 全局修正)
     * 职责：全游戏唯一合法的显示数据出口，解决 UI 显示不一致问题
     */
    getUnitDetails(type, side = 'player') {
        const blueprint = this.getUnitBlueprint(type);
        const dummyUnit = { side: side, type: type, isHero: this.heroData && this.heroData.id === type };
        
        // 1. 应用所有全局动态修正
        const finalHP = Math.ceil(modifierManager.getModifiedValue(dummyUnit, 'hp', blueprint.hp));
        
        // 核心修正：治疗职业也使用正数进行数值计算，避免数学公式导致的数值倒扣 Bug
        const finalAtk = modifierManager.getModifiedValue(dummyUnit, 'attackDamage', blueprint.atk);
        
        // 核心重构：区分局内局外速度修正
        const finalSpeed = modifierManager.getModifiedValue(dummyUnit, 'speed', blueprint.speed);
        
        // 如果是英雄，还需要额外计算轻功 (大世界速度)
        let finalQinggong = 0;
        if (this.heroData && this.heroData.id === type) {
            finalQinggong = modifierManager.getModifiedValue(dummyUnit, 'qinggong', this.heroData.stats.qinggong);
        }

        // 核心修正：应用全局攻速加成 (注意：攻速加成是频率提升，对应间隔缩短)
        const speedMult = modifierManager.getModifiedValue(dummyUnit, 'attackSpeed', 1.0);
        const finalInterval = blueprint.attackSpeed / speedMult;
        
        // 2. DPS 换算
        const burstCount = blueprint.burstCount || 1;
        const dps = Math.ceil((finalAtk * burstCount / finalInterval) * 1000);

        return {
            ...blueprint,
            hp: finalHP,
            atk: Math.ceil(finalAtk),
            speed: finalSpeed,
            qinggong: finalQinggong || finalSpeed, // 如果不是英雄，则 fallback 到普通速度
            dps: dps,
            cost: this.getUnitCost(type) // 确保这里也带上最新的 cost
        };
    }

    /**
     * 从英雄队伍移动士兵到城市 (驻守)
     */
    transferToCity(type, amount, cityId = 'main_city_1') {
        if (!this.isPlayerAtCity(cityId)) return false;

        if (this.heroArmy[type] >= amount) {
            this.heroArmy[type] -= amount;
            this.cities[cityId].availableUnits[type] = (this.cities[cityId].availableUnits[type] || 0) + amount;
            this.updateHUD(); // 确保 HUD 同步
            return true;
        }
        return false;
    }

    /**
     * 获取英雄当前最大统御上限 (包含天赋、装备等修正)
     */
    getHeroMaxLeadership() {
        const dummy = this.getPlayerHeroDummy();
        return Math.floor(modifierManager.getModifiedValue(dummy, 'leadership', this.heroData.stats.leadership));
    }

    /**
     * 计算英雄当前队伍的总领导力消耗 (带兵量)
     */
    getHeroCurrentLeadership() {
        let current = 0;
        for (const type in this.heroArmy) {
            const count = this.heroArmy[type];
            if (count > 0 && this.unitCosts[type]) {
                current += count * this.getUnitCost(type);
            }
        }
        return current;
    }

    /**
     * 获取英雄的基础属性配置 (唯一真理源)
     * 解决多重定义问题，支持 Debug 模式覆盖
     */
    _getHeroBaseStat(heroId, statName, defaultValue) {
        const isCheat = WorldManager.DEBUG.ENABLED && WorldManager.DEBUG.START_RESOURCES;
        
        // 专门处理蓝量的 Cheat 逻辑 (如果处于 Cheat 模式，且请求的是基础蓝量)
        if (statName === 'mpBase' && isCheat) return 999;
        
        // 如果数据表中有该项，则返回数据表中的值
        const identity = this.getHeroIdentity(heroId);
        if (identity && identity.combatBase && identity.combatBase[statName] !== undefined) {
            return identity.combatBase[statName];
        }
        
        return defaultValue;
    }

    /**
     * 刷新英雄的所有全局修正器 (包含成长、统帅加成等)
     * 职责：将英雄的当前状态 (Level, Power, Morale) 同步到 ModifierManager
     */
    refreshHeroStats() {
        if (!this.heroData) return;
        
        const data = this.heroData;
        const s = data.stats;
        const identity = this.getHeroIdentity(data.id);
        if (!identity) return;
        
        const cb = identity.combatBase;
        const dummy = this.getPlayerHeroDummy();

        // --- 核心修复：获取经过奇穴/天赋加成后的“真实属性点” ---
        // 这一步至关重要，否则奇穴点的力道不会增加血量和攻击
        const realPower = modifierManager.getModifiedValue(dummy, 'power', s.power);
        const realSpells = modifierManager.getModifiedValue(dummy, 'spells', s.spells);
        const realMorale = modifierManager.getModifiedValue(dummy, 'morale', s.morale);

        // 1. 统率修正 (基于真实统帅值) - 仅对小兵生效 (unitType: 'army')
        modifierManager.addModifier({ 
            id: 'soldier_morale_atk', 
            side: 'player', 
            unitType: 'army', // 核心修正：只影响非英雄单位
            stat: 'attackDamage', 
            multiplier: 1.0 + (realMorale / 100), 
            source: 'hero_stats' 
        });
        modifierManager.addModifier({ 
            id: 'soldier_morale_hp', 
            side: 'player', 
            unitType: 'army', // 核心修正：只影响非英雄单位
            stat: 'hp', 
            multiplier: 1.0 + (realMorale / 100), 
            source: 'hero_stats' 
        });

        // 2. 英雄自身基础数值与成长
        modifierManager.addModifier({
            id: 'hero_growth_hp',
            side: 'player',
            unitType: data.id, 
            stat: 'hp',
            offset: realPower * cb.hpScaling,
            source: 'hero_stats'
        });

        modifierManager.addModifier({
            id: 'hero_growth_atk',
            side: 'player',
            unitType: data.id,
            stat: 'primary_attack_mult', // 专用桶：主属性普攻倍率
            multiplier: 1.0 + (realPower * (cb.atkScaling || 0.05)),
            source: 'hero_stats'
        });

        // 3. 同步更新 heroData 冗余字段 (仅用于 UI 简单显示)
        data.hpMax = Math.ceil(modifierManager.getModifiedValue(dummy, 'hp', cb.hpBase));
        
        // 核心修复：内力上限应受数据表 mpBase 和 mpScaling 控制
        const baseMpStart = this._getHeroBaseStat(data.id, 'mpBase', 80);
        const scalingMp = this._getHeroBaseStat(data.id, 'mpScaling', 6);
        const baseMp = baseMpStart + (data.level - 1) * scalingMp;
        data.mpMax = Math.ceil(modifierManager.getModifiedValue(dummy, 'mp', baseMp));
        
        // 确保 stats 中的冗余字段反映的是 ModifierManager 的最终输出
        data.stats.finalSpells = modifierManager.getModifiedValue(dummy, 'skill_power', realSpells);
        data.stats.finalHaste = modifierManager.getModifiedValue(dummy, 'haste', 0);
        data.stats.finalLeadership = this.getHeroMaxLeadership();
        
        // 4. 重新加载英雄固有天赋
        modifierManager.removeModifiersBySource('trait');
        const traits = this.getHeroTraits(data.id);
        traits.forEach(trait => {
            modifierManager.addModifier({
                ...trait,
                side: 'player',
                unitType: trait.unitType || data.id,
                source: 'trait'
            });
        });
    }

    /**
     * 获取玩家主角的“影子对象”(用于 ModifierManager 匹配)
     */
    getPlayerHeroDummy() {
        return {
            side: 'player',
            isHero: true,
            type: this.heroData.id
        };
    }

    /**
     * 从城市移动士兵到英雄队伍
     */
    transferToHero(type, amount, cityId = 'main_city_1') {
        if (!this.isPlayerAtCity(cityId)) return false;

        const city = this.cities[cityId];
        const unitCost = this.getUnitCost(type);
        const totalCostToAdd = amount * unitCost;
        
        const currentLeadership = this.getHeroCurrentLeadership();
        const maxLeadership = this.getHeroMaxLeadership();

        if (currentLeadership + totalCostToAdd > maxLeadership) {
            this.showNotification(`统御容量不足！当前占用: ${currentLeadership}/${maxLeadership}，该操作需额外占用 ${totalCostToAdd} 点数`);
            return false;
        }

        if (city.availableUnits[type] >= amount) {
            city.availableUnits[type] -= amount;
            this.heroArmy[type] = (this.heroArmy[type] || 0) + amount;
            this.updateHUD(); // 确保调兵后刷新 HUD
            return true;
        }
        return false;
    }
}

export const worldManager = new WorldManager();

// 初始化奇穴管理器
talentManager.init(worldManager.heroData);


