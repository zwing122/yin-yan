# 脚本说明

## `generate-test-report.mjs`

从本地账本 JSON 生成匿名测试报告。

默认读取：

```text
yin-yan/samples/ledger.sample.json
```

默认输出：

```text
yin-yan/samples/test-report.generated.json
```

示例：

```powershell
node yin-yan/scripts/generate-test-report.mjs
```

指定输入、输出和文本报告：

```powershell
node yin-yan/scripts/generate-test-report.mjs --ledger yin-yan/samples/ledger.sample.json --output yin-yan/samples/test-report.generated.json --text yin-yan/samples/test-report.generated.txt --testId anon_demo
```

该脚本不会上传数据，不读取微信、支付宝、银行流水，也不会包含完整交易明细以外的匿名汇总指标。

## `run-command.mjs`

把自然语言财务输入或兼容命令映射到本地脚本。真实测试优先使用自然语言，不要求用户记忆 `/记`、`/提醒` 等命令。

示例：

```powershell
node yin-yan/scripts/run-command.mjs --text "今天午饭 38，微信付的"
node yin-yan/scripts/run-command.mjs --text "看看待复核"
node yin-yan/scripts/run-command.mjs --text "生成测试报告"
```

同一个账本文件的写入命令会通过本地 `.lock` 文件串行化，避免并发写入覆盖彼此结果。

定时心跳入口：

```powershell
node yin-yan/scripts/run-command.mjs --heartbeat reminder
node yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
```

## `smoke-test.mjs`

验证自然语言路由、账本写入、复核、定时提醒、定时汇总和匿名测试报告生成。

```powershell
node yin-yan/scripts/smoke-test.mjs
```
