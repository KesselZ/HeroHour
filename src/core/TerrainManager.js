import * as THREE from 'three';
import { TILE_TYPES } from './MapGenerator.js';

/**
 * 地形样式枚举
 */
export const TERRAIN_STYLES = {
    DEFAULT: 'default',
    SNOW: 'snow',
    EVIL: 'evil',
    SHENCE: 'shence',
    AUTUMN: 'autumn', // 枫华谷风格 (红衣教/邪恶势力)
    NORMAL_AUTUMN: 'normal_autumn' // 普适性秋天风格 (自然更替)
};

/**
 * 地形管理器
 * 负责地形网格的创建、高度计算、颜色填充以及动态样式切换
 */
export class TerrainManager {
    constructor() {
        this.mesh = null;
        this.geometry = null;
        this.material = null;
        this.size = 0;
        this.currentBaseStyle = TERRAIN_STYLES.DEFAULT;
        this.vertexStyles = null; // 记录每个顶点的样式
        this.vertexInfluences = null; // 记录每个顶点受特殊样式影响的权重 (0-1)
        
        // 渐变动画相关
        this.isTransitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 2.0; // 渐变持续 2 秒
        this.startColors = null; // 渐变起始颜色数组
        this.targetColors = null; // 渐变目标颜色数组
        
        // 核心颜色配置：复用并扩展原本的美术参数
        this.styleConfigs = {
            [TERRAIN_STYLES.DEFAULT]: {
                [TILE_TYPES.GRASS]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const greenVal = 0.4 + (step * 0.2);
                    return new THREE.Color().setRGB(greenVal * 0.4, greenVal, greenVal * 0.2);
                },
                [TILE_TYPES.MOUNTAIN]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const greyVal = 0.3 + (step * 0.3);
                    return new THREE.Color().setRGB(greyVal, greyVal, greyVal * 1.1);
                },
                [TILE_TYPES.WATER]: () => new THREE.Color(0x1a3a6d)
            },
            [TERRAIN_STYLES.SNOW]: {
                [TILE_TYPES.GRASS]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const v = 0.88 + (step * 0.12); 
                    
                    // 积雪质感：混合纯白积雪与透着冷气的冰蓝色影
                    // 利用高频正弦波模拟积雪表面的起伏阴影
                    const mixFactor = (Math.sin(rawNoise * 40.0) + 1) / 2;
                    
                    const pureSnow = { r: v, g: v * 0.98, b: v * 1.02 }; // 洁白略带冷
                    const iceShadow = { r: v * 0.75, g: v * 0.85, b: v * 0.95 }; // 冰蓝色阴影
                    
                    return new THREE.Color().setRGB(
                        pureSnow.r * (1 - mixFactor) + iceShadow.r * mixFactor,
                        pureSnow.g * (1 - mixFactor) + iceShadow.g * mixFactor,
                        pureSnow.b * (1 - mixFactor) + iceShadow.b * mixFactor
                    );
                },
                [TILE_TYPES.MOUNTAIN]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const v = 0.6 + (step * 0.3);
                    
                    // 雪山细节：陡峭处露出深色的寒岩
                    const rockExposure = (Math.sin(rawNoise * 15.0) + 1) / 2;
                    
                    const snowCover = { r: v * 0.95, g: v * 0.98, b: v * 1.05 }; // 覆盖的厚雪
                    const coldRock = { r: v * 0.4, g: v * 0.45, b: v * 0.55 }; // 深冷岩石
                    
