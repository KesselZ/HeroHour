/**
 * 全游戏唯一的兵种属性与消耗配置中心 (Source of Truth)
 * 供 WorldManager.js (运行逻辑) 与 BalanceCalculator.js (数值分析) 共同引用
 */

export const UNIT_STATS_DATA = {
    // --- 玩家兵种 ---
    'melee': { name: '天策弟子', hp: 85, atk: 6, range: 1.2, rangeType: '近战', speed: 4.0, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'], description: '天策府的基础步兵，性价比极高，适合作为前排炮灰。' },
    'ranged': { name: '长歌弟子', hp: 70, atk: 14, range: 6.0, rangeType: '远程', speed: 3.4, attackSpeed: 1800, targets: 1.0, allowedZones: ['middle'], description: '以音律伤敌，射程适中，生存能力一般。' },
    'archer': { name: '唐门射手', hp: 85, atk: 30, range: 20.0, rangeType: '极远', speed: 4.0, attackSpeed: 2500, targets: 1.0, allowedZones: ['back'], description: '穿心弩箭，百步穿杨，脆皮但高输出。' },
    'tiance': { name: '天策骑兵', hp: 320, atk: 9, range: 1.8, rangeType: '冲锋', speed: 6.7, attackSpeed: 800, targets: 3.0, allowedZones: ['front'], description: '大唐精锐，强大的切入能力与控制力。' },
    'chunyang': {
        name: '纯阳弟子',
        hp: 140,
        atk: 10,
        range: 12.0,
        rangeType: '远近结合',
        speed: 4.7,
        attackSpeed: 1500,
        allowedZones: ['middle'],
        description: '御剑而行，能在大后方提供精准的剑气支援。',
        modes: {
            'chunyang_remote': { name: '纯阳(气)', atk: 8.5, range: 12.0, burstCount: 3, targets: 1.0 },
            'chunyang_melee': { name: '纯阳(剑)', atk: 15.3, range: 1.5, burstCount: 1, targets: 2.5 }
        }
    },
    'cangjian': { name: '藏剑弟子', hp: 200, atk: 5.0, range: 1.5, rangeType: 'AOE', speed: 4.7, attackSpeed: 2000, burstCount: 3, targets: 4.0, allowedZones: ['front'], description: '藏剑名剑，重剑无锋，旋风斩具有毁灭性的群体伤害。' },
    'cangyun': { name: '苍云将士', hp: 390, atk: 10, range: 1.2, rangeType: '盾墙', speed: 2.7, attackSpeed: 1200, targets: 1.2, allowedZones: ['front'], description: '玄甲军魂，战场上最难以逾越的铁壁。' },
    'healer': { name: '万花弟子', hp: 120, atk: 39, range: 5.0, rangeType: '治疗', speed: 3.2, attackSpeed: 2500, targets: 1.0, allowedZones: ['middle'], description: '妙手回春，能够有效保障精锐部队的存活。' },

    // --- 藏剑扩充势力 ---
    'cj_retainer': { name: '藏剑入门弟子', hp: 130, atk: 12, range: 1.2, rangeType: '近战', speed: 4.2, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'], description: '藏剑山庄的入门弟子，虽年轻但剑法扎实。' },
    'cj_wenshui': { name: '问水剑客', hp: 190, atk: 11, range: 1.2, rangeType: '爆发', speed: 4.7, attackSpeed: 1000, targets: 1.0, burstCount: 2, allowedZones: ['front'], description: '手持轻剑，身姿轻盈，能瞬间发动多段刺击。' },
    'cj_shanju': { name: '山居力士', hp: 280, atk: 22, range: 1.8, rangeType: '近战AOE', speed: 3.2, attackSpeed: 1500, targets: 2.0, allowedZones: ['front'], description: '手持重剑，力大无穷，横扫千军。' },
    'cj_xinjian': { name: '灵峰侍剑师', hp: 320, atk: 20, range: 12.0, rangeType: '远程', speed: 3.8, attackSpeed: 1200, targets: 2.0, penetration: 2, allowedZones: ['middle'], description: '藏剑门客，感悟西湖灵峰剑意，能凝聚金色气剑点射敌军。' },
    'cj_golden_guard': { name: '黄金剑卫', hp: 480, atk: 14, range: 1.2, rangeType: '重装', speed: 2.8, attackSpeed: 1200, mass: 3.0, targets: 1.0, allowedZones: ['front'], description: '身披金甲，不动如山，是藏剑最坚固的盾。' },
    'cj_elder': { name: '剑庐大长老', hp: 780, atk: 18, range: 2.5, rangeType: 'AOE旋风', speed: 3.5, attackSpeed: 2000, targets: 5.0, allowedZones: ['front'], description: '剑庐长老，周身剑气纵横，旋风斩毁灭一切。' },

    // --- 纯阳扩充势力 ---
    'cy_twin_blade': { name: '双剑剑宗精锐', hp: 190, atk: 18, range: 1.2, rangeType: '近战', speed: 4.8, attackSpeed: 600, targets: 1.0, allowedZones: ['front'], description: '剑宗精锐，双剑挥舞如风，攻击频率极高。' },
    'cy_sword_array': { name: '玄门阵法师', hp: 420, atk: 26, range: 15.0, rangeType: '穿透', speed: 3.8, attackSpeed: 1800, targets: 2.0, penetration: 2, burstCount: 2, allowedZones: ['back'], description: '纯阳高徒，精通北斗阵法，发射具有强大穿透力的玄门剑气。' },
    'cy_zixia_disciple': { name: '紫霞功真传弟子', hp: 240, atk: 9, range: 12.0, rangeType: '远程爆发', speed: 3.8, attackSpeed: 1200, targets: 3.0, burstCount: 3, allowedZones: ['middle'], description: '气宗真传，能够连续发射三枚气剑压制敌人。' },
    'cy_taixu_disciple': { name: '太虚剑意真传弟子', hp: 320, atk: 10, range: 1.5, rangeType: '近战AOE', speed: 4.0, attackSpeed: 750, targets: 2.5, allowedZones: ['front'], description: '剑宗高手，重剑横扫，造成范围伤害。' },
    'cy_field_master': { name: '纯阳气场大师', hp: 350, atk: 15, range: 10.0, rangeType: '小型吞日月', speed: 3.2, attackSpeed: 3000, targets: 1.0, allowedZones: ['middle'], description: '纯阳高手，会对敌军释放小型吞日月气场，降低敌人的移速与伤害。' },
    
    // --- 野外单位 ---
    'wild_boar': { name: '野猪', hp: 100, atk: 6, range: 1.2, rangeType: '冲撞', speed: 4.0, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'wolf': { name: '野狼', hp: 60, atk: 10, range: 1.2, rangeType: '撕咬', speed: 5.4, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'tiger': { name: '猛虎', hp: 180, atk: 15, range: 1.4, rangeType: '扑杀', speed: 6.1, attackSpeed: 1000, mass: 2.0, targets: 1.2, allowedZones: ['front'] },
    'bear': { name: '黑熊', hp: 250, atk: 18, range: 1.5, rangeType: '重击', speed: 3.4, attackSpeed: 1000, mass: 3.0, targets: 1.5, allowedZones: ['front'] },
    'bandit': { name: '山贼刀匪', hp: 190, atk: 8, range: 1.2, rangeType: '近战', speed: 4.0, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'bandit_archer': { name: '山贼弩匪', hp: 170, atk: 24, range: 12.0, rangeType: '远程', speed: 4.0, attackSpeed: 2000, targets: 1.0, allowedZones: ['middle'] },
    'rebel_soldier': { name: '狼牙甲兵', hp: 200, atk: 10, range: 1.2, rangeType: '近战', speed: 3.4, attackSpeed: 1000, mass: 1.5, targets: 1.0, allowedZones: ['front'] },
    'rebel_axeman': { name: '狼牙斧兵', hp: 135, atk: 17, range: 1.2, rangeType: '近战', speed: 4.0, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'snake': { name: '毒蛇', hp: 30, atk: 16, range: 5.0, rangeType: '远程', speed: 4.7, attackSpeed: 1000, targets: 1.0, allowedZones: ['middle'] },
    'bats': { name: '蝙蝠群', hp: 30, atk: 5, range: 1.1, rangeType: '近战', speed: 6.7, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'deer': { name: '林间小鹿', hp: 160, atk: 1, range: 1.1, rangeType: '近战', speed: 6.7, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'pheasant': { name: '山鸡', hp: 60, atk: 2, range: 1.1, rangeType: '近战', speed: 5.4, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'assassin_monk': { name: '苦修刺客', hp: 200, atk: 16, range: 1.2, rangeType: '近战', speed: 6.1, attackSpeed: 800, targets: 1.0, allowedZones: ['middle'] },
    'zombie': { name: '毒尸傀儡', hp: 250, atk: 10, range: 1.2, rangeType: '近战', speed: 2.5, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'heavy_knight': { name: '铁浮屠重骑', hp: 300, atk: 25, range: 1.5, rangeType: '冲锋', speed: 2.7, attackSpeed: 1500, mass: 4.0, targets: 1.5, allowedZones: ['front'] },
    'shadow_ninja': { name: '隐之影', hp: 120, atk: 18, range: 1.2, rangeType: '近战', speed: 8.1, attackSpeed: 600, targets: 1.0, allowedZones: ['middle'] },

    // --- 天一教势力 (来自 enemy4.png) ---
    'tianyi_guard': { name: '天一教卫', hp: 220, atk: 15, range: 1.2, rangeType: '近战', speed: 3.5, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'tianyi_crossbowman': { name: '天一弩手', hp: 150, atk: 25, range: 15.0, rangeType: '远程', speed: 3.8, attackSpeed: 2000, targets: 1.0, allowedZones: ['back'] },
    'tianyi_apothecary': { name: '天一药师', hp: 180, atk: 12, range: 8.0, rangeType: '毒瓶', speed: 3.8, attackSpeed: 1500, targets: 1.0, allowedZones: ['middle'] },
    'tianyi_venom_zombie': { name: '天一毒尸', hp: 350, atk: 10, range: 1.2, rangeType: '近战', speed: 2.5, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'tianyi_priest': { name: '天一祭司', hp: 200, atk: 20, range: 10.0, rangeType: '咒术', speed: 3.2, attackSpeed: 2000, targets: 2.0, allowedZones: ['middle'] },
    'tianyi_abomination': { name: '缝合巨怪', hp: 800, atk: 35, range: 3.0, rangeType: '重击', speed: 2.5, attackSpeed: 2500, mass: 100.0, targets: 8.0, allowedZones: ['front'] },
    'tianyi_elder': { name: '天一长老', hp: 450, atk: 45, range: 12.0, rangeType: '法术', speed: 3.8, attackSpeed: 2200, targets: 1.5, allowedZones: ['middle'] },
    'tianyi_shadow_guard': { name: '天一影卫', hp: 260, atk: 22, range: 1.2, rangeType: '暗杀', speed: 6.5, attackSpeed: 800, targets: 1.0, allowedZones: ['middle'] },

    // --- 神策军势力 (来自 enemy3.png) ---
    'shence_infantry': { name: '神策步兵', hp: 200, atk: 14, range: 1.5, rangeType: '近战', speed: 3.4, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'shence_shieldguard': { name: '神策盾卫', hp: 550, atk: 12, range: 1.2, rangeType: '坦', speed: 2.5, attackSpeed: 1200, mass: 3.0, targets: 1.0, allowedZones: ['front'] },
    'shence_crossbowman': { name: '神策弩手', hp: 200, atk: 35, range: 15.0, rangeType: '远程', speed: 3.8, attackSpeed: 2200, targets: 1.0, allowedZones: ['back'] },
    'shence_bannerman': { name: '神策旗手', hp: 220, atk: 100, range: 5.0, rangeType: '增益', speed: 3.6, attackSpeed: 2000, targets: 1.0, allowedZones: ['middle'], description: '神策军的精神支柱，提升周围友军的士气。' },
    'shence_cavalry': { name: '神策精骑', hp: 500, atk: 35, range: 2.0, rangeType: '冲锋', speed: 6.0, attackSpeed: 1500, mass: 4.0, targets: 2.0, allowedZones: ['front'] },
    'shence_overseer': { name: '神策督军', hp: 720, atk: 58, range: 1.8, rangeType: '精英', speed: 3.2, attackSpeed: 1800, mass: 2.5, targets: 1.5, allowedZones: ['front'] },
    'shence_assassin': { name: '神策暗刺', hp: 200, atk: 28, range: 1.2, rangeType: '爆发', speed: 7.0, attackSpeed: 600, targets: 1.0, allowedZones: ['middle'] },
    'shence_iron_pagoda': { name: '铁甲神策', hp: 1440, atk: 75, range: 2.5, rangeType: '重装', speed: 2.5, attackSpeed: 2500, mass: 50.0, targets: 6.0, allowedZones: ['front'] },

    // --- 红衣教势力 (来自 enemy5.png) ---
    'red_cult_priestess': { name: '红衣教祭司', hp: 280, atk: 32, range: 10.0, rangeType: '法术', speed: 3.2, attackSpeed: 2000, targets: 1.0, allowedZones: ['middle'], description: '红衣教的中坚力量，能够释放灼热的惩戒。' },
    'red_cult_high_priestess': { name: '红衣圣女', hp: 550, atk: 40, range: 12.0, rangeType: '神圣', speed: 3.8, attackSpeed: 1800, targets: 2.0, allowedZones: ['middle'], description: '地位崇高的圣女，周围散发着令人疯狂的狂热气息。' },
    'red_cult_swordsman': { name: '红衣剑卫', hp: 240, atk: 12, range: 1.5, rangeType: '近战', speed: 3.8, attackSpeed: 1000, targets: 1.0, allowedZones: ['front'] },
    'red_cult_archer': { name: '红衣教弩手', hp: 180, atk: 22, range: 15.0, rangeType: '远程', speed: 3.8, attackSpeed: 2000, targets: 1.0, allowedZones: ['back'] },
    'red_cult_assassin': { name: '红衣暗刺', hp: 200, atk: 30, range: 1.2, rangeType: '暗杀', speed: 6.8, attackSpeed: 700, targets: 1.0, allowedZones: ['middle'] },
    'red_cult_firemage': { name: '红衣法师', hp: 280, atk: 45, range: 8.0, rangeType: '灼烧', speed: 3.2, attackSpeed: 2500, targets: 3.0, allowedZones: ['middle'], description: '红衣教的控火者，能让大片战场陷入火海。' },
    'red_cult_executioner': { name: '红衣惩戒者', hp: 400, atk: 25, range: 1.8, rangeType: '重击', speed: 2.6, attackSpeed: 1500, mass: 2.5, targets: 1.5, allowedZones: ['front'] },
    'red_cult_acolyte': { name: '红衣教众', hp: 150, atk: 9, range: 1.2, rangeType: '狂热', speed: 4.5, attackSpeed: 900, targets: 1.0, allowedZones: ['front'] },
    'red_cult_enforcer': { name: '红衣武者', hp: 200, atk: 11, range: 1.2, rangeType: '近战', speed: 4.8, attackSpeed: 800, targets: 1.0, allowedZones: ['front'] },
    'red_cult_high_priestess': { name: '红衣圣女', hp: 550, atk: 40, range: 12.0, rangeType: '神圣', speed: 3.8, attackSpeed: 1800, targets: 2.0, allowedZones: ['middle'], description: '地位崇高的圣女，周围散发着令人疯狂的狂热气息。' },
    'red_cult_archer': { name: '红衣教弩手', hp: 180, atk: 22, range: 15.0, rangeType: '远程', speed: 3.8, attackSpeed: 2000, targets: 1.0, allowedZones: ['back'] },
    'red_cult_firemage': { name: '红衣法师', hp: 280, atk: 45, range: 8.0, rangeType: '灼烧', speed: 3.2, attackSpeed: 2500, targets: 3.0, allowedZones: ['middle'], description: '红衣教的控火者，能让大片战场陷入火海。' },

    // --- 天策扩充势力 (强度/Cost 4-15) ---
    'tc_crossbow': { name: '天策羽林弩手', hp: 140, atk: 26, range: 18.0, rangeType: '远程', speed: 3.8, attackSpeed: 2800, targets: 2.0, penetration: 2, allowedZones: ['back'], description: '威力巨大的劲弩，装填虽慢但足以致命。' },
    'tc_banner': { name: '天策战旗使', hp: 280, atk: 150, range: 5.0, rangeType: '辅助', speed: 3.5, attackSpeed: 2000, targets: 1.0, allowedZones: ['middle'], description: '天策之魂，每3秒提升周围8米友军15%伤害，持续3秒。' },
    'tc_dual_blade': { name: '天策双刃校尉', hp: 240, atk: 11, range: 1.2, rangeType: '近战', speed: 4.8, attackSpeed: 600, targets: 1.0, allowedZones: ['front'], description: '双刀挥舞如风，天策府中的突击尖兵。' },
    'tc_halberdier': { name: '持戟中郎将', hp: 420, atk: 16, range: 2.8, rangeType: '中程群伤', speed: 3.8, attackSpeed: 1600, targets: 2.0, allowedZones: ['front'], description: '长戟所到之处，敌军人仰马翻。' },
    'tc_shield_vanguard': { name: '天策前锋', hp: 720, atk: 16, range: 1.2, rangeType: '重装坦克', speed: 2.8, attackSpeed: 1200, mass: 3.0, targets: 1.0, allowedZones: ['front'], description: '身披厚甲持重盾，是天策阵地最稳固的前锋。' },
    'tc_mounted_crossbow': { name: '骁骑弩手', hp: 640, atk: 26, range: 14.0, rangeType: '骑射', speed: 6.5, attackSpeed: 2000, targets: 2.5, penetration: 3, allowedZones: ['back'], description: '羽林骑精锐，在马上亦能精准射杀敌军。' },
    'tc_heavy_cavalry': { name: '玄甲陷阵骑', hp: 850, atk: 28, range: 2.2, rangeType: '重装冲锋', speed: 5.5, attackSpeed: 1500, targets: 3.0, allowedZones: ['front'], description: '大唐最强重骑，冲锋之时无坚不摧。' },

    // --- 英雄单位 (物理常数，数值在大世界中动态同步) ---
    'liwangsheng':      { 
        name: '李忘生', 
        range: 15.0, 
        rangeType: '五剑连发', 
        burstCount: 3, 
        attackSpeed: 1000, 
        speed: 6.0,
        description: '纯阳现任掌门。虚怀若谷，正气凛然。'
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
    'liwangsheng': {
        primaryStat: '根骨',
        initialStats: { power: 7, spells: 12, morale: 6, qinggong: 7.0, battleSpeed: 6.0, leadership: 20 },
        combatBase: { atk: 13, hpBase: 200, hpScaling: 5, mpBase: 80, mpScaling: 6, atkScaling: 0.02 }, 
        traits: [
            { id: 'liwangsheng_sect_hp', unitType: 'chunyang', stat: 'hp', multiplier: 1.2, description: '门派领袖：纯阳弟子气血提高 20%' },
            { id: 'liwangsheng_sect_dmg', unitType: 'chunyang', stat: 'attackDamage', multiplier: 1.2, description: '门派领袖：纯阳弟子伤害提高 20%' }
        ]
    },
    'lichengen': {
        primaryStat: '力道',
        initialStats: { power: 5, spells: 8, morale: 10, qinggong: 7.0, battleSpeed: 9.0, leadership: 25 },
        combatBase: { atk: 22, hpBase: 390, hpScaling: 5, mpBase: 60, mpScaling: 4, atkScaling: 0.02 }, 
        traits: [
            { id: 'talent_speed', stat: 'qinggong', multiplier: 1.2, description: '骁勇善战：轻功提高 20%' },
            { id: 'tiance_sect_hp', unitType: 'tiance', stat: 'hp', multiplier: 1.1, description: '骁勇善战：天策兵种气血提高 10%' }
        ]
    },
    'yeying': {
        primaryStat: '身法',
        initialStats: { power: 10, spells: 18, morale: 2, qinggong: 7.0, battleSpeed: 7.0, leadership: 15 },
        combatBase: { atk: 5, hpBase: 360, hpScaling: 5, mpBase: 70, mpScaling: 5, atkScaling: 0.02 }, 
        traits: [
            { id: 'yeying_sect_as', unitType: 'cangjian', stat: 'attackSpeed', multiplier: 1.2, description: '心剑合一：藏剑弟子攻击频率提高 20%' }
        ]
    }
};

export const UNIT_COSTS = {
    'melee': { gold: 50, cost: 2 },
    'ranged': { gold: 55, cost: 2 },    // 80 -> 55 (大幅降价，提升性价比)
    'tiance': { gold: 230, cost: 8 },   // 210 -> 230
    'chunyang': { gold: 130, cost: 5 },  // 145 -> 130
    'cangjian': { gold: 175, cost: 6 },  // 230 -> 175
    'cangyun': { gold: 145, cost: 5 },   // 160 -> 145
    'archer': { gold: 85, cost: 3 },     // 65 -> 85
    'healer': { gold: 100, cost: 4 },    // 90 -> 100

    // --- 藏剑扩充势力消耗 ---
    'cj_retainer': { gold: 90, cost: 3 },
    'cj_wenshui': { gold: 145, cost: 5 },
    'cj_shanju': { gold: 200, cost: 7 },
    'cj_xinjian': { gold: 255, cost: 8 },
    'cj_golden_guard': { gold: 165, cost: 6 },
    'cj_elder': { gold: 420, cost: 15 },

    // --- 纯阳扩充势力消耗 ---
    'cy_twin_blade': { gold: 180, cost: 6 },
    'cy_sword_array': { gold: 380, cost: 11 },
    'cy_zixia_disciple': { gold: 300, cost: 10 },
    'cy_taixu_disciple': { gold: 230, cost: 8 },
    'cy_field_master': { gold: 100, cost: 12 },

    // --- 天策扩充势力消耗 ---
    'tc_crossbow': { gold: 130, cost: 4 },
    'tc_banner': { gold: 335, cost: 8 },
    'tc_dual_blade': { gold: 150, cost: 5 },
    'tc_halberdier': { gold: 205, cost: 7 },
    'tc_shield_vanguard': { gold: 215, cost: 8 },
    'tc_mounted_crossbow': { gold: 360, cost: 12 },
    'tc_heavy_cavalry': { gold: 490, cost: 15 },

    // 野外 (价格调整主要为了让分析表好看，同时也影响战力评估)
    'wild_boar': { gold: 55, cost: 2 },
    'wolf': { gold: 55, cost: 2 },
    'tiger': { gold: 125, cost: 5 },
    'bear': { gold: 180, cost: 7 },
    'bandit': { gold: 85, cost: 3 },
    'bandit_archer': { gold: 110, cost: 4 },
    'rebel_soldier': { gold: 100, cost: 4 },
    'rebel_axeman': { gold: 105, cost: 4 },
    'snake': { gold: 50, cost: 2 },
    'bats': { gold: 25, cost: 1 },
    'deer': { gold: 30, cost: 1 },
    'pheasant': { gold: 25, cost: 1 },
    'assassin_monk': { gold: 150, cost: 5 },
    'zombie': { gold: 120, cost: 4 },
    'heavy_knight': { gold: 195, cost: 7 },
    'shadow_ninja': { gold: 135, cost: 5 },

    // --- 天一教势力消耗 ---
    'tianyi_guard': { gold: 125, cost: 5 },
    'tianyi_crossbowman': { gold: 110, cost: 4 },
    'tianyi_apothecary': { gold: 90, cost: 3 },
    'tianyi_venom_zombie': { gold: 130, cost: 5 },
    'tianyi_priest': { gold: 150, cost: 6 },
    'tianyi_abomination': { gold: 410, cost: 15 },
    'tianyi_elder': { gold: 290, cost: 10 },
    'tianyi_shadow_guard': { gold: 190, cost: 7 },

    // --- 神策军消耗 ---
    'shence_infantry': { gold: 120, cost: 4 },
    'shence_shieldguard': { gold: 165, cost: 6 },
    'shence_crossbowman': { gold: 140, cost: 5 },
    'shence_bannerman': { gold: 240, cost: 6 },
    'shence_cavalry': { gold: 340, cost: 12 },
    'shence_overseer': { gold: 415, cost: 15 },
    'shence_assassin': { gold: 215, cost: 8 },
    'shence_iron_pagoda': { gold: 800, cost: 30 },

    // --- 红衣教消耗 ---
    'red_cult_priestess': { gold: 160, cost: 6 },
    'red_cult_high_priestess': { gold: 385, cost: 15 },
    'red_cult_swordsman': { gold: 120, cost: 4 },
    'red_cult_archer': { gold: 110, cost: 4 },
    'red_cult_assassin': { gold: 205, cost: 8 },
    'red_cult_firemage': { gold: 290, cost: 10 },
    'red_cult_executioner': { gold: 225, cost: 9 },
    'red_cult_acolyte': { gold: 85, cost: 3 },
    'red_cult_enforcer': { gold: 115, cost: 4 }
};

