import { modifierManager } from './ModifierManager.js';

/**
 * 城镇类：管理单个城镇的属性和逻辑
 */
class City {
    constructor(id, name, type = 'main_city') {
        this.id = id;
        this.name = name;
        this.type = type; // 决定图标
        this.level = 1;
        
        // 建筑分类与效果定义预留
        this.buildings = {
            'economy': [
                { 
                    id: 'town_hall', name: '议政厅', level: 1, maxLevel: 3, 
                    cost: { gold: 500, wood: 100 }, icon: 'main_city', 
                    effect: '增加基础金钱产出',
                    description: '城镇的核心权力机构。升级可大幅提升每季度的税收收入。'
                },
                { 
                    id: 'market', name: '市场', level: 1, maxLevel: 2, 
                    cost: { gold: 300, wood: 50 }, icon: 'gold_pile', 
                    effect: '提高资源产出效率',
                    description: '进行商贸往来的场所。提高金钱和木材的额外产出百分比。'
                },
                { 
                    id: 'tavern', name: '酒馆', level: 0, maxLevel: 1, 
                    cost: { gold: 200, wood: 80 }, icon: 'healer', 
                    effect: '解锁万花补给招募',
                    description: '江湖侠客落脚之地。建造后可招募擅长治疗的万花弟子。'
                },
                { 
                    id: 'inn', name: '旅馆', level: 0, maxLevel: 1, 
                    cost: { gold: 350, wood: 120 }, icon: 'items', 
                    effect: '提高英雄体力恢复速率',
                    description: '提供舒适休息的环境。让驻守英雄和路过侠客更快恢复元气。'
                }
            ],
            'military': [
                { 
                    id: 'barracks', name: '兵营', level: 1, maxLevel: 5, 
                    cost: { gold: 400, wood: 150 }, icon: 'melee', 
                    effect: '解锁基础步兵，提升生命值',
                    description: '训练天策弟子和长歌弟子的地方。升级可强化其体质。'
                },
                { 
                    id: 'archery_range', name: '靶场', level: 0, maxLevel: 3, 
                    cost: { gold: 400, wood: 200 }, icon: 'archer', 
                    effect: '解锁唐门射手，提升伤害',
                    description: '供远程兵种修习箭术。建造后可招募唐门射手。'
                },
                { 
                    id: 'stable', name: '马厩', level: 0, maxLevel: 3, 
                    cost: { gold: 800, wood: 300 }, icon: 'tiance', 
                    effect: '解锁天策骑兵招募',
                    description: '饲养名马的场所。建造后可招募强大的天策府骑兵。'
                }
            ],
            'magic': [
                { 
                    id: 'mage_guild', name: '法师公会', level: 0, maxLevel: 5, 
                    cost: { gold: 1000, wood: 500 }, icon: 'chunyang', 
                    effect: '解锁纯阳弟子招募',
                    description: '道家修行之地。建造后可招募控制与输出兼备的纯阳弟子。'
                },
                { 
                    id: 'shrine', name: '祭坛', level: 0, maxLevel: 1, 
                    cost: { gold: 1500, wood: 800 }, icon: 'cangyun', 
                    effect: '解锁苍云将士招募',
                    description: '供奉战神之灵。建造后可招募坚不可摧的苍云肉盾。'
                }
            ]
        };

        this.availableUnits = {
            'melee': 100,
            'ranged': 50
        };
        
        this.production = {
            gold: 1000,
            wood: 200
        };
    }

    getIconKey() {
        return this.type;
    }

    /**
     * 检查某个建筑是否已建造（等级 > 0）
     */
    isBuildingBuilt(buildingId) {
        for (const cat in this.buildings) {
            const build = this.buildings[cat].find(b => b.id === buildingId);
            if (build) return build.level > 0;
        }
        return false;
    }

