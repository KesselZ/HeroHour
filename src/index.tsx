import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import { ResourcesHUD } from './ui/panels/ResourcesHUD';
import { WorldDateHUD } from './ui/panels/WorldDateHUD';
import { HeroMiniCard } from './ui/panels/HeroMiniCard';
import { CityMiniCard } from './ui/panels/CityMiniCard';
import { HeroStatsPanel } from './ui/panels/HeroStatsPanel';
import { TownManagementPanel } from './ui/panels/TownManagementPanel';
import { SkillLearnPanel } from './ui/panels/SkillLearnPanel';
import { TalentPanel } from './ui/panels/TalentPanel';
import { HowToPlayPanel } from './ui/panels/HowToPlayPanel';
import { SaveLoadPanel } from './ui/panels/SaveLoadPanel';
import { WorldEventHistoryPanel } from './ui/panels/WorldEventHistoryPanel';
import { BroadcastBubble } from './ui/panels/BroadcastBubble';
import { BroadcastHorn } from './ui/panels/BroadcastHorn';
import { TeleportPanel } from './ui/panels/TeleportPanel';
import { GameStartPanel } from './ui/panels/GameStartPanel';
import { BuildingDraftPanel } from './ui/panels/BuildingDraftPanel';
import { PauseMenuPanel } from './ui/panels/PauseMenuPanel';
import { BattleSettlementPanel } from './ui/panels/BattleSettlementPanel';
import { BattleModals } from './ui/panels/BattleModals';
import { BattleHUD } from './ui/panels/BattleHUD';
import { GameStartFlow } from './ui/panels/GameStartFlow';

// 1. 唤醒原有的原生 JS 逻辑 (Three.js 引擎、旧版 UI 监听等)
import './main.js';

// 2. 初始化 React UI - 侠客名鉴 (挂载到原有面板位置以保持 CSS 兼容)
const heroStatsMount = document.getElementById('react-hero-stats-mount');
if (heroStatsMount) {
  const root = createRoot(heroStatsMount);
  root.render(
    <React.StrictMode>
      <HeroStatsPanel />
    </React.StrictMode>
  );
}

// 2.5 初始化 React UI - 城镇管理
const townMount = document.getElementById('react-town-management-mount');
if (townMount) {
  const root = createRoot(townMount);
  root.render(
    <React.StrictMode>
      <TownManagementPanel />
    </React.StrictMode>
  );
}

// 2.7 初始化 React UI - 招式图谱
const skillLearnMount = document.getElementById('react-skill-learn-mount');
if (skillLearnMount) {
  const root = createRoot(skillLearnMount);
  root.render(
    <React.StrictMode>
      <SkillLearnPanel />
    </React.StrictMode>
  );
}

// 2.8 初始化 React UI - 奇穴系统
const talentMount = document.getElementById('react-talent-mount');
if (talentMount) {
  const root = createRoot(talentMount);
  root.render(
    <React.StrictMode>
      <TalentPanel />
    </React.StrictMode>
  );
}

// 2.9 初始化 React UI - 江湖指南
const howToPlayMount = document.getElementById('react-how-to-play-mount');
if (howToPlayMount) {
  const root = createRoot(howToPlayMount);
  root.render(
    <React.StrictMode>
      <HowToPlayPanel />
    </React.StrictMode>
  );
}

// 2.10 初始化 React UI - 存档/读档
const loadSaveMount = document.getElementById('react-load-save-mount');
if (loadSaveMount) {
  const root = createRoot(loadSaveMount);
  root.render(
    <React.StrictMode>
      <SaveLoadPanel mode="load" />
    </React.StrictMode>
  );
}

const saveGameMount = document.getElementById('react-save-game-mount');
if (saveGameMount) {
  const root = createRoot(saveGameMount);
  root.render(
    <React.StrictMode>
      <SaveLoadPanel mode="save" />
    </React.StrictMode>
  );
}

// 2.11 初始化 React UI - 江湖快报
const worldEventHistoryMount = document.getElementById('react-world-event-history-mount');
if (worldEventHistoryMount) {
  const root = createRoot(worldEventHistoryMount);
  root.render(
    <React.StrictMode>
      <WorldEventHistoryPanel />
    </React.StrictMode>
  );
}

