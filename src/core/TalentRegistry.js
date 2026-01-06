/**
 * TalentRegistry.js: 组合式奇穴系统注册表
 * 
 * --- 描述高亮规则 ---
 * 1. 蓝色 (<span class="skill-term-highlight">): 被影响者/对象 (如：季度金钱产出、全军招募成本)
 * 2. 黄色 (<span class="skill-num-highlight">): 影响程度/数值 (如：200点、12%、翻倍)
 */

import { HERO_IDENTITY } from '../data/UnitStatsData.js';

// 1. 最小天赋单位 (原子效果)
export const TALENT_UNITS = {
    // --- 第一组：商道·金戈 (经济与财富) ---
    'unit_income_base': { 
        name: '生财有道', icon: 'talent_gold_base', 
        description: '生财有方，每座城池<span class="skill-term-highlight">季度金钱产出</span>提升 <span class="skill-num-highlight">200</span> 点。', 
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'global', key: 'gold_income', value: 200, method: 'add' }] 
    },
    'unit_kill_gold': { 
        name: '战力清剿', icon: 'talent_loot', 
        description: '以战养战，战斗胜利后额外获得相当于<span class="skill-term-highlight">敌人强度</span><span class="skill-num-highlight">三倍</span>的金钱。', 
        requires: ['unit_income_base'],
        effects: [{ type: 'modifier', target: 'hero', key: 'kill_gold', value: 3.0, method: 'percent' }] 
    },
    'unit_wood_save': { 
        name: '以物易物', icon: 'talent_wood', 
        description: '<span class="skill-term-highlight">建筑升级所需的木材消耗</span>降低<span class="skill-num-highlight">25%</span>。', 
        requires: ['unit_income_base'],
        effects: [{ type: 'modifier', target: 'global', key: 'building_wood_cost', value: -0.25, method: 'percent' }] 
    },
    'unit_loot_bonus': { 
        name: '赏金猎人', icon: 'talent_loot', 
        description: '拾取野外资源点（金矿、宝箱）时，获得<span class="skill-term-highlight">金钱</span><span class="skill-num-highlight">翻倍</span>。', 
        requires: ['unit_income_base'],
        effects: [{ type: 'modifier', target: 'hero', key: 'world_loot', value: 1.0, method: 'percent' }] 
    },
    'unit_trade_monopoly': {
        name: '奇货可居', icon: 'talent_monopoly',
        description: '战略物资垄断，所有<span class="skill-term-highlight">金矿和伐木场的季度产量</span>提升<span class="skill-num-highlight">五成</span>。',
        requires: ['unit_loot_bonus'], 
        effects: [
            { type: 'modifier', target: 'gold_mine', key: 'gold_income', value: 0.5, method: 'percent' },
            { type: 'modifier', target: 'sawmill', key: 'wood_income', value: 0.5, method: 'percent' }
        ]
    },
    'unit_all_stats_boost': {
        name: '脱胎换骨', icon: 'talent_power_epic',
        description: '全面激发潜能，永久提升所有基础属性：<span class="skill-term-highlight">基础属性</span>提升 <span class="skill-num-highlight">8</span> 点，<span class="skill-term-highlight">功法</span>提升 <span class="skill-num-highlight">4</span> 点，<span class="skill-term-highlight">统御</span>提升 <span class="skill-num-highlight">12</span> 点，<span class="skill-term-highlight">最大内力</span>提升 <span class="skill-num-highlight">12</span> 点，<span class="skill-term-highlight">招式调息</span>提升 <span class="skill-num-highlight">2%</span>。',
        requires: ['node_core'],
        effects: [
            { type: 'stat', stat: 'power', value: 8, method: 'add' },
            { type: 'stat', stat: 'spells', value: 4, method: 'add' },
            { type: 'stat', stat: 'leadership', value: 12, method: 'add' },
            { type: 'stat', stat: 'mp', value: 12, method: 'add' },
            { type: 'stat', stat: 'haste', value: 0.02, method: 'add' }
        ]
    },

    // --- 第二组：将道·铁骑 (统御与军队) ---
    'unit_elite_cost': { 
        name: '兵贵神速', icon: 'talent_elite_cost', 
        description: '名将统领，统御占用为 4 或以上的精锐，其<span class="skill-term-highlight">统御占用</span>永久降低 <span class="skill-num-highlight">1</span> 点。', 
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'army', key: 'elite_cost_minus', value: 1, method: 'add' }] 
    },
    'unit_recruit_save': { 
        name: '整军经武', icon: 'talent_elite_cost', 
        description: '<span class="skill-term-highlight">全军招募成本</span>降低<span class="skill-num-highlight">12%</span>。', 
        requires: ['unit_elite_cost'],
        effects: [{ type: 'modifier', target: 'global', key: 'recruit_cost', value: -0.12, method: 'percent' }] 
    },
    'unit_army_def': { 
        name: '坚不可摧', icon: 'talent_army_def', 
        description: '士兵百战不殆，在战斗中<span class="skill-term-highlight">受到的伤害</span>降低<span class="skill-num-highlight">一成</span>。', 
        requires: ['unit_elite_cost'],
        effects: [{ type: 'modifier', target: 'army', key: 'damageReduction', value: 0.1, method: 'add' }] 
    },
    'unit_battle_start_buff': { 
        name: '激励士气', icon: 'talent_haste', 
        description: '战斗开始时，全军获得 <span class="skill-num-highlight">8</span> 秒“振奋”效果（<span class="skill-term-highlight">移速</span>提升<span class="skill-num-highlight">二成</span>，<span class="skill-term-highlight">攻速</span>提升<span class="skill-num-highlight">12%</span>）。', 
        requires: ['unit_army_def'],
        effects: [
            { type: 'modifier', target: 'army', key: 'battle_start_haste', value: 0.12, method: 'percent' },
            { type: 'modifier', target: 'army', key: 'battle_start_speed', value: 0.20, method: 'percent' }
        ] 
    },
    'unit_martyrdom': {
        name: '哀兵必胜', icon: 'talent_martyrdom',
        description: '向死而生，士兵生命值归零时，会<span class="skill-term-highlight">强行再战斗</span> <span class="skill-num-highlight">2</span> 秒才真正死亡。',
        requires: ['unit_elite_cost'],
        effects: [{ type: 'modifier', target: 'hero', key: 'martyrdom_enabled', value: 1, method: 'add' }]
    },

    // --- 第三组：侠道·逍遥 (探索与回复) ---
    'unit_world_speed_boost': { 
        name: '风驰电掣', icon: 'talent_world_speed', 
        description: '身轻如燕且明察秋毫，<span class="skill-term-highlight">轻功等级</span>永久提升 <span class="skill-num-highlight">4</span> 点，且<span class="skill-term-highlight">迷雾揭开半径</span>增加<span class="skill-num-highlight">五成</span>。', 
        requires: ['unit_kill_gold'],
        effects: [
            { type: 'stat', stat: 'qinggong', value: 4, method: 'add' },
            { type: 'modifier', target: 'global', key: 'reveal_radius', value: 0.5, method: 'percent' }
        ] 
    },
    'unit_season_mp_regen': { 
        name: '气吞山河', icon: 'talent_mp_regen', 
        description: '每当季节更替时，侠客立即<span class="skill-term-highlight">恢复内力值</span>，恢复量相当于最大内力值的<span class="skill-num-highlight">八成</span>。', 
        requires: ['unit_recruit_save'],
        effects: [{ type: 'modifier', target: 'hero', key: 'season_mp_regen', value: 0.8, method: 'percent' }] 
    },
    'unit_combo_chain': {
        name: '行云流水', icon: 'talent_combo',
        description: '招式如龙，释放技能后 3 秒内提升<span class="skill-num-highlight">两成</span><span class="skill-term-highlight">功法</span>，且每次施法都会刷新持续时间。',
        effects: [{ type: 'modifier', target: 'hero', key: 'combo_chain_enabled', value: 1, method: 'add' }]
    },

    // --- 天策职业特色奇穴 (仅李承恩可见) ---
    'tiance_cavalry_upgrade': {
        name: '铁骑召来', icon: 'talent_tiance_cavalry',
        description: '集结令的感召力增强，现在会召唤<span class="skill-term-highlight">天策骑兵</span>而非步兵。',
        requires: ['tiance_yulin_spear'],
        requiredSkill: 'summon_militia',
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_summon_upgrade', value: 1, method: 'add' }]
    },
    'tiance_yulin_spear': {
        name: '横扫千军', icon: 'talent_tiance_sweep',
        description: '领悟天策府高深枪法，将原本厚重的单体穿刺攻击升级为大范围横扫。虽<span class="skill-term-highlight">单体伤害</span>下降至<span class="skill-num-highlight">75%</span>，但获得了极其强悍的群体杀伤能力。',
        requires: ['tiance_xu_ru_lin'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_yulin_enabled', value: 1, method: 'add' }]
    },
    'tiance_benlei_spear': {
        name: '奔雷枪术', icon: 'talent_tiance_tu',
        description: '雷霆之势，【突】的<span class="skill-term-highlight">调息时间</span>永久降低至 <span class="skill-num-highlight">1</span> 秒。',
        requires: ['tiance_bleeding_edge'],
        requiredSkill: 'tu',
        effects: [{ type: 'modifier', target: 'hero', key: 'skill_tu_cooldown_override', value: 1000, method: 'add' }]
    },

    'tiance_shout_speed_boost': {
        name: '激雷', icon: 'talent_tiance_3_4',
        description: '【撼如雷】的振奋效果更进一层，每重额外使全军<span class="skill-term-highlight">攻击速度</span>提升 <span class="skill-num-highlight">8%</span>。',
        maxLevel: 3,
        requires: ['tiance_tiger_hp_lock'],
        requiredSkill: 'battle_shout',
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_shout_haste_enabled', value: 0.08, perLevel: true, method: 'add' }]
    },

    'tiance_tiger_hp_lock': {
        name: '虎啸', icon: 'talent_tiance_3_2',
        description: '【啸如虎】的意志感染全军。锁血阈值从 <span class="skill-num-highlight">1</span> 点提升至最大生命值的 <span class="skill-num-highlight">50%</span>。',
        requires: ['node_core'],
        requiredSkill: 'xiaoruhu',
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_tiger_lock_enhanced', value: 1, method: 'add' }]
    },

    'tiance_xu_ru_lin': {
        name: '徐如林', icon: 'talent_tiance_2_1',
        description: '徐如林，其寿如山。每重使普通攻击及武学招式释放时，恢复自身<span class="skill-num-highlight">8%</span>的<span class="skill-term-highlight">已损失生命值</span>。',
        maxLevel: 3,
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_heal_on_cast_factor', value: 0.08, perLevel: true, method: 'add' }]
    },

    'tiance_bleeding_edge': {
        name: '龙牙破军', icon: 'talent_tiance_bleeding',
        description: '所有的武学招式（非普攻）在命中敌人时都会造成伤口，使敌人额外受到共计相当于<span class="skill-term-highlight">该招式伤害</span><span class="skill-num-highlight">36%</span>的<span class="skill-term-highlight">流血伤害</span>，持续 <span class="skill-num-highlight">3</span> 秒。',
        requires: ['tiance_xu_ru_lin'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_bleeding_enabled', value: 0.12, method: 'add' }]
    },

    // --- 藏剑职业特色奇穴 (仅叶英可见) ---
    'cangjian_fengming': {
        name: '凤鸣', icon: 'talent_cangjian_fengming',
        description: '轻剑之极致。梦泉虎跑<span class="skill-term-highlight">持续时间</span>延长 <span class="skill-num-highlight">3</span> 秒；且虎跑期间，平湖断月的<span class="skill-term-highlight">调息时间</span>降低<span class="skill-num-highlight">三成</span>。',
        requires: ['node_core'],
        requiredSkill: 'mengquan',
        effects: [
            { type: 'modifier', target: 'hero', key: 'skill_mengquan_duration_offset', value: 3000, method: 'add' },
            { type: 'modifier', target: 'hero', key: 'cangjian_fengming_enabled', value: 1, method: 'add' }
        ]
    },
    'cangjian_kill_shield': {
        name: '映波锁澜', icon: 'talent_cangjian_shield',
        description: '重剑之威，势不可挡。重剑形态下，英雄亲手击杀敌方单位后立即获得相当于自身最大生命值 <span class="skill-num-highlight">10%</span> 的护盾，持续 <span class="skill-num-highlight">2</span> 秒。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'cangjian_kill_shield_enabled', value: 0.1, method: 'add' }]
    },
    'cangjian_heavy_burst': {
        name: '莺鸣柳浪', icon: 'talent_cangjian_burst',
        description: '重剑之威，更进一层。重剑形态下的普通攻击次数由 <span class="skill-num-highlight">3</span> 段提升至 <span class="skill-num-highlight">4</span> 段。',
        requires: ['cangjian_fengming'],
        effects: [{ type: 'modifier', target: 'hero', key: 'yeying_heavy_burst_bonus', value: 1, method: 'add' }]
    },
    'cangjian_jump_whirlwind': {
        name: '层云', icon: 'talent_cangjian_jump',
        description: '大巧不工。使用鹤归孤山或松舍问霞落地 <span class="skill-num-highlight">0.5</span> 秒后，会自动触发一次额外的旋风斩，造成 <span class="skill-num-highlight">35</span> 点基础范围伤害（受功法加成）。',
        requires: ['cangjian_kill_shield'],
        requiredSkill: ['hegui', 'songshe'],
        effects: [{ type: 'modifier', target: 'hero', key: 'cangjian_jump_whirlwind_enabled', value: 1, method: 'add' }]
    },
    'cangjian_fenglai_heavy': {
        name: '吴山雷鸣', icon: 'talent_cangjian_burst',
        description: '【绝技强化】大巧不工，重剑之极。风来吴山的<span class="skill-term-highlight">持续时间</span>延长 <span class="skill-num-highlight">2</span> 秒。',
        requires: ['cangjian_jump_whirlwind'],
        requiredSkill: 'fenglaiwushan',
        effects: [{ type: 'modifier', target: 'hero', key: 'skill_fenglaiwushan_duration_offset', value: 2000, method: 'add' }]
    },
    'cangjian_tingying': {
        name: '听莺', icon: 'talent_cangjian_tingying',
        description: '【西子情】泉凝月的<span class="skill-term-highlight">护盾基础值</span>提高至最大生命值的 <span class="skill-num-highlight">50%</span>，且<span class="skill-term-highlight">持续时间</span>延长至 <span class="skill-num-highlight">5</span> 秒。',
        requires: ['node_core'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'skill_quanningyue_percent_override', value: 0.5, method: 'add' },
            { type: 'modifier', target: 'hero', key: 'skill_quanningyue_duration_override', value: 5000, method: 'add' }
        ]
    },
    'cangjian_pianyu': {
        name: '片玉', icon: 'talent_cangjian_pianyu',
        description: '【问水决】梦泉虎跑期间的<span class="skill-term-highlight">受到的伤害</span>额外降低，使总减伤效果提升至 <span class="skill-num-highlight">80%</span>。',
        requires: ['cangjian_fengming'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'skill_mengquan_dr_override', value: 0.8, method: 'add' }
        ]
    },

    // --- 纯阳职业特色奇穴 (仅李忘生可见) ---
    'chunyang_array_duration': {
        name: '不竭', icon: 'talent_chunyang_duration',
        description: '道法自然，生生不息。所有【气场】类招式的<span class="skill-term-highlight">持续时间</span>延长 <span class="skill-num-highlight">2</span> 秒。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'category_气场_duration_offset', value: 2000, method: 'add' }]
    },
    'chunyang_array_radius': {
        name: '广域', icon: 'talent_chunyang_radius',
        description: '乾坤之内，皆为道场。所有【气场】类招式的<span class="skill-term-highlight">影响半径</span>提升 <span class="skill-num-highlight">30%</span>。',
        requires: ['chunyang_array_duration'],
        effects: [{ type: 'modifier', target: 'hero', key: 'category_气场_radius_multiplier', value: 1.3, method: 'mult' }]
    },
    'chunyang_huasanqing_permanent': {
        name: '化三清·延', icon: 'talent_chunyang_huasanqing',
        description: '悟彻三清，气劲延绵。【化三清】的<span class="skill-term-highlight">持续时间</span>变为<span class="skill-num-highlight">永久</span>（持续 999 秒）。',
        requires: ['chunyang_array_duration'],
        requiredSkill: 'huasanqing',
        effects: [{ type: 'modifier', target: 'hero', key: 'skill_huasanqing_duration_override', value: 999000, method: 'add' }]
    },
    'unit_chunyang_field_damage': {
        name: '行天道', icon: 'talent_chunyang_field_damage',
        description: '【气场强化】道法自然，天道昭彰。所有【气场】获得范围伤害效果，使圈内的敌人每秒受到 <span class="skill-num-highlight">3</span> 点伤害（受功法加成）。',
        requires: ['chunyang_array_radius'],
        effects: [{ type: 'modifier', target: 'hero', key: 'chunyang_field_damage_enabled', value: 3, method: 'add' }]
    },
    'chunyang_array_mana_regen': {
        name: '坐忘无我', icon: 'talent_mp_regen',
        description: '坐忘玄机，物我两忘。侠客在【气场】范围内时，每秒额外<span class="skill-term-highlight">恢复内力</span> <span class="skill-num-highlight">3</span> 点。',
        requires: ['chunyang_array_duration'],
        effects: [{ type: 'modifier', target: 'hero', key: 'chunyang_array_mp_regen_enabled', value: 3, method: 'add' }]
    },
    'chunyang_sanqing_huashen_permanent': {
        name: '三清化神·恒', icon: 'talent_chunyang_huasanqing',
        description: '玄门化神，剑气长存。【三清化神】的<span class="skill-term-highlight">持续时间</span>变为<span class="skill-num-highlight">永久</span>（持续 999 秒）。',
        requires: ['unit_power_epic'],
        requiredSkill: 'sanqing_huashen',
        effects: [{ type: 'modifier', target: 'hero', key: 'skill_sanqing_huashen_duration_override', value: 999000, method: 'add' }]
    },
    'chunyang_sanqing_huashen_mastery': {
        name: '三清化神·极', icon: 'talent_chunyang_huasanqing',
        description: '三清造化，神技自成。【三清化神】的<span class="skill-term-highlight">内力消耗</span>降低为 <span class="skill-num-highlight">0</span>，且发射<span class="skill-term-highlight">间隔</span>缩短 <span class="skill-num-highlight">1</span> 秒。',
        requires: ['chunyang_sanqing_huashen_permanent'],
        requiredSkill: 'sanqing_huashen',
        effects: [
            { type: 'modifier', target: 'hero', key: 'skill_sanqing_huashen_mana_cost_multiplier', value: 0, method: 'mult' },
            { type: 'modifier', target: 'hero', key: 'skill_sanqing_huashen_interval_offset', value: -1000, method: 'add' }
        ]
    },
    'chunyang_sword_penetration': {
        name: '万剑归宗', icon: 'talent_power_epic',
        description: '心剑合一，气剑纵横。每重提升 <span class="skill-num-highlight">1</span> 次<span class="skill-term-highlight">穿透</span>，且<span class="skill-term-highlight">攻击范围</span>提高 <span class="skill-num-highlight">10%</span>。',
        maxLevel: 3,
        requires: ['unit_power_epic'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'projectile_penetration', value: 1, perLevel: true, method: 'add' },
            { type: 'modifier', target: 'hero', key: 'attackRange', value: 0.1, perLevel: true, method: 'percent' }
        ]
    },
    'chunyang_sword_damage_boost': {
        name: '凭虚御风', icon: 'talent_power',
        description: '剑气如风，虚怀若谷。普通攻击造成的<span class="skill-term-highlight">伤害</span>提升 <span class="skill-num-highlight">20%</span>。',
        requires: ['unit_power_epic'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'more_damage', value: 1.2, method: 'mult' }
        ]
    },
    'chunyang_sword_haste': {
        name: '凭虚·疾', icon: 'talent_haste',
        description: '剑随意动，身随气行。普通攻击的<span class="skill-term-highlight">攻击速度</span>提升 <span class="skill-num-highlight">15%</span>。',
        requires: ['chunyang_sword_damage_boost'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'attackSpeed', value: 0.15, method: 'percent' }
        ]
    },

    // 基础属性类 (每个可升 3 级)
    'unit_power_base': { 
        name: '主属性', // UI 会根据英雄动态改为 力道/身法
        icon: 'talent_power', 
        description: '<span class="skill-term-highlight">基础属性</span>提升 <span class="skill-num-highlight">25</span> 点', 
        requires: ['unit_all_stats_boost'],
        effects: [{ type: 'stat', stat: 'power', value: 25, perLevel: true, method: 'add' }] 
    },
    'unit_spells_base': { 
        name: '功法', 
        icon: 'talent_spell_power', 
        description: '<span class="skill-term-highlight">功法</span>提升 <span class="skill-num-highlight">15</span> 点', 
        requires: ['unit_all_stats_boost'],
        effects: [{ type: 'stat', stat: 'spells', value: 15, perLevel: true, method: 'add' }] 
    },
    'unit_leadership_base': { 
        name: '统御', 
        icon: 'talent_leadership', 
        description: '<span class="skill-term-highlight">统御</span>提升 <span class="skill-num-highlight">20</span> 点', 
        requires: ['unit_all_stats_boost'],
        effects: [{ type: 'stat', stat: 'leadership', value: 20, perLevel: true, method: 'add' }] 
    },
    'unit_army_hp': { 
        name: '军队', 
        icon: 'talent_army_hp', 
        description: '<span class="skill-term-highlight">全军士兵生命</span>提升 <span class="skill-num-highlight">12</span> 点', 
        requires: ['unit_all_stats_boost'],
        effects: [{ type: 'modifier', target: 'army', key: 'hp', value: 12, perLevel: true, method: 'add' }] 
    },
    'unit_haste_base': {
        name: '加速',
        icon: 'talent_haste', 
        description: '<span class="skill-term-highlight">招式调息</span>提升 <span class="skill-num-highlight">8</span> 点', 
        requires: ['unit_all_stats_boost'],
        effects: [{ type: 'stat', stat: 'haste', value: 0.08, perLevel: true, method: 'add' }] 
    },
    'unit_mp_base': {
        name: '内力',
        icon: 'talent_mp',
        description: '<span class="skill-term-highlight">最大内力</span>提升 <span class="skill-num-highlight">80</span> 点',
        requires: ['unit_all_stats_boost'],
        effects: [{ type: 'stat', stat: 'mp', value: 80, perLevel: true, method: 'add' }]
    },
    'unit_morale_base': {
        name: '军队统御',
        icon: 'talent_army_hp',
        description: '<span class="skill-term-highlight">军队</span>提升 <span class="skill-num-highlight">12</span> 点',
        requires: ['unit_elite_cost'],
        effects: [{ type: 'stat', stat: 'morale', value: 12, perLevel: true, method: 'add' }]
    },

    // --- 史诗级基础属性 (作为各流派后期奖励，MaxLevel: 1) ---
    'unit_power_epic': {
        name: '神力惊世', // UI 同样会动态处理身法
        icon: 'talent_power_epic',
        description: '突破肉身极限，<span class="skill-term-highlight">基础属性</span>爆发式提升 <span class="skill-num-highlight">35</span> 点。',
        requires: ['cangjian_fengming'],
        effects: [{ type: 'stat', stat: 'power', value: 35, method: 'add' }]
    }
};

