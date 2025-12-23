import * as THREE from 'three';
import { MeleeSoldier, RangedSoldier, Archer, Healer, Cangjian, Cangyun, Tiance, Chunyang } from '../entities/Soldier.js';
import { GrasslandEnvironment } from '../environment/Environments.js';
import { ProjectileManager } from '../core/ProjectileManager.js';
import { rng } from '../core/Random.js';

export class BattleScene {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
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
        this.unitCounts = {
            melee: 10,
            ranged: 4,
            archer: 2,
            healer: 2,
            cangjian: 2,
            tiance: 5, // 增加到 5 个骑兵用于测试
            chunyang: 2,
            cangyun: 2
        };

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        
        this.isPointerDown = false;
        this.lastPlacementPos = new THREE.Vector3();
        this.placementZoneIndicator = null;
        this.previewSprite = null;

        // 全局挂载，方便兵种 AI 逻辑访问场景状态
        window.battle = this;
    }

    start() {
        console.log("剑网三大乱斗：进入部署阶段");
        this.isActive = false; 
        this.isDeployment = true;
        
        this.environment = new GrasslandEnvironment(this.scene);
        this.environment.init();

        // 查找地面用于射线检测
        this.ground = this.scene.children.find(obj => obj.geometry instanceof THREE.PlaneGeometry);

        // 创建部署区域指示器
        this.createDeploymentIndicator();

        this.camera.position.set(0, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // 使用动态生成 API 产生敌人：设定基础强度为 60
        this.spawnEnemiesDynamic(60);
        
        // 显示部署 UI
        document.getElementById('deployment-ui').classList.remove('hidden');
        this.setupUIListeners();
        
        window.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        this.updateUI();
    }

    createDeploymentIndicator() {
        // 创建一个半透明的蓝色区域，指示玩家可以放置的位置 (x < 0)
        const geometry = new THREE.PlaneGeometry(50, 30);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff, 
            transparent: true, 
            opacity: 0.08, 
            side: THREE.DoubleSide,
            depthWrite: false // 禁用深度写入防止 Z-fight
        });
        this.placementZoneIndicator = new THREE.Mesh(geometry, material);
        this.placementZoneIndicator.rotation.x = -Math.PI / 2;
        this.placementZoneIndicator.position.set(-25, 0.01, 0); // 设为 0.01
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
        const unitClasses = [
            MeleeSoldier, RangedSoldier, Archer, Healer, 
            Cangjian, Cangyun, Tiance, Chunyang
        ];

        // 1. 随机选择 3-5 种兵种类型作为本次战斗的组合
        // 使用 Math.random() 确保每次刷新页面敌人阵型都不同
        const typeCount = Math.floor(Math.random() * 3) + 3; // 3 to 5
        const selectedClasses = [];
        const availableClasses = [...unitClasses];
        for (let i = 0; i < typeCount; i++) {
            const idx = Math.floor(Math.random() * availableClasses.length);
            selectedClasses.push(availableClasses.splice(idx, 1)[0]);
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

        // 3. 执行“合理化”布阵
        armyList.forEach((Cls, idx) => {
            const unit = new Cls('enemy', idx, this.projectileManager);
            
            let zoneX; 
            const type = unit.type;

            // 逻辑分区判定
            if (['melee', 'cangyun', 'tiance', 'cangjian'].includes(type)) {
                zoneX = 8 + Math.random() * 5; // 前排
            } else if (['ranged', 'archer', 'chunyang'].includes(type)) {
                zoneX = 14 + Math.random() * 6; // 中排
            } else {
                zoneX = 21 + Math.random() * 4; // 后排 (Healer 等)
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
        if (!this.isDeployment) return;

        // 更新预览位置
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
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
        switch(type) {
            case 'melee': unit = new MeleeSoldier('player', idx, this.projectileManager); break;
            case 'ranged': unit = new RangedSoldier('player', idx, this.projectileManager); break;
            case 'archer': unit = new Archer('player', idx, this.projectileManager); break;
            case 'healer': unit = new Healer('player', idx, this.projectileManager); break;
            case 'cangjian': unit = new Cangjian('player', idx, this.projectileManager); break;
            case 'tiance': unit = new Tiance('player', idx, this.projectileManager); break;
            case 'chunyang': unit = new Chunyang('player', idx, this.projectileManager); break;
            case 'cangyun': unit = new Cangyun('player', idx, this.projectileManager); break;
        }

        if (unit) {
            unit.position.set(position.x, 0.6, position.z);
            this.playerUnits.push(unit);
            this.scene.add(unit);
            this.unitCounts[type]--;
            this.updateUI();
            
            // 如果该兵种用完了，清除选中
            if (this.unitCounts[type] <= 0) {
                this.selectedType = null;
                this.updatePreviewSprite(null);
                document.querySelectorAll('.unit-slot').forEach(s => s.classList.remove('selected'));
            }
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
        this.isDeployment = false;
        this.isActive = true;
        this.enemyUnits.forEach(u => u.visible = true); 
        document.getElementById('deployment-ui').classList.add('hidden');
        
        // 移除部署相关的监听和指示器
        window.removeEventListener('pointerdown', this.onPointerDown);
        window.removeEventListener('pointermove', this.onPointerMove);
        window.removeEventListener('pointerup', this.onPointerUp);
        
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

    update() {
        if (this.isDeployment) return;
        if (!this.isActive) return;

        this.playerUnits.forEach(u => u.update(this.enemyUnits, this.playerUnits));
        this.enemyUnits.forEach(u => u.update(this.playerUnits, this.enemyUnits));

        this.projectileManager.update();
        this.checkWinCondition();
    }

    checkWinCondition() {
        const playerAlive = this.playerUnits.some(u => !u.isDead);
        const enemyAlive = this.enemyUnits.some(u => !u.isDead);

        if (!playerAlive) {
            this.endBattle("胜败乃兵家常事，侠士请重新来过！");
        } else if (!enemyAlive) {
            this.endBattle("这就是大唐侠士的风采！敌军已尽数伏诛。");
        }
    }

    endBattle(message) {
        this.isActive = false;
        console.log(message);
        setTimeout(() => {
            alert(message);
            location.reload(); 
        }, 1000);
    }
}
