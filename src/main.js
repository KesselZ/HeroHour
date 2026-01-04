import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { WorldScene } from './scenes/WorldScene.js'; // 引入大世界场景
import { spriteFactory } from './core/SpriteFactory.js';
import { setSeed } from './core/Random.js';
import { modifierManager } from './core/ModifierManager.js';
import { WorldManager, worldManager } from './core/WorldManager.js';
import { SkillRegistry } from './core/SkillRegistry.js';
import { talentManager } from './core/TalentManager.js';
import { uiManager } from './core/UIManager.js';
import { audioManager } from './core/AudioManager.js';
import { timeManager } from './core/TimeManager.js';
import { resourcePreloader } from './core/ResourcePreloader.js';
import { saveManager } from './core/SaveManager.js';
import { WorldStatusManager } from './core/WorldStatusManager.js';

import { HOW_TO_PLAY } from './data/HowToPlayContent.js';

// 游戏状态管理
const GameState = {
    MENU: 'menu',
    CHAR_SELECT: 'char_select',
    LOADING: 'loading',
    WORLD: 'world', // 新增：大世界阶段
    BATTLE: 'battle'
};

let currentState = GameState.MENU;
let worldInstance = null; // 大世界实例
let battleInstance = null;
let selectedHero = null;
let isPaused = false;

/**
 * 切换暂停状态
 */
function togglePause() {
    // 只有在世界或战斗中才能暂停
    if (currentState !== GameState.WORLD && currentState !== GameState.BATTLE) return;

    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pause-menu');
    
    if (isPaused) {
        pauseMenu.classList.remove('hidden');
        timeManager.pause();
        audioManager.play('ui_click');
    } else {
        pauseMenu.classList.add('hidden');
        // 确保关闭暂停菜单时，重置为默认选项视图
        const defaultOps = document.getElementById('pause-default-options');
        const settingOps = document.getElementById('pause-settings-options');
        if (defaultOps) defaultOps.classList.remove('hidden');
        if (settingOps) settingOps.classList.add('hidden');

        timeManager.resume();
        audioManager.play('ui_click');
    }
}

// 监听 ESC 键
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // 1. 检查是否有打开的面板需要关闭 (优先级高于暂停)
        const panels = [
            'hero-stats-panel',
            'town-management-panel',
            'skill-learn-panel',
            'how-to-play-panel',
            'load-save-panel',
            'save-game-panel',
            'game-start-window'
        ];
        
        let panelClosed = false;
        for (const id of panels) {
            const panel = document.getElementById(id);
            if (panel && !panel.classList.contains('hidden')) {
                panel.classList.add('hidden');
                audioManager.play('ui_click', { volume: 0.4 });
                
                // 特殊逻辑：如果是城镇面板，需要调用实例方法清理状态
                if (id === 'town-management-panel' && worldInstance) {
                    worldInstance.closeTownManagement();
                }
                // 特殊逻辑：如果是传闻面板，同步清理红点
                if (id === 'world-event-history-panel') {
                    WorldStatusManager.updateNotificationDot(false);
                }
                panelClosed = true;
                break; // 每次只关闭一个面板
            }
        }

        if (panelClosed) return;

        // 2. 检查战斗中是否有选中的兵种或正在释放的技能
        if (currentState === GameState.BATTLE && battleInstance) {
            if (battleInstance.selectedType) {
                battleInstance.selectedType = null;
                battleInstance.updatePreviewSprite(null);
                const slots = document.querySelectorAll('.unit-slot');
                slots.forEach(s => s.classList.remove('selected'));
                return;
            }
            if (battleInstance.activeSkill) {
                battleInstance.activeSkill = null;
                if (battleInstance.skillIndicator) battleInstance.skillIndicator.visible = false;
                if (battleInstance.rangeIndicator) battleInstance.rangeIndicator.visible = false;
                // 清除高亮
                [...battleInstance.playerUnits, ...battleInstance.enemyUnits].forEach(u => u.setTargeted(false));
                uiManager.hideActionHint();
                return;
            }
        }

        // 3. 如果没有面板和特殊状态，则切换暂停
        togglePause();
    }
});

// 绑定暂停菜单按钮
const resumeBtn = document.getElementById('resume-game-btn');
if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
        togglePause();
    });
}

