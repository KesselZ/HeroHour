/**
 * 全游戏唯一的兵种属性与消耗配置中心 (Source of Truth)
 * 供 WorldManager.js (运行逻辑) 与 BalanceCalculator.js (数值分析) 共同引用
 */

export const UNIT_STATS_DATA = {
    // --- 玩家兵种 ---
    'melee': { name: '天策弟子', hp: 85, atk: 6, range: 1.2, rangeType: '近战', speed: 4.0, attackSpeed: 1000, targets: 1.0, description: '天策府的基础步兵，性价比极高，适合作为前排炮灰。' },
    'ranged': { name: '长歌弟子', hp: 70, atk: 14, range: 6.0, rangeType: '远程', speed: 3.4, attackSpeed: 1800, targets: 1.0, description: '以音律伤敌，射程适中，生存能力一般。' },
    'archer': { name: '唐门射手', hp: 65, atk: 22, range: 20.0, rangeType: '极远', speed: 4.0, attackSpeed: 2500, targets: 1.0, description: '穿心弩箭，百步穿杨，脆皮但高输出。' },
    'tiance': { name: '天策骑兵', hp: 320, atk: 9, range: 1.8, rangeType: '冲锋', speed: 6.7, attackSpeed: 800, targets: 3.0, description: '大唐精锐，强大的切入能力与控制力。' },
    'chunyang': { 
        name: '纯阳弟子', 
        hp: 140, 
        atk: 12*3, 
        range: 12.0, 
        rangeType: '远近结合', 
        speed: 4.7, 
        attackSpeed: 1500, 
        description: '御剑而行，能在大后方提供精准的剑气支援。',
        modes: {
            'chunyang_remote': { name: '纯阳(气)', atk: 12, range: 12.0, burstCount: 3, targets: 1.0 },
            'chunyang_melee': { name: '纯阳(剑)', atk: 22, range: 1.5, burstCount: 1, targets: 2.5 }
        }
    },
    'cangjian': { name: '藏剑弟子', hp: 200, atk: 6.0, range: 1.5, rangeType: 'AOE', speed: 4.7, attackSpeed: 2000, burstCount: 3, targets: 4.0, description: '藏剑名剑，重剑无锋，旋风斩具有毁灭性的群体伤害。' },
    'cangyun': { name: '苍云将士', hp: 390, atk: 10, range: 1.2, rangeType: '盾墙', speed: 2.7, attackSpeed: 1200, targets: 1.2, description: '玄甲军魂，战场上最难以逾越的铁壁。' },
    'healer': { name: '万花补给', hp: 120, atk: 30, range: 5.0, rangeType: '治疗', speed: 2.7, attackSpeed: 2500, targets: 1.0, description: '妙手回春，能够有效保障精锐部队的存活。' },
    
    // --- 野外单位 ---
    'wild_boar': { name: '野猪', hp: 100, atk: 8, range: 1.2, rangeType: '冲撞', speed: 4.0, attackSpeed: 1000, targets: 1.0 },
    'wolf': { name: '野狼', hp: 60, atk: 10, range: 1.2, rangeType: '撕咬', speed: 5.4, attackSpeed: 1000, targets: 1.0 },
    'tiger': { name: '猛虎', hp: 180, atk: 15, range: 1.4, rangeType: '扑杀', speed: 6.1, attackSpeed: 1000, mass: 2.0, targets: 1.2 },
    'bear': { name: '黑熊', hp: 250, atk: 18, range: 1.5, rangeType: '重击', speed: 3.4, attackSpeed: 1000, mass: 3.0, targets: 1.5 },
    'bandit': { name: '山贼刀匪', hp: 190, atk: 8, range: 1.2, rangeType: '近战', speed: 4.0, attackSpeed: 1000, targets: 1.0 },
    'bandit_archer': { name: '山贼弩匪', hp: 170, atk: 24, range: 12.0, rangeType: '远程', speed: 4.0, attackSpeed: 2000, targets: 1.0 },
    'rebel_soldier': { name: '狼牙甲兵', hp: 200, atk: 10, range: 1.2, rangeType: '近战', speed: 3.4, attackSpeed: 1000, mass: 1.5, targets: 1.0 },
    'rebel_axeman': { name: '狼牙斧兵', hp: 135, atk: 17, range: 1.2, rangeType: '近战', speed: 4.0, attackSpeed: 1000, targets: 1.0 },
    'snake': { name: '毒蛇', hp: 30, atk: 16, range: 5.0, rangeType: '远程', speed: 4.7, attackSpeed: 1000, targets: 1.0 },
    'bats': { name: '蝙蝠群', hp: 30, atk: 5, range: 1.1, rangeType: '近战', speed: 6.7, attackSpeed: 1000, targets: 1.0 },
    'deer': { name: '林间小鹿', hp: 160, atk: 1, range: 1.1, rangeType: '近战', speed: 6.7, attackSpeed: 1000, targets: 1.0 },
    'pheasant': { name: '山鸡', hp: 60, atk: 2, range: 1.1, rangeType: '近战', speed: 5.4, attackSpeed: 1000, targets: 1.0 },
    'assassin_monk': { name: '苦修刺客', hp: 200, atk: 16, range: 1.2, rangeType: '近战', speed: 6.1, attackSpeed: 800, targets: 1.0 },
    'zombie': { name: '毒尸傀儡', hp: 250, atk: 12, range: 1.2, rangeType: '近战', speed: 2.0, attackSpeed: 1000, targets: 1.0 },
    'heavy_knight': { name: '铁浮屠重骑', hp: 300, atk: 25, range: 1.5, rangeType: '冲锋', speed: 2.7, attackSpeed: 1500, mass: 4.0, targets: 1.5 },
    'shadow_ninja': { name: '隐之影', hp: 120, atk: 18, range: 1.2, rangeType: '近战', speed: 8.1, attackSpeed: 600, targets: 1.0 },

    // --- 天一教势力 (来自 enemy4.png) ---
    'tianyi_guard': { name: '天一教卫', hp: 220, atk: 15, range: 1.2, rangeType: '近战', speed: 3.5, attackSpeed: 1000, targets: 1.0 },
    'tianyi_crossbowman': { name: '天一弩手', hp: 150, atk: 25, range: 15.0, rangeType: '远程', speed: 3.2, attackSpeed: 2000, targets: 1.0 },
    'tianyi_apothecary': { name: '天一药师', hp: 180, atk: 12, range: 8.0, rangeType: '毒瓶', speed: 3.8, attackSpeed: 1500, targets: 1.0 },
    'tianyi_venom_zombie': { name: '天一毒尸', hp: 350, atk: 10, range: 1.2, rangeType: '近战', speed: 2.2, attackSpeed: 1000, targets: 1.0 },
    'tianyi_priest': { name: '天一祭司', hp: 200, atk: 20, range: 10.0, rangeType: '咒术', speed: 3.0, attackSpeed: 2000, targets: 2.0 },
    'tianyi_abomination': { name: '缝合巨怪', hp: 800, atk: 35, range: 2.0, rangeType: '重击', speed: 2.5, attackSpeed: 2500, mass: 5.0, targets: 3.0 },
    'tianyi_elder': { name: '天一长老', hp: 450, atk: 45, range: 12.0, rangeType: '法术', speed: 2.8, attackSpeed: 2200, targets: 1.5 },
    'tianyi_shadow_guard': { name: '天一影卫', hp: 260, atk: 22, range: 1.2, rangeType: '暗杀', speed: 6.5, attackSpeed: 800, targets: 1.0 },

    // --- 神策军势力 (来自 enemy3.png) ---
    'shence_infantry': { name: '神策步兵', hp: 200, atk: 14, range: 1.5, rangeType: '近战', speed: 3.4, attackSpeed: 1000, targets: 1.0 },
    'shence_shieldguard': { name: '神策盾卫', hp: 450, atk: 8, range: 1.2, rangeType: '坦', speed: 2.5, attackSpeed: 1200, mass: 3.0, targets: 1.0 },
    'shence_crossbowman': { name: '神策弩手', hp: 160, atk: 28, range: 15.0, rangeType: '远程', speed: 3.0, attackSpeed: 2200, targets: 1.0 },
    'shence_bannerman': { name: '神策旗手', hp: 220, atk: 10, range: 5.0, rangeType: '增益', speed: 3.6, attackSpeed: 2000, targets: 1.0, description: '神策军的精神支柱，提升周围友军的士气。' },
    'shence_cavalry': { name: '神策精骑', hp: 500, atk: 35, range: 2.0, rangeType: '冲锋', speed: 6.0, attackSpeed: 1500, mass: 4.0, targets: 2.0 },
    'shence_overseer': { name: '神策督军', hp: 600, atk: 50, range: 1.8, rangeType: '精英', speed: 3.2, attackSpeed: 1800, mass: 2.5, targets: 1.5 },
    'shence_assassin': { name: '神策暗刺', hp: 180, atk: 25, range: 1.2, rangeType: '爆发', speed: 7.0, attackSpeed: 600, targets: 1.0 },
    'shence_iron_pagoda': { name: '铁甲神策', hp: 1200, atk: 60, range: 2.2, rangeType: '重装', speed: 1.8, attackSpeed: 2500, mass: 10.0, targets: 3.0 },

    // --- 红衣教势力 (来自 enemy5.png) ---
    'red_cult_priestess': { name: '红衣教祭司', hp: 220, atk: 25, range: 10.0, rangeType: '法术', speed: 3.2, attackSpeed: 2000, targets: 1.0, description: '红衣教的中坚力量，能够释放灼热的惩戒。' },
    'red_cult_high_priestess': { name: '红衣圣女', hp: 550, atk: 40, range: 12.0, rangeType: '神圣', speed: 3.0, attackSpeed: 1800, targets: 2.0, description: '地位崇高的圣女，周围散发着令人疯狂的狂热气息。' },
    'red_cult_swordsman': { name: '红衣剑卫', hp: 240, atk: 18, range: 1.5, rangeType: '近战', speed: 3.8, attackSpeed: 1000, targets: 1.0 },
    'red_cult_archer': { name: '红衣教弩手', hp: 180, atk: 22, range: 15.0, rangeType: '远程', speed: 3.4, attackSpeed: 2000, targets: 1.0 },
    'red_cult_assassin': { name: '红衣暗刺', hp: 200, atk: 30, range: 1.2, rangeType: '暗杀', speed: 6.8, attackSpeed: 700, targets: 1.0 },
    'red_cult_firemage': { name: '红衣法师', hp: 210, atk: 35, range: 8.0, rangeType: '灼烧', speed: 2.8, attackSpeed: 2500, targets: 3.0, description: '红衣教的控火者，能让大片战场陷入火海。' },
    'red_cult_executioner': { name: '红衣惩戒者', hp: 400, atk: 25, range: 1.8, rangeType: '重击', speed: 2.6, attackSpeed: 1500, mass: 2.5, targets: 1.5 },
    'red_cult_acolyte': { name: '红衣教众', hp: 150, atk: 12, range: 1.2, rangeType: '狂热', speed: 4.5, attackSpeed: 900, targets: 1.0 },
    'red_cult_enforcer': { name: '红衣武者', hp: 200, atk: 16, range: 1.2, rangeType: '近战', speed: 4.8, attackSpeed: 800, targets: 1.0 },

    // --- 英雄单位 (物理常数，数值在大世界中动态同步) ---
    'qijin':      { 
        name: '祁进', 
        range: 15.0, 
        rangeType: '五剑连发', 
        attackSpeed: 1000, 
        burstCount: 5, 
        targets: 1.0,
        description: '紫虚子，剑气凌人，擅长远程密集压制。' 
    },
    'lichengen': { 
        name: '李承恩', 
        range: 2.0, 
        rangeType: '横扫千军', 
        attackSpeed: 1000, 
        targets: 2.5,
        knockbackForce: 0.15,
        modes: {
            'pierce': { name: '突刺', atkMult: 2.0, targets: 1.0 }, // 默认形态：2倍单体
            'sweep':  { name: '横扫', atkMult: 1.5, targets: 2.5 }  // 奇穴形态：1.5倍群体
        },
        description: '天策统领，不动如山，一人可挡万军。' 
    },
    'yeying':    { 
        name: '叶英', 
        range: 2.5, 
        rangeType: '心剑旋风', 
        attackSpeed: 1000, 
        description: '藏剑庄主，心剑合一，周身剑气无坚不摧。',
        modes: {
            'yeying_heavy': { name: '叶英(重)', atk: 5,  range: 2.5, burstCount: 3, targets: 5.0, attackSpeed: 1500 },
            'yeying_light': { name: '叶英(轻)', atk: 20, range: 1.8, burstCount: 1, targets: 1.0, attackSpeed: 600 }
        }
    }
};

