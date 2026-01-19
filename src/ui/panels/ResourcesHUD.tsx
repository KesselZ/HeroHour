import React from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * 资源显示面板 (HUD) - 已迁移至 React
 * 复用原有的 CSS 类名：.resource-bar, .res-item, .res-emoji
 */
export const ResourcesHUD: React.FC = () => {
  const { resources } = useGameStore();

  return (
    <div className="resource-bar">
      <div className="res-item">
        <span className="res-emoji">💰</span>
        <span id="world-gold">{resources.gold}</span>
      </div>
      <div className="res-item">
        <span className="res-emoji">🪵</span>
        <span id="world-wood">{resources.wood}</span>
      </div>
    </div>
  );
};
