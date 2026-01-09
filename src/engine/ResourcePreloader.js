import { audioManager } from './AudioManager.js';

/**
 * 资源预加载器 (Singleton)
 * 职责：在游戏开始前加载所有核心图片和音频，并提供进度反馈
 */
class ResourcePreloader {
    constructor() {
        this.totalCount = 0;
        this.loadedCount = 0;
        this.onProgress = null;
        this.onComplete = null;
        this.isStarted = false;
        this.loadedImages = new Set();
        this.loadedAudios = new Set();
        this.currentLoadingFile = '';
    }

    /**
     * 获取所有需要预加载的资源路径
     * @returns {Object} { images: [], audios: [] }
     */
    async fetchResourceList() {
        try {
            // 尝试加载生成的资源列表
            const response = await fetch('/resource-list.json');
            if (response.ok) {
                const data = await response.json();
                return {
                    images: data.images || [],
                    audios: data.audios || []
                };
            }
        } catch (error) {
            console.warn('无法获取 resource-list.json，将使用硬编码备用列表:', error);
        }

        // 备用硬编码列表 (如果 fetch 失败)
        return {
            images: this.getBackupImagePaths(),
            audios: this.getBackupAudioPaths()
        };
    }

    getBackupImagePaths() {
        const imagePaths = [
            // 角色图片
            '/assets/characters/character.png',
            '/assets/characters/character2.png',
            '/assets/characters/character3.png',
            '/assets/characters/chunyang.png',
            '/assets/characters/chunyang2.png',
            '/assets/characters/chunyang3.png',
            '/assets/characters/cangjian.png',
            '/assets/characters/cangjian2.png',
            '/assets/characters/cangjian3.png',
            '/assets/characters/tiance.png',
            '/assets/characters/tiance2.png',
            '/assets/characters/tiance3.png',
            '/assets/characters/tiance4.png',
            '/assets/characters/tiance5.png',

            // 建筑 (合并后的路径)
            '/assets/buildings/building.png',
            '/assets/buildings/building2.png',
            '/assets/buildings/building3.png',
            '/assets/buildings/building4.png',
            '/assets/buildings/building5.png',
            '/assets/buildings/building6.png',
            '/assets/buildings/building7.png',
            '/assets/buildings/building8.png',

            // 敌人
            '/assets/enemies/enemy.png',
            '/assets/enemies/enemy2.png',
            '/assets/enemies/enemy3.png',
            '/assets/enemies/enemy4.png',
            '/assets/enemies/enemy5.png',

            // 能力图标 (技能与奇穴合并后)
            '/assets/abilities/common1.png',
            '/assets/abilities/common2.png',
            '/assets/abilities/common3.png',
            '/assets/abilities/common4.png',
            '/assets/abilities/common5.png',
            '/assets/abilities/common6.png',
            '/assets/abilities/common7.png',
            '/assets/abilities/common8.png',
            '/assets/abilities/tiance1.png',
            '/assets/abilities/tiance2.png',
            '/assets/abilities/tiance3.png',
            '/assets/abilities/tiance4.png',
            '/assets/abilities/cangjian1.png',
            '/assets/abilities/cangjian2.png',
            '/assets/abilities/cangjian3.png',
            '/assets/abilities/cangjian4.png',
            '/assets/abilities/chunyang1.png',
            '/assets/abilities/chunyang2.png',
            '/assets/abilities/chunyang3.png',
            '/assets/abilities/chunyang4.png',
            '/assets/abilities/wanhua1.png'
        ];

        return imagePaths;
    }

