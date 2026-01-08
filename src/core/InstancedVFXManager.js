import * as THREE from 'three';

/**
 * InstancedVFXManager: 集中管理所有相似视觉特效的实例化渲染
 * 目前支持：地面空心圆环、地面实心圆、通用立方体粒子系统
 */
class InstancedVFXManager {
    constructor() {
        this.maxRings = 2000;
        this.maxParticles = 6000;
        
        this.ringMesh = null;      // 空心环 (用于 Pulse, Slow 等)
        this.solidMesh = null;     // 实心圆 (用于阵营环, Stomp 等)
        this.particleMesh = null;  // 粒子
        this.scene = null;

        // 槽位管理
        this.UNIT_RING_START = 0;      // 0-999: 单位阵营环 (使用 solidMesh)
        this.EFFECT_RING_START = 1000; // 1000-1999: 临时圆环 (按需分配)
        
        this.activeRings = [];
        this.activeParticles = [];
        
        // 辅助对象
        this.dummy = new THREE.Object3D();
        this.tempColor = new THREE.Color();
        this.isInitialized = false;

        // 性能优化：粒子代理对象池
        this.proxyPool = [];
    }

    /**
     * 初始化所有实例化 Mesh
     */
    init(scene) {
        if (!scene) return;

        // 【核心修复】检查核心 Mesh 是否还在场景中且未被销毁
        const needsReset = !this.ringMesh || !this.ringMesh.parent || 
                          !this.solidMesh || !this.solidMesh.parent ||
                          !this.particleMesh || !this.particleMesh.parent;

        if (this.isInitialized && (this.scene !== scene || needsReset)) {
            this.isInitialized = false;
            this.activeRings = [];
            this.activeParticles = [];
        }

        if (this.isInitialized) return;
        this.scene = scene;

        const commonGeo = new THREE.PlaneGeometry(1, 1);

        // --- 1. 初始化空心圆环 Mesh ---
        const ringCanvas = document.createElement('canvas');
        ringCanvas.width = 128; ringCanvas.height = 128;
        const rCtx = ringCanvas.getContext('2d');
        rCtx.strokeStyle = 'white';
        // 【精准还原】对齐 RingGeometry(0.1, 0.15) 的内外径比例 (0.1/0.15 = 2/3)
        // 外径 64px, 内径 42.66px -> 线宽 21.34px -> 绘制半径 53.33px
        rCtx.lineWidth = 21.5; 
        rCtx.beginPath(); rCtx.arc(64, 64, 53.25, 0, Math.PI * 2); rCtx.stroke();
        const ringTex = new THREE.CanvasTexture(ringCanvas);

        const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false });
        this._injectAlphaSupport(ringMat);

        const ringAlphas = new Float32Array(this.maxRings);
        commonGeo.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(ringAlphas, 1));

        this.ringMesh = new THREE.InstancedMesh(commonGeo, ringMat, this.maxRings);
        this.ringMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.ringMesh.frustumCulled = false;
        this.ringMesh.renderOrder = -1;
        this.scene.add(this.ringMesh);

        // --- 2. 初始化实心圆 Mesh ---
        const solidCanvas = document.createElement('canvas');
        solidCanvas.width = 128; solidCanvas.height = 128;
        const sCtx = solidCanvas.getContext('2d');
        sCtx.fillStyle = 'white';
        // 【精准还原】填满整个 Canvas，确保 scale=1 时半径正好是 0.5
        sCtx.beginPath(); sCtx.arc(64, 64, 64, 0, Math.PI * 2); sCtx.fill();
        const solidTex = new THREE.CanvasTexture(solidCanvas);

        const solidMat = new THREE.MeshBasicMaterial({ map: solidTex, transparent: true, depthWrite: false });
        this._injectAlphaSupport(solidMat);

        const solidAlphas = new Float32Array(this.maxRings);
        const solidGeo = new THREE.PlaneGeometry(1, 1);
        solidGeo.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(solidAlphas, 1));

        this.solidMesh = new THREE.InstancedMesh(solidGeo, solidMat, this.maxRings);
        this.solidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.solidMesh.frustumCulled = false;
        this.solidMesh.renderOrder = -1;
        this.scene.add(this.solidMesh);

        // --- 3. 初始化粒子 Mesh ---
        const pGeo = new THREE.BoxGeometry(1, 1, 1);
        const pMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
        this._injectAlphaSupport(pMat);

        const pAlphas = new Float32Array(this.maxParticles);
        pGeo.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(pAlphas, 1));

        this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.maxParticles);
        this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.particleMesh.frustumCulled = false;
        this.scene.add(this.particleMesh);

        this.isInitialized = true;
    }

    _injectAlphaSupport(material) {
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = `
                attribute float instanceAlpha;
                varying float vInstanceAlpha;
                ${shader.vertexShader}
            `.replace(`void main() {`, `void main() { vInstanceAlpha = instanceAlpha;`);
            shader.fragmentShader = `
                varying float vInstanceAlpha;
                ${shader.fragmentShader}
            `.replace(
                `vec4 diffuseColor = vec4( diffuse, opacity );`,
                `vec4 diffuseColor = vec4( diffuse, opacity * vInstanceAlpha );`
            );
        };
    }

    update(units = []) {
        if (!this.isInitialized) return;
        const now = Date.now();
        this._updateRings(units, now);
        this._updateParticles(now);
    }

    _updateRings(units, now) {
        const ringAlphas = this.ringMesh.geometry.attributes.instanceAlpha.array;
        const solidAlphas = this.solidMesh.geometry.attributes.instanceAlpha.array;

        // 1. 单位阵营环 (永远使用 solidMesh)
        for (let i = 0; i < 1000; i++) {
            if (i < units.length) {
                const u = units[i];
                if (u.ringOpacity > 0.001) {
                    this.dummy.position.set(u.position.x, 0.01, u.position.z);
                    this.dummy.rotation.set(-Math.PI / 2, 0, 0);
                    const s = 2.5 * (u.ringScale || 1.0);
                    this.dummy.scale.set(s, s, 1);
                    this.dummy.updateMatrix();
                    this.solidMesh.setMatrixAt(i, this.dummy.matrix);
                    this.tempColor.setHex(u.side === 'player' ? 0x4488ff : 0xff4444);
                    this.solidMesh.setColorAt(i, this.tempColor);
                    solidAlphas[i] = u.ringOpacity;
                    
                    // 【重要】确保对应的 ringMesh 槽位被隐藏
                    this._hideInstance(this.ringMesh, i, ringAlphas);
                } else {
                    this._hideInstance(this.solidMesh, i, solidAlphas);
                    this._hideInstance(this.ringMesh, i, ringAlphas);
                }
            } else {
                this._hideInstance(this.solidMesh, i, solidAlphas);
                this._hideInstance(this.ringMesh, i, ringAlphas);
            }
        }

        // 2. 临时特效圆环 (支持 hollow 或 solid)
        for (let i = 0; i < 1000; i++) {
            const slotIdx = this.EFFECT_RING_START + i;
            const effect = this.activeRings[i];

            if (effect) {
                const elapsed = now - effect.startTime;
                const prg = effect.duration > 0 ? Math.min(1.0, elapsed / effect.duration) : 0;

                if (prg >= 1.0 && effect.duration > 0) {
                    this.activeRings[i] = null;
                    this._hideInstance(this.ringMesh, slotIdx, ringAlphas);
                    this._hideInstance(this.solidMesh, slotIdx, solidAlphas);
                    continue;
                }

                let pos = effect.pos;
                if (effect.parent && effect.parent.position && !effect.parent.isScene) pos = effect.parent.position;

                this.dummy.position.set(pos.x, effect.yOffset || 0.02, pos.z);
                this.dummy.rotation.set(-Math.PI / 2, 0, 0);

                let s = effect.radius * 2;
                let opacity = effect.opacity;

                if (effect.type === 'pulse') {
                    // 【精准还原】使用自定义扩张系数，原本 pulse 的 radius 参数其实是扩张倍率
                    const exp = effect.expansion !== undefined ? effect.expansion : 0.5;
                    s *= (1 + prg * exp);
                    opacity *= (1 - prg);
                } else if (effect.type === 'breathe') {
                    s *= (1 + Math.sin(now * 0.005) * 0.1);
                }

                this.dummy.scale.set(s, s, 1);
                this.dummy.updateMatrix();

                // 根据类型选择对应的 Mesh
                const targetMesh = effect.isHollow ? this.ringMesh : this.solidMesh;
                const targetAlphas = effect.isHollow ? ringAlphas : solidAlphas;
                const otherMesh = effect.isHollow ? this.solidMesh : this.ringMesh;
                const otherAlphas = effect.isHollow ? solidAlphas : ringAlphas;

                targetMesh.setMatrixAt(slotIdx, this.dummy.matrix);
                this.tempColor.set(effect.color);
                targetMesh.setColorAt(slotIdx, this.tempColor);
                targetAlphas[slotIdx] = opacity;

                // 确保另一个 Mesh 的对应槽位是隐藏的
                this._hideInstance(otherMesh, slotIdx, otherAlphas);
            } else {
                this._hideInstance(this.ringMesh, slotIdx, ringAlphas);
                this._hideInstance(this.solidMesh, slotIdx, solidAlphas);
            }
        }

        this.ringMesh.instanceMatrix.needsUpdate = true;
        this.ringMesh.geometry.attributes.instanceAlpha.needsUpdate = true;
        this.solidMesh.instanceMatrix.needsUpdate = true;
        this.solidMesh.geometry.attributes.instanceAlpha.needsUpdate = true;
        if (this.ringMesh.instanceColor) this.ringMesh.instanceColor.needsUpdate = true;
        if (this.solidMesh.instanceColor) this.solidMesh.instanceColor.needsUpdate = true;
    }

    _updateParticles(now) {
        const alphas = this.particleMesh.geometry.attributes.instanceAlpha.array;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.activeParticles[i];
            if (p) {
                const elapsed = now - p.startTime;
                const prg = elapsed / p.duration;
                if (prg >= 1.0) {
                    this._releaseProxy(p.proxy);
                    this.activeParticles[i] = null;
                    this._hideInstance(this.particleMesh, i, alphas);
                    continue;
                }
                p.updateFn(p.proxy, prg);
                const finalPos = p.proxy.position.clone();
                if (p.groupPos) finalPos.add(p.groupPos);
                this.dummy.position.copy(finalPos);
                this.dummy.rotation.copy(p.proxy.rotation);
                this.dummy.scale.copy(p.proxy.scale).multiply(p.baseScale);
                this.dummy.updateMatrix();
                this.particleMesh.setMatrixAt(i, this.dummy.matrix);
                this.particleMesh.setColorAt(i, p.proxy.material.color);
                alphas[i] = p.proxy.material.opacity;
            } else {
                this._hideInstance(this.particleMesh, i, alphas);
            }
        }
        this.particleMesh.instanceMatrix.needsUpdate = true;
        this.particleMesh.geometry.attributes.instanceAlpha.needsUpdate = true;
        if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }

    _hideInstance(mesh, index, alphas) {
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(index, this.dummy.matrix);
        if (alphas) alphas[index] = 0;
    }

    _getProxy() {
        let proxy = this.proxyPool.pop();
        if (!proxy) {
            proxy = {
                position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1),
                userData: {}, material: { color: new THREE.Color(), opacity: 1 }
            };
        }
        proxy.position.set(0, 0, 0); proxy.rotation.set(0, 0, 0); proxy.scale.set(1, 1, 1);
        proxy.userData = {}; proxy.material.color.set(0xffffff); proxy.material.opacity = 1;
        return proxy;
    }

    _releaseProxy(proxy) { this.proxyPool.push(proxy); }

    spawnParticle(config) {
        const { duration, color, initFn, updateFn, groupPos, geometryScale } = config;
        let slot = -1;
        for (let i = 0; i < this.maxParticles; i++) { if (!this.activeParticles[i]) { slot = i; break; } }
        if (slot === -1) return;
        const proxy = this._getProxy();
        proxy.material.color.set(color);
        const baseScale = geometryScale ? geometryScale.clone() : new THREE.Vector3(0.1, 0.1, 0.1);
        initFn(proxy);
        this.activeParticles[slot] = { proxy, baseScale, startTime: Date.now(), duration, updateFn, groupPos };
    }

    spawnEphemeralRing(config) {
        const { pos = new THREE.Vector3(), parent = null, radius = 1.0, color = 0xffffff, duration = 1000, opacity = 0.6, type = 'pulse', yOffset = 0.02, isHollow = true, expansion = 0.5 } = config;
        let slotIdx = -1;
        for (let i = 0; i < 1000; i++) {
            if (!this.activeRings[i]) { slotIdx = i; break; }
        }
        if (slotIdx === -1) return;
        this.activeRings[slotIdx] = { pos: pos.clone(), parent, radius, color, duration, opacity, type, yOffset, isHollow, expansion, startTime: Date.now() };
        return slotIdx + this.EFFECT_RING_START;
    }

    stopEffect(slotIdx) {
        if (slotIdx === undefined || slotIdx === null) return;
        const idx = slotIdx - this.EFFECT_RING_START;
        if (idx >= 0 && idx < 1000 && this.activeRings[idx]) this.activeRings[idx] = null;
    }
}

export const instancedVFXManager = new InstancedVFXManager();
