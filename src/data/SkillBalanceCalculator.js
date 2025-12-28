import { SkillRegistry } from '../core/SkillRegistry.js';

/**
 * 视觉宽度补全工具：解决终端中中文字符对齐问题
 */
function getVisualWidth(str) {
    let width = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0x4e00 && code <= 0x9fa5) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

function visualPad(str, targetWidth) {
    str = String(str);
    const currentWidth = getVisualWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + ' '.repeat(padding);
}

// 核心提取逻辑：将技能分为伤害类和辅助类
const ALL_SKILLS = Object.values(SkillRegistry).map(skill => {
    const stats = {
        id: skill.id,
        name: skill.name,
        cost: skill.cost,
        level: skill.level,
        range: skill.targeting?.range || 0,
        radius: skill.targeting?.radius || 0,
        isSector: skill.targeting?.shape === 'sector',
        desc: skill.description,
        
        // 伤害维度
        totalDamage: 0,
        isDamage: false,
        
        // 辅助维度
        duration: 0,
        utilityStats: [], // 记录 buff 属性名
        isUtility: false
    };

    const processActions = (actions) => {
        if (!actions) return;
        actions.forEach(a => {
            // 伤害判定
            if (a.type === 'damage_aoe') {
                stats.totalDamage = a.value;
                stats.radius = a.targeting?.radius || skill.targeting?.radius || stats.radius;
                stats.isDamage = true;
            } else if (a.type === 'tick_effect') {
                if (a.onTickDamage) {
                    stats.totalDamage = a.onTickDamage * (a.duration / a.interval);
                    stats.radius = a.targeting?.radius || skill.targeting?.radius || stats.radius;
                    stats.isDamage = true;
                }
                if (a.onTickBuff) {
                    stats.duration = a.duration || stats.duration;
                    stats.isUtility = true;
                    const b = a.onTickBuff;
                    const s = Array.isArray(b.stat) ? b.stat : [b.stat];
                    stats.utilityStats.push(...s);
                }
            } else if (a.type === 'projectile') {
                stats.totalDamage = a.damage * (a.count || 1);
                stats.isDamage = true;
            } else if (a.type === 'movement' && a.damage) {
                stats.totalDamage = a.damage;
                stats.isDamage = true;
            }
            
            // 辅助判定 (Buff/Status)
            if (a.type === 'buff_aoe' || a.type === 'status_aoe') {
                stats.isUtility = true;
                stats.duration = a.duration || (a.params && a.params.duration) || stats.duration;
                stats.radius = a.targeting?.radius || skill.targeting?.radius || stats.radius;
                if (a.params && a.params.stat) {
                    const s = Array.isArray(a.params.stat) ? a.params.stat : [a.params.stat];
                    stats.utilityStats.push(...s);
                }
                if (a.status) stats.utilityStats.push(a.status);
            }

            if (a.landActions) processActions(a.landActions);
        });
    };

    processActions(skill.actions);
    
    return stats;
});

const DAMAGE_SKILLS = ALL_SKILLS.filter(s => s.isDamage);
const UTILITY_SKILLS = ALL_SKILLS.filter(s => s.isUtility);

function calculateExpectedTargets(s) {
    if (s.radius === 0) return 1.0;
    let targets = 1.0 + (s.radius * 2.0);
    if (s.isSector) targets *= 0.5;
    return Math.max(1.0, targets);
}

function runSkillCheck() {
    // --- 1. 伤害类 ---
    const baselineSkill = DAMAGE_SKILLS.find(s => s.id === 'sword_rain') || DAMAGE_SKILLS[0];
    const baselineEff = (baselineSkill.totalDamage * calculateExpectedTargets(baselineSkill)) / (baselineSkill.cost || 1);

    console.log(`\n=== 招式分析 [第一部分：伤害输出类] ===`);
    const cols = { name: 12, mp: 6, range: 6, dmg: 10, targets: 10, benefit: 10, eff: 10, status: 10 };
    const sep = '-'.repeat(Object.values(cols).reduce((a, b) => a + b, 0) + (Object.keys(cols).length * 3));
    
    console.log(sep);
    console.log(`${visualPad("名称", cols.name)} | ${visualPad("MP", cols.mp)} | ${visualPad("距离", cols.range)} | ${visualPad("总伤害", cols.dmg)} | ${visualPad("期望命中", cols.targets)} | ${visualPad("收益分", cols.benefit)} | ${visualPad("性价比", cols.eff)} | ${visualPad("分析", cols.status)}`);
    console.log(sep);

    DAMAGE_SKILLS.sort((a, b) => a.id.localeCompare(b.id)).forEach(s => {
        const targets = calculateExpectedTargets(s);
        const benefit = s.totalDamage * targets;
        const efficiency = (benefit / (s.cost || 1)) / baselineEff * 100;
        let color = efficiency > 150 ? "\x1b[31m" : efficiency < 70 ? "\x1b[34m" : "\x1b[0m";
        let statusStr = efficiency > 150 ? "极度溢出" : efficiency < 70 ? "数值亏损" : "合理";
        console.log(`${visualPad(s.name, cols.name)} | ${visualPad(s.cost, cols.mp)} | ${visualPad(s.range, cols.range)} | ${visualPad(s.totalDamage.toFixed(1), cols.dmg)} | ${visualPad(targets.toFixed(1), cols.targets)} | ${visualPad(benefit.toFixed(0), cols.benefit)} | ${color}${visualPad(efficiency.toFixed(1) + "%", cols.eff)}\x1b[0m | ${color}${visualPad(statusStr, cols.status)}\x1b[0m`);
    });
    console.log(sep);

    // --- 2. 辅助类 ---
    console.log(`\n=== 招式分析 [第二部分：辅助与控制类] ===`);
    const uCols = { name: 12, mp: 6, range: 6, dur: 8, targets: 10, effects: 30 };
    const uSep = '-'.repeat(Object.values(uCols).reduce((a, b) => a + b, 0) + (Object.keys(uCols).length * 3));

    console.log(uSep);
    console.log(`${visualPad("名称", uCols.name)} | ${visualPad("MP", uCols.mp)} | ${visualPad("距离", uCols.range)} | ${visualPad("时长(s)", uCols.dur)} | ${visualPad("影响人数", uCols.targets)} | ${visualPad("核心效果汇总", uCols.effects)}`);
    console.log(uSep);

    UTILITY_SKILLS.sort((a, b) => a.id.localeCompare(b.id)).forEach(s => {
        const targets = calculateExpectedTargets(s);
        const effectStr = [...new Set(s.utilityStats)].join(", ");
        console.log(`${visualPad(s.name, uCols.name)} | ${visualPad(s.cost, uCols.mp)} | ${visualPad(s.range, uCols.range)} | ${visualPad((s.duration/1000).toFixed(1), uCols.dur)} | ${visualPad(targets.toFixed(1), uCols.targets)} | ${visualPad(effectStr, uCols.effects)}`);
    });
    console.log(uSep);
}

runSkillCheck();
