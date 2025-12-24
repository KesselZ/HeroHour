import { worldManager } from './WorldManager.js';

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

    onSeasonChange() {
        const dateStr = `天宝 ${this.year} 年 · ${this.seasons[this.seasonIndex]}`;
        console.log(`%c[时节更替] %c${dateStr}`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
        
        // 使用全局通知系统
        worldManager.showNotification(`时节更替：${dateStr}`);
        
        // 这里可以触发大世界的资源产出结算
        // worldManager.processResourceProduction();
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
}

export const timeManager = new TimeManager();

