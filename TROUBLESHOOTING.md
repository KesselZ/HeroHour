# 故障排查指南

## 问题：modifierManager is not defined

### 症状
- 错误信息：`Uncaught ReferenceError: modifierManager is not defined`
- 错误来自：`index-Ba0GSh2S.js:3771`（这是生产构建文件）

### 原因
浏览器缓存了旧的生产构建文件

### 解决步骤

#### 步骤 1：清除浏览器缓存
**Windows/Linux:**
- Chrome/Edge: 按 `Ctrl + Shift + Delete`，选择"缓存的图片和文件"，点击清除
- 或者按 `Ctrl + F5` 强制刷新

**Mac:**
- Chrome/Edge: 按 `Cmd + Shift + Delete`
- 或者按 `Cmd + Shift + R` 强制刷新

#### 步骤 2：确认开发服务器正在运行
```bash
# 停止当前服务器（如果在运行）
# 按 Ctrl+C

# 重新启动开发服务器
npm run dev
```

#### 步骤 3：在浏览器中打开开发者工具
1. 按 `F12` 打开开发者工具
2. 切换到 "Network"（网络）标签
3. 勾选 "Disable cache"（禁用缓存）
4. 刷新页面（F5）

#### 步骤 4：验证加载的文件
在 Network 标签中，查找加载的 JS 文件：
- ✅ 正确：应该看到类似 `src/main.js` 或 `src/index.tsx` 的文件
- ❌ 错误：如果看到 `index-Ba0GSh2S.js`，说明仍在使用缓存

#### 步骤 5：如果问题仍然存在
删除可能存在的构建文件：
```bash
# 删除 dist 目录（如果存在）
rmdir /s /q dist

# 清除 node_modules 缓存
npm cache clean --force

# 重新安装依赖
npm install

# 重新启动开发服务器
npm run dev
```

### 验证修复
打开浏览器控制台（F12），应该看到：
- 没有 `modifierManager is not defined` 错误
- 可以正常砍树并获得木材
- 游戏正常运行

### 预防措施
在开发时，始终保持浏览器开发者工具的 "Disable cache" 选项开启。