// 统一的面板关闭逻辑（针对带有 mobile HUD 适配的面板）
function closePanelWithHUD(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('hidden');
        audioManager.play('ui_click');

        // 特殊逻辑：如果是传闻面板，同步清理红点
        if (panelId === 'world-event-history-panel') {
            WorldStatusManager.updateNotificationDot(false);
        }

        // --- 手机端适配：仅在没有其他全屏面板打开时恢复 HUD ---
        if (uiManager.isMobile) {
            const panelsToCheck = [
                'hero-stats-panel', 
                'town-management-panel', 
                'talent-panel', 
                'skill-learn-panel', 
                'how-to-play-panel',
                'load-save-panel',
                'save-game-panel',
                'world-event-history-panel'
            ];
            const anyVisible = panelsToCheck.some(id => {
                const p = document.getElementById(id);
                return p && !p.classList.contains('hidden');
            });
            if (!anyVisible) {
                uiManager.setHUDVisibility(true);
            }
        }
    }
}
window.closePanelWithHUD = closePanelWithHUD; // 暴露给全局调用

// 绑定保存和载入按钮（暂停菜单内）
const pauseSaveBtn = document.getElementById('pause-save-btn');
const pauseLoadBtn = document.getElementById('pause-load-btn');

if (pauseSaveBtn) {
    pauseSaveBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        const savePanel = document.getElementById('save-game-panel');
        if (savePanel) {
            savePanel.classList.remove('hidden');
            renderSaveSlots('save-game-list-container', 'save'); // 渲染保存列表
            if (uiManager.isMobile) uiManager.setHUDVisibility(false);
            
            const closeBtn = document.getElementById('close-save-game');
            if (closeBtn) {
                closeBtn.onclick = () => closePanelWithHUD('save-game-panel');
            }
        }
    });
}

if (pauseLoadBtn) {
    pauseLoadBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        const loadPanel = document.getElementById('load-save-panel');
        if (loadPanel) {
            loadPanel.classList.remove('hidden');
            renderSaveSlots('save-list-container', 'load'); // 渲染载入列表
            if (uiManager.isMobile) uiManager.setHUDVisibility(false);

            const closeBtn = document.getElementById('close-load-save');
            if (closeBtn) {
                closeBtn.onclick = () => closePanelWithHUD('load-save-panel');
            }
        }
    });
}

// 设置按钮逻辑
const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const pauseDefaultOptions = document.getElementById('pause-default-options');
const pauseSettingsOptions = document.getElementById('pause-settings-options');

if (openSettingsBtn && closeSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        pauseDefaultOptions.classList.add('hidden');
        pauseSettingsOptions.classList.remove('hidden');
    });

    closeSettingsBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        pauseSettingsOptions.classList.add('hidden');
        pauseDefaultOptions.classList.remove('hidden');
    });
}

// 音量滑块逻辑
const bgmSlider = document.getElementById('bgm-volume-slider');
const sfxSlider = document.getElementById('sfx-volume-slider');

if (bgmSlider) {
    bgmSlider.value = audioManager.bgmVolume;
    bgmSlider.addEventListener('input', (e) => {
        audioManager.setBGMVolume(parseFloat(e.target.value));
    });
}

if (sfxSlider) {
    sfxSlider.value = audioManager.sfxVolume;
    sfxSlider.addEventListener('input', (e) => {
        audioManager.setSFXVolume(parseFloat(e.target.value));
    });
}

const backToMenuBtnFromPause = document.getElementById('back-to-menu-from-pause-btn');
if (backToMenuBtnFromPause) {
    backToMenuBtnFromPause.addEventListener('click', () => {
        // 强制刷新页面回到主菜单，这是最彻底的重置方式
        window.location.reload();
    });
}

// 1. 初始化 Three.js 基础
const scene = new THREE.Scene();
// 移除原本的黑色背景设置，由 Environment 类控制
// scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#game-canvas'),
    antialias: false 
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
// 关键修复：确保渲染器的色彩空间与材质贴图一致，防止泛白
renderer.outputColorSpace = THREE.SRGBColorSpace; 

