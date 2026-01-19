import React from 'react';
import { createPortal } from 'react-dom';

// 全局服务
import { Tooltip } from './components/Tooltip';
import { Notification } from './components/Notification';
import { LoadingScreen } from './components/LoadingScreen';
import { PerfPanel } from './components/PerfPanel';

// 游戏面板
import { HeroStatsPanel } from './panels/HeroStatsPanel';
import { TownManagementPanel } from './panels/TownManagementPanel';
import { SkillLearnPanel } from './panels/SkillLearnPanel';
import { TalentPanel } from './panels/TalentPanel';
import { HowToPlayPanel } from './panels/HowToPlayPanel';
import { SaveLoadPanel } from './panels/SaveLoadPanel';
import { WorldEventHistoryPanel } from './panels/WorldEventHistoryPanel';
import { BroadcastBubble } from './panels/BroadcastBubble';
import { BroadcastHorn } from './panels/BroadcastHorn';
import { TeleportPanel } from './panels/TeleportPanel';
import { GameStartPanel } from './panels/GameStartPanel';
import { BuildingDraftPanel } from './panels/BuildingDraftPanel';
import { PauseMenuPanel } from './panels/PauseMenuPanel';
import { BattleSettlementPanel } from './panels/BattleSettlementPanel';
import { BattleModals } from './panels/BattleModals';
import { BattleHUD } from './panels/BattleHUD';
import { GameStartFlow } from './panels/GameStartFlow';
import { ResourcesHUD } from './panels/ResourcesHUD';
import { WorldDateHUD } from './panels/WorldDateHUD';
import { HeroMiniCard } from './panels/HeroMiniCard';
import { CityMiniCard } from './panels/CityMiniCard';

/**
 * Portal 辅助组件：将内容渲染到指定的 HTML 容器中
 */
const Mount: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const el = document.getElementById(id);
  return el ? createPortal(children, el) : null;
};

const App: React.FC = () => {
  return (
    <div className="react-app-container">
      {/* 1. 全局底层服务 (挂载在 react-ui-root 内部) */}
      <LoadingScreen />
      <Tooltip />
      <Notification />
      <PerfPanel />

      {/* 2. 游戏核心面板 (利用 Portal 挂载到 HTML 的指定 ID 容器中，确保 CSS 兼容) */}
      <Mount id="react-game-start-flow-mount"><GameStartFlow /></Mount>
      <Mount id="react-resource-bar"><ResourcesHUD /></Mount>
      <Mount id="react-date-display"><WorldDateHUD /></Mount>
      <Mount id="react-broadcast-horn-mount"><BroadcastHorn /></Mount>
      <Mount id="react-broadcast-bubble-mount"><BroadcastBubble /></Mount>
      <Mount id="react-city-mini-card"><CityMiniCard /></Mount>
      <Mount id="react-hero-mini-card"><HeroMiniCard /></Mount>
      <Mount id="react-hero-stats-mount"><HeroStatsPanel /></Mount>
      <Mount id="react-town-management-mount"><TownManagementPanel /></Mount>
      <Mount id="react-teleport-mount"><TeleportPanel /></Mount>
      <Mount id="react-skill-learn-mount"><SkillLearnPanel /></Mount>
      <Mount id="react-how-to-play-mount"><HowToPlayPanel /></Mount>
      <Mount id="react-load-save-mount"><SaveLoadPanel mode="load" /></Mount>
      <Mount id="react-save-game-mount"><SaveLoadPanel mode="save" /></Mount>
      <Mount id="react-world-event-history-mount"><WorldEventHistoryPanel /></Mount>
      <Mount id="react-game-start-mount"><GameStartPanel /></Mount>
      <Mount id="react-building-draft-mount"><BuildingDraftPanel /></Mount>
      <Mount id="react-pause-menu-mount"><PauseMenuPanel /></Mount>
      <Mount id="react-battle-hud-mount"><BattleHUD /></Mount>
      <Mount id="react-talent-mount"><TalentPanel /></Mount>
      
      {/* 特殊：战斗结算与弹窗通常共享挂载点 */}
      <Mount id="react-settlement-mount">
        <BattleSettlementPanel />
        <BattleModals />
      </Mount>
    </div>
  );
};

export default App;
