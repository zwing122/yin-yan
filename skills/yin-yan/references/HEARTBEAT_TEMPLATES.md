# 心跳模板

## 输出约束

心跳和复盘消息必须像一条可直接发送的 IM 消息。不要显示模型、调度、请求数、等待/加载进度状态或“我来处理”的过程说明。预算进度和分类支出的文本条形图可以保留。长任务可以由宿主发送短状态，但 yin-yan 的最终输出只保留结果。

每天/每周/每月几点发送，由 OpenClaw/Hermes/QClaw heartbeat、cron 或本机计划任务按用户设置触发；skill 只提供 `reminder`、`daily-summary`、`weekly-summary`、`monthly-summary`、`cashflow-summary` 这些可调度入口。

## 每日待复核提醒

```text
你今天有 {pending_count} 条财务记录待复核。

先确认最重要的：
{top_review_item}

回复 `/复核` 查看全部。
```

## 未来 7 天提醒

```text
基于已记录数据，未来 7 天有 {scheduled_count} 个财务事项：

{scheduled_items}

如果有漏记的还款、订阅或固定支出，可以直接说：
/提醒 下周三还信用卡 3200
```

## 补录建议

```text
补录建议：
- 历史项目：之前记录过{category}¥{amount}，本期如已发生可补一句“本月{category}{amount}已付”。
- 过去账单：如果昨天或前天有漏记支出/缴费，可以直接补一句“昨天电费50，微信付的”。
- 账户余额：建议每周补一次主要账户余额，例如“微信余额 200”。
```

补录建议只基于本地已记录数据生成，不暗示已经读取真实账单或账户余额。

## 大额消费复核

30 天复核只提醒“是否还在用/是否闲置/是否退货或转卖”，不推断冲动购物，不声称真实使用次数。

```text
大额消费复核：
- 降噪耳机 ¥1299：购买约 30 天，记录中再次提到 0 次，最近一次：暂无。可回复“降噪耳机还在用 / 降噪耳机闲置了 / 降噪耳机退货了 / 降噪耳机转卖了 / 这个不追踪”。
```

## 重点提醒

重点提醒是运行时复盘，不是账本 schema 字段。IM 侧只输出具体项目，避免使用“大帽子”式总结：

- 高频低值：同类小额支出多次出现。
- 预算消耗过快：预算进度明显快于当前月份进度，或每日笔数达到上限。
- 订阅/固定支出累积：订阅、会员、套餐、固定扣款近期集中。
- 延迟付款集中：未来 7 到 14 天待付款集中。
- 大额低提及：用户确认追踪的大额物品 30 天后没有再次提及。

禁止写成人格化或道德化判断。输出用克制建议：

```text
重点提醒：
- 高频低值提醒：本月餐饮 5 次，合计 ¥86，均 ¥17。建议：餐饮可以先设每日笔数上限，例如“餐饮每天最多 1 笔”。
- 订阅/固定支出提醒：已记录 3 条订阅或固定支出，近期合计 ¥218。建议：月末复盘时逐条确认是否还在使用。
```

## 今日摘要

```text
📊 今日摘要（仅基于已记录数据）
仅基于已记录数据

支出合计：¥{expense_total}
收入合计：¥{income_total}
固定支出：¥{fixed_cost_total}

🍱 餐饮预算：¥{spent} / ¥{limit} ██████░░░░ {percent}%（剩余 ¥{remaining}）

🍱 餐饮  ¥{amount}  ████████░░ {percent}%
🚇 交通  ¥{amount}  ██░░░░░░░░ {percent}%
🛒 日用  ¥{amount}  ████░░░░░░ {percent}%

高频消费：
🍱 餐饮  {count} 次  ¥{amount}
🚇 交通  {count} 次  ¥{amount}

高频低值消费：
{low_value_frequent_lines}

重点提醒：
{spending_signal_lines}

明日需支出：
- {category} ¥{amount}，{account}

⚠️ 待复核：{pending_count} 条
⏰ 未来提醒：{scheduled_count} 条，{next_due_item}
数据不完整时，复盘只代表已记录部分。
```

## 周复盘

```text
📊 本周复盘（仅基于已记录数据）
仅基于已记录数据

支出合计：¥{weekly_expense_total}
收入合计：¥{weekly_income_total}
固定支出：¥{fixed_cost_total}

{budget_lines}

{category_bar_lines}

高频消费：
{frequent_expense_lines}

高频低值消费：
{low_value_frequent_lines}

重点提醒：
{spending_signal_lines}

明日需支出：
{tomorrow_due_lines}

⚠️ 待复核：{pending_count} 条
⏰ 未来提醒：{scheduled_count} 条，{next_due_item}
数据不完整时，复盘只代表已记录部分。
```

## 月复盘

```text
📊 本月复盘（仅基于已记录数据）
仅基于已记录数据

支出合计：¥{monthly_expense_total}
收入合计：¥{monthly_income_total}
固定支出：¥{fixed_cost_total}

{budget_lines}

{category_bar_lines}

高频消费：
{frequent_expense_lines}

高频低值消费：
{low_value_frequent_lines}

重点提醒：
{spending_signal_lines}

明日需支出：
{tomorrow_due_lines}

⚠️ 待复核：{pending_count} 条
⏰ 未来提醒：{scheduled_count} 条，{next_due_item}
数据不完整时，复盘只代表已记录部分。
```

## 现金流心跳

```text
📊 现金流心跳
仅基于已记录数据和你手动提供的余额估算

现金流画像：{completed}/{total} 已补全
已知可用余额：¥{balance}
未来 7 天确定支出：¥{upcoming_due}
距离下次发薪：{days_to_payday} 天
预估每日可自由支配：¥{daily_available}

{budget_progress_lines}

本月分类支出：
{category_bar_lines}

高频消费：
{frequent_expense_lines}

高频低值消费：
{low_value_frequent_lines}

重点提醒：
{spending_signal_lines}

未来 7 天现金流：
{cashflow_risk_lines}

消费行为：
{behavior_pattern_lines}

下一步最有用：{missing_profile_hint}
```

## 匿名测试报告摘要

```text
银砚 Skill 7 天匿名测试报告

测试 ID：{test_id}
使用天数：{days_used}/7
记录条数：{records_created}
待复核条数：{review_required}
已复核条数：{review_completed}
心跳提醒次数：{heartbeat_sent}
心跳回复次数：{heartbeat_replied}
周报是否生成：{weekly_report_generated}

常见复核原因：
{top_review_reasons}

主观评分：
是否愿意继续使用：
最有用的地方：
最烦的地方：
希望下一步改进：
```
