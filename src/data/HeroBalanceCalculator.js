/**
 * 英雄均衡计算器 (Hero Balance Calculator)
 * 
 * 1. 基础属性表：列出力道、功法、统帅、带兵容量。
 * 2. 战斗换算表：基于 Level 1 初始 Stats 换算得到的真实战斗力。
 */

// --- 英雄原始身份数据 (对应 WorldManager.HERO_IDENTITY) ---
const HERO_IDENTITY = {
    'qijin': { 
        name: '祁进', 
        stats: { power: 7, spells: 12, morale: 6, leadership: 20 },
        combat: { atk: 28, hpBase: 300, hpScaling: 5, atkScaling: 0.02, range: 6.0, attackSpeed: 1000, burst: 5, targets: 1.0 }
    },
    'lichengen': { 
        name: '李承恩', 
        stats: { power: 5, spells: 8, morale: 10, leadership: 25 },
        combat: { atk: 40, hpBase: 300, hpScaling: 5, atkScaling: 0.02, range: 2.0, attackSpeed: 1000, burst: 1, targets: 2.5 }
    },
    'yeying_heavy': { 
        name: '叶英(重)', 
        stats: { power: 10, spells: 18, morale: 2, leadership: 15 },
        combat: { atk: 8, hpBase: 300, hpScaling: 5, atkScaling: 0.02, range: 2.5, attackSpeed: 1500, burst: 3, targets: 5.0 }
    },
    'yeying_light': { 
        name: '叶英(轻)', 
        stats: { power: 10, spells: 18, morale: 2, leadership: 15 },
        combat: { atk: 8, hpBase: 300, hpScaling: 5, atkScaling: 0.02, range: 1.0, attackSpeed: 600, burst: 1, targets: 1.0 }
    }
};

// 用于战力对齐的常量 (必须与士兵计算器中的天策弟子数据一致)
const BASELINE_MELEE = { hp: 85, dps: 6.0, score: Math.sqrt(85 * 6.0) * (1 + 0.8/10 * 0.2) };
const K = 2.0 / BASELINE_MELEE.score; // K = 0.0886

function calculateHeroCombat(h) {
    const hp = h.combat.hpBase + (h.stats.power * h.combat.hpScaling);
    const atk = h.combat.atk * (1 + h.stats.power * h.combat.atkScaling);
    const dps = (atk * (h.combat.burst || 1) * (h.combat.targets || 1.0)) / (h.combat.attackSpeed / 1000);
    
    // 战力评分 (含射程补偿)
    const baseScore = Math.sqrt(hp * dps);
    const rangeBonus = 1 + (h.combat.range / 10.0) * 0.2;
    const theoreticalPower = baseScore * rangeBonus * K;
    
    return { hp, atk, dps, theoreticalPower };
}

function runHeroCheck() {
    console.log(`\n=== 英雄大世界基础属性表 (Level 1 原始面板) ===`);
    console.log(`--------------------------------------------------------------------------------------`);
    console.log(`${"名称".padEnd(10)} | ${"力道/身法".padEnd(8)} | ${"功法(Spells)".padEnd(10)} | ${"统帅(Morale)".padEnd(10)} | ${"带兵容量(Lead)"}`);
    console.log(`--------------------------------------------------------------------------------------`);
    for (const [id, h] of Object.entries(HERO_IDENTITY)) {
        console.log(`${h.name.padEnd(8)} | ${h.stats.power.toString().padEnd(9)} | ${h.stats.spells.toString().padEnd(12)} | ${h.stats.morale.toString().padEnd(12)} | ${h.stats.leadership}`);
    }

    console.log(`\n=== 英雄战斗力平衡评估表 (相对于天策弟子=2.0) ===`);
    console.log(`---------------------------------------------------------------------------------------------------------`);
    console.log(`${"名称".padEnd(12)} | ${"换算HP".padEnd(5)} | ${"综合DPS".padEnd(7)} | ${"Range".padEnd(5)} | ${"设定Cost".padEnd(6)} | ${"理论战力".padEnd(6)} | ${"平衡度"}`);
    console.log(`---------------------------------------------------------------------------------------------------------`);
    for (const [id, h] of Object.entries(HERO_IDENTITY)) {
        const { hp, dps, theoreticalPower } = calculateHeroCombat(h);
        const cost = 15; // 英雄设定价值
        const balance = (theoreticalPower / cost) * 100;
        const balanceStr = balance > 115 ? `\x1b[31m${balance.toFixed(1)}%\x1b[0m` : balance < 85 ? `\x1b[34m${balance.toFixed(1)}%\x1b[0m` : `${balance.toFixed(1)}%`;
        
        console.log(`${h.name.padEnd(10)} | ${hp.toString().padEnd(6)} | ${dps.toFixed(1).toString().padEnd(7)} | ${h.combat.range.toString().padEnd(5)} | ${cost.toString().padEnd(8)} | ${theoreticalPower.toFixed(2).padEnd(6)} | ${balanceStr}`);
    }
    console.log(`---------------------------------------------------------------------------------------------------------`);
    console.log(`提示：英雄战力目标为 15.0 左右。若理论战力过高，建议削弱初始力道(Power)或基础攻击。`);
}

runHeroCheck();

