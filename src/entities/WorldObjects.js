import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { worldManager } from '../core/WorldManager.js';
import { timeManager } from '../core/TimeManager.js';
import { mapGenerator } from '../core/MapGenerator.js';
import { Pathfinder } from '../core/Pathfinder.js';
import { audioManager } from '../core/AudioManager.js';
import { AIController } from '../core/AIController.js';

/**
 * 大世界物体的基类
 */
export class WorldObject {
    constructor(data) {
        this.id = data.id;
        this.type = data.type;
        this.x = data.x;
        this.z = data.z;
        this.config = data.config || {};
        
        this.mesh = null; // 视觉主体 (可以是 Sprite 或 Group)
        this.isInteractable = false;
        this.interactionRadius = 1.0;
    }

    /**
     * 创建视觉对象并添加到场景
     */
    spawn(scene) {
        this.mesh = this.createMesh();
        if (this.mesh) {
            // 核心修复：仅在大世界物体生成时，同步配置缩放
            if (this.mesh instanceof THREE.Sprite) {
                // 优雅同步：在 spawn 时直接获取配置缩放
                const spriteKey = this.mesh.userData.spriteKey || this.type;
                const config = spriteFactory.unitConfig[spriteKey];
                if (config && config.scale) {
                    this.baseScale = config.scale;
                }
            } else if (this.mesh instanceof THREE.Group) {
                const sprite = this.mesh.children.find(c => c instanceof THREE.Sprite && c.name !== 'shadow');
                if (sprite) {
                    const spriteKey = sprite.userData.spriteKey || this.type;
                    const config = spriteFactory.unitConfig[spriteKey];
                    if (config && config.scale) {
                        this.baseScale = config.scale;
                    }
                }
            }
            this.mesh.position.set(this.x, this.getElevation(), this.z);
            scene.add(this.mesh);
        }
    }

    createMesh() {
        // 子类实现具体创建逻辑，默认创建一个占位符或根据 type 创建
        return null;
    }

    getElevation() {
        // 核心改动：既然实现了自动脚底探测，所有物体都在 position.y = 0 处对齐
        // 视觉偏移已由 SpriteFactory.getFeetAnchor 解决
        return 0;
    }

    /**
     * 每帧更新
     */
    update(deltaTime, playerPos) {
        // 子类可以实现逻辑
    }

    /**
     * 统一交互入口
     * @param {WorldScene} worldScene 场景引用
     * @param {string} actorSide 发起者阵营 (默认 player)
     */
    onInteract(worldScene, actorSide = 'player') {
        const isPlayer = actorSide === 'player';
        
        // 1. 核心：调用 WorldManager 执行数值和所有权逻辑
        // 这一步会触发 entity-logic-removed 事件，WorldScene 会自动清理模型
        const success = worldManager.interactWithEntity(this.id, actorSide);
        
        return success;
    }

    /**
     * 检查是否可以交互
     */
    canInteract(playerPos) {
        if (!this.isInteractable || !this.mesh) return false;
        const dist = playerPos.distanceTo(this.mesh.position);
        return dist < this.interactionRadius;
    }

    removeFromScene(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
        }
    }

    /**
     * 获取浮动框信息
     */
    getTooltipData() {
        return null; // 默认不显示
    }
}

/**
 * 可移动大世界物体的基类 (服务于主角和敌人)
 */
export class MovableWorldObject extends WorldObject {
    constructor(data) {
        super(data);
        this.currentPath = [];
        this.moveSpeed = data.moveSpeed || 4.0;
        this.moveAnimTime = 0;
        this.lastPos = new THREE.Vector3(this.x, 0, this.z);
        this.isMoving = false;
        this.manualMoveDir = null; // 新增：用于接收外部手动移动指令
        
        // 视觉组件参考
        this.mainSprite = null; // 真正的角色 Sprite
        this.shadow = null;     // 影子 (如果有)
        this.baseScale = data.baseScale || 1.4;
        
        this.footstepTimer = 0;
        this.footstepInterval = 650;
        
        // --- 过程动画参数化 (允许子类覆盖) ---
        this.animStepDistance = 3.5;      // 步长：越小晃得越快
        this.animMaxStepsPerSecond = 3.5; // 频率封顶
        
        this._pathfinder = null;
    }

    get pathfinder() {
        if (!this._pathfinder && mapGenerator.grid.length > 0) {
            this._pathfinder = new Pathfinder(mapGenerator.grid, mapGenerator.size);
        }
        return this._pathfinder;
    }

    /**
     * 设置目的地并寻路
     */
    moveTo(targetX, targetZ) {
        if (!this.pathfinder) return;

        // 记录最终目的地，用于处理长距离分段寻路
        this.finalTargetX = targetX;
        this.finalTargetZ = targetZ;

        // 性能优化：如果目标点几乎没有变化，且当前已有路径，则不需要重新计算
        if (this.currentPath && this.currentPath.length > 0) {
            const finalTarget = this.currentPath[this.currentPath.length - 1];
            const dx = targetX - finalTarget.x;
            const dz = targetZ - finalTarget.z;
            if (dx * dx + dz * dz < 0.25) return; 
        }
        
        const halfSize = mapGenerator.size / 2;
        const start = {
            x: Math.round(this.mesh.position.x + halfSize),
            z: Math.round(this.mesh.position.z + halfSize)
        };
        const end = {
            x: Math.round(targetX + halfSize),
            z: Math.round(targetZ + halfSize)
        };
        
        // 增加异步感知：对于极长距离，Pathfinder 现在会返回部分路径 (5000次迭代截断)
        const path = this.pathfinder.findPath(start, end);
        if (path && path.length > 0) {
            this.currentPath = path.map(p => ({
                x: p.x - halfSize,
                z: p.z - halfSize
            }));
        } else {
            this.currentPath = [];
        }
    }

