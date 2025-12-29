import * as THREE from 'three';
import { 
    MeleeSoldier, RangedSoldier, Archer, Healer, 
    Cangjian, Cangyun, Tiance, Chunyang,
    WildBoar, Wolf, Tiger, Bear,
    Bandit, BanditArcher, RebelSoldier, RebelAxeman,
    Snake, Bats, Deer, Pheasant,
    AssassinMonk, Zombie, HeavyKnight, ShadowNinja,
    HeroUnit
} from '../entities/Soldier.js';

import { worldManager } from '../core/WorldManager.js';
import { modifierManager } from '../core/ModifierManager.js';
import { spriteFactory } from '../core/SpriteFactory.js';
import { SkillRegistry } from '../core/SkillSystem.js';

// 建立类型映射表，方便动态调用
const UnitTypeMap = {
    'melee': MeleeSoldier,
    'ranged': RangedSoldier,
    'archer': Archer,
    'healer': Healer,
    'cangjian': Cangjian,
    'cangyun': Cangyun,
    'tiance': Tiance,
    'chunyang': Chunyang,
    // 野外势力映射
    'wild_boar': WildBoar,
    'wolf': Wolf,
    'tiger': Tiger,
    'bear': Bear,
    'bandit': Bandit,
    'bandit_archer': BanditArcher,
    'rebel_soldier': RebelSoldier,
    'rebel_axeman': RebelAxeman,
    'snake': Snake,
    'bats': Bats,
    'deer': Deer,
    'pheasant': Pheasant,
    'assassin_monk': AssassinMonk,
    'zombie': Zombie,
    'heavy_knight': HeavyKnight,
    'shadow_ninja': ShadowNinja
};

import { GrasslandEnvironment } from '../environment/Environments.js';
import { ProjectileManager } from '../core/ProjectileManager.js';
import { VFXLibrary } from '../core/VFXLibrary.js';
import { rng, setSeed } from '../core/Random.js';

import { uiManager } from '../core/UIManager.js';
import { audioManager } from '../core/AudioManager.js';

export class BattleScene {
    constructor(scene, camera, enemyConfig = null) {
        this.scene = scene;
        this.camera = camera;
        this.enemyConfig = enemyConfig; // 接收大世界敌人配置
        this.playerUnits = [];
        this.enemyUnits = [];
        this.isActive = false;
        this.isDeployment = true; // 部署阶段标识
        this.environment = null;
        this.projectileManager = new ProjectileManager(this.scene);
        this.vfxLibrary = new VFXLibrary(this.scene);
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.ground = null;
        
        this.selectedType = null;
        
        // 核心改动：从 worldManager 获取真实的英雄兵力
        this.unitCounts = { ...worldManager.heroArmy };
        // 记录初始上阵兵力，用于战后损耗统计
        this.initialCounts = { ...worldManager.heroArmy };
        this.deployedCounts = {}; // 记录本次战斗实际放下的兵力
        Object.keys(this.unitCounts).forEach(type => this.deployedCounts[type] = 0);

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this); 
        this.handleSkillTargeting = this.handleSkillTargeting.bind(this); // 新增：绑定技能目标处理
        
        this.isPointerDown = false;
        this.lastPlacementPos = new THREE.Vector3();
        this.placementZoneIndicator = null;
        this.previewSprite = null;
        this.hoveredEnemy = null; // 记录当前悬浮的敌人，用于 Tooltip 性能优化

        // 英雄引用
        this.heroUnit = null;
        this.activeSkill = null; // 当前正在准备释放的技能 (针对 location 类型)
        this.worldManager = worldManager; // 挂载管理器方便组件访问
        this.isFleeing = false; // 新增：战斗是否处于撤退逃跑状态

