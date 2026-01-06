import { TALENT_UNITS, HERO_TREE_CONFIG, getHeroTalentTree } from './TalentRegistry.js';
import { modifierManager } from './ModifierManager.js';

/**
 * TalentManager: 奇穴系统逻辑管理器
 * 
 * --- 开发者指南：如何优雅地让奇穴影响技能？ ---
 * 
 * 方式 A: 声明式覆盖 (推荐：用于通用参数)
 * - 适用：CD、内力消耗、持续时间(Duration)、影响半径(Radius)。
 * - 实现：直接在 TalentRegistry 的 effects 中定义 `skill_ID_cooldown_override` 等 Key。
 * - 原理：Skill.js 核心逻辑会自动检查这些 Key，无需在 TalentManager 中写逻辑。
 * 
 * 方式 B: 动作装饰注入 (用于深层逻辑/动作修改)
 * - 适用：修改 Action 内部的基础值(如护盾比例)、注入新 Action (如流血、落地回旋斩)、改变动作属性(如召兵种类)。
 * - 实现：在下方的 `decorateSkillActions` 方法中进行拦截和 map 处理。
 * - 注意：这里只改“图纸基础值”，不处理英雄属性倍率计算。
 * 
 * 方式 C: 描述装饰 (仅用于显示)
 * - 适用：当 Action 被装饰后，默认的 Tooltip 模板(Template)需要改变时（例如增加原本没有的文字）。
 * - 实现：在下方的 `decorateSkillDescription` 中修改字符串模板。
 * - 自动化：如果 Action 的基础值变了且模板中有 {bonus} 等占位符，系统会自动计算并显示最终值，无需在此手动处理。
 * - 禁忌：严禁在此方法中修改任何战斗逻辑。
 */
class TalentManager {
    constructor() {
        this.activeTalents = {};
        this.heroData = null;
        this.currentTree = null; // 缓存当前英雄生成的树
    }

