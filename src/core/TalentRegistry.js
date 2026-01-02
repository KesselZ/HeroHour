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
        effects: [{ type: 'modifier', target: 'global', key: 'gold_income', value: 200, method: 'add' }] 
    },
    'unit_kill_gold': { 
        name: '战利清缴', icon: 'talent_loot', 
        description: '以战养战，战斗胜利后额外获得相当于<span class="skill-term-highlight">敌人强度</span><span class="skill-num-highlight">三倍</span>的金钱。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'kill_gold', value: 3.0, method: 'percent' }] 
    },
    'unit_wood_save': { 
        name: '以物易物', icon: 'talent_wood', 
        description: '<span class="skill-term-highlight">建筑升级所需的木材消耗</span>降低<span class="skill-num-highlight">25%</span>。', 
        effects: [{ type: 'modifier', target: 'global', key: 'building_wood_cost', value: -0.25, method: 'percent' }] 
    },
    'unit_loot_bonus': { 
        name: '赏金猎人', icon: 'talent_loot', 
        description: '拾取野外资源点（金矿、宝箱）时，获得<span class="skill-term-highlight">金钱</span><span class="skill-num-highlight">翻倍</span>。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'world_loot', value: 1.0, method: 'percent' }] 
    },
    'unit_trade_monopoly': {
        name: '奇货可居', icon: 'talent_monopoly',
        description: '战略物资垄断，所有<span class="skill-term-highlight">金矿和伐木场的季度产量</span>提升<span class="skill-num-highlight">五成</span>。',
        effects: [
            { type: 'modifier', target: 'gold_mine', key: 'gold_income', value: 0.5, method: 'percent' },
            { type: 'modifier', target: 'sawmill', key: 'wood_income', value: 0.5, method: 'percent' }
        ]
    },
    'unit_all_stats_boost': {
        name: '脱胎换骨', icon: 'talent_power_epic',
        description: '全面激发潜能，永久提升所有基础属性：<span class="skill-term-highlight">基础属性</span>提升 <span class="skill-num-highlight">8</span> 点，<span class="skill-term-highlight">功法</span>提升 <span class="skill-num-highlight">4</span> 点，<span class="skill-term-highlight">统御</span>提升 <span class="skill-num-highlight">12</span> 点，<span class="skill-term-highlight">最大内力</span>提升 <span class="skill-num-highlight">12</span> 点，<span class="skill-term-highlight">招式调息</span>提升 <span class="skill-num-highlight">2%</span>。',
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
        effects: [{ type: 'modifier', target: 'army', key: 'elite_cost_minus', value: 1, method: 'add' }] 
    },
    'unit_recruit_save': { 
        name: '整军经武', icon: 'talent_elite_cost', 
        description: '<span class="skill-term-highlight">全军招募成本</span>降低<span class="skill-num-highlight">12%</span>。', 
        effects: [{ type: 'modifier', target: 'global', key: 'recruit_cost', value: -0.12, method: 'percent' }] 
    },
    'unit_army_def': { 
        name: '坚不可摧', icon: 'talent_army_def', 
        description: '士兵百战不殆，在战斗中<span class="skill-term-highlight">受到的伤害</span>降低<span class="skill-num-highlight">一成</span>。', 
        effects: [{ type: 'modifier', target: 'army', key: 'damageReduction', value: 0.1, method: 'add' }] 
    },
    'unit_battle_start_buff': { 
        name: '激励士气', icon: 'talent_haste', 
        description: '战斗开始时，全军获得 <span class="skill-num-highlight">8</span> 秒“振奋”效果（<span class="skill-term-highlight">移速</span>提升<span class="skill-num-highlight">二成</span>，<span class="skill-term-highlight">攻速</span>提升<span class="skill-num-highlight">12%</span>）。', 
        effects: [
            { type: 'modifier', target: 'army', key: 'battle_start_haste', value: 0.12, method: 'percent' },
            { type: 'modifier', target: 'army', key: 'battle_start_speed', value: 0.20, method: 'percent' }
        ] 
    },
    'unit_martyrdom': {
        name: '哀兵必胜', icon: 'talent_martyrdom',
        description: '向死而生，士兵生命值归零时，会<span class="skill-term-highlight">强行再战斗</span> <span class="skill-num-highlight">2</span> 秒才真正死亡。',
        effects: [{ type: 'modifier', target: 'army', key: 'martyrdom_enabled', value: 1, method: 'add' }]
    },

    // --- 第三组：侠道·逍遥 (探索与回复) ---
    'unit_world_speed_boost': { 
        name: '风驰电掣', icon: 'talent_world_speed', 
        description: '身轻如燕且明察秋毫，<span class="skill-term-highlight">轻功等级</span>永久提升 <span class="skill-num-highlight">4</span> 点，且<span class="skill-term-highlight">迷雾揭开半径</span>增加<span class="skill-num-highlight">五成</span>。', 
        effects: [
            { type: 'stat', stat: 'qinggong', value: 4, method: 'add' },
            { type: 'modifier', target: 'global', key: 'reveal_radius', value: 0.5, method: 'percent' }
        ] 
    },
    'unit_season_mp_regen': { 
        name: '气吞山河', icon: 'talent_mp_regen', 
        description: '每当季节更替时，侠客立即<span class="skill-term-highlight">恢复内力值</span>，恢复量相当于最大内力值的<span class="skill-num-highlight">八成</span>。', 
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
        requires: ['node_core'],
        requiredSkill: 'summon_militia',
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_summon_upgrade', value: 1, method: 'add' }]
    },
    'tiance_yulin_spear': {
        name: '横扫千军', icon: 'talent_tiance_sweep',
        description: '领悟天策府高深枪法，将原本厚重的单体穿刺攻击升级为大范围横扫。虽<span class="skill-term-highlight">单体伤害</span>下降至<span class="skill-num-highlight">75%</span>，但获得了极其强悍的群体杀伤能力。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_yulin_enabled', value: 1, method: 'add' }]
    },
    'tiance_benlei_spear': {
        name: '奔雷枪术', icon: 'talent_tiance_tu',
        description: '雷霆之势，【突】的<span class="skill-term-highlight">调息时间</span>永久降低至 <span class="skill-num-highlight">1</span> 秒。',
        requires: ['node_core'],
        requiredSkill: 'tu',
        effects: [{ type: 'modifier', target: 'hero', key: 'skill_tu_cooldown_override', value: 1000, method: 'add' }]
    },

    'tiance_bleeding_edge': {
        name: '龙牙破军', icon: 'talent_tiance_bleeding',
        description: '所有的武学招式（非普攻）在命中敌人时都会造成伤口，使敌人额外受到共计相当于<span class="skill-term-highlight">该招式伤害</span><span class="skill-num-highlight">36%</span>的<span class="skill-term-highlight">流血伤害</span>，持续 <span class="skill-num-highlight">3</span> 秒。',
        requires: ['node_core'],
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
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'yeying_heavy_burst_bonus', value: 1, method: 'add' }]
    },
    'cangjian_jump_whirlwind': {
        name: '层云', icon: 'talent_cangjian_jump',
        description: '大巧不工。使用鹤归孤山或松舍问霞落地 <span class="skill-num-highlight">0.5</span> 秒后，会自动触发一次额外的旋风斩，造成 <span class="skill-num-highlight">35</span> 点基础范围伤害（受功法加成）。',
        requires: ['node_core'],
        requiredSkill: ['hegui', 'songshe'],
        effects: [{ type: 'modifier', target: 'hero', key: 'cangjian_jump_whirlwind_enabled', value: 1, method: 'add' }]
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
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'category_气场_radius_multiplier', value: 1.3, method: 'mult' }]
    },
    'chunyang_huasanqing_permanent': {
        name: '化三清·恒', icon: 'talent_chunyang_huasanqing',
        description: '悟彻三清，气劲恒常。【化三清】的<span class="skill-term-highlight">持续时间</span>变为<span class="skill-num-highlight">永久</span>（持续 999 秒）。',
        requires: ['node_core'],
        requiredSkill: 'huasanqing',
        effects: [{ type: 'modifier', target: 'hero', key: 'skill_huasanqing_duration_override', value: 999000, method: 'add' }]
    },
    'chunyang_array_mana_regen': {
        name: '坐忘无我', icon: 'talent_mp_regen',
        description: '坐忘玄机，物我两忘。侠客在【气场】范围内时，每秒额外<span class="skill-term-highlight">恢复内力</span> <span class="skill-num-highlight">3</span> 点。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'chunyang_array_mp_regen_enabled', value: 3, method: 'add' }]
    },
    'chunyang_sanqing_huashen_permanent': {
        name: '三清化神·恒', icon: 'talent_chunyang_huasanqing',
        description: '玄门化神，剑气长存。【三清化神】的<span class="skill-term-highlight">持续时间</span>变为<span class="skill-num-highlight">永久</span>（持续 999 秒）。',
        requires: ['node_core'],
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
        description: '心剑合一，气剑纵横。普通攻击获得 <span class="skill-num-highlight">3</span> 次<span class="skill-term-highlight">穿透</span>效果，且<span class="skill-term-highlight">攻击范围</span>提高 <span class="skill-num-highlight">20%</span>。',
        requires: ['node_core'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'projectile_penetration', value: 3, method: 'add' },
            { type: 'modifier', target: 'hero', key: 'attackRange', value: 0.2, method: 'percent' }
        ]
    },
    'chunyang_sword_damage_boost': {
        name: '凭虚御风', icon: 'talent_power',
        description: '剑气如风，虚怀若谷。普通攻击造成的<span class="skill-term-highlight">伤害</span>提升 <span class="skill-num-highlight">50%</span>（独立乘区）。',
        requires: ['node_core'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'more_damage', value: 1.5, method: 'mult' }
        ]
    },

    // 基础属性类 (每个可升 3 级)
    'unit_power_base': { 
        name: '主属性', // UI 会根据英雄动态改为 力道/身法
        icon: 'talent_power', 
        description: '<span class="skill-term-highlight">基础属性</span>提升 <span class="skill-num-highlight">25</span> 点', 
        effects: [{ type: 'stat', stat: 'power', value: 25, perLevel: true, method: 'add' }] 
    },
    'unit_spells_base': { 
        name: '功法', 
        icon: 'talent_spell_power', 
        description: '<span class="skill-term-highlight">功法</span>提升 <span class="skill-num-highlight">15</span> 点', 
        effects: [{ type: 'stat', stat: 'spells', value: 15, perLevel: true, method: 'add' }] 
    },
    'unit_leadership_base': { 
        name: '统御', 
        icon: 'talent_leadership', 
        description: '<span class="skill-term-highlight">统御</span>提升 <span class="skill-num-highlight">20</span> 点', 
        effects: [{ type: 'stat', stat: 'leadership', value: 20, perLevel: true, method: 'add' }] 
    },
    'unit_army_hp': { 
        name: '军队', 
        icon: 'talent_army_hp', 
        description: '<span class="skill-term-highlight">全军士兵生命</span>提升 <span class="skill-num-highlight">12</span> 点', 
        effects: [{ type: 'modifier', target: 'army', key: 'hp', value: 12, perLevel: true, method: 'add' }] 
    },
    'unit_haste_base': {
        name: '加速',
        icon: 'talent_haste', 
        description: '<span class="skill-term-highlight">招式调息</span>提升 <span class="skill-num-highlight">8</span> 点', 
        effects: [{ type: 'stat', stat: 'haste', value: 0.08, perLevel: true, method: 'add' }] 
    },
    'unit_mp_base': {
        name: '内力',
        icon: 'talent_mp',
        description: '<span class="skill-term-highlight">最大内力</span>提升 <span class="skill-num-highlight">80</span> 点',
        effects: [{ type: 'stat', stat: 'mp', value: 80, perLevel: true, method: 'add' }]
    },
    'unit_morale_base': {
        name: '军队统御',
        icon: 'talent_army_hp',
        description: '<span class="skill-term-highlight">军队</span>提升 <span class="skill-num-highlight">12</span> 点',
        effects: [{ type: 'stat', stat: 'morale', value: 12, perLevel: true, method: 'add' }]
    },

    // --- 史诗级基础属性 (作为各流派后期奖励，MaxLevel: 1) ---
    'unit_power_epic': {
        name: '神力惊世', // UI 同样会动态处理身法
        icon: 'talent_power_epic',
        description: '突破肉身极限，<span class="skill-term-highlight">基础属性</span>爆发式提升 <span class="skill-num-highlight">35</span> 点。',
        effects: [{ type: 'stat', stat: 'power', value: 35, method: 'add' }]
    },
    'unit_spells_epic': {
        name: '功参造化',
        icon: 'talent_spell_epic',
        description: '内功修为登峰造极，<span class="skill-term-highlight">功法</span>提升 <span class="skill-num-highlight">20</span> 点。',
        effects: [{ type: 'stat', stat: 'spells', value: 20, method: 'add' }]
    },
    'unit_leadership_epic': {
        name: '王霸之气',
        icon: 'talent_leadership',
        description: '名将之威，不怒而自威，<span class="skill-term-highlight">统御</span>提升 <span class="skill-num-highlight">26</span> 点。',
        effects: [{ type: 'stat', stat: 'leadership', value: 26, method: 'add' }]
    },
    'unit_army_hp_epic': {
        name: '百战铁甲',
        icon: 'talent_army_hp',
        description: '为全军装备百战精铁甲，<span class="skill-term-highlight">士兵生命值</span>提升 <span class="skill-num-highlight">16</span> 点。',
        effects: [{ type: 'modifier', target: 'army', key: 'hp', value: 16, method: 'add' }]
    },
    'unit_haste_epic': {
        name: '迅疾如风',
        icon: 'talent_haste_epic',
        description: '天下武功唯快不破，<span class="skill-term-highlight">招式调息</span>提升 <span class="skill-num-highlight">11</span> 点。',
        requires: ['node_core'],
        effects: [{ type: 'stat', stat: 'haste', value: 0.11, method: 'add' }]
    },
    'unit_mp_epic': {
        name: '海纳百川',
        icon: 'talent_mp',
        description: '丹田如海，气劲无穷，<span class="skill-term-highlight">最大内力</span>提升 <span class="skill-num-highlight">105</span> 点。',
        effects: [{ type: 'stat', stat: 'mp', value: 105, method: 'add' }]
    }
};

