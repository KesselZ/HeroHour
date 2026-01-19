import React, { useState } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { audioManager } from '../../engine/AudioManager';
import { spriteFactory } from '../../engine/SpriteFactory';

/**
 * 季度建筑抽卡面板 (BuildingDraftPanel) - 已迁移至 React
 * 炉石传说风格的卡牌三选一界面
 */
export const BuildingDraftPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { draftOptions } = useGameStore();
  const isVisible = activePanel === 'buildingDraft';
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (option: any) => {
    if (selectedId) return; // 防止重复点击

    setSelectedId(option.id);
    // @ts-ignore
    audioManager.play('ui_card_select');

    // 洗牌音效
    setTimeout(() => {
      // @ts-ignore
      audioManager.play('ui_card_shuffle');
    }, 500);

    // 延迟关闭并执行逻辑
    setTimeout(() => {
      if (window.worldManager?.buildingManager?.selectDraftOption(option.id)) {
        closePanel();
        window.worldManager.showNotification(`已确立发展目标：${option.name}`);
        setSelectedId(null); // 重置状态
      }
    }, 600);
  };

  const handleHover = () => {
    // @ts-ignore
    audioManager.play('ui_card_hover');
  };

  if (!isVisible) return null;

  return (
    <div id="building-draft-overlay" className="menu-overlay">
      <div className="draft-instruction">—— 季 度 策 划 ——</div>
      <div id="building-draft-cards" className="building-cards-wrapper">
        {draftOptions.map((option) => {
          const iconStyle = spriteFactory.getIconStyle(option.icon);
          const rarityLabels = {
            'legendary': '绝世',
            'epic': '传说',
            'rare': '稀有',
            'common': '基础'
          };
          const rarityLabel = rarityLabels[option.rarity] || '基础';
          const isSelected = selectedId === option.id;
          const isNotSelected = selectedId !== null && selectedId !== option.id;

          return (
            <div key={option.id} className="hs-card-wrapper">
              <div 
                className={`hs-card rarity-${option.rarity} ${isSelected ? 'is-selected' : ''} ${isNotSelected ? 'is-not-selected' : ''}`}
                onClick={() => handleSelect(option)}
                onMouseEnter={handleHover}
              >
                <div className="hs-card-icon-frame">
                  <div 
                    className="hs-card-icon" 
                    style={{
                      backgroundImage: iconStyle.backgroundImage,
                      backgroundPosition: iconStyle.backgroundPosition,
                      backgroundSize: iconStyle.backgroundSize
                    }}
                  ></div>
                </div>
                <div className="hs-card-name">{option.name}</div>
                <div className="hs-card-rarity">{rarityLabel}</div>
                <div className="hs-card-desc">{option.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
