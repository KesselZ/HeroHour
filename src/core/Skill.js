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
        const skillPower = 1 + (heroData.stats.spells || 0) / 100;
        
        const hl = (val) => `<span class="skill-num-highlight">${val}</span>`;
        const normal = (val) => val; 

        // 收集所有数值，最后统一替换，确保逻辑动作优先
        let foundDuration = null;
        let isDurationDynamic = false;

        const processActions = (actions) => {
            actions.forEach(action => {
                // 1. 伤害数值处理
                const damageVal = action.value || action.damage || action.onTickDamage;
                if (damageVal) {
                    const finalDmg = Math.floor(damageVal * skillPower);
                    desc = desc.split('{damage}').join(hl(finalDmg));
                    desc = desc.split('{tickDamage}').join(hl(finalDmg));
                }

                // 2. 持续时间预处理：如果是 VFX 且持续时间很短，除非没有别的选择，否则不作为主 duration
                const baseDur = action.duration || (action.params && action.params.duration);
                if (baseDur) {
                    const isVFX = action.type === 'vfx';
                    const isDynamic = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                    
                    // 优先级：逻辑动作 > VFX 动作；长持续时间 > 短持续时间
                    if (foundDuration === null || (!isVFX && baseDur > 1000)) {
                        foundDuration = baseDur;
                        isDurationDynamic = isDynamic;
                    }
                }

                // 3. 控制时长
                if (action.type === 'status_aoe' && action.duration) {
                    const dur = (action.duration / 1000).toFixed(1);
                    desc = desc.split('{stunDuration}').join(normal(dur));
                }

                // 4. Buff 加成 (支持普通 Buff 和 Tick Buff)
                const buffAction = (action.type === 'buff_aoe') ? action : (action.onTickBuff ? { params: action.onTickBuff, ...action } : null);
                
                if (buffAction && buffAction.params) {
                    const p = buffAction.params;
                    const isMultDynamic = buffAction.applySkillPowerToMultiplier !== false;
                    
                    if (p.multiplier) {
                        const multipliers = Array.isArray(p.multiplier) ? p.multiplier : [p.multiplier];
                        const stats = Array.isArray(p.stat) ? p.stat : [p.stat];

                        multipliers.forEach((m, idx) => {
                            const statName = stats[idx] || stats[0];
                            const currentPower = isMultDynamic ? skillPower : 1.0;
                            
                            let bonusPct;
                            if (statName === 'damageResist') {
                                bonusPct = Math.abs(Math.round((1.0 - m) * currentPower * 100));
                            } else {
                                bonusPct = Math.abs(Math.round((m - 1.0) * currentPower * 100));
                            }
                            
                            const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                            desc = desc.split(placeholder).join(isMultDynamic ? hl(bonusPct) : normal(bonusPct));
                        });
                    }
                    if (p.offset) {
                        const offsets = Array.isArray(p.offset) ? p.offset : [p.offset];
                        offsets.forEach((o, idx) => {
                            const finalVal = Math.abs(o) < 1 ? Math.round(o * skillPower * 100) : Math.round(o * skillPower);
                            const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                            desc = desc.split(placeholder).join(hl(finalVal));
                        });
                    }
                }

                if (action.count) desc = desc.split('{count}').join(normal(action.count));

                // 递归处理子动作（如 movement 的 landActions）
                if (action.landActions) {
                    processActions(action.landActions);
                }
            });
        };

        processActions(this.actions);

        // 最后替换持续时间
        if (foundDuration !== null) {
            const finalDur = isDurationDynamic ? (foundDuration * skillPower) : foundDuration;
            const durStr = (finalDur / 1000).toFixed(1);
            desc = desc.split('{duration}').join(isDurationDynamic ? hl(durStr) : normal(durStr));
        }

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
        
        battleScene.worldManager.heroData.mpCurrent -= actualCost;
        this.lastUsed = Date.now();

        // 核心逻辑：根据技能类别自动切换藏剑形态
        if (caster.isHero && caster.type === 'yeying') {
            if (this.category.includes('重剑')) {
                caster.cangjianStance = 'heavy';
            } else if (this.category.includes('轻剑')) {
                caster.cangjianStance = 'light';
            }
        }

        this.actions.forEach(action => {
            const skillPower = 1 + (heroStats.spells || 0) / 100;
            const center = targetPos || caster.position;
            this._executeAction(action, battleScene, caster, center, skillPower);
        });

        return true;
    }

    _executeAction(action, battleScene, caster, center, skillPower) {
        switch (action.type) {
            case 'vfx':
                const vfxParams = { ...action.params };
                if (vfxParams.duration && (action.applySkillPowerToDuration || vfxParams.durationPrefix)) {
                    vfxParams.duration *= skillPower;
                }
                // 核心重构：无需再手动计算方向，playVFX 内部会自动补全
                const vfxUnit = (this.targeting.type === 'instant') ? caster : null;
                battleScene.playVFX(action.name, { pos: center, unit: vfxUnit, ...vfxParams });
                break;

            case 'damage_aoe':
                const dmgTargeting = { ...this.targeting, ...(action.targeting || {}) };
                if (dmgTargeting.shape === 'sector') {
                    // 核心修复：如果是瞬发扇形技能，优先朝向当前目标，否则朝向移动方向
                    if (caster.target) {
                        dmgTargeting.facing = new THREE.Vector3().subVectors(caster.target.position, caster.position).normalize();
                    } else {
                        dmgTargeting.facing = caster.getWorldDirection(new THREE.Vector3());
                    }
                }
                const targets = battleScene.getUnitsInArea(center, dmgTargeting, 'enemy');
                battleScene.applyDamageToUnits(targets, action.value * skillPower, center, action.knockback);
                break;

            case 'buff_aoe':
                const buffTargets = battleScene.getUnitsInArea(center, this.targeting, action.side || 'all');
                const isDynamicBuff = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                const isMultDynamic = action.applySkillPowerToMultiplier !== false; // 默认随功法提升
                
                const buffParams = { ...action.params };
                if (buffParams.multiplier) {
                    const currentPower = isMultDynamic ? skillPower : 1.0;
                    buffParams.multiplier = Array.isArray(buffParams.multiplier) 
                        ? buffParams.multiplier.map(m => 1.0 + (m - 1.0) * currentPower)
                        : (1.0 + (buffParams.multiplier - 1.0) * currentPower);
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
                battleScene.applyTickEffect(center, action.targeting || this.targeting, {
                    duration: isDynamicTick ? action.duration * skillPower : action.duration,
                    interval: action.interval,
                    targetSide: action.side || 'enemy',
                    onTick: (targets) => {
                        if (action.onTickDamage) {
                            battleScene.applyDamageToUnits(targets, action.onTickDamage * skillPower, center, action.knockback);
                        }
                        if (action.onTickBuff) {
                            // 动态计算功法对 Buff 的影响
                            const tickBuffParams = { ...action.onTickBuff };
                            const isMultDynamic = action.applySkillPowerToMultiplier !== false;
                            
                            if (tickBuffParams.multiplier) {
                                const currentPower = isMultDynamic ? skillPower : 1.0;
                                tickBuffParams.multiplier = Array.isArray(tickBuffParams.multiplier) 
                                    ? tickBuffParams.multiplier.map(m => 1.0 + (m - 1.0) * currentPower)
                                    : (1.0 + (tickBuffParams.multiplier - 1.0) * currentPower);
                            }
                            if (tickBuffParams.offset) {
                                tickBuffParams.offset = Array.isArray(tickBuffParams.offset)
                                    ? tickBuffParams.offset.map(o => o * skillPower)
                                    : (tickBuffParams.offset * skillPower);
                            }
                            battleScene.applyBuffToUnits(targets, tickBuffParams);
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
                    spread: action.spread || 0.5,
                    scale: action.scale || 1.0
                });
                break;
        }
    }
}
