# 一键本地启动 / One-click local launch

无需手动安装任何环境。脚本会自动准备 Node.js、依赖、本地数据库与演示角色，然后启动服务并打开浏览器。

## 使用

- **macOS**：双击 `start-mac.command`
  - 首次运行若提示「无法打开未验证的开发者」，右键 → 打开，或在「系统设置 → 隐私与安全性」中允许。
- **Windows**：双击 `start-windows.bat`

启动后浏览器会自动打开 `http://localhost:3000`。

- 保持弹出的终端/命令行窗口打开 = 服务运行中。
- 关闭该窗口（或按 Ctrl+C）= 停止服务。

## 登录账号（演示）

| 角色 | 用户名 | 密码 |
|---|---|---|
| 创作者 | `creator` | `ChangeMe123!` |
| 管理员 | `admin` | `ChangeMe123!` |

## 说明

- 数据库使用 PGlite（进程内文件数据库，数据存于 `./.pglite`），无需安装 Postgres/Docker。
- 文件存储写入本地 `./.local-storage`，无需 MinIO/S3。
- 首次运行会下载依赖（约 1–2 分钟）并初始化数据；之后启动很快。
- 需要联网：首次下载依赖、以及 Live2D 运行时（PIXI/Cubism，从 CDN 加载）。
- AI 对话需在「管理员 → 设置 → AI 供应商」里填入 API Key 后生效，否则使用本地兜底回复。

## 重新初始化

删除 `apps/web/.pglite` 目录后再次启动，会重新建库 + 重新载入演示角色。