// 2. 规范化天赋组 (1个大奇穴 + 2-4个小奇穴)
export const TALENT_GROUPS = {
    // 【财富】经营与资源获取
    'group_economy': {
        name: '商道·金戈',
        tag: '财富',
        major: 'unit_income_base', // 每座城池+200产出
        minors: ['unit_wood_save', 'unit_loot_bonus', 'unit_trade_monopoly', 'unit_kill_gold', 'unit_world_speed_boost'] // 加入战力清剿和风驰电掣
    },
    // 【征战】军队规模与阵地战
    'group_military': {
        name: '将道·铁骑',
        tag: '征战',
        major: 'unit_elite_cost', // 精锐减费
        minors: ['unit_recruit_save', 'unit_army_def', 'unit_battle_start_buff', 'unit_martyrdom', 'unit_morale_base', 'unit_season_mp_regen'] 
    },
    // 【属性】全属性基础强化
    'group_attributes': {
        name: '根骨·造化',
        tag: '造化',
        major: 'unit_all_stats_boost', // 全属性提升
        minors: [
            'unit_power_base', 'unit_spells_base', 'unit_leadership_base', 
            'unit_mp_base', 'unit_haste_base' 
        ]
    },

    // --- 职业专属组 ---

    // 【天策·羽林】主打战吼与团队增益 (基于原有的 commander 组重构)
    'group_tiance_shout': {
        name: '将道·破军',
        tag: '破军',
        major: 'tiance_tiger_hp_lock', // 虎啸 (核心锁血)
        minors: ['tiance_shout_speed_boost'] // 激雷 (依赖虎啸)
    },
    // 【天策·战神】主打英雄自身的战斗形态与回血 (基于原有的 martial 组重构)
    'group_tiance_warrior': {
        name: '侠道·傲血',
        tag: '战神',
        major: 'tiance_xu_ru_lin', // 徐如林 (核心回血)
        minors: ['tiance_bleeding_edge', 'tiance_benlei_spear', 'tiance_yulin_spear', 'tiance_cavalry_upgrade'] // 两个分支：流血与横扫
    },
    // 【藏剑·问水】主打轻剑身法与普攻强化
    'group_cangjian_light': {
        name: '问水决·灵动',
        tag: '轻剑',
        major: 'cangjian_fengming', // 凤鸣 (核心：梦泉虎跑强化)
        minors: ['cangjian_heavy_burst', 'unit_power_epic', 'cangjian_tingying', 'cangjian_pianyu'] // 莺鸣柳浪 + 史诗属性 + 听莺 + 片玉
    },
    // 【藏剑·山居】主打重剑爆发与生存
    'group_cangjian_heavy': {
        name: '山居剑意·厚重',
        tag: '重剑',
        major: 'cangjian_kill_shield', // 映波锁澜 (核心：重剑杀敌获盾)
        minors: ['cangjian_jump_whirlwind', 'cangjian_fenglai_heavy'] // 层云 + 吴山雷鸣
    },

    // --- 纯阳专属组 ---

    // 【纯阳·气宗】主打气场增益、内力恢复与范围控制
    'group_chunyang_array': {
        name: '太虚剑意·气场',
        tag: '气场',
        major: 'chunyang_array_duration', 
        minors: ['chunyang_array_radius', 'chunyang_huasanqing_permanent', 'chunyang_array_mana_regen', 'unit_chunyang_field_damage']
    },
    // 【纯阳·剑宗】主打普通攻击强化、气剑穿透与三清化神爆发
    'group_chunyang_sword': {
        name: '紫霞功·心剑',
        tag: '剑气',
        major: 'unit_power_epic', // 神力惊世为主节点
        minors: ['chunyang_sword_damage_boost', 'chunyang_sword_haste', 'chunyang_sanqing_huashen_permanent', 'chunyang_sanqing_huashen_mastery', 'chunyang_sword_penetration']
    }
};

