/**
 * 简单的空间哈希系统，用于优化大规模战斗中的近邻查询
 * 将 2D 空间划分为网格，大大减少物理碰撞和索敌的计算量
 */
export class SpatialHash {
    constructor(cellSize = 4.0) {
        this.cellSize = cellSize;
        this.grid = new Map();
        // 预分配辅助向量或参数
    }

    /**
     * 清空并重新构建网格
     */
    clear() {
        this.grid.clear();
    }

    /**
     * 获取坐标对应的键 - 优化：使用数值 Key 代替字符串拼接，减少 GC 压力
     * 假设 X, Z 在 [-1000, 1000] 范围内，使用位移存储
     */
    _key(x, z) {
        const cx = Math.floor(x / this.cellSize);
        const cz = Math.floor(z / this.cellSize);
        // 将两个整数映射到一个 32 位整数 (cx 为高 16 位，cz 为低 16 位)
        // 加上偏移量保证正数
        return ((cx + 500) << 16) | (cz + 500);
    }

    /**
     * 将单位插入网格
     */
    insert(unit) {
        if (unit.isDead) return;
        const key = this._key(unit.position.x, unit.position.z);
        let cell = this.grid.get(key);
        if (!cell) {
            cell = [];
            this.grid.set(key, cell);
        }
        cell.push(unit);
    }

    /**
     * 查询指定点附近的单位
     * @param {number} x 中心 X
     * @param {number} z 中心 Z
     * @param {number} radius 查找半径
     * @returns {Array} 附近的单位列表
     */
    query(x, z, radius) {
        const results = [];
        const xMin = Math.floor((x - radius) / this.cellSize);
        const xMax = Math.floor((x + radius) / this.cellSize);
        const zMin = Math.floor((z - radius) / this.cellSize);
        const zMax = Math.floor((z + radius) / this.cellSize);

        for (let ix = xMin; ix <= xMax; ix++) {
            const xOffset = (ix + 500) << 16;
            for (let iz = zMin; iz <= zMax; iz++) {
                const key = xOffset | (iz + 500);
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0, len = cell.length; i < len; i++) {
                        results.push(cell[i]);
                    }
                }
            }
        }
        return results;
    }
}
