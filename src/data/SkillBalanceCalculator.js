/**
 * 技能平衡性计算器 (Skill Balance Calculator)
 * 
 * 逻辑：
 * 1. 估算每个技能的【总价值分 (Benefit Score)】
 * 2. 计算【性价比 (Efficiency)】= 价值分 / 蓝量消耗
 * 3. 观察不同等级（初级/高级/绝技）的技能效率是否平滑。
 */

const SKILLS = [
    // --- 纯阳 (紫霞/气场) ---
    { id: 'sixiang', name: '四象轮回', level: '初级', cost: 25, type: 'damage_single', val: 175, desc: '5剑连发' },
    { id: 'sword_rain', name: '五方行尽', level: '初级', cost: 35, type: 'damage_aoe', val: 80, radius: 3, desc: '瞬发AOE' },
    { id: 'liangyi', name: '两仪化形', level: '高级', cost: 40, type: 'damage_single', val: 450, desc: '10剑连发' },
    { id: 'divine_sword_rain', name: '六合独尊', level: '高级', cost: 55, type: 'damage_aoe', val: 240, radius: 4.5, desc: '持续3秒AOE' },
    { id: 'zhenshanhe', name: '镇山河', level: '高级', cost: 75, type: 'utility', val: 800, desc: '3秒无敌' },
    { id: 'wanshi', name: '万世不竭', level: '绝技', cost: 80, type: 'damage_single', val: 1100, desc: '20剑随机' },
    { id: 'shengtaiji', name: '生太极', level: '初级', cost: 40, type: 'buff', val: 300, desc: '移速/伤害/免控' },

    // --- 天策 (奔雷/虎牙) ---
    { id: 'tu', name: '突', level: '初级', cost: 35, type: 'damage_single', val: 55, cc: 0.5, desc: '冲锋' },
    { id: 'zhanbafang', name: '战八方', level: '初级', cost: 30, type: 'damage_aoe', val: 90, radius: 4, desc: '旋转横扫' },
    { id: 'summon_militia', name: '集结令', level: '高级', cost: 30, type: 'summon', val: 400, desc: '招兵3名' },
    { id: 'battle_shout', name: '撼如雷', level: '高级', cost: 45, type: 'buff', val: 500, desc: '全军加攻' },
    { id: 'shourushan', name: '守如山', level: '高级', cost: 60, type: 'utility', val: 600, desc: '80%减伤' },
    { id: 'xiaoruhu', name: '啸如虎', level: '绝技', cost: 50, type: 'utility', val: 1000, desc: '全军不死' },
    { id: 'pochongwei', name: '破重围', level: '高级', cost: 45, type: 'damage_aoe', val: 75, radius: 3, cc: 3, desc: '伤害+眩晕' },

    // --- 藏剑 (轻/重剑) ---
    { id: 'pinghu', name: '平湖断月', level: '初级', cost: 15, type: 'damage_aoe', val: 30, radius: 2.5, desc: '轻剑小扫' },
    { id: 'fengcha', name: '峰插云景', level: '初级', cost: 30, type: 'damage_aoe', val: 35, radius: 4, cc: 1, desc: '击退AOE' },
    { id: 'mengquan', name: '梦泉虎跑', level: '高级', cost: 45, type: 'buff', val: 600, desc: '全方位增强' },
    { id: 'hegui', name: '鹤归孤山', level: '高级', cost: 40, type: 'damage_aoe', val: 80, radius: 2.5, cc: 2, desc: '砸地+眩晕' },
    { id: 'songshe', name: '松舍问霞', level: '高级', cost: 65, type: 'damage_single', val: 145, desc: '重剑斩' },
    { id: 'fenglaiwushan', name: '风来吴山', level: '绝技', cost: 50, type: 'damage_aoe', val: 180, radius: 5, desc: '大风车' },
];

/**
 * 计算技能的综合收益分
 */
function calculateBenefit(s) {
    let score = s.val || 0;
    
    // AOE 修正：半径每增加 1，收益潜力增加 50% (非线性)
    if (s.radius) {
        score *= (1 + s.radius * 0.5);
    }
    
    // CC 修正：每秒控制价值 100 分
    if (s.cc) {
        score += s.cc * 100;
    }
    
    return score;
}

function runSkillCheck() {
    const results = [];
    
    // 基准设定：以剑雨 (sword_rain) 为 100% 性价比基准
    const baselineSkill = SKILLS.find(s => s.id === 'sword_rain');
    const baselineEff = calculateBenefit(baselineSkill) / baselineSkill.cost;

    console.log(`\n=== 招式属性平衡分析报告 (Efficiency vs MP) ===`);
    console.log(`基准技能: ${baselineSkill.name} (Efficiency = 100%)`);
    console.log(`---------------------------------------------------------------------------------------------------------`);
    console.log(`${"名称".padEnd(10)} | ${"等级".padEnd(4)} | ${"MP".padEnd(3)} | ${"收益分".padEnd(7)} | ${"性价比".padEnd(6)} | ${"分析"}`);
    console.log(`---------------------------------------------------------------------------------------------------------`);

    SKILLS.forEach(s => {
        const benefit = calculateBenefit(s);
        const efficiency = (benefit / s.cost) / baselineEff * 100;
        
        let analysis = "";
        if (efficiency > 150) analysis = "\x1b[31m数值严重溢出\x1b[0m";
        else if (efficiency > 120) analysis = "\x1b[33m性价比高\x1b[0m";
        else if (efficiency < 70) analysis = "\x1b[34m收益偏低\x1b[0m";
        else analysis = "合理";

        console.log(`${s.name.padEnd(8)} | ${s.level.padEnd(4)} | ${s.cost.toString().padEnd(3)} | ${benefit.toFixed(0).toString().padEnd(7)} | ${efficiency.toFixed(1).toString().padEnd(6)}% | ${analysis}`);
    });
    console.log(`---------------------------------------------------------------------------------------------------------`);
    console.log(`提示：通常绝技技能的性价比应高于初级技能 (约 120%-150%)，以体现成长感。`);
}

runSkillCheck();

