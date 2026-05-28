# 数据模型

## 本地文件

默认账本文件：

```text
yin-yan/data/ledger.json
```

原始输入流水：

```text
yin-yan/data/raw-events.ndjson
```

不要绕过脚本直接写账本，除非用户明确要求修复数据文件。

## 顶层结构

`ledger.json` 以本地 JSON 保存，核心结构：

```json
{
  "schema_version": "0.1",
  "profile": {},
  "entities": {},
  "heartbeat": {},
  "events": []
}
```

## 事件字段

常用事件字段：

- `id`：事件 ID。
- `type`：`expense`、`income`、`transfer`、`goal`、`balance`、`refund`、`reimbursement` 等。
- `amount`：金额；每日笔数预算这类 `goal` 可为空。
- `currency`：默认人民币。
- `category_l1`：一级类目。
- `category_l2`：二级类目。
- `category`：兼容字段，默认等于 `category_l2`。
- `budget_rule`：预算规则，仅用于预算目标。
- `asset_tracking`：大额消费使用追踪候选和确认后的再次提及间隔；旧账本可没有这个字段。
- `account`：账户或支付方式，只有用户明确说出才写入。
- `occurred_at`：发生日期，只有用户明确表达或可由命令上下文确定时写入。
- `due_at`：未来付款、还款、订阅等到期时间。
- `status`：完成、待处理、未来、已取消等。
- `review`：待审查原因、重复风险、分类不确定等。
- `source.raw_text`：保留用户原始输入。

## 预算规则

预算事件使用 `budget_rule`：

```json
{
  "scope": "category_l2",
  "category_l1": "餐饮",
  "category_l2": "咖啡",
  "limit_type": "count_per_day",
  "period": "day",
  "count": 2,
  "amount": null
}
```

预算作用域只支持：

- `category_l1`
- `category_l2`

不支持 `brand`、`merchant` 或平台维度。

## 大额消费追踪字段

`asset_tracking` 是消费事件的可选字段，只用于“大额可追踪消费候选”，不用于判断冲动购物。

核心字段：

- `candidate`：是否为候选。
- `status`：`needs_confirm`、`tracking`、`ignored`、`ended`。
- `item_name`：物品名。
- `reason_codes`：`large_amount`、`trackable_category`、`item_keyword`；其中 `large_amount` 表示固定大额阈值，或已知月收入大于等于 10% 阈值被触发。`trackable_category` 和 `item_keyword` 只作为辅助原因，不能绕过金额门槛单独触发追踪确认。
- `expected_review_days` / `next_review_at`：默认 30 天复核。
- `expected_use_days`：用户主动说“预计用一年/三个月”时记录。
- `mention_count` / `mention_logs`：后续再次提及次数和间隔，不代表真实使用次数。
- `state`：`unknown`、`using`、`idle`、`returned`、`resold`。

不要写 `usage_count` 或 `impulse`。

## 兼容原则

- 新逻辑读 `category_l1/category_l2`。
- 旧逻辑读 `category` 时，应得到二级类目。
- 旧账本缺少 `category_l1/category_l2` 时，可以从 `category` 做保守映射；不确定则进入审查。
- 旧账本缺少 `asset_tracking` 是正常情况，不需要迁移。
- 不新增未被 schema 接受的字段。
