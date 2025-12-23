import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { rng } from '../core/Random.js';

/**
 * 基础战斗单位类
 */
export class BaseUnit extends THREE.Group {
    constructor(config) {
        super();
        const {
            side = 'player',
            index = 0,
            type = 'melee',
            hp = 100,
            speed = 0.03,
            attackRange = 0.5,
            attackDamage = 15,
            attackSpeed = 1000,
            projectileManager = null, // 注入弹道管理器
            cost = 2 // 引入强度属性 (消耗分)
        } = config;

        this.side = side;
        this.index = index;
        this.type = type;
        this.projectileManager = projectileManager;
        this.cost = cost;
        
        this.maxHealth = hp;
        this.health = hp;
        // 使用 seeded rng 替代 Math.random()
        this.moveSpeed = speed + (rng.next() - 0.5) * 0.01;
        this.attackRange = attackRange;
        this.attackDamage = attackDamage;
        this.attackCooldownTime = attackSpeed;
        
        this.isDead = false;
        this.target = null;
        this.lastAttackTime = 0;
        
        this.unitSprite = null;
        
        // 物理动力学属性：用于平滑击退
        this.knockbackVelocity = new THREE.Vector3();
        this.knockbackFriction = 0.85; // 摩擦力，值越小停得越快
        
        this.initVisual();
    }

