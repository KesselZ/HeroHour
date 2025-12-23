import * as THREE from 'three';
import { rng } from '../core/Random.js';

/**
 * 环境管理基类
 */
export class BaseEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.objects = [];
    }

    init() {
        // 子类实现具体环境初始化
    }

    cleanup() {
        this.objects.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
            this.scene.remove(obj);
        });
        this.objects = [];
    }
}

/**
 * 第一种场景：青山绿水（草地战场）
 */
export class GrasslandEnvironment extends BaseEnvironment {
    constructor(scene) {
        super(scene);
    }

    init() {
        // 1. 天空盒与背景美化
        this.setupSky();

        // 2. 地面：生成动态颗粒感的草地贴图
        this.createProceduralGrass();

        // 3. 远景：更优美的群山
        this.createMountains();

        // 4. 灯光美化：温暖的武侠黄昏/清晨感
        this.setupLighting();
    }

    setupSky() {
        // 设置一个优美的渐变天空背景
        this.scene.background = new THREE.Color(0x87ceeb); // 天蓝色
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.02); // 加入大气雾化效果
    }

    setupLighting() {
        // 温暖的主光源
        const sunLight = new THREE.DirectionalLight(0xfff5e1, 1.2);
        sunLight.position.set(20, 30, 10);
        sunLight.castShadow = true;
        // 提升阴影质量
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);
        this.objects.push(sunLight);

        // 补光，让阴影不至于全黑
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7a3a, 0.6);
        this.scene.add(hemisphereLight);
        this.objects.push(hemisphereLight);
    }

    createProceduralGrass() {
        // 创建一个 Canvas 来生成程序化草地纹理
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 填充基础绿
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(0, 0, 512, 512);

        // 使用 seeded rng 生成固定的草地颗粒
        for (let i = 0; i < 20000; i++) {
            const x = rng.next() * 512;
            const y = rng.next() * 512;
            const h = 1 + rng.next() * 3;
            const g = 80 + rng.next() * 40;
            ctx.fillStyle = `rgb(40, ${g}, 30)`;
            ctx.fillRect(x, y, 2, h);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        // 关键：为了像素感和颗粒感
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        // 增加重复次数，让地面看起来很大
        texture.repeat.set(10, 5);

        // 创建非常长的地面，避免看到左右边界
        const groundGeo = new THREE.PlaneGeometry(100, 30); 
        const groundMat = new THREE.MeshStandardMaterial({ 
            map: texture,
            roughness: 1,
            metalness: 0
        });
        
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.objects.push(ground);
    }

    createMountains() {
        // 使用更自然的群山色调
        const mtMat = new THREE.MeshStandardMaterial({ 
            color: 0x1e351e,
            flatShading: true 
        });
        
        // 放置两排山脉，增加层次感
        for (let i = 0; i < 15; i++) {
            const h = 8 + rng.next() * 12;
            const r = 5 + rng.next() * 8;
            const geo = new THREE.ConeGeometry(r, h, 4);
            const mt = new THREE.Mesh(geo, mtMat);
            
            // 随机分布在远方
            const x = -60 + i * 10 + (rng.next() - 0.5) * 5;
            const z = -15 - rng.next() * 10;
            mt.position.set(x, h/2 - 1, z);
            mt.rotation.y = rng.next() * Math.PI;
            this.scene.add(mt);
            this.objects.push(mt);
        }
    }
}