// 2. 规范化天赋组 (1个大奇穴 + 2-4个小奇穴)
export const TALENT_GROUPS = {
    // 【财富】经营与资源获取
    'group_economy': {
        name: '商道·金戈',
        tag: '财富',
        major: 'unit_income_base', // 每座城池+200产出
        minors: ['unit_wood_save', 'unit_loot_bonus', 'unit_trade_monopoly', 'unit_leadership_epic'] // 加入统御史诗
    },
    // 【征战】军队规模与阵地战
    'group_military': {
        name: '将道·铁骑',
        tag: '征战',
        major: 'unit_elite_cost', // 精锐减费
        minors: ['unit_recruit_save', 'unit_army_def', 'unit_martyrdom', 'unit_morale_base', 'unit_army_hp_epic'] // 加入军队统御和士兵生命史诗
    },
    // 【游历】大世界移动与发育
    'group_exploration': {
        name: '侠道·神行',
        tag: '游历',
        major: 'unit_world_speed_boost', // 轻功+开图
        minors: ['unit_season_mp_regen', 'unit_kill_gold', 'unit_mp_epic', 'unit_battle_start_buff']
    },
    // 【属性】全属性基础强化
    'group_attributes': {
        name: '根骨·造化',
        tag: '造化',
        major: 'unit_all_stats_boost', // 全属性提升
        minors: [
            'unit_power_base', 'unit_spells_base', 'unit_leadership_base', 
            'unit_mp_base', 'unit_haste_base', 'unit_spells_epic', 'unit_haste_epic'
        ]
    },

    // --- 职业专属组 ---

    // 【天策·羽林】主打英雄自身的普攻横扫形态与近战爆发
    'group_tiance_commander': {
        name: '羽林枪法',
        tag: '羽林',
        major: 'tiance_yulin_spear', // 横扫千军 (核心形态)
        minors: ['unit_power_base', 'unit_power_epic', 'tiance_cavalry_upgrade'] // 围绕主属性与形态补充
    },
    // 【天策·破军】主打高频率的招式衔接与流血伤害
    'group_tiance_martial': {
        name: '傲血战意',
        tag: '破军',
        major: 'tiance_bleeding_edge', // 龙牙破军 (招式流血核心)
        minors: ['tiance_benlei_spear', 'unit_haste_base', 'unit_spells_epic'] // 围绕调息与功法加成
    },
    // 【藏剑·问水】主打轻剑身法与普攻强化
    'group_cangjian_light': {
        name: '问水决·灵动',
        tag: '轻剑',
        major: 'cangjian_fengming', // 凤鸣 (核心：梦泉虎跑强化)
        minors: ['cangjian_heavy_burst', 'unit_power_base', 'unit_power_epic'] // 莺鸣柳浪 + 身法
    },
    // 【藏剑·山居】主打重剑爆发与生存
    'group_cangjian_heavy': {
        name: '山居剑意·厚重',
        tag: '重剑',
        major: 'cangjian_kill_shield', // 映波锁澜 (核心：重剑杀敌获盾)
        minors: ['cangjian_jump_whirlwind', 'unit_haste_base', 'unit_spells_base'] // 层云 + 调息 +功法
    },

    // --- 纯阳专属组 ---

    // 【纯阳·气宗】主打气场增益、内力恢复与范围控制
    'group_chunyang_array': {
        name: '太虚剑意·气场',
        tag: '气场',
        major: 'chunyang_array_duration', 
        minors: ['chunyang_array_radius', 'chunyang_huasanqing_permanent', 'chunyang_array_mana_regen', 'unit_spells_epic']
    },
    // 【纯阳·剑宗】主打普通攻击强化、气剑穿透与三清化神爆发
    'group_chunyang_sword': {
        name: '紫霞功·心剑',
        tag: '剑气',
        major: 'chunyang_sword_penetration',
        minors: ['chunyang_sword_damage_boost', 'chunyang_sanqing_huashen_permanent', 'chunyang_sanqing_huashen_mastery', 'unit_power_epic']
    }
};