    /**
     * 升级建筑并触发效果应用
     */
    upgradeBuilding(category, buildingId) {
        const building = this.buildings[category].find(b => b.id === buildingId);
        if (building && building.level < building.maxLevel) {
            building.level++;
            
            // 触发效果应用接口
            this.applyBuildingEffect(buildingId, building.level);
            return true;
        }
        return false;
    }

    /**
     * 核心逻辑接口：在这里根据建筑 ID 和等级触发实际的数值变动
     */
    applyBuildingEffect(buildingId, level) {
        console.log(`%c[建筑效果] %c${buildingId} 升级至 Lv.${level}，正在触发效果...`, 'color: #a68b44; font-weight: bold', 'color: #fff');
        
        switch (buildingId) {
            case 'town_hall':
                this.production.gold += 50; // 每升一级增加金钱产出
                break;
            case 'barracks':
                // 增加近战兵血量加成 (示例：Lv.2 时增加 10%)
                if (level >= 2) {
                    modifierManager.addGlobalModifier({
                        id: `city_${this.id}_barracks_hp`,
                        side: 'player',
                        unitType: 'melee',
                        stat: 'hp',
                        multiplier: 1 + (level - 1) * 0.1
                    });
                }
                break;
            // 其他效果可以在此预留或直接实现
        }
    }
}

/**
 * 大世界数据管理器 (单例)
 * 负责追踪资源、英雄兵力、城镇兵力
 */
class WorldManager {
    constructor() {
        // 1. 基础资源 (仅保留金钱和木材)
        this.resources = {
            gold: 10000,
            wood: 2000
        };

        // 2. 英雄数据 (持久化状态)
        this.heroData = {
            id: 'qijin', // 默认，初始化时会被覆盖
            level: 1,
            xp: 0,
            xpMax: 100, // 下一级所需经验
            skillPoints: 1, // 初始给 1 点技能点
            hpMax: 500,
            hpCurrent: 500,
            mpMax: 100,
            mpCurrent: 100,
            skills: [],
            stats: {
                atk: 45,
                def: 30,
                speed: 0.08,
                // --- 基础 RPG 属性 ---
                fali: 100,            // 法力：决定内力上限
                haste: 0,             // 加速：冷却缩减 (0-1)
                primaryStatName: '力道', // 主属性名称 (力道/根骨等)
                primaryStatValue: 50   // 主属性数值
            }
        };

        this.heroArmy = {
            'melee': 50,
            'ranged': 20,
            'tiance': 0,
            'chunyang': 0,
            'cangjian': 0,
            'cangyun': 0,
            'archer': 0,
            'healer': 0
        };

        // 3. 城镇中的兵力与建设
        this.cities = {
            'main_city_1': new City('main_city_1', '稻香村')
        };

        // 4. 占领建筑状态
        this.capturedBuildings = []; // { id, type, owner, pos }

        // 5. 兵种价格定义
        this.unitCosts = {
            'melee': { gold: 50 },
            'ranged': { gold: 80 },
            'tiance': { gold: 200 },
            'chunyang': { gold: 150 },
            'cangjian': { gold: 180 },
            'cangyun': { gold: 160 },
            'archer': { gold: 100 },
            'healer': { gold: 120 },
            // 野外单位价格定义 (用于战力平衡计算)
            'wild_boar': { gold: 40 },
            'wolf': { gold: 40 },
            'tiger': { gold: 120 },
            'bear': { gold: 150 },
            'bandit': { gold: 45 },
            'bandit_archer': { gold: 60 },
            'rebel_soldier': { gold: 70 },
            'rebel_axeman': { gold: 75 },
            'snake': { gold: 20 },
            'bats': { gold: 15 },
            'deer': { gold: 10 },
            'pheasant': { gold: 5 },
            'assassin_monk': { gold: 130 },
            'zombie': { gold: 100 },
            'heavy_knight': { gold: 250 },
            'shadow_ninja': { gold: 180 }
        };

        // 5. 敌人组模板定义 (局外单位 -> 局内兵力映射)
        this.enemyTemplates = {
            'wild_animals': {
                name: '野兽群',
                overworldIcon: 'tiger', 
                unitPool: ['wild_boar', 'wolf', 'tiger', 'bear', 'snake', 'bats'], 
                pointRange: [40, 150],        
                description: '一群凶猛的野兽，虽然没有战术，但成群结队极其危险。'
            },
            'rebels': {
                name: '狼牙叛军',
                overworldIcon: 'rebel_soldier', 
                unitPool: ['rebel_soldier', 'rebel_axeman', 'bandit_archer', 'heavy_knight'],
                pointRange: [100, 300],
                description: '训练有素的叛军正规军，拥有重甲兵和攻坚手。'
            },
            'bandits': {
                name: '山贼草寇',
                overworldIcon: 'bandit',
                unitPool: ['bandit', 'bandit_archer', 'snake'],
                pointRange: [50, 120],
                description: '在林间打劫的流窜山贼，人数众多。'
            },
            'shadow_sect': {
                name: '影之教派',
                overworldIcon: 'shadow_ninja', 
                unitPool: ['shadow_ninja', 'assassin_monk', 'zombie'],
                pointRange: [150, 400],
                description: '神秘的影之组织，成员全是顶尖刺客和诡异的毒尸。'
            }
        };
    }

