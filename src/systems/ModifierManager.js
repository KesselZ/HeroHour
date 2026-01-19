import { useModifierStore } from '../store/modifierStore';

/**
 * ModifierManager - 核心属性修正管理器
 * 
 * 性能优化：
 * 1. 批处理同步 (Batched Sync)：使用 Promise.resolve().then() 确保高频修改期间仅触发一次 Zustand 同步。
 * 2. 移除冗余事件：废弃 modifiers-updated DOM 事件，统一走 Zustand 响应式。
 */
class ModifierManager {
    constructor() {
        this.globalModifiers = []; // 全局修正 (如主角天赋、科技树)
        this._syncPending = false;
    }

    /**
     * 核心优化：将底层数据异步同步至 React Store
     */
    syncToStore() {
        if (this._syncPending) return;
        this._syncPending = true;

        // 采用微任务批处理，确保连续调用 addModifier 时只执行一次 store 更新
        Promise.resolve().then(() => {
            if (typeof window !== 'undefined') {
                useModifierStore.getState().syncModifiers([...this.globalModifiers]);
            }
            this._syncPending = false;
        });
    }

    /**
     * 添加或更新一个修正器
     */
    addModifier(mod) {
        if (!mod.id) {
            console.warn('[ModifierManager] mod.id is required');
        }

        const normalizedMod = {
            id: mod.id,
            side: mod.side,
            unitType: mod.unitType || 'global',
            stat: mod.stat,
            source: mod.source,
            targetUnit: mod.targetUnit, 
            multiplier: mod.multiplier !== undefined ? mod.multiplier : 1.0,
            offset: mod.offset || 0,
            startTime: mod.startTime || Date.now(),
            duration: mod.duration || null,
            onCleanup: mod.onCleanup || null,
            type: mod.type,
            method: mod.method
        };

        // 处理显式类型转换
        if (mod.value !== undefined) {
            switch (mod.type) {
                case 'mult': normalizedMod.multiplier = mod.value; break;
                case 'percent': normalizedMod.multiplier = 1 + mod.value; break;
                case 'add':
                default:
                    normalizedMod.offset = mod.value;
                    normalizedMod.multiplier = 1.0; 
                    break;
            }
        }

        const existingIndex = this.globalModifiers.findIndex(m => m.id === mod.id);
        if (existingIndex !== -1) {
            this.globalModifiers[existingIndex] = normalizedMod;
        } else {
            this.globalModifiers.push(normalizedMod);
        }

        this.syncToStore();
    }

    removeModifiersBySource(source) {
        this.globalModifiers = this.globalModifiers.filter(m => m.source !== source);
        this.syncToStore();
    }

    removeModifiersByTarget(unit) {
        if (!unit) return;
        this.globalModifiers = this.globalModifiers.filter(m => m.targetUnit !== unit);
        this.syncToStore();
    }

    clearBattleModifiers() {
        this.globalModifiers = this.globalModifiers.filter(m => {
            return !m.targetUnit && m.source !== 'skill' && m.source !== 'status' && m.source !== 'hero_mode';
        });
        this.syncToStore();
    }

    removeModifier(id) {
        if (!id) return;
        this.globalModifiers = this.globalModifiers.filter(m => m.id !== id);
        this.syncToStore();
    }

