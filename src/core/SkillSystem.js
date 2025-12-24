/**
 * 技能类：管理技能的数据、状态（CD）和执行逻辑
 */
export class Skill {
    constructor(id, config) {
        this.id = id;
        this.name = config.name;
        this.icon = config.icon;
        this.cost = config.cost;
        this.cooldown = config.cooldown;
        this.targeting = config.targeting;
        this.description = config.description;
        
        // 声明式动作清单
        this.actions = config.actions || [];
        
        // 运行时状态
        this.lastUsedTime = 0;
    }

    /**
     * 检查技能是否可用
     * @param {Object} heroData 英雄数据 (包含 mpCurrent)
     */
    isReady(heroData) {
        const now = Date.now();
        // 核心改动：应用加速属性 (冷却缩减)
        const actualCooldown = this.cooldown * (1 - (heroData.stats.haste || 0));
        const cdReady = now - this.lastUsedTime >= actualCooldown;
        const mpReady = heroData.mpCurrent >= this.cost;
        return cdReady && mpReady;
    }

    /**
     * 获取剩余冷却百分比 (0-1)
     */
    getCDProgress(heroData) {
        const now = Date.now();
        const elapsed = now - this.lastUsedTime;
        const actualCooldown = this.cooldown * (1 - (heroData?.stats?.haste || 0));
        return Math.min(1, elapsed / actualCooldown);
    }

    /**
     * 执行技能核心流程
     */
    execute(battle, heroUnit, targetPos) {
        const heroData = heroUnit.side === 'player' ? 
            battle.worldManager.heroData : {}; 

        if (!this.isReady(heroData)) return false;

        // 1. 记录状态
        this.lastUsedTime = Date.now();
        heroData.mpCurrent -= this.cost;

        // 2. 计算当前技能强度系数
        // 公式：技能强度 = 1.0 + (主属性 / 100)
        const skillPower = 1.0 + (heroData.stats.primaryStatValue / 100);

        // 3. 执行动作清单
        this.actions.forEach(action => {
            this.runAction(battle, heroUnit, targetPos, action, skillPower);
        });

        return true;
    }

    /**
     * 动作解析器：将配置转化为具体的战斗操作
     * @param {Object} action 原始动作配置
     * @param {number} skillPower 经过计算的强度系数
     */
    runAction(battle, hero, targetPos, action, skillPower) {
        const pos = targetPos || hero.position;
        const config = this.targeting;

        switch (action.type) {
            case 'vfx':
                battle.playVFX(action.name, { pos, radius: config.radius, ...action.params });
                break;

            case 'damage_aoe':
                // 1. 伤害类：直接系数乘法
                const finalDamage = action.value * skillPower;
                const targets = battle.getUnitsInArea(pos, config, 'enemy');
                battle.applyDamageToUnits(targets, finalDamage, pos, action.knockback || 0.1);
                break;

            case 'tick_effect':
                // 2. 周期伤害类：对每一跳伤害做乘法
                battle.applyTickEffect(pos, config, {
                    duration: action.duration,
                    interval: action.interval,
                    onTick: (targets) => {
                        if (action.onTickDamage) {
                            const tickDamage = action.onTickDamage * skillPower;
                            battle.applyDamageToUnits(targets, tickDamage, pos, action.knockback || 0.05);
                        }
                    }
                });
                break;

            case 'buff_aoe':
                const targetSide = action.side || 'player';
                const affectedUnits = battle.getUnitsInArea(pos, config, targetSide);
                
                // 3. 增益类：对加成部分进行倍数放大
                // 公式：最终倍率 = 1.0 + (基础加成 - 1.0) * skillPower
                const params = { ...action.params };
                if (params.multiplier) {
                    const baseBonus = params.multiplier - 1.0;
                    params.multiplier = 1.0 + (baseBonus * skillPower);
                }
                
                battle.applyBuffToUnits(affectedUnits, params);
                break;

            case 'summon':
                // 4. 召唤类：增加召唤数量 (向下取整)
                const finalCount = Math.floor(action.count * skillPower);
                battle.spawnSupportUnits(action.unitType, finalCount, pos);
                break;
        }
    }
}

