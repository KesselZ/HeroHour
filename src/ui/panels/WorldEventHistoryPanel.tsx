import React, { useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useWorldStore } from '../../store/worldStore';
import { audioManager } from '../../engine/AudioManager';

/**
 * 江湖传闻历史面板 (WorldEventHistoryPanel) - 已迁移至 React
 */
export const WorldEventHistoryPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { eventHistory, markAllRead } = useWorldStore();
  const isVisible = activePanel === 'worldEventHistory';

  useEffect(() => {
    if (isVisible) {
      markAllRead();
    }
  }, [isVisible, markAllRead]);

  const handleClose = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
    if (window.uiManager?.isMobile) {
      window.uiManager.setHUDVisibility(true);
    }
  };

  if (!isVisible) return null;

  return (
    <div id="world-event-history-panel" className="menu-container standard-panel-v4">
      <div className="standard-panel-header">
        <div className="header-ornament-left"></div>
        <div className="panel-title">江湖快报</div>
        <div className="header-ornament-right"></div>
        <button className="close-btn-v3" onClick={handleClose}>×</button>
      </div>
      <div className="standard-panel-main">
        <div id="event-history-list" className="panel-content-scroll">
          {eventHistory.length > 0 ? (
            eventHistory.map((event) => (
              <div key={event.id} className="history-item">
                <div className="history-item-header">
                  <span className="history-item-time">天宝 {event.year} 年 · {event.season}</span>
                  <span className={`history-item-tag ${event.type}`}>{event.title}</span>
                </div>
                <div className="history-item-content">
                  {event.text}
                </div>
              </div>
            ))
          ) : (
            <div className="history-empty-hint">暂无江湖传闻...</div>
          )}
        </div>
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
