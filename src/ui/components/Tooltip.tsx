import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../store/uiStore';

/**
 * 全局 Tooltip 组件
 * 职责：响应 useUIStore 中的 tooltip 状态，显示游戏内的各种信息提示
 */
export const Tooltip: React.FC = () => {
  const { visible, data, x, y } = useUIStore(s => s.tooltip);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (visible && tooltipRef.current) {
      const tooltipWidth = tooltipRef.current.offsetWidth;
      const tooltipHeight = tooltipRef.current.offsetHeight;
      
      let finalX = x + 15;
      let finalY = y + 15;

      // 边界检测：防止超出屏幕
      if (finalX + tooltipWidth > window.innerWidth) {
        finalX = x - tooltipWidth - 15;
      }
      if (finalY + tooltipHeight > window.innerHeight) {
        finalY = y - tooltipHeight - 15;
      }

      setOffset({ x: finalX, y: finalY });
    }
  }, [visible, x, y, data]);

  if (!visible || !data) return null;

  return (
    <div 
      ref={tooltipRef}
      className="tooltip-container"
      style={{ 
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        pointerEvents: 'none',
        zIndex: 10000,
        visibility: offset.x === 0 ? 'hidden' : 'visible' // 防止闪烁
      }}
    >
      {/* 标题区 */}
      <div className="tooltip-title">
        {data.level && (data.level === '初级' || data.level === '高级' || data.level === '绝技') ? (
          <>
            <span>{data.name}</span>
            <span className={`skill-level-tag level-${data.level}`}>{data.level}</span>
          </>
        ) : (
          data.name
        )}
      </div>

      {/* 副标题区 (消耗、冷却、等级、状态等) */}
      {(data.mpCost || data.level !== undefined || data.cdText || data.status) && (
        <div 
          className="tooltip-level"
          style={{ color: data.color || '#ffffff' }}
        >
          {data.mpCost || data.cdText ? (
            <>
              <span>{data.mpCost || ''}</span>
              <span>{data.cdText || ''}</span>
            </>
          ) : typeof data.level === 'number' && data.maxLevel !== undefined ? (
            `当前等级: ${data.level} / ${data.maxLevel}`
          ) : data.status ? (
            <div dangerouslySetInnerHTML={{ __html: data.status }} />
          ) : data.level && data.maxLevel ? (
            `${data.level}: ${data.maxLevel}`
          ) : (
            data.level || ''
          )}
        </div>
      )}

      {/* 描述正文 */}
      {data.description && (
        <div 
          className="tooltip-desc"
          dangerouslySetInnerHTML={{ __html: data.description }}
        />
      )}
    </div>
  );
};
