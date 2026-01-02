/**
 * 全局资源预加载器
 * 在游戏启动时预加载所有图片和音频资源，避免运行时延迟
 */
class ResourcePreloader {
    constructor() {
        this.loadedImages = new Set();
        this.loadedAudios = new Set();
        this.totalResources = 0;
        this.loadedCount = 0;
        this.isPreloading = false;
        this.onProgress = null;
        this.onComplete = null;
        this.currentLoadingFile = null; // 当前正在加载的文件
    }

    /**
     * 预加载所有游戏资源
     * @param {Function} onProgress - 进度回调函数 (loadedCount, totalCount)
     * @param {Function} onComplete - 完成回调函数
     */
    async preloadAll(onProgress = null, onComplete = null) {
        if (this.isPreloading) return;

        this.onProgress = onProgress;
        this.onComplete = onComplete;
        this.isPreloading = true;

        try {
            // 从生成的资源清单中获取路径
            console.log('%c[资源预加载] 正在获取资源清单...', 'color: #5b8a8a; font-weight: bold');
            
            // 使用 import.meta.env.BASE_URL 处理 GitHub Pages 等子目录部署的情况
            const baseUrl = import.meta.env.BASE_URL || '/';
            const manifestUrl = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}resource-list.json`.replace(/\/+/g, '/');
            
            const response = await fetch(manifestUrl);
            if (!response.ok) {
                throw new Error('无法加载 resource-list.json');
            }
            const manifest = await response.json();
            
            // 提取路径并处理基础 URL
            const processPaths = (paths) => (paths || []).map(path => {
                // 如果路径已经是绝对路径（以 http 开头），则不处理
                if (path.startsWith('http')) return path;
                // 确保路径以 baseUrl 开头，并处理重复的斜杠
                const fullPath = `${baseUrl}/${path}`.replace(/\/+/g, '/');
                return fullPath;
            });

            const imagePaths = processPaths(manifest.images);
            const audioPaths = processPaths(manifest.audios);

            this.totalResources = imagePaths.length + audioPaths.length;
            this.loadedCount = 0;

            console.log(`%c[资源预加载] 开始预加载 ${this.totalResources} 个资源文件 (清单生成时间: ${manifest.generatedAt})`, 'color: #5b8a8a; font-weight: bold');

            // 并行预加载图片和音频
            const imagePromises = imagePaths.map(path => this.preloadImage(path));
            const audioPromises = audioPaths.map(path => this.preloadAudio(path));

            await Promise.all([...imagePromises, ...audioPromises]);
            console.log('%c[资源预加载] 所有资源预加载完成', 'color: #5b8a8a; font-weight: bold');
            if (this.onComplete) this.onComplete();
        } catch (error) {
            console.error('资源预加载过程中出错:', error);
            // 如果清单加载失败，则回退到硬编码的基础资源（可选，或者直接提示错误）
            console.warn('正在尝试回退到基础资源加载...');
            
            const imagePaths = this.getAllImagePaths();
            const audioPaths = this.getAllAudioPaths();
            this.totalResources = imagePaths.length + audioPaths.length;
            this.loadedCount = 0;
            
            const imagePromises = imagePaths.map(path => this.preloadImage(path));
            const audioPromises = audioPaths.map(path => this.preloadAudio(path));
            
            try {
                await Promise.all([...imagePromises, ...audioPromises]);
                if (this.onComplete) this.onComplete();
            } catch (fallbackError) {
                console.error('回退加载也失败了:', fallbackError);
                if (this.onComplete) this.onComplete();
            }
        }

        this.isPreloading = false;
    }

    /**
     * 获取所有图片资源路径
     */
    getAllImagePaths() {
        const imagePaths = [
            // UI资源
            '/assets/ui/主界面背景图.png',
            '/assets/ui/clan.png',

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

            // 建筑
            '/assets/buildings/building.png',
            '/assets/buildings/building2.png',
            '/assets/buildings/building3.png',

            // 敌人
            '/assets/enemies/enemy.png',
            '/assets/enemies/enemy2.png',
            '/assets/enemies/enemy3.png',
            '/assets/enemies/enemy4.png',
            '/assets/enemies/enemy5.png',

            // 物品
            '/assets/items/items.png',
            '/assets/items/items2.png',

            // 技能图标
            '/assets/skills/skill.png',
            '/assets/skills/skill2.png',
            '/assets/skills/skill3.png',
            '/assets/skills/skill4.png',
            '/assets/skills/skill5.png',
            '/assets/skills/skill6.png',
            '/assets/skills/skill7.png',
            '/assets/skills/skill8.png',

            // 天赋
            '/assets/talents/talent.png',
            '/assets/talents/talent2.png',
            '/assets/talents/talent3.png',
            '/assets/talents/talent4.png',
            '/assets/talents/talent5.png',
            '/assets/talents/talent6.png',
            '/assets/talents/talent7.png',
            '/assets/talents/talent8.png',
            '/assets/talents/talent_tiance.png',
            '/assets/talents/talent_tiance2.png'
        ];

        return imagePaths;
    }

    /**
     * 获取所有音频资源路径
     */
    getAllAudioPaths() {
        const audioPaths = [
            // BGM
            '/audio/bgm/如寄.mp3',
            '/audio/bgm/天赋界面.mp3',

            // UI音效
            '/audio/click/清脆按钮.mp3',
            '/audio/click/按下音效.mp3',
            '/audio/click/无效按钮音效.mp3',
            '/audio/click/铃铛.mp3',
            '/audio/click/胜利音效.mp3',
            '/audio/click/战斗失败音效.mp3',

            // 攻击音效
            '/audio/attack/挥砍1.mp3',
            '/audio/attack/交战_兵器碰撞1.mp3',
            '/audio/attack/交战_兵器碰撞2.mp3',
            '/audio/attack/射箭.mp3',
            '/audio/attack/挥拳击中1.mp3',
            '/audio/attack/气剑1.mp3',
            '/audio/attack/气剑2.mp3',

            // 受击音效
            '/audio/onhit/被击中1.mp3',
            '/audio/onhit/被砍中1.mp3',
            '/audio/onhit/被砍中2.mp3',

            // 技能音效
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

            // 战斗音效
            '/audio/fight/进入战斗.mp3',
            '/audio/fight/士兵呐喊.mp3',

            // 脚步声
            '/audio/walk/草地奔跑.mp3',
            '/audio/walk/草地奔跑脚步1.mp3',
            '/audio/walk/草地奔跑脚步2.mp3',
            '/audio/walk/草地奔跑脚步3.mp3',

            // 资源获得音效
            '/audio/sources/升级音效.mp3',
            '/audio/sources/点天赋.mp3',
            '/audio/sources/获得木材.mp3',
            '/audio/sources/获得木材厂.mp3',
            '/audio/sources/获得金矿厂.mp3',
            '/audio/sources/获得金钱.mp3'
        ];

        return audioPaths;
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
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.loadedImages.add(path);
                this.updateProgress(path);
                resolve();
            };
            img.onerror = () => {
                console.warn(`图片加载失败: ${path}`);
                this.updateProgress(path);
                resolve(); // 不阻断其他资源加载
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
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.loadedAudios.add(path);
                this.updateProgress(path);
                resolve();
            };
            audio.onerror = () => {
                console.warn(`音频加载失败: ${path}`);
                this.updateProgress(path);
                resolve(); // 不阻断其他资源加载
            };
            audio.preload = 'auto';
            audio.src = path;
        });
    }

    /**
     * 更新加载进度
     */
    updateProgress(fileName = null) {
        this.loadedCount++;
        if (this.onProgress) {
            this.onProgress(this.loadedCount, this.totalResources, fileName || this.currentLoadingFile);
        }
        this.currentLoadingFile = null; // 重置当前文件
    }

    /**
     * 检查资源是否已预加载
     */
    isImageLoaded(path) {
        return this.loadedImages.has(path);
    }

    isAudioLoaded(path) {
        return this.loadedAudios.has(path);
    }

    /**
     * 获取加载状态
     */
    getLoadingStats() {
        return {
            total: this.totalResources,
            loaded: this.loadedCount,
            progress: this.totalResources > 0 ? (this.loadedCount / this.totalResources) * 100 : 0
        };
    }
}

export const resourcePreloader = new ResourcePreloader();