    initVisual() {
        // 1. 侠客 Sprite
        this.unitSprite = spriteFactory.createUnitSprite(this.type);
        // 移除原本的 scale.x 翻转逻辑，改用统一的 updateFacing 处理
        this.add(this.unitSprite);

        // 2. 阵营环（Influence Ring）- 进一步增强可见度
        const ringGeo = new THREE.PlaneGeometry(2.5, 2.5);
        const ringColor = this.side === 'player' ? 0x4488ff : 0xff4444;
        const ringMat = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.4, // 提升透明度，让颜色更实
            depthWrite: false, 
            map: this.createRingTexture()
        });
        this.influenceRing = new THREE.Mesh(ringGeo, ringMat);
        this.influenceRing.rotation.x = -Math.PI / 2;
        this.influenceRing.position.y = -0.38; // 稍微调低一点避免与地面重叠太近
        this.add(this.influenceRing);

        this.position.y = 0.6;
    }

    createRingTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // 绘制纯色实心圆，不包含渐变，边缘清晰
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(64, 64, 62, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(canvas);
    }


    /**
     * 击退效果：注入瞬时速度，由 update 逐帧平滑消化
     * @param {THREE.Vector3} fromPosition 攻击发起点
     * @param {number} force 击退强度（冲量）
     */
    applyKnockback(fromPosition, force = 0.5) {
        if (this.isDead) return;
        
        // 计算从发起点到受击点的方向
        const dir = new THREE.Vector3()
            .subVectors(this.position, fromPosition)
            .normalize();
        
        dir.y = 0;
        
        // 注入初速度
        this.knockbackVelocity.addScaledVector(dir, force);
        
        // 受击视觉反馈：变红
        this.unitSprite.material.color.setHex(0xff8888);
        setTimeout(() => {
            if (!this.isDead && this.unitSprite) {
                this.unitSprite.material.color.setHex(0xffffff);
            }
        }, 150);
    }

    /**
     * 范围攻击通用 API
     * @param {Array} targets 潜在目标列表
     * @param {Object} options 攻击参数 { radius, angle, damage, knockbackForce, customDir }
     */
    executeAOE(targets, options) {
        const { radius = 2.0, angle = Math.PI * 2, damage = 10, knockbackForce = 0.5, customDir = null } = options;
        
        // 获取当前朝向：优先使用传入的 customDir（用于同步 VFX），否则朝向目标
        const forward = new THREE.Vector3(1, 0, 0);
        if (customDir) {
            forward.copy(customDir);
        } else if (this.target) {
            forward.subVectors(this.target.position, this.position).normalize();
        }

        targets.forEach(target => {
            if (target === this || target.isDead) return;

            const toTarget = new THREE.Vector3().subVectors(target.position, this.position);
            const dist = toTarget.length();

            if (dist <= radius) {
                // 如果是全圆攻击，直接判定命中
                if (angle >= Math.PI * 2) {
                    this.applyDamageAndKnockback(target, damage, knockbackForce);
                } else {
                    // 扇形判定：利用点积判断夹角
                    const dot = forward.dot(toTarget.normalize());
                    const targetAngle = Math.acos(Math.min(1, Math.max(-1, dot)));
                    if (targetAngle <= angle / 2) {
                        this.applyDamageAndKnockback(target, damage, knockbackForce);
                    }
                }
            }
        });
    }

    applyDamageAndKnockback(target, damage, knockbackForce) {
        target.takeDamage(damage + (rng.next() - 0.5) * 5);
        if (knockbackForce > 0) {
            target.applyKnockback(this.position, knockbackForce);
        }
    }

    update(enemies, allies, deltaTime) {
        if (this.isDead) return;

        // 1. 处理物理冲力 (击退位移)
        if (this.knockbackVelocity.lengthSq() > 0.0001) {
            // 应用当前冲力位移
            this.position.add(this.knockbackVelocity);
            // 模拟摩擦力：每帧衰减
            this.knockbackVelocity.multiplyScalar(this.knockbackFriction);
            
            // 如果冲力还很大，暂时打断 AI 寻路 (硬直感)
            if (this.knockbackVelocity.length() > 0.05) {
                this.applySeparation(allies, enemies); // 击退过程中也要处理碰撞
                return; 
            }
        }

        // 处理特殊状态（如旋风斩）
        if (this.type === 'cangjian' && this.isSpinning) {
            this.updateWhirlwind(enemies);
            // 旋风斩期间可以缓慢移动或静止，这里保持原地旋转并处理碰撞
            this.applySeparation(allies, enemies);
            return; 
        }

        // 1. 寻找目标逻辑 (可被子类覆盖)
        this.updateAI(enemies, allies);

        if (this.target) {
            const distance = this.position.distanceTo(this.target.position);
            
            // 实时翻转面向逻辑
            this.updateFacing();

            if (distance > this.attackRange) {
                this.moveTowardsTarget();
            } else {
                this.performAttack(enemies, allies);
            }
            
            // 2. 碰撞挤压逻辑：防止单位完全重叠
            this.applySeparation(allies, enemies);
            
            // 3. 动态光环逻辑
            const nearestEnemy = this.findNearestEnemy(enemies);
            if (nearestEnemy) {
                this.updateInfluenceRing(this.position.distanceTo(nearestEnemy.position));
            }
        }
    }

    /**
     * 更新单位面向：根据目标方向和初始面向决定是否翻转
     */
    updateFacing() {
        if (!this.target || !this.unitSprite) return;

        const config = spriteFactory.unitConfig[this.type];
        if (!config) return;

        const defaultFacing = config.defaultFacing || 'left';
        const isTargetToLeft = this.target.position.x < this.position.x;
        
        // 核心逻辑：如果目标在左边，我们希望侠客“面朝左”
        // 如果侠客初始就面朝左，则不需要翻转 (standard)
        // 如果侠客初始面朝右，则需要翻转 (flipped)
        let shouldFlip = false;
        if (isTargetToLeft) {
            shouldFlip = (defaultFacing === 'right'); 
        } else {
            shouldFlip = (defaultFacing === 'left');
        }
        
        const texture = this.unitSprite.material.map;
        const standardRepeatX = 1 / spriteFactory.cols;
        const flippedRepeatX = -1 / spriteFactory.cols;
        
        const targetRepeatX = shouldFlip ? flippedRepeatX : standardRepeatX;
        const standardOffsetX = (config.col - 1) / spriteFactory.cols;
        const flippedOffsetX = config.col / spriteFactory.cols;
        const targetOffsetX = shouldFlip ? flippedOffsetX : standardOffsetX;

        if (texture.repeat.x !== targetRepeatX) {
            console.log(`%c[面向修正] %c单位 ${this.type} %c目标在${isTargetToLeft?'左':'右'}, 初始面朝${defaultFacing} -> ${shouldFlip?'翻转':'标准'}`, 
                'color: #d4af37; font-weight: bold', 'color: #fff', 'color: #00ff00');
            
            texture.repeat.x = targetRepeatX;
            texture.offset.x = targetOffsetX;
            texture.needsUpdate = true;
        }
    }




    /**
     * 简单的碰撞挤压：当两个单位太近时产生排斥力
     */
    applySeparation(allies, enemies) {
        const separationRadius = 0.6; // 碰撞半径
        const force = 0.02; // 挤开的力量
        const allUnits = [...allies, ...enemies];

        for (const other of allUnits) {
            if (other === this || other.isDead) continue;

            const dist = this.position.distanceTo(other.position);
            if (dist < separationRadius) {
                // 计算排斥方向
                const pushDir = new THREE.Vector3()
                    .subVectors(this.position, other.position)
                    .normalize();
                
                // 距离越近，推力越大
                const strength = (1 - dist / separationRadius) * force;
                this.position.addScaledVector(pushDir, strength);
            }
        }
    }

    updateAI(enemies, allies) {
        if (!this.target || this.target.isDead) {
            this.target = this.findNearestEnemy(enemies);
        }
    }

    findLowestHealthAlly(allies) {
        let lowestHP = 1.1; 
        let target = null;
        for (const ally of allies) {
            if (!ally.isDead && ally !== this) {
                const hpRatio = ally.health / ally.maxHealth;
                if (hpRatio < lowestHP && hpRatio < 0.9) { // 只治疗 90% 血量以下的队友
                    lowestHP = hpRatio;
                    target = ally;
                }
            }
        }
        return target;
    }


    updateInfluenceRing(targetDist) {
        if (!this.influenceRing) return;
        
        const minSize = 0.4;
        const maxSize = 1.0;
        let scale = maxSize;
        
        // 当敌人进入 3.0 范围时开始挤压（因为环变大了，感应范围也相应变大）
        if (targetDist < 3.0) {
            scale = minSize + (targetDist / 3.0) * (maxSize - minSize);
        }
        
        this.influenceRing.scale.lerp(new THREE.Vector3(scale, scale, 1), 0.1);
        this.influenceRing.material.opacity = 0.15 + (this.health / this.maxHealth) * 0.15;
    }


    findNearestEnemy(enemies) {
        let minDist = Infinity;
        let nearest = null;
        for (const enemy of enemies) {
            if (!enemy.isDead) {
                const d = this.position.distanceTo(enemy.position);
                if (d < minDist) {
                    minDist = d;
                    nearest = enemy;
                }
            }
        }
        return nearest;
    }

    moveTowardsTarget() {
        const dir = new THREE.Vector3()
            .subVectors(this.target.position, this.position)
            .normalize();
        
        this.position.addScaledVector(dir, this.moveSpeed);
        
        // 像素风不需要旋转 Group，Sprite 始终面向相机
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            // 默认单体攻击
            this.target.takeDamage(this.attackDamage + (rng.next() - 0.5) * 5);
        }
    }

    onAttackAnimation() {
        const baseSize = 1.4;
        const attackSize = 1.8; // 更夸张的攻击缩放

        this.unitSprite.scale.set(attackSize, attackSize, attackSize);
        setTimeout(() => {
            if (!this.isDead) {
                this.unitSprite.scale.set(baseSize, baseSize, baseSize);
            }
        }, 150); // 增加停留时长
    }



    takeDamage(amount) {
        if (this.isDead) return;
        this.health -= amount;
        
        // 通用受击反馈：强烈的红色闪烁
        const originalColor = 0xffffff;
        const hitColor = 0xff3333; // 鲜艳的红色
        
        this.unitSprite.material.color.setHex(hitColor);
        
        setTimeout(() => {
            if (this.unitSprite && !this.isDead) {
                this.unitSprite.material.color.setHex(originalColor);
            }
        }, 150);

        if (this.health <= 0) this.die();
    }

    die() {
        this.isDead = true;
        this.unitSprite.rotation.z = Math.PI / 2; // 倒下
        this.position.y = 0.3;
        
        // 死亡时立即隐藏阵营环
        if (this.influenceRing) {
            this.influenceRing.visible = false;
        }

        this.onDieCleanup();
    }

    onDieCleanup() {
        // 加快消失速度：倒地后立即开始淡出，且淡出速度加快
        const fadeEffect = setInterval(() => {
            if (this.unitSprite && this.unitSprite.material.opacity > 0) {
                this.unitSprite.material.opacity -= 0.1; // 增加递减步长
            } else {
                clearInterval(fadeEffect);
                this.removeFromParent();
            }
        }, 50); // 每 50ms 检测一次，约 0.5 秒内彻底消失
    }
}

