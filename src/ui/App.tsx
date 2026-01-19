import React from 'react';
import { HeroStatsPanel } from './panels/HeroStatsPanel';

/**
 * React UI 总入口
 * 职责：管理所有全屏遮罩面板（如侠客名鉴、城镇管理等）
 */
const App: React.FC = () => {
  return (
    <div className="react-app-container">
      {/* 侠客名鉴面板 */}
      <HeroStatsPanel />
      
      {/* 以后其他的面板（如城镇管理、招式图谱）会陆续添加到这里 */}
    </div>
  );
};

export default App;
