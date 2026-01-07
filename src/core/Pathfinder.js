import { mapGenerator } from './MapGenerator.js';

/**
 * 极简 A* 寻路算法实现
 * 专为 HeroHour 的 grid 地图设计
 */
export class Pathfinder {
    constructor(grid, size) {
        this.grid = grid;
        this.size = size;
        this.halfSize = size / 2;
    }

    /**
     * 执行寻路
     * @param {Object} start {x, z} 逻辑网格坐标
     * @param {Object} end {x, z} 逻辑网格坐标
     * @returns {Array|null} 路径节点列表 [{x, z}, ...]
     */
    findPath(start, end) {
        // 1. 合法性检查
        if (!this._isPassable(end.x, end.z)) return null;
        if (start.x === end.x && start.z === end.z) return [];

        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = this._posToKey(start);
        const endKey = this._posToKey(end);

        openSet.push(start);
        gScore.set(startKey, 0);
        fScore.set(startKey, this._heuristic(start, end));

        while (openSet.length > 0) {
            // 获取 openSet 中 fScore 最小的点
            let current = openSet[0];
            let minF = fScore.get(this._posToKey(current));
            let currentIndex = 0;

            for (let i = 1; i < openSet.length; i++) {
                const f = fScore.get(this._posToKey(openSet[i]));
                if (f < minF) {
                    minF = f;
                    current = openSet[i];
                    currentIndex = i;
                }
            }

            if (this._posToKey(current) === endKey) {
                return this._reconstructPath(cameFrom, current);
            }

            openSet.splice(currentIndex, 1);
            closedSet.add(this._posToKey(current));

            // 检查 8 个邻居 (支持对角移动)
            const neighbors = this._getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = this._posToKey(neighbor);
                if (closedSet.has(neighborKey)) continue;

                // 计算到邻居的距离 (直线 1.0, 对角 1.414)
                const moveCost = (neighbor.x !== current.x && neighbor.z !== current.z) ? 1.414 : 1.0;
                const tentativeGScore = gScore.get(this._posToKey(current)) + moveCost;

                if (!this._isInSet(openSet, neighbor)) {
                    openSet.push(neighbor);
                } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
                    continue;
                }

                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this._heuristic(neighbor, end));
            }
        }

        return null;
    }

    _heuristic(a, b) {
        // 使用切比雪夫距离 (Chebyshev distance) 适配 8 方向移动
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
    }

    _posToKey(pos) {
        return `${pos.x},${pos.z}`;
    }

    _isInSet(set, pos) {
        const key = this._posToKey(pos);
        return set.some(p => this._posToKey(p) === key);
    }

    _isPassable(x, z) {
        if (x < 0 || x >= this.size || z < 0 || z >= this.size) return false;
        
        // 1. 基础地形检查
        const type = this.grid[z][x];
        if (type !== 'grass' && type !== 'poi') return false;

        // 2. 物理一致性检查：确保该网格中心在世界坐标下也是可通行的 (带 0.25 的半径)
        const worldX = x - this.halfSize;
        const worldZ = z - this.halfSize;
        return mapGenerator.isPassable(worldX, worldZ, 0.25);
    }

    _getNeighbors(pos) {
        const neighbors = [];
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dz === 0) continue;
                const nx = pos.x + dx;
                const nz = pos.z + dz;

                if (this._isPassable(nx, nz)) {
                    // --- 核心修复：防止对角线切角 ---
                    // 如果是斜向移动，必须保证两侧的直角边也都是可通行的
                    // 这样可以防止主角尝试钻过两块斜向相连的山体缝隙
                    if (dx !== 0 && dz !== 0) {
                        if (!this._isPassable(pos.x + dx, pos.z) || !this._isPassable(pos.x, pos.z + dz)) {
                            continue;
                        }
                    }
                    neighbors.push({ x: nx, z: nz });
                }
            }
        }
        return neighbors;
    }

    _reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom.has(this._posToKey(current))) {
            current = cameFrom.get(this._posToKey(current));
            path.unshift(current);
        }
        // 移除起点
        path.shift();
        return path;
    }
}

