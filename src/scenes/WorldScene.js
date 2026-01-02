import * as THREE from 'three';
import { spriteFactory } from '../core/SpriteFactory.js';
import { modifierManager } from '../core/ModifierManager.js';
import { WorldManager, worldManager } from '../core/WorldManager.js'; // 引入数据管家
import { SkillRegistry, SectSkills } from '../core/SkillSystem.js';
import { timeManager } from '../core/TimeManager.js';
import { mapGenerator, TILE_TYPES } from '../core/MapGenerator.js';
import { createWorldObject } from '../entities/WorldObjects.js';
import { VFXLibrary } from '../core/VFXLibrary.js'; // 核心引入

/**
 * 大世界场景类
 * 负责探索、移动、资源收集和城镇管理
 */
import { uiManager } from '../core/UIManager.js';
import { audioManager } from '../core/AudioManager.js';

export class WorldScene {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.vfxLibrary = new VFXLibrary(this.scene); // 初始化特效库
        
        this.playerHero = null;
        this.heroId = null;
        this.isActive = false;
        
        // 移动控制
        this.keys = {};
        this.moveSpeed = 0.04; 
        this.footstepTimer = 0;
        this.footstepInterval = 650;        
        // 交互控制
        this.interactables = [];
        this.activeCityId = null;        
        this.floatingStack = 0;          
        
