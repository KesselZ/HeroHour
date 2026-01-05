import * as THREE from 'three';
import { audioManager } from './AudioManager.js';
import { modifierManager } from './ModifierManager.js';
import { talentManager } from './TalentManager.js';

/**
 * Skill: 技能逻辑的核心基类
 */
export class Skill {
    constructor(id, config) {
        this.id = id;
        this.config = config; // 保存原始配置引用，用于数据驱动
        this.name = config.name;
        this.level = config.level || '初级';
        this.icon = config.icon;
        this.category = config.category || '通用';
        this.cost = config.cost || 0;
        this.cooldown = config.cooldown || 0;
        this.targeting = config.targeting || { type: 'instant' };
        this.description = config.description || '';
        this.actions = config.actions || [];
        this.audio = config.audio || null; 
        
        this.lastUsed = 0;
    }

    /**
     * 核心辅助：将传入的 heroData 或实战中的 HeroUnit 归一化为 ModifierManager 可识别的上下文
     */
    _getUnitContext(heroData) {
        if (!heroData) return { side: 'player', isHero: true };
        if (heroData.side) return heroData; 
        return { 
            ...heroData, 
            side: 'player', 
            isHero: true, 
            type: heroData.id || heroData.type 
        };
    }

    /**
     * 核心逻辑：计算动作在当前英雄属性下的生效参数 (复用计算公式)
     * 此方法被 getDescription 和 _executeAction 共同调用，确保数值绝对同步
     */
    _getScaledActionParams(action, unit, multipliers) {
        const { skillPower, totalSkillMult, totalPowerMult } = multipliers;
        const params = { ...action };
        
        // 1. 基础伤害确定
        let baseDmg = action.value || action.damage || action.onTickDamage || 0;
        
        // --- 核心进化：自然计算 (Natural Calculation) ---
        // 如果零件带有 damageFactor，则基于父动作的【基础值】进行计算
        if (action.damageFactor && action.parentBaseValue) {
            baseDmg = action.parentBaseValue * action.damageFactor;
        }

        if (baseDmg > 0) {
            // 关键：不论是直接技能还是零件，统一应用当前的功法/力道倍率
            // 这样流血就能吃到“持续伤害加成”、“最终伤害提升”等所有实时 Modifier
            const mult = action.applyPowerToDamage ? totalPowerMult : totalSkillMult;
            params.finalDamage = Math.floor(baseDmg * mult);
        }

        const baseHeal = action.onTickHeal || 0;
        if (baseHeal > 0) {
            params.finalHeal = Math.floor(baseHeal * totalSkillMult);
        }

        // 2. 持续时间缩放
        const baseDur = action.duration || (action.params && action.params.duration) || 0;
        if (baseDur > 0) {
            const isDynamic = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
            params.scaledDuration = isDynamic ? (baseDur * skillPower) : baseDur;
            params.isDurationDynamic = isDynamic;
        }

        // 3. Buff/护盾 属性缩放
        const p = action.params || action.onTickBuff || action;
        if (p && (p.multiplier || p.offset || p.percent)) {
            const isMultDynamic = action.applySkillPowerToMultiplier !== false;
            const currentPower = isMultDynamic ? skillPower : 1.0;
            params.isBonusDynamic = isMultDynamic;

            if (p.multiplier) {
                const ms = Array.isArray(p.multiplier) ? p.multiplier : [p.multiplier];
                const ss = Array.isArray(p.stat) ? p.stat : [p.stat];
                params.bonusValues = ms.map((m, idx) => {
                    if (ss[idx] === 'damageReduction') {
                        const off = Array.isArray(p.offset) ? p.offset[idx] : p.offset;
                        return Math.round((off || 0) * currentPower * 100);
                    }
                    return Math.abs(Math.round((m - 1.0) * currentPower * 100));
                });
            } else if (p.offset) {
                const os = Array.isArray(p.offset) ? p.offset : [p.offset];
                const ss = Array.isArray(p.stat) ? p.stat : [p.stat];
                params.bonusValues = os.map((o, idx) => {
                    return ss[idx] === 'haste' ? Math.round(o * currentPower * 100) : Math.floor(o * currentPower);
                });
            } else if (p.percent) {
                params.bonusValues = [Math.round(p.percent * 100 * currentPower)];
            }
        }

        return params;
    }