// 使用类实例重构注册表
export const SkillRegistry = {
    'sword_rain': new Skill('sword_rain', {
        name: '万剑归宗',
        icon: 'skill_wanjiangui_zong',
        cost: 35,
        cooldown: 6000,
        targeting: { type: 'location', shape: 'circle', radius: 4 },
        description: '在指定区域降下剑雨，造成 80 点范围伤害及击退效果',
        actions: [
            { type: 'vfx', name: 'rain', params: { color: 0x00ffff, duration: 1000, density: 1.0 } },
            { type: 'damage_aoe', value: 80, knockback: 0.1 }
        ]
    }),
    'divine_sword_rain': new Skill('divine_sword_rain', {
        name: '神剑归宗',
        icon: 'skill_shenjian_zong',
        cost: 55,
        cooldown: 10000,
        targeting: { type: 'location', shape: 'square', radius: 6 },
        description: '【进阶招式】在极广的正方形区域降下持续 3 秒的金色神剑，每 0.5 秒造成巨额伤害',
        actions: [
            { type: 'vfx', name: 'rain', params: { color: 0xffff00, duration: 3000, density: 2.0, speed: 1.5 } },
            { type: 'tick_effect', duration: 3000, interval: 500, onTickDamage: 40 }
        ]
    }),
    'battle_shout': new Skill('battle_shout', {
        name: '撼如雷',
        icon: 'skill_hanrulei',
        cost: 45,
        cooldown: 10000,
        targeting: { type: 'instant', shape: 'circle', radius: 20 },
        description: '激发起全军斗志，所有友军攻击力提升 50%，持续 5 秒',
        actions: [
            { type: 'vfx', name: 'pulse', params: { color: 0xffaa00, duration: 800, radius: 10 } },
            { type: 'buff_aoe', side: 'player', params: { stat: 'attackDamage', multiplier: 1.5, duration: 5000, color: 0xffaa00 } }
        ]
    }),
    'summon_militia': new Skill('summon_militia', {
        name: '集结令',
        icon: 'skill_jijieling',
        cost: 30,
        cooldown: 15000,
        targeting: { type: 'instant', shape: 'circle', radius: 5 },
        description: '在英雄身边紧急征召 3 名天策弟子参战',
        actions: [
            { type: 'vfx', name: 'pulse', params: { color: 0xffffff, duration: 500, radius: 3 } },
            { type: 'summon', unitType: 'melee', count: 3 }
        ]
    }),
    'zhenshanhe': new Skill('zhenshanhe', {
        name: '镇山河',
        icon: 'skill_zhenshanhe',
        cost: 75,
        cooldown: 25000,
        targeting: { type: 'location', shape: 'circle', radius: 3 },
        description: '【气场】产生无敌气场，保护范围内友军免受伤害（持续 5 秒）',
        actions: [
            { type: 'vfx', name: 'dome', params: { color: 0x88ccff, duration: 5000, radius: 3 } },
            { type: 'buff_aoe', params: { stat: 'invincible', duration: 5000, color: 0x88ccff } }
        ]
    }),
    'fenglaiwushan': new Skill('fenglaiwushan', {
        name: '风来吴山',
        icon: 'skill_fenglaiwushan',
        cost: 50,
        cooldown: 12000,
        targeting: { type: 'instant' },
        description: '【大风车】自身快速旋转，对周围敌人造成高额多段伤害',
        actions: [
            { type: 'vfx', name: 'tornado', params: { color: 0xffcc00, duration: 3000, radius: 4 } },
            { type: 'tick_effect', duration: 3000, interval: 300, onTickDamage: 25, knockback: 0.05 }
        ]
    })
};

/**
 * 定义各门派可研习的招式表
 */
export const SectSkills = {
    'chunyang': ['sword_rain', 'divine_sword_rain', 'zhenshanhe'],
    'tiance': ['battle_shout', 'summon_militia'],
    'cangjian': ['fenglaiwushan']
};
