import * as THREE from 'three';

/**
 * 弹道特效类 (如箭矢、剑气等)
 */
class Projectile extends THREE.Group {
    constructor(config) {
        super();
        this.config = config; // 保存配置以供后续访问
        const {
            startPos,
            target,
            speed = 0.2,
            damage = 10,
            color = 0xffffff,
            type = 'arrow',
            scale = 1.0,
            penetration = 0, // 新增：穿透属性，默认 0 为不穿透
            isHeroSource = false,
            arcHeight = 0 // 新增：弧度高度
        } = config;

        this.startPos = startPos.clone();
        this.arcHeight = arcHeight;
        this.target = target;
        this.speed = speed;
        this.damage = damage;
        this.penetration = penetration; // 穿透次数
        this.hitUnits = new Set(); // 记录已击中的单位
        this.isHeroSource = isHeroSource;
        this.isDone = false;

        // --- 核心改进：穿刺弹道锁定初始方向，实现贯穿效果 ---
        this.direction = null;
        if (this.penetration > 0 && target) {
            const tPos = target.position.clone().add(new THREE.Vector3(0, 0.3, 0));
            this.direction = new THREE.Vector3().subVectors(tPos, startPos).normalize();
        }
        this.distanceTraveled = 0;
        this.maxDistance = 45; // 弹道最大飞行距离

        this.initVisual(type, color);
        if (scale !== 1.0) {
            this.scale.setScalar(scale);
        }
        this.position.copy(startPos);
    }

