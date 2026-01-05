/**
 * WorldStatusManager: 江湖局势与事件引擎
 * 职责：
 * 1. 管理“江湖局势”（持久化的世界状态，影响 Tooltip 描述）
 * 2. 处理“主动事件”（玩家行为触发，如攻城、击杀 BOSS）
 * 3. 处理“被动事件”（随时间/季节自动触发，分为氛围传闻和逻辑事件）
 */
import { timeManager } from './TimeManager.js';
import { audioManager } from './AudioManager.js';
import { worldManager } from './WorldManager.js';

export class WorldStatusManager {
    // --- 0. 频率控制超参数 ---
    static CONFIG = {
        SEASONAL_EXPECTATION: 0.8,      // 正常模式：每季度期望发生的逻辑事件总数
        ATMOSPHERIC_EXPECTATION_PER_MIN: 1.5, // 正常模式：每分钟期望发生的氛围传闻总数
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
        'defeated_rebel_leader': " 随着叛军首领落马，各州郡的压力稍有缓解，但残余势力仍在暗中窥伺。",
        'captured_main_city': " 阁下收复重镇之举震动朝野，百姓夹道欢迎，江湖威望已达巅峰！",
        'first_winter_passed': " 熬过了最严酷的寒冬，各派势力开始复苏，新的平衡正在达成。"
    };

    // --- 2. 状态存储 ---
    static activeSituationKeys = new Set(); // 当前生效的重大局势 ID
    static eventHistory = [];               // 所有的传闻播报历史

    // --- 3. 事件池定义 ---
    
    // 季节切换事件：切换季节时挨个判定
    static SEASONAL_EVENT_POOL = [
        {
            id: 'spring_scenery',
            title: '万物复苏',
            text: '细雨斜风，江湖各地的柳色渐深，正是结伴同游、切磋技艺的好季节。',
            type: 'rumor',
            chance: 0.8,
            condition: (ctx) => ctx.season === '春'
        },
        {
            id: 'spring_heroes',
            title: '少年英才',
            text: '春意盎然，江湖上涌现出一批资质不凡的少年侠客，引得各大门派纷纷关注。',
            type: 'rumor',
            chance: 0.5,
            condition: (ctx) => ctx.season === '春'
        },
        {
            id: 'yeying_meeting',
            title: '名剑大会',
            text: '藏剑山庄叶英传帖江湖，欲召开名剑大会，引得各路剑客纷纷侧目。',
            type: 'rumor',
            chance: 0.4,
            condition: (ctx) => ctx.factions.includes('yeying') && ctx.playerHeroId !== 'yeying' && ctx.season === '春'
        },
        {
            id: 'summer_heat',
            title: '炎夏避暑',
            text: '烈日当头，不少侠客选择去青城山避暑，传闻那里的凉气可洗涤内功杂质。',
            type: 'rumor',
            chance: 0.8,
            condition: (ctx) => ctx.season === '夏'
        },
        {
            id: 'summer_tide',
            title: '东海潮汐',
            text: '盛夏时节，东海潮汐异常壮观，传闻有渔民在海滩捡到了散发着微光的奇异贝壳。',
            type: 'rumor',
            chance: 0.6,
            condition: (ctx) => ctx.season === '夏'
        },
        {
            id: 'autumn_harvest',
            title: '岁物丰收',
            text: '秋收季节，百姓安居乐业，各地城池的税收有所提升。',
            type: 'rumor',
            chance: 0.8,
            condition: (ctx) => ctx.season === '秋'
        },
        {
            id: 'autumn_maple',
            title: '枫华红叶',
            text: '枫华谷的枫叶红透了，不少文人墨客云集于此，吟咏“霜叶红于二月花”。',
            type: 'rumor',
            chance: 0.7,
            condition: (ctx) => ctx.season === '秋'
        },
        {
            id: 'heavy_snow',
            title: '大雪封山',
            text: '严冬已至，大雪封山，传闻北方势力正在囤积粮草，局势愈发扑朔迷离。',
            type: 'rumor',
            chance: 0.6,
            condition: (ctx) => ctx.season === '冬'
        },
        {
            id: 'winter_pause',
            title: '塞外休战',
            text: '严冬酷寒，塞外各部族暂时停止了袭扰，边境一带难得地进入了平静期。',
            type: 'rumor',
            chance: 0.5,
            condition: (ctx) => ctx.season === '冬'
        },
        {
            id: 'winter_newyear',
            title: '岁末张灯',
            text: '岁末将至，各地城池张灯结彩，虽有严寒，但百姓心中充满对新年的期盼。',
            type: 'rumor',
            chance: 0.8,
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
         * 概率缩放逻辑：
         * 我们希望触发的总数期望值 = SEASONAL_EXPECTATION (0.8)
         * 假设每个事件原始概率为 p_i，缩放后的概率 P_i = p_i * k
         * 则期望值 E = Σ P_i = k * Σ p_i
         * 所以缩放系数 k = SEASONAL_EXPECTATION / Σ p_i
         */
        const sumOriginalChances = validEvents.reduce((sum, e) => sum + e.chance, 0);
        let k = this.CONFIG.SEASONAL_EXPECTATION / sumOriginalChances;

        // 如果开启 Debug 模式，应用倍率
        if (worldManager.constructor.DEBUG.HIGH_EVENT_FREQUENCY) k *= this.CONFIG.DEBUG_MULTIPLIER;

        validEvents.forEach(eventDef => {
            if (Math.random() < eventDef.chance * k) {
                this.triggerActiveEvent(eventDef.id, {
                    title: eventDef.title,
                    text: eventDef.text,
                    type: eventDef.type || 'major',
                    affectsSituation: false 
                });
            }
        });

        // --- 核心新增：检查特殊的动态江湖事件 (如邪恶势力降临) ---
        this._checkSpecialDynamicEvents(worldManagerRef);
    }

    /**
     * 检查并触发特殊的动态世界事件
     */
    static _checkSpecialDynamicEvents(worldManagerRef) {
        const globalProgress = timeManager.getGlobalProgress(); // 已过的季度总数
        
        // 邪恶势力降临逻辑：
        // 第一年·夏 (进度 1) 开始，每个季度有概率降临一个邪恶势力，直到降满 2 个为止 (对应原逻辑规模)
        // 用户提到“邪恶势力据点（如天一教、神策军）”，原逻辑是 3 选 2，我们也保持 2 个
        if (globalProgress >= 1) {
            const currentEvilBases = worldManagerRef.mapState.entities.filter(e => e.config?.isEvilBase && !e.isRemoved);
            const evilFactions = ['tianyi', 'shence', 'red_cult'];
            const existingFactions = currentEvilBases.map(e => e.config.faction);
            const remainingFactions = evilFactions.filter(f => !existingFactions.includes(f));

            // 如果当前存活的邪恶据点少于 2 个，且还有可选势力
            if (currentEvilBases.length < 2 && remainingFactions.length > 0) {
                // 进度 1 (第一年夏) 100% 降临第一个
                // 之后每个季度 50% 概率降临第二个
                const shouldSpawn = (globalProgress === 1 && currentEvilBases.length === 0) || (Math.random() < 0.5);
                
                if (shouldSpawn) {
                    const nextFaction = remainingFactions[Math.floor(Math.random() * remainingFactions.length)];
                    worldManagerRef.spawnEvilBaseDynamic(nextFaction);
                }
            }
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
