import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * 资源显示面板 (HUD) - 已迁移至 React
 * 职责：展示金钱和木材，并在数值变动时播放跳动动画
 */
export const ResourcesHUD: React.FC = () => {
  const { resources } = useGameStore();
  const prevResources = useRef(resources);
  const goldRef = useRef<HTMLDivElement>(null);
  const woodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 检测金钱变动并触发动画
    if (resources.gold !== prevResources.current.gold && goldRef.current) {
      goldRef.current.classList.remove('res-update-anim');
      void goldRef.current.offsetWidth; // 强制重绘触发动画
      goldRef.current.classList.add('res-update-anim');
    }
    // 检测木材变动并触发动画
    if (resources.wood !== prevResources.current.wood && woodRef.current) {
      woodRef.current.classList.remove('res-update-anim');
      void woodRef.current.offsetWidth;
      woodRef.current.classList.add('res-update-anim');
    }
    prevResources.current = resources;
  }, [resources]);

  return (
    <div className="resource-bar">
      <div ref={goldRef} className="res-item">
        <span className="res-emoji">💰</span>
        <span>{resources.gold}</span>
      </div>
      <div ref={woodRef} className="res-item">
        <span className="res-emoji">🪵</span>
        <span>{resources.wood}</span>
      </div>
    </div>
  );
};
