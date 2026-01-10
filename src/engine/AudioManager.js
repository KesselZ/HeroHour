/**
 * AudioManager: 全局声音管理器
 * 支持音效池、随机播放、概率触发、并发控制和 BGM 淡入淡出。
 */
class AudioManager {
    constructor() {
        this.sounds = new Map(); // 缓存 Audio 对象或池
        this.bgmCache = new Map(); // 缓存 BGM 对象实现断点续播
        this.bgm = null;
        
        // 从本地存储读取音量，如果没有则使用默认值
        const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
        this.bgmVolume = isBrowser ? parseFloat(localStorage.getItem('jx3_bgm_volume') ?? '0.5') : 0.5;
        this.sfxVolume = isBrowser ? parseFloat(localStorage.getItem('jx3_sfx_volume') ?? '0.5') : 0.5;
        
        // 频率限制：记录音效上次播放时间，防止同一音效瞬间重叠过多
        this.lastPlayed = new Map();
        this.throttleMs = 50; 

        // 音频配置映射
        this.config = {
            // UI 音效
            'ui_click': { 
                files: ['/audio/click/清脆按钮.mp3'],
                throttle: 10,  // 降低间隔到 10ms，允许快速连续点击
                pitchVar: 0.25 // 默认开启音调波动，让连续点击听起来更自然
            },
            'ui_press': { 
                files: ['/audio/click/按下音效.mp3'],
                throttle: 50 
            },
            'ui_invalid': { 
                files: ['/audio/click/无效按钮音效.mp3'],
                throttle: 50 
            },
            
            // 攻击音效池
            'attack_melee': { 
                files: [
                    '/audio/attack/挥砍1.mp3', 
                    '/audio/attack/交战_兵器碰撞1.mp3',
                    '/audio/attack/交战_兵器碰撞2.mp3'
                ],
                limit: 5 // 同一时间内最多播放 5 个
            },
            'attack_arrow': { 
                files: ['/audio/attack/射箭.mp3', '/audio/attack/射箭2.mp3'] 
            },
            'attack_unarmed': { files: ['/audio/attack/挥拳击中1.mp3'] },
            'attack_air_sword': { files: ['/audio/attack/气剑1.mp3', '/audio/attack/气剑2.mp3'] },
            
            // 受击音效池
            'onhit': { 
                files: [
                    '/audio/onhit/被击中1.mp3',
                    '/audio/onhit/被砍中1.mp3',
                    '/audio/onhit/被砍中2.mp3'
                ],
                limit: 8
            },
            
            // 技能音效
            'skill_zhanbafang': { files: ['/audio/skill/战八方.mp3'] },
            'skill_jiantan': { files: ['/audio/skill/践踏.mp3'] },
            'skill_field': { files: ['/audio/skill/放气场.mp3'] },
            'skill_sword_rain': { files: ['/audio/skill/气剑雨.mp3'] },
            'skill_arrows_all': { files: ['/audio/skill/万箭齐发.mp3'] },
            'skill_armor': { files: ['/audio/skill/盔甲声音.mp3'] },
            'skill_horse': { files: ['/audio/skill/马叫声.mp3'] },
            'skill_shout_extra': { files: ['/audio/skill/士兵呐喊.mp3'] },
            'skill_xiaoruhu': { files: ['/audio/skill/啸如虎.mp3'] },
            'skill_pierce': { files: ['/audio/skill/突刺.mp3'] },
            'skill_slash': { files: ['/audio/skill/切砍声音.mp3'] },
            'skill_air_cut': { files: ['/audio/skill/破空声.mp3'] },
            
            // 场景音效
            'soldier_shout': { 
                files: ['/audio/fight/士兵呐喊.mp3'], 
                chance: 1.0, 
                duration: 3000, 
                fadeOut: 5000 
            },
            'battle_intro': { 
                files: ['/audio/fight/进入战斗.mp3'],
                duration: 100,  // 几乎开播就准备淡出
                fadeOut: 1500   // 整个过程都在柔和淡出，遮盖任何可能的截断
            },
            'footstep_grass': { 
                files: [
                    '/audio/walk/草地奔跑脚步1.mp3',
                    '/audio/walk/草地奔跑脚步2.mp3',
                    '/audio/walk/草地奔跑脚步3.mp3'
                ], 
                throttle: 100 
            },
            
            // 资源获得音效
            'source_gold': { files: ['/audio/sources/获得金钱.mp3'], throttle: 100 },
            'source_wood': { files: ['/audio/sources/获得木材.mp3'], throttle: 100 },
            'source_levelup': { files: ['/audio/sources/升级音效.mp3'], throttle: 1000 },
            'capture_gold_mine': { files: ['/audio/sources/获得金矿厂.mp3'], throttle: 500 },
            'capture_sawmill': { files: ['/audio/sources/获得木材厂.mp3'], throttle: 500 },
            'talent_upgrade': { files: ['/audio/sources/点天赋.mp3'], throttle: 200, pitchVar: 0.1 },
            
            // 战场结算音效
            'battle_victory': { files: ['/audio/click/胜利音效.mp3'], throttle: 1000 },
            'battle_defeat': { files: ['/audio/click/战斗失败音效.mp3'], throttle: 1000 },
            'ui_bell': { files: ['/audio/click/铃铛.mp3'], throttle: 500 },
            'ui_teleport': { files: ['/audio/sources/传送.mp3'], throttle: 500 },
            'ui_card_draft': { files: ['/audio/click/出现建筑选择.mp3'], throttle: 500 },
            'ui_card_draft_epic': { files: ['/audio/sources/点天赋.mp3'], throttle: 500 },
            'ui_card_hover': { files: ['/audio/click/轻微click声.mp3'], throttle: 30, pitchVar: 0.1 },
            'ui_card_select': { files: ['/audio/click/卡牌声音.mp3'], throttle: 500 },
            'ui_card_shuffle': { files: ['/audio/click/扑克洗牌.mp3'], throttle: 500 },
            
            // 砍树相关
            'farm_chop': { 
                files: [
                    '/audio/farm/砍树声音1.mp3',
                    '/audio/farm/砍树声音2.mp3'
                ],
                throttle: 100
            },
            'farm_tree_down': { 
                files: ['/audio/farm/砍断了树.mp3'],
                throttle: 500
            }
        };
    }

