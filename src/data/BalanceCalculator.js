/**
 * 士兵属性均衡计算器 (Soldier Balance Calculator) - 自动化版 v4
 * 
 * 核心重构：直接从 UnitStatsData.js 引入真实数据，确保分析结果与游戏实际逻辑完全同步。
 */

import { UNIT_STATS_DATA, UNIT_COSTS } from './UnitStatsData.js';

const UNIT_STATS = {};
for (const id in UNIT_STATS_DATA) {
    const baseUnit = UNIT_STATS_DATA[id];
    const pricing = UNIT_COSTS[id] || { gold: 0, cost: 1 };
    
    if (baseUnit.modes) {
        for (const modeId in baseUnit.modes) {
            const mode = baseUnit.modes[modeId];
            UNIT_STATS[modeId] = {
                ...baseUnit,
                ...mode,
                name: mode.name || baseUnit.name,
                cost: pricing.cost,
                gold: pricing.gold
            };
        }
    } else {
        UNIT_STATS[id] = {
            ...baseUnit,
            cost: pricing.cost,
            gold: pricing.gold
        };
    }
}


const MAX_RANGE = 20.0;

function calculateMetrics(unit) {
    const burst = unit.burstCount || unit.burst || 1;
    const targets = unit.targets || 1.0;
    const dps = (unit.atk * burst * targets) / (unit.attackSpeed / 1000);
    const baseScore = Math.sqrt(unit.hp * dps);
    const rangeBonus = 1 + (unit.range / MAX_RANGE) * 0.2;
    return { dps, score: baseScore * rangeBonus };
}

// 辅助函数：计算包含中文字符串的显示宽度
function getDisplayWidth(str) {
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        width += str.charCodeAt(i) > 255 ? 2 : 1;
    }
    return width;
}

// 辅助函数：对齐包含中文的字符串
function padRight(str, targetWidth) {
    const currentWidth = getDisplayWidth(str);
    return str + ' '.repeat(Math.max(0, targetWidth - currentWidth));
}

function runBalanceCheck() {
    const baseline = calculateMetrics(UNIT_STATS['melee']);
    const k = 2.0 / baseline.score; 

    console.log(`\n=== 士兵单位属性平衡分析报告 (经济效率增强版 v5) ===`);
    const header = `${padRight("单位名称", 14)} | ${"HP".padEnd(4)} | ${"综合DPS".padEnd(7)} | ${"Range".padEnd(5)} | ${"Cost".padEnd(4)} | ${"Gold".padEnd(5)} | ${"理论战力".padEnd(6)} | ${"统御平衡".padEnd(8)} | ${"经济效率"}`;
    console.log(`-`.repeat(header.length + 10));
    console.log(header);
    console.log(`-`.repeat(header.length + 10));

    for (const [id, unit] of Object.entries(UNIT_STATS)) {
        if (unit.hp === undefined || unit.atk === undefined) continue;

        const { dps, score } = calculateMetrics(unit);
        const theoreticalPower = score * k;
        
        // 1. 统御平衡度
        const balance = (theoreticalPower / unit.cost) * 100;
        let balanceValue = balance.toFixed(1) + "%";
        let balanceStr = balance > 115 ? `\x1b[31m${balanceValue}\x1b[0m` : 
                         balance < 85 ? `\x1b[34m${balanceValue}\x1b[0m` : 
                         balanceValue;

        // 2. 经济效率
        const goldEfficiency = unit.gold > 0 ? (theoreticalPower / (unit.gold / 25)) : 1.0;
        let geValue = goldEfficiency.toFixed(2);
        let geStr = goldEfficiency > 1.1 ? `\x1b[32m${geValue}\x1b[0m` : 
                      goldEfficiency < 0.8 ? `\x1b[33m${geValue}\x1b[0m` : 
                      geValue;

        const nameStr = padRight(unit.name, 14);
        const hpStr = (unit.hp || 0).toString().padEnd(4);
        const dpsStr = dps.toFixed(1).toString().padEnd(7);
        const rangeStr = (unit.range || 0).toString().padEnd(5);
        const costStr = (unit.cost || 0).toString().padEnd(4);
        const goldStr = (unit.gold || 0).toString().padEnd(5);
        const powerStr = theoreticalPower.toFixed(2).padEnd(6);

        // 颜色代码不计入宽度，所以手动对齐
        console.log(`${nameStr} | ${hpStr} | ${dpsStr} | ${rangeStr} | ${costStr} | ${goldStr} | ${powerStr} | ${balanceStr.padEnd(balance > 115 || balance < 85 ? 17 : 8)} | ${geStr}`);
    }
}

runBalanceCheck();
