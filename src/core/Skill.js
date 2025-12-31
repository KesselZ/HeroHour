import * as THREE from 'three';
import { audioManager } from './AudioManager.js';
import { modifierManager } from './ModifierManager.js';

/**
 * Skill: 技能逻辑的核心基类
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
        this.audio = config.audio || null; // 新增：音效配置
        
        // 运行时状态
        this.lastUsed = 0;
    }

    /**
     * 获取当前实际的冷却时间 (考虑全局修正和特殊天赋)
     */
    /**
     * 获取实际冷却时间 (支持通用声明式劫持)
     */
    getActualCooldown(heroData) {
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        
        // 1. 全局冷却缩减 (haste/急速)
        const globalCDMult = modifierManager.getModifiedValue(dummy, 'cooldown_multiplier', 1.0);
        
        // 2. 技能特定倍率劫持 (例如: pinghu_cooldown_multiplier)
        const specificCDMult = modifierManager.getModifiedValue(dummy, `skill_${this.id}_cooldown_multiplier`, 1.0) * 
                               modifierManager.getModifiedValue(dummy, `category_${this.category}_cooldown_multiplier`, 1.0);
        
        // 3. 技能特定数值覆盖 (例如: tu_cooldown_override)
        const override = modifierManager.getModifiedValue(dummy, `skill_${this.id}_cooldown_override`, 0);
        
        if (override > 0) return override;

        return this.cooldown * globalCDMult * specificCDMult;
    }

    /**
     * 获取当前实际的内力消耗 (考虑通用协议修正)
     */
    getActualManaCost(heroData) {
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        
        // 1. 获取全局消耗倍率 (如调息加成)
        const globalMult = modifierManager.getModifiedValue(dummy, 'mana_cost_multiplier', 1.0);
        
        // 2. 获取技能/类别特定倍率 (如奇穴加成)
        const skillMult = modifierManager.getModifiedValue(dummy, `skill_${this.id}_mana_cost_multiplier`, 1.0);
        const catMult = modifierManager.getModifiedValue(dummy, `category_${this.category}_mana_cost_multiplier`, 1.0);

        return Math.floor(this.cost * globalMult * skillMult * catMult);
    }

    /**
     * 获取当前实际的触发间隔 (考虑通用协议修正)
     */
    getActualInterval(heroData, baseInterval) {
        if (!baseInterval) return 0;
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        
        const offset = modifierManager.getModifiedValue(dummy, `skill_${this.id}_interval_offset`, 0) + 
                       modifierManager.getModifiedValue(dummy, `category_${this.category}_interval_offset`, 0);
        
        return Math.max(100, baseInterval + offset);
    }

    /**
     * 检查技能是否可用
     */
    isReady(heroData) {
        const now = Date.now();
        const actualCost = this.getActualManaCost(heroData);
        const actualCD = this.getActualCooldown(heroData);
        
        const canAffordMP = heroData.mpCurrent >= actualCost;
        const cdReady = (now - this.lastUsed) >= actualCD;
        
        return canAffordMP && cdReady;
    }

    /**
     * 获取当前实际的持续时间 (考虑通用协议修正)
     */
    getActualDuration(heroData, baseDuration) {
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        
        let duration = baseDuration;
        
        // 1. 优先级最高：技能特定覆盖 (Override)
        const skillOverride = modifierManager.getModifiedValue(dummy, `skill_${this.id}_duration_override`, 0);
        if (skillOverride > 0) return skillOverride;

        // 2. 类别覆盖 (Override)
        const categoryOverride = modifierManager.getModifiedValue(dummy, `category_${this.category}_duration_override`, 0);
        if (categoryOverride > 0) return categoryOverride;

        // 3. 累加与倍率 (Offset & Multiplier)
        // 顺序：(Base + Offset) * Multiplier
        const offset = modifierManager.getModifiedValue(dummy, `skill_${this.id}_duration_offset`, 0) + 
                       modifierManager.getModifiedValue(dummy, `category_${this.category}_duration_offset`, 0);
        
        const multiplier = modifierManager.getModifiedValue(dummy, `skill_${this.id}_duration_multiplier`, 1.0) * 
                           modifierManager.getModifiedValue(dummy, `category_${this.category}_duration_multiplier`, 1.0);

        return (duration + offset) * multiplier;
    }

    /**
     * 获取当前实际的半径 (考虑通用协议修正)
     */
    getActualRadius(heroData, baseRadius) {
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        
        let radius = baseRadius;

        // 1. 覆盖
        const skillOverride = modifierManager.getModifiedValue(dummy, `skill_${this.id}_radius_override`, 0);
        if (skillOverride > 0) return skillOverride;

        const categoryOverride = modifierManager.getModifiedValue(dummy, `category_${this.category}_radius_override`, 0);
        if (categoryOverride > 0) return categoryOverride;

        // 2. 累加与倍率
        const offset = modifierManager.getModifiedValue(dummy, `skill_${this.id}_radius_offset`, 0) + 
                       modifierManager.getModifiedValue(dummy, `category_${this.category}_radius_offset`, 0);
        
        const multiplier = modifierManager.getModifiedValue(dummy, `skill_${this.id}_radius_multiplier`, 1.0) * 
                           modifierManager.getModifiedValue(dummy, `category_${this.category}_radius_multiplier`, 1.0);

        return (radius + offset) * multiplier;
    }

    /**
     * 获取动态描述（支持 {damage} 等占位符替换）
     */
    getDescription(heroData) {
        let desc = this.description;
        // 核心优化：直接请求计算好的招式强度系数 (已包含 1 + spells/100 逻辑)
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        const skillPower = modifierManager.getModifiedValue(dummy, 'skill_power', 0);
        
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
                    let currentMultiplier = 1.0;
                    if (action.applyPowerToDamage) {
                        currentMultiplier = modifierManager.getModifiedValue(dummy, 'primary_attack_mult', 1.0);
                    } else if (action.applySkillPowerToDamage !== false) {
                        currentMultiplier = skillPower;
                    }
                    
                    const finalDmg = Math.floor(damageVal * currentMultiplier);
                    desc = desc.split('{damage}').join(hl(finalDmg));
                    desc = desc.split('{tickDamage}').join(hl(finalDmg));
                }

                // 2. 持续时间预处理
                const baseDur = action.duration || (action.params && action.params.duration);
                if (baseDur) {
                    const isVFX = action.type === 'vfx';
                    const isDynamic = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                    
                    // 优先级：逻辑动作 > VFX 动作
                    if (foundDuration === null || (!isVFX && baseDur > 1000)) {
                        // 核心：应用气场增强后的时长
                        const actualDur = this.getActualDuration(heroData, baseDur);
                        foundDuration = isDynamic ? (actualDur * skillPower) : actualDur;
                        isDurationDynamic = isDynamic; // 修正：只有受 skillPower 影响才标记为动态(金色)
                    }
                }

                // 3. 控制时长
                if (action.type === 'status_aoe' && action.duration) {
                    const isDynamic = action.applySkillPowerToDuration === true;
                    const dur = (isDynamic ? (action.duration * skillPower) : action.duration) / 1000;
                    desc = desc.split('{stunDuration}').join(isDynamic ? hl(dur.toFixed(1)) : normal(dur.toFixed(1)));
                }

                // 4. Buff 与 护盾 加成处理
                let isMultDynamic = false;

                if (action.type === 'buff_aoe' || (action.onTickBuff)) {
                    const buffAction = (action.type === 'buff_aoe') ? action : { params: action.onTickBuff, ...action };
                    if (buffAction.params) {
                        const p = buffAction.params;
                        isMultDynamic = buffAction.applySkillPowerToMultiplier !== false;
                        
                        // 处理 multiplier 形式的 bonus
                        if (p.multiplier) {
                            const multipliers = Array.isArray(p.multiplier) ? p.multiplier : [p.multiplier];
                            const stats = Array.isArray(p.stat) ? p.stat : [p.stat];

                            multipliers.forEach((m, idx) => {
                                const statName = stats[idx] || stats[0];
                                const currentPower = isMultDynamic ? skillPower : 1.0;
                                
                                let bonusPct;
                                if (statName === 'damageReduction') {
                                    const offsets = Array.isArray(p.offset) ? p.offset : [p.offset];
                                    const off = offsets[idx] !== undefined ? offsets[idx] : (offsets[0] || 0);
                                    bonusPct = Math.round(off * currentPower * 100);
                                } else {
                                    bonusPct = Math.abs(Math.round((m - 1.0) * currentPower * 100));
                                }
                                
                                const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                                desc = desc.split(placeholder).join(isMultDynamic ? hl(bonusPct) : normal(bonusPct));
                            });
                        }

                        // 处理 offset 形式的 bonus (如化三清的功法提升)
                        if (p.offset) {
                            const offsets = Array.isArray(p.offset) ? p.offset : [p.offset];
                            const stats = Array.isArray(p.stat) ? p.stat : [p.stat];

                            offsets.forEach((o, idx) => {
                                const statName = stats[idx] || stats[0];
                                const currentPower = isMultDynamic ? skillPower : 1.0;
                                
                                let val;
                                if (statName === 'haste') {
                                    val = Math.round(o * currentPower * 100);
                                } else {
                                    val = Math.floor(o * currentPower);
                                }
                                
                                const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                                // 如果占位符还在（没被 multiplier 处理过），则替换
                                if (desc.includes(placeholder)) {
                                    desc = desc.split(placeholder).join(isMultDynamic ? hl(val) : normal(val));
                                }
                            });
                        }
                    }
                } else if (action.type === 'shield') {
                    // 护盾数值处理
                    isMultDynamic = action.applySkillPowerToMultiplier !== false; // 护盾默认也随功法提升
                    const currentPower = isMultDynamic ? skillPower : 1.0;
                    
                    if (action.percent) {
                        const val = Math.round(action.percent * 100 * currentPower);
                        desc = desc.split('{bonus}').join(isMultDynamic ? hl(val) : normal(val));
                    } else if (action.value) {
                        const val = Math.floor(action.value * currentPower);
                        desc = desc.split('{damage}').join(isMultDynamic ? hl(val) : normal(val));
                    }
                }

                if (action.count) {
                    const isCountDynamic = action.applySkillPowerToCount === true;
                    const finalCount = isCountDynamic ? Math.floor(action.count * skillPower) : action.count;
                    desc = desc.split('{count}').join(isCountDynamic ? hl(finalCount) : normal(finalCount));
                }

                // 5. 触发间隔处理
                if (action.interval || (action.params && action.params.interval)) {
                    const baseInterval = action.interval || action.params.interval;
                    const actualInterval = this.getActualInterval(heroData, baseInterval);
                    const isIntervalDynamic = actualInterval !== baseInterval;
                    const intervalStr = (actualInterval / 1000).toFixed(1);
                    desc = desc.split('{interval}').join(isIntervalDynamic ? hl(intervalStr) : normal(intervalStr));
                }

                // 递归处理子动作（如 movement 的 landActions）
                if (action.landActions) {
                    processActions(action.landActions);
                }
            });
        };

        processActions(this.actions);

        // 最后替换持续时间
        if (foundDuration !== null) {
            // 特殊处理：化三清 999 秒显示为“永久”
            if (foundDuration >= 900000) {
                desc = desc.split('{duration}').join(hl('永久'));
            } else {
                const durStr = (foundDuration / 1000).toFixed(1);
                desc = desc.split('{duration}').join(isDurationDynamic ? hl(durStr) : normal(durStr));
            }
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
        
        heroData.mpCurrent -= actualCost;
        this.lastUsed = Date.now();

        // 播放技能音效 (技能触发强制 100% 成功)
        if (this.audio) {
            audioManager.play(this.audio, { force: true });
        }

        // 核心逻辑：根据技能类别自动切换藏剑形态
        if (caster.isHero && caster.type === 'yeying') {
            if (this.category === '山居剑意') {
                caster.cangjianStance = 'heavy'; // 自动切换为重剑形态
            } else if (this.category === '问水决') {
                caster.cangjianStance = 'light'; // 自动切换为轻剑形态
            } else if (this.category === '西子情') {
                // 西子情系列技能不会导致形态切换
            }
        }

        const skillPower = modifierManager.getModifiedValue(caster, 'skill_power', 0);

        this.actions.forEach(action => {
            const center = targetPos || caster.position;
            this._executeAction(action, battleScene, caster, center, skillPower);
        });

        // 播放动作级震屏
        if (this.actions.some(a => a.shake)) {
            battleScene.cameraShake?.(0.15, 200);
        }

        // --- 核心：处理“行云流水”天赋效果 ---
        const isComboChainEnabled = modifierManager.getModifiedValue(caster, 'combo_chain_enabled', 0) > 0;
        if (isComboChainEnabled && caster.isHero) {
            modifierManager.addModifier({
                id: 'combo_chain_buff',
                stat: 'spells', // 功法加成，会自动影响 skill_power
                multiplier: 1.2,
                duration: 3000,
                targetUnit: caster,
                source: 'skill',
                startTime: Date.now()
            });
            // 触发视觉反馈
            if (battleScene.playVFX) {
                battleScene.playVFX('vfx_sparkle', { unit: caster, color: 0x00ffff, duration: 500, radius: 1.2 });
            }
        }

        return true;
    }

    _executeAction(action, battleScene, caster, center, skillPower) {
        // 新增：支持动作级音效播放 (用于实现双段式音效，如落地声)
        if (action.audio) {
            audioManager.play(action.audio, { force: true });
        }

        const heroData = battleScene.worldManager.heroData;

        // --- 核心优化：技能伤害三桶聚合 (完全解耦普攻) ---
        // 1. 桶 1 (主属性): skillPower
        // 2. 桶 2 (增伤): [技能专用增伤桶] (内部加算)
        const skillBonus = modifierManager.getModifiedValue(caster, 'skill_damage_bonus', 1.0);
        
        // 3. 桶 3 (乘区): more_damage (内部乘算)
        const moreDamage = modifierManager.getModifiedValue(caster, 'more_damage', 1.0);
        const totalSkillMult = skillPower * skillBonus * moreDamage;

        switch (action.type) {
            case 'vfx':
                const vfxParams = { ...action.params };
                let vfxDur = vfxParams.duration || 0;
                if (vfxDur && (action.applySkillPowerToDuration || vfxParams.durationPrefix)) {
                    vfxDur *= skillPower;
                }
                
                // 应用气场增强
                const finalVfxDur = this.getActualDuration(heroData, vfxDur);
                if (vfxParams.radius) {
                    vfxParams.radius = this.getActualRadius(heroData, vfxParams.radius);
                }
                vfxParams.duration = finalVfxDur;

                const vfxUnit = (this.targeting.type === 'instant') ? caster : null;
                battleScene.playVFX(action.name, { pos: center, unit: vfxUnit, ...vfxParams });
                break;

            case 'damage_aoe':
                const dmgTargeting = { ...this.targeting, ...(action.targeting || {}) };
                if (dmgTargeting.radius) {
                    dmgTargeting.radius = this.getActualRadius(heroData, dmgTargeting.radius);
                }
                if (dmgTargeting.shape === 'sector') {
                    // 核心修复：如果是瞬发扇形技能，优先朝向当前目标，否则朝向移动方向
                    if (caster.target) {
                        dmgTargeting.facing = new THREE.Vector3().subVectors(caster.target.position, caster.position).normalize();
                    } else {
                        dmgTargeting.facing = caster.getWorldDirection(new THREE.Vector3());
                    }
                }
                const targets = battleScene.getUnitsInArea(center, dmgTargeting, 'enemy');
                battleScene.applyDamageToUnits(targets, action.value * totalSkillMult, center, action.knockback, caster.isHero);
                break;

            case 'buff_aoe':
                const buffTargeting = { ...this.targeting };
                if (buffTargeting.radius) {
                    buffTargeting.radius = this.getActualRadius(heroData, buffTargeting.radius);
                }
                const buffTargets = battleScene.getUnitsInArea(center, buffTargeting, action.side || 'all');
                const isDynamicBuff = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                const isMultDynamic = action.applySkillPowerToMultiplier !== false; 
                
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

                let baseBuffDur = action.params.duration;
                let finalBuffDur = isDynamicBuff ? baseBuffDur * skillPower : baseBuffDur;
                finalBuffDur = this.getActualDuration(heroData, finalBuffDur);

                // --- 核心：藏剑【凤鸣】时长延长 ---
                if (action.params && action.params.tag === 'mengquan' && caster.isHero) {
                    const extraDur = modifierManager.getModifiedValue(caster, 'cangjian_mengquan_duration_add', 0);
                    finalDuration += extraDur;

                    // --- 核心：藏剑【凤鸣】技能联动 ---
                    const isFengmingEnabled = modifierManager.getModifiedValue(caster, 'cangjian_fengming_enabled', 0) > 0;
                    if (isFengmingEnabled) {
                        modifierManager.addModifier({
                            id: 'pinghu_hupao_hijack',
                            stat: 'pinghu_cooldown_multiplier',
                            value: 0.7, // 降低 30% 即乘以 0.7
                            type: 'mult', 
                            unitType: 'hero',
                            source: 'skill',
                            duration: finalDuration,
                            startTime: Date.now()
                        });
                    }
                }

                battleScene.applyBuffToUnits(buffTargets, {
                    ...buffParams,
                    duration: finalDuration
                });
                break;

            case 'tick_effect':
                const isDynamicTick = action.applySkillPowerToDuration || (action.params && action.params.applySkillPowerToDuration);
                const tickTargeting = { ...(action.targeting || this.targeting) };
                
                tickTargeting.radius = this.getActualRadius(heroData, tickTargeting.radius);

                let baseTickDur = action.duration;
                let tickDuration = isDynamicTick ? baseTickDur * skillPower : baseTickDur;
                tickDuration = this.getActualDuration(heroData, tickDuration);

                battleScene.applyTickEffect(center, tickTargeting, {
                    duration: tickDuration,
                    interval: action.interval,
                    targetSide: action.side || 'enemy',
                    onTick: (targets) => {
                        if (action.onTickDamage) {
                            battleScene.applyDamageToUnits(targets, action.onTickDamage * skillPower, center, action.knockback, caster.isHero);
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
                let finalUnitType = action.unitType;
                
                // --- 核心：天策【铁骑召来】逻辑 ---
                if (this.id === 'summon_militia' && modifierManager.getModifiedValue(caster, 'tiance_summon_upgrade', 0) > 0) {
                    finalUnitType = 'tiance'; // 升级为骑兵
                }

                const finalCount = action.applySkillPowerToCount ? Math.floor(action.count * skillPower) : action.count;
                battleScene.spawnSupportUnits(finalUnitType, finalCount, center);
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

                        // --- 核心：藏剑【层云】奇穴落地特效 ---
                        if ((this.id === 'hegui' || this.id === 'songshe') && caster.isHero) {
                            const isJumpWhirlwindEnabled = modifierManager.getModifiedValue(caster, 'cangjian_jump_whirlwind_enabled', 0) > 0;
                            if (isJumpWhirlwindEnabled) {
                                setTimeout(() => {
                                    if (caster.isDead) return;
                                    const landPos = caster.position.clone();
                                    // 播放重剑普通攻击的旋风斩特效，颜色设为明显的橙色，半径增大至与风来吴山一致 (5.0)
                                    battleScene.playVFX('cangjian_whirlwind', { pos: landPos, radius: 5.0, color: 0xff8800, duration: 250 });
                                    // 造成基础 35 的范围伤害 (受功法加成)
                                    const jumpTargets = battleScene.getUnitsInArea(landPos, { shape: 'circle', radius: 5.0 }, 'enemy');
                                    battleScene.applyDamageToUnits(jumpTargets, 35 * skillPower, landPos, 0.035, true);
                                }, 500); // 延迟 0.5 秒
                            }
                        }
                    };
                }
                battleScene.executeMovement(caster, action.moveType, center, moveOptions);
                break;

            case 'status_aoe':
                const statusTargeting = { ...this.targeting };
                statusTargeting.radius = this.getActualRadius(heroData, statusTargeting.radius);
                
                const statusTargets = battleScene.getUnitsInArea(center, statusTargeting, 'enemy');
                battleScene.applyStatusToUnits(statusTargets, action.status, action.duration);
                break;

            case 'dot':
                // DOT 通常作用于当前区域内的敌人
                const dotTargets = battleScene.getUnitsInArea(center, action.targeting || this.targeting, 'enemy');
                dotTargets.forEach(target => {
                    battleScene.applyDOT(target, {
                        damage: action.damage * skillPower,
                        interval: action.interval || 1000,
                        count: action.count || 3,
                        color: action.color,
                        isHeroSource: caster.isHero
                    });
                });
                break;

            case 'shield':
                // 护盾动作：给指定目标（默认为 caster）添加护盾
                const shieldTargetSide = action.side || 'caster';
                const shieldTargets = (shieldTargetSide === 'caster') ? [caster] : battleScene.getUnitsInArea(center, action.targeting || this.targeting, shieldTargetSide);
                
                shieldTargets.forEach(target => {
                    if (target.isDead || !target.addShield) return;
                    
                    // 动态计算护盾量：支持百分比最大生命值或固定数值
                    let shieldAmount = 0;
                    if (action.percent) {
                        shieldAmount = target.maxHealth * action.percent * skillPower;
                    } else if (action.value) {
                        shieldAmount = action.value * skillPower;
                    }
                    
                    const shieldDuration = action.applySkillPowerToDuration ? (action.duration * skillPower) : action.duration;
                    target.addShield(shieldAmount, shieldDuration, action.id || this.id);
                });
                break;

            case 'projectile':
                const initialTargets = battleScene.getUnitsInArea(center, this.targeting, 'enemy');
                battleScene.spawnProjectiles({
                    count: action.count || 1,
                    interval: action.interval || 100,
                    audio: action.audio || this.audio, // 传递音效到发射器
                    startPos: caster.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    target: initialTargets[0], 
                    damage: action.damage * skillPower,
                    speed: action.speed || 0.2,
                    type: action.projType || 'air_sword',
                    color: action.color || 0x88ffff,
                    autoTarget: action.autoTarget !== false,
                    targetMode: action.targetMode || 'random',
                    spread: action.spread || 0.5,
                    scale: action.scale || 1.0,
                    isHeroSource: caster.isHero // 关键：标记为主角来源
                });
                break;

            case 'sanqing_huashen':
                const rawSqDuration = action.applySkillPowerToDuration ? (action.duration * skillPower) : action.duration;
                const sqDuration = this.getActualDuration(heroData, rawSqDuration);
                let sqDamage = action.damage;
                if (action.applyPowerToDamage) {
                    // 三清化神：它被定义为“视为普攻”，因此抓取普攻的所有桶
                    // 包括：主属性(根骨) * 普攻增伤桶 * 独立乘区
                    const atkBonus = modifierManager.getModifiedValue(caster, 'attack_damage_bonus', 1.0);
                    const powerMult = modifierManager.getModifiedValue(caster, 'primary_attack_mult', 1.0) * 
                                     atkBonus * 
                                     modifierManager.getModifiedValue(caster, 'more_damage', 1.0);
                    sqDamage = Math.floor(sqDamage * powerMult);
                } else if (action.applySkillPowerToDamage !== false) {
                    sqDamage = Math.floor(sqDamage * totalSkillMult);
                }
                
                // 核心优化：使用通用的间隔抓取接口
                const finalInterval = this.getActualInterval(heroData, action.interval || 3000);

                battleScene.applySanqingHuashen(caster, {
                    duration: sqDuration,
                    interval: finalInterval,
                    damage: sqDamage,
                    swordCount: action.swordCount || 5,
                    color: action.color || 0x00ffff
                });
                break;
        }
    }
}
