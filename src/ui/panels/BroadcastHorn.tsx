import React, { useState, useEffect } from 'react';
import { useWorldStore } from '../../store/worldStore';
import { useUIStore } from '../../store/uiStore';
import { audioManager } from '../../engine/AudioManager';

/**
 * 江湖播报喇叭 (BroadcastHorn) - 已迁移至 React
 * 包含小鸽子图标、红点提示、以及点击打开历史面板的逻辑
 */
export const BroadcastHorn: React.FC = () => {
  const { hasUnreadEvents, markAllRead } = useWorldStore();
  const { openPanel, togglePanel } = useUIStore();
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    const handleBroadcast = () => {
      // 收到新消息时晃动图标
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 2000);
    };

    window.addEventListener('world-broadcast', handleBroadcast);
    return () => window.removeEventListener('world-broadcast', handleBroadcast);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // @ts-ignore
    audioManager.play('ui_click');
    togglePanel('worldEventHistory');
  };

  return (
    <div 
      id="broadcast-horn" 
      className={`broadcast-horn ${isShaking ? 'shake' : ''}`} 
      title="江湖传闻"
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="horn-icon">🕊️</div>
      {hasUnreadEvents && (
        <div id="broadcast-dot" className="broadcast-dot"></div>
      )}
    </div>
  );
};
