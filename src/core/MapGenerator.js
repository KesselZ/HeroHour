import { rng } from './Random.js';

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
        this.scale = 0.02; // 进一步降低基础频率，追求更长的地貌线条
        this.grid = [];
        this.heightMap = []; // 新增：记录原始噪声高度
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
        
        // 如果提供了强制偏移量（通常用于加载存档），则使用它，否则随机生成
        if (forcedOffsets) {
            this.offsetX = forcedOffsets.x;
            this.offsetY = forcedOffsets.y;
        } else {
            this.offsetX = Math.random() * 5000;
            this.offsetY = Math.random() * 5000;
        }

        const offsetX = this.offsetX;
        const offsetY = this.offsetY;

        const baseFreq = 0.0125; 
        const border = 50; // 边缘山脉屏障的宽度

        for (let z = 0; z < size; z++) {
            this.grid[z] = [];
            this.heightMap[z] = [];
            for (let x = 0; x < size; x++) {
                // 1. 基础噪声计算 (全图坐标一致)
                const nx = x * baseFreq + offsetX;
                const nz = z * baseFreq + offsetY;

                const qx = rng.noise2D(nx, nz);
                const qz = rng.noise2D(nx + 5.2, nz + 1.3);

                let noise = rng.noise2D(nx + 2.0 * qx, nz + 2.0 * qz);
                noise += 0.5 * rng.noise2D(nx * 2, nz * 2);
                noise /= 1.5;

                const contrast = 1.4; 
                noise = Math.max(-1, Math.min(1, noise * contrast));

                // 2. 边缘抬升逻辑 (Border Push)
                // 不再硬编码，而是通过给噪声加权让边缘“自然”变高成山
                const distFromEdge = Math.min(x, z, size - 1 - x, size - 1 - z);
                if (distFromEdge < border) {
                    // 增加抬升强度到 1.5，确保即使深水也能被推高成山脉
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

        // 寻找并标记聚落兴趣点 (POIs)
        const pois = this.findPOICandidates(10);
        this.pois = pois; 

        return this.grid;
    }

    /**
     * 根据世界坐标获取地形类型
     * 假设地图中心在 (0,0)
     */
    getTileType(worldX, worldZ) {
        // 使用 Math.round 将碰撞中心与视觉顶点对齐，修复半格偏移导致的穿模/空气墙
        const gridX = Math.round(worldX + this.size / 2);
        const gridZ = Math.round(worldZ + this.size / 2);

        if (gridX < 0 || gridX >= this.size || gridZ < 0 || gridZ >= this.size) {
            return TILE_TYPES.MOUNTAIN; // 越界视为墙
        }

        return this.grid[gridZ][gridX];
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
                const type = this.grid[nz][nx];
                // 仅允许在普通草地上生成物体
                if (type !== TILE_TYPES.GRASS) return false;
            }
        }
        return true;
    }

    /**
     * 检查坐标是否可通行
     * 进一步增大默认 radius 到 0.7，配合 Math.round，让碰撞边界更向外扩张
     * 确保角色在斜坡边缘有明显的缓冲区，彻底杜绝穿模感
     */
    isPassable(worldX, worldZ, radius = 0.7) {
        // 检查以中心点为圆心的四个边缘点（前、后、左、右）
        // 以及中心点本身，确保整个身体都在草地上
        const points = [
            { x: worldX, z: worldZ },
            { x: worldX + radius, z: worldZ },
            { x: worldX - radius, z: worldZ },
            { x: worldX, z: worldZ + radius },
            { x: worldX, z: worldZ - radius }
        ];

        for (const p of points) {
            const type = this.getTileType(p.x, p.z);
            // 仅草地可通行
            if (type !== TILE_TYPES.GRASS) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 重构后的 POI 寻找逻辑：寻找真正的平原重心 (Local Maxima + NMS)
     */
    findPOICandidates(count = 15) {
        const candidates = [];
        const step = 4; // 缩小步长，提高精度
        const border = 55; // 稍微收缩边界范围

        // 第一步：密集采样，计算每个点的“深度”（即到最近障碍的距离）
        for (let z = border; z < this.size - border; z += step) {
            for (let x = border; x < this.size - border; x += step) {
                if (this.grid[z][x] !== TILE_TYPES.GRASS) continue;

                // 计算该点能支持的真实最大半径 (不封顶，直到碰到非草地)
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

                if (r >= 8) {
                    candidates.push({ x, z, radius: r, score: r });
                }
            }
        }

        // 第二步：非极大值抑制 (NMS) - 确保选中的点是其局部范围内“最中心”的
        // 只有当一个点的半径大于等于它周围一定范围内所有点的半径时，它才保留
        const localPeaks = candidates.filter(cand => {
            return !candidates.some(other => {
                if (cand === other) return false;
                const dist = Math.sqrt(Math.pow(cand.x - other.x, 2) + Math.pow(cand.z - other.z, 2));
                // 抑制半径设为 12，如果 12 米内有比我分数更高（更中心）的点，我就被剔除
                // 如果分数一样，则保留先扫描到的，防止大平原中心点全军覆没
                return dist < 12 && (other.score > cand.score);
            });
        });

        // 第三步：按半径（即中心化程度）从大到小排序
        localPeaks.sort((a, b) => b.score - a.score);

        // 第四步：最终筛选，确保 POI 之间有足够的战略间距
        const finalPois = [];
        for (const cand of localPeaks) {
            // 基础间距，防止聚落挤在一起
            const minDist = 40; 
            if (!finalPois.some(p => Math.sqrt(Math.pow(p.x - cand.x, 2) + Math.pow(p.z - cand.z, 2)) < minDist)) {
                finalPois.push(cand);
                if (finalPois.length >= count) break;
            }
        }
        return finalPois;
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
                const val = this.heightMap[z][x];
                const type = this.grid[z][x];
                const gray = Math.floor((val + 1) / 2 * 255);
                const idx = (z * size + x) * 4;
                
                if (type === TILE_TYPES.MOUNTAIN) {
                    // 山脉：深褐色/灰色
                    imgData.data[idx] = 100 + val * 50;
                    imgData.data[idx + 1] = 80 + val * 40;
                    imgData.data[idx + 2] = 60 + val * 30;
                } else if (type === TILE_TYPES.WATER) {
                    // 湖泊：深蓝色
                    imgData.data[idx] = 30;
                    imgData.data[idx + 1] = 60;
                    imgData.data[idx + 2] = 150 + val * 50;
                } else {
                    // 草地 (包含 POI)：翠绿色
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
