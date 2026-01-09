import * as THREE from 'three';
import { rng } from '../utils/Random.js';

/**
 * 环境管理基类
 */
export class BaseEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.objects = [];
    }

    init() { }

    /**
     * [性能加固] 深度清理资源，防止纹理导致的内存泄漏
     */
    cleanup() {
        this.objects.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(m => {
                    if (m.map) m.map.dispose(); // 显式销毁贴图
                    m.dispose();
                });
            }
            this.scene.remove(obj);
        });
        this.objects = [];
    }

    /**
     * 共享的山脉生成逻辑
     */
    _createSharedMountains(config) {
        const { 
            rockColor = '#4a2c1a', 
            topColor = '#2d4c2d', 
            snowCover = 0, 
            jitter = 2.0,
            count = 18 
        } = config;

        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = rockColor; 
        ctx.fillRect(0, 0, 128, 256);
        
        for (let i = 0; i < 30; i++) {
            const y = rng.next() * 256;
            ctx.fillStyle = `rgba(0, 0, 0, 0.15)`;
            ctx.fillRect(0, y, 128, 2 + rng.next() * 6);
        }
        
        const grad = ctx.createLinearGradient(0, 0, 0, 180);
        if (snowCover > 0) {
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(snowCover, '#ffffff');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
        } else {
            grad.addColorStop(0, topColor);
            grad.addColorStop(0.6, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 180);

        const mtTex = new THREE.CanvasTexture(canvas);
        const mtMat = new THREE.MeshStandardMaterial({ 
            map: mtTex, 
            flatShading: true, 
            roughness: 0.8 
        });
        
        for (let i = 0; i < count; i++) {
            const h = 10 + rng.next() * 15;
            const r = 6 + rng.next() * 10;
            const geo = new THREE.ConeGeometry(r, h, 8, 4);
            const posAttr = geo.attributes.position;
            
            for (let j = 0; j < posAttr.count; j++) {
                const y = posAttr.getY(j);
                if (y > -h/2 + 1 && y < h/2 - 1) {
                    posAttr.setX(j, posAttr.getX(j) + (rng.next() - 0.5) * jitter);
                    posAttr.setZ(j, posAttr.getZ(j) + (rng.next() - 0.5) * jitter);
                }
            }
            geo.computeVertexNormals();

            const mt = new THREE.Mesh(geo, mtMat);
            const x = -70 + i * (140/count) + (rng.next() - 0.5) * 10;
            const z = -18 - rng.next() * 15;
            mt.position.set(x, h/2 - 1, z);
            mt.rotation.y = rng.next() * Math.PI;
            mt.rotation.x = (rng.next() - 0.5) * 0.15;
            
            this.scene.add(mt);
            this.objects.push(mt);
        }
    }

    _drawSeamlessPatch(ctx, size, x, y, radius, color) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cx = x + dx * size;
                const cy = y + dy * size;
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
                grad.addColorStop(0, color);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

/**
 * 场景：青山绿水（草地战场）
 */
export class GrasslandEnvironment extends BaseEnvironment {
    init() {
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.02);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        const sunLight = new THREE.DirectionalLight(0xfff5e1, 3.0);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        this.scene.add(ambientLight, sunLight);
        this.objects.push(ambientLight, sunLight);

        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#4a7a3a'; 
        ctx.fillRect(0, 0, 512, 512);

        // [性能优化] 批处理草地线条绘制
        ctx.beginPath();
        for (let i = 0; i < 10000; i++) {
            const x = rng.next() * 512; const y = rng.next() * 512;
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 2 + rng.next() * 3);
        }
        ctx.strokeStyle = 'rgba(40, 80, 30, 0.3)';
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 5);
        
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 50), new THREE.MeshStandardMaterial({ map: texture }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.objects.push(ground);

        this._createSharedMountains({ rockColor: '#1e351e', topColor: '#2d4c2d' });
    }
}

/**
 * 场景：枫林尽染（秋天战场）
 */
export class AutumnEnvironment extends BaseEnvironment {
    init() {
        this.scene.background = new THREE.Color(0xb0c4de);
        this.scene.fog = new THREE.FogExp2(0xb0c4de, 0.01); 

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        const sunLight = new THREE.DirectionalLight(0xfff5e1, 2.5);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        this.scene.add(ambientLight, sunLight);
        this.objects.push(ambientLight, sunLight);

        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');

        // 1. 底色
        ctx.fillStyle = '#6b7045'; 
        ctx.fillRect(0, 0, size, size);

        // 2. [性能优化] 路径批处理绘制干草：大幅降低 CPU 负担
        const drawGrassBatch = (color, count) => {
            ctx.beginPath();
            ctx.strokeStyle = color;
            for (let i = 0; i < count; i++) {
                const x = rng.next() * size;
                const y = rng.next() * size;
                const len = 2 + rng.next() * 3;
                const angle = rng.next() * Math.PI;
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            }
            ctx.stroke();
        };
        drawGrassBatch('#7d7a4a', 15000); // 浅枯草
        drawGrassBatch('#5a5e3a', 15000); // 深枯草

        // 3. 绘制落叶
        const colors = ['#a0522d', '#8b4513', '#cd853f', '#d2691e', '#b22222'];
        for (let i = 0; i < 120; i++) {
            const px = rng.next() * size;
            const py = rng.next() * size;
            const patchRadius = 10 + rng.next() * 30;
            const leafColor = colors[Math.floor(rng.next() * colors.length)];
            const leafDensity = 15 + Math.floor(rng.next() * 20);
            
            ctx.fillStyle = leafColor;
            for (let j = 0; j < leafDensity; j++) {
                const lx = px + (rng.next() - 0.5) * patchRadius * 2;
                const ly = py + (rng.next() - 0.5) * patchRadius * 2;
                const lSize = 1 + rng.next() * 2;
                // 利用循环包裹逻辑进行无缝绘制
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        ctx.fillRect((lx + dx * size) % size, (ly + dy * size) % size, lSize, lSize);
                    }
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(6, 3);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 50), new THREE.MeshStandardMaterial({ map: texture, roughness: 1.0 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.objects.push(ground);

        this._createSharedMountains({ rockColor: '#5c4033', topColor: '#8b4513', jitter: 2.2 });
    }
}

/**
 * 场景：银装素裹（冬天战场）
 */
export class WinterEnvironment extends BaseEnvironment {
    init() {
        this.scene.background = new THREE.Color(0xe0efff);
        this.scene.fog = new THREE.FogExp2(0xe0efff, 0.02); 

        const ambientLight = new THREE.AmbientLight(0xddeeff, 0.7);
        const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(-20, 15, 10);
        sunLight.castShadow = true;
        this.scene.add(ambientLight, sunLight);
        this.objects.push(ambientLight, sunLight);

        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#3d4531'; 
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 120; i++) {
            const x = rng.next() * size;
            const y = rng.next() * size;
            const radius = 10 + rng.next() * 45;
            this._drawSeamlessPatch(ctx, size, x, y, radius, 'rgba(240, 248, 255, 0.8)');
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 2);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 50), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.objects.push(ground);

        this._createSharedMountains({ rockColor: '#2c3e50', snowCover: 0.4, jitter: 3.0 });
    }
}
