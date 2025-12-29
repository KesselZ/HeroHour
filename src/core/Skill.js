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
        const specificCDMult = modifierManager.getModifiedValue(dummy, `${this.id}_cooldown_multiplier`, 1.0);
        
        // 3. 技能特定数值覆盖 (例如: tu_cooldown_override)
        // 如果该值 > 0，则直接跳过所有计算，强制返回该值
        const override = modifierManager.getModifiedValue(dummy, `${this.id}_cooldown_override`, 0);
        
        if (override > 0) return override;

        return this.cooldown * globalCDMult * specificCDMult;
    }

    /**
     * 检查技能是否可用
     */
    isReady(heroData) {
        const now = Date.now();
        // 核心优化：直接请求计算好的倍率 (已包含 40% 上限逻辑)
        const dummy = { side: 'player', isHero: true, type: heroData.id };
        const mpMult = modifierManager.getModifiedValue(dummy, 'mana_cost_multiplier', 1.0);
        
        const actualCD = this.getActualCooldown(heroData);
        const canAffordMP = heroData.mpCurrent >= Math.floor(this.cost * mpMult);
        const cdReady = (now - this.lastUsed) >= actualCD;
        
        return canAffordMP && cdReady;
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
                            if (statName === 'damageReduction') {
                                // 减伤逻辑：offset 0.65 代表 65%
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
                    if (p.offset) {
                        const offsets = Array.isArray(p.offset) ? p.offset : [p.offset];
                        offsets.forEach((o, idx) => {
                            const finalVal = Math.abs(o) < 1 ? Math.round(o * skillPower * 100) : Math.round(o * skillPower);
                            const placeholder = idx === 0 ? '{bonus}' : `{bonus${idx + 1}}`;
                            desc = desc.split(placeholder).join(hl(finalVal));
                        });
                    }
                }

                if (action.count) {
                    const isCountDynamic = action.applySkillPowerToCount === true;
                    const finalCount = isCountDynamic ? Math.floor(action.count * skillPower) : action.count;
                    desc = desc.split('{count}').join(isCountDynamic ? hl(finalCount) : normal(finalCount));
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
        const heroData = battleScene.worldManager.heroData;
        if (!this.isReady(heroData)) return false;

        // 核心优化：通过 ModifierManager 分别获取 CD 和 蓝耗倍率
        const cdMult = modifierManager.getModifiedValue(caster, 'cooldown_multiplier', 1.0);
        const mpMult = modifierManager.getModifiedValue(caster, 'mana_cost_multiplier', 1.0);
        const actualCost = Math.floor(this.cost * mpMult);
        
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
            }
        }

        const skillPower = modifierManager.getModifiedValue(caster, 'skill_power', 0);

        this.actions.forEach(action => {
            const center = targetPos || caster.position;
            this._executeAction(action, battleScene, caster, center, skillPower);
        });

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
                battleScene.applyDamageToUnits(targets, action.value * skillPower, center, action.knockback, caster.isHero);
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

                let finalDuration = isDynamicBuff ? action.params.duration * skillPower : action.params.duration;

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
                battleScene.applyTickEffect(center, action.targeting || this.targeting, {
                    duration: isDynamicTick ? action.duration * skillPower : action.duration,
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
                    };
                }
                battleScene.executeMovement(caster, action.moveType, center, moveOptions);
                break;

            case 'status_aoe':
                const statusTargets = battleScene.getUnitsInArea(center, this.targeting, 'enemy');
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
        }
    }
}
