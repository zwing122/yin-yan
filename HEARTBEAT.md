# 银砚 OpenClaw Heartbeat

本文件用于 OpenClaw 原生 heartbeat。它不是固定时间日报；固定时间的今日/本周/本月复盘应继续使用 OpenClaw cron。

## 每次 heartbeat 做什么

轻量巡检银砚账本，只检查是否有需要打扰用户的事项：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.yin-yan\run-heartbeat.ps1" -Type reminder
```

如果命令输出表示当前没有到期财务提醒、待复核记录或大额消费复核，最终只回复：

```text
HEARTBEAT_OK
```

如果有事项，只发送脚本最终输出中真正需要用户看到的提醒。不要发送推理过程、工具调用过程、排队提示、等待动画或“我来检查”等过程话术。

## 什么时候提醒

只在这些情况提醒：

- 有到期或即将到期付款。
- 有高优先级待复核记录。
- 有大额消费 30 天复核。
- 有预算接近上限或超预算。
- 有现金流风险提示。

这些情况不要主动打扰：

- 只是账本为空。
- 只是补录建议。
- 只是普通低风险缺账户记录。
- 没有新风险时不要重复发送同一条提醒。

## 输出约束

- 没事必须输出 `HEARTBEAT_OK`。
- 有事时输出一条简短 IM 文本。
- 不要主动读取微信、支付宝或银行流水。
- 不要上传完整 `ledger.json`。
- 不要修改账本，除非用户明确要求。
- 日报、周报、月报、现金流固定汇总交给 OpenClaw cron，不在 heartbeat 里重复生成。