// 2. 窗口缩放适配
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 5. UI 逻辑
// 禁止所有可能导致脱离游戏沉浸感的浏览器行为
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('copy', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

// 核心 UI 元素引用
const loadingScreen = document.getElementById('loading-screen');
const progressFill = document.getElementById('loading-progress-fill');
const loadingText = document.getElementById('loading-text');
const uiLayer = document.getElementById('ui-layer');

const startBtn = document.querySelector('#start-btn');
const loadSaveBtn = document.querySelector('#load-save-btn'); // 加载存档按钮
const skillGalleryBtn = document.querySelector('#open-skill-learn-btn'); // 招式图谱按钮
const howToPlayBtn = document.querySelector('#how-to-play-btn'); // 江湖指南按钮
const mainMenu = document.querySelector('#main-menu');
const charSelectMenu = document.querySelector('#character-select');
const charCards = document.querySelectorAll('.hero-card');
const confirmCharBtn = document.querySelector('#confirm-char-btn');
const backToMenuBtn = document.querySelector('#back-to-menu-btn');
const menuBg = document.querySelector('#menu-background');

// 难度选择界面相关
const diffSelectMenu = document.querySelector('#difficulty-select');
const diffCards = document.querySelectorAll('.diff-card');
const confirmDiffBtn = document.querySelector('#confirm-diff-btn');
const backToCharBtn = document.querySelector('#back-to-char-btn');
let selectedDifficulty = 'easy';

// 初始化 UI 图标 (使用统一 API 替换 CSS 硬编码)
function initUIIcons() {
    // 1. 初始化角色选择界面的肖像
    const liwangshengPortrait = document.querySelector('.liwangsheng-portrait');
    const lichengenPortrait = document.querySelector('.lichengen-portrait');
    const yeyingPortrait = document.querySelector('.yeying-portrait');
    if (liwangshengPortrait) Object.assign(liwangshengPortrait.style, spriteFactory.getIconStyle('liwangsheng'));
    if (lichengenPortrait) Object.assign(lichengenPortrait.style, spriteFactory.getIconStyle('lichengen'));
    if (yeyingPortrait) Object.assign(yeyingPortrait.style, spriteFactory.getIconStyle('yeying'));

    // 2. 初始化部署界面的兵种图标
    const slots = document.querySelectorAll('.unit-slot');
    slots.forEach(slot => {
        const type = slot.getAttribute('data-type');
        const icon = slot.querySelector('.slot-icon');
        if (icon && type) {
            Object.assign(icon.style, spriteFactory.getIconStyle(type));
        }
    });
}

// 在 DOM 加载或脚本执行时初始化
initUIIcons();
WorldStatusManager.initUI();

// 点击“招式图谱”
if (skillGalleryBtn) {
    skillGalleryBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        
        // --- 互斥逻辑：打开招式图谱时，关闭其他面板 ---
        const panelsToHide = ['town-management-panel', 'hero-stats-panel', 'game-start-window', 'how-to-play-panel', 'load-save-panel', 'save-game-panel'];
        panelsToHide.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });

        // --- 手机端适配：打开面板时隐藏 HUD ---
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);

        const skillLearnPanel = document.getElementById('skill-learn-panel');
        if (skillLearnPanel) {
            skillLearnPanel.classList.remove('hidden');
            // 默认显示纯阳招式
            uiManager.renderLearnableSkills('chunyang');
        }
    });
}

// 点击“加载存档”
if (loadSaveBtn) {
    loadSaveBtn.addEventListener('click', () => {
        audioManager.play('ui_click');

        // --- 互斥逻辑：打开存档面板时，关闭其他面板 ---
        const panelsToHide = ['town-management-panel', 'hero-stats-panel', 'game-start-window', 'how-to-play-panel', 'skill-learn-panel', 'save-game-panel'];
        panelsToHide.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });

        // --- 手机端适配：打开面板时隐藏 HUD ---
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);

        const panel = document.getElementById('load-save-panel');
        if (panel) {
            panel.classList.remove('hidden');
            renderSaveSlots('save-list-container', 'load');
            
            const closeBtn = document.getElementById('close-load-save');
            if (closeBtn) {
                closeBtn.onclick = () => closePanelWithHUD('load-save-panel');
            }
        }
    });
}

/**
 * 渲染存档列表并绑定逻辑
 * @param {string} containerId 
 * @param {string} mode 'save' | 'load'
 */
