import React from 'react';
import { useUIStore } from '../../store/uiStore';

/**
 * FloatingTextLayer 组件
 * 职责：在屏幕上渲染浮动的文字（如伤害数值、资源获得等）
 */
export const FloatingTextLayer: React.FC = () => {
  const floatingTexts = useUIStore(s => s.floatingTexts);

  if (floatingTexts.length === 0) return null;

  return (
    <div className="floating-text-container" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 }}>
      {floatingTexts.map((item) => (
        <div 
          key={item.id} 
          className="floating-text"
          style={{
            position: 'absolute',
            left: `${item.x}px`,
            top: `${item.y}px`,
            color: item.color,
            transition: 'all 1.5s ease-out',
            animation: 'floating-up 1.5s forwards'
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
};