export class MeleeSoldier extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'melee',
            hp: 120,
            speed: 0.03,
            attackRange: 0.8,
            attackDamage: 15,
            attackSpeed: 1000,
            projectileManager,
            cost: 2
        });
    }
}

export class RangedSoldier extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'ranged',
            hp: 80,
            speed: 0.025,
            attackRange: 6.0,
            attackDamage: 12,
            attackSpeed: 1800,
            projectileManager,
            cost: 2
        });
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            if (this.projectileManager && this.target) {
                this.projectileManager.spawn({
                    startPos: this.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
                    target: this.target,
                    speed: 0.15,
                    damage: this.attackDamage + (rng.next() - 0.5) * 4,
                    type: 'wave',
                    color: 0x00ffff
                });
            }
        }
    }
}

/**
 * 射手：射程更远，使用箭矢 (第二行第四个)
 */
export class Archer extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'archer',
            hp: 70,
            speed: 0.03,
            attackRange: 10.0, // 极远射程
            attackDamage: 18,
            attackSpeed: 2000,
            projectileManager,
            cost: 3
        });
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            if (this.projectileManager && this.target) {
                this.projectileManager.spawn({
                    startPos: this.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
                    target: this.target,
                    speed: 0.3, // 箭矢速度快
                    damage: this.attackDamage,
                    type: 'arrow'
                });
            }
        }
    }
}

