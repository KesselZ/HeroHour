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
            projectileManager = null // 注入弹道管理器
        } = config;

        this.side = side;
        this.index = index;
        this.type = type;
        this.projectileManager = projectileManager;
        
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


    update(enemies, allies, deltaTime) {
        if (this.isDead) return;

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
                this.performAttack();
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

    performAttack() {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            // 使用 seeded rng 处理伤害波动
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
            projectileManager
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
            projectileManager
        });
    }

    performAttack() {
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
            projectileManager
        });
    }

    performAttack() {
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
            projectileManager
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

    performAttack() {
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
            projectileManager
        });
        this.isSpinning = false;
        this.spinTimer = 0;
        this.spinDuration = 120; // 持续帧数 (约2秒)
        this.swordVFX = null;
    }

    performAttack() {
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
            const aoeRadius = 2.5;
            enemies.forEach(enemy => {
                if (!enemy.isDead) {
                    const dist = this.position.distanceTo(enemy.position);
                    if (dist < aoeRadius) {
                        enemy.takeDamage(this.attackDamage);
                    }
                }
            });
        }
    }
}