    getModifiedValue(unit, statName, baseValue) {
        // --- 1. 特殊逻辑聚合 (冷却、消耗、最终伤害等) ---
        
        if (statName === 'cooldown_multiplier' || statName === 'mana_cost_multiplier') {
            const baseHaste = unit.baseStats ? unit.baseStats.haste : (unit.stats ? unit.stats.haste : 0);
            const hasteVal = this.getModifiedValue(unit, 'haste', baseHaste);
            const hasteMultiplier = 1 - hasteVal;

            let extraMultiplier = 1.0;
            let extraOffset = 0;
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, statName)) continue;
                if (mod.type === 'mult') extraMultiplier *= mod.multiplier;
                else extraOffset += mod.offset;
            }
            return Math.max(0.1, baseValue * hasteMultiplier * extraMultiplier + extraOffset);
        }

        if (statName === 'final_skill_multiplier') {
            const baseSpells = unit.baseStats ? unit.baseStats.spells : (unit.stats ? unit.stats.spells : 0);
            const skillPower = this.getModifiedValue(unit, 'skill_power', baseSpells);
            const skillBonus = this.getModifiedValue(unit, 'skill_damage_bonus', 1.0);
            const moreDamage = this.getModifiedValue(unit, 'more_damage', 1.0);
            return baseValue * skillPower * skillBonus * moreDamage;
        }

        if (statName === 'final_power_skill_multiplier') {
            const primaryMult = this.getModifiedValue(unit, 'primary_attack_mult', 1.0);
            const skillBonus = this.getModifiedValue(unit, 'skill_damage_bonus', 1.0);
            const moreDamage = this.getModifiedValue(unit, 'more_damage', 1.0);
            return baseValue * primaryMult * skillBonus * moreDamage;
        }

        if (statName === 'final_attack_damage') {
            const baseFlat = this.getModifiedValue(unit, 'attackDamage', baseValue);
            const primaryMult = this.getModifiedValue(unit, 'primary_attack_mult', 1.0);
            const attackBonus = this.getModifiedValue(unit, 'attack_damage_bonus', 1.0);
            const moreDamage = this.getModifiedValue(unit, 'more_damage', 1.0);
            return baseFlat * primaryMult * attackBonus * moreDamage;
        }

        if (statName === 'attackSpeed') {
            let incSum = 0; let flatSum = 0;
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, 'attackSpeed')) continue;
                if (mod.multiplier !== undefined) incSum += (mod.multiplier - 1);
                flatSum += mod.offset || 0;
            }
            const finalSpeedMult = Math.min(2.0, (baseValue + flatSum) * (1 + incSum));
            return Math.max(0.1, finalSpeedMult);
        }

        // --- 2. 通用属性计算 (Inc/More/Flat) ---
        const targetStat = this._getActualStatMapping(statName);
        let moreProduct = 1.0; let incSum = 0; let flatSum = 0;
        let maxFlat = -Infinity; let hasFlat = false;

        for (const mod of this.globalModifiers) {
            if (!this._isMatch(mod, unit, targetStat)) continue;

            if (mod.type === 'mult' || mod.method === 'mult') {
                if (mod.multiplier !== undefined) moreProduct *= mod.multiplier;
            } else if (mod.type === 'percent' || mod.method === 'percent') {
                incSum += (mod.multiplier - 1);
            } else {
                if (mod.multiplier !== undefined && mod.multiplier !== 1.0) incSum += (mod.multiplier - 1);
                flatSum += mod.offset;
                if (mod.offset !== undefined) { maxFlat = Math.max(maxFlat, mod.offset); hasFlat = true; }
            }
        }

        if (statName === 'survival_rate' && hasFlat) flatSum = maxFlat;

        if (statName === 'damage_multiplier') {
            let finalReduction = 1.0;
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, targetStat)) continue;
                if (mod.offset) finalReduction *= Math.max(0, 1.0 - mod.offset);
                if (mod.multiplier !== 1.0 && (mod.type === 'mult' || mod.method === 'mult')) finalReduction *= mod.multiplier;
            }
            return finalReduction;
        }

        const totalMultiplier = moreProduct * (1 + incSum);
        const incomeStats = ['gold_income', 'wood_income', 'final_gold_income', 'final_wood_income', 'recruit_cost', 'xp_gain', 'survival_rate'];
        const flagStats = ['stun', 'invincible', 'controlImmune', 'tigerHeart'];
        
        let rawValue;
        if (incomeStats.includes(statName) || flagStats.includes(statName)) {
            rawValue = (baseValue + flatSum) * totalMultiplier;
        } else {
            rawValue = baseValue * totalMultiplier + flatSum;
        }

        return this._applyFinalFormula(statName, rawValue);
    }

    update(deltaTime) {
        const now = Date.now();
        const expiredModifiers = this.globalModifiers.filter(mod => {
            return mod.duration && mod.startTime && (now - mod.startTime) >= mod.duration;
        });

        if (expiredModifiers.length > 0) {
            expiredModifiers.forEach(mod => { if (mod.onCleanup) mod.onCleanup(); });
            this.globalModifiers = this.globalModifiers.filter(mod => {
                return !mod.duration || !mod.startTime || (now - mod.startTime) < mod.duration;
            });
            this.syncToStore();
        }
    }

    _getActualStatMapping(statName) {
        const mappings = { 'skill_power': 'spells', 'damage_multiplier': 'damageReduction', 'final_gold_income': 'gold_income', 'final_wood_income': 'wood_income' };
        return mappings[statName] || statName;
    }

    _applyFinalFormula(statName, value) {
        switch (statName) {
            case 'haste': return Math.min(0.40, value);
            case 'skill_power': return 1 + (value / 100);
            case 'final_gold_income':
            case 'final_wood_income': return Math.max(0, value);
            default: return value;
        }
    }

    _isMatch(mod, unit, statName) {
        if (mod.stat !== statName) return false;
        if (mod.targetUnit && mod.targetUnit !== unit) return false;
        if (mod.side && unit.side !== mod.side) return false;
        return !mod.unitType || mod.unitType === 'global' || (mod.unitType === 'army' && !unit.isHero) || unit.type === mod.unitType || (mod.unitType === 'hero' && unit.isHero);
    }

    clear() {
        this.globalModifiers = [];
        this.syncToStore();
    }
}

export const modifierManager = new ModifierManager();