// 3. 英雄职业树配置 (通用 5 组 + 职业组)
export const HERO_TREE_CONFIG = {
    'lichengen': {
        core: { name: '天策府', icon: 'core_tiance', description: '长枪所指，守我大唐河山。', effects: [{ type: 'stat', stat: 'power', value: 10 }] },
        groups: [
            'group_tiance_shout', 'group_tiance_warrior', // 重构后的两个流派
            'group_military', 'group_economy', 'group_attributes' // 通用
        ]
    },
    'liwangsheng': {
        core: { 
            name: '纯阳宫', icon: 'core_liwangsheng', 
            description: '太极生两仪，剑气荡乾坤。', 
            effects: [
                { type: 'stat', stat: 'spells', value: 15 }
            ] 
        },
        groups: [
            'group_chunyang_sword', 
            'group_chunyang_array', 
            'group_military', 'group_economy', 'group_attributes'
        ]
    },
    'yeying': {
        core: { 
            name: '藏剑山庄', icon: 'core_yeying', 
            description: '秀水灵山隐剑锋，君子如风名满城。<span class="skill-term-highlight">释放招式</span>后，提升 <span class="skill-num-highlight">20%</span> <span class="skill-term-highlight">功法</span>，持续 3 秒，可刷新。', 
            effects: [
                { type: 'stat', stat: 'power', value: 12 },
                { type: 'modifier', target: 'hero', key: 'combo_chain_enabled', value: 1, method: 'add' }
            ] 
        },
        groups: [
            'group_cangjian_light', 'group_cangjian_heavy', // 独特：问水、山居
            'group_military', 'group_economy', 'group_attributes' // 通用
        ]
    }
};

