import { modifierManager } from '../systems/ModifierManager.js';
import { BUILDING_REGISTRY, BLUEPRINTS } from '../data/BuildingData.js';
import { timeManager } from '../systems/TimeManager.js';
import { useGameStore } from '../store/gameStore';

/**
 * 建筑与科技管理器
 * 负责处理建筑效果的同步、科技解锁以及 Roguelike 抽卡逻辑
 */
export class BuildingManager {
    constructor(worldManager) {
        this.worldManager = worldManager;
        
        // 初始解锁的基础建筑
        this.unlockedTechs = new Set();
        this._initBaseTechs();

        // 当前抽卡选项
        this.currentDraftOptions = [];
    }

    /**
     * 初始化基础科技
     */
    _initBaseTechs() {
        for (const [id, data] of Object.entries(BUILDING_REGISTRY)) {
            // 只要定义了 startingLevel，就代表开局解锁（无论是 0 级还是 1 级）
            if (data.startingLevel !== undefined) {
                this.unlockedTechs.add(id);
            }
        }
    }

    /**
     * 生成三张季度选择卡
     * @param {string} playerFaction 玩家所属门派 (e.g., 'chunyang')
     * @returns {Array} 抽出的建筑 ID 列表
     */
    generateDraftOptions(playerFaction) {
        // 1. 获取该门派蓝图中的所有建筑
        const blueprint = BLUEPRINTS[playerFaction] || [];
        
        // 2. 过滤出：未解锁、且不是基础建筑的候选项
        const candidates = blueprint.filter(id => {
            const data = BUILDING_REGISTRY[id];
            // 逻辑简化：获得完全依赖抽卡，不再检查前置条件
            if (!data || data.startingLevel !== undefined || this.unlockedTechs.has(id)) return false;

            return true;
        });

        // 3. 根据权重进行加权随机抽取
        this.currentDraftOptions = this._weightedSample(candidates, 3);
        return this.currentDraftOptions;
    }

    /**
     * 加权随机抽取
     * @private
     */
    _weightedSample(candidates, count) {
        if (candidates.length <= count) return [...candidates];

        const result = [];
        const pool = [...candidates];

        while (result.length < count && pool.length > 0) {
            const totalWeight = pool.reduce((sum, id) => sum + (BUILDING_REGISTRY[id].weight || 50), 0);
            let random = Math.random() * totalWeight;
            
            for (let i = 0; i < pool.length; i++) {
                const id = pool[i];
                const weight = BUILDING_REGISTRY[id].weight || 50;
                if (random < weight) {
                    result.push(id);
                    pool.splice(i, 1);
                    break;
                }
                random -= weight;
            }
        }
        return result;
    }

    /**
     * 选择并解锁建筑 (适配多势力)
     * @param {string} techId 建筑 ID
     * @param {string} factionId 势力 ID
     */
    selectDraftOption(techId, factionId = 'player') {
        const isPlayer = factionId === 'player';
        
        // 1. 记录解锁状态
        if (isPlayer) {
            if (!this.currentDraftOptions.includes(techId)) return false;
            this.unlockTech(techId);
            this.currentDraftOptions = [];
            useGameStore.getState().setPaused(false);
        } else {
            // 对于 AI，直接解锁 (内部会同步 modifiers)
            this.unlockTech(techId);
        }

        // 2. 核心：仅在该势力的所有城镇中应用 1 级效果
        const faction = this.worldManager.factions[factionId];
        if (faction && faction.cities) {
            faction.cities.forEach(cityId => {
                const city = this.worldManager.cities[cityId];
                if (city) {
                    const blueprintId = city.blueprintId || 'chunyang';
                    const blueprint = BLUEPRINTS[blueprintId] || [];
                    
                    // 只有在蓝图内的建筑才能在该城市生效
                    if (blueprint.includes(techId)) {
                        if ((city.buildingLevels[techId] || 0) === 0) {
                            city.buildingLevels[techId] = 1;
                        }
                    }
                }
            });
        }

        // 3. 同步全局 Modifier
        this.syncBuildingsToModifiers(this.worldManager.cities);
        
        if (isPlayer && this.worldManager.updateHUD) {
            this.worldManager.updateHUD();
        }
        
        return true;
    }

