import * as THREE from 'three';

/**
 * 弹道视觉工厂：定义各种弹道的外观
 */
const ProjectileVisuals = {
    wave: (group, color) => {
        const geo = new THREE.TorusGeometry(0.5, 0.08, 8, 16, Math.PI); 
        const mat = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.y = Math.PI / 2;
        group.add(mesh);
        
        const glowGeo = new THREE.SphereGeometry(0.25, 8, 8); 
        const glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6 });
        group.add(new THREE.Mesh(glowGeo, glowMat));
    },

    fireball: (group, color) => {
        // 核心亮点 (白色核心)
        const coreGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        group.add(new THREE.Mesh(coreGeo, coreMat));
        
        // 内焰 (动态颜色)
        const innerGeo = new THREE.SphereGeometry(0.25, 8, 8);
        const innerMat = new THREE.MeshBasicMaterial({ color: color || 0xffaa00, transparent: true, opacity: 0.9 });
        group.add(new THREE.Mesh(innerGeo, innerMat));
        
        // 外焰/光晕 (动态颜色)
        const outerGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const outerMat = new THREE.MeshBasicMaterial({ 
            color: color || 0xff4400, 
            transparent: true, 
            opacity: 0.4,
            blending: THREE.AdditiveBlending 
        });
        group.add(new THREE.Mesh(outerGeo, outerMat));

        // --- 新增：固定尾焰 (Mesh 表现) ---
        // 使用一个圆锥体作为拖尾，尖端朝后
        const tailGeo = new THREE.ConeGeometry(0.25, 0.8, 8);
        tailGeo.rotateX(-Math.PI / 2); // 旋转使尖端指向 -Z (后方)
        const tailMat = new THREE.MeshBasicMaterial({
            color: color || 0xff4400,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const tail = new THREE.Mesh(tailGeo, tailMat);
        tail.position.z = -0.3; // 往后偏移
        group.add(tail);

        group.userData.isFireball = true;
    },

    spit: (group, color) => {
        const geo = new THREE.SphereGeometry(0.12, 8, 8);
        geo.scale(0.7, 0.7, 2.0);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        
        for (let i = 1; i <= 3; i++) {
            const trailGeo = new THREE.SphereGeometry(0.12 - i*0.02, 6, 6);
            const trailMat = new THREE.MeshBasicMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.6 - i*0.15 
            });
            const trail = new THREE.Mesh(trailGeo, trailMat);
            trail.position.z = -i * 0.15;
            group.add(trail);
        }
    },

    lob: (group, color) => {
        const geo = new THREE.CylinderGeometry(0.2, 0.15, 0.5, 8);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        group.add(new THREE.Mesh(geo, mat));
    },

    pill: (group, color) => {
        const geo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
        geo.rotateX(Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        group.add(new THREE.Mesh(geo, mat));
    },

    heal: (group, color) => {
        const ringGeo = new THREE.TorusGeometry(0.4, 0.05, 8, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 1.0 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        
        const coreGeo = new THREE.SphereGeometry(0.2, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        group.add(new THREE.Mesh(coreGeo, coreMat));
    },

    arrow: (group, color) => {
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.6);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
    },

    air_sword: (group, color) => {
        const subGroup = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8);
        const bladeMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        subGroup.add(new THREE.Mesh(bladeGeo, bladeMat));

        const hiltGeo = new THREE.BoxGeometry(0.3, 0.05, 0.05);
        const hilt = new THREE.Mesh(hiltGeo, bladeMat);
        hilt.position.z = -0.2;
        subGroup.add(hilt);

        group.add(subGroup);

        const glowGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const glowMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.4 });
        group.add(new THREE.Mesh(glowGeo, glowMat));
    }
};

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
            arcHeight = 0, // 新增：弧度高度
            explosionRadius = 0, // 新增：爆炸半径
            explosionColor = null, // 新增：爆炸颜色
            explosionVFX = null // 新增：爆炸特效类型
        } = config;

        this.startPos = startPos.clone();
        this.arcHeight = arcHeight;
        this.explosionRadius = explosionRadius;
        this.explosionColor = explosionColor || color;
        this.explosionVFX = explosionVFX;
        this.target = target;
        this.speed = speed;
        this.damage = damage;
        this.penetration = penetration; // 穿透次数 (作为消耗计数)
        this.isPiercing = penetration > 0; // 核心修复：记录是否为穿透性质，不随碰撞消耗
        this.hitUnits = new Set(); // 记录已击中的单位
        this.isHeroSource = isHeroSource;
        this.isDone = false;

        // --- 核心改进：穿刺弹道锁定初始方向，实现贯穿效果 ---
        this.direction = null;
        if (this.penetration > 0 && target) {
            const tPos = target.position.clone().add(new THREE.Vector3(0, target.visualScale * 0.4, 0));
            this.direction = new THREE.Vector3().subVectors(tPos, startPos).normalize();
        }
        this.distanceTraveled = 0;
        this.maxDistance = 45; // 弹道最大飞行距离

        this.initVisual(type, color);
        if (scale !== 1.0) {
            this.scale.setScalar(scale);
        }
        this.position.copy(startPos);

        // 必须在 position 设置好之后立即修正初始朝向
        if (this.direction) {
            this.lookAt(this.position.clone().add(this.direction));
        }
    }

    initVisual(type, color) {
        if (ProjectileVisuals[type]) {
            ProjectileVisuals[type](this, color);
        } else {
            // 默认视觉效果
            ProjectileVisuals.arrow(this, color);
        }
    }

    update() {
        if (this.isDone) return;

        let moveDir;
        let targetPos = null;

        // 1. 确定运动方向与坐标更新
        if (this.isPiercing && this.direction) {
            // 穿透弹道：保持直线飞行，直到寿命结束或穿透次数扣完
            moveDir = this.direction;
            const step = this.speed;
            this.position.addScaledVector(moveDir, step);
            this.distanceTraveled += step;
            this.lookAt(this.position.clone().add(moveDir));
        } else {
            // 追踪类弹道 (普通或抛物线)
            if (!this.target || this.target.isDead) {
                this.isDone = true;
                return;
            }
            targetPos = this.target.position.clone().add(new THREE.Vector3(0, this.target.visualScale * 0.4, 0));

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

        // --- 核心改进：为火球添加实时拖尾粒子 ---
        if (this.config.type === 'fireball' && Math.random() > 0.3) {
            const battle = window.battle;
            if (battle && battle.vfx) {
                battle.vfx.createParticleSystem({
                    pos: this.position.clone(),
                    color: 0xff4400,
                    duration: 300,
                    density: 0.5,
                    spawnRate: 100,
                    geometry: new THREE.BoxGeometry(0.1, 0.1, 0.1),
                    initFn: (p) => {
                        p.position.add(new THREE.Vector3((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2));
                    },
                    updateFn: (p, prg) => {
                        p.scale.setScalar(1 - prg);
                        p.material.opacity = 0.5 * (1 - prg);
                    }
                });
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

        if (this.isPiercing) {
            // 穿透逻辑：使用 isPiercing 判定运动模式
            for (const unit of units) {
                if (unit.isDead || this.hitUnits.has(unit)) continue;
                const unitPos = unit.position.clone().add(new THREE.Vector3(0, unit.visualScale * 0.4, 0));
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
        // 如果没有传入 unit，说明是定点落地或者目标丢失，但我们仍可能需要触发 AOE
        const hitPos = this.position.clone();
        
        // 执行击中回调 (用于自定义逻辑)
        if (this.config.onHit) {
            this.config.onHit(hitPos);
        }

        const battle = window.battle;
        
        // 处理爆炸/范围伤害
        if (this.explosionRadius > 0 && battle) {
            // ... 爆炸逻辑不变 ...
            if (this.explosionVFX) {
                battle.playVFX(this.explosionVFX, { 
                    pos: hitPos, 
                    radius: this.explosionRadius, 
                    color: this.explosionColor,
                    duration: 500 
                });
            }
            const enemySide = this.target ? this.target.side : (this.isHeroSource ? 'enemy' : 'player');
            const targets = battle.getUnitsInArea(hitPos, { shape: 'circle', radius: this.explosionRadius }, enemySide);
            battle.applyDamageToUnits(targets, this.damage, this.isHeroSource);
        } else if (unit && !unit.isDead) {
            // 普通单体伤害
            unit.takeDamage(this.damage, this.isHeroSource);
        }

        if (unit) this.hitUnits.add(unit);

        // --- 核心修复：穿透计数的销毁逻辑 ---
        if (this.isPiercing) {
            // 穿透模式下：每命中一个 unit 减一次。只有减到负数（即超过了最大命中数）才消失
            this.penetration--;
            if (this.penetration < 0) {
                this.isDone = true;
            }
        } else {
            // 非穿透模式：撞到就消失
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

