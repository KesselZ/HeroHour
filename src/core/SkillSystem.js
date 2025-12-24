export const SkillRegistry = {
    'sword_rain': {
        name: '万剑归宗',
        icon: 'chunyang',
        cost: 40,
        cooldown: 8000,
        targeting: { type: 'location', shape: 'circle', radius: 4 },
        description: '在指定区域降下剑雨，造成 80 点范围伤害及击退效果',
        execute: (battle, hero, targetPos) => {
            const config = SkillRegistry.sword_rain.targeting;
            // 1. 蓝色剑雨：中等密度
            battle.playVFX('rain', { 
                pos: targetPos, radius: config.radius, color: 0x00ffff, 
                duration: 1000, density: 1.0 
            });
            // 2. 瞬间伤害
            const targets = battle.getUnitsInArea(targetPos, config, 'enemy');
            battle.applyDamageToUnits(targets, 80, targetPos, 0.1);
        }
    },
    'divine_sword_rain': {
        name: '神剑归宗',
        icon: 'chunyang',
        cost: 60,
        cooldown: 12000,
        targeting: { type: 'location', shape: 'square', radius: 6 },
        description: '【进阶招式】在极广的正方形区域降下持续 3 秒的金色神剑，每 0.5 秒造成巨额伤害',
        execute: (battle, hero, targetPos) => {
            const config = SkillRegistry.divine_sword_rain.targeting;
            
            // 1. 金色剑雨：高密度，持续 3 秒
            battle.playVFX('rain', { 
                pos: targetPos, radius: config.radius, color: 0xffff00, 
                duration: 3000, density: 2.0, speed: 1.5 
            });
            
            // 2. 周期性伤害
            battle.applyTickEffect(targetPos, config, {
                duration: 3000,
                interval: 500,
                onTick: (targets) => {
                    battle.applyDamageToUnits(targets, 40, targetPos, 0.05);
                }
            });
        }
    },
    'battle_shout': {
        name: '撼如雷',
        icon: 'tiance',
        cost: 25,
        cooldown: 12000,
        targeting: { type: 'instant' },
        description: '激发起全军斗志，所有友军攻击力提升 50%，持续 5 秒',
        execute: (battle, hero) => {
            // 播放增强版脉冲特效：橙色，3层扩散
            battle.playVFX('pulse', { pos: hero.position, radius: 10, color: 0xffaa00, duration: 800 });
            
            const targets = battle.playerUnits.filter(u => !u.isDead);
            battle.applyBuffToUnits(targets, {
                stat: 'attackDamage',
                multiplier: 1.5,
                duration: 5000,
                color: 0xffaa00
            });
        }
    },
    'summon_militia': {
        name: '集结令',
        icon: 'cangyun',
        cost: 50,
        cooldown: 20000,
        targeting: { type: 'instant' },
        description: '在英雄身边紧急征召 3 名天策弟子参战',
        execute: (battle, hero) => {
            // 播放白色脉冲：小范围召唤反馈
            battle.playVFX('pulse', { pos: hero.position, radius: 3, color: 0xffffff, duration: 500 });
            battle.spawnSupportUnits('melee', 3, hero.position);
        }
    }
};
