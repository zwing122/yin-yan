# 宿主接入

## 产品形态

银砚是 OpenClaw/Hermes/QClaw 可调用的本地 skill pack，不是独立 SaaS，也不是强账号体系 App。

宿主负责：

- IM 或聊天入口。
- 定时触发 heartbeat/cron，并把结果投递到 IM。
- 权限和文件路径配置。
- 把用户输入转交给 skill。

银砚负责：

- 自然语言记账。
- 本地账本读写。
- 预算和提醒。
- 本地浏览器审查页。
- 匿名测试报告。

## 主动提醒边界

银砚本体是 skill 和本地脚本，不常驻登录 IM，也不持有 QQ/Telegram/微信等发送凭证。

但在 OpenClaw 里，OpenClaw Gateway 可以用 heartbeat 或 cron 主动唤醒 agent。agent 调用银砚的 heartbeat 入口后，OpenClaw 再把最终输出发送到已配置的聊天频道。

因此正确表述是：

- 银砚本体不直接主动发 IM。
- OpenClaw/Hermes/QClaw 可以主动调度银砚。
- IM 发送、频道路由、失败重试和权限由宿主负责。
- 银砚只负责生成可直接发送的提醒/复盘文本。

## 命令入口

自然语言输入：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "午饭花了25"
```

heartbeat：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat reminder
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat monthly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat cashflow-summary
```

安装包还提供 OpenClaw cron 模板：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-cron.ps1
```

确认频道后可创建 OpenClaw 原生定时任务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-cron.ps1 -Channel qq -To "group:123456" -Run
```

如果不确定 channel/to，先只打印命令，不要直接 `-Run`。

OpenClaw heartbeat 用于轻量巡检，不用于固定时间日报。安装包提供 `HEARTBEAT.md` 和 heartbeat 工作区准备脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-heartbeat.ps1
```

heartbeat 规则：

- 周期性调用 `run-heartbeat.ps1 -Type reminder`。
- 没事输出 `HEARTBEAT_OK`。
- 有到期事项、待复核、大额消费复核、预算或现金流风险时才发送提醒。
- 固定时间日报、周报、月报继续使用 OpenClaw cron。

## IM 体验

IM 回复应短、稳、低压力。

适合：

- 记录确认。
- 缺口提示。
- 到期提醒。
- 今日/本周摘要。
- 审查入口提示。

不适合：

- 大段表格。
- 一次性追问多个低风险字段。
- 把统计解释成用户过错。

## 浏览器本地审查

浏览器审查页用于处理 IM 不适合承载的密集任务：

- 批量确认。
- 批量改类目。
- 重复项检查。
- 预算和现金流图表。
- 本地 JSON 导入/选择。

默认本地解析 JSON，不上传服务器。

## Windows 注意事项

PowerShell 可能出现 profile 执行策略噪声。验证脚本时可使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

中文显示乱码不等于文件损坏；以 `quick_validate.py` 和 Node 测试结果为准。
