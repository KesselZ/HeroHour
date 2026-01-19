import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { spriteFactory } from '../../engine/SpriteFactory';

/**
 * 城市状态简卡 (左下角 HUD) - 已迁移至 React
 */
export const CityMiniCard: React.FC = () => {
  const { city } = useGameStore();
  const { openPanel } = useUIStore();

  // 获取图标样式
  const portraitStyle = spriteFactory.getIconStyle(city.type) as React.CSSProperties;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 开启城镇管理面板前，确保数据已同步
    // 注意：这里我们使用 store 中存的当前城市 ID
    if (window.worldManager) {
      window.worldManager.syncCityToStore(city.id);
    }
    
    openPanel('townManagement');
  };

  return (
    <div 
      className="hud-card hud-card-city" 
      id="city-mini-card"
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <div 
        className="hud-portrait" 
        id="world-city-portrait"
        style={portraitStyle}
      ></div>
      <div className="hud-info">
        <span className="hud-name" id="world-city-display-name">{city.name}</span>
        <span className="hud-sub">{city.isMainCity ? '当前主城' : '附属领地'}</span>
      </div>
    </div>
  );
};
