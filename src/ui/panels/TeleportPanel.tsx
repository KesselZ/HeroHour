import React, { useMemo } from 'react';
import { useUIStore } from '../../store/uiStore';
import { audioManager } from '../../engine/AudioManager';
import { spriteFactory } from '../../engine/SpriteFactory';

interface TeleportDestination {
  id: string;
  name: string;
  type: string;
  x: number;
  z: number;
  icon: string;
  isActivated: boolean;
  isEnemyOccupied?: boolean;
}

/**
 * 神行千里传送面板 (TeleportPanel) - 已迁移至 React
 */
export const TeleportPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const isVisible = activePanel === 'teleport';

  const destinations = useMemo(() => {
    if (!isVisible || !window.worldManager) return [];

    const dests: TeleportDestination[] = [];
    const worldManager = window.worldManager;

    // 1. 玩家拥有的城市
    Object.values(worldManager.cities).forEach((city: any) => {
      if (city.owner === 'player') {
        dests.push({
          id: city.id,
          name: city.name,
          type: 'city',
          x: city.x,
          z: city.z,
          icon: city.getIconKey(),
          isActivated: true
        });
      }
    });

    // 2. 激活的传送祭坛
    const altarNames: Record<string, string> = {
      'TL': '西北祭坛',
      'TR': '东北祭坛',
      'BL': '西南祭坛',
      'BR': '东南祭坛'
    };

    worldManager.mapState.entities.forEach((entity: any) => {
      if (entity.type === 'captured_building' && entity.buildingType === 'teleport_altar') {
        const owner = entity.config.owner || 'none';
        const isActivated = owner === 'player';
        const isEnemyOccupied = owner !== 'none' && owner !== 'player';
        const suffix = entity.id.split('_').pop() || '';
        
        dests.push({
            id: entity.id,
            name: altarNames[suffix] || '未知祭坛',
            type: 'altar',
            x: entity.x,
            z: entity.z,
            icon: 'altar_v3', // 使用注册表中的祭坛图标
            isActivated: isActivated,
            isEnemyOccupied: isEnemyOccupied
        });
      }
    });

    return dests;
  }, [isVisible]);

  const handleClose = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
    if (window.uiManager?.isMobile) {
      window.uiManager.setHUDVisibility(true);
    }
  };

  const handleTeleport = (dest: TeleportDestination) => {
    if (!dest.isActivated) {
      if (dest.isEnemyOccupied) {
        window.worldManager.showNotification("该祭坛被敌方势力占据，无法传送。");
      } else {
        window.worldManager.showNotification("该祭坛尚未激活，无法传送。");
      }
      // @ts-ignore
      audioManager.play('ui_invalid', { volume: 0.8 });
      return;
    }

    // @ts-ignore
    audioManager.play('ui_teleport', { volume: 0.8 });
    if (window.worldScene) {
      window.worldScene.teleportTo(dest.x, dest.z);
    }
    closePanel();
  };

  if (!isVisible) return null;

  return (
    <div id="teleport-panel" className="menu-container teleport-panel-v3">
      <div className="menu-decoration-top"></div>
      <button className="close-btn-v3" onClick={handleClose} title="关闭">×</button>
      <div className="teleport-header">
        <h2 className="teleport-title">神行千里</h2>
        <p className="teleport-subtitle">选择你要传送的目的地</p>
      </div>
      <div id="teleport-destinations" className="teleport-grid panel-content-scroll">
        {destinations.map(dest => {
          const statusText = dest.isActivated ? '可传送' : (dest.isEnemyOccupied ? '敌方占据' : '未激活');
          const iconStyle = spriteFactory.getIconStyle(dest.icon);

          return (
            <div 
              key={dest.id} 
              className={`teleport-dest-card ${!dest.isActivated ? 'disabled' : ''}`}
              onClick={() => handleTeleport(dest)}
            >
              <div className="teleport-dest-icon" style={iconStyle as React.CSSProperties}></div>
              <div className="teleport-dest-info">
                <span className="teleport-dest-name">{dest.name}</span>
                <span className="teleport-dest-type">{statusText}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