        // 悬浮检测
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this); 

        // 动感行走动画状态
        this.moveAnimTime = 0;
        this.baseScale = 1.4;
        this.playerGroup = null;
        this.playerShadow = null;
        this.lastPlayerPos = new THREE.Vector3(); // 用于驱动位移动画
        this.debugLogTimer = 0; // 用于限流输出日志
    }

    /**
     * 初始化大世界
     * @param {string} heroId 选中的英雄 ID
     */
    init(heroId) {
        this.heroId = heroId;
        this.isActive = true; 

        // 播放大世界 BGM (如寄)
        audioManager.playBGM('/audio/bgm/如寄.mp3');

        // 同步英雄 ID 到数据管家，确保后续势力生成能正确匹配
        worldManager.heroData.id = heroId;

        // 1. 显示主世界 UI 容器
        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.remove('hidden');

        // 2. 从数据中心获取地图状态 (如果是新地图会在此生成)
        const mapState = worldManager.getOrGenerateWorld(mapGenerator);
        const mapData = mapState.grid;

        // 3. 渲染视觉表现
        this.setupLights();
        this.createGround(mapData);
        this.createWater(mapGenerator.size);
        this.createPlayer();
        
        // 设置背景色，增加武侠大世界的沉浸感
        this.scene.background = new THREE.Color(0x87ceeb); // 天蓝色背景
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.005); // 淡淡的远景雾效
        
        // 初始位置设定
        this.camera.position.set(this.playerGroup.position.x, 15, this.playerGroup.position.z + 12);
        this.camera.lookAt(this.playerGroup.position);

        this.initUI();
        
        // --- 核心改动：监听势力怪物清除事件 ---
        window.removeEventListener('sect-monsters-cleared', this._onSectMonstersCleared);
        this._onSectMonstersCleared = (e) => {
            const { templateIds } = e.detail;
            // 找到所有属于这些模板的交互对象并移除 Mesh
            const toRemoveIndices = [];
            this.interactables.forEach((item, index) => {
                if (item.templateId && templateIds.includes(item.templateId)) {
                    item.removeFromScene(this.scene);
                    toRemoveIndices.push(index);
                }
            });
            // 从交互列表中剔除
            for (let i = toRemoveIndices.length - 1; i >= 0; i--) {
                this.interactables.splice(toRemoveIndices[i], 1);
            }
            console.log(`%c[视觉更新] 已清除地图上属于该势力的 ${toRemoveIndices.length} 个野怪点`, "color: #44aa44");
        };
        window.addEventListener('sect-monsters-cleared', this._onSectMonstersCleared);

        // --- 英雄大世界属性应用 ---
        // 核心修正：行军速度必须读取“最终修正后”的轻功属性，确保李承恩等人的天赋生效
        const heroDetails = worldManager.getUnitDetails(worldManager.heroData.id);
        this.moveSpeed = heroDetails.qinggong * 0.6; // 使用分离后的轻功数值，0.6 是世界地图缩放系数

        // 4. 根据逻辑数据“摆放”物体
        this.renderWorldEntities(mapState.entities);

        // --- 初始化小地图 ---
        this.initMinimap();

        // --- 开局提示 ---
        if (worldManager.currentAIFactions.length > 0) {
            uiManager.showGameStartWindow(worldManager.currentAIFactions);
        }
    }

    /**
     * 根据逻辑数据在 3D 场景中生成实体
     */
    renderWorldEntities(entities) {
        entities.forEach(data => {
            if (data.isRemoved) return; // 跳过已被捡走的

            const worldObj = createWorldObject(data);
            worldObj.spawn(this.scene);
            
            if (worldObj.isInteractable) {
                this.interactables.push(worldObj);
            }
        });
    }

    initUI() {
        console.log("%c[UI] 正在初始化大世界 UI 监听器...", "color: #44aa44");
        
        // 初始刷新一次 HUD (包含所有城市)
        this.refreshWorldHUD();

        // 按钮点击事件
        const closeBtn = document.getElementById('close-town-panel');
        if (closeBtn) {
            closeBtn.onclick = () => {
                audioManager.play('ui_click', { volume: 0.4 });
                console.log("[UI] 手动关闭城镇面板");
                if (this.activeCityId) {
                    worldManager.mapState.interactionLocks.add(this.activeCityId);
                }
                this.closeTownManagement(); // 无论是否有 ID，强制执行关闭 UI 逻辑
            };
        }

        // --- 调兵按钮逻辑 ---
        const collectAllBtn = document.getElementById('collect-all-btn');
        if (collectAllBtn) {
            collectAllBtn.onclick = () => {
                if (this.activeCityId) {
                    audioManager.play('ui_click', { volume: 0.5 });
                    worldManager.collectAllFromCity(this.activeCityId);
                    this.refreshTownUI(this.activeCityId);
                }
            };
        }

        const depositAllBtn = document.getElementById('deposit-all-btn');
        if (depositAllBtn) {
            depositAllBtn.onclick = () => {
                if (this.activeCityId) {
                    audioManager.play('ui_click', { volume: 0.5 });
                    worldManager.depositAllToCity(this.activeCityId);
                    this.refreshTownUI(this.activeCityId);
                }
            };
        }

        const closeHeroBtn = document.getElementById('close-hero-panel');
        if (closeHeroBtn) {
            closeHeroBtn.onclick = () => {
                audioManager.play('ui_click', { volume: 0.4 });
                document.getElementById('hero-stats-panel').classList.add('hidden');
            };
        }

        // 移除旧的监听器防止重复
        window.removeEventListener('hero-stats-changed', this._onHeroStatsChanged);
        this._onHeroStatsChanged = () => {
            this.updateHeroHUD();
            // 核心修复：属性变化时同步更新大世界移动速度
            const heroDetails = worldManager.getUnitDetails(worldManager.heroData.id);
            this.moveSpeed = heroDetails.qinggong * 0.6;

            // 核心修复：如果属性面板打开，实时刷新它
            this.updateHeroStatsUI();
        };
        window.addEventListener('hero-stats-changed', this._onHeroStatsChanged);

        // 监听奇穴更新，同步更新移动速度
        window.removeEventListener('talents-updated', this._onTalentsUpdated);
        this._onTalentsUpdated = () => {
            const heroDetails = worldManager.getUnitDetails(worldManager.heroData.id);
            this.moveSpeed = heroDetails.qinggong * 0.6;
            console.log(`%c[属性同步] 奇穴已更新，当前大世界移速: ${this.moveSpeed.toFixed(3)}`, "color: #5b8a8a");
            
            // 同步更新 HUD (隐藏或更新提醒气泡)
            this.updateHeroHUD();

            // 核心修复：如果属性面板打开，实时刷新它
            this.updateHeroStatsUI();

            // 核心修复：奇穴更新后，如果城镇面板开着，也要刷新它，否则费用显示不更新
            if (this.activeCityId) {
                this.refreshTownUI(this.activeCityId);
            }
        };
        window.addEventListener('talents-updated', this._onTalentsUpdated);

        window.removeEventListener('resource-gained', this._onResourceGained);
        this._onResourceGained = (e) => {
            if (!this.isActive || !this.playerHero) return;
            const { type, amount } = e.detail;
            this.spawnFloatingText(type, amount);
        };
        window.addEventListener('resource-gained', this._onResourceGained);

        worldManager.updateHUD();
        this.updateHeroHUD(); 
    }

    updateHeroHUD() {
        const heroPortrait = document.getElementById('world-hero-portrait');
        const hpBar = document.getElementById('hud-hero-hp-bar');
        const mpBar = document.getElementById('hud-hero-mp-bar');
        const levelBadge = document.getElementById('hud-hero-level');
        const talentHint = document.getElementById('talent-hint');
        
        const heroData = worldManager.heroData;
        
        if (heroPortrait) {
            const iconStyle = spriteFactory.getIconStyle(heroData.id);
            Object.assign(heroPortrait.style, iconStyle);
        }

        if (levelBadge) {
            levelBadge.innerText = `Lv.${heroData.level}`;
        }

        if (hpBar) {
            const hpPct = (heroData.hpCurrent / heroData.hpMax) * 100;
            hpBar.style.width = `${hpPct}%`;
        }

        if (mpBar) {
            const mpPct = (heroData.mpCurrent / heroData.mpMax) * 100;
            mpBar.style.width = `${mpPct}%`;
        }

        // 核心逻辑：一旦有剩余点数，显示气泡提醒
        if (talentHint) {
            const points = heroData.talentPoints || 0;
            if (points > 0) {
                talentHint.classList.remove('hidden');
            } else {
                talentHint.classList.add('hidden');
            }
        }
    }

    openHeroStats() {
        // --- 互斥逻辑：打开属性面板时，关闭其他可能冲突的面板 ---
        this.closeTownManagement();
        const skillLearnPanel = document.getElementById('skill-learn-panel');
        if (skillLearnPanel) skillLearnPanel.classList.add('hidden');
        
        const panel = document.getElementById('hero-stats-panel');
        if (panel) {
            panel.classList.remove('hero-panel-v3');
            panel.classList.add('hero-panel-v4');
            panel.classList.remove('hidden');
        }

        // 核心逻辑：刷新英雄属性面板数据
        this.updateHeroStatsUI();
    }

    /**
     * 核心逻辑：刷新英雄属性面板数据 (不包含互斥关闭逻辑)
     */
    updateHeroStatsUI() {
        const panel = document.getElementById('hero-stats-panel');
        // 关键防护：如果面板没打开，则不需要浪费性能更新 DOM
        if (!panel || panel.classList.contains('hidden')) return;

        const data = worldManager.heroData;
        const heroInfo = worldManager.availableHeroes[data.id];
        
        // 填充数据
        document.getElementById('hero-panel-name').innerText = (data.id === 'liwangsheng' ? '李忘生' : (data.id === 'lichengen' ? '李承恩' : '叶英'));
        document.getElementById('hero-panel-title').innerText = heroInfo ? heroInfo.title : '';
        
        const portrait = document.getElementById('hero-panel-portrait');
        const iconStyle = spriteFactory.getIconStyle(data.id);
        Object.assign(portrait.style, iconStyle);
        
        const xpPct = (data.xp / data.xpMax) * 100;
        const hpPct = (data.hpCurrent / data.hpMax) * 100;
        const mpPct = (data.mpCurrent / data.mpMax) * 100;
        
        document.getElementById('hero-xp-bar').style.width = `${xpPct}%`;
        document.getElementById('hero-hp-bar').style.width = `${hpPct}%`;
        document.getElementById('hero-mp-bar').style.width = `${mpPct}%`;
        
        document.getElementById('hero-xp-text').innerText = `${data.xp}/${data.xpMax}`;
        document.getElementById('hero-hp-text').innerText = `${Math.floor(data.hpCurrent)}/${data.hpMax}`;
        document.getElementById('hero-mp-text').innerText = `${data.mpCurrent}/${data.mpMax}`;
        
        const levelDisplay = document.getElementById('hero-level-val');
        if (levelDisplay) levelDisplay.innerText = data.level;

        // 军队显示
        const moraleVal = document.getElementById('attr-morale');
        if (moraleVal) moraleVal.innerText = data.stats.morale;
        const details = worldManager.getUnitDetails(data.id);
        document.getElementById('attr-speed').innerText = details.qinggong.toFixed(1); 
        
        // 动态修改力道/身法标签
        const powerLabel = document.getElementById('attr-power-label');
        const powerName = heroInfo ? heroInfo.primaryStat : '力道';
        if (powerLabel) powerLabel.innerText = powerName;
        
        const dummy = worldManager.getPlayerHeroDummy();
        const identity = worldManager.getHeroIdentity(data.id);
        const cb = identity.combatBase;
        
        document.getElementById('attr-primary-val').innerText = Math.floor(modifierManager.getModifiedValue(dummy, 'power', data.stats.power));
        document.getElementById('attr-fali').innerText = Math.floor(modifierManager.getModifiedValue(dummy, 'spells', data.stats.spells));
        
        // 核心修复：显示经过 ModifierManager 截断后的真实调息百分比
        const actualHaste = modifierManager.getModifiedValue(dummy, 'haste', 0);
        document.getElementById('attr-haste').innerText = Math.floor(actualHaste * 100);
        
        const leaderMax = document.getElementById('attr-leadership-max');
        if (leaderMax) {
            leaderMax.innerText = Math.floor(modifierManager.getModifiedValue(dummy, 'leadership', data.stats.leadership));
        }

        // 绑定属性 Tooltip (动态显示主属性收益)
        const realMorale = Math.floor(modifierManager.getModifiedValue(dummy, 'morale', data.stats.morale));
        const realPower = Math.floor(modifierManager.getModifiedValue(dummy, 'power', data.stats.power));
        const realSpells = Math.floor(modifierManager.getModifiedValue(dummy, 'spells', data.stats.spells));
        
        const moraleAtkBonus = (realMorale).toFixed(0);
        const moraleHpBonus = (realMorale).toFixed(0);
        this.bindAttrTooltip('attr-box-morale', '军队', `统御三军，使帐下士兵的<span class="skill-term-highlight">攻击力</span>提升 <span class="skill-num-highlight">${moraleAtkBonus}%</span>，<span class="skill-term-highlight">气血上限</span>提升 <span class="skill-num-highlight">${moraleHpBonus}%</span>。`);
        
        const powerAtkBonus = (realPower * (cb.atkScaling || 0.05) * 100).toFixed(0);
        const powerHpBonus = (realPower * cb.hpScaling).toFixed(0);
        this.bindAttrTooltip('attr-box-power', powerName, `修习内功外招，使侠客自身的<span class="skill-term-highlight">普通攻击</span>伤害提升 <span class="skill-num-highlight">${powerAtkBonus}%</span>，并额外增加 <span class="skill-num-highlight">${powerHpBonus}</span> 点<span class="skill-term-highlight">气血上限</span>。`);
        
        const spellBonus = (realSpells).toFixed(0);
        this.bindAttrTooltip('attr-box-spells', '功法', `通过玄妙法门，使侠客的<span class="skill-term-highlight">招式威力</span>提升 <span class="skill-num-highlight">${spellBonus}%</span>。`);
        
        this.bindAttrTooltip('attr-box-speed', '轻功', `身轻如燕，提升侠客行走江湖与临阵对敌时的移动速度`);
        
        const hasteReduction = (actualHaste * 100).toFixed(0);
        this.bindAttrTooltip('attr-box-haste', '调息', `提升招式运转速度，使<span class="skill-term-highlight">冷却时间</span>与<span class="skill-term-highlight">内力消耗</span>降低 <span class="skill-num-highlight">${hasteReduction}%</span>。`);
        this.bindAttrTooltip('attr-box-leadership', '统御', `侠客带兵容量上限，每种兵力产生不同的占用点数`);
        
        const skillsContainer = document.getElementById('hero-panel-skills');
        skillsContainer.innerHTML = '';

        if (!data.skills || data.skills.length === 0) {
            skillsContainer.innerHTML = `<div class="hero-no-skills">暂无习得技能</div>`;
        } else {
            data.skills.forEach(skillId => {
                const skill = SkillRegistry[skillId];
                if (!skill) return;

                const slot = document.createElement('div');
                slot.className = 'hero-skill-slot';
                
                const iconStyle = spriteFactory.getIconStyle(skill.icon);
                slot.innerHTML = `
                    <div class="skill-icon-small" style="background-image: ${iconStyle.backgroundImage}; background-position: ${iconStyle.backgroundPosition}; background-size: ${iconStyle.backgroundSize};"></div>
                `;

                slot.onmouseenter = () => {
                    uiManager.showSkillTooltip(skillId, data);
                };
                slot.onmouseleave = () => uiManager.hideTooltip();

                skillsContainer.appendChild(slot);
            });
        }
    }

    bindAttrTooltip(id, name, desc) {
        const el = document.getElementById(id);
        if (el) {
            el.onmouseenter = () => uiManager.showTooltip({ name, description: desc });
            el.onmouseleave = () => uiManager.hideTooltip();
        }
    }

    onPointerMove(e) {
        if (!this.isActive) return;
        
        // 1. 更新鼠标归一化坐标用于 Raycaster
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

        // 2. 执行射线检测
        this.updateHover();
    }

    updateHover() {
        if (!this.isActive) return;

        // --- 核心修复：防止 Tooltip 穿透 UI 面板 ---
        const heroPanel = document.getElementById('hero-stats-panel');
        const townPanel = document.getElementById('town-management-panel');
        const skillLearnPanel = document.getElementById('skill-learn-panel');
        const startWindow = document.getElementById('game-start-window');
        const htpPanel = document.getElementById('how-to-play-panel');
        
        const isUIOpen = (heroPanel && !heroPanel.classList.contains('hidden')) || 
                         (townPanel && !townPanel.classList.contains('hidden')) ||
                         (skillLearnPanel && !skillLearnPanel.classList.contains('hidden')) ||
                         (startWindow && !startWindow.classList.contains('hidden')) ||
                         (htpPanel && !htpPanel.classList.contains('hidden'));

        if (isUIOpen) {
            if (this.hoveredObject) {
                uiManager.hideTooltip();
                this.hoveredObject = null;
            }
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // 过滤出有 mesh 的交互物体
        const objectsToIntersect = this.interactables
            .filter(item => item.mesh)
            .map(item => item.mesh);
            
        // 核心修复：开启递归检测 (true)，支持 Group 等复合对象
        const intersects = this.raycaster.intersectObjects(objectsToIntersect, true);

        if (intersects.length > 0) {
            const hitMesh = intersects[0].object;
            // 核心修复：不仅匹配顶层 mesh，也匹配子级 mesh 所属的 WorldObject
            const hitObj = this.interactables.find(item => {
                if (item.mesh === hitMesh) return true;
                let found = false;
                item.mesh.traverse(child => {
                    if (child === hitMesh) found = true;
                });
                return found;
            });
            
            if (hitObj && hitObj !== this.hoveredObject) {
                const tooltipData = hitObj.getTooltipData();
                if (tooltipData) {
                    uiManager.showTooltip(tooltipData);
                    this.hoveredObject = hitObj;
                } else {
                    uiManager.hideTooltip();
                    this.hoveredObject = null;
                }
            }
        } else {
            if (this.hoveredObject) {
                uiManager.hideTooltip();
                this.hoveredObject = null;
            }
        }
    }

    openTownManagement(cityId, isPhysical = false) {
        // --- 互斥逻辑：打开城镇面板时，关闭其他可能冲突的面板 ---
        document.getElementById('hero-stats-panel').classList.add('hidden');
        const skillLearnPanel = document.getElementById('skill-learn-panel');
        if (skillLearnPanel) skillLearnPanel.classList.add('hidden');

        const panel = document.getElementById('town-management-panel');
        const cityData = worldManager.cities[cityId];
        
        if (!cityData) return;

        // --- 核心修复：位置“懒同步” ---
        // 在打开面板前，将 3D 世界的实时位置同步给逻辑层，确保 isPlayerAtCity 判定准确
        if (this.playerGroup) {
            worldManager.savePlayerPos(this.playerGroup.position.x, this.playerGroup.position.z);
        }

        this.activeCityId = cityId; 
        // 智能判定：如果你手动标记了亲临 (isPhysical)，或者你当前坐标确实在城里
        const isPhysicalVisit = isPhysical || worldManager.isPlayerAtCity(cityId);
        this.isPhysicalVisit = isPhysicalVisit;

        // 核心：仅在亲自访问时响起铃铛
        if (isPhysicalVisit) {
            audioManager.play('ui_bell', { volume: 0.8 });
        }

        document.getElementById('town-name').innerText = cityData.name;
        panel.classList.remove('hidden');

        this.refreshTownUI(cityId);
    }

    refreshTownUI(cityId) {
        const cityData = worldManager.cities[cityId];
        const allBuildings = cityData.getAvailableBuildings();
        
        // --- 核心改动：展示全局总收益，而非单一城市收益 ---
        const prodData = worldManager.getGlobalProduction();
        const goldIncome = document.getElementById('town-income-gold');
        const woodIncome = document.getElementById('town-income-wood');
        if (goldIncome) goldIncome.innerText = prodData.gold;
        if (woodIncome) woodIncome.innerText = prodData.wood;

        // 为收益容器绑定明细 Tooltip
        const incomeContainer = document.querySelector('.town-income-v3');
        if (incomeContainer) {
            incomeContainer.style.cursor = 'help';
            incomeContainer.onmouseenter = () => {
                const breakdown = prodData.breakdown;
                let desc = `<div style="color: var(--jx3-celadon); margin-bottom: 4px;">各城池贡献:</div>`;
                breakdown.cities.forEach(c => {
                    desc += `<div style="display: flex; justify-content: space-between; gap: 10px;">
                        <span>${c.name}</span>
                        <span>💰${c.gold} 🪵${c.wood}</span>
                    </div>`;
                });
                
                if (breakdown.mines.count.gold_mine > 0 || breakdown.mines.count.sawmill > 0) {
                    desc += `<div style="color: var(--jx3-gold); margin-top: 8px; margin-bottom: 4px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">野外产出:</div>`;
                    if (breakdown.mines.count.gold_mine > 0) {
                        desc += `<div style="display: flex; justify-content: space-between;">
                            <span>金矿 x${breakdown.mines.count.gold_mine}</span>
                            <span>💰${breakdown.mines.gold}</span>
                        </div>`;
                    }
                    if (breakdown.mines.count.sawmill > 0) {
                        desc += `<div style="display: flex; justify-content: space-between;">
                            <span>伐木场 x${breakdown.mines.count.sawmill}</span>
                            <span>🪵${breakdown.mines.wood}</span>
                        </div>`;
                    }
                }
                
                uiManager.showTooltip({
                    name: "本季度总收益明细",
                    level: "所有城池与矿产合计",
                    description: desc
                });
            };
            incomeContainer.onmouseleave = () => uiManager.hideTooltip();
        }

        // 更新统御力显示
        const heroLeadershipLabel = document.querySelector('.hero-army .army-label');
        if (heroLeadershipLabel) {
            const current = worldManager.getHeroCurrentLeadership();
            const max = worldManager.getHeroMaxLeadership();
            heroLeadershipLabel.innerHTML = `我的队伍 <span style="color: ${current > max * 0.8 ? '#ff4444' : 'var(--jx3-celadon)'}">(${current}/${max})</span>`;
        }

        // --- 核心限制：远程访问不允许调兵 ---
        const canTransfer = this.isPhysicalVisit;
        const collectBtn = document.getElementById('collect-all-btn');
        const depositBtn = document.getElementById('deposit-all-btn');
        
        if (collectBtn) {
            collectBtn.disabled = !canTransfer;
            collectBtn.title = canTransfer ? "全部领取至队伍" : "必须亲临城市才能领兵";
            collectBtn.style.opacity = canTransfer ? "1" : "0.3";
            collectBtn.style.cursor = canTransfer ? "pointer" : "not-allowed";
        }
        if (depositBtn) {
            depositBtn.disabled = !canTransfer;
            depositBtn.title = canTransfer ? "队伍全部驻守" : "必须亲临城市才能遣散";
            depositBtn.style.opacity = canTransfer ? "1" : "0.3";
            depositBtn.style.cursor = canTransfer ? "pointer" : "not-allowed";
        }

        // 1. 刷新建筑面板
        ['economy', 'military', 'magic'].forEach(cat => {
            const container = document.getElementById(`build-cat-${cat}`);
            if (!container) return;
            container.innerHTML = '';
            
            allBuildings[cat].forEach(build => {
                const card = document.createElement('div');
                const isMax = build.level >= build.maxLevel;
                const isLocked = !build.unlockStatus.met;
                
                card.className = `building-card lv-${build.level} ${isMax ? 'is-max' : ''} ${isLocked ? 'is-locked' : ''}`;
                
                let costText = isMax ? '已满级' : `💰${build.cost.gold} 🪵${build.cost.wood}`;
                if (isLocked) {
                    costText = `🔒 ${build.unlockStatus.reason}`;
                }

                card.innerHTML = `
                    <div class="building-icon" style="${this.getIconStyleString(build.icon)}"></div>
                    <span class="building-name">${build.name}</span>
                    <span class="building-cost">${costText}</span>
                `;
                
                card.onmouseenter = () => {
                    const tooltipData = { ...build };
                    if (isLocked) {
                        tooltipData.description = `<div style="color: #ff4444; margin-bottom: 8px; font-weight: bold;">[锁定] ${build.unlockStatus.reason}</div>` + (build.description || '');
                    }
                    uiManager.showTooltip(tooltipData);
                };
                card.onmouseleave = () => uiManager.hideTooltip();

                card.onclick = () => {
                    if (isLocked) {
                        worldManager.showNotification(`无法建设：${build.unlockStatus.reason}`);
                        audioManager.play('ui_invalid', { volume: 0.8 });
                        return;
                    }
                    if (isMax) return;

                    // 使用原子化的资源消耗接口，修复资源扣除顺序导致的 Bug
                    if (worldManager.spendResources(build.cost)) {
                        // 建筑升级成功：播放厚重的“按下”音效
                        audioManager.play('ui_press', { volume: 0.8 });
                        cityData.upgradeBuilding(build.id);
                        this.refreshTownUI(cityId);
                    } else {
                        worldManager.showNotification('资源不足，无法建设！');
                        audioManager.play('ui_invalid', { volume: 0.8 });
                    }
                };
                container.appendChild(card);
            });
        });

        // 2. 刷新城镇驻军
        const townUnitsList = document.getElementById('town-units-list');
        townUnitsList.innerHTML = '';
        for (const type in cityData.availableUnits) {
            const count = cityData.availableUnits[type];
            if (count > 0) {
                const slot = this.createArmySlot(type, count, () => {
                    if (!this.isPhysicalVisit) {
                        worldManager.showNotification("必须亲临城市才能领兵！");
                        return;
                    }
                    audioManager.play('ui_click', { volume: 0.5 });
                    worldManager.transferToHero(type, 1, cityId);
                    this.refreshTownUI(cityId);
                });
                this.bindUnitTooltip(slot, type);
                // 远程访问样式
                if (!this.isPhysicalVisit) {
                    slot.style.opacity = "0.6";
                    slot.style.cursor = "not-allowed";
                }
                townUnitsList.appendChild(slot);
            }
        }

        // 3. 刷新可招募列表
        const recruitList = document.getElementById('town-recruit-list');
        if (recruitList) {
            recruitList.innerHTML = '';
            worldManager.getAvailableRecruits(cityId).forEach(unitInfo => {
                const type = unitInfo.type;
                const details = worldManager.getUnitDetails(type);
                const item = document.createElement('div');
                item.className = 'recruit-item';
                
                // 计算最终招募价格
                const finalCost = worldManager.getRecruitGoldCost(type);

                item.innerHTML = `
                    <div class="slot-icon" style="${this.getIconStyleString(type)}"></div>
                    <div class="unit-info">
                        <span class="unit-name">${details.name}</span>
                        <span class="unit-cost">💰${finalCost}</span>
                    </div>
                    <button class="wuxia-btn wuxia-btn-small">招募</button>
                `;

                this.bindUnitTooltip(item, type);
                item.querySelector('button').onclick = (e) => {
                    e.stopPropagation();
                    // 核心修改：逻辑已收拢至 WorldManager，它会自动判断是否能直接入队
                    if (worldManager.recruitUnit(type, cityId)) {
                        // 招募成功：播放清脆音效
                        audioManager.play('ui_click', { volume: 0.5 });
                        this.refreshTownUI(cityId);
                    } else {
                        worldManager.showNotification('资源不足或统御上限已满！');
                        audioManager.play('ui_invalid', { volume: 0.8 });
                    }
                };
                recruitList.appendChild(item);
            });
        }

        // 4. 刷新侠客队伍
        const heroArmyList = document.getElementById('hero-army-list');
        heroArmyList.innerHTML = '';
        for (const type in worldManager.heroArmy) {
            const count = worldManager.heroArmy[type];
            if (count > 0) {
                const slot = this.createArmySlot(type, count, () => {
                    if (!this.isPhysicalVisit) {
                        worldManager.showNotification("必须亲临城市才能调动部队！");
                        return;
                    }
                    audioManager.play('ui_click', { volume: 0.5 });
                    worldManager.transferToCity(type, 1, cityId);
                    this.refreshTownUI(cityId);
                });
                this.bindUnitTooltip(slot, type);
                // 远程访问样式
                if (!this.isPhysicalVisit) {
                    slot.style.opacity = "0.6";
                    slot.style.cursor = "not-allowed";
                }
                heroArmyList.appendChild(slot);
            }
        }
    }

    /**
     * 统一绑定兵种属性悬浮窗，消除重复代码
     */
    bindUnitTooltip(element, type) {
        const stats = worldManager.getUnitDetails(type);
        // 核心修复：直接从 getUnitDetails 中获取 cost，它是带了天赋修正的最终值
        const cost = stats.cost;
        // 遵照要求：UI 上依然统一显示为“伤害”，不再显示“秒伤”等现代术语
        const label = '伤害'; 
        
        element.onmouseenter = () => uiManager.showTooltip({
            name: stats.name,
            level: `气血:${stats.hp} | ${label}:${stats.dps} | 占用:${cost}`,
            description: stats.description,
            color: '#d4af37' // 武侠金色
        });
        element.onmouseleave = () => uiManager.hideTooltip();
    }

    createArmySlot(type, count, onClick) {
        const slot = document.createElement('div');
        slot.className = 'unit-slot';
        slot.innerHTML = `
            <div class="slot-icon" style="${this.getIconStyleString(type)}"></div>
            <span class="slot-count">x${count}</span>
        `;
        slot.onclick = onClick;
        return slot;
    }

    getIconStyleString(type) {
        const style = spriteFactory.getIconStyle(type);
        return `background-image: ${style.backgroundImage}; background-position: ${style.backgroundPosition}; background-size: ${style.backgroundSize}; image-rendering: pixelated;`;
    }

    getUnitName(type) {
        return worldManager.getUnitDetails(type).name;
    }

    createGround(mapData) {
        const size = mapGenerator.size;
        const heightMap = worldManager.mapState.heightMap;
        const geometry = new THREE.PlaneGeometry(size, size, size, size);
        
        const colors = [];
        const color = new THREE.Color();
        const vertices = geometry.attributes.position.array;

        for (let z = 0; z <= size; z++) {
            for (let x = 0; x <= size; x++) {
                const gridX = Math.min(x, size - 1);
                const gridZ = Math.min(z, size - 1);
                const type = mapData[gridZ][gridX];
                const rawNoise = heightMap[gridZ][gridX];

                let h = 0;
                if (type === TILE_TYPES.WATER) {
                    color.setHex(0x1a3a6d);
                    const diff = Math.abs(rawNoise + 0.15);
                    h = -1.5 - (diff * 8.4 + Math.pow(diff, 2) * 14.0); 
                } else if (type === TILE_TYPES.MOUNTAIN) {
                    const step = Math.floor(rawNoise * 5) / 5;
                    const greyVal = 0.3 + (step * 0.3);
                    color.setRGB(greyVal, greyVal, greyVal * 1.1);
                    const diff = rawNoise - 0.20;
                    h = 2.0 + (diff * 14.0 + Math.pow(diff, 2) * 35.0); 
                } else {
                    const step = Math.floor(rawNoise * 4) / 4;
                    const greenVal = 0.4 + (step * 0.2);
                    color.setRGB(greenVal * 0.4, greenVal, greenVal * 0.2);
                    h = 0;
                }
                
                const idx = (z * (size + 1) + x) * 3;
                vertices[idx + 2] = h;

                colors.push(color.r, color.g, color.b);
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        for (let i = 0; i < 16; i++) {
            for (let j = 0; j < 16; j++) {
                const noise = Math.random() * 40;
                const brightness = 210 + noise;
                ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
                ctx.fillRect(i, j, 1, 1);
            }
        }
        
        const terrainTex = new THREE.CanvasTexture(canvas);
        terrainTex.magFilter = THREE.NearestFilter;
        terrainTex.minFilter = THREE.NearestFilter;
        terrainTex.wrapS = terrainTex.wrapT = THREE.RepeatWrapping;
        terrainTex.repeat.set(size / 4, size / 4); 

        const material = new THREE.MeshStandardMaterial({ 
            map: terrainTex,
            vertexColors: true,
            roughness: 1.0,
            metalness: 0.0,
            flatShading: true
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grid = new THREE.GridHelper(size, size / 10, 0x445544, 0x223322);
        grid.position.y = 0.1;
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.scene.add(grid);
    }

    createWater(size) {
        const geometry = new THREE.PlaneGeometry(size, size);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 256, 256);
        gradient.addColorStop(0, '#1e5ab6');
        gradient.addColorStop(0.5, '#2a6ed0');
        gradient.addColorStop(1, '#1e5ab6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < 100; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const waterTex = new THREE.CanvasTexture(canvas);
        waterTex.magFilter = THREE.NearestFilter;
        waterTex.minFilter = THREE.NearestFilter;
        waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
        waterTex.repeat.set(size / 8, size / 8); 
        this.waterTex = waterTex;

        const material = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            map: waterTex,
            transparent: true,
            opacity: 0.7,
            roughness: 0.2,
            metalness: 0.3,
            side: THREE.DoubleSide,
            flatShading: true
        });

        const water = new THREE.Mesh(geometry, material);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.8; 
        this.scene.add(water);
    }

    createPlayer() {
        // 1. 创建玩家容器组，统一管理位置
        this.playerGroup = new THREE.Group();
        const pos = worldManager.mapState.playerPos;
        this.playerGroup.position.set(pos.x, 0, pos.z);

        // 2. 创建脚下影子
        const shadowGeom = new THREE.CircleGeometry(0.35, 16);
        const shadowMat = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.3 
        });
        this.playerShadow = new THREE.Mesh(shadowGeom, shadowMat);
        this.playerShadow.rotation.x = -Math.PI / 2;
        this.playerShadow.position.y = 0.05; // 略高于地面
        this.playerGroup.add(this.playerShadow);

        // 3. 创建主角精灵并存入容器
        this.playerHero = spriteFactory.createUnitSprite(this.heroId, 0); // 锚点设为底部 (0)
        const config = spriteFactory.unitConfig[this.heroId];
        this.baseScale = config.scale || 1.4;
        this.playerHero.scale.set(this.baseScale, this.baseScale, 1);
        this.playerGroup.add(this.playerHero);

        this.scene.add(this.playerGroup);
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); 
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.6); 
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    start() {
        this.isActive = true;
        timeManager.resume(); // 恢复时间流逝并重置计时起点
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('pointermove', this.onPointerMove); // 核心修复：注册指针监听
        
        const hud = document.getElementById('world-ui');
        if (hud) {
            hud.classList.remove('hidden');
            worldManager.updateHUD();
            this.updateHeroHUD();
        }

        // 显示小地图
        const minimap = document.querySelector('.minimap-container');
        if (minimap) minimap.classList.remove('hidden');

        timeManager.updateUI();
    }

    stop() {
        this.isActive = false;
        timeManager.pause(); // 暂停时间流逝
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('pointermove', this.onPointerMove); // 核心修复：移除指针监听
        
        if (this.playerGroup) {
            worldManager.savePlayerPos(this.playerGroup.position.x, this.playerGroup.position.z);
        }

        const hud = document.getElementById('world-ui');
        if (hud) hud.classList.add('hidden');

        // 隐藏小地图
        const minimap = document.querySelector('.minimap-container');
        if (minimap) minimap.classList.add('hidden');
    }

    onKeyDown(e) { this.keys[e.key.toLowerCase()] = true; }
    onKeyUp(e) { this.keys[e.key.toLowerCase()] = false; }

    update(deltaTime) {
        if (!this.isActive || !this.playerGroup) return;

        this.lastPlayerPos.copy(this.playerGroup.position); // 记录位移前位置

        // 驱动 UIManager 实时刷新 (所见即所得)
        uiManager.update();

        // --- 核心：检测待播放的升级反馈 ---
        if (worldManager.heroData.pendingLevelUps > 0) {
            this.vfxLibrary.createLevelUpVFX(this.playerGroup.position);
            // 播放专属的升级音效
            audioManager.play('source_levelup', { volume: 0.8 });
            worldManager.heroData.pendingLevelUps--;
            console.log("%c[升级反馈] 已在大世界触发视觉特效", "color: #ffd700; font-weight: bold");
        }

        if (this.waterTex) {
            this.waterTex.offset.x += 0.005 * deltaTime;
            this.waterTex.offset.y += 0.002 * deltaTime;
        }

        const seasonChanged = timeManager.update();
        if (seasonChanged) {
            worldManager.processResourceProduction();
        }

        // --- 核心限制：仅开局告示显示或奇穴面板打开时禁止移动 ---
        const startWindow = document.getElementById('game-start-window');
        const talentPanel = document.getElementById('talent-panel');
        const isStartWindowOpen = startWindow && !startWindow.classList.contains('hidden');
        const isTalentPanelOpen = talentPanel && !talentPanel.classList.contains('hidden');

        if (isStartWindowOpen || isTalentPanelOpen) {
            this.footstepTimer = 0;
        } else {
            const moveDir = new THREE.Vector3(0, 0, 0);
            if (this.keys['w'] || this.keys['arrowup']) moveDir.z -= 1;
            if (this.keys['s'] || this.keys['arrowdown']) moveDir.z += 1;
            if (this.keys['a'] || this.keys['arrowleft']) moveDir.x -= 1;
            if (this.keys['d'] || this.keys['arrowright']) moveDir.x += 1;

            const texture = this.playerHero.material.map;
            const config = spriteFactory.unitConfig[this.heroId];

            if (moveDir.lengthSq() > 0) {
                moveDir.normalize();
                // 核心修改：位移 = 速度 * deltaTime，脱离帧率限制
                const moveStep = this.moveSpeed * deltaTime;
                const nextPos = this.playerGroup.position.clone().addScaledVector(moveDir, moveStep);
                
                if (mapGenerator.isPassable(nextPos.x, nextPos.z)) {
                    this.playerGroup.position.copy(nextPos);
                } else {
                    const nextPosX = this.playerGroup.position.clone().add(new THREE.Vector3(moveDir.x * moveStep, 0, 0));
                    if (mapGenerator.isPassable(nextPosX.x, nextPosX.z)) {
                        this.playerGroup.position.copy(nextPosX);
                    }
                    const nextPosZ = this.playerGroup.position.clone().add(new THREE.Vector3(0, 0, moveDir.z * moveStep));
                    if (mapGenerator.isPassable(nextPosZ.x, nextPosZ.z)) {
                        this.playerGroup.position.copy(nextPosZ);
                    }
                }
            }

            // --- 动感行走动画逻辑 (Distance-based 优雅微调版) ---
            const distanceMoved = this.playerGroup.position.distanceTo(this.lastPlayerPos);
            const isPhysicallyMoving = distanceMoved > 0.001;

            if (isPhysicallyMoving) {
                // 【动感行走调参指南】
                // 1. stepDistance: 步长。越大迈步越大，频率越低。
                //    - 基准: 主角(李承恩)秒速约 8.5。
                //    - 设定 3.5 表示每秒产生 8.5/3.5 = 2.4 步，刚好处于天花板边缘。
                const stepDistance = 3.5;      
                const maxStepsPerSecond = 2.5; // 2. 天花板: 每秒最多跳几下。防止瞬移抽搐。
                
                const deltaAnim = (distanceMoved / stepDistance) * Math.PI;
                const maxDelta = (maxStepsPerSecond * Math.PI) * deltaTime;
                const finalDelta = Math.min(deltaAnim, maxDelta);
                this.moveAnimTime += finalDelta;

                // --- 调试日志：受 WorldManager.DEBUG.SHOW_MOTION_DEBUG 控制 ---
                const debug = WorldManager.DEBUG;
                if (debug.ENABLED && debug.SHOW_MOTION_DEBUG) {
                    this.debugLogTimer += deltaTime;
                    if (this.debugLogTimer > 0.5) {
                        const speedPerSec = (distanceMoved / deltaTime).toFixed(3);
                        const isCapped = deltaAnim > maxDelta ? "%c[已达天花板]" : "";
                        console.log(`%c[运动调试] %c秒速: ${speedPerSec} | 帧位移: ${distanceMoved.toFixed(4)} | 动画增量: ${finalDelta.toFixed(3)} ${isCapped}`, 
                            "color: #00ffcc; font-weight: bold", "color: #fff", isCapped ? "color: #ff4444" : "");
                        this.debugLogTimer = 0;
                    }
                }
                
                // 1. 垂直跳动 (Bobbing) - 降低高度使其更稳重
                const bob = Math.abs(Math.sin(this.moveAnimTime)); 
                this.playerHero.position.y = bob * 0.12; // 向上跳跃高度

                // 2. 挤压伸展 (Squash & Stretch) - 更加细微
                const stretch = 1 + bob * 0.06;
                const squash = 1 - bob * 0.03;
                
                // 3. 影子随跳动缩小 - 更加克制
                const shadowScale = 1 - bob * 0.2;
                this.playerShadow.scale.set(shadowScale, shadowScale, 1);
                this.playerShadow.material.opacity = 0.3 * (1 - bob * 0.2);

                // 4. 倾斜 (Tilting) - 减小倾斜度
                const tilt = moveDir.x * -0.08; 
                this.playerHero.rotation.z = THREE.MathUtils.lerp(this.playerHero.rotation.z, tilt, 0.1);

                // 统一应用缩放
                this.playerHero.scale.set(
                    this.baseScale * squash,
                    this.baseScale * stretch,
                    1
                );

                // 脚步声逻辑 (起步即响，固定频率)
                if (this.footstepTimer === 0) {
                    audioManager.play('footstep_grass', { 
                        volume: 0.6, 
                        pitchVar: 0.2 
                    });
                }

                this.footstepTimer += deltaTime * 1000;
                if (this.footstepTimer >= this.footstepInterval) {
                    this.footstepTimer = 0;
                }
                
                if (moveDir.x !== 0) {
                    const defaultFacing = config.defaultFacing || 'right';
                    const isMovingLeft = moveDir.x < 0;
                    let shouldFlip = isMovingLeft ? (defaultFacing === 'right') : (defaultFacing === 'left');
                    const standardRepeatX = 1 / 4; 
                    const flippedRepeatX = -1 / 4;
                    const targetRepeatX = shouldFlip ? flippedRepeatX : standardRepeatX;
                    if (texture.repeat.x !== targetRepeatX) {
                        texture.repeat.x = targetRepeatX;
                        texture.offset.x = shouldFlip ? (config.col / 4) : ((config.col - 1) / 4);
                    }
                }
                this.checkInteractions();
            } else {
                this.footstepTimer = 0; // 停止移动时归零
                this.moveAnimTime = 0;
                
                // 停止移动时平滑恢复
                this.playerHero.position.y = THREE.MathUtils.lerp(this.playerHero.position.y, 0, 0.2);
                this.playerHero.rotation.z = THREE.MathUtils.lerp(this.playerHero.rotation.z, 0, 0.2);
                this.playerShadow.scale.set(
                    THREE.MathUtils.lerp(this.playerShadow.scale.x, 1, 0.2),
                    THREE.MathUtils.lerp(this.playerShadow.scale.y, 1, 0.2),
                    1
                );
                this.playerShadow.material.opacity = THREE.MathUtils.lerp(this.playerShadow.material.opacity, 0.3, 0.2);

                // 呼吸效果
                const breath = Math.sin(Date.now() * 0.003) * 0.02;
                this.playerHero.scale.set(
                    this.baseScale * (1 - breath),
                    this.baseScale * (1 + breath),
                    1
                );
            }
        }

        // --- 更新小地图 ---
        this.updateExploration(); // 更新探索迷雾数据
        this.updateMinimap();

        const targetCamPos = this.playerGroup.position.clone().add(new THREE.Vector3(0, 15, 12));
        this.camera.position.lerp(targetCamPos, 0.1);
        this.camera.lookAt(this.playerGroup.position);
    }

    spawnFloatingText(type, amount) {
        const textEl = document.createElement('div');
        textEl.className = 'floating-text';
        this.floatingStack++;
        const currentStack = this.floatingStack;
        let color = '#ffffff';
        let prefix = '';
        
        switch (type) {
            case 'gold': color = '#ffcc00'; prefix = '💰 +'; break;
            case 'wood': color = '#deb887'; prefix = '🪵 +'; break;
            case 'xp': color = '#00ffcc'; prefix = '✨ XP +'; break;
        }
        
        textEl.style.color = color;
        textEl.innerText = `${prefix}${amount}`;
        
        const vector = new THREE.Vector3();
        this.playerHero.getWorldPosition(vector);
        vector.y += 2.2; 
        vector.project(this.camera);
        
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;
        
        const stackYOffset = (currentStack - 1) * 35; 
        const randomXOffset = (Math.random() - 0.5) * 40; 
        
        textEl.style.left = `${x + randomXOffset}px`;
        textEl.style.top = `${y - stackYOffset}px`;
        
        document.getElementById('ui-layer').appendChild(textEl);
        
        setTimeout(() => {
            this.floatingStack = Math.max(0, this.floatingStack - 1);
        }, 800);
        
        setTimeout(() => {
            if (textEl.parentNode) {
                textEl.parentNode.removeChild(textEl);
            }
        }, 1500);
    }

    onBattleEnd(result) {
        const ms = worldManager.mapState;
        const enemyId = ms.pendingBattleEnemyId;
        
        if (!enemyId) return;

        console.log(`%c[战斗结束] 结果: ${result.winner}, 目标: ${enemyId}`, "color: #ffaa00");

        // 核心修改：无论输赢，战后血量回满 (侠客不死)，但蓝量保持持久化状态
        worldManager.heroData.hpCurrent = worldManager.heroData.hpMax;

        if (result && result.winner === 'player') {
            // 核心改动：奇穴效果 - 战利清缴 (战后额外金钱)
            // 优雅实现：传入敌人强度作为基础值，中转站会自动根据 50% 加成返还 1.5 倍结果
            const enemyPower = result.enemyPower || 100;
            const totalGold = modifierManager.getModifiedValue(worldManager.getPlayerHeroDummy(), 'kill_gold', enemyPower);
            const bonusGold = Math.floor(totalGold - enemyPower); // 差值即为额外奖励
            
            if (bonusGold > 0) {
                worldManager.addGold(bonusGold);
                worldManager.showNotification(`战利清缴：额外获得 💰${bonusGold}`);
            }

            // 检查是否是城镇
            const cityData = worldManager.cities[enemyId];
            if (cityData) {
                // 攻城战胜利
                worldManager.captureCity(enemyId);
                // 刷新 HUD 以显示新占领的城市
                this.refreshWorldHUD();
            } else {
                // 普通野怪胜利：移除怪物
                worldManager.removeEntity(enemyId);
                const item = this.interactables.find(i => i.id === enemyId);
                if (item) this.scene.remove(item.mesh);
                this.interactables = this.interactables.filter(i => i.id !== enemyId);
            }
        } else {
            // 输了或逃了：锁定怪物/城镇，防止连续触发
            ms.interactionLocks.add(enemyId);
        }
        
        ms.pendingBattleEnemyId = null; 
    }

    /**
     * 动态刷新左下角 HUD (支持多个城市)
     */
    refreshWorldHUD() {
        const container = document.getElementById('world-hud-bottom-left');
        if (!container) return;

        // 清空现有内容
        container.innerHTML = '';

        // 获取模板
        const cityTpl = document.getElementById('tpl-hud-city');
        const heroTpl = document.getElementById('tpl-hud-hero');

        // 1. 获取所有属于玩家的城市
        const playerCities = Object.values(worldManager.cities).filter(c => c.owner === 'player');

        // 2. 为每个城市创建一个卡片
        playerCities.forEach(city => {
            if (!cityTpl) return;
            const clone = cityTpl.content.cloneNode(true);
            const cityCard = clone.querySelector('.hud-card');
            cityCard.id = `card-city-${city.id}`;
            
            const iconStyle = spriteFactory.getIconStyle(city.getIconKey());
            const portrait = cityCard.querySelector('.hud-portrait');
            Object.assign(portrait.style, iconStyle);

            cityCard.querySelector('.hud-name').innerText = city.name;
            cityCard.querySelector('.hud-sub').innerText = city.id === 'main_city_1' ? '大本营' : '占领据点';

            cityCard.onclick = () => {
                audioManager.play('ui_click', { volume: 0.6 });
                this.openTownManagement(city.id);
            };

            container.appendChild(clone);
        });

        // 3. 添加英雄卡片 (始终在最后)
        if (heroTpl) {
            const clone = heroTpl.content.cloneNode(true);
            const heroCard = clone.querySelector('.hud-card-hero');
            const talentHint = clone.querySelector('#talent-hint');
            const heroData = worldManager.heroData;
            const heroIconStyle = spriteFactory.getIconStyle(heroData.id);

            const portrait = heroCard.querySelector('.hud-portrait');
            Object.assign(portrait.style, heroIconStyle);

            heroCard.querySelector('#hud-hero-level').innerText = heroData.level;
            
            // 设置初始条状态
            const hpBar = heroCard.querySelector('#hud-hero-hp-bar');
            const mpBar = heroCard.querySelector('#hud-hero-mp-bar');
            if (hpBar) hpBar.style.width = `${(heroData.hpCurrent / heroData.hpMax) * 100}%`;
            if (mpBar) mpBar.style.width = `${(heroData.mpCurrent / heroData.mpMax) * 100}%`;

            heroCard.onclick = () => {
                audioManager.play('ui_click', { volume: 0.6 });
                this.openHeroStats();
            };

            // 绑定天赋提醒点击事件
            if (talentHint) {
                talentHint.onclick = (e) => {
                    // 此时已经不需要 stopPropagation，因为它们不再是嵌套关系
                    uiManager.toggleTalentPanel(true);
                };
            }

            container.appendChild(clone);
        }

        // 刷新后同步更新英雄 HUD 状态 (例如天赋提醒)
        this.updateHeroHUD();
    }

    checkInteractions() {
        const toRemove = [];
        const playerPos = this.playerGroup.position;
        const ms = worldManager.mapState;

        this.interactables.forEach((item, index) => {
            const dist = playerPos.distanceTo(item.mesh.position);
            const isLocked = ms.interactionLocks.has(item.id);

            if (isLocked) {
                const exitDist = item.interactionRadius * 1.5; // 动态解锁半径
                if (dist > exitDist) {
                    ms.interactionLocks.delete(item.id);
                }
                return;
            }

            if (item.canInteract(playerPos)) {
                const shouldRemove = item.onInteract(this);
                if (shouldRemove) {
                    toRemove.push(index);
                }
            } else if (item.onExitRange) {
                item.onExitRange(this);
            }
        });

        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.interactables.splice(toRemove[i], 1);
        }
    }

    closeTownManagement() {
        const panel = document.getElementById('town-management-panel');
        if (panel) panel.classList.add('hidden');
        this.activeCityId = null;
    }

    /**
     * 初始化小地图系统
     */
    initMinimap() {
        // --- 优雅重构：基于 DEBUG 配置决定迷雾与探测状态 ---
        const debug = WorldManager.DEBUG;
        this.enableFog = !(debug.ENABLED && debug.REVEAL_MAP); 
        
        if (!this.enableFog) {
            console.log("%c[DEBUG] %c迷雾已全局解除", "color: #ffaa00", "color: #fff");
            worldManager.revealFullMap();
        }

        let container = document.querySelector('.minimap-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'minimap-container';
            container.innerHTML = `<canvas id="minimap-canvas"></canvas>`;
            document.body.appendChild(container);
        }

        this.minimapCanvas = document.getElementById('minimap-canvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        
        const size = mapGenerator.size;
        this.cropMargin = 20; // 边缘裁剪宽度
        const displaySize = size - this.cropMargin * 2;
        
        this.minimapCanvas.width = displaySize;
        this.minimapCanvas.height = displaySize;

        // 预渲染静态地形层
        this.offscreenMap = document.createElement('canvas');
        this.offscreenMap.width = size;
        this.offscreenMap.height = size;
        mapGenerator.debugDraw(this.offscreenMap);

        // 创建迷雾遮罩 Canvas (用于渲染探索状态)
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = displaySize;
        this.fogCanvas.height = displaySize;
        this.fogCtx = this.fogCanvas.getContext('2d');
    }

    /**
     * 更新探索区域
     */
    updateExploration() {
        if (!this.playerGroup) return;
        
        const ms = worldManager.mapState;
        const size = mapGenerator.size;
        const halfSize = size / 2;
        
        // 获取玩家在 0-400 坐标系下的位置
        const px = Math.round(this.playerGroup.position.x + halfSize);
        const pz = Math.round(this.playerGroup.position.z + halfSize);
        
        // 核心改动：奇穴效果 - 慧眼识珠 (迷雾半径增加)
        // 优雅实现：传入基础半径 33，中转站根据百分比加成(如+50%)自动返还最终半径(如49)
        const revealRadius = Math.round(modifierManager.getModifiedValue({ side: 'player' }, 'reveal_radius', 33));
        
        // 标记已探索
        for (let dz = -revealRadius; dz <= revealRadius; dz++) {
            for (let dx = -revealRadius; dx <= revealRadius; dx++) {
                if (dx * dx + dz * dz > revealRadius * revealRadius) continue;
                
                const nx = px + dx;
                const nz = pz + dz;
                
                if (nx >= 0 && nx < size && nz >= 0 && nz < size) {
                    ms.exploredMap[nz * size + nx] = 1;
                }
            }
        }
    }

    /**
     * 每帧更新小地图动态标记
     */
    updateMinimap() {
        if (!this.minimapCtx || !this.playerGroup) return;

        const debug = WorldManager.DEBUG;
        const size = mapGenerator.size;
        const ctx = this.minimapCtx;
        const margin = this.cropMargin || 0;
        const displaySize = size - margin * 2;
        const ms = worldManager.mapState;

        // 1. 如果开启了迷雾，则在内存中构建迷雾遮罩图
        if (this.enableFog) {
            const fCtx = this.fogCtx;
            const fogData = fCtx.createImageData(displaySize, displaySize);
            for (let y = 0; y < displaySize; y++) {
                for (let x = 0; x < displaySize; x++) {
                    const gridX = x + margin;
                    const gridZ = y + margin;
                    const isExplored = ms.exploredMap[gridZ * size + gridX];
                    
                    const idx = (y * displaySize + x) * 4;
                    if (isExplored) {
                        fogData.data[idx] = 0;
                        fogData.data[idx+1] = 0;
                        fogData.data[idx+2] = 0;
                        fogData.data[idx+3] = 0;
                    } else {
                        fogData.data[idx] = 0;
                        fogData.data[idx+1] = 0;
                        fogData.data[idx+2] = 0;
                        fogData.data[idx+3] = 255;
                    }
                }
            }
            fCtx.putImageData(fogData, 0, 0);
        }

        // 2. 绘制地形层 (底图)
        ctx.clearRect(0, 0, displaySize, displaySize);
        ctx.drawImage(this.offscreenMap, margin, margin, displaySize, displaySize, 0, 0, displaySize, displaySize);

        // 3. 如果开启了迷雾，盖上迷雾层
        if (this.enableFog) {
            ctx.drawImage(this.fogCanvas, 0, 0);
        }

        // 4. 坐标转换工具 (World -> Minimap)
        const worldToMinimap = (wx, wz) => {
            const halfSize = size / 2;
            return {
                x: (wx + halfSize) - margin,
                y: (wz + halfSize) - margin
            };
        };

        // --- 4.5 优雅重构：调试专用势力热力图 ---
        if (debug.ENABLED && debug.SHOW_INFLUENCE && ms.influenceCenters) {
            ms.influenceCenters.forEach(center => {
                const pos = worldToMinimap(center.x, center.z);
                
                // 绘制影响力半径
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, center.radius, 0, Math.PI * 2);
                
                // 根据势力类型选择颜色
                let color = 'rgba(255, 255, 255, 0.2)';
                if (center.type === 'player_home') color = 'rgba(0, 255, 0, 0.15)'; // 玩家：绿色
                else if (center.type === 'evil') {
                    if (center.faction === 'tianyi') color = 'rgba(128, 0, 128, 0.25)'; // 天一：紫色
                    else if (center.faction === 'shence') color = 'rgba(255, 165, 0, 0.25)'; // 神策：橙色
                    else if (center.faction === 'red_cult') color = 'rgba(255, 0, 0, 0.25)'; // 红衣：红色
                }
                else if (center.type === 'sect') color = 'rgba(0, 191, 255, 0.2)'; // 门派：天蓝色

                ctx.fillStyle = color;
                ctx.fill();
                
                // 绘制外圈
                ctx.strokeStyle = color.replace('0.2', '0.5').replace('0.15', '0.4').replace('0.25', '0.6');
                ctx.lineWidth = 1;
                ctx.stroke();

                // 标注势力名称 (仅中心点)
                ctx.fillStyle = 'white';
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'center';
                const label = center.faction || center.factionHero || (center.type === 'player_home' ? 'Home' : 'Sect');
                ctx.fillText(label, pos.x, pos.y - 5);
            });
        }

        // --- 4.6 优雅重构：调试专用兴趣点标记 ---
        if (debug.ENABLED && debug.SHOW_POIS && mapGenerator.pois) {
            mapGenerator.pois.forEach((poi, index) => {
                // 将 grid 坐标转换为小地图相对坐标
                const px = poi.x - margin;
                const py = poi.z - margin;

                if (px >= 0 && px <= displaySize && py >= 0 && py <= displaySize) {
                    // 绘制探测半径圆圈
                    ctx.beginPath();
                    ctx.arc(px, py, poi.radius, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'; // 青色透明圆圈
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // 绘制中心点
                    ctx.fillStyle = 'cyan';
                    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);

                    // 绘制索引号 (可选)
                    ctx.font = '8px Arial';
                    ctx.fillStyle = 'white';
                    ctx.fillText(index.toString(), px + 4, py + 4);
                }
            });
        }

        // 5. 绘制重要建筑 (如果关闭迷雾，则始终显示)
        this.interactables.forEach(item => {
            if (item.type === 'city' || item.type === 'captured_building') {
                let shouldShow = true;
                if (this.enableFog) {
                    const gridX = Math.round(item.mesh.position.x + size/2);
                    const gridZ = Math.round(item.mesh.position.z + size/2);
                    shouldShow = ms.exploredMap[gridZ * size + gridX];
                }
                
                if (shouldShow) {
                    const pos = worldToMinimap(item.mesh.position.x, item.mesh.position.z);
                    if (pos.x >= 0 && pos.x <= displaySize && pos.y >= 0 && pos.y <= displaySize) {
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 1;

                        if (item.type === 'city') {
                            const cityData = worldManager.cities[item.id];
                            const factionColor = worldManager.getFactionColor(cityData?.owner);
                            
                            // 主城：正方形
                            ctx.fillStyle = factionColor;
                            ctx.fillRect(pos.x - 4, pos.y - 4, 8, 8);
                            ctx.strokeRect(pos.x - 4, pos.y - 4, 8, 8);
                        } else if (item.type === 'captured_building') {
                            // 资源建筑：圆形
                            const owner = item.config?.owner || 'none';
                            ctx.fillStyle = (owner === 'none') ? '#888888' : worldManager.getFactionColor(owner);
                            
                            ctx.beginPath();
                            ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.stroke();
                        }
                    }
                }
            }
        });

        // 6. 绘制玩家位置 (白色点)
        const playerPos = worldToMinimap(this.playerGroup.position.x, this.playerGroup.position.z);
        if (playerPos.x >= 0 && playerPos.x <= displaySize && playerPos.y >= 0 && playerPos.y <= displaySize) {
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.arc(playerPos.x, playerPos.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }
}