    getBackupAudioPaths() {
        return [
            '/audio/bgm/如寄.mp3',
            '/audio/bgm/天赋界面.mp3',
            '/audio/click/清脆按钮.mp3',
            '/audio/click/按下音效.mp3',
            '/audio/click/无效按钮音效.mp3',
            '/audio/click/铃铛.mp3',
            '/audio/click/胜利音效.mp3',
            '/audio/click/战斗失败音效.mp3',
            '/audio/attack/挥砍1.mp3',
            '/audio/attack/交战_兵器碰撞1.mp3',
            '/audio/attack/交战_兵器碰撞2.mp3',
            '/audio/attack/射箭.mp3',
            '/audio/attack/挥拳击中1.mp3',
            '/audio/attack/气剑1.mp3',
            '/audio/attack/气剑2.mp3',
            '/audio/onhit/被击中1.mp3',
            '/audio/onhit/被砍中1.mp3',
            '/audio/onhit/被砍中2.mp3',
            '/audio/skill/切砍声音.mp3',
            '/audio/skill/破空声.mp3',
            '/audio/skill/突刺.mp3',
            '/audio/skill/气剑雨.mp3',
            '/audio/skill/放气场.mp3',
            '/audio/skill/盔甲声音.mp3',
            '/audio/skill/马叫声.mp3',
            '/audio/skill/士兵呐喊.mp3',
            '/audio/skill/战八方.mp3',
            '/audio/skill/啸如虎.mp3',
            '/audio/skill/践踏.mp3',
            '/audio/skill/万箭齐发.mp3',
            '/audio/fight/进入战斗.mp3',
            '/audio/fight/士兵呐喊.mp3',
            '/audio/walk/草地奔跑.mp3',
            '/audio/walk/草地奔跑脚步1.mp3',
            '/audio/walk/草地奔跑脚步2.mp3',
            '/audio/walk/草地奔跑脚步3.mp3',
            '/audio/sources/升级音效.mp3',
            '/audio/sources/点天赋.mp3',
            '/audio/sources/获得木材.mp3',
            '/audio/sources/传送.mp3',
            '/audio/sources/获得木材厂.mp3',
            '/audio/sources/获得金矿厂.mp3',
            '/audio/sources/获得金钱.mp3',
            '/audio/farm/砍树声音1.mp3',
            '/audio/farm/砍树声音2.mp3',
            '/audio/farm/砍断了树.mp3'
        ];
    }

    /**
     * 开始预加载流程
     */
    async preloadAll(onProgress, onComplete) {
        if (this.isStarted) return;
        this.isStarted = true;
        this.onProgress = onProgress;
        this.onComplete = onComplete;

        console.log('%c[资源预加载] %c开始扫描资源...', 'color: #5b8a8a; font-weight: bold', 'color: #333');

        // 1. 获取资源列表
        const { images, audios } = await this.fetchResourceList();
        
        this.totalCount = images.length + audios.length;
        this.loadedCount = 0;

        // 2. 并行加载所有资源
        const imagePromises = images.map(path => this.preloadImage(path));
        const audioPromises = audios.map(path => this.preloadAudio(path));

        try {
            await Promise.all([...imagePromises, ...audioPromises]);
            console.log('%c[资源预加载] %c全部加载完成！', 'color: #5b8a8a; font-weight: bold', 'color: #4CAF50');
            if (this.onComplete) this.onComplete();
        } catch (error) {
            console.error('资源预加载失败:', error);
            // 即使失败也尝试继续游戏
            if (this.onComplete) this.onComplete();
        }
    }

    /**
     * 预加载单个图片
     */
    async preloadImage(path) {
        if (this.loadedImages.has(path)) {
            this.updateProgress(path);
            return;
        }

        this.currentLoadingFile = path;
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages.add(path);
                this.updateProgress(path);
                resolve();
            };
            img.onerror = () => {
                console.warn(`图片加载失败: ${path}`);
                this.updateProgress(path); // 失败也算进度，防止卡死
                resolve();
            };
            img.src = path;
        });
    }

    /**
     * 预加载单个音频
     */
    async preloadAudio(path) {
        if (this.loadedAudios.has(path)) {
            this.updateProgress(path);
            return;
        }

        this.currentLoadingFile = path;
        try {
            await audioManager.preload(path);
            this.loadedAudios.add(path);
            this.updateProgress(path);
        } catch (error) {
            console.warn(`音频加载失败: ${path}`);
            this.updateProgress(path);
            return;
        }
    }

    updateProgress(path) {
        this.loadedCount++;
        if (this.onProgress) {
            this.onProgress(this.loadedCount, this.totalCount, path);
        }
    }

    isImageLoaded(path) {
        return this.loadedImages.has(path);
    }

    isAudioLoaded(path) {
        return this.loadedAudios.has(path);
    }
}

export const resourcePreloader = new ResourcePreloader();
