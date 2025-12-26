import * as THREE from 'three';

/**
 * Skill: 技能逻辑的核心基类
 * 只包含技能的元数据定义和描述解析逻辑，不包含复杂的业务逻辑，以避免循环引用
 */
export class Skill {
    constructor(id, config) {
        this.id = id;
        this.name = config.name;
        this.level = config.level || '初级';
        this.icon = config.icon;
        this.category = config.category || '通用';
        this.cost = config.cost || 0;
        this.cooldown = config.cooldown || 0;
        this.targeting = config.targeting || { type: 'instant' };
        this.description = config.description || '';
        this.actions = config.actions || [];
        
        // 运行时状态
        this.lastUsed = 0;
    }

    /**
     * 检查技能是否可用
     */
    isReady(heroData) {
        const now = Date.now();
        const haste = heroData.stats.haste || 0;
        const actualCD = this.cooldown * (1 - haste);
        
        const canAffordMP = heroData.mpCurrent >= Math.floor(this.cost * (1 - haste));
        const cdReady = (now - this.lastUsed) >= actualCD;
        
        return canAffordMP && cdReady;
    }

    /**
     * 获取动态描述（支持 {damage} 等占位符替换）
     */
    getDescription(heroData) {
        let desc = this.description;
        // 剑网三设定：功法属性 (spells) 提升招式强度
        // 1点功法提升 1% 招式强度，基础值为 1.0 (100%)
        const skillPower = 1 + (heroData.stats.spells || 0) / 100;
        
        // 定义高亮和普通处理函数
        const hl = (val) => `<span class="skill-num-highlight">${val}</span>`;
        const normal = (val) => val; 

        // 收集所有 actions 中的潜在数值
        this.actions.forEach(action => {
            // 1. 处理伤害数值 (包含 value, damage, onTickDamage) -> 总是受系数影响 -> 高亮
            const damageVal = action.value || action.damage || action.onTickDamage;
            if (damageVal) {
                const finalDmg = Math.floor(damageVal * skillPower);
                desc = desc.split('{damage}').join(hl(finalDmg));
                desc = desc.split('{tickDamage}').join(hl(finalDmg));
            }

            // 2. 处理持续时间 {duration}
            // 兼容 action 根节点 (tick_effect) 或 params 里的 duration (buff_aoe/vfx)
            const baseDur = action.duration || (action.params && action.params.duration);
            if (baseDur) {
                // 检查是否开启了系数加成 (支持根节点或 params 节点)
                const isDynamic = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                const finalDur = isDynamic ? (baseDur * skillPower) : baseDur;
                const durStr = (finalDur / 1000).toFixed(1);
                // 只有动态受系数影响的才高亮，否则普通显示
                desc = desc.split('{duration}').join(isDynamic ? hl(durStr) : normal(durStr));
            }

            // 3. 处理控制时长 (stunDuration) -> 通常固定
            if (action.type === 'status_aoe' && action.duration) {
                const dur = (action.duration / 1000).toFixed(1);
                desc = desc.split('{stunDuration}').join(normal(dur));
            }

            // 4. 处理 Buff 加成 (bonus) -> 总是受系数影响 -> 高亮
            if (action.type === 'buff_aoe' && action.params) {
                const p = action.params;
                
                // 处理 multiplier 类型的加成
                if (p.multiplier) {
                    const multipliers = Array.isArray(p.multiplier) ? p.multiplier : [p.multiplier];
                    multipliers.forEach((m, idx) => {
                        const bonusPct = Math.abs(Math.round((m - 1.0) * skillPower * 100));
                        const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                        desc = desc.split(placeholder).join(hl(bonusPct));
                    });
                }
                
                // 处理 offset 类型的加成 (如化三清的功法提升)
                if (p.offset) {
                    const offsets = Array.isArray(p.offset) ? p.offset : [p.offset];
                    offsets.forEach((o, idx) => {
                        let finalVal;
                        // 如果是数值（如 20点功法），直接乘系数
                        // 如果是小数（如 0.1 调息），转为百分比再乘系数
                        if (Math.abs(o) < 1) {
                            finalVal = Math.round(o * skillPower * 100);
                        } else {
                            finalVal = Math.round(o * skillPower);
                        }
                        const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                        desc = desc.split(placeholder).join(hl(finalVal));
                    });
                }
            }

            // 5. 处理特殊计数 (如召唤数量 {count}) -> 固定
            if (action.count) {
                desc = desc.split('{count}').join(normal(action.count));
            }
        });

        return desc;
    }

