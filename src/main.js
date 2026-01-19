import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { WorldScene } from './scenes/WorldScene.js'; 
import { spriteFactory } from './engine/SpriteFactory.js';
import { setSeed } from './utils/Random.js';
import { modifierManager } from './systems/ModifierManager.js';
import { WorldManager, worldManager } from './core/WorldManager.js';
import { SkillRegistry } from './data/SkillRegistry.js';
import { talentManager } from './systems/TalentManager.js';
import { uiManager } from './core/UIManager.js';
import { audioManager } from './engine/AudioManager.js';
import { timeManager } from './systems/TimeManager.js';
import { resourcePreloader } from './engine/ResourcePreloader.js';
import { saveManager } from './systems/SaveManager.js';
import { WorldStatusManager } from './world/WorldStatusManager.js';
import { terrainManager, TERRAIN_STYLES } from './world/TerrainManager.js';
import { weatherManager } from './systems/WeatherManager.js';

import { HOW_TO_PLAY } from './data/HowToPlayContent.js';

import { useGameStore } from './store/gameStore';
import { useUIStore } from './store/uiStore';

// 游戏状态管理
const GameState = {
    MENU: 'menu',
    LOADING: 'loading',
    WORLD: 'world', 
    BATTLE: 'battle'
};

let currentState = GameState.MENU;
let worldInstance = null; 
let battleInstance = null;

