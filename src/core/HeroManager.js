import { modifierManager } from '../systems/ModifierManager.js';
import { talentManager } from '../systems/TalentManager.js';
import { audioManager } from '../engine/AudioManager.js';
import { timeManager } from '../systems/TimeManager.js';
import { WorldStatusManager } from '../world/WorldStatusManager.js';
import { UNIT_STATS_DATA, UNIT_COSTS, HERO_IDENTITY } from '../data/UnitStatsData.js';
import { useHeroStore } from '../store/heroStore';

/**
 * 英雄管理器 (HeroManager)
 * 职责：负责玩家英雄的数据追踪、经验升级、技能习得、带兵统御以及属性同步。
 */
export class HeroManager {
    constructor(worldManager) {
        this.worldManager = worldManager;
        
        // 核心数据 (从 WorldManager 迁移)
        this.heroData = {
            id: 'liwangsheng', 
            level: 1,
            xp: 0,
            xpMax: 120,
            hpMax: 0,
            hpCurrent: 0,
            mpMax: 0,
            mpCurrent: 0,
            talentPoints: 3,
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

        // 玩家军队引用 (与 WorldManager.factions['player'].army 保持同步)
        this.heroArmy = {};
    }

    /**
     * 初始化英雄起始数据
     */
    init(heroId, isCheat = false) {
        this.heroData.id = heroId;
        if (isCheat) {
            this.heroData.talentPoints = 99;
        }

        // 初始化军队
        this.initHeroArmy(heroId);
        
        // 刷新一次初始属性
        this.refreshHeroStats();

        // 核心优化：初始化后立即同步状态到 Store，确保 UI 响应
        this.syncToStore();
    }

    /**
     * 创建初始军队 (统一逻辑)
     */
    createInitialArmy(heroId) {
        // 1. 定义标准开局
        const standardStart = {
            'melee': 4,
            'ranged': 3
        };

        // 2. 调试模式判定
        const useDebugArmy = this.worldManager.constructor.DEBUG.ENABLED && 
                             this.worldManager.constructor.DEBUG.LICHENGEN_GOD_MODE && 
                             heroId === 'lichengen';

        if (useDebugArmy) {
            return { 'tc_mounted_crossbow': 100 };
        } else {
            return { ...standardStart };
        }
    }

    initHeroArmy(heroId) {
        const army = this.createInitialArmy(heroId);
        
        // 核心修复：清空并重新填充，保持引用一致，防止外部引用失效
        Object.keys(this.heroArmy).forEach(key => delete this.heroArmy[key]);
        Object.assign(this.heroArmy, army);
        
        // 同步到 WorldManager 的势力数据中
        if (this.worldManager.factions['player']) {
            this.worldManager.factions['player'].army = this.heroArmy;
        }

        // 李承恩神将模式的特殊逻辑：暴力解锁统御上限
        if (this.worldManager.constructor.DEBUG.ENABLED && 
            this.worldManager.constructor.DEBUG.LICHENGEN_GOD_MODE && 
            heroId === 'lichengen') {
            console.log("%c[DEBUG] %c李承恩神将模式激活", "color: #ff4444; font-weight: bold", "color: #fff");
            this.heroData.stats.leadership = 999;
        }
    }

    /**
     * 英雄获得经验并处理升级
     */
    getNextLevelXP(level) {
        if (level < 1) return 120;
        const L = level - 1;
        return Math.floor(120 + 60 * L + 50 * Math.pow(L, 1.6));
    }

    gainXP(amount) {
        if (amount <= 0) return;
        
        // 应用全局阅历获取加成
        const bonusAmount = Math.ceil(modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'xp_gain', amount));
        const finalAmount = bonusAmount;

        const data = this.heroData;
        data.xp += finalAmount;
        
        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'xp', amount: finalAmount } 
        }));
        
        while (data.xp >= data.xpMax) {
            data.xp -= data.xpMax;
            data.level++;
            data.xpMax = this.getNextLevelXP(data.level);
            
            // 属性固定成长
            const s = data.stats;
            s.power += 4;
            s.spells += 2;
            s.morale += 2;
            s.leadership += 6;
            s.haste += 0.01;
            
            this.refreshHeroStats();

            data.talentPoints++; 
            data.pendingLevelUps++; 

            console.log(`%c[升级] %c英雄升到了第 ${data.level} 级！`, 'color: #00ff00; font-weight: bold', 'color: #fff');
            window.dispatchEvent(new CustomEvent('hero-level-up'));
        }
        
        this.syncToStore();
        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
    }

    /**
     * 统一修改英雄内力
     */
    modifyHeroMana(amount) {
        if (!this.heroData) return;
        this.heroData.mpCurrent = Math.max(0, Math.min(this.heroData.mpMax, this.heroData.mpCurrent + amount));
        this.syncToStore();
        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
    }

    /**
     * 统一修改英雄气血
     */
    modifyHeroHealth(amount) {
        if (!this.heroData) return;
        this.heroData.hpCurrent = Math.max(0, Math.min(this.heroData.hpMax, this.heroData.hpCurrent + amount));
        this.syncToStore();
        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
    }

    /**
     * 战斗后同步状态
     */
    syncHeroStatsAfterBattle({ healthRatio, mpCurrent, isDead }) {
        const data = this.heroData;
        if (!data) return;

        const targetHp = isDead ? 1 : Math.max(1, Math.floor(data.hpMax * healthRatio));
        this.modifyHeroHealth(targetHp - data.hpCurrent);
        this.modifyHeroMana(mpCurrent - data.mpCurrent);

        this.worldManager.updateHUD();
    }

    /**
     * 刷新英雄的所有全局修正器
     */
    refreshHeroStats() {
        if (!this.heroData) return;
        
        const data = this.heroData;
        const s = data.stats;
        const identity = this.getHeroIdentity(data.id);
        if (!identity) return;
        
        const cb = identity.combatBase;
        const dummy = this.getPlayerHeroDummy();

        // 获取真实属性点 (奇穴加成后)
        const realPower = modifierManager.getModifiedValue(dummy, 'power', s.power);
        const realSpells = modifierManager.getModifiedValue(dummy, 'spells', s.spells);
        const realMorale = modifierManager.getModifiedValue(dummy, 'morale', s.morale);

        // 1. 统率修正 (只影响非英雄单位)
        modifierManager.addModifier({ 
            id: 'soldier_morale_atk', 
            side: 'player', 
            unitType: 'army',
            stat: 'attackDamage', 
            multiplier: 1.0 + (realMorale / 100), 
            source: 'hero_stats' 
        });
        modifierManager.addModifier({ 
            id: 'soldier_morale_hp', 
            side: 'player', 
            unitType: 'army',
            stat: 'hp', 
            multiplier: 1.0 + (realMorale / 100), 
            source: 'hero_stats' 
        });

        // 2. 英雄自身成长
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
            stat: 'primary_attack_mult',
            multiplier: 1.0 + (realPower * (cb.atkScaling || 0.05)),
            source: 'hero_stats'
        });

        // 3. 更新数据冗余字段
        data.hpMax = Math.ceil(modifierManager.getModifiedValue(dummy, 'hp', cb.hpBase));
        
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

        // 5. 核心工程优化：自动压限 (Auto-Clamping)
        this.modifyHeroHealth(0);
        this.modifyHeroMana(0);

        this.syncToStore();
        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
    }

    syncToStore() {
        const data = this.heroData;
        const identity = this.getHeroIdentity(data.id);
        
        useHeroStore.getState().updateHero({
            id: data.id,
            name: identity?.name || '未知',
            title: identity?.title || '侠客',
            talentPoints: data.talentPoints || 0,
            talents: { ...data.talents } // 同步奇穴状态
        });

        useHeroStore.getState().updateStats({
            hp: data.hpCurrent,
            hpMax: data.hpMax,
            mp: data.mpCurrent,
            mpMax: data.mpMax,
            xp: data.xp,
            xpMax: data.xpMax,
            level: data.level,
            morale: Math.floor(modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'morale', data.stats.morale)),
            leadership: this.getHeroMaxLeadership(),
            power: Math.floor(modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'power', data.stats.power)),
            spells: Math.floor(data.stats.finalSpells || 0),
            haste: Math.floor((data.stats.finalHaste || 0) * 100),
            speed: parseFloat((modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'speed', data.stats.qinggong || 0.08)).toFixed(2)),
            primaryStatName: identity?.primaryStat || '力道',
            skills: [...data.skills] // 同步招式 ID 列表
        });
    }

    /**
     * 随机授予英雄技能
     */
    async grantRandomSkill(options = {}) {
        const { SkillRegistry, SectSkills } = await import('../systems/SkillSystem.js');
        const heroData = this.heroData;
        
        let candidateIds = [];
        if (options.pool) {
            candidateIds = options.pool;
        } else if (options.ignoreSect) {
            candidateIds = Object.keys(SkillRegistry).filter(id => typeof SkillRegistry[id] !== 'function');
        } else if (options.sect) {
            candidateIds = SectSkills[options.sect] || [];
        } else {
            const heroSect = this.worldManager.availableHeroes[heroData.id]?.sect || 'chunyang';
            candidateIds = SectSkills[heroSect] || [];
        }

        let availablePool = candidateIds.filter(id => {
            const skill = SkillRegistry[id];
            if (!skill || heroData.skills.includes(id)) return false;
            if (options.level && skill.level !== options.level) return false;
            return true;
        });

        if (availablePool.length === 0 && !options.forceSect && !options.level) {
            candidateIds = Object.keys(SkillRegistry).filter(id => typeof SkillRegistry[id] !== 'function');
            availablePool = candidateIds.filter(id => !heroData.skills.includes(id));
        }

        if (availablePool.length === 0) {
            this.worldManager.showNotification("侠客已学贯古今。");
            return null;
        }

        const count = options.count || 1;
        const selected = [];
        for (let i = 0; i < count && availablePool.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availablePool.length);
            const skillId = availablePool.splice(randomIndex, 1)[0];
            selected.push(skillId);
            
            heroData.skills.push(skillId);
            const skill = SkillRegistry[skillId];
            this.worldManager.showNotification(`感悟成功！新招式：【${skill.name}】`);
        }

        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
        return selected;
    }

    /**
     * 计算玩家队伍总战力
     */
    getPlayerTotalPower() {
        return this.getArmyTotalPower(this.heroArmy, this.heroData?.level || 1);
    }

    getArmyTotalPower(army, level = 1) {
        let total = 0;
        for (const type in army) {
            const count = army[type];
            if (count > 0 && UNIT_COSTS[type]) {
                total += count * (UNIT_COSTS[type].cost || 0);
            }
        }
        total += level * 3;
        return total;
    }

    /**
     * 统御力相关
     */
    getHeroMaxLeadership() {
        const dummy = this.getPlayerHeroDummy();
        return Math.floor(modifierManager.getModifiedValue(dummy, 'leadership', this.heroData.stats.leadership));
    }

    getHeroCurrentLeadership() {
        let current = 0;
        for (const type in this.heroArmy) {
            const count = this.heroArmy[type];
            if (count > 0 && UNIT_COSTS[type]) {
                current += count * this.worldManager.getUnitCost(type);
            }
        }
        return current;
    }

    /**
     * 更新英雄队伍兵力
     */
    updateHeroArmy(changes) {
        let changed = false;
        for (const type in changes) {
            if (this.heroArmy[type] !== undefined || changes[type] > 0) {
                const oldValue = this.heroArmy[type] || 0;
                this.heroArmy[type] = Math.max(0, oldValue + changes[type]);
                if (this.heroArmy[type] !== oldValue) {
                    changed = true;
                }
            }
        }
        if (changed) {
            this.worldManager.updateHUD();
        }
    }

    /**
     * 从存档数据恢复英雄状态
     */
    loadSaveData(data) {
        if (!data) return;

        // 核心修复：直接修改对象内容而不是重置引用，保持 WorldManager 中的引用有效
        if (data.heroData) {
            Object.keys(this.heroData).forEach(key => delete this.heroData[key]);
            Object.assign(this.heroData, JSON.parse(JSON.stringify(data.heroData)));
        }

        if (data.heroArmy) {
            Object.keys(this.heroArmy).forEach(key => delete this.heroArmy[key]);
            Object.assign(this.heroArmy, { ...data.heroArmy });
        }

        // 重新同步到势力数据 (虽然引用理论上没断，但保险起见再指一次)
        if (this.worldManager.factions['player']) {
            this.worldManager.factions['player'].army = this.heroArmy;
        }

        // 初始化奇穴
        talentManager.init(this.heroData);

        // 刷新属性
        this.refreshHeroStats();
    }

    /**
     * 辅助工具
     */
    getPlayerHeroDummy() {
        return { 
            side: 'player', 
            id: this.heroData.id, 
            type: this.heroData.id,
            isHero: true 
        };
    }

    getHeroIdentity(heroId) {
        return HERO_IDENTITY[heroId];
    }

    getHeroTraits(heroId) {
        const identity = HERO_IDENTITY[heroId];
        return identity ? identity.traits : [];
    }

    _getHeroBaseStat(heroId, statName, defaultValue) {
        const isCheat = this.worldManager.constructor.DEBUG.ENABLED && 
                        this.worldManager.constructor.DEBUG.START_RESOURCES;
        if (statName === 'mpBase' && isCheat) return 999;
        const identity = this.getHeroIdentity(heroId);
        if (identity && identity.combatBase && identity.combatBase[statName] !== undefined) {
            return identity.combatBase[statName];
        }
        return defaultValue;
    }
}

