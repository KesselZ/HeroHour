/**
 * WorldStatusManager: 江湖局势与事件引擎
 * 职责：
 * 1. 管理“江湖局势”（持久化的世界状态，影响 Tooltip 描述）
 * 2. 处理“主动事件”（玩家行为触发，如攻城、击杀 BOSS）
 * 3. 处理“被动事件”（随时间/季节自动触发，分为氛围传闻和逻辑事件）
 */
import { timeManager } from '../systems/TimeManager.js';
import { audioManager } from '../engine/AudioManager.js';
import { worldManager } from '../core/WorldManager.js';
import { terrainManager, TERRAIN_STYLES } from './TerrainManager.js';
import { weatherManager } from '../systems/WeatherManager.js';

export class WorldStatusManager {
    // --- 0. 频率控制超参数 ---
    static CONFIG = {
        SEASONAL_EXPECTATION: 0.8,      // 正常模式：每季度期望发生的逻辑事件总数
        ATMOSPHERIC_EXPECTATION_PER_MIN: 0.75, // 正常模式：每分钟期望发生的氛围传闻总数 (降低一倍)
        DEBUG_MULTIPLIER: 8             // Debug 模式下的概率倍率
    };

    // --- 1. 基础局势配置 ---
    static DIFFICULTY_BASES = {
        'easy': "如今世道尚算平稳，虽有零星山贼作乱，但各大门派根基稳固。正是英雄潜心闭关、积蓄实力的好时机。",
        'hard': "乱世风云渐起，边境守军告急，各地叛军正在招兵买马。江湖中传言四起，各方势力皆在暗中加强戒备。",
        'hell': "神州陆沉，狼烟四起！叛军铁骑已席卷各州郡。阁下的名声已引起了强敌的极度忌惮，杀机四伏。"
    };

    // 能够改变“局势描述”的重大事件定义
    static MAJOR_SITUATION_MODIFIERS = {
        'captured_main_city': " 阁下收复重镇之举震动朝野，百姓夹道欢迎，江湖威望已达巅峰！",
        'first_winter_passed': " 熬过了最严酷的寒冬，各派势力开始复苏，新的平衡正在达成。",
        'first_tianyi_kill': " 侠客首次重创天一教先遣队的壮举传遍武林，各大门派深受鼓舞，已公开悬赏缉拿其门徒。",
        'first_shence_kill': " 侠客正面击溃神策军叛军的消息震动朝野，天策府已发出江湖密令，号召天下豪杰共同讨逆。",
        'first_red_cult_kill': " 侠客挫败红衣教邪道祭礼的消息不胫而走，武林正道已集结势力，誓要将其连根拔起。"
    };

    // 邪恶势力独特的江湖通报文案
    static EVIL_FACTION_BROADCASTS = {
        'tianyi': {
            title: '幽冥剧毒',
            text: '腥红毒雾已彻底封锁荒野深处，【天一教】的尸傀大军正在疯狂扩张，所过之处寸草不生，生灵绝迹！',
            firstKill: {
                title: '武林悬赏',
                text: '侠客首次正面重创【天一教】！此举震动武林，各大门派已公开悬赏，正式开启全面抗击天一教的战争！'
            }
        },
        'shence': {
            title: '禁军压境',
            text: '玄甲铁骑的军旗已插遍荒野，【神策军】叛军封锁了所有命脉要道，正暴力搜刮每一寸土地，违令者杀无赦！',
            firstKill: {
                title: '讨逆檄文',
                text: '侠客竟正面击溃了【神策军】的先锋！天策府统领李承恩深感欣慰，已向全江湖发布讨逆檄文，誓要肃清叛逆！'
            }
        },
        'red_cult': {
            title: '血色祭礼',
            text: '恐怖的邪力正在荒野中心沸腾，【红衣教】的血色祭坛已经开启，方圆数里的生机已被祭礼强行掠夺，沦为焦土！',
            firstKill: {
                title: '正道齐心',
                text: '侠客挫败了【红衣教】的血色阴谋！武林各派英雄群情激昂，已集结精锐力量，开始围剿红衣教据点！'
            }
        }
    };

