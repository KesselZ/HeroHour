import React, { useEffect, useRef } from 'react';
import { useBattleStore } from '../../store/battleStore';
import { spriteFactory } from '../../engine/SpriteFactory';
import { audioManager } from '../../engine/AudioManager';

/**
 * 部署阶段的单位选择卡片
 */
const DeployUnitCard: React.FC<{
  type: string;
  count: number;
  deployed: number;
  isActive: boolean;
  onSelect: () => void;
}> = ({ type, count, deployed, isActive, onSelect }) => {
  const iconStyle = spriteFactory.getIconStyle(type) as React.CSSProperties;
  const remaining = count - deployed;
  const isAvailable = remaining > 0;

  return (
    <div 
      className={`unit-slot ${isActive ? 'active' : ''} ${!isAvailable ? 'disabled' : ''}`}
      onClick={isAvailable ? onSelect : undefined}
    >
      <div className="slot-icon" style={iconStyle}></div>
      <span className="slot-count">x{remaining}</span>
    </div>
  );
};

/**
 * 战斗阶段的技能按钮
 */
const BattleSkillButton: React.FC<{
  skill: any;
  currentMp: number;
  onClick: () => void;
}> = ({ skill, currentMp, onClick }) => {
  const iconStyle = spriteFactory.getIconStyle(skill.icon) as React.CSSProperties;
  const btnRef = useRef<HTMLDivElement>(null);
  const canAfford = currentMp >= skill.cost;
  const isReady = skill.isReady && canAfford;

  useEffect(() => {
    if (btnRef.current && window.uiManager) {
      window.uiManager.bindTooltip(btnRef.current, () => ({
        name: skill.name,
        level: skill.category,
        mpCost: `消耗: ${skill.cost} 内力`,
        cdText: `冷却: ${(skill.cooldown / 1000).toFixed(1)}s`,
        description: skill.description,
        type: 'skill',
        skillId: skill.id
      }));
    }
  }, [skill]);

  const cdProgress = skill.remainingCD > 0 ? (skill.remainingCD / skill.cooldown) * 100 : 0;

  return (
    <div 
      ref={btnRef}
      className={`skill-btn ${!isReady ? 'disabled' : ''} ${skill.remainingCD > 0 ? 'in-cooldown' : ''}`}
      onClick={isReady ? onClick : undefined}
    >
      <div className="skill-icon" style={{
        ...iconStyle,
        imageRendering: 'pixelated',
        width: '32px',
        height: '32px'
      }}></div>
      <div className="skill-cost">内:{skill.cost}</div>
      {skill.remainingCD > 0 && (
        <div className="cooldown-overlay" style={{ height: `${cdProgress}%` }}></div>
      )}
      <div className="skill-name-tag">{skill.name}</div>
    </div>
  );
};

/**
 * 战场核心 HUD (BattleHUD)
 * 职责：处理部署阶段的兵种选择、战斗阶段的技能释放与状态显示
 */
export const BattleHUD: React.FC = () => {
  const { 
    isActive, 
    isDeployment, 
    mp, 
    maxMp, 
    units, 
    skills, 
    selectedUnitType, 
    setSelectedUnitType 
  } = useBattleStore();

  if (!isActive) return null;

  const handleFightStart = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    window.dispatchEvent(new CustomEvent('battle-start-fight'));
  };

  const handleEscape = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    window.dispatchEvent(new CustomEvent('show-escape-confirm'));
  };

  const handleSkillClick = (skillId: string) => {
    window.dispatchEvent(new CustomEvent('battle-skill-click', { detail: { skillId } }));
  };

  // 部署阶段 UI
  if (isDeployment) {
    return (
      <div id="deployment-ui" className="deployment-container">
        <div className="deploy-info">请派遣你的侠客 (点击图标后点击地面)</div>
        <div className="unit-slots">
          {Object.values(units).map(unit => (
            <DeployUnitCard 
              key={unit.type}
              type={unit.type}
              count={unit.count}
              deployed={unit.deployed}
              isActive={selectedUnitType === unit.type}
              onSelect={() => {
                setSelectedUnitType(unit.type);
                // 同步给 JS 引擎
                // @ts-ignore
                if (window.battleScene) {
                  window.battleScene.selectedType = unit.type;
                  // @ts-ignore
                  window.battleScene.updatePreviewSprite(unit.type);
                }
              }}
            />
          ))}
        </div>
        <button className="wuxia-btn small-btn" onClick={handleFightStart}>开战！</button>
      </div>
    );
  }

  // 战斗阶段 UI
  const groupedSkills = skills.reduce((acc: any, skill) => {
    const cat = skill.category || '基础';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  const mpPct = (mp / maxMp) * 100;

  return (
    <div id="battle-bottom-ui" className="battle-bottom-ui autohide">
      <div id="battle-skill-bar" className="skill-bar-container">
        <div className="battle-mp-status">
          <div className="mp-bar-bg">
            <div className="mp-bar-fill" style={{ width: `${mpPct}%` }}></div>
          </div>
          <div className="mp-text">内力: {Math.floor(mp)}/{maxMp}</div>
        </div>
        
        <div className="skill-slots">
          {Object.entries(groupedSkills).map(([category, categorySkills]: [string, any]) => (
            <div key={category} className="skill-group-wrap">
              <div className="skill-group-header">{category}</div>
              <div className="skill-group-list">
                {categorySkills.map((skill: any) => (
                  <BattleSkillButton 
                    key={skill.id} 
                    skill={skill} 
                    currentMp={mp}
                    onClick={() => handleSkillClick(skill.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <button className="battle-escape-btn" title="撤退" onClick={handleEscape}>
        <span>逃</span>
      </button>
    </div>
  );
};
