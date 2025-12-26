/**
 * 属性修正管理器
 * 负责全局和局部的属性加成计算，支持按阵营、兵种、属性名进行过滤
 */
class ModifierManager {
    constructor() {
        this.globalModifiers = []; // 全局修正 (如主角天赋、科技树)
    }

    /**
     * 添加一个全局修正器
     * @param {Object} mod { id, side, unitType, stat, multiplier, offset }
     * multiplier: 1.2 表示增加 20%
     * offset: 10 表示增加 10 点固定值
     */
    addGlobalModifier(mod) {
        // 防止重复添加同一个 ID 的修正器
        if (this.globalModifiers.find(m => m.id === mod.id)) {
            // 如果 ID 相同，通常是更新逻辑，先移除旧的
            this.removeModifier(mod.id);
        }
        this.globalModifiers.push(mod);
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
        const isTypeMatch = !mod.unitType || unit.type === mod.unitType || (mod.unitType === 'hero' && unit.isHero);
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

