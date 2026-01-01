import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { rng } from '../core/Random.js';
import { modifierManager } from '../core/ModifierManager.js';
import { worldManager } from '../core/WorldManager.js';
import { audioManager } from '../core/AudioManager.js';
import { UNIT_STATS_DATA } from '../data/UnitStatsData.js';

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
        
        // --- 核心属性初始化 (使用 _ 前缀保存基础值) ---
        this._baseHp = hp;
        
        // 基础移速叠加随机微差
        this._baseMoveSpeed = (speed + (rng.next() - 0.5) * 0.01) * 0.5; // 全局移速再降低 30% (总计约降低 50%)
        
        this._baseAttackRange = attackRange;
        this._baseAttackDamage = attackDamage;
        this._baseAttackInterval = attackSpeed;
        this._baseDamageMultiplier = 1.0;

        // 当前血量初始化
        this.health = this.maxHealth;
        
        this.isDead = false;
        
        this.hitFlashUntil = 0; // 受击闪红截止时间戳
        this.activeColors = new Map(); // 记录当前生效的 Buff 颜色 (Tag -> Color)
        this.baseColor = 0xffffff; // 单位的基础颜色
        
        this.target = null;
        this.lastAttackTime = 0;
        this.isFleeing = false; // 新增：逃跑状态
        this.isVictoryMarch = false; // 新增：胜利进军状态
        
        this.unitSprite = null;
        
        // 物理动力学属性：用于平滑击退
        this.knockbackVelocity = new THREE.Vector3();
        this.knockbackFriction = 0.85; // 摩擦力，值越小停得越快
        
        // 走路音效控制 (改为固定时间频率)
        this.footstepTimer = 0;
        this.footstepInterval = 650; // 每 650ms 响一次
        this.moveAnimTime = 0; // 初始设为 0
        this.lastPosition = new THREE.Vector3(); // 用于驱动位移动画
        this.debugLogTimer = 0; // 调试日志计时器

        this._martyrdomTriggered = false; // 哀兵必胜触发标记

        // --- 护盾系统初始化 ---
        this.shield = 0;
        this.activeShields = []; // [{ id, amount, endTime }]

        // 攻击动画状态机 (平滑冲刺)
        this.lungeState = {
            active: false,
            progress: 0,     // 0.0 -> 1.0
            direction: new THREE.Vector3(),
            duration: 0.25,  // 总持续时间 (秒)
            maxDist: 0.4
        };

        this.initVisual();
        
        // 保存视觉缩放比例，用于计算碰撞半径
        const unitCfg = spriteFactory.unitConfig[this.type];
        this.visualScale = unitCfg ? (unitCfg.scale || 1.4) : 1.4;

        // 核心新增：所有单位初始化时都创建血条，但默认隐藏
        this.createHealthBar();
        if (this.hpSprite) this.hpSprite.visible = false;
    }

    /**
     * 创建头顶 精灵图血条 (基类通用版)
     */
    createHealthBar() {
        // 极低分辨率，高度略微增加以变宽
        const canvas = document.createElement('canvas');
        canvas.width = 32; 
        canvas.height = 6; 
        this.hpCanvas = canvas;
        this.hpCtx = canvas.getContext('2d');
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        
        this.hpSprite = new THREE.Sprite(material);
        // 主角血条长一点 (0.9)，普通士兵现在也变大一点 (0.8)
        const isHeroType = ['liwangsheng', 'lichengen', 'yeying'].includes(this.type);
        const s = isHeroType ? 0.9 : 0.8;
        this.hpSprite.scale.set(s, 0.12, 1); 
        
        // --- 应用统一的头顶 UI Trick ---
        this.hpGroup = new THREE.Group();
        this.hpGroup.add(this.hpSprite);
        this.add(this.hpGroup);
        
        if (window.battle && window.battle.vfxLibrary) {
            window.battle.vfxLibrary._applyHeadUITrick(this.hpSprite, 1.3);
        } else {
            // 回退方案
            this.hpSprite.position.y = 1.3;
        }
        
        this.updateHealthBar();
    }

    updateHealthBar() {
        if (!this.hpCtx || !this.hpCanvas) return;
        
        // 核心逻辑：总显示量 = Max(最大生命值, 当前生命值 + 护盾值)
        const totalValue = Math.max(this.maxHealth, this.health + this.shield);
        
        // 计算各项占比 (基于 totalValue)
        const hpPct = Math.max(0, this.health / totalValue);
        const shieldPct = Math.max(0, this.shield / totalValue);
        
        const ctx = this.hpCtx;
        const w = this.hpCanvas.width;
        const h = this.hpCanvas.height;
        const isPlayer = this.side === 'player';
        
        // 1. 完全清空
        ctx.clearRect(0, 0, w, h);
        
        // 2. 绘制黑色背景
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        
        // 3. 绘制内槽底色
        ctx.fillStyle = isPlayer ? 'rgba(0, 40, 0, 0.9)' : 'rgba(100, 20, 20, 0.9)';
        ctx.fillRect(1, 1, w - 2, h - 2);
        
        const maxFillW = w - 2;
        
        // 4. 绘制血量部分
        ctx.fillStyle = isPlayer ? '#44ff44' : '#ff4444';
        const hpW = Math.floor(maxFillW * hpPct);
        if (hpW > 0) {
            ctx.fillRect(1, 1, hpW, h - 2);
        }

        // 5. 绘制护盾部分 (白色，紧跟在当前血量后面)
        if (shieldPct > 0) {
            ctx.fillStyle = '#ffffff';
            const shieldStartX = 1 + hpW;
            const shieldW = Math.ceil(maxFillW * shieldPct); // 使用 ceil 确保哪怕很小的盾也能看到 1 像素
            if (shieldW > 0) {
                // 护盾宽度不会超出整个槽
                const finalShieldW = Math.min(shieldW, w - 1 - shieldStartX);
                ctx.fillRect(shieldStartX, 1, finalShieldW, h - 2);
            }
        }
        
        if (this.hpSprite) {
            this.hpSprite.material.map.needsUpdate = true;
        }
    }

    // --- 动态属性 Getters (核心：实时从 ModifierManager 获取计算后的数值) ---
    
    get maxHealth() {
        return modifierManager.getModifiedValue(this, 'hp', this._baseHp);
    }

    get moveSpeed() {
        return modifierManager.getModifiedValue(this, 'moveSpeed', this._baseMoveSpeed);
    }

    get baseMoveSpeed() {
        return this._baseMoveSpeed;
    }

    get attackRange() {
        return modifierManager.getModifiedValue(this, 'attackRange', this._baseAttackRange);
    }

    get attackDamage() {
        // --- 核心重构：直接请求 ModifierManager 聚合后的最终伤害 ---
        // 这一步包含了 baseFlat * primaryMult * attackBonus * moreDamage 的所有逻辑
        return modifierManager.getModifiedValue(this, 'final_attack_damage', this._baseAttackDamage);
    }

    get attackCooldownTime() {
        // 攻击频率 (attackSpeed) 增加时，冷却间隔缩短
        const speedMult = modifierManager.getModifiedValue(this, 'attackSpeed', 1.0);
        return this._baseAttackInterval / speedMult;
    }

    get damageMultiplier() {
        // 核心修正：基础倍率为 1.0 (100% 承受)，通过 ModifierManager 堆叠减伤
        return modifierManager.getModifiedValue(this, 'damage_multiplier', 1.0);
    }

    get isInvincible() {
        return modifierManager.getModifiedValue(this, 'invincible', 0) > 0;
    }

    get isControlImmune() {
        return modifierManager.getModifiedValue(this, 'controlImmune', 0) > 0;
    }

    get isTigerHeart() {
        return modifierManager.getModifiedValue(this, 'tigerHeart', 0) > 0;
    }

    get isStunned() {
        return modifierManager.getModifiedValue(this, 'stun', 0) > 0;
    }

    /**
     * 获取单位当前的硬体碰撞半径
     */
    get collisionRadius() {
        // 基础半径 0.5 (对应标准缩放 1.4)
        // 如果 scale 变大，半径等比例变大
        return 0.5 * (this.visualScale / 1.4);
    }

    initVisual() {
        // 1. 侠客 Sprite
        this.unitSprite = spriteFactory.createUnitSprite(this.type);
        this.add(this.unitSprite);

        // --- 核心修复：初始朝向同步 ---
        // 在部署/生成阶段，根据所属阵营立即应用初始翻转，防止开战瞬间才“回头”
        // 规则：玩家单位默认看右，敌人单位默认看左
        this.setSpriteFacing(this.side === 'player' ? 'right' : 'left');

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

        // --- 新增：目标预选指示器 ---
        this.initTargetIndicator();
        
        // 保存视觉缩放比例，用于计算碰撞半径
        const unitCfg = spriteFactory.unitConfig[this.type];
        this.visualScale = unitCfg ? (unitCfg.scale || 1.4) : 1.4;
    }

    initTargetIndicator() {
        const geo = new THREE.RingGeometry(0.6, 0.7, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0, // 初始隐藏
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.targetIndicator = new THREE.Mesh(geo, mat);
        this.targetIndicator.rotation.x = -Math.PI / 2;
        this.targetIndicator.position.y = -0.37; // 略高于阵营环 (-0.38)
        this.add(this.targetIndicator);
    }

    /**
     * 设置是否被技能锁定
     */
    setTargeted(isTargeted, color = 0xffffff) {
        if (!this.targetIndicator || this.isDead) return;
        this.targetIndicator.material.opacity = isTargeted ? 0.8 : 0;
        if (isTargeted) {
            this.targetIndicator.material.color.set(color);
            
            // --- 核心优化：动态匹配单位体积 ---
            // 基础半径是 0.6，我们根据 collisionRadius (单位碰撞半径) 动态缩放它
            // 原本是 1.2 倍，现在缩小 30% 左右，改为 0.85 倍
            const finalScale = (this.collisionRadius / 0.5) * 0.85;
            
            // 移除呼吸动画，使用固定缩放
            this.targetIndicator.scale.set(finalScale, finalScale, 1);
        }
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
        
        // 核心重构：利用 ModifierManager 的自动生命周期管理 (针对专家 Point 2)
        const modId = `stun_${this.side}_${this.type}_${this.index}`;
        
        modifierManager.addModifier({
            id: modId,
            stat: 'stun',
            value: 1,
            type: 'add',
            targetUnit: this,
            source: 'status',
            startTime: Date.now(),
            duration: duration
        });
        
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
        target.takeDamage(damage + (rng.next() - 0.5) * 5, this.isHero);
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
        if (this.isStunned) {
            targetColor = 0x888888;
        }

        // 3. 受击反馈 (最高优先级，短促闪烁)
        if (Date.now() < this.hitFlashUntil) {
            targetColor = 0xff3333;
        }

        if (this.unitSprite.material.color.getHex() !== targetColor) {
            this.unitSprite.material.color.setHex(targetColor);
        }

        // --- 统一头顶 UI 逻辑：不再需要每帧计算偏移 ---
        // 现在的血条位置由 hpGroup 的稳定锚点(0.7)和视觉偏移共同决定
        // 且已开启 depthTest: false，保证位置稳定且不被遮挡
    }

    /**
     * 处理平滑的攻击冲刺动画
     */
    updateLunge(deltaTime) {
        if (!this.lungeState.active || !this.unitSprite) return;

        this.lungeState.progress += deltaTime / this.lungeState.duration;
        
        if (this.lungeState.progress >= 1.0) {
            // 动画结束，重置位置和缩放
            this.lungeState.active = false;
            this.lungeState.progress = 0;
            this.unitSprite.position.set(0, 0, 0);
            this.unitSprite.scale.set(this.visualScale, this.visualScale, 1);
            return;
        }

        // 使用 sin 曲线模拟冲刺并弹回的效果 (0 -> 1 -> 0)
        // Math.sin(progress * Math.PI) 在 progress 为 0.5 时达到最大值 1
        const t = Math.sin(this.lungeState.progress * Math.PI);
        
        // 更新位移 (如果没被禁用)
        if (!this.lungeState.noLunge) {
            const dist = t * this.lungeState.maxDist;
            this.unitSprite.position.set(
                this.lungeState.direction.x * dist,
                this.lungeState.direction.y * dist,
                this.lungeState.direction.z * dist
            );
        }

        // 更新缩放 (在基础缩放上叠加 30% 的变化)
        const scaleBoost = 1.0 + t * 0.3;
        const currentScale = this.visualScale * scaleBoost;
        this.unitSprite.scale.set(currentScale, currentScale, 1);
    }

    update(enemies, allies, deltaTime) {
        if (this.isDead) return;

        this.lastPosition.copy(this.position); // 记录位移前的位置
        this.isActuallyMoving = false; // 每帧重置移动状态

        // --- 核心修复：坐忘无我（仅在拥有特定 Modifier 时生效，非底层机制） ---
        if (this.isHero && this.side === 'player') {
            const arrayRegen = modifierManager.getModifiedValue(this, 'chunyang_array_mp_regen_enabled', 0);
            if (arrayRegen > 0) {
                // 检查是否在任意气场中
                const isInArray = this.activeBuffs && this.activeBuffs.some(b => b.tag === 'shengtaiji' || b.tag === 'tunriyue' || b.tag === 'huasanqing');
                if (isInArray) {
                    const heroData = worldManager.heroData;
                    const recoverAmount = arrayRegen * (deltaTime / 1000);
                    heroData.mpCurrent = Math.min(heroData.mpMax, heroData.mpCurrent + recoverAmount);
                }
            }
        }

        // 0. 更新护盾过期
        this.updateShields();

        // 0. 统一视觉状态更新
        this.updateVisualState();
        
        // 0. 攻击冲刺动画更新
        this.updateLunge(deltaTime);

        // 0. 逃跑逻辑：强制往左走且减速
        if (this.isFleeing) {
            // 逃跑速度为基础战斗移速的 50%
            const fleeSpeed = this.baseMoveSpeed * 0.5;
            this.position.x -= fleeSpeed * deltaTime;
            this.isActuallyMoving = true;
            this.updateFacing(); // 确保面向左边
            this.applySeparation(allies, enemies, deltaTime);
            
            // 逃跑时显示减速特效和专门的“逃”字特效
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('slow', { unit: this });
                window.battle.playVFX('flee', { unit: this });
            }
            this.updateProceduralAnimation(deltaTime);
            return;
        }

        // 0. 胜利进军逻辑：直接向前奔跑
        if (this.isVictoryMarch) {
            const moveDir = this.side === 'player' ? 1 : -1;
            this.position.x += moveDir * this.moveSpeed * deltaTime;
            this.isActuallyMoving = true;
            this.setSpriteFacing(this.side === 'player' ? 'right' : 'left');
            this.applySeparation(allies, enemies, deltaTime);
            this.updateProceduralAnimation(deltaTime);
            return;
        }

        // 0. 状态特效判定：减速
        if (this.moveSpeed < this.baseMoveSpeed * 0.95) {
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('slow', { unit: this });
            }
        }

        // 0. 眩晕状态判定
        if (this.isStunned) {
            // 眩晕时也要处理物理冲力 (击退)
            if (this.knockbackVelocity.lengthSq() > 0.0001) {
                this.position.add(this.knockbackVelocity);
                this.knockbackVelocity.multiplyScalar(this.knockbackFriction);
            }
            // 处理碰撞挤压
            this.applySeparation(allies, enemies, deltaTime);
            this.updateProceduralAnimation(deltaTime);
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
                this.updateProceduralAnimation(deltaTime);
                return; 
            }
        }

        // 处理特殊状态（如旋风斩）
        if (this.type === 'cangjian' && this.isSpinning) {
            this.updateWhirlwind(enemies);
            // 旋风斩期间可以缓慢移动或静止，这里保持原地旋转并处理碰撞
            this.applySeparation(allies, enemies, deltaTime);
            this.updateProceduralAnimation(deltaTime);
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
                this.isActuallyMoving = true;
            } else {
                this.footstepTimer = 0; // 停止移动时归零
                this.performAttack(enemies, allies);
            }
            
            // 2. 碰撞挤压逻辑：防止单位完全重叠
            this.applySeparation(allies, enemies, deltaTime);
            
            // 3. 动态光环逻辑
            const nearestEnemy = this.findNearestEnemy(enemies, true); // 视觉光环需要绝对最近，防止闪烁
            if (nearestEnemy) {
                this.updateInfluenceRing(this.position.distanceTo(nearestEnemy.position));
            }
        }

        // 最后统一调用程序化动画更新 (包括闲置呼吸)
        this.updateProceduralAnimation(deltaTime);
    }

    /**
     * 更新单位面向：根据目标方向和初始面向决定是否翻转
     */
    updateFacing() {
        if (!this.unitSprite) return;
        
        // 逃跑时强制面向左
        if (this.isFleeing) {
            this.setSpriteFacing('left');
            return;
        }

        if (!this.target) return;

        const isTargetToLeft = this.target.position.x < this.position.x;
        this.setSpriteFacing(isTargetToLeft ? 'left' : 'right');
    }

    /**
     * 更新程序化动画 (动感行走与呼吸)
     */
    updateProceduralAnimation(deltaTime) {
        if (this.isDead || !this.unitSprite) return;

        // 如果正在攻击冲刺，则不套用行走动画（防止位移冲突）
        if (this.lungeState.active) return;

        const texture = this.unitSprite.material.map;
        if (!texture) return;

        // 计算这一帧真实的物理位移 (Distance-based Animation)
        const distanceMoved = this.position.distanceTo(this.lastPosition);
        const isPhysicallyMoving = distanceMoved > 0.00001; // 极大降低阈值，适配精细的战斗坐标系

        if (isPhysicallyMoving) {
            // 【战场行走调参指南】
            // 1. stepDistance: 步长。越大跳得越慢。
            //    - 基准: 李承恩(英雄)秒速约 4.5 -> 步频 5.0 步/秒 (触发天花板，表现为"全力冲刺")
            //    - 基准: 天策骑兵秒速约 3.0 -> 步频 3.3 步/秒 (线性区，表现为"快速奔跑")
            //    - 基准: 普通步兵秒速约 1.5 -> 步频 1.6 步/秒 (线性区，表现为"稳健行军")
            const stepDistance = 0.9;        
            const maxStepsPerSecond = 4.0;   // 2. 天花板: 封顶 4 步/秒。
            
            const deltaAnim = (distanceMoved / stepDistance) * Math.PI;
            // 核心：强制适配 deltaTime。如果大于 1 视为毫秒，否则视为秒
            const dtSec = (deltaTime > 1) ? (deltaTime / 1000) : deltaTime;
            const maxDelta = (maxStepsPerSecond * Math.PI) * dtSec;
            
            const finalDelta = Math.min(deltaAnim, maxDelta);
            this.moveAnimTime += finalDelta;

            // --- 战斗调试日志：受 WorldManager.DEBUG.SHOW_MOTION_DEBUG 控制，仅限玩家英雄 ---
            const debug = worldManager.constructor.DEBUG; 
            if (debug.ENABLED && debug.SHOW_MOTION_DEBUG && this.isHero && this.side === 'player') {
                this.debugLogTimer += dtSec;
                if (this.debugLogTimer > 0.5) {
                    const speedPerSec = (distanceMoved / dtSec).toFixed(3);
                    const isCapped = deltaAnim > maxDelta ? "%c[已达天花板]" : "";
                    console.log(`%c[战斗调试] %c秒速: ${speedPerSec} | 帧位移: ${distanceMoved.toFixed(5)} | 动画增量: ${finalDelta.toFixed(3)} ${isCapped}`, 
                        "color: #ffaa00; font-weight: bold", "color: #fff", isCapped ? "color: #ff4444" : "");
                    this.debugLogTimer = 0;
                }
            }
            
            const bob = Math.abs(Math.sin(this.moveAnimTime));
            this.unitSprite.position.y = bob * 0.15; // 跳跃高度

            const stretch = 1 + bob * 0.1;
            const squash = 1 - bob * 0.05;
            
            // 倾斜逻辑：根据当前面向决定倾斜方向
            const isFlipped = texture.repeat.x < 0;
            const tilt = isFlipped ? 0.08 : -0.08; 
            this.unitSprite.rotation.z = THREE.MathUtils.lerp(this.unitSprite.rotation.z, tilt, 0.1);

            this.unitSprite.scale.set(
                this.visualScale * squash,
                this.visualScale * stretch,
                1
            );
        } else {
            // --- 呼吸/闲置动画 ---
            this.unitSprite.position.y = THREE.MathUtils.lerp(this.unitSprite.position.y, 0, 0.2);
            this.unitSprite.rotation.z = THREE.MathUtils.lerp(this.unitSprite.rotation.z, 0, 0.2);

            const breath = Math.sin(Date.now() * 0.003 + (this.index * 0.5)) * 0.02; 
            this.unitSprite.scale.set(
                this.visualScale * (1 - breath),
                this.visualScale * (1 + breath),
                1
            );
        }
    }

    /**
     * 设置精灵面向
     * @param {'left' | 'right'} direction 
     */
    setSpriteFacing(direction) {
        const config = spriteFactory.unitConfig[this.type];
        if (!config) return;

        const defaultFacing = config.defaultFacing || 'left';
        let shouldFlip = (direction !== defaultFacing);
        
        const texture = this.unitSprite.material.map;
        const standardRepeatX = 1 / spriteFactory.cols;
        const flippedRepeatX = -1 / spriteFactory.cols;
        
        const targetRepeatX = shouldFlip ? flippedRepeatX : standardRepeatX;
        const standardOffsetX = (config.col - 1) / spriteFactory.cols;
        const flippedOffsetX = config.col / spriteFactory.cols;
        const targetOffsetX = shouldFlip ? flippedOffsetX : standardOffsetX;

        if (texture.repeat.x !== targetRepeatX) {
            texture.repeat.x = targetRepeatX;
            texture.offset.x = targetOffsetX;
        }
    }

    /**
     * 重构后的硬性碰撞：基于几何约束的保底体积逻辑
     * 不再使用质量分配，而是强制推开重叠部分，保证单位间有最小间距
     */
    applySeparation(allies, enemies, deltaTime) {
        const allUnits = [...allies, ...enemies];
        const myRadius = this.collisionRadius;

        for (const other of allUnits) {
            if (other === this || other.isDead) continue;

            const dist = this.position.distanceTo(other.position);
            const minAllowedDist = myRadius + other.collisionRadius;

            if (dist < minAllowedDist) {
                // 计算排斥方向
                const pushDir = new THREE.Vector3();
                
                // 解决重合死穴：如果距离极小，随机分配一个排斥方向
                if (dist < 0.001) {
                    pushDir.set(
                        Math.random() - 0.5,
                        Math.random() - 0.5,
                        0
                    ).normalize();
                } else {
                    pushDir.subVectors(this.position, other.position).normalize();
                }

                // 核心逻辑：立即校正重叠位移 (Constraint Correction)
                // 两个单位平分重叠距离，不考虑质量
                const overlap = minAllowedDist - dist;
                this.position.addScaledVector(pushDir, overlap * 0.5);
            }
        }
    }

    updateAI(enemies, allies) {
        // 1. 基础逻辑：目标死亡或不存在时索敌
        const needsNewTarget = !this.target || this.target.isDead;
        
        // 2. 优化：远程单位在准备好攻击时重新索敌，增加灵活性
        // 设定 2.0 为远程阈值，确保他们总是攻击当前最近的威胁
        const isRanged = this.attackRange > 2.0;
        const isReadyToAttack = (Date.now() - this.lastAttackTime) >= this.attackCooldownTime;
        const shouldRefreshTarget = isRanged && isReadyToAttack;

        if (needsNewTarget || shouldRefreshTarget) {
            const newTarget = this.findNearestEnemy(enemies);
            if (newTarget) {
                this.target = newTarget;
            }
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


    /**
     * 寻找最近的敌人 (带随机扰动的灵活寻敌)
     * @param {Array} enemies 
     * @param {boolean} strict 是否强制返回绝对最近的 (用于视觉/光环)
     */
    findNearestEnemy(enemies, strict = false) {
        const aliveEnemies = enemies.filter(e => !e.isDead);
        if (aliveEnemies.length === 0) return null;

        // 1. 计算所有距离并排序
        const candidates = aliveEnemies.map(enemy => ({
            enemy,
            dist: this.position.distanceTo(enemy.position)
        })).sort((a, b) => a.dist - b.dist);

        // 如果只需要最精确的最近目标（如视觉效果），或只有一个候选人，直接返回
        if (strict || candidates.length === 1) return candidates[0].enemy;

        // 2. 取最近的最多三个候选者
        const top3 = candidates.slice(0, 3);
        const minDist = top3[0].dist;

        // 3. 剔除 Outlier (定义：距离超过最近者 30% 且 绝对距离差超过 2.0)
        // 这样如果几个敌人扎堆，士兵会随机分流；如果一个近两个远，则只选近的
        const validCandidates = top3.filter(c => {
            const isTooFarRatio = c.dist > minDist * 1.3;
            const isTooFarAbs = (c.dist - minDist) > 2.0;
            // 只有同时满足“比最近的远很多”和“绝对距离有明显差距”才判定为 outlier
            return !(isTooFarRatio && isTooFarAbs);
        });

        // 4. 从非离群的候选人中随机选一个
        const randomIndex = Math.floor(rng.next() * validCandidates.length);
        return validCandidates[randomIndex].enemy;
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
                // 主角普通攻击强制 100% 播放
                audioManager.play('attack_melee', { 
                    volume: 0.3, 
                    chance: this.isHero ? 1.0 : 0.8,
                    force: this.isHero 
                });
            }

            // 默认单体攻击
            this.target.takeDamage(this.attackDamage + (rng.next() - 0.5) * 5, this.isHero);
        }
    }

    /**
     * 核心重构：通用的多段攻击 (Burst Attack) 支持
     * 解决了手动使用 setTimeout 导致的逻辑零散与难以维护问题
     * @param {Object} options { count, interval, damage, type, vfx, sound, onHit }
     */
    executeBurstAttack(options) {
        const { 
            count = 1, 
            interval = 150, 
            damage = this.attackDamage,
            isAOE = false,
            aoeRadius = 2.0,
            aoeAngle = Math.PI * 2,
            vfxName = null,
            projectileType = null,
            projectileColor = 0xffffff,
            projectileScale = 1.0,
            projectilePenetration = 0,
            soundName = 'attack_melee',
            noLunge = false
        } = options;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                if (this.isDead) return;

                // 1. 动画与音效 (仅第一段触发位移动画，后续仅触发受击感)
                if (soundName) audioManager.play(soundName, { volume: 0.25, pitchVar: 0.2 });
                if (i === 0) {
                    this.onAttackAnimation(noLunge);
                }

                // 2. 视觉特效 (VFX)
                if (vfxName && window.battle) {
                    window.battle.playVFX(vfxName, { 
                        unit: this, 
                        pos: isAOE ? this.position : null,
                        radius: aoeRadius, 
                        color: projectileColor, 
                        duration: interval + 100 
                    });
                }

                // 3. 伤害逻辑处理
                if (projectileType && this.projectileManager && this.target) {
                    // 远程/弹道模式
                    const spawnPos = this.position.clone().add(new THREE.Vector3(0, 0.8, 0));
                    // 气剑等连发时的扇形偏移
                    if (count > 1) {
                        const offset = (i - (count-1)/2) * 0.4;
                        spawnPos.x += offset;
                    }
                    this.projectileManager.spawn({
                        startPos: spawnPos,
                        target: this.target,
                        speed: 0.25,
                        damage: damage,
                        type: projectileType,
                        color: projectileColor,
                        scale: projectileScale,
                        penetration: projectilePenetration,
                        isHeroSource: this.isHero
                    });
                } else if (isAOE) {
                    // 范围攻击模式
                    const targets = (this.side === 'player') ? 
                        (window.battle?.enemyUnits || []) : 
                        (window.battle?.playerUnits || []);
                    
                    this.executeAOE(targets, {
                        radius: aoeRadius,
                        angle: aoeAngle,
                        damage: damage,
                        knockbackForce: 0.035
                    });
                } else if (this.target && !this.target.isDead) {
                    // 基础单体模式
                    this.target.takeDamage(damage + (rng.next() - 0.5) * 5, this.isHero);
                }
            }, i * interval);
        }
    }

    onAttackAnimation(noLunge = false) {
        if (this.lungeState.active) return; // 如果正在播放，不重复触发

        const baseSize = this.visualScale || 1.4;
        
        // 激活状态机
        this.lungeState.active = true;
        this.lungeState.progress = 0;
        this.lungeState.noLunge = noLunge; // 记录是否禁止位移
        this.lungeState.direction.copy(this.getForwardVector());
        this.lungeState.maxDist = 0.4 * (baseSize / 1.4); 
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

    takeDamage(amount, isHeroSource = false) {
        if (this.isDead || this.isInvincible) return;
        
        // 核心修正：如果是治疗 (amount < 0)，跳过减伤和护盾计算
        let finalAmount = amount;
        if (amount > 0) {
            // 1. 应用减伤 (Multiplicative Independent Reduction)
            finalAmount = amount * this.damageMultiplier;
            
            // 2. 应用易伤桶 (Additive Internal, Multiplicative External)
            // 易伤计算：1 + (易伤A + 易伤B)
            const vulnerability = modifierManager.getModifiedValue(this, 'vulnerability', 1.0);
            finalAmount *= vulnerability;
            
            // --- 护盾优先吸收伤害 ---
            if (this.shield > 0) {
                const absorbed = this._consumeShields(finalAmount);
                if (absorbed > 0) {
                    // 护盾跳字反馈：亮白色
                    if (window.battle && window.battle.playVFX) {
                        window.battle.playVFX('damage_number', { 
                            pos: this.position.clone(), 
                            value: absorbed, 
                            color: '#ffffff',
                            scale: 0.8
                        });
                    }
                    finalAmount -= absorbed;
                }
            }
        }
        
        if (finalAmount > 0) {
            // 只有受到伤害时才播受击音效和闪红
            // 主角受击 或 被主角攻击 时，受击音效强制 100% 播放
            const isCriticalSource = this.isHero || isHeroSource;
            audioManager.play('onhit', { 
                volume: 0.3, 
                chance: isCriticalSource ? 1.0 : 0.4,
                force: isCriticalSource 
            });
            this.hitFlashUntil = Date.now() + 150;

            // --- 剩余伤害跳字 ---
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('damage_number', { 
                    pos: this.position.clone(), 
                    value: finalAmount, 
                    color: isHeroSource ? '#ff3333' : '#ffaa00',
                    scale: 1.0
                });
            }
        } else if (finalAmount < 0) {
            // 治疗表现：绿色跳字
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('damage_number', { 
                    pos: this.position.clone(), 
                    value: Math.abs(finalAmount), 
                    color: '#44ff44',
                    scale: 0.8
                });
            }
        }

        // 2. 啸如虎：锁血 1 点逻辑
        if (this.isTigerHeart) {
            this.health = Math.max(1, this.health - finalAmount);
        } else {
            this.health -= finalAmount;
        }

        // 3. 治疗上限限制：不允许超过最大血量
        if (this.health > this.maxHealth) {
            this.health = this.maxHealth;
        }
        
        if (this.health <= 0) {
            // --- 核心：处理“哀兵必胜”天赋 ---
            const hasMartyrdom = modifierManager.getModifiedValue(this, 'martyrdom_enabled', 0) > 0;
            if (hasMartyrdom && !this._martyrdomTriggered && !this.isHero) {
                this._martyrdomTriggered = true;
                this.health = 1; // 强行锁 1 血
                
                // 视觉反馈：变为半透明，增加紧迫感
                if (this.unitSprite) this.unitSprite.material.opacity = 0.6;
                
                // 添加 2 秒无敌 Modifier
                modifierManager.addModifier({
                    id: `martyr_${this.side}_${this.type}_${this.index}`,
                    stat: 'invincible',
                    value: 1,
                    type: 'add',
                    duration: 2000,
                    targetUnit: this,
                    source: 'talent',
                    onCleanup: () => {
                        // 哀兵结束时，如果是被英雄打进这个状态的，依然算英雄击杀吗？
                        // 通常这种锁血状态结束后的自然死亡较难判定来源，这里简化处理：
                        // 如果在死亡瞬间判定
                        this.die(); // 2 秒后强行死亡
                    }
                });
                
                if (window.battle && window.battle.playVFX) {
                    window.battle.playVFX('vfx_sparkle', { unit: this, color: 0xff4444, duration: 2000, radius: 1.0 });
                }
            } else {
                // --- 核心：触发英雄击杀相关天赋 ---
                if (isHeroSource && !this.isDead && window.battle && window.battle.heroUnit) {
                    this._triggerHeroKillTalents(window.battle.heroUnit);
                }
                this.die();
            }
        }

        // 核心更新：任何受损都会更新血条
        this.updateHealthBar();
    }

    _triggerHeroKillTalents(hero) {
        // 1. 藏剑专属：映波锁澜 (重剑杀敌获盾)
        if (hero.type === 'yeying' && hero.cangjianStance === 'heavy') {
            const shieldRatio = modifierManager.getModifiedValue(hero, 'cangjian_kill_shield_enabled', 0);
            if (shieldRatio > 0) {
                const shieldAmount = hero.maxHealth * shieldRatio;
                // 添加 2 秒护盾，ID 设为 kill_shield 以便刷新
                hero.addShield(shieldAmount, 2000, 'cangjian_kill_shield');
            }
        }
    }

    die() {
        this.isDead = true;
        this.unitSprite.rotation.z = Math.PI / 2; // 倒下
        this.position.y = 0.3;
        
        // 核心修复：死亡时立即从 ModifierManager 中移除该单位的所有修正器
        // 彻底解决死亡单位 Modifier 堆积导致的内存泄漏与 $O(N)$ 计算性能崩溃问题
        modifierManager.removeModifiersByTarget(this);

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

    /**
     * 添加护盾
     * @param {number} amount 护盾值
     * @param {number} duration 持续时间 (ms)，0 为永久
     * @param {string} id 唯一标识符
     */
    addShield(amount, duration = 0, id = null) {
        if (this.isDead) return;
        
        const shieldId = id || `shield_${Date.now()}_${Math.random()}`;
        const endTime = duration > 0 ? Date.now() + duration : Infinity;
        
        // 如果存在同 ID 护盾，则更新它
        const existing = this.activeShields.find(s => s.id === shieldId);
        if (existing) {
            existing.amount = amount;
            existing.endTime = endTime;
        } else {
            this.activeShields.push({ id: shieldId, amount, endTime });
        }
        
        this.refreshShieldValue();
        
        // 护盾视觉反馈
        if (window.battle && window.battle.playVFX) {
            window.battle.playVFX('vfx_sparkle', { unit: this, color: 0xffffff, duration: 500, radius: 0.8 });
        }
    }

    /**
     * 移除特定护盾
     */
    removeShield(id) {
        this.activeShields = this.activeShields.filter(s => s.id !== id);
        this.refreshShieldValue();
    }

    /**
     * 刷新当前护盾总值
     */
    refreshShieldValue() {
        const oldShield = this.shield;
        this.shield = this.activeShields.reduce((sum, s) => sum + s.amount, 0);
        if (this.shield !== oldShield) {
            this.updateHealthBar();
        }
    }

    /**
     * 每帧更新护盾过期
     */
    updateShields() {
        if (this.activeShields.length === 0) return;
        
        const now = Date.now();
        const originalCount = this.activeShields.length;
        this.activeShields = this.activeShields.filter(s => s.endTime > now);
        
        if (this.activeShields.length !== originalCount) {
            this.refreshShieldValue();
        }
    }

    /**
     * 内部方法：按照过期时间顺序消耗护盾 (优先消耗快过期的)
     * @returns {number} 实际吸收的伤害量
     */
    _consumeShields(amount) {
        if (this.activeShields.length === 0) return 0;
        
        // 按照过期时间排序，快过期的排在前面 (Infinity 会排在最后)
        this.activeShields.sort((a, b) => a.endTime - b.endTime);
        
        let remainingDamage = amount;
        let totalAbsorbed = 0;
        
        for (let i = 0; i < this.activeShields.length; i++) {
            const s = this.activeShields[i];
            if (s.amount >= remainingDamage) {
                s.amount -= remainingDamage;
                totalAbsorbed += remainingDamage;
                remainingDamage = 0;
                break;
            } else {
                totalAbsorbed += s.amount;
                remainingDamage -= s.amount;
                s.amount = 0;
            }
        }
        
        // 清理掉已经扣成 0 的护盾
        this.activeShields = this.activeShields.filter(s => s.amount > 0);
        this.refreshShieldValue();
        
        return totalAbsorbed;
    }
}

