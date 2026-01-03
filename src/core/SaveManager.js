import { worldManager } from './WorldManager.js';
import { talentManager } from './TalentManager.js';
import { timeManager } from './TimeManager.js';
import { audioManager } from './AudioManager.js';

import { WorldStatusManager } from './WorldStatusManager.js';

/**
 * SaveManager: 负责全局存档的序列化、持久化存储与分发
 * 采用模块化快照方案，不直接操作具体业务数值
 */
class SaveManager {
    constructor() {
        this.SAVE_KEY_PREFIX = 'herohour_save_slot_';
        this.METADATA_KEY_PREFIX = 'herohour_metadata_slot_';
    }

    /**
     * 执行保存操作
     * @param {number} slotId 存档位 ID (1, 2, 3)
     */
    save(slotId) {
        try {
            // 1. 收集各模块快照
            const saveData = {
                version: '1.0',
                timestamp: Date.now(),
                world: worldManager.getSaveData(),
                talents: talentManager.getSaveData(),
                time: timeManager.getSaveData(),
                worldStatus: WorldStatusManager.getSaveData(),
                settings: {
                    bgm: audioManager.bgmVolume,
                    sfx: audioManager.sfxVolume
                }
            };

            // 2. 写入主体数据 (巨大 JSON)
            localStorage.setItem(`${this.SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(saveData));

            // 3. 写入轻量化元数据 (用于 UI 列表快速展示)
            const heroInfo = worldManager.availableHeroes[worldManager.heroData.id];
            const metadata = {
                timestamp: saveData.timestamp,
                heroName: heroInfo ? heroInfo.name : '未知侠客',
                heroLevel: worldManager.heroData.level,
                dateStr: timeManager.getDateString(),
                gold: worldManager.resources.gold,
                heroId: worldManager.heroData.id
            };
            localStorage.setItem(`${this.METADATA_KEY_PREFIX}${slotId}`, JSON.stringify(metadata));

            console.log(`%c[存档系统] 成功保存至位置 ${slotId}`, 'color: #4CAF50; font-weight: bold', metadata);
            return true;
        } catch (error) {
            console.error('[存档系统] 保存失败:', error);
            // 如果是容量超限 (QuotaExceededError)，可以在此处提醒用户
            return false;
        }
    }

    /**
     * 执行读取操作
     * 注意：此方法仅恢复数据状态，UI 的跳转由 main.js 控制
     * @param {number} slotId 存档位 ID
     */
    load(slotId) {
        try {
            const rawData = localStorage.getItem(`${this.SAVE_KEY_PREFIX}${slotId}`);
            if (!rawData) {
                console.warn(`[存档系统] 尝试读取空存档位: ${slotId}`);
                return false;
            }

            const data = JSON.parse(rawData);

            // 核心分发顺序：Time -> World -> Talent
            // 因为 Talent 的属性加成依赖于 WorldManager 的 heroData 结构
            timeManager.loadSaveData(data.time);
            worldManager.loadSaveData(data.world);
            talentManager.loadSaveData(data.talents);
            WorldStatusManager.loadSaveData(data.worldStatus);

            // 恢复设置
            if (data.settings) {
                if (data.settings.bgm !== undefined) audioManager.setBGMVolume(data.settings.bgm);
                if (data.settings.sfx !== undefined) audioManager.setSFXVolume(data.settings.sfx);
            }

            console.log(`%c[存档系统] 位置 ${slotId} 数据恢复成功`, 'color: #4CAF50; font-weight: bold');
            return true;
        } catch (error) {
            console.error('[存档系统] 读取失败，数据可能损坏:', error);
            return false;
        }
    }

    /**
     * 获取指定存档位的元数据
     */
    getMetadata(slotId) {
        const raw = localStorage.getItem(`${this.METADATA_KEY_PREFIX}${slotId}`);
        return raw ? JSON.parse(raw) : null;
    }

    /**
     * 获取所有存档位的元数据列表
     */
    getAllMetadata() {
        return [1, 2, 3].map(id => this.getMetadata(id));
    }

    /**
     * 检查存档是否存在
     */
    hasSave(slotId) {
        return localStorage.getItem(`${this.SAVE_KEY_PREFIX}${slotId}`) !== null;
    }

    /**
     * 格式化时间戳
     */
    formatTimestamp(ts) {
        const date = new Date(ts);
        return `${date.getFullYear()}/${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    }
}

export const saveManager = new SaveManager();

