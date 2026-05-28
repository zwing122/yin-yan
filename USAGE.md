# 银砚 Skill 使用说明

## 产品形态

第一版是 OpenClaw/Hermes 的个人财务助理 skill pack，不是独立 App、网页端 SaaS 或自动记账工具。

宿主平台负责 IM 入口、agent 运行、skill 加载、heartbeat 调度、模型配置和本地工具执行权限。本 skill 负责自然语言财务记录、待复核、轻量复盘、本地账本和匿名测试报告。

## 数据边界

完整账本保存在用户本地 `data/ledger.json`。

不要收集或要求用户提供：

- 完整账本
- 微信、支付宝、银行原始账单
- 银行卡号、身份证号、手机号等身份信息
- IM 全量聊天记录
- 支付凭证截图

测试阶段只接收用户自愿分享的 `/测试报告` 摘要，或用户手动脱敏后的 `/分享错误` 样例。

## 最小测试流程

在项目根目录执行：

```powershell
node yin-yan/scripts/run-command.mjs --text "初始化账本"
node yin-yan/scripts/run-command.mjs --text "帮助"
node yin-yan/scripts/run-command.mjs --text "今天午饭 38，微信付的"
node yin-yan/scripts/run-command.mjs --text "下周三还信用卡 3200，招商卡"
node yin-yan/scripts/run-command.mjs --text "每月 5 号房租 2500"
node yin-yan/scripts/run-command.mjs --text "这个月外卖别超过 800"
node yin-yan/scripts/run-command.mjs --text "咖啡每天最多2笔"
node yin-yan/scripts/run-command.mjs --text "瑞幸18"
node yin-yan/scripts/run-command.mjs --text "昨天电费50，微信付的"
node yin-yan/scripts/run-command.mjs --text "微信余额 200"
node yin-yan/scripts/run-command.mjs --text "看看待复核"
node yin-yan/scripts/run-command.mjs --text "今天花了多少"
node yin-yan/scripts/run-command.mjs --text "本周汇总"
node yin-yan/scripts/run-command.mjs --text "本月汇总"
node yin-yan/scripts/run-command.mjs --text "现金流心跳"
node yin-yan/scripts/run-command.mjs --text "生成测试报告"
node yin-yan/scripts/run-command.mjs --text "分享错误"
```

也可以一次发送多条，每行一条：

```powershell
node yin-yan/scripts/run-command.mjs --text "今天早餐 12，微信付的
今天午饭 38，支付宝付的
每月 15 号手机套餐 129"
```

可安装 skill 包位于：

```text
yin-yan/skills/yin-yan/
```

该目录内的脚本是自包含版本，可以在 OpenClaw/Hermes 加载 skill 后由宿主调用：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --text "今天午饭 38，微信付的"
```

OpenClaw/Hermes 的 heartbeat 或 cron 可以定时调用：

```powershell
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat reminder
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
node yin-yan/skills/yin-yan/scripts/run-command.mjs --heartbeat monthly-summary
```

用户每天/每周/每月几点收到提醒和汇总，由 OpenClaw/Hermes heartbeat/cron 或本机计划任务按用户设置触发；skill 本身不常驻运行，也不托管 IM 凭证。

今日、本周、本月汇总都会包含：

- 已记录支出、收入、固定支出
- 预算进度、每日笔数和分类支出条形图
- 高频消费次数和金额
- 明日需支出
- 待复核数量和未来提醒

## 分类和商户词规则

银砚现在按两层类目沉淀消费画像。对用户可见时优先展示二级类目，例如“正餐”“外卖”“咖啡”“茶饮”，不是把所有吃喝都塞进“餐饮”。

示例：

```text
午饭花了25 -> 已记录：正餐 ¥25。支付方式未填写
瑞幸18 -> 已记录：咖啡 ¥18。支付方式未填写
咖啡每天最多2笔 -> 已设置：咖啡每日最多 2 笔
```

注意：商户词只作为类目线索，不作为独立品牌维度沉淀。支付方式、账户、地点和用户没有说出的日期不会自动补全。

## 本地网页复盘

网页复盘器位于：

```text
yin-yan/web-review/index.html
```

直接用浏览器打开后，选择本地 `ledger.json`。网页只在浏览器本地解析，不上传账本。

如果浏览器支持 File System Access API（例如 Chromium 内核浏览器），可以点“授权文件”或“授权文件夹”：

- 第一次需要用户手动授权，浏览器不允许网页静默读取任意本地文件夹。
- 授权后页面会记住账本文件，下次打开时会尝试自动读取。
- 整理台修改会自动保存到浏览器缓存；授权写入权限后，可以点“保存回文件”，批量整理后也会尝试自动保存回原 JSON。
- 不支持该能力的浏览器仍可使用“选择 JSON”和“导出 JSON”。

当前网页端支持：

- 本地复盘：按记录最多月份、最近 30 天、今年或自定义时间段查看现金流概览、分类支出、消费类型占比、预算进度、高频消费、高频低值消费、同比、环比、未来支出、待复核和行为标签。
- 统计表格：分类支出明细、高频低值消费、固定支出 / 未来支出。
- 视觉图表：时间段趋势、消费类型占比、玫瑰图、日历热力图、高频低值气泡图。
- 批量整理：多选待复核或未分类记录，批量修改分类，批量确认。
- 规则建议和 Firefly III 映射预览：参考来源 / 去向账户模型，辅助后续规则整理；当前不是完整 Firefly III 导出器。
- 本地保存：浏览器缓存自动保存最近账本；授权文件后可保存回原 JSON。
- 导出 JSON：导出整理后的账本文件，作为不支持文件授权时的兜底。

## QQ 群测试规则

第一阶段用 QQ 群完成招募、使用说明、7 天测试和反馈收集。

群内只允许分享：

- `/测试报告` 生成的匿名摘要
- 手动脱敏后的 `/分享错误` 模板
- 产品体验反馈

群内不允许分享完整账本、原始账单、支付截图、身份证、银行卡、手机号或私人聊天记录。

## 验证命令

源码仓库内的开发侧 smoke test：

```powershell
node yin-yan/scripts/smoke-test.mjs
```

预期输出：

```text
Smoke test passed.
```

安装包自带轻量验收脚本，不会碰真实账本，只会在系统临时目录创建测试账本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\verify.ps1
```

安装后也可以在安装目录下手动验收：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 "今天午饭 38，微信付的"
powershell -NoProfile -ExecutionPolicy Bypass -File .\run-heartbeat.ps1 -Type daily-summary
```

注意：`yin-yan/data/` 是本地运行数据目录，不是样例目录，也不是需要提交或回收的数据。

## IM 噪音排查

如果聊天里出现以下内容，通常不是 `yin-yan` 脚本输出：

```text
任务准备中，正在为您智能调度算力...
调度完成，正在生成回复...
前方还有 N 个请求
```

优先检查 OpenClaw/宿主配置：

- 关闭或改低 `preview/progress streaming`，不要把模型中间状态发送到 IM。
- 关闭 reasoning/思考过程可见输出。
- 检查模型中转站或供应商是否注入了排队、算力调度、请求数提示。
- 对 yin-yan 场景，建议只转发脚本最终 stdout，不转发工具调用前后的 agent 过程消息。

`yin-yan` 自身要求最终回复只包含财务结果、复核问题、备份/恢复结果或必要风险提示。
