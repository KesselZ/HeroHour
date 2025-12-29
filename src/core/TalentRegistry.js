/**
 * TalentRegistry.js: 组合式奇穴系统注册表
 */

// 1. 最小天赋单位 (原子效果)
export const TALENT_UNITS = {
    // --- 第一组：商道·金戈 (经济与财富) ---
    'unit_income_base': { 
        name: '生财有道', icon: 'talent_point_1', 
        description: '生财有方，每座城池季度金钱产出提升 20 点。', 
        effects: [{ type: 'modifier', target: 'global', key: 'city_gold_income', value: 20, method: 'add' }] 
    },
    'unit_kill_gold': { 
        name: '战利清缴', icon: 'talent_point_1', 
        description: '以战养战，战斗胜利后额外获得相当于敌人强度 50% 的金钱。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'kill_gold', value: 0.5, method: 'percent' }] 
    },
    'unit_wood_save': { 
        name: '以物易物', icon: 'talent_point_1', 
        description: '建筑升级所需的 wood 消耗降低 25%。', 
        effects: [{ type: 'modifier', target: 'global', key: 'building_wood_cost', value: -0.25, method: 'percent' }] 
    },
    'unit_loot_bonus': { 
        name: '赏金猎人', icon: 'talent_point_1', 
        description: '拾取野外资源点（金矿、宝箱）时，获得金钱增加 100%。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'world_loot', value: 1.0, method: 'percent' }] 
    },

    // --- 第二组：将道·铁骑 (统御与军队) ---
    'unit_elite_cost': { 
        name: '兵贵神速', icon: 'talent_point_3', 
        description: '名将统领，统御占用(Cost)为 3 或以上的精锐，其占用永久 -1 点。', 
        effects: [{ type: 'modifier', target: 'army', key: 'elite_cost_minus', value: 1, method: 'add' }] 
    },
    'unit_recruit_save': { 
        name: '整军经武', icon: 'talent_point_6', 
        description: '全军招募成本降低 15%。', 
        effects: [{ type: 'modifier', target: 'global', key: 'recruit_cost', value: -0.15, method: 'percent' }] 
    },
    'unit_army_def': { 
        name: '坚不可摧', icon: 'talent_point_5', 
        description: '士兵百战不殆，在战斗中受到的伤害降低 10%。', 
        effects: [{ type: 'modifier', target: 'army', key: 'damageResist', value: -0.1, method: 'percent' }] 
    },
    'unit_battle_start_buff': { 
        name: '激励士气', icon: 'talent_point_3', 
        description: '战斗开始时，全军获得 10 秒“振奋”效果（攻速 +20%）。', 
        effects: [{ type: 'modifier', target: 'army', key: 'battle_start_haste', value: 0.2, method: 'percent' }] 
    },

    // --- 第三组：侠道·逍遥 (探索与回复) ---
    'unit_world_speed_boost': { 
        name: '神行千里', icon: 'talent_point_6', 
        description: '身轻如燕，轻功等级永久 +3。', 
        effects: [{ type: 'stat', stat: 'qinggong', value: 3, method: 'add' }] 
    },
    'unit_season_mp_regen': { 
        name: '气吞山河', icon: 'talent_point_4', 
        description: '每当季节更替时，侠客立即恢复 30% 的最大内力值。', 
        effects: [{ type: 'modifier', target: 'hero', key: 'season_mp_regen', value: 0.3, method: 'percent' }] 
    },
    'unit_reveal_radius': { 
        name: '慧眼识珠', icon: 'talent_point_2', 
        description: '明察秋毫，小地图探索迷雾揭开半径增加 50%。', 
        effects: [{ type: 'modifier', target: 'global', key: 'reveal_radius', value: 0.5, method: 'percent' }] 
    },

    // 基础属性类 (保留作为填充或后续使用)
    'unit_power_base': { name: '力道', icon: 'talent_point_1', description: '基础力道提升 8 点', effects: [{ type: 'stat', stat: 'power', value: 8, perLevel: true }] },
    'unit_spells_base': { name: '功法', icon: 'talent_point_2', description: '基础功法提升 10 点', effects: [{ type: 'stat', stat: 'spells', value: 10, perLevel: true }] },
    'unit_hp_base': { name: '气血', icon: 'talent_point_5', description: '基础气血提升 5%', effects: [{ type: 'modifier', target: 'hero', key: 'hp', value: 0.05, perLevel: true, method: 'percent' }] },
    'unit_speed': { name: '轻功', icon: 'talent_point_6', description: '大世界移动速度提升 10%', effects: [{ type: 'stat', stat: 'qinggong', value: 1.2, perLevel: true }] }
};

