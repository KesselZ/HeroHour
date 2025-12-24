import { rng } from './Random.js';

/**
 * 地形类型枚举
 */
export const TILE_TYPES = {
    WATER: 'water',       // 河流 (不可通行)
    GRASS: 'grass',       // 草地 (可通行)
    MOUNTAIN: 'mountain', // 山脉 (不可通行)
};

/**
 * 地图生成器
 * 使用柏林噪声生成逻辑蓝图
 */
export class MapGenerator {
    constructor() {
        this.size = 100;
        this.scale = 0.02; // 进一步降低基础频率，追求更长的地貌线条
        this.grid = [];
        this.heightMap = []; // 新增：记录原始噪声高度
    }

    /**
     * 生成地图
     */
    generate(size = 300) {
        this.size = size;
        this.grid = [];
        this.heightMap = [];
        
        const offsetX = Math.random() * 5000;
        const offsetY = Math.random() * 5000;

        // 回归 @s 版本的核心频率 (0.0125)
        // 这个频率配合扭曲能产生最宏大、连贯的地貌
        const baseFreq = 0.0125; 

        for (let z = 0; z < size; z++) {
            this.grid[z] = [];
            this.heightMap[z] = [];
            for (let x = 0; x < size; x++) {
                const nx = x * baseFreq + offsetX;
                const nz = z * baseFreq + offsetY;

                // 回归 @s 版本的领域扭曲逻辑：单层扭曲 (强度 2.0)
                const qx = rng.noise2D(nx, nz);
                const qz = rng.noise2D(nx + 5.2, nz + 1.3);

                let noise = rng.noise2D(nx + 2.0 * qx, nz + 2.0 * qz);
                // 叠加 0.5 权重的高频噪声，增加山体细节
                noise += 0.5 * rng.noise2D(nx * 2, nz * 2);
                noise /= 1.5;

                const contrast = 1.4; 
                noise = Math.max(-1, Math.min(1, noise * contrast));

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

        this.ensureStartingArea();
        return this.grid;
    }

    /**
     * 确保起始区域（地图中心）是平原
     */
    ensureStartingArea() {
        const center = Math.floor(this.size / 2);
        // 回归 @s 版本的安全区半径 (15)
        const radius = 15;
        for (let z = center - radius; z <= center + radius; z++) {
            for (let x = center - radius; x <= center + radius; x++) {
                if (z >= 0 && z < this.size && x >= 0 && x < this.size) {
                    this.grid[z][x] = TILE_TYPES.GRASS;
                    // 起始点高度清零，保证出生平滑
                    if (this.heightMap[z] && this.heightMap[z][x] !== undefined) {
                        this.heightMap[z][x] = 0;
                    }
                }
            }
        }
    }

    /**
     * 根据世界坐标获取地形类型
     * 假设地图中心在 (0,0)
     */
    getTileType(worldX, worldZ) {
        const gridX = Math.floor(worldX + this.size / 2);
        const gridZ = Math.floor(worldZ + this.size / 2);

        if (gridX < 0 || gridX >= this.size || gridZ < 0 || gridZ >= this.size) {
            return TILE_TYPES.MOUNTAIN; // 越界视为墙
        }

        return this.grid[gridZ][gridX];
    }

    /**
     * 检查坐标是否可通行
     */
    isPassable(worldX, worldZ) {
        const type = this.getTileType(worldX, worldZ);
        return type === TILE_TYPES.GRASS;
    }

    /**
     * 将当前的噪声图导出为 Canvas 预览
     */
    debugDraw(canvas) {
        const ctx = canvas.getContext('2d');
        const size = this.size;
        canvas.width = size;
        canvas.height = size;
        const imgData = ctx.createImageData(size, size);

        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const val = this.heightMap[z][x]; // -1 to 1
                // 映射到 0-255 灰度
                const gray = Math.floor((val + 1) / 2 * 255);
                const idx = (z * size + x) * 4;
                
                // 根据地形类型着色以便更直观
                if (val > 0.20) { // 山脉判定
                    imgData.data[idx] = gray;     // R
                    imgData.data[idx + 1] = gray * 0.8; // G (带点黄)
                    imgData.data[idx + 2] = gray * 0.5; // B
                } else if (val < -0.15) { // 河流判定
                    imgData.data[idx] = gray * 0.2;
                    imgData.data[idx + 1] = gray * 0.5;
                    imgData.data[idx + 2] = gray; // B (带点蓝)
                } else {
                    imgData.data[idx] = gray;
                    imgData.data[idx + 1] = gray;
                    imgData.data[idx + 2] = gray;
                }
                imgData.data[idx + 3] = 255; // Alpha
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
}

export const mapGenerator = new MapGenerator();