    /**
     * 奇穴动作装饰器 (Action Decorator)
     * 
     * 职责：在技能执行前，根据当前奇穴状态，动态修改技能的“动作图纸”。
     * 分工：
     * 1. 修改 Action 的基础数值 (如：percent, value)。这些值随后会进入 Skill.js 正常的倍率缩放流程。
     * 2. 注入新的 Action (如：onHit 零件，onComplete 零件)。
     * 3. 拦截并替换 Action 类型 (如：summon 兵种替换)。
     * 
     * 注意：如果只是修改 CD 或内力消耗，请使用【方式 A】，不要在此处手动 map。
     */
    decorateSkillActions(skill, caster, baseActions) {
        let finalActions = [...baseActions];

        // 统一处理：确保所有 caster (包括 heroData 镜像) 都能被识别
        const unitContext = caster.side ? caster : { side: 'player', isHero: true, type: caster.id || caster.type };

        // --- A. 天策联动收敛 ---
        
        // 1. 召兵升级
        const tianceUpgrade = modifierManager.getModifiedValue(unitContext, 'tiance_summon_upgrade', 0);
        if (tianceUpgrade > 0 && skill.id === 'summon_militia') {
            finalActions = finalActions.map(action => {
                if (action.type === 'summon') return { ...action, unitType: 'tiance' };
                return action;
            });
        }

        // 2. 龙牙破军 (流血效果)
        const bleedFactor = modifierManager.getModifiedValue(unitContext, 'tiance_bleeding_enabled', 0);
        if (bleedFactor > 0 && skill.category !== '普通攻击') {
            const bleedPart = { 
                type: 'dot', 
                damageFactor: bleedFactor, 
                applyPowerToDamage: true, 
                count: 3, 
                interval: 1000, 
                color: 0xff3300 
            };

            finalActions = finalActions.map(action => {
                if (action.type === 'damage_aoe' || action.type === 'projectile' || action.type === 'tick_effect' || action.type === 'movement') {
                    return { ...action, onHit: action.onHit ? (Array.isArray(action.onHit) ? [...action.onHit, bleedPart] : [action.onHit, bleedPart]) : bleedPart };
                }
                return action;
            });
        }

        // 3. 撼如雷强化 (激雷)
        if (skill.id === 'battle_shout') {
            const shoutHaste = modifierManager.getModifiedValue(unitContext, 'tiance_shout_haste_enabled', 0);
            if (shoutHaste > 0) {
                finalActions = finalActions.map(action => {
                    if (action.type === 'buff_aoe') {
                        const stats = Array.isArray(action.params.stat) ? [...action.params.stat] : [action.params.stat];
                        const multipliers = Array.isArray(action.params.multiplier) ? [...action.params.multiplier] : [action.params.multiplier];
                        
                        if (!stats.includes('attackSpeed')) {
                            stats.push('attackSpeed');
                            multipliers.push(1.0 + shoutHaste);
                        }
                        
                        return {
                            ...action,
                            params: {
                                ...action.params,
                                stat: stats,
                                multiplier: multipliers
                            }
                        };
                    }
                    return action;
                });
            }
        }

        // 4. 啸如虎强化 (虎啸)
        if (skill.id === 'xiaoruhu') {
            const tigerEnhanced = modifierManager.getModifiedValue(unitContext, 'tiance_tiger_lock_enhanced', 0);
            if (tigerEnhanced > 0) {
                finalActions = finalActions.map(action => {
                    if (action.type === 'buff_aoe') {
                        return {
                            ...action,
                            params: {
                                ...action.params,
                                stat: ['tigerHeart', 'tiger_heart_lock_percent'],
                                multiplier: [1, 1],
                                offset: [1, 0.5]
                            }
                        };
                    }
                    return action;
                });
            }
        }

        // --- B. 纯阳联动收敛 ---

        // 1. 行天道 (气场伤害 - 收敛为零件)
        const xingTianDaoValue = modifierManager.getModifiedValue(caster, 'chunyang_field_damage_enabled', 0);
        if (xingTianDaoValue > 0 && skill.category === '气场') {
            finalActions = finalActions.map(action => {
                if (action.type === 'tick_effect') {
                    return { 
                        ...action, 
                        onTick: { 
                            type: 'damage_aoe', 
                            value: xingTianDaoValue, 
                            color: 0x00ffff, 
                            targeting: action.targeting 
                        } 
                    };
                }
                return action;
            });
        }

        // --- C. 藏剑联动收敛 ---
        const jumpWhirlwind = modifierManager.getModifiedValue(caster, 'cangjian_jump_whirlwind_enabled', 0);
        if (jumpWhirlwind > 0 && (skill.id === 'hegui' || skill.id === 'songshe')) {
            finalActions = finalActions.map(action => {
                if (action.type === 'movement') {
                    return { 
                        ...action, 
                        // 注入一组带 500ms 延迟的动作零件
                        onComplete: [
                            {
                                type: 'vfx',
                                delay: 500, // 0.5秒延迟
                                name: 'cangjian_whirlwind', // 复用现有旋风斩特效
                                params: { 
                                    color: 0xffcc00, 
                                    radius: 5.0, 
                                    duration: 500 
                                }
                            },
                            { 
                                type: 'damage_aoe', 
                                delay: 500, // 与特效同步延迟
                                value: 35, 
                                targeting: { radius: 5.0 }, 
                                color: 0xff8800,
                                // 不设置 applyPowerToDamage: true，默认使用 totalSkillMult (受功法影响)
                            }
                        ]
                    };
                }
                return action;
            });
        }

        // 2. 泉凝月强化 (听莺)
        const tingyingPercent = modifierManager.getModifiedValue(unitContext, 'skill_quanningyue_percent_override', 0);
        const tingyingDuration = modifierManager.getModifiedValue(unitContext, 'skill_quanningyue_duration_override', 0);
        if (skill.id === 'quanningyue' && tingyingPercent > 0) {
            finalActions = finalActions.map(action => {
                if (action.type === 'shield') {
                    return { ...action, percent: tingyingPercent, duration: tingyingDuration || action.duration };
                }
                return action;
            });
        }

        // 3. 梦泉虎跑强化 (片玉)
        const pianyuDR = modifierManager.getModifiedValue(unitContext, 'skill_mengquan_dr_override', 0);
        if (skill.id === 'mengquan' && pianyuDR > 0) {
            finalActions = finalActions.map(action => {
                // 找到包含减伤的 buff 动作
                if (action.type === 'buff_aoe' && action.params.stat && action.params.stat.includes('damageReduction')) {
                    const stats = Array.isArray(action.params.stat) ? [...action.params.stat] : [action.params.stat];
                    const offsets = Array.isArray(action.params.offset) ? [...action.params.offset] : [action.params.offset];
                    
                    const drIndex = stats.indexOf('damageReduction');
                    if (drIndex !== -1) {
                        offsets[drIndex] = pianyuDR; // 使用来自奇穴数据的数值
                    }
                    
                    return {
                        ...action,
                        params: { ...action.params, offset: offsets }
                    };
                }
                return action;
            });
        }

        return finalActions;
    }

