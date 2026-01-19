import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { audioManager } from '../../engine/AudioManager';
import { spriteFactory } from '../../engine/SpriteFactory';

/**
 * 游戏开始面板 (GameStartPanel) - 已迁移至 React
 * 展示本局对手信息，作为进入游戏的告示
 */
export const GameStartPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { startEnemies } = useGameStore();
  const isVisible = activePanel === 'gameStart';

  const handleClose = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
    if (window.uiManager) {
      window.uiManager.gameStartWindowShown = true;
    }
  };

  if (!isVisible) return null;

  return (
    <div id="game-start-window" className="menu-container game-start-v3">
      <div className="menu-decoration-top">江湖告示</div>
      <div className="game-start-header">
        <h2 className="game-title">风云<span>际会</span></h2>
        <p className="game-subtitle">大幕拉开，谁主沉浮？</p>
      </div>
      <div className="game-start-content">
        <div className="enemy-info-box">
          <div className="enemy-info-label">本场对手</div>
          <div id="game-start-enemies" className="enemy-list-horizontal">
            {startEnemies.map(enemy => {
              const iconStyle = spriteFactory.getIconStyle(enemy.id);
              return (
                <div key={enemy.id} className="enemy-item-card">
                  <div 
                    className="enemy-portrait-start" 
                    style={{
                      backgroundImage: iconStyle.backgroundImage,
                      backgroundPosition: iconStyle.backgroundPosition,
                      backgroundSize: iconStyle.backgroundSize
                    }}
                  ></div>
                  <div className="enemy-name-start">{enemy.name}</div>
                  <div className="enemy-title-start">{enemy.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="menu-options">
        <button className="wuxia-btn" onClick={handleClose}>踏上征途</button>
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
