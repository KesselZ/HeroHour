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
            console.warn(`Modifier with id ${mod.id} already exists.`);
            return;
        }
        this.globalModifiers.push(mod);
        console.log(`%c[属性加成] %c已应用: ${mod.id}`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
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
        let multiplierTotal = 1.0;
        let offsetTotal = 0;

        for (const mod of this.globalModifiers) {
            // 1. 检查阵营是否匹配 (side: 'player' | 'enemy')
            if (mod.side && unit.side !== mod.side) continue;
            
            // 2. 检查兵种是否匹配 (unitType: 'chunyang' | 'tiance' 等)
            if (mod.unitType && unit.type !== mod.unitType) continue;
            
            // 3. 检查属性名是否匹配
            if (mod.stat !== statName) continue;

            // 叠加倍率 (加法叠算，如两个 20% 叠加为 1 + 0.2 + 0.2 = 1.4)
            if (mod.multiplier) {
                multiplierTotal += (mod.multiplier - 1);
            }
            // 叠加固定值
            if (mod.offset) {
                offsetTotal += mod.offset;
            }
        }

        return baseValue * multiplierTotal + offsetTotal;
    }

    /**
     * 清空所有修正器 (通常在游戏重启或新局开始时调用)
     */
    clear() {
        this.globalModifiers = [];
    }
}

export const modifierManager = new ModifierManager();

