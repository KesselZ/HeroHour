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
 *    消费端: src/core/Skill.js -> getActualCooldown() / execute()
 *    ------------------------------------------------------------------------
 *    - [skillId]_cooldown_multiplier: [倍率] 独立乘法修正 (如: pinghu_cooldown_multiplier)
 *    - [skillId]_cooldown_override:   [绝对值] 强制覆盖 CD，优先级最高，单位 ms (如: tu_cooldown_override)
 *    - [skillId]_mana_cost_multiplier: [倍率] 内力消耗倍率
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
     * 优雅重构：支持逻辑依赖属性
     */
    getModifiedValue(unit, statName, baseValue) {
        // --- 1. 处理具有逻辑依赖的派生属性 (cooldown_multiplier 依赖 haste) ---
        if (statName === 'cooldown_multiplier' || statName === 'mana_cost_multiplier') {
            // 获取基础急速值 (此调用内部会自动应用 0.4 的阈值截断)
            const hasteVal = this.getModifiedValue(unit, 'haste', 0);
            const hasteMultiplier = 1 - hasteVal;

            // 获取该属性特有的额外修正 (专家建议：此处只建议使用 multiplier)
            let extraMultiplier = 1.0;
            let extraOffset = 0;
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, statName)) continue;
                if (mod.multiplier) extraMultiplier *= mod.multiplier;
                if (mod.offset) extraOffset += mod.offset;
            }

            // 最终公式：(1 - 急速) * 额外加成 + 额外偏移 (注意：extraOffset 需谨慎使用)
            return Math.max(0.1, baseValue * hasteMultiplier * extraMultiplier + extraOffset);
        }

        // --- 2. 属性名映射 (解耦 原始点数 与 最终倍率) ---
        const targetStat = this._getActualStatMapping(statName);
        
        // --- 3. 特殊处理：乘法堆叠属性 (减伤) ---
        if (statName === 'damage_multiplier') {
            // 核心修复：允许 0 作为合法的基数，只在 undefined 时回退到 1.0
            let finalMultiplier = (baseValue !== undefined) ? baseValue : 1.0;
            
            for (const mod of this.globalModifiers) {
                if (!this._isMatch(mod, unit, targetStat)) continue;
                if (mod.offset) finalMultiplier *= Math.max(0, 1.0 - mod.offset);
                if (mod.multiplier !== 1.0) finalMultiplier *= mod.multiplier;
            }
            return finalMultiplier;
        }

        // --- 4. 常规加法/乘法堆叠逻辑 ---
        let traitMultiplier = 1.0;      
        let commonAdditiveBonus = 0;    
        let offsetTotal = 0;            

        for (const mod of this.globalModifiers) {
            if (!this._isMatch(mod, unit, targetStat)) continue;

            if (mod.source === 'trait') {
                if (mod.multiplier) traitMultiplier *= mod.multiplier;
            } else {
                if (mod.multiplier) {
                    commonAdditiveBonus += (mod.multiplier - 1);
                }
            }
            if (mod.offset) offsetTotal += mod.offset;
        }

        const totalMultiplier = traitMultiplier * (1 + commonAdditiveBonus);
        
        // --- 5. 应用最终公式与阈值截断 ---
        // 核心修正：区分“叠加型”属性和“基础型”属性 (针对主角不动 Bug)
        // 逻辑：
        // A. 如果是产出类(income)或标记类(stun/invincible)，使用 (base + offset) * mult，确保 0 基础也能加成
        // B. 如果是原生战斗属性(hp/atk/speed)，使用 base * mult + offset，确保基础值不被偏移量反向稀释
        const incomeStats = ['gold_income', 'wood_income', 'final_gold_income', 'final_wood_income', 'recruit_cost', 'xp_gain', 'survival_rate'];
        const flagStats = ['stun', 'invincible', 'controlImmune', 'tigerHeart'];
        
        let rawValue;
        if (incomeStats.includes(statName) || flagStats.includes(statName)) {
            rawValue = (baseValue + offsetTotal) * totalMultiplier;
        } else {
            rawValue = baseValue * totalMultiplier + offsetTotal;
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