/**
 * 奶妈：治疗队友 (第二行第二个)
 */
export class Healer extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'healer',
            hp: 90,
            speed: 0.02, // 移动慢
            attackRange: 5.0, // 治疗范围
            attackDamage: -20, // 负伤害即治疗
            attackSpeed: 2500,
            projectileManager,
            cost: 4
        });
    }

    updateAI(enemies, allies) {
        // 优先寻找血量最低的盟友
        this.target = this.findLowestHealthAlly(allies);
        // 如果没有需要治疗的盟友，则跟着大部队走（寻找最近敌人但不攻击）
        if (!this.target) {
            this.target = this.findNearestEnemy(enemies);
        }
    }

    performAttack(enemies, allies) {
        if (!this.target || this.target.side !== this.side) return;

        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            
            if (this.projectileManager) {
                this.projectileManager.spawn({
                    startPos: this.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    target: this.target,
                    speed: 0.1,
                    damage: this.attackDamage,
                    type: 'heal'
                });
            }
        }
    }
}

/**
 * 藏剑：旋风斩 (第二行第三个)
 */
export class Cangjian extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'cangjian',
            hp: 180,
            speed: 0.035,
            attackRange: 1.5,
            attackDamage: 8, // 单次伤害降低，因为是高频多段伤害
            attackSpeed: 4000,
            projectileManager,
            cost: 6
        });
        this.isSpinning = false;
        this.spinTimer = 0;
        this.spinDuration = 120; // 持续帧数 (约2秒)
        this.swordVFX = null;
    }

    performAttack(enemies, allies) {
        if (this.isSpinning) return;

        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.startWhirlwind();
        }
    }

    startWhirlwind() {
        this.isSpinning = true;
        this.spinTimer = this.spinDuration;
        
        // 创建单把重剑视觉
        const vfx = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(2.0, 0.08, 0.2);
        const bladeMat = new THREE.MeshBasicMaterial({ 
            color: 0xffcc00, 
            transparent: true, 
            opacity: 0.8 
        });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.x = 1.0; 
        vfx.add(blade);
        vfx.position.y = -0.1;
        this.add(vfx);
        this.swordVFX = vfx;
    }

    /**
     * 每帧调用的旋风斩逻辑 (丝滑旋转 + AOE)
     */
    updateWhirlwind(enemies) {
        if (this.spinTimer <= 0) {
            this.isSpinning = false;
            if (this.swordVFX) {
                this.remove(this.swordVFX);
                this.swordVFX = null;
            }
            this.unitSprite.rotation.y = 0;
            return;
        }

        this.spinTimer--;

        // 1. 丝滑旋转：直接随帧率更新角度
        this.unitSprite.rotation.y += 0.2; 
        if (this.swordVFX) {
            this.swordVFX.rotation.y += 0.4; // 剑转得更快
            const s = 1 + Math.sin(this.spinTimer * 0.2) * 0.1;
            this.swordVFX.scale.set(s, 1, s);
        }

        // 2. 攻击反馈
        this.unitSprite.scale.set(1.6, 1.6, 1.6);
        setTimeout(() => { if(!this.isDead) this.unitSprite.scale.set(1.4, 1.4, 1.4); }, 30);

        // 3. 真实 AOE 伤害：每 10 帧检测一次周围敌人
        if (this.spinTimer % 10 === 0) {
            this.executeAOE(enemies, {
                radius: 2.5,
                angle: Math.PI * 2, // 全圆攻击
                damage: this.attackDamage,
                knockbackForce: 0.07 // 设为 0.07
            });
        }
    }
}

/**
 * 苍云：肉盾，攻击方式类似近战，走得慢 (第三行第三个)
 */
export class Cangyun extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'cangyun',
            hp: 250, // 极高生命值
            speed: 0.02, // 移动缓慢
            attackRange: 0.8,
            attackDamage: 12, // 伤害一般
            attackSpeed: 1200,
            projectileManager,
            cost: 5
        });
    }
}

/**
 * 天策骑兵：移动快，180度扇形攻击 + 强力击退 (第一行第二个)
 */
