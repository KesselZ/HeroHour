/**
 * 属性修正管理器
 * 负责全局和局部的属性加成计算，支持按阵营、兵种、属性名进行过滤
 */
class ModifierManager {
    constructor() {
        this.globalModifiers = []; // 全局修正 (如主角天赋、科技树)
    }

    /**
     * 添加一个修正器 (核心 API)
     * @param {Object} mod 
     * { 
     *   id: 唯一标识 (必填，用于覆盖 and 移除), 
     *   stat: 属性名, 
     *   value: 数值, 
     *   type: 'add' | 'mult' | 'percent', 
     *   source: 来源 (talent/building/skill),
     *   unitType: 作用兵种 (army/hero/global/具体兵种),
     *   side: 阵营 (player/enemy),
     *   targetUnit: 明确指向的单位对象 (可选，用于单个单位的 Buff)
     * }
     */
    addModifier(mod) {
        if (!mod.id) {
            console.warn('[ModifierManager] mod.id is required for reliable removal');
        }

        const normalizedMod = {
            id: mod.id,
            side: mod.side,
            unitType: mod.unitType || mod.type || 'global',
            stat: mod.stat,
            source: mod.source,
            targetUnit: mod.targetUnit, // 新增：支持直接锁定单位
            multiplier: mod.multiplier !== undefined ? mod.multiplier : 1.0,
            offset: mod.offset || 0
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
                    normalizedMod.multiplier = 1.0; // 确保加法时不带乘法
                    break;
            }
        }

        // 防止重复添加同一个 ID 的修正器 (唯一性保证)
        this.removeModifier(mod.id);
        this.globalModifiers.push(normalizedMod);
    }

    /**
     * 按来源批量移除修正器
     * @param {string} source 
     */
    removeModifiersBySource(source) {
        this.globalModifiers = this.globalModifiers.filter(m => m.source !== source);
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
     * 优雅重构：划分独立乘区与加法乘区，防止数值爆炸
     * 
     * 公式：最终值 = 基础值 * (Trait独立乘区) * (1 + Σ通用百分比加成) + Σ固定偏移量
     */
    getModifiedValue(unit, statName, baseValue) {
        let traitMultiplier = 1.0;      // 乘区 A: 英雄固有特性 (Trait)，各特性间独立相乘
        let commonAdditiveBonus = 0;    // 乘区 B: 天赋、建筑、属性等，同乘区内加法堆叠
        let offsetTotal = 0;            // 加法区: 固定值偏移

        for (const mod of this.globalModifiers) {
            if (!this._isMatch(mod, unit, statName)) continue;

            // 1. 判断是否属于独立乘区 (目前仅限 Trait)
            if (mod.source === 'trait') {
                if (mod.multiplier) traitMultiplier *= mod.multiplier;
            } else {
                // 2. 其余所有来源 (talent, building, hero_stats 等) 均进入加法堆叠乘区
                if (mod.multiplier) {
                    commonAdditiveBonus += (mod.multiplier - 1);
                }
            }
            
            // 3. 统计所有固定值偏移
            if (mod.offset) offsetTotal += mod.offset;
        }

        // 计算最终结果：独立乘区 * 加法乘区
        const totalMultiplier = traitMultiplier * (1 + commonAdditiveBonus);
        return baseValue * totalMultiplier + offsetTotal;
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
