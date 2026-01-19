import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { audioManager } from '../../engine/AudioManager';
import { spriteFactory } from '../../engine/SpriteFactory';

interface HeroOption {
  id: string;
  name: string;
  title: string;
  traitName: string;
  traitDesc: string;
  portraitClass: string;
}

const HEROES: HeroOption[] = [
  {
    id: 'liwangsheng',
    name: '李忘生',
    title: '纯阳掌门',
    traitName: '门派领袖',
    traitDesc: '纯阳弟子血量和伤害提高 20%',
    portraitClass: 'liwangsheng-portrait'
  },
  {
    id: 'lichengen',
    name: '李承恩',
    title: '天策府统领',
    traitName: '骁勇善战',
    traitDesc: '大世界移动速度提高 20%，天策兵种血量提高 10%',
    portraitClass: 'lichengen-portrait'
  },
  {
    id: 'yeying',
    name: '叶英',
    title: '藏剑大庄主',
    traitName: '心剑合一',
    traitDesc: '藏剑弟子攻击频率提高 20%',
    portraitClass: 'yeying-portrait'
  }
];

interface DifficultyOption {
  id: string;
  name: string;
  title: string;
  icon: string;
  desc: string;
}

const DIFFICULTIES: DifficultyOption[] = [
  { id: 'easy', name: '简单', title: 'EASY', icon: '🍃', desc: '敌军成长较慢。' },
  { id: 'hard', name: '困难', title: 'HARD', icon: '🔥', desc: '敌军成长迅速。' },
  { id: 'hell', name: '地狱', title: 'HELL', icon: '🩸', desc: '敌军实力突飞猛进！' }
];

export const GameStartFlow: React.FC = () => {
  const { activePanel, openPanel, closePanel } = useUIStore();
  const [step, setStep] = useState<'menu' | 'charSelect' | 'difficultySelect'>('menu');
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);
  const [selectedDiffId, setSelectedDiffId] = useState<string>('easy');

  // 当 activePanel 变为 mainMenu 时，重置内部步骤
  useEffect(() => {
    if (activePanel === 'mainMenu') {
      setStep('menu');
    }
  }, [activePanel]);

  if (activePanel !== 'mainMenu' && activePanel !== 'characterSelect' && activePanel !== 'difficultySelect') {
    return null;
  }

  const handleStartClick = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    setStep('charSelect');
    openPanel('characterSelect');
  };

  const handleLoadClick = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    openPanel('loadSave');
  };

  const handleHowToPlayClick = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    openPanel('howToPlay');
  };

  const handleSkillLearnClick = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    openPanel('skillLearn');
  };

  const handleExitClick = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    // 在 Electron 环境下通常会 window.close()，这里简单提示
    alert('请直接关闭浏览器窗口以退出。');
  };

  const handleHeroSelect = (id: string) => {
    // @ts-ignore
    audioManager.play('ui_click');
    setSelectedHeroId(id);
  };

  const handleConfirmHero = () => {
    if (!selectedHeroId) return;
    // @ts-ignore
    audioManager.play('ui_click');
    setStep('difficultySelect');
    openPanel('difficultySelect');
  };

  const handleBackToMenu = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    setStep('menu');
    setSelectedHeroId(null);
    openPanel('mainMenu');
  };

  const handleDiffSelect = (id: string) => {
    // @ts-ignore
    audioManager.play('ui_click');
    setSelectedDiffId(id);
  };

  const handleBackToChar = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    setStep('charSelect');
    openPanel('characterSelect');
  };

  const handleConfirmDiff = () => {
    if (!selectedHeroId) return;
    // @ts-ignore
    audioManager.play('ui_click');
    
    // 派发全局事件通知引擎开始游戏
    window.dispatchEvent(new CustomEvent('request-game-start', {
      detail: {
        heroId: selectedHeroId,
        difficulty: selectedDiffId
      }
    }));
    
    closePanel();
  };

  return (
    <>
      <div id="menu-background" className={`menu-bg ${activePanel ? '' : 'hidden'}`}></div>
      
      {/* 1. 主菜单 */}
      {activePanel === 'mainMenu' && (
        <div id="main-menu" className="menu-container">
          <div className="menu-decoration-top"></div>
          <h1 className="game-title">稻香村<span>发展计划</span></h1>
          <div className="menu-options">
            <button className="wuxia-btn" onClick={handleStartClick}>闯荡江湖</button>
            <button className="wuxia-btn" onClick={handleLoadClick}>加载存档</button>
            <button className="wuxia-btn" onClick={handleHowToPlayClick}>江湖指南</button>
            <button className="wuxia-btn" onClick={handleSkillLearnClick}>招式图谱</button>
            <button className="wuxia-btn" onClick={handleExitClick}>退出游戏</button>
          </div>
          <div className="menu-decoration-bottom"></div>
        </div>
      )}

      {/* 2. 角色选择 */}
      {activePanel === 'characterSelect' && (
        <div id="character-select" className="menu-container">
          <div className="menu-decoration-top"></div>
          <h2 className="game-title select-title">选择<span>你的侠客</span></h2>
          <div className="character-cards">
            {HEROES.map(hero => {
              const iconStyle = spriteFactory.getIconStyle(hero.id) as React.CSSProperties;
              return (
                <div 
                  key={hero.id}
                  className={`char-card hero-card ${selectedHeroId === hero.id ? 'selected' : ''}`}
                  onClick={() => handleHeroSelect(hero.id)}
                >
                  <div className={`char-portrait`} style={iconStyle}></div>
                  <h3 className="char-name">{hero.name}</h3>
                  <p className="char-title">{hero.title}</p>
                  <div className="char-traits">
                    <div className="trait">
                      <span className="trait-tag">{hero.traitName}</span>
                      <span className="trait-desc">{hero.traitDesc}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="menu-options">
            <button 
              className={`wuxia-btn ${!selectedHeroId ? 'disabled' : ''}`} 
              disabled={!selectedHeroId}
              onClick={handleConfirmHero}
            >
              确定身份
            </button>
            <button className="wuxia-btn small-btn" onClick={handleBackToMenu}>返回主页</button>
          </div>
          <div className="menu-decoration-bottom"></div>
        </div>
      )}

      {/* 3. 难度选择 */}
      {activePanel === 'difficultySelect' && (
        <div id="difficulty-select" className="menu-container">
          <div className="menu-decoration-top"></div>
          <h2 className="game-title select-title">选择<span>江湖难度</span></h2>
          <div className="character-cards difficulty-cards">
            {DIFFICULTIES.map(diff => (
              <div 
                key={diff.id}
                className={`char-card diff-card ${selectedDiffId === diff.id ? 'selected' : ''}`}
                onClick={() => handleDiffSelect(diff.id)}
              >
                <div className="diff-icon" style={{ fontSize: '3em', margin: '10px 0' }}>{diff.icon}</div>
                <h3 className="char-name">{diff.name}</h3>
                <p className="char-title">{diff.title}</p>
                <div className="char-traits">
                  <div className="trait">
                    <span className="trait-desc">{diff.desc}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="menu-options">
            <button className="wuxia-btn" onClick={handleConfirmDiff}>踏入江湖</button>
            <button className="wuxia-btn small-btn" onClick={handleBackToChar}>重选侠客</button>
          </div>
          <div className="menu-decoration-bottom"></div>
        </div>
      )}
    </>
  );
};