function renderSaveSlots(containerId, mode) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const allMeta = saveManager.getAllMetadata();

    allMeta.forEach((meta, index) => {
        const slotId = index + 1;
        const item = document.createElement('div');
        item.className = `save-item ${!meta && mode === 'load' ? 'empty' : ''}`;
        
        if (meta) {
            const iconStyle = spriteFactory.getIconStyle(meta.heroId || 'liwangsheng');
            item.innerHTML = `
                <div class="save-portrait" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                <div class="save-info">
                    <div class="save-name">${meta.heroName} <span class="save-lv">Lv.${meta.heroLevel}</span></div>
                    <div class="save-details">
                        <span>${meta.dateStr}</span>
                        <span class="save-res">💰${meta.gold}</span>
                        <span class="save-time">${saveManager.formatTimestamp(meta.timestamp)}</span>
                    </div>
                </div>
                ${mode === 'save' ? '<div class="save-action-badge override">覆盖</div>' : ''}
            `;
        } else {
            item.innerHTML = `
                <div class="save-portrait empty"></div>
                <div class="save-info">
                    <div class="save-name" style="color: rgba(255,255,255,0.3)">空存档位</div>
                    <div class="save-details">尚无江湖传闻</div>
                </div>
                ${mode === 'save' ? '<div class="save-action-badge create">建立</div>' : ''}
            `;
        }

        item.onclick = () => {
            audioManager.play('ui_click');
            if (mode === 'save') {
                // 核心修复：在保存前，必须先将 3D 世界的所有实体位置同步到逻辑层 (WorldManager)
                if (currentState === GameState.WORLD && worldInstance) {
                    worldInstance.syncEntitiesToLogic();
                }

                if (saveManager.save(slotId)) {
                    uiManager.showNotification(`位置 ${slotId} 存档成功`);
                    renderSaveSlots(containerId, mode); // 刷新
                }
            } else {
                if (meta) {
                    if (saveManager.load(slotId)) {
                        uiManager.showNotification("江湖快马载入中...");
                        
                        // 关闭所有可能的 UI 面板和主菜单
                        const panels = ['load-save-panel', 'save-game-panel', 'pause-menu', 'main-menu', 'character-select', 'difficulty-select'];
                        panels.forEach(id => {
                            const p = document.getElementById(id);
                            if (p) p.classList.add('hidden');
                        });
                        
                        if (currentState === GameState.MENU && menuBg) {
                            menuBg.classList.add('hidden');
                        }

                        enterGameState(GameState.LOADING);
                        
                        setTimeout(async () => {
                            await spriteFactory.load();
                            selectedHero = worldManager.heroData.id;
                            enterGameState(GameState.WORLD);
                            isPaused = false;
                            timeManager.resume();
                        }, 800);
                    }
                }
            }
        };

        container.appendChild(item);
    });
}

// 点击“江湖指南”
if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', () => {
        audioManager.play('ui_click');

        // --- 互斥逻辑：打开指南时，关闭其他面板 ---
        const panelsToHide = ['town-management-panel', 'hero-stats-panel', 'skill-learn-panel', 'game-start-window', 'load-save-panel', 'save-game-panel'];
        panelsToHide.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });

        // --- 手机端适配：打开面板时隐藏 HUD ---
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);

        const panel = document.getElementById('how-to-play-panel');
        const textContainer = document.getElementById('how-to-play-text');
        const closeBtn = document.getElementById('close-how-to-play');

        if (panel && textContainer) {
            // 填充内容
            textContainer.innerHTML = HOW_TO_PLAY.sections.map(section => `
                <div class="htp-section">
                    <div class="htp-subtitle">${section.subtitle}</div>
                    <div class="htp-content">${section.content}</div>
                </div>
            `).join('');

            panel.classList.remove('hidden');

            if (closeBtn) {
                closeBtn.onclick = () => window.closePanelWithHUD('how-to-play-panel');
            }
        }
    });
}

// 点击“闯荡江湖”进入角色选择
startBtn.addEventListener('click', () => {
    audioManager.play('ui_click');
    mainMenu.classList.add('hidden');
    charSelectMenu.classList.remove('hidden');
    currentState = GameState.CHAR_SELECT;
});

