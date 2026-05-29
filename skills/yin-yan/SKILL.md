---
name: yin-yan
description: 银砚 personal finance skill for OpenClaw/Hermes/QClaw. Use when the user records, reviews, queries, exports, or summarizes personal finance events in natural language, including expenses, income, transfers, repayments, refunds, reimbursements, fixed costs, subscriptions, future payments, balances, budget goals, daily count limits, heartbeat reminders, cashflow summaries, local ledger backup/restore, browser-local review, and anonymous 7-day test reports.
license: Apache-2.0
metadata:
  version: "0.2.0"
  tags:
    - finance
    - ledger
    - heartbeat
    - cashflow
    - openclaw
    - hermes
    - qclaw
---

# 银砚

银砚是一个本地优先的自然语言记账 skill pack。它面向 OpenClaw/Hermes/QClaw 等宿主，通过 IM 或命令入口把用户的日常财务表达整理为本地 `ledger.json`，并提供低打扰追问、预算提醒、现金流摘要、浏览器本地审查和匿名测试报告。

核心边界：

- 先记录用户明确说出的事实，再处理不确定项。
- 不自主补全支付方式、账户、地点、具体日期或用户没有说出的上下文。
- 商户、店名、商品名只能作为分类线索；不沉淀为独立品牌或商户维度。
- 数据默认留在本地，不上传到外部服务。

## 快速路由

| 用户意图 | 优先动作 | 需要读取 |
| --- | --- | --- |
| 记一笔、改一笔、批量输入 | 调用 `scripts/run-command.mjs --text` | `references/COMMANDS.md`、`references/RECORDING_RULES.md` |
| 分类、两级类目、商户词归类 | 用一级/二级类目处理 | `references/CATEGORY_TAXONOMY.md` |
| 预算、每日笔数、预算提醒 | 记录 `goal` 或生成提醒 | `references/BUDGETS.md` |
| 用户画像、低打扰追问、待审查项 | 只补用户确认的信息 | `references/PROFILE_AND_REVIEW.md` |
| 大额消费使用追踪、30 天复核 | 只记录候选、确认和再次提及间隔 | `references/RECORDING_RULES.md`、`references/DATA_MODEL.md` |
| 日报、周报、月报、现金流摘要、重点提醒 | 调用 heartbeat 模式 | `references/HEARTBEAT_TEMPLATES.md` |
| 本地 JSON、schema、迁移、兼容字段 | 读写本地账本 | `references/DATA_MODEL.md`、`references/DATA_BOUNDARY.md` |
| OpenClaw/Hermes/QClaw 接入 | 选择宿主入口和约束 | `references/HOST_INTEGRATION.md` |
| 测试、验证、匿名报告 | 跑验证命令 | `references/TESTING.md` |
| 产品形态和范围判断 | 不把它当 SaaS 或 App | `references/PRODUCT_FORM.md` |

## 默认工作流

1. 判断输入是记录、查询、预算、heartbeat、审查、导出还是测试。
2. 只加载对应 reference，不一次性读完整 skill。
3. 对记账输入，先保留原始 `raw_text`，再抽取金额、类型、一级类目、二级类目、时间、账户、状态和 review 标记。
4. 对缺失但重要的信息，用低打扰方式提示；不能把未说出的信息写入账本。
5. 对商户词命中的内容，只写分类结果，例如 `餐饮 / 咖啡`，不写 `brand` 或 `merchant`。
6. 写入或读取统一通过 `scripts/run-command.mjs`，不要手写修改 `ledger.json`，除非用户明确要求修复数据文件。
7. IM 侧只输出轻量重点提醒，例如高频低值、预算速度、订阅/固定支出、待付款集中、大额低提及；不使用抽象总称，不写入人格判断。
8. 修改 skill、脚本、schema 或用户可见行为后，运行对应测试并说明验证范围。

## 命令入口

常用记录入口：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "午饭花了25"
```

常用 heartbeat：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat reminder
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat monthly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat cashflow-summary
```

常用验证：

```powershell
node yin-yan/scripts/smoke-test.mjs
node yin-yan/scripts/web-review-test.mjs
$env:PYTHONUTF8='1'; python path\to\skill-creator\scripts\quick_validate.py yin-yan\skills\yin-yan
```

## 输出要求

- 面向用户的回复要短、清楚、低压力。
- 确认记录时只复述已记录事实和必要缺口，例如“已记录：正餐 ¥25。支付方式未填写”。
- 预算提醒要区分金额预算和笔数预算，例如“咖啡每日最多 2 笔”。
- 大额消费只做“可追踪候选”和再次提及间隔，不写真实使用次数，不判断冲动购物。
- 审查建议要按影响排序，先处理可能重复、金额异常、到期项、预算超限，再处理低风险分类建议。

## 模块索引

- `references/COMMANDS.md`：自然语言命令、斜杠命令、批量输入和快捷入口。
- `references/RECORDING_RULES.md`：记录规则、低打扰追问、禁止自主补全。
- `references/CATEGORY_TAXONOMY.md`：两级类目、商户词线索、兼容字段。
- `references/BUDGETS.md`：预算设置、每日笔数、预算提醒和预算作用域。
- `references/PROFILE_AND_REVIEW.md`：用户画像、审查优先级、可沉淀信息和禁止沉淀信息。
- `references/HEARTBEAT_TEMPLATES.md`：reminder、daily、weekly、monthly、cashflow 输出模板。
- `references/DATA_MODEL.md`：`ledger.json` 结构、事件字段、兼容和迁移边界。
- `references/DATA_BOUNDARY.md`：本地数据、隐私、备份、匿名测试报告。
- `references/HOST_INTEGRATION.md`：OpenClaw/Hermes/QClaw/IM/cron 接入方式。
- `references/PRODUCT_FORM.md`：产品形态、MVP 边界、非目标。
- `references/TESTING.md`：验证命令、包验证、失败处理。
