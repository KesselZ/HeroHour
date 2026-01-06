import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { WorldScene } from './scenes/WorldScene.js'; 
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
import { terrainManager, TERRAIN_STYLES } from './core/TerrainManager.js';
import { weatherManager } from './core/WeatherManager.js';

import { HOW_TO_PLAY } from './data/HowToPlayContent.js';

// 游戏状态管理
const GameState = {
    MENU: 'menu',
    CHAR_SELECT: 'char_select',
    LOADING: 'loading',
    WORLD: 'world', 
    BATTLE: 'battle'
};

let currentState = GameState.MENU;
let worldInstance = null; 
let battleInstance = null;
let selectedHero = null;

function togglePause() {
    if (currentState !== GameState.WORLD && currentState !== GameState.BATTLE) return;
    const nextState = !timeManager.isLogicPaused;
    const pauseMenu = document.getElementById('pause-menu');
    if (nextState) {
        pauseMenu.classList.remove('hidden');
        audioManager.play('ui_click');
    } else {
        pauseMenu.classList.add('hidden');
        const defaultOps = document.getElementById('pause-default-options');
        const settingOps = document.getElementById('pause-settings-options');
        if (defaultOps) defaultOps.classList.remove('hidden');
        if (settingOps) settingOps.classList.add('hidden');
        audioManager.play('ui_click');
    }
    window.setGamePaused(nextState);
}

window.setGamePaused = (paused) => {
    timeManager.isLogicPaused = paused;
    if (paused) {
        timeManager.pause();
    } else {
        timeManager.resume();
    }
    console.log(`%c[核心系统] 暂停状态同步: ${paused ? '暂停' : '恢复'}`, "color: #ff00ff; font-weight: bold");
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const panels = [
            'talent-panel',
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
                if (id === 'talent-panel') {
                    uiManager.toggleTalentPanel(false);
                    panelClosed = true;
                    break;
                }
                panel.classList.add('hidden');
                audioManager.play('ui_click', { volume: 0.4 });
                if (id === 'town-management-panel' && worldInstance) {
                    worldInstance.closeTownManagement();
                }
                if (id === 'world-event-history-panel') {
                    WorldStatusManager.updateNotificationDot(false);
                }
                if ((id === 'skill-learn-panel' || id === 'how-to-play-panel') && uiManager.isMobile) {
                    uiManager.setHUDVisibility(true);
                }
                panelClosed = true;
                break; 
            }
        }
        if (panelClosed) return;
        if (currentState === GameState.BATTLE && battleInstance) {
            if (battleInstance.selectedType) {
                battleInstance.selectedType = null;
                battleInstance.updatePreviewSprite(null);
                document.querySelectorAll('.unit-slot').forEach(s => s.classList.remove('selected'));
                return;
            }
            if (battleInstance.activeSkill) {
                battleInstance.activeSkill = null;
                if (battleInstance.skillIndicator) battleInstance.skillIndicator.visible = false;
                if (battleInstance.rangeIndicator) battleInstance.rangeIndicator.visible = false;
                [...battleInstance.playerUnits, ...battleInstance.enemyUnits].forEach(u => u.setTargeted(false));
                uiManager.hideActionHint();
                return;
            }
        }
        togglePause();
    }
});

function closePanelWithHUD(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.add('hidden');
        audioManager.play('ui_click');
        if (panelId === 'world-event-history-panel') {
            WorldStatusManager.updateNotificationDot(false);
        }
        if (uiManager.isMobile) {
            const panelsToCheck = ['hero-stats-panel', 'town-management-panel', 'talent-panel', 'skill-learn-panel', 'how-to-play-panel','load-save-panel','save-game-panel','world-event-history-panel'];
            const anyVisible = panelsToCheck.some(id => {
                const p = document.getElementById(id);
                return p && !p.classList.contains('hidden');
            });
            if (!anyVisible) uiManager.setHUDVisibility(true);
        }
    }
}
window.closePanelWithHUD = closePanelWithHUD;

const pauseSaveBtn = document.getElementById('pause-save-btn');
const pauseLoadBtn = document.getElementById('pause-load-btn');
if (pauseSaveBtn) {
    pauseSaveBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        const savePanel = document.getElementById('save-game-panel');
        if (savePanel) {
            savePanel.classList.remove('hidden');
            renderSaveSlots('save-game-list-container', 'save');
            if (uiManager.isMobile) uiManager.setHUDVisibility(false);
            const closeBtn = document.getElementById('close-save-game');
            if (closeBtn) closeBtn.onclick = () => closePanelWithHUD('save-game-panel');
        }
    });
}
if (pauseLoadBtn) {
    pauseLoadBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        const loadPanel = document.getElementById('load-save-panel');
        if (loadPanel) {
            loadPanel.classList.remove('hidden');
            renderSaveSlots('save-list-container', 'load');
            if (uiManager.isMobile) uiManager.setHUDVisibility(false);
            const closeBtn = document.getElementById('close-load-save');
            if (closeBtn) closeBtn.onclick = () => closePanelWithHUD('load-save-panel');
        }
    });
}

