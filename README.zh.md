# Tab Out

**一个让标签页混乱变得井然有序的新标签页。**

基于 [Zara Zhang](https://x.com/zarazhangrui) 的[原版 Tab Out](https://github.com/zarazhangrui/tab-out) 进行二次创作，新增了面向重度用户和设计师的功能。

> made with ♥ by [Zara Zhang](https://x.com/zarazhangrui) · [AI](https://anthropic.com/product/claude-code) · [Yuxuan Hou](https://x.com/yuxuan_o_o)

---

## 预览

<div align="center">
<video src="https://github.com/user-attachments/assets/16d00221-f83c-44ad-b1b2-1fd1bf5f7422" controls autoplay loop muted></video>
</div>

---

## 新增功能

### 1. 多窗口支持
所有 Chrome 窗口合并到同一个视图中。每个窗口独立分区展示，你随时知道每个标签页在哪里，再也不用在窗口之间反复切换找标签。

### 2. 列表视图 & 图片视图
两种浏览模式自由切换：
- **列表视图** — 简洁紧凑，快速扫描
- **图片视图** — 展示每个标签页的 OG 图片和截图，靠视觉辨认页面而不是读 URL。对浏览视觉灵感的设计师尤其实用。

### 3. 快捷链接
将常用网站固定为图标快捷方式，始终显示在顶部，一键直达。

### 4. AI 整理标签页
单纯按域名分组往往不够用 —— 一个设计师从 Dribbble、Pinterest、Behance 和各种博客收集灵感，需要更智能的分组方式。点击 **Organize with AI**，标签页会按内容语义重新分组，而不只是按网站归类。

支持 **Claude**、**OpenAI**、**Gemini** —— 粘贴 API key 即可，Tab Out 自动识别供应商。Key 存储在本地，不会离开你的浏览器。

### 5. 稍后再看
不想关掉但暂时不需要处理的标签页，可以保存到顶部专属的 **Saved** 区域，与当前打开的标签页分开展示。

### 6. 显示选项
自由定制 Tab Out 的外观：
- **布局** — 单列 / 双列
- **视图** — 列表 / 图片网格
- **风格** — 磨砂玻璃 / 纯色
- **模式** — 浅色 / 深色 / 自动（根据时间切换）
- **背景** — 纯色选色器 / 上传自定义壁纸

---

## 安装方法

1. 克隆或下载本仓库
2. 打开 Chrome → `chrome://extensions`
3. 开启右上角的**开发者模式**
4. 点击**加载已解压的扩展程序** → 选择 `extension/` 文件夹
5. 打开一个新标签页 ✨

---

## 技术栈

Chrome 扩展程序（Manifest V3）。无需构建步骤，无外部依赖，纯 HTML、CSS 和原生 JavaScript。

AI 调用直接从浏览器发送到各供应商的 API。你的 API key 存储在 `localStorage` 中，除了你选择的 AI 供应商之外，不会发送到任何地方。
