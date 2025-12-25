import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { modifierManager } from '../core/ModifierManager.js';
import { worldManager } from '../core/WorldManager.js'; // 引入数据管家
import { SkillRegistry, SectSkills } from '../core/SkillSystem.js';
import { timeManager } from '../core/TimeManager.js';
import { mapGenerator, TILE_TYPES } from '../core/MapGenerator.js';
import { createWorldObject } from '../entities/WorldObjects.js';

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
        this.moveSpeed = 0.04; 
        
        // 交互控制
        this.interactables = [];
        this.activeCityId = null;        
        this.floatingStack = 0;          
        
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
    }

    /**
     * 初始化大世界
     * @param {string} heroId 选中的英雄 ID
     */
    init(heroId) {
        this.heroId = heroId;
        this.isActive = true; 

        // 1. 显示主世界 UI 容器
        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.remove('hidden');

        // 2. 从数据中心获取地图状态 (如果是新地图会在此生成)
        const mapState = worldManager.getOrGenerateWorld(mapGenerator);
        const mapData = mapState.grid;

        // 3. 渲染视觉表现
        this.createGround(mapData);
        this.createWater(mapGenerator.size);
        this.createPlayer();
        
        // 初始位置设定
        this.camera.position.set(this.playerHero.position.x, 15, this.playerHero.position.z + 12);
        this.camera.lookAt(this.playerHero.position);

        this.setupLights();
        this.initUI();
        
        const bonus = modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'world_speed', 1.0);
        this.moveSpeed *= bonus;

        // 4. 根据逻辑数据“摆放”物体
        this.renderWorldEntities(mapState.entities);

        // --- 初始化小地图 ---
        this.initMinimap();
    }

    /**
     * 根据逻辑数据在 3D 场景中生成实体
     */
    renderWorldEntities(entities) {
        entities.forEach(data => {
            if (data.isRemoved) return; // 跳过已被捡走的

            const worldObj = createWorldObject(data);
            worldObj.spawn(this.scene);
            
            if (worldObj.isInteractable) {
                this.interactables.push(worldObj);
            }
        });
    }

    initUI() {
        console.log("%c[UI] 正在初始化大世界 UI 监听器...", "color: #44aa44");
        
        // 基础信息初始化
        const cityData = worldManager.cities['main_city_1'];
        if (!cityData) {
            console.error("[UI] 找不到主城数据 'main_city_1'");
            return;
        }
        
        const cityDisplayName = document.getElementById('world-city-display-name');
        if (cityDisplayName) cityDisplayName.innerText = cityData.name;

        const cityPortrait = document.getElementById('world-city-portrait');
        if (cityPortrait) {
            const iconStyle = spriteFactory.getIconStyle(cityData.getIconKey());
            Object.assign(cityPortrait.style, iconStyle);
        }

        // 按钮点击事件
        const closeBtn = document.getElementById('close-town-panel');
        if (closeBtn) {
            closeBtn.onclick = () => {
                console.log("[UI] 手动关闭城镇面板");
                if (this.activeCityId) {
                    worldManager.mapState.interactionLocks.add(this.activeCityId);
                }
                this.closeTownManagement(); // 无论是否有 ID，强制执行关闭 UI 逻辑
            };
        }

        const miniCard = document.getElementById('city-mini-card');
        if (miniCard) {
            miniCard.onclick = () => {
                console.log("[UI] 点击左下角城镇头像");
                this.openTownManagement('main_city_1');
            };
        }

        const heroMiniCard = document.getElementById('hero-mini-card');
        if (heroMiniCard) {
            heroMiniCard.onclick = () => {
                console.log("[UI] 点击左下角英雄头像");
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
                this.renderLearnableSkills(worldManager.heroData.id === 'qijin' ? 'chunyang' : 'tiance'); 
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

        // 移除旧的监听器防止重复
        window.removeEventListener('hero-stats-changed', this._onHeroStatsChanged);
        this._onHeroStatsChanged = () => this.updateHeroHUD();
        window.addEventListener('hero-stats-changed', this._onHeroStatsChanged);

        window.removeEventListener('resource-gained', this._onResourceGained);
        this._onResourceGained = (e) => {
            if (!this.isActive || !this.playerHero) return;
            const { type, amount } = e.detail;
            this.spawnFloatingText(type, amount);
        };
        window.addEventListener('resource-gained', this._onResourceGained);

        worldManager.updateHUD();
        this.updateHeroHUD(); 

        this.setupTooltip();
    }

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

    openHeroStats() {
        const panel = document.getElementById('hero-stats-panel');
        const data = worldManager.heroData;
        
        // 填充数据
        document.getElementById('hero-panel-name').innerText = (data.id === 'qijin' ? '祁进' : '李承恩');
        document.getElementById('hero-panel-title').innerText = (data.id === 'qijin' ? '紫虚子' : '天策府统领');
        
        const portrait = document.getElementById('hero-panel-portrait');
        const iconStyle = spriteFactory.getIconStyle(data.id);
        Object.assign(portrait.style, iconStyle);
        
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

        document.getElementById('attr-atk').innerText = data.stats.atk + (data.level - 1) * 5;
        document.getElementById('attr-def').innerText = data.stats.def;
        document.getElementById('attr-speed').innerText = data.stats.speed.toFixed(2);
        
        document.getElementById('attr-primary-name').innerText = data.stats.primaryStatName;
        document.getElementById('attr-primary-val').innerText = data.stats.primaryStatValue;
        document.getElementById('attr-fali').innerText = data.stats.fali;
        document.getElementById('attr-haste').innerText = Math.floor(data.stats.haste * 100);
        
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
        
        if (!cityData) return;

        this.activeCityId = cityId; // 必须设置当前激活的城市 ID
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

    createGround(mapData) {
        const size = mapGenerator.size;
        const heightMap = worldManager.mapState.heightMap;
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
                    const diff = Math.abs(rawNoise + 0.15);
                    h = -1.5 - (diff * 8.4 + Math.pow(diff, 2) * 14.0); 
                } else if (type === TILE_TYPES.MOUNTAIN) {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const greyVal = 0.3 + (step * 0.3);
                    color.setRGB(greyVal, greyVal, greyVal * 1.1);
                    const diff = rawNoise - 0.20;
                    h = 2.0 + (diff * 14.0 + Math.pow(diff, 2) * 35.0); 
                } else {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const greenVal = 0.4 + (step * 0.2);
                    color.setRGB(greenVal * 0.4, greenVal, greenVal * 0.2);
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

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 16; i++) {
            for (let j = 0; j < 16; j++) {
                const noise = Math.random() * 40;
                const brightness = 210 + noise;
                ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
                ctx.fillRect(i, j, 1, 1);
            }
        }
        
        const terrainTex = new THREE.CanvasTexture(canvas);
        terrainTex.magFilter = THREE.NearestFilter;
        terrainTex.minFilter = THREE.NearestFilter;
        terrainTex.wrapS = terrainTex.wrapT = THREE.RepeatWrapping;
        terrainTex.repeat.set(size / 4, size / 4); 

        const material = new THREE.MeshStandardMaterial({ 
            map: terrainTex,
            vertexColors: true,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grid = new THREE.GridHelper(size, size / 10, 0x445544, 0x223322);
        grid.position.y = 0.1;
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.scene.add(grid);
    }

    createWater(size) {
        const geometry = new THREE.PlaneGeometry(size, size);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 256, 256);
        gradient.addColorStop(0, '#1e5ab6');
        gradient.addColorStop(0.5, '#2a6ed0');
        gradient.addColorStop(1, '#1e5ab6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 100; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const waterTex = new THREE.CanvasTexture(canvas);
        waterTex.magFilter = THREE.NearestFilter;
        waterTex.minFilter = THREE.NearestFilter;
        waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
        waterTex.repeat.set(size / 8, size / 8); 
        this.waterTex = waterTex;

        const material = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            map: waterTex,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2,
            metalness: 0.3,
            side: THREE.DoubleSide,
            flatShading: true
        });

        const water = new THREE.Mesh(geometry, material);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.8; 
        this.scene.add(water);
    }

    createPlayer() {
        this.playerHero = spriteFactory.createUnitSprite(this.heroId);
        const pos = worldManager.mapState.playerPos;
        this.playerHero.position.set(pos.x, 0.8, pos.z);
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

        // 显示小地图
        const minimap = document.querySelector('.minimap-container');
        if (minimap) minimap.classList.remove('hidden');

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

        // 隐藏小地图
        const minimap = document.querySelector('.minimap-container');
        if (minimap) minimap.classList.add('hidden');
    }

    onKeyDown(e) { this.keys[e.key.toLowerCase()] = true; }
    onKeyUp(e) { this.keys[e.key.toLowerCase()] = false; }

    update(deltaTime) {
        if (!this.isActive || !this.playerHero) return;

        if (this.waterTex) {
            this.waterTex.offset.x += 0.005 * deltaTime;
            this.waterTex.offset.y += 0.002 * deltaTime;
        }

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

        // --- 更新小地图 ---
        this.updateExploration(); // 更新探索迷雾数据
        this.updateMinimap();

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

    onBattleEnd(result) {
        const ms = worldManager.mapState;
        const enemyId = ms.pendingBattleEnemyId;
        
        if (!enemyId) return;

        console.log(`%c[战斗结束] 结果: ${result.winner}, 目标: ${enemyId}`, "color: #ffaa00");

        if (result && result.winner === 'player') {
            // 赢了：移除怪物
            worldManager.removeEntity(enemyId);
            const item = this.interactables.find(i => i.id === enemyId);
            if (item) this.scene.remove(item.mesh);
            this.interactables = this.interactables.filter(i => i.id !== enemyId);
            // 赢了不需要锁定，因为怪已经没了
        } else {
            // 输了或逃了：锁定怪物，防止连续触发
            ms.interactionLocks.add(enemyId);
        }
        
        ms.pendingBattleEnemyId = null; 
    }

    checkInteractions() {
        const toRemove = [];
        const playerPos = this.playerHero.position;
        const ms = worldManager.mapState;

        this.interactables.forEach((item, index) => {
            const dist = playerPos.distanceTo(item.mesh.position);
            const isLocked = ms.interactionLocks.has(item.id);

            if (isLocked) {
                const exitDist = item.interactionRadius * 1.5; // 动态解锁半径
                if (dist > exitDist) {
                    ms.interactionLocks.delete(item.id);
                }
                return;
            }

            if (item.canInteract(playerPos)) {
                const shouldRemove = item.onInteract(this);
                if (shouldRemove) {
                    toRemove.push(index);
                }
            } else if (item.onExitRange) {
                item.onExitRange(this);
            }
        });

        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.interactables.splice(toRemove[i], 1);
        }
    }

    closeTownManagement() {
        const panel = document.getElementById('town-management-panel');
        if (panel) panel.classList.add('hidden');
        this.activeCityId = null;
    }

    /**
     * 初始化小地图系统
     */
    initMinimap() {
        // --- 开发开关：一键开启/关闭迷雾 ---
        this.enableFog = false; 

        let container = document.querySelector('.minimap-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'minimap-container';
            container.innerHTML = `<canvas id="minimap-canvas"></canvas>`;
            document.body.appendChild(container);
        }

        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        const size = mapGenerator.size;
        this.cropMargin = 20; // 边缘裁剪宽度
        const displaySize = size - this.cropMargin * 2;
        
        this.minimapCanvas.width = displaySize;
        this.minimapCanvas.height = displaySize;

        // 预渲染静态地形层
        this.offscreenMap = document.createElement('canvas');
        this.offscreenMap.width = size;
        this.offscreenMap.height = size;
        mapGenerator.debugDraw(this.offscreenMap);

        // 创建迷雾遮罩 Canvas (用于渲染探索状态)
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = displaySize;
        this.fogCanvas.height = displaySize;
        this.fogCtx = this.fogCanvas.getContext('2d');
    }

    /**
     * 更新探索区域
     */
    updateExploration() {
        if (!this.playerHero) return;
        
        const ms = worldManager.mapState;
        const size = mapGenerator.size;
        const halfSize = size / 2;
        
        // 获取玩家在 0-400 坐标系下的位置
        const px = Math.round(this.playerHero.position.x + halfSize);
        const pz = Math.round(this.playerHero.position.z + halfSize);
        
        const revealRadius = 33; // 探索半径 (增大 30% 从 25 -> 33)
        
        // 标记已探索
        for (let dz = -revealRadius; dz <= revealRadius; dz++) {
            for (let dx = -revealRadius; dx <= revealRadius; dx++) {
                if (dx * dx + dz * dz > revealRadius * revealRadius) continue;
                
                const nx = px + dx;
                const nz = pz + dz;
                
                if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
                    ms.exploredMap[nz * size + nx] = 1;
                }
            }
        }
    }

    /**
     * 每帧更新小地图动态标记
     */
    updateMinimap() {
        if (!this.minimapCtx || !this.playerHero) return;

        const size = mapGenerator.size;
        const ctx = this.minimapCtx;
        const margin = this.cropMargin || 0;
        const displaySize = size - margin * 2;
        const ms = worldManager.mapState;

        // 1. 如果开启了迷雾，则在内存中构建迷雾遮罩图
        if (this.enableFog) {
            const fCtx = this.fogCtx;
            const fogData = fCtx.createImageData(displaySize, displaySize);
            for (let y = 0; y < displaySize; y++) {
                for (let x = 0; x < displaySize; x++) {
                    const gridX = x + margin;
                    const gridZ = y + margin;
                    const isExplored = ms.exploredMap[gridZ * size + gridX];
                    
                    const idx = (y * displaySize + x) * 4;
                    if (isExplored) {
                        fogData.data[idx] = 0;
                        fogData.data[idx+1] = 0;
                        fogData.data[idx+2] = 0;
                        fogData.data[idx+3] = 0;
                    } else {
                        fogData.data[idx] = 0;
                        fogData.data[idx+1] = 0;
                        fogData.data[idx+2] = 0;
                        fogData.data[idx+3] = 255;
                    }
                }
            }
            fCtx.putImageData(fogData, 0, 0);
        }

        // 2. 绘制地形层 (底图)
        ctx.clearRect(0, 0, displaySize, displaySize);
        ctx.drawImage(this.offscreenMap, margin, margin, displaySize, displaySize, 0, 0, displaySize, displaySize);

        // 3. 如果开启了迷雾，盖上迷雾层
        if (this.enableFog) {
            ctx.drawImage(this.fogCanvas, 0, 0);
        }

        // 4. 坐标转换工具 (World -> Minimap)
        const worldToMinimap = (wx, wz) => {
            const halfSize = size / 2;
            return {
                x: (wx + halfSize) - margin,
                y: (wz + halfSize) - margin
            };
        };

        // 5. 绘制重要建筑 (如果关闭迷雾，则始终显示)
        this.interactables.forEach(item => {
            if (item.type === 'city' || item.type === 'captured_building') {
                let shouldShow = true;
                if (this.enableFog) {
                    const gridX = Math.round(item.mesh.position.x + size/2);
                    const gridZ = Math.round(item.mesh.position.z + size/2);
                    shouldShow = ms.exploredMap[gridZ * size + gridX];
                }
                
                if (shouldShow) {
                    const pos = worldToMinimap(item.mesh.position.x, item.mesh.position.z);
                    if (pos.x >= 0 && pos.x <= displaySize && pos.y >= 0 && pos.y <= displaySize) {
                        ctx.fillStyle = (item.type === 'city') ? '#ffcc00' : '#00ffff';
                        ctx.beginPath();
                        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }
        });

        // 6. 绘制玩家位置 (白色点)
        const playerPos = worldToMinimap(this.playerHero.position.x, this.playerHero.position.z);
        if (playerPos.x >= 0 && playerPos.x <= displaySize && playerPos.y >= 0 && playerPos.y <= displaySize) {
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.arc(playerPos.x, playerPos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}
