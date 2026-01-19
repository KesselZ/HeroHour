import React from 'react';
import { useUIStore } from '../../store/uiStore';

/**
 * 全局通知组件
 * 职责：显示游戏内的临时消息提醒（如存档成功、获得物品等）
 */
export const Notification: React.FC = () => {
  const notifications = useUIStore(s => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="notification-container">
      {notifications.map((n) => (
        <div key={n.id} className="game-notification">
          <span className="game-notification-icon">◈</span>
          <span>{n.text}</span>
        </div>
      ))}
    </div>
  );
};
