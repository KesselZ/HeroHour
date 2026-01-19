import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    // 优化代码分割，确保核心模块不被拆分
    rollupOptions: {
      output: {
        manualChunks: {
          // 将核心游戏逻辑放在一个 chunk 中，避免循环依赖问题
          'game-core': [
            './src/systems/ModifierManager.js',
            './src/systems/TimeManager.js',
            './src/core/WorldManager.js',
            './src/core/HeroManager.js',
            './src/core/BuildingManager.js',
          ],
          // Three.js 单独打包
          'three-vendor': ['three'],
        },
      },
    },
  },
});
