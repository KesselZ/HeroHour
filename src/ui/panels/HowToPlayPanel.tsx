import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { HOW_TO_PLAY } from '../../data/HowToPlayContent';
import { audioManager } from '../../engine/AudioManager';

/**
 * 江湖指南面板 (HowToPlayPanel) - 已迁移至 React
 */
export const HowToPlayPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const isVisible = activePanel === 'howToPlay';

  const handleClose = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
  };

  if (!isVisible) return null;

  return (
    <div id="how-to-play-panel" className="menu-container standard-panel-v4">
      <div className="standard-panel-header">
        <div className="header-ornament-left"></div>
        <div className="panel-title">{HOW_TO_PLAY.title}</div>
        <div className="header-ornament-right"></div>
        <button className="close-btn-v3" onClick={handleClose}>×</button>
      </div>
      <div className="standard-panel-main">
        <div id="how-to-play-text" className="panel-content-scroll">
          {HOW_TO_PLAY.sections.map((section, index) => (
            <div key={index} className="htp-section">
              <h3 className="htp-subtitle">{section.subtitle}</h3>
              <p className="htp-content">{section.content}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