const openSettingsBtn = document.getElementById('open-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
if (openSettingsBtn && closeSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        document.getElementById('pause-default-options').classList.add('hidden');
        document.getElementById('pause-settings-options').classList.remove('hidden');
    });
    closeSettingsBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        document.getElementById('pause-settings-options').classList.add('hidden');
        document.getElementById('pause-default-options').classList.remove('hidden');
    });
}

const bgmSlider = document.getElementById('bgm-volume-slider');
const sfxSlider = document.getElementById('sfx-volume-slider');
if (bgmSlider) {
    bgmSlider.value = audioManager.bgmVolume;
    bgmSlider.addEventListener('input', (e) => audioManager.setBGMVolume(parseFloat(e.target.value)));
}
if (sfxSlider) {
    sfxSlider.value = audioManager.sfxVolume;
    sfxSlider.addEventListener('input', (e) => audioManager.setSFXVolume(parseFloat(e.target.value)));
}

if (document.getElementById('back-to-menu-from-pause-btn')) {
    document.getElementById('back-to-menu-from-pause-btn').addEventListener('click', () => window.location.reload());
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace; 

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('copy', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

const loadingScreen = document.getElementById('loading-screen');
const progressFill = document.getElementById('loading-progress-fill');
const loadingText = document.getElementById('loading-text');
const uiLayer = document.getElementById('ui-layer');

const startBtn = document.querySelector('#start-btn');
const loadSaveBtnRoot = document.querySelector('#load-save-btn');
const skillGalleryBtn = document.querySelector('#open-skill-learn-btn');
const howToPlayBtn = document.querySelector('#how-to-play-btn');
const mainMenu = document.querySelector('#main-menu');
const charSelectMenu = document.querySelector('#character-select');
const charCards = document.querySelectorAll('.hero-card');
const confirmCharBtn = document.querySelector('#confirm-char-btn');
const backToMenuBtn = document.querySelector('#back-to-menu-btn');
const menuBg = document.querySelector('#menu-background');
const diffSelectMenu = document.querySelector('#difficulty-select');
const diffCards = document.querySelectorAll('.diff-card');
const confirmDiffBtn = document.querySelector('#confirm-diff-btn');
const backToCharBtn = document.querySelector('#back-to-char-btn');
let selectedDifficulty = 'easy';

function initUIIcons() {
    ['liwangsheng', 'lichengen', 'yeying'].forEach(id => {
        const p = document.querySelector(`.${id}-portrait`);
        if (p) Object.assign(p.style, spriteFactory.getIconStyle(id));
    });
    document.querySelectorAll('.unit-slot').forEach(slot => {
        const type = slot.getAttribute('data-type');
        const icon = slot.querySelector('.slot-icon');
        if (icon && type) Object.assign(icon.style, spriteFactory.getIconStyle(type));
    });
}

initUIIcons();
WorldStatusManager.initUI();

if (skillGalleryBtn) {
    skillGalleryBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        ['town-management-panel', 'hero-stats-panel', 'game-start-window', 'how-to-play-panel', 'load-save-panel', 'save-game-panel'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);
        const p = document.getElementById('skill-learn-panel');
        if (p) {
            p.classList.remove('hidden');
            uiManager.renderLearnableSkills('chunyang');
        }
    });
}

if (loadSaveBtnRoot) {
    loadSaveBtnRoot.addEventListener('click', () => {
        audioManager.play('ui_click');
        ['town-management-panel', 'hero-stats-panel', 'game-start-window', 'how-to-play-panel', 'skill-learn-panel', 'save-game-panel'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);
        const p = document.getElementById('load-save-panel');
        if (p) {
            p.classList.remove('hidden');
            renderSaveSlots('save-list-container', 'load');
            const closeBtn = document.getElementById('close-load-save');
            if (closeBtn) closeBtn.onclick = () => closePanelWithHUD('load-save-panel');
        }
    });
}

