import * as THREE from 'three';

/**
 * 弹道特效类 (如箭矢、剑气等)
 */
class Projectile extends THREE.Group {
    constructor(config) {
        super();
        const {
            startPos,
            target,
            speed = 0.2,
            damage = 10,
            color = 0xffffff,
            type = 'arrow'
        } = config;

        this.target = target;
        this.speed = speed;
        this.damage = damage;
        this.isDone = false;

        this.initVisual(type, color);
        this.position.copy(startPos);
    }

    initVisual(type, color) {
        if (type === 'wave') {
            // 强化琴音波：更大、更亮、半透明度更高
            const geo = new THREE.TorusGeometry(0.5, 0.08, 8, 16, Math.PI); // 增大半径和粗细
            const mat = new THREE.MeshBasicMaterial({ 
                color: 0x00ffff, 
                transparent: true, 
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.y = Math.PI / 2;
            this.add(mesh);
            
            const glowGeo = new THREE.SphereGeometry(0.25, 8, 8); // 增大核心光球
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.6 });
            this.add(new THREE.Mesh(glowGeo, glowMat));
        } else if (type === 'heal') {
            // 强化治疗：鲜艳的荧光绿
            const ringGeo = new THREE.TorusGeometry(0.4, 0.05, 8, 16);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 1.0 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            this.add(ring);
            
            const coreGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xccffcc });
            this.add(new THREE.Mesh(coreGeo, coreMat));
        } else if (type === 'arrow') {
            // 强化箭矢：加粗并增加长度
            const geo = new THREE.BoxGeometry(0.6, 0.12, 0.12);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const mesh = new THREE.Mesh(geo, mat);
            this.add(mesh);
        } else if (type === 'air_sword') {
            // 纯阳：气剑 - 细长、青蓝色、半透明发光
            const group = new THREE.Group();
            
            // 剑身
            const bladeGeo = new THREE.BoxGeometry(0.8, 0.05, 0.05);
            const bladeMat = new THREE.MeshBasicMaterial({ 
                color: 0x88ffff, 
                transparent: true, 
                opacity: 0.8 
            });
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            group.add(blade);

            // 护手/剑格 (简单的十字)
            const hiltGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
            const hilt = new THREE.Mesh(hiltGeo, bladeMat);
            hilt.position.x = -0.2;
            group.add(hilt);

            // 整体偏移，让剑尖作为旋转/移动中心
            group.rotation.y = Math.PI / 2; // 指向 Z 轴
            this.add(group);

            // 增加一点外发光点
            const glowGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const glowMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            this.add(glow);
        }
    }

    update() {
        if (this.isDone || !this.target || this.target.isDead) {
            this.isDone = true;
            return;
        }

        // 1. 获取目标位置 (瞄准胸口位置)
        const targetPos = this.target.position.clone();
        targetPos.y += 0.3; 

        // 2. 计算方向并移动
        const dir = new THREE.Vector3().subVectors(targetPos, this.position).normalize();
        this.position.addScaledVector(dir, this.speed);

        // 3. 旋转箭矢指向目标
        this.lookAt(targetPos);

        // 4. 碰撞检测 (到达目标附近)
        if (this.position.distanceTo(targetPos) < 0.3) {
            this.hit();
        }
    }

    hit() {
        this.isDone = true;
        if (this.target && !this.target.isDead) {
            this.target.takeDamage(this.damage);
        }
    }
}

/**
 * 弹道管理器：统一处理战场上的所有飞行道具
 */
export class ProjectileManager {
    constructor(scene) {
        this.scene = scene;
        this.projectiles = [];
    }

    /**
     * 发射弹道
     * @param {Object} config 
     */
    spawn(config) {
        const p = new Projectile(config);
        this.scene.add(p);
        this.projectiles.push(p);
    }

    update() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update();

            if (p.isDone) {
                this.scene.remove(p);
                this.projectiles.splice(i, 1);
            }
        }
    }

    cleanup() {
        this.projectiles.forEach(p => this.scene.remove(p));
        this.projectiles = [];
    }
}

