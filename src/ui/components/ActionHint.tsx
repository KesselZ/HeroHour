import React from 'react';
import { useUIStore } from '../../store/uiStore';

/**
 * ActionHint 组件
 * 职责：显示跟随鼠标的操作提示文字（如“点击对话”、“右键移动”等）
 */
export const ActionHint: React.FC = () => {
  const { visible, text, x, y } = useUIStore(s => s.actionHint);

  if (!visible || !text) return null;

  return (
    <div 
      id="action-hint"
      className="pixel-font"
      style={{
        position: 'fixed',
        left: `${x + 10}px`,
        top: `${y + 10}px`,
        pointerEvents: 'none',
        zIndex: 9999,
        whiteSpace: 'nowrap'
      }}
    >
      {text}
    </div>
  );
};