function renderSaveSlots(containerId, mode) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    saveManager.getAllMetadata().forEach((meta, index) => {
        const slotId = index + 1;
        const item = document.createElement('div');
        item.className = `save-item ${!meta && mode === 'load' ? 'empty' : ''}`;
        if (meta) {
            const iconStyle = spriteFactory.getIconStyle(meta.heroId || 'liwangsheng');
            item.innerHTML = `<div class="save-portrait" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div><div class="save-info"><div class="save-name">${meta.heroName} <span class="save-lv">Lv.${meta.heroLevel}</span></div><div class="save-details"><span>${meta.dateStr}</span><span class="save-res">💰${meta.gold}</span><span class="save-time">${saveManager.formatTimestamp(meta.timestamp)}</span></div></div>${mode === 'save' ? '<div class="save-action-badge override">覆盖</div>' : ''}`;
        } else {
            item.innerHTML = `<div class="save-portrait empty"></div><div class="save-info"><div class="save-name" style="color: rgba(255,255,255,0.3)">空存档位</div><div class="save-details">尚无江湖传闻</div></div>${mode === 'save' ? '<div class="save-action-badge create">建立</div>' : ''}`;
        }
        item.onclick = () => {
            audioManager.play('ui_click');
            if (mode === 'save') {
                if (currentState === GameState.WORLD && worldInstance) worldInstance.syncEntitiesToLogic();
                if (saveManager.save(slotId)) {
                    uiManager.showNotification(`位置 ${slotId} 存档成功`);
                    renderSaveSlots(containerId, mode);
                }
            } else if (meta) {
                if (saveManager.load(slotId)) {
                    uiManager.showNotification("江湖快马载入中...");
                    ['load-save-panel', 'save-game-panel', 'pause-menu', 'main-menu', 'character-select', 'difficulty-select'].forEach(id => {
                        const p = document.getElementById(id);
                        if (p) p.classList.add('hidden');
                    });
                    if (currentState === GameState.MENU && menuBg) menuBg.classList.add('hidden');
                    enterGameState(GameState.LOADING);
                    setTimeout(async () => {
                        await spriteFactory.load();
                        selectedHero = worldManager.heroData.id;
                        enterGameState(GameState.WORLD);
                        window.setGamePaused(false);
                    }, 800);
                }
            }
        };
        container.appendChild(item);
    });
}

if (howToPlayBtn) {
    howToPlayBtn.addEventListener('click', () => {
        audioManager.play('ui_click');
        ['town-management-panel', 'hero-stats-panel', 'skill-learn-panel', 'game-start-window', 'load-save-panel', 'save-game-panel'].forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);
        const p = document.getElementById('how-to-play-panel');
        const t = document.getElementById('how-to-play-text');
        if (p && t) {
            t.innerHTML = HOW_TO_PLAY.sections.map(s => `<div class="htp-section"><div class="htp-subtitle">${s.subtitle}</div><div class="htp-content">${s.content}</div></div>`).join('');
            p.classList.remove('hidden');
            const c = document.getElementById('close-how-to-play');
            if (c) c.onclick = () => window.closePanelWithHUD('how-to-play-panel');
        }
    });
}

startBtn.addEventListener('click', () => {
    audioManager.play('ui_click');
    mainMenu.classList.add('hidden');
    charSelectMenu.classList.remove('hidden');
    currentState = GameState.CHAR_SELECT;
});

backToMenuBtn.addEventListener('click', () => {
    audioManager.play('ui_click');
    charSelectMenu.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    currentState = GameState.MENU;
    selectedHero = null;
    charCards.forEach(c => c.classList.remove('selected'));
    confirmCharBtn.classList.add('disabled');
    confirmCharBtn.disabled = true;
});

charCards.forEach(card => {
    card.addEventListener('click', () => {
        audioManager.play('ui_click');
        charCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedHero = card.dataset.hero;
        confirmCharBtn.classList.remove('disabled');
        confirmCharBtn.disabled = false;
    });
});

confirmCharBtn.addEventListener('click', () => {
    if (!selectedHero) return;
    audioManager.play('ui_click');
    charSelectMenu.classList.add('hidden');
    diffSelectMenu.classList.remove('hidden');
});

diffCards.forEach(card => {
    card.addEventListener('click', () => {
        audioManager.play('ui_click');
        diffCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedDifficulty = card.dataset.diff;
    });
});

backToCharBtn.addEventListener('click', () => {
    audioManager.play('ui_click');
    diffSelectMenu.classList.add('hidden');
    charSelectMenu.classList.remove('hidden');
});

confirmDiffBtn.addEventListener('click', async () => {
    if (!selectedHero || !selectedDifficulty) return;
    audioManager.play('ui_click');
    import('./core/Random.js').then(m => m.setSeed(Math.floor(Math.random() * 1000000)));
    diffSelectMenu.classList.add('hidden');
    if (menuBg) menuBg.classList.add('hidden');
    enterGameState(GameState.LOADING);
    try {
        await spriteFactory.load();
        timeManager.setDifficulty(selectedDifficulty);
        applyHeroTraits(selectedHero);
        enterGameState(GameState.WORLD);
    } catch (e) {
        console.error('游戏启动失败:', e);
    }
});

