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