    initVisual(type, color) {
        if (type === 'wave') {
            // 强化音波/法术波：使用传入的 color
            const geo = new THREE.TorusGeometry(0.5, 0.08, 8, 16, Math.PI); 
            const mat = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.y = Math.PI / 2;
            this.add(mesh);
            
            const glowGeo = new THREE.SphereGeometry(0.25, 8, 8); 
            const glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6 });
            this.add(new THREE.Mesh(glowGeo, glowMat));
        } else if (type === 'fireball') {
            // 火球：核心黄色，外围红色
            const geo = new THREE.SphereGeometry(0.3, 8, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
            this.add(new THREE.Mesh(geo, mat));
            
            const outerGeo = new THREE.SphereGeometry(0.45, 8, 8);
            const outerMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.5 });
            this.add(new THREE.Mesh(outerGeo, outerMat));
        } else if (type === 'spit') {
            // 毒液/口水：显著减小尺寸 (0.12)，并增加拖尾表现
            const geo = new THREE.SphereGeometry(0.12, 8, 8);
            geo.scale(2.0, 0.7, 0.7); // 更加尖锐的流体感
            const mat = new THREE.MeshBasicMaterial({ color: color });
            const mesh = new THREE.Mesh(geo, mat);
            this.add(mesh);
            
            // 强化拖尾：多层半透明粒子
            for (let i = 1; i <= 3; i++) {
                const trailGeo = new THREE.SphereGeometry(0.12 - i*0.02, 6, 6);
                const trailMat = new THREE.MeshBasicMaterial({ 
                    color: color, 
                    transparent: true, 
                    opacity: 0.6 - i*0.15 
                });
                const trail = new THREE.Mesh(trailGeo, trailMat);
                trail.position.x = -i * 0.15;
                this.add(trail);
            }
        } else if (type === 'lob') {
            // 投掷类弹道（如药罐）：稍大一点的容器形状
            const geo = new THREE.CylinderGeometry(0.2, 0.15, 0.5, 8);
            const mat = new THREE.MeshBasicMaterial({ color: color });
            this.add(new THREE.Mesh(geo, mat));
        } else if (type === 'pill') {
            // 药瓶/药丸：小圆柱体
            const geo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
            geo.rotateZ(Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({ color: color });
            this.add(new THREE.Mesh(geo, mat));
        } else if (type === 'heal') {
            // 强化治疗：使用传入的 color (通常是绿色)
            const ringGeo = new THREE.TorusGeometry(0.4, 0.05, 8, 16);
            const ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            this.add(ring);
            
            const coreGeo = new THREE.SphereGeometry(0.2, 8, 8);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            this.add(new THREE.Mesh(coreGeo, coreMat));
        } else if (type === 'arrow') {
            // 强化箭矢
            const geo = new THREE.BoxGeometry(0.6, 0.12, 0.12);
            const mat = new THREE.MeshBasicMaterial({ color: color }); // 支持不同颜色的箭
            const mesh = new THREE.Mesh(geo, mat);
            this.add(mesh);
        } else if (type === 'air_sword') {
            // 纯阳：气剑 - 使用传入的 color
            const group = new THREE.Group();
            
            // 剑身
            const bladeGeo = new THREE.BoxGeometry(0.8, 0.05, 0.05);
            const bladeMat = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.8 
            });
            const blade = new THREE.Mesh(bladeGeo, bladeMat);
            group.add(blade);

            // 护手/剑格
            const hiltGeo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
            const hilt = new THREE.Mesh(hiltGeo, bladeMat);
            hilt.position.x = -0.2;
            group.add(hilt);

            group.rotation.y = -Math.PI / 2; 
            this.add(group);

            // 增加外发光
            const glowGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4 });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            this.add(glow);
        }
    }

    update() {
        if (this.isDone) return;

        let moveDir;
        let targetPos = null;

        // 1. 确定运动方向与坐标更新
        if (this.penetration > 0 && this.direction) {
            // 穿透弹道：保持直线飞行
            moveDir = this.direction;
            const step = this.speed;
            this.position.addScaledVector(moveDir, step);
            this.distanceTraveled += step;
        } else {
            // 追踪类弹道 (普通或抛物线)
            if (!this.target || this.target.isDead) {
                this.isDone = true;
                return;
            }
            targetPos = this.target.position.clone().add(new THREE.Vector3(0, 0.3, 0));

            if (this.arcHeight > 0) {
                // --- 核心新增：抛物线 (LOB) 逻辑 ---
                const startFlat = new THREE.Vector2(this.startPos.x, this.startPos.z);
                const targetFlat = new THREE.Vector2(targetPos.x, targetPos.z);
                const totalDistFlat = startFlat.distanceTo(targetFlat);
                
                this.distanceTraveled += this.speed;
                const progress = Math.min(this.distanceTraveled / totalDistFlat, 1.0);

                // 更新位置 (Lerp + Arc)
                const currentPos = new THREE.Vector3().lerpVectors(this.startPos, targetPos, progress);
                const arcY = 4 * this.arcHeight * progress * (1 - progress);
                currentPos.y += arcY;
                this.position.copy(currentPos);

                // 朝向处理
                if (progress < 0.99) {
                    const nextProgress = progress + 0.01;
                    const nextPos = new THREE.Vector3().lerpVectors(this.startPos, targetPos, nextProgress);
                    nextPos.y += 4 * this.arcHeight * nextProgress * (1 - nextProgress);
                    this.lookAt(nextPos);
                }
            } else {
                moveDir = new THREE.Vector3().subVectors(targetPos, this.position).normalize();
                const step = this.speed;
                this.position.addScaledVector(moveDir, step);
                this.distanceTraveled += step;
                this.lookAt(this.position.clone().add(moveDir));
            }
        }

        // 4. 边界清理
        if (this.distanceTraveled > this.maxDistance) {
            this.isDone = true;
            return;
        }

        // 5. 碰撞判定
        const battle = window.battle;
        if (!battle) return;

        // 确定要攻击哪一方
        const enemySide = this.target ? this.target.side : (this.isHeroSource ? 'enemy' : 'player');
        const units = (enemySide === 'enemy') ? battle.enemyUnits : battle.playerUnits;

        if (this.penetration > 0) {
            // 穿透逻辑
            for (const unit of units) {
                if (unit.isDead || this.hitUnits.has(unit)) continue;
                const unitPos = unit.position.clone().add(new THREE.Vector3(0, 0.3, 0));
                if (this.position.distanceTo(unitPos) < 0.5) {
                    this.hit(unit);
                    if (this.isDone) break;
                }
            }
        } else if (targetPos) {
            // 普通与抛物线逻辑
            if (this.position.distanceTo(targetPos) < 0.4) {
                this.hit(this.target);
            }
        }
    }

    hit(unit) {
        if (!unit || unit.isDead) return;
        
        // 执行击中回调 (用于爆炸等额外效果)
        if (this.config.onHit) {
            this.config.onHit(this.position.clone());
        }

        unit.takeDamage(this.damage, this.isHeroSource);
        this.hitUnits.add(unit);

        if (this.penetration > 0) {
            this.penetration--;
            // 注意：只有穿透次数用尽时才销毁
            if (this.penetration < 0) this.isDone = true;
        } else {
            this.isDone = true;
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

