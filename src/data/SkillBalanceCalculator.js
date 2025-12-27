/**
 * 技能平衡性计算器 (AOE 加权版)
 * 
 * 逻辑：
 * 1. 总伤害 = 单发 * 段数/频率
 * 2. 期望命中 (Targets) = 1 + 半径 (单体为1，半径1.0为2，半径5.0为6)
 * 3. 收益分 = 总伤害 * 期望命中
 * 4. 性价比 = 收益分 / 蓝量
 */

const DAMAGE_SKILLS = [
    // --- 纯阳 ---
    { id: 'sixiang', name: '四象轮回', cost: 25, level: '初级', damage: 35, count: 5, radius: 0, type: 'projectile', desc: '单体连发' },
    { id: 'sword_rain', name: '五方行尽', cost: 35, level: '初级', damage: 80, radius: 3, type: 'aoe_burst', desc: '圆形AOE' },
    { id: 'liangyi', name: '两仪化形', cost: 40, level: '高级', damage: 45, count: 10, radius: 0, type: 'projectile', desc: '单体连发' },
    { id: 'divine_sword_rain', name: '六合独尊', cost: 55, level: '高级', damage: 16, duration: 3000, interval: 500, radius: 4.5, type: 'aoe_tick', desc: '大范围持续' },
    { id: 'wanshi', name: '万世不竭', cost: 80, level: '绝技', damage: 38.5, count: 20, radius: 0, type: 'projectile', desc: '单体乱射' },

    // --- 天策 ---
    { id: 'tu', name: '突', cost: 35, level: '初级', damage: 55, radius: 0, type: 'dash', desc: '单体冲锋' },
    { id: 'zhanbafang', name: '战八方', cost: 30, level: '初级', damage: 45, duration: 1000, interval: 500, radius: 4, type: 'aoe_tick', desc: '近身圆周' },
    { id: 'pochongwei', name: '破重围', cost: 45, level: '高级', damage: 75, radius: 3, type: 'aoe_burst', desc: '震地' },

    // --- 藏剑 ---
    { id: 'pinghu', name: '平湖断月', cost: 15, level: '初级', damage: 60, radius: 2.5, isSector: true, type: 'aoe_burst', desc: '扇形' },
    { id: 'fengcha', name: '峰插云景', cost: 30, level: '初级', damage: 35, radius: 4, isSector: true, type: 'aoe_burst', desc: '扇形' },
    { id: 'hegui', name: '鹤归孤山', cost: 40, level: '高级', damage: 80, radius: 2.5, type: 'aoe_burst', desc: '重剑震地' },
    { id: 'songshe', name: '松舍问霞', cost: 65, level: '高级', damage: 145, radius: 1.0, type: 'single', desc: '重剑斩(附带微小AOE)' },
    { id: 'fenglaiwushan', cost: 50, name: '风来吴山', level: '绝技', damage: 18, duration: 3000, interval: 300, radius: 5, type: 'aoe_tick', desc: '大风车' },
];

function calculateTotalDamage(s) {
    switch (s.type) {
        case 'projectile': return s.damage * s.count;
        case 'aoe_tick': return s.damage * (s.duration / s.interval);
        default: return s.damage;
    }
}

/**
 * 核心：计算期望命中目标数
 */
function calculateExpectedTargets(s) {
    if (s.radius === 0) return 1.0; // 纯单体
    
    // 基础公式：1 + 半径
    let targets = 1.0 + s.radius;
    
    // 扇形修正：扇形通常只有 90-120 度，命中潜力减半
    if (s.isSector) targets *= 0.5;
    
    return Math.max(1.0, targets);
}

function runSkillCheck() {
    const baselineSkill = DAMAGE_SKILLS.find(s => s.id === 'sword_rain');
    const baselineEff = (calculateTotalDamage(baselineSkill) * calculateExpectedTargets(baselineSkill)) / baselineSkill.cost;

    console.log(`\n=== 招式全维度平衡分析 (AOE 加权版) ===`);
    console.log(`公式: 收益 = 总伤害 * (1 + 半径) | 基准: ${baselineSkill.name}`);
    console.log(`-----------------------------------------------------------------------------------------------------------------`);
    console.log(`${"名称".padEnd(10)} | ${"MP".padEnd(3)} | ${"总伤害".padEnd(6)} | ${"期望命中".padEnd(6)} | ${"收益分".padEnd(7)} | ${"性价比".padEnd(6)} | ${"分析"}`);
    console.log(`-----------------------------------------------------------------------------------------------------------------`);

    DAMAGE_SKILLS.forEach(s => {
        const totalDmg = calculateTotalDamage(s);
        const targets = calculateExpectedTargets(s);
        const benefit = totalDmg * targets;
        const efficiency = (benefit / s.cost) / baselineEff * 100;
        
        let color = efficiency > 150 ? "\x1b[31m" : efficiency < 70 ? "\x1b[34m" : "\x1b[0m";
        let status = efficiency > 150 ? "极度溢出" : efficiency < 70 ? "数值亏损" : "合理";

        console.log(`${s.name.padEnd(8)} | ${s.cost.toString().padEnd(3)} | ${totalDmg.toString().padEnd(6)} | ${targets.toFixed(1).toString().padEnd(8)} | ${benefit.toFixed(0).toString().padEnd(7)} | ${color}${efficiency.toFixed(1).toString().padEnd(6)}% | ${status}\x1b[0m`);
    });
    console.log(`-----------------------------------------------------------------------------------------------------------------`);
}

runSkillCheck();
