import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import { saveManager } from '../../systems/SaveManager';
import { spriteFactory } from '../../engine/SpriteFactory';
import { audioManager } from '../../engine/AudioManager';

interface SaveMetadata {
  timestamp: number;
  heroName: string;
  heroLevel: number;
  dateStr: string;
  gold: number;
  heroId: string;
}

/**
 * 存档项组件
 */
const SaveItem: React.FC<{
  slotId: number;
  metadata: SaveMetadata | null;
  mode: 'load' | 'save';
  onAction: (slotId: number) => void;
}> = ({ slotId, metadata, mode, onAction }) => {
  const iconStyle = metadata 
    ? spriteFactory.getIconStyle(metadata.heroId || 'liwangsheng') 
    : {};

  return (
    <div 
      className={`save-item ${!metadata && mode === 'load' ? 'empty' : ''}`}
      onClick={() => (metadata || mode === 'save') && onAction(slotId)}
    >
      {metadata ? (
        <>
          <div className="save-portrait" style={iconStyle as React.CSSProperties}></div>
          <div className="save-info">
            <div className="save-name">
              {metadata.heroName} <span className="save-lv">Lv.{metadata.heroLevel}</span>
            </div>
            <div className="save-details">
              <span>{metadata.dateStr}</span>
              <span className="save-res">💰{metadata.gold}</span>
              <span className="save-time">{saveManager.formatTimestamp(metadata.timestamp)}</span>
            </div>
          </div>
          {mode === 'save' && <div className="save-action-badge override">覆盖</div>}
        </>
      ) : (
        <>
          <div className="save-portrait empty"></div>
          <div className="save-info">
            <div className="save-name" style={{ color: 'rgba(255,255,255,0.3)' }}>空存档位</div>
            <div className="save-details">尚无江湖传闻</div>
          </div>
          {mode === 'save' && <div className="save-action-badge create">建立</div>}
        </>
      )}
    </div>
  );
};

/**
 * 存档/读档面板 (SaveLoadPanel) - 已迁移至 React
 */
export const SaveLoadPanel: React.FC<{ mode: 'load' | 'save' }> = ({ mode }) => {
  const { activePanel, closePanel } = useUIStore();
  const [saves, setSaves] = useState<(SaveMetadata | null)[]>([]);
  const isVisible = (mode === 'load' && activePanel === 'loadSave') || 
                    (mode === 'save' && activePanel === 'saveGame');

  const refreshSaves = () => {
    setSaves(saveManager.getAllMetadata());
  };

  useEffect(() => {
    if (isVisible) {
      refreshSaves();
    }
  }, [isVisible]);

  const handleAction = (slotId: number) => {
    // @ts-ignore
    audioManager.play('ui_click');
    
    if (mode === 'save') {
      window.dispatchEvent(new CustomEvent('request-save', { detail: { slotId } }));
    } else {
      window.dispatchEvent(new CustomEvent('request-load', { detail: { slotId } }));
    }
  };

  useEffect(() => {
    const handleUpdate = () => refreshSaves();
    window.addEventListener('save-updated', handleUpdate);
    return () => window.removeEventListener('save-updated', handleUpdate);
  }, []);

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
    <div id={`${mode}-save-panel`} className="menu-container standard-panel-v4">
      <div className="standard-panel-header">
        <div className="header-ornament-left"></div>
        <div className="panel-title">{mode === 'load' ? '载入江湖' : '记叙江湖'}</div>
        <div className="header-ornament-right"></div>
        <button className="close-btn-v3" onClick={handleClose}>×</button>
      </div>
      <div className="standard-panel-main">
        <div className="load-save-list panel-content-scroll">
          {[1, 2, 3].map((id, index) => (
            <SaveItem 
              key={id} 
              slotId={id} 
              metadata={saves[index]} 
              mode={mode} 
              onAction={handleAction} 
            />
          ))}
        </div>
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