        // 全局挂载，方便兵种 AI 逻辑访问场景状态
        window.battle = this;
    }

    start() {
        console.log("稻香村发展计划：进入部署阶段");
        this.isActive = false; 
        this.isDeployment = true;

        // 停止大世界 BGM (带 500ms 淡出)
        audioManager.stopBGM(500);
        // 播放进入战斗的提示音
        audioManager.play('battle_intro', { volume: 0.8 });
        
        // 初始化局内蓝条
        this.updateMPUI();
        
        this.environment = new GrasslandEnvironment(this.scene);
        this.environment.init();

        // 查找地面用于射线检测
        this.ground = this.scene.children.find(obj => obj.geometry instanceof THREE.PlaneGeometry);

        // 创建部署区域指示器
        this.createDeploymentIndicator();

        // 核心改动：生成英雄 (英雄是自动生成的，不需要玩家手动部署)
        this.spawnHero();

        // 核心改动：根据来自大世界的配置生成敌人
        const totalPoints = this.enemyConfig ? this.enemyConfig.totalPoints : 60;
        this.spawnEnemiesDynamic(totalPoints); 
        
        // 显示部署 UI
        document.getElementById('deployment-ui').classList.remove('hidden');
        this.setupUIListeners();
        
        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('contextmenu', this.onContextMenu); // 核心：拦截右键
        this.updateUI();
    }

    /**
     * 右键点击处理：取消施法
     */
    onContextMenu(event) {
        event.preventDefault(); // 彻底禁用浏览器默认菜单
        if (this.activeSkill) {
            this.cancelActiveSkill();
        }
    }

    /**
     * 核心：执行取消当前正在准备的技能
     */
    cancelActiveSkill() {
        if (!this.activeSkill) return;
        console.log("%c[技能系统] %c已取消当前招式准备", "color: #aaa", "color: #fff");
        this.activeSkill = null;
        this.hideSkillIndicator();
        uiManager.hideActionHint();
        // 清除所有单位的目标高亮
        [...this.playerUnits, ...this.enemyUnits].forEach(u => u.setTargeted(false));
        audioManager.play('ui_click', { volume: 0.2 });
    }

    /**
     * 在战场上生成主角单位
     */
    spawnHero() {
        // 创建英雄单位，索引设为 -1 以示区别
        this.heroUnit = new HeroUnit('player', -1, this.projectileManager);
        
        // 英雄初始位置：己方半场后方中央 (X: -15, Z: 0)
        this.heroUnit.position.set(-15, 0.6, 0);
        
        this.playerUnits.push(this.heroUnit);
        this.scene.add(this.heroUnit);
        
        console.log(`%c[英雄入场] %c${this.heroUnit.type} 已就位 (HP: ${Math.floor(this.heroUnit.health)}/${this.heroUnit.maxHealth})`, 
            'color: #ff9900; font-weight: bold', 'color: #fff');
    }

    createDeploymentIndicator() {
        // 统一化：玩家部署区为 X: -50 到 0，宽度 50
        const geometry = new THREE.PlaneGeometry(50, 30);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.08, 
            side: THREE.DoubleSide,
            depthWrite: false 
        });
        this.placementZoneIndicator = new THREE.Mesh(geometry, material);
        this.placementZoneIndicator.rotation.x = -Math.PI / 2;
        // 中心点设在 -25，这样覆盖范围就是 -50 到 0
        this.placementZoneIndicator.position.set(-25, 0.01, 0); 
        this.scene.add(this.placementZoneIndicator);
    }

    setupUIListeners() {
        const slots = document.querySelectorAll('.unit-slot');
        slots.forEach(slot => {
            const type = slot.getAttribute('data-type');

            // --- 核心新增：部署阶段查看己方兵种属性 ---
            slot.onmouseenter = () => {
                const stats = worldManager.getUnitDetails(type, 'player');
                const cost = worldManager.unitCosts[type]?.cost || 0;
                uiManager.showTooltip({
                    name: stats.name,
                    level: `气血:${stats.hp} | 伤害:${stats.dps} | 占用:${cost}`,
                    description: stats.description || '精锐的大唐将士。',
                    color: '#d4af37' // 友军金色
                });
            };
            slot.onmouseleave = () => uiManager.hideTooltip();

            slot.onclick = (e) => {
                // 移除其他选中状态
                slots.forEach(s => s.classList.remove('selected'));
                if (this.unitCounts[type] > 0) {
                    this.selectedType = type;
                    slot.classList.add('selected');
                    this.updatePreviewSprite(type);
                } else {
                    this.selectedType = null;
                    this.updatePreviewSprite(null);
                }
            };
        });

        document.getElementById('fight-btn').onclick = () => {
            this.startFighting();
        };
    }

    updatePreviewSprite(type) {
        // 移除旧的预览
        if (this.previewSprite) {
            this.scene.remove(this.previewSprite);
            // 递归清理资源
            this.previewSprite.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.previewSprite = null;
        }

        if (!type) return;

        const group = new THREE.Group();

        // 1. 地面放置点指示器 (XZ 平面，正方形)
        const groundGeo = new THREE.PlaneGeometry(1.2, 1.2);
        const groundMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3, 
            depthWrite: false
        });
        const groundMarker = new THREE.Mesh(groundGeo, groundMat);
        groundMarker.rotation.x = -Math.PI / 2;
        groundMarker.position.y = 0.02; 
        groundMarker.name = 'groundMarker';
        group.add(groundMarker);

        // 2. 增加一个线框
        const edges = new THREE.EdgesGeometry(groundGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.6 
        }));
        line.rotation.x = -Math.PI / 2;
        line.position.y = 0.021; 
        line.name = 'groundLine';
        group.add(line);

        this.previewSprite = group;
        this.previewSprite.visible = false;
        this.scene.add(this.previewSprite);
    }

    spawnEnemiesDynamic(totalPoints) {
        let availableClasses = [];
        
        if (this.enemyConfig && this.enemyConfig.unitPool) {
            availableClasses = this.enemyConfig.unitPool
                .map(type => UnitTypeMap[type])
                .filter(cls => cls);
        } else {
            availableClasses = [
                MeleeSoldier, RangedSoldier, Archer, Healer, 
                Cangjian, Cangyun, Tiance, Chunyang
            ];
        }

        const maxTypes = Math.min(availableClasses.length, 5);
        const minTypes = Math.min(availableClasses.length, 3);
        const typeCount = Math.floor(Math.random() * (maxTypes - minTypes + 1)) + minTypes;
        
        const selectedClasses = [];
        const pool = [...availableClasses];
        for (let i = 0; i < typeCount; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            selectedClasses.push(pool.splice(idx, 1)[0]);
        }

        let remainingPoints = totalPoints;
        const armyList = [];
        let attempts = 0;
        while (remainingPoints >= 2 && attempts < 100) {
            const Cls = selectedClasses[Math.floor(Math.random() * selectedClasses.length)];
            const tempUnit = new Cls('enemy', 0, this.projectileManager);
            if (remainingPoints >= tempUnit.cost) {
                armyList.push(Cls);
                remainingPoints -= tempUnit.cost;
            }
            tempUnit.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            attempts++;
        }

        armyList.forEach((Cls, idx) => {
            const unit = new Cls('enemy', idx, this.projectileManager);
            let zoneX; 
            const type = unit.type;

            if (['melee', 'cangyun', 'tiance', 'cangjian', 'wild_boar', 'wolf', 'tiger', 'bear', 'bandit', 'rebel_soldier', 'rebel_axeman', 'heavy_knight'].includes(type)) {
                zoneX = 2 + Math.random() * 8;  // 前排 (X: 2-10)
            } else if (['ranged', 'archer', 'chunyang', 'bandit_archer', 'shadow_ninja', 'assassin_monk'].includes(type)) {
                zoneX = 12 + Math.random() * 8; // 中排 (X: 12-20)
            } else {
                zoneX = 22 + Math.random() * 6; // 后排 (X: 22-28)
            }

            const zPos = (Math.random() - 0.5) * 18;
            unit.position.set(zoneX, 0.6, zPos);
            unit.visible = true; 
            this.enemyUnits.push(unit);
            this.scene.add(unit);
        });

        console.log(`%c[敌军生成] %c总预算: ${totalPoints}, 实际消耗: ${totalPoints - remainingPoints}, 兵力: ${armyList.length}`, 
            'color: #ff4444; font-weight: bold', 'color: #fff');
    }

    onPointerDown(event) {
        if (!this.isDeployment || !this.selectedType) return;
        if (event.button !== 0) return; // 仅限左键部署
        if (event.target.closest('#deployment-ui') || event.target.closest('.wuxia-btn')) return;
        this.isPointerDown = true;
        this.handlePlacement(event);
    }

    onPointerMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (!this.isDeployment) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // --- 核心新增：备战阶段探测敌军属性 ---
        let enemyHit = null;
        const enemyMeshes = this.enemyUnits.map(u => u.unitSprite).filter(s => s);
        const enemyIntersects = this.raycaster.intersectObjects(enemyMeshes, true);
        
        if (enemyIntersects.length > 0) {
            const hitSprite = enemyIntersects[0].object;
            enemyHit = this.enemyUnits.find(u => u.unitSprite === hitSprite);
        }

        if (enemyHit) {
            if (this.hoveredEnemy !== enemyHit) {
                this.hoveredEnemy = enemyHit;
                const stats = worldManager.getUnitDetails(enemyHit.type, 'enemy');
                const cost = worldManager.unitCosts[enemyHit.type]?.cost || 0;
                
                uiManager.showTooltip({
                    name: stats.name,
                    level: `气血:${stats.hp} | 伤害:${stats.dps} | 占用:${cost}`,
                    description: stats.description || '敌方精锐部队。',
                    color: '#ff4444' // 敌对红色
                });
            }
            if (this.previewSprite) this.previewSprite.visible = false;
            return; 
        } else {
            if (this.hoveredEnemy) {
                this.hoveredEnemy = null;
                uiManager.hideTooltip();
            }
        }

        const intersects = this.raycaster.intersectObject(this.ground);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            if (this.previewSprite) {
                this.previewSprite.position.x = point.x;
                this.previewSprite.position.z = point.z;
                this.previewSprite.visible = true;
                const color = point.x < 0 ? 0x00ff00 : 0xff0000;
                this.previewSprite.traverse(child => {
                    if (child.material) child.material.color.setHex(color);
                });
            }
            if (this.isPointerDown) this.handlePlacement(event);
        } else if (this.previewSprite) {
            this.previewSprite.visible = false;
        }
    }

    onPointerUp() {
        this.isPointerDown = false;
    }

    handlePlacement(event) {
        if (!this.selectedType || this.unitCounts[this.selectedType] <= 0) return;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            if (point.x < 0) {
                if (!this.isPointerDown || point.distanceTo(this.lastPlacementPos) > 1.2) {
                    this.deployUnit(this.selectedType, point);
                    this.lastPlacementPos.copy(point);
                }
            }
        }
    }

    deployUnit(type, position) {
        let unit;
        const idx = this.playerUnits.length;
        const Cls = UnitTypeMap[type];
        if (Cls) unit = new Cls('player', idx, this.projectileManager);

        if (unit) {
            unit.position.set(position.x, 0.6, position.z);
            this.playerUnits.push(unit);
            this.scene.add(unit);
            this.unitCounts[type]--;
            this.deployedCounts[type]++;
            
            // 部署士兵时播放点击音效 (使用配置中的默认 10ms throttle 和 pitchVar)
            audioManager.play('ui_click', { volume: 0.3 });

            this.updateUI();
            if (this.unitCounts[type] <= 0) {
                this.selectedType = null;
                this.updatePreviewSprite(null);
                document.querySelectorAll('.unit-slot').forEach(s => s.classList.remove('selected'));
            }
        }
    }

    spawnSupportUnits(type, count, position) {
        const Cls = UnitTypeMap[type];
        if (!Cls) return;
        for (let i = 0; i < count; i++) {
            const idx = this.playerUnits.length;
            const unit = new Cls('player', idx, this.projectileManager);
            const offset = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
            unit.position.copy(position).add(offset);
            unit.position.y = 0.6;
            this.playerUnits.push(unit);
            this.scene.add(unit);
        }
    }

    updateUI() {
        Object.keys(this.unitCounts).forEach(type => {
            const slot = document.querySelector(`.unit-slot[data-type="${type}"]`);
            if (slot) {
                slot.querySelector('.slot-count').innerText = `x${this.unitCounts[type]}`;
                if (this.unitCounts[type] <= 0) {
                    slot.classList.add('disabled');
                    slot.style.opacity = '0.3';
                    slot.style.pointerEvents = 'none';
                } else {
                    slot.classList.remove('disabled');
                    slot.style.opacity = '1';
                    slot.style.pointerEvents = 'auto';
                }
            }
        });
    }

    startFighting() {
        setSeed(888);
        this.isDeployment = false;
        this.isActive = true;
        
        // 核心修复：开战时强制隐藏悬浮提示
        uiManager.hideTooltip();
        this.hoveredEnemy = null;

        // 播放士兵呐喊：配置已在 AudioManager 中定义 (维持 3s，淡出 5s)
        this._shoutAudio = audioManager.play('soldier_shout', { volume: 0.6 });

        document.getElementById('deployment-ui').classList.add('hidden');
        this.initSkillUI();
        window.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointerup', this.onPointerUp);
        window.addEventListener('pointerdown', this.handleSkillTargeting);

        if (this.placementZoneIndicator) {
            this.scene.remove(this.placementZoneIndicator);
            this.placementZoneIndicator.geometry.dispose();
            this.placementZoneIndicator.material.dispose();
        }
        if (this.previewSprite) {
            this.scene.remove(this.previewSprite);
            this.previewSprite.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }

        // --- 核心改动：奇穴效果 - 激励士气 (战斗开始全军振奋) ---
        const startHasteMultiplier = modifierManager.getModifiedValue({ side: 'player' }, 'battle_start_haste', 1.0);
        
        if (startHasteMultiplier > 1.0) {
            console.log(`[战斗开始] 激励士气生效：攻速倍率=${startHasteMultiplier.toFixed(2)}`);
            this.applyBuffToUnits(this.playerUnits, {
                tag: 'talent_haste',
                stat: 'attackSpeed',
                multiplier: startHasteMultiplier,
                duration: 10000,
                color: 0xffffaa, // 浅金色振奋
                vfxName: 'rising_particles'
            });
        }

        console.log("部署完成，江湖开战！");
    }

    initSkillUI() {
        const bottomUI = document.getElementById('battle-bottom-ui');
        const filterContainer = document.getElementById('skill-category-filters');
        
        if (bottomUI) bottomUI.classList.remove('hidden');
        
        if (!bottomUI || !filterContainer) return;

        this.updateMPUI();

        const heroData = this.worldManager.heroData;
        const heroSkills = heroData.skills;
        
        // 1. 提取所有已拥有的技能类别
        const categories = new Set();
        heroSkills.forEach(id => {
            const skill = SkillRegistry[id];
            if (skill && skill.category) categories.add(skill.category);
        });

        // 2. 初始化过滤器按钮
        filterContainer.innerHTML = '<button class="filter-btn active" data-category="all">所有</button>';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.dataset.category = cat;
            btn.innerText = cat;
            filterContainer.appendChild(btn);
        });

        // 3. 绑定过滤器点击事件
        const filterBtns = filterContainer.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            btn.onclick = () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderSkills(btn.dataset.category);
            };
        });

        // 4. 初始渲染所有技能
        this.renderSkills('all');
    }

    renderSkills(categoryFilter = 'all') {
        const skillSlots = document.getElementById('skill-slots');
        if (!skillSlots) return;

        skillSlots.innerHTML = '';
        const heroData = this.worldManager.heroData;
        const heroSkills = heroData.skills;

        heroSkills.forEach(skillId => {
            const skill = SkillRegistry[skillId];
            if (!skill) return;

            // 类别过滤
            if (categoryFilter !== 'all' && skill.category !== categoryFilter) return;

            const btn = document.createElement('div');
            btn.className = 'skill-btn';
            btn.id = `skill-${skillId}`;
            const iconStyle = spriteFactory.getIconStyle(skill.icon);
            const actualCost = Math.floor(skill.cost * (1 - (heroData.stats.haste || 0)));
            
            btn.innerHTML = `
                <div class="skill-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize}; image-rendering: pixelated; width: 32px; height: 32px;"></div>
                <div class="skill-cost">内:${actualCost}</div>
                <div class="cooldown-overlay" id="cd-${skillId}"></div>
                <div class="skill-name-tag">${skill.name}</div>
            `;

            btn.onmouseenter = () => {
                uiManager.showSkillTooltip(skillId, heroData);
            };

            btn.onmouseleave = () => uiManager.hideTooltip();
            btn.onclick = (e) => { e.stopPropagation(); this.onSkillBtnClick(skillId); };
            skillSlots.appendChild(btn);

            // 如果技能正在冷却中，需要重新启动动画（如果是中途切换分类）
            const now = Date.now();
            const actualCD = skill.cooldown * (1 - (heroData.stats.haste || 0));
            const elapsed = now - skill.lastUsed;
            if (elapsed < actualCD) {
                this.startSkillCDAnimation(skillId, actualCD, elapsed);
            }
        });
    }

    updateMPUI() {
        const fill = document.getElementById('battle-mp-fill');
        const text = document.getElementById('battle-mp-text');
        if (!fill || !text) return;
        const data = this.worldManager.heroData;
        const pct = (data.mpCurrent / data.mpMax) * 100;
        fill.style.width = `${pct}%`;
        text.innerText = `内力: ${Math.floor(data.mpCurrent)}/${data.mpMax}`;
    }

    onSkillBtnClick(skillId) {
        if (!this.isActive) return;
        const skill = SkillRegistry[skillId];
        if (!skill) return;
        if (!skill.isReady(this.worldManager.heroData)) return;

        if (skill.targeting.type === 'location') {
            this.activeSkill = skillId;
            this.showSkillIndicator(skill.targeting);
        } else {
            this.executeSkill(skillId);
        }
    }

    handleSkillTargeting(event) {
        if (!this.isActive || !this.activeSkill) return;

        // 核心优化：按下右键 (button 2) 立即取消，不再等待松手
        if (event.button === 2) {
            this.cancelActiveSkill();
            return;
        }

        // 核心修复：只允许左键释放技能 (button 0)
        if (event.button !== 0) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);
        if (intersects.length > 0) {
            let targetPos = intersects[0].point.clone();
            
            // 核心修复：点击释放时也进行范围钳制
            const skill = SkillRegistry[this.activeSkill];
            const range = (skill && skill.targeting) ? (skill.targeting.range || 0) : 0;
            if (range > 0 && this.heroUnit) {
                const dist = targetPos.distanceTo(this.heroUnit.position);
                if (dist > range) {
                    const dir = targetPos.clone().sub(this.heroUnit.position).normalize();
                    targetPos = this.heroUnit.position.clone().add(dir.multiplyScalar(range));
                }
            }

            this.executeSkill(this.activeSkill, targetPos);
            this.hideSkillIndicator();
        }
    }

    executeSkill(skillId, targetPos = null) {
        const skill = SkillRegistry[skillId];
        if (!skill) return;
        const success = skill.execute(this, this.heroUnit, targetPos);
        if (success) {
            window.dispatchEvent(new CustomEvent('hero-stats-changed'));
            this.updateMPUI();
            const actualCD = skill.cooldown * (1 - (this.worldManager.heroData.stats.haste || 0));
            this.startSkillCDAnimation(skillId, actualCD);
        }
        this.activeSkill = null;
    }

    startSkillCDAnimation(skillId, cooldown, initialElapsed = 0) {
        const overlay = document.getElementById(`cd-${skillId}`);
        if (!overlay) return;
        
        const startTime = Date.now() - initialElapsed;
        const update = () => {
            // 检查元素是否还在 DOM 中（分类切换时按钮会被销毁重建）
            const currentOverlay = document.getElementById(`cd-${skillId}`);
            if (!currentOverlay) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.max(0, 1 - elapsed / cooldown);
            currentOverlay.style.height = `${progress * 100}%`;
            
            if (progress > 0 && this.isActive) {
                requestAnimationFrame(update);
            }
        };
        update();
    }

    showSkillIndicator(config) {
        this.hideSkillIndicator();
        // range: 释放距离, impactRadius: 生效半径, radius: 兼容旧逻辑
        const { shape = 'circle', radius = 1, impactRadius, range = 0 } = config;
        const visualRadius = impactRadius || radius;
        
        const group = new THREE.Group();
        
        // 1. 释放范围圈 (指示英雄可以放多远)
        if (range > 0) {
            const rangeGeo = new THREE.RingGeometry(range, range + 0.1, 64);
            const rangeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
            const rangeMesh = new THREE.Mesh(rangeGeo, rangeMat);
            rangeMesh.rotation.x = -Math.PI / 2;
            rangeMesh.position.y = 0.01;
            this.rangeIndicator = rangeMesh;
            this.scene.add(this.rangeIndicator);
        }

        // 2. 技能生效预览圈 (随鼠标移动)
        let geo = (shape === 'circle') ? new THREE.CircleGeometry(visualRadius, 32) : new THREE.PlaneGeometry(visualRadius * 2, visualRadius * 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.2, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.05;
        group.add(mesh);
        const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }));
        line.rotation.x = -Math.PI / 2;
        line.position.y = 0.051;
        group.add(line);
        this.skillIndicator = group;
        this.scene.add(this.skillIndicator);
    }

    hideSkillIndicator() {
        if (this.skillIndicator) {
            this.scene.remove(this.skillIndicator);
            this.skillIndicator.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            this.skillIndicator = null;
        }
        if (this.rangeIndicator) {
            this.scene.remove(this.rangeIndicator);
            this.rangeIndicator.geometry.dispose();
            this.rangeIndicator.material.dispose();
            this.rangeIndicator = null;
        }
        // 清除所有单位的目标高亮
        [...this.playerUnits, ...this.enemyUnits].forEach(u => u.setTargeted(false));
    }

    /**
     * 实时更新被技能覆盖单位的高亮状态
     */
    updateTargetHighlights(center, skill) {
        // 1. 确定技能侧重（是给队友上Buff还是给敌人降伤害）
        let targetSide = 'enemy';
        // 简单逻辑：如果技能包含 buff_aoe 且 side 是 player，或者是特定的气场
        if (skill.actions && skill.actions.some(a => 
            (a.type === 'buff_aoe' && (a.side === 'player' || !a.side)) || 
            (a.type === 'tick_effect' && a.side === 'player')
        )) {
            targetSide = 'player';
        }

        // 2. 找到范围内单位
        const targets = this.getUnitsInArea(center, skill.targeting, targetSide);
        
        // 3. 更新所有相关单位的状态
        const allUnits = (targetSide === 'player') ? this.playerUnits : this.enemyUnits;
        const color = (targetSide === 'player') ? 0x00ffcc : 0xff3333;

        allUnits.forEach(u => {
            if (u.isDead) return;
            const isHighlighted = targets.includes(u);
            u.setTargeted(isHighlighted, color);
        });
    }

    // ========================================================
    // 2. 视觉层 API (VFX 特效库)
    // ========================================================

    playVFX(type, options) {
        const { 
            pos, 
            unit = null,  
            radius = 1, 
            color = 0xffffff, 
            duration = 1000, 
            density = 1, 
            speed = 1.0,  
            dir = null,   
            angle = Math.PI 
        } = options;
        
        // 核心优化：智能方向补全
        const finalDir = dir || (unit ? unit.getForwardVector() : null);
        const vfxPos = unit ? new THREE.Vector3(0, 0, 0) : pos;
        const parent = unit || this.scene;

        switch (type) {
            case 'tiance_sweep': 
                this.vfxLibrary.createSweepVFX(vfxPos, finalDir, radius, color, duration, angle, parent); 
                break;
            case 'advanced_sweep':
                this.vfxLibrary.createAdvancedSweepVFX(vfxPos, finalDir, radius, color, duration, angle, parent);
                break;
            case 'cangjian_whirlwind': 
                this.vfxLibrary.createWhirlwindVFX(vfxPos, radius, color, duration, parent); 
                break;
            case 'rising_particles': 
                this.vfxLibrary.createParticleSystem({
                    pos: vfxPos, parent, color, duration, density,
                    initFn: p => p.position.set((Math.random()-0.5)*0.6, 0, (Math.random()-0.5)*0.6),
                    updateFn: (p, prg) => { p.position.y += 0.02; p.scale.setScalar(1 - prg); p.material.opacity = 0.8 * (1 - prg); }
                });
                break;
            case 'shield': 
                this.vfxLibrary.createShieldVFX(parent, vfxPos, radius, color, duration); 
                break;
            case 'stomp': 
                this.vfxLibrary.createStompVFX(vfxPos, radius, color, duration, parent); 
                break;
            case 'pulse': 
                this.vfxLibrary.createPulseVFX(vfxPos, radius, color, duration, parent); 
                break;
            case 'rain': 
                this.vfxLibrary.createRainVFX(vfxPos, radius, color, duration, density, speed); 
                break;
            case 'mega_whirlwind': 
                this.vfxLibrary.createMegaWhirlwindVFX(vfxPos, radius, color, duration, parent); 
                break;
            case 'field':
                this.vfxLibrary.createFieldVFX(vfxPos, radius, color, duration);
                break;
            case 'dome': 
                this.vfxLibrary.createDomeVFX(vfxPos, radius, color, duration);
                break;
            case 'fire_trail':
                this.vfxLibrary.createParticleSystem({
                    parent, pos: vfxPos, color, duration, density,
                    spawnRate: 50,
                    initFn: p => { p.position.set((Math.random()-0.5)*0.4, 0, (Math.random()-0.5)*0.4); },
                    updateFn: (p, prg) => { p.position.y += 0.03; p.scale.setScalar(0.5 * (1 - prg)); p.material.opacity = 0.6 * (1 - prg); }
                });
                break;
            case 'butterfly_particles':
                this.vfxLibrary.createButterflyVFX(parent, color, duration);
                break;
            case 'stun':
                this.vfxLibrary.createStunVFX(parent, duration);
                break;
            case 'slow':
                this.vfxLibrary.createSlowVFX(parent);
                break;
            case 'flee':
                this.vfxLibrary.createFleeVFX(parent);
                break;
            case 'damage_number':
                this.vfxLibrary.createDamageNumberVFX(pos || (unit ? unit.position.clone() : new THREE.Vector3()), options.value, color, options.scale || 1.0);
                break;
        }
    }

    /**
     * 周期性区域效果 API (Tick Effect)
     * 极大复用点：所有持续性技能的中枢
     */
    applyTickEffect(center, config, options) {
        const { duration, interval, onTick, targetSide = 'enemy' } = options;
        const startTime = Date.now();
        const executeTick = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= duration || !this.isActive) return;
            const targets = this.getUnitsInArea(center, config, targetSide);
            onTick(targets);
            setTimeout(executeTick, interval);
        };
        executeTick();
    }

    spawnProjectiles(options) {
        const { 
            count = 1, interval = 100, startPos, target, damage, speed, 
            type, color, spread = 0.5, autoTarget = false,
            targetMode = 'random', // 新增模式：random, nearest, spread
            scale = 1.0, // 新增：支持缩放
            audio = null, // 新增：发射音效
            isHeroSource = false // 是否为主角来源
        } = options;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (!this.isActive || !this.projectileManager) return;

                // 每发子弹强制播放音效
                if (audio) {
                    audioManager.play(audio, { volume: 0.25, force: isHeroSource, pitchVar: 0.3 });
                }
                
                let currentTarget = target;
                if (autoTarget || !currentTarget || currentTarget.isDead) {
                    const enemies = this.enemyUnits.filter(u => !u.isDead);
                    if (enemies.length > 0) {
                        if (targetMode === 'nearest') {
                            // 索敌策略优化：选择最近的 N 个敌人作为“近敌池”，从中随机挑选
                            // 这样既保证了集火近处目标，又避免了全部打在一个目标上导致伤害溢出
                            enemies.sort((a, b) => a.position.distanceTo(startPos) - b.position.distanceTo(startPos));
                            const nearPoolSize = Math.min(4, enemies.length); // 取最近的 4 个
                            const poolIndex = Math.floor(rng.next() * nearPoolSize);
                            currentTarget = enemies[poolIndex];
                        } else if (targetMode === 'spread') {
                            // 索敌策略：智能散布，轮流点名，防止伤害溢出
                            currentTarget = enemies[i % enemies.length];
                        } else {
                            // 默认：随机点名
                            currentTarget = enemies[Math.floor(rng.next() * enemies.length)];
                        }
                    }
                }

                if (!currentTarget) return;

                const offset = new THREE.Vector3((rng.next() - 0.5) * spread, (rng.next() - 0.5) * spread, (rng.next() - 0.5) * spread);
                this.projectileManager.spawn({ 
                    startPos: startPos.clone().add(offset), 
                    target: currentTarget, 
                    speed, 
                    damage, 
                    type, 
                    color,
                    scale,
                    isHeroSource
                });
            }, i * interval);
        }
    }

    getUnitsInArea(center, config, targetSide = 'enemy') {
        const { shape = 'circle', radius = 1 } = config;
        const potentialTargets = [];
        if (targetSide === 'enemy' || targetSide === 'all') potentialTargets.push(...this.enemyUnits);
        if (targetSide === 'player' || targetSide === 'all') potentialTargets.push(...this.playerUnits);
        return potentialTargets.filter(unit => {
            if (unit.isDead) return false;
            if (shape === 'circle') return unit.position.distanceTo(center) < radius;
            if (shape === 'square') return Math.abs(unit.position.x - center.x) < radius && Math.abs(unit.position.z - center.z) < radius;
            if (shape === 'sector') {
                // 扇形判定：距离 + 角度
                const dist = unit.position.distanceTo(center);
                if (dist > radius) return false;
                
                // 计算单位相对于中心的方向
                const dirToUnit = new THREE.Vector3().subVectors(unit.position, center).normalize();
                // 如果没有传入具体朝向，默认取中心点前向 (z轴负方向) 或者通过 caster 传入
                const forward = config.facing || new THREE.Vector3(0, 0, 1);
                const angle = dirToUnit.angleTo(forward);
                return angle < (config.angle || Math.PI / 4); // 默认 90 度扇形
            }
            return false;
        });
    }

    applyDamageToUnits(units, damage, sourcePos = null, knockback = 0, isHeroSource = false) {
        units.forEach(unit => {
            unit.takeDamage(damage, isHeroSource);
            if (knockback > 0 && sourcePos) unit.applyKnockback(sourcePos, knockback);
        });
    }

    applyBuffToUnits(units, options) {
        const { stat, multiplier, offset, duration, color, vfxName, tag } = options;

        units.forEach(unit => {
            // 1. 如果指定了 tag 且该 Buff 已存在，则仅刷新持续时间，不重复添加 Modifier
            if (tag && unit.activeBuffs) {
                const existing = unit.activeBuffs.find(b => b.tag === tag);
                if (existing) {
                    clearTimeout(existing.timer);
                    existing.timer = setTimeout(existing.cleanup, duration);
                    return; 
                }
            }

            // 2. 播放特效
            if (vfxName) this.playVFX(vfxName, { unit, duration, color: color || 0xffffff, radius: unit.isHero ? 1.5 : 0.8 });
            
            // 3. 记录颜色
            if (color && tag && unit.activeColors) {
                unit.activeColors.set(tag, color);
            }

            const stats = Array.isArray(stat) ? stat : [stat];
            const multipliers = Array.isArray(multiplier) ? multiplier : [multiplier];
            const offsets = Array.isArray(offset) ? offset : [offset];

            // 4. 为每个属性添加 Modifier
            const modifierIds = [];
            stats.forEach((s, i) => {
                let m = multipliers[i] !== undefined ? multipliers[i] : (multipliers[0] !== undefined ? multipliers[0] : 1.0);
                let o = offsets[i] !== undefined ? offsets[i] : (offsets[0] !== undefined ? offsets[0] : 0);

                // --- 核心增强：自动识别并激活“开关型”Buff (Flag Stats) ---
                // 像无敌、锁血、免控这类属性，基础值通常是 0，只要有任意正向修正就视为开启
                const isFlagStat = ['invincible', 'controlImmune', 'tigerHeart'].includes(s);
                if (isFlagStat && m === 1.0 && o === 0) {
                    o = 1; // 默认赋予 1 点偏移量以激活该状态
                }

                const modId = `buff_${unit.side}_${unit.type}_${unit.index}_${tag || 'anon'}_${s}`;
                
                modifierManager.addModifier({
                    id: modId,
                    stat: s,
                    multiplier: m,
                    offset: o,
                    targetUnit: unit,
                    source: 'skill'
                });
                modifierIds.push(modId);
            });

            // 5. 定时清理函数 (经销商负责撤场)
            const cleanup = () => {
                if (!unit.isDead) {
                    modifierIds.forEach(id => modifierManager.removeModifier(id));
                    
                    if (color && tag && unit.activeColors) {
                        unit.activeColors.delete(tag);
                    }
                }
                if (tag && unit.activeBuffs) {
                    unit.activeBuffs = unit.activeBuffs.filter(b => b.timer !== timer);
                }
            };

            const timer = setTimeout(cleanup, duration);

            // 6. 登记在册，方便中途维护
            if (tag) {
                if (!unit.activeBuffs) unit.activeBuffs = [];
                unit.activeBuffs.push({ tag, timer, cleanup });
            }
        });
    }

    applyHealToUnits(units, amount) {
        units.forEach(unit => { unit.health = Math.min(unit.maxHealth, unit.health + amount); if (unit.updateHealthBar) unit.updateHealthBar(); });
    }

    applyStatusToUnits(units, status, duration) {
        units.forEach(unit => { 
            if (status === 'stun') {
                unit.applyStun(duration);
            } 
        });
    }

    executeMovement(unit, type, targetPos, options = {}) {
        const { duration = 300, damage = 0, knockback = 0, jumpHeight = 0, onHit = null, onComplete = null } = options;
        if (type === 'dash') {
            const startPos = unit.position.clone();
            const startTime = Date.now();
            const hitUnits = new Set();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(1, elapsed / duration);
                
                // 1. 水平位移
                unit.position.lerpVectors(startPos, targetPos, progress);
                
                // 2. 垂直位移 (抛物线)
                // y = baseHeight + 4 * jumpHeight * progress * (1 - progress)
                const jumpY = jumpHeight > 0 ? (4 * jumpHeight * progress * (1 - progress)) : 0;
                unit.position.y = 0.6 + jumpY;

                if (damage > 0 || knockback > 0 || onHit) {
                    this.getUnitsInArea(unit.position, { shape: 'circle', radius: 1.5 }, 'enemy').forEach(target => {
                        if (!hitUnits.has(target)) {
                            if (damage > 0) target.takeDamage(damage);
                            if (knockback > 0) target.applyKnockback(unit.position, knockback);
                            if (onHit) onHit(target);
                            hitUnits.add(target);
                        }
                    });
                }
                
                if (progress < 1) requestAnimationFrame(animate); 
                else {
                    unit.position.y = 0.6; // 落地校准
                    if (onComplete) onComplete();
                }
            };
            animate();
        } else if (type === 'blink') {
            unit.position.copy(targetPos);
            unit.position.y = 0.6;
            if (onComplete) onComplete();
        }
    }

    update(deltaTime) {
        this.camera.position.set(0, 15, 18); 
        this.camera.lookAt(0, 0, 0);
        
        // --- 核心新增：悬停显示血条逻辑 ---
        this.updateHoverHealthBar();

        // 实时更新技能栏状态 (内力不足或主角阵亡时禁用)
        this.updateSkillUIState();
        
        // 处理技能指示器逻辑
        if (this.activeSkill && this.skillIndicator) {
            const skill = SkillRegistry[this.activeSkill];
            const range = (skill && skill.targeting) ? (skill.targeting.range || 0) : 0;
            
            // 1. 让释放范围圈始终跟随英雄
            if (this.rangeIndicator && this.heroUnit) {
                this.rangeIndicator.position.copy(this.heroUnit.position);
                this.rangeIndicator.position.y = 0.01;
            }

            // 2. 更新鼠标位置对应的技能预览圈
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.ground);
            if (intersects.length > 0) {
                let targetPos = intersects[0].point.clone();
                
                // 3. 如果有范围限制，进行向心钳制 (Clamping)
                if (range > 0 && this.heroUnit) {
                    const dist = targetPos.distanceTo(this.heroUnit.position);
                    if (dist > range) {
                        const dir = targetPos.clone().sub(this.heroUnit.position).normalize();
                        targetPos = this.heroUnit.position.clone().add(dir.multiplyScalar(range));
                    }
                }

                this.skillIndicator.position.copy(targetPos);
                this.skillIndicator.position.y = 0.05;
                this.skillIndicator.visible = true;

                // --- 新增：实时目标预选高亮 ---
                this.updateTargetHighlights(targetPos, skill);

                // --- 新增：跟随鼠标的“右键取消”提示 ---
                uiManager.showActionHint('右键取消', this.mouse);
            } else {
                this.skillIndicator.visible = false;
                // 没指到地面时，清除所有高亮
                [...this.playerUnits, ...this.enemyUnits].forEach(u => u.setTargeted(false));
                uiManager.hideActionHint();
            }
        } else {
            // 如果没有活动技能，确保提示隐藏
            uiManager.hideActionHint();
        }
        
        // --- 核心修复：无论是否在部署阶段，都必须更新单位的视觉状态(血条对齐) ---
        [...this.playerUnits, ...this.enemyUnits].forEach(u => {
            if (u.updateVisualState) u.updateVisualState();
        });

        if (this.isDeployment || !this.isActive) return;
        this.playerUnits.forEach(u => u.update(this.enemyUnits, this.playerUnits, deltaTime));
        this.enemyUnits.forEach(u => u.update(this.playerUnits, this.enemyUnits, deltaTime));
        this.projectileManager.update(deltaTime);
        this.checkWinCondition();
    }

    /**
     * 实时更新鼠标悬停单位的血条显示
     */
    updateHoverHealthBar() {
        if (!this.isActive || this.isPostBattleSequence) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const allUnits = [...this.playerUnits, ...this.enemyUnits];
        // 获取所有存活单位的精灵图进行射线检测
        const aliveSprites = allUnits
            .filter(u => !u.isDead && u.unitSprite)
            .map(u => u.unitSprite);
        
        const intersects = this.raycaster.intersectObjects(aliveSprites);
        
        // 1. 先隐藏所有非主角的血条 (主角血条始终显示)
        allUnits.forEach(u => {
            if (!u.isHero && u.hpSprite) {
                u.hpSprite.visible = false;
            }
        });

        // 2. 如果鼠标悬停在某个单位上，显示该单位的血条
        if (intersects.length > 0) {
            const hitSprite = intersects[0].object;
            const unit = allUnits.find(u => u.unitSprite === hitSprite);
            if (unit && unit.hpSprite) {
                unit.hpSprite.visible = true;
            }
        }
    }

    /**
     * 实时更新技能图标的可点击状态 (置灰逻辑)
     */
    updateSkillUIState() {
        if (!this.isActive || this.isDeployment || this.isPostBattleSequence) return;
        
        const heroData = this.worldManager.heroData;
        const isHeroDead = this.heroUnit ? this.heroUnit.isDead : true;
        
        heroData.skills.forEach(skillId => {
            const btn = document.getElementById(`skill-${skillId}`);
            if (!btn) return;
            
            const skill = SkillRegistry[skillId];
            if (!skill) return;

            // 检查：主角是否存活、内力是否足够
            // 注意：冷却状态由 overlay 处理，此处主要控制“绝对不可放”的情况 (死亡/蓝耗)
            const actualCost = Math.floor(skill.cost * (1 - (heroData.stats.haste || 0)));
            const hasEnoughMP = heroData.mpCurrent >= actualCost;
            
            const isDisabled = isHeroDead || !hasEnoughMP;
            
            if (isDisabled) {
                btn.classList.add('disabled');
            } else {
                btn.classList.remove('disabled');
            }
        });
    }

    checkWinCondition() {
        if (this.isPostBattleSequence) return;
        
        const playerAlive = this.playerUnits.some(u => !u.isDead);
        const enemyAlive = this.enemyUnits.some(u => !u.isDead);

        // 如果全灭了，无论是否在逃跑，都直接结束
        if (!playerAlive) {
            this.isFleeing = false; // 停止逃跑状态
            this.endBattle("胜败乃兵家常事，侠士请重新来过！", false);
            return;
        }

        if (this.isFleeing) return; // 逃跑期间不检查敌人是否全灭（因为我们要逃了）

        if (!enemyAlive) this.endBattle("这就是大唐侠士的风采！敌军已尽数伏诛。", true);
    }

    /**
     * 开始逃跑序列：所有友军减速并向后撤退 5 秒
     */
    startFleeing() {
        if (!this.isActive || this.isFleeing) return;
        
        this.isFleeing = true;
        
        // 1. 隐藏底部 UI
        if (document.getElementById('battle-bottom-ui')) {
            document.getElementById('battle-bottom-ui').classList.add('hidden');
        }
        
        // 2. 所有存活友军进入逃跑状态
        this.playerUnits.forEach(u => {
            if (!u.isDead) {
                u.isFleeing = true;
                u.target = null; // 清除目标，不再攻击
            }
        });

        // 3. 5秒后正式结束战斗
        uiManager.showActionHint("正在全力撤退... (剩余 5.0s)");
        let timeLeft = 5.0;
        this.fleeTimer = setInterval(() => {
            timeLeft -= 0.1;
            if (timeLeft <= 0 || !this.isActive) {
                clearInterval(this.fleeTimer);
                this.fleeTimer = null;
                uiManager.hideActionHint();
                if (this.isActive) {
                    this.endBattle("留得青山在，不怕没柴烧。侠士决定先行撤退！", false);
                }
            } else {
                uiManager.showActionHint(`正在全力撤退... (剩余 ${timeLeft.toFixed(1)}s)`);
            }
        }, 100);
    }

    async endBattle(message, isVictory) {
        if (this.isPostBattleSequence) return;
        
        // 关键重构：进入“战斗后序列”而非立即停止所有逻辑
        this.isPostBattleSequence = true;
        this.battleResult = isVictory;

        if (this.fleeTimer) {
            clearInterval(this.fleeTimer);
            this.fleeTimer = null;
            uiManager.hideActionHint();
        }
        if (this.skillIndicator) { this.scene.remove(this.skillIndicator); this.skillIndicator = null; }
        this.activeSkill = null;
        
        // 停止所有单位的攻击，清除目标
        [...this.playerUnits, ...this.enemyUnits].forEach(u => {
            u.target = null;
            // 隐藏血条
            if (u.hpSprite) u.hpSprite.visible = false;
            // 确保胜者面向前进方向
            if (isVictory && u.side === 'player') u.isVictoryMarch = true;
            if (!isVictory && u.side === 'enemy') u.isVictoryMarch = true;
        });

        // 清理事件监听
        window.removeEventListener('contextmenu', this.onContextMenu);
        window.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointerdown', this.handleSkillTargeting);
        
        console.log(message);
        const survivalCounts = {};
        Object.keys(this.initialCounts).forEach(type => survivalCounts[type] = 0);
        this.playerUnits.forEach(u => { if (!u.isDead) survivalCounts[u.type]++; });
        const armyChanges = {};
        const losses = {};
        const survivalRate = modifierManager.getModifiedValue({ side: 'player' }, 'survival_rate', 0);
        Object.keys(this.deployedCounts).forEach(type => {
            const rawLoss = this.deployedCounts[type] - survivalCounts[type];
            if (rawLoss > 0) {
                const finalLoss = Math.floor(rawLoss * (1 - survivalRate));
                if (finalLoss > 0) { armyChanges[type] = -finalLoss; losses[type] = finalLoss; }
            }
        });
        worldManager.updateHeroArmy(armyChanges);
        if (isVictory) {
            const totalPoints = this.enemyConfig ? this.enemyConfig.totalPoints : 0;
            const { timeManager } = await import('../core/TimeManager.js');
            const xpGained = Math.floor(totalPoints * 4 * (1.0 + timeManager.getGlobalProgress() * 0.05));
            
            // 记录升级前的状态，用于结算界面展示
            const data = worldManager.heroData;
            this.xpBefore = data.xp;
            this.xpMaxBefore = data.xpMax;
            this.levelBefore = data.level;
            
            worldManager.gainXP(xpGained);
            
            // 记录升级后的状态
            this.xpAfter = data.xp;
            this.xpMaxAfter = data.xpMax;
            this.levelAfter = data.level;
            this.xpGained = xpGained;
        } else {
            this.xpGained = 0;
        }

        // 延迟 2 秒弹出结算界面，并播放对应音效
        setTimeout(() => {
            this.isActive = false; // 正式停止逻辑更新
            this.isPostBattleSequence = false;
            
            if (isVictory) {
                audioManager.play('battle_victory');
            } else {
                audioManager.play('battle_defeat');
            }
            this.showSettlementUI(isVictory, losses);
        }, 2000);
    }

    showSettlementUI(isVictory, losses) {
        document.getElementById('deployment-ui').classList.add('hidden');
        if (document.getElementById('battle-bottom-ui')) {
            document.getElementById('battle-bottom-ui').classList.add('hidden');
        }
        const panel = document.getElementById('battle-settlement');
        document.getElementById('settlement-title').innerText = isVictory ? "战斗胜利" : "战斗失败";
        document.getElementById('settlement-title').style.color = isVictory ? "var(--jx3-celadon-dark)" : "#cc0000";

        // --- 阅历结算展示 ---
        const xpSection = document.getElementById('settlement-xp-section');
        if (isVictory && this.xpGained > 0) {
            if (xpSection) xpSection.style.display = 'flex';
            const xpVal = document.getElementById('settlement-xp-val');
            const xpBar = document.getElementById('settlement-xp-bar');
            const xpLevelVal = document.getElementById('settlement-level-val');
            
            if (xpVal) xpVal.innerText = `+${this.xpGained}`;
            if (xpLevelVal) xpLevelVal.innerText = `Lv.${this.levelBefore}`;

            if (xpBar) {
                const isLevelUp = this.levelAfter > this.levelBefore;
                const startPct = (this.xpBefore / this.xpMaxBefore) * 100;
                const endPct = (this.xpAfter / this.xpMaxAfter) * 100;
                
                // 初始状态
                xpBar.style.transition = 'none';
                xpBar.style.width = `${startPct}%`;
                
                // 强制重绘
                xpBar.offsetHeight;

                if (!isLevelUp) {
                    // 情况 A: 未升级，平滑增长到目标百分比
                    requestAnimationFrame(() => {
                        xpBar.style.transition = 'width 1.5s cubic-bezier(0.22, 1, 0.36, 1)';
                        xpBar.style.width = `${endPct}%`;
                    });
                } else {
                    // 情况 B: 升了级，分两段展示
                    requestAnimationFrame(() => {
                        // 第一段：从当前涨到 100%
                        xpBar.style.transition = 'width 0.8s ease-in';
                        xpBar.style.width = '100%';
                        
                        setTimeout(() => {
                            // 瞬间重置到 0%
                            xpBar.style.transition = 'none';
                            xpBar.style.width = '0%';
                            
                            // 更新等级显示
                            if (xpLevelVal) {
                                xpLevelVal.innerText = `Lv.${this.levelAfter}`;
                                xpLevelVal.style.transform = 'scale(1.2)';
                                xpLevelVal.style.transition = 'transform 0.2s';
                                setTimeout(() => xpLevelVal.style.transform = 'scale(1)', 200);
                            }
                            
                            // 强制重绘后再涨到最终位置
                            xpBar.offsetHeight;
                            
                            setTimeout(() => {
                                xpBar.style.transition = 'width 1.0s cubic-bezier(0.22, 1, 0.36, 1)';
                                xpBar.style.width = `${endPct}%`;
                            }, 50);
                        }, 850); // 略多于第一段 transition 时间
                    });
                }
            }
        } else {
            if (xpSection) xpSection.style.display = 'none';
        }

        const list = document.getElementById('settlement-losses-list');
        const label = document.getElementById('settlement-losses-label');
        list.innerHTML = '';
        const lossTypes = Object.keys(losses);
        
        if (lossTypes.length === 0) { 
            // 无损情况：隐藏标题，显示居中的优雅提示
            if (label) label.style.display = 'none';
            const emptyHint = document.createElement('div');
            emptyHint.className = 'loss-empty-hint';
            emptyHint.innerText = '没有士兵损失。';
            list.appendChild(emptyHint);
        } else {
            // 有变化情况：显示标题和列表
            if (label) label.style.display = 'block';
            lossTypes.forEach(type => {
                const iconStyle = spriteFactory.getIconStyle(type);
                const item = document.createElement('div');
                item.className = 'loss-item';
                item.innerHTML = `<div class="slot-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize}; image-rendering: pixelated; width: 32px; height: 32px;"></div><div class="loss-count">-${losses[type]}</div><div class="loss-name">${this.getUnitName(type)}</div>`;
                list.appendChild(item);
            });
        }
        panel.classList.remove('hidden');
        if (document.getElementById('return-to-world-btn')) {
            document.getElementById('return-to-world-btn').onclick = () => {
                // 停止士兵呐喊
                if (this._shoutAudio) {
                    this._shoutAudio.pause();
                    this._shoutAudio.remove();
                    this._shoutAudio = null;
                }
                
                // 恢复大世界 BGM (断点续播)
                audioManager.playBGM('/audio/bgm/如寄.mp3');

                panel.classList.add('hidden');
                window.dispatchEvent(new CustomEvent('battle-finished', { 
                    detail: { winner: isVictory ? 'player' : 'enemy' } 
                }));
            };
        }
    }

    getUnitName(type) {
        const names = { 'melee': '天策弟子', 'ranged': '长歌弟子', 'tiance': '天策骑兵', 'chunyang': '纯阳弟子', 'cangjian': '藏剑弟子', 'cangyun': '苍云将士', 'archer': '唐门射手', 'healer': '万花补给' };
        return names[type] || type;
    }
}
