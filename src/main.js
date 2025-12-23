import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { WorldScene } from './scenes/WorldScene.js'; // 引入大世界场景
import { spriteFactory } from './core/SpriteFactory.js';
import { setSeed } from './core/Random.js';
import { modifierManager } from './core/ModifierManager.js';

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

// 2. 窗口缩放适配
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// 3. 基础灯光
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // 从 0.8 降低到 0.4，让颜色更浓郁
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); // 稍微加强直射光，增强立体感
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

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

/**
 * 根据选择的角色应用全局属性加成
 */
function applyHeroTraits(heroId) {
    // 首先清空旧的修正器
    modifierManager.clear();

    if (heroId === 'qijin') {
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
}

function enterGameState(state) {
    currentState = state;
    
    // 清理当前所有场景内容 (除了基础光源)
    // 注意：实际项目中建议更精细地管理 Object3D 的销毁
    
    if (state === GameState.WORLD) {
        // 进入大世界
        worldInstance = new WorldScene(scene, camera, renderer);
        worldInstance.init(selectedHero);
        worldInstance.start();
    } else if (state === GameState.BATTLE) {
        // 进入战斗
        if (worldInstance) worldInstance.stop();
        battleInstance = new BattleScene(scene, camera);
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