    // --- 2. 状态存储 ---
    static activeSituationKeys = new Set(); // 当前生效的重大局势 ID
    static eventHistory = [];               // 所有的传闻播报历史
    static usedEvilFactions = new Set();    // 永久记录已经登场过的势力 ID
    static firstKillFactions = new Set();   // 永久记录已经完成“首杀”的势力 ID
    static seasonalEventWeights = {};       // 季节事件的动态权重 (触发后衰减)

    // --- 3. 事件池定义 ---
    
    // 季节切换事件：切换季节时挨个判定
    static SEASONAL_EVENT_POOL = [
        {
            id: 'spring_scenery',
            title: '万物复苏',
            text: '细雨斜风，江湖各地的柳色渐深，正是结伴同游、切磋技艺的好季节。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '春'
        },
        {
            id: 'spring_rain',
            title: '润物无声',
            text: '随风潜入夜，润物细无声。一场春雨悄然而至。',
            type: 'rumor',
            weight: 0.6,
            condition: (ctx) => ctx.season === '春',
            weather: 'rain_light'
        },
        {
            id: 'spring_heroes',
            title: '少年英才',
            text: '春意盎然，江湖上涌现出一批资质不凡的少年侠客，引得各大门派纷纷关注。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '春'
        },
        {
            id: 'yeying_meeting',
            title: '名剑大会',
            text: '藏剑山庄叶英传帖江湖，欲召开名剑大会，引得各路剑客纷纷侧目。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.factions.includes('yeying') && ctx.playerHeroId !== 'yeying' && ctx.season === '春'
        },
        {
            id: 'summer_heat',
            title: '炎夏避暑',
            text: '烈日当头，不少侠客选择去青城山避暑，传闻那里的凉气可洗涤内功杂质。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '夏'
        },
        {
            id: 'summer_storm',
            title: '骤雨敲窗',
            text: '盛夏时节，乌云压顶，一场暴雨即将洗刷大地。',
            type: 'rumor',
            weight: 0.6,
            condition: (ctx) => ctx.season === '夏',
            weather: 'rain_medium'
        },
        {
            id: 'summer_tide',
            title: '东海潮汐',
            text: '盛夏时节，东海潮汐异常壮观，传闻有渔民在海滩捡到了散发着微光的奇异贝壳。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '夏'
        },
        {
            id: 'autumn_harvest',
            title: '岁物丰收',
            text: '秋收季节，百姓安居乐业，各地城池的税收有所提升。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '秋'
        },
        {
            id: 'autumn_maple',
            title: '枫华红叶',
            text: '枫华谷的枫叶红透了，不少文人墨客云集于此，吟咏“霜叶红于二月花”。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '秋',
            terrain: 'NORMAL_AUTUMN'
        },
        {
            id: 'heavy_snow',
            title: '大雪封山',
            text: '严冬已至，大雪封山，传闻北方势力正在囤积粮草，局势愈发扑朔迷离。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '冬',
            weather: 'snow',
            terrain: 'SNOW'
        },
        {
            id: 'winter_pause',
            title: '塞外休战',
            text: '严冬酷寒，塞外各部族暂时停止了袭扰，边境一带难得地进入了平静期。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '冬'
        },
        {
            id: 'winter_newyear',
            title: '岁末张灯',
            text: '岁末将至，各地城池张灯结彩，虽有严寒，但百姓心中充满对新年的期盼。',
            type: 'rumor',
            weight: 1.0,
            condition: (ctx) => ctx.season === '冬'
        }
    ];

