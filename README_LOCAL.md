# 本地运行指南 (How to Run Locally)

## 方法 1: 使用 VS Code Live Server (最推荐)
如果你使用 VS Code:
1. 在扩展商店搜索并安装 **Live Server** 插件。
2. 右键点击 `index.html`，选择 **"Open with Live Server"**。
3. 浏览器会自动打开页面。

## 方法 2: 使用 Python (简单快捷)
如果你安装了 Python (Mac/Linux 通常预装，Windows 用户可能需要安装):
1. 打开终端 (Terminal/Command Prompt)。
2. 进入项目目录:
   ```bash
   cd "c:\Users\knightlyflash\Desktop\博士\可视化\Data_Visualization_Homework"
   ```
3. 运行以下命令启动服务:
   ```bash
   # Python 3
   python -m http.server 8000
   ```
4. 在浏览器打开: `http://localhost:8000`

## 常见问题
- **图片无法加载 (ERR_CERT_COMMON_NAME_INVALID)**:
  这通常是因为 `wwsdw.net` 的 HTTPS 证书无效。我们已经在代码中添加了自动代理 (images.weserv.nl) 来解决此问题。请确保你的浏览器缓存已清除 (Ctrl + Shift + R 强制刷新)。
