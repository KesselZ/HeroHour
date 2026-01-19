import React, { useEffect, useRef } from 'react';
import { useHeroStore } from '../../store/heroStore';
import { useUIStore } from '../../store/uiStore';
import { spriteFactory } from '../../engine/SpriteFactory';
import { uiManager } from '../../core/UIManager';
import { audioManager } from '../../engine/AudioManager';
import { SkillRegistry } from '../../data/SkillRegistry';
import { useModifiedValue } from '../../hooks/useModifiedValue';

declare global {
  interface Window {
    worldManager: any;
    uiManager: any;
    worldScene: any;
  }
}

/**
 * 侠客名鉴面板 - 子组件：属性盒子
 */
const AttributeBox: React.FC<{
  label: string;
  value: string | number;
  highlighted?: boolean;
  tooltipData?: any;
}> = ({ label, value, highlighted, tooltipData }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && tooltipData) {
      // 核心修复：显式传递函数或对象给 bindTooltip
      uiManager.bindTooltip(ref.current, tooltipData);
    }
  }, [tooltipData]);

  return (
    <div ref={ref} className={`attr-box ${highlighted ? 'highlighted' : ''}`} style={{ cursor: 'help' }}>
      <div className="attr-label">{label}</div>
      <div className="attr-val">{value}</div>
    </div>
  );
};

/**
 * 侠客名鉴面板 - 子组件：招式槽位
 */
const SkillSlot: React.FC<{ skillId: string; heroData: any }> = ({ skillId, heroData }) => {
  // @ts-ignore - SkillRegistry 使用字符串索引
  const skill = (SkillRegistry as any)[skillId];
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slotRef.current && skill) {
      uiManager.bindTooltip(slotRef.current, () => {
        const actualCD = (skill.getActualCooldown(heroData) / 1000).toFixed(1);
        const actualCost = skill.getActualManaCost(heroData);
        return {
          name: skill.name,
          level: skill.level,
          mpCost: `消耗: ${actualCost} 内力`,
          cdText: `冷却: ${actualCD}s`,
          description: skill.getDescription(heroData),
          type: 'skill'
        };
      });
    }
  }, [skillId, heroData, skill]);

  if (!skill) return null;

  const iconStyle = spriteFactory.getIconStyle(skill.icon) as React.CSSProperties;

  return (
    <div className="hero-skill-slot" ref={slotRef}>
      <div className="skill-icon-small" style={iconStyle}></div>
    </div>
  );
};

/**
 * 侠客名鉴面板 (HeroStatsPanel)
 * 职责：展示英雄详细属性、技能、进度，并提供奇穴入口
 */