    /**
     * 核心：执行技能
     */
    execute(battleScene, caster, targetPos = null) {
        if (!this.isReady(battleScene.worldManager.heroData)) return false;

        const heroStats = battleScene.worldManager.heroData.stats;
        const haste = heroStats.haste || 0;
        const actualCost = Math.floor(this.cost * (1 - haste));
        
        // 1. 扣除消耗
        battleScene.worldManager.heroData.mpCurrent -= actualCost;
        this.lastUsed = Date.now();

        // 2. 顺序执行 Actions
        this.actions.forEach(action => {
            const skillPower = 1 + (heroStats.spells || 0) / 100;
            const center = targetPos || caster.position;
            this._executeAction(action, battleScene, caster, center, skillPower);
        });

        return true;
    }

    /**
     * 内部方法：执行单个动作逻辑（实现高度复用）
     */
    _executeAction(action, battleScene, caster, center, skillPower) {
        switch (action.type) {
            case 'vfx':
                const vfxParams = { ...action.params };
                if (vfxParams.duration && (action.applySkillPowerToDuration || vfxParams.applySkillPowerToDuration)) {
                    vfxParams.duration *= skillPower;
                }
                battleScene.playVFX(action.name, { pos: center, ...vfxParams });
                break;

            case 'damage_aoe':
                const dmgTargeting = { ...this.targeting, ...(action.targeting || {}) };
                if (dmgTargeting.shape === 'sector') {
                    dmgTargeting.facing = caster.getWorldDirection(new THREE.Vector3());
                }
                const targets = battleScene.getUnitsInArea(center, dmgTargeting, 'enemy');
                battleScene.applyDamageToUnits(targets, action.value * skillPower, center, action.knockback);
                break;

            case 'buff_aoe':
                const buffTargets = battleScene.getUnitsInArea(center, this.targeting, action.side || 'all');
                const isDynamicBuff = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                const buffParams = { ...action.params };
                if (buffParams.multiplier) {
                    buffParams.multiplier = Array.isArray(buffParams.multiplier) 
                        ? buffParams.multiplier.map(m => 1.0 + (m - 1.0) * skillPower)
                        : (1.0 + (buffParams.multiplier - 1.0) * skillPower);
                }
                if (buffParams.offset) {
                    buffParams.offset = Array.isArray(buffParams.offset)
                        ? buffParams.offset.map(o => o * skillPower)
                        : (buffParams.offset * skillPower);
                }
                battleScene.applyBuffToUnits(buffTargets, {
                    ...buffParams,
                    duration: isDynamicBuff ? action.params.duration * skillPower : action.params.duration
                });
                break;

            case 'tick_effect':
                const isDynamicTick = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                battleScene.applyTickEffect(center, this.targeting, {
                    duration: isDynamicTick ? action.duration * skillPower : action.duration,
                    interval: action.interval,
                    targetSide: 'enemy',
                    onTick: (enemies) => {
                        if (action.onTickDamage) {
                            battleScene.applyDamageToUnits(enemies, action.onTickDamage * skillPower, center, action.knockback);
                        }
                    }
                });
                break;

            case 'summon':
                battleScene.spawnSupportUnits(action.unitType, action.count, center);
                break;

            case 'movement':
                const moveOptions = {
                    duration: action.duration,
                    damage: (action.damage || 0) * skillPower,
                    knockback: action.knockback || 0,
                    jumpHeight: action.jumpHeight || 0 // 新增：支持跳跃弧线
                };

                // 优雅复用：落地时递归调用 _executeAction
                if (action.landActions) {
                    moveOptions.onComplete = () => {
                        action.landActions.forEach(la => {
                            this._executeAction(la, battleScene, caster, caster.position.clone(), skillPower);
                        });
                    };
                }
                battleScene.executeMovement(caster, action.moveType, center, moveOptions);
                break;

            case 'status_aoe':
                const statusTargets = battleScene.getUnitsInArea(center, this.targeting, 'enemy');
                battleScene.applyStatusToUnits(statusTargets, action.status, action.duration);
                break;

            case 'projectile':
                const initialTargets = battleScene.getUnitsInArea(center, this.targeting, 'enemy');
                battleScene.spawnProjectiles({
                    count: action.count || 1,
                    interval: action.interval || 100,
                    startPos: caster.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    target: initialTargets[0], 
                    damage: action.damage * skillPower,
                    speed: action.speed || 0.2,
                    type: action.projType || 'air_sword',
                    color: action.color || 0x88ffff,
                    autoTarget: action.autoTarget !== false,
                    targetMode: action.targetMode || 'random',
                    spread: action.spread || 0.5
                });
                break;
        }
    }
}