    /**
     * 重写高度补偿：可移动物体自带阴影，Group 节点必须贴地 (y=0)
     */
    getElevation() {
        return 0;
    }

    /**
     * 创建标准化的阴影 Mesh
     * 解决穿模、渲染层级和缩放一致性问题
     */
    _createStandardShadow() {
        const shadowGeom = new THREE.CircleGeometry(0.35, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.3,
            depthWrite: false, // 核心：关闭深度写入，防止与地面闪烁
        });
        const shadow = new THREE.Mesh(shadowGeom, shadowMat);
        shadow.name = 'shadow';
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01; // 极小偏移即可，不再需要 0.05
        shadow.renderOrder = -1;  // 核心：确保在角色本体之前渲染，永远在脚下
        return shadow;
    }

    /**
     * 执行移动与动画更新
     */
    update(deltaTime, playerPos = null) {
        if (!this.mesh) return;
        
        let moveDir = new THREE.Vector3(0, 0, 0);
        this.isMoving = false;

        // 1. 优先处理手动移动 (通常来自玩家键盘，通过外部设置 manualMoveDir 属性)
        if (this.manualMoveDir && this.manualMoveDir.lengthSq() > 0) {
            this.isMoving = true;
            moveDir.copy(this.manualMoveDir);
            this.currentPath = []; // 手动移动打断寻路
        } 
        // 2. 其次处理路径跟踪
        else if (this.currentPath && this.currentPath.length > 0) {
            this.isMoving = true;
            const target = this.currentPath[0];
            const dx = target.x - this.mesh.position.x;
            const dz = target.z - this.mesh.position.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < 0.15) {
                this.currentPath.shift();
                if (this.currentPath.length === 0) {
                    // 如果路径走完了，但还没到最终目的地 (可能是因为之前是部分寻路)，则重新触发寻路
                    if (this.finalTargetX !== undefined && this.finalTargetZ !== undefined) {
                        const dxFinal = this.finalTargetX - this.mesh.position.x;
                        const dzFinal = this.finalTargetZ - this.mesh.position.z;
                        if (dxFinal * dxFinal + dzFinal * dzFinal > 1.0) {
                            this.moveTo(this.finalTargetX, this.finalTargetZ);
                        } else {
                            this.isMoving = false;
                        }
                    } else {
                        this.isMoving = false;
                    }
                } else {
                    const next = this.currentPath[0];
                    moveDir.set(next.x - this.mesh.position.x, 0, next.z - this.mesh.position.z).normalize();
                }
            } else {
                moveDir.set(dx, 0, dz).normalize();
            }
        }

        // 3. 执行物理位移
        if (this.isMoving && moveDir.lengthSq() > 0) {
            const moveStep = this.moveSpeed * deltaTime;
            const nextPos = this.mesh.position.clone().addScaledVector(moveDir, moveStep);
            
            // 严格物理碰撞检测
            if (mapGenerator.isPassable(nextPos.x, nextPos.z, 0.25)) {
                this.mesh.position.copy(nextPos);
            } else {
                // 撞墙即停止：玩家手动移动或 AI 寻路均适用
                // 对于 AI，清空路径防止持续撞墙；对于玩家，单纯停止位移
                if (!this.manualMoveDir) {
                    this.currentPath = [];
                }
                this.isMoving = false;
            }
            
            this.x = this.mesh.position.x;
            this.z = this.mesh.position.z;
        }

        // 4. 视觉表现更新
        this._updateVisuals(deltaTime, moveDir);
        
        this.lastPos.copy(this.mesh.position);
    }

    _updateVisuals(deltaTime, moveDir) {
        // 寻找主体 Sprite
        if (!this.mainSprite) {
            if (this.mesh instanceof THREE.Sprite) {
                this.mainSprite = this.mesh;
            } else if (this.mesh instanceof THREE.Group) {
                this.mainSprite = this.mesh.children.find(c => c instanceof THREE.Sprite && c.name !== 'shadow');
                this.shadow = this.mesh.children.find(c => c.name === 'shadow');
            }
        }
        
        if (!this.mainSprite) return;

        const sprite = this.mainSprite;
        const texture = sprite.material.map;
        
        // 核心修复：优先从 mesh 上的 userData 获取真实 spriteKey
        // 如果没有，再从 config 获取，最后才是 type
        const spriteKey = sprite.userData.spriteKey || this.config.spriteKey || this.type;
        const config = spriteFactory.unitConfig[spriteKey] || { col: 1 };
        
        // 核心方案：由于 SpriteFactory 已经自动将中心点（Pivot）对齐到了脚底像素，
        // 这里的视觉基础 y 始终为 0 即可实现完美对齐且不滑步。
        const baseVisualY = 0; 

        if (this.isMoving) {
            const distanceMoved = this.mesh.position.distanceTo(this.lastPos);
            
            // 使用实例属性而非硬编码
            const stepDistance = this.animStepDistance; 
            const maxStepsPerSecond = this.animMaxStepsPerSecond; 
            
            const deltaAnim = (distanceMoved / stepDistance) * Math.PI;
            const maxDelta = (maxStepsPerSecond * Math.PI) * deltaTime;
            const finalDelta = Math.min(deltaAnim, maxDelta);
            
            this.moveAnimTime += finalDelta;

            // 跳动
            const bob = Math.abs(Math.sin(this.moveAnimTime));
            sprite.position.y = baseVisualY + bob * 0.12;

            // 挤压伸展
            const stretch = 1 + bob * 0.06;
            const squash = 1 - bob * 0.03;
            sprite.scale.set(this.baseScale * squash, this.baseScale * stretch, 1);

            // 影子表现
            if (this.shadow) {
                const bobScale = 1 - bob * 0.2;
                // 核心修复：阴影缩放需乘以基准缩放 baseScale，确保大体型单位阴影也大
                const finalShadowScale = this.baseScale * bobScale;
                this.shadow.scale.set(finalShadowScale, finalShadowScale, 1);
                this.shadow.material.opacity = 0.3 * bobScale;
            }

            // 倾斜
            const tilt = moveDir.x * -0.08;
            sprite.rotation.z = THREE.MathUtils.lerp(sprite.rotation.z, tilt, 0.1);

            // 翻转
            if (moveDir.x !== 0 && texture) {
                const defaultFacing = config.defaultFacing || 'right';
                const isMovingLeft = moveDir.x < 0;
                let shouldFlip = isMovingLeft ? (defaultFacing === 'right') : (defaultFacing === 'left');
                const standardRepeatX = 1 / 4;
                const flippedRepeatX = -1 / 4;
                const targetRepeatX = shouldFlip ? flippedRepeatX : standardRepeatX;
                
                if (texture.repeat.x !== targetRepeatX) {
                    texture.repeat.x = targetRepeatX;
                    texture.offset.x = shouldFlip ? (config.col / 4) : ((config.col - 1) / 4);
                }
            }
        } else {
            // 停止时的状态恢复
            this.moveAnimTime = 0;
            sprite.position.y = THREE.MathUtils.lerp(sprite.position.y, baseVisualY, 0.2);
            sprite.rotation.z = THREE.MathUtils.lerp(sprite.rotation.z, 0, 0.2);
            const breath = Math.sin(Date.now() * 0.003) * 0.02;
            sprite.scale.set(this.baseScale * (1 - breath), this.baseScale * (1 + breath), 1);
            
            if (this.shadow) {
                this.shadow.scale.x = THREE.MathUtils.lerp(this.shadow.scale.x, this.baseScale, 0.2);
                this.shadow.scale.y = THREE.MathUtils.lerp(this.shadow.scale.y, this.baseScale, 0.2);
                this.shadow.material.opacity = THREE.MathUtils.lerp(this.shadow.material.opacity, 0.3, 0.2);
            }
        }
    }
}

