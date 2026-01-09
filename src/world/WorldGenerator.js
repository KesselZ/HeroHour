import { rng } from '../utils/Random.js';
import { City } from '../entities/City.js';
import { WorldStatusManager } from './WorldStatusManager.js';
import { UNIT_STATS_DATA, HERO_IDENTITY } from '../data/UnitStatsData.js';

/**
 * 世界生成器 (WorldGenerator)
 * 职责：负责大世界的冷启动初始化、实体摆放算法、热力图初始化等逻辑。
 */
export class WorldGenerator {
    constructor() {
        this.lastGenerator = null;
    }

    /**
     * 初始化或获取地图数据
     * @param {Object} worldManager WorldManager 实例
     * @param {Object} mapGenerator MapGenerator 实例 (由 Scene 传入)
     */
    buildInitialWorld(worldManager, mapGenerator) {
        const { mapState, heroData, availableHeroes, factions, cities } = worldManager;

        // 如果标记为已生成但网格为空（说明是刚从存档载入），则使用保存的偏移量重新生成地形
        if (mapState.isGenerated) {
            console.log("%c[生成器] 正在从存档数据恢复江湖地形...", "color: #5b8a8a; font-weight: bold");
            mapState.grid = mapGenerator.generate(mapState.size, mapState.terrainOffsets);
            mapState.heightMap = mapGenerator.heightMap;
            return mapState;
        }

        console.log("%c[生成器] 正在生成全新的江湖地图...", "color: #5b8a8a; font-weight: bold");
        
        const size = 400; 
        const grid = mapGenerator.generate(size);
        this.lastGenerator = mapGenerator;
        
        // 记录地形偏移量和种子，以便存档时保存
        mapState.terrainOffsets = { x: mapGenerator.offsetX, y: mapGenerator.offsetY };
        mapState.seed = rng.seed;
        
        const entities = [];
        const halfSize = size / 2;

        // --- 1. 势力初始化逻辑 ---
        const playerHeroId = heroData.id;
        const playerHeroInfo = availableHeroes[playerHeroId] || { name: '未知侠客' };
        
        const playerFaction = factions['player'];
        playerFaction.name = playerHeroInfo.name;
        playerFaction.heroId = playerHeroId;
        
        // 识别潜在对手 (排除玩家选中的)
        const opponentPool = Object.keys(availableHeroes).filter(id => id !== playerHeroId);
        
        // 随机选择两个对手
        const shuffledPool = [...opponentPool].sort(() => Math.random() - 0.5);
        const aiHeroes = shuffledPool.slice(0, 2);
        
        // 记录对手信息以便 UI 展示
        worldManager.currentAIFactions = aiHeroes.map(id => ({
            id: id,
            name: availableHeroes[id].name,
            title: availableHeroes[id].title
        }));

        aiHeroes.forEach((aiHeroId, index) => {
            const aiHeroInfo = availableHeroes[aiHeroId];
            const factionId = `ai_faction_${index + 1}`;
            const cityId = `ai_city_${index + 1}`;

            factions[factionId] = {
                id: factionId,
                name: aiHeroInfo.name,
                heroId: aiHeroId,
                isPlayer: false,
                cities: [cityId],
                resources: { gold: 1000, wood: 500 },
                army: worldManager.createInitialArmy(aiHeroId)
            };

            const aiCity = new City(cityId, `${aiHeroInfo.name}的据点`, factionId, 'main_city', aiHeroInfo.sect);
            cities[cityId] = aiCity;
        });

        // --- 2. 放置主城逻辑 ---
        if (mapGenerator.pois && mapGenerator.pois.length > 0) {
            const factionCount = 1 + aiHeroes.length;
            const spreadPois = this._selectSpreadPOIs(mapGenerator.pois, Math.min(factionCount, mapGenerator.pois.length));

            // 分配玩家出生点
            const playerPoi = spreadPois[0];
            const px = playerPoi.x - halfSize;
            const pz = playerPoi.z - halfSize;
            mapState.playerPos = { x: px, z: pz };
            
            const pCity = cities['main_city_1'];
            pCity.name = "稻香村"; 
            pCity.x = px;
            pCity.z = pz;
            const playerSect = availableHeroes[heroData.id]?.sect || 'chunyang';
            pCity.blueprintId = playerSect;
            
            entities.push({ id: 'main_city_1', type: 'city', x: px, z: pz });

            // 分配 AI 出生点
            aiHeroes.forEach((aiHeroId, index) => {
                const aiHeroInfo = availableHeroes[aiHeroId];
                const factionId = `ai_faction_${index + 1}`;
                const cityId = `ai_city_${index + 1}`;
                
                const poiIndex = (index + 1) < spreadPois.length ? (index + 1) : (index % spreadPois.length);
                const aiPoi = spreadPois[poiIndex];
                const ax = aiPoi.x - halfSize;
                const az = aiPoi.z - halfSize;
                
                const aiCity = cities[cityId];
                aiCity.x = ax;
                aiCity.z = az;

                entities.push({ id: cityId, type: 'city', x: ax, z: az });

                if (!worldManager.constructor.DEBUG.DISABLE_AI) {
                    entities.push({
                        id: `ai_hero_${index + 1}`,
                        type: 'ai_hero',
                        x: ax + (Math.random() - 0.5) * 4,
                        z: az + (Math.random() - 0.5) * 4,
                        config: {
                            name: aiHeroInfo.name,
                            heroId: aiHeroId,
                            factionId: factionId
                        }
                    });
                }
            });
        }

        // --- 3. 构建全图影响力中心缓存 ---
        mapState.influenceCenters = [];
        
        mapState.influenceCenters.push({
            type: 'player_home',
            x: mapState.playerPos.x,
            z: mapState.playerPos.z,
            strength: 1500, 
            radius: 50
        });

        Object.values(cities).forEach(city => {
            if (city.owner !== 'player') {
                const faction = factions[city.owner];
                mapState.influenceCenters.push({
                    type: 'sect',
                    factionHero: faction?.heroId,
                    x: city.x,
                    z: city.z,
                    strength: 1000,
                    radius: 40
                });
            }
        });

        // --- 4. 随机实体生成 ---
        const occupied = new Uint8Array(size * size); 
        this._generateEntitiesInArea(worldManager, 0, 0, size, mapGenerator, occupied, entities);

        // --- 4.5 放置特殊建筑 ---
        this._placeSpecialAltars(worldManager, size, mapGenerator, occupied, entities);

        // --- 5. 自动分配周边矿产逻辑 ---
        entities.forEach(entity => {
            if (entity.type === 'captured_building') {
                let closestCity = null;
                let minDist = 50; 

                Object.values(cities).forEach(city => {
                    if (city.owner === 'player') return;
                    const d = Math.sqrt(Math.pow(entity.x - city.x, 2) + Math.pow(entity.z - city.z, 2));
                    if (d < minDist) {
                        minDist = d;
                        closestCity = city;
                    }
                });

                if (closestCity) {
                    entity.config.owner = closestCity.owner;
                }
            }
        });

        // 记录状态
        mapState.isGenerated = true;
        mapState.grid = grid;
        mapState.heightMap = mapGenerator.heightMap;
        mapState.entities = entities;
        mapState.size = size;
        mapState.exploredMap = new Uint8Array(size * size);

        return mapState;
    }

