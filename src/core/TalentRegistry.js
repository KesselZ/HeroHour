/**
 * TalentRegistry.js: 组合式奇穴系统注册表
 */

// 1. 最小天赋单位 (原子效果)
export const TALENT_UNITS = {
    // --- 第一组：商道·金戈 (经济与财富) ---
    'unit_income_base': { 
        name: '生财有道', icon: 'talent_gold_base', 
        description: '生财有方，每座城池季度金钱产出提升 <span class="skill-num-highlight">200</span> 点。', 
        effects: [{ type: 'modifier', target: 'global', key: 'gold_income', value: 200, method: 'add' }] 
    },
    'unit_kill_gold': { 
        name: '战利清缴', icon: 'talent_loot', 
        description: '以战养战，战斗胜利后额外获得相当于敌人强度<span class="skill-num-highlight">三倍</span>的金钱。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'kill_gold', value: 3.0, method: 'percent' }] 
    },
    'unit_wood_save': { 
        name: '以物易物', icon: 'talent_wood', 
        description: '建筑升级所需的木材消耗降低<span class="skill-num-highlight">两成半</span>。', 
        effects: [{ type: 'modifier', target: 'global', key: 'building_wood_cost', value: -0.25, method: 'percent' }] 
    },
    'unit_loot_bonus': { 
        name: '赏金猎人', icon: 'talent_loot', 
        description: '拾取野外资源点（金矿、宝箱）时，获得金钱<span class="skill-num-highlight">翻倍</span>。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'world_loot', value: 1.0, method: 'percent' }] 
    },
    'unit_trade_monopoly': {
        name: '奇货可居', icon: 'talent_monopoly',
        description: '战略物资垄断，所有金矿和伐木场的季度基础产量提升<span class="skill-num-highlight">五成</span>。',
        effects: [
            { type: 'modifier', target: 'gold_mine', key: 'gold_income', value: 0.5, method: 'percent' },
            { type: 'modifier', target: 'sawmill', key: 'wood_income', value: 0.5, method: 'percent' }
        ]
    },

    // --- 第二组：将道·铁骑 (统御与军队) ---
    'unit_elite_cost': { 
        name: '兵贵神速', icon: 'talent_elite_cost', 
        description: '名将统领，统御占用为 <span class="skill-num-highlight">4</span> 或以上的精锐，其占用永久降低 <span class="skill-num-highlight">1</span> 点。', 
        effects: [{ type: 'modifier', target: 'army', key: 'elite_cost_minus', value: 1, method: 'add' }] 
    },
    'unit_recruit_save': { 
        name: '整军经武', icon: 'talent_elite_cost', 
        description: '全军招募成本降低<span class="skill-num-highlight">一成二</span>。', 
        effects: [{ type: 'modifier', target: 'global', key: 'recruit_cost', value: -0.12, method: 'percent' }] 
    },
    'unit_army_def': { 
        name: '坚不可摧', icon: 'talent_army_def', 
        description: '士兵百战不殆，在战斗中受到的伤害降低<span class="skill-num-highlight">一成</span>。', 
        effects: [{ type: 'modifier', target: 'army', key: 'damageReduction', value: 0.1, method: 'add' }] 
    },
    'unit_battle_start_buff': { 
        name: '激励士气', icon: 'talent_haste', 
        description: '战斗开始时，全军获得 <span class="skill-num-highlight">8</span> 秒“振奋”效果（移速提升<span class="skill-num-highlight">两成</span>，攻速提升<span class="skill-num-highlight">一成二</span>）。', 
        effects: [
            { type: 'modifier', target: 'army', key: 'battle_start_haste', value: 0.12, method: 'percent' },
            { type: 'modifier', target: 'army', key: 'battle_start_speed', value: 0.20, method: 'percent' }
        ] 
    },
    'unit_martyrdom': {
        name: '哀兵必胜', icon: 'talent_martyrdom',
        description: '向死而生，士兵生命值归零时，会强行再战斗 <span class="skill-num-highlight">2</span> 秒才真正死亡。',
        effects: [{ type: 'modifier', target: 'army', key: 'martyrdom_enabled', value: 1, method: 'add' }]
    },

    // --- 第三组：侠道·逍遥 (探索与回复) ---
    'unit_world_speed_boost': { 
        name: '风驰电掣', icon: 'talent_world_speed', 
        description: '身轻如燕且明察秋毫，轻功等级永久提升 <span class="skill-num-highlight">4</span> 点，且迷雾揭开半径增加<span class="skill-num-highlight">五成</span>。', 
        effects: [
            { type: 'stat', stat: 'qinggong', value: 4, method: 'add' },
            { type: 'modifier', target: 'global', key: 'reveal_radius', value: 0.5, method: 'percent' }
        ] 
    },
    'unit_season_mp_regen': { 
        name: '气吞山河', icon: 'talent_mp_regen', 
        description: '每当季节更替时，侠客立即恢复<span class="skill-num-highlight">八成</span>的最大内力值。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'season_mp_regen', value: 0.8, method: 'percent' }] 
    },
    'unit_combo_chain': {
        name: '行云流水', icon: 'talent_combo',
        description: '招式如龙，释放技能后 <span class="skill-num-highlight">3</span> 秒内提升<span class="skill-num-highlight">两成</span>功法，且每次施法都会刷新持续时间。',
        effects: [{ type: 'modifier', target: 'hero', key: 'combo_chain_enabled', value: 1, method: 'add' }]
    },

    // --- 天策职业特色奇穴 (仅李承恩可见) ---
    'tiance_cavalry_upgrade': {
        name: '铁骑召来', icon: 'talent_tiance_cavalry',
        description: '集结令的感召力增强，现在会召唤<span class="skill-num-highlight">精锐天策骑兵</span>而非步兵。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_summon_upgrade', value: 1, method: 'add' }]
    },
    'tiance_yulin_spear': {
        name: '横扫千军', icon: 'talent_tiance_sweep',
        description: '领悟天策府高深枪法，将原本厚重的单体穿刺攻击升级为大范围横扫。虽单体伤害下降至<span class="skill-num-highlight">七成五</span>，但获得了极其强悍的群体杀伤能力。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_yulin_enabled', value: 1, method: 'add' }]
    },
    'tiance_benlei_spear': {
        name: '奔雷枪术', icon: 'talent_tiance_tu',
        description: '雷霆之势，【突】的调息时间永久降低至 <span class="skill-num-highlight">1</span> 秒。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tu_cooldown_override', value: 1000, method: 'add' }]
    },

    'tiance_bleeding_edge': {
        name: '龙牙破军', icon: 'talent_tiance_bleeding',
        description: '所有的武学招式（非普攻）在命中敌人时都会造成伤口，使敌人额外受到相当于该招式伤害<span class="skill-num-highlight">一成五</span>的流血伤害，每秒一跳，持续 <span class="skill-num-highlight">3</span> 秒。',
        requires: ['node_core'],
        effects: [{ type: 'modifier', target: 'hero', key: 'tiance_bleeding_enabled', value: 0.15, method: 'add' }]
    },

    // --- 藏剑职业特色奇穴 (仅叶英可见) ---
    'cangjian_fengming': {
        name: '凤鸣', icon: 'talent_cangjian_fengming',
        description: '轻剑之极致。梦泉虎跑持续时间延长 <span class="skill-num-highlight">3</span> 秒；且虎跑期间，平湖断月的调息时间降低<span class="skill-num-highlight">三成</span>。',
        requires: ['node_core'],
        effects: [
            { type: 'modifier', target: 'hero', key: 'cangjian_mengquan_duration_add', value: 3000, method: 'add' },
            { type: 'modifier', target: 'hero', key: 'cangjian_fengming_enabled', value: 1, method: 'add' }
        ]
    },

    // 基础属性类 (每个可升 3 级)
    'unit_power_base': { 
        name: '主属性', // UI 会根据英雄动态改为 力道/身法
        icon: 'talent_power', 
        description: '基础属性提升 <span class="skill-num-highlight">25</span> 点', 
        effects: [{ type: 'stat', stat: 'power', value: 25, perLevel: true, method: 'add' }] 
    },
    'unit_spells_base': { 
        name: '功法', 
        icon: 'talent_spell_power', 
        description: '基础功法提升 <span class="skill-num-highlight">15</span> 点', 
        effects: [{ type: 'stat', stat: 'spells', value: 15, perLevel: true, method: 'add' }] 
    },
    'unit_leadership_base': { 
        name: '统御', 
        icon: 'talent_leadership', 
        description: '基础统御提升 <span class="skill-num-highlight">20</span> 点', 
        effects: [{ type: 'stat', stat: 'leadership', value: 20, perLevel: true, method: 'add' }] 
    },
    'unit_army_hp': { 
        name: '军队', 
        icon: 'talent_army_hp', 
        description: '全军士兵生命提升 <span class="skill-num-highlight">12</span> 点', 
        effects: [{ type: 'modifier', target: 'army', key: 'hp', value: 12, perLevel: true, method: 'add' }] 
    },
    'unit_haste_base': {
        name: '加速',
        icon: 'talent_haste', 
        description: '招式调息提升 <span class="skill-num-highlight">8</span> 点', 
        effects: [{ type: 'stat', stat: 'haste', value: 0.08, perLevel: true, method: 'add' }] 
    },
    'unit_mp_base': {
        name: '内力',
        icon: 'talent_mp', 
        description: '最大内力提升 <span class="skill-num-highlight">80</span> 点', 
        effects: [{ type: 'stat', stat: 'mp', value: 80, perLevel: true, method: 'add' }] 
    },

    // --- 史诗级基础属性 (作为各流派后期奖励，MaxLevel: 1) ---
    'unit_power_epic': {
        name: '神力惊世', // UI 同样会动态处理身法
        icon: 'talent_power_epic',
        description: '突破肉身极限，基础属性爆发式提升 <span class="skill-num-highlight">35</span> 点。',
        effects: [{ type: 'stat', stat: 'power', value: 35, method: 'add' }]
    },
    'unit_spells_epic': {
        name: '功参造化',
        icon: 'talent_spell_epic',
        description: '内功修为登峰造极，基础功法提升 <span class="skill-num-highlight">20</span> 点。',
        effects: [{ type: 'stat', stat: 'spells', value: 20, method: 'add' }]
    },
    'unit_leadership_epic': {
        name: '王霸之气',
        icon: 'talent_leadership',
        description: '名将之威，不怒而自威，基础统御提升 <span class="skill-num-highlight">26</span> 点。',
        effects: [{ type: 'stat', stat: 'leadership', value: 26, method: 'add' }]
    },
    'unit_army_hp_epic': {
        name: '百战铁甲',
        icon: 'talent_army_hp',
        description: '为全军装备百战精铁甲，士兵生命值提升 <span class="skill-num-highlight">16</span> 点。',
        effects: [{ type: 'modifier', target: 'army', key: 'hp', value: 16, method: 'add' }]
    },
    'unit_haste_epic': {
        name: '迅疾如风',
        icon: 'talent_haste_epic',
        description: '天下武功唯快不破，招式调息提升 <span class="skill-num-highlight">11</span> 点。',
        effects: [{ type: 'stat', stat: 'haste', value: 0.11, method: 'add' }]
    },
    'unit_mp_epic': {
        name: '海纳百川',
        icon: 'talent_mp',
        description: '丹田如海，气劲无穷，最大内力提升 <span class="skill-num-highlight">105</span> 点。',
        effects: [{ type: 'stat', stat: 'mp', value: 105, method: 'add' }]
    }
};