/**
 * 装饰性物体（不可交互，如树木、草丛）
 */
export class DecorationObject extends WorldObject {
    constructor(data) {
        super(data);
        this.spriteKey = data.spriteKey;
        this.isInteractable = false;
    }

    createMesh() {
        return spriteFactory.createUnitSprite(this.spriteKey);
    }
}

/**
 * 砍树物体
 */
export class TreeObject extends WorldObject {
    constructor(data) {
        super(data);
        this.spriteKey = data.spriteKey || 'tree';
        this.durability = Math.floor(Math.random() * 6) + 13; // 13-18 下耐久
        this.chopCount = 0;
        this.chopTimer = 0;
        this.chopCooldown = 800; // 0.8s 砍一下
        this.shakeTime = 0;
        this.mainSprite = null;
        
        // 核心修复：必须设置为可交互，否则 WorldScene 不会将其加入更新循环
        this.isInteractable = true;
        this.interactionRadius = 0.5; // 减小触发半径，防止干扰自动砍伐逻辑
    }

    createMesh() {
        const group = new THREE.Group();
        const sprite = spriteFactory.createUnitSprite(this.spriteKey);
        this.mainSprite = sprite;
        
        group.add(sprite);
        return group;
    }

    getTooltipData() {
        // 获取当前全局木材收益倍率 (仅包含可能的奇穴加成)
        const currentMult = modifierManager.getModifiedValue({ side: 'player' }, 'wood_income', 1);
        // 估算总收益：(剩余耐久度 / 3 * 20) + 40 (砍断奖励)
        const estimatedTotal = Math.floor(((this.durability / 3) * 20 + 40) * currentMult);
        
        return {
            name: '树木',
            level: '可采集',
            maxLevel: `约 ${estimatedTotal} 份木材`,
            description: `靠近后自动砍伐。砍断树木可获得额外惊喜奖励。`
        };
    }

