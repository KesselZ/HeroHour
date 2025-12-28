/**
 * 属性修正管理器
 * 负责全局和局部的属性加成计算，支持按阵营、兵种、属性名进行过滤
 */
class ModifierManager {
    constructor() {
        this.globalModifiers = []; // 全局修正 (如主角天赋、科技树)
    }

    /**
     * 添加一个修正器 (兼容旧版 addGlobalModifier)
     */
    addModifier(mod) {
        // 兼容处理：将 type 转为 unitType, value 转为 offset/multiplier
        const normalizedMod = {
            id: mod.id,
            side: mod.side,
            unitType: mod.unitType || mod.type,
            stat: mod.stat,
            source: mod.source,
            multiplier: mod.multiplier,
            offset: mod.offset
        };

        // 如果只有 value，根据属性名猜测是 offset 还是 multiplier
        if (mod.value !== undefined) {
            if (mod.stat.endsWith('_mult') || mod.stat.includes('multiplier') || Math.abs(mod.value) < 2) {
                // 如果数值很小或者是比例类属性，设为系数加成
                // 注意：这里需要根据实际业务逻辑微调
                normalizedMod.multiplier = 1 + mod.value;
            } else {
                normalizedMod.offset = mod.value;
            }
        }

        this.addGlobalModifier(normalizedMod);
    }

    /**
     * 添加一个全局修正器
     * @param {Object} mod { id, side, unitType, stat, multiplier, offset, source }
     * multiplier: 1.2 表示增加 20%
     * offset: 10 表示增加 10 点固定值
     */
    addGlobalModifier(mod) {
        // 防止重复添加同一个 ID 的修正器
        if (this.globalModifiers.find(m => m.id === mod.id)) {
            this.removeModifier(mod.id);
        }
        this.globalModifiers.push(mod);
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
        this.globalModifiers = this.globalModifiers.filter(m => m.id !== id);
    }

    /**
     * 计算修正后的数值 (核心 API)
     * @param {Object} unit 单位对象 (需包含 side, type 属性)
     * @param {string} statName 属性名 (如 'hp', 'speed', 'damage', 'range')
     * @param {number} baseValue 基础数值
     */
    getModifiedValue(unit, statName, baseValue) {
        let totalMultiplier = 1.0;
        let offsetTotal = 0;

        for (const mod of this.globalModifiers) {
            if (!this._isMatch(mod, unit, statName)) continue;

            // 核心重构：全部采用乘法叠算，极致简单
            if (mod.multiplier) totalMultiplier *= mod.multiplier;
            if (mod.offset) offsetTotal += mod.offset;
        }

        return baseValue * totalMultiplier + offsetTotal;
    }

    /**
     * 内部辅助：检查修正器是否匹配单位
     */
    _isMatch(mod, unit, statName) {
        if (mod.stat !== statName) return false;
        if (mod.side && unit.side !== mod.side) return false;
        
        // 核心增强：支持 army (所有非英雄) 和 global (所有人) 关键字
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