/**
 * 获取当前英雄的扁平化奇穴图定义 (供 UI 渲染)
 * 采用激进的气泡树算法 (Aggressive Bubble Tree Layout)
 * 极大幅度拉开节点间距，引入强力的半径错落，营造磅礴的星图感
 */
export function getHeroTalentTree(heroId) {
    const heroInfo = HERO_IDENTITY[heroId];
    const powerName = heroInfo ? heroInfo.primaryStat : '力道';
    const config = HERO_TREE_CONFIG[heroId] || HERO_TREE_CONFIG['liwangsheng'];
    
    const nodes = {};
    const links = [];
    const tags = [];
    
    const unitToNodeMap = { 'node_core': 'node_core' };

    const processUnit = (unit) => {
        if (!unit) return null;
        let name = unit.name === '主属性' ? powerName : unit.name;
        let description = unit.description.replace(/基础属性/g, powerName);
        return { ...unit, name, description };
    };

    nodes['node_core'] = { ...config.core, id: 'node_core', unitId: 'node_core', pos: { x: 0, y: 0 }, maxLevel: 1, requires: [], type: 'core' };

    const treeData = config.groups.map((groupId, groupIdx) => {
        const group = TALENT_GROUPS[groupId];
        if (!group) return null;

        const buildSubtree = (parentId) => {
            const childrenIds = group.minors.filter(uid => {
                const u = TALENT_UNITS[uid];
                return u && u.requires && u.requires[0] === parentId;
            });

            if (parentId === group.major) {
                const orphans = group.minors.filter(uid => {
                    const u = TALENT_UNITS[uid];
                    const hasValidParent = u && u.requires && (u.requires[0] === group.major || group.minors.includes(u.requires[0]));
                    return !hasValidParent;
                });
                orphans.forEach(oid => { if (!childrenIds.includes(oid)) childrenIds.push(oid); });
            }

            const node = { unitId: parentId, children: childrenIds.map(cid => buildSubtree(cid)) };
            node.weight = node.children.length === 0 ? 1 : node.children.reduce((sum, c) => sum + c.weight, 0);
            return node;
        };

        return { groupId, tag: group.tag, root: buildSubtree(group.major), groupIdx };
    }).filter(Boolean);

    const layoutBubble = (treeNode, depth, parentPos, angle, type, groupIdx, groupId, parentNodeId = null, childIdx = 0) => {
        // --- 策略：父子极近，同级极度错落 ---
        
        // 1. 基础步进：按照需求压缩
        const baseDist = depth === 0 ? 150 : 120; 
        
        // 2. 半径交错 (staggerDist)：大幅调高以增强同级节点间的错落感
        const staggerDist = (depth > 0 && childIdx % 2 === 1) ? 100 : 0;
        
        // 3. 权重推力：保持低干扰
        const complexityOffset = depth === 0 ? 0 : Math.sqrt(treeNode.weight) * 20;
        
        const dist = baseDist + complexityOffset + staggerDist;

        const nodeId = type === 'major' ? `node_major_${groupIdx}` : `node_minor_${groupIdx}_${treeNode.unitId}`;
        const pos = { x: parentPos.x + Math.cos(angle) * dist, y: parentPos.y + Math.sin(angle) * dist };
        
        unitToNodeMap[treeNode.unitId] = nodeId;
        const unitDef = processUnit(TALENT_UNITS[treeNode.unitId]);
        const isBaseStat = ['unit_power_base', 'unit_spells_base', 'unit_leadership_base', 'unit_army_hp', 'unit_haste_base', 'unit_mp_base', 'unit_morale_base'].includes(treeNode.unitId);

        nodes[nodeId] = {
            ...unitDef, id: nodeId, unitId: treeNode.unitId, pos, 
            maxLevel: unitDef.maxLevel || (isBaseStat ? 5 : 1),
            type, groupId, angle, requires: []
        };

        if (parentNodeId) links.push({ source: parentNodeId, target: nodeId });
        else if (type === 'major') links.push({ source: 'node_core', target: nodeId });

        const children = treeNode.children;
        if (children.length > 0) {
            // --- 核心调整：大幅增加扇区宽度 span ---
            // 深度 > 0 时，将展开弧度从 0.85PI 提升至 1.5PI，实现“横向炸开”
            const span = depth === 0 ? (Math.PI * 2 / treeData.length) * 0.95 : Math.PI * 1.5 / Math.pow(1.1, depth);
            let currentAngle = angle - span / 2;

            children.forEach((child, idx) => {
                const childAngleWidth = (child.weight / treeNode.weight) * span;
                const childCenterAngle = currentAngle + childAngleWidth / 2;
                layoutBubble(child, depth + 1, pos, childCenterAngle, 'minor', groupIdx, groupId, nodeId, idx);
                currentAngle += childAngleWidth;
            });
        }
    };

    const groupCount = treeData.length;
    treeData.forEach((g, idx) => {
        const globalAngle = (idx / groupCount) * Math.PI * 2 - Math.PI / 2;
        layoutBubble(g.root, 0, { x: 0, y: 0 }, globalAngle, 'major', g.groupIdx, g.groupId);
        if (g.tag) {
            const tagDist = 750; 
            tags.push({ 
                text: g.tag, 
                pos: { x: Math.cos(globalAngle) * tagDist, y: Math.sin(globalAngle) * tagDist }, 
                angle: globalAngle,
                groupId: g.groupId, // 补全：用于 UIManager 匹配节点计算亮度
                weight: g.root.weight 
            });
        }
    });

    Object.values(nodes).forEach(node => {
        if (node.type === 'core') return;
        const unitDef = TALENT_UNITS[node.unitId] || {};
        if (unitDef.requires) {
            unitDef.requires.forEach(rid => {
                const targetId = rid === 'node_core' ? 'node_core' : (Object.keys(nodes).find(nid => nodes[nid].unitId === rid && nodes[nid].groupId === node.groupId) || unitToNodeMap[rid]);
                if (targetId && !node.requires.includes(targetId)) {
                    node.requires.push(targetId);
                    if (!links.some(l => l.source === targetId && l.target === node.id)) links.push({ source: targetId, target: node.id });
                }
            });
        }
        if (unitDef.conflicts) node.conflicts = unitDef.conflicts.map(rid => Object.keys(nodes).find(nid => nodes[nid].unitId === rid && nodes[nid].groupId === node.groupId) || unitToNodeMap[rid]).filter(id => !!id);
    });

    return { nodes, links, tags };
}
