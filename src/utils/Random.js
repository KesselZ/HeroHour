/**
 * 带种子的伪随机数生成器 (LCG 算法)
 * 只要 seed 相同，生成的随机数序列就完全一致
 */
class Random {
    constructor(seed = 12345) {
        this.seed = seed;
        this.p = new Uint8Array(512);
        this.rebuildPermutationTable();
    }

    /**
     * 根据当前种子重建置换表
     * 这是消除“网格感”的关键，确保哈希分布均匀
     */
    rebuildPermutationTable() {
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;

        // 使用当前种子进行洗牌 (Fisher-Yates Shuffle)
        let tempSeed = this.seed;
        const nextInternal = () => {
            tempSeed = (tempSeed * 1664525 + 1013904223) % 4294967296;
            return tempSeed / 4294967296;
        };

        for (let i = 255; i > 0; i--) {
            const j = Math.floor(nextInternal() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }

        // 扩展到 512 以避免边界检查
        for (let i = 0; i < 512; i++) {
            this.p[i] = p[i & 255];
        }
    }

    // 返回 0 到 1 之间的浮点数
    next() {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    // 返回 rangeLow 到 rangeHigh 之间的浮点数
    nextFloat(low, high) {
        return low + this.next() * (high - low);
    }

    // 返回 rangeLow 到 rangeHigh 之间的整数
    nextInt(low, high) {
        return Math.floor(this.nextFloat(low, high + 1));
    }

    /**
     * 标准改进版柏林噪声 (Improved Perlin Noise)
     * 解决了简版算法导致的“网格感”和“均匀感”
     */
    noise2D(x, y) {
        // 1. 找到输入点所在的单位正方形坐标 (X, Y)
        let X = Math.floor(x) & 255;
        let Y = Math.floor(y) & 255;

        // 2. 找到点在正方形内的相对坐标 (0.0 ~ 1.0)
        x -= Math.floor(x);
        y -= Math.floor(y);

        // 3. 计算淡入淡出曲线 (Fade Curve)，确保过渡平滑
        const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
        const u = fade(x);
        const v = fade(y);

        // 4. 哈希坐标并计算 4 个顶点的梯度值
        const p = this.p;
        const AA = p[p[X] + Y];
        const AB = p[p[X] + Y + 1];
        const BA = p[p[X + 1] + Y];
        const BB = p[p[X + 1] + Y + 1];

        // 5. 混合 (Lerp) 结果
        const lerp = (t, a, b) => a + t * (b - a);
        const grad = (hash, x, y) => {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        };

        return lerp(v, 
            lerp(u, grad(AA, x, y), grad(BA, x - 1, y)),
            lerp(u, grad(AB, x, y - 1), grad(BB, x - 1, y - 1))
        );
    }
}

// 导出一个全局单例
export const rng = new Random(Math.floor(Math.random() * 1000000));

/**
 * 设置全局种子
 */
export function setSeed(seed) {
    rng.seed = seed;
    rng.rebuildPermutationTable(); // 关键：设置种子后必须重建表
    console.log(`%c[系统] 随机种子已更新: ${seed}`, 'color: #00ff00; font-weight: bold');
}

