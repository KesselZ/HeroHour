import { modifierManager } from '../systems/ModifierManager.js';
import { SkillRegistry } from '../data/SkillRegistry.js';
import { audioManager } from '../engine/AudioManager.js';
import { talentManager } from '../systems/TalentManager.js';
import { timeManager } from '../systems/TimeManager.js';
import { useGameStore } from '../store/gameStore';
import { useHeroStore } from '../store/heroStore';
import { rng, setSeed } from '../utils/Random.js';
import { UNIT_STATS_DATA, UNIT_COSTS, HERO_IDENTITY } from '../data/UnitStatsData.js';
import { WorldStatusManager } from '../world/WorldStatusManager.js';
import { City } from '../entities/City.js';
import { BuildingManager } from './BuildingManager.js';
import { BUILDING_REGISTRY } from '../data/BuildingData.js';
import { HeroManager } from './HeroManager.js';
import { worldGenerator } from '../world/WorldGenerator.js';
import { terrainManager, TERRAIN_STYLES } from '../world/TerrainManager.js';

/**
 * 3. 兵种属性与说明注册表：全游戏唯一的兵种属性配置中心
 */
const UNIT_STATS_DATA_INTERNAL = UNIT_STATS_DATA;

 /* 负责追踪资源、英雄兵力、城镇兵力
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
        HIGH_EVENT_FREQUENCY: false,             // 暂时强制关闭高频事件触发
        SHOW_MOTION_DEBUG: false,                // 运动调试日志
        DISABLE_AI: false                        // 【性能测试】一键关闭 AI 英雄生成与逻辑
    };

    constructor() {
        // 核心修复：显式指定 Side (针对专家建议 Point 1)
        // 这样当 WorldManager 调用 getModifiedValue 时，能正确匹配 side: 'player' 的全局修正
        this.side = 'player'; 

        // 核心管理组件
        this.buildingManager = new BuildingManager(this);
        this.heroManager = new HeroManager(this);

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

        this.factions = {}; // 记录所有势力数据 { factionId: { heroId, cities: [], army: {}, resources: {} } }

        // 1. 基础资源 (初始资源调低，增加探索动力)
        // 调试模式下大幅提升初始资源
        const isCheat = WorldManager.DEBUG.ENABLED && WorldManager.DEBUG.START_RESOURCES;
        
        // --- 核心初始化：预先建立玩家势力，防止 HUD 更新报错 ---
        this.factions['player'] = {
            id: 'player',
            name: '玩家',
            isPlayer: true,
            cities: ['main_city_1'],
            resources: { gold: isCheat ? 10000 : 1000, wood: isCheat ? 5000 : 500 },
            army: {} 
        };

        // 核心引用同步：确保全局访问点永远指向玩家势力数据
        this.resources = this.factions['player'].resources;

        // 2. 英雄数据 (由 HeroManager 接管)
        this.heroManager.init('liwangsheng', isCheat);

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
            influenceCenters: [], // 新增：势力影响力中心 [{type, faction, x, z, strength}]
            terrainOffsets: { x: 0, y: 0 }, // 新增：记录地形生成的随机偏移量，用于存档恢复
            seed: 0             // 新增：地形随机种子
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
                basePoints: 150,
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
                basePoints: 150,
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

        // --- 核心初始化：立即同步一次初始数据到 UI ---
        this.updateHUD();
    }

    get heroData() { return this.heroManager.heroData; }
    get heroArmy() { return this.heroManager.heroArmy; }

    createInitialArmy(heroId) {
        return this.heroManager.createInitialArmy(heroId);
    }

    initHeroArmy(heroId) {
        this.heroManager.initHeroArmy(heroId);
    }

    /**
     * 获取全图探索数据 (用于调试模式)
     */
    revealFullMap() {
        if (!this.mapState.exploredMap) return;
        this.mapState.exploredMap.fill(1);
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
            { type: 'healer', requiredBuilding: 'medical_pavilion' },
            
            // 纯阳高级
            { type: 'cy_sword_array', requiredBuilding: 'cy_array_pavilion' },
            { type: 'cy_zixia_disciple', requiredBuilding: 'cy_zixia_shrine' },
            { type: 'cy_field_master', requiredBuilding: 'cy_field_shrine' },
            
            // 天策高级
            { type: 'tc_banner', requiredBuilding: 'tc_halberd_hall' },
            { type: 'tc_halberdier', requiredBuilding: 'tc_halberd_hall' },
            { type: 'tc_mounted_crossbow', requiredBuilding: 'tc_iron_camp' },
            
            // 藏剑高级
            { type: 'cj_xinjian', requiredBuilding: 'cj_spirit_pavilion' },
            { type: 'cj_golden_guard', requiredBuilding: 'cj_golden_hall' }
        ];

        return allPossibleUnits.filter(unit => {
            if (!unit.requiredBuilding) return true;
            return city.isBuildingBuilt(unit.requiredBuilding);
        });
    }

    /**
     * 获取指定势力的全局季度收益 (城市 + 矿产)
     * @param {string} factionId 势力 ID，默认为 'player'
     */
    getGlobalProduction(factionId = 'player') {
        let totalGold = 0;
        let totalWood = 0;
        const breakdown = {
            cities: [],
            mines: { gold: 0, wood: 0, count: { gold_mine: 0, sawmill: 0 } }
        };

        // 1. 统计该势力所有城镇的产出
        for (const cityId in this.cities) {
            const city = this.cities[cityId];
            if (city.owner === factionId) {
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

        // 2. 统计该势力所有已占领矿产的收益
        this.capturedBuildings.forEach(b => {
            if (b.owner === factionId) {
                const dummy = { side: factionId, type: b.type };
                if (b.type === 'gold_mine') {
                    // 基础金矿产量 100，支持全局百分比加成
                    const mineGold = Math.floor(modifierManager.getModifiedValue(dummy, 'final_gold_income', 100));
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
     * 资源产出 Tick：遍历所有势力并分发季度收益
     */
    processResourceProduction() {
        Object.keys(this.factions).forEach(factionId => {
            const faction = this.factions[factionId];

            // 如果关闭了 AI，则跳过非玩家势力的产出结算
            if (WorldManager.DEBUG.DISABLE_AI && !faction.isPlayer) return;

            const prodData = this.getGlobalProduction(factionId);
            
            if (prodData.gold > 0) this.addGold(prodData.gold, factionId);
            if (prodData.wood > 0) this.addWood(prodData.wood, factionId);
            
            // 情况 1：玩家势力
            if (faction.isPlayer) {
                // 奇穴效果回复
                const mpRegenMult = modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'season_mp_regen', 0);
                const hpRegenMult = modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'season_hp_regen', 0);
                
                if (mpRegenMult > 0) this.modifyHeroMana(Math.floor(this.heroData.mpMax * mpRegenMult));
                if (hpRegenMult > 0) this.modifyHeroHealth(this.heroData.hpMax);

                if (mpRegenMult > 0 || hpRegenMult > 0) this.showNotification(`千里袭远：由于时节更替，状态已补满`);
                
                console.log(`%c[季度结算] %c总收入金钱 +${prodData.gold}, 木材 +${prodData.wood}`, 'color: #557755; font-weight: bold', 'color: #fff');

                // Roguelike 建筑抽卡触发
                if (timeManager.getGlobalProgress() % 2 === 1) {
                    this.triggerBuildingDraft();
                }
            } else {
                // 情况 2：AI 势力 - 通知其大脑进行经济决策
                // 找到对应的 AI 英雄控制器
                this.mapState.entities.forEach(entity => {
                    if (entity.type === 'ai_hero' && entity.config.factionId === factionId) {
                        const scene = window.worldScene;
                        const heroObj = scene?.worldObjects?.get(entity.id);
                        if (heroObj && heroObj.controller && heroObj.controller.onQuarterlyUpdate) {
                            heroObj.controller.onQuarterlyUpdate();
                        }
                    }
                });
            }
        });

        // --- 核心：季度末余额审计日志 ---
        this._logAudit();
    }

    _logAudit() {
        console.group(`%c[库房审计] 季度结算结束 (进度: ${timeManager.getGlobalProgress()})`, 'color: #d4af37; font-weight: bold');
        Object.keys(this.factions).forEach(factionId => {
            const f = this.factions[factionId];
            const color = factionId === 'player' ? '#00ff00' : '#ff4444';
            console.log(
                `%c势力: ${f.name.padEnd(6)} | %c金钱: ${Math.floor(f.resources.gold).toString().padStart(6)} | %c木材: ${Math.floor(f.resources.wood).toString().padStart(6)}`,
                `color: ${color}; font-weight: bold`,
                'color: #ffd700',
                'color: #deb887'
            );
        });
        console.groupEnd();
    }

    /**
     * 触发建筑抽卡环节
     */
    triggerBuildingDraft() {
        const faction = this.heroData.sect || 'chunyang';
        const options = this.buildingManager.generateDraftOptions(faction);
        
        if (options.length > 0) {
            console.log('%c[建筑抽卡] %c正在生成季度科技选择...', 'color: #ffcc00; font-weight: bold', 'color: #fff');
            // 派发事件，由 UI 层监听并弹出选择界面
            window.dispatchEvent(new CustomEvent('show-building-draft', { 
                detail: { 
                    options: options.map(id => ({
                        id,
                        ...BUILDING_REGISTRY[id]
                    }))
                } 
            }));
            
            // 暂停大世界时间，等待玩家选择
            timeManager.isLogicPaused = true;
        } else {
            console.log('%c[建筑抽卡] %c没有更多可解锁的科技了', 'color: #888', 'color: #fff');
        }
    }

    /**
     * 核心：统一实体交互接口
     */
    interactWithEntity(entityId, actorSide = 'player') {
        const entity = this.mapState.entities.find(e => e.id === entityId && !e.isRemoved);
        if (!entity) return false;

        const isPlayer = actorSide === 'player';
        // 统一识别实体的功能类型 (拾取物 vs 建筑)
        const keyType = entity.pickupType || entity.buildingType || entity.type;

        // 1. 资源类 (拾取)
        if (entity.type === 'pickup' || keyType.includes('pile') || keyType === 'chest') {
            return this._handleResourcePickup(entity, actorSide, isPlayer);
        }

        // 2. 建筑类 (占领)
        if (entity.type === 'captured_building' || keyType.includes('mine') || keyType.includes('sawmill')) {
            return this._handleBuildingCapture(entity, actorSide, isPlayer);
        }

        return false;
    }

    /**
     * 处理建筑占领 (金矿/伐木场)
     */
    _handleBuildingCapture(entity, factionId, isPlayer) {
        // 兼容处理 owner 的存放位置
        const config = entity.config || entity;
        if (config.owner === factionId) return false;

        config.owner = factionId;
        entity.owner = factionId; // 同步冗余字段
        
        // 更新季度结算缓存
        const existing = this.capturedBuildings.find(b => b.id === entity.id);
        if (existing) {
            existing.owner = factionId;
        } else {
            this.capturedBuildings.push({
                id: entity.id,
                type: entity.buildingType || entity.type,
                owner: factionId
            });
        }

        const soundKey = (entity.buildingType || entity.type).includes('gold') ? 'capture_gold_mine' : 'capture_sawmill';

        if (isPlayer) {
            const typeLabel = (entity.buildingType || entity.type).includes('gold') ? '金矿' : '伐木场';
            this.showNotification(`已占领：${typeLabel}`);
            audioManager.play(soundKey); 
        } else {
            // AI 占领时播放空间音效
            this._playSpatialResourceSound(soundKey, { x: entity.x, z: entity.z });
        }

        this.syncBuildingsToModifiers();
        return true;
    }

    /**
     * 处理地面资源拾取
     */
    _handleResourcePickup(entity, factionId, isPlayer) {
        let reward = { gold: 0, wood: 0 };
        let msg = "";
        const itemType = entity.pickupType || entity.type;

        // 获取英雄影子对象用于计算加成
        const dummyHero = isPlayer ? this.getPlayerHeroDummy() : { side: factionId };

        switch (itemType) {
            case 'gold_pile':
                const rawGold = Math.floor(Math.random() * 51) + 200; // 200-250 金币
                reward.gold = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawGold));
                msg = `捡到了一堆金币，获得 ${reward.gold} 💰`;
                break;
            case 'chest':
                // 宝箱给金币和木材
                const rawChestGold = Math.floor(Math.random() * 101) + 400; // 400-500
                const rawChestWood = Math.floor(Math.random() * 101) + 200; // 200-300
                reward.gold = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawChestGold));
                reward.wood = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawChestWood));
                msg = `开启了宝箱，获得 ${reward.gold} 💰 和 ${reward.wood} 🪵`;
                break;
            case 'wood_pile':
                const rawWood = Math.floor(Math.random() * 61) + 90; // 90-150
                reward.wood = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawWood));
                msg = `捡到了木材堆，获得 ${reward.wood} 🪵`;
                break;
            default:
                // 极少数特殊情况下的兜底
                if (itemType.includes('gold')) reward.gold = 50;
                else if (itemType.includes('wood')) reward.wood = 50;
        }

        // 执行资源增加
        const pos = { x: entity.x, z: entity.z };
        if (reward.gold > 0) this.addGold(reward.gold, factionId, pos);
        if (reward.wood > 0) this.addWood(reward.wood, factionId, pos);

        entity.isRemoved = true;

        // 派发事件通知表现层
        window.dispatchEvent(new CustomEvent('entity-logic-removed', { 
            detail: { entityId: entity.id } 
        }));
        
        if (isPlayer && msg) {
            console.log(`%c[拾取] %c${msg}`, 'color: #ffcc00; font-weight: bold', 'color: #fff');
            // 核心修复：显示在 UI 通知栏
            this.showNotification(msg);
        }
        return true;
    }

    /**
     * 获取单位的统御占用 (考虑奇穴减费)
     */
    getUnitCost(type) {
        const baseCost = this.unitCosts[type]?.cost || 0;
        // 获取针对该单位或军队的减费修正
        // 核心修复：明确传出 isHero: false，确保 army 目标的修正能准确匹配
        const minus = modifierManager.getModifiedValue({ side: 'player', type: type, isHero: false }, 'elite_cost_minus', 0);
        
        // 规则：只有基础占用 >= 6 的精锐单位享受减费
        if (baseCost >= 6 && minus > 0) {
            return Math.max(1, baseCost - Math.floor(minus));
        }
        return baseCost;
    }

    /**
     * 获取招募金钱消耗 (包含全局修正与城镇局部修正)
     * @param {string} type 兵种类型
     * @param {string} cityId 城镇 ID (用于计算局部折扣)
     */
    getRecruitGoldCost(type, cityId = null) {
        const baseCost = this.unitCosts[type]?.gold || 0;
        const city = cityId ? this.cities[cityId] : null;
        // 如果传入了 cityId，计算时会包含该城镇的局部折扣 (如马帮驿站)；
        // 侠客天赋由于没有绑定 targetUnit，依然会作为全局修正生效。
        return Math.ceil(modifierManager.getModifiedValue(city || { side: 'player' }, 'recruit_cost', baseCost));
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
        const finalCost = this.getRecruitGoldCost(type, cityId);
        
        if (this.spendGold(finalCost)) {
            // 优雅的自动判定：如果人在现场且统御足够，直接入队
            const canTakeNow = this.isPlayerAtCity(cityId) && 
                               (this.getHeroCurrentLeadership() + unitLeadershipCost <= this.getHeroMaxLeadership());

            if (canTakeNow) {
                this.heroManager.updateHeroArmy({ [type]: 1 });
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
                    this.heroManager.updateHeroArmy({ [type]: 1 });
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

    depositAllToCity(cityId = 'main_city_1') {
        let count = 0;
        const army = this.heroManager.heroArmy;
        for (const type in army) {
            const amount = army[type];
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
     * @param {Object} mapGenerator 地图生成器实例 (由 Scene 传入)
     */
    getOrGenerateWorld(mapGenerator) {
        return worldGenerator.buildInitialWorld(this, mapGenerator);
    }

    /**
     * 【动态事件接口】在随机 POI 处降临邪恶势力
     * @param {string} factionId 'tianyi' | 'shence' | 'red_cult'
     */
    spawnEvilBaseDynamic(factionId) {
        return worldGenerator.spawnEvilBaseDynamic(this, factionId);
    }

    /**
     * 【调试接口】立即触发一个随机邪恶势力降临
     * 可在控制台调用：worldManager.debugSpawnEvil()
     */
    debugSpawnEvil(factionId = null) {
        const evilFactions = ['tianyi', 'shence', 'red_cult'];
        const currentFactions = this.mapState.entities
            .filter(e => e.config?.isEvilBase && !e.isRemoved)
            .map(e => e.config.faction);
            
        const available = evilFactions.filter(f => !currentFactions.includes(f));
        
        const target = factionId || available[Math.floor(Math.random() * available.length)];
        
        if (!target) {
            console.warn("[Debug] 所有邪恶势力已全部降临，或没有可用的势力。");
            return;
        }
        
        console.log(`%c[Debug] 手动触发邪恶势力降临: ${target}`, "color: #ff00ff; font-weight: bold");
        this.spawnEvilBaseDynamic(target);
    }

    /**
     * 处理攻城战胜利后的城市占领
     * @param {string} cityId 
     * @param {string} newOwner 新的占领者 ID
     */
    captureCity(cityId, newOwner = 'player') {
        const city = this.cities[cityId];
        if (!city) return;

        const oldOwner = city.owner;
        if (oldOwner === newOwner) return; // 已经是自己的了

        const oldFaction = this.factions[oldOwner];
        const oldHeroId = oldFaction ? oldFaction.heroId : null;

        city.owner = newOwner;
        city.side = newOwner; // 核心同步更新 side
        
        const isPlayer = newOwner === 'player';
        const ownerName = isPlayer ? '玩家' : (this.factions[newOwner]?.name || '敌方');

        if (isPlayer) {
            // 核心重构：使用主动事件接口
            WorldStatusManager.triggerActiveEvent('captured_main_city', {
                title: '收复重镇',
                text: `阁下指挥若定，一举收复了【${city.name}】！百姓夹道欢迎，江湖威望已达巅峰！`,
                type: 'important',
                affectsSituation: true
            });
        } else {
            console.log(`%c[城池陷落] %c${city.name} 已被 ${ownerName} 占领`, 'color: #ff4444; font-weight: bold', 'color: #fff');
        }

        // 更新势力的城市列表
        if (oldFaction) {
            oldFaction.cities = oldFaction.cities.filter(id => id !== cityId);
        }
        
        const newFaction = this.factions[newOwner];
        if (newFaction && !newFaction.cities.includes(cityId)) {
            newFaction.cities.push(cityId);
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

        // 核心修复：占领后立即同步一次建筑效果，确保产出立即生效
        this.syncBuildingsToModifiers();

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
            this.showNotification("天下一统：你已消灭了所有割据势力，达成最终胜利！");
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
    getArmyTotalPower(army, level = 1) {
        return this.heroManager.getArmyTotalPower(army, level);
    }

    getPlayerTotalPower() {
        return this.heroManager.getPlayerTotalPower();
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
     */
    syncBuildingsToModifiers() {
        if (this.buildingManager) {
            this.buildingManager.syncBuildingsToModifiers(this.cities);
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
     */
    showNotification(message) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.innerHTML = `<span class="game-notification-icon">◈</span><span>${message}</span>`;

        if (container.children.length >= 3) {
            const firstActive = Array.from(container.children).find(child => !child.classList.contains('removing'));
            if (firstActive) {
                this.removeNotification(firstActive);
            }
        }

        container.appendChild(notification);

        setTimeout(() => {
            this.removeNotification(notification);
        }, 3700);
    }

    removeNotification(notification) {
        if (!notification || notification.classList.contains('removing')) return;
        
        notification.classList.add('removing');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * 处理捡起大世界物品的通用接口
     */
    handlePickup(itemType) {
        let reward = { gold: 0, wood: 0, xp: 0 };
        let msg = "";

        const powerMult = timeManager.getPowerMultiplier();
        const dummyHero = this.getPlayerHeroDummy();
        switch (itemType) {
            case 'gold_pile':
                const rawGold = (Math.floor(Math.random() * 51) + 200) * powerMult;
                reward.gold = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawGold));
                msg = `捡到了一堆金币，获得 ${reward.gold} 💰`;
                break;
            case 'chest':
                const rawChestGold = (Math.floor(Math.random() * 101) + 400) * powerMult;
                const rawChestWood = (Math.floor(Math.random() * 101) + 200) * powerMult;
                reward.gold = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawChestGold));
                reward.wood = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawChestWood));
                msg = `开启了宝箱，获得 ${reward.gold} 💰 和 ${reward.wood} 🪵`;
                reward.xp = 30;
                break;
            case 'wood_pile':
                const rawWood = (Math.floor(Math.random() * 61) + 90) * powerMult;
                reward.wood = Math.floor(modifierManager.getModifiedValue(dummyHero, 'world_loot', rawWood));
                msg = `捡到了木材堆，获得 ${reward.wood} 🪵`;
                break;
        }

        if (reward.gold > 0) this.addGold(reward.gold);
        if (reward.wood > 0) this.addWood(reward.wood);
        if (reward.xp > 0) this.gainXP(reward.xp);

        if (msg) {
            this.showNotification(msg);
        }

        return reward;
    }

    /**
     * 处理野外矿产/建筑的占领逻辑
     */
    handleCapture(buildingItem, newOwner = 'player') {
        const { id, config } = buildingItem;
        if (config.owner === newOwner) return;

        config.owner = newOwner;
        
        let recorded = this.capturedBuildings.find(b => b.id === id);
        if (recorded) {
            recorded.owner = newOwner;
        } else {
            this.capturedBuildings.push({ id, type: config.type, owner: newOwner });
        }

        const names = { 'gold_mine': '金矿', 'sawmill': '伐木场', 'teleport_altar': '神行祭坛' };
        const name = names[config.type] || '建筑';
        
        const captureSounds = { 'gold_mine': 'capture_gold_mine', 'sawmill': 'capture_sawmill', 'teleport_altar': 'ui_teleport' };
        const soundKey = captureSounds[config.type];
        if (newOwner === 'player' && soundKey) {
            audioManager.play(soundKey);
        }
        
        if (newOwner === 'player') {
            const icon = config.type === 'gold_mine' ? '💰' : (config.type === 'sawmill' ? '🪵' : '⛩️');
            this.showNotification(`成功占领 ${icon}${name}！`);
        }
        
        window.dispatchEvent(new CustomEvent('building-captured', { detail: { id, type: config.type, owner: newOwner } }));
    }

    grantRandomSkill(options = {}) {
        return this.heroManager.grantRandomSkill(options);
    }

    /**
     * 核心：全能战斗模拟器 (支持 玩家/AI/野怪 任意两方对拼)
     * @param {string} attackerId 发起者 ID (如 'player', 'ai_hero_1')
     * @param {string} defenderId 防御者 ID (如 'city_1', 'enemy_group_123')
     * @param {Object} defenderConfig 防御方的配置 (包含 army, totalPoints 等)
     */
    simulateSimpleBattle(attackerId, defenderId, defenderConfig) {
        // 1. 获取双方的基础战力数据
        const attackerFaction = this.factions[attackerId];
        const isAttackerPlayer = attackerId === 'player';
        
        // 攻击方战力 (英雄等级 + 军队)
        const attackerPower = isAttackerPlayer ? 
            this.getPlayerTotalPower() : 
            this.getArmyTotalPower(attackerFaction?.army || {}, 1);

        // 防御方战力
        const defenderPower = defenderConfig.totalPoints || defenderConfig.power || 0;
        
        // 2. 加入随机扰动 (±10%)
        const attackerEff = attackerPower * (0.9 + Math.random() * 0.2);
        const defenderEff = defenderPower * (0.9 + Math.random() * 0.2);

        const isAttackerWinner = attackerEff >= defenderEff;
        const winnerPower = isAttackerWinner ? attackerEff : defenderEff;
        const loserPower = isAttackerWinner ? defenderEff : attackerEff;
        const ratio = winnerPower / (loserPower || 1);

        // 3. 计算损耗率 (使用你提供的指数模型)
        // 1:1 -> 50%, 2:1 -> 10%, 3:1 -> 2%, 4:1 -> 0.4%
        let winnerLossRate = 0.5 * Math.pow(5, -(ratio - 1));
        if (isAttackerWinner && isAttackerPlayer) winnerLossRate *= 0.5; // 玩家主动跳过战斗有策略优势

        const loserLossRate = 0.9; // 失败方损失 90%

        // 4. 应用损失逻辑 (抽象化函数)
        const processLosses = (sideId, armyObj, rate) => {
            if (!armyObj) return { armyChanges: {}, settlement: [] };
            
            const changes = {};
            const settlement = [];
            const isSidePlayer = sideId === 'player';
            const survivalRate = isSidePlayer ? modifierManager.getModifiedValue({ side: 'player' }, 'survival_rate', 0) : 0;

            // 转换成列表并排序 (保护精锐)
            const list = Object.entries(armyObj)
                .map(([type, count]) => ({ type, count, cost: this.getUnitCost(type) }))
                .filter(item => item.count > 0)
                .sort((a, b) => a.cost - b.cost);

            const totalCount = list.reduce((sum, i) => sum + i.count, 0);
            let targetLoss = Math.floor(totalCount * rate);

            for (const item of list) {
                if (targetLoss <= 0) break;
                const loss = Math.min(item.count, targetLoss);
                targetLoss -= loss;

                // 医疗救回 (仅玩家享受)
                let saved = 0;
                if (isSidePlayer) {
                    for (let i = 0; i < loss; i++) {
                        if (Math.random() < survivalRate) saved++;
                    }
                }

                const actualLoss = loss - saved;
                if (loss > 0) settlement.push({ type: item.type, loss: -loss, gain: saved });
                if (actualLoss > 0) changes[item.type] = -actualLoss;
            }
            return { armyChanges: changes, settlement };
        };

        // 5. 执行双方损失结算
        const attackerRes = processLosses(attackerId, isAttackerPlayer ? this.heroManager.heroArmy : attackerFaction?.army, isAttackerWinner ? winnerLossRate : loserLossRate);
        
        // 6. 应用变动
        if (isAttackerPlayer) {
            this.updateHeroArmy(attackerRes.armyChanges);
        } else if (attackerFaction) {
            // AI 英雄兵力扣除
            for (const [type, amt] of Object.entries(attackerRes.armyChanges)) {
                attackerFaction.army[type] = Math.max(0, (attackerFaction.army[type] || 0) + amt);
            }
        }

        // 防御方如果是 AI 势力或城市，也需要扣除
        if (defenderConfig.cityId) {
            const defenderRes = processLosses(defenderId, defenderConfig.army, isAttackerWinner ? loserLossRate : winnerLossRate);
            this.updateCityGarrison(defenderConfig.cityId, defenderRes.armyChanges);
        }

        // 7. 玩家特供：经验结算
        let xpData = {};
        if (isAttackerPlayer) {
            const xpGained = Math.floor(defenderPower * 4);
            const data = this.heroData;
            const xpBefore = data.xp;
            const levelBefore = data.level;
            this.gainXP(xpGained);
            xpData = { xpGained, xpBefore, levelBefore, xpAfter: data.xp, levelAfter: data.level };
        }

        console.log(`%c[全能模拟] %c${attackerId} vs ${defenderId} | 胜者: ${isAttackerWinner ? attackerId : defenderId} | 损耗率: ${(winnerLossRate*100).toFixed(1)}%`, 'color: #ffaa00; font-weight: bold', 'color: #fff');

        return {
            isVictory: isAttackerWinner,
            settlementChanges: attackerRes.settlement,
            ...xpData,
            enemyConfig: defenderConfig
        };
    }

    /**
     * 核心同步：将指定城镇数据推送到 React Store
     * @param {string} cityId 
     */
    /**
     * 核心同步：将指定城镇数据推送到 React Store
     * @param {string} cityId 
     * @param {boolean} isPhysicalOverride 强制设定是否为“亲临” (不传则根据距离自动判定)
     */
    syncCityToStore(cityId, isPhysicalOverride = null) {
        const city = this.cities[cityId];
        if (!city) return;

        // 获取可招募列表
        const recruits = this.getAvailableRecruits(cityId).map(u => ({
            type: u.type,
            name: this.getUnitDetails(u.type).name,
            cost: this.getRecruitGoldCost(u.type, cityId),
            icon: u.type // 兵种 ID 通常也是图标 ID
        }));

        const isPhysicalVisit = (isPhysicalOverride !== null) ? isPhysicalOverride : this.isPlayerAtCity(cityId);

        useGameStore.getState().updateCity({
            id: city.id,
            name: city.name,
            type: city.type,
            isMainCity: cityId === 'main_city_1',
            isPhysicalVisit: isPhysicalVisit,
            income: city.getTotalProduction(),
            buildings: city.getAvailableBuildings(),
            garrison: city.availableUnits || {}, // 使用城市自身的守军数据
            recruits: recruits
        });

        // 同步英雄队伍
        useHeroStore.getState().updateStats({
            army: { ...this.factions['player'].army },
            currentLeadership: this.getArmyTotalPower(this.factions['player'].army, 1) // 计算当前占用的统御值
        });
    }

    updateHUD() {
        this.syncBuildingsToModifiers();
        const resources = ['gold', 'wood'];
        resources.forEach(res => {
            const el = document.getElementById(`world-${res}`);
            if (el) el.innerText = this.resources[res];
        });

        // --- 核心同步：将数据推送到 React Store ---
        useGameStore.getState().updateResources({
            gold: this.resources.gold,
            wood: this.resources.wood
        });

        // 默认同步当前关注的城镇（如果是主城）
        this.syncCityToStore('main_city_1');
    }

    updateHeroArmy(changes) {
        this.heroManager.updateHeroArmy(changes);
    }

    getSaveData() {
        return {
            resources: { ...this.resources },
            heroData: JSON.parse(JSON.stringify(this.heroManager.heroData)),
            heroArmy: { ...this.heroManager.heroArmy },
            cities: Object.values(this.cities).map(city => ({
                id: city.id,
                name: city.name,
                owner: city.owner,
                type: city.type,
                blueprintId: city.blueprintId,
                buildingLevels: { ...city.buildingLevels },
                availableUnits: { ...city.availableUnits },
                x: city.x,
                z: city.z
            })),
            mapState: {
                isGenerated: this.mapState.isGenerated,
                entities: JSON.parse(JSON.stringify(this.mapState.entities)),
                playerPos: { ...this.mapState.playerPos },
                terrainOffsets: { ...this.mapState.terrainOffsets },
                seed: this.mapState.seed,
                influenceCenters: JSON.parse(JSON.stringify(this.mapState.influenceCenters)),
                size: this.mapState.size,
                exploredMap: this.mapState.exploredMap ? Array.from(this.mapState.exploredMap) : null
            },
            factions: JSON.parse(JSON.stringify(this.factions)),
            currentAIFactions: JSON.parse(JSON.stringify(this.currentAIFactions)),
            capturedBuildings: JSON.parse(JSON.stringify(this.capturedBuildings))
        };
    }

    loadSaveData(data) {
        if (!data) return;
        modifierManager.clear();
        this.heroManager.loadSaveData(data);
        
        this.cities = {};
        data.cities.forEach(cData => {
            const city = new City(cData.id, cData.name, cData.owner, cData.type, cData.blueprintId);
            city.buildingLevels = { ...cData.buildingLevels };
            city.availableUnits = { ...cData.availableUnits };
            city.x = cData.x;
            city.z = cData.z;
            this.cities[cData.id] = city;
        });

        this.mapState.isGenerated = data.mapState.isGenerated;
        this.mapState.grid = [];
        this.mapState.heightMap = []; 
        this.mapState.entities = JSON.parse(JSON.stringify(data.mapState.entities));
        this.mapState.playerPos = { ...data.mapState.playerPos };
        this.mapState.terrainOffsets = { ...data.mapState.terrainOffsets };
        this.mapState.seed = data.mapState.seed;
        this.mapState.influenceCenters = JSON.parse(JSON.stringify(data.mapState.influenceCenters));
        this.mapState.size = data.mapState.size;
        this.mapState.interactionLocks = new Set();
        
        if (this.mapState.seed) {
            setSeed(this.mapState.seed);
        }
        
        if (data.mapState.exploredMap) {
            this.mapState.exploredMap = new Uint8Array(data.mapState.exploredMap);
        }

        this.factions = JSON.parse(JSON.stringify(data.factions));
        if (this.factions['player']) {
            this.resources = this.factions['player'].resources;
        } else {
            this.resources = { ...data.resources };
        }

        this.currentAIFactions = JSON.parse(JSON.stringify(data.currentAIFactions));
        this.capturedBuildings = JSON.parse(JSON.stringify(data.capturedBuildings));

        this.syncBuildingsToModifiers();
        window.dispatchEvent(new CustomEvent('hero-initialized'));
        this.updateHUD();
    }

    addGold(amount, factionId = 'player', spatialPos = null) {
        if (amount <= 0) return;
        const faction = this.factions[factionId];
        if (!faction) return;
        faction.resources.gold += amount;
        if (faction.isPlayer) {
            this.updateHUD();
            this.triggerResourceAnimation('gold');
            audioManager.play('source_gold');
            window.dispatchEvent(new CustomEvent('resource-gained', { detail: { type: 'gold', amount } }));
        } else if (spatialPos) {
            this._playSpatialResourceSound('source_gold', spatialPos);
        }
    }

    addWood(amount, factionId = 'player', spatialPos = null) {
        if (amount <= 0) return;
        const faction = this.factions[factionId];
        if (!faction) return;
        faction.resources.wood += amount;
        if (faction.isPlayer) {
            this.updateHUD();
            this.triggerResourceAnimation('wood');
            audioManager.play('source_wood');
            window.dispatchEvent(new CustomEvent('resource-gained', { detail: { type: 'wood', amount } }));
        } else if (spatialPos) {
            this._playSpatialResourceSound('source_wood', spatialPos);
        }
    }

    _playSpatialResourceSound(key, pos) {
        const worldScene = window.worldScene;
        let px, pz;
        if (worldScene && worldScene.playerObject && worldScene.playerObject.mesh) {
            px = worldScene.playerObject.mesh.position.x;
            pz = worldScene.playerObject.mesh.position.z;
        } else if (this.mapState.playerPos) {
            px = this.mapState.playerPos.x;
            pz = this.mapState.playerPos.z;
        } else return;

        const dist = Math.sqrt(Math.pow(pos.x - px, 2) + Math.pow(pos.z - pz, 2));
        const maxDist = 20;
        if (dist < maxDist) {
            const volume = Math.max(0, 1 - dist / maxDist);
            if (volume > 0.05) audioManager.play(key, { volume: volume * 0.8 }); 
        }
    }

    spendGold(amount, factionId = 'player') {
        const faction = this.factions[factionId];
        if (!faction) return false;
        if (faction.resources.gold >= amount) {
            faction.resources.gold -= amount;
            if (faction.isPlayer) this.updateHUD();
            return true;
        }
        return false;
    }

    spendWood(amount, factionId = 'player') {
        const faction = this.factions[factionId];
        if (!faction) return false;
        if (faction.resources.wood >= amount) {
            faction.resources.wood -= amount;
            if (faction.isPlayer) this.updateHUD();
            return true;
        }
        return false;
    }

    hasResources(costs, factionId = 'player') {
        const faction = this.factions[factionId];
        if (!faction) return false;
        return faction.resources.gold >= (costs.gold || 0) && faction.resources.wood >= (costs.wood || 0);
    }

    spendResources(costs, factionId = 'player') {
        if (this.hasResources(costs, factionId)) {
            const faction = this.factions[factionId];
            if (costs.gold) faction.resources.gold -= costs.gold;
            if (costs.wood) faction.resources.wood -= costs.wood;
            if (faction.isPlayer) this.updateHUD();
            return true;
        }
        return false;
    }

    getNextLevelXP(level) { return this.heroManager.getNextLevelXP(level); }
    gainXP(amount) { this.heroManager.gainXP(amount); }

    triggerResourceAnimation(type) {
        const el = document.getElementById(`world-${type}`);
        if (!el) return;
        const parent = el.closest('.res-item');
        if (!parent) return;
        parent.classList.remove('res-update-anim');
        void parent.offsetWidth; 
        parent.classList.add('res-update-anim');
    }

    getHeroIdentity(heroId) { return this.heroManager.getHeroIdentity(heroId); }
    getHeroTraits(heroId) { return this.heroManager.getHeroTraits(heroId); }

    getUnitBlueprint(type) {
        const baseBlueprint = UNIT_STATS_DATA_INTERNAL[type];
        const cost = this.getUnitCost(type);
        let stats = baseBlueprint ? { ...baseBlueprint, cost } : { name: type, hp: 0, atk: 0, speed: 0, attackSpeed: 1000, cost };
        if (this.heroData && this.heroData.id === type) {
            const identity = this.getHeroIdentity(type);
            const cb = identity.combatBase;
            stats.hp = cb.hpBase;
            stats.mp = this._getHeroBaseStat(type, 'mpBase', 80); 
            stats.atk = cb.atk;
            stats.speed = this.heroData.stats.battleSpeed || 4.0; 
        }
        return stats;
    }

    getUnitDetails(type, side = 'player') {
        const blueprint = this.getUnitBlueprint(type);
        const dummyUnit = { side, type, isHero: this.heroData && this.heroData.id === type };
        let baseAtk = blueprint.atk, baseBurst = blueprint.burstCount || 1, baseInterval = blueprint.attackSpeed || 1000, baseRange = blueprint.range, baseTargets = blueprint.targets || 1.0;
        if (blueprint.modes) {
            const firstMode = blueprint.modes[Object.keys(blueprint.modes)[0]];
            if (firstMode.atk !== undefined) baseAtk = firstMode.atk;
            if (firstMode.atkMult !== undefined) baseAtk *= firstMode.atkMult;
            baseBurst = firstMode.burstCount || baseBurst;
            baseInterval = firstMode.attackSpeed || baseInterval;
            baseRange = firstMode.range || baseRange;
            baseTargets = firstMode.targets || baseTargets;
        }
        const finalHP = Math.ceil(modifierManager.getModifiedValue(dummyUnit, 'hp', blueprint.hp));
        const finalAtk = modifierManager.getModifiedValue(dummyUnit, 'attackDamage', baseAtk);
        const finalSpeed = modifierManager.getModifiedValue(dummyUnit, 'speed', blueprint.speed);
        let finalQinggong = 0;
        if (this.heroData && this.heroData.id === type) {
            finalQinggong = modifierManager.getModifiedValue(dummyUnit, 'qinggong', this.heroData.stats.qinggong);
        }
        const speedMult = modifierManager.getModifiedValue(dummyUnit, 'attackSpeed', 1.0);
        const finalInterval = baseInterval / speedMult;
        const dps = Math.ceil((finalAtk * baseBurst * baseTargets / finalInterval) * 1000);
        return { ...blueprint, hp: finalHP, atk: Math.ceil(finalAtk), range: baseRange, targets: baseTargets, speed: finalSpeed, qinggong: finalQinggong || finalSpeed, dps, cost: this.getUnitCost(type) };
    }

    /**
     * 更新指定城市的驻军
     * @param {string} cityId 城市ID
     * @param {Object} changes 兵力变动对象 { 'melee': -2, 'ranged': 1 }
     */
    updateCityGarrison(cityId, changes) {
        const city = this.cities[cityId];
        if (!city) return;
        
        for (const [type, amount] of Object.entries(changes)) {
            city.availableUnits[type] = Math.max(0, (city.availableUnits[type] || 0) + amount);
        }
        
        // 触发 UI 刷新，如果当前正打开着该城市的管理界面
        if (window.worldScene && window.worldScene.activeCityId === cityId) {
            window.worldScene.updateTownManagementUI();
        }
    }

    transferToCity(type, amount, cityId = 'main_city_1') {
        if (!this.isPlayerAtCity(cityId)) return false;
        if (this.heroArmy[type] >= amount) {
            this.heroArmy[type] -= amount;
            this.cities[cityId].availableUnits[type] = (this.cities[cityId].availableUnits[type] || 0) + amount;
            this.updateHUD();
            return true;
        }
        return false;
    }

    getHeroMaxLeadership() { return this.heroManager.getHeroMaxLeadership(); }
    getHeroCurrentLeadership() { return this.heroManager.getHeroCurrentLeadership(); }
    _getHeroBaseStat(heroId, statName, defaultValue) { return this.heroManager._getHeroBaseStat(heroId, statName, defaultValue); }
    modifyHeroMana(amount) { this.heroManager.modifyHeroMana(amount); }
    modifyHeroHealth(amount) { this.heroManager.modifyHeroHealth(amount); }
    syncHeroStatsAfterBattle(stats) { this.heroManager.syncHeroStatsAfterBattle(stats); }
    refreshHeroStats() { this.heroManager.refreshHeroStats(); }
    getPlayerHeroDummy() { return this.heroManager.getPlayerHeroDummy(); }

    isActorAtEntity(entityId, actorPos, radius = 1.5) {
        const entity = this.mapState.entities.find(e => e.id === entityId);
        if (!entity || !actorPos) return false;
        return Math.sqrt(Math.pow(actorPos.x - entity.x, 2) + Math.pow(actorPos.z - entity.z, 2)) <= radius;
    }

    isPlayerAtCity(cityId) {
        const city = this.cities[cityId];
        if (!city || !this.mapState.playerPos) return false;
        return Math.sqrt(Math.pow(this.mapState.playerPos.x - city.x, 2) + Math.pow(this.mapState.playerPos.z - city.z, 2)) <= 5.0;
    }

    transferToHero(type, amount, cityId = 'main_city_1') {
        if (!this.isPlayerAtCity(cityId)) return false;
        const city = this.cities[cityId];
        const cost = this.getUnitCost(type) * amount;
        if (this.getHeroCurrentLeadership() + cost > this.getHeroMaxLeadership()) {
            this.showNotification(`统御容量不足！当前占用: ${this.getHeroCurrentLeadership()}/${this.getHeroMaxLeadership()}，需额外 ${cost}`);
            return false;
        }
        if (city.availableUnits[type] >= amount) {
            city.availableUnits[type] -= amount;
            this.heroManager.updateHeroArmy({ [type]: amount });
            this.updateHUD();
            return true;
        }
        return false;
    }

    debugSetTerrain(styleKey) {
        const style = TERRAIN_STYLES[styleKey.toUpperCase()] || styleKey;
        terrainManager.setGlobalStyle(style, this.mapState.grid, this.mapState.heightMap);
    }
}

export const worldManager = new WorldManager();
talentManager.init(worldManager.heroData);
