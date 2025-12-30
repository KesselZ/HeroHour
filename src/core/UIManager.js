import { spriteFactory } from './SpriteFactory.js';
import { SkillRegistry, SectSkills } from './SkillRegistry.js';
import { worldManager } from './WorldManager.js';
import { modifierManager } from './ModifierManager.js';
import { TALENT_UNITS, HERO_TREE_CONFIG, getHeroTalentTree } from './TalentRegistry.js';
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

        if (openTalentBtn && talentPanel && uiLayer && gameCanvas) {
            openTalentBtn.onclick = () => {
                audioManager.play('ui_click');
                
                // 1. 触发【全画面】扭曲缩小效果
                uiLayer.classList.add('ui-layer-distort-out');
                gameCanvas.classList.add('ui-layer-distort-out');

                // 2. 暂停大世界时间流动
                timeManager.pause();
                
                // 3. 稍微缩短延迟，确保新面板在旧画面彻底消失前就入场，形成重叠感
                setTimeout(() => {
                    talentPanel.classList.remove('hidden');
                    talentPanel.classList.add('distort-enter');
                    
                    // 彻底隐藏底层防止干扰 (不移除动画类，而是用 visibility 配合强制隐藏)
                    uiLayer.style.visibility = 'hidden';
                    gameCanvas.style.visibility = 'hidden';
                    
                    // 重置拖拽偏移
                    this.resetTalentView();
                    
                    // 更新点数
                    const pointsVal = document.getElementById('talent-points-val');
                    if (pointsVal) {
                        pointsVal.innerText = worldManager.heroData.talentPoints || 0;
                    }

                    // 渲染奇穴图
                    this.renderTalentGraph();
                }, 550);
            };
        }

        if (closeTalentBtn && talentPanel && uiLayer && gameCanvas) {
            closeTalentBtn.onclick = () => {
                audioManager.play('ui_click');
                
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
            };
        }

        // --- 拖拽交互监听 ---
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
            }
        });

        // --- 滚轮缩放监听 ---
        talentPanel.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            const newScale = Math.max(0.5, Math.min(2.0, this.talentDrag.scale + delta));
            
            if (newScale !== this.talentDrag.scale) {
                this.talentDrag.scale = newScale;
                this.updateTalentView();
            }
        }, { passive: false });
    }

    /**
     * 重置奇穴视图位置
     */
    resetTalentView() {
        this.talentDrag.offsetX = 0;
        this.talentDrag.offsetY = 0;
        this.talentDrag.scale = 1.0;
        this.updateTalentView();
    }

    /**
     * 更新奇穴视图（包含星空视差与缩放）
     */
    updateTalentView() {
        const container = document.getElementById('talent-container');
        const starryBg = document.querySelector('.talent-starry-bg');
        
        if (container) {
            // 奇穴位点跟随移动并缩放
            container.style.transform = `translate(${this.talentDrag.offsetX}px, ${this.talentDrag.offsetY}px) scale(${this.talentDrag.scale})`;
        }
        
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

        container.querySelectorAll('.talent-node').forEach(n => n.remove());
        svg.innerHTML = '';

        // 获取当前英雄生成的树
        const tree = talentManager.currentTree;
        if (!tree) return;

        const { nodes, links } = tree;

        // 1. 绘制经脉连线
        links.forEach(link => {
            const source = nodes[link.source];
            const target = nodes[link.target];
            if (!source || !target) return;

            // 升级：使用 SVG Path 绘制带有张力的贝塞尔曲线 (Quadratic Bezier)
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const offsetX = 700; // 适配新的 1400 宽度容器
            const offsetY = 700; // 适配新的 1400 高度容器
            
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
            const cx = midX + (midX - offsetX) * 0.14; // 进一步增加弧度，适配大空间
            const cy = midY + (midY - offsetY) * 0.14;

            path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
            path.setAttribute('class', 'talent-link');
            
            const isSourceActive = (talentManager.activeTalents[link.source] || 0) > 0;
            const isTargetActive = (talentManager.activeTalents[link.target] || 0) > 0;
            if (isSourceActive && isTargetActive) {
                path.classList.add('active');
            }

            svg.appendChild(path);
        });

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
                displayName = (heroId === 'qijin' || heroId === 'yeying') ? '身法' : '力道';
            }

            node.style.left = `${nodeData.pos.x + 700}px`; 
            node.style.top = `${nodeData.pos.y + 700}px`;

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
    }

    /**
     * 便捷方法：显示技能提示
     * @param {string} skillId 
     * @param {Object} heroData 
     */
    showSkillTooltip(skillId, heroData) {
        const skill = SkillRegistry[skillId];
        if (!skill) return;

        // 核心修复：统一使用 ModifierManager 获取已截断的倍率，解决 UI 与逻辑不一致问题
        const casterDummy = { side: 'player', isHero: true, type: heroData.id };
        const mpMult = modifierManager.getModifiedValue(casterDummy, 'mana_cost_multiplier', 1.0);

        const actualCD = (skill.getActualCooldown(heroData) / 1000).toFixed(1);
        const actualCost = Math.floor(skill.cost * mpMult);

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