                    return new THREE.Color().setRGB(
                        snowCover.r * (1 - rockExposure) + coldRock.r * rockExposure,
                        snowCover.g * (1 - rockExposure) + coldRock.g * rockExposure,
                        snowCover.b * (1 - rockExposure) + coldRock.b * rockExposure
                    );
                },
                [TILE_TYPES.WATER]: (rawNoise) => {
                    // 冰封河面：深浅不一的冻结感
                    const v = 0.6 + (Math.sin(rawNoise * 10.0) * 0.1);
                    return new THREE.Color().setRGB(v * 0.3, v * 0.5, v * 0.8); // 宝石蓝般的冻冰
                }
            },
            [TERRAIN_STYLES.EVIL]: {
                [TILE_TYPES.GRASS]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const v = 0.22 + (step * 0.12);
                    
                    // 腐蚀纹路混合逻辑：产生交错的两种深紫色纹路
                    const mixFactor = (Math.sin(rawNoise * 35.0) + 1) / 2;
                    const purpleA = { r: v * 0.7, g: v * 0.4, b: v * 1.1 };
                    const purpleB = { r: v * 0.3, g: v * 0.2, b: v * 0.6 };
                    
                    return new THREE.Color().setRGB(
                        purpleA.r * (1 - mixFactor) + purpleB.r * mixFactor,
                        purpleA.g * (1 - mixFactor) + purpleB.g * mixFactor,
                        purpleA.b * (1 - mixFactor) + purpleB.b * mixFactor
                    );
                },
                [TILE_TYPES.MOUNTAIN]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const v = 0.15 + (step * 0.18);
                    // 邪教山脉：焦黑的岩石，带有深紫色的阴影
                    return new THREE.Color().setRGB(v * 1.0, v * 0.7, v * 0.9);
                },
                [TILE_TYPES.WATER]: () => new THREE.Color(0x10051a) // 极深的紫黑色死水
            },
            [TERRAIN_STYLES.SHENCE]: {
                [TILE_TYPES.GRASS]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const v = 0.38 + (step * 0.18);
                    
                    // 战乱地面的斑驳感：混合枯萎的草皮和被践踏后的干泥
                    const mixFactor = (Math.sin(rawNoise * 22.0) + 1) / 2;
                    const witheredGrass = { r: v * 1.0, g: v * 0.85, b: v * 0.45 };
                    const dryMud = { r: v * 0.7, g: v * 0.55, b: v * 0.35 };
                    
                    return new THREE.Color().setRGB(
                        witheredGrass.r * (1 - mixFactor) + dryMud.r * mixFactor,
                        witheredGrass.g * (1 - mixFactor) + dryMud.g * mixFactor,
                        witheredGrass.b * (1 - mixFactor) + dryMud.b * mixFactor
                    );
                },
                [TILE_TYPES.MOUNTAIN]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const v = 0.25 + (step * 0.25);
                    // 战乱山脉：深灰褐色，像被熏黑的焦土
                    return new THREE.Color().setRGB(v * 0.9, v * 0.8, v * 0.7);
                },
                [TILE_TYPES.WATER]: () => new THREE.Color(0x4a4235) // 浑浊不堪的泥水
            },
            [TERRAIN_STYLES.AUTUMN]: {
                [TILE_TYPES.GRASS]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const v = 0.5 + (step * 0.2);
                    
                    // 枫华谷风格：混合金黄色和枫叶红
                    const mixFactor = (Math.sin(rawNoise * 18.0) + 1) / 2;
                    // 金黄色 (秋季草地)
                    const goldenYellow = { r: v * 1.0, g: v * 0.8, b: v * 0.2 };
                    // 枫红色 (落叶堆积)
                    const mapleRed = { r: v * 1.2, g: v * 0.3, b: v * 0.2 };
                    
                    return new THREE.Color().setRGB(
                        goldenYellow.r * (1 - mixFactor) + mapleRed.r * mixFactor,
                        goldenYellow.g * (1 - mixFactor) + mapleRed.g * mixFactor,
                        goldenYellow.b * (1 - mixFactor) + mapleRed.b * mixFactor
                    );
                },
                [TILE_TYPES.MOUNTAIN]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const v = 0.3 + (step * 0.25);
                    // 秋季山脉：暖褐色的岩石
                    return new THREE.Color().setRGB(v * 1.0, v * 0.8, v * 0.6);
                },
                [TILE_TYPES.WATER]: () => new THREE.Color(0x1a4c6d) // 清澈但深邃的蓝色，与红叶形成对比
            },
            [TERRAIN_STYLES.NORMAL_AUTUMN]: {
                [TILE_TYPES.GRASS]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const v = 0.45 + (step * 0.2);
                    
                    // 自然秋天：混合“将枯未枯的绿”与“落叶的黄褐色”
                    const mixFactor = (Math.sin(rawNoise * 25.0) + 1) / 2;
                    
                    // 1. 这种绿不再是嫩绿，而是带点灰调的暗绿 (v*0.3, v*0.5, v*0.2)
                    const fadedGreen = { r: v * 0.4, g: v * 0.55, b: v * 0.25 };
                    // 2. 这种黄是枯草和落叶的褐色 (v*0.8, v*0.6, v*0.3)
                    const dryYellow = { r: v * 0.85, g: v * 0.65, b: v * 0.35 };
                    
                    return new THREE.Color().setRGB(
                        fadedGreen.r * (1 - mixFactor) + dryYellow.r * mixFactor,
                        fadedGreen.g * (1 - mixFactor) + dryYellow.g * mixFactor,
                        fadedGreen.b * (1 - mixFactor) + dryYellow.b * mixFactor
                    );
                },
                [TILE_TYPES.MOUNTAIN]: (rawNoise) => {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const v = 0.35 + (step * 0.2);
                    // 自然秋山：土褐色，不再那么红
                    return new THREE.Color().setRGB(v * 0.8, v * 0.7, v * 0.5);
                },
                [TILE_TYPES.WATER]: () => new THREE.Color(0x2a5a7d) // 稍显深沉的蓝灰色
            }
        };
    }

    /**
     * 初始化地形
     */
    init(scene, mapData, heightMap, size) {
        this.size = size;
        this.geometry = new THREE.PlaneGeometry(size, size, size, size);
        
        const colors = [];
        const vertices = this.geometry.attributes.position.array;

        // 初始化顶点数据记录
        const vertexCount = (size + 1) * (size + 1);
        this.vertexStyles = new Array(vertexCount).fill(this.currentBaseStyle);
        this.vertexInfluences = new Float32Array(vertexCount).fill(0); // 初始权重全为 0 (纯自然)

        // 1. 复用原本的高度和基础颜色计算逻辑
        for (let z = 0; z <= size; z++) {
            for (let x = 0; x <= size; x++) {
                const gridX = Math.min(x, size - 1);
                const gridZ = Math.min(z, size - 1);
                const type = mapData[gridZ][gridX];
                const rawNoise = heightMap[gridZ][gridX];

                // --- 高度计算逻辑 (严格同步 WorldScene.js 原版) ---
                let h = 0;
                if (type === TILE_TYPES.WATER) {
                    const diff = Math.abs(rawNoise + 0.15);
                    h = -1.5 - (diff * 8.4 + Math.pow(diff, 2) * 14.0); 
                } else if (type === TILE_TYPES.MOUNTAIN) {
                    const diff = rawNoise - 0.20;
                    h = 2.0 + (diff * 14.0 + Math.pow(diff, 2) * 35.0); 
                } else {
                    h = 0;
                }
                
                const idx = (z * (size + 1) + x) * 3;
                vertices[idx + 2] = h;

                // --- 颜色计算逻辑 ---
                const color = this.getStyleColor(type, rawNoise, this.currentBaseStyle);
                colors.push(color.r, color.g, color.b);
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // 2. 复用噪点贴图生成逻辑
        const terrainTex = this.generateNoiseTexture();

        this.material = new THREE.MeshStandardMaterial({ 
            map: terrainTex,
            vertexColors: true,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        return this.mesh;
    }

    /**
     * 获取指定样式下的地形颜色
     */
    getStyleColor(type, rawNoise, style) {
        const config = this.styleConfigs[style] || this.styleConfigs[TERRAIN_STYLES.DEFAULT];
        const colorFn = config[type] || config[TILE_TYPES.GRASS];
        return colorFn(rawNoise);
    }

    /**
     * 生成维持原有美术风格的颗粒感贴图
     */
    generateNoiseTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 16; i++) {
            for (let j = 0; j < 16; j++) {
                const noise = Math.random() * 40;
                const brightness = 210 + noise;
                ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
                ctx.fillRect(i, j, 1, 1);
            }
        }
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(this.size / 4, this.size / 4); 
        return tex;
    }

    /**
     * 动态改变区域地形样式 (带平滑渐变过度)
     * @param {number} centerX 世界坐标 X
     * @param {number} centerZ 世界坐标 Z
     * @param {number} radius 半径 (世界单位)
     * @param {string} styleType 目标样式类型
     * @param {Array} mapData 地图网格数据
     * @param {Array} heightMap 噪声高度图数据
     * @param {string} baseStyleType 基础样式类型 (不传则默认使用当前季节)
     */
    setAreaStyle(centerX, centerZ, radius, styleType, mapData, heightMap, baseStyleType = null) {
        if (!this.geometry) return;
        
        const colors = this.geometry.attributes.color.array;
        const actualBaseStyle = baseStyleType || this.currentBaseStyle;
        // 增加渐变带宽度到 30%，让过渡更舒缓
        const featherWidth = radius * 0.3; 
        const innerRadius = radius - featherWidth;

        for (let z = 0; z <= this.size; z++) {
            for (let x = 0; x <= this.size; x++) {
                const worldX = x - this.size / 2;
                const worldZ = z - this.size / 2;
                
                const dx = worldX - centerX;
                const dz = worldZ - centerZ;
                const dist = Math.sqrt(dx * dx + dz * dz);

                const gx = Math.min(x, this.size - 1);
                const gz = Math.min(z, this.size - 1);
                const rawNoise = heightMap[gz][gx];
                
                // --- 核心优化：噪声扰动边界 ---
                // 利用地形自带的柏林噪声 perturb 距离，使边界呈现出自然的有机形态，而非死板的圆圈
                const noisePerturbation = rawNoise * 6.0; 
                const perturbedDist = dist + noisePerturbation;

                if (perturbedDist <= radius) {
                    const type = mapData[gz][gx];
                    const targetColor = this.getStyleColor(type, rawNoise, styleType);
                    
                    let finalColor;
                    if (perturbedDist <= innerRadius) {
                        // 内部区域：完全应用目标颜色
                        finalColor = targetColor;
                    } else {
                        // 边缘渐变区域：混合基础颜色和目标颜色
                        const baseColor = this.getStyleColor(type, rawNoise, actualBaseStyle);
                        const t = (perturbedDist - innerRadius) / featherWidth; 
                        const clampedT = Math.max(0, Math.min(1, t));
                        
                        finalColor = new THREE.Color().setRGB(
                            targetColor.r * (1 - clampedT) + baseColor.r * clampedT,
                            targetColor.g * (1 - clampedT) + baseColor.g * clampedT,
                            targetColor.b * (1 - clampedT) + baseColor.b * clampedT
                        );
                    }
                    
                    const vertexIdx = (z * (this.size + 1) + x);
                    const influence = 1 - Math.max(0, Math.min(1, (perturbedDist - innerRadius) / featherWidth));

                    if (influence > this.vertexInfluences[vertexIdx]) {
                        this.vertexStyles[vertexIdx] = styleType;
                        this.vertexInfluences[vertexIdx] = influence;
                    }
                    
                    const idx = vertexIdx * 3;
                    colors[idx] = finalColor.r;
                    colors[idx + 1] = finalColor.g;
                    colors[idx + 2] = finalColor.b;
                }
            }
        }
        this.geometry.attributes.color.needsUpdate = true;
    }

    /**
     * 全局切换基础季节样式 (带平滑渐变)
     */
    setGlobalStyle(styleType, mapData, heightMap) {
        if (!this.geometry || this.isTransitioning) return;
        
        this.currentBaseStyle = styleType;
        const colors = this.geometry.attributes.color.array;
        
        this.startColors = new Float32Array(colors);
        this.targetColors = new Float32Array(colors.length);
        
        for (let z = 0; z <= this.size; z++) {
            for (let x = 0; x <= this.size; x++) {
                const vertexIdx = (z * (this.size + 1) + x);
                const gx = Math.min(x, this.size - 1);
                const gz = Math.min(z, this.size - 1);
                const type = mapData[gz][gx];
                const rawNoise = heightMap[gz][gx];
                const influence = this.vertexInfluences[vertexIdx];

                // 无论该点是否被特殊地块占据，都先计算出它在当前季节该有的颜色
                const seasonalColor = this.getStyleColor(type, rawNoise, styleType);
                let finalColor = seasonalColor;

                if (influence > 0) {
                    // 如果被特殊样式占据，则执行动态混合：(新季节颜色 * (1-权重) + 特殊颜色 * 权重)
                    const specialColor = this.getStyleColor(type, rawNoise, this.vertexStyles[vertexIdx]);
                    finalColor = new THREE.Color().copy(seasonalColor).lerp(specialColor, influence);
                }

                const idx = vertexIdx * 3;
                this.targetColors[idx] = finalColor.r;
                this.targetColors[idx + 1] = finalColor.g;
                this.targetColors[idx + 2] = finalColor.b;
            }
        }

        this.isTransitioning = true;
        this.transitionProgress = 0;
    }

    /**
     * 每帧更新渐变动画
     */
    update(deltaTime) {
        if (!this.isTransitioning) return;

        this.transitionProgress += deltaTime / this.transitionDuration;
        const t = Math.min(1.0, this.transitionProgress);
        
        // 使用简单的 Easing 让过渡更平滑 (SmoothStep)
        const easeT = t * t * (3 - 2 * t);
        
        const colors = this.geometry.attributes.color.array;
        for (let i = 0; i < colors.length; i++) {
            colors[i] = this.startColors[i] + (this.targetColors[i] - this.startColors[i]) * easeT;
        }
        
        this.geometry.attributes.color.needsUpdate = true;

        if (t >= 1.0) {
            this.isTransitioning = false;
            this.startColors = null;
            this.targetColors = null;
        }
    }
}

export const terrainManager = new TerrainManager();

