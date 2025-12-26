import { spriteFactory } from './SpriteFactory.js';
import { SkillRegistry } from './SkillRegistry.js';

/**
 * UIManager: 统一管理全局 UI 逻辑（如 Tooltip、面板切换等）
 * 确保大世界和战斗界面的 UI 表现一致
 */
class UIManager {
    constructor() {
        this.tooltip = document.getElementById('game-tooltip');
        this.tooltipTitle = this.tooltip?.querySelector('.tooltip-title');
        this.tooltipLevel = this.tooltip?.querySelector('.tooltip-level');
        this.tooltipEffect = this.tooltip?.querySelector('.tooltip-effect');
        this.tooltipDesc = this.tooltip?.querySelector('.tooltip-desc');

        this.initTooltipEvents();
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
            } else if (typeof data.level === 'number' && data.maxLevel !== undefined) {
                // 建筑等级模式
                this.tooltipLevel.innerText = `当前等级: ${data.level} / ${data.maxLevel}`;
            } else if (data.status) {
                // 状态模式
                this.tooltipLevel.innerText = data.status;
            } else {
                // 通用文字模式
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

