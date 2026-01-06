import * as THREE from 'three';

/**
 * VFXLibrary: 集中管理所有战场视觉特效的底层实现
 * 保持与渲染引擎的直接交互，但不涉及业务逻辑
 */
export class VFXLibrary {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * 内部辅助方法：统一处理材质创建，确保透明材质默认关闭深度写入
     */
    _createMaterial(params, MaterialClass = THREE.MeshBasicMaterial) {
        const mat = new MaterialClass(params);
        if (params.transparent && params.depthWrite === undefined) {
            mat.depthWrite = false;
        }
        return mat;
    }

    /**
     * 【通用头顶 UI Trick】
     * 解决透视畸变：将 3D 坐标锚定在地面(0)，通过 center.y 实现视觉偏移。
         * 支持 Sprite (零畸变) 和 Mesh (普通置顶)
     */
    _applyHeadUITrick(obj, visualHeight) {
        if (!obj) return;
        
        // 使用 traverse 递归处理所有子对象，确保嵌套的 Group 也能正确生效
        obj.traverse(child => {
            if (child.material) {
                child.material.depthTest = false;
                child.material.depthWrite = false;
                child.renderOrder = 9999;
            }

            if (child.isSprite) {
                // 核心：Sprite 专有的 center 偏移，实现 3D 坐标与视觉位置的分离
                const spriteHeight = child.scale.y;
                child.center.y = 0.5 - (visualHeight / spriteHeight);
                child.position.y = 0; // 强制 3D 坐标回归地面，消除视差
            } else if (child !== obj && !child.isGroup) {
                // 对于非 Sprite 的 Mesh，进行物理位置偏移
                child.position.y = visualHeight;
            }
        });
    }