    /**
     * 获取实际冷却时间 (支持通用声明式劫ict)
     */
    getActualCooldown(heroData) {
        const unit = this._getUnitContext(heroData);
        
        // --- 核心重构：冷却倍率的基数应该是 1.0 (100%) ---
        // ModifierManager 内部会计算 1.0 * (1 - haste)
        const globalCDMult = modifierManager.getModifiedValue(unit, 'cooldown_multiplier', 1.0);
        
        const specificCDMult = modifierManager.getModifiedValue(unit, `skill_${this.id}_cooldown_multiplier`, 1.0) * 
                               modifierManager.getModifiedValue(unit, `category_${this.category}_cooldown_multiplier`, 1.0);
        
        const override = modifierManager.getModifiedValue(unit, `skill_${this.id}_cooldown_override`, 0);
        
        if (override > 0) return override;

        return this.cooldown * globalCDMult * specificCDMult;
    }

    /**
     * 获取实际内力消耗
     */
    getActualManaCost(heroData) {
        const unit = this._getUnitContext(heroData);
        // --- 核心重构：倍率基数应为 1.0 ---
        const globalMult = modifierManager.getModifiedValue(unit, 'mana_cost_multiplier', 1.0);
        
        const skillMult = modifierManager.getModifiedValue(unit, `skill_${this.id}_mana_cost_multiplier`, 1.0);
        const catMult = modifierManager.getModifiedValue(unit, `category_${this.category}_mana_cost_multiplier`, 1.0);

        return Math.floor(this.cost * globalMult * skillMult * catMult);
    }

    getActualInterval(heroData, baseInterval) {
        if (!baseInterval) return 0;
        const unit = this._getUnitContext(heroData);
        const offset = modifierManager.getModifiedValue(unit, `skill_${this.id}_interval_offset`, 0) + 
                       modifierManager.getModifiedValue(unit, `category_${this.category}_interval_offset`, 0);
        return Math.max(100, baseInterval + offset);
    }

    getActualDuration(heroData, baseDuration) {
        const unit = this._getUnitContext(heroData);
        const skillOverride = modifierManager.getModifiedValue(unit, `skill_${this.id}_duration_override`, 0);
        if (skillOverride > 0) return skillOverride;
        const categoryOverride = modifierManager.getModifiedValue(unit, `category_${this.category}_duration_override`, 0);
        if (categoryOverride > 0) return categoryOverride;

        // 优雅修复：镇山河技能特殊处理，不受气场持续时间延长天赋影响
        const categoryOffset = this.id === 'zhenshanhe' ? 0 :
                               modifierManager.getModifiedValue(unit, `category_${this.category}_duration_offset`, 0);

        const offset = modifierManager.getModifiedValue(unit, `skill_${this.id}_duration_offset`, 0) + categoryOffset;
        const multiplier = modifierManager.getModifiedValue(unit, `skill_${this.id}_duration_multiplier`, 1.0) *
                           modifierManager.getModifiedValue(unit, `category_${this.category}_duration_multiplier`, 1.0);
        return (baseDuration + offset) * multiplier;
    }

    getActualRadius(heroData, baseRadius) {
        const unit = this._getUnitContext(heroData);
        const skillOverride = modifierManager.getModifiedValue(unit, `skill_${this.id}_radius_override`, 0);
        if (skillOverride > 0) return skillOverride;
        const categoryOverride = modifierManager.getModifiedValue(unit, `category_${this.category}_radius_override`, 0);
        if (categoryOverride > 0) return categoryOverride;
        const offset = modifierManager.getModifiedValue(unit, `skill_${this.id}_radius_offset`, 0) + 
                       modifierManager.getModifiedValue(unit, `category_${this.category}_radius_offset`, 0);
        const multiplier = modifierManager.getModifiedValue(unit, `skill_${this.id}_radius_multiplier`, 1.0) * 
                           modifierManager.getModifiedValue(unit, `category_${this.category}_radius_multiplier`, 1.0);
        return (baseRadius + offset) * multiplier;
    }

    /**
     * 判断技能是否冷却完毕且法力充足 (基于当前属性)
     */
    isReady(heroData) {
        const now = Date.now();
        const actualCooldown = this.getActualCooldown(heroData);
        if (now - this.lastUsed < actualCooldown) return false;
        
        const actualCost = this.getActualManaCost(heroData);
        if (heroData.mpCurrent < actualCost) return false;
        
        return true;
    }

