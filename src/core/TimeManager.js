import { worldManager } from './WorldManager.js';
import { modifierManager } from './ModifierManager.js';

/**
 * 时间管理器：管理游戏内的日期、季节和季度更替
 */
class TimeManager {
    constructor() {
        this.year = 1; // 初始为天宝一年
        this.seasonIndex = 0; // 0:春, 1:夏, 2:秋, 3:冬
        this.seasons = ['春', '夏', '秋', '冬'];
        
        this.seasonDuration = 60000; // 每个季度 60 秒 (1分钟)
        this.lastUpdateTime = Date.now();
        this.currentTime = 0; // 当前季度的进度 (0 到 seasonDuration)
        
        this.isPaused = false;

        // 难度配置项 (DIFFICULTY PRESETS)
        this.difficulty = 'easy'; // 默认难度
        this.difficultyPresets = {
            'easy': {
                name: '简单',
                hpScale: 0.007,     // HP 每进度增加 0.7%
                damageScale: 0.007, // 伤害每进度增加 0.7%
                powerScale: 0.007,  // 战力规模每进度增加 0.7%
                maxProgress: 30,    // 简单难度最高进度上限
                description: '敌军成长较慢。'
            },
            'hard': {
                name: '困难',
                hpScale: 0.017,
                damageScale: 0.014,
                powerScale: 0.014,
                maxProgress: 70,    // 困难难度最高进度上限
                description: '敌军成长迅速。'
            },
            'hell': {
                name: '地狱',
                hpScale: 0.025,
                damageScale: 0.02,
                powerScale: 0.02,
                maxProgress: 100,   // 地狱难度最高进度上限
                description: '敌军实力突飞猛进！'
            }
        };
        
        // 核心重构：监听等级提升与初始化事件，动态调整难度
        window.addEventListener('hero-level-up', () => {
            console.log('%c[难度调整] %c检测到等级提升，正在重新计算敌军强度...', 'color: #ff9800; font-weight: bold', 'color: #fff');
            this.updateDifficultyModifiers();
        });

        window.addEventListener('hero-initialized', () => {
            this.updateDifficultyModifiers();
        });

        // 核心修复：不再在构造函数中立即调用 updateDifficultyModifiers
        // 因为这会触发对 worldManager 的访问，而此时可能处于循环引用的 TDZ（未初始化状态）
        // 难度系数将在 hero-initialized 事件触发时或首次 update 时进行初始化
    }

    /**
     * 设置全局难度
     * @param {string} level 'easy' | 'normal' | 'hard' | 'hell'
     */
    setDifficulty(level) {
        if (this.difficultyPresets[level]) {
            this.difficulty = level;
            const preset = this.difficultyPresets[level];
            console.log(`%c[难度设置] %c已切换至: ${preset.name}`, 'color: #ff9800; font-weight: bold', 'color: #fff');
            
            // 如果 worldManager 已初始化，立即更新
            try {
                if (typeof worldManager !== 'undefined' && worldManager) {
                    this.updateDifficultyModifiers();
                }
            } catch (e) {}
        }
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
        const progress = this.getCombinedDifficultyProgress();
        const preset = this.difficultyPresets[this.difficulty];
        
        // 难度缩放系数设计：使用当前难度的预设系数
        const damageMult = 1.0 + progress * preset.damageScale;
        const hpHoldMult = 1.0 + progress * preset.hpScale;
        
        // 注入 HP 修正
        modifierManager.addModifier({
            id: 'difficulty_hp',
            side: 'enemy',
            stat: 'hp',
            multiplier: hpHoldMult
        });

        // 注入伤害修正
        modifierManager.addModifier({
            id: 'difficulty_damage',
            side: 'enemy',
            stat: 'attackDamage',
            multiplier: damageMult
        });
        
        console.log(`%c[难度缩放] %c综合进度: ${progress.toFixed(2)} | 难度: ${preset.name}`, 'color: #ff4444; font-weight: bold', 'color: #fff');
        console.log(`%c[难度缩放] %c敌军属性系数: 生命 x${hpHoldMult.toFixed(2)}, 伤害 x${damageMult.toFixed(2)}`, 'color: #ff4444; font-weight: bold', 'color: #fff');
    }

    updateUI() {
        const dateDisplay = document.querySelector('.world-date-display');
        if (dateDisplay) {
            dateDisplay.innerHTML = `天宝 ${this.year} 年 · ${this.seasons[this.seasonIndex]}`;
        }

        // 更新环形进度条
        const progress = (this.currentTime / this.seasonDuration) * 100;
        const circle = document.querySelector('.time-progress-circle');
        if (circle) {
            // 背景色改为淡灰色，进度色为金色
            circle.style.background = `conic-gradient(var(--jx3-gold) ${progress}%, #e0e0e0 0)`;
        }
    }

    getDateString() {
        const preset = this.difficultyPresets[this.difficulty];
        return `天宝 ${this.year} 年 · ${this.seasons[this.seasonIndex]} [${preset.name.split(' ')[0]}]`;
    }

    /**
     * 获取综合难度进度值 (核心重构)
     * 结合了时间进度和玩家等级进度
     */
    getCombinedDifficultyProgress() {
        // 1. 时间进度：每个季度算 2 个单位进度 (用户要求：季度 * 2)
        const timeProgress = this.getGlobalProgress() * 2;
        
        // 2. 等级进度 (用户要求：等级 * 3)
        let level = 1;
        try {
            // 核心修复：安全访问 worldManager，防止循环引用导致的 TDZ 错误
            if (typeof worldManager !== 'undefined' && worldManager && worldManager.heroData) {
                level = worldManager.heroData.level || 1;
            }
        } catch (e) {
            // 如果 worldManager 尚未初始化，则默认使用 1 级
        }
        
        const levelProgress = level * 3;
        
        // 3. 综合进度
        const totalProgress = timeProgress + levelProgress;
        
        // 4. 硬上限处理：根据当前难度设定上限
        const preset = this.difficultyPresets[this.difficulty];
        return Math.min(preset.maxProgress, totalProgress);
    }

    /**
     * 获取全局进度（已过的季度总数）
     */
    getGlobalProgress() {
        return (this.year - 1) * 4 + this.seasonIndex;
    }

    /**
     * 获取战力缩放系数（影响大世界怪物的 totalPoints）
     */
    getPowerMultiplier() {
        const progress = this.getCombinedDifficultyProgress();
        const preset = this.difficultyPresets[this.difficulty];
        return 1.0 + progress * preset.powerScale; // 怪物群落规模增长基于难度预设
    }

    /**
     * 获取数值缩放系数（影响怪物的 HP 和 Damage）
     */
    getStatMultiplier() {
        const progress = this.getCombinedDifficultyProgress();
        const preset = this.difficultyPresets[this.difficulty];
        return 1.0 + progress * preset.hpScale; // 基础数值随综合进度增加
    }

    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            year: this.year,
            seasonIndex: this.seasonIndex,
            currentTime: this.currentTime,
            difficulty: this.difficulty
        };
    }

    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        if (!data) return;
        this.year = data.year;
        this.seasonIndex = data.seasonIndex;
        this.currentTime = data.currentTime;
        this.difficulty = data.difficulty;
        
        this.updateDifficultyModifiers();
        this.updateUI();
        console.log("%c[系统] TimeManager 数据恢复完毕", "color: #4CAF50; font-weight: bold");
    }
}

export const timeManager = new TimeManager();

