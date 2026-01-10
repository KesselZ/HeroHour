import { spriteFactory } from '../engine/SpriteFactory.js';
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
        this.initSkillGalleryEvents();
        this.initTalentEvents();
        this.initGameStartEvents();
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

    initBattleEscapeEvents() {
        const escapeBtn = document.getElementById('battle-escape-btn');
        const modal = document.getElementById('escape-confirm-modal');
        const confirmBtn = document.getElementById('confirm-escape-btn');
        const cancelBtn = document.getElementById('cancel-escape-btn');

        if (escapeBtn && modal && confirmBtn && cancelBtn) {
            escapeBtn.onclick = () => {
                audioManager.play('ui_click');
                modal.classList.remove('hidden');
            };

            cancelBtn.onclick = () => {
                audioManager.play('ui_click');
                modal.classList.add('hidden');
            };

            confirmBtn.onclick = () => {
                audioManager.play('ui_click');
                modal.classList.add('hidden');
                escapeBtn.classList.add('hidden');
                
                // 执行逃跑逻辑
                if (window.battle && window.battle.isActive) {
                    // 调用战斗场景的逃跑序列
                    window.battle.startFleeing();
                }
            };
        }
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
     * 显示季度建筑选择界面 (Hearthstone Style)
     * @param {Array} options 建筑选项列表
     */
    showBuildingDraft(options) {
        const overlay = document.getElementById('building-draft-overlay');
        const container = document.getElementById('building-draft-cards');
        if (!overlay || !container) return;

        // 核心音效逻辑：如果有传说/绝世建筑，播放相应音效，否则播放普通出现音效
        const hasLegendary = options.some(opt => opt.rarity === 'legendary');
        const hasEpic = options.some(opt => opt.rarity === 'epic');
        
        if (hasLegendary) {
            audioManager.play('ui_card_draft_legendary');
        } else if (hasEpic) {
            audioManager.play('ui_card_draft_epic');
        } else {
            audioManager.play('ui_card_draft');
        }

        container.innerHTML = '';
        options.forEach((option, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'hs-card-wrapper';
            
            const card = document.createElement('div');
            card.className = `hs-card rarity-${option.rarity || 'common'}`;
            
            const iconStyle = spriteFactory.getIconStyle(option.icon);
            const rarityLabels = {
                'legendary': '绝世',
                'epic': '传说',
                'rare': '稀有',
                'common': '基础'
            };
            const rarityLabel = rarityLabels[option.rarity] || '基础';

            card.innerHTML = `
                <div class="hs-card-icon-frame">
                    <div class="hs-card-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                </div>
                <div class="hs-card-name">${option.name}</div>
                <div class="hs-card-rarity">${rarityLabel}</div>
                <div class="hs-card-desc">${option.description}</div>
            `;

            card.onclick = () => {
                audioManager.play('ui_card_select'); // 1. 选中时播放卡牌声音
                
                // 2. 获取所有卡牌
                const allCards = container.querySelectorAll('.hs-card');
                
                // 3. 应用选中/未选中动画类
                allCards.forEach(c => {
                    if (c === card) {
                        c.classList.add('is-selected');
                    } else {
                        c.classList.add('is-not-selected');
                    }
                });

                // 4. 0.5 秒后触发洗牌音效
                setTimeout(() => {
                    audioManager.play('ui_card_shuffle');
                }, 500);

                // 5. 延迟执行后端解锁逻辑和 UI 关闭
                setTimeout(() => {
                    if (worldManager.buildingManager.selectDraftOption(option.id)) {
                        overlay.classList.add('hidden');
                        worldManager.showNotification(`已确立发展目标：${option.name}`);
                    }
                }, 600); // 匹配 cardSelectBurst 动画时长
            };

            // --- 悬停音效与高级动态 3D 倾斜 ---
            card.onmouseenter = () => {
                audioManager.play('ui_card_hover'); // 1. 悬停时播放轻微click声
            };

            card.onmousemove = (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                // 1. 计算旋转角度 (增加最大角度至 25 度)
                const rotateX = ((y - centerY) / centerY) * -25; 
                const rotateY = ((x - centerX) / centerX) * 25;
                
                // 2. 计算光影位置 (Glare position)
                // 光影应该在鼠标的反方向移动，产生反光效果
                const glareX = (x / rect.width) * 100;
                const glareY = (y / rect.height) * 100;
                
                // 应用动态变换
                card.style.transform = `translateY(-40px) scale(1.15) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                
                // 找到或创建光影层
                let glare = card.querySelector('.hs-glare');
                if (!glare) {
                    glare = document.createElement('div');
                    glare.className = 'hs-glare';
                    card.appendChild(glare);
                }
                glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.3) 0%, transparent 60%)`;
            };

            card.onmouseleave = () => {
                card.style.transform = ''; 
                const glare = card.querySelector('.hs-glare');
                if (glare) glare.style.background = 'transparent';
            };

            wrapper.appendChild(card);
            container.appendChild(wrapper);
        });

        overlay.classList.remove('hidden');
    }

    initGameStartEvents() {
        const closeBtn = document.getElementById('close-game-start-btn');
        const window = document.getElementById('game-start-window');
        if (closeBtn && window) {
            closeBtn.onclick = () => {
                audioManager.play('ui_click');
                window.classList.add('hidden');
                this.gameStartWindowShown = true; // 标记为已显示
            };
        }
    }

    /**
     * 显示开局提示窗口
     * @param {Array} enemies 对手信息列表
     */
    showGameStartWindow(enemies) {
        if (this.gameStartWindowShown) return; // 如果已经显示过，则不再重复显示

        // --- 互斥逻辑：显示江湖告示时，关闭其他面板 ---
        const panelsToHide = ['hero-stats-panel', 'town-management-panel', 'skill-learn-panel', 'how-to-play-panel'];
        panelsToHide.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.classList.add('hidden');
        });

        const window = document.getElementById('game-start-window');
        const container = document.getElementById('game-start-enemies');
        if (!window || !container) return;

        container.innerHTML = '';
        enemies.forEach(enemy => {
            const card = document.createElement('div');
            card.className = 'enemy-item-card';
            
            const iconStyle = spriteFactory.getIconStyle(enemy.id);
            card.innerHTML = `
                <div class="enemy-portrait-start" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                <div class="enemy-name-start">${enemy.name}</div>
                <div class="enemy-title-start">${enemy.title}</div>
            `;
            container.appendChild(card);
        });

        window.classList.remove('hidden');
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
     * 初始化招式图谱面板的交互事件（关闭按钮、标签切换）
     */
    initSkillGalleryEvents() {
        const closeSkillLearnBtn = document.getElementById('close-skill-learn');
        const skillLearnPanel = document.getElementById('skill-learn-panel');
        if (closeSkillLearnBtn && skillLearnPanel) {
            closeSkillLearnBtn.onclick = () => {
                if (window.closePanelWithHUD) {
                    window.closePanelWithHUD('skill-learn-panel');
                } else {
                    // --- 手机端适配：关闭面板时恢复 HUD ---
                    if (this.isMobile) this.setHUDVisibility(true);
                    audioManager.play('ui_click');
                    skillLearnPanel.classList.add('hidden');
                }
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
     * 初始化奇穴系统交互事件
     */
    initTalentEvents() {
        const openTalentBtn = document.getElementById('open-talent-btn');
        const closeTalentBtn = document.getElementById('close-talent-panel');
        const talentPanel = document.getElementById('talent-panel');
        const uiLayer = document.getElementById('ui-layer');
        const gameCanvas = document.getElementById('game-canvas');

        // 监听英雄数据初始化/更新事件，提前进行皮肤设置和图谱渲染
        window.addEventListener('hero-initialized', () => {
            this.prepareTalentPanel();
        });

        // 拖拽状态变量
        this.talentDrag = {
            isDragging: false,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0,
            currentX: 0,
            currentY: 0,
            scale: 1.0 // 新增：缩放倍率
        };

        if (openTalentBtn) {
            openTalentBtn.onclick = () => {
                this.toggleTalentPanel(true);
            };
        }

        if (closeTalentBtn) {
            closeTalentBtn.onclick = () => {
                this.toggleTalentPanel(false);
            };
        }

        // --- 拖拽交互监听 ---
        if (talentPanel) {
            talentPanel.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 仅左键
            this.talentDrag.isDragging = true;
            this.talentDrag.startX = e.clientX - this.talentDrag.offsetX;
            this.talentDrag.startY = e.clientY - this.talentDrag.offsetY;
            talentPanel.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.talentDrag.isDragging) return;
            
            this.talentDrag.offsetX = e.clientX - this.talentDrag.startX;
            this.talentDrag.offsetY = e.clientY - this.talentDrag.startY;
            
            this.updateTalentView();
        });

        window.addEventListener('mouseup', () => {
            if (this.talentDrag.isDragging) {
                this.talentDrag.isDragging = false;
                talentPanel.style.cursor = 'default';
                
                // 松手后检查是否需要回弹 (平滑回到阈值内)
                this.elasticSnapBack();
            }
        });

        // --- 滚轮缩放监听 ---
        talentPanel.addEventListener('wheel', (e) => {
            e.preventDefault();
            // 减小缩放步长，让缩放更平滑
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            const newScale = Math.max(0.4, Math.min(1.8, this.talentDrag.scale + delta));
            
            if (newScale !== this.talentDrag.scale) {
                this.talentDrag.scale = newScale;
                this.updateTalentView();
            }
        }, { passive: false });
        }
    }

    /**
     * 切换奇穴面板显示状态
     * @param {boolean} show 是否显示
     */
    toggleTalentPanel(show) {
        const talentPanel = document.getElementById('talent-panel');
        const uiLayer = document.getElementById('ui-layer');
        const gameCanvas = document.getElementById('game-canvas');

        if (!talentPanel || !uiLayer || !gameCanvas) return;

        audioManager.play('ui_click');

        if (show) {
            // --- 手机端适配：打开面板时隐藏 HUD ---
            if (this.isMobile) this.setHUDVisibility(false);

            // --- 互斥逻辑：打开奇穴面板时，关闭其他所有 UI 面板 ---
            const panelsToHide = ['hero-stats-panel', 'town-management-panel', 'skill-learn-panel', 'how-to-play-panel', 'game-start-window'];
            panelsToHide.forEach(id => {
                const p = document.getElementById(id);
                if (p) p.classList.add('hidden');
            });

            // 1. 触发【全画面】扭曲缩小效果
            uiLayer.classList.add('ui-layer-distort-out');
            gameCanvas.classList.add('ui-layer-distort-out');

            // 2. 使用统一接口暂停游戏逻辑与时间
            if (window.setGamePaused) window.setGamePaused(true);
            
            // 3. 立即显示天赋面板
            talentPanel.classList.remove('hidden');
            talentPanel.classList.add('distort-enter');
            
            // 记录进入动画开始，稍后彻底隐藏底层 (匹配 0.2s 的退出时长)
            setTimeout(() => {
                uiLayer.style.visibility = 'hidden';
                gameCanvas.style.visibility = 'hidden';
                
                // 重置点数显示
                const pointsVal = document.getElementById('talent-points-val');
                if (pointsVal) {
                    pointsVal.innerText = worldManager.heroData.talentPoints || 0;
                }
            }, 200);

            // 重置视图位置
            this.resetTalentView();
        } else {
            // --- 手机端适配：关闭面板时恢复 HUD (仅当没有其他大面板时) ---
            if (this.isMobile) {
                const heroPanel = document.getElementById('hero-stats-panel');
                const townPanel = document.getElementById('town-management-panel');
                const skillPanel = document.getElementById('skill-learn-panel');
                const htpPanel = document.getElementById('how-to-play-panel');
                if (
                    (!heroPanel || heroPanel.classList.contains('hidden')) &&
                    (!townPanel || townPanel.classList.contains('hidden')) &&
                    (!skillPanel || skillPanel.classList.contains('hidden')) &&
                    (!htpPanel || htpPanel.classList.contains('hidden'))
                ) {
                    this.setHUDVisibility(true);
                }
            }

            // 1. 先准备好底层的状态
            uiLayer.classList.remove('ui-layer-distort-out');
            gameCanvas.classList.remove('ui-layer-distort-out');

            // 2. 使用统一接口恢复游戏逻辑与时间流动
            if (window.setGamePaused) window.setGamePaused(false);
            
            // 3. 隐藏奇穴面板
            talentPanel.classList.add('hidden');
            talentPanel.classList.remove('distort-enter');
            
            // 3. 恢复底层可见性，同时触发进入动画
            uiLayer.style.visibility = 'visible';
            gameCanvas.style.visibility = 'visible';
            
            uiLayer.classList.add('ui-layer-distort-in');
            gameCanvas.classList.add('ui-layer-distort-in');
            
            // 4. 动画结束后清理类名
            setTimeout(() => {
                uiLayer.classList.remove('ui-layer-distort-in');
                gameCanvas.classList.remove('ui-layer-distort-in');
            }, 600);
        }
    }

    /**
     * 提前准备天赋面板：设置皮肤、预渲染图谱
     * 职责：消除打开时的卡顿和颜色闪烁
     */
    prepareTalentPanel() {
        const talentPanel = document.getElementById('talent-panel');
        if (!talentPanel || !worldManager.heroData) return;

        const heroId = worldManager.heroData.id;
        const heroInfo = worldManager.availableHeroes[heroId];
        
        // 1. 立即设置门派皮肤
        talentPanel.classList.remove('sect-chunyang', 'sect-tiance', 'sect-cangjian');
        if (heroInfo && heroInfo.sect) {
            talentPanel.classList.add(`sect-${heroInfo.sect}`);
        }

        // 2. 预渲染奇穴图谱 (后台计算和 DOM 生成)
        this.renderTalentGraph();
        
        console.log(`%c[UI] %c奇穴系统已为门派【${heroInfo?.name}】预加载完毕`, "color: #44ccff", "color: #fff");
    }

    /**
     * 重置奇穴视图位置并自动居中
     */
    resetTalentView() {
        const talentPanel = document.getElementById('talent-panel');
        if (!talentPanel) return;

        const panelWidth = talentPanel.offsetWidth || window.innerWidth;
        const panelHeight = talentPanel.offsetHeight || window.innerHeight;

        // 中心点现在是 2500 (画布 5000px 的中点)
        this.talentDrag.offsetX = (panelWidth / 2) - 2500;
        this.talentDrag.offsetY = (panelHeight / 2) - 2500;
        this.talentDrag.scale = 1.0;

        this.updateTalentView();
    }

    /**
     * 实现弹性回弹效果
     */
    elasticSnapBack() {
        const talentPanel = document.getElementById('talent-panel');
        const panelWidth = talentPanel?.offsetWidth || window.innerWidth;
        const panelHeight = talentPanel?.offsetHeight || window.innerHeight;
        
        const idealX = (panelWidth / 2) - 2500;
        const idealY = (panelHeight / 2) - 2500;
        const threshold = 800; // 允许自由移动的半径

        let targetX = this.talentDrag.offsetX;
        let targetY = this.talentDrag.offsetY;

        // 如果超出阈值，计算回弹目标
        const diffX = targetX - idealX;
        if (Math.abs(diffX) > threshold) {
            targetX = idealX + (diffX > 0 ? threshold : -threshold);
        }

        const diffY = targetY - idealY;
        if (Math.abs(diffY) > threshold) {
            targetY = idealY + (diffY > 0 ? threshold : -threshold);
        }

        if (targetX !== this.talentDrag.offsetX || targetY !== this.talentDrag.offsetY) {
            // 使用 CSS 动画实现平滑回弹
            const container = document.getElementById('talent-container');
            if (container) {
                container.style.transition = 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)';
                this.talentDrag.offsetX = targetX;
                this.talentDrag.offsetY = targetY;
                this.updateTalentView();
                
                // 动画结束后移除 transition 防止拖拽卡顿
                setTimeout(() => {
                    container.style.transition = 'transform 0.05s linear';
                }, 600);
            }
        }
    }

    /**
     * 更新奇穴视图（包含星空视差与缩放）
     */
    updateTalentView() {
        const container = document.getElementById('talent-container');
        const starryBg = document.querySelector('.talent-starry-bg');
        const talentPanel = document.getElementById('talent-panel');
        
        // --- 统一计算位置 ---
        const panelWidth = talentPanel?.offsetWidth || window.innerWidth;
        const panelHeight = talentPanel?.offsetHeight || window.innerHeight;
        
        // 理想中心偏移 (让 (2500, 2500) 居中)
        const idealX = (panelWidth / 2) - 2500;
        const idealY = (panelHeight / 2) - 2500;
        
        let finalX = this.talentDrag.offsetX;
        let finalY = this.talentDrag.offsetY;

        if (container) {
            // --- 软边界逻辑实现 ---
            // 允许自由移动的阈值
            const threshold = 800;
            
            const diffX = finalX - idealX;
            if (Math.abs(diffX) > threshold) {
                const over = Math.abs(diffX) - threshold;
                // 阻力公式：超出部分按平方根衰减，模拟“拉力”感
                const resistance = Math.sqrt(over) * 15;
                finalX = idealX + (diffX > 0 ? (threshold + resistance) : -(threshold + resistance));
            }
            
            const diffY = finalY - idealY;
            if (Math.abs(diffY) > threshold) {
                const over = Math.abs(diffY) - threshold;
                const resistance = Math.sqrt(over) * 15;
                finalY = idealY + (diffY > 0 ? (threshold + resistance) : -(threshold + resistance));
            }

            // 奇穴位点跟随移动并缩放
            container.style.transform = `translate(${finalX}px, ${finalY}px) scale(${this.talentDrag.scale})`;
        }
        
        if (starryBg) {
            // 背景星空视差移动并伴随微弱缩放
            const deltaX = finalX - idealX;
            const deltaY = finalY - idealY;
            
            const bgX = deltaX * 0.1;
            const bgY = deltaY * 0.1;
            const bgScale = 1.05 + (this.talentDrag.scale - 1.0) * 0.1;
            starryBg.style.transform = `translate(${bgX}px, ${bgY}px) scale(${bgScale})`;
        }
    }

    /**
     * 渲染基于注册表数据的奇穴图
     */
    renderTalentGraph() {
        const container = document.getElementById('talent-container');
        const svg = document.getElementById('talent-links-svg');
        if (!container || !svg) return;

        container.querySelectorAll('.talent-node, .talent-group-tag').forEach(n => n.remove());
        svg.innerHTML = '';

        // 获取当前英雄生成的树
        const tree = talentManager.currentTree;
        if (!tree) return;

        const { nodes, links, tags } = tree;

        // 1. 绘制经脉连线
        links.forEach(link => {
            const source = nodes[link.source];
            const target = nodes[link.target];
            if (!source || !target) return;

            // 升级：使用 SVG Path 绘制带有张力的贝塞尔曲线 (Quadratic Bezier)
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const offsetX = 2500; 
            const offsetY = 2500; 
            
            const x1 = source.pos.x + offsetX;
            const y1 = source.pos.y + offsetY;
            const x2 = target.pos.x + offsetX;
            const y2 = target.pos.y + offsetY;

            // 计算控制点：让连线呈现自然的弧度
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            // 简单的弧度算法：向原点方向反向推一点点，或者根据法线偏移
            // 这里采用简单的中点偏移，让连线看起来更有“经脉”感
            const curveStrength = 15; 
            const cx = midX + (midX - offsetX) * 0.14; 
            const cy = midY + (midY - offsetY) * 0.14;

            path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
            path.setAttribute('class', 'talent-link');
            
            // 记录原始坐标用于计算边界
            path.dataset.x1 = x1;
            path.dataset.y1 = y1;
            path.dataset.x2 = x2;
            path.dataset.y2 = y2;
            path.dataset.cx = cx;
            path.dataset.cy = cy;

            const isSourceActive = (talentManager.activeTalents[link.source] || 0) > 0;
            const isTargetActive = (talentManager.activeTalents[link.target] || 0) > 0;
            if (isSourceActive && isTargetActive) {
                path.classList.add('active');
            }

            svg.appendChild(path);
        });

        // 1.5 动态调整 SVG 尺寸防止截断
        this.updateSvgDimensions(svg);

        // 2. 绘制奇穴节点
        for (const id in nodes) {
            const nodeData = nodes[id];
            const node = document.createElement('div');
            node.className = `talent-node node-type-${nodeData.type}`;
            
            const currentLevel = talentManager.activeTalents[id] || 0;
            if (currentLevel > 0) node.classList.add('active');

            // --- 新增：检查解锁状态并添加 is-locked 类 ---
            const unlockStatus = talentManager.checkUnlockStatus(id);
            if (unlockStatus.isLocked) {
                node.classList.add('is-locked');
            }

            // 核心逻辑：动态处理主属性名称 (力道/身法)
            let displayName = nodeData.name;
            if (id.includes('minor') && nodeData.name === '主属性') {
                const heroId = worldManager.heroData?.id;
                const heroInfo = worldManager.availableHeroes[heroId];
                displayName = heroInfo ? heroInfo.primaryStat : '力道';
            }

            node.style.left = `${nodeData.pos.x + 2500}px`; 
            node.style.top = `${nodeData.pos.y + 2500}px`;

            const iconStyle = spriteFactory.getIconStyle(nodeData.icon);
            node.innerHTML = `
                <div class="talent-node-inner" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                <div class="talent-node-level">${currentLevel}/${nodeData.maxLevel}</div>
                <div class="talent-node-name">${displayName}</div>
            `;

            // 使用优雅的 Tooltip 绑定器
            this.bindTooltip(node, () => {
                let statusText = currentLevel < nodeData.maxLevel ? `升级需求: 1 奇穴点数` : '已修至最高重';
                let statusColor = currentLevel < nodeData.maxLevel ? 'var(--jx3-gold)' : '#ccc';
                
                // 如果被锁定，覆盖状态描述
                if (unlockStatus.isLocked) {
                    statusText = `<span style="color: #ff4d4d;">${unlockStatus.reason}</span>`;
                    statusColor = '#ff4d4d';
                }

                return {
                    name: displayName,
                    level: `当前等级: ${currentLevel}/${nodeData.maxLevel}`,
                    description: `<div style="margin-bottom: 8px;">${nodeData.description}</div>`,
                    status: statusText,
                    color: statusColor
                };
            });

            node.onclick = () => {
                if (talentManager.upgradeTalent(id)) {
                    audioManager.play('talent_upgrade');
                    this.renderTalentGraph();
                    const pointsVal = document.getElementById('talent-points-val');
                    if (pointsVal) pointsVal.innerText = worldManager.heroData.talentPoints;
                } else {
                    const check = talentManager.canUpgrade(id);
                    this.showNotification(check.reason);
                    audioManager.play('ui_invalid');
                }
            };

            container.appendChild(node);
        }

        // 3. 绘制组描述大字
        if (tags) {
            tags.forEach(tag => {
                const tagEl = document.createElement('div');
                tagEl.className = 'talent-group-tag';
                tagEl.innerText = tag.text;
                tagEl.style.left = `${tag.pos.x + 2500}px`;
                tagEl.style.top = `${tag.pos.y + 2500}px`;
                
                // --- 动态亮度逻辑 ---
                // 根据该分支的激活节点数量，线性提升亮度
                let activeCount = 0;
                for (const nodeId in nodes) {
                    if (nodes[nodeId].groupId === tag.groupId) {
                        if ((talentManager.activeTalents[nodeId] || 0) > 0) {
                            activeCount++;
                        }
                    }
                }

                // 计算进度：激活节点数 / 总节点数 (tag.weight)
                const progress = tag.weight > 0 ? activeCount / tag.weight : 0;
                
                // 基础透明度 0.1，满激活时提升至 0.8
                const opacity = 0.1 + progress * 0.7;
                tagEl.style.color = `rgba(255, 255, 255, ${opacity})`;
                
                // 增强发光感：最高 60px 半径的强光
                if (progress > 0) {
                    const glowRadius = progress * 60;
                    const glowOpacity = progress * 0.8;
                    tagEl.style.textShadow = `0 0 ${glowRadius}px rgba(255, 255, 255, ${glowOpacity})`;
                }
                
                // 让文字保持正向显示
                tagEl.style.transform = `translate(-50%, -50%)`;
                
                container.appendChild(tagEl);
            });
        }
    }

    /**
     * 动态调整 SVG 尺寸防止连线被截断
     */
    updateSvgDimensions(svg) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const paths = svg.querySelectorAll('path');
        
        // 考虑连线
        paths.forEach(path => {
            const x1 = parseFloat(path.dataset.x1);
            const y1 = parseFloat(path.dataset.y1);
            const x2 = parseFloat(path.dataset.x2);
            const y2 = parseFloat(path.dataset.y2);
            const cx = parseFloat(path.dataset.cx);
            const cy = parseFloat(path.dataset.cy);

            minX = Math.min(minX, x1, x2, cx);
            minY = Math.min(minY, y1, y2, cy);
            maxX = Math.max(maxX, x1, x2, cx);
            maxY = Math.max(maxY, y1, y2, cy);
        });

        // 考虑标签 (Tags 往往在更远处)
        const tags = document.querySelectorAll('.talent-group-tag');
        tags.forEach(tag => {
            const x = parseFloat(tag.style.left);
            const y = parseFloat(tag.style.top);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });

        // 增加边距缓冲
        const padding = 200; // 增加缓冲，因为标签很大
        const width = maxX + padding;
        const height = maxY + padding;

        svg.style.width = `${width}px`;
        svg.style.height = `${height}px`;
        // 同时更新容器尺寸以确保背景能覆盖
        const container = document.getElementById('talent-container');
        if (container) {
            container.style.width = `${width}px`;
            container.style.height = `${height}px`;
        }
    }

    /**
     * 显示全局通知
     */
    showNotification(text) {
        // 统一调用 WorldManager 的通知系统
        worldManager.showNotification(text);
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

            // 使用优雅的 Tooltip 绑定器
            this.bindTooltip(item, () => {
                // 强制使用原始数值（不计入调息/缩减）
                const actualCost = skill.cost;
                const actualCD = (skill.cooldown / 1000).toFixed(1);
                
                return {
                    name: skill.name,
                    level: skill.level,
                    mpCost: `消耗: ${actualCost} 内力`,
                    cdText: `冷却: ${actualCD}s`,
                    description: skill.getDescription({ stats: baseStats })
                };
            });

            container.appendChild(item);
        });
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