    /**
     * 【内部通用】创建头顶符号特效 (晕/逃等)
     * 实现了文字浮动 + 粒子旋转 + 零畸变 Trick
     */
    _createHeadSymbolVFX(parent, config) {
        const { text, color, starColor, activeKey } = config;
        if (!parent || parent.isDead || parent.userData[activeKey + 'Active']) return;
        parent.userData[activeKey + 'Active'] = true;

        const group = new THREE.Group();
        parent.add(group);

        // 1. 创建文字 Sprite
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black'; ctx.lineWidth = 8;
        ctx.strokeText(text, 64, 64); ctx.fillText(text, 64, 64);
        
        const sprite = new THREE.Sprite(this._createMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }, THREE.SpriteMaterial));
        sprite.scale.set(0.8, 0.8, 1);
        group.add(sprite);

        // 2. 创建环绕的小点 (改用 Sprite 实现零畸变)
        const stars = [];
        for (let i = 0; i < 3; i++) {
            const star = new THREE.Sprite(this._createMaterial({ color: starColor, transparent: true }, THREE.SpriteMaterial));
            star.scale.set(0.1, 0.1, 1);
            group.add(star);
            stars.push({ obj: star, angle: (i / 3) * Math.PI * 2 });
        }

        const startTime = Date.now();
        const anim = () => {
            const isActive = activeKey === 'stun' ? parent.isStunned : parent.isFleeing;
            
            if (isActive && !parent.isDead) {
                const elapsed = Date.now() - startTime;
                const floatY = 1.5 + Math.sin(elapsed * 0.005) * 0.1;
                
                this._applyHeadUITrick(sprite, floatY);
                
                stars.forEach((s, i) => {
                    const curAngle = s.angle + elapsed * (activeKey === 'flee' ? 0.008 : 0.005);
                    s.obj.position.x = Math.cos(curAngle) * 0.4;
                    s.obj.position.z = Math.sin(curAngle) * 0.4;
                    this._applyHeadUITrick(s.obj, floatY + 0.2 + Math.sin(elapsed * 0.01 + i) * 0.05);
                });

                requestAnimationFrame(anim);
            } else {
                parent.remove(group);
                parent.userData[activeKey + 'Active'] = false;
                sprite.material.map.dispose();
                sprite.material.dispose();
                stars.forEach(s => s.obj.material.dispose());
            }
        };
        anim();
    }

    /**
     * 通用粒子系统发射器
     * 支持基于时间的发射、自定义几何体、初始状态和逐帧更新
     */
    createParticleSystem(options) {
        const { 
            pos = new THREE.Vector3(), 
            parent = null, // 新增：支持指定父容器（如单位自身）
            color = 0xffffff, 
            duration = 1000, 
            density = 1,
            spawnRate = 100,
            geometry = null,
            initFn = (p) => {},
            updateFn = (p, progress) => {}
        } = options;

        const actualParent = parent || this.scene;
        const group = new THREE.Group();
        group.position.copy(pos);
        actualParent.add(group);

        const pGeo = geometry || new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const startTime = Date.now();

        const interval = setInterval(() => {
            if (Date.now() - startTime > duration) {
                clearInterval(interval);
                setTimeout(() => {
                    actualParent.remove(group);
                    if (!geometry) pGeo.dispose();
                }, 1500);
                return;
            }

            const count = Math.ceil(2 * density);
            for (let i = 0; i < count; i++) {
                const pMat = this._createMaterial({ color, transparent: true, opacity: 0.8 });
                const p = new THREE.Mesh(pGeo, pMat);
                initFn(p);
                group.add(p);

                const pStart = Date.now();
                const pDur = 500 + Math.random() * 500;
                const anim = () => {
                    const progress = (Date.now() - pStart) / pDur;
                    if (progress < 1) {
                        updateFn(p, progress);
                        requestAnimationFrame(anim);
                    } else {
                        group.remove(p);
                        pMat.dispose();
                    }
                };
                anim();
            }
        }, spawnRate);
    }

    /**
     * 简单的粒子爆发效果 (用于传送、物品掉落等)
     */
    createParticleExplosion(pos, options = {}) {
        const {
            color = 0xffffff,
            particleCount = 20,
            size = 0.2,
            duration = 800,
            speed = 0.1
        } = options;

        const pGeo = new THREE.BoxGeometry(size, size, size);
        const group = new THREE.Group();
        group.position.copy(pos);
        this.scene.add(group);

        for (let i = 0; i < particleCount; i++) {
            const pMat = this._createMaterial({ color, transparent: true, opacity: 1.0 });
            const p = new THREE.Mesh(pGeo, pMat);
            
            // 随机初速度
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            const v = speed * (0.5 + Math.random() * 0.5);
            p.userData.velocity = new THREE.Vector3(
                Math.sin(theta) * Math.cos(phi) * v,
                Math.cos(theta) * v + 0.05, // 稍微向上一点
                Math.sin(theta) * Math.sin(phi) * v
            );

            group.add(p);

            const start = Date.now();
            const anim = () => {
                const elapsed = Date.now() - start;
                const prg = elapsed / duration;

                if (prg < 1) {
                    p.position.add(p.userData.velocity);
                    p.userData.velocity.multiplyScalar(0.96); // 阻力
                    p.rotation.x += 0.1;
                    p.rotation.y += 0.1;
                    pMat.opacity = 1 - prg;
                    p.scale.setScalar(1 - prg * 0.5);
                    requestAnimationFrame(anim);
                } else {
                    group.remove(p);
                    pMat.dispose();
                }
            };
            anim();
        }

        setTimeout(() => {
            this.scene.remove(group);
            pGeo.dispose();
        }, duration + 100);
    }

    createFieldVFX(pos, radius, color, duration) {
        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = 0.02; // 贴近地面
        this.scene.add(group);

        // 1. 创建渐变圆形贴图
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        const c = new THREE.Color(color);
        const rgb = `${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)}`;
        gradient.addColorStop(0, `rgba(${rgb}, 0)`);     // 中心消失，形成中空感
        gradient.addColorStop(0.5, `rgba(${rgb}, 0.2)`); // 中间渐变
        gradient.addColorStop(1, `rgba(${rgb}, 0.5)`);   // 边缘适中，保持优雅
        
        ctx.clearRect(0, 0, 256, 256); // 显式清空，防止残留
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        const fillGeo = new THREE.CircleGeometry(radius, 64); // 改用圆形几何体，物理切除方角
        const fillMat = this._createMaterial({
            map: texture,
            transparent: true,
            opacity: 0, // 初始透明度为0，用于入场动画
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        fill.scale.setScalar(0.1); // 初始缩放极小
        group.add(fill);

        // 2. 细腻的边缘亮环
        const ringGeo = new THREE.RingGeometry(radius * 0.98, radius, 64);
        const ringMat = this._createMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.scale.setScalar(0.1); // 初始缩放极小
        group.add(ring);

        const startTime = Date.now();
        const entryDuration = 400; // 入场动画时间
        const fadeDuration = 600; // 淡出时间
        
        const anim = () => {
            const elapsed = Date.now() - startTime;
            
            if (elapsed < duration + fadeDuration) {
                if (elapsed < entryDuration) {
                    // 入场动画：快速展开 + 渐亮
                    const prg = elapsed / entryDuration;
                    const easeOut = 1 - Math.pow(1 - prg, 3); // 缓动函数
                    fill.scale.setScalar(easeOut);
                    ring.scale.setScalar(easeOut);
                    fillMat.opacity = 0.4 * easeOut;
                    ringMat.opacity = 0.6 * easeOut;
                } else {
                    // 常驻逻辑：呼吸动效 + 最终淡出
                    const fadeProgress = Math.max(0, (elapsed - duration) / fadeDuration);
                    
                    // 呼吸动效
                    const pulse = 1 + Math.sin(elapsed * 0.003) * 0.02;
                    fill.scale.setScalar(pulse);
                    
                    // 在 duration 期间保持，在最后的 fadeDuration 内线性淡出
                    fillMat.opacity = 0.4 * (1 - fadeProgress) * (0.8 + Math.sin(elapsed * 0.005) * 0.2);
                    ringMat.opacity = 0.6 * (1 - fadeProgress);
                }
                
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(group);
                texture.dispose();
                fillGeo.dispose(); fillMat.dispose();
                ringGeo.dispose(); ringMat.dispose();
            }
        };
        anim();

        // 3. 入场时的瞬间脉冲粒子 (能量释放感)
        this.createParticleExplosion(pos.clone().add(new THREE.Vector3(0, 0.1, 0)), {
            color: color,
            particleCount: 12,
            size: 0.06,
            duration: 600,
            speed: 0.12
        });

        // 4. 核心“气”粒子：优雅的螺旋上升
        this.createParticleSystem({
            pos: pos.clone(),
            color: 0xffffff,
            duration: duration,
            density: 2.5, // 密度提升
            spawnRate: 150, // 发射频率加快
            geometry: new THREE.BoxGeometry(0.04, 0.3, 0.02), // 剑气尺寸增大
            initFn: (p) => {
                const r = Math.sqrt(Math.random()) * radius;
                const theta = Math.random() * Math.PI * 2;
                p.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
                p.userData.angle = theta;
                p.userData.radius = r;
                p.userData.speedY = 0.015 + Math.random() * 0.02;
            },
            updateFn: (p, prg) => {
                // 缓慢螺旋上升
                p.userData.angle += 0.015;
                p.position.x = Math.cos(p.userData.angle) * p.userData.radius;
                p.position.z = Math.sin(p.userData.angle) * p.userData.radius;
                p.position.y += p.userData.speedY;
                
                // 颜色演变：由白转为气场色
                const targetColor = new THREE.Color(color);
                p.material.color.lerp(targetColor, 0.05);
                
                // 透明度：淡入淡出，更有灵性
                p.material.opacity = 0.6 * Math.sin(Math.PI * prg);
                p.scale.setScalar(1 - prg * 0.4);
                p.rotation.y += 0.05;
            }
        });

        // 5. 零散的玄秘光芒 (Scattered Glimmers)
        this.createParticleSystem({
            pos: pos.clone(),
            color: color,
            duration: duration,
            density: 1.5, // 密度提升
            spawnRate: 300, // 频率加快
            geometry: new THREE.BoxGeometry(0.08, 0.08, 0.08), // 光点尺寸增大
            initFn: (p) => {
                const r = Math.sqrt(Math.random()) * radius;
                const theta = Math.random() * Math.PI * 2;
                p.position.set(Math.cos(theta) * r, 0.1 + Math.random() * 0.8, Math.sin(theta) * r);
                p.userData.floatSpeed = 0.005 + Math.random() * 0.01;
                p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            },
            updateFn: (p, prg) => {
                // 极其缓慢地漂浮
                p.position.y += p.userData.floatSpeed;
                
                // 闪烁感：正弦波控制透明度
                p.material.opacity = 0.8 * Math.sin(Math.PI * prg);
                
                // 随机旋转增加光影闪烁感
                p.rotation.x += 0.02;
                p.rotation.z += 0.02;
                
                // 尺寸微调
                const s = 1 - prg * 0.2;
                p.scale.setScalar(s);
            }
        });
    }

    /**
     * 火球爆炸特效：核心白光脉冲 + 扩散火球 + 升腾烟雾粒子
     */
    createFireExplosionVFX(pos, radius, color, duration) {
        const actualParent = this.scene;
        
        // --- 核心修正：将爆炸特效锚定在地面 ---
        // 弹道击中时 pos 是在空中（约 0.6 高度），但爆炸效果应该以敌人脚下为基准
        const groundPos = pos.clone();
        groundPos.y = 0.05; // 略高于地面，避免 z-fighting
        
        // 1. 核心白光脉冲 (瞬间爆发感)
        const flashGeo = new THREE.SphereGeometry(radius * 0.5, 16, 16);
        const flashMat = this._createMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(groundPos);
        actualParent.add(flash);

        // 2. 扩散的火环 (波纹感) - 现在完全贴合地面
        const ringGeo = new THREE.RingGeometry(0.1, radius, 32);
        const ringMat = this._createMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(groundPos);
        ring.rotation.x = -Math.PI / 2;
        actualParent.add(ring);

        const startTime = Date.now();
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const prg = elapsed / duration;
            if (prg < 1) {
                // 核心闪光迅速缩小消失
                const flashS = 1 + prg * 2;
                flash.scale.set(flashS, flashS, flashS);
                flashMat.opacity = 1 - prg * 2;
                if (flashMat.opacity < 0) flashMat.opacity = 0;

                // 火环向外扩散淡出
                ring.scale.set(1 + prg * 0.5, 1 + prg * 0.5, 1);
                ringMat.opacity = 0.8 * (1 - prg);

                requestAnimationFrame(anim);
            } else {
                actualParent.remove(flash);
                actualParent.remove(ring);
                flashGeo.dispose(); flashMat.dispose();
                ringGeo.dispose(); ringMat.dispose();
            }
        };
        anim();

        // 3. 升腾的烟火粒子 - 从地面开始上升
        this.createParticleSystem({
            pos: groundPos.clone(),
            color: color,
            duration: duration * 1.5,
            density: 3,
            spawnRate: 50,
            geometry: new THREE.BoxGeometry(0.15, 0.15, 0.15),
            initFn: (p) => {
                const angle = Math.random() * Math.PI * 2;
                const r = radius * Math.random() * 0.8;
                p.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                p.userData.vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    0.05 + Math.random() * 0.1,
                    (Math.random() - 0.5) * 0.1
                );
            },
            updateFn: (p, prg) => {
                p.position.add(p.userData.vel);
                p.rotation.set(p.rotation.x + 0.1, p.rotation.y + 0.1, p.rotation.z + 0.1);
                // 颜色演变：基于传入颜色 -> 暗色调 -> 灰黑
                const c = p.material.color;
                const baseColor = new THREE.Color(color);
                const darkColor = baseColor.clone().multiplyScalar(0.3); // 暗色版本
                if (prg < 0.5) {
                    c.lerp(darkColor, 0.1);
                } else {
                    c.lerp(new THREE.Color(0x333333), 0.1);
                }
                p.material.opacity = 0.8 * (1 - prg);
                p.scale.setScalar(1.2 * (1 - prg));
            }
        });
    }

    createPulseVFX(pos, radius, color, duration, parent = null) {
        const actualParent = parent || this.scene;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const geo = new THREE.RingGeometry(0.1, 0.15, 64);
                const mat = this._createMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
                const ring = new THREE.Mesh(geo, mat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(pos).y = 0.1 + i * 0.05;
                actualParent.add(ring);

                const start = Date.now();
                const anim = () => {
                    const prg = (Date.now() - start) / (duration * 0.8);
                    if (prg < 1) {
                        const s = 1 + prg * radius;
                        ring.scale.set(s, s, 1);
                        mat.opacity = 0.8 * (1 - prg);
                        requestAnimationFrame(anim);
                    } else {
                        actualParent.remove(ring);
                        geo.dispose(); mat.dispose();
                    }
                };
                anim();
            }, i * 200);
        }
    }

    createRainVFX(pos, radius, color, duration, density, speed) {
        this.createParticleSystem({
            pos, color, duration, density: density * 2,
            spawnRate: 60, // 稍微提高发射频率，补偿变慢后的视觉密度
            geometry: new THREE.BoxGeometry(0.12, 2.0, 0.02), // 剑宽 0.12，长 2.0，更像一把大剑
            initFn: p => {
                // 初始高度稍微降低一点点，配合变慢的速度
                p.position.set((Math.random()-0.5)*radius*2, 12 + Math.random()*5, (Math.random()-0.5)*radius*2);
                p.rotation.z = (Math.random()-0.5) * 0.1; // 减少倾斜度，让剑落得更直
            },
            updateFn: (p, prg) => {
                // 显著降低下落速度：从之前的 0.6-1.0 降低到 0.25-0.4 左右
                p.position.y -= (0.25 + Math.random()*0.15) * (speed || 1.0);
                if (p.position.y < 0) {
                    p.position.y = -100; // 落地隐藏
                }
                // 增加淡出效果，防止突兀消失
                p.material.opacity = 0.7 * (1 - prg);
            }
        });
    }

    createShieldVFX(parent, pos, radius, color, duration) {
        const group = new THREE.Group();
        group.position.copy(pos);
        parent.add(group);

        const layers = [
            { geometry: new THREE.SphereGeometry(radius * 0.8, 16, 16), opacity: 0.15 },
            { geometry: new THREE.TorusGeometry(radius, 0.03, 8, 32), opacity: 0.5, rot: { y: 0.05, z: 0.02 } },
            { geometry: new THREE.TorusGeometry(radius, 0.03, 8, 32), opacity: 0.5, rot: { y: -0.05, x: 0.02 } }
        ];

        const meshes = layers.map(l => {
            const mat = this._createMaterial({ color, transparent: true, opacity: l.opacity });
            const m = new THREE.Mesh(l.geometry, mat);
            group.add(m);
            return { m, mat, l };
        });

        const start = Date.now();
        const anim = () => {
            const el = Date.now() - start;
            if (el < duration) {
                meshes.forEach(({ m, l }) => {
                    if (l.rot) {
                        m.rotation.x += l.rot.x || 0;
                        m.rotation.y += l.rot.y || 0;
                        m.rotation.z += l.rot.z || 0;
                    }
                });
                requestAnimationFrame(anim);
            } else {
                parent.remove(group);
                meshes.forEach(x => { x.l.geometry.dispose(); x.mat.dispose(); });
            }
        };
        anim();
    }

    createStompVFX(pos, radius, color, duration, parent = null) {
        const actualParent = parent || this.scene;
        const ringGeo = new THREE.RingGeometry(radius * 0.1, radius, 32);
        const ringMat = this._createMaterial({ color: 0x554433, transparent: true, opacity: 0.6, depthWrite: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(pos).y = 0.05;
        actualParent.add(ring);

        const start = Date.now();
        const anim = () => {
            const prg = (Date.now() - start) / 400;
            if (prg < 1) {
                ring.scale.set(0.1 + prg * 0.9, 0.1 + prg * 0.9, 1);
                ringMat.opacity = 0.6 * (1 - prg);
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(ring);
                ringGeo.dispose(); ringMat.dispose();
            }
        };
        anim();

        // 核心修复：添加地震践踏的渣渣粒子效果
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color: 0x887766, // 恢复原本的泥土/灰色
            duration: 500,
            density: 10.0, // 数量提升 5 倍 (之前是 2.0)
            spawnRate: 30, // 频率提高 (之前是 50)
            geometry: new THREE.BoxGeometry(0.12, 0.12, 0.12),
            initFn: (p) => {
                const r = Math.random() * radius;
                const theta = Math.random() * Math.PI * 2;
                p.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
                p.userData.velY = 0.1 + Math.random() * 0.1; // 降低高度
                p.rotation.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
            },
            updateFn: (p, prg) => {
                // 向上跳起后落下
                p.position.y += p.userData.velY;
                p.userData.velY -= 0.015; // 增加重力模拟，落地更快
                if (p.position.y < 0) p.position.y = 0;
                
                p.rotation.x += 0.1;
                p.rotation.z += 0.1;
                p.material.opacity = 0.8 * (1 - prg);
                p.scale.setScalar(1 - prg);
            }
        });
    }

    /**
     * 高级半球气场 (镇山河专属优化)
     * 包含：地面太极法阵、半透明流光罩子、入场冲击感
     */
    createDomeVFX(pos, radius, color, duration) {
        const group = new THREE.Group();
        group.position.copy(pos);
        this.scene.add(group);

        // --- 核心修正：处理颜色，使其蓝得更深邃、饱和度更高 ---
        const baseColor = new THREE.Color(color);
        const hsl = {};
        baseColor.getHSL(hsl);
        // 强制高饱和度 (1.0)，降低亮度 (0.18)，这样叠加后依然是纯正的深色调
        baseColor.setHSL(hsl.h, 1.0, 0.18); 
        const deepColorHex = baseColor.getHex();
        const rgb = `${Math.floor(baseColor.r * 255)},${Math.floor(baseColor.g * 255)},${Math.floor(baseColor.b * 255)}`;

        // 1. 地面太极法阵 (Canvas 动态生成)
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const cx = 128, cy = 128, r = 120;
        
        // 绘制外圈
        ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制简约太极轮廓
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 15, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(cx, cy - r + 15);
        ctx.bezierCurveTo(cx + r, cy - r, cx + r, cy + r, cx, cy + r - 15);
        ctx.bezierCurveTo(cx - r, cy + r, cx - r, cy - r, cx, cy - r + 15);
        ctx.fillStyle = `rgba(${rgb}, 0.3)`;
        ctx.fill();
        ctx.stroke();

        const groundTex = new THREE.CanvasTexture(canvas);
        const groundGeo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2);
        const groundMat = this._createMaterial({ 
            map: groundTex, 
            transparent: true, 
            opacity: 0, 
            depthWrite: false,
            blending: THREE.AdditiveBlending 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0.05;
        group.add(ground);

        // 2. 半球罩子
        const domeGeo = new THREE.SphereGeometry(radius, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = this._createMaterial({ 
            color: deepColorHex, 
            transparent: true, 
            opacity: 0, 
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        group.add(dome);

        // 3. 顶部装饰光圈
        const topRingGeo = new THREE.TorusGeometry(radius * 0.2, 0.015, 8, 32);
        const ringColor = new THREE.Color(deepColorHex).lerp(new THREE.Color(0xffffff), 0.15);
        const topRingMat = this._createMaterial({ color: ringColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
        const topRing = new THREE.Mesh(topRingGeo, topRingMat);
        topRing.rotation.x = Math.PI / 2;
        topRing.position.y = radius * 0.95;
        group.add(topRing);

        const startTime = Date.now();
        const entryTime = 500;
        const fadeTime = 800;

        const anim = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < duration + fadeTime) {
                const prg = elapsed / duration;
                
                if (elapsed < entryTime) {
                    // 入场：从下往上弹出 + 渐亮
                    const entryPrg = elapsed / entryTime;
                    const ease = 1 - Math.pow(1 - entryPrg, 3);
                    dome.scale.set(ease, ease, ease);
                    dome.position.y = -radius * (1 - ease);
                    domeMat.opacity = 0.5 * ease; 
                    groundMat.opacity = 0.6 * ease;
                    topRingMat.opacity = 0.7 * ease;
                } else if (elapsed > duration) {
                    // 淡出
                    const fadePrg = (elapsed - duration) / fadeTime;
                    const out = 1 - fadePrg;
                    domeMat.opacity = 0.5 * out;
                    groundMat.opacity = 0.6 * out;
                    topRingMat.opacity = 0.7 * out;
                    group.scale.setScalar(1 + fadePrg * 0.1);
                } else {
                    // 常驻：呼吸 + 旋转
                    const pulse = 1 + Math.sin(elapsed * 0.002) * 0.03;
                    dome.scale.set(pulse, pulse, pulse);
                    domeMat.opacity = 0.35 + Math.sin(elapsed * 0.003) * 0.1;
                    ground.rotation.z += 0.004; // 地面法阵缓慢旋转
                }

                requestAnimationFrame(anim);
            } else {
                this.scene.remove(group);
                groundTex.dispose(); groundGeo.dispose(); groundMat.dispose();
                domeGeo.dispose(); domeMat.dispose();
                topRingGeo.dispose(); topRingMat.dispose();
            }
        };
        anim();

        // 4. 伴随效果：落剑感 (快速落下的光束)
        for(let i = 0; i < 3; i++) {
            setTimeout(() => {
                this.createParticleSystem({
                    pos: pos.clone().add(new THREE.Vector3((Math.random()-0.5)*radius, 0, (Math.random()-0.5)*radius)),
                    color: deepColorHex, 
                    duration: 400,
                    density: 1,
                    spawnRate: 100,
                    geometry: new THREE.BoxGeometry(0.1, 2.0, 0.1),
                    initFn: p => { 
                        p.position.y = 10; 
                        p.material.opacity = 0.6;
                        p.material.blending = THREE.AdditiveBlending;
                    },
                    updateFn: (p, prg) => { 
                        p.position.y -= 0.8; 
                        p.material.opacity = 0.6 * (1 - prg); 
                    }
                });
            }, i * 150);
        }
    }

    createSweepVFX(pos, dir, radius, color, duration, angle, parent = null) {
        const actualParent = parent || this.scene;
        const group = new THREE.Group();

        // 核心修复：抵消单位缩放
        if (parent && parent.scale) {
            group.scale.set(1/parent.scale.x, 1/parent.scale.y, 1/parent.scale.z);
        }

        const geo = new THREE.RingGeometry(radius * 0.5, radius, 32, 1, -Math.PI / 2 - angle / 2, angle);
        const mat = this._createMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        group.add(mesh);
        if (dir) group.rotation.y = Math.atan2(dir.x, dir.z);
        group.position.copy(pos).y = 0.15;
        actualParent.add(group);

        const start = Date.now();
        const anim = () => {
            const prg = (Date.now() - start) / duration;
            if (prg < 1) {
                group.scale.set(1 + prg * 0.5, 1 + prg * 0.5, 1);
                mat.opacity = 0.6 * (1 - prg);
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(group);
                geo.dispose(); mat.dispose();
            }
        };
        anim();
    }

    /**
     * 高级横扫特效：带有羽化边缘和流光感，适用于英雄
     */
    createAdvancedSweepVFX(pos, dir, radius, color, duration, angle, parent = null) {
        const actualParent = parent || this.scene;
        const group = new THREE.Group();

        // 抵消父级缩放
        if (parent && parent.scale) {
            group.scale.set(1/parent.scale.x, 1/parent.scale.y, 1/parent.scale.z);
        }

        // 1. 创建羽化扇形贴图
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // 绘制渐变扇形
        const cx = 128, cy = 128;
        const c = new THREE.Color(color);
        const rgb = `${Math.floor(c.r * 255)},${Math.floor(c.g * 255)},${Math.floor(c.b * 255)}`;
        
        // 核心修正：使用固定的画布坐标 (0-128) 而非受世界半径影响的错误坐标
        const grad = ctx.createRadialGradient(cx, cy, 60, cx, cy, 120); 
        
        grad.addColorStop(0, `rgba(${rgb}, 0)`);
        grad.addColorStop(0.5, `rgba(${rgb}, 0.95)`); // 显著提升中心带透明度，让红色更“实”
        grad.addColorStop(1, `rgba(${rgb}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        // 核心修正：将中心点从 -PI/2 (Canvas的UP) 改为 +PI/2 (Canvas的DOWN)
        // 这样在贴图映射到 PlaneGeometry 后，能与基础 sweep 一样指向本地 -Z 轴
        ctx.arc(cx, cy, 120, -angle/2 + Math.PI/2, angle/2 + Math.PI/2);
        ctx.closePath();
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        const geo = new THREE.PlaneGeometry(radius * 2.1, radius * 2.1); // 尺寸更贴合半径
        const mat = this._createMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.15; // 与基础版高度一致，确保可见
        group.add(mesh);

        // 设置方向
        if (dir) group.rotation.y = Math.atan2(dir.x, dir.z);
        group.position.copy(pos);
        actualParent.add(group);

        const start = Date.now();
        const anim = () => {
            const prg = (Date.now() - start) / duration;
            if (prg < 1) {
                // 核心动效：扇形从小变大，同时迅速淡出
                const s = 0.8 + prg * 0.4;
                group.scale.set(s, s, 1);
                mat.opacity = 0.8 * Math.pow(1 - prg, 2); // 平方衰减更显凌厉
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(group);
                texture.dispose(); geo.dispose(); mat.dispose();
            }
        };
        anim();

        // 2. 伴随碎裂粒子 (增加打击感)
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color,
            duration: duration * 0.8,
            density: 1.5,
            spawnRate: 40,
            geometry: new THREE.BoxGeometry(0.05, 0.05, 0.05),
            initFn: (p) => {
                const a = (Math.random() - 0.5) * angle;
                const r = radius * (0.6 + Math.random() * 0.4);
                // 核心修正：粒子位置也需要与贴图弧度同步 (+Math.PI/2)
                const localPos = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(r);
                if (dir) {
                    const rotY = Math.atan2(dir.x, dir.z);
                    localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
                }
                p.position.copy(localPos);
                p.userData.vel = localPos.clone().normalize().multiplyScalar(0.05);
            },
            updateFn: (p, prg) => {
                p.position.add(p.userData.vel);
                p.material.opacity = 0.6 * (1 - prg);
                p.scale.setScalar(1 - prg);
            }
        });
    }

    createWhirlwindVFX(pos, radius, color, duration, parent = null) {
        const actualParent = parent || this.scene;
        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = 0.5;
        actualParent.add(group);

        // 抵消父级缩放
        if (parent && parent.scale) {
            group.scale.set(1/parent.scale.x, 1/parent.scale.y, 1/parent.scale.z);
        }

        // 1. 创建多层旋转剑气圆环 (Sword Trails)
        const trailCount = 3;
        const meshes = [];
        for (let i = 0; i < trailCount; i++) {
            const innerR = radius * (0.6 + i * 0.1);
            const outerR = radius * (0.8 + i * 0.1);
            // 使用 RingGeometry 模拟剑气轨迹
            const geo = new THREE.RingGeometry(innerR, outerR, 32, 1, Math.random() * Math.PI, Math.PI * 1.2);
            const mat = this._createMaterial({ 
                color, 
                transparent: true, 
                opacity: 0.5 - i * 0.1,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = i * 0.15;
            group.add(mesh);
            meshes.push({ mesh, mat, speed: 0.15 + i * 0.05 });
        }

        // 2. 核心金光
        const coreGeo = new THREE.SphereGeometry(radius * 0.3, 16, 16);
        const coreMat = this._createMaterial({ color, transparent: true, opacity: 0.3 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        group.add(core);

        const startTime = Date.now();
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const prg = elapsed / duration;

            if (prg < 1) {
                // 旋转各层轨迹
                meshes.forEach(item => {
                    item.mesh.rotation.z += item.speed;
                    item.mat.opacity = (0.5 - (meshes.indexOf(item) * 0.1)) * (1 - prg);
                });
                
                core.scale.setScalar(1 + Math.sin(elapsed * 0.01) * 0.2);
                coreMat.opacity = 0.3 * (1 - prg);
                
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(group);
                coreGeo.dispose(); coreMat.dispose();
                meshes.forEach(item => { item.mesh.geometry.dispose(); item.mat.dispose(); });
            }
        };
        anim();

        // 3. 伴随旋转粒子 (Sparks)
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color,
            duration,
            density: 2,
            spawnRate: 60,
            geometry: new THREE.BoxGeometry(0.1, 0.1, 0.1),
            initFn: (p) => {
                const angle = Math.random() * Math.PI * 2;
                const r = radius * (0.5 + Math.random() * 0.5);
                p.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                p.userData.angle = angle;
                p.userData.r = r;
            },
            updateFn: (p, prg) => {
                p.userData.angle += 0.15;
                p.position.x = Math.cos(p.userData.angle) * p.userData.r;
                p.position.z = Math.sin(p.userData.angle) * p.userData.r;
                p.position.y += 0.02;
                p.material.opacity = 0.8 * (1 - prg);
                p.scale.setScalar(1 - prg);
            }
        });
    }

    /**
     * 风来吴山专属特效：沉重的重剑旋风斩
     * 优化点：强调重剑的重量感与排山倒海的气浪，移除电锯般的切割感
     */
    createMegaWhirlwindVFX(pos, radius, color, duration, parent = null) {
        const actualParent = parent || this.scene;
        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = 0.1; // 极低重心，表现贴地横扫的力量
        actualParent.add(group);

        if (parent && parent.scale) {
            group.scale.set(1/parent.scale.x, 1/parent.scale.y, 1/parent.scale.z);
        }

        // --- 核心修正：强化橙色的深邃感与饱和度 ---
        const baseColor = new THREE.Color(color);
        const hsl = {};
        baseColor.getHSL(hsl);
        // 强制高饱和度 (1.0)，适度压低亮度 (0.3 - 0.4)，确保叠加后呈现浓郁的橙色
        baseColor.setHSL(hsl.h, 1.0, 0.35); 
        const heavyColorHex = baseColor.getHex();
        const rgb = `${Math.floor(baseColor.r * 255)},${Math.floor(baseColor.g * 255)},${Math.floor(baseColor.b * 255)}`;

        // 1. 创建“重剑气浪”纹理 (Canvas)
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // 绘制一个厚重的、带有拖尾的宽阔弧光
        ctx.clearRect(0, 0, 512, 512);
        const grad = ctx.createRadialGradient(256, 256, 150, 256, 256, 250);
        grad.addColorStop(0, `rgba(${rgb}, 0)`);
        grad.addColorStop(0.3, `rgba(${rgb}, 0.9)`); // 增加不透明度，让颜色更“实”
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        
        ctx.strokeStyle = grad;
        ctx.lineWidth = 85; // 进一步加宽
        ctx.lineCap = 'round';
        ctx.beginPath();
        // 缩短弧度到 180 度左右，突出每一剑“抡”出来的感觉
        ctx.arc(256, 256, 200, 0, Math.PI * 1.1); 
        ctx.stroke();

        const heavyTrailTex = new THREE.CanvasTexture(canvas);
        
        // 2. 核心气浪层 (表现体积感)
        const layers = [];
        const layerCount = 3;
        for (let i = 0; i < layerCount; i++) {
            const r = radius * (0.9 + i * 0.15);
            const geo = new THREE.PlaneGeometry(r * 2.2, r * 2.2);
            const mat = this._createMaterial({
                map: heavyTrailTex,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.y = i * 0.3; 
            mesh.rotation.z = (i * Math.PI) / 2;
            group.add(mesh);
            // 降低转速，突出沉重感
            layers.push({ mesh, mat, speed: 0.12 + i * 0.03 });
        }

        // 3. 地面震荡波 (Shockwaves)
        const ringGeo = new THREE.RingGeometry(radius * 0.8, radius, 64);
        const ringMat = this._createMaterial({ color: heavyColorHex, transparent: true, opacity: 0.4, depthWrite: false });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        const startTime = Date.now();
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const prg = elapsed / duration;

            if (prg < 1) {
                const timeFactor = elapsed * 0.001;
                
                // 0.8秒快速渐入，最后0.6秒快速渐出
                const fadeIn = Math.min(1, elapsed / 800);
                const fadeOut = Math.min(1, (duration - elapsed) / 600);
                const fs = fadeIn * fadeOut;

                layers.forEach((layer, idx) => {
                    layer.mesh.rotation.z += layer.speed;
                    layer.mesh.position.y = (idx * 0.3) + Math.sin(timeFactor * 10 + idx) * 0.05;
                    const baseOpacity = 0.85 - idx * 0.15;
                    layer.mat.opacity = baseOpacity * fs;
                });

                ring.scale.setScalar(1 + Math.sin(timeFactor * 15) * 0.05);
                ringMat.opacity = 0.3 * fs;
                
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(group);
                heavyTrailTex.dispose();
                layers.forEach(l => { l.mesh.geometry.dispose(); l.mat.dispose(); });
                ringGeo.dispose(); ringMat.dispose();
            }
        };
        anim();

        // 4. 重力粒子：地面翻起的碎石与尘土
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color: heavyColorHex, // 使用加重后的橙色
            duration: duration,
            density: 3.0,
            spawnRate: 60,
            geometry: new THREE.BoxGeometry(0.12, 0.12, 0.12), 
            initFn: (p) => {
                const a = Math.random() * Math.PI * 2;
                const r = radius * (0.5 + Math.random() * 0.5);
                p.position.set(Math.cos(a) * r, -0.2, Math.sin(a) * r);
                p.userData.velY = 0.1 + Math.random() * 0.15;
                p.userData.angle = a;
                p.userData.r = r;
            },
            updateFn: (p, prg) => {
                p.userData.angle += 0.1;
                p.position.x = Math.cos(p.userData.angle) * p.userData.r;
                p.position.z = Math.sin(p.userData.angle) * p.userData.r;
                
                p.position.y += p.userData.velY;
                p.userData.velY -= 0.01;
                if(p.position.y < 0) p.position.y = 0;

                p.rotation.x += 0.1;
                p.material.opacity = 0.7 * (1 - prg);
                p.scale.setScalar(1 - prg * 0.5);
            }
        });
    }

    /**
     * 三清化神：在单位身后创建 5 把环绕的气剑
     */
    createSanqingSwordsVFX(parent, color, duration) {
        if (!parent || parent.isDead) return;

        const group = new THREE.Group();
        this.scene.add(group);

        const swords = [];
        const swordCount = 5;
        const swordGeo = new THREE.BoxGeometry(0.05, 0.05, 0.8);
        const swordMat = this._createMaterial({ color, transparent: true, opacity: 0.8 });

        for (let i = 0; i < swordCount; i++) {
            const swordGroup = new THREE.Group();
            const mesh = new THREE.Mesh(swordGeo, swordMat);
            // 核心修正：Pivot 设在剑柄末端 (0,0,0)，+Z 轴指向剑尖。
            // 剑身中心在 0.4，覆盖 0 到 0.8
            mesh.position.z = 0.4; 
            swordGroup.add(mesh);

            // 护手放在靠近剑柄的位置
            const hiltGeo = new THREE.BoxGeometry(0.25, 0.05, 0.05);
            const hilt = new THREE.Mesh(hiltGeo, swordMat);
            hilt.position.z = 0.2; // 留出 0.2 的剑柄空间
            swordGroup.add(hilt);

            group.add(swordGroup);
            swords.push({
                obj: swordGroup,
                baseAngle: (i / swordCount) * Math.PI * 2,
                state: 'follow', // follow, attack, return
                targetUnit: null,
                attackStartTime: 0
            });
        }

        const startTime = Date.now();
        const anim = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > duration || parent.isDead) {
                this.scene.remove(group);
                swordGeo.dispose();
                swordMat.dispose();
                return;
            }

            const time = elapsed * 0.002;
            swords.forEach((s, i) => {
                if (s.state === 'follow') {
                    // 环绕逻辑
                    const angle = s.baseAngle + time;
                    const radius = 1.2;
                    const targetX = parent.position.x + Math.cos(angle) * radius;
                    const targetZ = parent.position.z + Math.sin(angle) * radius;
                    const targetY = parent.position.y + 0.8 + Math.sin(time * 2 + i) * 0.15; // 稍微抬高并增加起伏

                    const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
                    s.obj.position.lerp(targetPos, 0.1);
                    
                    // 闲置状态：剑尖垂直向下
                    // 由于 Pivot 在剑柄，+Z 指向剑尖，我们将 +Z 轴旋转到指向下方 (-Y)
                    // 使用 lookAt 指向正下方，确保方向一致性
                    const downPos = s.obj.position.clone().add(new THREE.Vector3(0, -1, 0));
                    s.obj.lookAt(downPos);
                } else if (s.state === 'attack' && s.targetUnit) {
                    // 攻击冲刺逻辑
                    const attackProgress = (Date.now() - s.attackStartTime) / 400; 
                    if (attackProgress < 1) {
                        const targetPos = s.targetUnit.position.clone().add(new THREE.Vector3(0, 0.5, 0));
                        
                        // 重置旋转以允许 lookAt 正常工作（或者 lookAt 会自动覆盖）
                        s.obj.lookAt(targetPos);
                        
                        // 为了让剑尖 (z=0.8) 恰好刺中敌人，剑柄 (Pivot) 应该停在距离敌人 0.8 的位置
                        const direction = targetPos.clone().sub(s.obj.position).normalize();
                        const hiltTarget = targetPos.clone().sub(direction.multiplyScalar(0.8));
                        
                        s.obj.position.lerp(hiltTarget, attackProgress);
                    } else {
                        s.state = 'return';
                        s.attackStartTime = Date.now();
                    }
                } else if (s.state === 'return') {
                    // 返回逻辑
                    const returnProgress = (Date.now() - s.attackStartTime) / 400;
                    const targetPos = parent.position.clone().add(new THREE.Vector3(0, 0.5, 0));
                    if (returnProgress < 1) {
                        // 返回时剑尖指向英雄
                        s.obj.lookAt(targetPos);
                        s.obj.position.lerp(targetPos, returnProgress);
                    } else {
                        s.state = 'follow';
                    }
                }
            });

            requestAnimationFrame(anim);
        };
        anim();

        return {
            group,
            swords,
            attack: (index, target) => {
                const s = swords[index];
                if (s && s.state === 'follow') {
                    s.state = 'attack';
                    s.targetUnit = target;
                    s.attackStartTime = Date.now();
                }
            }
        };
    }

    /**
     * 仙女/蝴蝶粒子效果：
     * 粒子紧随英雄，但在移动时会留下平滑的延迟轨迹
     */
    createButterflyVFX(parent, color, duration) {
        if (!parent) return;

        const startTime = Date.now();
        const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

        // 提高发射频率 (30ms)，确保高速移动下轨迹平滑连贯
        const interval = setInterval(() => {
            // 如果英雄死亡或效果到期，停止发射
            if (Date.now() - startTime > duration || parent.isDead) {
                clearInterval(interval);
                pGeo.dispose();
                return;
            }

            // 每一跳生成 1 个精细粒子
            const pMat = this._createMaterial({ color, transparent: true, opacity: 0.8 });
            const p = new THREE.Mesh(pGeo, pMat);
            
            // 初始位置：覆盖整个身体范围，并增加水平散布
            const angle = Math.random() * Math.PI * 2;
            const r = 0.2 + Math.random() * 0.8; // 增加水平范围
            p.position.set(
                parent.position.x + Math.cos(angle) * r,
                parent.position.y + Math.random() * 1.2, // 覆盖从脚到头的高度 (假设单位高约 1.2)
                parent.position.z + Math.sin(angle) * r
            );
            
            // 为每个粒子分配一个独立的追随高度偏置，并增加一个水平轨道偏置，防止其完全汇聚到一点
            p.userData.targetYOffset = 0.2 + Math.random() * 1.0;
            const orbitAngle = Math.random() * Math.PI * 2;
            const orbitR = 0.3 + Math.random() * 0.7; // 粒子会趋向于角色周围的这个点，而不是角色中心
            p.userData.orbitX = Math.cos(orbitAngle) * orbitR;
            p.userData.orbitZ = Math.sin(orbitAngle) * orbitR;
            
            // 直接加入场景，使其拥有独立的世界坐标
            this.scene.add(p);

            const pStart = Date.now();
            const pDur = 800 + Math.random() * 400; // 粒子寿命稍长一些，让轨迹更明显
            
            // 粒子个体的摆动相位
            const phase = Math.random() * Math.PI * 2;

            const anim = () => {
                const elapsed = Date.now() - pStart;
                const prg = elapsed / pDur;
                
                if (prg < 1 && !parent.isDead) {
                    // 1. 追随逻辑：向角色周围的“舒适区”缓慢汇聚
                    const targetPos = parent.position.clone().add(new THREE.Vector3(
                        p.userData.orbitX, 
                        p.userData.targetYOffset, 
                        p.userData.orbitZ
                    ));
                    
                    // 降低系数至 0.03，产生极强的滞后感和丝滑感
                    p.position.lerp(targetPos, 0.03);
                    
                    // 2. 浮动逻辑：更大幅度的随机晃动
                    const time = Date.now() * 0.003;
                    p.position.x += Math.sin(time + phase) * 0.02;
                    p.position.y += Math.cos(time * 0.7 + phase) * 0.02;
                    p.position.z += Math.sin(time * 1.2 + phase) * 0.02;
                    
                    // 3. 视觉演变
                    p.rotation.x += 0.1;
                    p.rotation.z += 0.1;
                    p.material.opacity = 0.8 * (1 - prg); // 逐渐透明
                    p.scale.setScalar(1 - prg * 0.8);      // 逐渐变小
                    
                    requestAnimationFrame(anim);
                } else {
                    this.scene.remove(p);
                    pMat.dispose();
                }
            };
            anim();
        }, 30);
    }

    /**
     * 眩晕特效：在单位头顶显示旋转的小星星和“晕”字
     */
    createStunVFX(parent) {
        this._createHeadSymbolVFX(parent, { text: '晕', color: '#ffcc00', starColor: '#ffcc00', activeKey: 'stun' });
    }

    /**
     * 减速特效：在单位脚下显示一个粘稠的暗影圆环或拖尾
     */
    createSlowVFX(parent) {
        if (!parent || parent.isDead) return;
        if (parent.userData.slowVFXActive) return;
        parent.userData.slowVFXActive = true;

        const group = new THREE.Group();
        group.position.y = -0.35; // 贴近地面
        parent.add(group);

        // 1. 创建地面的粘稠阴影圈
        const ringGeo = new THREE.RingGeometry(0.3, 0.5, 32);
        const ringMat = this._createMaterial({ 
            color: 0x220033, 
            transparent: true, 
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        // 2. 创建向上冒出的虚弱气息 (粒子)
        const particleInterval = setInterval(() => {
            if (!parent.userData.slowVFXActive || parent.isDead) {
                clearInterval(particleInterval);
                return;
            }

            const pGeo = new THREE.BoxGeometry(0.05, 0.1, 0.05);
            const pMat = this._createMaterial({ color: 0x440066, transparent: true, opacity: 0.6 });
            const p = new THREE.Mesh(pGeo, pMat);
            
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.4;
            p.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
            group.add(p);

            const pStart = Date.now();
            const pDur = 600 + Math.random() * 400;
            const pAnim = () => {
                const prg = (Date.now() - pStart) / pDur;
                if (prg < 1 && parent.userData.slowVFXActive) {
                    p.position.y += 0.01;
                    p.material.opacity = 0.6 * (1 - prg);
                    p.scale.setScalar(1 - prg * 0.5);
                    requestAnimationFrame(pAnim);
                } else {
                    group.remove(p);
                    pGeo.dispose();
                    pMat.dispose();
                }
            };
            pAnim();
        }, 200);

        const anim = () => {
            // 核心逻辑：检测单位当前的移速是否仍然低于基础移速
            const isSlowed = parent.moveSpeed < parent.baseMoveSpeed * 0.95; // 给一点容差
            
            if (isSlowed && !parent.isDead) {
                // 呼吸效果
                const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
                ring.scale.set(scale, scale, 1);
                requestAnimationFrame(anim);
            } else {
                parent.userData.slowVFXActive = false;
                clearInterval(particleInterval);
                parent.remove(group);
                ringGeo.dispose();
                ringMat.dispose();
            }
        };
        anim();
    }

    /**
     * 逃跑特效：参考眩晕特效风格，头顶显示浮动的“逃”字，并有红色的慌乱粒子环绕
     */
    /**
     * 逃跑特效：参考眩晕特效风格，头顶显示浮动的“逃”字，并有红色的慌乱粒子环绕
     */
    createFleeVFX(parent) {
        this._createHeadSymbolVFX(parent, { text: '逃', color: '#ff3333', starColor: '#ff3333', activeKey: 'flee' });
    }

    /**
     * 升级特效：参考武侠风格的金光冲天 + 地面震荡
     */
    createLevelUpVFX(pos, parent = null) {
        const actualParent = parent || this.scene;
        
        // 1. 核心爆发脉冲 (金色)
        this.createPulseVFX(pos, 2.5, 0xffcc00, 1000, actualParent);
        
        // 2. 环绕上升的粒子 (蝴蝶感/灵气)
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color: 0xffdd44,
            duration: 2000,
            density: 2.5,
            spawnRate: 40,
            initFn: (p) => {
                const angle = Math.random() * Math.PI * 2;
                const r = 0.5 + Math.random() * 0.5;
                p.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                p.userData.angle = angle;
                p.userData.r = r;
                p.userData.speedY = 0.02 + Math.random() * 0.03;
            },
            updateFn: (p, prg) => {
                p.userData.angle += 0.05;
                p.position.x = Math.cos(p.userData.angle) * p.userData.r;
                p.position.z = Math.sin(p.userData.angle) * p.userData.r;
                p.position.y += p.userData.speedY;
                p.material.opacity = 0.8 * (1 - prg);
                p.scale.setScalar(1 - prg * 0.5);
            }
        });

        // 3. 冲天光柱 (由快速上升的长方体组成)
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color: 0xffffff,
            duration: 1000,
            density: 3.0,
            spawnRate: 30,
            geometry: new THREE.BoxGeometry(0.05, 2.5, 0.05),
            initFn: (p) => {
                p.position.set((Math.random()-0.5)*0.3, 0, (Math.random()-0.5)*0.3);
                p.material.opacity = 0.3;
            },
            updateFn: (p, prg) => {
                p.position.y += 0.2;
                p.scale.set(1 - prg, 1, 1 - prg);
                p.material.opacity = 0.4 * (1 - prg);
            }
        });
    }

    /**
     * 显示跳字特效 (像素风)
     */
    createDamageNumberVFX(pos, value, color = '#ff3333', scale = 1.0) {
        return this.createFloatingTextVFX(pos, Math.floor(value), color, scale);
    }

    /**
     * 通用像素漂浮文字 (可用于切换姿态、技能名、状态提示等)
     */
    createFloatingTextVFX(pos, text, color = '#ffffff', scale = 1.0) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128; // 稍微加宽以容纳更长的中文字符
        canvas.height = 64;

        ctx.imageSmoothingEnabled = false;
        ctx.font = 'bold 24px "Courier New", monospace'; // 稍微调小字号适配文字长度
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(text, 64, 32);
        
        ctx.fillStyle = color;
        ctx.fillText(text, 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;

        const spriteMat = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            depthTest: false 
        });
        const sprite = new THREE.Sprite(spriteMat);
        
        sprite.position.copy(pos);
        sprite.position.y += 1.2; // 比伤害数字稍微高一点点，防止重叠
        
        sprite.position.x += (Math.random() - 0.5) * 0.2;
        sprite.position.z += (Math.random() - 0.5) * 0.2;

        const baseScale = 1.0 * scale;
        sprite.scale.set(baseScale * 2, baseScale, 1); // 宽度翻倍适配比例
        this.scene.add(sprite);

        const startTime = Date.now();
        const duration = 1000; // 停留时间稍微长一点
        const startY = sprite.position.y;
        const maxUpDist = 0.6;
        
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const prg = Math.min(1, elapsed / duration);

            if (prg < 1) {
                const currentOffset = prg * (2 - prg) * maxUpDist;
                sprite.position.y = startY + currentOffset;
                
                if (prg > 0.7) {
                    spriteMat.opacity = 1 - (prg - 0.7) / 0.3;
                }
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(sprite);
                texture.dispose();
                spriteMat.dispose();
            }
        };
        anim();
    }

    /**
     * 创建点击地面时的即时像素反馈 (Scheme C)
     */
    createClickRippleVFX(pos) {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        // 使用哑光金 (Matte Gold)
        ctx.fillStyle = 'rgba(197, 160, 89, 0.8)';
        ctx.beginPath();
        ctx.arc(16, 16, 10, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        
        const mat = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true, 
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const geo = new THREE.PlaneGeometry(0.8, 0.8);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        mesh.position.y = 0.1;
        mesh.renderOrder = 1000;
        this.scene.add(mesh);

        const startTime = Date.now();
        const duration = 400;
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const prg = elapsed / duration;
            if (prg < 1) {
                mesh.scale.set(1 + prg * 2, 1 + prg * 2, 1);
                mat.opacity = 0.8 * (1 - prg);
                requestAnimationFrame(anim);
            } else {
                if (mesh.parent) this.scene.remove(mesh);
                geo.dispose();
                mat.dispose();
                texture.dispose();
            }
        };
        anim();
    }

    /**
     * 创建路径目标点的常驻标记 (Scheme C)
     */
    createPathMarkerVFX(pos, color = '#5b8a8a') {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        
        // 绘制一个像素风格的十字/箭头光标
        // 中心使用传入的职业颜色，外框恢复为黑色 (#000000)
        ctx.fillStyle = color;
        ctx.fillRect(12, 0, 8, 32); 
        ctx.fillRect(0, 12, 32, 8);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 0, 8, 32);
        ctx.strokeRect(0, 12, 32, 8);

        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        
        const mat = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true, 
            depthTest: false 
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.6, 0.6, 1);
        sprite.position.copy(pos);
        sprite.renderOrder = 1001;
        this.scene.add(sprite);

        const startTime = Date.now();
        const bounceAnim = () => {
            if (!sprite.parent) {
                texture.dispose();
                mat.dispose();
                return;
            }
            const elapsed = Date.now() - startTime;
            sprite.position.y = pos.y + 0.8 + Math.abs(Math.sin(elapsed * 0.006)) * 0.5;
            requestAnimationFrame(bounceAnim);
        };
        bounceAnim();

        return sprite;
    }

    /**
     * 创建一个路径点 (面包屑)
     */
    createPathPointVFX(pos) {
        const geo = new THREE.PlaneGeometry(0.2, 0.2);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0xc5a059, // 哑光金
            transparent: true, 
            opacity: 0.7,
            depthTest: false 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(pos);
        mesh.position.y = 0.1;
        mesh.renderOrder = 999;
        this.scene.add(mesh);
        return mesh;
    }
}

