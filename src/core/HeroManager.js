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
 * 
 * 极致性能优化版：
 * 1. Proxy 缓存 (Proxy Cache)：使用 WeakMap 缓存已代理的对象，防止每帧产生数万个垃圾对象，大幅提升 FPS。
 * 2. 智能脏检查 (Dirty Check)：仅在属性值真正改变时才申请同步。
 * 3. 宏任务同步 (Batched Sync)：将同步任务从微任务或 RAF 优化为受控的宏任务，防止卡死。
 */
export class HeroManager {
    constructor(worldManager) {
        this.worldManager = worldManager;
        
        // 核心数据 (原始引用)
        this._rawHeroData = {
            id: 'liwangsheng', level: 1, xp: 0, xpMax: 120,
            hpMax: 0, hpCurrent: 0, mpMax: 0, mpCurrent: 0,
            talentPoints: 3, talents: {}, pendingLevelUps: 0, skills: [],
            stats: {
                morale: 0, power: 0, spells: 0, qinggong: 0,
                battleSpeed: 0, haste: 0, leadership: 0,
            }
        };
        this._rawHeroArmy = {};

        // 内部状态
        this._syncPending = false;
        this._syncLocked = false;
        this._proxyCache = new WeakMap(); // 核心：缓存已创建的 Proxy

        // 响应式入口
        this.heroData = this._createDeepProxy(this._rawHeroData, () => this.requestSync());
        this.heroArmy = this._createDeepProxy(this._rawHeroArmy, () => this.requestSync());
    }

    /**
     * 申请同步：使用单次微任务/宏任务合并
     */
    requestSync() {
        if (this._syncPending || this._syncLocked) return;
        this._syncPending = true;
        
        // 采用 Promise 异步批处理同步任务
        Promise.resolve().then(() => {
            if (!this._syncPending) return;
            this.syncToStore();
            this._syncPending = false;
        });
    }

    /**
     * 递归代理工厂 (带缓存，防止对象爆炸)
     */
    _createDeepProxy(obj, callback) {
        if (this._proxyCache.has(obj)) {
            return this._proxyCache.get(obj);
        }

        const self = this;
        const proxy = new Proxy(obj, {
            get: (target, property, receiver) => {
                const value = Reflect.get(target, property, receiver);
                // 仅对纯对象进行递归代理
                if (value && typeof value === 'object' && value.constructor === Object) {
                    return self._createDeepProxy(value, callback);
                }
                return value;
            },
            set: (target, property, value, receiver) => {
                const oldValue = Reflect.get(target, property, receiver);
                if (oldValue === value) return true; // 数值没变，跳过

                const result = Reflect.set(target, property, value, receiver);
                callback();
                return result;
            },
            deleteProperty: (target, property) => {
                const result = Reflect.deleteProperty(target, property);
                callback();
                return result;
            }
        });

        this._proxyCache.set(obj, proxy);
        return proxy;
    }

    init(heroId, isCheat = false) {
        this._syncLocked = true;
        this.heroData.id = heroId;
        if (isCheat) this.heroData.talentPoints = 99;
        this.initHeroArmy(heroId);
        this.refreshHeroStats();
        this._syncLocked = false;
        this.syncToStore();
    }

    initHeroArmy(heroId) {
        const army = this.createInitialArmy(heroId);
        // 直接操作 _raw 以避免初始化期间的高频 Proxy 触发
        for (const key in this._rawHeroArmy) delete this._rawHeroArmy[key];
        Object.assign(this._rawHeroArmy, army);
        
        if (this.worldManager.factions['player']) {
            this.worldManager.factions['player'].army = this.heroArmy;
        }

        if (this.worldManager.constructor.DEBUG.ENABLED && 
            this.worldManager.constructor.DEBUG.LICHENGEN_GOD_MODE && 
            heroId === 'lichengen') {
            this._rawHeroData.stats.leadership = 999;
        }
    }

    createInitialArmy(heroId) {
        const standardStart = { 'melee': 4, 'ranged': 3 };
        const useDebugArmy = this.worldManager.constructor.DEBUG.ENABLED && 
                             this.worldManager.constructor.DEBUG.LICHENGEN_GOD_MODE && 
                             heroId === 'lichengen';
        return useDebugArmy ? { 'tc_mounted_crossbow': 100 } : { ...standardStart };
    }

    gainXP(amount) {
        if (amount <= 0) return;
        console.log(`%c[经验调试] 开始获取经验: ${amount}`, "color: #00ff00");
        
        const finalAmount = Math.ceil(modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'xp_gain', amount));
        const data = this.heroData;
        
        this._syncLocked = true; // 锁定！防止 while 循环里每一步都触发 React 重绘
        
        data.xp += finalAmount;
        window.dispatchEvent(new CustomEvent('resource-gained', { detail: { type: 'xp', amount: finalAmount } }));
        