// 2.12 初始化 React UI - 播报气泡
const broadcastBubbleMount = document.getElementById('react-broadcast-bubble-mount');
if (broadcastBubbleMount) {
  const root = createRoot(broadcastBubbleMount);
  root.render(
    <React.StrictMode>
      <BroadcastBubble />
    </React.StrictMode>
  );
}

// 2.13 初始化 React UI - 播报小鸽子
const broadcastHornMount = document.getElementById('react-broadcast-horn-mount');
if (broadcastHornMount) {
  const root = createRoot(broadcastHornMount);
  root.render(
    <React.StrictMode>
      <BroadcastHorn />
    </React.StrictMode>
  );
}

// 2.14 初始化 React UI - 神行千里传送
const teleportMount = document.getElementById('react-teleport-mount');
if (teleportMount) {
  const root = createRoot(teleportMount);
  root.render(
    <React.StrictMode>
      <TeleportPanel />
    </React.StrictMode>
  );
}

// 2.15 初始化 React UI - 游戏开始告示
const gameStartMount = document.getElementById('react-game-start-mount');
if (gameStartMount) {
  const root = createRoot(gameStartMount);
  root.render(
    <React.StrictMode>
      <GameStartPanel />
    </React.StrictMode>
  );
}

// 2.16 初始化 React UI - 季度建筑抽卡
const buildingDraftMount = document.getElementById('react-building-draft-mount');
if (buildingDraftMount) {
  const root = createRoot(buildingDraftMount);
  root.render(
    <React.StrictMode>
      <BuildingDraftPanel />
    </React.StrictMode>
  );
}

// 2.17 初始化 React UI - 暂停菜单
const pauseMenuMount = document.getElementById('react-pause-menu-mount');
if (pauseMenuMount) {
  const root = createRoot(pauseMenuMount);
  root.render(
    <React.StrictMode>
      <PauseMenuPanel />
    </React.StrictMode>
  );
}

// 2.18 初始化 React UI - 战斗结算与弹窗
const settlementMount = document.getElementById('react-settlement-mount');
if (settlementMount) {
  const root = createRoot(settlementMount);
  root.render(
    <React.StrictMode>
      <BattleSettlementPanel />
      <BattleModals />
    </React.StrictMode>
  );
}

// 3. 初始化 React UI - 资源条
const resContainer = document.getElementById('react-resource-bar');
if (resContainer) {
  const root = createRoot(resContainer);
  root.render(
    <React.StrictMode>
      <ResourcesHUD />
    </React.StrictMode>
  );
}

// 4. 初始化 React UI - 时间显示
const dateContainer = document.getElementById('react-date-display');
if (dateContainer) {
  const root = createRoot(dateContainer);
  root.render(
    <React.StrictMode>
      <WorldDateHUD />
    </React.StrictMode>
  );
}

// 5. 初始化 React UI - 英雄简卡
const heroCardContainer = document.getElementById('react-hero-mini-card');
if (heroCardContainer) {
  const root = createRoot(heroCardContainer);
  root.render(
    <React.StrictMode>
      <HeroMiniCard />
    </React.StrictMode>
  );
}

// 6. 初始化 React UI - 城市简卡
const cityCardContainer = document.getElementById('react-city-mini-card');
if (cityCardContainer) {
  const root = createRoot(cityCardContainer);
  root.render(
    <React.StrictMode>
      <CityMiniCard />
    </React.StrictMode>
  );
}

// 7. 初始化 React UI - 战场 HUD
const battleHUDMount = document.getElementById('react-battle-hud-mount');
if (battleHUDMount) {
  const root = createRoot(battleHUDMount);
  root.render(
    <React.StrictMode>
      <BattleHUD />
    </React.StrictMode>
  );
}

// 8. 初始化 React UI - 游戏流程 (主菜单、选人、选难度)
const gameFlowMount = document.getElementById('react-game-start-flow-mount');
if (gameFlowMount) {
  const root = createRoot(gameFlowMount);
  root.render(
    <React.StrictMode>
      <GameStartFlow />
    </React.StrictMode>
  );
}
