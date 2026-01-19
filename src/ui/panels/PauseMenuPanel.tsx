import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { audioManager } from '../../engine/AudioManager';

/**
 * 暂停菜单面板 (PauseMenuPanel) - 已迁移至 React
 */
export const PauseMenuPanel: React.FC = () => {
  const { activePanel, closePanel, openPanel } = useUIStore();
  const isVisible = activePanel === 'pauseMenu';
  const [showSettings, setShowSettings] = useState(false);

  const handleResume = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
  };

  const handleSave = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    openPanel('saveGame');
  };

  const handleLoad = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    openPanel('loadSave');
  };

  const handleBackToMenu = () => {
    window.location.reload();
  };

  const handleBgmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    // @ts-ignore
    audioManager.setBGMVolume(val);
  };

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    // @ts-ignore
    audioManager.setSFXVolume(val);
  };

  if (!isVisible) return null;

  return (
    <div id="pause-menu" className="menu-overlay">
      <div className="menu-container pause-container">
        <div className="menu-decoration-top">江湖休整</div>
        <h2 className="game-title">中途<span>休息</span></h2>
        
        {!showSettings ? (
          <div className="menu-options">
            <button className="wuxia-btn" onClick={handleResume}>继续江湖</button>
            <button className="wuxia-btn" onClick={handleSave}>保存存档</button>
            <button className="wuxia-btn" onClick={handleLoad}>载入存档</button>
            <button className="wuxia-btn" onClick={() => setShowSettings(true)}>江湖设置</button>
            <button className="wuxia-btn small-btn" onClick={handleBackToMenu}>退出到主界面</button>
          </div>
        ) : (
          <div id="pause-settings-options">
            <div className="settings-group">
              <label>音乐音量</label>
              <input 
                type="range" 
                min="0" max="1" step="0.01" 
                defaultValue={audioManager.bgmVolume}
                onChange={handleBgmChange}
              />
            </div>
            <div className="settings-group">
              <label>音效音量</label>
              <input 
                type="range" 
                min="0" max="1" step="0.01" 
                defaultValue={audioManager.sfxVolume}
                onChange={handleSfxChange}
              />
            </div>
            <button className="wuxia-btn small-btn" style={{ marginTop: '20px' }} onClick={() => setShowSettings(false)}>返回暂停</button>
          </div>
        )}
        
        <div className="menu-decoration-bottom"></div>
      </div>
    </div>
  );
};