    /**
     * 判断当前战斗环境是否允许施放
     */
    canCast(battleScene, caster) {
        const heroData = battleScene.worldManager.heroData;
        if (!this.isReady(heroData)) return false;

        // 目标判定
        if (this.targeting.type === 'target') {
            if (!caster.target || caster.target.isDead) return false;
            const dist = caster.position.distanceTo(caster.target.position);
            if (dist > (this.targeting.range || 10)) return false;
        }

        return true;
    }

    getDescription(heroData) {
        let desc = this.description;
        const unit = this._getUnitContext(heroData);

        const totalSkillMult = modifierManager.getModifiedValue(unit, 'final_skill_multiplier', 1.0);
        const totalPowerMult = modifierManager.getModifiedValue(unit, 'final_power_skill_multiplier', 1.0);
        const baseSpells = unit.baseStats ? unit.baseStats.spells : (unit.stats ? unit.stats.spells : 0);
        const skillPower = modifierManager.getModifiedValue(unit, 'skill_power', baseSpells);
        
        const hl = (val) => `<span class="skill-num-highlight">${val}</span>`;
        const normal = (val) => val; 

        let foundDuration = null;
        let isDurationDynamic = false;
        let foundIsVFX = true;

        const processActions = (actions) => {
            actions.forEach(action => {
                const res = this._getScaledActionParams(action, unit, { skillPower, totalSkillMult, totalPowerMult });

                if (res.finalDamage !== undefined) {
                    desc = desc.split('{damage}').join(hl(res.finalDamage)).split('{tickDamage}').join(hl(res.finalDamage));
                }
                if (res.bonusValues) {
                    res.bonusValues.forEach((val, idx) => {
                        const key = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                        desc = desc.split(key).join(res.isBonusDynamic ? hl(val) : normal(val));
                    });
                }
                if (action.count) {
                    const isDyn = action.applySkillPowerToCount === true;
                    const val = isDyn ? Math.floor(action.count * skillPower) : action.count;
                    desc = desc.split('{count}').join(isDyn ? hl(val) : normal(val));
                }
                if (res.scaledDuration !== undefined) {
                    const isVFX = action.type === 'vfx';
                    // --- 核心修复：智能识别主逻辑时长 ---
                    // 1. 优先选择非 VFX 动作的时长（如 Buff、气场等）
                    // 2. 在同类动作（同为 VFX 或同为逻辑动作）中，选择最长的那个
                    const shouldUpdate = foundDuration === null || 
                                         (!isVFX && (foundIsVFX || res.scaledDuration > foundDuration)) ||
                                         (isVFX && foundIsVFX && res.scaledDuration > foundDuration);

                    if (shouldUpdate) {
                        const rawDuration = action.duration || (action.params && action.params.duration) || 0;
                        const actualDur = this.getActualDuration(heroData, rawDuration);
                        
                        // 核心修复：应基于 res.isDurationDynamic 判断是否应用缩放，而不是只看 action 顶层
                        foundDuration = res.isDurationDynamic ? (actualDur * skillPower) : actualDur;
                        isDurationDynamic = res.isDurationDynamic;
                        foundIsVFX = isVFX;
                    }
                }
                if (action.type === 'status_aoe' && action.duration) {
                    const actualDur = this.getActualDuration(heroData, action.duration);
                    const isDyn = action.applySkillPowerToDuration === true || (action.params && action.params.applySkillPowerToDuration === true);
                    const val = (isDyn ? (actualDur * skillPower) : actualDur) / 1000;
                    desc = desc.split('{stunDuration}').join(isDyn ? hl(val.toFixed(1)) : normal(val.toFixed(1)));
                }
                if (action.interval || (action.params && action.params.interval)) {
                    const baseInt = action.interval || action.params.interval;
                    const actualInt = this.getActualInterval(heroData, baseInt);
                    desc = desc.split('{interval}').join(actualInt !== baseInt ? hl((actualInt / 1000).toFixed(1)) : normal((actualInt / 1000).toFixed(1)));
                }
                if (action.landActions) processActions(action.landActions);
            });
        };

        processActions(this.actions);

        if (foundDuration !== null) {
            const val = foundDuration >= 900000 ? '永久' : (foundDuration / 1000).toFixed(1);
            desc = desc.split('{duration}').join(isDurationDynamic ? hl(val) : normal(val));
        }
        return desc;
    }

