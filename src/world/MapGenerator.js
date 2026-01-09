import { rng } from '../utils/Random.js';

/**
 * 地形类型枚举
 */
export const TILE_TYPES = {
    WATER: 'water',       // 河流 (不可通行)
    GRASS: 'grass',       // 草地 (可通行)
    MOUNTAIN: 'mountain'  // 山脉 (不可通行)
};

/**
 * 地图生成器
 * 使用柏林噪声生成逻辑蓝图
 */
export class MapGenerator {
    constructor() {
        this.size = 100;
        this.grid = [];
        this.heightMap = []; 
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * 生成地图
     */
    generate(size = 400, forcedOffsets = null) {
        this.size = size;
        this.grid = [];
        this.heightMap = [];
        
        if (forcedOffsets) {
            this.offsetX = forcedOffsets.x;
            this.offsetY = forcedOffsets.y;
        } else {
            this.offsetX = Math.random() * 5000;
            this.offsetY = Math.random() * 5000;
        }

        const baseFreq = 0.0125; 
        const border = 50; 

        for (let z = 0; z < size; z++) {
            this.grid[z] = [];
            this.heightMap[z] = [];
            for (let x = 0; x < size; x++) {
                const nx = x * baseFreq + this.offsetX;
                const nz = z * baseFreq + this.offsetY;

                const qx = rng.noise2D(nx, nz);
                const qz = rng.noise2D(nx + 5.2, nz + 1.3);

                let noise = rng.noise2D(nx + 2.0 * qx, nz + 2.0 * qz);
                noise += 0.5 * rng.noise2D(nx * 2, nz * 2);
                noise /= 1.5;

                const contrast = 1.4; 
                noise = Math.max(-1, Math.min(1, noise * contrast));

                const distFromEdge = Math.min(x, z, size - 1 - x, size - 1 - z);
                if (distFromEdge < border) {
                    const pushFactor = Math.pow((border - distFromEdge) / border, 1.2);
                    noise += pushFactor * 1.5; 
                }

                this.heightMap[z][x] = noise; 

                let type = TILE_TYPES.GRASS;
                if (noise > 0.20) {
                    type = TILE_TYPES.MOUNTAIN;
                } else if (noise < -0.15) {
                    type = TILE_TYPES.WATER;
                }
                this.grid[z][x] = type;
            }
        }

        this.pois = this.findPOICandidates(10); 
        return this.grid;
    }

    /**
     * 根据世界坐标获取地形类型
     * 实现“所见即所得”：基于三角形面片的精确判定
     */
    getTileType(worldX, worldZ) {
        const x = worldX + this.size / 2;
        const z = worldZ + this.size / 2;

        const x1 = Math.floor(x);
        const z1 = Math.floor(z);
        const x2 = x1 + 1;
        const z2 = z1 + 1;

        if (x1 < 0 || x2 >= this.size || z1 < 0 || z2 >= this.size) {
            return TILE_TYPES.MOUNTAIN;
        }

        const fx = x - x1;
        const fz = z - z1;

        let triangleVertices = [];
        // 这里的逻辑必须与 TerrainManager 生成 Geometry 的方式严格一致 (Three.js 默认切分方式)
        if (fx + fz < 1) {
            triangleVertices = [this.grid[z1][x1], this.grid[z1][x2], this.grid[z2][x1]];
        } else {
            triangleVertices = [this.grid[z2][x2], this.grid[z1][x2], this.grid[z2][x1]];
        }

        if (triangleVertices.includes(TILE_TYPES.MOUNTAIN)) return TILE_TYPES.MOUNTAIN;
        if (triangleVertices.includes(TILE_TYPES.WATER)) return TILE_TYPES.WATER;

        return TILE_TYPES.GRASS;
    }

    /**
     * 检查坐标是否为“安全的平原”
     * 要求该点及其周围 1 格范围内全部都是草地
     * 用于物品生成，防止物品出现在山坡或水边
     */
    isSafeGrass(gridX, gridZ) {
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = gridX + dx;
                const nz = gridZ + dz;
                if (nx < 0 || nx >= this.size || nz < 0 || nz >= this.size) return false;
                if (this.grid[nz][nx] !== TILE_TYPES.GRASS) return false;
            }
        }
        return true;
    }

    /**
     * 检查坐标是否可通行 (支持 2.5D 非对称半径)
     */
    isPassable(worldX, worldZ, radius = 0.25) {
        const r_side = radius;
        const r_up = radius * 1.2;
        const r_down = radius * 0.4;

        const points = [
            { x: worldX, z: worldZ },
            { x: worldX + r_side, z: worldZ },
            { x: worldX - r_side, z: worldZ },
            { x: worldX, z: worldZ - r_up },
            { x: worldX, z: worldZ + r_down }
        ];

        for (const p of points) {
            if (this.getTileType(p.x, p.z) !== TILE_TYPES.GRASS) return false;
        }
        return true;
    }

    /**
     * 寻找兴趣点 (POI)
     */
    findPOICandidates(count = 15) {
        const candidates = [];
        const step = 4;
        const border = 55;

        for (let z = border; z < this.size - border; z += step) {
            for (let x = border; x < this.size - border; x += step) {
                if (this.grid[z][x] !== TILE_TYPES.GRASS) continue;

                let r = 2;
                let isSafe = true;
                while (isSafe && r < 120) { 
                    const samples = Math.max(8, Math.floor(r * 1.5));
                    for (let i = 0; i < samples; i++) {
                        const angle = (i / samples) * Math.PI * 2;
                        const nx = Math.round(x + Math.cos(angle) * r);
                        const nz = Math.round(z + Math.sin(angle) * r);
                        if (nx < 0 || nx >= this.size || nz < 0 || nz >= this.size || 
                            this.grid[nz][nx] !== TILE_TYPES.GRASS) {
                            isSafe = false;
                            break;
                        }
                    }
                    if (isSafe) r += 2;
                    else break;
                }
                if (r >= 8) candidates.push({ x, z, radius: r, score: r });
            }
        }

        const localPeaks = candidates.filter(cand => !candidates.some(other => {
            if (cand === other) return false;
            const dist = Math.sqrt(Math.pow(cand.x - other.x, 2) + Math.pow(cand.z - other.z, 2));
            return dist < 12 && (other.score > cand.score);
        }));

        localPeaks.sort((a, b) => b.score - a.score);

        const finalPois = [];
        for (const cand of localPeaks) {
            if (!finalPois.some(p => Math.sqrt(Math.pow(p.x - cand.x, 2) + Math.pow(p.z - cand.z, 2)) < 40)) {
                finalPois.push(cand);
                if (finalPois.length >= count) break;
            }
        }
        return finalPois;
    }

    /**
     * 调试绘制
     */
    debugDraw(canvas) {
        const ctx = canvas.getContext('2d');
        const size = this.size;
        canvas.width = size;
        canvas.height = size;
        const imgData = ctx.createImageData(size, size);

        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const val = this.heightMap[z][x];
                const type = this.grid[z][x];
                const idx = (z * size + x) * 4;
                
                if (type === TILE_TYPES.MOUNTAIN) {
                    imgData.data[idx] = 100 + val * 50;
                    imgData.data[idx + 1] = 80 + val * 40;
                    imgData.data[idx + 2] = 60 + val * 30;
                } else if (type === TILE_TYPES.WATER) {
                    imgData.data[idx] = 30;
                    imgData.data[idx + 1] = 60;
                    imgData.data[idx + 2] = 150 + val * 50;
                } else {
                    imgData.data[idx] = 60 + val * 20;
                    imgData.data[idx + 1] = 120 + val * 40;
                    imgData.data[idx + 2] = 60 + val * 20;
                }
                imgData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
}

export const mapGenerator = new MapGenerator();