// 2. 规范化天赋组 (1个大奇穴 + 2-4个小奇穴)
export const TALENT_GROUPS = {
    // 【财富】经营与资源获取
    'group_economy': {
        name: '商道·金戈',
        major: 'unit_income_base', // 每座城池+200产出
        minors: ['unit_wood_save', 'unit_loot_bonus', 'unit_trade_monopoly', 'unit_leadership_epic'] // 加入统御史诗
    },
    // 【征战】军队规模与阵地战
    'group_military': {
        name: '将道·铁骑',
        major: 'unit_elite_cost', // 精锐减费
        minors: ['unit_recruit_save', 'unit_army_def', 'unit_martyrdom', 'unit_army_hp_epic'] // 加入士兵生命史诗
    },
    // 【游历】大世界移动与发育
    'group_exploration': {
        name: '侠道·神行',
        major: 'unit_world_speed_boost', // 轻功+开图
        minors: ['unit_season_mp_regen', 'unit_kill_gold', 'unit_mp_epic'] // 加入内力史诗
    },
    // 【演武】技能频率与内力基础
    'group_combat': {
        name: '武道·极诣',
        major: 'unit_combo_chain', // 连招增益
        minors: ['unit_battle_start_buff', 'unit_haste_base', 'unit_spells_epic'] // 加入功法史诗
    },

    // --- 职业专属组 ---

    // 【天策·羽林】主打英雄自身的普攻横扫形态与近战爆发
    'group_tiance_commander': {
        name: '羽林枪法',
        major: 'tiance_yulin_spear', // 横扫千军 (核心形态)
        minors: ['unit_power_base', 'unit_power_epic', 'tiance_cavalry_upgrade'] // 围绕主属性与形态补充
    },
    // 【天策·破军】主打高频率的招式衔接与流血伤害
    'group_tiance_martial': {
        name: '傲血战意',
        major: 'tiance_bleeding_edge', // 龙牙破军 (招式流血核心)
        minors: ['tiance_benlei_spear', 'unit_haste_base', 'unit_spells_epic'] // 围绕调息与功法加成
    },
    // 【藏剑·凤鸣】主打轻剑身法与爆发
    'group_cangjian_exclusive': {
        name: '名剑藏锋',
        major: 'cangjian_fengming', // 凤鸣
        minors: ['unit_power_base', 'unit_haste_epic', 'unit_power_epic'] // 加入加速和属性史诗
    }
};

