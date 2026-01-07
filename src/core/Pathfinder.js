import { mapGenerator } from './MapGenerator.js';

/**
 * 极简二叉堆实现，用于优化 A* 的 openSet
 */
class BinaryHeap {
    constructor(scoreFunction) {
        this.content = [];
        this.scoreFunction = scoreFunction;
    }
    push(element) {
        this.content.push(element);
        this.bubbleUp(this.content.length - 1);
    }
    pop() {
        const result = this.content[0];
        const end = this.content.pop();
        if (this.content.length > 0) {
            this.content[0] = end;
            this.sinkDown(0);
        }
        return result;
    }
    size() {
        return this.content.length;
    }
    bubbleUp(n) {
        const element = this.content[n];
        const score = this.scoreFunction(element);
        while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.content[parentN];
            if (score >= this.scoreFunction(parent)) break;
            this.content[parentN] = element;
            this.content[n] = parent;
            n = parentN;
        }
    }
    sinkDown(n) {
        const length = this.content.length;
        const element = this.content[n];
        const elemScore = this.scoreFunction(element);
        while (true) {
            let child2N = (n + 1) * 2, child1N = child2N - 1;
            let swap = null;
            let child1Score;
            if (child1N < length) {
                const child1 = this.content[child1N];
                child1Score = this.scoreFunction(child1);
                if (child1Score < elemScore) swap = child1N;
            }
            if (child2N < length) {
                const child2 = this.content[child2N];
                const child2Score = this.scoreFunction(child2);
                if (child2Score < (swap === null ? elemScore : child1Score)) swap = child2N;
            }
            if (swap === null) break;
            this.content[n] = this.content[swap];
            this.content[swap] = element;
            n = swap;
        }
    }
}

/**
 * 高性能 A* 寻路算法实现
 * 针对 400x400 等大地图进行了二叉堆和整数索引优化
 */
export class Pathfinder {
    constructor(grid, size) {
        this.grid = grid;
        this.size = size;
        this.halfSize = size / 2;
        
        // 预分配缓冲区，减少 GC 压力 (对于 400x400，约需 16w 长度)
        this.gScore = new Float32Array(size * size);
        this.fScore = new Float32Array(size * size);
        this.visited = new Uint8Array(size * size); // 0: unvisited, 1: open, 2: closed
        this.cameFrom = new Int32Array(size * size);
    }

    /**
     * 执行寻路
     * @param {Object} start {x, z} 逻辑网格坐标
     * @param {Object} end {x, z} 逻辑网格坐标
     * @returns {Array|null} 路径节点列表 [{x, z}, ...]
     */
    findPath(start, end) {
        // 1. 合法性与边界检查
        if (!this._isPassable(end.x, end.z)) return null;
        if (start.x === end.x && start.z === end.z) return [];

        // 2. 直线预检 (Raycasting)
        // 如果起点终点距离较近且无障碍，直接返回插值路径，跳过 A*
        const directPath = this._isDirectPathPassable(start, end);
        if (directPath) {
            return directPath;
        }

        const size = this.size;
        const startIdx = start.z * size + start.x;
        const endIdx = end.z * size + end.x;

        // 3. 重置状态 (仅重置必要的标志位，比 new Map 块得多)
        this.visited.fill(0);
        this.gScore.fill(Infinity);
        this.fScore.fill(Infinity);
        this.cameFrom.fill(-1);

        const openHeap = new BinaryHeap(idx => this.fScore[idx]);

        // 初始化起点
        this.gScore[startIdx] = 0;
        this.fScore[startIdx] = this._heuristic(start, end);
        openHeap.push(startIdx);
        this.visited[startIdx] = 1; // Mark as open

        let iterations = 0;
        const maxIterations = 5000; // 限制单次寻路最大迭代次数，防止长距离爆炸

        let bestIdx = startIdx;
        let minH = this._heuristic(start, end);

        while (openHeap.size() > 0) {
            iterations++;
            
            const currentIdx = openHeap.pop();
            
            if (currentIdx === endIdx) {
                return this._reconstructPath(currentIdx);
            }

            // 记录目前为止最接近终点的点 (启发式值最小)
            const curZ = Math.floor(currentIdx / size);
            const curX = currentIdx % size;
            const h = this._heuristic({x: curX, z: curZ}, end);
            if (h < minH) {
                minH = h;
                bestIdx = currentIdx;
            }

            if (iterations > maxIterations) {
                // 如果超过限制，返回目前为止最接近终点的点计算出的路径 (部分路径)
                return this._reconstructPath(bestIdx);
            }

            this.visited[currentIdx] = 2; // Mark as closed

            const cz = curZ;
            const cx = curX;

            // 检查 8 个邻居
            for (let dz = -1; dz <= 1; dz++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dz === 0) continue;

                    const nx = cx + dx;
                    const nz = cz + dz;

                    if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
                    
                    const neighborIdx = nz * size + nx;
                    if (this.visited[neighborIdx] === 2) continue; // Skip closed

                    if (this._isPassable(nx, nz)) {
                        // 防止对角线切角
                        if (dx !== 0 && dz !== 0) {
                            if (!this._isPassable(cx + dx, cz) || !this._isPassable(cx, cz + dz)) {
                                continue;
                            }
                        }

                        const moveCost = (dx !== 0 && dz !== 0) ? 1.414 : 1.0;
                        const tentativeGScore = this.gScore[currentIdx] + moveCost;

                        if (this.visited[neighborIdx] !== 1 || tentativeGScore < this.gScore[neighborIdx]) {
                            this.cameFrom[neighborIdx] = currentIdx;
                            this.gScore[neighborIdx] = tentativeGScore;
                            this.fScore[neighborIdx] = tentativeGScore + this._heuristic({x: nx, z: nz}, end);
                            
                            if (this.visited[neighborIdx] !== 1) {
                                openHeap.push(neighborIdx);
                                this.visited[neighborIdx] = 1; // Mark as open
                            }
                        }
                    }
                }
            }
        }

        return null;
    }

    _heuristic(a, b) {
        // 切比雪夫距离适配 8 方向
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
    }

    _isPassable(x, z) {
        if (x < 0 || x >= this.size || z < 0 || z >= this.size) return false;
        const type = this.grid[z][x];
        if (type !== 'grass' && type !== 'poi') return false;
        
        // 物理一致性检查
        const worldX = x - this.halfSize;
        const worldZ = z - this.halfSize;
        return mapGenerator.isPassable(worldX, worldZ, 0.25);
    }

    /**
     * 直线检测：使用简单的采样检查路径上是否全通
     * 如果通行，返回插值后的路径点列表
     */
    _isDirectPathPassable(start, end) {
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 30) return null; // 太远了不建议用直线检测，老实走 A*

        const path = [];
        const steps = Math.ceil(dist);
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = Math.round(start.x + dx * t);
            const pz = Math.round(start.z + dz * t);
            if (!this._isPassable(px, pz)) return null;
            path.push({ x: px, z: pz });
        }
        return path;
    }

    _reconstructPath(endIdx) {
        const path = [];
        let currentIdx = endIdx;
        const size = this.size;
        
        while (currentIdx !== -1) {
            path.push({
                x: currentIdx % size,
                z: Math.floor(currentIdx / size)
            });
            currentIdx = this.cameFrom[currentIdx];
        }
        
        path.reverse();
        path.shift(); // 移除起点
        return path;
    }
}
