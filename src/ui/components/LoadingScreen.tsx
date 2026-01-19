import React from 'react';
import { useGameStore } from '../../store/gameStore';

/**
 * 全局加载界面组件
 * 职责：显示资源预加载进度、转场动画以及游戏提示
 */
export const LoadingScreen: React.FC = () => {
  const { visible, progress, text, tip } = useGameStore(s => s.loading);

  if (!visible) return null;

  return (
    <div id="loading-screen" className="loading-screen">
      <div className="loading-content">
        <div className="loading-title">稻香村发展计划</div>
        <div className="loading-subtitle">正在准备江湖世界...</div>
        <div className="loading-progress">
          <div className="progress-bar-bg">
            <div 
              id="loading-progress-fill" 
              className="progress-bar-fill"
              style={{ width: `${progress}%`, transition: 'width 0.3s ease-out' }}
            ></div>
          </div>
          <div id="loading-text" className="loading-text">{text}</div>
        </div>
        <div className="loading-tip">{tip}</div>
      </div>
    </div>
  );
};