    /**
     * 获取指定城镇当前可用的招募列表（根据建筑是否建造判定解锁）
     */
    getAvailableRecruits(cityId = 'main_city_1') {
        const city = this.cities[cityId];
        const allPossibleUnits = [
            { type: 'melee', requiredBuilding: 'barracks' },
            { type: 'ranged', requiredBuilding: 'barracks' },
            { type: 'archer', requiredBuilding: 'archery_range' },
            { type: 'tiance', requiredBuilding: 'stable' },
            { type: 'chunyang', requiredBuilding: 'mage_guild' },
            { type: 'cangyun', requiredBuilding: 'shrine' },
            { type: 'healer', requiredBuilding: 'tavern' }
        ];

        return allPossibleUnits.filter(unit => {
            if (!unit.requiredBuilding) return true;
            return city.isBuildingBuilt(unit.requiredBuilding);
        });
    }

    /**
     * 资源产出 Tick：根据所有城镇的产出增加全局资源
     */
    processResourceProduction() {
        let totalGoldGain = 0;
        let totalWoodGain = 0;
        
        // 1. 城镇产出
        for (const cityId in this.cities) {
            const city = this.cities[cityId];
            totalGoldGain += city.production.gold;
            totalWoodGain += city.production.wood;
        }

        // 2. 占领建筑产出
        this.capturedBuildings.forEach(b => {
            if (b.owner === 'player') {
                if (b.type === 'gold_mine') totalGoldGain += 200; // 金矿产出更高
                if (b.type === 'sawmill') totalWoodGain += 100;
            }
        });

        if (totalGoldGain > 0) this.addGold(totalGoldGain);
        if (totalWoodGain > 0) this.addWood(totalWoodGain);
        
        console.log(`%c[周产出] %c获得金钱 +${totalGoldGain}, 木材 +${totalWoodGain}`, 'color: #557755; font-weight: bold', 'color: #fff');
    }

    /**
     * 招募士兵到指定城市
     */
    recruitUnit(type, cityId = 'main_city_1') {
        const cost = this.unitCosts[type].gold;
        if (this.spendGold(cost)) {
            const city = this.cities[cityId];
            city.availableUnits[type] = (city.availableUnits[type] || 0) + 1;
            return true;
        }
        return false;
    }

    /**
     * 将城市中的所有士兵转移到英雄身上
     */
    collectAllFromCity(cityId = 'main_city_1') {
        const city = this.cities[cityId];
        let count = 0;
        for (const type in city.availableUnits) {
            const amount = city.availableUnits[type];
            this.heroArmy[type] += amount;
            city.availableUnits[type] = 0;
            count += amount;
        }
        if (count > 0) {
            console.log(`%c[调兵] %c英雄从 ${city.name} 领取了 ${count} 名士兵`, 'color: #5b8a8a; font-weight: bold', 'color: #fff');
        }
        this.updateHUD();
    }