    /**
     * 核心：执行技能
     */
    execute(battleScene, caster, targetPos = null) {
        const heroData = battleScene.worldManager.heroData;
        if (!this.isReady(heroData)) return false;

        const actualCost = this.getActualManaCost(heroData);
        battleScene.worldManager.modifyHeroMana(-actualCost);
        this.lastUsed = Date.now();

        if (this.audio) {
            audioManager.play(this.audio, { force: true });
        }

        if (caster.isHero && caster.type === 'yeying') {
            if (this.category === '山居剑意') {
                caster.cangjianStance = 'heavy'; 
            } else if (this.category === '问水决') {
                caster.cangjianStance = 'light'; 
            }
        }

        const baseSpells = caster.baseStats ? caster.baseStats.spells : (heroData.stats ? heroData.stats.spells : 0);
        const skillPower = modifierManager.getModifiedValue(caster, 'skill_power', baseSpells);

        // --- 核心重构：动作拦截与注入 (Action Decoration) ---
        // 引擎不再硬编码逻辑，而是允许 TalentManager 根据当前奇穴动态注入动作
        const tm = talentManager || window.talentManager;
        const finalActions = tm ? tm.decorateSkillActions(this, caster, this.actions) : this.actions;

        finalActions.forEach(action => {
            const center = targetPos || caster.position;
            // 核心重构：执行动作时，自动注入技能的 category 作为 sourceCategory
            this._executeAction(action, battleScene, caster, center, skillPower, this.category);
        });

        if (this.actions.some(a => a.shake)) {
            battleScene.cameraManager.shake(0.2, 300);
        }

        // --- 核心进化：通用技能释放联动 (Post-Cast Linkage) ---
        // 1. 局部联动：由技能配置驱动 (如：某些技能特有的后继效果)
        if (this.config.linkedModifiers) {
            this.config.linkedModifiers.forEach(lm => {
                const isEnabled = lm.requireTalent ? 
                                 (modifierManager.getModifiedValue(caster, lm.requireTalent, 0) > 0) : true;
                if (isEnabled && lm.trigger === 'onCast') {
                    battleScene.applyBuffToUnits([caster], {
                        tag: lm.tag || `cast_link_${this.id}`,
                        stat: lm.stat,
                        multiplier: lm.multiplier,
                        offset: lm.offset,
                        duration: lm.duration,
                        color: lm.color,
                        vfxName: lm.vfxName
                    });
                }
            });
        }

        // 2. 全局联动：由英雄天赋标记驱动 (如：纯阳根节点“行云流水”)
        // 逻辑：只要拥有 combo_chain_enabled 标记，释放任何技能都会获得加成
        const comboEnabled = modifierManager.getModifiedValue(caster, 'combo_chain_enabled', 0);
        if (comboEnabled > 0) {
            battleScene.applyBuffToUnits([caster], {
                tag: 'combo_chain',
                stat: 'spells', 
                multiplier: 1.2, // 提升两成功法
                duration: 3000,
                color: 0x88ff88,
                vfxName: 'vfx_sparkle'
            });
        }

        return true;
    }

