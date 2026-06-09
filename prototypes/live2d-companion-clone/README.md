# Live2D Companion Clone

基于 `pixi-live2d-display` 的 Live2D Creator Platform 静态 MVP 原型。

## 功能

- 创作者工作台：套餐、项目、模型、语音、标签、粉丝访问码
- 管理后台原型：手工订单、额度授予、项目暂停/恢复、声音克隆审核、审计日志
- 粉丝入口原型：访问码校验、浏览器设备绑定、消息额度扣减、错误态提示
- PixiJS + pixi-live2d-display 加载 Cubism 4 `model3.json`
- 聊天气泡、底部输入框、右侧快捷按钮、动作抽屉、设置面板
- 本地模拟 AI 回复，回复格式为 `【动作】文本`
- 支持配置 OpenAI-compatible Chat Completions 接口
- 根据动作标签触发表情参数
- Web Speech 演示语音播放，并用嘴型参数做可视化口型
- 可替换自己的 Live2D 模型地址

## 运行

在本目录运行任意静态服务器，例如：

```bash
python3 -m http.server 5177
```

然后打开：

```text
http://localhost:5177
```

不要直接双击 `index.html`，Live2D 模型和浏览器能力可能会被 `file://` 限制。

## 替换模型

打开页面右侧设置按钮，在“模型地址 model3.json”里填入你的模型地址，例如：

```text
https://example.com/model/your-character.model3.json
```

模型资源需要允许跨域访问，或者和页面部署在同一个域名下。

## 接入大模型

设置面板里可以填：

- OpenAI-compatible Endpoint
- API Key
- 模型名

注意：这只是本地演示。商业项目不要把 API Key 放前端，应改成后端代理接口。

## 访问码演示

1. 在“模型管理”勾选“管理员协助配置模型”，或上传 zip 让模型状态变为有效。
2. 点击“发布项目”。
3. 在右侧粉丝页输入种子访问码：

```text
YURI-2026
```

也可以在“粉丝访问码”页生成新批次，生成后的明文会一次性展示并可导出 CSV。

## 生产建议

- 用后端代理 LLM/TTS/ASR 请求
- 对用户做登录、激活码或付费鉴权
- Live2D 模型资源使用签名 URL 或服务端鉴权
- 语音克隆、模型素材、Live2D SDK/素材授权需要单独确认
- 部署到 Netlify/Vercel 时，语音输入需要 HTTPS
