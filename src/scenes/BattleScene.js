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
import { rng, setSeed } from '../core/Random.js';

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
        
        this.isPointerDown = false;
        this.lastPlacementPos = new THREE.Vector3();
        this.placementZoneIndicator = null;
        this.previewSprite = null;

        // 英雄引用
        this.heroUnit = null;
        this.activeSkill = null; // 当前正在准备释放的技能 (针对 location 类型)
        this.worldManager = worldManager; // 挂载管理器方便组件访问

        // 全局挂载，方便兵种 AI 逻辑访问场景状态
        window.battle = this;
    }

    start() {
        console.log("剑网三大乱斗：进入部署阶段");
        this.isActive = false; 
        this.isDeployment = true;
        
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

        // 核心改动：根据来自大世界的配置生成敌人
        const totalPoints = this.enemyConfig ? this.enemyConfig.totalPoints : 60;
        this.spawnEnemiesDynamic(totalPoints); 
        
        // 显示部署 UI
        document.getElementById('deployment-ui').classList.remove('hidden');
        this.setupUIListeners();
        
        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        this.updateUI();
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
            slot.onclick = (e) => {
                // 移除其他选中状态
                slots.forEach(s => s.classList.remove('selected'));
                const type = slot.getAttribute('data-type');
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
        // 增加边框感，让定位更精准，彻底解决双重显示的视觉差
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

        // 2. 增加一个线框，让几何边缘更清晰
        const edges = new THREE.EdgesGeometry(groundGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.6 
        }));
        line.rotation.x = -Math.PI / 2;
        line.position.y = 0.021; // 微高于填充面
        line.name = 'groundLine';
        group.add(line);

        this.previewSprite = group;
        this.previewSprite.visible = false;
        this.scene.add(this.previewSprite);
    }

    /**
     * 核心 API：根据总强度动态生成敌军布阵
     * @param {number} totalPoints 
     */
    spawnEnemiesDynamic(totalPoints) {
        // 核心改动：如果大世界传来了 enemyConfig，则使用其指定的池子
        let availableClasses = [];
        
        if (this.enemyConfig && this.enemyConfig.unitPool) {
            // 从映射表中提取允许出现的类
            availableClasses = this.enemyConfig.unitPool
                .map(type => UnitTypeMap[type])
                .filter(cls => cls);
        } else {
            // 兜底方案：全随机
            availableClasses = [
                MeleeSoldier, RangedSoldier, Archer, Healer, 
                Cangjian, Cangyun, Tiance, Chunyang
            ];
        }

        // 1. 随机选择 3-5 种兵种类型（如果池子够大）
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

        // 2. 模拟“购买”逻辑
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

        // 3. 执行“合理化”布阵：以 X=0 为前线，向右延伸
        armyList.forEach((Cls, idx) => {
            const unit = new Cls('enemy', idx, this.projectileManager);
            
            let zoneX; 
            const type = unit.type;

            // 逻辑分区判定：敌人从 X=2 以后开始放置，避免直接贴脸
            if (['melee', 'cangyun', 'tiance', 'cangjian', 'wild_boar', 'wolf', 'tiger', 'bear', 'bandit', 'rebel_soldier', 'rebel_axeman', 'heavy_knight'].includes(type)) {
                zoneX = 2 + Math.random() * 8;  // 前排 (X: 2-10)
            } else if (['ranged', 'archer', 'chunyang', 'bandit_archer', 'shadow_ninja', 'assassin_monk'].includes(type)) {
                zoneX = 12 + Math.random() * 8; // 中排 (X: 12-20)
            } else {
                zoneX = 22 + Math.random() * 6; // 后排 (X: 22-28)
            }

            const zPos = (Math.random() - 0.5) * 18;

            unit.position.set(zoneX, 0.6, zPos);
            unit.visible = false; 
            this.enemyUnits.push(unit);
            this.scene.add(unit);
        });

        console.log(`%c[敌军生成] %c总预算: ${totalPoints}, 实际消耗: ${totalPoints - remainingPoints}, 兵力: ${armyList.length}`, 
            'color: #ff4444; font-weight: bold', 'color: #fff');
    }

    spawnEnemiesHidden() {
        // 该方法已被 spawnEnemiesDynamic 替代
    }

    onPointerDown(event) {
        if (!this.isDeployment || !this.selectedType) return;
        
        // 如果点击的是 UI 元素，不处理部署
        if (event.target.closest('#deployment-ui') || event.target.closest('.wuxia-btn')) return;

        this.isPointerDown = true;
        this.handlePlacement(event);
    }

    onPointerMove(event) {
        // 实时更新鼠标坐标，供所有系统（部署、技能选位、Tooltip）使用
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (!this.isDeployment) return;

        // 更新预览位置 (仅部署阶段)
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            if (this.previewSprite) {
                this.previewSprite.position.x = point.x;
                this.previewSprite.position.z = point.z;
                this.previewSprite.visible = true;
                
                // 颜色指示：合法区域绿色，非法区域红色
                const color = point.x < 0 ? 0x00ff00 : 0xff0000;
                this.previewSprite.traverse(child => {
                    if (child.material) {
                        child.material.color.setHex(color);
            }
        });
    }

            // 如果正在按下并移动，尝试连续放置
            if (this.isPointerDown) {
                this.handlePlacement(event);
            }
        } else if (this.previewSprite) {
            this.previewSprite.visible = false;
        }
    }

    onPointerUp() {
        this.isPointerDown = false;
    }

    handlePlacement(event) {
        if (!this.selectedType || this.unitCounts[this.selectedType] <= 0) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            // 只能部署在己方半场 (x < 0)
            if (point.x < 0) {
                // 连续放置时，检查与上一个位置的距离，防止重叠太严重
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
        if (Cls) {
            unit = new Cls('player', idx, this.projectileManager);
        }

        if (unit) {
            unit.position.set(position.x, 0.6, position.z);
            this.playerUnits.push(unit);
            this.scene.add(unit);
            this.unitCounts[type]--;
            this.deployedCounts[type]++; // 记录实际派上战场的兵力
            this.updateUI();
            
            // 如果该兵种用完了，清除选中
            if (this.unitCounts[type] <= 0) {
                this.selectedType = null;
                this.updatePreviewSprite(null);
                document.querySelectorAll('.unit-slot').forEach(s => s.classList.remove('selected'));
            }
        }
    }

    /**
     * 战斗中召唤辅助单位
     */
    spawnSupportUnits(type, count, position) {
        const Cls = UnitTypeMap[type];
        if (!Cls) return;

        for (let i = 0; i < count; i++) {
            const idx = this.playerUnits.length;
            const unit = new Cls('player', idx, this.projectileManager);
            // 在指定位置附近随机偏移一点，避免重叠
            const offset = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2);
            unit.position.copy(position).add(offset);
            unit.position.y = 0.6;
            
            this.playerUnits.push(unit);
            this.scene.add(unit);
            
            // 召唤单位通常不计入初始兵力损耗，或者视需求而定
            // 这里我们简单地直接加入战场
            console.log(`%c[召唤] %c${unit.type} 加入了战斗`, 'color: #00ffff', 'color: #fff');
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
        // 关键点：开战瞬间锁定种子！
        // 这样无论是什么战斗，随机数序列（暴击、伤害浮动）都从 888 开始
        // 结果将只取决于你的兵种位置和属性
        setSeed(888);

        this.isDeployment = false;
        this.isActive = true;
        this.enemyUnits.forEach(u => u.visible = true); 
        document.getElementById('deployment-ui').classList.add('hidden');
        
        // 核心改动：初始化技能栏
        this.initSkillUI();

        // 移除部署相关的“点击和松开”监听，但保留“移动”监听以更新鼠标坐标
        window.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointerup', this.onPointerUp);
        
        // 增加一个通用的战斗中点击监听处理技能选位
        window.addEventListener('pointerdown', (e) => this.handleSkillTargeting(e));

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

        console.log("部署完成，江湖开战！");
    }

    /**
     * 初始化技能 UI 栏
     */
    initSkillUI() {
        const skillBar = document.getElementById('battle-skill-bar');
        const skillSlots = document.getElementById('skill-slots');
        if (!skillBar || !skillSlots) return;

        skillBar.classList.remove('hidden');
        this.updateMPUI();
        skillSlots.innerHTML = '';

        const heroSkills = worldManager.heroData.skills;
        heroSkills.forEach(skillId => {
            const skill = SkillRegistry[skillId];
            if (!skill) return;

            const btn = document.createElement('div');
            btn.className = 'skill-btn';
            btn.id = `skill-${skillId}`;
            
            const iconStyle = spriteFactory.getIconStyle(skill.icon);
            
            btn.innerHTML = `
                <div class="skill-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize}; image-rendering: pixelated; width: 32px; height: 32px;"></div>
                <div class="skill-cost">内:${skill.cost}</div>
                <div class="cooldown-overlay" id="cd-${skillId}"></div>
                <div class="skill-name-tag">${skill.name}</div>
            `;

            btn.onclick = (e) => {
                e.stopPropagation();
                this.onSkillBtnClick(skillId);
            };
            skillSlots.appendChild(btn);
        });
    }

    /**
     * 更新战斗内的蓝条 UI
     */
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

        // 使用 Skill 类自带的检查方法 (包含 CD 和蓝量)
        if (!skill.isReady(this.worldManager.heroData)) {
            console.warn(`技能 ${skill.name} 尚未就绪或蓝量不足`);
            return;
        }

        if (skill.targeting.type === 'location') {
            this.activeSkill = skillId;
            // 显示对应的指示器
            this.showSkillIndicator(skill.targeting);
            console.log(`请点击战场选择 [${skill.name}] 的释放位置`);
        } else {
            this.executeSkill(skillId);
        }
    }

    handleSkillTargeting(event) {
        if (!this.isActive || !this.activeSkill) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);

        if (intersects.length > 0) {
            this.executeSkill(this.activeSkill, intersects[0].point);
            this.hideSkillIndicator(); // 释放后隐藏
        }
    }

    executeSkill(skillId, targetPos = null) {
        const skill = SkillRegistry[skillId];
        if (!skill) return;

        // 调用 Skill 实例的执行方法
        const success = skill.execute(this, this.heroUnit, targetPos);

        if (success) {
            // 只有执行成功才触发 UI 更新
            window.dispatchEvent(new CustomEvent('hero-stats-changed'));
            this.updateMPUI();
            
            // 计算应用加速后的实际 CD
            const heroData = this.worldManager.heroData;
            const actualCD = skill.cooldown * (1 - (heroData.stats.haste || 0));
            this.startSkillCDAnimation(skillId, actualCD);
        }
        
        this.activeSkill = null;
    }

    startSkillCDAnimation(skillId, cooldown) {
        const overlay = document.getElementById(`cd-${skillId}`);
        if (!overlay) return;

        overlay.style.height = '100%';
        const startTime = Date.now();
        
        const update = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.max(0, 1 - elapsed / cooldown);
            overlay.style.height = `${progress * 100}%`;
            
            if (progress > 0) {
                requestAnimationFrame(update);
            }
        };
        update();
    }

    // ========================================================
    // 1. 控制层 API (指示器管理)
    // ========================================================
    
    showSkillIndicator(config) {
        this.hideSkillIndicator(); // 先清理旧的
        
        const { shape = 'circle', radius = 1 } = config;
        const group = new THREE.Group();
        
        let geo;
        if (shape === 'circle') geo = new THREE.CircleGeometry(radius, 32);
        else geo = new THREE.PlaneGeometry(radius * 2, radius * 2); // 矩形

        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, transparent: true, opacity: 0.2, depthWrite: false 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.05;
        group.add(mesh);

        // 边框
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 }));
        line.rotation.x = -Math.PI / 2;
        line.position.y = 0.051;
        group.add(line);

        this.skillIndicator = group;
        this.scene.add(this.skillIndicator);
    }

    hideSkillIndicator() {
        if (this.skillIndicator) {
            this.scene.remove(this.skillIndicator);
            this.skillIndicator.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            this.skillIndicator = null;
        }
    }

    // ========================================================
    // 2. 视觉层 API (VFX 特效库)
    // ========================================================

    playVFX(type, options) {
        const { 
            pos, 
            radius = 1, 
            color = 0xffffff, 
            duration = 1000, 
            density = 1, // 密度系数
            speed = 1.0  // 速度系数
        } = options;
        
        switch (type) {
            case 'pulse': // 增强版脉冲：多重环扩散
                const pulseGroup = new THREE.Group();
                this.scene.add(pulseGroup);
                
                // 产生 3 层扩散环
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        const pGeo = new THREE.RingGeometry(radius * 0.05, radius * 0.1, 64);
                        const pMat = new THREE.MeshBasicMaterial({ 
                            color, transparent: true, opacity: 0.8, side: THREE.DoubleSide 
                        });
                        const ring = new THREE.Mesh(pGeo, pMat);
                        ring.rotation.x = -Math.PI / 2;
                        ring.position.copy(pos).y = 0.1 + i * 0.05;
                        pulseGroup.add(ring);

                        const start = Date.now();
                        const ringAnim = () => {
                            const progress = (Date.now() - start) / (duration * 0.8);
                            if (progress < 1) {
                                const currentRadius = 0.1 + progress * radius;
                                ring.scale.set(currentRadius * 10, currentRadius * 10, 1);
                                ring.material.opacity = 0.8 * (1 - progress);
                                requestAnimationFrame(ringAnim);
                            } else {
                                pulseGroup.remove(ring);
                                pGeo.dispose(); pMat.dispose();
                            }
                        };
                        ringAnim();
                    }, i * 200);
                }
                setTimeout(() => this.scene.remove(pulseGroup), duration + 1000);
                break;

            case 'rain': // 优化版剑雨：带残影和随机偏转
                const rGroup = new THREE.Group();
                this.scene.add(rGroup);
                
                const spawnStart = Date.now();
                const spawnTimer = setInterval(() => {
                    const elapsed = Date.now() - spawnStart;
                    if (elapsed > duration) {
                        clearInterval(spawnTimer);
                        setTimeout(() => this.scene.remove(rGroup), 1000);
                        return;
                    }
                    
                    // 密度控制：每一跳生成的数量
                    const count = Math.ceil(3 * density);
                    for(let i=0; i<count; i++) {
                        // 细长的“剑”感：使用长方体或窄圆柱
                        const dropGeo = new THREE.BoxGeometry(0.04, 1.5, 0.04);
                        const dropMat = new THREE.MeshStandardMaterial({ 
                            color, emissive: color, emissiveIntensity: 2, 
                            transparent: true, opacity: 0.9 
                        });
                        const drop = new THREE.Mesh(dropGeo, dropMat);
                        
                        // 随机落点
                        const offset = new THREE.Vector3(
                            (Math.random()-0.5)*radius*2, 
                            15 + Math.random()*5, 
                            (Math.random()-0.5)*radius*2
                        );
                        drop.position.copy(pos).add(offset);
                        
                        // 稍微倾斜，增加动感
                        drop.rotation.z = (Math.random()-0.5) * 0.2;
                        rGroup.add(drop);
                        
                        // 物理模拟
                        const fallSpeed = (0.6 + Math.random()*0.4) * speed;
                        const fall = () => {
                            drop.position.y -= fallSpeed;
                            if (drop.position.y > 0.1) requestAnimationFrame(fall);
                            else {
                                rGroup.remove(drop);
                                dropGeo.dispose(); dropMat.dispose();
                            }
                        };
                        fall();
                    }
                }, 80); 
                break;

            case 'dome': // 镇山河：半透明气场罩
                const domeGeo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
                const domeMat = new THREE.MeshBasicMaterial({ 
                    color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false 
                });
                const dome = new THREE.Mesh(domeGeo, domeMat);
                dome.position.copy(pos);
                this.scene.add(dome);
                
                // 简单的呼吸动画
                const startDome = Date.now();
                const domeAnim = () => {
                    const elapsed = Date.now() - startDome;
                    if (elapsed < duration) {
                        const s = 1 + Math.sin(elapsed * 0.005) * 0.05;
                        dome.scale.set(s, s, s);
                        requestAnimationFrame(domeAnim);
                    } else {
                        this.scene.remove(dome);
                        domeGeo.dispose(); domeMat.dispose();
                    }
                };
                domeAnim();
                break;

            case 'tornado': // 风来吴山：旋转飓风
                const tGroup = new THREE.Group();
                this.scene.add(tGroup);
                
                // 由多个环组成的螺旋感
                for (let i = 0; i < 5; i++) {
                    const tGeo = new THREE.TorusGeometry(radius * (0.2 + i * 0.2), 0.05, 16, 32);
                    const tMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
                    const ring = new THREE.Mesh(tGeo, tMat);
                    ring.rotation.x = Math.PI / 2;
                    ring.position.y = i * 0.5;
                    tGroup.add(ring);
                }
                tGroup.position.copy(pos);

                const startTornado = Date.now();
                const tornadoAnim = () => {
                    const elapsed = Date.now() - startTornado;
                    if (elapsed < duration) {
                        tGroup.rotation.y += 0.2;
                        tGroup.position.y = Math.sin(elapsed * 0.01) * 0.2;
                        requestAnimationFrame(tornadoAnim);
                    } else {
                        this.scene.remove(tGroup);
                        tGroup.traverse(c => {
                            if (c.geometry) c.geometry.dispose();
                            if (c.material) c.material.dispose();
                        });
                    }
                };
                tornadoAnim();
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

            // 1. 空间查询 (复用现有的数学引擎)
            const targets = this.getUnitsInArea(center, config, targetSide);
            
            // 2. 执行每一跳的具体逻辑
            onTick(targets);

            // 3. 递归下一跳
            setTimeout(executeTick, interval);
        };

        executeTick();
    }

    // ========================================================
    // 1. 查询层 API (Single Source of Truth for Geometry)
    // ========================================================

    /**
     * 根据空间配置获取单位列表
     * @param {THREE.Vector3} center 中心点
     * @param {Object} config { shape, radius }
     * @param {string} targetSide 'enemy' | 'player' | 'all'
     */
    getUnitsInArea(center, config, targetSide = 'enemy') {
        const { shape = 'circle', radius = 1 } = config;
        const potentialTargets = [];
        
        if (targetSide === 'enemy' || targetSide === 'all') potentialTargets.push(...this.enemyUnits);
        if (targetSide === 'player' || targetSide === 'all') potentialTargets.push(...this.playerUnits);

        return potentialTargets.filter(unit => {
            if (unit.isDead) return false;
            
            if (shape === 'circle') {
                return unit.position.distanceTo(center) < radius;
            } else if (shape === 'square') {
                const dx = Math.abs(unit.position.x - center.x);
                const dz = Math.abs(unit.position.z - center.z);
                return dx < radius && dz < radius;
            }
            return false;
        });
    }

    // ========================================================
    // 2. 执行层 API (只管干活，不管人在哪)
    // ========================================================

    applyDamageToUnits(units, damage, sourcePos = null, knockback = 0) {
        units.forEach(unit => {
            unit.takeDamage(damage);
            if (knockback > 0 && sourcePos) {
                unit.applyKnockback(sourcePos, knockback);
            }
        });
    }

    applyBuffToUnits(units, options) {
        const { stat, multiplier, duration, color } = options;
        units.forEach(unit => {
            if (stat === 'attackDamage') unit.attackDamage *= multiplier;
            if (stat === 'moveSpeed') unit.moveSpeed *= multiplier;
            if (stat === 'invincible') unit.isInvincible = true;
            
            if (color) unit.unitSprite.material.color.setHex(color);

            setTimeout(() => {
                if (!unit.isDead) {
                    if (stat === 'attackDamage') unit.attackDamage /= multiplier;
                    if (stat === 'moveSpeed') unit.moveSpeed /= multiplier;
                    if (stat === 'invincible') unit.isInvincible = false;
                    if (color) unit.unitSprite.material.color.setHex(0xffffff);
                }
            }, duration);
        });
    }

    applyHealToUnits(units, amount) {
        units.forEach(unit => {
            unit.health = Math.min(unit.maxHealth, unit.health + amount);
            if (unit.updateHealthBar) unit.updateHealthBar();
        });
    }

    update(deltaTime) {
        // 1. 相机固定
        this.camera.position.set(0, 15, 18); 
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateMatrixWorld();

        // 2. 核心改动：如果正在选位，让指示器跟随鼠标
        if (this.activeSkill && this.skillIndicator) {
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.ground);
            if (intersects.length > 0) {
                this.skillIndicator.position.x = intersects[0].point.x;
                this.skillIndicator.position.z = intersects[0].point.z;
                this.skillIndicator.visible = true;
            } else {
                this.skillIndicator.visible = false;
            }
        }

        if (this.isDeployment) return;
        if (!this.isActive) return;

        this.playerUnits.forEach(u => u.update(this.enemyUnits, this.playerUnits, deltaTime));
        this.enemyUnits.forEach(u => u.update(this.playerUnits, this.enemyUnits, deltaTime));

        this.projectileManager.update(deltaTime);
        this.checkWinCondition();
    }

    checkWinCondition() {
        const playerAlive = this.playerUnits.some(u => !u.isDead);
        const enemyAlive = this.enemyUnits.some(u => !u.isDead);

        if (!playerAlive) {
            this.endBattle("胜败乃兵家常事，侠士请重新来过！", false);
        } else if (!enemyAlive) {
            this.endBattle("这就是大唐侠士的风采！敌军已尽数伏诛。", true);
        }
    }

    async endBattle(message, isVictory) {
        this.isActive = false;
        
        // 清理技能指示器
        if (this.skillIndicator) {
            this.scene.remove(this.skillIndicator);
            this.skillIndicator = null;
        }
        this.activeSkill = null;

        console.log(message);

        // 1. 统计存活兵力
        const survivalCounts = {};
        Object.keys(this.initialCounts).forEach(type => survivalCounts[type] = 0);
        this.playerUnits.forEach(u => {
            if (!u.isDead) survivalCounts[u.type]++;
        });

        // 2. 计算损耗 (负数代表死亡)
        const armyChanges = {};
        const losses = {};
        
        // 获取全局士兵存活率 (由医馆等建筑提供)
        const survivalRate = modifierManager.getModifiedValue({ side: 'player' }, 'survival_rate', 0);
        if (survivalRate > 0) {
            console.log(`%c[医馆结算] %c当前士兵战场存活率: ${(survivalRate * 100).toFixed(0)}%`, 'color: #00ffff', 'color: #fff');
        }

        Object.keys(this.deployedCounts).forEach(type => {
            const deployed = this.deployedCounts[type];
            const survived = survivalCounts[type];
            const rawLoss = deployed - survived;
            
            if (rawLoss > 0) {
                // 计算实际损失 = 原始损失 * (1 - 存活率)
                // 使用 floor 保证玩家收益最大化（向下取整损失，即向上取整存活）
                const finalLoss = Math.max(0, Math.floor(rawLoss * (1 - survivalRate)));
                const saved = rawLoss - finalLoss;
                
                if (saved > 0) {
                    console.log(`%c[仁心仁术] %c${this.getUnitName(type)} 救治成功: ${saved} 名士兵重返营地`, 'color: #00ff00', 'color: #fff');
                }

                if (finalLoss > 0) {
                    armyChanges[type] = -finalLoss;
                    losses[type] = finalLoss;
                }
            }
        });

        // 3. 更新大世界英雄数据
        worldManager.updateHeroArmy(armyChanges);
        
        // 核心改动：根据敌军战力和时间进度计算经验
        if (isVictory) {
            // 基础经验 = 战力点数 * 4
            const totalPoints = this.enemyConfig ? this.enemyConfig.totalPoints : 0;
            const baseXP = totalPoints * 4;
            
            // 时间乘数：每个季节增加 5%
            const { timeManager } = await import('../core/TimeManager.js');
            const progress = timeManager.getGlobalProgress();
            const timeMultiplier = 1.0 + (progress * 0.05);
            
            const xpGain = Math.floor(baseXP * timeMultiplier);
            
            console.log(`%c[战斗胜利] %c战力基数: ${totalPoints}, 时间加成: x${timeMultiplier.toFixed(2)}, 获得阅历: ${xpGain}`, 
                'color: #00ff00; font-weight: bold', 'color: #fff');
                
            worldManager.gainXP(xpGain);
        }

        // 4. 显示结算界面
        this.showSettlementUI(isVictory, losses);
    }

    showSettlementUI(isVictory, losses) {
        // 隐藏部署 UI 和技能栏
        document.getElementById('deployment-ui').classList.add('hidden');
        const skillBar = document.getElementById('battle-skill-bar');
        if (skillBar) skillBar.classList.add('hidden');
        
        const panel = document.getElementById('battle-settlement');
        const title = document.getElementById('settlement-title');
        const list = document.getElementById('settlement-losses-list');
        
        title.innerText = isVictory ? "战斗胜利" : "战斗失败";
        title.style.color = isVictory ? "var(--jx3-celadon-dark)" : "#cc0000";
        
        list.innerHTML = '';
        const lossTypes = Object.keys(losses);
        const lossSection = document.querySelector('.loss-section');
        
        if (lossTypes.length === 0) {
            if (lossSection) lossSection.style.display = 'none';
        } else {
            if (lossSection) lossSection.style.display = 'block';
            lossTypes.forEach(type => {
                const item = document.createElement('div');
                item.className = 'loss-item';
                
                // 复用图标逻辑
                const iconStyle = spriteFactory.getIconStyle(type);
                const iconHtml = `<div class="slot-icon" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize}; image-rendering: pixelated; width: 32px; height: 32px;"></div>`;
                
                item.innerHTML = `
                    ${iconHtml}
                    <div class="loss-count">-${losses[type]}</div>
                    <div class="loss-name">${this.getUnitName(type)}</div>
                `;
                list.appendChild(item);
            });
        }

        panel.classList.remove('hidden');

        // 绑定返回大世界按钮
        const returnBtn = document.getElementById('return-to-world-btn');
        if (returnBtn) {
            returnBtn.onclick = () => {
                panel.classList.add('hidden');
                // 派发全局事件，包含战斗结果
                window.dispatchEvent(new CustomEvent('battle-finished', { 
                    detail: { winner: isVictory ? 'player' : 'enemy' } 
                }));
            };
        }
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
        // 兼容野怪名字 (如果有的话)
        return names[type] || type;
    }
}
