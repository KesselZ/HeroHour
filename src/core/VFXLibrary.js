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
        gradient.addColorStop(0.5, `rgba(${rgb}, 0.3)`); // 中间渐变
        gradient.addColorStop(1, `rgba(${rgb}, 0.8)`);   // 边缘最实，强调边界
        
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
            opacity: 0.4,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        group.add(fill);

        // 2. 细腻的边缘亮环
        const ringGeo = new THREE.RingGeometry(radius * 0.98, radius, 64);
        const ringMat = this._createMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.6,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);

        const startTime = Date.now();
        const fadeDuration = 600; // 0.6 秒消失时间
        const anim = () => {
            const elapsed = Date.now() - startTime;
            
            if (elapsed < duration + fadeDuration) {
                // 计算淡出进度（只有当经过时间超过 duration 时才开始 > 0）
                const fadeProgress = Math.max(0, (elapsed - duration) / fadeDuration);
                
                // 呼吸动效
                const pulse = 1 + Math.sin(elapsed * 0.003) * 0.05;
                fill.scale.set(pulse, pulse, 1);
                
                // 在 duration 期间保持饱满（呼吸），在最后的 fadeDuration 内线性淡出
                fillMat.opacity = 0.4 * (1 - fadeProgress) * (0.8 + Math.sin(elapsed * 0.005) * 0.2);
                ringMat.opacity = 0.6 * (1 - fadeProgress);
                
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(group);
                texture.dispose();
                fillGeo.dispose(); fillMat.dispose();
                ringGeo.dispose(); ringMat.dispose();
            }
        };
        anim();

        // 3. 极细微的上升星光
        this.createParticleSystem({
            pos: pos.clone(),
            color: 0xffffff,
            duration: duration,
            density: 0.8,
            spawnRate: 300,
            geometry: new THREE.BoxGeometry(0.02, 0.02, 0.02),
            initFn: (p) => {
                const r = Math.sqrt(Math.random()) * radius;
                const theta = Math.random() * Math.PI * 2;
                p.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
            },
            updateFn: (p, prg) => {
                p.position.y += 0.01;
                p.material.opacity = 0.5 * (1 - prg);
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

    createDomeVFX(pos, radius, color, duration) {
        const geo = new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const mat = this._createMaterial({ color, transparent: true, opacity: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        this.scene.add(mesh);

        const start = Date.now();
        const anim = () => {
            const el = Date.now() - start;
            if (el < duration) {
                const s = 1 + Math.sin(el * 0.005) * 0.05;
                mesh.scale.set(s, s, s);
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(mesh);
                geo.dispose(); mat.dispose();
            }
        };
        anim();
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
     * 风来吴山专属特效：巨大巨剑旋风斩
     */
    createMegaWhirlwindVFX(pos, radius, color, duration, parent = null) {
        const actualParent = parent || this.scene;
        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = 0.8; // 稍微抬高一点，显得宏大
        actualParent.add(group);

        if (parent && parent.scale) {
            group.scale.set(1/parent.scale.x, 1/parent.scale.y, 1/parent.scale.z);
        }

        // 1. 核心巨剑幻影 (多个长方体模拟巨剑)
        const swordCount = 4;
        const swords = [];
        const swordGeo = new THREE.BoxGeometry(radius * 1.8, 0.2, 0.4); // 很长很宽的剑
        for (let i = 0; i < swordCount; i++) {
            const swordMat = this._createMaterial({ 
                color: color, 
                transparent: true, 
                opacity: 0.7,
                depthWrite: false 
            });
            const sword = new THREE.Mesh(swordGeo, swordMat);
            sword.rotation.y = (i * Math.PI * 2) / swordCount;
            group.add(sword);
            swords.push({ mesh: sword, mat: swordMat });
        }

        // 2. 华丽的旋转气浪
        const waveCount = 5;
        const waves = [];
        for (let i = 0; i < waveCount; i++) {
            const innerR = radius * (0.4 + i * 0.15);
            const outerR = radius * (0.7 + i * 0.15);
            const geo = new THREE.RingGeometry(innerR, outerR, 64, 1, Math.random() * Math.PI, Math.PI * 1.5);
            const mat = this._createMaterial({ 
                color: i % 2 === 0 ? color : 0xffffff, // 交替白光和金光
                transparent: true, 
                opacity: 0.4,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const wave = new THREE.Mesh(geo, mat);
            wave.rotation.x = -Math.PI / 2;
            wave.position.y = (i - 2) * 0.2; // 错落有致
            group.add(wave);
            waves.push({ mesh: wave, mat, speed: 0.2 + i * 0.05 });
        }

        // 3. 底部金色法阵
        const circleGeo = new THREE.CircleGeometry(radius, 32);
        const circleMat = this._createMaterial({ color, transparent: true, opacity: 0.15 });
        const circle = new THREE.Mesh(circleGeo, circleMat);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = -0.7;
        group.add(circle);

        const startTime = Date.now();
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const prg = elapsed / duration;

            if (prg < 1) {
                // 巨剑旋转：从 0.25 降为 0.1，让巨剑轨迹清晰可见
                group.rotation.y += 0.1;
                
                // 气浪旋转和错动：同样减速，增加厚重感
                waves.forEach(w => {
                    w.mesh.rotation.z += w.speed * 0.5;
                    w.mat.opacity = 0.4 * (1 - prg);
                });

                swords.forEach(s => {
                    s.mat.opacity = 0.7 * (1 - prg);
                });

                circleMat.opacity = 0.15 * (1 - prg);
                
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(group);
                swordGeo.dispose();
                circleGeo.dispose();
                swords.forEach(s => s.mat.dispose());
                waves.forEach(w => { w.mesh.geometry.dispose(); w.mat.dispose(); });
                circleMat.dispose();
            }
        };
        anim();

        // 4. 大量喷发粒子
        this.createParticleSystem({
            pos: pos.clone(),
            parent: actualParent,
            color: 0xffcc00,
            duration: duration,
            density: 4,
            spawnRate: 40,
            geometry: new THREE.BoxGeometry(0.15, 0.15, 0.15),
            initFn: (p) => {
                const angle = Math.random() * Math.PI * 2;
                const r = radius * Math.random();
                p.position.set(Math.cos(angle) * r, -0.5, Math.sin(angle) * r);
                p.userData.vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    0.1 + Math.random() * 0.2,
                    (Math.random() - 0.5) * 0.2
                );
            },
            updateFn: (p, prg) => {
                p.position.add(p.userData.vel);
                p.rotation.x += 0.2;
                p.rotation.y += 0.2;
                p.material.opacity = 0.8 * (1 - prg);
                p.scale.setScalar(1.5 * (1 - prg));
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