    // 每秒氛围事件：带权重的随机池
    static ATMOSPHERIC_FLAVOR_POOL = [
        // --- 琐事 (Level 1 - 江湖琐事) ---
        { text: "听说稻香村附近很多野兽和山贼，不少猎户遇难。", weight: 1.0, type: 'trivia' },
        { text: "酒馆传闻，南方的粮价最近涨了不少。", weight: 1.0, type: 'trivia' },
        { text: "有侠客自北边归来，说那边的风雪比往年都要大。", weight: 1.0, type: 'trivia' },
        { text: "听说扬州城的酒肆最近新酿了玉冰烧，引得无数江湖客豪饮。", weight: 1.0, type: 'trivia' },
        { text: "有僧人自西域而来，在大雁塔下讲经三日，引来百鸟朝凤。", weight: 1.0, type: 'trivia' },
        { text: "近日夜晚，常能听到林中传出悠扬的笛声，却不见吹笛之人。", weight: 1.0, type: 'trivia' },
        { text: "村口的王大爷感慨，这太平日子怕是过不长久了。", weight: 1.0, type: 'trivia' },
        { text: "听说有商队在林间古道遭遇了伏击，财货散落一地。", weight: 1.0, type: 'trivia' },
        { text: "城里的戏班子最近新排了一出《杜十娘》，连演三场座无虚席。", weight: 1.0, type: 'trivia' },
        { text: "听说西域的葡萄干特别甜，正有大批商队运往中原。", weight: 1.0, type: 'trivia' },
        { text: "有个不知名的醉汉在酒馆里吹牛，说他曾见过龙神现身。", weight: 1.0, type: 'trivia' },
        { text: "后街的裁缝铺最近推出了一款云锦长袍，深受城中名媛喜爱。", weight: 1.0, type: 'trivia' },
        { text: "传闻后山有处隐秘的温泉，不少弟子夜里偷偷跑去泡澡。", weight: 1.0, type: 'trivia' },
        { text: "稻香村王婶家的老母猪昨日产了十二个崽，全村都传遍了。", weight: 1.0, type: 'trivia' },

        // --- 传言/大事 (Level 2 - 武林大事) ---
        { text: "江湖传闻，有一名神秘剑客在各地挑战名门弟子。", weight: 1.0, type: 'rumor' },
        { text: "官道旁的茶摊老板说，最近路过的马蹄声急促了不少。", weight: 1.0, type: 'rumor' },
        { text: "传闻昆仑派一名弟子近日下山历练，一路行侠仗义，传为美谈。", weight: 1.0, type: 'rumor' },
        { text: "有小道消息称，江南一代出现了一位擅用暗器的隐世高手。", weight: 1.0, type: 'rumor' },
        { text: "近日华山论剑台上有高人比武留下的剑痕，至今仍有剑意残留。", weight: 1.0, type: 'rumor' },
        
        // 门派特色事件 (带 Condition 检查：只有当角色存在且玩家不扮演该角色时触发)
        { 
            text: "听说藏剑山庄剑池近日神光乍现，大庄主叶英正闭关铸造一柄绝世神兵。", 
            weight: 1.5, type: 'rumor', 
            condition: (ctx) => ctx.factions.includes('yeying') && ctx.playerHeroId !== 'yeying'
        },
        { 
            text: "西湖边有人目睹叶英庄主在亭中静坐，一整日滴水未进，似乎悟出了新剑法。", 
            weight: 1.5, type: 'rumor', 
            condition: (ctx) => ctx.factions.includes('yeying') && ctx.playerHeroId !== 'yeying'
        },
        { 
            text: "天策府最近在北邙山进行演武，战鼓声响彻云霄，将士士气如虹。", 
            weight: 1.5, type: 'rumor', 
            condition: (ctx) => ctx.factions.includes('lichengen') && ctx.playerHeroId !== 'lichengen'
        },
        { 
            text: "洛阳城内随处可见巡逻的天策甲士，传闻李承恩统领正在加强城防布局。", 
            weight: 1.5, type: 'rumor', 
            condition: (ctx) => ctx.factions.includes('lichengen') && ctx.playerHeroId !== 'lichengen'
        },
        { 
            text: "华山之巅近日紫气东来，纯阳宫李忘生道长似乎在参悟长生之道。", 
            weight: 1.5, type: 'rumor', 
            condition: (ctx) => ctx.factions.includes('liwangsheng') && ctx.playerHeroId !== 'liwangsheng'
        },
        { 
            text: "有道士宣称，在纯阳宫太极殿附近感应到了极为纯正的阴阳二气波动。", 
            weight: 1.5, type: 'rumor', 
            condition: (ctx) => ctx.factions.includes('liwangsheng') && ctx.playerHeroId !== 'liwangsheng'
        }
    ];

    /**
     * 触发势力降临的独特播报
     */
    static broadcastEvilSpawn(factionId) {
        const config = this.EVIL_FACTION_BROADCASTS[factionId];
        if (!config) return;

        this.triggerActiveEvent(`evil_rise_${factionId}`, {
            title: config.title,
            text: config.text,
            type: 'major',
            affectsSituation: true
        });
    }