audioManager.playBGM('/audio/bgm_menu.mp3');

window.addEventListener('load', () => {
    setTimeout(() => {
        resourcePreloader.preloadAll((loaded, total, currentFile) => {
            const progress = Math.round((loaded / total) * 100);
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (loadingText) loadingText.textContent = `${progress}%`;
        }, () => {
            setTimeout(() => {
                if (loadingScreen) loadingScreen.classList.add('hidden');
                if (uiLayer) uiLayer.classList.remove('hidden');
            }, 500);
        });
    }, 100);
});

window.addEventListener('start-battle', (e) => enterGameState(GameState.BATTLE, e.detail));
window.addEventListener('battle-finished', (e) => {
    SkillRegistry.resetAllCooldowns();
    enterGameState(GameState.WORLD, e.detail);
});
window.addEventListener('hero-level-up', () => worldManager.refreshHeroStats());
window.addEventListener('talents-updated', () => {
    worldManager.refreshHeroStats();
    worldManager.updateHUD();
});

function applyHeroTraits(heroId) {
    modifierManager.clear();
    worldManager.heroData.id = heroId;
    const identity = worldManager.getHeroIdentity(heroId);
    if (identity) Object.assign(worldManager.heroData.stats, identity.initialStats);
    worldManager.initHeroArmy(heroId);
    const isCheat = WorldManager.DEBUG.ENABLED && WorldManager.DEBUG.START_RESOURCES;
    if (isCheat) {
        if (heroId === 'liwangsheng') worldManager.heroData.skills = ['sword_rain', 'divine_sword_rain', 'zhenshanhe', 'shengtaiji', 'tunriyue', 'sixiang', 'liangyi', 'wanshi', 'huasanqing', 'sanqing_huashen'];
        if (heroId === 'lichengen') worldManager.heroData.skills = ['battle_shout', 'renchicheng', 'shourushan', 'zhanbafang', 'xiaoruhu', 'pochongwei', 'tu'];
        if (heroId === 'yeying') worldManager.heroData.skills = ['hegui', 'fengcha', 'songshe', 'mengquan', 'pinghu', 'quanningyue', 'yingmingliu', 'fenglaiwushan'];
    } else worldManager.heroData.skills = [];
    worldManager.refreshHeroStats();
    talentManager.init(worldManager.heroData);
    window.dispatchEvent(new CustomEvent('hero-initialized'));
    worldManager.modifyHeroHealth(worldManager.heroData.hpMax);
    worldManager.modifyHeroMana(worldManager.heroData.mpMax);
}

function enterGameState(state, config = null) {
    currentState = state;
    if (loadingScreen) {
        if (state === GameState.LOADING) loadingScreen.classList.remove('hidden');
        else loadingScreen.classList.add('hidden');
    }
    const objectsToRemove = [];
    scene.children.forEach(child => objectsToRemove.push(child));
    objectsToRemove.forEach(obj => {
        if (obj.parent) obj.parent.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    });
    scene.background = new THREE.Color(0x000000);
    scene.fog = null;
    renderer.toneMappingExposure = 1.0; 
    if (state === GameState.WORLD) {
        worldInstance = new WorldScene(scene, camera, renderer);
        worldInstance.init(selectedHero);
        if (config && config.winner) worldInstance.onBattleEnd(config);
        worldInstance.start();
    } else if (state === GameState.BATTLE) {
        if (worldInstance) worldInstance.stop();
        battleInstance = new BattleScene(scene, camera, config);
        battleInstance.start();
    }
}

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    if (timeManager.isLogicPaused) {
        renderer.render(scene, camera);
        return;
    }
    if (currentState === GameState.WORLD && worldInstance) worldInstance.update(deltaTime);
    else if (currentState === GameState.BATTLE && battleInstance) battleInstance.update(deltaTime);
    renderer.render(scene, camera);
}

if (import.meta.env.DEV) {
    window.worldManager = worldManager;
    window.timeManager = timeManager;
    window.modifierManager = modifierManager;
    window.talentManager = talentManager;
    window.WorldStatusManager = WorldStatusManager;
    window.terrainManager = terrainManager;
    window.TERRAIN_STYLES = TERRAIN_STYLES;
    window.weatherManager = weatherManager;
    console.log('%c[Debug] 已挂载全局管理实例。使用 worldManager.debugSetTerrain("snow") 切换地形。', 'color: #ff00ff; font-weight: bold');
    console.log('%c[Debug] 使用 weatherManager.setRain() 或 setSnow() 切换天气。', 'color: #3498db; font-weight: bold');
}

animate();
