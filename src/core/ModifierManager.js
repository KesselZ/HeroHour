/**
 * ModifierManager - 核心属性修正管理器
 * 
 * ============================================================================
 * 设计哲学：约定优于配置 (Convention over Configuration, CoC)
 * ============================================================================
 * 为了实现英雄技能、天赋、Buff 系统的高度解耦，我们采用了一套声明式的命名协议。
 * 
 * [核心逻辑]：
 * 消费端（如 Skill.js）不查询具体的英雄或天赋，而是查询特定命名的“属性（Stat）”。
 * 生产端（如 TalentRegistry.js）通过 addModifier 注入这些属性。
 * 
 * ============================================================================
 * 命名协议清单 (Protocol Registry)
 * ============================================================================
 * 
 * 1. 技能控制协议 (Skill Control Protocol)
 *    消费端: src/core/Skill.js -> getActualCooldown() / getActualDuration() / getActualRadius()
 *    ------------------------------------------------------------------------
 *    - [skillId/category]_cooldown_multiplier: [倍率] 独立乘法修正
 *    - [skillId/category]_cooldown_override:   [绝对值] 强制覆盖 CD (ms)
 *    - [skillId/category]_duration_offset:     [绝对值] 增加时长 (ms)
 *    - [skillId/category]_duration_override:   [绝对值] 强制覆盖时长 (ms)
 *    - [skillId/category]_radius_multiplier:   [倍率] 范围缩放
 *    - [skillId/category]_mana_cost_multiplier: [倍率] 内力消耗倍率
 * 
 *    协议格式约定: [作用域]_[标识符]_[属性]_[方式]
 *    作用域(Scope): skill (针对具体 ID) 或 category (针对招式类别)
 *    属性(Property): cooldown, duration, radius, mana_cost
 *    方式(Method): multiplier (乘法), offset (加法), override (覆盖)
 * 
 * 2. 英雄机制协议 (Hero Mechanism Protocol)
 *    消费端: src/entities/Soldier.js -> performAttack() 或其他特定逻辑
 *    ------------------------------------------------------------------------
 *    - tiance_yulin_enabled: [开关] 1=开启 AOE 扫击模式, 0=默认单体模式
 *    - tiance_bleeding_enabled: [系数] 非 0 则开启招式流血，值为伤害百分比 (如 0.15)
 *    - cangjian_fengming_enabled: [开关] 1=开启凤鸣奇穴联动逻辑
 * 
 * 3. 基础状态协议 (Core Flag Protocol)
 *    消费端: src/core/ModifierManager.js -> getModifiedValue() 的 flagStats 列表
 *    ------------------------------------------------------------------------
 *    - stun: [开关] 1=眩晕，无法行动
 *    - invincible: [开关] 1=无敌，不接收伤害判定
 *    - controlImmune: [开关] 1=免疫控制
 */
class ModifierManager {
    constructor() {
        this.globalModifiers = []; // 全局修正 (如主角天赋、科技树)
    }

    /**
     * 添加或更新一个修正器 (核心 API)
     * @param {Object} mod 
     */
    addModifier(mod) {
        if (!mod.id) {
            console.warn('[ModifierManager] mod.id is required for reliable removal');
        }

        const normalizedMod = {
            id: mod.id,
            side: mod.side,
            unitType: mod.unitType || 'global', // 核心修复：不再使用 mod.type 作为 fallback，防止与计算类型冲突
            stat: mod.stat,
            source: mod.source,
            targetUnit: mod.targetUnit, 
            multiplier: mod.multiplier !== undefined ? mod.multiplier : 1.0,
            offset: mod.offset || 0,
            startTime: mod.startTime || Date.now(),
            duration: mod.duration || null,
            onCleanup: mod.onCleanup || null // 核心新增：支持过期后的清理回调
        };

        // 处理显式类型转换
        if (mod.value !== undefined) {
            switch (mod.type) {
                case 'mult':
                    normalizedMod.multiplier = mod.value;
                    break;
                case 'percent':
                    normalizedMod.multiplier = 1 + mod.value;
                    break;
                case 'add':
                default:
                    normalizedMod.offset = mod.value;
                    normalizedMod.multiplier = 1.0; 
                    break;
            }
        }

        // --- 核心优化：原地更新以防止数值闪烁与状态丢失 ---
        const existingIndex = this.globalModifiers.findIndex(m => m.id === mod.id);
        if (existingIndex !== -1) {
            this.globalModifiers[existingIndex] = normalizedMod;
        } else {
            this.globalModifiers.push(normalizedMod);
        }
    }