    /**
     * 在全图范围内寻找 count 个彼此距离最远的点
     */
    _selectSpreadPOIs(allPois, count) {
        if (allPois.length <= count) {
            const shuffled = [...allPois];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }

        const selected = [];
        const seedIdx = Math.floor(Math.random() * Math.min(allPois.length, Math.ceil(allPois.length * 0.4)));
        selected.push(allPois[seedIdx]);

        while (selected.length < count) {
            let bestCandidate = null;
            let maxMinDist = -1;

            for (let i = 0; i < allPois.length; i++) {
                const poi = allPois[i];
                if (selected.includes(poi)) continue;

                let minDist = Infinity;
                for (const s of selected) {
                    const d = Math.sqrt(Math.pow(poi.x - s.x, 2) + Math.pow(poi.z - s.z, 2));
                    if (d < minDist) minDist = d;
                }

                if (minDist > maxMinDist) {
                    maxMinDist = minDist;
                    bestCandidate = poi;
                }
            }

            if (bestCandidate) selected.push(bestCandidate);
            else break;
        }

        for (let i = selected.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selected[i], selected[j]] = [selected[j], selected[i]];
        }

        return selected;
    }

    /**
     * 在地图的四个象限分别随机生成一个神行祭坛
     */
    _placeSpecialAltars(worldManager, size, generator, occupiedBuffer, entitiesList) {
        const halfSize = size / 2;
        const margin = 40; 
        
        const quadrants = [
            { minX: 20, maxX: halfSize - margin, minZ: 20, maxZ: halfSize - margin, id: 'TL' },
            { minX: halfSize + margin, maxX: size - 20, minZ: 20, maxZ: halfSize - margin, id: 'TR' },
            { minX: 20, maxX: halfSize - margin, minZ: halfSize + margin, maxZ: size - 20, id: 'BL' },
            { minX: halfSize + margin, maxX: size - 20, minZ: halfSize + margin, maxZ: size - 20, id: 'BR' }
        ];

        quadrants.forEach(q => {
            let placed = false;
            let attempts = 0;
            while (!placed && attempts < 500) {
                const rx = Math.floor(Math.random() * (q.maxX - q.minX)) + q.minX;
                const rz = Math.floor(Math.random() * (q.maxZ - q.minZ)) + q.minZ;

                if (generator.isSafeGrass(rx, rz) && !occupiedBuffer[rz * size + rx]) {
                    const worldX = rx - halfSize;
                    const worldZ = rz - halfSize;

                    let tooCloseToCity = false;
                    for (const cityId in worldManager.cities) {
                        const city = worldManager.cities[cityId];
                        if (Math.sqrt(Math.pow(worldX - city.x, 2) + Math.pow(worldZ - city.z, 2)) < 20) {
                            tooCloseToCity = true;
                            break;
                        }
                    }

                    if (!tooCloseToCity) {
                        entitiesList.push({
                            id: `teleport_altar_${q.id}`,
                            type: 'captured_building',
                            spriteKey: 'spell_altar_v2',
                            buildingType: 'teleport_altar',
                            x: worldX,
                            z: worldZ,
                            config: { owner: 'none', type: 'teleport_altar' }
                        });
                        
                        occupiedBuffer[rz * size + rx] = 1;
                        placed = true;
                    }
                }
                attempts++;
            }
        });
    }

    /**
     * 在指定区域内局部生成/补全实体
     */
    _generateEntitiesInArea(worldManager, centerX, centerZ, radius, generator, occupiedBuffer, entitiesList) {
        const size = worldManager.mapState.size || 400;
        const halfSize = size / 2;
        
        const minX = Math.max(0, Math.floor(centerX - radius + halfSize));
        const maxX = Math.min(size - 1, Math.ceil(centerX + radius + halfSize));
        const minZ = Math.max(0, Math.floor(centerZ - radius + halfSize));
        const maxZ = Math.min(size - 1, Math.ceil(centerZ + radius + halfSize));

        const playerSpawnX = worldManager.mapState.playerPos.x;
        const playerSpawnZ = worldManager.mapState.playerPos.z;

        for (let z = minZ; z <= maxZ; z++) {
            for (let x = minX; x <= maxX; x++) {
                const worldX = x - halfSize;
                const worldZ = z - halfSize;
                const distSq = Math.pow(worldX - centerX, 2) + Math.pow(worldZ - centerZ, 2);
                if (distSq > radius * radius) continue;

                if (!generator.isSafeGrass(x, z)) continue;

                let hasAdjacent = false;
                for (let dz = -2; dz <= 2; dz++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        if (dx === 0 && dz === 0) continue;
                        const nx = x + dx, nz = z + dz;
                        if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
                            if (occupiedBuffer[nz * size + nx]) { hasAdjacent = true; break; }
                        }
                    }
                    if (hasAdjacent) break;
                }
                if (hasAdjacent) continue;

                const distToPlayer = Math.sqrt(Math.pow(worldX - playerSpawnX, 2) + Math.pow(worldZ - playerSpawnZ, 2));
                let inCitySafetyZone = distToPlayer < 10;
                if (!inCitySafetyZone) {
                    for (const cityId in worldManager.cities) {
                        const city = worldManager.cities[cityId];
                        if (Math.sqrt(Math.pow(worldX - city.x, 2) + Math.pow(worldZ - city.z, 2)) < 10) {
                            inCitySafetyZone = true; break;
                        }
                    }
                }
                if (inCitySafetyZone) continue;

                const roll = Math.random();
                const density = this.getDensityMultiplier(worldManager, worldX, worldZ);
                const enemyProb = 0.0025 * density;

                let placed = false;
                if (roll < 0.001) {
                    entitiesList.push({ id: `gold_${x}_${z}`, type: 'pickup', pickupType: 'gold_pile', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.00125) {
                    entitiesList.push({ id: `chest_${x}_${z}`, type: 'pickup', pickupType: 'chest', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.00185) {
                    entitiesList.push({ id: `wood_${x}_${z}`, type: 'pickup', pickupType: 'wood_pile', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.0021) {
                    const bType = Math.random() > 0.5 ? 'gold_mine' : 'sawmill';
                    entitiesList.push({ 
                        id: `${bType}_${x}_${z}`, type: 'captured_building', 
                        spriteKey: bType === 'gold_mine' ? 'gold_mine_v2' : 'sawmill_v2',
                        buildingType: bType, x: worldX, z: worldZ,
                        config: { owner: 'none', type: bType }
                    });
                    placed = true;
                } else if (roll < 0.0021 + enemyProb) {
                    const tId = this.getDynamicEnemyType(worldManager, worldX, worldZ);
                    const template = worldManager.enemyTemplates[tId];
                    if (template) {
                        const points = Math.max(1, Math.floor(template.basePoints * (0.95 + Math.random() * 0.1)));
                        entitiesList.push({ 
                            id: `enemy_${x}_${z}`, type: 'enemy_group', templateId: tId, x: worldX, z: worldZ,
                            config: { name: template.name, unitPool: template.unitPool, totalPoints: points }
                        });
                        placed = true;
                    }
                } else if (roll < 0.0021 + enemyProb + 0.007) {
                    entitiesList.push({ id: `tree_${x}_${z}`, type: 'tree', spriteKey: 'tree', x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.0021 + enemyProb + 0.009) {
                    const houseKeys = ['house_1', 'house_2', 'house_3'];
                    const spriteKey = houseKeys[Math.floor(Math.random() * houseKeys.length)];
                    entitiesList.push({ id: `house_${x}_${z}`, type: 'decoration', spriteKey: spriteKey, x: worldX, z: worldZ });
                    placed = true;
                } else if (roll < 0.0021 + enemyProb + 0.010) {
                    const propKeys = ['boxes'];
                    const spriteKey = propKeys[Math.floor(Math.random() * propKeys.length)];
                    entitiesList.push({ id: `prop_${x}_${z}`, type: 'decoration', spriteKey: spriteKey, x: worldX, z: worldZ });
                    placed = true;
                }

                if (placed) occupiedBuffer[z * size + x] = 1;
            }
        }
    }

    /**
     * 工业级动态权重系统：完全基于“影响力中心”的热力图算法
     */
    getDynamicEnemyType(worldManager, worldX, worldZ) {
        const weights = {};
        const centers = worldManager.mapState.influenceCenters || [];
        
        for (const [id, template] of Object.entries(worldManager.enemyTemplates)) {
            let baseW = template.baseWeight || 0;
            if (baseW <= 0 && !template.sectHero) continue;

            let weightBonus = 0;
            let suppressionFactor = 1.0;

            centers.forEach(center => {
                const dist = Math.sqrt(Math.pow(worldX - center.x, 2) + Math.pow(worldZ - center.z, 2));
                if (dist > center.radius) return;

                const influence = 0.5 * (1 + Math.cos(Math.PI * (dist / center.radius))); 
                const power = center.strength * influence;

                if (center.type === 'player_home') {
                    if (template.isBasic) {
                        weightBonus += power;
                    } else {
                        suppressionFactor *= Math.pow(1 - influence, 2);
                    }
                } 
                else if (center.type === 'sect') {
                    if (template.sectHero === center.factionHero) {
                        weightBonus += power;
                    }
                } 
                else if (center.type === 'evil') {
                    if (id.startsWith(center.faction)) {
                        weightBonus += power;
                    } else if (!template.isBasic) {
                        suppressionFactor *= (1 - influence * 0.8);
                    }
                }
            });

            weights[id] = (baseW + weightBonus) * suppressionFactor;
        }

        return this.weightedRandomSelect(weights);
    }

    /**
     * 通用的加权随机选择算法
     */
    weightedRandomSelect(weights) {
        const entries = Object.entries(weights);
        if (entries.length === 0) return 'bandits'; 

        const totalWeight = entries.reduce((sum, [_, w]) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (const [id, weight] of entries) {
            if (random < weight) return id;
            random -= weight;
        }
        return entries[0][0];
    }

    /**
     * 获取局部生成密度乘子 (1.0 - 4.0)
     */
    getDensityMultiplier(worldManager, worldX, worldZ) {
        let multiplier = 1.0;
        const centers = (worldManager.mapState && worldManager.mapState.influenceCenters) || [];
        
        centers.forEach(center => {
            const dist = Math.sqrt(Math.pow(worldX - center.x, 2) + Math.pow(worldZ - center.z, 2));
            if (dist > center.radius) return;

            const influence = 0.5 * (1 + Math.cos(Math.PI * (dist / center.radius)));
            
            if (center.type === 'sect') multiplier += influence * 1.5; 
            else if (center.type === 'evil') multiplier += influence * 3.0; 
            else if (center.type === 'player_home') multiplier += influence * 0.5; 
        });

        return Math.min(4.0, multiplier);
    }

    /**
     * 【动态事件接口】在随机 POI 处降临邪恶势力
     */
    spawnEvilBaseDynamic(worldManager, factionId) {
        if (!this.lastGenerator) return;
        const generator = this.lastGenerator;
        const size = worldManager.mapState.size;
        const halfSize = size / 2;
        
        const occupiedLocations = [
            ...Object.values(worldManager.cities).map(c => ({x: c.x, z: c.z})),
            ...worldManager.mapState.entities.filter(e => e.config?.isEvilBase).map(e => ({x: e.x, z: e.z}))
        ];

        let availablePois = generator.pois.filter(poi => {
            const wx = poi.x - halfSize;
            const wz = poi.z - halfSize;
            return !occupiedLocations.some(loc => Math.abs(loc.x - wx) < 15 && Math.abs(loc.z - wz) < 15);
        });

        if (availablePois.length === 0) {
            console.warn("[生成器] 没有足够的空余 POI 放置邪恶势力");
            return;
        }

        const playerPos = worldManager.mapState.playerPos;
        availablePois.sort((a, b) => {
            const distA = Math.pow(a.x - halfSize - playerPos.x, 2) + Math.pow(a.z - halfSize - playerPos.z, 2);
            const distB = Math.pow(b.x - halfSize - playerPos.x, 2) + Math.pow(b.z - halfSize - playerPos.z, 2);
            return distA - distB; 
        });

        let candidatePois = availablePois;
        if (availablePois.length > 2) {
            candidatePois = availablePois.slice(2);
        }
        
        const targetIdx = candidatePois.length > 1 ? rng.nextInt(0, candidatePois.length - 1) : 0;
        const targetPoi = candidatePois[targetIdx];
        const ex = targetPoi.x - halfSize;
        const ez = targetPoi.z - halfSize;

        const clearRadius = 60;
        worldManager.mapState.entities = worldManager.mapState.entities.filter(ent => {
            const distSq = Math.pow(ent.x - ex, 2) + Math.pow(ent.z - ez, 2);
            if (distSq < clearRadius * clearRadius && ent.type !== 'city') {
                ent.isRemoved = true; 
                return false;
            }
            return true;
        });

        const factionNames = { 'tianyi': '天一教总坛', 'shence': '神策军营', 'red_cult': '红衣教祭坛' };
        const iconKeys = { 'tianyi': 'tianyi_abomination', 'shence': 'shence_iron_pagoda', 'red_cult': 'red_cult_high_priestess' };

        const newCenter = {
            type: 'evil',
            faction: factionId,
            x: ex, z: ez,
            strength: 1200,
            radius: 60
        };
        worldManager.mapState.influenceCenters.push(newCenter);

        const baseEntity = {
            id: `evil_base_${factionId}_${Date.now()}`,
            type: 'decoration',
            spriteKey: iconKeys[factionId],
            x: ex, z: ez,
            scale: 2.5,
            config: { isEvilBase: true, faction: factionId, name: factionNames[factionId] }
        };
        worldManager.mapState.entities.push(baseEntity);

        const occupied = new Uint8Array(size * size);
        worldManager.mapState.entities.forEach(ent => {
            if (ent.isRemoved) return;
            const gx = Math.round(ent.x + halfSize);
            const gz = Math.round(ent.z + halfSize);
            if (gx >= 0 && gx < size && gz >= 0 && gz < size) {
                occupied[gz * size + gx] = 1;
            }
        });

        this._generateEntitiesInArea(worldManager, ex, ez, clearRadius, generator, occupied, worldManager.mapState.entities);

        let style = 'evil';
        if (factionId === 'shence') style = 'shence';
        else if (factionId === 'red_cult') style = 'autumn';

        window.dispatchEvent(new CustomEvent('terrain-style-change', {
            detail: { x: ex, z: ez, radius: clearRadius, style: style }
        }));

        WorldStatusManager.broadcastEvilSpawn(factionId);

        worldManager.mapState.entities.forEach(entity => {
            if (entity.type === 'captured_building' && entity.config.owner === 'none') {
                const dSq = Math.pow(entity.x - ex, 2) + Math.pow(entity.z - ez, 2);
                if (dSq < 50 * 50) {
                    entity.config.owner = factionId;
                }
            }
        });

        window.dispatchEvent(new CustomEvent('map-entities-updated'));
    }
}

export const worldGenerator = new WorldGenerator();

