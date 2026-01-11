import { worldManager } from '../core/WorldManager.js';
import { mapGenerator } from '../world/MapGenerator.js';
import { timeManager } from '../systems/TimeManager.js';

/**
 * AIController: 具备领地扩张意识的高性能大脑
 */
export class AIController {
    constructor(owner) {
        this.owner = owner;
        this.factionId = owner.factionId;
        
        // 核心重构：确保数据层引用存在，实现单一事实来源
        if (!this.owner.config) this.owner.config = {};
        
        this.decisionTimer = Math.random(); 
        this.DECISION_INTERVAL = 1.0; 
        
        // 核心：记录初始据点 ID 和位置
        this.homeCityId = this._initHomeCityId();
        this.homePos = this._findHomePos();
        
        // 领地参数
        this.baseRadius = 50; 
        this.growthRate = 10; // 每个季度领地扩张 10 米
        
        this.memory = {
            targetEntityId: null
        };
    }

    // 优雅的代理：直接读写数据层 (owner.config)，确保场景重建、存档都能自动恢复
    get state() { return this.owner.config.aiState || 'WANDER'; }
    set state(v) { this.owner.config.aiState = v; }

    get restTimer() { return this.owner.config.restTimer || 0; }
    set restTimer(v) { this.owner.config.restTimer = v; }

    /**
     * 季度经济决策：由 WorldManager 在季度结算后统一触发
     */
    onQuarterlyUpdate() {
        if (worldManager.constructor.DEBUG.DISABLE_AI) return;

        console.log(`%c[AI大脑] 英雄 ${this.owner.id} 正在进行季度经济审计...`, "color: #888");

        // 1. 建筑研发决策 (每两个季度一次，与玩家同步)
        const progress = timeManager.getGlobalProgress();
        if (progress % 2 === 1) {
            this._decideBuildingDraft();
        }

        // 2. 招兵买马决策 (每个季度都会尝试)
        this._decideRecruitment();
    }

    /**
     * AI 研发决策：选择一项最符合当前需求的科技
     */
    _decideBuildingDraft() {
        const faction = worldManager.factions[this.factionId];
        if (!faction) return;

        const sect = worldManager.availableHeroes[faction.heroId]?.sect || 'chunyang';
        const options = worldManager.buildingManager.generateDraftOptions(sect);

        if (options.length > 0) {
            // 基础策略：随机选一个 (未来可以根据倾向性权重选择)
            const selected = options[Math.floor(Math.random() * options.length)];
            worldManager.buildingManager.selectDraftOption(selected, this.factionId);
            
            const buildName = worldManager.buildingManager.BUILDING_REGISTRY?.[selected]?.name || selected;
            console.log(`%c[AI科技] %c${faction.name} 成功研发：${buildName}`, 'color: #ffcc00; font-weight: bold');
        }
    }

    /**
     * AI 募兵决策：根据财力扩充据点驻军
     */
    _decideRecruitment() {
        const faction = worldManager.factions[this.factionId];
        if (!faction || !faction.cities || faction.cities.length === 0) return;

        // 策略：保留 200 金币底金，剩下的全部用来买兵
        let budget = faction.resources.gold - 200;
        if (budget <= 0) return;

        // 识别当前已解锁的可招募兵种
        const recruitableTypes = this._getAvailableUnitTypes();
        if (recruitableTypes.length === 0) return;

        // 简单循环募兵
        let attempts = 0;
        const mainCityId = faction.cities[0];
        while (budget > 0 && attempts < 20) {
            const type = recruitableTypes[Math.floor(Math.random() * recruitableTypes.length)];
            // AI 招募成本计算 (逻辑与 WorldManager 保持一致)
            const cost = worldManager.getUnitCost(type) * 20; 
            
            if (budget >= cost) {
                worldManager.updateCityGarrison(mainCityId, { [type]: 1 });
                worldManager.spendGold(cost, this.factionId);
                budget -= cost;
            }
            attempts++;
        }
    }

    /**
     * 辅助：获取当前已解锁的所有兵种类型
     */
    _getAvailableUnitTypes() {
        const faction = worldManager.factions[this.factionId];
        if (!faction || !faction.cities) return [];

        const mainCity = worldManager.cities[faction.cities[0]];
        if (!mainCity) return [];

        const types = [];
        for (const [buildId, level] of Object.entries(mainCity.buildingLevels)) {
            if (level <= 0) continue;
            
            // 映射建筑到兵种 (解耦逻辑)
            const map = {
                'barracks': ['melee'],
                'academy_changge': ['ranged'],
                'archery_range': ['archer'],
                'medical_pavilion': ['healer'],
                'stable': ['tiance'],
                'sword_forge': ['cangjian'],
                'cy_array_pavilion': ['cy_sword_array'],
                'cy_zixia_shrine': ['cy_zixia_disciple'],
                'cy_field_shrine': ['cy_field_master'],
                'tc_halberd_hall': ['tc_halberdier', 'tc_banner'],
                'tc_iron_camp': ['tc_mounted_crossbow'],
                'cj_spirit_pavilion': ['cj_wenshui'],
                'cj_golden_hall': ['cj_golden_guard']
            };
            
            if (map[buildId]) types.push(...map[buildId]);
        }
        return [...new Set(types)]; // 去重
    }