export const HeroStatsPanel: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();
  const { hero } = useHeroStore();
  const { stats, talentPoints } = hero;

  // --- 响应式属性：使用 useModifiedValue 使数值随增益实时变动 ---
  // 修正：从 window 对象获取最新的英雄虚拟单位，确保属性计算准确
  const heroDummy = window.worldManager?.heroManager?.getPlayerHeroDummy() || { side: 'player', id: hero.id, type: hero.id, isHero: true };
  
  const reactiveMorale = useModifiedValue(heroDummy, 'morale', stats.morale);
  const reactiveLeadership = useModifiedValue(heroDummy, 'leadership', stats.leadership);
  const reactivePower = useModifiedValue(heroDummy, 'power', stats.power);
  const reactiveSpells = useModifiedValue(heroDummy, 'skill_power', stats.spells);
  const reactiveHaste = useModifiedValue(heroDummy, 'haste', stats.haste / 100);
  const reactiveSpeed = useModifiedValue(heroDummy, 'speed', stats.speed);

  const isVisible = activePanel === 'heroStats';

  useEffect(() => {
    if (isVisible) {
      // @ts-ignore
      audioManager.play('ui_click', { volume: 0.5 });
      if (uiManager.isMobile) uiManager.setHUDVisibility(false);
    } else if (uiManager.isMobile) {
      const townPanel = document.getElementById('town-management-panel');
      const talentPanel = document.getElementById('talent-panel');
      const skillPanel = document.getElementById('skill-learn-panel');
      if (
          (!townPanel || townPanel.classList.contains('hidden')) &&
          (!talentPanel || talentPanel.classList.contains('hidden')) &&
          (!skillPanel || skillPanel.classList.contains('hidden'))
      ) {
          uiManager.setHUDVisibility(true);
      }
    }
  }, [isVisible]);

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore
    audioManager.play('ui_click', { volume: 0.4 });
    closePanel();
  };

  const hpPercent = stats.hpMax > 0 ? (stats.hp / stats.hpMax) * 100 : 0;
  const mpPercent = stats.mpMax > 0 ? (stats.mp / stats.mpMax) * 100 : 0;
  const xpPercent = stats.xpMax > 0 ? (stats.xp / stats.xpMax) * 100 : 0;

  const bigPortraitStyle = spriteFactory.getIconStyle(hero.id) as React.CSSProperties;

  return (
    <div 
      id="hero-stats-panel" 
      className={`menu-container hero-panel-v4 ${isVisible ? '' : 'hidden'}`}
      style={{ 
        pointerEvents: isVisible ? 'auto' : 'none',
        zIndex: 1000 
      }}
    >
      <div className="hero-panel-header">
        <div className="header-ornament-left"></div>
        <div className="panel-title">侠客名鉴</div>
        <div className="header-ornament-right"></div>
        <button 
          id="close-hero-panel"
          className="close-btn-v3" 
          onClick={handleClose}
          style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        >
          ×
        </button>
      </div>

      <div className="hero-panel-main">
        <div className="hero-core-info">
          <div className="hero-avatar-area">
            <div className="hero-big-portrait" style={bigPortraitStyle}></div>
            <div className="hero-identity">
              <h2>{hero.name}</h2>
              <p className="char-title">{hero.title}</p>
              <div className="hero-level-tag">等级 <span>{stats.level}</span></div>
            </div>
          </div>

          <div className="hero-bars-area">
            <div className="stat-group-v3">
              <div className="bar-label">气血 (HP)</div>
              <div className="stat-bar-container">
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill hp" style={{ width: `${hpPercent}%` }}></div>
                </div>
                <span className="stat-value">{Math.floor(stats.hp)}/{stats.hpMax}</span>
              </div>
            </div>

            <div className="stat-group-v3">
              <div className="bar-label">内力 (MP)</div>
              <div className="stat-bar-container">
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill mp" style={{ width: `${mpPercent}%` }}></div>
                </div>
                <span className="stat-value">{Math.floor(stats.mp)}/{stats.mpMax}</span>
              </div>
            </div>

            <div className="stat-group-v3">
              <div className="bar-label">阅历 (XP)</div>
              <div className="stat-bar-container">
                <div className="stat-bar-bg">
                  <div className="stat-bar-fill xp" style={{ width: `${xpPercent}%` }}></div>
                </div>
                <span className="stat-value">{stats.xp}/{stats.xpMax}</span>
              </div>
            </div>

            <button className="talent-btn-v4" onClick={() => openPanel('talent')}>
              奇穴 {talentPoints > 0 && <span className="talent-badge">({talentPoints})</span>}
            </button>
          </div>
        </div>

        <div className="hero-attributes-section">
          <div className="attributes-header"><span>—— 基础潜能 ——</span></div>
          <div className="attributes-grid-v4">
            <AttributeBox 
              label="士气" 
              value={Math.floor(reactiveMorale)} 
              highlighted 
              tooltipData={{
                name: "士气",
                description: `统御三军，使帐下士兵的<span class="skill-term-highlight">攻击力</span>提升 <span class="skill-num-highlight">${Math.floor(reactiveMorale)}%</span>，<span class="skill-term-highlight">气血上限</span>提升 <span class="skill-num-highlight">${Math.floor(reactiveMorale)}%</span>。`
              }}
            />
            <AttributeBox 
              label="统御" 
              value={Math.floor(reactiveLeadership)} 
              highlighted 
              tooltipData={{
                name: "统御",
                description: `侠客带兵容量上限，每种兵力产生不同的占用点数。`
              }}
            />
            <AttributeBox 
              label={stats.primaryStatName || '力道'} 
              value={Math.floor(reactivePower)} 
              highlighted 
              tooltipData={() => {
                const identity = window.worldManager?.getHeroIdentity(hero.id);
                const atkScaling = identity?.combatBase?.atkScaling || 0.05;
                const hpScaling = identity?.combatBase?.hpScaling || 0;
                return {
                  name: stats.primaryStatName || '力道',
                  description: `修习内功外招，使侠客自身的<span class="skill-term-highlight">普通攻击</span>伤害提升 <span class="skill-num-highlight">${Math.floor(reactivePower * atkScaling * 100)}%</span>，并额外增加 <span class="skill-num-highlight">${Math.floor(reactivePower * hpScaling)}</span> 点<span class="skill-term-highlight">气血上限</span>。`
                };
              }}
            />
            <AttributeBox 
              label="功法" 
              value={Math.floor(reactiveSpells)} 
              highlighted 
              tooltipData={{
                name: "功法",
                description: `通过玄妙法门，使侠客的<span class="skill-term-highlight">招式威力</span>提升 <span class="skill-num-highlight">${Math.floor(reactiveSpells)}%</span>。`
              }}
            />
            <AttributeBox 
              label="调息" 
              value={`${Math.floor(reactiveHaste * 100)}%`} 
              highlighted 
              tooltipData={{
                name: "调息",
                description: `提升招式运转速度，使<span class="skill-term-highlight">冷却时间</span>与<span class="skill-term-highlight">内力消耗</span>降低 <span class="skill-num-highlight">${Math.floor(reactiveHaste * 100)}%</span>。`
              }}
            />
            <AttributeBox 
              label="轻功" 
              value={reactiveSpeed.toFixed(2)} 
              highlighted 
              tooltipData={{
                name: "轻功",
                description: `身轻如燕，提升侠客行走江湖与临阵对敌时的移动速度。`
              }}
            />
          </div>
        </div>

        <div className="hero-skills-section-v4">
          <div className="section-header-v4">
            <div className="label-with-icon">習得招式</div>
          </div>
          <div className="hero-skills-list-v4">
            {stats.skills.length > 0 ? (
              stats.skills.map(id => (
                <SkillSlot key={id} skillId={id} heroData={hero.stats} />
              ))
            ) : (
              <div className="empty-skills-hint">暂未感悟招式</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="menu-decoration-bottom"></div>
    </div>
  );
};
