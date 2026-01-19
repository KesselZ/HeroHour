/**
 * 开发模式诊断脚本
 * 用于确认当前是否在正确的开发模式下运行
 */

console.log('\n=== 开发环境诊断 ===\n');

// 检查环境变量
console.log('1. 环境检查:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || '未设置'}`);
console.log(`   DEV: ${import.meta.env.DEV ? '✅ 开发模式' : '❌ 生产模式'}`);
console.log(`   PROD: ${import.meta.env.PROD ? '⚠️ 生产模式' : '✅ 开发模式'}`);

// 检查 Vite 模式
console.log('\n2. Vite 模式:');
console.log(`   Mode: ${import.meta.env.MODE}`);
console.log(`   Base URL: ${import.meta.env.BASE_URL}`);

// 检查模块加载
console.log('\n3. 模块加载检查:');
try {
  const { modifierManager } = await import('../src/systems/ModifierManager.js');
  console.log('   ✅ modifierManager 加载成功');
  console.log(`   类型: ${typeof modifierManager}`);
} catch (e) {
  console.error('   ❌ modifierManager 加载失败:', e.message);
}

try {
  const { worldManager } = await import('../src/core/WorldManager.js');
  console.log('   ✅ worldManager 加载成功');
} catch (e) {
  console.error('   ❌ worldManager 加载失败:', e.message);
}

console.log('\n=== 诊断完成 ===\n');
console.log('如果看到任何 ❌ 标记，请检查：');
console.log('1. 是否正在运行 npm run dev');
console.log('2. 浏览器是否清除了缓存');
console.log('3. 是否在正确的端口访问（通常是 http://localhost:5173）\n');
