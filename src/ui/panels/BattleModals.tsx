import React from 'react';
import { useUIStore } from '../../store/uiStore';
import { audioManager } from '../../engine/AudioManager';

/**
 * 战斗相关的弹窗集合 (BattleModals) - 已迁移至 React
 */
export const BattleModals: React.FC = () => {
  const { activePanel, closePanel } = useUIStore();

  const handleEscapeConfirm = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    if (window.battleScene) {
      window.battleScene.confirmEscape();
    }
    closePanel();
  };

  const handleSkipConfirm = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    if (window.worldScene?.confirmSkipBattle) {
      window.worldScene.confirmSkipBattle();
    }
    closePanel();
  };

  const handleSkipCancel = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    if (window.worldScene?.cancelSkipBattle) {
      window.worldScene.cancelSkipBattle();
    }
    closePanel();
  };

  const handleCancel = () => {
    // @ts-ignore
    audioManager.play('ui_click');
    closePanel();
  };

  return (
    <>
      {/* 撤退确认弹窗 */}
      {activePanel === 'escapeConfirm' && (
        <div id="escape-confirm-modal" className="menu-overlay">
          <div className="menu-container confirm-container">
            <div className="menu-decoration-top">战场撤退</div>
            <h2 className="game-title">是否<span>撤离战场</span>？</h2>
            <p className="confirm-desc">撤退将导致本次战斗失败，且可能损失部分兵力。</p>
            <div className="menu-options horizontal">
              <button className="wuxia-btn" onClick={handleEscapeConfirm}>确认撤退</button>
              <button className="wuxia-btn secondary" onClick={handleCancel}>继续战斗</button>
            </div>
            <div className="menu-decoration-bottom"></div>
          </div>
        </div>
      )}

      {/* 战斗跳过 (碾压) 弹窗 */}
      {activePanel === 'skipBattle' && (
        <div id="skip-battle-modal" className="menu-overlay">
          <div className="menu-container confirm-container">
            <div className="menu-decoration-top">势不可挡</div>
            <h2 className="game-title">敌人<span>过于弱小</span></h2>
            <p className="confirm-desc">
              对手实力平平，是否直接席卷战场？<br />
              <span style={{ fontSize: '0.8em', color: '#aa8888' }}>(跳过战斗将直接获得胜利，但会损失少量低阶兵力)</span>
            </p>
            <div className="menu-options horizontal">
              <button className="wuxia-btn" onClick={handleSkipConfirm}>直接碾压</button>
              <button className="wuxia-btn secondary" onClick={handleSkipCancel}>常规战斗</button>
            </div>
            <div className="menu-decoration-bottom"></div>
          </div>
        </div>
      )}
    </>
  );
};