    /**
     * 显示全局通知气泡
     * @param {string} message 消息内容
     */
    showNotification(message) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = 'game-notification';
        notification.innerText = message;

        // 限制最大显示数量，防止刷屏
        if (container.children.length >= 3) {
            container.removeChild(container.firstChild);
        }

        container.appendChild(notification);

        // 4秒后自动移除（与 CSS 动画时长匹配）
        setTimeout(() => {
            if (notification.parentNode) {
                container.removeChild(notification);
            }
        }, 4000);
    }

    /**
     * 处理捡起大世界物品的通用接口
     * @param {string} itemType 物品类型 ('gold_pile', 'chest' 等)
     * @returns {Object} 获得的奖励描述
     */
    handlePickup(itemType) {
        let reward = { gold: 0, wood: 0, xp: 0 };
        let msg = "";

        switch (itemType) {
            case 'gold_pile':
                reward.gold = Math.floor(Math.random() * 100) + 50; // 50-150 金币
                msg = `捡到了一堆金币，获得 ${reward.gold} 💰`;
                break;
            case 'chest':
                // 宝箱随机给金币或木材
                if (Math.random() > 0.5) {
                    reward.gold = Math.floor(Math.random() * 300) + 100;
                    msg = `开启了宝箱，获得 ${reward.gold} 💰`;
                } else {
                    reward.wood = Math.floor(Math.random() * 100) + 50;
                    msg = `开启了宝箱，获得 ${reward.wood} 🪵`;
                }
                reward.xp = 20; // 开启宝箱给点经验
                break;
            case 'wood_small':
                reward.wood = Math.floor(Math.random() * 50) + 30;
                msg = `捡到了木材，获得 ${reward.wood} 🪵`;
                break;
            case 'wood_large':
                reward.wood = Math.floor(Math.random() * 150) + 100;
                msg = `捡到了一大堆木材，获得 ${reward.wood} 🪵`;
                break;
        }

        if (reward.gold > 0) this.addGold(reward.gold);
        if (reward.wood > 0) this.addWood(reward.wood);
        if (reward.xp > 0) this.gainXP(reward.xp);

        if (msg) {
            console.log(`%c[交互] %c${msg}`, 'color: #ffcc00; font-weight: bold', 'color: #fff');
        }

        return reward;
    }

    /**
     * 处理占领大世界建筑的接口
     * @param {Object} buildingItem 交互项
     */
    handleCapture(buildingItem) {
        const { id, config } = buildingItem;
        
        // 如果已经是自己的，直接返回
        if (config.owner === 'player') return;

        // 占领逻辑 (目前简化，直接占领)
        config.owner = 'player';
        
        // 如果不在已记录列表中，则添加
        if (!this.capturedBuildings.find(b => b.id === id)) {
            this.capturedBuildings.push({
                id: id,
                type: config.type, // 'gold_mine' 或 'sawmill'
                owner: 'player'
            });
        }

        const name = config.type === 'gold_mine' ? '金矿' : '伐木场';
        this.showNotification(`成功占领了${name}！每季度将产出额外资源。`);
        console.log(`%c[占领] %c${name} (${id}) 现在归属于 玩家`, 'color: #00ff00; font-weight: bold', 'color: #fff');
        
        // 触发 UI 刷新或特效 (可选)
        window.dispatchEvent(new CustomEvent('building-captured', { detail: { id, type: config.type } }));
    }

    updateHUD() {
        const resources = ['gold', 'wood'];
        resources.forEach(res => {
            const el = document.getElementById(`world-${res}`);
            if (el) el.innerText = this.resources[res];
        });
    }

    /**
     * 更新英雄队伍兵力 (例如战斗损耗)
     * @param {Object} changes 兵力变动，如 { melee: -2, archer: -1 }
     */
    updateHeroArmy(changes) {
        for (const type in changes) {
            if (this.heroArmy[type] !== undefined) {
                this.heroArmy[type] = Math.max(0, this.heroArmy[type] + changes[type]);
            }
        }
        console.log("%c[兵力变动] %c英雄队伍已更新", 'color: #5b8a8a; font-weight: bold', 'color: #fff', changes);
    }

    /**
     * 增加金钱接口
     */
    addGold(amount) {
        if (amount <= 0) return;
        this.resources.gold += amount;
        this.updateHUD();
        this.triggerResourceAnimation('gold');
        
        // 派发事件供大世界显示飘字
        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'gold', amount: amount } 
        }));
    }

    /**
     * 增加木材接口
     */
    addWood(amount) {
        if (amount <= 0) return;
        this.resources.wood += amount;
        this.updateHUD();
        this.triggerResourceAnimation('wood');

        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'wood', amount: amount } 
        }));
    }

    /**
     * 消耗金钱接口
     */
    spendGold(amount) {
        if (this.resources.gold >= amount) {
            this.resources.gold -= amount;
            this.updateHUD();
            return true;
        }
        return false;
    }

    /**
     * 消耗木材接口
     */
    spendWood(amount) {
        if (this.resources.wood >= amount) {
            this.resources.wood -= amount;
            this.updateHUD();
            return true;
        }
        return false;
    }

    /**
     * 英雄获得经验并处理升级
     */
    gainXP(amount) {
        if (amount <= 0) return;
        const data = this.heroData;
        data.xp += amount;
        
        // 派发事件供大世界显示飘字
        window.dispatchEvent(new CustomEvent('resource-gained', { 
            detail: { type: 'xp', amount: amount } 
        }));
        
        while (data.xp >= data.xpMax) {
            data.xp -= data.xpMax;
            data.level++;
            data.xpMax = Math.floor(data.xpMax * 1.5);
            data.skillPoints++; // 每升一级给 1 点技能点
            
            // 升级属性提升 (简单实现)
            data.hpMax += 50;
            data.hpCurrent = data.hpMax;
            data.stats.atk += 5;
            data.stats.fali += 10;
            data.mpMax = data.stats.fali;
            data.mpCurrent = data.mpMax;

            console.log(`%c[升级] %c英雄升到了第 ${data.level} 级！获得 1 点技能点`, 'color: #00ff00; font-weight: bold', 'color: #fff');
        }
        
        window.dispatchEvent(new CustomEvent('hero-stats-changed'));
    }

    /**
     * 触发 UI 动画反馈
     */
    triggerResourceAnimation(type) {
        const el = document.getElementById(`world-${type}`);
        if (!el) return;
        
        const parent = el.closest('.res-item');
        if (!parent) return;

        // 移除旧动画类并强制重绘
        parent.classList.remove('res-update-anim');
        void parent.offsetWidth; 
        parent.classList.add('res-update-anim');
    }

    /**
     * 从英雄队伍移动士兵到城市 (驻守)
     */
    transferToCity(type, amount, cityId = 'main_city_1') {
        if (this.heroArmy[type] >= amount) {
            this.heroArmy[type] -= amount;
            this.cities[cityId].availableUnits[type] = (this.cities[cityId].availableUnits[type] || 0) + amount;
            return true;
        }
        return false;
    }

    /**
     * 从城市移动士兵到英雄队伍
     */
    transferToHero(type, amount, cityId = 'main_city_1') {
        const city = this.cities[cityId];
        if (city.availableUnits[type] >= amount) {
            city.availableUnits[type] -= amount;
            this.heroArmy[type] = (this.heroArmy[type] || 0) + amount;
            return true;
        }
        return false;
    }
}

export const worldManager = new WorldManager();