    update(deltaTime, playerPos) {
        if (!this.mesh || !playerPos || this.durability <= 0) return;

        // 寻找主体 Sprite (如果还没找到)
        if (!this.mainSprite) {
            if (this.mesh instanceof THREE.Sprite) {
                this.mainSprite = this.mesh;
            } else if (this.mesh instanceof THREE.Group) {
                this.mainSprite = this.mesh.children.find(c => c instanceof THREE.Sprite);
            }
        }

        // 自动砍树逻辑：距离检测
        const dist = playerPos.distanceTo(this.mesh.position);
        const chopRadius = 1.3; // 稍微大一点，提高体验

        if (dist < chopRadius) {
            if (this.chopTimer <= 0) {
                this.chop();
                this.chopTimer = this.chopCooldown;
            }
        }
        
        if (this.chopTimer > 0) {
            this.chopTimer -= deltaTime * 1000;
        }

        // 抖动动画逻辑
        if (this.shakeTime > 0) {
            this.shakeTime -= deltaTime * 1000;
            const intensity = 0.12;
            if (this.mainSprite) {
                this.mainSprite.position.x = (Math.random() - 0.5) * intensity;
            }
        } else if (this.mainSprite) {
            this.mainSprite.position.x = 0;
        }
    }

    chop() {
        if (this.durability <= 0) return; // 再次确保安全
        
        this.durability--;
        this.chopCount++;
        this.shakeTime = 300; // 抖动 0.3s
        
        // 耐久耗尽逻辑
        if (this.durability <= 0) {
            // 播放砍断音效
            audioManager.play('farm_tree_down', { volume: 0.8 });

            // 核心修改：砍断树木直接获得 30-50 木材
            const baseFinalAmount = Math.floor(Math.random() * 21) + 30; // 30-50 随机
            const finalAmount = Math.floor(modifierManager.getModifiedValue({ side: 'player' }, 'wood_income', baseFinalAmount));
            worldManager.addWood(finalAmount);
            worldManager.showNotification(`树木倒下了！额外获得 🪵${finalAmount}`);
            
            worldManager.removeEntity(this.id);
            // 核心修复：确保从场景中彻底消失
            if (this.mesh) {
                if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            }
            // 立即触发全图实体的视觉同步
            window.dispatchEvent(new CustomEvent('map-entities-updated'));
        } else {
            // 还没断，播放普通砍树音效 (1, 2 随机由 AudioManager 处理)
            audioManager.play('farm_chop', { volume: 0.6, pitchVar: 0.2 });
        }

        // 每砍三下获得随机木材，并随季度增长
        if (this.chopCount % 3 === 0 && this.durability > 0) {
            // 核心修改：降低每三下的收益为 15-25
            const baseAmount = Math.floor(Math.random() * 11) + 15; // 15-25 随机
            
            // 接入全局资源成长系统：使用 ModifierManager 计算最终收益
            const finalAmount = Math.floor(modifierManager.getModifiedValue({ side: 'player' }, 'wood_income', baseAmount));
            
            worldManager.addWood(finalAmount);
        }
    }
}

/**
 * 可捡起物体（如金币、木材）
 */
export class PickupObject extends WorldObject {
    constructor(data) {
        super(data);
        this.pickupType = data.pickupType;
        this.isInteractable = true;
        this.interactionRadius = 1.2;
    }

    createMesh() {
        return spriteFactory.createUnitSprite(this.pickupType);
    }

    onInteract(worldScene, actorSide = 'player') {
        // 调用父类的统一逻辑
        const success = super.onInteract(worldScene, actorSide);
        return success; // 拾取类物体需要返回 true 告知场景移除交互监听
    }

    getTooltipData() {
        const names = {
            'gold_pile': '金币堆',
            'chest': '宝箱',
            'wood_pile': '木材堆'
        };
        return {
            name: names[this.pickupType] || '未知物品',
            level: '类别',
            maxLevel: '可收集资源'
        };
    }
}

/**
 * 敌人组物体
 */
export class EnemyGroupObject extends MovableWorldObject {
    constructor(data) {
        super(data);
        this.templateId = data.templateId;
        this.isInteractable = true;
        this.interactionRadius = 1.0;
        
        // --- 速度配置 ---
        this.speedWander = 1.5;
        this.speedChase = 3.5;
        this.speedReturn = 2.5;
        this.moveSpeed = this.speedWander; // 初始为徘徊速度

        // --- 行为状态机相关 ---
        this.spawnX = data.spawnX !== undefined ? data.spawnX : this.x;
        this.spawnZ = data.spawnZ !== undefined ? data.spawnZ : this.z;
        this.territoryRadius = 8; // 徘徊半径
        this.aggroRadius = 3;      // 静态感应半径 (降低到 3 米，玩家需要更近才被发现)
        this.leashRadius = 10;     // 动态追杀半径 (玩家跑出 10 米才拉脱)
        
        // --- 独立动画修正 ---
        this.animStepDistance = 0.8; // 降低步长，增加晃动频率
        
        this.state = 'IDLE'; // IDLE, WANDER, CHASE, RETURN
        this.idleTimer = 0;
        this.nextWanderTime = Math.random() * 3000 + 2000;
        this.chaseUpdateTimer = 0; // 降低追逐时的路径更新频率

        // --- 视觉表情组件 ---
        this.emoteSprite = null;
    }