/**
 * 英雄身份与初始数据 (面板数据)
 */
export const HERO_IDENTITY = {
    'qijin': {
        initialStats: { power: 7, spells: 12, morale: 6, qinggong: 11.8, battleSpeed: 6.0, leadership: 20 },
        combatBase: { atk: 9, hpBase: 200, hpScaling: 5, atkScaling: 0.02 }, 
        traits: [
            { id: 'qijin_sect_hp', unitType: 'chunyang', stat: 'hp', multiplier: 1.2, description: '门派领袖：纯阳弟子气血提高 20%' },
            { id: 'qijin_sect_dmg', unitType: 'chunyang', stat: 'attackDamage', multiplier: 1.2, description: '门派领袖：纯阳弟子伤害提高 20%' }
        ]
    },
    'lichengen': {
        initialStats: { power: 5, spells: 8, morale: 10, qinggong: 11.8, battleSpeed: 9.0, leadership: 25 },
        combatBase: { atk: 22, hpBase: 390, hpScaling: 5, atkScaling: 0.02 }, 
        traits: [
            { id: 'talent_speed', stat: 'qinggong', multiplier: 1.2, description: '骁勇善战：轻功提高 20%' },
            { id: 'tiance_sect_hp', unitType: 'tiance', stat: 'hp', multiplier: 1.1, description: '骁勇善战：天策兵种气血提高 10%' }
        ]
    },
    'yeying': {
        initialStats: { power: 10, spells: 18, morale: 2, qinggong: 11.8, battleSpeed: 7.0, leadership: 15 },
        combatBase: { atk: 5, hpBase: 360, hpScaling: 5, atkScaling: 0.02 }, 
        traits: [
            { id: 'yeying_sect_as', unitType: 'cangjian', stat: 'attackSpeed', multiplier: 1.2, description: '心剑合一：藏剑弟子攻击频率提高 20%' }
        ]
    }
};