    /**
     * 触发势力首次被击败（小怪）的独特播报
     */
    static broadcastFirstKill(factionId) {
        if (this.firstKillFactions.has(factionId)) return;

        const config = this.EVIL_FACTION_BROADCASTS[factionId];
        if (!config || !config.firstKill) return;

        this.firstKillFactions.add(factionId);

        this.triggerActiveEvent(`first_${factionId}_kill`, {
            title: config.firstKill.title,
            text: config.firstKill.text,
            type: 'major',
            affectsSituation: true
        });
    }

    /**
     * 【主动事件接口】
     * 由外部逻辑（如战斗结束、占领城池）手动调用
     * @param {string} eventId 事件 ID
     * @param {Object} options { title, text, type, affectsSituation }
     */
    static triggerActiveEvent(eventId, { title, text, type = 'major', affectsSituation = false } = {}) {
        // 1. 如果影响局势，记录下来
        if (affectsSituation) {
            this.activeSituationKeys.add(eventId);
        }

        // 根据 type 决定默认标签名称
        let tag = "风云惊变"; 
        if (type === 'rumor') tag = "武林大事";
        if (type === 'trivia') tag = "江湖琐事";

        // 2. 构建事件对象
        const event = {
            id: eventId,
            title: tag,
            text: title ? `${title}：${text}` : text, // 将具体标题融入正文
            type: type, // trivia, rumor, major
            year: timeManager.year,
            season: timeManager.seasons[timeManager.seasonIndex],
            timestamp: Date.now()
        };

        // 3. 进入播报流程
        this._processEvent(event);
    }

    /**
     * 【季节切换检查】
     * 每次季节更替时调用一次
     */
    static onSeasonChange(worldManagerRef) {
        const context = {
            season: timeManager.seasons[timeManager.seasonIndex],
            year: timeManager.year,
            factions: Object.values(worldManagerRef.factions).map(f => f.heroId),
            playerHeroId: worldManagerRef.heroData.id
        };

        // 统计当前符合条件的事件
        const validEvents = this.SEASONAL_EVENT_POOL.filter(e => e.condition(context));
        if (validEvents.length === 0) return;

        /**
         * 权重随机逻辑：
         * 1. 每个事件有初始权重 1.0
         * 2. 触发后权重衰减至 20% (乘以 0.2)
         * 3. 使用权重随机算法确保期望总量为 SEASONAL_EXPECTATION (0.8)
         */

        // 为符合条件的事件获取当前权重
        const eventsWithWeights = validEvents.map(eventDef => ({
            ...eventDef,
            currentWeight: this.seasonalEventWeights[eventDef.id] !== undefined ?
                this.seasonalEventWeights[eventDef.id] : eventDef.weight
        }));

        // 计算期望触发数量并进行权重随机
        const targetCount = this.CONFIG.SEASONAL_EXPECTATION;
        let remainingTarget = targetCount;
        let terrainStyleToSet = null;
        let weatherToSet = 'none'; // 核心新增：天气联动变量

        // 如果开启 Debug 模式，应用倍率
        if (worldManager.constructor.DEBUG.HIGH_EVENT_FREQUENCY) {
            remainingTarget *= this.CONFIG.DEBUG_MULTIPLIER;
        }

        // 使用权重随机算法选择事件
        while (remainingTarget > 0 && eventsWithWeights.length > 0) {
            // 核心修正：如果剩余期望不足 1.0，则按概率判定本次是否触发
            if (remainingTarget < 1.0 && Math.random() > remainingTarget) {
                break;
            }

            const totalWeight = eventsWithWeights.reduce((sum, e) => sum + e.currentWeight, 0);
            if (totalWeight <= 0) break;

            const randomValue = Math.random() * totalWeight;
            let cumulativeWeight = 0;
            let selectedIndex = -1;

            for (let i = 0; i < eventsWithWeights.length; i++) {
                cumulativeWeight += eventsWithWeights[i].currentWeight;
                if (randomValue <= cumulativeWeight) {
                    selectedIndex = i;
                    break;
                }
            }

            if (selectedIndex !== -1) {
                const selectedEvent = eventsWithWeights[selectedIndex];

                // --- 核心联动：如果触发了带效果的事件，自动设置目标样式 ---
                if (selectedEvent.terrain) {
                    terrainStyleToSet = TERRAIN_STYLES[selectedEvent.terrain] || selectedEvent.terrain;
                }
                if (selectedEvent.weather) {
                    weatherToSet = selectedEvent.weather;
                }

                // 触发事件
                this.triggerActiveEvent(selectedEvent.id, {
                    title: selectedEvent.title,
                    text: selectedEvent.text,
                    type: selectedEvent.type || 'major',
                    affectsSituation: false
                });

                // 权重衰减 (乘以 0.2)
                this.seasonalEventWeights[selectedEvent.id] = selectedEvent.currentWeight * 0.2;

                // 从候选列表中移除，避免重复触发
                eventsWithWeights.splice(selectedIndex, 1);

                remainingTarget--;
            } else {
                break; // 无法选择事件，退出循环
            }
        }

        // --- 核心联动：应用地形变换 ---
        const mapData = worldManagerRef.mapState.grid;
        const heightMap = worldManagerRef.mapState.heightMap;

        if (terrainStyleToSet) {
            // 触发了特殊天气（如大雪、红叶），切换到对应地形
            terrainManager.setGlobalStyle(terrainStyleToSet, mapData, heightMap);
        } else if (terrainManager.currentBaseStyle !== TERRAIN_STYLES.DEFAULT) {
            // 季节更替且没有触发特殊天气，则平滑恢复为默认草地
            terrainManager.setGlobalStyle(TERRAIN_STYLES.DEFAULT, mapData, heightMap);
        }

        // --- 核心联动：应用天气效果 ---
        if (weatherToSet === 'snow') {
            weatherManager.setSnow();
        } else if (weatherToSet === 'rain_light') {
            weatherManager.setRain('light');
        } else if (weatherToSet === 'rain_medium') {
            weatherManager.setRain('medium');
        } else {
            // 如果新季节没有触发持续性降水事件，则停止之前的降水 (满足“下个季节结束”逻辑)
            weatherManager.stop();
        }

        // --- 核心新增：检查特殊的动态江湖事件 (如邪恶势力降临) ---
        this._checkSpecialDynamicEvents(worldManagerRef);
    }

