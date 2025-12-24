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
        // 1. 生成随机地图蓝图
        const mapData = mapGenerator.generate(100);

        this.heroId = heroId;
        this.createGround(mapData);
        this.createPlayer();
        this.setupLights();
        this.initUI();
        this.camera.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);

        const bonus = modifierManager.getModifiedValue({ side: 'player', type: 'hero' }, 'world_speed', 1.0);
        this.moveSpeed *= bonus;

        // 7. 放置交互物体
        this.spawnMainCity();

        // 根据地图蓝图随机分布一些物体 (每 10 格尝试生成一次)
        this.randomizeWorldObjects();

        // 在主城附近放置一个测试用的山贼组 (坐标: -5, 5)
        this.spawnEnemyGroup('bandits', -5, 5); 
    }

    /**
     * 根据生成的地图蓝图随机分布资源
     */
    randomizeWorldObjects() {
        const size = mapGenerator.size;
        const halfSize = size / 2;

        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const type = mapGenerator.grid[z][x];
                if (type !== TILE_TYPES.GRASS) continue;

                // 计算世界坐标
                const worldX = x - halfSize;
                const worldZ = z - halfSize;

                // 避开出生点区域 (稻香村在 -10, -10 附近)
                const distToStart = Math.sqrt(Math.pow(worldX + 10, 2) + Math.pow(worldZ + 10, 2));
                if (distToStart < 8) continue;

                const roll = Math.random();
                if (roll < 0.01) {
                    this.spawnPickup('gold_pile', worldX, worldZ);
                } else if (roll < 0.015) {
                    this.spawnPickup('chest', worldX, worldZ);
                } else if (roll < 0.02) {
                    this.spawnPickup('wood_small', worldX, worldZ);
                } else if (roll < 0.025) {
                    this.spawnCapturedBuilding(Math.random() > 0.5 ? 'gold_mine_world' : 'sawmill_world', 
                                             Math.random() > 0.5 ? 'gold_mine' : 'sawmill', worldX, worldZ);
                } else if (roll < 0.05) {
                    this.spawnDecoration('tree', worldX, worldZ);
                } else if (roll < 0.055) {
                    this.spawnDecoration('house_1', worldX, worldZ);
                }
            }
        }
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

        // 监听英雄状态变化事件 (例如在战斗中释放技能扣蓝)
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
     * 更新左下角英雄 HUD (头像与简易血条/蓝条)
     */
    updateHeroHUD() {
        const heroPortrait = document.getElementById('world-hero-portrait');
        const hpBar = document.getElementById('hud-hero-hp-bar');
        const mpBar = document.getElementById('hud-hero-mp-bar');
        
        const heroData = worldManager.heroData;
        
        if (heroPortrait) {
            // 使用统一的背景样式
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
        
        // 扩展 V4 信息
        const levelDisplay = document.getElementById('hero-level-val');
        if (levelDisplay) levelDisplay.innerText = data.level;

        // 技能点显示
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

            // 绑定 Tooltip
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

        // 切换类名
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

        // 更新面板上的技能点显示
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

            // 购买逻辑
            const buyBtn = item.querySelector('.buy-skill-btn');
            if (buyBtn) {
                buyBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (heroData.skillPoints > 0) {
                        heroData.skillPoints--;
                        heroData.skills.push(id);
                        this.renderLearnableSkills(sect); // 刷新当前列表
                        this.openHeroStats(); // 刷新属性面板
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
        if (!this.tooltip) {
            console.warn("Tooltip element #game-tooltip not found in DOM.");
            return;
        }
        
        this.tooltipTitle = this.tooltip.querySelector('.tooltip-title');
        this.tooltipLevel = this.tooltip.querySelector('.tooltip-level');
        this.tooltipEffect = this.tooltip.querySelector('.tooltip-effect');
        this.tooltipDesc = this.tooltip.querySelector('.tooltip-desc');

        window.addEventListener('mousemove', (e) => {
            if (!this.tooltip.classList.contains('hidden')) {
                const x = e.clientX + 15;
                const y = e.clientY + 15;
                
                // 边界检测：防止超出屏幕右侧或底部
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

    /**
     * 打开主城管理界面
     */
    openTownManagement(cityId) {
        const panel = document.getElementById('town-management-panel');
        const cityData = worldManager.cities[cityId];
        
        document.getElementById('town-name').innerText = cityData.name;
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
                const isMax = build.level >= build.maxLevel;
                card.className = `building-card lv-${build.level} ${isMax ? 'is-max' : ''}`;
                
                card.innerHTML = `
                    <div class="building-icon" style="${this.getIconStyleString(build.icon)}"></div>
                    <span class="building-name">${build.name}</span>
                    <span class="building-cost">${isMax ? '已满级' : `💰${build.cost.gold} 🪵${build.cost.wood}`}</span>
                `;
                
                // 绑定提示框显示
                card.onmouseenter = () => this.showTooltip(build);
                card.onmouseleave = () => this.hideTooltip();

                card.onclick = () => {
                    if (isMax) return;
                    
                    const goldCost = build.cost.gold;
                    const woodCost = build.cost.wood;

                    // 检查资源并升级
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
        
        // 使用动态解锁逻辑获取可招募列表
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

    /**
     * 生成可占领建筑
     */
    spawnCapturedBuilding(spriteKey, buildingType, x, z) {
        const sprite = spriteFactory.createUnitSprite(spriteKey);
        sprite.position.set(x, 1.2, z); // 建筑通常大一点，位置稍微调高
        this.scene.add(sprite);
        this.interactables.push({
            id: `${buildingType}_${Math.floor(x)}_${Math.floor(z)}`,
            mesh: sprite,
            type: 'captured_building',
            config: {
                type: buildingType, // 'gold_mine' | 'sawmill'
                owner: 'none'
            }
        });
    }

    spawnMainCity() {
        // ... 保持原样 ...
        const city = spriteFactory.createUnitSprite('main_city');
        city.center.set(0.5, 0); 
        city.position.set(-10, 0, -10); 
        
        this.scene.add(city);
        this.interactables.push({ mesh: city, type: 'city', id: 'main_city_1' });
    }

    /**
     * 在大世界生成一队敌人 (老虎/叛军等)
     * @param {string} templateId 模板ID (来自 WorldManager.enemyTemplates)
     */
    spawnEnemyGroup(templateId, x, z) {
        const template = worldManager.enemyTemplates[templateId];
        if (!template) return;

        // 创建大世界图标 (例如老虎)
        const groupSprite = spriteFactory.createUnitSprite(template.overworldIcon);
        groupSprite.position.set(x, 0.8, z);
        this.scene.add(groupSprite);

        // 计算这队的随机强度
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
        const geometry = new THREE.PlaneGeometry(size, size, size, size);
        
        // 为顶点着色以显示地形
        const colors = [];
        const color = new THREE.Color();

        for (let z = 0; z <= size; z++) {
            for (let x = 0; x <= size; x++) {
                // 读取对应格子的地形类型
                const gridX = Math.min(x, size - 1);
                const gridZ = Math.min(z, size - 1);
                const type = mapData[gridZ][gridX];

                if (type === TILE_TYPES.WATER) {
                    color.setHex(0x3366aa); // 蓝紫色河流
                } else if (type === TILE_TYPES.MOUNTAIN) {
                    color.setHex(0x444444); // 深灰色山脉
                } else {
                    color.setHex(0x557755); // 墨绿色草地
                }
                colors.push(color.r, color.g, color.b);
            }
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.MeshStandardMaterial({ 
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.1
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 添加简单的网格辅助
        const grid = new THREE.GridHelper(size, size / 2, 0x445544, 0x334433);
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // 大世界环境光：1.0
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.6); // 大世界直射光：1.6
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    start() {
        this.isActive = true;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        
        // 显示 World HUD
        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.remove('hidden');

        // 初始化时间显示
        timeManager.updateUI();
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

        // 更新时间系统
        const seasonChanged = timeManager.update();
        if (seasonChanged) {
            // 季度更替时结算一次产出
            worldManager.processResourceProduction();
        }

        // 1. 处理移动输入
        const moveDir = new THREE.Vector3(0, 0, 0);
        if (this.keys['w'] || this.keys['arrowup']) moveDir.z -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveDir.z += 1;
        if (this.keys['a'] || this.keys['arrowleft']) moveDir.x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveDir.x += 1;

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            
            // 预测移动后的位置
            const nextPos = this.playerHero.position.clone().addScaledVector(moveDir, this.moveSpeed);
            
            // 地形通行性检测
            if (mapGenerator.isPassable(nextPos.x, nextPos.z)) {
                this.playerHero.position.copy(nextPos);
            } else {
                // 如果正前方不通，尝试分量移动 (滑墙效果)
                const nextPosX = this.playerHero.position.clone().add(new THREE.Vector3(moveDir.x * this.moveSpeed, 0, 0));
                if (mapGenerator.isPassable(nextPosX.x, nextPosX.z)) {
                    this.playerHero.position.copy(nextPosX);
                }
                const nextPosZ = this.playerHero.position.clone().add(new THREE.Vector3(0, 0, moveDir.z * this.moveSpeed));
                if (mapGenerator.isPassable(nextPosZ.x, nextPosZ.z)) {
                    this.playerHero.position.copy(nextPosZ);
                }
            }
            
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
            
            // 3. 移动后检测交互
            this.checkInteractions();
        }

        // 3. 相机平滑跟随
        const targetCamPos = this.playerHero.position.clone().add(new THREE.Vector3(0, 15, 12));
        this.camera.position.lerp(targetCamPos, 0.1);
        this.camera.lookAt(this.playerHero.position);
    }

    /**
     * 在英雄头上生成飘字
     */
    spawnFloatingText(type, amount) {
        const textEl = document.createElement('div');
        textEl.className = 'floating-text';
        
        // 增加堆叠逻辑：如果同时有多个飘字，高度递增
        this.floatingStack++;
        const currentStack = this.floatingStack;
        
        let color = '#ffffff';
        let prefix = '';
        
        switch (type) {
            case 'gold':
                color = '#ffcc00'; // 金色
                prefix = '💰 +';
                break;
            case 'wood':
                color = '#deb887'; // 木色 (BurlyWood)
                prefix = '🪵 +';
                break;
            case 'xp':
                color = '#00ffcc'; // 经验青色
                prefix = '✨ XP +';
                break;
        }
        
        textEl.style.color = color;
        textEl.innerText = `${prefix}${amount}`;
        
        // 获取英雄在屏幕上的位置
        const vector = new THREE.Vector3();
        this.playerHero.getWorldPosition(vector);
        vector.y += 2.2; // 基础高度在英雄头顶上方
        
        vector.project(this.camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        
        // 应用堆叠偏移和微小的随机水平抖动
        const stackYOffset = (currentStack - 1) * 35; // 每个飘字间隔 35 像素
        const randomXOffset = (Math.random() - 0.5) * 40; // 随机左右抖动 20 像素
        
        textEl.style.left = `${x + randomXOffset}px`;
        textEl.style.top = `${y - stackYOffset}px`;
        
        document.getElementById('ui-layer').appendChild(textEl);
        
        // 0.8秒后减少堆叠计数（此时第一段动画已快结束，空出位置）
        setTimeout(() => {
            this.floatingStack = Math.max(0, this.floatingStack - 1);
        }, 800);
        
        // 1.5秒后完全移除元素
        setTimeout(() => {
            if (textEl.parentNode) {
                textEl.parentNode.removeChild(textEl);
            }
        }, 1500);
    }

    /**
     * 检测周围可交互物体
     */
    checkInteractions() {
        const toRemove = [];

        this.interactables.forEach((item, index) => {
            const dist = this.playerHero.position.distanceTo(item.mesh.position);
            
            if (item.type === 'city') {
                const cityId = item.id || 'main_city_1';
                if (dist < 3.0) {
                    // 如果还没有记录当前城市，且不是刚刚手动关闭的，则打开
                    if (this.activeCityId !== cityId && this.manuallyClosedCityId !== cityId) {
                        this.openTownManagement(cityId);
                        this.activeCityId = cityId;
                    }
                } else {
                    // 离开范围
                    if (this.activeCityId === cityId) {
                        document.getElementById('town-management-panel').classList.add('hidden');
                        this.activeCityId = null;
                    }
                    // 离开范围后，重置手动关闭状态，允许下次进入时再次触发
                    if (this.manuallyClosedCityId === cityId) {
                        this.manuallyClosedCityId = null;
                    }
                }
            } else if (item.type === 'enemy_group') {
                if (dist < 1.5) {
                    console.log(`%c[开战] %c遭遇 ${item.config.name}！`, 'color: #ff4444; font-weight: bold', 'color: #fff');
                    window.dispatchEvent(new CustomEvent('start-battle', { 
                        detail: item.config 
                    }));
                }
            } else if (item.type === 'pickup') {
                if (dist < 1.2) {
                    worldManager.handlePickup(item.pickupType);
                    this.scene.remove(item.mesh);
                    toRemove.push(index);
                }
            } else if (item.type === 'captured_building') {
                // 占领逻辑
                if (dist < 2.0) {
                    worldManager.handleCapture(item);
                }
            }
        });

        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.interactables.splice(toRemove[i], 1);
        }
    }

    /**
     * 生成装饰性物体（不可交互）
     */
    spawnDecoration(key, x, z) {
        // 改为使用精灵图，保持风格统一
        const sprite = spriteFactory.createUnitSprite(key);
        sprite.position.set(x, 0.8, z);
        this.scene.add(sprite);
    }

    /**
     * 生成可拾取资源
     */
    spawnPickup(key, x, z) {
        const sprite = spriteFactory.createUnitSprite(key);
        sprite.position.set(x, 0.8, z);
        this.scene.add(sprite);
        this.interactables.push({
            mesh: sprite,
            type: 'pickup',
            pickupType: key
        });
    }
}

