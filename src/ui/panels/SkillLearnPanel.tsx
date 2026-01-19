import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../store/uiStore';
import { SkillRegistry, SectSkills } from '../../data/SkillRegistry';
import { SECT_INTRO } from '../../data/HowToPlayContent';
import { spriteFactory } from '../../engine/SpriteFactory';
import { audioManager } from '../../engine/AudioManager';

declare global {
  interface Window {
    uiManager: any;
  }
}

/**
 * 招式项组件：负责单个招式的图标显示与 Tooltip 绑定
 */
const SkillItem: React.FC<{ skillId: string }> = ({ skillId }) => {
  const skill = SkillRegistry[skillId];
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (itemRef.current && skill && window.uiManager) {
      window.uiManager.bindTooltip(itemRef.current, () => {
        // 招式图谱中显示基础数值 (不计算英雄属性加成)
        return {
          name: skill.name,
          level: skill.level,
          mpCost: `消耗: ${skill.cost} 内力`,
          cdText: `冷却: ${(skill.cooldown / 1000).toFixed(1)}s`,
          description: skill.getDescription({ stats: { haste: 0 } }),
          type: 'skill'
        };
      });
    }
  }, [skillId, skill]);

  if (!skill) return null;

  const iconStyle = spriteFactory.getIconStyle(skill.icon) as React.CSSProperties;

  return (
    <div className="learn-item" ref={itemRef}>
      <div className="skill-learn-icon" style={iconStyle}></div>
      <div className="skill-learn-name">{skill.name}</div>
    </div>
  );
};

/**
 * 招式图谱面板 (SkillLearnPanel) - 已迁移至 React
 * 职责：展示全门派招式详情，提供分类筛选
 */
export const SkillLearnPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const [activeSect, setActiveSect] = useState<'chunyang' | 'tiance' | 'cangjian'>('chunyang');
  const isVisible = activePanel === 'skillLearn';

  const sects = [
    { id: 'chunyang', name: '纯阳招式' },
    { id: 'tiance', name: '天策招式' },
    { id: 'cangjian', name: '藏剑招式' }
  ] as const;

  const handleSectChange = (sectId: typeof activeSect) => {
    // @ts-ignore
    audioManager.play('ui_click');
    setActiveSect(sectId);
  };

  const handleClose = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
    // 恢复 HUD (移动端)
    if (window.uiManager?.isMobile) {
      window.uiManager.setHUDVisibility(true);
    }
  };

  if (!isVisible) return null;

  return (
    <div id="skill-learn-panel" className="menu-container standard-panel-v4">
      <div className="standard-panel-header">
        <div className="header-ornament-left"></div>
        <div className="panel-title">招式图谱</div>
        <div className="header-ornament-right"></div>
        <button className="close-btn-v3" onClick={handleClose}>×</button>
      </div>

      <div className="standard-panel-main">
        <div className="skill-learn-header-row">
          <div className="skill-learn-tabs">
            {sects.map(sect => (
              <button
                key={sect.id}
                className={`tab-btn ${activeSect === sect.id ? 'active' : ''}`}
                onClick={() => handleSectChange(sect.id)}
              >
                {sect.name}
              </button>
            ))}
          </div>
        </div>

        <div id="skill-list-to-learn" className="skill-grid-v3 panel-content-scroll">
          {/* 门派介绍卡片 */}
          <div className="sect-intro-card">
            <div className="sect-intro-desc">
              {(SECT_INTRO as any)[activeSect]}
            </div>
          </div>

          {/* 招式列表 */}
          {(SectSkills as any)[activeSect]?.map((skillId: string) => (
            <SkillItem key={skillId} skillId={skillId} />
          ))}
        </div>
      </div>
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
