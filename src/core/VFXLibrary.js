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

    createTornadoVFX(pos, radius, color, duration, parent = null) {
        this.createParticleSystem({
            pos, parent, color, duration, density: 2,
            spawnRate: 50,
            geometry: new THREE.TorusGeometry(radius * 0.5, 0.05, 8, 24),
            initFn: p => { p.rotation.x = Math.PI / 2; p.userData.yPos = 0; },
            updateFn: (p, prg) => {
                p.rotation.z += 0.2;
                p.userData.yPos += 0.1;
                p.position.y = p.userData.yPos;
                p.scale.setScalar(1 + prg * 2);
                p.material.opacity = 0.6 * (1 - prg);
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
        const vfx = new THREE.Group();
        
        // 核心修复：如果挂载在单位身上，抵消掉单位的缩放，确保 radius 是绝对物理半径
        if (parent && parent.scale) {
            vfx.scale.set(1/parent.scale.x, 1/parent.scale.y, 1/parent.scale.z);
        }

        const bladeGeo = new THREE.BoxGeometry(radius, 0.08, 0.2);
        const bladeMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        // 刀锋中心偏移 radius/2，让旋转半径刚好等于 radius
        blade.position.x = radius / 2;
        vfx.add(blade);
        vfx.position.copy(pos).y = 0.4;
        actualParent.add(vfx);

        const start = Date.now();
        const anim = () => {
            const prg = (Date.now() - start) / duration;
            if (prg < 1) {
                vfx.rotation.y = prg * Math.PI * 4;
                bladeMat.opacity = 0.8 * (1 - prg);
                requestAnimationFrame(anim);
            } else {
                actualParent.remove(vfx);
                bladeGeo.dispose(); bladeMat.dispose();
            }
        };
        anim();
    }
}

