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
                const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
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
        group.position.y = 0.05;
        this.scene.add(group);

        const ringGeo = new THREE.TorusGeometry(radius, 0.04, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const fillGeo = new THREE.CircleGeometry(radius, 32);
        const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 });
        const fill = new THREE.Mesh(fillGeo, fillMat);
        fill.rotation.x = -Math.PI / 2;
        group.add(fill);

        const runeGeo = new THREE.RingGeometry(radius * 0.4, radius * 0.9, 4, 1, 0, Math.PI * 2);
        const runeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, wireframe: true });
        const rune = new THREE.Mesh(runeGeo, runeMat);
        rune.rotation.x = -Math.PI / 2;
        rune.position.y = 0.01;
        group.add(rune);

        const startTime = Date.now();
        const anim = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            if (progress < 1) {
                rune.rotation.z += 0.01;
                fillMat.opacity = 0.1 * (1 + Math.sin(elapsed * 0.005) * 0.5);
                requestAnimationFrame(anim);
            } else {
                this.scene.remove(group);
                ringGeo.dispose(); ringMat.dispose();
                fillGeo.dispose(); fillMat.dispose();
                runeGeo.dispose(); runeMat.dispose();
            }
        };
        anim();

        this.createParticleSystem({
            pos: pos.clone(),
            color: color,
            duration: duration,
            density: 1.5,
            spawnRate: 200,
            geometry: new THREE.BoxGeometry(0.02, 0.5, 0.02),
            initFn: (p) => {
                const r = Math.sqrt(Math.random()) * radius;
                const theta = Math.random() * Math.PI * 2;
                p.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
            },
            updateFn: (p, prg) => {
                p.position.y += 0.02;
                p.material.opacity = 0.4 * (1 - prg);
                p.scale.y = 1 - prg;
            }
        });
    }

    createPulseVFX(pos, radius, color, duration, parent = null) {
        const actualParent = parent || this.scene;
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const geo = new THREE.RingGeometry(0.1, 0.15, 64);
                const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
                const ring = new THREE.Mesh(geo, mat);
                ring.rotation.x = -Math.PI / 2;
                ring.position.copy(pos).y = 0.1 + i * 0.05;
                actualParent.add(ring);

                const start = Date.now();
                const anim = () => {
                    const prg = (Date.now() - start) / (duration * 0.8);
                    if (prg < 1) {
                        const s = 1 + prg * (radius * 10); 
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
            spawnRate: 80,
            geometry: new THREE.BoxGeometry(0.04, 1.5, 0.04),
            initFn: p => {
                p.position.set((Math.random()-0.5)*radius*2, 15 + Math.random()*5, (Math.random()-0.5)*radius*2);
                p.rotation.z = (Math.random()-0.5) * 0.2;
            },
            updateFn: (p, prg) => {
                p.position.y -= (0.6 + Math.random()*0.4) * speed;
                if (p.position.y < 0) p.position.y = -100;
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
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: l.opacity });
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
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x554433, transparent: true, opacity: 0.6, depthWrite: false });
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
            color: 0x887766, // 泥土颜色
            duration: 500,
            density: 10.0, // 数量提升 5 倍 (之前是 2.0)
            spawnRate: 30, // 频率提高 (之前是 50)
            geometry: new THREE.BoxGeometry(0.12, 0.12, 0.12),
            initFn: (p) => {
                const r = Math.random() * radius;
                const theta = Math.random() * Math.PI * 2;
                p.position.set(Math.cos(theta) * r, 0, Math.sin(theta) * r);
                p.userData.velY = 0.15 + Math.random() * 0.15; // 爆发力增强
                p.rotation.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
            },
            updateFn: (p, prg) => {
                // 向上跳起后落下
                p.position.y += p.userData.velY;
                p.userData.velY -= 0.01; // 简单的重力模拟
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
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
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
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
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
            const mat = new THREE.MeshBasicMaterial({ 
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
        const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 });
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
            const swordMat = new THREE.MeshBasicMaterial({ 
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
            const mat = new THREE.MeshBasicMaterial({ 
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
        const circleMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 });
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
            const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
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
}