/**
 * 英雄单位：主角亲自参战，拥有高属性和独特逻辑
 */
export class HeroUnit extends BaseUnit {
    static displayName = '主角';
    constructor(side, index, projectileManager) {
        const heroData = worldManager.heroData;
        const details = worldManager.getUnitBlueprint(heroData.id);
        
        super({
            side,
            index,
            type: heroData.id, 
            hp: details.hp, // 使用蓝图基础血量 (BaseUnit 会应用全局修正)
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
        
        // --- 核心修复：将大世界的基础属性同步到战斗实例，用于 ModifierManager 计算 ---
        this.baseStats = heroData.stats ? { ...heroData.stats } : { spells: 0, haste: 0, power: 0 };

        // --- 优雅的血量同步逻辑：百分比映射 ---
        // 1. 获取该英雄在大世界的基础最大血量 (即蓝图值)
        const baseMaxHP = details.hp; 
        // 2. 获取大世界当前的实时血量 (如果没有记录，则默认为满血)
        const worldCurrentHP = (heroData.hpCurrent !== undefined) ? heroData.hpCurrent : baseMaxHP;
        
        // 3. 计算血量百分比 (0.0 - 1.0)
        const healthRatio = Math.min(1.0, worldCurrentHP / baseMaxHP);

        // 4. 将百分比应用到战场的 maxHealth 上 (maxHealth 已由 BaseUnit 应用了全局 Buff)
        if (healthRatio >= 0.99) {
            this.health = this.maxHealth; // 接近满血则强制满血，处理浮点数误差
        } else {
            this.health = this.maxHealth * healthRatio;
        }

        console.log(`%c[HeroUnit] %c主角入场同步: 大世界状态(${worldCurrentHP.toFixed(1)}/${baseMaxHP.toFixed(1)}) -> 战场状态(${this.health.toFixed(1)}/${this.maxHealth.toFixed(1)})`);
        
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
        this.updateHealthBar();
        if (this.hpSprite) this.hpSprite.visible = true;
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
        const interval = worldManager.getUnitBlueprint('yeying').continuousInterval || 166;
        
        if (this.hitTimer >= interval) {
            this.hitTimer = 0; // 触发判定并重置
            this.executeAOE(enemies, {
                radius: 2.5,
                damage: this.attackDamage, 
                knockbackForce: 0.035
            });
        }
    }

    /**
     * 藏剑形态管理
     */
    get cangjianStance() { return this._cangjianStance; }
    set cangjianStance(v) {
        if (this._cangjianStance === v) return;
        this._cangjianStance = v;
        
        const details = worldManager.getUnitBlueprint('yeying');
        const m = details.modes;
        const modeKey = v === 'heavy' ? 'yeying_heavy' : 'yeying_light';
        const modeCfg = m[modeKey];

        // --- 核心重构：将形态攻速缩放转化为 Modifier (Point 2) ---
        // 逻辑：通过 attackSpeed 修正器来改变 attackCooldownTime，实现数据驱动
        const baseBlueprintAS = UNIT_STATS_DATA['yeying'].attackSpeed || 1000;
        const ratio = (modeCfg && modeCfg.attackSpeed) ? (modeCfg.attackSpeed / baseBlueprintAS) : 1.0;
        
        modifierManager.addModifier({
            id: 'yeying_mode_speed',
            side: this.side,
            targetUnit: this,
            stat: 'attackSpeed',
            multiplier: 1 / ratio, // 间隔 = 基础 / 倍率，若间隔变为 2倍，则倍率设为 0.5
            source: 'hero_mode'
        });

        // 切换到重剑形态时，强制中断轻剑特有 Buff (如梦泉虎跑)
        if (v === 'heavy') {
            this.clearBuffs('mengquan');
            this.baseColor = 0xffffff; 
            this.scale.set(1.5, 1.5, 1.5);
            this._baseAttackRange = details.range; 
        } else {
            this.baseColor = 0xffffff; 
            this.scale.set(1.5, 1.5, 1.5);
            this._baseAttackRange = modeCfg.range || 1.8; // 使用配置值，保底 1.8
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
    get spells() { 
        // 核心加固：直接传入当前原始功法点数作为 baseValue (专家建议 Point 2)
        // 这样即便外部没有提前注册 Modifier，英雄的基本功法加成也能保底生效
        const rawPoints = worldManager.heroData.stats.spells;
        return modifierManager.getModifiedValue(this, 'skill_power', rawPoints); 
    }
    set spells(v) { 
        // 原始点数依然存回 heroData
        worldManager.heroData.stats.spells = v; 
        worldManager.refreshHeroStats(); 
    }

    /**
     * 获取原始功法点数 (用于 UI 显示)
     */
    get rawSpells() {
        return modifierManager.getModifiedValue(this, 'spells', 0);
    }
    
    get haste() { 
        // 核心加固：传入英雄原始急速作为 baseValue
        return modifierManager.getModifiedValue(this, 'haste', worldManager.heroData.stats.haste); 
    }
    set haste(v) { 
        // 核心优化：原始数据不再截断，出口由 ModifierManager 统一管理
        worldManager.heroData.stats.haste = Math.max(0, v); 
        worldManager.refreshHeroStats();
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
        const now = Date.now();
        const details = worldManager.getUnitBlueprint(this.type);
        
        // 核心优化：攻速逻辑现在完全由 ModifierManager 驱动
        let actualCD = this.attackCooldownTime;

        if (now - this.lastAttackTime < actualCD) return;
        
        // --- 核心：天策【横扫千军】(原羽林枪法) 逻辑 ---
        if (this.type === 'lichengen') {
            const isSweepEnabled = modifierManager.getModifiedValue(this, 'tiance_yulin_enabled', 0) > 0;
            const mode = isSweepEnabled ? details.modes.sweep : details.modes.pierce;

            this.lastAttackTime = now;
            this.onAttackAnimation();

            if (isSweepEnabled) {
                // 情况 1: 横扫 (1.5倍伤害)
                audioManager.play('attack_melee', { volume: 0.5, force: true });
                const radius = this.attackRange;
                const kb = details.knockbackForce || 0.15;
                if (window.battle && window.battle.playVFX) {
                    window.battle.playVFX('advanced_sweep', { unit: this, radius: radius, color: 0xff0000, duration: 300 });
                }
                this.executeAOE(enemies, {
                    radius: radius,
                    angle: Math.PI, 
                    damage: this.attackDamage * mode.atkMult,
                    knockbackForce: kb
                });
            } else {
                // 情况 2: 单体突刺 (2倍伤害)
                audioManager.play('attack_melee', { volume: 0.6, force: true });
                if (window.battle && window.battle.playVFX) {
                    window.battle.playVFX('tiance_sweep', { unit: this, radius: 1.2, color: 0xffaa00, duration: 150, angle: Math.PI / 4 });
                }
                if (this.target && !this.target.isDead) {
                    this.target.takeDamage(this.attackDamage * mode.atkMult, true);
                }
            }
            return;
        }

        this.lastAttackTime = now;

        const heroId = this.type;
        if (heroId === 'yeying') {
            const m = details.modes;
            const ident = worldManager.getHeroIdentity('yeying');
            const baseAtk = ident.combatBase.atk;
            if (this.cangjianStance === 'heavy') {
                // 重剑模式：心剑旋风 (禁用冲刺位移)
                const cfg = m.yeying_heavy;
                const bonusBurst = modifierManager.getModifiedValue(this, 'yeying_heavy_burst_bonus', 0);
                const burst = (cfg.burstCount || 1) + bonusBurst;
                for (let i = 0; i < burst; i++) {
                    setTimeout(() => {
                        if (this.isDead) return;
                        // 每段爆发独立音效
                        audioManager.play('attack_melee', { volume: 0.4, force: true, pitchVar: 0.2 });
                        this.onAttackAnimation(true); // 传入 true 禁用位移
                        window.battle.playVFX('cangjian_whirlwind', { unit: this, radius: this.attackRange, color: 0xffcc00, duration: 250 });
                        this.executeAOE(enemies, {
                            radius: this.attackRange,
                            damage: this.attackDamage * (cfg.atk / baseAtk),
                            knockbackForce: 0.035
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
                        // 每段爆发独立音效，音量稍小
                        audioManager.play('attack_melee', { volume: 0.25, force: true, pitchVar: 0.1 });
                        if (i === 0) this.onAttackAnimation(); 
                        
                        const finalDmg = this.attackDamage * (cfg.atk / baseAtk);
                        this.target.takeDamage(finalDmg + (rng.next() - 0.5) * 5, true);
                    }, i * 150); 
                }
            }
        } else if (heroId === 'liwangsheng') {
            // 李忘生改为 performChunyangAttack 内部控制音效
            this.onAttackAnimation();
            this.performChunyangAttack(enemies, details);
        } else if (heroId === 'lichengen') {
            // 此时已在 performAttack 顶层处理了羽林枪法覆盖，这里的逻辑仅作保底（通常不会走到）
            audioManager.play('attack_melee', { volume: 0.5, force: true });
            this.onAttackAnimation();
            this.performTianceAttack(enemies, details);
        }
    }

    performTianceAttack(enemies, details) {
        if (!this.target || this.target.isDead) return;
        // 原有横扫逻辑
        const radius = this.attackRange;
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

        // 核心优化：从 ModifierManager 获取穿透次数
        const penetration = modifierManager.getModifiedValue(this, 'projectile_penetration', 0);

        this.executeBurstAttack({
            count: details.burstCount || 3,
            interval: 100,
            damage: this.attackDamage,
            projectileType: 'air_sword',
            projectileColor: 0x00ffff,
            projectilePenetration: penetration,
            soundName: 'attack_air_sword'
        });
    }
}

export class MeleeSoldier extends BaseUnit {
    static displayName = '天策弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('melee');
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
        const stats = worldManager.getUnitBlueprint('ranged');
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
        const stats = worldManager.getUnitBlueprint('archer');
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
            cost: stats.cost
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
        const stats = worldManager.getUnitBlueprint('healer');
        super({
            side,
            index,
            type: 'healer',
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range, // 治疗范围
            attackDamage: stats.atk, // 核心修正：治疗职业也存正数，仅在输出时转为负值
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    updateAI(enemies, allies) {
        // 1. 寻找所有受伤的盟友 (血量低于 90%)
        const injuredAllies = allies.filter(u => !u.isDead && u.health < (u.maxHealth * 0.9));

        if (injuredAllies.length > 0) {
            // 2. 计算距离并按距离排序
            const withDist = injuredAllies.map(ally => ({
                ally,
                dist: this.position.distanceTo(ally.position),
                hpRatio: ally.health / ally.maxHealth
            })).sort((a, b) => a.dist - b.dist);

            // 3. 取最近的 4 个候选者 (k=4)
            const topK = withDist.slice(0, 4);
            const minDist = topK[0].dist;

            // 4. 剔除距离过远的 Outlier (奶妈容忍度稍高，设为 2 倍距离且差值大于 4)
            const validByDist = topK.filter(c => {
                const isTooFarRatio = c.dist > minDist * 2.0;
                const isTooFarAbs = (c.dist - minDist) > 4.0;
                return !(isTooFarRatio && isTooFarAbs);
            });

            // 5. 在有效的近处伤员中，按血量百分比排序 (伤最重的排前面)
            validByDist.sort((a, b) => a.hpRatio - b.hpRatio);

            // 6. 从最残血的前 2 名中随机选一个，兼顾“救急”和“分工”
            const finalCandidates = validByDist.slice(0, 2);
            const randomIndex = Math.floor(rng.next() * finalCandidates.length);
            this.target = finalCandidates[randomIndex].ally;
            
        } else {
            // 7. 如果全员健康，则把主角作为跟随目标
            this.target = allies.find(u => u.isHero && !u.isDead);
        }

        if (this.target) {
            const dist = this.position.distanceTo(this.target.position);
            // 保持距离：离目标太远才移动
            this.isMoving = dist > this.attackRange * 0.8; 
        }
    }

    performAttack(enemies, allies) {
        // --- 核心安全性检查：只奶受伤的自己人，同样增加 1 点血量容差 ---
        if (!this.target || this.target.side !== this.side || this.target.health >= (this.target.maxHealth - 1)) return;

        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            console.log(`%c[Healer Attack] %c发射治疗 -> ${this.target.type}, 当前HP: ${this.target.health.toFixed(2)}`);
            this.lastAttackTime = now;
            this.onAttackAnimation();
            
            if (this.projectileManager) {
                this.projectileManager.spawn({
                    startPos: this.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
                    target: this.target,
                    speed: 0.1,
                    damage: -this.attackDamage, // 发射负值进行治疗
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
        const stats = worldManager.getUnitBlueprint('wild_boar');
        super({ side, index, type: 'wild_boar', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Wolf extends BaseUnit {
    static displayName = '野狼';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('wolf');
        super({ side, index, type: 'wolf', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Tiger extends BaseUnit {
    static displayName = '猛虎';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tiger');
        super({ side, index, type: 'tiger', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 2.0, projectileManager });
    }
}

export class Bear extends BaseUnit {
    static displayName = '黑熊';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('bear');
        super({ side, index, type: 'bear', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 3.0, projectileManager });
    }
}

// --- 第二行：山贼与叛军 ---
export class Bandit extends BaseUnit {
    static displayName = '山贼刀匪';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('bandit');
        super({ side, index, type: 'bandit', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class BanditArcher extends BaseUnit {
    static displayName = '山贼弩匪';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('bandit_archer');
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
    static displayName = '狼牙甲兵';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('rebel_soldier');
        super({ side, index, type: 'rebel_soldier', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 1.5, projectileManager });
    }
}

export class RebelAxeman extends BaseUnit {
    static displayName = '狼牙斧兵';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('rebel_axeman');
        super({ side, index, type: 'rebel_axeman', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

// --- 第三行：毒虫与飞禽 ---
export class Snake extends BaseUnit {
    static displayName = '毒蛇';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('snake');
        super({ side, index, type: 'snake', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();

            // 毒蛇吐口水音效 (暂用气剑音效，音量调低)
            audioManager.play('attack_air_sword', { volume: 0.2, pitchVar: 0.4 });

            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 0.2, 0)), 
                target: this.target, 
                speed: 0.15, 
                damage: this.attackDamage, 
                type: 'spit', // 改为口水特效
                color: 0x8800ff // 紫色口水
            });
        }
    }
}

export class Bats extends BaseUnit {
    static displayName = '蝙蝠群';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('bats');
        super({ side, index, type: 'bats', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Deer extends BaseUnit {
    static displayName = '林间小鹿';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('deer');
        super({ side, index, type: 'deer', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class Pheasant extends BaseUnit {
    static displayName = '山鸡';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('pheasant');
        super({ side, index, type: 'pheasant', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

// --- 第四行：精英与特殊 ---
export class AssassinMonk extends BaseUnit {
    static displayName = '苦修刺客';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('assassin_monk');
        super({ side, index, type: 'assassin_monk', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

export class Zombie extends BaseUnit {
    static displayName = '毒尸傀儡';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('zombie');
        super({ side, index, type: 'zombie', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class HeavyKnight extends BaseUnit {
    static displayName = '铁浮屠重骑';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('heavy_knight');
        super({ side, index, type: 'heavy_knight', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 4.0, projectileManager });
    }
}

export class ShadowNinja extends BaseUnit {
    static displayName = '隐之影';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shadow_ninja');
        super({ side, index, type: 'shadow_ninja', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

// ==========================================
// 天一教势力 (基于 enemy4.png)
// ==========================================

export class TianyiGuard extends BaseUnit {
    static displayName = '天一教卫';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_guard');
        super({ side, index, type: 'tianyi_guard', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class TianyiCrossbowman extends BaseUnit {
    static displayName = '天一弩手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_crossbowman');
        super({ side, index, type: 'tianyi_crossbowman', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
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
                type: 'arrow',
                color: 0x88ff88 // 天一教特有的翠绿色毒箭
            });
        }
    }
}

export class TianyiApothecary extends BaseUnit {
    static displayName = '天一药师';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_apothecary');
        super({ side, index, type: 'tianyi_apothecary', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_air_sword', { volume: 0.2, pitchVar: 0.4 });
            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 
                target: this.target, 
                speed: 0.15, 
                damage: this.attackDamage, 
                type: 'lob', // 改为投掷模式
                arcHeight: 2.0, // 增加抛物线高度
                color: 0x00ff00 // 毒药绿色
            });
        }
    }
}

export class TianyiVenomZombie extends BaseUnit {
    static displayName = '天一毒尸';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_venom_zombie');
        super({ side, index, type: 'tianyi_venom_zombie', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class TianyiPriest extends BaseUnit {
    static displayName = '天一祭司';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_priest');
        super({ side, index, type: 'tianyi_priest', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_air_sword', { volume: 0.3, pitchVar: 0.5 });
            
            // 多目标攻击逻辑
            const nearbyEnemies = window.battle.getUnitsInArea(this.target.position, { shape: 'circle', radius: 4.0 }, 'enemy');
            const targetCount = Math.min(nearbyEnemies.length, 2);
            
            for (let i = 0; i < targetCount; i++) {
                this.projectileManager?.spawn({ 
                    startPos: this.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 
                    target: nearbyEnemies[i], 
                    speed: 0.1, 
                    damage: this.attackDamage, 
                    type: 'wave',
                    color: 0x8800ff 
                });
            }
        }
    }
}

export class TianyiAbomination extends BaseUnit {
    static displayName = '缝合巨怪';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_abomination');
        super({ side, index, type: 'tianyi_abomination', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, mass: 5.0, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_unarmed', { volume: 0.8 });
            
            // 范围重击
            this.executeAOE(enemies, {
                radius: 2.5,
                damage: this.attackDamage,
                knockbackForce: 0.2
            });
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('stomp', { pos: this.position, radius: 2.5, color: 0x664422, duration: 400 });
            }
        }
    }
}

export class TianyiElder extends BaseUnit {
    static displayName = '天一长老';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_elder');
        super({ side, index, type: 'tianyi_elder', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_air_sword', { volume: 0.4, pitchVar: 0.2 });
            
            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 
                target: this.target, 
                speed: 0.2, 
                damage: this.attackDamage, 
                type: 'fireball', // 改用火球效果
                scale: 0.8, // 缩小尺寸
                color: 0x006600 // 暗绿色
            });
        }
    }
}

export class TianyiShadowGuard extends BaseUnit {
    static displayName = '天一影卫';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tianyi_shadow_guard');
        super({ side, index, type: 'tianyi_shadow_guard', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

// ==========================================
// 神策军势力 (基于 enemy3.png)
// ==========================================

export class ShenceInfantry extends BaseUnit {
    static displayName = '神策步兵';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_infantry');
        super({ side, index, type: 'shence_infantry', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class ShenceShieldguard extends BaseUnit {
    static displayName = '神策盾卫';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_shieldguard');
        super({ side, index, type: 'shence_shieldguard', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 3.0, projectileManager });
    }
}

export class ShenceCrossbowman extends BaseUnit {
    static displayName = '神策弩手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_crossbowman');
        super({ side, index, type: 'shence_crossbowman', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
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
                speed: 0.3, 
                damage: this.attackDamage, 
                type: 'arrow',
                color: 0xffffaa // 神策军特有的浅金色箭羽
            });
        }
    }
}

export class ShenceBannerman extends BaseUnit {
    static displayName = '神策旗手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_bannerman');
        super({ side, index, type: 'shence_bannerman', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
    updateAI(enemies, allies) {
        super.updateAI(enemies, allies);
        // 旗手会周期性给周围友军加Buff
        const now = Date.now();
        if (now - (this.lastBuffTime || 0) > 4000) {
            this.lastBuffTime = now;
            const nearbyAllies = allies.filter(u => !u.isDead && u.position.distanceTo(this.position) < 5.0);
            if (window.battle) {
                window.battle.applyBuffToUnits(nearbyAllies, {
                    stat: 'attackDamage',
                    multiplier: 1.15,
                    duration: 3000,
                    color: 0xffff00,
                    tag: 'shence_morale',
                    vfxName: 'rising_particles'
                });
            }
        }
    }
}

export class ShenceCavalry extends BaseUnit {
    static displayName = '神策精骑';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_cavalry');
        super({ side, index, type: 'shence_cavalry', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 4.0, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.5, force: true });
            
            this.executeAOE(enemies, {
                radius: 2.5,
                angle: Math.PI / 2,
                damage: this.attackDamage,
                knockbackForce: 0.1
            });
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('tiance_sweep', { unit: this, radius: 2.5, color: 0xff4444, duration: 250 });
            }
        }
    }
}

export class ShenceOverseer extends BaseUnit {
    static displayName = '神策督军';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_overseer');
        super({ side, index, type: 'shence_overseer', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 2.5, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.6, force: true });
            
            // 强力顺劈
            this.executeAOE(enemies, {
                radius: 2.0,
                angle: Math.PI,
                damage: this.attackDamage,
                knockbackForce: 0.08
            });
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('advanced_sweep', { unit: this, radius: 2.0, color: 0xff0000, duration: 300 });
            }
        }
    }
}

export class ShenceAssassin extends BaseUnit {
    static displayName = '神策暗刺';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_assassin');
        super({ side, index, type: 'shence_assassin', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

export class ShenceIronPagoda extends BaseUnit {
    static displayName = '铁甲神策';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('shence_iron_pagoda');
        super({ side, index, type: 'shence_iron_pagoda', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, mass: 10.0, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_unarmed', { volume: 0.9 });
            
            // 大范围地裂击
            this.executeAOE(enemies, {
                radius: 3.5,
                damage: this.attackDamage,
                knockbackForce: 0.3
            });
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('stomp', { pos: this.position, radius: 3.5, color: 0x333333, duration: 600 });
            }
        }
    }
}

// ==========================================
// 红衣教势力 (基于 enemy5.png)
// ==========================================

export class RedCultPriestess extends BaseUnit {
    static displayName = '红衣祭司';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_priestess');
        super({ side, index, type: 'red_cult_priestess', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_air_sword', { volume: 0.3, pitchVar: 0.2 });
            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 
                target: this.target, 
                speed: 0.2, 
                damage: this.attackDamage, 
                type: 'wave',
                color: 0xff4444 
            });
        }
    }
}

export class RedCultHighPriestess extends BaseUnit {
    static displayName = '红衣圣女';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_high_priestess');
        super({ side, index, type: 'red_cult_high_priestess', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    updateAI(enemies, allies) {
        super.updateAI(enemies, allies);
        // 圣女周期性赋予周围友军狂热 Buff (攻速提升)
        const now = Date.now();
        if (now - (this.lastBuffTime || 0) > 5000) {
            this.lastBuffTime = now;
            const nearbyAllies = allies.filter(u => !u.isDead && u.position.distanceTo(this.position) < 6.0);
            if (window.battle) {
                window.battle.applyBuffToUnits(nearbyAllies, {
                    stat: 'attackSpeed',
                    multiplier: 1.3,
                    duration: 4000,
                    color: 0xff0000,
                    tag: 'red_cult_fanaticism',
                    vfxName: 'rising_particles'
                });
            }
        }
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_air_sword', { volume: 0.4, pitchVar: 0.1 });
            
            // 发射两枚圣光
            for (let i = 0; i < 2; i++) {
                setTimeout(() => {
                    if (this.isDead || !this.target || this.target.isDead) return;
                    this.projectileManager?.spawn({ 
                        startPos: this.position.clone().add(new THREE.Vector3((i-0.5)*0.5, 1.0, 0)), 
                        target: this.target, 
                        speed: 0.15, 
                        damage: this.attackDamage / 2, 
                        type: 'wave',
                        scale: 1.5,
                        color: 0xffaa00 
                    });
                }, i * 200);
            }
        }
    }
}

export class RedCultSwordsman extends BaseUnit {
    static displayName = '红衣剑卫';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_swordsman');
        super({ side, index, type: 'red_cult_swordsman', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class RedCultArcher extends BaseUnit {
    static displayName = '红衣弩手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_archer');
        super({ side, index, type: 'red_cult_archer', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
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
                type: 'arrow',
                color: 0xff8888 // 红衣教特有的暗红色箭羽
            });
        }
    }
}

export class RedCultAssassin extends BaseUnit {
    static displayName = '红衣暗刺';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_assassin');
        super({ side, index, type: 'red_cult_assassin', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

export class RedCultFireMage extends BaseUnit {
    static displayName = '红衣法师';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_firemage');
        super({ side, index, type: 'red_cult_firemage', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_arrow', { volume: 0.4 }); // 使用射箭音效模拟火球飞行
            
            // 发射火球，击中后触发爆炸
            if (this.projectileManager) {
                this.projectileManager.spawn({
                    startPos: this.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
                    target: this.target,
                    speed: 0.2,
                    damage: this.attackDamage,
                    type: 'fireball',
                    scale: 0.5, // 尺寸缩小 50%
                    explosionRadius: 2.5,
                    explosionColor: 0xff4400,
                    explosionVFX: 'fire_explosion'
                });
            }
        }
    }
}

export class RedCultExecutioner extends BaseUnit {
    static displayName = '红衣惩戒者';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_executioner');
        super({ side, index, type: 'red_cult_executioner', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, mass: 2.5, projectileManager });
    }
    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.6, force: true });
            
            this.executeAOE(enemies, {
                radius: 2.0,
                damage: this.attackDamage,
                knockbackForce: 0.15
            });
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('advanced_sweep', { unit: this, radius: 2.0, color: 0xff0000, duration: 300 });
            }
        }
    }
}

export class RedCultEnforcer extends BaseUnit {
    static displayName = '红衣武者';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_enforcer');
        super({ side, index, type: 'red_cult_enforcer', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, cost: stats.cost, projectileManager });
    }
}

export class RedCultAcolyte extends BaseUnit {
    static displayName = '红衣教众';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('red_cult_acolyte');
        super({ side, index, type: 'red_cult_acolyte', hp: stats.hp, speed: stats.speed, attackRange: stats.range, attackDamage: stats.atk, attackSpeed: stats.attackSpeed, cost: stats.cost, projectileManager });
    }
}

/**
 * 藏剑：旋风斩 (第二行第三个)
 */
export class Cangjian extends BaseUnit {
    static displayName = '藏剑弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cangjian');
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

            const details = worldManager.getUnitBlueprint('cangjian');
            this.executeBurstAttack({
                count: details.burstCount || 3,
                interval: 250,
                damage: this.attackDamage,
                isAOE: true,
                aoeRadius: this.attackRange,
                vfxName: 'cangjian_whirlwind',
                soundName: 'attack_melee',
                noLunge: true
            });
        }
    }
}

// --- 纯阳扩充单位类 ---

export class CYTwinBlade extends BaseUnit {
    static displayName = '双剑剑宗精锐';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cy_twin_blade');
        super({ 
            side, 
            index, 
            type: 'cy_twin_blade', 
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

export class CYSwordArray extends BaseUnit {
    static displayName = '玄门阵法师';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cy_sword_array');
        super({ 
            side, 
            index, 
            type: 'cy_sword_array', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            
            this.executeBurstAttack({
                count: 2,
                interval: 200,
                damage: this.attackDamage / 2,
                projectileType: 'air_sword',
                projectileColor: 0x88ffff,
                projectilePenetration: 2,
                soundName: 'attack_air_sword'
            });
        }
    }
}

export class CYZixiaDisciple extends BaseUnit {
    static displayName = '紫霞功真传弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cy_zixia_disciple');
        super({ 
            side, 
            index, 
            type: 'cy_zixia_disciple', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            
            const stats = worldManager.getUnitBlueprint('cy_zixia_disciple');
            this.executeBurstAttack({
                count: stats.burstCount || 3,
                interval: 150,
                damage: this.attackDamage,
                projectileType: 'air_sword',
                soundName: 'attack_air_sword'
            });
        }
    }
}

export class CYTaixuDisciple extends BaseUnit {
    static displayName = '太虚剑意真传弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cy_taixu_disciple');
        super({ 
            side, 
            index, 
            type: 'cy_taixu_disciple', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.5, force: true });
            
            // 范围横扫
            this.executeAOE(enemies, {
                radius: this.attackRange,
                angle: Math.PI, // 180度
                damage: this.attackDamage,
                knockbackForce: 0.05
            });
            
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('tiance_sweep', { unit: this, radius: this.attackRange, color: 0x00ffff, duration: 200 });
            }
        }
    }
}

// --- 藏剑扩充单位类 ---

export class CJRetainer extends BaseUnit {
    static displayName = '藏剑入门弟子';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cj_retainer');
        super({ 
            side, 
            index, 
            type: 'cj_retainer', 
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

export class CJWenshui extends BaseUnit {
    static displayName = '问水剑客';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cj_wenshui');
        super({ 
            side, 
            index, 
            type: 'cj_wenshui', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            
            const stats = worldManager.getUnitBlueprint('cj_wenshui');
            this.executeBurstAttack({
                count: stats.burstCount || 2,
                interval: 200,
                damage: this.attackDamage,
                soundName: 'attack_melee'
            });
        }
    }
}

export class CJShanju extends BaseUnit {
    static displayName = '山居力士';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cj_shanju');
        super({ 
            side, 
            index, 
            type: 'cj_shanju', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.5, force: true });
            
            // 范围横扫 180度
            this.executeAOE(enemies, {
                radius: this.attackRange,
                angle: Math.PI, 
                damage: this.attackDamage,
                knockbackForce: 0.1
            });
            
            if (window.battle && window.battle.playVFX) {
                window.battle.playVFX('tiance_sweep', { unit: this, radius: this.attackRange, color: 0xffcc00, duration: 250 });
            }
        }
    }
}

export class CJXinjian extends BaseUnit {
    static displayName = '灵峰侍剑师';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cj_xinjian');
        super({ 
            side, 
            index, 
            type: 'cj_xinjian', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_air_sword', { volume: 0.3 });

            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 
                target: this.target, 
                speed: 0.2, 
                damage: this.attackDamage, 
                type: 'air_sword',
                color: 0xffcc00 // 金色剑气
            });
        }
    }
}

export class CJGoldenGuard extends BaseUnit {
    static displayName = '黄金剑卫';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cj_golden_guard');
        super({ 
            side, 
            index, 
            type: 'cj_golden_guard', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost,
            mass: stats.mass || 3.0
        });
        
        // 固有被动：20% 减伤
        modifierManager.addModifier({
            id: `cj_golden_guard_reduction_${this.index}`,
            targetUnit: this,
            stat: 'damage_multiplier',
            multiplier: 0.8,
            source: 'passive'
        });
    }
}

export class CJElder extends BaseUnit {
    static displayName = '剑庐大长老';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cj_elder');
        super({ 
            side, 
            index, 
            type: 'cj_elder', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;

            const stats = worldManager.getUnitBlueprint('cj_elder');
            this.executeBurstAttack({
                count: stats.burstCount || 3,
                interval: 300,
                damage: this.attackDamage,
                isAOE: true,
                aoeRadius: this.attackRange,
                vfxName: 'cangjian_whirlwind',
                soundName: 'attack_melee',
                noLunge: true
            });
        }
    }
}

/**
 * 苍云：肉盾，攻击方式类似近战，走得慢 (第三行第三个)
 */
export class Cangyun extends BaseUnit {
    static displayName = '苍云将士';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('cangyun');
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
        const stats = worldManager.getUnitBlueprint('tiance');
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
        const stats = worldManager.getUnitBlueprint('chunyang');
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
                this._baseAttackRange = this.meleeAttackRange;
            } else {
                this.isMeleeMode = false;
                this._baseAttackRange = this.remoteAttackRange;
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
                // 核心修复：使用修正后的 attackRange (Point 1)
                window.battle.playVFX('tiance_sweep', { unit: this, radius: this.attackRange, color: 0x00ffff, duration: 200 });
                this.executeAOE(enemies, { radius: this.attackRange, angle: Math.PI * 2/3, damage: this.attackDamage * (m.atk/this.statsData.modes.chunyang_remote.atk), knockbackForce: 0.03 });
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

// --- 天策扩充势力类 ---

export class TCCrossbow extends BaseUnit {
    static displayName = '天策羽林弩手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_crossbow');
        super({ 
            side, 
            index, 
            type: 'tc_crossbow', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_arrow', { volume: 0.4 });

            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 
                target: this.target, 
                speed: 0.25, 
                damage: this.attackDamage, 
                type: 'arrow',
                scale: 1.2
            });
        }
    }
}

export class TCBanner extends BaseUnit {
    static displayName = '天策战旗使';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_banner');
        super({ 
            side, 
            index, 
            type: 'tc_banner', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
        
        this.lastBuffTime = 0;
        this.buffInterval = 3000;
    }

    updateAI(enemies, allies, deltaTime) {
        super.updateAI(enemies, allies, deltaTime);
        
        const now = Date.now();
        if (now - this.lastBuffTime > this.buffInterval) {
            this.lastBuffTime = now;
            // 激励光环：提升 8 米内友军 15% 攻速
            if (window.battle) {
                const affectedAllies = allies.filter(a => !a.isDead && a.position.distanceTo(this.position) < 8.0);
                window.battle.applyBuffToUnits(affectedAllies, {
                    stat: 'attackSpeed',
                    multiplier: 1.15,
                    duration: 3000,
                    color: 0xffaa00,
                    vfxName: 'vfx_sparkle'
                });
            }
        }
    }
}

export class TCDualBlade extends BaseUnit {
    static displayName = '天策双刃校尉';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_dual_blade');
        super({ 
            side, 
            index, 
            type: 'tc_dual_blade', 
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
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.executeBurstAttack({
                count: 2,
                interval: 150,
                damage: this.attackDamage,
                soundName: 'attack_melee'
            });
        }
    }
}

export class TCHalberdier extends BaseUnit {
    static displayName = '持戟中郎将';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_halberdier');
        super({ 
            side, 
            index, 
            type: 'tc_halberdier', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.4 });
            
            // AOE 横扫：伤害范围内所有目标
            this.executeAOE(enemies, {
                radius: 2.8,
                damage: this.attackDamage,
                knockback: 0.15
            });
        }
    }
}

export class TCShieldVanguard extends BaseUnit {
    static displayName = '天策前锋';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_shield_vanguard');
        super({ 
            side, 
            index, 
            type: 'tc_shield_vanguard', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost,
            mass: 3.0
        });
    }
}

export class TCMountedCrossbow extends BaseUnit {
    static displayName = '骁骑弩手';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_mounted_crossbow');
        super({ 
            side, 
            index, 
            type: 'tc_mounted_crossbow', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime && this.target) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_arrow', { volume: 0.3 });

            this.projectileManager?.spawn({ 
                startPos: this.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 
                target: this.target, 
                speed: 0.22, 
                damage: this.attackDamage, 
                type: 'arrow',
                penetration: 3 // 新增：3次穿透属性
            });
        }
    }
}

export class TCHeavyCavalry extends BaseUnit {
    static displayName = '玄甲陷阵骑';
    constructor(side, index, projectileManager) {
        const stats = worldManager.getUnitBlueprint('tc_heavy_cavalry');
        super({ 
            side, 
            index, 
            type: 'tc_heavy_cavalry', 
            hp: stats.hp,
            speed: stats.speed,
            attackRange: stats.range,
            attackDamage: stats.atk,
            attackSpeed: stats.attackSpeed,
            projectileManager,
            cost: stats.cost,
            mass: 5.0
        });
    }

    performAttack(enemies) {
        const now = Date.now();
        if (now - this.lastAttackTime > this.attackCooldownTime) {
            this.lastAttackTime = now;
            this.onAttackAnimation();
            audioManager.play('attack_melee', { volume: 0.6 });
            
            // 强力冲锋横扫：伤害范围内所有目标
            this.executeAOE(enemies, {
                radius: 2.2,
                damage: this.attackDamage,
                knockback: 0.4
            });
        }
    }
}