    _initHomeCityId() {
        const faction = worldManager.factions[this.factionId];
        if (faction && faction.cities && faction.cities.length > 0) {
            return faction.cities[0];
        }
        return null;
    }

    /**
     * 获取当前领地半径 (随季度增长)
     */
    _getCurrentTerritoryRadius() {
        // 使用 TimeManager 的全局季度进度
        const seasonsPassed = timeManager.getGlobalProgress();
        return this.baseRadius + seasonsPassed * this.growthRate;
    }

    _findHomePos() {
        const faction = worldManager.factions[this.factionId];
        if (faction && faction.cities && faction.cities.length > 0) {
            const city = worldManager.cities[faction.cities[0]];
            if (city) return { x: city.x, z: city.z };
        }
        return { x: this.owner.x, z: this.owner.z }; // 兜底：以出生点为准
    }

    update(deltaTime) {
        if (worldManager.constructor.DEBUG.DISABLE_AI) return;
        if (!this.owner || !this.owner.mesh) return;

        // 处理休养状态 (数据会自动同步到 worldManager.mapState.entities)
        if (this.state === 'REST') {
            this.restTimer -= deltaTime;

            if (this.restTimer <= 0) {
                console.log(`%c[AI] 英雄 ${this.owner.id} 休养结束，重返江湖`, "color: #00ff00");
                
                // 清理持久化标记
                delete this.owner.config.aiState;
                delete this.owner.config.restTimer;
                
                this._switchState('WANDER');
            }
            return; // REST 状态下不进行决策
        }

        this.decisionTimer -= deltaTime;
        if (this.decisionTimer <= 0) {
            this._makeDecision();
            this.decisionTimer = this.DECISION_INTERVAL;
        }

        this._executeState(deltaTime);
    }

    _makeDecision() {
        // 1. 感知增强：尝试获取最实时的玩家位置
        const worldScene = window.worldScene;
        const playerPos = worldScene?.playerObject?.mesh?.position || worldManager.mapState.playerPos; 

        // 战力评估
        const playerPower = worldManager.getPlayerTotalPower();
        const myPower = worldManager.getArmyTotalPower(this.owner.army || {}, 1);

        // 优先级 1：生存与战力评估 (侦测半径 8 米内)
        if (this._isUnderThreat(playerPos)) {
            // 情况 A：打不过 -> 逃跑 (玩家战力明显高于自己，或自己几乎没兵)
            if (playerPower > myPower * 1.1 || myPower < 5) {
                this._switchState('FLEE');
                return;
            }
            
            // 情况 B：优势大 -> 追逐开战 (自己战力是玩家 1.5 倍以上)
            if (myPower > playerPower * 1.5) {
                console.log(`%c[AI决策] 英雄 ${this.owner.id} 战力占优 (${Math.round(myPower)} vs ${Math.round(playerPower)})，开始猎杀玩家！`, "color: #ff0000; font-weight: bold;");
                this._switchState('CHASE');
                return;
            }
        }

        // 优先级 2：收复失地 (如果没有据点，优先夺回初始据点)
        if (this._needsToRetakeHome()) {
            this._switchState('RETAKE_CITY');
            return;
        }

        // 优先级 3：领地内资源采集
        const nearbyResource = this._scanNearbyInterests();
        if (nearbyResource) {
            this._switchState('SEEK_RESOURCE', nearbyResource);
            return;
        }

        // 优先级 4：保底游走 (仅在领地内游走)
        if (this.state !== 'WANDER' || (!this.owner.isMoving && this.owner.currentPath.length === 0)) {
            this._switchState('WANDER');
        }
    }

    /**
     * 检查是否需要夺回主城
     */
    _needsToRetakeHome() {
        if (!this.homeCityId) return false;
        
        const faction = worldManager.factions[this.factionId];
        if (!faction) return false;

        // 如果主城 ID 不在自己势力的城市列表中，说明丢了
        const hasHome = faction.cities.includes(this.homeCityId);
        
        // 只有当自己有一定战力（例如 > 10）时才敢去夺回，否则就是送人头
        const myPower = worldManager.getArmyTotalPower(this.owner.army || {}, 1);
        
        return !hasHome && myPower > 10;
    }

