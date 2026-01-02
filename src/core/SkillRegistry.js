import { Skill } from './Skill.js';

/**
 * 技能注册表：存放所有技能的具体配置和动作
 */
export const SkillRegistry = {
    /**
     * 获取门派技能统计 (用于建筑等级与技能数量挂钩)
     * @param {string} sectId 门派ID (如 'chunyang', 'tiance')
     * @returns {Object} { '初级': n, '高级': n, '绝技': n, total: n }
     */
    getSectSkillStats(sectId) {
        const skillIds = SectSkills[sectId] || [];
        const stats = { '初级': 0, '高级': 0, '绝技': 0, total: skillIds.length };
        
        skillIds.forEach(id => {
            const skill = this[id];
            if (skill && stats[skill.level] !== undefined) {
                stats[skill.level]++;
            }
        });
        return stats;
    },

    /**
     * 重置所有技能冷却
     */
    resetAllCooldowns() {
        Object.values(this).forEach(skill => {
            if (skill instanceof Skill) {
                skill.lastUsed = 0;
            }
        });
    },

    'sword_rain': new Skill('sword_rain', {
        name: '五方行尽',
        level: '初级',
        category: '紫霞功',
        icon: 'skill_wanjiangui_zong',
        cost: 35,
        cooldown: 6000,
        audio: 'skill_sword_rain',
        targeting: { type: 'location', shape: 'circle', range: 8, radius: 3 },
        description: '在指定区域降下剑雨，造成 {damage} 点范围伤害及击退效果',
        actions: [
            { type: 'vfx', name: 'rain', params: { color: 0x00ffff, duration: 600, density: 1.0, radius: 3 } },
            { type: 'damage_aoe', value: 40, knockback: 0.1, targeting: { shape: 'circle', radius: 3 } }
        ]
    }),
    'divine_sword_rain': new Skill('divine_sword_rain', {
        name: '六合独尊',
        level: '高级',
        category: '紫霞功',
        icon: 'skill_liuhe',
        cost: 55,
        cooldown: 10000,
        audio: 'skill_sword_rain',
        targeting: { type: 'location', shape: 'circle', range: 10, radius: 4.5 },
        description: '【进阶招式】在极广区域降下凛冽剑雨，持续 {duration} 秒，每 0.5 秒造成 {tickDamage} 点伤害',
        actions: [
            { type: 'vfx', name: 'rain', params: { color: 0x00ffff, duration: 3000, density: 2.0, speed: 0.5, radius: 4.5, applySkillPowerToDuration: true } },
            { type: 'tick_effect', duration: 3000, interval: 500, onTickDamage: 8, applySkillPowerToDuration: true, targeting: { shape: 'circle', radius: 4.5 } }
        ]
    }),
    'battle_shout': new Skill('battle_shout', {
        name: '撼如雷',
        level: '高级',
        category: '虎牙令',
        icon: 'skill_hanrulei',
        cost: 45,
        cooldown: 10000,
        audio: 'skill_shout_extra',
        targeting: { type: 'instant', shape: 'circle', radius: 150 },
        description: '激发起全军斗志，所有友军普通攻击伤害提升 {bonus}%，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'pulse', params: { color: 0xffaa00, duration: 800, radius: 150 } },
            { type: 'buff_aoe', side: 'player', params: { stat: 'attack_damage_bonus', multiplier: 1.2, duration: 3000, color: 0xffaa00, radius: 150 } }
        ]
    }),
    'summon_militia': new Skill('summon_militia', {
        name: '集结令',
        level: '高级',
        category: '奔雷枪法',
        icon: 'skill_jijieling',
        cost: 30,
        cooldown: 15000,
        audio: 'skill_field',
        targeting: { type: 'instant', shape: 'circle', radius: 5 },
        description: '在英雄身边紧急征召 {count} 名天策步兵参战',
        actions: [
            { type: 'vfx', name: 'pulse', params: { color: 0xffffff, duration: 500, radius: 3 } },
            { type: 'summon', unitType: 'melee', count: 3, applySkillPowerToCount: true }
        ]
    }),
    'zhenshanhe': new Skill('zhenshanhe', {
        name: '镇山河',
        level: '高级',
        category: '气场',
        icon: 'skill_zhenshanhe',
        cost: 75,
        cooldown: 25000,
        audio: 'skill_field',
        targeting: { type: 'location', shape: 'circle', range: 18, radius: 4.5 },
        description: '【气场】产生无敌气场，保护范围内友军免受伤害，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'dome', params: { color: 0x88ccff, duration: 2000, radius: 4.5, applySkillPowerToDuration: true } },
            {
                type: 'tick_effect',
                duration: 2000,
                interval: 500,
                side: 'player',
                applySkillPowerToDuration: true,
                onTickBuff: {
                    stat: 'invincible',
                    duration: 800,
                    color: 0x88ccff,
                    tag: 'zhenshanhe'
                }
            }
        ]
    }),
    'fenglaiwushan': new Skill('fenglaiwushan', {
        name: '风来吴山',
        level: '绝技',
        category: '山居剑意',
        icon: 'skill_fenglaiwushan',
        cost: 50,
        cooldown: 12000,
        audio: 'skill_zhanbafang',
        targeting: { type: 'instant' },
        description: '【大风车】自身快速旋转，对周围敌人造成 10 段每段 {tickDamage} 点范围伤害',
        actions: [
            { type: 'vfx', name: 'mega_whirlwind', params: { color: 0xffcc00, duration: 3000, radius: 5 } },
            { type: 'tick_effect', duration: 3000, interval: 300, onTickDamage: 7.2, knockback: 0.12, targeting: { radius: 5 } }
        ]
    }),
    'renchicheng': new Skill('renchicheng', {
        name: '任驰骋',
        level: '高级',
        category: '奔雷枪法',
        icon: 'skill_renchicheng',
        cost: 40,
        cooldown: 15000,
        audio: 'skill_horse',
        targeting: { type: 'instant' },
        description: '天策骑术：大幅提升移速与 {bonus}% 攻击频率，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'pulse', params: { color: 0xff4400, duration: 800, radius: 5 } },
            { type: 'buff_aoe', side: 'player', params: { 
                stat: ['moveSpeed', 'attackSpeed'], 
                multiplier: [1.3, 1.5], 
                duration: 5000, 
                color: 0xff4400,
                vfxName: 'rising_particles'
            } }
        ]
    }),
    'shourushan': new Skill('shourushan', {
        name: '守如山',
        level: '高级',
        category: '虎牙令',
        icon: 'skill_shourushan',
        cost: 60,
        cooldown: 15000,
        audio: 'skill_armor',
        targeting: { type: 'instant' },
        description: '钢铁意志：获得 80% 减伤效果，持续 {duration} 秒',
        actions: [
            // 特效层：短持续时间
            { type: 'vfx', name: 'pulse', params: { color: 0x666666, duration: 800, radius: 1.5 } },
            // 逻辑层：减伤设为 0.8 (即受损 20%)
            { 
                type: 'buff_aoe', 
                side: 'player', 
                applySkillPowerToMultiplier: false, // 核心修复：减伤百分比固定为 80%
                applySkillPowerToDuration: true,    // 核心修复：只有持续时间随功法提升
                params: { 
                    stat: 'damageReduction', 
                    offset: 0.8, // 80% 减伤
                    duration: 4000, 
                    color: 0xaaaaaa,
                    vfxName: 'shield'
                } 
            }
        ]
    }),
    'zhanbafang': new Skill('zhanbafang', {
        name: '战八方',
        level: '初级',
        category: '奔雷枪法',
        icon: 'skill_zhanbafang',
        cost: 30,
        cooldown: 5000,
        audio: 'skill_zhanbafang',
        targeting: { type: 'instant', shape: 'circle', radius: 2.8 },
        description: '长枪横扫：快速旋转两圈，造成每段 {tickDamage} 点范围伤害',
        actions: [
            { type: 'vfx', name: 'cangjian_whirlwind', params: { color: 0xff0000, duration: 1000, radius: 2.8 } },
            { type: 'tick_effect', duration: 1000, interval: 500, onTickDamage: 22.5, knockback: 0.1 }
        ]
    }),
    'xiaoruhu': new Skill('xiaoruhu', {
        name: '啸如虎',
        level: '绝技',
        category: '虎牙令',
        icon: 'skill_xiaoruhu',
        cost: 50,
        cooldown: 25000,
        audio: 'skill_xiaoruhu',
        targeting: { type: 'instant', shape: 'circle', radius: 150 },
        description: '全军困兽犹斗：友军血量最低降至 1 点，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'pulse', params: { color: 0xff0000, duration: 1000, radius: 150 } },
            { type: 'buff_aoe', side: 'player', params: {
                stat: 'tigerHeart',
                duration: 2500,
                applySkillPowerToDuration: true,
                color: 0xff3333,
                vfxName: 'rising_particles'
            } }
        ]
    }),
    'pochongwei': new Skill('pochongwei', {
        name: '破重围',
        level: '高级',
        category: '奔雷枪法',
        icon: 'skill_pochongwei',
        cost: 45,
        cooldown: 12000,
        audio: 'skill_jiantan',
        targeting: { type: 'instant', shape: 'circle', radius: 3 },
        description: '重踏地面：对周围敌人造成 {damage} 点伤害并眩晕 {stunDuration} 秒',
        actions: [
            { type: 'vfx', name: 'stomp', params: { color: 0x887766, duration: 800, radius: 3 } },
            { type: 'damage_aoe', value: 37.5, knockback: 0.2, targeting: { shape: 'circle', radius: 3 } },
            { type: 'status_aoe', status: 'stun', duration: 3000, targeting: { shape: 'circle', radius: 3 } }
        ]
    }),
    'tu': new Skill('tu', {
        name: '突',
        level: '初级',
        category: '奔雷枪法',
        icon: 'skill_tu',
        cost: 35,
        cooldown: 12000,
        audio: 'skill_pierce',
        targeting: { type: 'location', range: 24, radius: 1 },
        description: '长枪冲锋：突进并击退路径敌人，造成 {damage} 点伤害',
        actions: [
            { type: 'movement', moveType: 'dash', duration: 400, damage: 55, knockback: 0.4 },
            { type: 'vfx', name: 'pulse', params: { color: 0xffffff, duration: 400, radius: 2 } }
        ]
    }),
    'shengtaiji': new Skill('shengtaiji', {
        name: '生太极',
        level: '初级',
        category: '气场',
        icon: 'skill_shengtaiji',
        cost: 40,
        cooldown: 12000,
        audio: 'skill_field',
        targeting: { type: 'location', shape: 'circle', range: 18, radius: 6.0 },
        description: '【气场】产生生太极气场，使范围内友军移速提升 {bonus}%，普通攻击伤害提升 {bonus2}%，并免疫控制，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'field', params: { color: 0x00ffcc, duration: 5000, radius: 6.0 } },
            { 
                type: 'tick_effect', 
                duration: 5000, 
                interval: 500, 
                side: 'player',
                onTickBuff: { 
                    stat: ['moveSpeed', 'attack_damage_bonus', 'controlImmune'], 
                    multiplier: [1.1, 1.2, 1.0], 
                    duration: 800, 
                    color: 0x00ffcc,
                    tag: 'shengtaiji'
                }
            }
        ]
    }),
    'tunriyue': new Skill('tunriyue', {
        name: '吞日月',
        level: '高级',
        category: '气场',
        icon: 'skill_tunriyue',
        cost: 45,
        cooldown: 15000,
        audio: 'skill_field',
        targeting: { type: 'location', shape: 'circle', range: 18, radius: 6.0 },
        description: '【气场】产生吞日月气场，使范围内敌人移速降低 {bonus}%，伤害降低 {bonus2}%，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'field', params: { color: 0xff3300, duration: 5000, radius: 6.0 } },
            { 
                type: 'tick_effect', 
                duration: 5000, 
                interval: 500, 
                side: 'enemy',
                onTickBuff: { 
                    stat: ['moveSpeed', 'attackDamage'], 
                    multiplier: [0.8, 0.8], 
                    duration: 800, // 略大于 interval 确保覆盖
                    color: 0xff3300,
                    vfxName: 'slow',
                    tag: 'tunriyue'
                }
            }
        ]
    }),
    'sixiang': new Skill('sixiang', {
        name: '四象轮回',
        level: '初级',
        category: '紫霞功',
        icon: 'skill_sixiang', // 假设图标已存在或后续添加
        cost: 25,
        cooldown: 3000,
        audio: 'attack_air_sword',
        targeting: { type: 'instant', radius: 10 },
        description: '集聚浩然之气，连续发射 {count} 枚气剑，每枚造成 {damage} 点伤害',
        actions: [
            { 
                type: 'projectile', 
                count: 5, 
                interval: 150, 
                damage: 35, 
                projType: 'air_sword',
                color: 0x00ffff,
                autoTarget: true,
                targetMode: 'nearest', // 四象轮回：盯着最近的打，适合集火
                scale: 1.5 // 技能射出的剑比普攻大 50%
            }
        ]
    }),
    'liangyi': new Skill('liangyi', {
        name: '两仪化形',
        level: '高级',
        category: '紫霞功',
        icon: 'skill_liangyi',
        cost: 40,
        cooldown: 8000,
        audio: 'attack_air_sword',
        targeting: { type: 'instant', radius: 12 },
        description: '【进阶招式】瞬间爆发万千气劲，发射 {count} 枚追踪气剑，每枚造成 {damage} 点伤害',
        actions: [
            { 
                type: 'projectile', 
                count: 10, 
                interval: 80, 
                damage: 45, 
                projType: 'air_sword',
                color: 0x00ffff,
                autoTarget: true,
                targetMode: 'spread', // 两仪化形：智能散布，每人分几剑，华丽清场
                scale: 1.8 // 进阶技能的剑气更粗壮
            }
        ]
    }),
    'wanshi': new Skill('wanshi', {
        name: '万世不竭',
        level: '绝技',
        category: '紫霞功',
        icon: 'skill_wanshi',
        cost: 80,
        cooldown: 20000,
        audio: 'attack_air_sword',
        targeting: { type: 'instant', radius: 15 },
        description: '【纯阳绝技】生生不息，气劲无穷。持续发射 {count} 枚强力气剑随机轰击周围敌人',
        actions: [
            { 
                type: 'projectile', 
                count: 20, 
                interval: 100, 
                damage: 30.8, 
                projType: 'air_sword',
                color: 0x00ffff,
                autoTarget: true,
                targetMode: 'random',
                scale: 2.5 // 绝技的剑气具有毁灭性的压迫感，最大！
            }
        ]
    }),
    'huasanqing': new Skill('huasanqing', {
        name: '化三清',
        level: '高级',
        category: '气场',
        icon: 'skill_huasanqing',
        cost: 60,
        cooldown: 18000,
        audio: 'skill_field',
        targeting: { type: 'location', shape: 'circle', range: 18, radius: 6.0 },
        description: '【气场】产生化三清气场，使范围内友军功法提升 {bonus} 点，调息提升 {bonus2}%，持续 {duration} 秒',
        actions: [
            { type: 'vfx', name: 'field', params: { color: 0x4488ff, duration: 8000, radius: 6.0 } },
            { 
                type: 'tick_effect', 
                duration: 8000, 
                interval: 500, 
                side: 'player',
                onTickBuff: { 
                    stat: ['spells', 'haste'], 
                    offset: [20, 0.1], // spells 提升 20点，haste 提升 10%
                    duration: 800, 
                    color: 0x4488ff,
                    tag: 'huasanqing'
                }
            }
        ]
    }),
    'hegui': new Skill('hegui', {
        name: '鹤归孤山',
        level: '高级',
        category: '山居剑意',
        icon: 'skill_hegui',
        cost: 40,
        cooldown: 10000,
        audio: 'skill_air_cut', // 第一段：飞身破空声
        targeting: { type: 'location', range: 13, impactRadius: 2.5 },
        description: '【山居剑意】向目标区域飞身俯冲，落地时震碎地面造成 {damage} 点伤害、强力击退并眩晕敌人 2 秒',
        actions: [
            { 
                type: 'movement', 
                moveType: 'dash', 
                duration: 500, 
                jumpHeight: 2.0, // 鹤归孤山有明显的跳跃感
                landActions: [
                    // 第二段：落地砸地声
                    { type: 'vfx', audio: 'skill_jiantan', name: 'stomp', params: { color: 0xffcc00, radius: 2.5, duration: 800 } },
                    { type: 'damage_aoe', value: 80, knockback: 0.5, targeting: { shape: 'circle', radius: 2.5 } },
                    { type: 'status_aoe', status: 'stun', duration: 2000, targeting: { shape: 'circle', radius: 2.5 } }
                ]
            }
        ]
    }),
    'fengcha': new Skill('fengcha', {
        name: '峰插云景',
        level: '初级',
        category: '山居剑意',
        icon: 'skill_fengcha',
        cost: 30,
        cooldown: 4000,
        audio: 'skill_slash',
        targeting: { type: 'instant', shape: 'sector', radius: 4.0, angle: Math.PI / 2 }, 
        description: '【山居剑意】横扫前方，对扇形区域敌人造成 {damage} 点伤害、大幅击退并使其减速 30%，持续 3 秒',
        actions: [
            { type: 'vfx', name: 'advanced_sweep', params: { color: 0xffcc00, duration: 400, radius: 4.0, angle: Math.PI / 2 } },
            { type: 'damage_aoe', value: 35, knockback: 1.6 },
            { type: 'buff_aoe', side: 'enemy', params: { stat: 'moveSpeed', multiplier: 0.7, duration: 3000, color: 0x00ffff, vfxName: 'slow' } }
        ]
    }),
    'songshe': new Skill('songshe', {
        name: '松舍问霞',
        level: '高级',
        category: '山居剑意',
        icon: 'skill_songshe',
        cost: 65,
        cooldown: 7500,
        audio: 'skill_pierce', // 第一段：极速冲锋声
        targeting: { type: 'location', range: 15, impactRadius: 1.3 },
        description: '【山居剑意】以极速俯冲目标，造成 {damage} 点高额爆发伤害并击退周围敌人',
        actions: [
            { 
                type: 'movement', 
                moveType: 'dash', 
                duration: 350, 
                jumpHeight: 0, // 修复：松舍问霞改为突的冲锋感，高度为 0
                landActions: [
                    // 第二段：击中地板声
                    { type: 'vfx', audio: 'skill_jiantan', name: 'stomp', params: { color: 0xff4400, radius: 1.3, duration: 1000 } },
                    { type: 'damage_aoe', value: 145, knockback: 0.3, targeting: { shape: 'circle', radius: 1.3 } }
                ]
            }
        ]
    }),
    'mengquan': new Skill('mengquan', {
        name: '梦泉虎跑',
        level: '高级',
        category: '问水决',
        icon: 'skill_mengquan',
        cost: 45,
        cooldown: 12000,
        audio: 'skill_field',
        targeting: { type: 'instant' },
        description: '【问水决】身如游龙，游走于敌人之间。移动速度提高 50%，攻击频率提高 {bonus}%，击退提高 50%，减伤提高 65%，持续 5 秒。切换重剑形态将中断此效果。',
        actions: [
            {
                type: 'buff_aoe',
                side: 'player',
                tag: 'mengquan',
                applySkillPowerToMultiplier: true, // 只有攻击频率吃系数，放在第一位以确保 {bonus} 对应它
                params: {
                    stat: ['attackSpeed'],
                    multiplier: [1.5], 
                    duration: 5000,
                    vfxName: 'butterfly_particles' // 使用新设计的蝴蝶追随粒子
                },
                // 数据驱动：声明联动逻辑
                linkedModifiers: [
                    { requireTalent: 'cangjian_fengming', stat: 'skill_pinghu_cooldown_multiplier', multiplier: 0.7 }
                ]
            },
            { 
                type: 'buff_aoe', 
                side: 'player', 
                tag: 'mengquan',
                applySkillPowerToMultiplier: false, // 基础移动、击退、减伤不吃系数
                params: { 
                    stat: ['moveSpeed', 'knockback', 'damageReduction'], 
                    multiplier: [1.5, 1.5, 1.0], 
                    offset: [0, 0, 0.65], // 65% 减伤
                    duration: 5000
                } 
            }
        ]
    }),
    'pinghu': new Skill('pinghu', {
        name: '平湖断月',
        level: '初级',
        category: '问水决',
        icon: 'skill_pinghu',
        cost: 15,
        cooldown: 2000,
        audio: 'skill_slash',
        targeting: { type: 'instant', shape: 'sector', radius: 2.5, angle: Math.PI / 2 },
        description: '【问水决】轻盈一击，对前方扇形区域敌人造成 {damage} 点伤害',
        actions: [
            { type: 'vfx', name: 'advanced_sweep', params: { color: 0xffcc00, duration: 200, radius: 2.5, angle: Math.PI / 2 } },
            { type: 'damage_aoe', value: 45, knockback: 0 }
        ]
    }),
    'quanningyue': new Skill('quanningyue', {
        name: '泉凝月',
        level: '初级',
        category: '西子情',
        icon: 'skill_quanningyue',
        cost: 35,
        cooldown: 8000,
        audio: 'skill_field',
        targeting: { type: 'instant' },
        description: '【西子情】运转藏剑高深内功，使自身获得一层相当于最大生命值 {bonus}% 的护盾，持续 {duration} 秒。',
        actions: [
            {
                type: 'shield',
                side: 'caster',
                percent: 0.3,
                duration: 3000,
                applySkillPowerToDuration: false,
                applySkillPowerToMultiplier: true // 只有数值受功法影响，会被 getDescription 标黄
            },
            {
                type: 'vfx',
                name: 'vfx_sparkle',
                params: { color: 0xffffff, radius: 1.2, duration: 500 }
            }
        ]
    }),
    'yingmingliu': new Skill('yingmingliu', {
        name: '莺鸣柳',
        level: '高级',
        category: '西子情',
        icon: 'skill_yingmingliu',
        cost: 60,
        cooldown: 20000,
        audio: 'skill_field',
        targeting: { type: 'instant' },
        description: '【西子情】莺鸣柳浪，剑气如虹。使自身造成的伤害提升 {bonus}%（包括普通攻击与招式），持续 {duration} 秒。',
        actions: [
            {
                type: 'buff_aoe',
                side: 'caster',
                applySkillPowerToMultiplier: true,
                params: {
                    // 同时对物理和魔法增伤桶进行加成，实现“全伤害提升”
                    stat: ['attack_damage_bonus', 'skill_damage_bonus'],
                    multiplier: [1.5, 1.5],
                    duration: 3000,
                    vfxName: 'vfx_sparkle',
                    color: 0xffff00
                }
            }
        ]
    }),
    'sanqing_huashen': new Skill('sanqing_huashen', {
        name: '三清化神',
        level: '绝技',
        category: '紫霞功',
        icon: 'skill_sanqing_huashen',
        cost: 65,
        cooldown: 25000,
        audio: 'skill_field',
        targeting: { type: 'instant' },
        description: '【纯阳绝技】身后化出五把气剑，持续 {duration} 秒。每过 {interval} 秒，五把气剑将依次飞向最近敌人造成 {damage} 点伤害后返回。伤害取决于【根骨】。',
        actions: [
            { 
                type: 'sanqing_huashen', 
                duration: 8000, 
                interval: 3000, 
                damage: 10, 
                swordCount: 5,
                applyPowerToDamage: true,
                applySkillPowerToDamage: false,
                applySkillPowerToDuration: false
            }
        ]
    }),
};

/**
 * 定义各门派可研习的招式表
 */
export const SectSkills = {
    'chunyang': ['sword_rain', 'divine_sword_rain', 'zhenshanhe', 'shengtaiji', 'tunriyue', 'sixiang', 'liangyi', 'wanshi', 'huasanqing', 'sanqing_huashen'],
    'tiance': ['battle_shout', 'summon_militia', 'renchicheng', 'shourushan', 'zhanbafang', 'xiaoruhu', 'pochongwei', 'tu'],
    'cangjian': ['hegui', 'fengcha', 'songshe', 'mengquan', 'pinghu', 'quanningyue', 'yingmingliu', 'fenglaiwushan']
};

