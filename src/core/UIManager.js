import { spriteFactory } from './SpriteFactory.js';
import { SkillRegistry, SectSkills } from './SkillRegistry.js';
import { worldManager } from './WorldManager.js';
import { SECT_INTRO } from '../data/HowToPlayContent.js';
import { audioManager } from './AudioManager.js';

/**
 * UIManager: 统一管理全局 UI 逻辑（如 Tooltip、面板切换等）
 */
class UIManager {
    constructor() {
        this.tooltip = document.getElementById('game-tooltip');
        this.tooltipTitle = this.tooltip?.querySelector('.tooltip-title');
        this.tooltipLevel = this.tooltip?.querySelector('.tooltip-level');
        this.tooltipEffect = this.tooltip?.querySelector('.tooltip-effect');
        this.tooltipDesc = this.tooltip?.querySelector('.tooltip-desc');

        this.initTooltipEvents();
        this.initSkillGalleryEvents();
    }

    initTooltipEvents() {
        window.addEventListener('mousemove', (e) => {
            if (this.tooltip && !this.tooltip.classList.contains('hidden')) {
                const x = e.clientX + 15;
                const y = e.clientY + 15;
                const tooltipWidth = this.tooltip.offsetWidth;
                const tooltipHeight = this.tooltip.offsetHeight;
                
                const finalX = (x + tooltipWidth > window.innerWidth) ? (e.clientX - tooltipWidth - 15) : x;
                const finalY = (y + tooltipHeight > window.innerHeight) ? (e.clientY - tooltipHeight - 15) : y;
                
                this.tooltip.style.left = `${finalX}px`;
                this.tooltip.style.top = `${finalY}px`;
            }
        });
    }

    /**
     * 初始化招式图谱面板的交互事件（关闭按钮、标签切换）
     */
    initSkillGalleryEvents() {
        const closeSkillLearnBtn = document.getElementById('close-skill-learn');
        const skillLearnPanel = document.getElementById('skill-learn-panel');
        if (closeSkillLearnBtn && skillLearnPanel) {
            closeSkillLearnBtn.onclick = () => {
                audioManager.play('ui_click');
                skillLearnPanel.classList.add('hidden');
            };
        }

        // 标签切换
        const tabs = document.querySelectorAll('.skill-learn-tabs .tab-btn');
        tabs.forEach(tab => {
            tab.onclick = () => {
                audioManager.play('ui_click');
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const sect = tab.dataset.sect;
                this.renderLearnableSkills(sect);
            };
        });
    }

    /**
     * 渲染可学习/图谱技能
     * @param {string} sect 门派
     * @param {Object} heroData 当前英雄数据（可选，用于判断是否已习得）
     */
    renderLearnableSkills(sect) {
        const container = document.getElementById('skill-list-to-learn');
        if (!container) return;

        container.innerHTML = '';

        // 1. 注入门派介绍（简化版一段话）
        const introText = SECT_INTRO[sect];
        if (introText) {
            const introCard = document.createElement('div');
            introCard.className = 'sect-intro-card';
            introCard.innerHTML = `
                <div class="sect-intro-desc">${introText}</div>
            `;
            container.appendChild(introCard);
        }

        const skillIds = SectSkills[sect] || [];
        
        // 招式图谱作为展示工具，不再受当前英雄属性影响，显示原始属性
        const baseStats = { haste: 0 }; 

        skillIds.forEach(id => {
            const skill = SkillRegistry[id];
            if (!skill) return;

            const item = document.createElement('div');
            item.className = 'learn-item';

            const iconStyle = spriteFactory.getIconStyle(skill.icon);
            item.innerHTML = `
                <div class="skill-learn-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                <div class="skill-learn-name">${skill.name}</div>
            `;

            item.onmouseenter = () => {
                // 强制使用原始数值（不计入调息/缩减）
                const actualCost = skill.cost;
                const actualCD = (skill.cooldown / 1000).toFixed(1);
                
                this.showTooltip({
                    name: skill.name,
                    level: skill.level,
                    mpCost: `消耗: ${actualCost} 内力`,
                    cdText: `冷却: ${actualCD}s`,
                    description: skill.getDescription({ stats: baseStats })
                });
            };
            item.onmouseleave = () => this.hideTooltip();

            container.appendChild(item);
        });
    }

    /**
     * 显示全局通用 Tooltip
     * @param {Object} data 提示框数据
     */
    showTooltip(data) {
        if (!this.tooltip || !this.tooltipTitle || !this.tooltipDesc) return;

        // 1. 处理标题（支持技能等级标签）
        if (data.level && (data.level === '初级' || data.level === '高级' || data.level === '绝技')) {
            this.tooltipTitle.innerHTML = `
                <span>${data.name}</span>
                <span class="skill-level-tag level-${data.level}">${data.level}</span>
            `;
        } else {
            this.tooltipTitle.innerText = data.name;
        }

        // 2. 处理副标题（消耗、冷却、等级、状态等）
        if (data.mpCost || data.level !== undefined || data.cdText || data.status) {
            if (data.mpCost || data.cdText) {
                // 技能模式
                this.tooltipLevel.innerHTML = `
                    <span>${data.mpCost || ''}</span>
                    <span>${data.cdText || ''}</span>
                `;
            } else if (typeof data.level === 'number' && data.maxLevel !== undefined && typeof data.maxLevel === 'number') {
                // 建筑等级模式 (数字型)
                this.tooltipLevel.innerText = `当前等级: ${data.level} / ${data.maxLevel}`;
            } else if (data.status) {
                // 状态模式
                this.tooltipLevel.innerText = data.status;
            } else if (data.level && data.maxLevel) {
                // 通用双行模式 (例如：预计难度: 简单)
                this.tooltipLevel.innerText = `${data.level}: ${data.maxLevel}`;
            } else {
                // 通用单文字模式
                this.tooltipLevel.innerText = data.level || '';
            }

            this.tooltipLevel.style.color = data.color || '#ffffff';
            this.tooltipLevel.classList.remove('hidden');
        } else {
            this.tooltipLevel.classList.add('hidden');
        }

        // 3. 处理描述正文
        if (data.description) {
            this.tooltipEffect.classList.add('hidden'); // 确保显眼的特效行被隐藏
            this.tooltipDesc.innerHTML = data.description;
            this.tooltipDesc.classList.remove('hidden');
        } else {
            this.tooltipDesc.classList.add('hidden');
        }

        this.tooltip.classList.remove('hidden');
    }

    /**
     * 隐藏 Tooltip
     */
    hideTooltip() {
        if (this.tooltip) this.tooltip.classList.add('hidden');
    }

    /**
     * 便捷方法：显示技能提示
     * @param {string} skillId 
     * @param {Object} heroData 
     */
    showSkillTooltip(skillId, heroData) {
        const skill = SkillRegistry[skillId];
        if (!skill) return;

        const haste = heroData.stats.haste || 0;
        const actualCD = (skill.cooldown * (1 - haste) / 1000).toFixed(1);
        const actualCost = Math.floor(skill.cost * (1 - haste));

        this.showTooltip({
            name: skill.name,
            level: skill.level,
            mpCost: `消耗: ${actualCost} 内力`,
            cdText: `冷却: ${actualCD}s`,
            description: skill.getDescription(heroData),
            type: 'skill'
        });
    }
}

export const uiManager = new UIManager();