    /**
     * 按来源批量移除修正器
     * @param {string} source 
     */
    removeModifiersBySource(source) {
        this.globalModifiers = this.globalModifiers.filter(m => m.source !== source);
    }

    /**
     * 移除特定单位的所有修正器 (解决内存泄漏与性能压力)
     * @param {Object} unit 
     */
    removeModifiersByTarget(unit) {
        if (!unit) return;
        this.globalModifiers = this.globalModifiers.filter(m => m.targetUnit !== unit);
    }

    /**
     * 清理所有战斗相关的瞬时修正器 (通常在战斗结束时调用)
     * 移除所有具有 targetUnit 的修正器，以及来源为 skill 或 status 的修正器
     */
    clearBattleModifiers() {
        this.globalModifiers = this.globalModifiers.filter(m => {
            // 保留没有 targetUnit 且 来源不是 skill/status/hero_mode 的修正器 (如天赋)
            const isPermanent = !m.targetUnit && 
                              m.source !== 'skill' && 
                              m.source !== 'status' && 
                              m.source !== 'hero_mode';
            return isPermanent;
        });
    }

    /**
     * 移除指定的修正器
     * @param {string} id 
     */
    removeModifier(id) {
        if (!id) return;
        this.globalModifiers = this.globalModifiers.filter(m => m.id !== id);
    }

