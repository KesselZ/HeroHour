/**
 * 士兵属性均衡计算器 (Soldier Balance Calculator) - 调优版 v3
 * 
 * 1. 纯阳 Cost 下调至 5。
 * 2. 藏剑 Atk 下调 20% (9 -> 7.2)。
 * 3. 黑熊/铁浮屠 Cost 提升至 7。
 * 4. 傀儡 Atk 下调 20% (15 -> 12)。
 */

const UNIT_STATS = {
    // 玩家兵种
    'melee': { name: '天策弟子', hp: 85, atk: 6, attackSpeed: 1000, speed: 5.0, range: 0.8, burst: 1, targets: 1.0, cost: 2 },
    'ranged': { name: '长歌弟子', hp: 70, atk: 14, attackSpeed: 1800, speed: 4.2, range: 6.0, burst: 1, targets: 1.0, cost: 2 },
    'archer': { name: '唐门射手', hp: 65, atk: 22, attackSpeed: 2500, speed: 5.0, range: 20.0, burst: 1, targets: 1.0, cost: 3 },
    'chunyang_air': { name: '纯阳(气)', hp: 140, atk: 12, attackSpeed: 1500, speed: 5.9, range: 12.0, burst: 3, targets: 1.0, cost: 5 },
    'chunyang_sword': { name: '纯阳(剑)', hp: 140, atk: 18, attackSpeed: 1500, speed: 5.9, range: 1.2, burst: 1, targets: 1.5, cost: 5 },
    'tiance': { name: '天策骑兵', hp: 160, atk: 18, attackSpeed: 800, speed: 8.4, range: 1.8, burst: 1, targets: 2.5, cost: 8 },
    'cangjian': { name: '藏剑弟子', hp: 200, atk: 7.2, attackSpeed: 2000, speed: 5.9, range: 1.5, burst: 3, targets: 5.0, cost: 6 },
    'cangyun': { name: '苍云将士', hp: 300, atk: 14, attackSpeed: 1200, speed: 3.4, range: 0.8, burst: 1, targets: 1.2, cost: 5 },
    'healer': { name: '万花补给', hp: 120, atk: 30, attackSpeed: 2500, speed: 3.4, range: 5.0, burst: 1, targets: 1.0, cost: 4 },

    // 野外势力 (同步调优)
    'wild_boar': { name: '野猪', hp: 100, atk: 8, attackSpeed: 1000, speed: 5.0, range: 0.8, burst: 1, targets: 1.0, cost: 2 },
    'wolf': { name: '野狼', hp: 60, atk: 10, attackSpeed: 1000, speed: 6.7, range: 0.8, burst: 1, targets: 1.0, cost: 2 },
    'tiger': { name: '猛虎', hp: 180, atk: 15, attackSpeed: 1000, speed: 7.6, range: 1.2, burst: 1, targets: 1.2, cost: 5 },
    'bear': { name: '黑熊', hp: 250, atk: 18, attackSpeed: 1000, speed: 4.2, range: 1.0, burst: 1, targets: 1.5, cost: 7 },
    'heavy_knight': { name: '铁浮屠', hp: 300, atk: 25, attackSpeed: 1500, speed: 3.4, range: 1.5, burst: 1, targets: 1.5, cost: 7 },
    'shadow_ninja': { name: '隐之影', hp: 120, atk: 18, attackSpeed: 600, speed: 10.1, range: 0.8, burst: 1, targets: 1.0, cost: 5 },
    'zombie': { name: '毒尸傀儡', hp: 250, atk: 12, attackSpeed: 1000, speed: 2.5, range: 0.7, burst: 1, targets: 1.0, cost: 4 },
    'rebel_soldier': { name: '叛军甲兵', hp: 100, atk: 14, attackSpeed: 1000, speed: 4.2, range: 0.8, burst: 1, targets: 1.0, cost: 3 },
};

const MAX_RANGE = 20.0;

function calculateMetrics(unit) {
    const dps = (unit.atk * (unit.burst || 1) * (unit.targets || 1.0)) / (unit.attackSpeed / 1000);
    const baseScore = Math.sqrt(unit.hp * dps);
    const rangeBonus = 1 + (unit.range / MAX_RANGE) * 0.2;
    return { dps, score: baseScore * rangeBonus };
}

function runBalanceCheck() {
    const baseline = calculateMetrics(UNIT_STATS['melee']);
    const k = 2.0 / baseline.score; 

    console.log(`\n=== 士兵单位属性平衡分析报告 (调优版 v3) ===`);
    console.log(`-----------------------------------------------------------------------------------------------------------------`);
    console.log(`${"单位名称".padEnd(12)} | ${"HP".padEnd(4)} | ${"综合DPS".padEnd(7)} | ${"Range".padEnd(5)} | ${"Speed".padEnd(5)} | ${"设定Cost".padEnd(6)} | ${"理论战力".padEnd(6)} | ${"平衡度"}`);
    console.log(`-----------------------------------------------------------------------------------------------------------------`);

    for (const [id, unit] of Object.entries(UNIT_STATS)) {
        const { dps, score } = calculateMetrics(unit);
        const theoreticalPower = score * k;
        const balance = (theoreticalPower / unit.cost) * 100;

        const balanceStr = balance > 115 ? `\x1b[31m${balance.toFixed(1)}%\x1b[0m` : 
                           balance < 85 ? `\x1b[34m${balance.toFixed(1)}%\x1b[0m` : 
                           `${balance.toFixed(1)}%`;

        console.log(`${unit.name.padEnd(10)} | ${unit.hp.toString().padEnd(4)} | ${dps.toFixed(1).toString().padEnd(7)} | ${unit.range.toString().padEnd(5)} | ${unit.speed.toString().padEnd(5)} | ${unit.cost.toString().padEnd(8)} | ${theoreticalPower.toFixed(2).padEnd(6)} | ${balanceStr}`);
    }
}

runBalanceCheck();