export const UNIT_COSTS = {
    'melee': { gold: 50, cost: 2 },
    'ranged': { gold: 55, cost: 2 },    // 80 -> 55 (大幅降价，提升性价比)
    'tiance': { gold: 210, cost: 8 },   // 200 -> 210 (略微涨价)
    'chunyang': { gold: 145, cost: 5 },  // 150 -> 145
    'cangjian': { gold: 230, cost: 6 },  // 180 -> 230 (超模补票)
    'cangyun': { gold: 145, cost: 5 },   // 160 -> 145
    'archer': { gold: 65, cost: 3 },     // 100 -> 65 (大幅降价)
    'healer': { gold: 90, cost: 4 },     // 120 -> 90 (降价)
    // 野外 (价格调整主要为了让分析表好看，同时也影响战力评估)
    'wild_boar': { gold: 60, cost: 2 },
    'wolf': { gold: 55, cost: 2 },
    'tiger': { gold: 125, cost: 5 },
    'bear': { gold: 180, cost: 7 },
    'bandit': { gold: 65, cost: 3 },
    'bandit_archer': { gold: 55, cost: 4 },
    'rebel_soldier': { gold: 65, cost: 4 },
    'rebel_axeman': { gold: 85, cost: 4 },
    'snake': { gold: 20, cost: 2 },
    'bats': { gold: 15, cost: 1 },
    'deer': { gold: 15, cost: 1 },
    'pheasant': { gold: 10, cost: 1 },
    'assassin_monk': { gold: 150, cost: 5 },
    'zombie': { gold: 120, cost: 4 },
    'heavy_knight': { gold: 195, cost: 7 },
    'shadow_ninja': { gold: 135, cost: 5 },

    // --- 天一教势力消耗 ---
    'tianyi_guard': { gold: 150, cost: 5 },
    'tianyi_crossbowman': { gold: 120, cost: 4 },
    'tianyi_apothecary': { gold: 100, cost: 3 },
    'tianyi_venom_zombie': { gold: 155, cost: 5 },
    'tianyi_priest': { gold: 180, cost: 6 },
    'tianyi_abomination': { gold: 450, cost: 15 },
    'tianyi_elder': { gold: 300, cost: 10 },
    'tianyi_shadow_guard': { gold: 210, cost: 7 },

    // --- 神策军消耗 ---
    'shence_infantry': { gold: 120, cost: 4 },
    'shence_shieldguard': { gold: 200, cost: 6 },
    'shence_crossbowman': { gold: 140, cost: 5 },
    'shence_bannerman': { gold: 180, cost: 6 },
    'shence_cavalry': { gold: 400, cost: 12 },
    'shence_overseer': { gold: 500, cost: 15 },
    'shence_assassin': { gold: 220, cost: 8 },
    'shence_iron_pagoda': { gold: 1000, cost: 30 },

    // --- 红衣教消耗 ---
    'red_cult_priestess': { gold: 180, cost: 6 },
    'red_cult_high_priestess': { gold: 450, cost: 15 },
    'red_cult_swordsman': { gold: 130, cost: 4 },
    'red_cult_archer': { gold: 120, cost: 4 },
    'red_cult_assassin': { gold: 240, cost: 8 },
    'red_cult_firemage': { gold: 300, cost: 10 },
    'red_cult_executioner': { gold: 280, cost: 9 },
    'red_cult_acolyte': { gold: 80, cost: 3 },
    'red_cult_enforcer': { gold: 110, cost: 4 }
};

