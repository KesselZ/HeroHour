import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { spriteFactory } from './core/SpriteFactory.js';
import { setSeed } from './core/Random.js';

// 游戏状态管理
// ... (保持不变)
const GameState = {
    MENU: 'menu',
    LOADING: 'loading',
    BATTLE: 'battle'
};

let currentState = GameState.MENU;
let battleInstance = null;

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
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// 5. UI 逻辑
const startBtn = document.querySelector('#start-btn');
const mainMenu = document.querySelector('#main-menu');
const menuBg = document.querySelector('#menu-background');

startBtn.addEventListener('click', async () => {
    mainMenu.classList.add('hidden');
    if (menuBg) menuBg.classList.add('hidden');
    enterGameState(GameState.LOADING);
    
    // 加载资源
    await spriteFactory.load();
    
    // 设定随机种子，确保战斗可预测
    setSeed(888); 
    
    enterGameState(GameState.BATTLE);
});

function enterGameState(state) {
    currentState = state;
    if (state === GameState.BATTLE) {
        battleInstance = new BattleScene(scene, camera);
        battleInstance.start();
    }
}

// 6. 渲染循环
function animate() {
    requestAnimationFrame(animate);

    if (currentState === GameState.BATTLE && battleInstance) {
        battleInstance.update();
    }

    renderer.render(scene, camera);
}

animate();



