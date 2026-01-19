import React from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useUIStore } from '../../store/uiStore';
import { spriteFactory } from '../../engine/SpriteFactory';
import { audioManager } from '../../engine/AudioManager';
import { uiManager } from '../../core/UIManager';

declare global {
  interface Window {
    worldScene: any;
  }
}

/**
 * 英雄状态简卡 (左下角 HUD) - 已迁移至 React
 * 
 * 软件工程优化说明：
 * 1. 结构对齐：严格还原原生 HTML 的 hero-hud-unit-group 嵌套关系，确保 CSS 布局 100% 兼容。
 * 2. 逻辑解耦：通过 UI Store 管理面板状态，移除对全局 WorldScene 的直接依赖。
 * 3. 视觉还原：修复气泡在卡片内部导致的容器撑大问题。
 */
export const HeroMiniCard: React.FC = () => {
  const { hero } = useHeroStore();
  const { openPanel } = useUIStore();
  const { stats, hasAvailableTalents } = hero;

  const hpPercent = stats.hpMax > 0 ? (stats.hp / stats.hpMax) * 100 : 0;
  const mpPercent = stats.mpMax > 0 ? (stats.mp / stats.mpMax) * 100 : 0;

  // 获取头像样式并强制转换为 React.CSSProperties
  const portraitStyle = spriteFactory.getIconStyle(hero.id) as React.CSSProperties;

  const handleTalentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // @ts-ignore
    audioManager.play('ui_click');
    openPanel('talent');
  };

  const handleHeroClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 优雅重构：改用 UI Store 开启面板
    openPanel('heroStats');
  };

  return (
    <div className="hero-hud-unit-group">
      {/* 天赋提醒：作为独立按钮层，位于卡片上方，不再撑开卡片轮廓 */}
      {hasAvailableTalents && (
        <div className="talent-hint-wrapper" onClick={handleTalentClick}>
        <div id="talent-hint" className="talent-hint-v1">
          <span className="hint-icon">✧</span>
          <span className="hint-text">星魄待悟</span>
          </div>
        </div>
      )}
      
      {/* 英雄卡片：现在其大小将仅由 portrait 和 info 决定，回归原始小巧样式 */}
      <div 
        className="hud-card hud-card-hero" 
        id="hero-mini-card"
        onClick={handleHeroClick}
        style={{ cursor: 'pointer' }}
      >
      <div 
        className="hud-portrait" 
        id="world-hero-portrait"
        style={portraitStyle}
      >
        <div className="hud-level-badge" id="hud-hero-level">Lv.{stats.level}</div>
      </div>
      
      <div className="hud-info">
        <div className="hud-mini-bars">
          <div className="mini-bar-bg">
            <div 
              id="hud-hero-hp-bar" 
              className="mini-bar-fill hp" 
              style={{ width: `${hpPercent}%` }}
            ></div>
          </div>
          <div className="mini-bar-bg">
            <div 
              id="hud-hero-mp-bar" 
              className="mini-bar-fill mp" 
              style={{ width: `${mpPercent}%` }}
            ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
