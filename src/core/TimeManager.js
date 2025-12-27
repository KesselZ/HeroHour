import { worldManager } from './WorldManager.js';
import { modifierManager } from './ModifierManager.js';

/**
 * 时间管理器：管理游戏内的日期、季节和季度更替
 */
class TimeManager {
    constructor() {
        this.year = 3; // 初始为天宝三年
        this.seasonIndex = 0; // 0:春, 1:夏, 2:秋, 3:冬
        this.seasons = ['春', '夏', '秋', '冬'];
        
        this.seasonDuration = 60000; // 每个季度 60 秒 (1分钟)
        this.lastUpdateTime = Date.now();
        this.currentTime = 0; // 当前季度的进度 (0 到 seasonDuration)
        
        this.isPaused = false;
        
        // 初始化难度系数
        this.updateDifficultyModifiers();
    }

    update() {
        if (this.isPaused) return false;

        const now = Date.now();
        const delta = now - this.lastUpdateTime;
        this.lastUpdateTime = now;
        
        this.currentTime += delta;

        // 检查季度更替
        if (this.currentTime >= this.seasonDuration) {
            this.currentTime = 0;
            this.seasonIndex++;
            
            if (this.seasonIndex >= 4) {
                this.seasonIndex = 0;
                this.year++;
            }
            
            this.onSeasonChange();
            return true; // 告知外部发生了大版本变化
        }
        
        this.updateUI();
        return false;
    }

    /**
     * 暂停时间
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * 恢复时间
     */
    resume() {
        this.isPaused = false;
        this.lastUpdateTime = Date.now(); // 核心：恢复时立即重置计时起点，防止对战期间的漫长时间被计入
    }

    onSeasonChange() {
        const dateStr = `天宝 ${this.year} 年 · ${this.seasons[this.seasonIndex]}`;
        console.log(`%c[时节更替] %c${dateStr}`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
        
        // 更新难度修正器
        this.updateDifficultyModifiers();
        
        // 使用全局通知系统
        worldManager.showNotification(`时节更替：${dateStr}`);
    }

    /**
     * 更新全局难度修正器
     */
    updateDifficultyModifiers() {
        const statMult = this.getStatMultiplier();
        
        // 注入 HP 修正
        modifierManager.addGlobalModifier({
            id: 'difficulty_hp',
            side: 'enemy',
            stat: 'hp',
            multiplier: statMult
        });

        // 注入伤害修正
        modifierManager.addGlobalModifier({
            id: 'difficulty_damage',
            side: 'enemy',
            stat: 'damage',
            multiplier: statMult
        });
        
        console.log(`%c[难度缩放] %c当前敌军属性系数: x${statMult.toFixed(2)}`, 'color: #ff4444; font-weight: bold', 'color: #fff');
    }

    updateUI() {
        const dateDisplay = document.querySelector('.world-date-display');
        if (dateDisplay) {
            dateDisplay.innerText = `天宝 ${this.year} 年 · ${this.seasons[this.seasonIndex]}`;
        }

        // 更新环形进度条
        const progress = (this.currentTime / this.seasonDuration) * 100;
        const circle = document.querySelector('.time-progress-circle');
        if (circle) {
            circle.style.background = `conic-gradient(var(--jx3-gold) ${progress}%, transparent 0)`;
        }
    }

    getDateString() {
        return `天宝 ${this.year} 年 · ${this.seasons[this.seasonIndex]}`;
    }

    /**
     * 获取全局进度（已过的季度总数）
     */
    getGlobalProgress() {
        return (this.year - 3) * 4 + this.seasonIndex;
    }

    /**
     * 获取战力缩放系数（影响大世界怪物的 totalPoints）
     * 每季度增加 4%，最高 3 倍
     */
    getPowerMultiplier() {
        return Math.min(3.0, 1.0 + this.getGlobalProgress() * 0.04);
    }

    /**
     * 获取数值缩放系数（影响怪物的 HP 和 Damage）
     * 每季度增加 4%，最高 3 倍
     */
    getStatMultiplier() {
        return Math.min(3.0, 1.0 + this.getGlobalProgress() * 0.04);
    }
}

export const timeManager = new TimeManager();