// 返回主菜单
backToMenuBtn.addEventListener('click', () => {
    audioManager.play('ui_click');
    charSelectMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    currentState = GameState.MENU;
    
    // 重置选择
    selectedHero = null;
    charCards.forEach(c => c.classList.remove('selected'));
    confirmCharBtn.classList.add('disabled');
    confirmCharBtn.disabled = true;
});

// 选择角色卡片
charCards.forEach(card => {
    card.addEventListener('click', () => {
        audioManager.play('ui_click');
        charCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedHero = card.dataset.hero;
        
        // 激活确认按钮
        confirmCharBtn.classList.remove('disabled');
        confirmCharBtn.disabled = false;
    });
});

// 确认选择角色，进入难度选择
confirmCharBtn.addEventListener('click', () => {
    if (!selectedHero) return;
    audioManager.play('ui_click');
    
    charSelectMenu.classList.add('hidden');
    diffSelectMenu.classList.remove('hidden');
});

// 选择难度卡片
diffCards.forEach(card => {
    card.addEventListener('click', () => {
        audioManager.play('ui_click');
        diffCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDifficulty = card.dataset.diff;
    });
});

// 返回角色选择
backToCharBtn.addEventListener('click', () => {
    audioManager.play('ui_click');
    diffSelectMenu.classList.add('hidden');
    charSelectMenu.classList.remove('hidden');
});

// 确认难度选择，开始加载
confirmDiffBtn.addEventListener('click', async () => {
    console.log('%c[主流程] %c开始进入江湖...', 'color: #ff9800; font-weight: bold', 'color: #fff');
    if (!selectedHero || !selectedDifficulty) {
        console.warn('[主流程] 角色或难度未选择', { selectedHero, selectedDifficulty });
        return;
    }
    audioManager.play('ui_click');
    
    // 核心优化：确保新游戏使用完全随机的种子
    import('./core/Random.js').then(m => {
        m.setSeed(Math.floor(Math.random() * 1000000));
    });
    
    diffSelectMenu.classList.add('hidden');
    if (menuBg) menuBg.classList.add('hidden');
    
    enterGameState(GameState.LOADING);
    
    try {
        // 加载资源
        await spriteFactory.load();
        
        // 设置难度
        timeManager.setDifficulty(selectedDifficulty);
        
        // 应用英雄天赋属性
        applyHeroTraits(selectedHero);
        
        // 进入大世界
        enterGameState(GameState.WORLD);
    } catch (error) {
        console.error('[主流程] 游戏启动失败:', error);
    }
});

// 初始进入菜单时播放菜单 BGM
audioManager.playBGM('/audio/bgm_menu.mp3');

// 在页面加载完成后开始预加载所有资源
window.addEventListener('load', () => {
    // 延迟一小段时间再开始预加载，避免阻塞初始渲染
    setTimeout(() => {
        resourcePreloader.preloadAll(
            (loaded, total, currentFile) => {
                // 更新加载界面进度
                const progress = Math.round((loaded / total) * 100);
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (loadingText) loadingText.textContent = `${progress}%`;

                // 显示详细的加载信息
                const fileName = currentFile ? currentFile.split('/').pop() : '未知文件';
                console.log(`资源预加载进度: ${loaded}/${total} (${progress}%) - ${fileName}`);
            },
            () => {
                console.log('%c[资源预加载] 全局预加载完成，用户体验将大幅提升', 'color: #4CAF50; font-weight: bold');

                // 隐藏加载界面，显示主界面
                setTimeout(() => {
                    if (loadingScreen) loadingScreen.classList.add('hidden');
                    if (uiLayer) uiLayer.classList.remove('hidden');
                }, 500); // 短暂延迟，让用户看到100%
            }
        );
    }, 100);
});

// 监听大世界发出的开战请求
window.addEventListener('start-battle', (e) => {
    const enemyConfig = e.detail;
    enterGameState(GameState.BATTLE, enemyConfig);
});

// 监听战斗结束返回大世界的请求
window.addEventListener('battle-finished', (e) => {
    const result = e.detail;
    // 关键修复：战斗结束后重置所有技能冷却
    SkillRegistry.resetAllCooldowns();
    enterGameState(GameState.WORLD, result);
});

// 监听英雄升级事件，同步属性修正器
window.addEventListener('hero-level-up', () => {
    worldManager.refreshHeroStats();
});