        let leveledUp = false;
        let loopCount = 0;
        while (data.xp >= data.xpMax) {
            loopCount++;
            if (loopCount > 100) {
                console.error("[经验调试] 检测到升级死循环！强制跳出");
                break;
            }
            data.xp -= data.xpMax;
            data.level++;
            data.xpMax = this.getNextLevelXP(data.level);
            
            const s = data.stats;
            s.power += 4; s.spells += 2; s.morale += 2; s.leadership += 6; s.haste += 0.01;
            data.talentPoints++; data.pendingLevelUps++; 
            leveledUp = true;
        }

        if (leveledUp) {
            this.refreshHeroStats();
            console.log(`%c[升级] %c英雄升到了第 ${data.level} 级！`, 'color: #00ff00; font-weight: bold', 'color: #fff');
        }

        this._syncLocked = false;
        this.requestSync(); // 循环结束，一次性同步
        console.log(`%c[经验调试] 经验获取处理完成`, "color: #00ff00");
    }

    getNextLevelXP(level) {
        if (level < 1) return 120;
        const L = level - 1;
        return Math.floor(120 + 60 * L + 50 * Math.pow(L, 1.6));
    }

    modifyHeroMana(amount) {
        if (amount === 0) return;
        this.heroData.mpCurrent = Math.max(0, Math.min(this.heroData.mpMax, this.heroData.mpCurrent + amount));
    }

    modifyHeroHealth(amount) {
        if (amount === 0) return;
        this.heroData.hpCurrent = Math.max(0, Math.min(this.heroData.hpMax, this.heroData.hpCurrent + amount));
    }

    syncHeroStatsAfterBattle({ healthRatio, mpCurrent, isDead }) {
        this._syncLocked = true;
        const targetHp = isDead ? 1 : Math.max(1, Math.floor(this._rawHeroData.hpMax * healthRatio));
        this._rawHeroData.hpCurrent = targetHp;
        this._rawHeroData.mpCurrent = mpCurrent;
        this.worldManager.updateHUD();
        this._syncLocked = false;
        this.requestSync();
    }

    refreshHeroStats() {
        if (!this.heroData) return;
        
        const data = this._rawHeroData; // 内部计算全部基于 raw，不触发同步
        const s = data.stats;
        const identity = this.getHeroIdentity(data.id);
        if (!identity) return;
        
        const cb = identity.combatBase;
        const dummy = this.getPlayerHeroDummy();

        const realPower = modifierManager.getModifiedValue(dummy, 'power', s.power);
        const realSpells = modifierManager.getModifiedValue(dummy, 'spells', s.spells);
        const realMorale = modifierManager.getModifiedValue(dummy, 'morale', s.morale);

        modifierManager.addModifier({ 
            id: 'soldier_morale_atk', side: 'player', unitType: 'army', stat: 'attackDamage', 
            multiplier: 1.0 + (realMorale / 100), source: 'hero_stats' 
        });
        modifierManager.addModifier({ 
            id: 'soldier_morale_hp', side: 'player', unitType: 'army', stat: 'hp', 
            multiplier: 1.0 + (realMorale / 100), source: 'hero_stats' 
        });

        modifierManager.addModifier({
            id: 'hero_growth_hp', side: 'player', unitType: data.id, stat: 'hp',
            offset: realPower * cb.hpScaling, source: 'hero_stats'
        });

        modifierManager.addModifier({
            id: 'hero_growth_atk', side: 'player', unitType: data.id, stat: 'primary_attack_mult',
            multiplier: 1.0 + (realPower * (cb.atkScaling || 0.05)), source: 'hero_stats'
        });

        // 更新冗余字段
        data.hpMax = Math.ceil(modifierManager.getModifiedValue(dummy, 'hp', cb.hpBase));
        const baseMpStart = this._getHeroBaseStat(data.id, 'mpBase', 80);
        const scalingMp = this._getHeroBaseStat(data.id, 'mpScaling', 6);
        const baseMp = baseMpStart + (data.level - 1) * scalingMp;
        data.mpMax = Math.ceil(modifierManager.getModifiedValue(dummy, 'mp', baseMp));

        data.stats.finalSpells = modifierManager.getModifiedValue(dummy, 'skill_power', realSpells);
        data.stats.finalHaste = modifierManager.getModifiedValue(dummy, 'haste', 0);
        data.stats.finalLeadership = this.getHeroMaxLeadership();
        
        modifierManager.removeModifiersBySource('trait');
        const traits = this.getHeroTraits(data.id);
        traits.forEach(trait => {
            modifierManager.addModifier({
                ...trait, side: 'player', unitType: trait.unitType || data.id, source: 'trait'
            });
        });

        // 校正当前值
        data.hpCurrent = Math.max(0, Math.min(data.hpMax, data.hpCurrent));
        data.mpCurrent = Math.max(0, Math.min(data.mpMax, data.mpCurrent));

        if (!this._syncLocked) this.requestSync();
    }

    /**
     * 最终同步：将快照推送到 Zustand
     */
    syncToStore() {
        if (this._syncLocked) return;
        
        const data = this._rawHeroData;
        const identity = this.getHeroIdentity(data.id);
        const dummy = this.getPlayerHeroDummy();
        
        useHeroStore.getState().updateHero({
            id: data.id,
            name: identity?.name || '未知',
            title: identity?.title || '侠客',
            talentPoints: data.talentPoints || 0,
            talents: { ...data.talents }
        });

        useHeroStore.getState().updateStats({
            hp: data.hpCurrent, hpMax: data.hpMax, mp: data.mpCurrent, mpMax: data.mpMax,
            xp: data.xp, xpMax: data.xpMax, level: data.level,
            morale: Math.floor(modifierManager.getModifiedValue(dummy, 'morale', data.stats.morale)),
            leadership: this.getHeroMaxLeadership(),
            currentLeadership: this.getHeroCurrentLeadership(),
            power: Math.floor(modifierManager.getModifiedValue(dummy, 'power', data.stats.power)),
            spells: Math.floor(data.stats.finalSpells || 0),
            haste: Math.floor((data.stats.finalHaste || 0) * 100),
            speed: parseFloat((modifierManager.getModifiedValue(dummy, 'speed', data.stats.qinggong || 0.08)).toFixed(2)),
            primaryStatName: identity?.primaryStat || '力道',
            skills: [...data.skills]
        });

        useHeroStore.getState().updateArmy({ ...this._rawHeroArmy });
    }

    async grantRandomSkill(options = {}) {
        const { SkillRegistry, SectSkills } = await import('../systems/SkillSystem.js');
        const heroData = this.heroData;
        
        let candidateIds = [];
        if (options.pool) candidateIds = options.pool;
        else if (options.ignoreSect) candidateIds = Object.keys(SkillRegistry).filter(id => typeof SkillRegistry[id] !== 'function');
        else if (options.sect) candidateIds = SectSkills[options.sect] || [];
        else {
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

        this._syncLocked = true;
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
        this._syncLocked = false;
        this.requestSync();

        return selected;
    }

    getPlayerTotalPower() {
        return this.getArmyTotalPower(this._rawHeroArmy, this._rawHeroData.level);
    }

    getArmyTotalPower(army, level = 1) {
        let total = 0;
        for (const type in army) {
            const count = army[type];
            if (count > 0 && UNIT_COSTS[type]) total += count * (UNIT_COSTS[type].cost || 0);
        }
        total += level * 3;
        return total;
    }

    getHeroMaxLeadership() {
        return Math.floor(modifierManager.getModifiedValue(this.getPlayerHeroDummy(), 'leadership', this._rawHeroData.stats.leadership));
    }

    getHeroCurrentLeadership() {
        let current = 0;
        for (const type in this._rawHeroArmy) {
            const count = this._rawHeroArmy[type];
            if (count > 0 && UNIT_COSTS[type]) current += count * this.worldManager.getUnitCost(type);
        }
        return current;
    }

    updateHeroArmy(changes) {
        this._syncLocked = true;
        for (const type in changes) {
            const oldValue = this._rawHeroArmy[type] || 0;
            const newValue = Math.max(0, oldValue + changes[type]);
            this._rawHeroArmy[type] = newValue;
        }
        this.worldManager.updateHUD();
        this._syncLocked = false;
        this.requestSync();
    }

    loadSaveData(data) {
        if (!data) return;
        this._syncLocked = true;
        if (data.heroData) Object.assign(this._rawHeroData, JSON.parse(JSON.stringify(data.heroData)));
        if (data.heroArmy) {
            for (const key in this._rawHeroArmy) delete this._rawHeroArmy[key];
            Object.assign(this._rawHeroArmy, { ...data.heroArmy });
        }
        if (this.worldManager.factions['player']) this.worldManager.factions['player'].army = this.heroArmy;
        talentManager.init(this.heroData);
        this.refreshHeroStats();
        this._syncLocked = false;
        this.syncToStore();
    }

    getPlayerHeroDummy() {
        return { side: 'player', id: this._rawHeroData.id, type: this._rawHeroData.id, isHero: true };
    }

    getHeroIdentity(heroId) {
        return HERO_IDENTITY[heroId];
    }

    getHeroTraits(heroId) {
        const identity = HERO_IDENTITY[heroId];
        return identity ? identity.traits : [];
    }

    _getHeroBaseStat(heroId, statName, defaultValue) {
        const isCheat = this.worldManager.constructor.DEBUG.ENABLED && this.worldManager.constructor.DEBUG.START_RESOURCES;
        if (statName === 'mpBase' && isCheat) return 999;
        const identity = this.getHeroIdentity(heroId);
        if (identity && identity.combatBase && identity.combatBase[statName] !== undefined) return identity.combatBase[statName];
        return defaultValue;
    }
}