    /**
     * 同步所有城镇建筑的效果到 ModifierManager
     * @param {Object} cities 城镇列表
     */
    syncBuildingsToModifiers(cities) {
        modifierManager.removeModifiersBySource('building');
        modifierManager.removeModifiersBySource('city_base'); 

        // 记录每个势力各自的最高军事建筑等级
        // { factionId: { buildingId: maxLevel } }
        const factionMaxMilitaryLevels = {}; 

        for (const cityId in cities) {
            const city = cities[cityId];
            
            // --- 0. 基础产出同步 (AI 和玩家都有基础产出) ---
            city._initBaseProduction();

            const side = city.owner;
            if (side === 'none') continue; 

            // 初始化该势力的追踪器
            if (!factionMaxMilitaryLevels[side]) factionMaxMilitaryLevels[side] = {};

            for (const [id, level] of Object.entries(city.buildingLevels)) {
                if (level <= 0) continue;

                // --- 1. 经济类与功能类建筑 ---
                // 这些效果直接作用于所属势力 (side)
                if (id === 'town_hall') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_town_hall_gold`,
                        side: side, targetUnit: city, stat: 'gold_income',
                        offset: level * 150, source: 'building'
                    });
                } else if (id === 'market') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_market_gold`,
                        side: side, targetUnit: city, stat: 'gold_income',
                        offset: level * 60, source: 'building'
                    });
                    modifierManager.addModifier({
                        id: `city_${cityId}_market_wood`,
                        side: side, targetUnit: city, stat: 'wood_income',
                        offset: level * 30, source: 'building'
                    });
                } else if (id === 'bank') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_bank_bonus`,
                        side: side, targetUnit: city, stat: 'gold_income',
                        multiplier: 1.0 + (level * 0.15), source: 'building'
                    });
                } else if (id === 'trade_post') {
                    modifierManager.addModifier({
                        id: `city_${cityId}_trade_post_wood`,
                        side: side, targetUnit: city, stat: 'wood_income',
                        offset: level * 80, source: 'building'
                    });
                    modifierManager.addModifier({ 
                        id: `city_${cityId}_recruit_discount`, 
                        side: side, 
                        targetUnit: city, 
                        stat: 'recruit_cost', 
                        multiplier: 1.0 - (level * 0.05), source: 'building'
                    });
                } else if (id === 'inn') {
                    modifierManager.addModifier({ 
                        id: `city_${cityId}_xp_bonus`, 
                        side: side, stat: 'xp_gain', 
                        multiplier: 1.0 + (level * 0.10), source: 'building'
                    });
                } else {
                    // --- 2. 军事类建筑：记录势力内的最高等级 ---
                    factionMaxMilitaryLevels[side][id] = Math.max(factionMaxMilitaryLevels[side][id] || 0, level);
                }
            }
        }

        // --- 3. 统一应用军事类加成 (按势力分别应用) ---
        for (const side in factionMaxMilitaryLevels) {
            const militaryLevels = factionMaxMilitaryLevels[side];
            for (const [id, level] of Object.entries(militaryLevels)) {
                const milMultiplier = 1.0 + Math.max(0, (level - 1) * 0.10);
                const globalId = `${side}_mil_${id}`; 

                switch (id) {
                    case 'barracks':
                        modifierManager.addModifier({ id: `${globalId}_melee_hp`, side: side, unitType: 'melee', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_melee_dmg`, side: side, unitType: 'melee', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'academy_changge':
                        modifierManager.addModifier({ id: `${globalId}_ranged_dmg`, side: side, unitType: 'ranged', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_ranged_hp`, side: side, unitType: 'ranged', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'archery_range':
                        modifierManager.addModifier({ id: `${globalId}_archer_dmg`, side: side, unitType: 'archer', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_archer_hp`, side: side, unitType: 'archer', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'stable':
                        modifierManager.addModifier({ id: `${globalId}_tiance_bonus`, side: side, unitType: 'tiance', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_tiance_hp`, side: side, unitType: 'tiance', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'sword_forge':
                        modifierManager.addModifier({ id: `${globalId}_cangjian_bonus`, side: side, unitType: 'cangjian', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cangjian_hp`, side: side, unitType: 'cangjian', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'martial_shrine':
                        modifierManager.addModifier({ id: `${globalId}_cangyun_hp`, side: side, unitType: 'cangyun', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cangyun_dmg`, side: side, unitType: 'cangyun', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'mage_guild':
                        modifierManager.addModifier({ id: `${globalId}_chunyang_bonus`, side: side, unitType: 'chunyang', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_chunyang_hp`, side: side, unitType: 'chunyang', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'medical_pavilion':
                        modifierManager.addModifier({ id: `${globalId}_healer_hp`, side: side, unitType: 'healer', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_healer_bonus`, side: side, unitType: 'healer', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'cy_array_pavilion':
                        modifierManager.addModifier({ id: `${globalId}_cy_array_dmg`, side: side, unitType: 'cy_sword_array', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cy_array_hp`, side: side, unitType: 'cy_sword_array', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'cy_zixia_shrine':
                        modifierManager.addModifier({ id: `${globalId}_cy_zixia_dmg`, side: side, unitType: 'cy_zixia_disciple', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cy_zixia_hp`, side: side, unitType: 'cy_zixia_disciple', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'cy_field_shrine':
                        modifierManager.addModifier({ id: `${globalId}_cy_field_dmg`, side: side, unitType: 'cy_field_master', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cy_field_hp`, side: side, unitType: 'cy_field_master', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'tc_halberd_hall':
                        modifierManager.addModifier({ id: `${globalId}_tc_banner_dmg`, side: side, unitType: 'tc_banner', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_tc_banner_hp`, side: side, unitType: 'tc_banner', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_tc_halberdier_dmg`, side: side, unitType: 'tc_halberdier', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_tc_halberdier_hp`, side: side, unitType: 'tc_halberdier', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'tc_iron_camp':
                        modifierManager.addModifier({ id: `${globalId}_tc_crossbow_dmg`, side: side, unitType: 'tc_mounted_crossbow', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_tc_crossbow_hp`, side: side, unitType: 'tc_mounted_crossbow', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'cj_spirit_pavilion':
                        modifierManager.addModifier({ id: `${globalId}_cj_spirit_dmg`, side: side, unitType: 'cj_xinjian', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cj_spirit_hp`, side: side, unitType: 'cj_xinjian', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'cj_golden_hall':
                        modifierManager.addModifier({ id: `${globalId}_cj_golden_dmg`, side: side, unitType: 'cj_golden_guard', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                        modifierManager.addModifier({ id: `${globalId}_cj_golden_hp`, side: side, unitType: 'cj_golden_guard', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                        break;
                    case 'clinic':
                        modifierManager.addModifier({ id: `${globalId}_clinic_survival`, side: side, stat: 'survival_rate', offset: level * 0.10, source: 'building' });
                        break;
                }
            }
        }
    }

    /**
     * 解锁一项新科技/建筑
     * @param {string} techId 建筑/科技 ID
     */
    unlockTech(techId) {
        this.unlockedTechs.add(techId);
        this.syncBuildingsToModifiers(this.worldManager.cities);
    }

    /**
     * 检查某建筑是否已解锁
     * @param {string} techId 建筑 ID
     * @returns {boolean}
     */
    isTechUnlocked(techId) {
        return this.unlockedTechs.has(techId);
    }
}

