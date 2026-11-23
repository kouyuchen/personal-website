# personal-website

一个极简个人网站：白底黑字、一句话居中，手机与电脑自适应。

- **访问地址**：https://personal-website-d3e2bi65f7a84f7-1301197628.tcloudbaseapp.com
- **技术栈**：Vite + React + TypeScript
- **托管**：腾讯云 CloudBase 静态网站托管（个人版，地域 ap-shanghai，环境 ID `personal-website-d3e2bi65f7a84f7`）
- **域名**：使用 CloudBase 默认域名，未绑定自定义域名，不需要 ICP 备案
- 无后端、无数据库、无登录、无统计脚本

## 修改网站文字

编辑 [`src/content.ts`](./src/content.ts) 中的 `siteText`，改成想显示的内容，然后重新构建并部署：

```bash
pnpm build
tcb hosting deploy ./dist -e personal-website-d3e2bi65f7a84f7 --verify --entry index.html
```

## 本地开发

```bash
pnpm install
pnpm dev        # 本地开发预览
pnpm build      # 构建到 dist/
pnpm preview    # 预览构建产物
```

## 目录结构

```
index.html        页面骨架（标题、viewport、浅色模式）
src/main.tsx      React 入口
src/App.tsx       页面组件
src/content.ts    网站文字（改这里）
src/styles.css    白底黑字、居中的样式
```

## 部署说明

- 构建产物在 `dist/`，部署命令见上方。
- 首次部署由 CloudBase CLI 完成，CLI 已登录的本机可直接执行。
- 默认域名受 CloudBase 平台策略限制：在浏览器中直接打开网址（或从外部链接进入）时，会先显示腾讯云的「页面访问提示」，等待约 3 秒后点「确定访问」即可进入网站。该提示页是平台对未备案默认域名的强制安全提醒，无法在不绑定已备案自定义域名的情况下移除。
- 默认域名适合个人测试/小流量使用，不建议对外大规模分发。

## 变更记录

- 2026-11-23 初始化项目并首次部署。
- 2026-11-23 补充仓库与部署信息。
