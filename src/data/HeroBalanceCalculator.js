/**
 * 英雄均衡计算器 (Hero Balance Calculator)
 * 
 * 1. 基础属性表：列出力道、功法、统帅、带兵容量。
 * 2. 战斗换算表：基于 Level 1 初始 Stats 换算得到的真实战斗力。
 */

import { UNIT_STATS_DATA, HERO_IDENTITY } from './UnitStatsData.js';

/**
 * 英雄均衡计算器 (Hero Balance Calculator) - 2.0 数据驱动版
 */

// 用于战力对齐的常量 (基准：天策弟子 = 2.0 战力)
const BASELINE_MELEE = { hp: 85, dps: 6.0, score: Math.sqrt(85 * 6.0) };
const K = 2.0 / BASELINE_MELEE.score;

/**
 * 计算英雄在特定模式下的战斗力
 * @param {string} heroId 
 * @param {string} mode 'default' | 'yeying_light' | 'yeying_heavy'
 */
function calculateHeroCombat(heroId, mode = 'default') {
    const ident = HERO_IDENTITY[heroId];
    const stats = UNIT_STATS_DATA[heroId];
    if (!ident || !stats) return null;

    const s = ident.initialStats;
    const cb = ident.combatBase;

    // 1. 基础属性换算 (同步 WorldManager.js 逻辑)
    const hp = cb.hpBase + (s.power * cb.hpScaling);
    let baseAtk = cb.atk * (1 + s.power * (cb.atkScaling || 0.05));
    
    // 2. 模式特定调整 (处理叶英轻重剑等逻辑)
    let actualAtk = baseAtk;
    let actualAS = stats.attackSpeed;
    let actualBurst = stats.burstCount || 1;
    let actualTargets = stats.targets || 1.0;
    let range = stats.range;

    if (heroId === 'yeying') {
        const m = stats.modes;
        if (mode === 'yeying_heavy') {
            const cfg = m.yeying_heavy;
            actualAtk = baseAtk * (cfg.atk / cb.atk);
            actualAS = stats.attackSpeed * (cfg.attackSpeed / stats.attackSpeed);
            actualTargets = cfg.targets || 5.0;
            actualBurst = cfg.burstCount || 3;
            range = cfg.range || 2.5;
        } else {
            const cfg = m.yeying_light;
            actualAtk = baseAtk * (cfg.atk / cb.atk);
            actualAS = stats.attackSpeed * (cfg.attackSpeed / stats.attackSpeed);
            actualTargets = cfg.targets || 1.0;
            actualBurst = cfg.burstCount || 1;
            range = cfg.range || 1.5; 
        }
    } else if (heroId === 'liwangsheng') {
        actualTargets = 1.0; // 纯阳剑气是单体
    } else if (heroId === 'lichengen') {
        const modes = stats.modes;
        if (mode === 'tiance_sweep') {
            // 点了天赋：横扫千军 (从数据表读取)
            const cfg = modes.sweep;
            actualAtk = baseAtk * cfg.atkMult;
            actualTargets = cfg.targets; 
        } else {
            // 默认状态：单体突刺 (从数据表读取)
            const cfg = modes.pierce;
            actualAtk = baseAtk * cfg.atkMult;
            actualTargets = cfg.targets;
        }
    }

    // 3. 计算 DPS
    const dps = (actualAtk * actualBurst * actualTargets) / (actualAS / 1000);

    // 4. 战力评分 (移除射程补偿，仅根据 HP 和 DPS 计算)
    const theoreticalPower = Math.sqrt(hp * dps) * K;

    return { 
        name: mode === 'default' ? stats.name : (mode === 'yeying_heavy' ? '叶英(重)' : '叶英(轻)'),
        hp, 
        atk: actualAtk, 
        dps, 
        range,
        targets: actualTargets,
        theoreticalPower 
    };
}

// 辅助函数：处理中文字符的对齐
function getDisplayWidth(str) {
    if (str === undefined || str === null) return 0;
    str = str.toString();
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        width += str.charCodeAt(i) > 255 ? 2 : 1;
    }
    return width;
}

function padRight(str, targetWidth) {
    if (str === undefined || str === null) str = "";
    str = str.toString();
    const currentWidth = getDisplayWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + ' '.repeat(padding);
}

function runHeroCheck() {
    console.log(`\n=== 英雄大世界基础属性表 (Level 1 原始面板) ===`);
    console.log(`--------------------------------------------------------------------------------------`);
    console.log(`${padRight("名称", 10)} | ${padRight("力道/身法", 10)} | ${padRight("功法(Spells)", 12)} | ${padRight("统帅(Morale)", 12)} | ${padRight("带兵容量", 10)}`);
    console.log(`--------------------------------------------------------------------------------------`);
    
    for (const [id, h] of Object.entries(HERO_IDENTITY)) {
        const name = UNIT_STATS_DATA[id]?.name || id;
        console.log(`${padRight(name, 10)} | ${padRight(h.initialStats.power, 10)} | ${padRight(h.initialStats.spells, 12)} | ${padRight(h.initialStats.morale, 12)} | ${h.initialStats.leadership}`);
    }

    console.log(`\n=== 英雄战斗力平衡评估表 (相对于天策弟子=2.0) ===`);
    console.log(`----------------------------------------------------------------------------------------------------------------------------`);
    console.log(`${padRight("名称", 12)} | ${padRight("换算HP", 8)} | ${padRight("单次伤害", 10)} | ${padRight("综合DPS", 10)} | ${padRight("Range", 8)} | ${padRight("Targets", 8)} | ${padRight("设定Cost", 10)} | ${padRight("理论战力", 10)} | ${padRight("平衡度", 10)}`);
    console.log(`----------------------------------------------------------------------------------------------------------------------------`);
    
    const heroesToCheck = [
        { id: 'liwangsheng', mode: 'default' },
        { id: 'lichengen', mode: 'default' },
        { id: 'lichengen', mode: 'tiance_sweep' },
        { id: 'yeying', mode: 'yeying_heavy' },
        { id: 'yeying', mode: 'yeying_light' }
    ];

    for (const item of heroesToCheck) {
        const result = calculateHeroCombat(item.id, item.mode);
        if (!result) continue;

        const nameDisplay = item.id === 'lichengen' 
            ? (item.mode === 'tiance_sweep' ? '李承恩(扫)' : '李承恩(刺)')
            : result.name;

        const cost = 20; // 英雄设定价值 (调整为 20)
        const balance = (result.theoreticalPower / cost) * 100;
        
        const colorCode = balance > 110 ? '\x1b[31m' : (balance < 90 ? '\x1b[34m' : '');
        const resetCode = '\x1b[0m';
        const balanceStr = `${colorCode}${balance.toFixed(1)}%${resetCode}`;
        
        console.log(`${padRight(nameDisplay, 12)} | ${padRight(result.hp, 8)} | ${padRight(result.atk.toFixed(1), 10)} | ${padRight(result.dps.toFixed(1), 10)} | ${padRight(result.range.toFixed(1), 8)} | ${padRight(result.targets.toFixed(1), 8)} | ${padRight(cost, 10)} | ${padRight(result.theoreticalPower.toFixed(2), 10)} | ${balanceStr}`);
    }
    console.log(`----------------------------------------------------------------------------------------------------------------------------`);
    console.log(`提示：英雄战力目标为 15.0 左右。目前已同步最新数值调整。`);
}

runHeroCheck();


