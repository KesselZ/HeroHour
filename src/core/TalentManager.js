import { TALENT_UNITS, HERO_TREE_CONFIG, getHeroTalentTree } from './TalentRegistry.js';
import { modifierManager } from './ModifierManager.js';

/**
 * TalentManager: 奇穴系统逻辑管理器
 * 处理点数分配、前置检查及加成应用
 */
class TalentManager {
    constructor() {
        this.activeTalents = {};
        this.heroData = null;
        this.currentTree = null; // 缓存当前英雄生成的树
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

        if (node.requires && node.requires.length > 0) {
            for (const reqId of node.requires) {
                const reqLevel = this.activeTalents[reqId] || 0;
                const reqNode = this.currentTree.nodes[reqId];
                if (reqLevel < (reqNode ? reqNode.maxLevel : 1)) {
                    return { canUpgrade: false, reason: `需先修满前置奇穴：${reqNode ? reqNode.name : reqId}` };
                }
            }
        }

        return { canUpgrade: true };
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

                if (effect.type === 'stat') {
                    modifierManager.addModifier({
                        side: 'player', type: 'hero', stat: effect.stat,
                        value: finalValue, source: 'talent', id: `talent_${nodeId}_${effect.stat}`
                    });
                } else if (effect.type === 'modifier') {
                    modifierManager.addModifier({
                        side: 'player', type: effect.target, stat: effect.key,
                        value: finalValue, source: 'talent', id: `talent_${nodeId}_${effect.key}`
                    });
                }
            });
        }

        window.dispatchEvent(new CustomEvent('talents-updated'));
    }
}

export const talentManager = new TalentManager();

