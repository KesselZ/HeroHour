import { modifierManager } from '../systems/ModifierManager.js';
import { BUILDING_REGISTRY, BLUEPRINTS } from '../data/BuildingData.js';
import { timeManager } from '../systems/TimeManager.js';

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
            if (data.isDefault) {
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
        
        // 2. 过滤出：未解锁、满足前置要求、且不是基础建筑的候选项
        const candidates = blueprint.filter(id => {
            const data = BUILDING_REGISTRY[id];
            if (!data || data.isDefault || this.unlockedTechs.has(id)) return false;

            // 检查前置条件 (如果有)
            if (data.requirements) {
                return data.requirements.every(req => this.unlockedTechs.has(req.id));
            }

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
     * 玩家选择并解锁建筑
     */
    selectDraftOption(techId) {
        if (this.currentDraftOptions.includes(techId)) {
            this.unlockTech(techId);
            this.currentDraftOptions = [];
            
            // 恢复游戏逻辑
            timeManager.isLogicPaused = false;
            return true;
        }
        return false;
    }

    /**
     * 同步所有城镇建筑的效果到 ModifierManager
     * @param {Object} cities 城镇列表
     */
    syncBuildingsToModifiers(cities) {
        modifierManager.removeModifiersBySource('building');
        modifierManager.removeModifiersBySource('city_base'); 

        const maxMilitaryLevels = {}; 

        for (const cityId in cities) {
            const city = cities[cityId];
            
            // --- 0. 基础产出同步 ---
            city._initBaseProduction();

            const side = city.owner;
            if (side !== 'player') continue; 

            for (const [id, level] of Object.entries(city.buildingLevels)) {
                if (level <= 0) continue;

                // --- 1. 经济类与功能类建筑 ---
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
                        side: 'player', 
                        targetUnit: city, 
                        stat: 'recruit_cost', 
                        multiplier: 1.0 - (level * 0.05), source: 'building'
                    });
                } else if (id === 'inn') {
                    modifierManager.addModifier({ 
                        id: `city_${cityId}_xp_bonus`, 
                        side: 'player', stat: 'xp_gain', 
                        multiplier: 1.0 + (level * 0.10), source: 'building'
                    });
                } else {
                    // --- 2. 军事类建筑：记录全图最高等级 ---
                    maxMilitaryLevels[id] = Math.max(maxMilitaryLevels[id] || 0, level);
                }
            }
        }

        // --- 3. 统一应用军事类加成 (取全图最高等级，不叠加) ---
        for (const [id, level] of Object.entries(maxMilitaryLevels)) {
            const milMultiplier = 1.0 + Math.max(0, (level - 1) * 0.10);
            const globalId = `global_mil_${id}`; 

            switch (id) {
                case 'barracks':
                    modifierManager.addModifier({ id: `${globalId}_melee_hp`, side: 'player', unitType: 'melee', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_melee_dmg`, side: 'player', unitType: 'melee', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'archery_range':
                    modifierManager.addModifier({ id: `${globalId}_ranged_dmg`, side: 'player', unitType: 'ranged', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_ranged_hp`, side: 'player', unitType: 'ranged', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_archer_dmg`, side: 'player', unitType: 'archer', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_archer_hp`, side: 'player', unitType: 'archer', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'stable':
                    modifierManager.addModifier({ id: `${globalId}_tiance_bonus`, side: 'player', unitType: 'tiance', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_tiance_hp`, side: 'player', unitType: 'tiance', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'sword_forge':
                    modifierManager.addModifier({ id: `${globalId}_cangjian_bonus`, side: 'player', unitType: 'cangjian', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cangjian_hp`, side: 'player', unitType: 'cangjian', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'martial_shrine':
                    modifierManager.addModifier({ id: `${globalId}_cangyun_hp`, side: 'player', unitType: 'cangyun', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cangyun_dmg`, side: 'player', unitType: 'cangyun', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'mage_guild':
                    modifierManager.addModifier({ id: `${globalId}_chunyang_bonus`, side: 'player', unitType: 'chunyang', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_chunyang_hp`, side: 'player', unitType: 'chunyang', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'medical_pavilion':
                    modifierManager.addModifier({ id: `${globalId}_healer_hp`, side: 'player', unitType: 'healer', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_healer_bonus`, side: 'player', unitType: 'healer', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'cy_array_pavilion':
                    modifierManager.addModifier({ id: `${globalId}_cy_array_dmg`, side: 'player', unitType: 'cy_sword_array', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cy_array_hp`, side: 'player', unitType: 'cy_sword_array', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'cy_zixia_shrine':
                    modifierManager.addModifier({ id: `${globalId}_cy_zixia_dmg`, side: 'player', unitType: 'cy_zixia_disciple', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cy_zixia_hp`, side: 'player', unitType: 'cy_zixia_disciple', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'cy_field_shrine':
                    modifierManager.addModifier({ id: `${globalId}_cy_field_dmg`, side: 'player', unitType: 'cy_field_master', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cy_field_hp`, side: 'player', unitType: 'cy_field_master', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'tc_halberd_hall':
                    modifierManager.addModifier({ id: `${globalId}_tc_banner_dmg`, side: 'player', unitType: 'tc_banner', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_tc_banner_hp`, side: 'player', unitType: 'tc_banner', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_tc_halberdier_dmg`, side: 'player', unitType: 'tc_halberdier', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_tc_halberdier_hp`, side: 'player', unitType: 'tc_halberdier', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'tc_iron_camp':
                    modifierManager.addModifier({ id: `${globalId}_tc_crossbow_dmg`, side: 'player', unitType: 'tc_mounted_crossbow', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_tc_crossbow_hp`, side: 'player', unitType: 'tc_mounted_crossbow', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'cj_spirit_pavilion':
                    modifierManager.addModifier({ id: `${globalId}_cj_spirit_dmg`, side: 'player', unitType: 'cj_xinjian', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cj_spirit_hp`, side: 'player', unitType: 'cj_xinjian', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'cj_golden_hall':
                    modifierManager.addModifier({ id: `${globalId}_cj_golden_dmg`, side: 'player', unitType: 'cj_golden_guard', stat: 'attackDamage', multiplier: milMultiplier, source: 'building' });
                    modifierManager.addModifier({ id: `${globalId}_cj_golden_hp`, side: 'player', unitType: 'cj_golden_guard', stat: 'hp', multiplier: milMultiplier, source: 'building' });
                    break;
                case 'clinic':
                    modifierManager.addModifier({ id: `${globalId}_clinic_survival`, side: 'player', stat: 'survival_rate', offset: level * 0.10, source: 'building' });
                    break;
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

