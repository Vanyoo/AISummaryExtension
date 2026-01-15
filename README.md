# AI Element Selector - 智能网页内容总结工具

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome](https://img.shields.io/badge/Chrome-88%2B-yellow.svg)
![Edge](https://img.shields.io/badge/Edge-88%2B-blue.svg)

**✨ 一键智能总结网页任意内容**

</div>

---

## 📖 简介

AI Element Selector 是一款强大的浏览器扩展，让你能够选择网页上的任意元素，AI 会实时生成智能总结并支持 Markdown 渲染。

### ✨ 核心特性

- 🎯 **智能元素选择** - 点击任意网页元素，自动提取文本内容
- 🤖 **AI 实时总结** - 流式输出，实时显示 AI 总结结果
- 📝 **Markdown 渲染** - 完整支持 Markdown 格式（标题、列表、代码块、表格等）
- 🌳 **Shadow DOM 支持** - 完美支持 Shadow DOM 内容提取
- 🎨 **可定制界面** - 拖拽移动、调整大小、固定位置
- ⌨️ **快捷键支持** - ESC 键快速关闭
- 💾 **持久化配置** - 配置自动保存，无需重复设置
- 🧠 **思考过程** - 支持查看 AI 思考过程（`<thinking>` 标签）

---

## 🚀 快速开始

### 安装方法

#### 方式一：从 Chrome Web Store 安装（即将上线）
> 等待上架 Chrome Web Store 后，直接搜索 "AI Element Selector" 安装

#### 方式二：开发者模式安装（当前版本）

1. **下载扩展文件**
   - 下载最新版本的 `AI-Element-Selector-v1.0.0.zip`
   - 解压到任意目录

2. **打开扩展管理页面**
   - Chrome: 访问 `chrome://extensions/`
   - Edge: 访问 `edge://extensions/`

3. **启用开发者模式**
   - 点击右上角的"开发者模式"开关

4. **加载扩展**
   - 点击"加载已解压的扩展程序"
   - 选择解压后的文件夹

5. **验证安装**
   - 浏览器工具栏会出现 AI 元素选择图标 ✅

### 首次配置

1. **点击扩展图标**，打开配置界面

2. **配置 AI API**
   - 选择 API 模式：
     - **Direct Mode**: 直连 OpenAI（需配置 API Key）
     - **Proxy Mode**: 通过代理服务器（需配置代理 URL）
     - **GM Bridge Mode**: 通过 GM Bridge 脚本（需配合 Tampermonkey）

3. **配置提示词**
   - 系统提示词：定义 AI 的角色和行为
   - 用户提示词：定义总结的格式和要求

4. **保存配置**
   - 点击"保存"按钮完成配置

---

## 📝 使用指南

### 基础使用

#### 1. 选择元素并总结

1. 打开任意网页
2. 点击扩展图标，选择"开始选择元素"
3. 点击网页上的任意元素（文章、段落、列表等）
4. 等待 AI 实时生成总结
5. 查看渲染后的 Markdown 结果

#### 2. 模态窗口操作

- **拖拽移动**: 按住标题栏拖拽
- **调整大小**: 拖拽四个角或边框
- **固定位置**: 点击"固定"按钮锁定当前位置
- **双击标题栏**: 最大化/恢复窗口
- **关闭**: 点击关闭按钮或按 ESC 键

#### 3. 查看思考过程

如果 AI 返回了 `<thinking>` 标签内容：
- 点击"显示思考过程"按钮
- 查看 AI 的推理过程
- 帮助理解总结生成的逻辑

### 高级功能

#### 配置选项

通过扩展的"选项"页面可以配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| API Mode | API 调用模式 | Direct |
| API Key | OpenAI API Key | - |
| API URL | API 端点 | https://api.openai.com/v1/chat/completions |
| Model | 使用的模型 | gpt-4o-mini |
| Max Tokens | 最大响应 Token 数 | 2000 |
| Temperature | 温度参数（0-2） | 0.7 |
| Streaming | 是否启用流式输出 | true |
| Markdown Enabled | 是否启用 Markdown 渲染 | true |
| System Prompt | 系统提示词 | 默认 |
| User Prompt | 用户提示词 | 默认 |

#### 快捷键

| 按键 | 功能 |
|------|------|
| ESC | 关闭模态窗口 / 退出选择模式 |

---

## 🔧 技术特性

### 技术栈

- **前端**: 原生 JavaScript + CSS3
- **Markdown 解析**: marked.js (轻量级、流式友好)
- **Chrome Extension API**: Manifest V3
- **存储**: Chrome Sync Storage

### 核心技术特性

#### 1. 流式输出优化

```javascript
// 使用 requestAnimationFrame 实现平滑渲染
function streamText(text) {
  const raf = requestAnimationFrame(() => {
    renderChunk(text);
  });
}
```

**优势**：
- 避免页面跳动
- 高效批量处理 DOM 更新
- 防止性能问题

#### 2. Shadow DOM 支持

```javascript
// 递归遍历 Shadow DOM
function getTextContent(node) {
  if (node.shadowRoot) {
    return node.shadowRoot.textContent;
  }
  // ...
}
```

#### 3. 防御性编程

- 全面的错误处理
- 降级方案（Markdown 渲染失败时显示纯文本）
- 内存泄漏防护

#### 4. CORS 解决方案

支持多种 API 调用模式绕过 CORS 限制：

1. **Direct Mode**: 直连 API（需浏览器支持）
2. **Proxy Mode**: 通过代理服务器转发
3. **GM Bridge Mode**: 通过 Tampermonkey 脚本转发

---

## 📦 文件结构

```
AI-summary/
├── manifest.json          # 扩展清单
├── background.js          # 后台脚本
├── content.js            # 内容脚本（核心逻辑）
├── content.css           # 内容样式
├── marked.min.js         # Markdown 解析库
├── icons/                # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── options/              # 选项页面
│   ├── options.html
│   └── options.js
├── popup/                # 弹出页面
│   ├── popup.html
│   └── popup.js
├── README.md             # 项目说明
├── CHANGELOG.md          # 更新日志
├── INSTALL.md            # 安装指南
└── TESTING.md            # 测试指南
```

---

## 🐛 常见问题

### Q1: 提示 "API Key 未配置"

**解决方法**：
1. 打开扩展的"选项"页面
2. 输入您的 OpenAI API Key
3. 点击保存

### Q2: Markdown 渲染失败，显示纯文本

**可能原因**：
1. marked.js 加载失败
2. Markdown 语法错误
3. 浏览器兼容性问题

**解决方法**：
- 检查控制台错误信息
- 确认 Markdown 语法是否正确
- 尝试禁用然后重新启用扩展

### Q3: 无法选择某些网页元素

**可能原因**：
- 元素使用 Shadow DOM
- 网站有反爬虫机制
- 跨域限制

**解决方法**：
- 尝试选择父元素
- 使用开发者模式绕过某些限制
- 联系开发者反馈

### Q4: 流式输出不流畅

**可能原因**：
- 网络延迟
- API 限流
- 浏览器性能问题

**解决方法**：
- 检查网络连接
- 降低 Max Tokens 设置
- 关闭其他标签页释放资源

### Q5: 扩展在其他浏览器无法使用

**支持情况**：
- ✅ Chrome 88+
- ✅ Edge 88+ (Chromium 内核)
- ✅ Brave 1.20+
- ✅ Opera 74+
- ⚠️ Firefox (部分支持)

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 如何贡献

1. **Fork** 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. **提交 Pull Request**

### 开发环境设置

```bash
# 克隆项目
git clone https://github.com/yourusername/AI-element-selector.git

# 进入项目目录
cd AI-element-selector

# 加载到浏览器（开发者模式）
# 然后就可以开始开发了

# 修改代码后，在 chrome://extensions 页面点击刷新按钮
```

### 代码规范

- 使用 ES6+ 语法
- 遵循 Prettier 代码风格
- 添加必要的注释
- 编写测试用例

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [marked.js](https://marked.js.org/) - 强大的 Markdown 解析库
- [OpenAI](https://openai.com/) - 提供 AI API 服务
- Chrome Extension 社区 - 提供的技术支持

---

## 📮 联系方式

- **Issue**: [提交问题](https://github.com/yourusername/AI-element-selector/issues)
- **Email**: support@example.com
- **Website**: https://example.com

---

## 🌟 Star History

如果这个项目对你有帮助，请给它一个 Star ⭐

<div align="center">

**Made with ❤️ by AI Element Selector Team**

</div>