    /**
     * 播放音效
     * @param {string} key 配置中的键名
     * @param {Object} options 覆盖选项 { volume, chance, throttle, onFinish, duration, fadeOut, pitch, pitchVar }
     * @param {number} options.duration 持续播放时间(ms)，之后停止或开始淡出
     * @param {number} options.fadeOut 淡出时间(ms)
     * @param {number} options.pitch 基础音调 (playbackRate), 默认 1.0
     * @param {number} options.pitchVar 音调随机抖动范围, 默认 0 (无抖动)
     */
    play(key, options = {}) {
        const conf = this.config[key];
        if (!conf) return;

        // 0. 强制播放检查 (Bypass chance and throttle)
        const isForce = options.force ?? false;

        // 1. 概率检查
        if (!isForce) {
            const chance = options.chance ?? conf.chance ?? 1.0;
            if (Math.random() > chance) return;
        }

        // 2. 频率限制 (Throttle)
        const now = Date.now();
        const throttle = options.throttle ?? conf.throttle ?? this.throttleMs;
        if (!isForce && this.lastPlayed.has(key) && now - this.lastPlayed.get(key) < throttle) {
            return;
        }
        this.lastPlayed.set(key, now);

        // 3. 随机选择文件
        const files = conf.files;
        const file = files[Math.floor(Math.random() * files.length)];

        // 4. 播放逻辑
        try {
            const audio = new Audio(file);

            // 如果资源已经被预加载，音频应该已经可以立即播放
            if (this.sounds.has(file)) {
                audio.preload = 'auto'; // 确保预加载状态
            }

            const baseVolume = (options.volume ?? 1.0) * this.sfxVolume;
            audio.volume = baseVolume;

            // 4.5 音调随机化 (Pitch/PlaybackRate)
            const basePitch = options.pitch ?? conf.pitch ?? 1.0;
            const pitchVar = options.pitchVar ?? conf.pitchVar ?? 0;
            if (pitchVar > 0) {
                audio.playbackRate = basePitch + (Math.random() - 0.5) * pitchVar;
            } else {
                audio.playbackRate = basePitch;
            }

            audio.play().catch(e => {
                // 忽略浏览器自动播放限制导致的错误
            });
            
            // 5. 自动生命周期管理：持续时间与淡出
            const duration = options.duration ?? conf.duration;
            const fadeOut = options.fadeOut ?? conf.fadeOut;

            if (duration) {
                setTimeout(() => {
                    if (audio.paused) return;
                    if (fadeOut) {
                        this.fadeAudio(audio, 0, fadeOut, () => {
                            audio.pause();
                            audio.remove();
                        });
                    } else {
                        audio.pause();
                        audio.remove();
                    }
                }, duration);
            }

            // 播放完后销毁，释放内存
            audio.onended = () => {
                if (options.onFinish) options.onFinish();
                audio.remove();
            };

            return audio; 
        } catch (e) {
            console.error('Failed to play audio:', file, e);
        }
    }

