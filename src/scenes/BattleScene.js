import * as THREE from 'three';
import { MeleeSoldier, RangedSoldier, Archer, Healer, Cangjian } from '../entities/Soldier.js';
import { GrasslandEnvironment } from '../environment/Environments.js';
import { ProjectileManager } from '../core/ProjectileManager.js';

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
            cangjian: 2
        };

        this.onMouseDown = this.onMouseDown.bind(this);
    }

    start() {
        console.log("剑网三大乱斗：进入部署阶段");
        this.isActive = false; 
        this.isDeployment = true;
        
        this.environment = new GrasslandEnvironment(this.scene);
        this.environment.init();

        // 查找地面用于射线检测
        this.ground = this.scene.children.find(obj => obj.geometry instanceof THREE.PlaneGeometry);

        this.camera.position.set(0, 15, 15);
        this.camera.lookAt(0, 0, 0);

        // 预生成不可见的敌人
        this.spawnEnemiesHidden();
        
        // 显示部署 UI
        document.getElementById('deployment-ui').classList.remove('hidden');
        this.setupUIListeners();
        
        window.addEventListener('mousedown', this.onMouseDown);
        this.updateUI();
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
                }
            };
        });

        document.getElementById('fight-btn').onclick = () => {
            this.startFighting();
        };
    }

    spawnEnemiesHidden() {
        const armyLayout = [
            { type: MeleeSoldier, count: 10 },
            { type: RangedSoldier, count: 4 },
            { type: Archer, count: 2 },
            { type: Healer, count: 2 },
            { type: Cangjian, count: 2 }
        ];

        let enemyIdx = 0;
        armyLayout.forEach(config => {
            for (let i = 0; i < config.count; i++) {
                const unit = new config.type('enemy', enemyIdx++, this.projectileManager);
                const row = enemyIdx % 6;
                const col = Math.floor(enemyIdx / 6);
                unit.position.set(12 + col * 1.5, 0.6, (row - 2.5) * 2.5);
                unit.visible = false; 
                this.enemyUnits.push(unit);
                this.scene.add(unit);
            }
        });
    }

    onMouseDown(event) {
        if (!this.isDeployment || !this.selectedType) return;
        if (this.unitCounts[this.selectedType] <= 0) return;

        // 射线检测
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.ground);

        if (intersects.length > 0) {
            const point = intersects[0].point;
            // 只能部署在己方半场 (x < 0)
            if (point.x < 0) {
                this.deployUnit(this.selectedType, point);
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
                }
            }
        });
    }

    startFighting() {
        this.isDeployment = false;
        this.isActive = true;
        this.enemyUnits.forEach(u => u.visible = true); 
        document.getElementById('deployment-ui').classList.add('hidden');
        window.removeEventListener('mousedown', this.onMouseDown);
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