    /**
     * 奇穴描述装饰器 (Description Decorator)
     * 
     * 职责：修正技能面板(Tooltip)的文字描述模板。
     * 
     * 准则：
     * 1. 仅限替换字符串模板。
     * 2. 只有在原始描述是“死文字”且无法通过占位符自然表达时，才在此处进行手动替换。
     */
    decorateSkillDescription(skill, caster, baseDescription) {
        let desc = baseDescription;
        const unitContext = caster.side ? caster : { side: 'player', isHero: true, type: caster.id || caster.type };

        // 1. 激雷：为撼如雷增加攻速描述
        if (skill.id === 'battle_shout') {
            const val = modifierManager.getModifiedValue(unitContext, 'tiance_shout_haste_enabled', 0);
            if (val > 0) {
                // 将描述中的 "提升 {bonus}%" 替换为 "提升 {bonus}% 及 {bonus2}% 攻击速度"
                desc = desc.replace('提升 {bonus}%', '提升 {bonus}% 及 {bonus2}% <span class="skill-term-highlight">攻击速度</span>');
            }
        }

        // 2. 虎啸：修改啸如虎的锁血点描述
        if (skill.id === 'xiaoruhu') {
            const val = modifierManager.getModifiedValue(unitContext, 'tiance_tiger_lock_enhanced', 0);
            if (val > 0) {
                desc = desc.replace('1 点', '<span class="skill-num-highlight">50%</span> 最大生命值');
            }
        }

        // 3. 听莺：原本 quanningyue 描述已有 {bonus} 和 {duration} 占位符
        // 由于 decorateSkillActions 已经修改了基础值，系统会自动算出最终百分比。
        // 此处不再需要任何逻辑，系统会自然渲染。

        // 4. 片玉：修改梦泉虎跑的减伤描述
        // 注意：原本 mengquan 的减伤描述是硬编码的 "65%"，所以这里需要手动替换模板
        if (skill.id === 'mengquan') {
            const pianyuDR = modifierManager.getModifiedValue(unitContext, 'skill_mengquan_dr_override', 0);
            if (pianyuDR > 0) {
                desc = desc.replace('减伤提高 65%', `减伤提高 <span class="skill-num-highlight">${Math.round(pianyuDR * 100)}%</span>`);
            }
        }

        return desc;
    }

    /**
     * 初始化英雄的奇穴状态
     */
    init(heroData) {
        this.heroData = heroData;
        this.activeTalents = heroData.talents || {};

        // 核心改动：职业中心节点默认点亮 (不消耗点数)
        if (Object.keys(this.activeTalents).length === 0 || !this.activeTalents['node_core']) {
            this.activeTalents['node_core'] = 1;
            if (this.heroData) {
                this.heroData.talents = this.activeTalents;
            }
        }

        // 根据当前英雄 ID 重新生成对应的天赋树
        this.currentTree = getHeroTalentTree(heroData.id);
        this.applyAllTalentEffects();
    }

    /**
     * 检查奇穴是否可以升级
     */
    canUpgrade(nodeId) {
        if (!this.currentTree) return { canUpgrade: false, reason: '未初始化' };
        const node = this.currentTree.nodes[nodeId];
        if (!node) return { canUpgrade: false, reason: '无效奇穴' };

        const currentLevel = this.activeTalents[nodeId] || 0;
        
        if (currentLevel >= node.maxLevel) {
            return { canUpgrade: false, reason: '已达最高重' };
        }

        const availablePoints = this.heroData ? (this.heroData.talentPoints || 0) : 0;
        if (availablePoints <= 0) {
            return { canUpgrade: false, reason: '奇穴点数不足' };
        }

        // 复用逻辑检查
        const unlockStatus = this.checkUnlockStatus(nodeId);
        if (unlockStatus.isLocked) {
            return { canUpgrade: false, reason: unlockStatus.reason };
        }

        return { canUpgrade: true };
    }

