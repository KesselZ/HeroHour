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
        this.tooltip = document.getElementById('game-tooltip');
        this.tooltipTitle = this.tooltip?.querySelector('.tooltip-title');
        this.tooltipLevel = this.tooltip?.querySelector('.tooltip-level');
        this.tooltipEffect = this.tooltip?.querySelector('.tooltip-effect');
        this.tooltipDesc = this.tooltip?.querySelector('.tooltip-desc');

        // 设备识别
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 1024 && window.innerHeight <= 600);
        if (this.isMobile) {
            document.body.classList.add('is-mobile');
        }

        this.initTooltipEvents();
        // this.initGameStartEvents(); // 已迁移至 React
        this.initBattleEscapeEvents();
        this.initBuildingDraftEvents();
        
        // 性能监控面板 (仅开发模式)
        if (import.meta.env.DEV) {
            this.initPerfPanel();
        }
        
        this.gameStartWindowShown = false; // 记录开局窗口是否已显示
    }

    /**
     * 初始化性能监控面板
     */
    initPerfPanel() {
        this.perfPanel = document.createElement('div');
        this.perfPanel.id = 'perf-panel';
        this.perfPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            padding: 10px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            border-radius: 4px;
            z-index: 9999;
            pointer-events: none;
            line-height: 1.4;
            min-width: 200px;
            border: 1px solid rgba(0, 255, 0, 0.3);
        `;
        document.body.appendChild(this.perfPanel);
    }

    /**
     * 更新性能监控数据
     */
    updatePerfPanel(data) {
        if (!this.perfPanel) return;
        
        let html = `<div style="font-weight: bold; border-bottom: 1px solid #00ff00; margin-bottom: 5px;">PERFORMANCE MONITOR</div>`;
        
        // 1. 基础运行指标
        html += `FPS: ${data.fps || 0}<br>`;
        html += `DrawCalls: ${data.drawCalls || 0}<br>`;
        html += `Triangles: ${data.triangles || 0}<br>`;
        
        // 2. 战斗逻辑拆解 (如果是战斗中)
        if (data.totalFrameTime !== undefined) {
            const isWarning = data.totalFrameTime > 16.6;
            const color = isWarning ? '#ff4444' : '#00ff00';
            html += `<div style="margin-top: 5px; color: ${color}">FrameTime: ${data.totalFrameTime.toFixed(2)}ms</div>`;
            html += `&nbsp;&nbsp;SpatialHash: ${data.spatialHashBuildTime?.toFixed(2)}ms<br>`;
            html += `&nbsp;&nbsp;UnitLogic: ${data.unitUpdateTime?.toFixed(2)}ms<br>`;
            if (data.subTimings) {
                html += `&nbsp;&nbsp;&nbsp;&nbsp;* Physics: ${data.subTimings.physics.toFixed(2)}ms<br>`;
                html += `&nbsp;&nbsp;&nbsp;&nbsp;* AI/Target: ${data.subTimings.ai.toFixed(2)}ms<br>`;
                html += `&nbsp;&nbsp;&nbsp;&nbsp;* Visual: ${data.subTimings.visual.toFixed(2)}ms<br>`;
            }
            html += `CollisionChecks: ${data.collisionChecks || 0}<br>`;
        }
        
        // 3. 单位统计
        if (data.totalUnits !== undefined) {
            html += `<div style="margin-top: 5px;">Units: ${data.totalUnits} (P:${data.playerUnits} E:${data.enemyUnits})</div>`;
        }

        this.perfPanel.innerHTML = html;
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
        // 创建动作提示框 (Action Hint)
        this.actionHint = document.createElement('div');
        this.actionHint.id = 'action-hint';
        this.actionHint.className = 'pixel-font hidden';
        document.body.appendChild(this.actionHint);

        // 记录当前活跃的 Tooltip 触发源
        this.activeTooltipSource = null;

        window.addEventListener('mousemove', (e) => {
            if (this.tooltip && !this.tooltip.classList.contains('hidden')) {
                this.updateTooltipPosition(e.clientX, e.clientY);
            }

            // 更新 Action Hint 位置 (始终跟随鼠标，贴合右下方)
            if (this.actionHint && !this.actionHint.classList.contains('hidden')) {
                this.actionHint.style.left = `${e.clientX + 10}px`;
                this.actionHint.style.top = `${e.clientY + 10}px`;
            }
        });

        // 全局点击/触摸隐藏逻辑：点击非 Tooltip 且非触发源的地方时隐藏
        const hideHandler = (e) => {
            if (!this.tooltip || this.tooltip.classList.contains('hidden')) return;
            
            // 如果点击的是 Tooltip 本身，或者点击的是当前的触发源，则不隐藏
            if (this.tooltip.contains(e.target) || (this.activeTooltipSource && this.activeTooltipSource.contains(e.target))) {
                return;
            }
            
            this.hideTooltip();
        };

        window.addEventListener('mousedown', hideHandler);
        window.addEventListener('touchstart', hideHandler, { passive: true });
    }

    /**
     * 更新 Tooltip 位置
     */
    updateTooltipPosition(clientX, clientY) {
        if (!this.tooltip || this.isMobile) return;
        const x = clientX + 15;
        const y = clientY + 15;
        const tooltipWidth = this.tooltip.offsetWidth;
        const tooltipHeight = this.tooltip.offsetHeight;
        
        const finalX = (x + tooltipWidth > window.innerWidth) ? (clientX - tooltipWidth - 15) : x;
        const finalY = (y + tooltipHeight > window.innerHeight) ? (clientY - tooltipHeight - 15) : y;
        
        this.tooltip.style.left = `${finalX}px`;
        this.tooltip.style.top = `${finalY}px`;
    }

    /**
     * 优雅的 Tooltip 绑定器：自动处理 PC 悬浮与手机长按
     * @param {HTMLElement} element 目标 DOM 元素
     * @param {Function|Object} dataGetter 返回提示数据的函数或直接的数据对象
     */
    bindTooltip(element, dataGetter) {
        if (!element) return;

        let longPressTimer = null;
        let isLongPressActive = false;
        let startPos = { x: 0, y: 0 };

        const getData = () => (typeof dataGetter === 'function' ? dataGetter() : dataGetter);

        // --- PC 端：悬浮逻辑 ---
        element.onmouseenter = (e) => {
            if (window.matchMedia("(pointer: coarse)").matches) return; // 触摸屏跳过悬浮
            const data = getData();
            if (data) {
                this.activeTooltipSource = element;
                this.showTooltip(data);
                this.updateTooltipPosition(e.clientX, e.clientY);
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
            isLongPressActive = false;

            // 启动 500ms 长按计时
            longPressTimer = setTimeout(() => {
                const data = getData();
                if (data) {
                    isLongPressActive = true;
                    this.activeTooltipSource = element;
                    this.showTooltip(data);
                    // 手机端显示在手指上方一点
                    this.updateTooltipPosition(touch.clientX, touch.clientY - 40);
                    // 触发震动反馈（如果支持）
                    if (navigator.vibrate) navigator.vibrate(20);
                }
            }, 500);
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            const dist = Math.sqrt(Math.pow(touch.clientX - startPos.x, 2) + Math.pow(touch.clientY - startPos.y, 2));
            
            // 如果手指移动超过 10 像素，取消长按计时
            if (dist > 10) {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            }
        }, { passive: true });

        element.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            // 注意：长按触发后不立即消失，点击其他地方才消失
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
        // 统一调用 WorldManager 的通知系统
        worldManager.showNotification(text);
    }


    /**
     * 显示全局通用 Tooltip
     * @param {Object} data 提示框数据
     */
    showTooltip(data) {
        if (!this.tooltip || !this.tooltipTitle || !this.tooltipDesc) return;

        // 核心记录：如果是技能提示，记录 ID 以便 update 中实时刷新
        if (data.type === 'skill' && data.skillId) {
            this.lastSkillTooltip = { skillId: data.skillId, heroData: data.heroData };
        }

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
                this.tooltipLevel.innerHTML = data.status;
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
        this.lastSkillTooltip = null; // 清除记录
    }

    /**
     * 实时更新：如果当前正显示技能提示，则刷新其数值（实现所见即所得）
     */
    update() {
        if (this.lastSkillTooltip && !this.tooltip.classList.contains('hidden')) {
            const { skillId, heroData } = this.lastSkillTooltip;
            this.showSkillTooltip(skillId, heroData);
        }
    }

    /**
     * 便捷方法：显示技能提示
     * @param {string} skillId 
     * @param {Object} heroData 
     */
    showSkillTooltip(skillId, heroData) {
        const skill = SkillRegistry[skillId];
        if (!skill) return;

        // 记录当前正在查看的技能，用于实时刷新
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
        });
    }
}

export const uiManager = new UIManager();
window.uiManager = uiManager;