    _scanNearbyInterests() {
        const entities = worldManager.mapState.entities;
        const currentRadius = this._getCurrentTerritoryRadius();
        let bestTarget = null;
        let minDistToHero = Infinity;

        for (const entity of entities) {
            if (entity.isRemoved) continue;

            // 核心逻辑：资源是否在【据点领地】范围内？
            const distToHome = Math.sqrt(Math.pow(entity.x - this.homePos.x, 2) + Math.pow(entity.z - this.homePos.z, 2));
            if (distToHome > currentRadius) continue;

            // 识别感兴趣的类型
            const isResource = entity.type === 'pickup' || entity.type === 'captured_building' || entity.type === 'tree';
            if (!isResource) continue;

            // 检查所有权 (矿产类)
            if (entity.type === 'captured_building' && entity.owner === this.factionId) continue;

            // 在符合领地条件的资源中，找离【英雄】最近的
            const distToHero = this._getDistTo(entity.x, entity.z);
            if (distToHero < minDistToHero) {
                minDistToHero = distToHero;
                bestTarget = entity;
            }
        }
        return bestTarget;
    }

    _executeState(deltaTime) {
        // --- 持续行为逻辑 ---
        
        // 核心保证：每一帧只能执行一种状态逻辑，防止多重任务冲突
        
        // 1. 逃跑过程中的实时转向
        if (this.state === 'FLEE') {
            const worldScene = window.worldScene;
            const playerPos = worldScene?.playerObject?.mesh?.position || worldManager.mapState.playerPos; 
            const dist = this._getDistTo(playerPos.x, playerPos.z);
            
            // 如果玩家还在威胁范围内，且自己快走完当前的逃跑路径了，就更新逃跑点
            if (dist < 12 && (!this.owner.isMoving || this.owner.currentPath.length < 2)) {
                this._startFlee(); 
            }
            
            // 如果跑得足够远了，恢复正常
            if (dist > 20) {
                this._switchState('WANDER');
            }
        }

        // 2. 追击玩家逻辑
        else if (this.state === 'CHASE') {
            const worldScene = window.worldScene;
            const playerPos = worldScene?.playerObject?.mesh?.position || worldManager.mapState.playerPos;
            const dist = this._getDistTo(playerPos.x, playerPos.z);

            // 如果玩家跑得太远（例如 15 米开外），或者玩家已经消失，则放弃追逐
            if (!playerPos || dist > 15) {
                this._switchState('WANDER');
            } else {
                // 每帧更新目的地，moveTo 内部会有路径平滑和性能过滤
                this.owner.moveTo(playerPos.x, playerPos.z);
            }
        }

        // 3. 夺回据点逻辑
        else if (this.state === 'RETAKE_CITY') {
            const distToHome = this._getDistTo(this.homePos.x, this.homePos.z);
            
            // 如果已经到达据点附近
            if (distToHome < 1.5) {
                const worldScene = window.worldScene;
                const cityObj = worldScene?.worldObjects?.get(this.homeCityId);
                
                // 核心：到达目的地，发起进攻/交互
                if (cityObj) {
                    cityObj.onInteract(worldScene, this.factionId);
                }
                this._switchState('IDLE');
            } else {
                // 持续向据点移动
                if (!this.owner.isMoving || this.owner.currentPath.length < 2) {
                    this.owner.moveTo(this.homePos.x, this.homePos.z);
                }
            }
        }

        // 4. 资源采集目标检测
        else if (this.state === 'SEEK_RESOURCE' && this.memory.targetEntityId) {
            // 获取实体的 Object 实例（如果它还在场景中的话）
            const targetId = this.memory.targetEntityId;
            const worldScene = this.owner.worldScene || window.worldScene; // 确保能拿到场景引用
            
            // 找到对应的 WorldObject 实例
            const targetObj = worldScene?.worldObjects?.get(targetId);
            
            if (targetObj && !targetObj.isRemoved) {
                if (this._getDistTo(targetObj.x, targetObj.z) < 1.5) {
                    // 核心修正：当到达资源点并开始交互时，立即停止物理移动，避免产生逻辑摩擦
                    if (this.owner.isMoving) {
                        this.owner.currentPath = [];
                        this.owner.isMoving = false;
                    }

                    // 【核心统一】：让 AI 也调用物体的 onInteract
                    // 如果是即时拾取(返回true)，则进入待机；如果是持续交互(如砍树返回false)，则保持当前状态
                    const success = targetObj.onInteract(worldScene, this.factionId);
                    if (success) {
                        this._switchState('IDLE');
                    }
                }
            } else {
                this._switchState('WANDER');
            }
        }
    }