export class Tiance extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'tiance',
            hp: 180, 
            speed: 0.05,
            attackRange: 1.8, 
            attackDamage: 14, // 伤害减半 (28 -> 14)
            attackSpeed: 800, // 攻速双倍 (1600 -> 800)
            projectileManager,
            cost: 8
        });
        this.sweepRadius = 2.0; // 范围缩小 (3.5 -> 2.0)
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            // 1. 锁定攻击方向：基于当前主目标，确保 VFX 和逻辑完美同步
            const attackDir = new THREE.Vector3().subVectors(this.target.position, this.position).normalize();
            attackDir.y = 0;

            // 2. 显示 VFX
            this.showSweepVFX(attackDir); 

            // 3. 执行判定
            this.executeAOE(enemies, {
                radius: this.sweepRadius,
                angle: Math.PI, 
                damage: this.attackDamage,
                knockbackForce: 0.15,
                customDir: attackDir 
            });
        }
    }

    showSweepVFX(attackDir) {
        const group = new THREE.Group();
        
        // 使用 RingGeometry 制作平贴地面的扇形波，比 Torus 更像“横扫剑气”
        const innerRadius = this.sweepRadius * 0.5;
        const outerRadius = this.sweepRadius;
        
        // 创建一个 180 度的扇形，起点设在 -PI/2，这样其中轴线正好对着正方向
        const geo = new THREE.RingGeometry(innerRadius, outerRadius, 32, 1, -Math.PI/2, Math.PI);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xff4400, 
            transparent: true, 
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        
        // 关键：让扇形平躺在地面
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);

        // 设置位置并利用 lookAt 指向目标方向点 (复用远程攻击逻辑)
        group.position.copy(this.position);
        group.position.y = 0.15;
        
        const lookTarget = this.position.clone().add(attackDir);
        group.lookAt(lookTarget);
        
        this.parent.add(group);

        // 特效动画
        const startTime = Date.now();
        const duration = 250;
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            if (progress < 1) {
                // 模拟剑气扩散
                group.scale.set(1 + progress * 0.5, 1 + progress * 0.5, 1);
                mesh.material.opacity = 0.6 * (1 - progress);
                requestAnimationFrame(animate);
            } else {
                if (group.parent) group.parent.remove(group);
                geo.dispose();
                mat.dispose();
            }
        };
        animate();
    }
}

/**
 * 纯阳：远近结合，优先远程，近身切剑 (第一行第三个)
 */
export class Chunyang extends BaseUnit {
    constructor(side, index, projectileManager) {
        super({
            side,
            index,
            type: 'chunyang',
            hp: 110,
            speed: 0.035,
            attackRange: 10.0, 
            attackDamage: 18,
            attackSpeed: 1200,
            projectileManager,
            cost: 6
        });
        this.meleeSwitchThreshold = 4.5; // 决定切换到近战模式的阈值
        this.meleeAttackRange = 1.2;     // 近战实际出招距离
        this.remoteAttackRange = 10.0;   // 远程攻击距离
        this.isMeleeMode = false;
    }

    updateAI(enemies, allies) {
        super.updateAI(enemies, allies);
        
        if (this.target) {
            const dist = this.position.distanceTo(this.target.position);
            // 如果目标进入 4.5 范围，则切换为近战模式并缩短攻击范围，促使其跑位贴脸
            if (dist < this.meleeSwitchThreshold) {
                this.isMeleeMode = true;
                this.attackRange = this.meleeAttackRange;
            } else {
                this.isMeleeMode = false;
                this.attackRange = this.remoteAttackRange;
            }
        }
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            if (this.isMeleeMode) {
                // 近战：剑击（再次弱化 2 倍：0.06 -> 0.03）
                this.target.takeDamage(this.attackDamage * 1.5);
                this.target.applyKnockback(this.position, 0.03); 
            } else {
                // 远程：依次射出 3 把气剑
                const swordCount = 3;
                const delayBetweenSwords = 200; 

                for (let i = 0; i < swordCount; i++) {
                    setTimeout(() => {
                        if (this.isDead || !this.target || this.target.isDead) return;

                        const offset = new THREE.Vector3(
                            (i - 1) * 0.4, 
                            1.2 + Math.sin(i) * 0.2, 
                            (rng.next() - 0.5) * 0.5
                        );
                        const spawnPos = this.position.clone().add(offset);

                        if (this.projectileManager) {
                            this.projectileManager.spawn({
                                startPos: spawnPos,
                                target: this.target,
                                speed: 0.25,
                                damage: this.attackDamage / swordCount, 
                                type: 'air_sword'
                            });
                        }
                    }, i * delayBetweenSwords);
                }
            }
        }
    }
}




