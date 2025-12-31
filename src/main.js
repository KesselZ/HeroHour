import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { WorldScene } from './scenes/WorldScene.js'; // 引入大世界场景
import { spriteFactory } from './core/SpriteFactory.js';
import { setSeed } from './core/Random.js';
import { modifierManager } from './core/ModifierManager.js';
import { worldManager } from './core/WorldManager.js';
import { SkillRegistry } from './core/SkillRegistry.js';
import { talentManager } from './core/TalentManager.js';
import { uiManager } from './core/UIManager.js';
import { audioManager } from './core/AudioManager.js';
import { timeManager } from './core/TimeManager.js';

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

const startBtn = document.querySelector('#start-btn');
const skillGalleryBtn = document.querySelector('#open-skill-learn-btn'); // 招式图谱按钮
const howToPlayBtn = document.querySelector('#how-to-play-btn'); // 江湖指南按钮
const mainMenu = document.querySelector('#main-menu');
const charSelectMenu = document.querySelector('#character-select');
const charCards = document.querySelectorAll('.char-card');
const confirmCharBtn = document.querySelector('#confirm-char-btn');
const backToMenuBtn = document.querySelector('#back-to-menu-btn');
const menuBg = document.querySelector('#menu-background');

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

// 点击“招式图谱”
if (skillGalleryBtn) {
    skillGalleryBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        
        // --- 互斥逻辑：打开招式图谱时，关闭其他面板 ---
        const townPanel = document.getElementById('town-management-panel');
        const heroPanel = document.getElementById('hero-stats-panel');
        if (townPanel) townPanel.classList.add('hidden');
        if (heroPanel) heroPanel.classList.add('hidden');

        const skillLearnPanel = document.getElementById('skill-learn-panel');
        if (skillLearnPanel) {
            skillLearnPanel.classList.remove('hidden');
            // 默认显示纯阳招式
            uiManager.renderLearnableSkills('chunyang');
        }
    });
}

// 点击“江湖指南”
if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', () => {
        audioManager.play('ui_click');

        // --- 互斥逻辑：打开指南时，关闭其他面板 ---
        const townPanel = document.getElementById('town-management-panel');
        const heroPanel = document.getElementById('hero-stats-panel');
        const skillPanel = document.getElementById('skill-learn-panel');
        if (townPanel) townPanel.classList.add('hidden');
        if (heroPanel) heroPanel.classList.add('hidden');
        if (skillPanel) skillPanel.classList.add('hidden');

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
                closeBtn.onclick = () => {
                    audioManager.play('ui_click');
                    panel.classList.add('hidden');
                };
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

// 确认选择，开始加载
confirmCharBtn.addEventListener('click', async () => {
    if (!selectedHero) return;
    audioManager.play('ui_click');
    
    charSelectMenu.classList.add('hidden');
    if (menuBg) menuBg.classList.add('hidden');
    
    enterGameState(GameState.LOADING);
    
    // 加载资源
    await spriteFactory.load();
    
    // 应用英雄天赋属性
    applyHeroTraits(selectedHero);
    
    // 设定随机种子 - 移除全局锁定，由场景自行控制
    // setSeed(888); 
    
    // 核心改动：选择完角色后先进入大世界
    enterGameState(GameState.WORLD);
});

// 初始进入菜单时播放菜单 BGM
audioManager.playBGM('/audio/bgm_menu.mp3');

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
    
    // 2. 设定初始技能 (这些也可以数据化，目前暂留)
    if (heroId === 'liwangsheng') worldManager.heroData.skills = ['sword_rain', 'divine_sword_rain', 'zhenshanhe', 'shengtaiji', 'tunriyue', 'sixiang', 'liangyi', 'wanshi', 'huasanqing'];
    if (heroId === 'lichengen') worldManager.heroData.skills = ['battle_shout', 'renchicheng', 'shourushan', 'zhanbafang', 'xiaoruhu', 'pochongwei', 'tu'];
    if (heroId === 'yeying') worldManager.heroData.skills = ['hegui', 'fengcha', 'songshe', 'mengquan', 'pinghu', 'quanningyue', 'yingmingliu', 'fenglaiwushan'];

    // 3. 执行同步与修正注册 (这里会根据 identity 动态计算 hpMax 和 mpMax)
    worldManager.refreshHeroStats();

    // 3.5 重新初始化奇穴管理器，根据选中的英雄生成对应的奇穴树
    talentManager.init(worldManager.heroData);

    // 4. 初始化资源状态 (补满血蓝)
    worldManager.heroData.hpCurrent = worldManager.heroData.hpMax;
    worldManager.heroData.mpCurrent = worldManager.heroData.mpMax;
}

function enterGameState(state, config = null) {
    currentState = state;
    
    // 1. 彻底清理当前所有场景内容 (包括灯光、物体、背景和雾)
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