    /**
     * 计算修正后的数值 (核心 API)
     * 遵循标准的 RPG 数值模型：Final = (Base * Product(More) * (1 + Sum(Inc))) + Sum(Flat)
     */
    getModifiedValue(unit, statName, baseValue) {
        // --- 1. 处理具有逻辑依赖的派生属性 (聚合桶逻辑) ---
        
        // 1.1 冷却与消耗
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

        // 1.2 最终技能倍率聚合 (聚合功法桶、技能增伤桶、最终乘区)
        if (statName === 'final_skill_multiplier') {
            const baseSpells = unit.baseStats ? unit.baseStats.spells : (unit.stats ? unit.stats.spells : 0);
            const skillPower = this.getModifiedValue(unit, 'skill_power', baseSpells);
            const skillBonus = this.getModifiedValue(unit, 'skill_damage_bonus', 1.0);
            const moreDamage = this.getModifiedValue(unit, 'more_damage', 1.0);
            return baseValue * skillPower * skillBonus * moreDamage;
        }

        // 1.3 最终外功技能倍率聚合 (聚合主属性桶、技能增伤桶、最终乘区)
        if (statName === 'final_power_skill_multiplier') {
            const primaryMult = this.getModifiedValue(unit, 'primary_attack_mult', 1.0);
            const skillBonus = this.getModifiedValue(unit, 'skill_damage_bonus', 1.0);
            const moreDamage = this.getModifiedValue(unit, 'more_damage', 1.0);
            return baseValue * primaryMult * skillBonus * moreDamage;
        }

        // 1.4 普攻最终伤害聚合
        if (statName === 'final_attack_damage') {
            const baseFlat = this.getModifiedValue(unit, 'attackDamage', baseValue);
            const primaryMult = this.getModifiedValue(unit, 'primary_attack_mult', 1.0);
            const attackBonus = this.getModifiedValue(unit, 'attack_damage_bonus', 1.0);
            const moreDamage = this.getModifiedValue(unit, 'more_damage', 1.0);
            return baseFlat * primaryMult * attackBonus * moreDamage;
        }

        // --- 1.5 攻速安全收敛 (核心改动) ---
        if (statName === 'attackSpeed') {
            // 无论 mod.type 是什么，统一转为百分比加成，防止指数级爆炸
            let incSum = 0; 
            let flatSum = 0;
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, 'attackSpeed')) continue;
                if (mod.multiplier !== undefined) incSum += (mod.multiplier - 1);
                flatSum += mod.offset || 0;
            }
            // 限制最高提速至 2.0 倍，最低不低于 0.1 倍
            const finalSpeedMult = Math.min(2.0, (baseValue + flatSum) * (1 + incSum));
            return Math.max(0.1, finalSpeedMult);
        }

        // --- 2. 属性名映射 ---
        const targetStat = this._getActualStatMapping(statName);
        
        // --- 3. 核心计算循环 (三区模型) ---
        let moreProduct = 1.0;      // 独立乘区 (More)
        let incSum = 0;             // 加法乘区 (Increased)
        let flatSum = 0;            // 基础加算 (Flat)

        for (const mod of this.globalModifiers) {
            if (!this._isMatch(mod, unit, targetStat)) continue;

            // 根据 mod.type 自动分流
            if (mod.type === 'mult' || mod.method === 'mult') {
                if (mod.multiplier !== undefined) moreProduct *= mod.multiplier;
            } else if (mod.type === 'percent' || mod.method === 'percent') {
                incSum += (mod.multiplier - 1);
            } else {
                // 兼容性逻辑：如果 mod 只有 multiplier 但没标 type，默认视为加法增伤 (Inc)
                if (mod.multiplier !== undefined && mod.multiplier !== 1.0) {
                    incSum += (mod.multiplier - 1);
                }
                flatSum += mod.offset;
            }
        }

        // 特殊处理：减伤属性 (damage_multiplier) 采用乘法堆叠逻辑
        // 逻辑：每层减伤独立，计算最终剩余承伤比。例如 20% + 20% = 0.8 * 0.8 = 0.64 (即减伤 36%)
        if (statName === 'damage_multiplier') {
            let finalReduction = 1.0;
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, targetStat)) continue;
                if (mod.offset) finalReduction *= Math.max(0, 1.0 - mod.offset);
                // 允许使用 mult 类型直接提供 More 减伤系数
                if (mod.multiplier !== 1.0 && (mod.type === 'mult' || mod.method === 'mult')) finalReduction *= mod.multiplier;
            }
            return finalReduction;
        }

        // --- 4. 最终公式应用 (Inc/More/Flat) ---
        // 公式：(Base * More * (1 + Sum(Inc))) + Flat
        const totalMultiplier = moreProduct * (1 + incSum);
        
        // 区分产出类和战斗属性类 (保持原有 Base+Flat 的位置逻辑)
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

    /**
     * 核心新增：自动生命周期管理
     */
    update(deltaTime) {
        const now = Date.now();
        const initialCount = this.globalModifiers.length;
        
        // 找出已过期的修正器
        const expiredModifiers = this.globalModifiers.filter(mod => {
            if (mod.duration && mod.startTime) {
                return (now - mod.startTime) >= mod.duration;
            }
            return false;
        });

        if (expiredModifiers.length > 0) {
            // 执行清理回调
            expiredModifiers.forEach(mod => {
                if (mod.onCleanup) mod.onCleanup();
            });

            // 从列表中移除
            this.globalModifiers = this.globalModifiers.filter(mod => {
                if (mod.duration && mod.startTime) {
                    return (now - mod.startTime) < mod.duration;
                }
                return true;
            });

            window.dispatchEvent(new CustomEvent('modifiers-updated'));
        }
    }

    /**
     * 内部辅助：属性名映射
     */
    _getActualStatMapping(statName) {
        const mappings = {
            'skill_power': 'spells',          // 映射：倍率出口 -> 原始点数源
            'damage_multiplier': 'damageReduction',
            'final_gold_income': 'gold_income',
            'final_wood_income': 'wood_income'
        };
        return mappings[statName] || statName;
    }

    /**
     * 内部辅助：应用最终公式与阈值截断
     */
    _applyFinalFormula(statName, value) {
        switch (statName) {
            case 'haste':
                return Math.min(0.40, value);
            
            case 'skill_power':
                // 专家建议：skill_power 专门作为倍率出口，计算公式统一在此
                return 1 + (value / 100);

            case 'final_gold_income':
            case 'final_wood_income':
                return Math.max(0, value);

            default:
                return value;
        }
    }

    /**
     * 内部辅助：检查修正器是否匹配单位
     */
    _isMatch(mod, unit, statName) {
        if (mod.stat !== statName) return false;
        
        // 1. 如果指定了具体单位，则必须匹配该单位
        if (mod.targetUnit && mod.targetUnit !== unit) return false;

        // 2. 阵营过滤
        if (mod.side && unit.side !== mod.side) return false;
        
        // 3. 兵种类型过滤：支持 army (所有非英雄) 和 global (所有人) 关键字
        const isTypeMatch = !mod.unitType || 
                           mod.unitType === 'global' ||
                           (mod.unitType === 'army' && !unit.isHero) ||
                           unit.type === mod.unitType || 
                           (mod.unitType === 'hero' && unit.isHero);
        
        return isTypeMatch;
    }

    /**
     * 清空所有修正器 (通常在游戏重启或新局开始时调用)
     */
    clear() {
        this.globalModifiers = [];
    }
}

export const modifierManager = new ModifierManager();
