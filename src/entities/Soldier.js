import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { rng } from '../core/Random.js';
import { modifierManager } from '../core/ModifierManager.js';
import { worldManager } from '../core/WorldManager.js';
import { audioManager } from '../core/AudioManager.js';

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
            cost = 2, // 引入强度属性 (消耗分)
            mass = 1.0 // 新增：质量/重量，影响被推挤的程度
        } = config;

        this.side = side;
        this.index = index;
        this.type = type;
        this.projectileManager = projectileManager;
        this.cost = cost;
        this.mass = mass; // 质量越大，越难被推开
        this.maxHealth = modifierManager.getModifiedValue(this, 'hp', hp);
        this.health = this.maxHealth;
        
        // 基础移速叠加随机微差后，再应用全局修正
        const rawSpeed = (speed + (rng.next() - 0.5) * 0.01) * 0.5; // 全局移速再降低 30% (总计约降低 50%)
        this.moveSpeed = modifierManager.getModifiedValue(this, 'speed', rawSpeed);
        this.baseMoveSpeed = this.moveSpeed; // 记录基础移速，用于判定减速特效
        
        this.attackRange = modifierManager.getModifiedValue(this, 'range', attackRange);
        this.attackDamage = modifierManager.getModifiedValue(this, 'damage', attackDamage);
        
        // 核心改动：攻击频率修正 (攻击间隔的倒数即频率，增加频率等于减小间隔)
        this.attackCooldownTime = modifierManager.getModifiedValue(this, 'attack_speed', attackSpeed);
        
        this.isDead = false;
        this.isInvincible = false;
        this.isControlImmune = false; // 新增：控制免疫 (生太极)
        
        // 核心精简：全部统一使用 getModifiedValue，减伤只是受损倍率为 0.85
        this.damageMultiplier = modifierManager.getModifiedValue(this, 'damage_reduction', 1.0);
        
        this.isTigerHeart = false; // 啸如虎：锁血状态
        this.stunnedUntil = 0; // 眩晕截止时间戳
        this.hitFlashUntil = 0; // 受击闪红截止时间戳
        this.activeColors = new Map(); // 记录当前生效的 Buff 颜色 (Tag -> Color)
        this.baseColor = 0xffffff; // 单位的基础颜色
        
        this.target = null;
        this.lastAttackTime = 0;
        
        this.unitSprite = null;
        
        // 物理动力学属性：用于平滑击退
        this.knockbackVelocity = new THREE.Vector3();
        this.knockbackFriction = 0.85; // 摩擦力，值越小停得越快
        
        // 走路音效控制 (改为固定时间频率)
        this.footstepTimer = 0;
        this.footstepInterval = 650; // 每 650ms 响一次

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
        if (this.isDead || this.isControlImmune || this.isInvincible) return;
        
        // 计算从发起点到受击点的方向
        const dir = new THREE.Vector3()
            .subVectors(this.position, fromPosition)
            .normalize();
        
        dir.y = 0;
        
        // 注入初速度
        this.knockbackVelocity.addScaledVector(dir, force);
        
        // 受击视觉反馈：记录时间，由 updateVisualState 统一处理
        this.hitFlashUntil = Date.now() + 150;
    }

    applyStun(duration) {
        if (this.isControlImmune || this.isInvincible) return;
        this.stunnedUntil = Math.max(this.stunnedUntil, Date.now() + duration);
        
        // 自动触发眩晕视觉特效
        if (window.battle && window.battle.playVFX) {
            window.battle.playVFX('stun', { unit: this, duration });
        }
    }

    /**
     * 范围攻击通用 API
     * @param {Array} targets 潜在目标列表
     * @param {Object} options 攻击参数 { radius, angle, damage, knockbackForce, customDir }
     */
    executeAOE(targets, options) {
        const { radius = 2.0, angle = Math.PI * 2, damage = 10, knockbackForce = 0.5, customDir = null } = options;
        
        // 核心重构：如果没有传 customDir，自动调用统一的面向逻辑
        const forward = customDir || this.getForwardVector();

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

    /**
     * 统一视觉状态更新：解决颜色冲突 (受击 > 眩晕 > Buff > 基础色)
     */
    updateVisualState() {
        if (this.isDead || !this.unitSprite) return;

        let targetColor = this.baseColor;

        // 1. Buff/气场颜色 (取最后加入的颜色)
        if (this.activeColors.size > 0) {
            targetColor = Array.from(this.activeColors.values()).pop();
        }

        // 2. 眩晕状态 (优先级高于 Buff)
        if (Date.now() < this.stunnedUntil) {
            targetColor = 0x888888;
        }

        // 3. 受击反馈 (最高优先级，短促闪烁)
        if (Date.now() < this.hitFlashUntil) {
            targetColor = 0xff3333;
        }

        if (this.unitSprite.material.color.getHex() !== targetColor) {
            this.unitSprite.material.color.setHex(targetColor);
        }
    }

    update(enemies, allies, deltaTime) {
        if (this.isDead) return;

        // 0. 统一视觉状态更新
        this.updateVisualState();

        // 0. 状态特效判定：减速
        if (this.moveSpeed < this.baseMoveSpeed * 0.95) {
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('slow', { unit: this });
            }
        }

        // 0. 眩晕状态判定
        if (Date.now() < this.stunnedUntil) {
            // 眩晕时也要处理物理冲力 (击退)
            if (this.knockbackVelocity.lengthSq() > 0.0001) {
                this.position.add(this.knockbackVelocity);
                this.knockbackVelocity.multiplyScalar(this.knockbackFriction);
            }
            // 处理碰撞挤压
            this.applySeparation(allies, enemies, deltaTime);
            return;
        } 

        // 1. 处理物理冲力 (击退位移)
        if (this.knockbackVelocity.lengthSq() > 0.0001) {
            // 应用当前冲力位移
            this.position.add(this.knockbackVelocity);
            // 模拟摩擦力：每帧衰减
            this.knockbackVelocity.multiplyScalar(this.knockbackFriction);
            
            // 如果冲力还很大，暂时打断 AI 寻路 (硬直感)
            if (this.knockbackVelocity.length() > 0.05) {
                this.applySeparation(allies, enemies, deltaTime); // 击退过程中也要处理碰撞
                return; 
            }
        }

        // 处理特殊状态（如旋风斩）
        if (this.type === 'cangjian' && this.isSpinning) {
            this.updateWhirlwind(enemies);
            // 旋风斩期间可以缓慢移动或静止，这里保持原地旋转并处理碰撞
            this.applySeparation(allies, enemies, deltaTime);
            return; 
        }

        // 1. 寻找目标逻辑 (可被子类覆盖)
        this.updateAI(enemies, allies);

        if (this.target) {
            const distance = this.position.distanceTo(this.target.position);
            
            // 实时翻转面向逻辑
            this.updateFacing();

            if (distance > this.attackRange) {
                this.moveTowardsTarget(deltaTime);
            } else {
                this.footstepTimer = 0; // 停止移动时归零
                this.performAttack(enemies, allies);
            }
            
            // 2. 碰撞挤压逻辑：防止单位完全重叠
            this.applySeparation(allies, enemies, deltaTime);
            
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
        }
    }




    /**
     * 优化后的碰撞挤压：考虑质量 (Mass) 和 敌我关系
     */
    applySeparation(allies, enemies, deltaTime) {
        const separationRadius = 0.8; // 增大排斥半径 (0.6 -> 0.8)
        const force = 2.0; // 增大排斥力度 (1.2 -> 2.0)
        const allUnits = [...allies, ...enemies];

        for (const other of allUnits) {
            if (other === this || other.isDead) continue;

            const dist = this.position.distanceTo(other.position);
            
            // 队友和敌人统一使用较大的排斥半径，防止重叠
            const effectiveRadius = separationRadius;

            if (dist < effectiveRadius) {
                // 计算排斥方向
                const pushDir = new THREE.Vector3()
                    .subVectors(this.position, other.position)
                    .normalize();
                
                // 核心逻辑：推挤强度受自身质量影响
                let strength = (1 - dist / effectiveRadius) * force * deltaTime;
                strength /= this.mass; 

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

    moveTowardsTarget(deltaTime) {
        const dir = new THREE.Vector3()
            .subVectors(this.target.position, this.position)
            .normalize();
        
        const moveDist = this.moveSpeed * deltaTime;
        this.position.addScaledVector(dir, moveDist);

        // 战斗中暂时取消个体的草地脚步声，由环境音或集体音效代替（可选）
        /*
        if (this.footstepTimer === 0) {
            audioManager.play('footstep_grass', { 
                volume: 0.4,   
                pitchVar: 0.3, 
                chance: 0.5    
            });
        }
        */

        this.footstepTimer += deltaTime * 1000;
        if (this.footstepTimer >= this.footstepInterval) {
            this.footstepTimer = 0; // 重置，以便下帧或下次循环
        }
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            // 播放攻击音效 (根据类型)
            const animalTypes = ['wild_boar', 'wolf', 'tiger', 'bear'];
            if (animalTypes.includes(this.type)) {
                audioManager.play('attack_unarmed', { volume: 0.5 });
            } else {
                audioManager.play('attack_melee', { volume: 0.3, chance: 0.8 });
            }

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



    /**
     * 获取单位当前的逻辑面向（优先目标方向，其次移动方向）
     */
    getForwardVector() {
        if (this.target && !this.target.isDead) {
            return new THREE.Vector3().subVectors(this.target.position, this.position).normalize().setY(0);
        }
        // 如果没有目标，则根据 Sprite 翻转状态返回左或右
        // 注意：repeat.x 为正则面朝右（对应 standard），为负正面朝左（对应 flipped）
        // 但我们要根据 spriteFactory.cols 来精确判断，这里简化处理：
        const isFlipped = this.unitSprite.material.map.repeat.x < 0;
        return new THREE.Vector3(isFlipped ? -1 : 1, 0, 0);
    }

    takeDamage(amount) {
        if (this.isDead || this.isInvincible) return;
        
        // 概率播放受击音效
        audioManager.play('onhit', { volume: 0.3, chance: 0.4 });

        // 1. 应用百分比减伤 (核心重构：采用乘法叠加逻辑)
        let finalAmount = amount * this.damageMultiplier;
        
        // 2. 啸如虎：锁血 1 点逻辑
        if (this.isTigerHeart) {
            this.health = Math.max(1, this.health - finalAmount);
        } else {
            this.health -= finalAmount;
        }
        
        // 通用受击反馈：记录时间，由 updateVisualState 统一处理
        this.hitFlashUntil = Date.now() + 150;

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

/**
 * 英雄单位：主角亲自参战，拥有高属性和独特逻辑
 */
export class HeroUnit extends BaseUnit {
    static displayName = '主角';
    constructor(side, index, projectileManager) {
        const heroData = worldManager.heroData;
        const details = worldManager.getUnitDetails(heroData.id);
        
        super({
            side,
            index,
            type: heroData.id, 
            hp: details.hp, // 直接使用 getUnitDetails 返回的、包含成长和全局加成的最终血量
            speed: details.speed,
            attackDamage: details.atk, // 使用包含力道成长的最终攻击力
            attackRange: details.range,
            attackSpeed: details.attackSpeed,
            projectileManager,
            cost: 0,
            mass: 5.0 
        });

        this.isHero = true;
        this.level = heroData.level;
        // 当前血量：如果之前有记录则用记录的，否则用最大血量
        this.health = (heroData.hpCurrent !== undefined && heroData.hpCurrent > 0) ? heroData.hpCurrent : this.maxHealth;
        
        // --- 藏剑双形态逻辑 ---
        if (heroData.id === 'yeying') {
            this._cangjianStance = 'heavy'; // 默认重剑
            this.scale.set(1.5, 1.5, 1.5);
        }
        
        // --- 旋风斩逻辑复用 (时间驱动) ---
        this.isSpinning = false; 
        this.spinTimer = 0;
        this.spinDuration = 2.0; // 持续 2 秒 (物理时间)
        this.hitTimer = 0;       // 伤害判定计时器
        this.swordVFX = null;

        // 英雄更加醒目
        this.scale.set(1.5, 1.5, 1.5);
        this.createHeroHealthBar();
    }

    /**
     * 叶英复用：启动藏剑旋风斩
     */
    startWhirlwind() {
        this.isSpinning = true;
        this.spinTimer = this.spinDuration;
        this.hitTimer = 0; // 重置判定计时
        
        const vfx = new THREE.Group();
        const bladeGeo = new THREE.BoxGeometry(2.0, 0.08, 0.2); 
        const bladeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.8 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.x = 1.0; 
        vfx.add(blade);
        vfx.position.y = -0.1;
        this.add(vfx);
        this.swordVFX = vfx;
    }

    /**
     * 叶英复用：更新旋风斩 (时间步长驱动)
     */
    updateWhirlwind(enemies, deltaTime) {
        if (this.spinTimer <= 0) {
            this.isSpinning = false;
            if (this.swordVFX) {
                this.remove(this.swordVFX);
                this.swordVFX = null;
            }
            this.unitSprite.rotation.y = 0;
            return;
        }

        this.spinTimer -= deltaTime;
        
        // 视觉旋转 (按角速度计算)
        this.unitSprite.rotation.y += 12.0 * deltaTime; 
        if (this.swordVFX) this.swordVFX.rotation.y += 24.0 * deltaTime;

        // 核心修正：基于物理时间判定伤害
        this.hitTimer += deltaTime * 1000; // 转为毫秒
        const interval = worldManager.getUnitDetails('yeying').continuousInterval || 166;
        
        if (this.hitTimer >= interval) {
            this.hitTimer = 0; // 触发判定并重置
            this.executeAOE(enemies, {
                radius: 2.5,
                damage: this.attackDamage, 
                knockbackForce: 0.05
            });
        }
    }

    /**
     * 创建头顶 3D 血条
     */
    createHeroHealthBar() {
        const bgGeo = new THREE.PlaneGeometry(0.8, 0.1);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
        const bg = new THREE.Mesh(bgGeo, bgMat);
        bg.position.y = 1.2;
        this.add(bg);

        const fillGeo = new THREE.PlaneGeometry(0.78, 0.08);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.hpFill = new THREE.Mesh(fillGeo, fillMat);
        this.hpFill.position.set(0, 0, 0.01);
        bg.add(this.hpFill);
        this.hpBarFullWidth = 0.78;
    }

    updateHealthBar() {
        if (!this.hpFill) return;
        const pct = Math.max(0, this.health / this.maxHealth);
        this.hpFill.scale.x = pct;
        this.hpFill.position.x = -(1 - pct) * (this.hpBarFullWidth / 2);
    }

    /**
     * 藏剑形态管理
     */
    get cangjianStance() { return this._cangjianStance; }
    set cangjianStance(v) {
        if (this._cangjianStance === v) return;
        this._cangjianStance = v;
        
        const details = worldManager.getUnitDetails('yeying');

        // 切换到重剑形态时，强制中断轻剑特有 Buff (如梦泉虎跑)
        if (v === 'heavy') {
            this.clearBuffs('mengquan');
            this.baseColor = 0xffffff; // 重剑底色保持白色
            this.scale.set(1.5, 1.5, 1.5);
            this.attackRange = details.range; // 恢复心剑范围 (2.5)
        } else {
            this.baseColor = 0xffffff; // 轻剑底色恢复白色
            this.scale.set(1.5, 1.5, 1.5);
            this.attackRange = 1.0; // 轻剑单体攻击范围缩短
        }
    }

    /**
     * 清除指定标记的 Buff
     */
    clearBuffs(tag) {
        if (!this.activeBuffs) return;
        const toClear = this.activeBuffs.filter(b => b.tag === tag);
        toClear.forEach(b => {
            clearTimeout(b.timer);
            b.cleanup();
        });
        this.activeBuffs = this.activeBuffs.filter(b => b.tag !== tag);
    }

    /**
     * 英雄数据的代理接口：
     * 允许 BattleScene 中的 Buff 像操作普通属性一样操作功法和调息，并自动同步回 WorldManager
     */
    get spells() { return worldManager.heroData.stats.spells; }
    set spells(v) { worldManager.heroData.stats.spells = v; }
    
    get haste() { return worldManager.heroData.stats.haste; }
    set haste(v) { 
        // 调息上限锁定在 0.5 (50%)
        worldManager.heroData.stats.haste = Math.max(0, Math.min(0.5, v)); 
    }

    takeDamage(amount) {
        super.takeDamage(amount);
        this.updateHealthBar();
        if (this.side === 'player') {
            worldManager.heroData.hpCurrent = this.health;
        }
    }

    die() {
        if (this.isDead) return;
        super.die();
        if (this.side === 'player') {
            window.dispatchEvent(new CustomEvent('hero-defeated', { detail: { heroId: this.type } }));
        }
    }

    /**
     * 核心重构：高度复用兵种逻辑，彻底解决残留与重叠
     */
    performAttack(enemies, allies) {
        const heroId = worldManager.heroData.id;
        const now = Date.now();
        const details = worldManager.getUnitDetails(heroId);
        
        // 核心优化：攻速逻辑完全数据驱动，消除硬编码，且支持 Buff 缩放
        let actualCD = this.attackCooldownTime;
        if (heroId === 'yeying' && details.modes) {
            const m = details.modes;
            const modeKey = this.cangjianStance === 'heavy' ? 'yeying_heavy' : 'yeying_light';
            const modeCfg = m[modeKey];
            if (modeCfg && modeCfg.attackSpeed) {
                // 计算该形态相对于英雄蓝图攻速的比例
                const baseBlueprintAS = UNIT_STATS_DATA[heroId].attackSpeed || 1000;
                const ratio = modeCfg.attackSpeed / baseBlueprintAS;
                actualCD = this.attackCooldownTime * ratio;
            }
        }

        if (now - this.lastAttackTime < actualCD) return;
        this.lastAttackTime = now;

        const burstCount = details.burstCount || 1;

        if (heroId === 'yeying') {
            const m = details.modes;
            const ident = worldManager.getHeroIdentity('yeying');
            const baseAtk = ident.combatBase.atk;
            if (this.cangjianStance === 'heavy') {
                // 重剑模式：心剑旋风
                const cfg = m.yeying_heavy;
                const burst = cfg.burstCount || 1;
                for (let i = 0; i < burst; i++) {
                    setTimeout(() => {
                        if (this.isDead) return;
                        this.onAttackAnimation();
                        window.battle.playVFX('cangjian_whirlwind', { unit: this, radius: cfg.range, color: 0xffcc00, duration: 250 });
                        this.executeAOE(enemies, {
                            radius: cfg.range,
                            damage: this.attackDamage * (cfg.atk / baseAtk),
                            knockbackForce: 0.05
                        });
                    }, i * 250);
                }
            } else {
                // 轻剑模式：单体快速攻击
                const cfg = m.yeying_light;
                const burst = cfg.burstCount || 1;
                for (let i = 0; i < burst; i++) {
                    setTimeout(() => {
                        if (this.isDead || !this.target || this.target.isDead) return;
                        if (i === 0) this.onAttackAnimation(); 
                        
                        const finalDmg = this.attackDamage * (cfg.atk / baseAtk);
                        this.target.takeDamage(finalDmg + (rng.next() - 0.5) * 5);
                    }, i * 150); 
                }
            }
        } else if (heroId === 'qijin') {
            this.onAttackAnimation();
            this.performChunyangAttack(enemies, details);
        } else if (heroId === 'lichengen') {
            this.onAttackAnimation();
            this.performTianceAttack(enemies, details);
        }
    }

    performTianceAttack(enemies, details) {
        if (!this.target || this.target.isDead) return;
        const radius = details.range || 2.0;
        const kb = details.knockbackForce || 0.15;
        window.battle.playVFX('advanced_sweep', { unit: this, radius: radius, color: 0xff0000, duration: 300 });
        this.executeAOE(enemies, {
            radius: radius,
            angle: Math.PI, 
            damage: this.attackDamage,
            knockbackForce: kb
        });
    }

    /**
     * 纯阳强化：五剑齐发视觉与逻辑
     */
    performChunyangAttack(enemies, details) {
        if (!this.target || this.target.isDead) return;
        const swordCount = details.burstCount || 5; 
        for (let i = 0; i < swordCount; i++) {
            setTimeout(() => {
                if (this.isDead || !this.target || this.target.isDead) return;
                const offset = new THREE.Vector3((i - (swordCount-1)/2) * 0.5, 1.2, (rng.next() - 0.5) * 0.5);
                const spawnPos = this.position.clone().add(offset);
                this.projectileManager?.spawn({
                    startPos: spawnPos,
                    target: this.target,
                    speed: 0.25,
                    damage: this.attackDamage, 
                    type: 'air_sword'
                });
            }, i * 100);
        }
    }
}

export class MeleeSoldier extends BaseUnit {
    static displayName = '天策弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('melee');
        super({
            side,
            index,
            type: 'melee',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }
}

export class RangedSoldier extends BaseUnit {
    static displayName = '长歌弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('ranged');
        super({
            side,
            index,
            type: 'ranged',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            audioManager.play('attack_air_sword', { volume: 0.4 });

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
    static displayName = '唐门射手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('archer');
        super({
            side,
            index,
            type: 'archer',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range, // 极远射程
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: 3
        });
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            audioManager.play('attack_arrow', { volume: 0.4 });

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
    static displayName = '万花补给';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('healer');
        super({
            side,
            index,
            type: 'healer',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range, // 治疗范围
            attackDamage: -stats.atk, // 负伤害即治疗
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    updateAI(enemies, allies) {
        // 1. 寻找任意受伤的盟友 (简单 find，不强求最低血量，自然分散治疗压力)
        this.target = allies.find(u => !u.isDead && u.health < u.maxHealth);
        
        // 2. 如果全员健康，则把主角作为跟随目标
        if (!this.target) {
            this.target = allies.find(u => u.isHero && !u.isDead);
        }

        if (this.target) {
            const dist = this.position.distanceTo(this.target.position);
            // 保持距离：离目标太远才移动
            this.isMoving = dist > this.attackRange * 0.8; 
        }
    }

    performAttack(enemies, allies) {
        // --- 核心安全性检查：只奶受伤的自己人 ---
        if (!this.target || this.target.side !== this.side || this.target.health >= this.target.maxHealth) return;

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

// ==========================================
// 野外势力与动物 (基于 enemy.png)
// ==========================================

// --- 第一行：野生动物 (纯近战，移速较快) ---
export class WildBoar extends BaseUnit {
    static displayName = '野猪';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('wild_boar');
        super({ side, index, type: 'wild_boar', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Wolf extends BaseUnit {
    static displayName = '野狼';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('wolf');
        super({ side, index, type: 'wolf', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Tiger extends BaseUnit {
    static displayName = '猛虎';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('tiger');
        super({ side, index, type: 'tiger', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 2.0, projectileManager });
    }
}

export class Bear extends BaseUnit {
    static displayName = '黑熊';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('bear');
        super({ side, index, type: 'bear', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 3.0, projectileManager });
    }
}

// --- 第二行：山贼与叛军 ---
export class Bandit extends BaseUnit {
    static displayName = '山贼刀匪';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('bandit');
        super({ side, index, type: 'bandit', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class BanditArcher extends BaseUnit {
    static displayName = '山贼弩匪';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('bandit_archer');
        super({ side, index, type: 'bandit_archer', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            audioManager.play('attack_arrow', { volume: 0.3 });

            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 
                target: this.target, 
                speed: 0.25, 
                damage: this.attackDamage, 
                type: 'arrow' 
            });
        }
    }
}

export class RebelSoldier extends BaseUnit {
    static displayName = '叛军甲兵';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('rebel_soldier');
        super({ side, index, type: 'rebel_soldier', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 1.5, projectileManager });
    }
}

export class RebelAxeman extends BaseUnit {
    static displayName = '叛军斧兵';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('rebel_axeman');
        super({ side, index, type: 'rebel_axeman', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

// --- 第三行：毒虫与飞禽 ---
export class Snake extends BaseUnit {
    static displayName = '毒蛇';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('snake');
        super({ side, index, type: 'snake', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Bats extends BaseUnit {
    static displayName = '蝙蝠群';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('bats');
        super({ side, index, type: 'bats', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Deer extends BaseUnit {
    static displayName = '林间小鹿';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('deer');
        super({ side, index, type: 'deer', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Pheasant extends BaseUnit {
    static displayName = '山鸡';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('pheasant');
        super({ side, index, type: 'pheasant', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

// --- 第四行：精英与特殊 ---
export class AssassinMonk extends BaseUnit {
    static displayName = '苦修刺客';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('assassin_monk');
        super({ side, index, type: 'assassin_monk', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

export class Zombie extends BaseUnit {
    static displayName = '毒尸傀儡';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('zombie');
        super({ side, index, type: 'zombie', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class HeavyKnight extends BaseUnit {
    static displayName = '铁浮屠重骑';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('heavy_knight');
        super({ side, index, type: 'heavy_knight', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 4.0, projectileManager });
    }
}

export class ShadowNinja extends BaseUnit {
    static displayName = '隐之影';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('shadow_ninja');
        super({ side, index, type: 'shadow_ninja', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

/**
 * 藏剑：旋风斩 (第二行第三个)
 */
export class Cangjian extends BaseUnit {
    static displayName = '藏剑弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('cangjian');
        super({
            side,
            index,
            type: 'cangjian',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk, // 单次伤害降低，因为是高频多段伤害
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
        this.isSpinning = false;
        this.spinTimer = 0;
        this.spinDuration = 120; // 持续帧数 (约2秒)
        this.swordVFX = null;
    }

    performAttack(enemies, allies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;

            const details = worldManager.getUnitDetails('cangjian');
            const burstCount = details.burstCount || 3;

            // 核心修正：藏剑弟子也改为爆发模式，缩小范围 (1.5)
            for (let i = 0; i < burstCount; i++) {
                setTimeout(() => {
                    if (this.isDead) return;
                    this.onAttackAnimation();
                    window.battle.playVFX('cangjian_whirlwind', { pos: this.position, radius: details.range, color: 0xffcc00, duration: 500 });
                    this.executeAOE(enemies, {
                        radius: details.range,
                        angle: Math.PI * 2,
                        damage: this.attackDamage,
                        knockbackForce: 0.05
                    });
                }, i * 250); // 间隔拉长
            }
        }
    }
}

/**
 * 苍云：肉盾，攻击方式类似近战，走得慢 (第三行第三个)
 */
export class Cangyun extends BaseUnit {
    static displayName = '苍云将士';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('cangyun');
        super({
            side,
            index,
            type: 'cangyun',
            hp: stats.hp, // 极高生命值
            speed: stats.speed, // 移动缓慢
            attackRange: stats.range,
            attackDamage: stats.atk, // 伤害一般
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost,
            mass: 2.5 // 苍云盾墙，质量较高
        });
    }
}

/**
 * 天策骑兵：移动快，180度扇形攻击 + 强力击退 (第一行第二个)
 */
export class Tiance extends BaseUnit {
    static displayName = '天策骑兵';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('tiance');
        super({
            side,
            index,
            type: 'tiance',
            hp: stats.hp, 
            speed: stats.speed,
            attackRange: stats.range, 
            attackDamage: stats.atk, 
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
        this.sweepRadius = 2.0; // 范围缩小 (3.5 -> 2.0)
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            // 真正的精简：VFX 和 AOE 判定现在都能自动识别面向
            window.battle.playVFX('tiance_sweep', { unit: this, radius: this.sweepRadius, color: 0xff0000, duration: 250 });

            this.executeAOE(enemies, {
                radius: this.sweepRadius,
                angle: Math.PI, 
                damage: this.attackDamage,
                knockbackForce: 0.07
            });
        }
    }
}

/**
 * 纯阳：远近结合，优先远程，近身切剑 (第一行第三个)
 */
export class Chunyang extends BaseUnit {
    static displayName = '纯阳弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitDetails('chunyang');
        super({
            side,
            index,
            type: 'chunyang',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range, 
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
        this.statsData = stats; // 保存原始数据引用以获取多形态数值
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
                const m = this.statsData.modes.chunyang_melee;
                window.battle.playVFX('tiance_sweep', { unit: this, radius: m.range, color: 0x00ccff, duration: 200 });
                this.executeAOE(enemies, { radius: m.range, angle: Math.PI * 2/3, damage: this.attackDamage * (m.atk/this.statsData.modes.chunyang_remote.atk), knockbackForce: 0.03 });
            } else {
                const r = this.statsData.modes.chunyang_remote;
                for (let i = 0; i < r.burstCount; i++) {
                    setTimeout(() => {
                        if (this.isDead || !this.target || this.target.isDead) return;
                        const spawnPos = this.position.clone().add(new THREE.Vector3((i - 1) * 0.4, 1.2, (rng.next() - 0.5) * 0.5));
                        this.projectileManager?.spawn({ startPos: spawnPos, target: this.target, speed: 0.25, damage: this.attackDamage, type: 'air_sword' });
                    }, i * 200);
                }
            }
        }
    }
}




