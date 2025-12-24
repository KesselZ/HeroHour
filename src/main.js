import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { WorldScene } from './scenes/WorldScene.js'; // 引入大世界场景
import { spriteFactory } from './core/SpriteFactory.js';
import { setSeed } from './core/Random.js';
import { modifierManager } from './core/ModifierManager.js';
import { worldManager } from './core/WorldManager.js';

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
const startBtn = document.querySelector('#start-btn');
const mainMenu = document.querySelector('#main-menu');
const charSelectMenu = document.querySelector('#character-select');
const charCards = document.querySelectorAll('.char-card');
const confirmCharBtn = document.querySelector('#confirm-char-btn');
const backToMenuBtn = document.querySelector('#back-to-menu-btn');
const menuBg = document.querySelector('#menu-background');

// 初始化 UI 图标 (使用统一 API 替换 CSS 硬编码)
function initUIIcons() {
    // 1. 初始化角色选择界面的肖像
    const qijinPortrait = document.querySelector('.qijin-portrait');
    const lichengenPortrait = document.querySelector('.lichengen-portrait');
    if (qijinPortrait) Object.assign(qijinPortrait.style, spriteFactory.getIconStyle('qijin'));
    if (lichengenPortrait) Object.assign(lichengenPortrait.style, spriteFactory.getIconStyle('lichengen'));

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

// 点击“闯荡江湖”进入角色选择
startBtn.addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    charSelectMenu.classList.remove('hidden');
    currentState = GameState.CHAR_SELECT;
});

// 返回主菜单
backToMenuBtn.addEventListener('click', () => {
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
    
    charSelectMenu.classList.add('hidden');
    if (menuBg) menuBg.classList.add('hidden');
    
    enterGameState(GameState.LOADING);
    
    // 加载资源
    await spriteFactory.load();
    
    // 应用英雄天赋属性
    applyHeroTraits(selectedHero);
    
    // 设定随机种子
    setSeed(888); 
    
    // 核心改动：选择完角色后先进入大世界
    enterGameState(GameState.WORLD);
});

// 监听大世界发出的开战请求
window.addEventListener('start-battle', (e) => {
    const enemyConfig = e.detail;
    enterGameState(GameState.BATTLE, enemyConfig);
});

// 监听战斗结束返回大世界的请求
window.addEventListener('battle-finished', () => {
    enterGameState(GameState.WORLD);
});

/**
 * 根据选择的角色应用全局属性加成
 */
function applyHeroTraits(heroId) {
    // 首先清空旧的修正器
    modifierManager.clear();

    // 初始化世界管理器的英雄数据
    worldManager.heroData.id = heroId;
    if (heroId === 'qijin') {
        worldManager.heroData.hpMax = 500;
        worldManager.heroData.stats.atk = 45;
        worldManager.heroData.stats.speed = 0.08;
        worldManager.heroData.skills = ['sword_rain', 'divine_sword_rain', 'battle_shout']; // 增加神剑归宗
        
        // 祁进天赋：纯阳弟子血量和伤害提高 20%
        modifierManager.addGlobalModifier({
            id: 'qijin_chunyang_hp',
            side: 'player',
            unitType: 'chunyang',
            stat: 'hp',
            multiplier: 1.2
        });
        modifierManager.addGlobalModifier({
            id: 'qijin_chunyang_dmg',
            side: 'player',
            unitType: 'chunyang',
            stat: 'damage',
            multiplier: 1.2
        });
    } else if (heroId === 'lichengen') {
        worldManager.heroData.hpMax = 650;
        worldManager.heroData.stats.atk = 35;
        worldManager.heroData.stats.speed = 0.06;
        worldManager.heroData.skills = ['battle_shout', 'summon_militia']; // 李承恩技能组

        // 李承恩天赋：大世界移动速度提高 20%
        modifierManager.addGlobalModifier({
            id: 'lichengen_world_speed',
            side: 'player',
            stat: 'world_speed',
            multiplier: 1.2
        });
        // 额外给天策兵种一点防御/血量加成，作为统领的隐形成长
        modifierManager.addGlobalModifier({
            id: 'lichengen_tiance_hp',
            side: 'player',
            unitType: 'tiance',
            stat: 'hp',
            multiplier: 1.1
        });
    }
    // 初始生命值为满血
    worldManager.heroData.hpCurrent = worldManager.heroData.hpMax;
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
        worldInstance.start();
    } else if (state === GameState.BATTLE) {
        if (worldInstance) worldInstance.stop();
        battleInstance = new BattleScene(scene, camera, config);
        battleInstance.start();
    }
}

// 6. 渲染循环
function animate() {
    requestAnimationFrame(animate);

    if (currentState === GameState.WORLD && worldInstance) {
        worldInstance.update();
    } else if (currentState === GameState.BATTLE && battleInstance) {
        battleInstance.update();
    }

    renderer.render(scene, camera);
}

animate();



