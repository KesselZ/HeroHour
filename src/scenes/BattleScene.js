import * as THREE from 'three';
import { 
    MeleeSoldier, RangedSoldier, Archer, Healer, 
    Cangjian, Cangyun, Tiance, Chunyang,
    WildBoar, Wolf, Tiger, Bear,
    Bandit, BanditArcher, RebelSoldier, RebelAxeman,
    Snake, Bats, Deer, Pheasant,
    AssassinMonk, Zombie, HeavyKnight, ShadowNinja,
    TianyiGuard, TianyiCrossbowman, TianyiApothecary, TianyiVenomZombie,
    TianyiPriest, TianyiAbomination, TianyiElder, TianyiShadowGuard,
    ShenceInfantry, ShenceShieldguard, ShenceCrossbowman, ShenceBannerman,
    ShenceCavalry, ShenceOverseer, ShenceAssassin, ShenceIronPagoda,
    RedCultPriestess, RedCultHighPriestess, RedCultSwordsman, RedCultArcher,
    RedCultAssassin, RedCultFireMage, RedCultExecutioner, RedCultAcolyte, RedCultEnforcer,
    HeroUnit, CYTwinBlade, CYSwordArray, CYZixiaDisciple, CYTaixuDisciple, CYFieldMaster,
    CJRetainer, CJWenshui, CJShanju, CJXinjian, CJGoldenGuard, CJElder,
    TCCrossbow, TCBanner, TCDualBlade, TCHalberdier, TCShieldVanguard, TCMountedCrossbow, TCHeavyCavalry
} from '../entities/Soldier.js';

import { worldManager } from '../core/WorldManager.js';
import { modifierManager } from '../systems/ModifierManager.js';
import { spriteFactory } from '../engine/SpriteFactory.js';
import { SkillRegistry } from '../systems/SkillSystem.js';

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
    'shadow_ninja': ShadowNinja,
    'tianyi_guard': TianyiGuard,
    'tianyi_crossbowman': TianyiCrossbowman,
    'tianyi_apothecary': TianyiApothecary,
    'tianyi_venom_zombie': TianyiVenomZombie,
    'tianyi_priest': TianyiPriest,
    'tianyi_abomination': TianyiAbomination,
    'tianyi_elder': TianyiElder,
    'tianyi_shadow_guard': TianyiShadowGuard,
    'shence_infantry': ShenceInfantry,
    'shence_shieldguard': ShenceShieldguard,
    'shence_crossbowman': ShenceCrossbowman,
    'shence_bannerman': ShenceBannerman,
    'shence_cavalry': ShenceCavalry,
    'shence_overseer': ShenceOverseer,
    'shence_assassin': ShenceAssassin,
    'shence_iron_pagoda': ShenceIronPagoda,
    'red_cult_priestess': RedCultPriestess,
    'red_cult_high_priestess': RedCultHighPriestess,
    'red_cult_swordsman': RedCultSwordsman,
    'red_cult_archer': RedCultArcher,
    'red_cult_assassin': RedCultAssassin,
    'red_cult_firemage': RedCultFireMage,
    'red_cult_executioner': RedCultExecutioner,
    'red_cult_acolyte': RedCultAcolyte,
    'red_cult_enforcer': RedCultEnforcer,
    'cy_twin_blade': CYTwinBlade,
    'cy_sword_array': CYSwordArray,
    'cy_zixia_disciple': CYZixiaDisciple,
    'cy_taixu_disciple': CYTaixuDisciple,
    'cy_field_master': CYFieldMaster,
    'cj_retainer': CJRetainer,
    'cj_wenshui': CJWenshui,
    'cj_shanju': CJShanju,
    'cj_xinjian': CJXinjian,
    'cj_golden_guard': CJGoldenGuard,
    'cj_elder': CJElder,
    'tc_crossbow': TCCrossbow,
    'tc_banner': TCBanner,
    'tc_dual_blade': TCDualBlade,
    'tc_halberdier': TCHalberdier,
    'tc_shield_vanguard': TCShieldVanguard,
    'tc_mounted_crossbow': TCMountedCrossbow,
    'tc_heavy_cavalry': TCHeavyCavalry
};

import { GrasslandEnvironment, AutumnEnvironment, WinterEnvironment } from '../environment/Environments.js';
import { terrainManager, TERRAIN_STYLES } from '../world/TerrainManager.js';
import { weatherManager } from '../systems/WeatherManager.js';
import { ProjectileManager } from '../engine/ProjectileManager.js';
import { VFXLibrary } from '../engine/VFXLibrary.js';
import { instancedVFXManager } from '../engine/InstancedVFXManager.js';
import { SpatialHash } from '../utils/SpatialHash.js';
import { rng, setSeed } from '../utils/Random.js';

