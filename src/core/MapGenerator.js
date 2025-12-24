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
        this.scale = 0.1; // 噪声缩放系数
        this.grid = [];   // 二维数组存储地形
    }

    /**
     * 生成地图
     * @param {number} size 地图边长
     */
    generate(size = 100) {
        this.size = size;
        this.grid = [];
        
        // 随机种子由 rng 维护
        const offsetX = rng.nextFloat(0, 1000);
        const offsetY = rng.nextFloat(0, 1000);

        for (let z = 0; z < size; z++) {
            this.grid[z] = [];
            for (let x = 0; x < size; x++) {
                // 获取噪声值 (-1 到 1)
                const noise = rng.noise2D((x + offsetX) * this.scale, (z + offsetY) * this.scale);
                
                // 根据高度划分地形
                let type = TILE_TYPES.GRASS;
                if (noise < -0.35) {
                    type = TILE_TYPES.WATER;
                } else if (noise > 0.45) {
                    type = TILE_TYPES.MOUNTAIN;
                }
                
                this.grid[z][x] = type;
            }
        }

        // 确保起始点（通常是中心或固定坐标）周围是草地，防止主城被埋在水里或山上
        this.ensureStartingArea();

        return this.grid;
    }

    /**
     * 确保起始区域（地图中心）是平原
     */
    ensureStartingArea() {
        const center = Math.floor(this.size / 2);
        const radius = 5;
        for (let z = center - radius; z <= center + radius; z++) {
            for (let x = center - radius; x <= center + radius; x++) {
                if (z >= 0 && z < this.size && x >= 0 && x < this.size) {
                    this.grid[z][x] = TILE_TYPES.GRASS;
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
}

export const mapGenerator = new MapGenerator();

