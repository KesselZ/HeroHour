import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { modifierManager } from '../core/ModifierManager.js';
import { worldManager } from '../core/WorldManager.js'; // 引入数据管家
import { SkillRegistry, SectSkills } from '../core/SkillSystem.js';
import { timeManager } from '../core/TimeManager.js';
import { mapGenerator, TILE_TYPES } from '../core/MapGenerator.js';

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
        this.activeCityId = null;       // 当前正打开 UI 的城市
        this.manuallyClosedCityId = null; // 玩家刚刚手动关闭的城市（离开范围前不再弹窗）
        this.floatingStack = 0;         // 当前正在飘字的层数，用于防重叠
        
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
    }

    /**
     * 初始化大世界
     * @param {string} heroId 选中的英雄 ID
     */
    init(heroId) {
        this.heroId = heroId;
        this.isActive = true; // 确保场景激活

        // 1. 显示主世界 UI 容器
        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.remove('hidden');

        // 2. 从数据中心获取地图状态 (如果是新地图会在此生成)
        const mapState = worldManager.getOrGenerateWorld(mapGenerator);
        const mapData = mapState.grid;

        // 3. 渲染视觉表现
        this.createGround(mapData);
        this.createPlayer();
        
        // 恢复玩家位置
        if (mapState.playerPos.x !== 0 || mapState.playerPos.z !== 0) {
            this.playerHero.position.set(mapState.playerPos.x, 0.8, mapState.playerPos.z);
        }

        this.setupLights();
        this.initUI();
        
        // 相机初始位置跟随主角
        this.camera.position.set(this.playerHero.position.x, 15, this.playerHero.position.z + 12);
        this.camera.lookAt(this.playerHero.position);

        const bonus = modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'world_speed', 1.0);
        this.moveSpeed *= bonus;

        // 4. 根据逻辑数据“摆放”物体
        this.renderWorldEntities(mapState.entities);

        // --- 调试功能：显示噪声预览图 ---
        this.showNoiseDebugOverlay();

        // 主城这种特殊地标依然手动管理
        this.spawnMainCity();

        // 在主城附近放置一个测试用的山贼组
        this.spawnEnemyGroup('bandits', -5, 5); 
    }

    /**
     * 根据逻辑数据在 3D 场景中生成实体
     */
    renderWorldEntities(entities) {
        entities.forEach(data => {
            if (data.isRemoved) return; // 跳过已被捡走的

            switch (data.type) {
                case 'decoration':
                    this.spawnDecoration(data.spriteKey, data.x, data.z);
                    break;
                case 'pickup':
                    this.spawnPickup(data.pickupType, data.x, data.z, data.id);
                    break;
                case 'captured_building':
                    this.spawnCapturedBuilding(data.spriteKey, data.buildingType, data.x, data.z, data.id, data.config);
                    break;
            }
        });
    }

    /**
     * 重写 spawnPickup 以支持持久化 ID
     */
    spawnPickup(key, x, z, id = null) {
        const sprite = spriteFactory.createUnitSprite(key);
        sprite.position.set(x, 0.8, z);
        this.scene.add(sprite);
        this.interactables.push({
            id: id || `${key}_${Math.floor(x)}_${Math.floor(z)}`,
            mesh: sprite,
            type: 'pickup',
            pickupType: key
        });
    }

    /**
     * 重写 spawnCapturedBuilding 以支持状态恢复
     */
    spawnCapturedBuilding(spriteKey, buildingType, x, z, id = null, config = null) {
        const sprite = spriteFactory.createUnitSprite(spriteKey);
        sprite.position.set(x, 1.2, z);
        this.scene.add(sprite);
        this.interactables.push({
            id: id || `${buildingType}_${Math.floor(x)}_${Math.floor(z)}`,
            mesh: sprite,
            type: 'captured_building',
            config: config || {
                type: buildingType,
                owner: 'none'
            }
        });
    }

    initUI() {
        // ... 原有初始化代码 ...
        const cityData = worldManager.cities['main_city_1'];
        
        const cityDisplayName = document.getElementById('world-city-display-name');
        if (cityDisplayName) cityDisplayName.innerText = cityData.name;

        const cityPortrait = document.getElementById('world-city-portrait');
        if (cityPortrait) {
            const iconStyle = spriteFactory.getIconStyle(cityData.getIconKey());
            Object.assign(cityPortrait.style, iconStyle);
        }

        const closeBtn = document.getElementById('close-town-panel');
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.getElementById('town-management-panel').classList.add('hidden');
                // 记录手动关闭状态
                this.manuallyClosedCityId = this.activeCityId;
                this.activeCityId = null;
            };
        }

        const miniCard = document.getElementById('city-mini-card');
        if (miniCard) {
            miniCard.onclick = () => {
                this.openTownManagement('main_city_1');
            };
        }

        const heroMiniCard = document.getElementById('hero-mini-card');
        if (heroMiniCard) {
            heroMiniCard.onclick = () => {
                this.openHeroStats();
            };
        }

        const closeHeroBtn = document.getElementById('close-hero-panel');
        if (closeHeroBtn) {
            closeHeroBtn.onclick = () => {
                document.getElementById('hero-stats-panel').classList.add('hidden');
            };
        }

        // --- 招式学习逻辑 ---
        const skillLearnBtn = document.getElementById('open-skill-learn-btn');
        const skillLearnPanel = document.getElementById('skill-learn-panel');
        const closeSkillLearnBtn = document.getElementById('close-skill-learn');

        if (skillLearnBtn) {
            skillLearnBtn.onclick = () => {
                skillLearnPanel.classList.remove('hidden');
                this.renderLearnableSkills('chunyang'); // 默认显示纯阳
            };
        }

        if (closeSkillLearnBtn) {
            closeSkillLearnBtn.onclick = () => {
                skillLearnPanel.classList.add('hidden');
            };
        }

        // 标签切换
        const tabs = document.querySelectorAll('.skill-learn-tabs .tab-btn');
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.renderLearnableSkills(tab.dataset.sect);
            };
        });

        // 监听英雄状态变化事件
        window.addEventListener('hero-stats-changed', () => {
            this.updateHeroHUD();
        });

        // 监听资源获得事件，触发大世界飘字
        window.addEventListener('resource-gained', (e) => {
            if (!this.isActive || !this.playerHero) return;
            const { type, amount } = e.detail;
            this.spawnFloatingText(type, amount);
        });

        worldManager.updateHUD();
        this.updateHeroHUD(); // 初始化英雄头像

        // 初始化提示框逻辑
        this.setupTooltip();
    }

    /**
     * 更新左下角英雄 HUD
     */
    updateHeroHUD() {
        const heroPortrait = document.getElementById('world-hero-portrait');
        const hpBar = document.getElementById('hud-hero-hp-bar');
        const mpBar = document.getElementById('hud-hero-mp-bar');
        
        const heroData = worldManager.heroData;
        
        if (heroPortrait) {
            const iconStyle = spriteFactory.getIconStyle(heroData.id);
            Object.assign(heroPortrait.style, iconStyle);
        }

        if (hpBar) {
            const hpPct = (heroData.hpCurrent / heroData.hpMax) * 100;
            hpBar.style.width = `${hpPct}%`;
        }

        if (mpBar) {
            const mpPct = (heroData.mpCurrent / heroData.mpMax) * 100;
            mpBar.style.width = `${mpPct}%`;
        }
    }

    /**
     * 打开英雄属性面板
     */
    openHeroStats() {
        const panel = document.getElementById('hero-stats-panel');
        const data = worldManager.heroData;
        
        // 填充数据
        document.getElementById('hero-panel-name').innerText = (data.id === 'qijin' ? '祁进' : '李承恩');
        document.getElementById('hero-panel-title').innerText = (data.id === 'qijin' ? '紫虚子' : '天策府统领');
        
        // 肖像
        const portrait = document.getElementById('hero-panel-portrait');
        const iconStyle = spriteFactory.getIconStyle(data.id);
        Object.assign(portrait.style, iconStyle);
        
        // 进度条
        const xpPct = (data.xp / data.xpMax) * 100;
        const hpPct = (data.hpCurrent / data.hpMax) * 100;
        const mpPct = (data.mpCurrent / data.mpMax) * 100;
        
        document.getElementById('hero-xp-bar').style.width = `${xpPct}%`;
        document.getElementById('hero-hp-bar').style.width = `${hpPct}%`;
        document.getElementById('hero-mp-bar').style.width = `${mpPct}%`;
        
        document.getElementById('hero-xp-text').innerText = `${data.xp}/${data.xpMax}`;
        document.getElementById('hero-hp-text').innerText = `${Math.floor(data.hpCurrent)}/${data.hpMax}`;
        document.getElementById('hero-mp-text').innerText = `${data.mpCurrent}/${data.mpMax}`;
        
        const levelDisplay = document.getElementById('hero-level-val');
        if (levelDisplay) levelDisplay.innerText = data.level;

        const spDisplay = document.getElementById('hero-skill-points');
        if (spDisplay) spDisplay.innerText = data.skillPoints;

        // 基础属性
        document.getElementById('attr-atk').innerText = data.stats.atk + (data.level - 1) * 5;
        document.getElementById('attr-def').innerText = data.stats.def;
        document.getElementById('attr-speed').innerText = data.stats.speed.toFixed(2);
        
        // 扩展属性
        document.getElementById('attr-primary-name').innerText = data.stats.primaryStatName;
        document.getElementById('attr-primary-val').innerText = data.stats.primaryStatValue;
        document.getElementById('attr-fali').innerText = data.stats.fali;
        document.getElementById('attr-haste').innerText = Math.floor(data.stats.haste * 100);
        
        // 渲染技能列表
        const skillsContainer = document.getElementById('hero-panel-skills');
        skillsContainer.innerHTML = '';
        data.skills.forEach(skillId => {
            const skill = SkillRegistry[skillId];
            if (!skill) return;

            const slot = document.createElement('div');
            slot.className = 'hero-skill-slot';
            
            const iconStyle = spriteFactory.getIconStyle(skill.icon);
            slot.innerHTML = `
                <div class="skill-icon-small" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
            `;

            slot.onmouseenter = () => {
                const actualCD = (skill.cooldown * (1 - (data.stats.haste || 0)) / 1000).toFixed(1);
                this.showTooltip({
                    name: skill.name,
                    level: `消耗: ${skill.cost} 内力`,
                    effect: `冷却: ${actualCD} 秒 (原始: ${skill.cooldown / 1000}s)`,
                    description: skill.description
                });
            };
            slot.onmouseleave = () => this.hideTooltip();

            skillsContainer.appendChild(slot);
        });

        panel.classList.remove('hero-panel-v3');
        panel.classList.add('hero-panel-v4');
        panel.classList.remove('hidden');
    }

    /**
     * 渲染可学习招式列表
     */
    renderLearnableSkills(sect) {
        const container = document.getElementById('skill-list-to-learn');
        if (!container) return;

        container.innerHTML = '';
        const skillIds = SectSkills[sect] || [];
        const heroData = worldManager.heroData;

        const panelSpDisplay = document.getElementById('learn-panel-sp');
        if (panelSpDisplay) panelSpDisplay.innerText = heroData.skillPoints;

        skillIds.forEach(id => {
            const skill = SkillRegistry[id];
            if (!skill) return;

            const isOwned = heroData.skills.includes(id);
            const item = document.createElement('div');
            item.className = `learn-item ${isOwned ? 'owned' : ''}`;

            const iconStyle = spriteFactory.getIconStyle(skill.icon);
            item.innerHTML = `
                <div class="skill-learn-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                <div class="skill-learn-name">${skill.name}</div>
                ${!isOwned ? `<button class="wuxia-btn-small buy-skill-btn" data-id="${id}">研习</button>` : ''}
            `;

            const buyBtn = item.querySelector('.buy-skill-btn');
            if (buyBtn) {
                buyBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (heroData.skillPoints > 0) {
                        heroData.skillPoints--;
                        heroData.skills.push(id);
                        this.renderLearnableSkills(sect); 
                        this.openHeroStats(); 
                        console.log(`%c[习得] %c成功研习招式：${skill.name}`, 'color: #d4af37; font-weight: bold', 'color: #fff');
                    } else {
                        worldManager.showNotification("技能点不足，请通过战斗升级获取技能点！");
                    }
                };
            }

            container.appendChild(item);
        });
    }

    setupTooltip() {
        this.tooltip = document.getElementById('game-tooltip');
        if (!this.tooltip) return;
        
        this.tooltipTitle = this.tooltip.querySelector('.tooltip-title');
        this.tooltipLevel = this.tooltip.querySelector('.tooltip-level');
        this.tooltipEffect = this.tooltip.querySelector('.tooltip-effect');
        this.tooltipDesc = this.tooltip.querySelector('.tooltip-desc');

        window.addEventListener('mousemove', (e) => {
            if (!this.tooltip.classList.contains('hidden')) {
                const x = e.clientX + 15;
                const y = e.clientY + 15;
                const tooltipWidth = this.tooltip.offsetWidth;
                const tooltipHeight = this.tooltip.offsetHeight;
                
                const finalX = (x + tooltipWidth > window.innerWidth) ? (e.clientX - tooltipWidth - 15) : x;
                const finalY = (y + tooltipHeight > window.innerHeight) ? (e.clientY - tooltipHeight - 15) : y;
                
                this.tooltip.style.left = `${finalX}px`;
                this.tooltip.style.top = `${finalY}px`;
            }
        });
    }

    showTooltip(data) {
        if (!this.tooltip) return;
        this.tooltipTitle.innerText = data.name;
        this.tooltipLevel.innerText = `当前等级: ${data.level} / ${data.maxLevel}`;
        this.tooltipEffect.innerText = `● ${data.effect}`;
        this.tooltipDesc.innerText = data.description;
        this.tooltip.classList.remove('hidden');
    }

    hideTooltip() {
        if (this.tooltip) this.tooltip.classList.add('hidden');
    }

    openTownManagement(cityId) {
        const panel = document.getElementById('town-management-panel');
        const cityData = worldManager.cities[cityId];
        
        document.getElementById('town-name').innerText = cityData.name;
        panel.classList.remove('hidden');

        this.refreshTownUI(cityId);
    }

    refreshTownUI(cityId) {
        const cityData = worldManager.cities[cityId];
        
        ['economy', 'military', 'magic'].forEach(cat => {
            const container = document.getElementById(`build-cat-${cat}`);
            if (!container) return;
            container.innerHTML = '';
            
            cityData.buildings[cat].forEach(build => {
                const card = document.createElement('div');
                const isMax = build.level >= build.maxLevel;
                card.className = `building-card lv-${build.level} ${isMax ? 'is-max' : ''}`;
                
                card.innerHTML = `
                    <div class="building-icon" style="${this.getIconStyleString(build.icon)}"></div>
                    <span class="building-name">${build.name}</span>
                    <span class="building-cost">${isMax ? '已满级' : `💰${build.cost.gold} 🪵${build.cost.wood}`}</span>
                `;
                
                card.onmouseenter = () => this.showTooltip(build);
                card.onmouseleave = () => this.hideTooltip();

                card.onclick = () => {
                    if (isMax) return;
                    const goldCost = build.cost.gold;
                    const woodCost = build.cost.wood;

                    if (worldManager.resources.gold >= goldCost && worldManager.resources.wood >= woodCost) {
                        worldManager.spendGold(goldCost);
                        worldManager.spendWood(woodCost);
                        cityData.upgradeBuilding(cat, build.id);
                        this.refreshTownUI(cityId);
                    } else {
                        worldManager.showNotification('资源不足，无法建设！');
                    }
                };
                container.appendChild(card);
            });
        });

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
        const availableRecruits = worldManager.getAvailableRecruits(cityId);
        
        availableRecruits.forEach(unitInfo => {
            const type = unitInfo.type;
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
                    worldManager.showNotification('金钱不足！');
                }
            };
            recruitList.appendChild(item);
        });

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
            'melee': '天策弟子',
            'ranged': '长歌弟子',
            'tiance': '天策骑兵',
            'chunyang': '纯阳弟子',
            'cangjian': '藏剑弟子',
            'cangyun': '苍云将士',
            'archer': '唐门射手',
            'healer': '万花补给'
        };
        return names[type] || type;
    }

    spawnMainCity() {
        const city = spriteFactory.createUnitSprite('main_city');
        city.center.set(0.5, 0); 
        city.position.set(-10, 0, -10); 
        this.scene.add(city);
        this.interactables.push({ mesh: city, type: 'city', id: 'main_city_1' });
    }

    spawnEnemyGroup(templateId, x, z) {
        const template = worldManager.enemyTemplates[templateId];
        if (!template) return;

        const groupSprite = spriteFactory.createUnitSprite(template.overworldIcon);
        groupSprite.position.set(x, 0.8, z);
        this.scene.add(groupSprite);

        const points = Math.floor(
            Math.random() * (template.pointRange[1] - template.pointRange[0] + 1)
        ) + template.pointRange[0];

        this.interactables.push({
            mesh: groupSprite,
            type: 'enemy_group',
            config: {
                name: template.name,
                unitPool: template.unitPool,
                totalPoints: points
            }
        });
    }

    createGround(mapData) {
        const size = mapGenerator.size;
        const heightMap = worldManager.mapState.heightMap;
        // 增加分段数，让高度变化更平滑
        const geometry = new THREE.PlaneGeometry(size, size, size, size);
        
        const colors = [];
        const color = new THREE.Color();
        const vertices = geometry.attributes.position.array;

        for (let z = 0; z <= size; z++) {
            for (let x = 0; x <= size; x++) {
                const gridX = Math.min(x, size - 1);
                const gridZ = Math.min(z, size - 1);
                const type = mapData[gridZ][gridX];
                const rawNoise = heightMap[gridZ][gridX];

                let h = 0;
                if (type === TILE_TYPES.WATER) {
                    color.setHex(0x1a3a6d);
                    // 同步阈值 0.15，且深度降低 30%
                    const diff = Math.abs(rawNoise + 0.15);
                    h = -1.5 - (diff * 8.4 + Math.pow(diff, 2) * 14.0); 
                } else if (type === TILE_TYPES.MOUNTAIN) {
                    color.setHex(0x5a5a5a);
                    // 同步阈值 0.20，且高度降低 30% (从 20/50 降至 14/35)
                    const diff = rawNoise - 0.20;
                    h = 2.0 + (diff * 14.0 + Math.pow(diff, 2) * 35.0); 
                } else {
                    color.setHex(0x4a7c44);
                    h = 0;
                }
                
                const idx = (z * (size + 1) + x) * 3;
                vertices[idx + 2] = h;

                colors.push(color.r, color.g, color.b);
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 辅助网格：规模扩大后，网格间距也适当调大，保持画面清爽
        const grid = new THREE.GridHelper(size, size / 10, 0x445544, 0x223322);
        grid.position.y = 0.1;
        grid.material.opacity = 0.1;
        grid.material.transparent = true;
        this.scene.add(grid);
    }

    createPlayer() {
        this.playerHero = spriteFactory.createUnitSprite(this.heroId);
        this.playerHero.position.y = 0.8;
        this.scene.add(this.playerHero);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.6); 
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    start() {
        this.isActive = true;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        
        const hud = document.getElementById('world-ui');
        if (hud) {
            hud.classList.remove('hidden');
            worldManager.updateHUD();
            this.updateHeroHUD();
        }

        timeManager.updateUI();
    }

    stop() {
        this.isActive = false;
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        
        if (this.playerHero) {
            worldManager.savePlayerPos(this.playerHero.position.x, this.playerHero.position.z);
        }

        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.add('hidden');
    }

    onKeyDown(e) { this.keys[e.key.toLowerCase()] = true; }
    onKeyUp(e) { this.keys[e.key.toLowerCase()] = false; }

    update(deltaTime) {
        if (!this.isActive || !this.playerHero) return;

        const seasonChanged = timeManager.update();
        if (seasonChanged) {
            worldManager.processResourceProduction();
        }

        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.keys['w'] || this.keys['arrowup']) moveDir.z -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveDir.z += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveDir.x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveDir.x += 1;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            const nextPos = this.playerHero.position.clone().addScaledVector(moveDir, this.moveSpeed);
            
            if (mapGenerator.isPassable(nextPos.x, nextPos.z)) {
                this.playerHero.position.copy(nextPos);
            } else {
                const nextPosX = this.playerHero.position.clone().add(new THREE.Vector3(moveDir.x * this.moveSpeed, 0, 0));
                if (mapGenerator.isPassable(nextPosX.x, nextPosX.z)) {
                    this.playerHero.position.copy(nextPosX);
                }
                const nextPosZ = this.playerHero.position.clone().add(new THREE.Vector3(0, 0, moveDir.z * this.moveSpeed));
                if (mapGenerator.isPassable(nextPosZ.x, nextPosZ.z)) {
                    this.playerHero.position.copy(nextPosZ);
                }
            }
            
            if (moveDir.x !== 0) {
                const config = spriteFactory.unitConfig[this.heroId];
                const defaultFacing = config.defaultFacing || 'right';
                const isMovingLeft = moveDir.x < 0;
                let shouldFlip = isMovingLeft ? (defaultFacing === 'right') : (defaultFacing === 'left');
                const texture = this.playerHero.material.map;
                const standardRepeatX = 1 / 4; 
                const flippedRepeatX = -1 / 4;
                const targetRepeatX = shouldFlip ? flippedRepeatX : standardRepeatX;
                if (texture.repeat.x !== targetRepeatX) {
                    texture.repeat.x = targetRepeatX;
                    texture.offset.x = shouldFlip ? (config.col / 4) : ((config.col - 1) / 4);
                    texture.needsUpdate = true;
                }
            }
            this.checkInteractions();
        }

        const targetCamPos = this.playerHero.position.clone().add(new THREE.Vector3(0, 15, 12));
        this.camera.position.lerp(targetCamPos, 0.1);
        this.camera.lookAt(this.playerHero.position);
    }

    spawnFloatingText(type, amount) {
        const textEl = document.createElement('div');
        textEl.className = 'floating-text';
        this.floatingStack++;
        const currentStack = this.floatingStack;
        let color = '#ffffff';
        let prefix = '';
        
        switch (type) {
            case 'gold': color = '#ffcc00'; prefix = '💰 +'; break;
            case 'wood': color = '#deb887'; prefix = '🪵 +'; break;
            case 'xp': color = '#00ffcc'; prefix = '✨ XP +'; break;
        }
        
        textEl.style.color = color;
        textEl.innerText = `${prefix}${amount}`;
        
        const vector = new THREE.Vector3();
        this.playerHero.getWorldPosition(vector);
        vector.y += 2.2; 
        vector.project(this.camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        
        const stackYOffset = (currentStack - 1) * 35; 
        const randomXOffset = (Math.random() - 0.5) * 40; 
        
        textEl.style.left = `${x + randomXOffset}px`;
        textEl.style.top = `${y - stackYOffset}px`;
        
        document.getElementById('ui-layer').appendChild(textEl);
        
        setTimeout(() => {
            this.floatingStack = Math.max(0, this.floatingStack - 1);
        }, 800);
        
        setTimeout(() => {
            if (textEl.parentNode) {
                textEl.parentNode.removeChild(textEl);
            }
        }, 1500);
    }

    checkInteractions() {
        const toRemove = [];
        this.interactables.forEach((item, index) => {
            const dist = this.playerHero.position.distanceTo(item.mesh.position);
            
            if (item.type === 'city') {
                const cityId = item.id || 'main_city_1';
                if (dist < 3.0) {
                    if (this.activeCityId !== cityId && this.manuallyClosedCityId !== cityId) {
                        this.openTownManagement(cityId);
                        this.activeCityId = cityId;
                    }
                } else {
                    if (this.activeCityId === cityId) {
                        document.getElementById('town-management-panel').classList.add('hidden');
                        this.activeCityId = null;
                    }
                    if (this.manuallyClosedCityId === cityId) {
                        this.manuallyClosedCityId = null;
                    }
                }
            } else if (item.type === 'enemy_group') {
                if (dist < 1.5) {
                    window.dispatchEvent(new CustomEvent('start-battle', { detail: item.config }));
                }
            } else if (item.type === 'pickup') {
                if (dist < 1.2) {
                    worldManager.handlePickup(item.pickupType);
                    worldManager.removeEntity(item.id); 
                    this.scene.remove(item.mesh);
                    toRemove.push(index);
                }
            } else if (item.type === 'captured_building') {
                if (dist < 2.0) {
                    worldManager.handleCapture(item);
                }
            }
        });

        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.interactables.splice(toRemove[i], 1);
        }
    }

    spawnDecoration(key, x, z) {
        const sprite = spriteFactory.createUnitSprite(key);
        sprite.position.set(x, 0.8, z);
        this.scene.add(sprite);
    }

    /**
     * 在屏幕右上角创建一个调试 Canvas 展现噪声图
     */
    showNoiseDebugOverlay() {
        let canvas = document.getElementById('noise-debug-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'noise-debug-canvas';
            canvas.style.position = 'fixed';
            canvas.style.top = '10px';
            canvas.style.right = '10px';
            canvas.style.width = '200px';
            canvas.style.height = '200px';
            canvas.style.zIndex = '9999';
            canvas.style.border = '2px solid white';
            canvas.style.backgroundColor = 'black';
            canvas.style.imageRendering = 'pixelated';
            document.body.appendChild(canvas);
        }
        mapGenerator.debugDraw(canvas);
    }
}