// 3. 英雄职业树配置 (通用 5 组 + 职业组)
export const HERO_TREE_CONFIG = {
    'lichengen': {
        core: { name: '天策府', icon: 'core_tiance', description: '长枪所指，守我大唐河山。', effects: [{ type: 'stat', stat: 'power', value: 10 }] },
        groups: [
            'group_tiance_commander', 'group_tiance_martial', // 独特：带兵、流血
            'group_military', 'group_economy', 'group_exploration', 'group_attributes' // 通用
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
            'group_military', 'group_economy', 'group_exploration', 'group_attributes'
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
            'group_military', 'group_economy', 'group_exploration', 'group_attributes' // 通用
        ]
    }
};

/**
 * 获取当前英雄的扁平化奇穴图定义 (供 UI 渲染)
 */
export function getHeroTalentTree(heroId) {
    // 动态确定主属性名称 (身法/力道)
    // 核心优化：从 HERO_IDENTITY 动态获取英雄的主属性显示名称
    const heroInfo = HERO_IDENTITY[heroId];
    const powerName = heroInfo ? heroInfo.primaryStat : '力道';

    const config = HERO_TREE_CONFIG[heroId] || HERO_TREE_CONFIG['liwangsheng'];
    const nodes = {};
    const links = [];
    const tags = []; // 存储组描述大字

    // 辅助函数：处理节点的动态文本
    const processUnit = (unit) => {
        if (!unit) return null;
        let name = unit.name;
        let description = unit.description;

        // 1. 替换名称中的占位符
        if (name === '主属性') name = powerName;
        
        // 2. 替换描述中的 "基础属性" 为动态属性名 (力道/身法)
        description = description.replace(/基础属性/g, powerName);

        return { ...unit, name, description };
    };

    // 1. 核心节点 (固定在中心)
    const coreId = 'node_core';
    nodes[coreId] = {
        ...config.core,
        id: coreId,
        pos: { x: 0, y: 0 },
        maxLevel: 1,
        requires: [],
        type: 'core'
    };

    // 2. 遍历天赋组，计算坐标并连线
    const groupCount = config.groups.length;
    config.groups.forEach((groupId, groupIdx) => {
        const group = TALENT_GROUPS[groupId];
        if (!group) {
            console.warn(`Talent group ${groupId} not found in TALENT_GROUPS`);
            return;
        }
        const groupAngle = (groupIdx / groupCount) * Math.PI * 2; // 组在圆周上的角度
        
        // --- 大天赋节点 ---
        const majorId = `node_major_${groupIdx}`;
        const majorDist = 240; // 进一步增加，让整体布局更松弛
        const processedMajor = processUnit(TALENT_UNITS[group.major]);

        nodes[majorId] = {
            ...processedMajor,
            id: majorId,
            pos: { 
                x: Math.cos(groupAngle) * majorDist, 
                y: Math.sin(groupAngle) * majorDist 
            },
            maxLevel: 1,
            requires: [coreId],
            type: 'major',
            groupId: groupId, // 新增：标记所属组
            groupName: group.name
        };
        links.push({ source: coreId, target: majorId });

        // --- 小天赋节点 ---
        // 优化：根据子节点数量动态调整扇区，并增加基础宽度
        const nodeCount = group.minors.length;
        // 允许扇区占用的最大比例，根据组数动态调整
        const safetyFactor = 0.85; 
        const maxSectorAngle = (Math.PI * 2 / groupCount) * safetyFactor;
        
        // 基础展开角度：每个节点预留约 15 度的呼吸空间
        const preferredAngleWidth = (nodeCount - 1) * (Math.PI / 12); 
        const subAngleWidth = Math.min(preferredAngleWidth, maxSectorAngle);

        group.minors.forEach((minorUnitId, minorIdx) => {
            const minorId = `node_minor_${groupIdx}_${minorIdx}`;
            
            // --- 升级：全局相位交错布局 (Global Interleaved Layout) ---
            
            // 1. 计算角度
            let minorAngle = groupAngle;
            if (nodeCount > 1) {
                const startAngle = groupAngle - subAngleWidth / 2;
                const angleStep = subAngleWidth / (nodeCount - 1);
                minorAngle = startAngle + minorIdx * angleStep;
            }
            
            // 2. 核心算法：半径相位对冲 (Radius Phase Shifting)
            // 相邻组(groupIdx)使用不同的基准半径偏移，确保边缘节点不在同一圆周
            const groupOffset = (groupIdx % 2) * 50; 
            const baseMinorDist = 420 + groupOffset;
            
            // 3. 错层分布
            const layers = 3; 
            const staggerStep = 95; 
            const layerIdx = minorIdx % layers;
            
            // 4. 边缘推力：越靠近组边缘的节点，半径额外增加，形成自然的张力感
            const edgePush = (nodeCount > 1) 
                ? Math.abs(minorIdx - (nodeCount-1)/2) * 25 
                : 0;

            const minorDist = baseMinorDist + (layerIdx * staggerStep) + edgePush; 

            const isBaseStat = ['unit_power_base', 'unit_spells_base', 'unit_leadership_base', 'unit_army_hp', 'unit_haste_base', 'unit_mp_base', 'unit_morale_base'].includes(minorUnitId);
            const processedMinor = processUnit(TALENT_UNITS[minorUnitId]);

            nodes[minorId] = {
                ...processedMinor,
                id: minorId,
                pos: {
                    x: Math.cos(minorAngle) * minorDist,
                    y: Math.sin(minorAngle) * minorDist
                },
                maxLevel: isBaseStat ? 3 : 1,
                requires: [majorId],
                type: 'minor',
                groupId: groupId // 新增：标记所属组
            };
            links.push({ source: majorId, target: minorId });
        });

        // 3. 添加组描述大字 (放置在组的最远处)
        if (group.tag) {
            const tagDist = 820; // 放置在比小奇穴更远的地方
            tags.push({
                text: group.tag,
                groupId: groupId, // 携带组ID以便计算亮度
                pos: {
                    x: Math.cos(groupAngle) * tagDist,
                    y: Math.sin(groupAngle) * tagDist
                },
                angle: groupAngle
            });
        }
    });

    return { nodes, links, tags };
}