    /**
     * 播放/切换背景音乐 (带淡入淡出和断点续播)
     * @param {string} file BGM 文件路径
     * @param {boolean} loop 是否循环
     */
    playBGM(file, loop = true) {
        if (this.bgm && this.bgm.src.includes(file)) return;

        const startNewBGM = () => {
            // 检查缓存中是否已有该 BGM 对象
            let audio = this.bgmCache.get(file);
            
            if (!audio) {
                audio = new Audio(file);
                audio.loop = loop;
                this.bgmCache.set(file, audio);
            }

            this.bgm = audio;
            this.bgm.volume = 0;
            this.bgm.play().catch(e => {
                // 只有在用户第一次交互后才能播放 BGM
                // console.warn('BGM play blocked:', e);
            });
            
            // 淡入至预设音量
            this.fadeAudio(this.bgm, this.bgmVolume, 1000);
        };

        if (this.bgm) {
            // 先淡出旧 BGM
            this.fadeAudio(this.bgm, 0, 1000, () => {
                this.bgm.pause();
                startNewBGM();
            });
        } else {
            startNewBGM();
        }
    }

    /**
     * 停止当前 BGM
     * @param {number} fadeOutDuration 淡出时长
     */
    stopBGM(fadeOutDuration = 1000) {
        if (!this.bgm) return;
        
        const currentBGM = this.bgm;
        this.fadeAudio(currentBGM, 0, fadeOutDuration, () => {
            currentBGM.pause();
            if (this.bgm === currentBGM) this.bgm = null;
        });
    }

    /**
     * 音频淡入淡出工具
     */
    fadeAudio(audio, targetVolume, duration, callback) {
        const startVolume = audio.volume;
        const diff = targetVolume - startVolume;
        const steps = 20;
        const stepTime = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            audio.volume = startVolume + (diff * (currentStep / steps));
            if (currentStep >= steps) {
                clearInterval(timer);
                audio.volume = targetVolume;
                if (callback) callback();
            }
        }, stepTime);
    }

    /**
     * 预加载音频资源
     * @param {string} file 文件路径
     */
    async preload(file) {
        if (this.sounds.has(file)) return;
        
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.sounds.set(file, true); // 标记已预加载
                resolve();
            };
            audio.onerror = () => {
                reject(new Error(`音频加载失败: ${file}`));
            };
            audio.src = file;
            audio.load(); // 显式触发加载
        });
    }

    setSFXVolume(v) {
        this.sfxVolume = Math.max(0, Math.min(1, v));
        localStorage.setItem('jx3_sfx_volume', this.sfxVolume.toString());
    }

    setBGMVolume(v) {
        this.bgmVolume = Math.max(0, Math.min(1, v));
        localStorage.setItem('jx3_bgm_volume', this.bgmVolume.toString());
        if (this.bgm) this.bgm.volume = this.bgmVolume;
    }
}

export const audioManager = new AudioManager();

