import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { audioManager } from '../../engine/AudioManager';
import { spriteFactory } from '../../engine/SpriteFactory';

/**
 * 战斗结算面板 (BattleSettlementPanel) - 已迁移至 React
 */
export const BattleSettlementPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { settlement } = useGameStore();
  const isVisible = activePanel === 'battleSettlement';

  const handleReturn = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
    // 如果是从战斗中返回，需要执行场景切换逻辑
    if (window.battleScene) {
      window.battleScene.returnToWorld();
    } else if (window.worldScene) {
      // @ts-ignore
      window.worldScene.finalizeSimpleSettlement();
    }
  };

  if (!isVisible || !settlement) return null;

  return (
    <div id="battle-settlement" className="menu-container">
      <div className="menu-decoration-top">战斗统计</div>
      <h2 id="settlement-title" className={`game-title ${settlement.isVictory ? 'victory' : 'defeat'}`}>
        {settlement.title}
      </h2>
      <div className="settlement-content">
        <div className="xp-gain-section">
          <div className="section-label">
            阅历获得 <span style={{ color: 'var(--jx3-gold-light)' }}>Lv.{settlement.level}</span>
          </div>
          <div className="xp-gain-display">
            <span className="xp-gain-val">+{settlement.xpGained}</span>
            <div className="stat-bar-bg" style={{ height: '12px', flex: 1 }}>
              <div 
                className="stat-bar-fill xp" 
                style={{ width: `${settlement.xpProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
        <div className="loss-section">
          <div className="section-label">兵力变化</div>
          <div className="loss-list">
            {settlement.losses.length > 0 ? (
              settlement.losses.map((item, idx) => {
                const iconStyle = spriteFactory.getIconStyle(item.icon);
                return (
                  <div key={idx} className="loss-item">
                    <div className="loss-icon" style={iconStyle as React.CSSProperties}></div>
                    <div className="loss-info">
                      <span className="loss-name">{item.name}</span>
                      <span className="loss-val">-{item.loss}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="loss-item-empty">无兵力损失</div>
            )}
          </div>
        </div>
      </div>
      <div className="menu-options">
        <button className="wuxia-btn" onClick={handleReturn}>返回大世界</button>
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
