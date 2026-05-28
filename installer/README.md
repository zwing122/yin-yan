# 银砚一键安装包

## 安装

在 PowerShell 中进入解压后的 `yin-yan` 目录，执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1
```

也可以使用安装向导。它会检查 SkillHub CLI、安装银砚本地包、准备 OpenClaw heartbeat workspace，并按参数决定是否安装 SkillHub 技能或创建 OpenClaw cron：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\setup-wizard.ps1
```

如果要同时安装 SkillHub 技能：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\setup-wizard.ps1 -InstallSkillHubSkill
```

如果已经确认 OpenClaw 频道和目标，并要创建固定时间汇总任务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\setup-wizard.ps1 -ConfigureOpenClawCron -Channel qq -To "group:123456"
```

默认安装到：

```text
%USERPROFILE%\.yin-yan
```

默认创建 5 个 Windows 计划任务：

- `YinYanReminder`：每天 21:00，提醒到期事项和待复核。
- `YinYanDailySummary`：每天 21:05，生成每日汇总。
- `YinYanCashflowSummary`：每天 21:08，生成现金流心跳。
- `YinYanWeeklySummary`：每周日 21:10，生成每周汇总。
- `YinYanMonthlySummary`：每天 21:15 检查一次，仅在每月 28 日生成本月汇总。

Windows 计划任务只会在本机生成输出和日志；如果要主动发到 QQ/Telegram/Slack/微信等 IM，应使用 OpenClaw/Hermes/QClaw 的 heartbeat/cron 和频道投递能力。

## 自定义时间

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1 -ReminderTime "20:30" -DailySummaryTime "20:35" -CashflowSummaryTime "20:38" -WeeklySummaryTime "20:40" -WeeklyDay Sunday -MonthlySummaryTime "20:45" -MonthlySummaryDay 28
```

只安装，不设置计划任务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1 -NoSchedule
```

## 手动记录

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run.ps1" "帮助"
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run.ps1" "今天午饭 38，微信付的"
```

也可以一次发送多条，每行一条：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run.ps1" "今天早餐 12，微信付的
今天午饭 38，支付宝付的
每月 15 号手机套餐 129"
```

## 手动触发心跳

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run-heartbeat.ps1" -Type reminder
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run-heartbeat.ps1" -Type daily-summary
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run-heartbeat.ps1" -Type weekly-summary
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run-heartbeat.ps1" -Type monthly-summary
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run-heartbeat.ps1" -Type cashflow-summary
```

今日、本周、本月汇总都会包含高频消费次数、高频消费金额和明日需支出。

## OpenClaw 主动发送

银砚本体不直接登录 IM，也不保存 IM token。OpenClaw Gateway 可以用 heartbeat/cron 主动调度银砚，再把脚本最终输出发送到已配置的聊天频道。

### OpenClaw heartbeat：轻量巡检

heartbeat 用于周期性检查“有没有事需要提醒”，没事返回 `HEARTBEAT_OK`。它不适合固定时间日报、周报、月报。

准备 OpenClaw heartbeat 工作区：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-heartbeat.ps1
```

这个脚本会复制 `HEARTBEAT.md` 到：

```text
%USERPROFILE%\.yin-yan\openclaw-workspace\HEARTBEAT.md
```

然后在 OpenClaw 中把 heartbeat 指向或运行在这个 workspace。需要立刻测试时，可以让 OpenClaw 触发一次 system event，或先用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-heartbeat.ps1 -RunNow
```

### OpenClaw cron：固定时间汇总

先打印 OpenClaw cron 命令模板：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-cron.ps1
```

确认 OpenClaw 的频道和目标后再创建任务，例如：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install-openclaw-cron.ps1 -Channel qq -To "group:123456" -Run
```

如果不确定 `-Channel` 或 `-To`，不要直接 `-Run`。OpenClaw 的 channel/to 写法以你的宿主配置为准。

## 本地网页复盘

安装后用浏览器打开：

```text
%USERPROFILE%\.yin-yan\web-review\index.html
```

选择本地 `ledger.json` 后生成本地复盘。网页只在浏览器本地解析，不上传账本。

如果浏览器支持 File System Access API（例如 Chromium 内核浏览器），可以点“授权文件”或“授权文件夹”：

- 第一次需要用户手动授权，浏览器不允许网页静默读取任意本地文件夹。
- 授权后页面会记住账本文件，下次打开时会尝试自动读取。
- 整理台修改会自动保存到浏览器缓存；授权写入权限后，可以点“保存回文件”，批量整理后也会尝试自动保存回原 JSON。
- 不支持该能力的浏览器仍可使用“选择 JSON”和“导出 JSON”。

当前网页端支持：

- 本地复盘：按记录最多月份、最近 30 天、今年或自定义时间段查看现金流、分类支出、消费类型占比、预算进度、高频消费、高频低值消费、同比、环比、未来支出和待复核。
- 统计表格：分类支出明细、高频低值消费、固定支出 / 未来支出。
- 视觉图表：时间段趋势、消费类型占比、玫瑰图、日历热力图、高频低值气泡图。
- 批量整理：多选待复核或未分类记录，批量修改分类，批量确认。
- 规则建议和 Firefly III 映射预览：参考来源 / 去向账户模型，辅助后续规则整理；当前不是完整 Firefly III 导出器。
- 本地保存：浏览器缓存自动保存最近账本；授权文件后可保存回原 JSON。
- 导出 JSON：导出整理后的账本文件，作为不支持文件授权时的兜底。

## 日志和账本

账本：

```text
%USERPROFILE%\.yin-yan\skills\yin-yan\data\ledger.json
```

计划任务输出日志：

```text
%USERPROFILE%\.yin-yan\logs\
```

## 验收

安装包自带轻量验收脚本。它只会在系统临时目录创建测试账本，不会写入你的真实账本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

安装后也可以运行安装目录里的验收脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\verify.ps1"
```

## 卸载

默认只删除计划任务，保留本地账本和安装目录：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\uninstall.ps1
```

只有明确要删除本地账本时，才使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\uninstall.ps1 -DeleteData
```

## 注意

- 安装包不会读取微信、支付宝、银行流水。
- 完整账本保存在本机。
- 计划任务只负责在本机生成提醒/汇总输出；真正主动发送到 IM 由 OpenClaw/QClaw/Hermes 的 heartbeat/cron 和 channel 负责。

## IM 噪音排查

如果聊天里出现“任务准备中”“调度完成”“前方还有 N 个请求”等内容，通常不是 yin-yan 脚本输出。优先检查 OpenClaw/QClaw/Hermes 宿主配置：

- 关闭或降低 preview/progress streaming。
- 隐藏 reasoning/思考过程消息。
- 检查模型中转站是否注入排队、算力调度或请求数提示。
- 对 yin-yan 只转发脚本最终 stdout，不转发工具调用前后的 agent 过程消息。
