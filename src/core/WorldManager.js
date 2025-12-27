import { modifierManager } from './ModifierManager.js';
import { SkillRegistry } from './SkillRegistry.js';
import { audioManager } from './AudioManager.js';
import { UNIT_STATS_DATA, UNIT_COSTS, HERO_IDENTITY } from '../data/UnitStatsData.js';

/**
 * 1. 建筑全量注册表：定义所有建筑的元数据
 * 这种方式将数据与逻辑彻底分离，以后增加建筑只需在此处添加
 */
const BUILDING_REGISTRY = {
    'town_hall': { name: '议政厅', category: 'economy', maxLevel: 3, icon: 'main_city', cost: { gold: 500, wood: 100 }, description: '大权统筹：提升每季度的税收金钱产出。' },
    'market': { name: '市场', category: 'economy', maxLevel: 3, icon: 'merchant_guild', cost: { gold: 300, wood: 50 }, description: '互通有无：提高城镇的金钱与木材产出效率。' },
    'inn': { name: '悦来客栈', category: 'economy', maxLevel: 3, icon: 'pagoda_library', cost: { gold: 800, wood: 400 }, description: '江湖传闻：每级增加全军 15% 的阅历（经验）获取速度。' },
    'bank': { name: '大通钱庄', category: 'economy', maxLevel: 3, icon: 'imperial_treasury', cost: { gold: 1500, wood: 300 }, description: '财源广进：每级提升该城镇 20% 的金钱产出。' },
    'trade_post': { name: '马帮驿站', category: 'economy', maxLevel: 3, icon: 'distillery_v2', cost: { gold: 1000, wood: 600 }, description: '辎重运输：每级增加城镇木材产出，并降低全军招募成本 5%。' },
    
    // 军事建筑：现在每级都有数值成长
    'barracks': { name: '兵营', category: 'military', maxLevel: 5, icon: 'melee', cost: { gold: 400, wood: 150 }, description: '训练基础步兵。每级增加全军近战兵种 15% 生命。' },
    'archery_range': { name: '靶场', category: 'military', maxLevel: 5, icon: 'archer', cost: { gold: 400, wood: 200 }, description: '招募唐门射手。每级增加全军远程兵种 15% 伤害。' },
    'stable': { name: '天策马厩', category: 'military', maxLevel: 5, icon: 'tiance', cost: { gold: 800, wood: 300 }, description: '招募天策骑兵。每级增加天策骑兵 15% 伤害与生命。' },
    'sword_forge': { name: '藏剑剑庐', category: 'military', maxLevel: 5, icon: 'cangjian', cost: { gold: 900, wood: 400 }, description: '招募藏剑弟子。每级增加藏剑弟子 15% 伤害与生命。' },
    'martial_shrine': { name: '苍云讲武堂', category: 'military', maxLevel: 5, icon: 'cangyun', cost: { gold: 850, wood: 450 }, description: '招募苍云将士。每级增加苍云将士 15% 生命与防御。' },
    'mage_guild': { name: '纯阳道场', category: 'military', maxLevel: 5, icon: 'chunyang', cost: { gold: 1000, wood: 500 }, description: '招募纯阳弟子。每级增加纯阳弟子 15% 属性。' },
    'medical_pavilion': { name: '万花医馆', category: 'military', maxLevel: 5, icon: 'healer', cost: { gold: 700, wood: 350 }, description: '招募万花弟子。每级增加万花弟子 15% 气血与疗效。' },
    
    'spell_altar': { name: '功法祭坛', category: 'magic', maxLevel: 3, icon: 'spell_altar_v2', cost: { gold: 1200, wood: 600 }, description: '博采众长：每级随机感悟全江湖招式。' },
    'treasure_pavilion': { name: '藏宝阁', category: 'economy', maxLevel: 1, icon: 'treasure_pavilion_v2', cost: { gold: 2000, wood: 800 }, description: '琳琅满目：极其罕见的珍宝汇聚之地。' },
    
    // 纯阳：招式研习
    'sect_chunyang_basic': { name: '两仪馆', category: 'magic', maxLevel: 2, icon: 'sect_chunyang_v3', cost: { gold: 400, wood: 200 }, description: '纯阳基础：感悟纯阳【初级】招式。' },
    'sect_chunyang_advanced': { name: '太极殿', category: 'magic', maxLevel: 5, icon: 'sect_chunyang_v3', cost: { gold: 1000, wood: 500 }, description: '纯阳进阶：感悟纯阳【高级】招式。' },
    'sect_chunyang_ultimate': { name: '纯阳宫', category: 'magic', maxLevel: 1, icon: 'sect_chunyang_v3', cost: { gold: 2500, wood: 1200 }, description: '纯阳绝学：感悟纯阳【绝技】招式。' },

    // 天策：招式研习
    'sect_tiance_basic': { name: '演武场', category: 'magic', maxLevel: 2, icon: 'dummy_training', cost: { gold: 400, wood: 200 }, description: '天策基础：感悟天策【初级】招式。' },
    'sect_tiance_advanced': { name: '凌烟阁', category: 'magic', maxLevel: 5, icon: 'dummy_training', cost: { gold: 1000, wood: 500 }, description: '天策进阶：感悟天策【高级】招式。' },
    'sect_tiance_ultimate': { name: '天策府', category: 'magic', maxLevel: 1, icon: 'dummy_training', cost: { gold: 2500, wood: 1200 }, description: '天策绝学：感悟天策【绝技】招式。' },

    // 藏剑：招式研习
    'sect_cangjian_basic': { name: '问水亭', category: 'magic', maxLevel: 2, icon: 'sect_cangjian_v3', cost: { gold: 400, wood: 200 }, description: '藏剑基础：感悟藏剑【初级】招式。' },
    'sect_cangjian_advanced': { name: '山外山', category: 'magic', maxLevel: 5, icon: 'sect_cangjian_v3', cost: { gold: 1000, wood: 500 }, description: '藏剑进阶：感悟藏剑【高级】招式。' },
    'sect_cangjian_ultimate': { name: '藏剑庐', category: 'magic', maxLevel: 1, icon: 'sect_cangjian_v3', cost: { gold: 2500, wood: 1200 }, description: '藏剑绝学：感悟藏剑【绝技】招式。' },

    'clinic': { name: '医馆', category: 'magic', maxLevel: 1, icon: 'clinic_v3', cost: { gold: 600, wood: 300 }, description: '仁心仁术：战场上死去的士兵有 20% 概率伤愈归队，减少损耗。' }
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
        this.production = { gold: 1000, wood: 200 };
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
     * 动态获取当前城市所有的建筑列表
     * 基于城市自身的 blueprintId，与当前 owner 无关，实现了“夺城而不改制”的战略感
     */
    getAvailableBuildings() {
        const list = { economy: [], military: [], magic: [] };
        const blueprint = BLUEPRINTS[this.blueprintId] || BLUEPRINTS['chunyang'];
        
        blueprint.forEach(id => {
            const meta = BUILDING_REGISTRY[id];
            if (meta) {
                list[meta.category].push({ 
                    id, 
                    ...meta, 
                    maxLevel: this.getBuildingMaxLevel(id), // 使用动态最大等级
                    level: this.buildingLevels[id] || 0 
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
     * 效果分发器
     */
    _applyEffect(id, level) {
        console.log(`%c[建设] %c${id} 升级至 Lv.${level}`, 'color: #a68b44; font-weight: bold', 'color: #fff');
        
        // --- 商业建筑效果 ---
        if (id === 'town_hall') {
            // 每级增加 200 金钱产出
            this.production.gold += 200;
        } else if (id === 'market') {
            // 每级增加 100 金钱和 50 木材
            this.production.gold += 100;
            this.production.wood += 50;
        } else if (id === 'bank') {
            // 每级增加该城市当前金钱产出的 20% (基于初始 1000 的基数，约 200)
            this.production.gold += 200;
        } else if (id === 'trade_post') {
            // 每级增加 80 木材，并降低全局招募成本 5%
            this.production.wood += 80;
            modifierManager.addGlobalModifier({ 
                id: `city_${this.id}_recruit_discount`, 
                side: 'player', 
                stat: 'recruit_cost', 
                multiplier: 1.0 - (level * 0.05) 
            });
        } else if (id === 'inn') {
            // 每级增加全军阅历获取 15%
            modifierManager.addGlobalModifier({ 
                id: `city_${this.id}_xp_bonus`, 
                side: 'player', 
                stat: 'xp_gain', 
                multiplier: 1.0 + (level * 0.15) 
            });
        }
        // --- 特殊建筑效果 ---
        else if (id === 'spell_altar') {
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

        // --- 军事建筑数值增强系统 ---
        // 逻辑：每升一级提供 15% 的全局属性增益
        const multiplier = 1.0 + (level * 0.15); 
        
        switch (id) {
            case 'barracks':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_melee_hp`, side: 'player', unitType: 'melee', stat: 'hp', multiplier: multiplier });
                break;
            case 'archery_range':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_ranged_dmg`, side: 'player', unitType: 'ranged', stat: 'damage', multiplier: multiplier });
                break;
            case 'stable':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_tiance_bonus`, side: 'player', unitType: 'tiance', stat: 'damage', multiplier: multiplier });
                modifierManager.addGlobalModifier({ id: `city_${this.id}_tiance_hp`, side: 'player', unitType: 'tiance', stat: 'hp', multiplier: multiplier });
                break;
            case 'sword_forge':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_cangjian_bonus`, side: 'player', unitType: 'cangjian', stat: 'damage', multiplier: multiplier });
                modifierManager.addGlobalModifier({ id: `city_${this.id}_cangjian_hp`, side: 'player', unitType: 'cangjian', stat: 'hp', multiplier: multiplier });
                break;
            case 'martial_shrine':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_cangyun_hp`, side: 'player', unitType: 'cangyun', stat: 'hp', multiplier: multiplier });
                // 核心重构：直接增加 15% 减伤百分点，不再做 2 - x 的复杂换算
                modifierManager.addGlobalModifier({ id: `city_${this.id}_cangyun_def`, side: 'player', unitType: 'cangyun', stat: 'damage_reduction', offset: level * 0.15 });
                break;
            case 'mage_guild':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_chunyang_bonus`, side: 'player', unitType: 'chunyang', stat: 'damage', multiplier: multiplier });
                break;
            case 'medical_pavilion':
                modifierManager.addGlobalModifier({ id: `city_${this.id}_healer_hp`, side: 'player', unitType: 'healer', stat: 'hp', multiplier: multiplier });
                modifierManager.addGlobalModifier({ id: `city_${this.id}_healer_bonus`, side: 'player', unitType: 'healer', stat: 'damage', multiplier: multiplier });
                break;
            case 'clinic':
                // 仁心仁术：每级增加 20% 战场存活率 (修正器 offset 模式)
                modifierManager.addGlobalModifier({ id: `city_${this.id}_clinic_survival`, side: 'player', stat: 'survival_rate', offset: level * 0.20 });
                break;
        }
    }

    isBuildingBuilt(buildingId) {
        return (this.buildingLevels[buildingId] || 0) > 0;
    }

    getIconKey() {
        return this.type;
    }

    /**
     * 获取总产出（包含城镇基础产出 + 挂载的外围矿产）
     */
    getTotalProduction() {
        let gold = this.production.gold;
        let wood = this.production.wood;
        
        // 核心逻辑：如果该城市是主城 (main_city_1)，则额外统计全图所有已占领矿产的收益
        // 这使得“外围矿产”在 UI 显示上更具整体感
        if (this.id === 'main_city_1' && this.owner === 'player') {
            worldManager.capturedBuildings.forEach(b => {
                if (b.owner === 'player') {
                    if (b.type === 'gold_mine') gold += 200;
                    if (b.type === 'sawmill') wood += 100;
                }
            });
        }
        
        return { gold, wood };
    }
}

/**
 * 大世界数据管理器 (单例)
 * 负责追踪资源、英雄兵力、城镇兵力
 */
class WorldManager {
    constructor() {
        // 0. 势力定义
        this.availableHeroes = {
            'qijin': { name: '祁进', title: '紫虚子', icon: 'qijin', sect: 'chunyang', color: '#44ccff', primaryStat: '力道' }, 
            'lichengen': { name: '李承恩', title: '天策府统领', icon: 'lichengen', sect: 'tiance', color: '#ff4444', primaryStat: '力道' }, 
            'yeying': { name: '叶英', title: '藏剑大庄主', icon: 'cangjian', sect: 'cangjian', color: '#ffcc00', primaryStat: '身法' } 
        };

        this.factions = {}; // 记录所有势力数据 { factionId: { heroId, cities: [], army: {} } }

        // 1. 基础资源 (初始资源调低，增加探索动力)
        this.resources = {
            gold: 1000,
            wood: 500
        };

        // 2. 英雄数据 (持久化状态)
        this.heroData = {
            id: 'qijin', // 默认，初始化时会被覆盖
            level: 1,
            xp: 0,
            xpMax: 100, // 下一级所需经验
            hpMax: 500,
            hpCurrent: 500,
            mpMax: 160,
            mpCurrent: 160,
            skills: [],
            stats: {
                morale: 40,           // 统帅：军队 (同时影响士兵攻击和血量)
                power: 50,            // 武力：英雄体魄与伤害
                spells: 100,          // 功法：招式强度
                speed: 0.08,
                haste: 0,
                leadership: 20,       // 带兵容量上限
            }
        };

        this.heroArmy = {
            'melee': 4,
            'ranged': 3,
            'tiance': 0,
            'chunyang': 0,
            'cangjian': 0,
            'cangyun': 0,
            'archer': 0,
            'healer': 0
        };

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
            pendingBattleEnemyId: null   // 新增：正在进行的战斗目标 ID
        };

        // 5. 占领建筑状态 (已整合进 entities，保留此数组用于快速结算收益)
        this.capturedBuildings = []; 

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
                overworldIcon: 'qijin', 
                unitPool: ['chunyang', 'ranged'],
                basePoints: 70,
                baseWeight: 0, 
                sectHero: 'qijin', 
                description: '纯阳与长歌的弟子结伴而行，攻守兼备。'
            },
            'tiance_disciples_group': {
                name: '天策弟子',
                overworldIcon: 'melee', 
                unitPool: ['tiance', 'melee'],
                basePoints: 70,
                baseWeight: 0, 
                sectHero: 'lichengen', 
                description: '天策府的精锐小队，包含强悍的骑兵和坚韧的步兵。'
            },
            'cangjian_disciples_group': {
                name: '藏剑弟子',
                overworldIcon: 'cangjian', 
                unitPool: ['cangjian', 'melee'],
                basePoints: 70,
                baseWeight: 0,
                sectHero: 'yeying', 
                description: '西子湖畔藏剑山庄的弟子，擅长剑法。'
            }
        };
    }

    /**
     * 工业级动态权重系统：完全基于地理生态的敌人生成
     */
    getDynamicEnemyType(worldX, worldZ) {
        const playerHeroId = this.heroData.id;
        const distToPlayer = Math.sqrt(Math.pow(worldX - this.mapState.playerPos.x, 2) + Math.pow(worldZ - this.mapState.playerPos.z, 2));
        
        const tempWeights = {};
        let sumBaseWeights = 0;

        // --- 1. 计算环境基础权重 ---
        for (const [id, template] of Object.entries(this.enemyTemplates)) {
            let w = template.baseWeight || 0;
            if (w <= 0 && !template.sectHero) continue; // 排除无权重的非门派单位

            // 稻香村平滑保护 (仅影响 45m 内)
            if (distToPlayer < 45) {
                const protectionFactor = distToPlayer / 45; // 0.0(中心) -> 1.0(边缘)
                if (template.isBasic) {
                    // 越简单的怪，在稻香村附近的权重提升越夸张
                    // 特别针对最简单的“林间小生灵”和“山贼前哨”
                    let simplicityBonus = 5;
                    if (id === 'woodland_critters') simplicityBonus = 15; // 极大幅度提升
                    if (id === 'bandit_outpost') simplicityBonus = 10;    // 大幅度提升
                    
                    w *= (1 + (1 - protectionFactor) * simplicityBonus);
                } else {
                    // 强力怪在稻香村附近几乎绝迹 (使用二次方衰减)
                    w *= Math.pow(protectionFactor, 2); 
                }
            }
            
            tempWeights[id] = w;
            sumBaseWeights += w;
        }

        // --- 2. 注入势力地理权重 (平滑激活门派兵) ---
        Object.values(this.cities).forEach(city => {
            const distToCity = Math.sqrt(Math.pow(worldX - city.x, 2) + Math.pow(worldZ - city.z, 2));
            if (distToCity >= 45) return;

            const faction = this.factions[city.owner];
            if (!faction || faction.heroId === playerHeroId) return;

            const falloff = 1 - (distToCity / 45); // 1.0(中心) -> 0.0(边缘)
            
            // 查找所有匹配该城市英雄的模板
            for (const [id, template] of Object.entries(this.enemyTemplates)) {
                if (template.sectHero === faction.heroId) {
                    // 动态注入权重：在中心处占比 80% (即其他总分的 4 倍)
                    const bonus = (sumBaseWeights * 4) * falloff;
                    tempWeights[id] = (tempWeights[id] || 0) + bonus;
                }
            }

            // 敌对城市周围的基础威胁度加成
            if (city.owner !== 'player') {
                ['rebels', 'shadow_sect'].forEach(id => {
                    if (tempWeights[id]) tempWeights[id] *= (1 + falloff * 2);
                });
            }
        });

        return this.weightedRandomSelect(tempWeights);
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
     * 资源产出 Tick：根据所有城镇的产出增加全局资源
     */
    processResourceProduction() {
        let totalGoldGain = 0;
        let totalWoodGain = 0;
        
        // 核心改动：现在所有外围矿产的产出都已集成到 City.getTotalProduction() 中（尤其是主城）
        for (const cityId in this.cities) {
            const city = this.cities[cityId];
            if (city.owner === 'player') {
                const prod = city.getTotalProduction();
                totalGoldGain += prod.gold;
                totalWoodGain += prod.wood;
            }
        }

        if (totalGoldGain > 0) this.addGold(totalGoldGain);
        if (totalWoodGain > 0) this.addWood(totalWoodGain);
        
        console.log(`%c[季度结算] %c总收入金钱 +${totalGoldGain}, 木材 +${totalWoodGain}`, 'color: #557755; font-weight: bold', 'color: #fff');
    }

    /**
     * 招募士兵到指定城市
     */
    recruitUnit(type, cityId = 'main_city_1') {
        const baseCost = this.unitCosts[type].gold;
        // 应用全局招募折扣 (来自马帮驿站等)
        const finalCost = Math.ceil(modifierManager.getModifiedValue({ side: 'player', type: type }, 'recruit_cost', baseCost));
        
        if (this.spendGold(finalCost)) {
            const city = this.cities[cityId];
            city.availableUnits[type] = (city.availableUnits[type] || 0) + 1;
            return true;
        }
        return false;
    }

    /**
     * 将城市中的所有士兵转移到英雄身上 (受统御力限制)
     * 改进版：采用轮询机制，尽量让每一类兵种都能领到一点，而不是优先领满某一类
     */
    collectAllFromCity(cityId = 'main_city_1') {
        const city = this.cities[cityId];
        let count = 0;
        let leadershipGained = 0;
        
        const currentLeadership = this.getHeroCurrentLeadership();
        const maxLeadership = this.heroData.stats.leadership;
        let remainingLeadership = maxLeadership - currentLeadership;

        // 获取所有有余量且有成本的兵种
        const types = Object.keys(city.availableUnits).filter(type => {
            const amount = city.availableUnits[type];
            const unitCost = this.unitCosts[type]?.cost || 0;
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

                const unitCost = this.unitCosts[type].cost;
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
        if (generator.pois && generator.pois.length >= 3) {
            // 核心优化：不再随机选取，而是计算间距最大的 POI 分布
            // 势力总数 = 玩家(1) + AI(aiHeroes.length)
            const factionCount = 1 + aiHeroes.length;
            const spreadPois = this._selectSpreadPOIs(generator.pois, factionCount);

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
                
                const aiPoi = spreadPois[index + 1];
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
        }

        // --- 3. 随机实体生成 ---
        const playerSpawnX = this.mapState.playerPos.x;
        const playerSpawnZ = this.mapState.playerPos.z;

        // 新增：使用占据图来确保物体不紧贴
        const occupied = new Uint8Array(size * size); 

        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                if (!generator.isSafeGrass(x, z)) continue;

                // 检查相邻格子是否已有物体 (相邻 8 格)
                let hasAdjacent = false;
                for (let dz = -1; dz <= 1; dz++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dz === 0) continue;
                        const nx = x + dx;
                        const nz = z + dz;
                        if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
                            if (occupied[nz * size + nx]) {
                                hasAdjacent = true;
                                break;
                            }
                        }
                    }
                    if (hasAdjacent) break;
                }
                if (hasAdjacent) continue;

                const worldX = x - halfSize;
                const worldZ = z - halfSize;

                // 避开玩家和 AI 出生点
                const distToPlayer = Math.sqrt(Math.pow(worldX - playerSpawnX, 2) + Math.pow(worldZ - playerSpawnZ, 2));
                const aiCity = this.cities['ai_city_1'];
                const distToAI = aiCity ? Math.sqrt(Math.pow(worldX - aiCity.x, 2) + Math.pow(worldZ - aiCity.z, 2)) : 100;

                if (distToPlayer < 10 || distToAI < 10) continue;

                const roll = Math.random();
                let placed = false;
                if (roll < 0.002) {
                    entities.push({ id: `gold_${x}_${z}`, type: 'pickup', pickupType: 'gold_pile', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.003) {
                    entities.push({ id: `chest_${x}_${z}`, type: 'pickup', pickupType: 'chest', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.004) {
                    entities.push({ id: `chest_${x}_${z}`, type: 'pickup', pickupType: 'wood_small', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.0045) {
                    const bType = Math.random() > 0.5 ? 'gold_mine' : 'sawmill';
                    const sKey = bType === 'gold_mine' ? 'gold_mine_v2' : 'sawmill_v2';
                    entities.push({ 
                        id: `${bType}_${x}_${z}`, 
                        type: 'captured_building', 
                        spriteKey: sKey,
                        buildingType: bType, 
                        x: worldX, z: worldZ,
                        config: { owner: 'none', type: bType }
                    });
                    placed = true;
                } else if (roll < 0.008) {
                    // --- 核心优化：使用动态权重系统选择敌人类型 ---
                    const tId = this.getDynamicEnemyType(worldX, worldZ);
                    const template = this.enemyTemplates[tId];
                    
                    // 统一计算逻辑：基础战力 + 正负 15% 的随机波动
                    const variance = 0.15;
                    const randomFactor = 1 + (Math.random() * variance * 2 - variance);
                    const points = Math.max(1, Math.floor(template.basePoints * randomFactor));
                    
                    entities.push({ 
                        id: `enemy_${x}_${z}`, 
                        type: 'enemy_group', 
                        templateId: tId,
                        x: worldX, z: worldZ,
                        config: {
                            name: template.name,
                            unitPool: template.unitPool,
                            totalPoints: points
                        }
                    });
                    placed = true;
                } else if (roll < 0.015) {
                    entities.push({ id: `tree_${x}_${z}`, type: 'decoration', spriteKey: 'tree', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.017) {
                    entities.push({ id: `house_${x}_${z}`, type: 'decoration', spriteKey: 'house_1', x: worldX, z: worldZ });
                    placed = true;
                }

                if (placed) {
                    occupied[z * size + x] = 1;
                }
            }
        }

        // --- 4. 自动分配周边矿产逻辑 (圈地系统) ---
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
                total += count * (this.unitCosts[type].cost || 0);
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

        switch (itemType) {
            case 'gold_pile':
                reward.gold = Math.floor(Math.random() * 100) + 50; // 50-150 金币
                msg = `捡到了一堆金币，获得 ${reward.gold} 💰`;
                break;
            case 'chest':
                // 宝箱随机给金币或木材
                if (Math.random() > 0.5) {
                    reward.gold = Math.floor(Math.random() * 300) + 100;
                    msg = `开启了宝箱，获得 ${reward.gold} 💰`;
                } else {
                    reward.wood = Math.floor(Math.random() * 100) + 50;
                    msg = `开启了宝箱，获得 ${reward.wood} 🪵`;
                }
                reward.xp = 20; // 开启宝箱给点经验
                break;
            case 'wood_small':
                reward.wood = Math.floor(Math.random() * 50) + 30;
                msg = `捡到了木材，获得 ${reward.wood} 🪵`;
                break;
            case 'wood_large':
                reward.wood = Math.floor(Math.random() * 150) + 100;
                msg = `捡到了一大堆木材，获得 ${reward.wood} 🪵`;
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
     * 在可选 POI 中选择 n 个彼此间距最大的点
     * 解决“势力过于拥挤”的问题 (Max-Min 算法)
     */
    _selectSpreadPOIs(allPois, count) {
        if (allPois.length <= count) return allPois;

        const selected = [];
        // 1. 随机选第一个点作为起点
        const firstIdx = Math.floor(Math.random() * allPois.length);
        selected.push(allPois[firstIdx]);

        // 2. 迭代选择剩余的点
        while (selected.length < count) {
            let bestPoi = null;
            let maxMinDist = -1;

            for (let i = 0; i < allPois.length; i++) {
                const poi = allPois[i];
                if (selected.includes(poi)) continue;

                // 计算该候选点到已选点集的最小距离
                let minDist = Infinity;
                for (const s of selected) {
                    const d = Math.sqrt(Math.pow(poi.x - s.x, 2) + Math.pow(poi.z - s.z, 2));
                    if (d < minDist) minDist = d;
                }

                // 核心：寻找一个让“到已选集合最小距离”最大的点
                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestPoi = poi;
                }
            }

            if (bestPoi) selected.push(bestPoi);
            else break;
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
            // 忽略门派：直接使用全局全池
            candidateIds = Object.keys(SkillRegistry);
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
            candidateIds = Object.keys(SkillRegistry);
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

    updateHUD() {
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
        for (const type in changes) {
            if (this.heroArmy[type] !== undefined) {
                this.heroArmy[type] = Math.max(0, this.heroArmy[type] + changes[type]);
            }
        }
        console.log("%c[兵力变动] %c英雄队伍已更新", 'color: #5b8a8a; font-weight: bold', 'color: #fff', changes);
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
     * 英雄获得经验并处理升级
     */
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
            data.xpMax = Math.floor(data.xpMax * 1.5);
            
            // --- 属性固定成长系统 ---
            const s = data.stats;
            s.power += 8;          // 侠客力道/身法 (+8)
            s.spells += 4;         // 侠客功法
            s.morale += 3;         // 统帅军队 (+3%)
            s.leadership += 6;     // 带兵上限每级 +6
            // s.speed 保持不变
            s.haste = Math.min(0.5, s.haste + 0.01); // 招式调息 (每级 1%, 上限 50%)
            
            // 同步计算英雄血量与内力上限 (从身份表动态获取，彻底消除 Hardcode)
            const identity = this.getHeroIdentity(data.id);
            const cb = identity.combatBase;

            data.hpMax = cb.hpBase + (s.power * cb.hpScaling);
            data.hpCurrent = data.hpMax;
            
            // 核心修改：所有人统一 160 基础，每级 +14
            data.mpMax = 160 + (data.level - 1) * 14;
            data.mpCurrent = data.mpMax; // 升级补满状态

            console.log(`%c[升级] %c英雄升到了第 ${data.level} 级！`, 'color: #00ff00; font-weight: bold', 'color: #fff');
            
            // 派发事件让 main.js 执行 syncHeroStatsToModifiers()
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
        const cost = this.unitCosts[type]?.cost || 0;

        // 基础数据克隆
        let stats = baseBlueprint ? { ...baseBlueprint, cost } : { 
            name: type, hp: 0, atk: 0, speed: 0, attackSpeed: 1000, cost 
        };

        // --- 英雄成长逻辑 (属于基础属性的一部分) ---
        if (this.heroData && this.heroData.id === type) {
            const s = this.heroData.stats;
            const identity = this.getHeroIdentity(type);
            const cb = identity.combatBase;

            stats.hp = cb.hpBase + (s.power * cb.hpScaling); 
            stats.mp = 160 + (this.heroData.level - 1) * 14; 
            stats.atk = cb.atk * (1 + s.power * (cb.atkScaling || 0.05));                
            stats.speed = s.speed;          
        }

        return stats;
    }

    /**
     * 获取兵种最终详情 (蓝图 + 全局修正)
     * 职责：全游戏唯一合法的显示数据出口，解决 UI 显示不一致问题
     */
    getUnitDetails(type, side = 'player') {
        const blueprint = this.getUnitBlueprint(type);
        const dummyUnit = { side: side, type: type };
        
        // 1. 应用所有全局动态修正
        const finalHP = Math.ceil(modifierManager.getModifiedValue(dummyUnit, 'hp', blueprint.hp));
        
        let finalAtk;
        if (type === 'healer') {
            finalAtk = Math.abs(modifierManager.getModifiedValue(dummyUnit, 'damage', -blueprint.atk));
        } else {
            finalAtk = modifierManager.getModifiedValue(dummyUnit, 'damage', blueprint.atk);
        }
        
        const finalSpeed = modifierManager.getModifiedValue(dummyUnit, 'speed', blueprint.speed);
        const finalInterval = modifierManager.getModifiedValue(dummyUnit, 'attack_speed', blueprint.attackSpeed);
        
        // 2. DPS 换算
        const burstCount = blueprint.burstCount || 1;
        const dps = Math.ceil((finalAtk * burstCount / finalInterval) * 1000);

        return {
            ...blueprint,
            hp: finalHP,
            atk: Math.ceil(finalAtk),
            speed: finalSpeed,
            dps: dps,
            cost: blueprint.cost
        };
    }

    /**
     * 从英雄队伍移动士兵到城市 (驻守)
     */
    transferToCity(type, amount, cityId = 'main_city_1') {
        if (this.heroArmy[type] >= amount) {
            this.heroArmy[type] -= amount;
            this.cities[cityId].availableUnits[type] = (this.cities[cityId].availableUnits[type] || 0) + amount;
            return true;
        }
        return false;
    }

    /**
     * 计算英雄当前队伍的总领导力消耗 (带兵量)
     */
    getHeroCurrentLeadership() {
        let current = 0;
        for (const type in this.heroArmy) {
            const count = this.heroArmy[type];
            if (count > 0 && this.unitCosts[type]) {
                current += count * (this.unitCosts[type].cost || 0);
            }
        }
        return current;
    }

    /**
     * 从城市移动士兵到英雄队伍
     */
    transferToHero(type, amount, cityId = 'main_city_1') {
        const city = this.cities[cityId];
        const unitCost = this.unitCosts[type]?.cost || 0;
        const totalCostToAdd = amount * unitCost;
        
        const currentLeadership = this.getHeroCurrentLeadership();
        const maxLeadership = this.heroData.stats.leadership;

        if (currentLeadership + totalCostToAdd > maxLeadership) {
            this.showNotification(`统御容量不足！当前占用: ${currentLeadership}/${maxLeadership}，该操作需额外占用 ${totalCostToAdd} 点数`);
            return false;
        }

        if (city.availableUnits[type] >= amount) {
            city.availableUnits[type] -= amount;
            this.heroArmy[type] = (this.heroArmy[type] || 0) + amount;
            return true;
        }
        return false;
    }
}

export const worldManager = new WorldManager();