    /**
     * 检查并触发特殊的动态世界事件
     */
    static _checkSpecialDynamicEvents(worldManagerRef) {
        const globalProgress = timeManager.getGlobalProgress(); // 已过的季度总数
        const difficulty = timeManager.difficulty || 'easy';

        // --- 核心逻辑：根据难度定制邪恶势力登场节奏 ---
        // 简单：第 1 季度结束（入夏）登场 1 个
        // 困难：第 1, 2 季度结束（入夏、入秋）各登场 1 个，共 2 个
        // 地狱：第 1, 2, 3 季度结束（入夏、入秋、入冬）各登场 1 个，共 3 个
        
        let targetCount = 0;
        if (difficulty === 'easy') {
            if (globalProgress === 1) targetCount = 1;
        } else if (difficulty === 'hard') {
            if (globalProgress >= 1 && globalProgress <= 2) targetCount = globalProgress;
        } else if (difficulty === 'hell') {
            if (globalProgress >= 1 && globalProgress <= 3) targetCount = globalProgress;
        }

        // 如果当前已登场的势力数量已经达到或超过该阶段应有的数量，则跳过
        if (this.usedEvilFactions.size >= targetCount) return;

        const evilFactions = ['tianyi', 'shence', 'red_cult'];
        const remainingPool = evilFactions.filter(f => !this.usedEvilFactions.has(f));

        if (remainingPool.length > 0) {
            const nextFaction = remainingPool[Math.floor(Math.random() * remainingPool.length)];
            
            // 永久记录
            this.usedEvilFactions.add(nextFaction);
            
            // 执行生成
            worldManagerRef.spawnEvilBaseDynamic(nextFaction);
        }
    }

