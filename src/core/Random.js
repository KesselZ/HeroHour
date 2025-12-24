/**
 * 带种子的伪随机数生成器 (LCG 算法)
 * 只要 seed 相同，生成的随机数序列就完全一致
 */
class Random {
    constructor(seed = 12345) {
        this.seed = seed;
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
     * 简单的 2D 柏林噪声实现 (简化版)
     */
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = x * x * x * (x * (x * 6 - 15) + 10);
        const v = y * y * y * (y * (y * 6 - 15) + 10);
        
        // 伪随机梯度查找 (基于 LCG 的简化哈希)
        const hash = (i) => {
            const val = (i * 1664525 + 1013904223) % 4294967296;
            return val / 4294967296;
        };

        const p = new Array(512);
        for (let i = 0; i < 256; i++) p[i] = p[i + 256] = Math.floor(hash(i + this.seed) * 256);

        const A = p[X] + Y, AA = p[A], AB = p[A + 1],
              B = p[X + 1] + Y, BA = p[B], BB = p[B + 1];

        const grad = (hash, x, y) => {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        };

        const lerp = (t, a, b) => a + t * (b - a);

        return lerp(v, lerp(u, grad(p[AA], x, y), grad(p[BA], x - 1, y)),
                       lerp(u, grad(p[AB], x, y - 1), grad(p[BB], x - 1, y - 1)));
    }
}

// 导出一个全局单例，方便全项目共用
export const rng = new Random(Math.floor(Math.random() * 1000000));

/**
 * 设置全局种子
 */
export function setSeed(seed) {
    rng.seed = seed;
    console.log(`%c[系统] 战斗种子已设定为: ${seed}`, 'color: #00ff00; font-weight: bold');
}