    /**
     * 显示像素风格的表情气泡
     * @param {'exclamation' | 'question'} type 类型
     */
    _showEmote(type) {
        if (this.emoteSprite) {
            this.mesh.remove(this.emoteSprite);
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // 绘制逻辑
        if (type === 'exclamation') {
            // 感叹号 (!) - 回归 8px 粗细，适配缩小后的图标
            ctx.fillStyle = '#ff4400';
            ctx.fillRect(28, 8, 8, 32); 
            ctx.fillRect(28, 48, 8, 8);
        } else {
            // 问号 (?) - 同步回归
            ctx.fillStyle = '#00ccff';
            ctx.fillRect(22, 8, 20, 8);
            ctx.fillRect(38, 16, 8, 16);
            ctx.fillRect(30, 28, 12, 8);
            ctx.fillRect(30, 48, 8, 8);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        
        this.emoteSprite = new THREE.Sprite(material);
        this.emoteSprite.renderOrder = 9999;
        
        // --- 核心修复：基于局部坐标系的“头顶锚定”方案 ---
        // 1. 图标大小：设定为 0.6 (缩小一半，使其更加精致)
        const localIconSize = 0.6; 
        this.emoteSprite.scale.set(localIconSize, localIconSize, 1);
        
        // 2. 视觉高度偏移：锁定在局部坐标 1.2 处
        // 算法：0.9 (头顶高度基准) + 0.3 (图标半径) = 1.2，确保图标底部精准踩在头顶
        const localVisualHeight = 1.2; 
        
        // 3. 应用零畸变 Trick：
        // 这里的公式会自动处理 3D 深度偏移，让 UI 永远置顶且不位移
        this.emoteSprite.center.y = 0.5 - (localVisualHeight / localIconSize);
        this.emoteSprite.position.set(0, 0, 0); 
        
        this.mesh.add(this.emoteSprite);

        // 3秒后自动消失
        setTimeout(() => {
            if (this.emoteSprite && this.emoteSprite.parent) {
                this.mesh.remove(this.emoteSprite);
                this.emoteSprite = null;
            }
        }, 3000);
    }

    update(deltaTime, playerPos) {
        if (!this.mesh) return;

        // 1. 调用基类的物理移动与视觉更新 (先更新位移状态)
        super.update(deltaTime, playerPos);

        // 2. 核心状态逻辑 (根据更新后的位移状态决定下一步)
        this._updateState(deltaTime, playerPos);
    }

    /**
     * 内部状态机更新
     */
    _updateState(deltaTime, playerPos) {
        // 核心修复：使用 mesh 的真实坐标计算距离
        const currentX = this.mesh.position.x;
        const currentZ = this.mesh.position.z;

        const distToSpawn = Math.sqrt(Math.pow(currentX - this.spawnX, 2) + Math.pow(currentZ - this.spawnZ, 2));
        let distToPlayer = Infinity;
        if (playerPos) {
            distToPlayer = Math.sqrt(Math.pow(currentX - playerPos.x, 2) + Math.pow(currentZ - playerPos.z, 2));
        }

        switch (this.state) {
            case 'IDLE':
                this.moveSpeed = this.speedWander; // 确保速度正确
                if (distToPlayer < this.aggroRadius) {
                    console.log(`%c[AI] 敌人 ${this.id} 发现玩家，开始追逐!`, "color: #ff4444");
                    this.state = 'CHASE';
                    this.moveSpeed = this.speedChase; // 发现瞬间提速
                    this._showEmote('exclamation'); // 触发感叹号
                    break;
                }
                this.idleTimer += deltaTime * 1000;
                if (this.idleTimer >= this.nextWanderTime) {
                    this._startWandering();
                }
                break;

            case 'WANDER':
                this.moveSpeed = this.speedWander; // 保持慢速徘徊
                if (distToPlayer < this.aggroRadius) {
                    this.state = 'CHASE';
                    this.moveSpeed = this.speedChase; // 追杀提速
                    this._showEmote('exclamation'); // 触发感叹号
                    break;
                }
                // 只有当路径为空且确实不在移动时，才回到闲置
                if (this.currentPath.length === 0 && !this.isMoving) {
                    this.state = 'IDLE';
                    this.idleTimer = 0;
                    this.nextWanderTime = Math.random() * 5000 + 3000;
                }
                break;

            case 'CHASE':
                this.moveSpeed = this.speedChase; // 保持追击高移速
                // 核心重构：现在完全移除“领地限制”，敌人是否放弃完全依赖于“拉脱距离”
                // 只要玩家没有跑出 10 米开外，敌人就会一直追下去
                if (distToPlayer > this.leashRadius) {
                    console.log(`%c[AI] 敌人 ${this.id} 目标丢失 (拉开 10 米拉脱)，放弃追逐`, "color: #aaaaaa");
                    this.state = 'RETURN';
                    this.moveSpeed = this.speedReturn; // 归巢中速
                    this._showEmote('question'); // 触发问号
                    this.moveTo(this.spawnX, this.spawnZ);
                    break;
                }

                this.chaseUpdateTimer += deltaTime * 1000;
                if (this.chaseUpdateTimer >= 800) { // 稍微降低频率
                    this.chaseUpdateTimer = 0;
                    this.moveTo(playerPos.x, playerPos.z);
                }
                break;

            case 'RETURN':
                this.moveSpeed = this.speedReturn; // 归巢中速
                // 核心修复：归巢途中如果再次发现玩家，立即重新切回追击状态
                if (distToPlayer < this.aggroRadius) {
                    console.log(`%c[AI] 敌人 ${this.id} 在归巢途中再次发现玩家!`, "color: #ff4444");
                    this.state = 'CHASE';
                    this.moveSpeed = this.speedChase; // 再次发现立即提速
                    this._showEmote('exclamation'); // 再次弹出感叹号
                    this.chaseUpdateTimer = 800; // 立即触发一次寻路更新
                    break;
                }

                if (this.currentPath.length === 0 && !this.isMoving || distToSpawn < 1.5) {
                    this.state = 'IDLE';
                    this.moveSpeed = this.speedWander; // 回到闲置速度
                    this.idleTimer = 0;
                }
                break;
        }
    }

    /**
     * 在领地内随机寻找一个点开始徘徊
     */
    _startWandering() {
        // 在领地圆圈内随机采样
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * this.territoryRadius;
        const tx = this.spawnX + Math.cos(angle) * radius;
        const tz = this.spawnZ + Math.sin(angle) * radius;

        // 调用 moveTo
        this.moveTo(tx, tz);
        
        if (this.currentPath.length > 0) {
            this.state = 'WANDER';
            // console.log(`%c[AI] 敌人 ${this.id} 开始徘徊`, "color: #44aa44");
        } else {
            this.state = 'IDLE';
            this.idleTimer = 0;
            this.nextWanderTime = 500; // 寻路失败，尽快尝试下一次
        }
    }

    createMesh() {
        const template = worldManager.enemyTemplates[this.templateId || 'bandits'];
        const icon = template ? template.overworldIcon : 'bandit';
        
        const group = new THREE.Group();
        
        // 统一添加阴影
        const shadow = this._createStandardShadow();
        group.add(shadow);
        
        // 创建精灵：自动探测脚底
        const sprite = spriteFactory.createUnitSprite(icon);
        const config = spriteFactory.unitConfig[icon] || { scale: 1.4 };
        this.baseScale = config.scale || 1.4;
        
        sprite.scale.set(this.baseScale, this.baseScale, 1);
        sprite.position.y = 0; // 脚底贴地
        
        // 同步阴影缩放
        shadow.scale.set(this.baseScale, this.baseScale, 1);
        
        group.add(sprite);
        
        this.mainSprite = sprite;
        this.shadow = shadow;
        
        return group;
    }

    onInteract(worldScene) {
        // 核心修复：防止重复触发对话框 (特别是玩家不动时)
        if (worldManager.mapState.pendingBattleEnemyId) return false;
        
        worldManager.mapState.pendingBattleEnemyId = this.id;
        
        // 克隆配置并应用随时间增长的战力缩放
        const scaledPoints = Math.floor((this.config.totalPoints || 0) * timeManager.getPowerMultiplier());
        const scaledConfig = {
            ...this.config,
            totalPoints: scaledPoints
        };

        const playerPower = worldManager.getPlayerTotalPower();
        const ratio = playerPower / scaledPoints;

        // 如果难度为“简单” (ratio > 1.5)，弹出跳过确认
        if (ratio > 1.5) {
            worldScene.showSkipBattleDialog(scaledConfig, scaledPoints, 
                // 取消：正常开战
                () => {
                    this._startBattle(worldScene, scaledConfig);
                },
                // 确认：直接结算
                () => {
                    const result = worldManager.simulateSimpleBattle(scaledConfig, scaledPoints);
                    worldScene.showSimpleSettlement(result);
                }
            );
            return false;
        }

        return this._startBattle(worldScene, scaledConfig);
    }

    /**
     * 内部方法：执行正常的开战流程
     */
    _startBattle(worldScene, scaledConfig) {
        window.dispatchEvent(new CustomEvent('start-battle', { detail: scaledConfig }));
        worldScene.stop();
        return false;
    }

    getTooltipData() {
        const template = worldManager.enemyTemplates[this.templateId || 'bandits'];
        const scaledPoints = Math.floor((this.config.totalPoints || 0) * timeManager.getPowerMultiplier());
        const playerPower = worldManager.getPlayerTotalPower();
        
        let difficulty = '地狱';
        let color = '#ff0000';
        
        const ratio = playerPower / scaledPoints;
        if (ratio > 1.5) {
            difficulty = '简单';
            color = '#00ff00';
        } else if (ratio >= 1.1) {
            difficulty = '普通';
            color = '#ffff00';
        } else if (ratio >= 0.8) {
            difficulty = '稍难';
            color = '#d4af37'; // 武侠金
        } else if (ratio >= 0.5) {
            difficulty = '困难';
            color = '#ffaa00';
        }

        return {
            name: template ? template.name : '未知敌人',
            level: '预计难度',
            maxLevel: difficulty,
            color: color
        };
    }
}

/**
 * 城市/城镇物体
 */
export class CityObject extends WorldObject {
    constructor(data) {
        super(data);
        this.isInteractable = true;
        this.interactionRadius = 2.1; // 从 3.0 缩小 30% 至 2.1
    }

    createMesh() {
        return spriteFactory.createUnitSprite('main_city');
    }

    getElevation() {
        return 0; // 城市贴地
    }

    onInteract(worldScene) {
        const cityData = worldManager.cities[this.id];
        if (!cityData) return false;

        if (cityData.owner === 'player') {
            // 访问自己的城市：补满侠客状态 (内力和气血)
            const hero = worldManager.heroData;
            if (hero.mpCurrent < hero.mpMax || hero.hpCurrent < hero.hpMax) {
                worldManager.modifyHeroMana(hero.mpMax);
                worldManager.modifyHeroHealth(hero.hpMax);
                worldManager.showNotification(`回到 ${cityData.name}，侠客状态已补满`);
                window.dispatchEvent(new CustomEvent('hero-stats-changed'));
            }

            // 核心修复：即使面板已经打开（可能是远程打开的），也要更新为“亲自访问”状态
            if (worldScene.activeCityId !== this.id || !worldScene.isPhysicalVisit) {
                worldScene.openTownManagement(this.id, true); // 亲自到场访问
                worldScene.activeCityId = this.id;
            }
        } else {
            // 敌方势力主城：触发攻城战
            const faction = worldManager.factions[cityData.owner];
            const heroInfo = worldManager.availableHeroes[faction?.heroId];
            
            worldManager.showNotification(`正在对 ${cityData.name} 发起攻城战！`);
            worldManager.mapState.pendingBattleEnemyId = this.id;

            // 攻城战配置：极高战力，且兵种池固定为该门派
            const siegeConfig = {
                name: `${cityData.name} 守军`,
                // 核心重构：根据主城所属英雄，配置该门派的全系兵种池
                unitPool: this._getSectUnitPool(faction?.heroId),
                // 统一攻城战难度：基础战力由 200 上调至 250，并随时间系数缩放
                totalPoints: Math.floor(250 * timeManager.getPowerMultiplier()), 
                isCitySiege: true, // 标记为攻城战
                cityId: this.id
            };

            window.dispatchEvent(new CustomEvent('start-battle', { detail: siegeConfig }));
            worldScene.stop();
        }
        return false;
    }

    /**
     * 获取对应门派的全系兵种池
     * @param {string} heroId 英雄ID
     */
    _getSectUnitPool(heroId) {
        const pools = {
            'liwangsheng': [
                'chunyang', 'cy_twin_blade', 'cy_sword_array', 
                'cy_zixia_disciple', 'cy_taixu_disciple', 'cy_field_master'
            ],
            'lichengen': [
                'tiance', 'tc_crossbow', 'tc_banner', 'tc_dual_blade', 
                'tc_halberdier', 'tc_shield_vanguard', 'tc_mounted_crossbow', 
                'tc_heavy_cavalry'
            ],
            'yeying': [
                'cangjian', 'cj_retainer', 'cj_wenshui', 'cj_shanju', 
                'cj_xinjian', 'cj_golden_guard', 'cj_elder'
            ]
        };
        return pools[heroId] || ['melee', 'ranged']; // 兜底返回基础兵种
    }

    onExitRange(worldScene) {
        // 核心修复：只有在“亲临访问”的情况下离开才自动关闭
        // 如果是远程通过 HUD 打开的（this.isPhysicalVisit 为 false），则不触发自动关闭
        if (worldScene.activeCityId === this.id && worldScene.isPhysicalVisit) {
            worldScene.closeTownManagement();
            worldScene.closeTeleportMenu(); // 离开城市时，如果开了传送界面也一并关闭
        }
    }

    getTooltipData() {
        const cityData = worldManager.cities[this.id];
        const owner = cityData ? cityData.owner : 'unknown';
        const factionColor = worldManager.getFactionColor(owner);
        
        let ownerName = '未知势力';
        if (owner === 'player') {
            ownerName = '你的领地';
        } else if (worldManager.factions[owner]) {
            ownerName = worldManager.factions[owner].name;
        }

        return {
            name: cityData ? cityData.name : '城镇',
            level: '归属势力',
            maxLevel: ownerName,
            color: factionColor
        };
    }
}

/**
 * 占领建筑（如金矿、锯木厂）
 */
export class CapturedBuildingObject extends WorldObject {
    constructor(data) {
        super(data);
        this.spriteKey = data.spriteKey;
        this.buildingType = data.buildingType;
        this.isInteractable = true;
        this.interactionRadius = 2.0;
    }

    createMesh() {
        return spriteFactory.createUnitSprite(this.spriteKey);
    }

    getElevation() {
        return 0;
    }

    onInteract(worldScene, actorSide = 'player') {
        const isPlayer = actorSide === 'player';
        
        // 核心：调用统一逻辑
        const success = worldManager.interactWithEntity(this.id, actorSide);
        
        // 2. 玩家特有的视觉逻辑：开启传送界面
        if (success && isPlayer && this.buildingType === 'teleport_altar') {
            if (worldScene.activeAltarId !== this.id) {
                worldScene.activeAltarId = this.id;
                setTimeout(() => worldScene.openTeleportMenu(this.id), 100);
            }
        }
        
        // 注意：不再手动调用 removeFromScene，全部交给事件监听器处理
        return false; // 占领类建筑不需要立即从 interactables 移除，因为所有权变了还能继续交互（比如查看）
    }

    onExitRange(worldScene) {
        // 如果是该祭坛开启了传送界面，走远了就自动关闭
        if (this.buildingType === 'teleport_altar' && worldScene.activeAltarId === this.id) {
            worldScene.closeTeleportMenu();
        }
    }

    getTooltipData() {
        const owner = this.config.owner || 'none';
        const ownerFaction = worldManager.factions[owner];
        const ownerName = owner === 'none' ? '无人占领' : (ownerFaction ? ownerFaction.name : '未知势力');
        const factionColor = (owner === 'none') ? '#888888' : worldManager.getFactionColor(owner);
        
        const typeNames = {
            'gold_mine': '金矿',
            'sawmill': '锯木厂',
            'teleport_altar': '神行祭坛'
        };
        const typeName = typeNames[this.buildingType] || '建筑';
        
        return {
            name: typeName,
            level: '当前状态',
            maxLevel: owner === 'none' ? '未激活' : `由 ${ownerName} 占领`,
            color: factionColor
        };
    }
}

/**
 * 主角物体 (封装移动与视觉逻辑)
 */
export class PlayerObject extends MovableWorldObject {
    constructor(data) {
        super(data);
        this.type = 'player';
        this.baseScale = data.baseScale || 1.4;
    }

    /**
     * 绑定 WorldScene 中创建的 Group
     */
    setMesh(group) {
        this.mesh = group;
        // 自动识别子组件
        if (group instanceof THREE.Group) {
            this.mainSprite = group.children.find(c => c instanceof THREE.Sprite && c.name !== 'shadow');
            this.shadow = group.children.find(c => c.name === 'shadow');
        }
    }

    /**
     * 重写动画逻辑，加入足音
     */
    _updateVisuals(deltaTime, moveDir) {
        super._updateVisuals(deltaTime, moveDir);
        
        // 特有的足音逻辑
        if (this.isMoving) {
            if (this.footstepTimer === 0) {
                audioManager.play('footstep_grass', { volume: 0.6, pitchVar: 0.2 });
            }
            this.footstepTimer += deltaTime * 1000;
            if (this.footstepTimer >= this.footstepInterval) {
                this.footstepTimer = 0;
            }
        } else {
            this.footstepTimer = 0;
        }
    }
}

/**
 * AI 英雄物体 (敌方英雄在大世界中的游走)
 */
export class AIHeroObject extends MovableWorldObject {
    constructor(data) {
        super(data);
        this.type = 'ai_hero';
        this.factionId = data.config.factionId;
        this.heroId = data.config.heroId;
        this.isInteractable = true;
        this.interactionRadius = 1.5;
        
        this.moveSpeed = 3.5; // 稍微比玩家慢一点点，或者持平

        // 核心改动：注入大脑
        this.brain = new AIController(this);
    }

    createMesh() {
        const group = new THREE.Group();
        
        // 使用基类标准阴影，解决穿模和缩放问题
        const shadow = this._createStandardShadow();
        group.add(shadow);

        // 创建英雄精灵：自动探测脚底
        const sprite = spriteFactory.createUnitSprite(this.heroId);
        const config = spriteFactory.unitConfig[this.heroId] || { scale: 1.4 };
        this.baseScale = config.scale || 1.4;
        
        sprite.scale.set(this.baseScale, this.baseScale, 1);
        sprite.position.y = 0; // 脚底贴地
        
        // 同步初始阴影缩放
        shadow.scale.set(this.baseScale, this.baseScale, 1);
        
        group.add(sprite);

        this.mainSprite = sprite;
        this.shadow = shadow;

        return group;
    }

    update(deltaTime, playerPos) {
        super.update(deltaTime, playerPos);
        // 让大脑驱动行为
        this.brain.update(deltaTime);
    }

    onInteract(worldScene) {
        console.log(`%c[遭遇] %c与英雄【${this.config.name}】狭路相逢！`, 'color: #ff4444; font-weight: bold', 'color: #fff');
        worldManager.showNotification(`遭遇了敌方英雄：${this.config.name}`);
        return false;
    }

    getTooltipData() {
        const faction = worldManager.factions[this.factionId];
        const factionColor = worldManager.getFactionColor(this.factionId);
        
        return {
            name: this.config.name,
            level: '敌方英雄',
            maxLevel: faction ? faction.name : '未知势力',
            color: factionColor,
            description: '一位正在巡视江湖的敌方侠客。'
        };
    }
}

/**
 * 工厂函数：根据数据类型创建对应的物体实例
 */
export function createWorldObject(data) {
    switch (data.type) {
        case 'city':
            return new CityObject(data);
        case 'enemy_group':
            return new EnemyGroupObject(data);
        case 'ai_hero':
            return new AIHeroObject(data);
        case 'decoration':
            if (data.spriteKey === 'tree') return new TreeObject(data);
            return new DecorationObject(data);
        case 'tree':
            return new TreeObject(data);
        case 'pickup':
            return new PickupObject(data);
        case 'captured_building':
            return new CapturedBuildingObject(data);
        default:
            console.warn(`Unknown world object type: ${data.type}`);
            return new WorldObject(data);
    }
}