    /**
     * 【每秒氛围检查】
     * 每秒由场景层驱动，极低概率触发
     */
    static checkAtmosphericFlavor() {
        /**
         * 计算公式：
         * 期望每分钟 1.5 个 -> 每秒概率 = 1.5 / 60 = 0.025
         */
        let chancePerSecond = this.CONFIG.ATMOSPHERIC_EXPECTATION_PER_MIN / 60;

        // 如果开启 Debug 模式，应用倍率
        if (worldManager.constructor.DEBUG.HIGH_EVENT_FREQUENCY) chancePerSecond *= this.CONFIG.DEBUG_MULTIPLIER;

        if (Math.random() < chancePerSecond) {
            const context = {
                season: timeManager.seasons[timeManager.seasonIndex],
                factions: Object.values(worldManager.factions).map(f => f.heroId),
                playerHeroId: worldManager.heroData.id
            };

            // 过滤出符合条件的事件
            const availablePool = this.ATMOSPHERIC_FLAVOR_POOL.filter(entry => 
                !entry.condition || entry.condition(context)
            );

            // 使用权重随机算法选择文本
            const selectedIndex = this._getWeightedRandomIndex(availablePool);
            if (selectedIndex === -1) return;

            const entry = availablePool[selectedIndex];
            
            // 触发后权重严重衰减（降至 20%），更狠地压制重复事件
            entry.weight *= 0.2;

            const type = entry.type || 'trivia';
            let tag = "江湖琐事";
            if (type === 'rumor') tag = "武林大事";

            const event = {
                id: 'flavor_' + Date.now(),
                title: tag,
                text: entry.text,
                type: type,
                year: timeManager.year,
                season: timeManager.seasons[timeManager.seasonIndex],
                timestamp: Date.now()
            };

            this._processEvent(event);
        }
    }

    /**
     * 权重随机辅助函数
     */
    static _getWeightedRandomIndex(pool) {
        const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight <= 0) return -1;

