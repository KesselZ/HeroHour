import { spriteFactory } from './SpriteFactory.js';
import { SkillRegistry, SectSkills } from './SkillRegistry.js';
import { worldManager } from './WorldManager.js';
import { modifierManager } from './ModifierManager.js';
import { TALENT_UNITS, TALENT_GROUPS, HERO_TREE_CONFIG, getHeroTalentTree } from './TalentRegistry.js';
import { talentManager } from './TalentManager.js';
import { timeManager } from './TimeManager.js';
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
        this.initTalentEvents();
        this.initGameStartEvents();
        this.initBattleEscapeEvents();
        
        this.gameStartWindowShown = false; // 记录开局窗口是否已显示
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

            // 更新 Action Hint 位置 (始终跟随鼠标，贴合右下方)
            if (this.actionHint && !this.actionHint.classList.contains('hidden')) {
                this.actionHint.style.left = `${e.clientX + 10}px`;
                this.actionHint.style.top = `${e.clientY + 10}px`;
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
            // 1. 触发【全画面】扭曲缩小效果
            uiLayer.classList.add('ui-layer-distort-out');
            gameCanvas.classList.add('ui-layer-distort-out');

            // 2. 暂停大世界时间流动
            timeManager.pause();
            
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
            // 1. 先准备好底层的状态
            uiLayer.classList.remove('ui-layer-distort-out');
            gameCanvas.classList.remove('ui-layer-distort-out');

            // 2. 恢复时间流动
            timeManager.resume();
            
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
        
        if (container) {
            // --- 软边界逻辑实现 ---
            const panelWidth = talentPanel?.offsetWidth || window.innerWidth;
            const panelHeight = talentPanel?.offsetHeight || window.innerHeight;
            
            // 理想中心偏移 (让 (2500, 2500) 居中)
            const idealX = (panelWidth / 2) - 2500;
            const idealY = (panelHeight / 2) - 2500;
            
            // 允许自由移动的阈值
            const threshold = 800;
            let finalX = this.talentDrag.offsetX;
            let finalY = this.talentDrag.offsetY;
            
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
// ... (rest unchanged)
        
        if (starryBg) {
            // 背景星空视差移动并伴随微弱缩放
            const bgX = this.talentDrag.offsetX * 0.2;
            const bgY = this.talentDrag.offsetY * 0.2;
            // 星空缩放幅度更小，产生深度距离感 (基础 1.1 + 缩放增量的 20%)
            const bgScale = 1.1 + (this.talentDrag.scale - 1.0) * 0.2;
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

            node.onmouseenter = () => {
                this.showTooltip({
                    name: displayName,
                    level: `当前等级: ${currentLevel}/${nodeData.maxLevel}`,
                    description: `<div style="margin-bottom: 8px;">${nodeData.description}</div>`,
                    status: currentLevel < nodeData.maxLevel ? `升级需求: 1 奇穴点数` : '已修至最高重',
                    color: currentLevel < nodeData.maxLevel ? 'var(--jx3-gold)' : '#ccc'
                });
            };
            node.onmouseleave = () => this.hideTooltip();

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
                // 计算该分支的激活进度
                let totalInGroup = 0;
                let activeInGroup = 0;
                for (const nodeId in nodes) {
                    if (nodes[nodeId].groupId === tag.groupId) {
                        totalInGroup++;
                        if ((talentManager.activeTalents[nodeId] || 0) > 0) {
                            activeInGroup++;
                        }
                    }
                }

                const progress = totalInGroup > 0 ? activeInGroup / totalInGroup : 0;
                
                // 大幅提升亮度上限：基础透明度 0.05，最高点亮到 0.5
                const opacity = 0.05 + progress * 0.45;
                tagEl.style.color = `rgba(255, 255, 255, ${opacity})`;
                
                // 增强发光感：最高 50px 半径，0.6 透明度的强光
                if (progress > 0) {
                    const glowRadius = progress * 50;
                    const glowOpacity = progress * 0.6;
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
        const container = document.getElementById('notification-container');
        if (!container) return;
        const note = document.createElement('div');
        note.className = 'notification-item';
        note.innerText = text;
        container.appendChild(note);
        setTimeout(() => note.classList.add('fade-out'), 2000);
        setTimeout(() => note.remove(), 2500);
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
            type: 'skill'
        });
    }
}

export const uiManager = new UIManager();

