# 银砚 Skill

OpenClaw / Hermes / QClaw 可调用的本地优先个人财务 skill。

银砚通过自然语言记录支出、收入、转账、还款、退款、报销、固定支出、未来付款、余额、预算目标和每日笔数限制，并把数据写入本地 `ledger.json`。它还提供 heartbeat 摘要、待复核整理、匿名测试报告和浏览器本地复盘入口。

## 一句话

把“今天午饭 38，微信付的”这类聊天输入，整理成可复盘、可审查、默认留在本地的个人财务记录。

## 安装位置

把本目录作为 skill 包安装或复制到宿主的 skills 目录：

```text
yin-yan/skills/yin-yan/
```

入口文件：

```text
SKILL.md
```

命令脚本：

```text
scripts/run-command.mjs
```

## 快速试用

需要 Node.js 18 或更高版本。

从仓库根目录调用：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "帮助"
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "今天午饭 38，微信付的"
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "下周三还信用卡 3200，招商卡"
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "这个月外卖别超过 800"
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "现金流心跳"
```

也可以一次发送多行：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "今天早餐 12，微信付的
今天午饭 38，支付宝付的
每月 15 号手机套餐 129"
```

## Heartbeat

宿主可定时调用：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat reminder
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat monthly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat cashflow-summary
```

边界：

- 银砚只生成提醒和复盘文本。
- IM 发送、频道路由、cron、失败重试和权限由宿主负责。
- 没有需要提醒的 heartbeat 可以返回 `HEARTBEAT_OK`。

## 数据边界

完整账本默认保存在本地：

```text
data/ledger.json
```

不要上传或回收用户完整账本、原始支付流水、支付截图、身份证件、银行卡号、手机号或全量聊天记录。

测试反馈建议只使用：

- `/测试报告` 生成的匿名摘要
- 用户手动脱敏后的 `/分享错误` 样例

## 行为规则

- 先记录用户明确说出的事实。
- 支付方式、账户、地点、日期等缺失信息不能自行补全。
- 商户词只作为分类线索，不沉淀为 `brand` 或 `merchant` 维度。
- 大额消费只做可追踪候选和再次提及间隔，不判断冲动购物。
- IM 回复保持短、清楚、低压力。

## 常见输入

```text
今天午饭 38，微信付的
收到工资 12000
下周三还信用卡 3200，招商卡
每月 5 号房租 2500
这个月外卖别超过 800
咖啡每天最多2笔
微信余额 200
看看待复核
今天花了多少
本周汇总
现金流心跳
生成测试报告
分享错误
```

## 模块索引

- `references/COMMANDS.md`：自然语言命令、斜杠命令、批量输入和快捷入口。
- `references/RECORDING_RULES.md`：记录规则、低打扰追问、禁止自主补全。
- `references/CATEGORY_TAXONOMY.md`：两级类目、商户词线索和兼容字段。
- `references/BUDGETS.md`：预算设置、每日笔数和预算提醒。
- `references/PROFILE_AND_REVIEW.md`：用户画像、审查优先级和可沉淀信息边界。
- `references/HEARTBEAT_TEMPLATES.md`：reminder、daily、weekly、monthly、cashflow 输出模板。
- `references/DATA_MODEL.md`：`ledger.json` 结构、事件字段、兼容和迁移边界。
- `references/DATA_BOUNDARY.md`：本地数据、隐私、备份和匿名测试报告。
- `references/HOST_INTEGRATION.md`：OpenClaw / Hermes / QClaw / IM / cron 接入方式。
- `references/PRODUCT_FORM.md`：产品形态、MVP 边界和非目标。
- `references/TESTING.md`：验证命令、包验证和失败处理。

## 验证

从仓库根目录执行：

```powershell
node yin-yan/scripts/smoke-test.mjs
$env:PYTHONUTF8='1'; python path\to\skill-creator\scripts\quick_validate.py yin-yan\skills\yin-yan
```

只验证本目录时：

```powershell
npm run verify:local
```

## License

银砚代码采用 Apache License 2.0 开源。

网页复盘页包含 Apache ECharts，本地随包分发，ECharts 采用 Apache License 2.0。相关第三方声明见仓库根目录的 `web-review/THIRD_PARTY.md` 和 `review-launch-v3/THIRD_PARTY.md`。