    /**
     * 检查奇穴是否满足逻辑上的解锁条件 (前置需求和互斥)
     * 用于 UI 表现：如果是不能点出的，显示为灰色
     */
    checkUnlockStatus(nodeId) {
        if (!this.currentTree) return { isLocked: true, reason: '未初始化' };
        const node = this.currentTree.nodes[nodeId];
        if (!node) return { isLocked: true, reason: '无效奇穴' };

        // 核心节点永远解锁
        if (node.type === 'core') return { isLocked: false };
        
        // 如果已经有等级，视为已解锁
        if ((this.activeTalents[nodeId] || 0) > 0) return { isLocked: false };

        // --- A. 互斥检查 (Conflicts) ---
        if (node.conflicts && node.conflicts.length > 0) {
            for (const conflictId of node.conflicts) {
                if ((this.activeTalents[conflictId] || 0) > 0) {
                    const conflictNode = this.currentTree.nodes[conflictId];
                    return { isLocked: true, reason: `与已修习奇穴【${conflictNode ? conflictNode.name : conflictId}】互斥` };
                }
            }
        }

        // --- B. 前置需求检查 (Requires) ---
        if (node.requires && node.requires.length > 0) {
            for (const reqId of node.requires) {
                const reqLevel = this.activeTalents[reqId] || 0;
                const reqNode = this.currentTree.nodes[reqId];
                
                // 核心重构：取消“必须修满”限制，只要点出 1 重即可解锁后续
                if (reqLevel < 1) {
                    return { isLocked: true, reason: `需先领悟前置奇穴：${reqNode ? reqNode.name : reqId}` };
                }
            }
        }

        // --- C. 前置技能检查 ---
        if (node.requiredSkill) {
            const heroSkills = this.heroData ? (this.heroData.skills || []) : [];
            const requiredSkills = Array.isArray(node.requiredSkill) ? node.requiredSkill : [node.requiredSkill];
            const hasSkill = requiredSkills.some(sid => heroSkills.includes(sid));
            
            if (!hasSkill) {
                const skillNames = requiredSkills.map(sid => {
                    // 核心修复：通过全局或动态方式获取技能名称，避免循环依赖导致的初始化失败
                    const SkillRegistry = typeof window !== 'undefined' ? window.SkillRegistry : null; 
                    const skill = SkillRegistry ? SkillRegistry[sid] : null;
                    return skill ? `【${skill.name}】` : sid;
                }).join(' 或 ');
                return { isLocked: true, reason: `需先领悟招式：${skillNames}` };
            }
        }

        return { isLocked: false };
    }

    /**
     * 升级奇穴
     */
    upgradeTalent(nodeId) {
        const check = this.canUpgrade(nodeId);
        if (!check.canUpgrade) return false;

        if (this.heroData) this.heroData.talentPoints--;
        this.activeTalents[nodeId] = (this.activeTalents[nodeId] || 0) + 1;
        if (this.heroData) this.heroData.talents = this.activeTalents;

        this.applyAllTalentEffects();
        return true;
    }

    /**
     * 应用所有加成
     */
    applyAllTalentEffects() {
        if (!this.currentTree) return;
        modifierManager.removeModifiersBySource('talent');

        for (const nodeId in this.activeTalents) {
            const level = this.activeTalents[nodeId];
            const node = this.currentTree.nodes[nodeId];
            if (!node || level <= 0) continue;

            node.effects?.forEach(effect => {
                const finalValue = effect.perLevel ? effect.value * level : effect.value;

                // 统一使用 addModifier，并显式传递计算类型
                if (effect.type === 'stat') {
                    modifierManager.addModifier({
                        side: 'player', 
                        unitType: 'hero', // 映射到新的 unitType 字段
                        stat: effect.stat,
                        value: finalValue, 
                        type: 'add', // 英雄基础属性通常是加法
                        source: 'talent', 
                        id: `talent_${nodeId}_${effect.stat}`
                    });
                } else if (effect.type === 'modifier') {
                    // 天赋配置中，如果有 value < 0 且绝对值小于 1，或者是明确的比例，判定为 percent
                    // 未来可以在 TALENT_UNITS 中显式定义 method
                    const method = (Math.abs(finalValue) < 1 && finalValue !== 0) ? 'percent' : 'add';
                    
                    modifierManager.addModifier({
                        side: 'player', 
                        unitType: effect.target, 
                        stat: effect.key,
                        value: finalValue, 
                        type: effect.method || method,
                        source: 'talent', 
                        id: `talent_${nodeId}_${effect.key}`
                    });
                }
            });
        }

        // 核心修复：应用奇穴效果后，立即刷新英雄的全局二次属性 (如 Power -> HP/ATK 的转化)
        if (this.heroData) {
            import('./WorldManager.js').then(m => {
                m.worldManager.refreshHeroStats();
            });
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('talents-updated'));
        }
    }

    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            activeTalents: { ...this.activeTalents }
        };
    }

    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        if (!data) return;
        
        this.activeTalents = { ...data.activeTalents };
        
        // 核心修复：加载存档时，如果 heroData 已就绪，必须同步更新天赋树，防止跨角色加载 Bug
        if (this.heroData) {
            this.heroData.talents = this.activeTalents;
            this.currentTree = getHeroTalentTree(this.heroData.id);
            this.applyAllTalentEffects();
        }
        
        console.log("%c[系统] TalentManager 数据恢复完毕", "color: #4CAF50; font-weight: bold");
    }
}

export const talentManager = new TalentManager();
// 暴露给全局以解决循环依赖问题 (仅在浏览器环境下执行)
if (typeof window !== 'undefined') {
    window.talentManager = talentManager;
}