// 3. 英雄职业树配置 (支持 3-4 个分支)
export const HERO_TREE_CONFIG = {
    'lichengen': {
        core: { name: '天策府', icon: 'core_tiance', description: '长枪所指，守我大唐河山。', effects: [{ type: 'stat', stat: 'power', value: 10 }] },
        groups: ['group_tiance_commander', 'group_tiance_martial', 'group_military', 'group_economy'] // 四条分支：带兵、技能、通用军事、经济
    },
    'qijin': {
        core: { name: '纯阳宫', icon: 'core_qijin', description: '太极生两仪，剑气荡乾坤。', effects: [{ type: 'stat', stat: 'spells', value: 15 }] },
        groups: ['group_combat', 'group_exploration', 'group_economy'] // 三条分支：技能、发育、经济
    },
    'yeying': {
        core: { name: '藏剑山庄', icon: 'core_yeying', description: '秀水灵山隐剑锋，君子如风名满城。', effects: [{ type: 'stat', stat: 'power', value: 12 }] },
        groups: ['group_cangjian_exclusive', 'group_military', 'group_economy'] // 三条分支：职业、军事、经济
    }
};

/**
 * 获取当前英雄的扁平化奇穴图定义 (供 UI 渲染)
 */
export function getHeroTalentTree(heroId) {
    const config = HERO_TREE_CONFIG[heroId] || HERO_TREE_CONFIG['qijin'];
    const nodes = {};
    const links = [];

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
        const groupAngle = (groupIdx / groupCount) * Math.PI * 2; // 组在圆周上的角度
        
        // --- 大天赋节点 ---
        // ... (保持不变) ...
        const majorId = `node_major_${groupIdx}`;
        const majorDist = 180;
        nodes[majorId] = {
            ...TALENT_UNITS[group.major],
            id: majorId,
            pos: { 
                x: Math.cos(groupAngle) * majorDist, 
                y: Math.sin(groupAngle) * majorDist 
            },
            maxLevel: 1,
            requires: [coreId],
            type: 'major',
            groupName: group.name
        };
        links.push({ source: coreId, target: majorId });

        // --- 小天赋节点 ---
        // 核心优化：动态计算扇形宽度。
        // 分支越多，每个分支允许展开的角度就越窄，防止重叠。
        // 留出 20% 的安全空隙
        const maxAvailableAngle = (Math.PI * 2 / groupCount) * 0.8;
        const subAngleWidth = Math.min(Math.PI / 2, maxAvailableAngle); 

        group.minors.forEach((minorUnitId, minorIdx) => {
            const minorId = `node_minor_${groupIdx}_${minorIdx}`;
            // 在大天赋节点周围扇形展开
            const minorAngle = (group.minors.length <= 1) 
                ? groupAngle 
                : groupAngle - subAngleWidth/2 + (minorIdx / (group.minors.length - 1)) * subAngleWidth;
            
            const minorDist = 320; 
            // ... (剩余逻辑) ...

            const isBaseStat = ['unit_power_base', 'unit_spells_base', 'unit_leadership_base', 'unit_army_hp', 'unit_haste_base', 'unit_mp_base'].includes(minorUnitId);

            nodes[minorId] = {
                ...TALENT_UNITS[minorUnitId],
                id: minorId,
                pos: {
                    x: Math.cos(minorAngle) * minorDist,
                    y: Math.sin(minorAngle) * minorDist
                },
                maxLevel: isBaseStat ? 3 : 1,
                requires: [majorId],
                type: 'minor'
            };
            links.push({ source: majorId, target: minorId });
        });
    });

    return { nodes, links };
}