        let random = Math.random() * totalWeight;
        for (let i = 0; i < pool.length; i++) {
            if (random < pool[i].weight) {
                return i;
            }
            random -= pool[i].weight;
        }
        return pool.length - 1;
    }

    /**
     * 获取当前的江湖局势描述 (用于 Tooltip)
     * @returns {string}
     */
    static getSituationDescription(difficulty) {
        let desc = this.DIFFICULTY_BASES[difficulty] || this.DIFFICULTY_BASES['easy'];
        
        // 遍历所有已激活的重大局势修改器
        this.activeSituationKeys.forEach(key => {
            if (this.MAJOR_SITUATION_MODIFIERS[key]) {
                desc += this.MAJOR_SITUATION_MODIFIERS[key];
            }
        });

        return desc;
    }

    /**
     * 内部处理：记录历史、派发播报事件
     */
    static _processEvent(event) {
        this.eventHistory.unshift(event);
        if (this.eventHistory.length > 50) this.eventHistory.pop(); // 限制历史记录

        console.log(`%c[江湖播报] ${event.title}: ${event.text}`, "color: #d4af37");
        
        // 派发全局事件给 UI
        window.dispatchEvent(new CustomEvent('world-broadcast', { detail: event }));
    }

    // --- UI 逻辑维持 ---

    /**
     * 获取存档数据
     */
    static getSaveData() {
        return {
            activeSituationKeys: Array.from(this.activeSituationKeys),
            eventHistory: this.eventHistory,
            usedEvilFactions: Array.from(this.usedEvilFactions), // 记录已登场的势力
            firstKillFactions: Array.from(this.firstKillFactions), // 记录已首杀的势力
            seasonalEventWeights: this.seasonalEventWeights, // 记录季节事件权重
            flavorPoolWeights: this.ATMOSPHERIC_FLAVOR_POOL.map(e => e.weight)
        };
    }

    /**
     * 加载存档数据
     */
    static loadSaveData(data) {
        if (!data) return;
        
        if (data.activeSituationKeys) {
            this.activeSituationKeys = new Set(data.activeSituationKeys);
        }
        
        if (data.eventHistory) {
            this.eventHistory = data.eventHistory;
        }

        if (data.usedEvilFactions) {
            this.usedEvilFactions = new Set(data.usedEvilFactions);
        }

        if (data.firstKillFactions) {
            this.firstKillFactions = new Set(data.firstKillFactions);
        }

        if (data.seasonalEventWeights) {
            this.seasonalEventWeights = data.seasonalEventWeights;
        }

        if (data.flavorPoolWeights && data.flavorPoolWeights.length === this.ATMOSPHERIC_FLAVOR_POOL.length) {
            data.flavorPoolWeights.forEach((w, i) => {
                this.ATMOSPHERIC_FLAVOR_POOL[i].weight = w;
            });
        }

        console.log("%c[系统] WorldStatusManager 存档数据恢复完毕", "color: #4CAF50; font-weight: bold");
    }

    static initUI() {
        const horn = document.getElementById('broadcast-horn');
        const historyPanel = document.getElementById('world-event-history-panel');
        const closeBtn = document.getElementById('close-event-history');

        if (horn) {
            horn.onclick = () => {
                audioManager.play('ui_click');
                this.toggleHistoryPanel(true);
            };
        }

        if (closeBtn) {
            closeBtn.onclick = () => {
                // 如果在 main.js 中定义了全局 closePanelWithHUD，则使用它以保持逻辑统一
                if (window.closePanelWithHUD) {
                    window.closePanelWithHUD('world-event-history-panel');
                } else {
                    audioManager.play('ui_click');
                    this.toggleHistoryPanel(false);
                }
            };
        }

        window.addEventListener('world-broadcast', (e) => {
            const event = e.detail;
            this.showBroadcastBubble(event);
            
            // --- 修复：如果历史面板已打开，则通过添加 DOM 元素实现动画刷新 ---
            const panel = document.getElementById('world-event-history-panel');
            const isPanelOpen = panel && !panel.classList.contains('hidden');

            if (isPanelOpen) {
                this.addEventToHistoryUI(event);
                this.updateNotificationDot(false);
            } else {
                this.updateNotificationDot(true);
            }
            
            this.shakeHorn();
        });
    }

    /**
     * 动态向 UI 列表中插入一个新事件（带动画）
     */
    static addEventToHistoryUI(event) {
        const list = document.getElementById('event-history-list');
        if (!list) return;

        // 如果之前是空的，先清空提示
        if (list.querySelector('.history-empty-hint')) {
            list.innerHTML = '';
        }

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-item-header">
                <span class="history-item-time">天宝 ${event.year} 年 · ${event.season}</span>
                <span class="history-item-tag ${event.type}">${event.title}</span>
            </div>
            <div class="history-item-content">
                ${event.text}
            </div>
        `;

        // 插入到最前面
        list.insertBefore(item, list.firstChild);

        // 如果条目过多，移除末尾多余的 DOM 元素（保持 UI 简洁）
        if (list.children.length > 50) {
            list.lastChild.remove();
        }
    }

    static toggleHistoryPanel(show) {
        const panel = document.getElementById('world-event-history-panel');
        if (!panel) return;
        if (show) {
            this.renderHistoryList();
            panel.classList.remove('hidden');
            this.updateNotificationDot(false);
        } else {
            panel.classList.add('hidden');
        }
    }

    static renderHistoryList() {
        const list = document.getElementById('event-history-list');
        if (!list) return;
        if (this.eventHistory.length === 0) {
            list.innerHTML = '<div class="history-empty-hint">暂无江湖传闻...</div>';
            return;
        }
        list.innerHTML = this.eventHistory.map(event => `
            <div class="history-item">
                <div class="history-item-header">
                    <span class="history-item-time">天宝 ${event.year} 年 · ${event.season}</span>
                    <span class="history-item-tag ${event.type}">${event.title}</span>
                </div>
                <div class="history-item-content">
                    ${event.text}
                </div>
            </div>
        `).join('');
    }

    static showBroadcastBubble(event) {
        const container = document.getElementById('broadcast-bubble-container');
        if (!container) return;

        const bubble = document.createElement('div');
        bubble.className = 'broadcast-bubble';
        
        bubble.innerHTML = `
            <span class="event-tag ${event.type}">${event.title}</span>
            <div class="event-text">${event.text}</div>
        `;
        container.appendChild(bubble);
        setTimeout(() => {
            bubble.classList.add('fade-out');
            setTimeout(() => bubble.remove(), 500);
        }, 4000);
    }

    static updateNotificationDot(show) {
        const dot = document.getElementById('broadcast-dot');
        if (dot) {
            if (show) dot.classList.remove('hidden');
            else dot.classList.add('hidden');
        }
    }

    static shakeHorn() {
        const horn = document.getElementById('broadcast-horn');
        if (horn) {
            horn.classList.add('shake');
            setTimeout(() => horn.classList.remove('shake'), 2000);
        }
    }
}
