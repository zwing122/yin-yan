# 银砚 Yin-Yan

> 本地优先的自然语言财务 skill pack。  
> A local-first personal finance skill pack for natural-language ledger capture.

[使用说明](./USAGE.md) · [安装包说明](./installer/README.md) · [Skill 入口](./skills/yin-yan/SKILL.md) · [Skill README](./skills/yin-yan/README.md) · [数据模型](./skills/yin-yan/references/DATA_MODEL.md) · [宿主接入](./skills/yin-yan/references/HOST_INTEGRATION.md)

## 简介

银砚面向 OpenClaw / Hermes / QClaw 等 agent 宿主。它把用户在 IM 或命令行里说出的日常财务事件整理为本地 `ledger.json`，并提供低打扰追问、预算提醒、现金流摘要、浏览器本地复盘和匿名测试报告。

它不是独立 App，不是完整 SaaS，也不是自动读取支付流水的工具。

## What is Yin-Yan?

Yin-Yan is a local-first personal finance skill pack for OpenClaw, Hermes, QClaw, and similar agent hosts. It turns natural-language finance notes into a local `ledger.json`, then produces lightweight reminders, cashflow summaries, budget reviews, and browser-local review output.

It is not a standalone app, not a full SaaS product, and not an automatic bank/payment-statement importer.

## 适合谁

- 想用聊天方式随手记账，但不想把完整账本上传到云端的人。
- 已经在使用 OpenClaw、Hermes、QClaw 或类似 agent 宿主的人。
- 想先用 7 天轻量测试验证个人财务复盘是否有价值的人。
- 想研究本地优先财务 agent / skill pack 结构的人。

不适合：

- 需要自动读取微信、支付宝、银行流水的人。
- 需要完整会计、报销、审批、发票和企业财务系统的人。
- 需要云端账号体系、多端同步和在线订阅计费的人。

## 核心能力

- 自然语言记账：例如 `今天午饭 38，微信付的`。
- 低打扰追问：只追问会影响记录质量的缺口，不自行补全用户没说的信息。
- 两级分类：例如 `餐饮 / 正餐`、`餐饮 / 咖啡`、`居住 / 房租`。
- 预算和笔数提醒：例如 `这个月外卖别超过 800`、`咖啡每天最多 2 笔`。
- 固定支出和未来付款：例如房租、手机套餐、信用卡还款。
- Heartbeat 摘要：日报、周报、月报、现金流心跳和到期提醒。
- 本地网页复盘：在浏览器本地导入 `ledger.json`，查看分类、趋势、预算和待复核项。
- 匿名测试报告：用于测试期反馈，不需要提交完整账本。

## 快速开始

需要 Node.js 18 或更高版本。

如果把本仓库作为独立项目使用，在仓库根目录执行：

```powershell
node scripts/run-command.mjs --text "帮助"
node scripts/run-command.mjs --text "今天午饭 38，微信付的"
node scripts/run-command.mjs --text "这个月外卖别超过 800"
node scripts/run-command.mjs --text "本周汇总"
node scripts/run-command.mjs --text "生成测试报告"
```

可安装 skill 包位于：

```text
skills/yin-yan/
```

宿主或命令行可直接调用：

```powershell
node skills/yin-yan/scripts/run-command.mjs --text "今天午饭 38，微信付的"
```

## Heartbeat / Cron

银砚本体不常驻登录 IM，也不保存 QQ、Telegram、微信等发送凭证。

正确边界是：

- OpenClaw / Hermes / QClaw 负责 IM 入口、频道投递、定时触发和失败重试。
- 银砚负责生成可直接发送的提醒或复盘文本。

常用 heartbeat：

```powershell
node skills/yin-yan/scripts/run-command.mjs --heartbeat reminder
node skills/yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node skills/yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
node skills/yin-yan/scripts/run-command.mjs --heartbeat monthly-summary
node skills/yin-yan/scripts/run-command.mjs --heartbeat cashflow-summary
```

## 数据边界

默认完整账本只保存在本地：

```text
data/ledger.json
```

银砚不会要求上传：

- 完整 `ledger.json`
- 微信、支付宝或银行原始账单
- 银行卡、身份证、手机号等身份信息
- 支付凭证截图
- IM 全量聊天记录

测试阶段只建议分享由命令生成的匿名摘要，或用户手动脱敏后的错误样例。

## Windows 一键安装包

安装脚本位于：

```text
installer/
```

在 PowerShell 中进入仓库目录后执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\install.ps1
```

默认安装到：

```text
%USERPROFILE%\.yin-yan
```

默认创建本机计划任务，用于生成提醒和汇总输出。计划任务只在本机生成结果；如果要主动发送到 IM，应使用 OpenClaw / Hermes / QClaw 的 heartbeat 或 cron 能力。

## 本地网页复盘

网页复盘器位于：

```text
web-review/index.html
```

直接用浏览器打开后选择本地 `ledger.json`。页面在浏览器本地解析数据，不上传账本。

支持能力包括：

- 现金流概览
- 分类支出和消费类型占比
- 预算进度
- 高频消费和高频低值消费
- 固定支出和未来支出
- 待复核项整理
- 批量改类目和批量确认
- 导出整理后的 JSON

## 验证

```powershell
node scripts/smoke-test.mjs
node scripts/web-review-test.mjs
node scripts/asset-tracking-test.mjs
```

skill 格式校验：

```powershell
$env:PYTHONUTF8='1'
python path\to\skill-creator\scripts\quick_validate.py skills\yin-yan
```

安装包验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

## 目录结构

```text
yin-yan/
├─ skills/yin-yan/        # 可安装 skill 包
├─ scripts/               # 开发侧命令和测试脚本
├─ schemas/               # ledger 和测试报告 schema
├─ samples/               # 示例账本和报告
├─ web-review/            # 浏览器本地复盘页面
├─ installer/             # Windows 安装和验收脚本
└─ data/                  # 本地运行数据目录，不建议提交真实数据
```

## 重要边界

- 不自动读取支付 App 或银行流水。
- 不执行支付、转账、催收或投资操作。
- 不把商户、店名、商品名沉淀为独立品牌画像，只作为分类线索。
- 不根据少量消费记录判断人格、冲动购物或心理状态。
- 不把 IM 中间过程、模型思考过程或宿主调度提示转发给用户。

## License

当前 skill 元数据标记为 `UNLICENSED`，`package.json` 仍为 `private: true`。如果要公开开源发布，请先补充明确的 `LICENSE` 文件，并同步更新 package 元数据。