    _switchState(newState, targetData = null) {
        // 优雅重构：状态切换时，必须彻底清理旧状态的残留逻辑，防止“粘滞”
        if (this.state !== newState) {
            this.memory.targetEntityId = null;
            // 切换状态时立即清空当前路径，确保新状态的移动指令能立刻获得控制权
            this.owner.currentPath = [];
            this.owner.isMoving = false;
        }

        // 允许特殊状态（如逃跑、追逐、收复或游走）在执行中重置路径
        if (this.state === newState && newState !== 'WANDER' && newState !== 'FLEE' && newState !== 'CHASE' && newState !== 'RETAKE_CITY') return;
        this.state = newState;
        
        switch (newState) {
            case 'REST':
                // 传送回主城坐标
                this.owner.x = this.homePos.x;
                this.owner.z = this.homePos.z;
                if (this.owner.mesh) {
                    this.owner.mesh.position.set(this.homePos.x, 0, this.homePos.z);
                }
                break;
            case 'FLEE':
                this._startFlee();
                break;
            case 'CHASE':
                // 追逐状态初始化：立即尝试向玩家位置移动
                const worldScene = window.worldScene;
                const playerPos = worldScene?.playerObject?.mesh?.position || worldManager.mapState.playerPos;
                if (playerPos) {
                    this.owner.moveTo(playerPos.x, playerPos.z);
                }
                break;
            case 'RETAKE_CITY':
                // 收复据点初始化：立即向据点移动
                this.owner.moveTo(this.homePos.x, this.homePos.z);
                break;
            case 'SEEK_RESOURCE':
                this.memory.targetEntityId = targetData.id;
                this.owner.moveTo(targetData.x, targetData.z);
                break;
            case 'WANDER':
                this._startWander();
                break;
            case 'IDLE':
                break;
        }
    }

    _isUnderThreat(playerPos) {
        if (!playerPos) {
            // 兜底：尝试获取最实时的
            const worldScene = window.worldScene;
            playerPos = worldScene?.playerObject?.mesh?.position || worldManager.mapState.playerPos;
        }
        return playerPos ? this._getDistTo(playerPos.x, playerPos.z) < 8 : false;
    }

    _startWander() {
        if (this.owner.isMoving) return;
        const currentRadius = this._getCurrentTerritoryRadius();
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 10;
        
        let tx = this.owner.x + Math.cos(angle) * dist;
        let tz = this.owner.z + Math.sin(angle) * dist;

        // 游走限制：不能走出领地
        const distToHome = Math.sqrt(Math.pow(tx - this.homePos.x, 2) + Math.pow(tz - this.homePos.z, 2));
        if (distToHome > currentRadius) {
            // 如果出界了，往家中心走
            const backAngle = Math.atan2(this.homePos.z - this.owner.z, this.homePos.x - this.owner.x);
            tx = this.owner.x + Math.cos(backAngle) * 8;
            tz = this.owner.z + Math.sin(backAngle) * 8;
        }

        if (mapGenerator.isPassable(tx, tz)) {
            this.owner.moveTo(tx, tz);
        }
    }

    _startFlee() {
        const worldScene = window.worldScene;
        const playerPos = worldScene?.playerObject?.mesh?.position || worldManager.mapState.playerPos; 
        if (!playerPos) return;

        const angle = Math.atan2(this.owner.z - playerPos.z, this.owner.x - playerPos.x);
        
        // 尝试逃跑的方向，如果正后方跑不通，尝试稍微偏转角度（扇形搜索逃生路径）
        const fleeDist = 15;
        const testAngles = [0, Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2];
        
        for (const offset of testAngles) {
            const finalAngle = angle + offset;
            const tx = this.owner.x + Math.cos(finalAngle) * fleeDist;
            const tz = this.owner.z + Math.sin(finalAngle) * fleeDist;
            
            if (mapGenerator.isPassable(tx, tz)) {
                this.owner.moveTo(tx, tz);
                return;
            }
        }
        
        // 如果扇形搜索都跑不通，最后尝试往主城（据点）跑
        this.owner.moveTo(this.homePos.x, this.homePos.z);
    }

    _getDistTo(tx, tz) {
        return Math.sqrt(Math.pow(this.owner.x - tx, 2) + Math.pow(this.owner.z - tz, 2));
    }

    /**
     * 外部接口：强制进入休养模式
     * @param {number} duration 休养时长(秒)
     */
    enterRestMode(duration = 60) {
        this.restTimer = duration;
        this._switchState('REST');
    }
}
