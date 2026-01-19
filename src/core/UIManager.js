import { spriteFactory } from '../engine/SpriteFactory.js';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { SkillRegistry, SectSkills } from '../data/SkillRegistry.js';
import { worldManager } from './WorldManager.js';
import { modifierManager } from '../systems/ModifierManager.js';
import { TALENT_UNITS, TALENT_GROUPS, HERO_TREE_CONFIG, getHeroTalentTree } from '../data/TalentRegistry.js';
import { talentManager } from '../systems/TalentManager.js';
import { timeManager } from '../systems/TimeManager.js';
import { SECT_INTRO } from '../data/HowToPlayContent.js';
import { audioManager } from '../engine/AudioManager.js';

/**
 * UIManager: 统一管理全局 UI 逻辑（如 Tooltip、面板切换等）
 */
class UIManager {
    constructor() {
        // 设备识别
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 1024 && window.innerHeight <= 600);
        if (this.isMobile) {
            document.body.classList.add('is-mobile');
        }

        this.initTooltipEvents();
        this.initBattleEscapeEvents();
        this.initBuildingDraftEvents();
        
        this.gameStartWindowShown = false;
    }

    /**
     * 更新性能监控数据 (已迁移至 React)
     */
    updatePerfPanel(data) {
        useUIStore.getState().updatePerfData(data);
    }

    /**
     * 设置大世界 HUD 的可见性 (主要用于手机端打开面板时隐藏背景干扰)
     */
    setHUDVisibility(visible) {
        const worldUI = document.getElementById('world-ui');
        const minimap = document.querySelector('.minimap-container');
        if (worldUI) {
            if (visible) worldUI.classList.remove('hidden');
            else worldUI.classList.add('hidden');
        }
        if (minimap) {
            if (visible) minimap.classList.remove('hidden');
            else minimap.classList.add('hidden');
        }
    }

    /**
     * 切换神行千里面板 (兼容 React)
     */
    toggleTeleportPanel(show) {
        if (show) {
            useUIStore.getState().openPanel('teleport');
        } else {
            useUIStore.getState().closePanel();
        }
    }

    initBattleEscapeEvents() {
        window.addEventListener('show-escape-confirm', () => {
            useUIStore.getState().openPanel('escapeConfirm');
        });
    }

    /**
     * 初始化建筑抽卡事件监听
     */
    initBuildingDraftEvents() {
        window.addEventListener('show-building-draft', (e) => {
            this.showBuildingDraft(e.detail.options);
        });
    }

    /**
     * 显示季度建筑选择界面 (已迁移至 React)
     * @param {Array} options 建筑选项列表
     */
    showBuildingDraft(options) {
        // 核心音效逻辑
        const hasLegendary = options.some(opt => opt.rarity === 'legendary');
        const hasEpic = options.some(opt => opt.rarity === 'epic');
        
        if (hasLegendary) {
            audioManager.play('ui_card_draft_legendary');
        } else if (hasEpic) {
            audioManager.play('ui_card_draft_epic');
        } else {
            audioManager.play('ui_card_draft');
        }

        // 同步数据到 Store
        useGameStore.getState().setDraftOptions(options);
        
        // 打开 React 面板
        useUIStore.getState().openPanel('buildingDraft');
    }

    /**
     * 显示开局提示窗口 (已迁移至 React)
     * @param {Array} enemies 对手信息列表
     */
    showGameStartWindow(enemies) {
        if (this.gameStartWindowShown) return;

        // 同步数据到 Store
        useGameStore.getState().setStartEnemies(enemies);
        
        // 打开 React 面板
        useUIStore.getState().openPanel('gameStart');
    }

    initTooltipEvents() {
        // 创建动作提示框 (Action Hint) - 待下次迁移
        this.actionHint = document.createElement('div');
        this.actionHint.id = 'action-hint';
        this.actionHint.className = 'pixel-font hidden';
        document.body.appendChild(this.actionHint);

        // 记录当前活跃的 Tooltip 触发源
        this.activeTooltipSource = null;
        
        // 记录最后一次鼠标位置，用于 showTooltip 时缺省坐标
        this.mouseX = 0;
        this.mouseY = 0;

        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;

            // 更新 Action Hint 位置 (始终跟随鼠标，贴合右下方)
            if (this.actionHint && !this.actionHint.classList.contains('hidden')) {
                this.actionHint.style.left = `${e.clientX + 10}px`;
                this.actionHint.style.top = `${e.clientY + 10}px`;
            }

            // 如果 Tooltip 正在显示，同步更新位置 (React 会处理平滑移动)
            const { visible, data } = useUIStore.getState().tooltip;
            if (visible) {
                useUIStore.getState().showTooltip(data, e.clientX, e.clientY);
            }
        });

        // 全局点击/触摸隐藏逻辑
        const hideHandler = (e) => {
            const tooltipVisible = useUIStore.getState().tooltip.visible;
            if (!tooltipVisible) return;
            
            // 如果点击的是当前的触发源，则不隐藏 (由触发源自己的 logic 处理)
            if (this.activeTooltipSource && this.activeTooltipSource.contains(e.target)) {
                return;
            }
            
            this.hideTooltip();
        };

        window.addEventListener('mousedown', hideHandler);
        window.addEventListener('touchstart', hideHandler, { passive: true });
    }

    /**
     * 更新 Tooltip 位置 (现在仅作为 React Store 的中转)
     */
    updateTooltipPosition(clientX, clientY) {
        // React Tooltip 内部会自动处理位置，但我们需要把最新的鼠标坐标传给 Store
        const { visible, data } = useUIStore.getState().tooltip;
        if (visible) {
            useUIStore.getState().showTooltip(data, clientX, clientY);
        }
    }

    /**
     * 优雅的 Tooltip 绑定器：自动处理 PC 悬浮与手机长按
     */
    bindTooltip(element, dataGetter) {
        if (!element) return;

        let longPressTimer = null;
        let startPos = { x: 0, y: 0 };

        const getData = () => (typeof dataGetter === 'function' ? dataGetter() : dataGetter);

        // --- PC 端：悬浮逻辑 ---
        element.onmouseenter = (e) => {
            if (window.matchMedia("(pointer: coarse)").matches) return;
            const data = getData();
            if (data) {
                this.activeTooltipSource = element;
                this.showTooltip(data, e.clientX, e.clientY);
            }
        };

        element.onmouseleave = () => {
            if (this.activeTooltipSource === element) {
                this.hideTooltip();
            }
        };

        // --- 手机端：长按逻辑 ---
        element.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startPos = { x: touch.clientX, y: touch.clientY };

            longPressTimer = setTimeout(() => {
                const data = getData();
                if (data) {
                    this.activeTooltipSource = element;
                    // 手机端显示在手指上方一点
                    this.showTooltip(data, touch.clientX, touch.clientY - 40);
                    if (navigator.vibrate) navigator.vibrate(20);
                }
            }, 500);
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const dist = Math.sqrt(Math.pow(touch.clientX - startPos.x, 2) + Math.pow(touch.clientY - startPos.y, 2));
            if (dist > 10 && longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
            }
        }, { passive: true });

        element.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
    }

    showActionHint(text) {
        if (!this.actionHint) return;
        this.actionHint.innerText = text;
        this.actionHint.classList.remove('hidden');
    }

    hideActionHint() {
        if (this.actionHint) this.actionHint.classList.add('hidden');
    }

    /**
     * 显示全局通知
     */
    showNotification(text) {
        worldManager.showNotification(text);
    }

    /**
     * 显示全局通用 Tooltip (通过 React Store)
     * @param {Object} data 提示框数据
     * @param {number} x 
     * @param {number} y
     */
    showTooltip(data, x, y) {
        if (data.type === 'skill' && data.skillId) {
            this.lastSkillTooltip = { skillId: data.skillId, heroData: data.heroData };
        }

        // 如果没有提供坐标，使用最近一次记录的鼠标位置
        const finalX = x !== undefined ? x : this.mouseX;
        const finalY = y !== undefined ? y : this.mouseY;
        
        useUIStore.getState().showTooltip(data, finalX, finalY);
    }

    /**
     * 隐藏 Tooltip
     */
    hideTooltip() {
        useUIStore.getState().hideTooltip();
        this.lastSkillTooltip = null;
    }

    /**
     * 实时更新：如果当前正显示技能提示，则刷新其数值
     */
    update() {
        if (this.lastSkillTooltip) {
            const tooltip = useUIStore.getState().tooltip;
            if (tooltip.visible) {
            const { skillId, heroData } = this.lastSkillTooltip;
                this.showSkillTooltip(skillId, heroData, tooltip.x, tooltip.y);
            }
        }
    }

    /**
     * 便捷方法：显示技能提示
     */
    showSkillTooltip(skillId, heroData, x, y) {
        const skill = SkillRegistry[skillId];
        if (!skill) return;

        this.lastSkillTooltip = { skillId, heroData };
        const actualCD = (skill.getActualCooldown(heroData) / 1000).toFixed(1);
        const actualCost = skill.getActualManaCost(heroData);

        this.showTooltip({
            name: skill.name,
            level: skill.level,
            mpCost: `消耗: ${actualCost} 内力`,
            cdText: `冷却: ${actualCD}s`,
            description: skill.getDescription(heroData),
            type: 'skill',
            skillId,
            heroData
        }, x, y);
    }
}

export const uiManager = new UIManager();
window.uiManager = uiManager;