// 监听奇穴更新事件，同步属性
window.addEventListener('talents-updated', () => {
    worldManager.refreshHeroStats();
    worldManager.updateHUD(); // 更新血条等显示
});

/**
 * 根据选择的角色应用全局属性加成
 */
function applyHeroTraits(heroId) {
    modifierManager.clear();
    worldManager.heroData.id = heroId;
    
    // 1. 从数据表加载初始数值 (不再有 if-else)
    const identity = worldManager.getHeroIdentity(heroId);
    if (identity) {
        Object.assign(worldManager.heroData.stats, identity.initialStats);
    }

    // 1.5 初始化兵力 (支持调试模式)
    worldManager.initHeroArmy(heroId);
    
    // 2. 设定初始技能 (仅在 Debug 模式下全学会)
    const isCheat = WorldManager.DEBUG.ENABLED && WorldManager.DEBUG.START_RESOURCES;
    if (isCheat) {
        if (heroId === 'liwangsheng') worldManager.heroData.skills = ['sword_rain', 'divine_sword_rain', 'zhenshanhe', 'shengtaiji', 'tunriyue', 'sixiang', 'liangyi', 'wanshi', 'huasanqing', 'sanqing_huashen'];
        if (heroId === 'lichengen') worldManager.heroData.skills = ['battle_shout', 'renchicheng', 'shourushan', 'zhanbafang', 'xiaoruhu', 'pochongwei', 'tu'];
        if (heroId === 'yeying') worldManager.heroData.skills = ['hegui', 'fengcha', 'songshe', 'mengquan', 'pinghu', 'quanningyue', 'yingmingliu', 'fenglaiwushan'];
    } else {
        // 非 Debug 模式下，初始技能为空（需通过等级或奇穴获得）
        worldManager.heroData.skills = [];
    }

    // 3. 执行同步与修正注册 (这里会根据 identity 动态计算 hpMax 和 mpMax)
    worldManager.refreshHeroStats();

    // 3.5 重新初始化奇穴管理器，根据选中的英雄生成对应的奇穴树
    talentManager.init(worldManager.heroData);

    // 触发英雄初始化完成事件，通知 UI 进行预加载
    window.dispatchEvent(new CustomEvent('hero-initialized'));

    // 4. 初始化资源状态 (补满血蓝)
    worldManager.modifyHeroHealth(worldManager.heroData.hpMax);
    worldManager.modifyHeroMana(worldManager.heroData.mpMax);
}

function enterGameState(state, config = null) {
    currentState = state;
    
    // 1. 处理 UI 层级显示
    if (state === GameState.LOADING) {
        if (loadingScreen) loadingScreen.classList.remove('hidden');
    } else {
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }

    // 2. 彻底清理当前所有场景内容 (包括灯光、物体、背景和雾)
    const objectsToRemove = [];
    scene.children.forEach(child => {
        objectsToRemove.push(child);
    });
    
    objectsToRemove.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        // 释放资源
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
    });

    // 关键修复：重置场景全局属性，防止战斗环境污染大世界
    scene.background = new THREE.Color(0x000000); // 重置背景为黑色
    scene.fog = null; // 清除雾效
    
    // 确保渲染器状态回到默认 (针对可能的过曝问题)
    renderer.toneMappingExposure = 1.0; 
    
    // 2. 进入新状态
    if (state === GameState.WORLD) {
        worldInstance = new WorldScene(scene, camera, renderer);
        worldInstance.init(selectedHero);
        // 如果是从战斗回来，触发回调
        if (config && config.winner) {
            worldInstance.onBattleEnd(config);
        }
        worldInstance.start();
    } else if (state === GameState.BATTLE) {
        if (worldInstance) worldInstance.stop();
        battleInstance = new BattleScene(scene, camera, config);
        battleInstance.start();
    }
}

// 6. 渲染循环
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();

    // 如果处于暂停状态，跳过逻辑更新，只进行渲染
    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    if (currentState === GameState.WORLD && worldInstance) {
        worldInstance.update(deltaTime);
    } else if (currentState === GameState.BATTLE && battleInstance) {
        battleInstance.update(deltaTime);
    }

    renderer.render(scene, camera);
}

animate();