import { uiManager } from '../core/UIManager.js';
import { audioManager } from '../engine/AudioManager.js';

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
        
        // 核心重构：判断玩家是“进攻方”还是“防守方”来决定兵力分配
        let playerArmyData = { ...worldManager.heroArmy };
        let enemyArmyData = enemyConfig?.army || {};

        if (enemyConfig && enemyConfig.isCitySiege) {
            // 在攻城战中，我们需要明确谁在城里，谁在城外
            if (enemyConfig.attackerFactionId === 'player') {
                // 玩家进攻：玩家用英雄部队，敌人用城市驻军 (已由 enemyConfig.army 传入)
                playerArmyData = { ...worldManager.heroArmy };
                enemyArmyData = { ...enemyConfig.army };
            } else {
                // AI 进攻：玩家变成防御方，使用城市驻军
                playerArmyData = { ...enemyConfig.army };
                // 敌人变成发起进攻的 AI 英雄部队
                const attackerFaction = worldManager.factions[enemyConfig.attackerFactionId];
                enemyArmyData = { ...(attackerFaction?.army || {}) };
                
                console.log(`%c[战斗初始化] %c玩家作为防御方加入战斗！使用主城驻军：`, 'color: #44ccff; font-weight: bold', 'color: #fff', playerArmyData);
            }
        }

        this.unitCounts = { ...playerArmyData };
        this.initialCounts = { ...playerArmyData };
        this.deployedCounts = {}; 
        Object.keys(this.unitCounts).forEach(type => this.deployedCounts[type] = 0);

        // 如果是固定兵力（如攻城战或英雄对决），BattleScene 会在 spawnEnemiesDynamic 中直接处理 enemyArmyData
        if (enemyConfig) {
            // 重点修正：只有当真正有固定部队数据时才覆盖，否则保留 null 让 spawnEnemiesDynamic 动态生成
            if (Object.keys(enemyArmyData).length > 0) {
                enemyConfig.army = enemyArmyData;
            }
        }

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

        // 手机端长按交互支持
        this.longPressTimer = null;
        this.longPressTarget = null;
        this.isLongPressTriggered = false;
        this.touchStartPos = new THREE.Vector2();

        // 英雄引用
        this.heroUnit = null;
        this.activeSkill = null; // 当前正在准备释放的技能 (针对 location 类型)
        this.worldManager = worldManager; // 挂载管理器方便组件访问
        this.isFleeing = false; // 新增：战斗是否处于撤退逃跑状态

        // 性能监控
        this.perf = {
            lastLogTime: 0,
            collisionChecks: 0,
            spatialHashBuildTime: 0,
            unitUpdateTime: 0,
            renderTime: 0,
            totalFrameTime: 0,
            subTimings: {
                physics: 0,
                ai: 0,
                visual: 0
            }
        };

        // 性能优化：空间哈希系统
        this.spatialHash = new SpatialHash(4.0); // 网格大小设为 4.0，适配 80x30 战场与寻敌/碰撞平衡

        // 战略重心缓存
        this.strategicCenters = {
            player: new THREE.Vector3(),
            enemy: new THREE.Vector3()
        };

        // 移动控制
        this.keys = { w: false, a: false, s: false, d: false };
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);

        // 全局挂载，方便兵种 AI 逻辑访问场景状态
        window.battle = this;
    }

    onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            this.keys[key] = true;
        }
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            this.keys[key] = false;
        }
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
        
        // --- 核心联动：根据大世界当前地形风格选择战斗环境 ---
        const style = terrainManager.currentBaseStyle;
        if (style === TERRAIN_STYLES.SNOW) {
            this.environment = new WinterEnvironment(this.scene);
        } else if (style === TERRAIN_STYLES.NORMAL_AUTUMN || style === TERRAIN_STYLES.AUTUMN) {
            this.environment = new AutumnEnvironment(this.scene);
        } else {
            this.environment = new GrasslandEnvironment(this.scene);
        }
        this.environment.init();

        // --- 核心联动：将大世界的天气效果同步至战场 ---
        if (weatherManager.type !== 'none') {
            const savedType = weatherManager.type;
            const savedIntensity = weatherManager.rainIntensity;
            weatherManager.init(this.scene, this.camera);
            if (savedType === 'rain') weatherManager.setRain(savedIntensity);
            else if (savedType === 'snow') weatherManager.setSnow();
        }

        // 查找地面用于射线检测
        this.ground = this.scene.children.find(obj => obj.geometry instanceof THREE.PlaneGeometry);

        // 创建部署区域指示器
        this.createDeploymentIndicator();

        // 核心改动：生成英雄 (英雄是自动生成的，不需要玩家手动部署)
        this.spawnHero();

        // 核心改动：根据来自大世界的配置生成敌人
        const totalPoints = this.enemyConfig ? this.enemyConfig.totalPoints : 60;
        this.enemyPower = totalPoints; // 记录敌人强度，用于战后奖励计算
        this.spawnEnemiesDynamic(totalPoints); 
        
        // 显示部署 UI
        document.getElementById('deployment-ui').classList.remove('hidden');
        this.setupUIListeners();
        
        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('contextmenu', this.onContextMenu); // 核心：拦截右键
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        instancedVFXManager.init(this.scene);
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
        
        // 【新功能】如果是从瞄准状态取消，让面板弹回来
        const bottomUI = document.getElementById('battle-bottom-ui');
        if (bottomUI && bottomUI.classList.contains('is-targeting')) {
            bottomUI.classList.add('force-visible');
            // 2秒后移除强制显示，恢复正常的自动感应
            setTimeout(() => bottomUI.classList.remove('force-visible'), 2000);
        }

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
        this.heroUnit.position.set(-15, 0, 0);
        
        this.playerUnits.push(this.heroUnit);
        this.scene.add(this.heroUnit);
        
        console.log(`%c[英雄入场] %c${this.heroUnit.type} 已就位 (HP: ${Math.floor(this.heroUnit.health)}/${this.heroUnit.maxHealth})`, 
            'color: #ff9900; font-weight: bold', 'color: #fff');
    }

    createDeploymentIndicator() {
        // 核心改动：由于逻辑边界缩减为 X:[-40, 40]，部署区也要同步缩减
        // 原本是 50x30，现在改为 40x30，中心点设在 -20
        const geometry = new THREE.PlaneGeometry(40, 30);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.08, 
            side: THREE.DoubleSide,
            depthWrite: false 
        });
        this.placementZoneIndicator = new THREE.Mesh(geometry, material);
        this.placementZoneIndicator.rotation.x = -Math.PI / 2;
        // 中心点设在 -20，覆盖范围就是 -40 到 0
        this.placementZoneIndicator.position.set(-20, 0.01, 0); 
        this.scene.add(this.placementZoneIndicator);
    }

    setupUIListeners() {
        const container = document.querySelector('.unit-slots');
        if (!container) return;

        // 1. 清空原有硬编码占位符
        container.innerHTML = '';

        // 2. 动态生成当前英雄拥有的所有兵种槽位
        Object.keys(this.unitCounts).forEach(type => {
            // 只显示数量大于 0 的兵种，避免 UI 过于拥挤
            if (this.unitCounts[type] <= 0) return;

            const slot = document.createElement('div');
            slot.className = 'unit-slot';
            slot.setAttribute('data-type', type);

            const icon = document.createElement('div');
            icon.className = 'slot-icon';
            // 应用来自 SpriteFactory 的精灵图样式 (支持全兵种)
            Object.assign(icon.style, spriteFactory.getIconStyle(type));
            
            const count = document.createElement('span');
            count.className = 'slot-count';
            count.innerText = `x${this.unitCounts[type]}`;

            slot.appendChild(icon);
            slot.appendChild(count);
            container.appendChild(slot);

            // 3. 绑定 Tooltip 绑定器
            uiManager.bindTooltip(slot, () => {
                const stats = worldManager.getUnitDetails(type, 'player');
                const cost = worldManager.unitCosts[type]?.cost || 0;
                return {
                    name: stats.name,
                    level: `气血:${stats.hp} | 伤害:${stats.dps} | 占用:${cost}`,
                    description: stats.description || '精锐的大唐将士。',
                    color: '#d4af37' // 友军金色
                };
            });

            // 4. 绑定点击选择逻辑
            slot.onclick = (e) => {
                // 移除其他选中状态
                document.querySelectorAll('.unit-slot').forEach(s => s.classList.remove('selected'));
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

        // 4. 绑定开战按钮
        const fightBtn = document.getElementById('fight-btn');
        if (fightBtn) {
            fightBtn.onclick = () => this.startFighting();
        }
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
        // --- 核心改动：如果传入了具体的 army 对象，则直接按照该兵力生成，不再随机购买 ---
        if (this.enemyConfig && this.enemyConfig.army) {
            console.log("%c[战斗系统] %c检测到敌方固定编制，正在按实名部署...", "color: #ffcc00; font-weight: bold", "color: #fff");
            this._spawnFixedArmy(this.enemyConfig.army);
            return;
        }

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

        // --- 核心重构：预算均分算法 (Equal Budget Partitioning) ---
        // 1. 计算每种单位的基准份额
        const sharePerType = Math.floor(totalPoints / selectedClasses.length);
        
        // 2. 第一阶段：每种单位按份额“保底”购买
        selectedClasses.forEach(Cls => {
            const tempUnit = new Cls('enemy', 0, this.projectileManager);
            const cost = tempUnit.cost;
            const count = Math.floor(sharePerType / cost);
            
            for (let i = 0; i < count; i++) {
                armyList.push(Cls);
            }
            remainingPoints -= (count * cost);

            // 清理临时对象
            tempUnit.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });

        // 3. 第二阶段：余钱“向下寻宝” (由贵到便宜购买，确保预算充分利用)
        // 获取单位 cost 并按降序排列
        const classWithCost = selectedClasses.map(Cls => {
            const temp = new Cls('enemy', 0, this.projectileManager);
            const cost = temp.cost;
            temp.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            return { Cls, cost };
        }).sort((a, b) => b.cost - a.cost);

        for (const item of classWithCost) {
            while (remainingPoints >= item.cost) {
                armyList.push(item.Cls);
                remainingPoints -= item.cost;
            }
        }

        // 4. 摆放单位 (使用数据驱动的区域逻辑)
        armyList.forEach((Cls, idx) => {
            const unit = new Cls('enemy', idx, this.projectileManager);
            const blueprint = this.worldManager.getUnitBlueprint(unit.type);
            const allowedZones = blueprint.allowedZones || ['front']; 
            
            const selectedZone = allowedZones[Math.floor(Math.random() * allowedZones.length)];
            
            let zoneX; 
            switch (selectedZone) {
                case 'front':
                    zoneX = 2 + Math.random() * 8;   // 前排 (X: 2-10)
                    break;
                case 'middle':
                    zoneX = 12 + Math.random() * 8;  // 中排 (X: 12-20)
                    break;
                case 'back':
                    zoneX = 22 + Math.random() * 6;  // 后排 (X: 22-28)
                    break;
                default:
                    zoneX = 2 + Math.random() * 8;
            }

            const zPos = (Math.random() - 0.5) * 18;
            unit.position.set(zoneX, 0, zPos);
            unit.visible = true; 
            this.enemyUnits.push(unit);
            this.scene.add(unit);
        });

        console.log(`%c[敌军生成] %c总预算: ${totalPoints}, 实际消耗: ${totalPoints - remainingPoints}, 兵力: ${armyList.length}`, 
            'color: #ff4444; font-weight: bold', 'color: #fff');
    }

    _spawnFixedArmy(armyData) {
        let idx = 0;
        for (const [type, count] of Object.entries(armyData)) {
            const Cls = UnitTypeMap[type];
            if (!Cls) continue;

            for (let i = 0; i < count; i++) {
                const unit = new Cls('enemy', idx++, this.projectileManager);
                const blueprint = this.worldManager.getUnitBlueprint(unit.type);
                const allowedZones = blueprint.allowedZones || ['front']; 
                const selectedZone = allowedZones[Math.floor(Math.random() * allowedZones.length)];
                
                let zoneX; 
                switch (selectedZone) {
                    case 'front': zoneX = 2 + Math.random() * 8; break;
                    case 'middle': zoneX = 12 + Math.random() * 8; break;
                    case 'back': zoneX = 22 + Math.random() * 6; break;
                    default: zoneX = 2 + Math.random() * 8;
                }
                const zPos = (Math.random() - 0.5) * 18; 
                
                unit.position.set(zoneX, 0, zPos);
                unit.visible = true; 
                this.enemyUnits.push(unit);
                this.scene.add(unit);
            }
        }
        console.log(`%c[战斗系统] %c固定编制部署完成，共计 ${idx} 名单位`, 'color: #ffcc00; font-weight: bold', 'color: #fff');
    }

    onPointerDown(event) {
        if (!this.isActive && !this.isDeployment) return;
        if (event.target.closest('#deployment-ui') || event.target.closest('.wuxia-btn')) return;

        // --- 手机端长按逻辑启动 ---
        const isTouch = event.pointerType === 'touch';
        if (isTouch) {
            this.touchStartPos.set(event.clientX, event.clientY);
            this.isLongPressTriggered = false;

            // 检测是否点中了敌军
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const enemyMeshes = this.enemyUnits.map(u => u.unitSprite).filter(s => s);
            const enemyIntersects = this.raycaster.intersectObjects(enemyMeshes, true);

            if (enemyIntersects.length > 0) {
                const hitSprite = enemyIntersects[0].object;
                const enemyHit = this.enemyUnits.find(u => u.unitSprite === hitSprite);
                if (enemyHit) {
                    this.longPressTarget = enemyHit;
                    this.longPressTimer = setTimeout(() => {
                        const stats = worldManager.getUnitDetails(enemyHit.type, 'enemy');
                        const cost = worldManager.unitCosts[enemyHit.type]?.cost || 0;
                        uiManager.showTooltip({
                            name: stats.name,
                            level: `气血:${stats.hp} | 伤害:${stats.dps} | 占用:${cost}`,
                            description: stats.description || '敌方精锐部队。',
                            color: '#ff4444' // 敌对红色
                        });
                        this.isLongPressTriggered = true;
                        if (navigator.vibrate) navigator.vibrate(20);
                    }, 500);
                }
            }
        }

        this.isPointerDown = true;
        
        // 如果是部署模式且左键点击，则处理位置
        if (this.isDeployment && event.button === 0 && (!isTouch || !this.longPressTarget)) {
            this.handlePlacement(event);
        }
    }

    onPointerMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // 如果移动距离过大，取消长按计时
        if (this.longPressTimer) {
            const dist = Math.sqrt(Math.pow(event.clientX - this.touchStartPos.x, 2) + Math.pow(event.clientY - this.touchStartPos.y, 2));
            if (dist > 15) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
        }

        if (!this.isDeployment) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // --- 核心新增：备战阶段探测敌军属性 (PC 悬停) ---
        let enemyHit = null;
        if (event.pointerType !== 'touch') {
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
            if (this.isPointerDown && !this.isLongPressTriggered) this.handlePlacement(event);
        } else if (this.previewSprite) {
            this.previewSprite.visible = false;
        }
    }

    onPointerUp() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
        this.isPointerDown = false;
        this.longPressTarget = null;
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
            unit.position.set(position.x, 0, position.z);
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
            unit.position.y = 0;
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
        const startHaste = modifierManager.getModifiedValue({ side: 'player' }, 'battle_start_haste', 1.0);
        const startSpeed = modifierManager.getModifiedValue({ side: 'player' }, 'battle_start_speed', 1.0);
        
        if (startHaste > 1.0 || startSpeed > 1.0) {
            console.log(`[战斗开始] 激励士气生效：攻速+${((startHaste-1)*100).toFixed(0)}%, 移速+${((startSpeed-1)*100).toFixed(0)}%`);
            this.applyBuffToUnits(this.playerUnits, {
                tag: 'talent_haste',
                stat: ['attackSpeed', 'speed'],
                multiplier: [startHaste, startSpeed],
                duration: 8000,
                color: 0xffffaa, // 浅金色振奋
                vfxName: 'rising_particles'
            });
        }

        console.log("部署完成，江湖开战！");
    }

    initSkillUI() {
        const bottomUI = document.getElementById('battle-bottom-ui');
        const filterContainer = document.getElementById('skill-category-filters');
        
        if (bottomUI) {
            bottomUI.classList.remove('hidden');
            bottomUI.classList.add('autohide'); // 启用自动收缩
        }
        
        // 核心重构：隐藏过滤器，改为全显示并分组
        if (filterContainer) filterContainer.style.display = 'none';
        if (!bottomUI) return;

        this.updateMPUI();
        this.renderSkills();
    }

    renderSkills() {
        const skillSlots = document.getElementById('skill-slots');
        if (!skillSlots) return;

        skillSlots.innerHTML = '';
        const heroData = this.worldManager.heroData;
        const heroSkills = heroData.skills;

        if (!heroSkills || heroSkills.length === 0) {
            skillSlots.innerHTML = `
                <div class="no-skills-msg">
                    <div class="no-skills-icon">?</div>
                    <span>暂无习得技能</span>
                </div>
            `;
            return;
        }

        // 1. 按类别对技能进行分组
        const groupedSkills = {};
        heroSkills.forEach(skillId => {
            const skill = SkillRegistry[skillId];
            if (!skill) return;
            const cat = skill.category || '基础';
            if (!groupedSkills[cat]) groupedSkills[cat] = [];
            groupedSkills[cat].push({ id: skillId, data: skill });
        });

        // 2. 遍历类别进行渲染
        Object.entries(groupedSkills).forEach(([category, skills]) => {
            // 创建分组容器
            const groupWrap = document.createElement('div');
            groupWrap.className = 'skill-group-wrap';
            
            // 添加类别标签
            const header = document.createElement('div');
            header.className = 'skill-group-header';
            header.innerText = category;
            groupWrap.appendChild(header);

            // 添加技能列表容器
            const list = document.createElement('div');
            list.className = 'skill-group-list';
            
            skills.forEach(item => {
                const skillId = item.id;
                const skill = item.data;
                const btn = document.createElement('div');
                btn.className = 'skill-btn';
                btn.id = `skill-${skillId}`;
                const iconStyle = spriteFactory.getIconStyle(skill.icon);
                
                // 核心修复：优先使用实时的 heroUnit (包含战斗中的 Buff)
                const caster = this.heroUnit || { side: 'player', isHero: true, type: heroData.id };
                const mpMult = modifierManager.getModifiedValue(caster, 'mana_cost_multiplier', 1.0);
                
                const actualCost = Math.floor(skill.cost * mpMult);
                const actualCD = skill.getActualCooldown(caster);
                
                btn.innerHTML = `
                    <div class="skill-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize}; image-rendering: pixelated; width: 32px; height: 32px;"></div>
                    <div class="skill-cost">内:${actualCost}</div>
                    <div class="cooldown-overlay" id="cd-${skillId}"></div>
                    <div class="skill-name-tag">${skill.name}</div>
                `;

                // 使用优雅的 Tooltip 绑定器
                uiManager.bindTooltip(btn, () => {
                    const skill = SkillRegistry[skillId];
                    if (!skill) return null;
                    const heroData = this.worldManager.heroData;
                    const caster = this.heroUnit || { side: 'player', isHero: true, type: heroData.id };
                    
                    const mpMult = modifierManager.getModifiedValue(caster, 'mana_cost_multiplier', 1.0);
                    const cost = Math.floor(skill.cost * mpMult);
                    const cd = (skill.getActualCooldown(caster) / 1000).toFixed(1);
                    
                    return {
                        name: skill.name,
                        level: skill.level,
                        mpCost: `消耗: ${cost} 内力`,
                        cdText: `冷却: ${cd}s`,
                        description: skill.getDescription(this.heroUnit || heroData),
                        type: 'skill',
                        skillId: skillId,
                        heroData: this.heroUnit || heroData
                    };
                });

                btn.onclick = (e) => { e.stopPropagation(); this.onSkillBtnClick(skillId); };
                list.appendChild(btn);

                // 如果技能正在冷却中，需要重新启动动画
                const now = Date.now();
                const elapsed = now - (skill.lastUsed || 0);
                if (elapsed < actualCD) {
                    this.startSkillCDAnimation(skillId, actualCD, elapsed);
                }
            });

            groupWrap.appendChild(list);
            skillSlots.appendChild(groupWrap);
        });
    }

    updateMPUI() {
        const fill = document.getElementById('battle-mp-fill');
        const text = document.getElementById('battle-mp-text');
        if (!fill || !text) return;
        const data = this.worldManager.heroData;

        // 性能优化：内力数值没有实质变化时跳过 DOM 操作
        const mpInt = Math.floor(data.mpCurrent);
        if (this._lastMP === mpInt && this._lastMaxMP === data.mpMax) return;
        this._lastMP = mpInt;
        this._lastMaxMP = data.mpMax;
        
        const pct = (data.mpCurrent / data.mpMax) * 100;
        fill.style.width = `${pct}%`;
        text.innerText = `内力: ${mpInt}/${data.mpMax}`;
    }

    onSkillBtnClick(skillId) {
        if (!this.isActive) return;
        // 核心修复：英雄死亡后无法点击技能按钮
        if (this.heroUnit && this.heroUnit.isDead) return;

        const skill = SkillRegistry[skillId];
        if (!skill) return;
        if (!skill.isReady(this.worldManager.heroData)) return;

        if (skill.targeting.type === 'location') {
            this.activeSkill = skillId;
            this.showSkillIndicator(skillId, skill.targeting);
        } else {
            this.executeSkill(skillId);
        }
    }

    handleSkillTargeting(event) {
        if (!this.isActive || !this.activeSkill) return;

        // 核心修复：英雄死亡时立即取消选区状态
        if (this.heroUnit && this.heroUnit.isDead) {
            this.cancelActiveSkill();
            return;
        }

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
        // 核心修复：防止死亡后通过任何途径触发技能执行
        if (this.heroUnit && this.heroUnit.isDead) {
            this.cancelActiveSkill();
            return;
        }

        const skill = SkillRegistry[skillId];
        if (!skill) return;
        const success = skill.execute(this, this.heroUnit, targetPos);
        if (success) {
            window.dispatchEvent(new CustomEvent('hero-stats-changed'));
            this.updateMPUI();
            
            // 核心修复：统一使用 ModifierManager 获取已截断的冷却倍率
            const cdMult = modifierManager.getModifiedValue(this.heroUnit, 'cooldown_multiplier', 1.0);
            const actualCD = skill.cooldown * cdMult;
            
            this.startSkillCDAnimation(skillId, actualCD);
        }
        this.activeSkill = null;
        this.hideSkillIndicator(); // 确保释放后隐藏指示器，同时也恢复 UI 展开（如果鼠标在的话）
    }

    startSkillCDAnimation(skillId, cooldown, initialElapsed = 0) {
        const overlay = document.getElementById(`cd-${skillId}`);
        if (!overlay) return;
        
        const update = () => {
            // 检查元素是否还在 DOM 中
            const currentOverlay = document.getElementById(`cd-${skillId}`);
            if (!currentOverlay) return;

            const skill = SkillRegistry[skillId];
            if (!skill) return;

            // --- 核心：动态同步进度条 ---
            // 每一帧都获取最新的“实际冷却时长”，这样即使在冷却中途开启虎跑，进度条也会瞬间对齐
            const actualCD = skill.getActualCooldown(worldManager.heroData);
            const elapsed = Date.now() - (skill.lastUsed || 0);
            
            const progress = Math.max(0, 1 - elapsed / actualCD);
            currentOverlay.style.height = `${progress * 100}%`;
            
            if (progress > 0 && this.isActive) {
                requestAnimationFrame(update);
            }
        };
        update();
    }

    showSkillIndicator(skillId, config) {
        this.hideSkillIndicator();
        const skill = SkillRegistry[skillId];
        if (!skill) return;

        // 【新功能】进入瞄准模式时，强制收缩技能面板，防止挡住战场选点
        const bottomUI = document.getElementById('battle-bottom-ui');
        if (bottomUI) bottomUI.classList.add('is-targeting');

        // 核心：使用 getActualRadius 获取最终半径（尊重 CoC 修正器）
        const heroData = this.worldManager.heroData;
        const baseRadius = config.impactRadius || config.radius || 1;
        const actualRadius = skill.getActualRadius(heroData, baseRadius);

        // range: 释放距离
        const { range = 0, shape = 'circle' } = config;
        
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
        let geo = (shape === 'circle') ? new THREE.CircleGeometry(actualRadius, 32) : new THREE.PlaneGeometry(actualRadius * 2, actualRadius * 2);
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
        // 【新功能】退出瞄准模式，允许 UI 重新收缩
        const bottomUI = document.getElementById('battle-bottom-ui');
        if (bottomUI) bottomUI.classList.remove('is-targeting');

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
        const vfxBodyPos = unit ? new THREE.Vector3(0, unit.visualScale * 0.4, 0) : pos;
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
            case 'fire_explosion':
                this.vfxLibrary.createFireExplosionVFX(vfxPos, radius, color, duration);
                break;
            case 'rising_particles': 
                this.vfxLibrary.createParticleSystem({
                    pos: vfxPos, parent, color, duration, density: 1.5,
                    spawnRate: 100,
                    initFn: p => {
                        // 初始分布在单位身体周围
                        const r = 0.4;
                        const ang = Math.random() * Math.PI * 2;
                        p.position.set(Math.cos(ang) * r, Math.random() * 0.5, Math.sin(ang) * r);
                        p.userData.speedY = 0.02 + Math.random() * 0.02;
                    },
                    updateFn: (p, prg) => { 
                        p.position.y += p.userData.speedY; 
                        p.rotation.y += 0.1; // 粒子自身旋转
                        p.scale.setScalar((1 - prg) * 0.5); 
                        p.material.opacity = 0.8 * (1 - prg); 
                    }
                });
                break;
            case 'vfx_sparkle':
                this.vfxLibrary.createParticleSystem({
                    pos: vfxBodyPos, parent, color, duration, density,
                    spawnRate: 100,
                    initFn: p => {
                        const r = radius * 0.8;
                        // 基于身体中心点，向上偏移一点
                        p.position.set((Math.random()-0.5)*r, 0.6 + Math.random()*0.3, (Math.random()-0.5)*r);
                    },
                    updateFn: (p, prg) => { 
                        // 颗粒向下移动，且重力感逐渐增加
                        p.position.y -= 0.02; 
                        // 颗粒大一点 (0.5 -> 1.0)
                        p.scale.setScalar((1 - prg) * 1.0); 
                        p.material.opacity = 0.8 * (1 - prg); 
                    }
                });
                break;
            case 'shield': 
                this.vfxLibrary.createShieldVFX(parent, vfxBodyPos, radius, color, duration); 
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
            case 'move_hint':
                this.vfxLibrary.createMoveHintVFX(parent);
                break;
            case 'damage_number':
                this.vfxLibrary.createDamageNumberVFX(pos || (unit ? unit.position.clone() : new THREE.Vector3()), options.value, color, options.scale || 1.0);
                break;
            case 'floating_text':
                this.vfxLibrary.createFloatingTextVFX(pos || (unit ? unit.position.clone() : new THREE.Vector3()), options.text, color, options.scale || 1.0);
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

    /**
     * 三清化神逻辑实现
     */
    applySanqingHuashen(caster, options) {
        const { duration, interval, damage, swordCount, color } = options;
        
        // 1. 创建视觉表现
        const vfxCtrl = this.vfxLibrary.createSanqingSwordsVFX(caster, color, duration);
        if (!vfxCtrl) return;

        const startTime = Date.now();
        const executeCycle = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= duration || !this.isActive || caster.isDead) return;

            // 2. 依次发射 5 把剑，每把剑独立寻敌
            for (let i = 0; i < swordCount; i++) {
                setTimeout(() => {
                    if (caster.isDead || !this.isActive) return;
                    
                    // 3. 动态寻找当前最近目标
                    const target = caster.findNearestEnemy ? caster.findNearestEnemy(this.enemyUnits) : null;
                    if (!target || target.isDead) return;

                    // 触发视觉攻击
                    vfxCtrl.attack(i, target);
                    
                    // 250ms 后造成伤害（对应 VFX 中的冲刺时间）
                    setTimeout(() => {
                        if (!target || target.isDead || !this.isActive) return;
                        target.takeDamage(damage, true);
                        // 播放击中音效
                        audioManager.play('attack_air_sword', { volume: 0.15, pitchVar: 0.2 });
                    }, 250);
                    
                }, i * 200); // 每把剑间隔 200ms 发射
            }

            // 下一个周期
            // 核心重构：让发射间隔吃攻速加成，将其视为一种特殊的普通攻击
            const speedMult = modifierManager.getModifiedValue(caster, 'attackSpeed', 1.0);
            const dynamicInterval = interval / speedMult;
            
            setTimeout(executeCycle, dynamicInterval);
        };

        // 立即开始第一个周期
        executeCycle();
    }

    /**
     * 持续伤害 API (DOT - Damage Over Time)
     */
    applyDOT(unit, options) {
        const { damage, interval, count, color = 0xff3333, isHeroSource = false, immediate = false } = options;
        let ticksLeft = count;

        const executeTick = () => {
            if (unit.isDead || ticksLeft <= 0 || !this.isActive) return;

            // 1. 造成伤害
            unit.takeDamage(damage, isHeroSource);
            
            // 2. 视觉反馈
            this.playVFX('vfx_sparkle', { unit, color, duration: 300, radius: 0.5 });

            ticksLeft--;
            if (ticksLeft > 0) {
                setTimeout(executeTick, interval);
            }
        };

        if (immediate) {
            executeTick();
        } else {
            setTimeout(executeTick, interval);
        }
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
        
        // --- 核心优化：利用空间哈希进行范围查询 ---
        let potentialTargets;
        if (this.spatialHash) {
            potentialTargets = this.spatialHash.query(center.x, center.z, radius);
        } else {
            potentialTargets = [];
            if (targetSide === 'enemy' || targetSide === 'all') potentialTargets.push(...this.enemyUnits);
            if (targetSide === 'player' || targetSide === 'all') potentialTargets.push(...this.playerUnits);
        }

        return potentialTargets.filter(unit => {
            if (unit.isDead) return false;
            
            // 阵营过滤
            if (targetSide === 'enemy' && unit.side !== 'enemy') return false;
            if (targetSide === 'player' && unit.side !== 'player') return false;

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
        const { stat, multiplier, offset, duration, color, vfxName, tag, sourceCategory } = options;

        units.forEach(unit => {
            // 1. 播放特效
            if (vfxName) this.playVFX(vfxName, { unit, duration, color: color || 0xffffff, radius: unit.isHero ? 1.5 : 0.8 });
            
            // 2. 记录颜色反馈
            if (color && tag && unit.activeColors) {
                unit.activeColors.set(tag, color);
            }

            // --- 核心重构：通用的气场天赋联动 (Universal Field Linkage) ---
            // 逻辑：不再在每个技能里硬编码联动，而是只要标记了 sourceCategory === '气场'，就自动检查相关天赋
            if (sourceCategory === '气场' && unit.isHero && unit.side === 'player') {
                const regenVal = modifierManager.getModifiedValue(unit, 'chunyang_array_mp_regen_enabled', 0);
                console.log(`%c[气场检测] %c目标: ${unit.type}, 来源类别: ${sourceCategory}, 天赋回蓝量: ${regenVal}`, 'color: #00ffcc', 'color: #fff');
                
                if (regenVal > 0) {
                    console.log(`%c[天赋激活] %c坐忘无我生效！为 ${unit.type} 注入 ${regenVal} 点/秒回蓝`, 'color: #ffff00; font-weight: bold', 'color: #fff');
                    modifierManager.addModifier({
                        id: `talent_zuowang_${unit.side}_${tag || 'anon'}`,
                        stat: 'mpRegen',
                        offset: regenVal,
                        targetUnit: unit,
                        source: 'skill',
                        startTime: Date.now(),
                        duration: duration
                    });
                }
            }

            const stats = Array.isArray(stat) ? stat : [stat];
            const multipliers = Array.isArray(multiplier) ? multiplier : [multiplier];
            const offsets = Array.isArray(offset) ? offset : [offset];

            // 3. 为每个属性添加 Modifier (由 ModifierManager 自动管理生命周期)
            stats.forEach((s, i) => {
                let m = multipliers[i] !== undefined ? multipliers[i] : (multipliers[0] !== undefined ? multipliers[0] : 1.0);
                let o = offsets[i] !== undefined ? offsets[i] : (offsets[0] !== undefined ? offsets[0] : 0);

                const isFlagStat = ['invincible', 'controlImmune', 'tigerHeart'].includes(s);
                if (isFlagStat && m === 1.0 && o === 0) {
                    o = 1; 
                }

                const modId = `buff_${unit.side}_${unit.type}_${unit.index}_${tag || 'anon'}_${s}`;
                
                modifierManager.addModifier({
                    id: modId,
                    stat: s,
                    multiplier: m,
                    offset: o,
                    targetUnit: unit,
                    source: 'skill',
                    startTime: Date.now(),
                    duration: duration,
                    onCleanup: () => {
                        // 核心：利用 ModifierManager 的回调清理视觉反馈
                        if (color && tag && unit.activeColors) {
                            unit.activeColors.delete(tag);
                        }
                    }
                });
            });

            // 4. 通用联动协议处理 (Data-Driven Linkage)
            // 不再需要为特定技能写 if (tag === 'xxx')，而是根据配置中的 linkedModifiers 自动执行
            if (options.linkedModifiers) {
                options.linkedModifiers.forEach(lm => {
                    const isEnabled = lm.requireTalent ? 
                                     (modifierManager.getModifiedValue(unit, lm.requireTalent, 0) > 0) : true;
                    if (isEnabled) {
                        modifierManager.addModifier({
                            id: `link_${tag || 'anon'}_${lm.stat}_${unit.side}_${unit.index}`,
                            stat: lm.stat,
                            multiplier: lm.multiplier !== undefined ? lm.multiplier : 1.0,
                            offset: lm.offset || 0,
                            targetUnit: unit,
                            source: 'skill',
                            startTime: Date.now(),
                            duration: duration
                        });
                    }
                });
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
        const { 
            duration = 300, 
            damage = 0, 
            knockback = 0, 
            jumpHeight = 0, 
            onHit = null, 
            onComplete = null,
            isHeroSource = false,
            invincible = false // 新增：是否在位移途中无敌
        } = options;

        // --- 核心增强：位移途中无敌 ---
        if (invincible && unit) {
            modifierManager.addModifier({
                id: `movement_invincible_${unit.id || 'hero'}_${Date.now()}`,
                stat: 'invincible',
                offset: 1,
                targetUnit: unit,
                source: 'skill',
                duration: duration + 50, // 稍微多给 50ms 容错，防止落地瞬间被打
                startTime: Date.now()
            });
        }

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
                unit.position.y = 0 + jumpY;

                // 3. 碰撞检测：增加判定半径至 2.0，且传入 isHeroSource 触发流血等天赋
                if (damage > 0 || knockback > 0 || onHit) {
                    this.getUnitsInArea(unit.position, { shape: 'circle', radius: 2.0 }, 'enemy').forEach(target => {
                        if (!hitUnits.has(target)) {
                            if (damage > 0) target.takeDamage(damage, isHeroSource);
                            if (knockback > 0) target.applyKnockback(unit.position, knockback);
                            if (onHit) onHit(target);
                            hitUnits.add(target);
                        }
                    });
                }
                
                if (progress < 1) requestAnimationFrame(animate); 
                else {
                    unit.position.y = 0; // 落地校准
                    // 核心修复：不再区分英雄，位移结束后全员强制触发重新索敌
                    unit.target = null; 
                    if (unit.updateAI) {
                        // 立即执行一次索敌，确保存储新坐标点下的最近敌人
                        unit.updateAI(this.enemyUnits, this.playerUnits);
                    }
                    if (onComplete) onComplete();
                }
            };
            animate();
        } else if (type === 'blink') {
            unit.position.copy(targetPos);
            unit.position.y = 0;
            // 核心修复：瞬移结束后同样强制触发重新索敌
            unit.target = null;
            if (unit.updateAI) {
                unit.updateAI(this.enemyUnits, this.playerUnits);
            }
            if (onComplete) onComplete();
        }
    }

    update(deltaTime) {
        const frameStart = performance.now();
        let start;
        this.perf.collisionChecks = 0; // 重置碰撞计数
        this.perf.subTimings.physics = 0;
        this.perf.subTimings.ai = 0;
        this.perf.subTimings.visual = 0;

        // 驱动 ModifierManager 的自动计时系统 (Point 4)
        modifierManager.update(deltaTime);

        // 驱动天气系统 (Point 5)
        weatherManager.update(deltaTime);

        // 驱动 UIManager 实时刷新 (所见即所得)
        uiManager.update();

        this.camera.position.set(0, 18, 18); 
        this.camera.lookAt(0, 0, 0);
        
        // --- 核心新增：悬停显示血条逻辑 ---
        if (this.perf.subTimings) start = performance.now();
        this.updateHoverHealthBar();
        if (this.perf.subTimings) this.perf.subTimings.visual += performance.now() - start;

        // 实时更新技能栏状态 (内力不足或主角阵亡时禁用)
        this.updateSkillUIState();

        // 实时更新英雄蓝条 (对应坐忘无我等回蓝天赋)
        this.updateMPUI();
        
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
        // 优化：如果是战斗中，BaseUnit.update 已经包含了 updateVisualState，这里可以跳过
        if (this.isDeployment || !this.isActive) {
            if (this.perf.subTimings) start = performance.now();
            [...this.playerUnits, ...this.enemyUnits].forEach(u => {
                if (u.updateVisualState) u.updateVisualState();
            });
            if (this.perf.subTimings) this.perf.subTimings.visual += performance.now() - start;
        }

        // 统一更新实例化渲染 (阵营环、技能圈、状态圈)
        instancedVFXManager.update([...this.playerUnits, ...this.enemyUnits]);

        if (this.isDeployment || !this.isActive) return;

        // --- 核心优化：构建空间哈希表 ---
        const hashStart = performance.now();
        this.spatialHash.clear();
        
        // 预先准备好存活列表，避免 100+ 个单位各自 filter 产生 O(N^2) 开销
        const alivePlayerUnits = [];
        const aliveEnemyUnits = [];
        
        const playerCenter = this.strategicCenters.player.set(0, 0, 0);
        const enemyCenter = this.strategicCenters.enemy.set(0, 0, 0);

        for (let i = 0; i < this.playerUnits.length; i++) {
            const u = this.playerUnits[i];
            if (!u.isDead) {
                this.spatialHash.insert(u);
                alivePlayerUnits.push(u);
                playerCenter.add(u.position);
            }
        }
        for (let i = 0; i < this.enemyUnits.length; i++) {
            const u = this.enemyUnits[i];
            if (!u.isDead) {
                this.spatialHash.insert(u);
                aliveEnemyUnits.push(u);
                enemyCenter.add(u.position);
            }
        }

        if (alivePlayerUnits.length > 0) playerCenter.divideScalar(alivePlayerUnits.length);
        if (aliveEnemyUnits.length > 0) enemyCenter.divideScalar(aliveEnemyUnits.length);

        this.perf.spatialHashBuildTime = performance.now() - hashStart;

        const unitStart = performance.now();
        // 传入预过滤的存活列表
        this.playerUnits.forEach(u => u.update(aliveEnemyUnits, alivePlayerUnits, deltaTime));
        this.enemyUnits.forEach(u => u.update(alivePlayerUnits, aliveEnemyUnits, deltaTime));
        this.perf.unitUpdateTime = performance.now() - unitStart;

        this.projectileManager.update(deltaTime);
        this.checkWinCondition();

        // 性能统计更新至 UI 面板 (仅开发模式)
        if (import.meta.env.DEV) {
            const alivePlayer = alivePlayerUnits.length;
            const aliveEnemy = aliveEnemyUnits.length;
            const now = performance.now();
            this.perf.totalFrameTime = now - frameStart;
            
            uiManager.updatePerfPanel({
                fps: window.perf_fps || 0,
                drawCalls: window.perf_drawCalls || 0,
                triangles: window.perf_triangles || 0,
                totalFrameTime: this.perf.totalFrameTime,
                spatialHashBuildTime: this.perf.spatialHashBuildTime,
                unitUpdateTime: this.perf.unitUpdateTime,
                subTimings: this.perf.subTimings,
                collisionChecks: this.perf.collisionChecks,
                totalUnits: alivePlayer + aliveEnemy,
                playerUnits: alivePlayer,
                enemyUnits: aliveEnemy
            });
        }
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

        // 性能优化：只有当内力值（整数部分）或英雄生死状态发生变化时，才更新技能栏状态
        const mpInt = Math.floor(heroData.mpCurrent);
        if (this._lastSkillUpdateMP === mpInt && this._lastHeroDeadState === isHeroDead) return;
        this._lastSkillUpdateMP = mpInt;
        this._lastHeroDeadState = isHeroDead;
        
        heroData.skills.forEach(skillId => {
            const btn = document.getElementById(`skill-${skillId}`);
            if (!btn) return;
            
            const skill = SkillRegistry[skillId];
            if (!skill) return;

            // 检查：主角是否存活、内力是否足够
            // 注意：冷却状态由 overlay 处理，此处主要控制“绝对不可放”的情况 (死亡/蓝耗)
            const mpMult = modifierManager.getModifiedValue({ side: 'player', isHero: true, type: heroData.id }, 'mana_cost_multiplier', 1.0);
            const actualCost = Math.floor(skill.cost * mpMult);
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
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        
        console.log(message);
        const survivalCounts = {};
        Object.keys(this.initialCounts).forEach(type => survivalCounts[type] = 0);
        this.playerUnits.forEach(u => { if (!u.isDead) survivalCounts[u.type]++; });

        const armyChanges = {};
        const settlementChanges = []; // 用于 UI 显示：[{type, loss, gain}]
        
        const survivalRate = modifierManager.getModifiedValue({ side: 'player' }, 'survival_rate', 0);
        
        Object.keys(this.deployedCounts).forEach(type => {
            const rawLoss = this.deployedCounts[type] - survivalCounts[type];
            if (rawLoss > 0) {
                let saved = 0;
                for (let i = 0; i < rawLoss; i++) {
                    if (Math.random() < survivalRate) {
                        saved++;
                    }
                }

                const finalLoss = rawLoss - saved;
                settlementChanges.push({ 
                    type, 
                    loss: -rawLoss, 
                    gain: saved 
                });

                if (finalLoss > 0) {
                    armyChanges[type] = -finalLoss;
                }
            }
        });

        // 核心修正：判断变动应该应用到英雄身上，还是城市驻军身上
        if (this.enemyConfig && this.enemyConfig.isCitySiege && this.enemyConfig.attackerFactionId !== 'player') {
            // 玩家作为防御方，损失应用到城市驻军
            worldManager.updateCityGarrison(this.enemyConfig.cityId, armyChanges);
            console.log(`%c[结算] %c防御战结束，城市驻军变动已同步至 ${this.enemyConfig.cityId}`, 'color: #44ccff', 'color: #fff');
        } else {
            // 玩家作为进攻方（或野外战斗），损失应用到英雄部队
            worldManager.updateHeroArmy(armyChanges);
        }

        // --- 核心重构：统一同步英雄战斗后的状态 (HP & MP) ---
        if (this.heroUnit) {
            worldManager.syncHeroStatsAfterBattle({
                healthRatio: this.heroUnit.health / this.heroUnit.maxHealth,
                mpCurrent: worldManager.heroData.mpCurrent,
                isDead: this.heroUnit.isDead
            });
        }

        if (isVictory) {
            const totalPoints = this.enemyConfig ? this.enemyConfig.totalPoints : 0;
            const { timeManager } = await import('../systems/TimeManager.js');
            const xpGained = Math.floor(totalPoints * 4);
            
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
            this.showSettlementUI(isVictory, settlementChanges);
        }, 2000);
    }

    showSettlementUI(isVictory, settlementChanges) {
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
        
        if (settlementChanges.length === 0) { 
            // 无损情况：隐藏标题，显示居中的优雅提示
            if (label) label.style.display = 'none';
            const emptyHint = document.createElement('div');
            emptyHint.className = 'loss-empty-hint';
            emptyHint.innerText = '没有士兵损失。';
            list.appendChild(emptyHint);
        } else {
            // 有变化情况：显示标题和列表
            if (label) {
                label.style.display = 'block';
                label.innerText = "兵力变动"; // 还原用户喜欢的标题
            }
            settlementChanges.forEach(change => {
                const { type, loss, gain } = change;
                const iconStyle = spriteFactory.getIconStyle(type);
                const item = document.createElement('div');
                item.className = 'loss-item';
                
                // 构建数值显示部分
                let countsHtml = `<div class="loss-count">${loss}</div>`;
                if (gain > 0) {
                    countsHtml += `<div class="gain-count">+${gain}</div>`;
                }
                
                item.innerHTML = `
                    <div class="slot-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize}; image-rendering: pixelated; width: 32px; height: 32px;"></div>
                    <div style="display: flex; align-items: center; gap: 10px; margin: 2px 0;">
                        ${countsHtml}
                    </div>
                    <div class="loss-name">${this.getUnitName(type)}</div>
                `;
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

                // 核心修复：返回大世界前，彻底清理所有战斗瞬时 Modifier
                // 解决单位死亡或战斗结束后的 Modifier 残留导致的性能与逻辑问题
                modifierManager.clearBattleModifiers();

                panel.classList.add('hidden');
                window.dispatchEvent(new CustomEvent('battle-finished', { 
                    detail: { 
                        winner: isVictory ? 'player' : 'enemy',
                        enemyPower: this.enemyPower,
                        // 鲁棒性：回传战斗发起者，方便大世界判断归属权变动
                        attackerFactionId: this.enemyConfig?.attackerFactionId || 'player'
                    } 
                }));
            };
        }
    }

    getUnitName(type) {
        // 核心修复：通过 worldManager 获取中文名，彻底解决导入冲突与 ID 显示问题
        return worldManager.getUnitDisplayName(type);
    }
}
