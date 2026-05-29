# 银砚 Yin-Yan

本地优先的自然语言财务 skill pack，面向 OpenClaw / Hermes / QClaw。

银砚把 IM 或命令行里的财务描述整理为本地 `ledger.json`，并生成提醒、现金流摘要和浏览器本地复盘。它不是独立 App，不自动读取微信、支付宝或银行流水，也不上传完整账本。

[使用说明](./USAGE.md) · [安装包说明](./installer/README.md) · [Skill 入口](./skills/yin-yan/SKILL.md) · [宿主接入](./skills/yin-yan/references/HOST_INTEGRATION.md)

## 快速安装

从 [Releases](https://github.com/zwing122/yin-yan/releases) 下载 `yin-yan-installer.zip`，解压后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\setup-wizard.ps1
```

默认安装到：

```text
%USERPROFILE%\.yin-yan
```

## 给 AI Agent 的安装指令

需要让 AI 宿主或编码 agent 自动安装时，可以直接复制下面这段：

```text
请安装银砚（yin-yan）财务助手。

请先检查当前环境是否可以访问 GitHub，并确认本机已安装 Node.js 18 或更高版本。

然后从 GitHub 下载并安装银砚：
https://github.com/zwing122/yin-yan

请优先使用 GitHub Releases 里的 `yin-yan-installer.zip` 安装包。
下载后解压，并运行安装向导：

powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\setup-wizard.ps1

安装后请完成以下检查：
1. 确认本地已安装银砚，名称为 yin-yan / 银砚。
2. 确认本地存在银砚账本目录。
3. 运行一次“帮助”确认银砚可用。
4. 确认本地网页复盘页可以打开。
5. 如果当前宿主支持定时任务或 heartbeat，请询问我是否要设置每日提醒、每日汇总、每周汇总和现金流心跳。
6. 不要上传我的完整账本，不要读取微信、支付宝、银行流水。

如果宿主是 OpenClaw / Hermes / QClaw，请优先把银砚配置为本地工具或本地 skill，并把定时触发交给宿主 heartbeat 或 cron。
```

一句话版本：

```text
请从 GitHub 安装银砚（yin-yan）财务助手：https://github.com/zwing122/yin-yan

请优先下载 Releases 里的 `yin-yan-installer.zip`，解压后运行：

powershell -NoProfile -ExecutionPolicy Bypass -File .\installer\setup-wizard.ps1

安装后请运行“帮助”确认可用，并检查本地账本目录和网页复盘页。不要上传完整账本，不要读取微信、支付宝或银行流水。如果宿主支持 heartbeat/cron，请询问我是否设置每日提醒、每日汇总、每周汇总和现金流心跳。
```

## 致谢

| 感谢 | 介绍 |
| --- | --- |
| Cognint | B站创业指导、哲学 UP 主，在本项目策划期提供了丰富的理论指导和思想支持，在本项目后期为这个项目最后的收尾提供了有力的支持，[特此感谢](https://space.bilibili.com/28210233?spm_id_from=333.337.0.0)。 |
| ![逍遥中转](./assets/thanks/xztcodex-cloud.jpg) | 本项目创建过程中本站提供了充足的技术和资源支持，费率低至 0.35，特此感谢，[点击此链接注册](https://xztcodex.cloud/register?aff=TS4K7QFQHSUH)可联系管理员领取 5 元体验金。 |

## 能做什么

- 自然语言记账：`今天午饭 38，微信付的`
- 预算提醒：`这个月外卖别超过 800`
- 固定支出和未来付款：房租、信用卡、订阅扣费
- Heartbeat 摘要：日报、周报、月报、现金流心跳
- 本地网页复盘：分类、趋势、预算、高频低值消费、待复核整理
- 匿名测试报告：只生成本地摘要，不提交完整账本

## 数据边界

银砚不会要求上传：

- 完整 `ledger.json`
- 微信、支付宝或银行原始账单
- 银行卡、身份证、手机号等身份信息
- 支付凭证截图
- IM 全量聊天记录

完整账本默认只保存在本地。

## Heartbeat / Cron

银砚不直接登录 IM，也不保存 QQ、Telegram、微信等发送凭证。

- OpenClaw / Hermes / QClaw 负责 IM 入口、定时触发和消息投递。
- 银砚负责生成可发送的提醒、汇总和复盘文本。

## 本地网页复盘

打开：

```text
web-review/index.html
```

选择本地 `ledger.json` 后即可复盘。页面在浏览器本地解析，不上传账本。

## 开发者

```powershell
node scripts/run-command.mjs --text "帮助"
node scripts/run-command.mjs --text "今天午饭 38，微信付的"
node scripts/run-command.mjs --text "本周汇总"
```

更多命令见 [USAGE.md](./USAGE.md)。

## License

银砚代码采用 [Apache License 2.0](./LICENSE) 开源。

网页复盘页包含 Apache ECharts，本地随包分发，ECharts 采用 Apache License 2.0。相关第三方声明见 [web-review/THIRD_PARTY.md](./web-review/THIRD_PARTY.md) 和 [review-launch-v3/THIRD_PARTY.md](./review-launch-v3/THIRD_PARTY.md)。