function togglePause() {
    if (currentState !== GameState.WORLD && currentState !== GameState.BATTLE) return;
    const nextState = !timeManager.isLogicPaused;
    
    if (nextState) {
        useUIStore.getState().openPanel('pauseMenu');
        audioManager.play('ui_click');
    } else {
        useUIStore.getState().closePanel();
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
        // 核心逻辑：优先关闭 React 面板
        const activePanel = useUIStore.getState().activePanel;
        if (activePanel) {
            // 如果是在暂停菜单里开了子面板（如存读档），返回暂停菜单
            if (activePanel === 'saveGame' || activePanel === 'loadSave') {
                useUIStore.getState().openPanel('pauseMenu');
            } else {
                useUIStore.getState().closePanel();
                if (uiManager.isMobile) uiManager.setHUDVisibility(true);
            }
            return;
        }

        // 战斗内特殊逻辑
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
        
        // 最后才是切换暂停
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
        useUIStore.getState().openPanel('saveGame');
        if (uiManager.isMobile) uiManager.setHUDVisibility(false);
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

// 暂停菜单逻辑已迁移至 React (PauseMenuPanel.tsx)

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#game-canvas'), antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace; 
window.renderer = renderer; // 暴露给 PerfPanel 访问渲染信息

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('copy', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());

// 移除原有的 DOM 引用，改用 React Store
// const loadingScreen = document.getElementById('loading-screen');
// const progressFill = document.getElementById('loading-progress-fill');
// const loadingText = document.getElementById('loading-text');
const uiLayer = document.getElementById('ui-layer');

function initUIIcons() {
    // 图标预加载已移至 React 组件内部
}

initUIIcons();

window.addEventListener('load', () => {
    setTimeout(() => {
        resourcePreloader.preloadAll((loaded, total, currentFile) => {
            const progress = Math.round((loaded / total) * 100);
            // 同步进度到 React Store
            useGameStore.getState().setLoading({
                progress: progress,
                text: `${progress}%`
            });
        }, () => {
            setTimeout(() => {
                // 隐藏加载界面，显示 UI 层
                useGameStore.getState().setLoading({ visible: false });
                if (uiLayer) uiLayer.classList.remove('hidden');
                // 自动打开主菜单
                useUIStore.getState().openPanel('mainMenu');
            }, 500);
        });
    }, 100);
});

// --- 核心桥梁：响应来自 React 的游戏启动请求 ---
window.addEventListener('request-game-start', async (e) => {
    const { heroId, difficulty } = e.detail;
    if (!heroId || !difficulty) return;
    
    console.log(`%c[游戏启动] %c侠客: ${heroId}, 难度: ${difficulty}`, 'color: #44ccff; font-weight: bold', 'color: #fff');
    
    // 初始化随机种子
    import('./utils/Random.js').then(m => m.setSeed(Math.floor(Math.random() * 1000000)));
    
    // 进入加载状态
    enterGameState(GameState.LOADING);
    
    try {
        await spriteFactory.load();
        timeManager.setDifficulty(difficulty);
        applyHeroTraits(heroId);
        enterGameState(GameState.WORLD);
    } catch (e) {
        console.error('游戏启动失败:', e);
    }
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

// --- 核心桥梁：响应来自 React UI 的存档/读档请求 ---
window.addEventListener('request-save', (e) => {
    const { slotId } = e.detail;
    if (currentState === GameState.WORLD && worldInstance) {
        // 存档前同步实体的逻辑位置
        worldInstance.syncEntitiesToLogic();
    }
    if (saveManager.save(slotId)) {
        uiManager.showNotification(`位置 ${slotId} 存档成功`);
        // 触发 UI 刷新 (React 会监听到这个存储变化)
        window.dispatchEvent(new CustomEvent('save-updated'));
    }
});

window.addEventListener('request-load', (e) => {
    const { slotId } = e.detail;
    if (saveManager.load(slotId)) {
        uiManager.showNotification("江湖快马载入中...");
        
        // 关闭所有面板
        useUIStore.getState().closePanel();

        // 进入加载流程
        enterGameState(GameState.LOADING);
        setTimeout(async () => {
            await spriteFactory.load();
            const loadedHeroId = worldManager.heroData.id;
            enterGameState(GameState.WORLD);
            window.setGamePaused(false);
        }, 800);
    }
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
    
    // 使用 React Store 管理加载界面显隐
    if (state === GameState.LOADING) {
        useGameStore.getState().setLoading({ visible: true, progress: 0, text: '加载中...' });
    } else {
        useGameStore.getState().setLoading({ visible: false });
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
        const heroId = worldManager.heroData.id;
        worldInstance = new WorldScene(scene, camera, renderer);
        worldInstance.init(heroId);
        if (config && config.winner) worldInstance.onBattleEnd(config);
        worldInstance.start();
    } else if (state === GameState.BATTLE) {
        if (worldInstance) worldInstance.stop();
        battleInstance = new BattleScene(scene, camera, config);
        battleInstance.start();
    }
}

const clock = new THREE.Clock();
let frameCount = 0;
let lastFpsUpdate = 0;

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    // 性能采集 (仅开发模式)
    if (import.meta.env.DEV) {
        frameCount++;
        const now = performance.now();
        if (now - lastFpsUpdate > 1000) {
            window.perf_fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
            frameCount = 0;
            lastFpsUpdate = now;
        }
        window.perf_drawCalls = renderer.info.render.calls;
        window.perf_triangles = renderer.info.render.triangles;
    }

    if (timeManager.isLogicPaused) {
        renderer.render(scene, camera);
        return;
    }
    if (currentState === GameState.WORLD && worldInstance) worldInstance.update(deltaTime);
    else if (currentState === GameState.BATTLE && battleInstance) battleInstance.update(deltaTime);
    
    renderer.render(scene, camera);

    // 基础性能面板更新 (非战斗场景也显示基础指标)
    if (import.meta.env.DEV && currentState !== GameState.BATTLE) {
        uiManager.updatePerfPanel({
            fps: window.perf_fps || 0,
            drawCalls: window.perf_drawCalls || 0,
            triangles: window.perf_triangles || 0
        });
    }
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

    // --- 开发者作弊指令说明书 ---
    const showDevCheatsHelp = () => {
        console.group("%c🛠️ 开发者作弊指令说明书", "color: #ffcc00; font-weight: bold; font-size: 14px;");
        console.log("%c使用方法：直接在浏览器控制台输入以下指令并回车", "color: #888; font-style: italic;");
        
        console.log("%c[ 建筑相关 ]", "color: #ffaa00; font-weight: bold;");
        console.log("  worldManager.triggerBuildingDraft()      - %c立即触发一次季度建筑抽卡", "color: #aaa;");
        
        console.log("%c[ 资源/经验 ]", "color: #00ffaa; font-weight: bold;");
        console.log("  worldManager.resources.gold += 100000    - %c增加 10万金钱", "color: #aaa;");
        console.log("  worldManager.resources.wood += 50000     - %c增加 5万木材", "color: #aaa;");
        console.log("  worldManager.heroManager.gainXP(5000)    - %c增加 5000 经验并自动处理升级", "color: #aaa;");
        console.log("  worldManager.heroManager.heroData.talentPoints += 10 - %c增加 10点奇穴天赋点", "color: #aaa;");
        
        console.log("%c[ 战斗/军队 ]", "color: #ff5555; font-weight: bold;");
        console.log("  worldManager.heroManager.updateHeroArmy({ 'tc_heavy_cavalry': 50 }) - %c获得 50名玄甲陷阵骑", "color: #aaa;");
        console.log("  worldManager.heroManager.grantRandomSkill() - %c随机获得一个新的招式", "color: #aaa;");
        
        console.log("%c[ 全局调试 ]", "color: #55aaff; font-weight: bold;");
        console.log("  WorldManager.DEBUG.REVEAL_MAP = true     - %c揭开地图迷雾 (需移动后生效)", "color: #aaa;");
        console.log("  worldManager.debugSetTerrain('snow')     - %c一键切换地形风格", "color: #aaa;");
        console.log("  weatherManager.setRain()                 - %c一键切换天气为雨天", "color: #aaa;");
        
        console.log("%c温馨提示：部分指令执行后需要手动调用 worldManager.updateHUD() 刷新界面显示。", "color: #ff8888;");
        console.groupEnd();
    };

    // 延迟一秒显示，确保在其他启动日志之后
    setTimeout(showDevCheatsHelp, 1500);
}

animate();
