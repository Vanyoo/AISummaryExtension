# 安装指南 - AI Element Selector

本指南将帮助你详细安装和配置 AI Element Selector 扩展。

---

## 📋 系统要求

### 浏览器版本

| 浏览器 | 最低版本 | 推荐版本 |
|--------|---------|---------|
| Chrome | 88+ | 120+ |
| Edge | 88+ (Chromium) | 120+ |
| Brave | 1.20+ | 最新版 |
| Opera | 74+ | 最新版 |
| Safari | ❌ 不支持 | - |
| Firefox | ⚠️ 实验性支持 | - |

### 其他要求

- 稳定的网络连接（用于 AI API 调用）
- OpenAI API Key 或其他兼容的 API 服务
- 基本的浏览器扩展操作经验

---

## 📥 下载扩展

### 方式一：下载预打包版本（推荐）

1. **访问发布页面**
   - 访问 [GitHub Releases](https://github.com/yourusername/AI-element-selector/releases)
   - 下载最新版本 `AI-Element-Selector-v1.0.0.zip`

2. **解压文件**
   ```bash
   # Windows
   # 右键 zip 文件 -> 解压到当前文件夹

   # macOS / Linux
   unzip AI-Element-Selector-v1.0.0.zip
   ```

### 方式二：从源码构建（开发者）

```bash
# 克隆仓库
git clone https://github.com/yourusername/AI-element-selector.git
cd AI-element-selector

# 确保所有文件都在正确的位置
ls -la  # 应该看到 manifest.json, content.js 等文件
```

---

## 🔨 安装步骤

### Chrome / Edge 安装

#### Step 1: 打开扩展管理页面

**Chrome:**
```
在地址栏输入: chrome://extensions/
或者: 菜单 -> 更多工具 -> 扩展程序
```

**Edge:**
```
在地址栏输入: edge://extensions/
或者: 菜单 -> 扩展
```

#### Step 2: 启用开发者模式

![启用开发者模式](https://example.com/dev-mode.png)

1. 找到右上角的"开发者模式"开关
2. 点击开关使其变为蓝色（启用状态）

#### Step 3: 加载扩展

![加载扩展](https://example.com/load-extension.png)

1. 点击"加载已解压的扩展程序"按钮
2. 在文件选择器中，选择解压后的扩展文件夹
3. 点击"选择文件夹"

#### Step 4: 验证安装

成功安装后，你应该看到：
- ✅ 扩展列表中出现 "AI Element Selector"
- ✅ 浏览器工具栏出现扩展图标（拼图图标）
- ✅ 没有错误提示

---

## ⚙️ 初始配置

### 配置向导

#### 1. 打开配置页面

**方法一：右键扩展图标**
- 右键点击浏览器工具栏的扩展图标
- 选择"选项"或"Options"

**方法二：通过扩展管理页面**
- 访问 `chrome://extensions/`
- 找到 "AI Element Selector"
- 点击"详细信息"
- 点击"扩展程序选项"

#### 2. 配置 API 模式

根据你的情况选择合适的 API 模式：

##### 模式一：Direct Mode（推荐 - 最简单）

**适用场景**：
- 你有 OpenAI API Key
- 能够直接访问 OpenAI API（无 CORS 限制）

**配置步骤**：
1. **API Mode** 选择 `Direct`
2. **API URL** 填写：
   ```
   https://api.openai.com/v1/chat/completions
   ```
3. **API Key** 填写你的 OpenAI API Key
4. **Model** 选择或填写：
   ```
   gpt-4o-mini  # 最便宜且性能好
   或 gpt-4o    # 更强大但贵
   ```
5. 点击"测试连接"验证配置

##### 模式二：Proxy Mode（推荐 - 更稳定）

**适用场景**：
- 无法直接访问 OpenAI API
- 遇到 CORS 跨域问题
- 需要通过代理转发请求

**配置步骤**：
1. **API Mode** 选择 `Proxy`
2. **Proxy URL** 填写代理服务器地址：
   ```
   https://your-proxy-server.com/api/proxy
   ```
3. **API Key** 填写你的 API Key
4. 点击"测试连接"验证配置

**注意**：你需要部署一个代理服务器或使用第三方代理服务。

##### 模式三：GM Bridge Mode（高级）

**适用场景**：
- 使用 Tampermonkey 或其他用户脚本管理器
- 需要通过脚本绕过浏览器限制

**配置步骤**：
1. 安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 安装 GM Bridge 脚本
3. **API Mode** 选择 `GM Bridge`
4. 配置 GM Bridge 相关参数

#### 3. 配置提示词

##### 系统提示词（System Prompt）

这是定义 AI 角色的提示词，决定了 AI 的行为方式。

**示例（默认）**：
```
你是一个专业的内容总结助手，请对用户提供的网页内容进行简洁明了的总结。
```

**自定义建议**：
- 如果用于技术文档，可以指定：
  ```
  你是一个技术文档专家，请以结构化的方式总结技术内容。
  ```
- 如果用于新闻文章，可以指定：
  ```
  你是一个新闻分析专家，请提取关键信息并客观总结。

```

##### 用户提示词（User Prompt）

这是定义总结格式的要求。

**示例（默认）**：
```
请用 Markdown 格式总结以下内容，包括：
1. 核心观点
2. 关键细节
3. 重要数据
\n\n内容：\n{content}
```

#### 4. 高级配置（可选）

| 配置项 | 说明 | 推荐值 |
|--------|------|--------|
| Temperature | 创造性程度（0-2） | 0.7 |
| Max Tokens | 最大响应长度 | 2000 |
| Timeout | 请求超时时间（秒） | 60 |
| Retry Count | 失败重试次数 | 3 |

#### 5. 保存配置

1. 点击"保存"按钮
2. 等几秒钟
3. 看到"配置已保存"提示即成功

---

## ✅ 验证安装

### 功能测试清单

完成以下测试确保扩展正常工作：

- [ ] **图标显示**：浏览器工具栏显示扩展图标
- [ ] **配置保存**：配置能够正常保存和加载
- [ ] **API 连接**：点击"测试连接"显示成功
- [ ] **元素选择**：点击"开始选择元素"进入选择模式
- [ ] **内容提取**：点击网页元素能正确提取文本
- [ ] **AI 总结**：能收到 AI 的总结响应
- [ ] **Markdown 渲染**：Markdown 格式正确显示
- [ ] **流式输出**：内容流式加载不卡顿
- [ ] **关闭功能**：ESC 键能关闭窗口

### 浏览控制台

检查是否有错误信息：

1. 按 `F12` 打开开发者工具
2. 切换到 **Console** 标签
3. 查看是否有红色错误信息

**正常情况**：
- 应该看到 `[AI Selector Content]` 的日志信息
- 不应该有未捕获的错误

### 测试示例

**简单测试**：
1. 访问任意新闻网站
2. 点击扩展图标 -> "开始选择元素"
3. 点击文章标题或正文
4. 等待 AI 总结生成
5. 验证结果是否准确

**复杂测试**：
1. 访问技术文档页面（如 MDN）
2. 选择包含代码块的文档
3. 验证 Markdown 渲染是否正确
4. 验证代码块语法高亮

---

## 🐛 常见安装问题

### 问题 1: 加载扩展失败

**错误信息**：
```
扩展程序未通过验证
```

**解决方法**：
1. 确认解压后的文件夹结构完整
2. 检查 `manifest.json` 文件是否存在
3. 尝试重新解压 zip 文件

### 问题 2: 扩展图标不显示

**可能原因**：
- 扩展被暂时隐藏
- 图标文件缺失

**解决方法**：
1. 点击浏览器工具栏的拼图图标（扩展程序）
2. 找到 "AI Element Selector"
3. 点击图钉图标固定到工具栏

### 问题 3: 配置无法保存

**错误信息**：
```
Chrome storage 同步失败
```

**解决方法**：
1. 检查是否已登录 Chrome 账号
2. 确保网络连接正常
3. 尝试退出重新登录 Chrome

### 问题 4: API 连接失败

**错误信息**：
```
Failed to fetch
```

**解决方法**：
1. 检查 API Key 是否正确
2. 确认 API URL 格式正确
3. 尝试切换到 Proxy Mode
4. 检查网络连接和防火墙设置

### 问题 5: CORS 错误

**错误信息**：
```
CORS policy: No 'Access-Control-Allow-Origin' header
```

**解决方法**：
1. 切换到 **Proxy Mode**
2. 或者使用 **GM Bridge Mode**
3. 配置代理服务器来处理 CORS

---

## 🔄 卸载重装

### 卸载扩展

1. 访问 `chrome://extensions/`
2. 找到 "AI Element Selector"
3. 点击"移除"按钮
4. 确认删除

### 完全清理

如果遇到问题需要完全清理：

```bash
# 删除扩展配置（可选）
# 这会清除所有保存的配置和 API Key

# 1. 访问 chrome://settings/content/siteDetails?site=chrome-extension%3A%2F%2Fyour-extension-id
# 2. 清除所有数据
```

### 重新安装

重新按照上面的安装步骤进行即可。

---

## 📞 获取帮助

如果安装过程中遇到问题：

1. 查看 [常见问题](README.md#常见问题)
2. 在 [GitHub Issues](https://github.com/yourusername/AI-element-selector/issues) 提交问题
3. 加入社区讨论
4. 联系技术支持

---

<div align="center">

**安装完成后，你可以开始使用 AI Element Selector 了！🎉**

[返回安装步骤](#安装步骤) | [查看使用指南](README.md#使用指南)

</div>