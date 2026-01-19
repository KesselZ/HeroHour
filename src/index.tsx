import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';

// 1. 唤醒原有的原生 JS 逻辑 (Three.js 引擎)
import './main.js';

// 2. 初始化唯一的 React 根节点
// 所有的 UI 面板都将通过这个根节点，利用 Portal 挂载到 index.html 预留的各个槽位中
const uiRoot = document.getElementById('react-ui-root');
if (uiRoot) {
  const root = createRoot(uiRoot);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