// 2. 天赋组模板 (每个主奇穴 maxLevel 为 1)
export const TALENT_GROUPS = {
    'group_economy': {
        name: '商道·金戈',
        major: 'unit_income_base',
        minors: ['unit_kill_gold', 'unit_wood_save', 'unit_loot_bonus']
    },
    'group_military': {
        name: '将道·铁骑',
        major: 'unit_elite_cost',
        minors: ['unit_recruit_save', 'unit_army_def', 'unit_battle_start_buff']
    },
    'group_exploration': {
        name: '侠道·逍遥',
        major: 'unit_world_speed_boost',
        minors: ['unit_season_mp_regen', 'unit_reveal_radius', 'unit_season_mp_regen']
    }
};

// 3. 英雄职业树配置
export const HERO_TREE_CONFIG = {
    'lichengen': {
        core: { name: '傲血战意', icon: 'talent_point_3', description: '天策府绝学，开启后可进修天策奇穴。', effects: [{ type: 'stat', stat: 'power', value: 10 }] },
        groups: ['group_military', 'group_economy'] 
    },
    'qijin': {
        core: { name: '紫霞功', icon: 'talent_point_2', description: '纯阳内功总纲，开启后可进修纯阳奇穴。', effects: [{ type: 'stat', stat: 'spells', value: 15 }] },
        groups: ['group_exploration', 'group_economy']
    },
    'yeying': {
        core: { name: '问水诀', icon: 'talent_point_1', description: '藏剑心法总纲，开启后可进修藏剑奇穴。', effects: [{ type: 'stat', stat: 'power', value: 12 }] },
        groups: ['group_economy', 'group_military']
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
    config.groups.forEach((groupId, groupIdx) => {
        const group = TALENT_GROUPS[groupId];
        const groupAngle = (groupIdx / config.groups.length) * Math.PI * 2; // 组在圆周上的角度
        
        // --- 大天赋节点 ---
        const majorId = `node_major_${groupIdx}`;
        const majorDist = 180;
        nodes[majorId] = {
            ...TALENT_UNITS[group.major],
            id: majorId,
            pos: { 
                x: Math.cos(groupAngle) * majorDist, 
                y: Math.sin(groupAngle) * majorDist 
            },
            maxLevel: 1, // 修正：所有主奇穴都只有最高一级
            requires: [coreId],
            type: 'major',
            groupName: group.name
        };
        links.push({ source: coreId, target: majorId });

        // --- 小天赋节点 ---
        group.minors.forEach((minorUnitId, minorIdx) => {
            const minorId = `node_minor_${groupIdx}_${minorIdx}`;
            // 在大天赋节点周围扇形展开
            const subAngleWidth = Math.PI / 3; 
            const minorAngle = groupAngle - subAngleWidth/2 + (minorIdx / (group.minors.length - 1)) * subAngleWidth;
            const minorDist = 320; // 稍微拉开距离

            nodes[minorId] = {
                ...TALENT_UNITS[minorUnitId],
                id: minorId,
                pos: {
                    x: Math.cos(minorAngle) * minorDist,
                    y: Math.sin(minorAngle) * minorDist
                },
                maxLevel: 3,
                requires: [majorId],
                type: 'minor'
            };
            links.push({ source: majorId, target: minorId });
        });
    });

    return { nodes, links };
}
