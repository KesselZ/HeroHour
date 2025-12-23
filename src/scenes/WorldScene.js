import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { modifierManager } from '../core/ModifierManager.js';
import { worldManager } from '../core/WorldManager.js'; // 引入数据管家

/**
 * 大世界场景类
 * 负责探索、移动、资源收集和城镇管理
 */
export class WorldScene {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.playerHero = null;
        this.heroId = null;
        this.isActive = false;
        
        // 移动控制
        this.keys = {};
        this.moveSpeed = 0.04; // 移动速度降低 4 倍 (从 0.15 改为约 0.04)
        
        // 大世界物体
        this.interactables = [];
        
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
    }

    /**
     * 初始化大世界
     * @param {string} heroId 选中的英雄 ID
     */
    init(heroId) {
        this.heroId = heroId;
        
        // 1. 创建地面 (瓦片地图感)
        this.createGround();
        
        // 2. 创建主角小人
        this.createPlayer();
        
        // 3. 设置灯光
        this.setupLights();

        // 4. 初始化 UI
        this.initUI();
        
        // 5. 设置摄像机初始位置
        this.camera.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);

        // 6. 应用英雄速度加成
        const bonus = modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'world_speed', 1.0);
        this.moveSpeed *= bonus;

        // 7. 放置主城
        this.spawnMainCity();
    }

    initUI() {
        // 1. 设置左下角城市显示 (使用当前管理的城市数据)
        const cityData = worldManager.cities['main_city_1'];
        
        // 设置左下角城市名字 (显示稻香村)
        const cityDisplayName = document.getElementById('world-city-display-name');
        if (cityDisplayName) cityDisplayName.innerText = cityData.name;

        // 设置左下角城市图标 (对应 items.png 第一行第二个图标)
        const cityPortrait = document.getElementById('world-city-portrait');
        if (cityPortrait) {
            const iconStyle = spriteFactory.getIconStyle(cityData.getIconKey());
            Object.assign(cityPortrait.style, iconStyle);
        }

        // 2. 绑定主城界面关闭按钮
        document.getElementById('close-town-btn').onclick = () => {
            document.getElementById('town-management-panel').classList.add('hidden');
        };

        // 3. 绑定左下角卡片点击事件 (打开默认主城)
        const miniCard = document.getElementById('city-mini-card');
        if (miniCard) {
            miniCard.onclick = () => {
                this.openTownManagement('main_city_1');
            };
        }

        // 4. 初始化资源显示
        worldManager.updateHUD();
    }

    /**
     * 打开主城管理界面
     */
    openTownManagement(cityId) {
        const panel = document.getElementById('town-management-panel');
        const cityData = worldManager.cities[cityId];
        
        document.getElementById('town-name').innerHTML = `${cityData.name}<span>城市管理</span>`;
        panel.classList.remove('hidden');

        this.refreshTownUI(cityId);
    }

    /**
     * 刷新主城界面内容
     */
    refreshTownUI(cityId) {
        const cityData = worldManager.cities[cityId];
        
        // 1. 渲染建筑规划 (中间主体)
        ['economy', 'military', 'magic'].forEach(cat => {
            const container = document.getElementById(`build-cat-${cat}`);
            if (!container) return;
            container.innerHTML = '';
            
            cityData.buildings[cat].forEach(build => {
                const card = document.createElement('div');
                card.className = `building-card ${build.level === 0 ? 'locked' : ''}`;
                const isMax = build.level >= build.maxLevel;
                
                card.innerHTML = `
                    <div class="building-icon" style="${this.getIconStyleString(build.icon)}"></div>
                    <span class="building-name">${build.name} (Lv.${build.level})</span>
                    <span class="building-cost">${isMax ? '已满级' : `💰${build.cost.gold} 🪵${build.cost.wood}`}</span>
                `;
                
                card.onclick = () => {
                    if (isMax) return;
                    // 检查资源并升级
                    if (worldManager.resources.gold >= build.cost.gold && worldManager.resources.wood >= build.cost.wood) {
                        worldManager.resources.gold -= build.cost.gold;
                        worldManager.resources.wood -= build.cost.wood;
                        cityData.upgradeBuilding(cat, build.id);
                        worldManager.updateHUD();
                        this.refreshTownUI(cityId);
                    } else {
                        alert('资源不足，无法建设！');
                    }
                };
                container.appendChild(card);
            });
        });

        // 2. 驻留兵力与招募 (侧边栏与底部区域)
        const townUnitsList = document.getElementById('town-units-list');
        townUnitsList.innerHTML = '';
        for (const type in cityData.availableUnits) {
            const count = cityData.availableUnits[type];
            if (count > 0) {
                const slot = this.createArmySlot(type, count, () => {
                    worldManager.transferToHero(type, 1, cityId);
                    this.refreshTownUI(cityId);
                });
                townUnitsList.appendChild(slot);
            }
        }

        const recruitList = document.getElementById('town-recruit-list');
        recruitList.innerHTML = '';
        ['melee', 'ranged', 'tiance', 'chunyang'].forEach(type => {
            const item = document.createElement('div');
            item.className = 'recruit-item';
            const cost = worldManager.unitCosts[type].gold;
            item.innerHTML = `
                <div class="slot-icon" style="${this.getIconStyleString(type)}"></div>
                <div class="unit-info">
                    <span class="unit-name">${this.getUnitName(type)}</span>
                    <span class="unit-cost">💰${cost}</span>
                </div>
                <button class="wuxia-btn tiny-btn">招募</button>
            `;
            item.querySelector('button').onclick = (e) => {
                e.stopPropagation();
                if (worldManager.recruitUnit(type, cityId)) {
                    this.refreshTownUI(cityId);
                } else {
                    alert('金钱不足！');
                }
            };
            recruitList.appendChild(item);
        });

        // 3. 英雄队伍 (底部)
        const heroArmyList = document.getElementById('hero-army-list');
        heroArmyList.innerHTML = '';
        for (const type in worldManager.heroArmy) {
            const count = worldManager.heroArmy[type];
            if (count > 0) {
                const slot = this.createArmySlot(type, count, () => {
                    worldManager.transferToCity(type, 1, cityId);
                    this.refreshTownUI(cityId);
                });
                heroArmyList.appendChild(slot);
            }
        }
    }

    createArmySlot(type, count, onClick) {
        const slot = document.createElement('div');
        slot.className = 'unit-slot';
        slot.innerHTML = `
            <div class="slot-icon" style="${this.getIconStyleString(type)}"></div>
            <span class="slot-count">x${count}</span>
        `;
        slot.onclick = onClick;
        return slot;
    }

    getIconStyleString(type) {
        const style = spriteFactory.getIconStyle(type);
        return `background-image: ${style.backgroundImage}; background-position: ${style.backgroundPosition}; background-size: ${style.backgroundSize}; image-rendering: pixelated;`;
    }

    getUnitName(type) {
        const names = {
            'melee': '近战步兵',
            'ranged': '远程射手',
            'tiance': '天策骑兵',
            'chunyang': '纯阳弟子',
            'cangjian': '藏剑弟子',
            'cangyun': '苍云将士',
            'archer': '弓箭手',
            'healer': '补给兵'
        };
        return names[type] || type;
    }

    spawnMainCity() {
        // ... 保持原样 ...
        const city = spriteFactory.createUnitSprite('main_city');
        city.center.set(0.5, 0); 
        city.position.set(-10, 0, -10); 
        
        this.scene.add(city);
        this.interactables.push({ mesh: city, type: 'city', id: 'main_city_1' });
    }

    createGround() {
        // 创建一个巨大的水墨感草地
        const geometry = new THREE.PlaneGeometry(200, 200);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x557755,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 添加简单的网格辅助
        const grid = new THREE.GridHelper(200, 50, 0x445544, 0x334433);
        grid.position.y = 0.05;
        this.scene.add(grid);
    }

    createPlayer() {
        // 使用 SpriteFactory 创建主角
        this.playerHero = spriteFactory.createUnitSprite(this.heroId);
        this.playerHero.position.y = 0.8;
        this.scene.add(this.playerHero);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    start() {
        this.isActive = true;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        
        // 显示 World HUD (后续实现)
        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.remove('hidden');
    }

    stop() {
        this.isActive = false;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        
        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.add('hidden');
    }

    onKeyDown(e) { this.keys[e.key.toLowerCase()] = true; }
    onKeyUp(e) { this.keys[e.key.toLowerCase()] = false; }

    update(deltaTime) {
        if (!this.isActive || !this.playerHero) return;

        // 1. 处理移动输入
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.keys['w'] || this.keys['arrowup']) moveDir.z -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveDir.z += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveDir.x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveDir.x += 1;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            this.playerHero.position.addScaledVector(moveDir, this.moveSpeed);
            
            // 2. 处理面向翻转
            if (moveDir.x !== 0) {
                const config = spriteFactory.unitConfig[this.heroId];
                const defaultFacing = config.defaultFacing || 'right';
                const isMovingLeft = moveDir.x < 0;
                
                let shouldFlip = isMovingLeft ? (defaultFacing === 'right') : (defaultFacing === 'left');
                
                const texture = this.playerHero.material.map;
                const standardRepeatX = 1 / 4; // 这里暂时写死 4x4
                const flippedRepeatX = -1 / 4;
                const targetRepeatX = shouldFlip ? flippedRepeatX : standardRepeatX;
                
                if (texture.repeat.x !== targetRepeatX) {
                    texture.repeat.x = targetRepeatX;
                    texture.offset.x = shouldFlip ? (config.col / 4) : ((config.col - 1) / 4);
                    texture.needsUpdate = true;
                }
            }

            // 3. 移动后检测与主城的交互
            this.checkCityInteraction();
        }

        // 3. 相机平滑跟随
        const targetCamPos = this.playerHero.position.clone().add(new THREE.Vector3(0, 15, 12));
        this.camera.position.lerp(targetCamPos, 0.1);
        this.camera.lookAt(this.playerHero.position);
    }

    /**
     * 检测与主城的距离，触发交互
     */
    checkCityInteraction() {
        this.interactables.forEach(item => {
            if (item.type === 'city') {
                const dist = this.playerHero.position.distanceTo(item.mesh.position);
                const townPanel = document.getElementById('town-management-panel');
                
                // 当主角靠近主城 (距离 < 3.0) 且面板未打开时
                if (dist < 3.0) {
                    if (townPanel.classList.contains('hidden')) {
                        // 自动打开或通过交互提示打开，这里我们直接打开（符合用户“点击/进入”描述）
                        this.openTownManagement(item.id || 'main_city_1');
                    }
                } else {
                    // 离开范围自动关闭（可选，或者让用户手动点完成）
                    // townPanel.classList.add('hidden');
                }
            }
        });
    }
}