    _executeAction(action, battleScene, caster, center, skillPower, sourceCategory) {
        // --- 核心优化：声明式延迟支持 ---
        if (action.delay > 0 && !action._delayed) {
            setTimeout(() => {
                // 递归调用，标记已处理延迟，防止循环
                this._executeAction({ ...action, delay: 0, _delayed: true }, battleScene, caster, center, skillPower, sourceCategory);
            }, action.delay);
            return;
        }

        if (action.audio) {
            audioManager.play(action.audio, { force: true });
        }

        const heroData = battleScene.worldManager.heroData;
        const totalSkillMult = modifierManager.getModifiedValue(caster, 'final_skill_multiplier', 1.0);
        const totalPowerMult = modifierManager.getModifiedValue(caster, 'final_power_skill_multiplier', 1.0);
        
        const res = this._getScaledActionParams(action, caster, { skillPower, totalSkillMult, totalPowerMult });

        switch (action.type) {
            case 'vfx':
                const vfxParams = { ...action.params };
                vfxParams.duration = this.getActualDuration(heroData, res.scaledDuration || 0);
                if (vfxParams.radius) {
                    vfxParams.radius = this.getActualRadius(heroData, vfxParams.radius);
                }
                // 透传颜色 (优先取 params，其次取 action)
                vfxParams.color = vfxParams.color || action.color;
                
                const vfxUnit = (this.targeting.type === 'instant') ? caster : null;
                battleScene.playVFX(action.name, { pos: center, unit: vfxUnit, ...vfxParams });
                break;

            case 'damage_aoe':
                const dmgTargeting = { ...this.targeting, ...(action.targeting || {}) };
                if (dmgTargeting.radius) dmgTargeting.radius = this.getActualRadius(heroData, dmgTargeting.radius);
                if (dmgTargeting.shape === 'sector') {
                    if (caster.target) dmgTargeting.facing = new THREE.Vector3().subVectors(caster.target.position, caster.position).normalize();
                    else dmgTargeting.facing = caster.getWorldDirection(new THREE.Vector3());
                }
                const targets = battleScene.getUnitsInArea(center, dmgTargeting, 'enemy');
                battleScene.applyDamageToUnits(targets, res.finalDamage, center, action.knockback, caster.isHero, action.color);
                
                // --- 核心进化：支持零件化子动作 ---
                if (action.onHit) {
                    if (typeof action.onHit === 'function') {
                        action.onHit(targets, battleScene, center, skillPower, res.finalDamage);
                    } else if (typeof action.onHit === 'object') {
                        // 如果是一个零件对象
                        const subActions = Array.isArray(action.onHit) ? action.onHit : [action.onHit];
                        subActions.forEach(sa => {
                            // 核心重构：不再传递计算后的 finalDamage (快照)
                            // 而是透传原始 action 的基础数值，让零件自己去“自然计算”
                            const parentBaseValue = action.value || action.damage || 0;
                            this._executeAction({ ...sa, parentBaseValue }, battleScene, caster, center, skillPower, sourceCategory);
                        });
                    }
                }
                break;

            case 'buff_aoe':
                const buffTargeting = { ...this.targeting };
                if (buffTargeting.radius) buffTargeting.radius = this.getActualRadius(heroData, buffTargeting.radius);
                const buffTargets = battleScene.getUnitsInArea(center, buffTargeting, action.side || 'all');
                
                const buffParams = { ...action.params };
                if (res.bonusValues) {
                    if (buffParams.multiplier) {
                        buffParams.multiplier = Array.isArray(buffParams.multiplier) 
                            ? res.bonusValues.map(v => 1.0 + v/100) 
                            : (1.0 + res.bonusValues[0]/100);
                    } else if (buffParams.offset) {
                        buffParams.offset = Array.isArray(buffParams.offset) ? res.bonusValues : res.bonusValues[0];
                    } else if (buffParams.percent) {
                        buffParams.percent = res.bonusValues[0] / 100;
                    }
                }

                const finalBuffDur = this.getActualDuration(heroData, res.scaledDuration || action.params.duration);
                battleScene.applyBuffToUnits(buffTargets, { 
                    ...buffParams, 
                    duration: finalBuffDur, 
                    tag: action.tag, 
                    sourceCategory, // 核心：继承类别
                    linkedModifiers: action.linkedModifiers // 透传联动协议
                });
                break;

            case 'status_aoe':
                const stTargeting = { ...this.targeting, ...(action.targeting || {}) };
                if (stTargeting.radius) stTargeting.radius = this.getActualRadius(heroData, stTargeting.radius);
                const stTargets = battleScene.getUnitsInArea(center, stTargeting, action.side || 'enemy');
                const stDur = action.applySkillPowerToDuration ? (action.duration * skillPower) : action.duration;
                battleScene.applyStatusToUnits(stTargets, action.status, stDur);
                break;

            case 'tick_effect':
                const tickTargeting = { ...this.targeting, ...(action.targeting || {}) };
                if (tickTargeting.radius) tickTargeting.radius = this.getActualRadius(heroData, tickTargeting.radius);
                const tickDur = this.getActualDuration(heroData, res.scaledDuration || action.duration);
                const tickInt = this.getActualInterval(heroData, action.interval);
                
                battleScene.applyTickEffect(center, tickTargeting, {
                    duration: tickDur,
                    interval: tickInt,
                    targetSide: action.side || 'enemy',
                    onTick: (targets) => {
                        // 1. 执行内置逻辑 (数据驱动：如生太极的 Buff)
                        if (action.onTickDamage) {
                            battleScene.applyDamageToUnits(targets, res.finalDamage, center, action.knockback || 0, caster.isHero, action.color);
                            
                            // --- 核心钩子：tick_effect 命中子动作 ---
                            if (action.onHit) {
                                const subActions = Array.isArray(action.onHit) ? action.onHit : [action.onHit];
                                subActions.forEach(sa => {
                                    this._executeAction({ ...sa, parentBaseValue: action.onTickDamage }, battleScene, caster, center, skillPower, sourceCategory);
                                });
                            }
                        }
                        if (action.onTickHeal) {
                            battleScene.applyDamageToUnits(targets, -res.finalHeal, center, 0, caster.isHero, action.color || 0x44ff44);
                        }
                        if (action.onTickBuff) {
                            battleScene.applyBuffToUnits(targets, { 
                                ...action.onTickBuff, 
                                sourceCategory
                            });
                        }

                        // --- 核心重构：支持通用 onTick 子动作 (如行天道) ---
                        if (action.onTick && typeof action.onTick === 'object') {
                            const tickActions = Array.isArray(action.onTick) ? action.onTick : [action.onTick];
                            tickActions.forEach(ta => {
                                // 这里如果是纯新增伤害，parentBaseValue 取 0
                                this._executeAction(ta, battleScene, caster, center, skillPower, sourceCategory);
                            });
                        }
                    }
                });
                break;

            case 'summon':
                const finalUnitType = action.unitType;
                const finalCount = action.applySkillPowerToCount ? Math.floor(action.count * skillPower) : action.count;
                battleScene.spawnSupportUnits(finalUnitType, finalCount, center);
                break;

            case 'movement':
                const moveOptions = {
                    duration: action.duration,
                    damage: res.finalDamage || 0,
                    knockback: action.knockback || 0,
                    jumpHeight: action.jumpHeight || 0,
                    isHeroSource: caster.isHero, // 补全：传入来源标记以触发天赋
                    invincible: true, // 核心增强：所有主动位移技能在途中默认无敌
                    onHit: (target) => {
                        // --- 核心钩子：位移碰撞命中 ---
                        if (action.onHit) {
                            const subActions = Array.isArray(action.onHit) ? action.onHit : [action.onHit];
                            subActions.forEach(sa => {
                                this._executeAction({ ...sa, parentBaseValue: action.damage }, battleScene, caster, target.position.clone(), skillPower, sourceCategory);
                            });
                        }
                    },
                    onComplete: () => {
                        if (action.landActions) action.landActions.forEach(la => this._executeAction(la, battleScene, caster, caster.position.clone(), skillPower, sourceCategory));
                        
                        // --- 核心钩子：onComplete ---
                        if (typeof action.onComplete === 'function') {
                            action.onComplete(battleScene, caster, caster.position.clone(), skillPower);
                        }
                        // 支持对象形式的 onComplete
                        if (action.onComplete && typeof action.onComplete === 'object') {
                            const endActions = Array.isArray(action.onComplete) ? action.onComplete : [action.onComplete];
                            endActions.forEach(ea => {
                                this._executeAction(ea, battleScene, caster, caster.position.clone(), skillPower, sourceCategory);
                            });
                        }
                    }
                };
                battleScene.executeMovement(caster, action.moveType, center, moveOptions);
                break;

            case 'projectile':
                const projTargets = battleScene.getUnitsInArea(center, { type: 'instant', radius: 20 }, 'enemy');
                
                // 核心重构：优雅地剥离“技能动作属性”与“子弹视觉属性”，解决命名冲突
                const { type: actionType, projType, visualType, ...projectileParams } = action;
                
                battleScene.spawnProjectiles({
                    ...projectileParams,
                    type: projType || visualType || 'arrow', // 显式映射视觉类型到底层的 type 字段
                    damage: res.finalDamage,
                    isHeroSource: caster.isHero,
                    startPos: caster.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    target: projTargets[0]
                });
                break;

            case 'dot':
                const dotTargeting = { ...this.targeting, ...(action.targeting || {}) };
                const dotTargets = battleScene.getUnitsInArea(center, dotTargeting, action.side || 'enemy');
                dotTargets.forEach(t => {
                    // 修正：统一使用 battleScene.applyDOT 接口
                    if (battleScene.applyDOT) {
                        battleScene.applyDOT(t, {
                            damage: res.finalDamage,
                            interval: action.interval || 1000,
                            count: action.count || 3,
                            color: action.color,
                            isHeroSource: caster.isHero
                        });
                    }
                });
                break;

            case 'sanqing_huashen':
                const sqDur = this.getActualDuration(heroData, res.scaledDuration || action.duration);
                const sqInt = this.getActualInterval(heroData, action.interval || 3000);
                battleScene.applySanqingHuashen(caster, {
                    ...action,
                    duration: sqDur,
                    interval: sqInt,
                    damage: res.finalDamage
                });
                break;
        }
    }
}
