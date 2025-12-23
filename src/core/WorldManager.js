/**
 * 城镇类：管理单个城镇的属性和逻辑
 */
class City {
    constructor(id, name, type = 'main_city') {
        this.id = id;
        this.name = name;
        this.type = type; // 决定图标
        this.level = 1;
        
        // 建筑分类
        this.buildings = {
            'economy': [
                { id: 'town_hall', name: '议政厅', level: 1, maxLevel: 3, cost: { gold: 500, wood: 100 }, icon: 'main_city' },
                { id: 'market', name: '市场', level: 1, maxLevel: 2, cost: { gold: 300, wood: 50 }, icon: 'gold_pile' },
                { id: 'tavern', name: '酒馆', level: 0, maxLevel: 1, cost: { gold: 200, wood: 80 }, icon: 'healer' } // 借用补给兵图标
            ],
            'military': [
                { id: 'barracks', name: '兵营', level: 1, maxLevel: 5, cost: { gold: 400, wood: 150 }, icon: 'melee' },
                { id: 'archery_range', name: '靶场', level: 0, maxLevel: 3, cost: { gold: 400, wood: 200 }, icon: 'archer' },
                { id: 'stable', name: '马厩', level: 0, maxLevel: 3, cost: { gold: 800, wood: 300 }, icon: 'tiance' }
            ],
            'magic': [
                { id: 'mage_guild', name: '法师公会', level: 0, maxLevel: 5, cost: { gold: 1000, wood: 500 }, icon: 'chunyang' },
                { id: 'shrine', name: '祭坛', level: 0, maxLevel: 1, cost: { gold: 1500, wood: 800 }, icon: 'cangyun' }
            ]
        };

        this.availableUnits = {
            'melee': 10,
            'ranged': 5,
            'tiance': 2,
            'chunyang': 1
        };
        
        this.production = {
            gold: 100,
            wood: 20
        };
    }

    getIconKey() {
        return this.type;
    }

    upgradeBuilding(category, buildingId) {
        const building = this.buildings[category].find(b => b.id === buildingId);
        if (building && building.level < building.maxLevel) {
            // 这里可以添加资源扣除逻辑
            building.level++;
            return true;
        }
        return false;
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
            gold: 1000,
            wood: 200
        };

        // 2. 英雄携带的兵力 (当前队伍)
        this.heroArmy = {
            'melee': 5,
            'ranged': 2,
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

        // 4. 兵种价格定义
        this.unitCosts = {
            'melee': { gold: 50 },
            'ranged': { gold: 80 },
            'tiance': { gold: 200 },
            'chunyang': { gold: 150 },
            'cangjian': { gold: 180 },
            'cangyun': { gold: 160 },
            'archer': { gold: 100 },
            'healer': { gold: 120 }
        };
    }

    /**
     * 招募士兵到指定城市
     */
    recruitUnit(type, cityId = 'main_city_1') {
        const cost = this.unitCosts[type].gold;
        if (this.resources.gold >= cost) {
            this.resources.gold -= cost;
            const city = this.cities[cityId];
            city.availableUnits[type] = (city.availableUnits[type] || 0) + 1;
            this.updateHUD();
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

    updateHUD() {
        const resources = ['gold', 'wood'];
        resources.forEach(res => {
            const el = document.getElementById(`world-${res}`);
            if (el) el.innerText = this.resources[res];
        });
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

