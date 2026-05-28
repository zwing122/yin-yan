import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));
const rawInput = args.text ?? args._.join(" ").trim();

try {
  if (args.heartbeat) {
    const heartbeatArgs = [
      resolve(rootDir, "scripts", "ledger-cli.mjs"),
      "heartbeat",
      "--type",
      String(args.heartbeat),
      ...(args.ledger ? ["--ledger", args.ledger] : [])
    ];
    await runNode(heartbeatArgs);
    process.exit(0);
  }

  if (!rawInput) {
    printUsage();
    process.exit(1);
  }

  const inputItems = splitBatchInput(rawInput);
  for (const [index, inputItem] of inputItems.entries()) {
    if (inputItems.length > 1) {
      console.log(`\n[${index + 1}/${inputItems.length}] ${inputItem}`);
    }
    await dispatchInput(inputItem);
  }
} catch (error) {
  if (error?.code !== "CHILD_FAILED") {
    console.error(error?.message ?? String(error));
  }
  process.exit(error?.exitCode ?? 1);
}

async function dispatchInput(input) {
  const parsed = parseFinanceCommand(input);
  if (!parsed) {
    printUsage();
    process.exit(1);
  }

  const ledgerArgs = args.ledger ? ["--ledger", args.ledger] : [];

  if (parsed.kind === "help") {
    console.log(renderHelpMenu());
    if (await shouldShowFirstUsePrompt()) {
      console.log("");
      console.log(renderFirstUseSetupPrompt());
    }
    return;
  }

  if (parsed.kind === "test-report") {
    const reportArgs = [
      resolve(rootDir, "scripts", "generate-test-report.mjs"),
      "--ledger",
      args.ledger ?? resolve(rootDir, "data", "ledger.json"),
      "--output",
      args.output ?? resolve(rootDir, "data", "test_report.json"),
      "--text",
      args.reportText ?? resolve(rootDir, "data", "test_report.txt"),
      "--testId",
      args.testId ?? "anon_local"
    ];
    await runNode(reportArgs);
    return;
  }

  if (parsed.kind === "setup-wizard") {
    console.log(renderSetupWizardGuide());
    return;
  }

  if (parsed.kind === "noop") {
    console.log(parsed.message);
    return;
  }

  const cliArgs = [
    resolve(rootDir, "scripts", "ledger-cli.mjs"),
    parsed.command,
    ...ledgerArgs
  ];
  if (parsed.text) {
    cliArgs.push("--text", parsed.text);
  }

  await runNode(cliArgs);
}

function parseFinanceCommand(input) {
  const trimmed = input.trim();
  if (isHelpText(trimmed)) {
    return { kind: "help" };
  }

  const commandMap = [
    ["/初始化", "init"],
    ["/记", "record"],
    ["/提醒", "remind"],
    ["/固定", "fixed"],
    ["/目标", "goal"],
    ["/余额", "balance"],
    ["/复核", "review"],
    ["/今日", "today"],
    ["/本周", "week"],
    ["/本月", "month"],
    ["/现金流", "cashflow"],
    ["/清空账本", "clear"],
    ["/导出账本", "export"],
    ["/查看备份", "backups"],
    ["/帮助", "help"]
  ];

  if (trimmed === "/测试报告") {
    return { kind: "test-report" };
  }
  if (trimmed === "/分享错误") {
    return { kind: "ledger", command: "share-error", text: "" };
  }

  for (const [prefix, command] of commandMap) {
    if (trimmed === prefix) {
      if (command === "help") return { kind: "help" };
      return { kind: "ledger", command, text: "" };
    }
    if (trimmed.startsWith(`${prefix} `)) {
      if (command === "help") return { kind: "help" };
      return {
        kind: "ledger",
        command,
        text: trimmed.slice(prefix.length).trim()
      };
    }
  }

  return inferNaturalLanguageCommand(trimmed);
}

function inferNaturalLanguageCommand(text) {
  if (containsAny(text, ["确认清空账本", "确认删除账本记录"])) {
    return { kind: "ledger", command: "clear", text: "确认清空账本" };
  }
  if (containsAny(text, ["确认恢复最近备份", "确认恢复最新备份"])) {
    return { kind: "ledger", command: "restore", text: "确认恢复最近备份" };
  }
  if (isSetupWizardText(text)) {
    return { kind: "setup-wizard" };
  }

  const nonWritingIntent = inferNonWritingIntent(text);
  if (nonWritingIntent) {
    return nonWritingIntent;
  }

  if (containsAny(text, ["清空账本", "删除全部记录", "清除全部记录"])) {
    return { kind: "ledger", command: "clear", text: "" };
  }
  if (containsAny(text, ["初始化", "新建账本", "重置账本"])) {
    return { kind: "ledger", command: "init", text: "" };
  }
  if (containsAny(text, ["待复核", "复核", "需要确认"])) {
    return { kind: "ledger", command: "review", text: "" };
  }
  if (containsAny(text, ["今天花了多少", "今日汇总", "今天汇总", "今天消费", "今天支出"])) {
    return { kind: "ledger", command: "today", text: "" };
  }
  if (containsAny(text, ["本周汇总", "这周汇总", "本周复盘", "这周花了多少"])) {
    return { kind: "ledger", command: "week", text: "" };
  }
  if (containsAny(text, ["本月汇总", "这个月汇总", "本月复盘", "这个月花了多少"])) {
    return { kind: "ledger", command: "month", text: "" };
  }
  if (containsAny(text, ["现金流", "现金流心跳", "还能花多少", "发薪日前", "撑到发薪"])) {
    return { kind: "ledger", command: "cashflow", text: "" };
  }
  if (containsAny(text, ["测试报告", "匿名报告"])) {
    return { kind: "test-report" };
  }
  if (containsAny(text, ["分享错误", "解析错误", "反馈错误"])) {
    return { kind: "ledger", command: "share-error", text: "" };
  }
  if (containsAny(text, ["导出账本", "账本路径"])) {
    return { kind: "ledger", command: "export", text: "" };
  }
  if (containsAny(text, ["查看备份", "备份列表", "有哪些备份", "可用备份"])) {
    return { kind: "ledger", command: "backups", text: "" };
  }
  if (containsAny(text, ["恢复最近备份", "恢复最新备份", "恢复账本", "恢复备份"])) {
    return { kind: "ledger", command: "restore", text: "" };
  }
  if (isAssetTrackingText(text)) {
    return { kind: "ledger", command: "asset", text };
  }
  if (containsAny(text, ["余额", "可用余额", "账户余额", "卡里", "微信还剩", "支付宝还剩"])) {
    return { kind: "ledger", command: "balance", text };
  }
  if (containsAny(text, ["昨天", "前天"])) {
    return { kind: "ledger", command: "record", text };
  }
  if (containsAny(text, ["发工资", "发薪", "发薪日", "薪水", "工资到账"])) {
    return { kind: "ledger", command: "record", text };
  }
  if (
    containsAny(text, ["别超过", "控制在", "控制一下", "少花点", "别花太多", "尽量不超过", "预算", "上限", "目标"]) ||
    (containsAny(text, ["每天", "每日", "一天"]) &&
      containsAny(text, ["最多", "不超过", "别超过", "控制在"]) &&
      containsAny(text, ["笔", "次", "杯", "单"]))
  ) {
    return { kind: "ledger", command: "goal", text };
  }
  if (containsAny(text, ["每月", "每周", "每年", "固定支出", "订阅", "会员", "自动扣", "扣款"])) {
    return { kind: "ledger", command: "fixed", text };
  }
  if (
    containsAny(text, [
      "提醒",
      "记得",
      "到时候",
      "下周",
      "明天",
      "后天",
      "还信用卡",
      "还花呗",
      "还款",
      "需要付",
      "要付",
      "待付款",
      "缴费",
      "交房租",
      "交保险",
      "交电费",
      "交水费",
      "付电费",
      "付水费",
      "电费",
      "水费",
      "燃气费",
      "物业费",
      "网费",
      "宽带费"
    ])
  ) {
    return { kind: "ledger", command: "remind", text };
  }
  return { kind: "ledger", command: "record", text };
}

function inferNonWritingIntent(text) {
  if (isBudgetQuery(text)) {
    return { kind: "ledger", command: "cashflow", text: "" };
  }

  if (isSpendingPatternQuery(text)) {
    return { kind: "ledger", command: "cashflow", text: "" };
  }

  if (isIncomeArrivalQuery(text)) {
    return {
      kind: "noop",
      message: "我不能自动确认工资是否到账，也不会读取银行或支付软件。你可以说“收到工资 12000”来记录，或说“现金流心跳”查看已记录数据。"
    };
  }

  if (isTestOrMetaText(text)) {
    return {
      kind: "noop",
      message: "已识别为测试或说明文字，没有写入账本。要记账可以直接说：今天午饭 38，微信付的。"
    };
  }

  if (isBackupQuestion(text)) {
    return {
      kind: "noop",
      message: "没有执行清空、恢复或重置。备份保存在本地 data/backups，可发送“查看备份”；恢复前会要求发送“确认恢复最近备份”。"
    };
  }

  if (isNegatedDestructiveIntent(text)) {
    return {
      kind: "noop",
      message: "已识别为不要执行清空、恢复或重置，没有改动账本。需要查看备份可以发送“查看备份”。"
    };
  }

  if (isNegatedReminderIntent(text)) {
    return {
      kind: "noop",
      message: "已识别为取消或否定提醒意图，没有新增记录。当前版本暂不自动删除旧提醒；需要整理时先发送“看看待复核”。"
    };
  }

  return null;
}

function isBudgetQuery(text) {
  return containsAny(text, ["预算"]) && containsAny(text, ["还剩", "剩多少", "用了多少", "用掉多少", "进度", "超了吗", "多少"]);
}

function isSpendingPatternQuery(text) {
  const questionLike = containsAny(text, ["吗", "么", "是不是", "有没有", "多少", "多不多", "高不高", "超了吗"]);
  const reviewLike = containsAny(text, ["最近", "这周", "本周", "这个月", "本月", "今天"]);
  const spendingLike = containsAny(text, ["吃饭", "餐饮", "外卖", "咖啡", "打车", "交通", "消费", "花钱", "支出", "花得", "花了"]);
  const patternLike = containsAny(text, ["有点多", "太多", "多不多", "高不高", "频繁", "经常", "是不是多", "超了吗"]);
  return questionLike && spendingLike && (reviewLike || patternLike);
}

function isIncomeArrivalQuery(text) {
  return containsAny(text, ["工资", "薪水", "收入"]) && containsAny(text, ["到账了吗", "到了吗", "有没有到", "到没到", "是否到账"]);
}

function isTestOrMetaText(text) {
  return containsAny(text, ["只是测试", "测试一下", "没有花钱", "没花钱", "不是记账", "不用记录", "不要记录"]);
}

function isBackupQuestion(text) {
  return containsAny(text, ["备份", "恢复", "清空", "重置"]) && containsAny(text, ["怎么", "如何", "风险", "之前", "先看看", "先看", "说明", "会不会"]);
}

function isNegatedDestructiveIntent(text) {
  return containsAny(text, ["清空", "删除全部", "清除全部", "恢复", "重置"]) && containsAny(text, ["不要", "不想", "不用", "不是", "先别", "别恢复", "别清空"]);
}

function isNegatedReminderIntent(text) {
  return containsAny(text, ["提醒", "还信用卡", "还花呗", "还款", "需要付", "要付", "下周", "明天", "后天"]) && containsAny(text, ["不需要", "不用", "不要", "取消", "不提醒"]);
}

function isSetupWizardText(text) {
  return containsAny(text, ["安装银砚", "设置银砚", "银砚安装", "安装向导", "设置自动提醒", "配置自动提醒"]) &&
    containsAny(text, ["安装", "设置", "配置", "向导", "自动提醒"]);
}

function isAssetTrackingText(text) {
  const assetTerms = [
    "降噪耳机",
    "耳机",
    "相机",
    "手机",
    "电脑",
    "平板",
    "键盘",
    "显示器",
    "课程",
    "会员",
    "鞋",
    "包",
    "工具",
    "设备",
    "家电"
  ];
  const actionTerms = [
    "开始追踪",
    "继续追踪",
    "追踪一下",
    "不追踪",
    "不用追踪",
    "别追踪",
    "预计",
    "用了",
    "用过",
    "还在用",
    "学了",
    "学习",
    "练了",
    "戴了",
    "带了",
    "闲置",
    "吃灰",
    "退货",
    "退了",
    "转卖",
    "卖掉",
    "二手卖"
  ];
  if (containsAny(text, ["这个不追踪", "这件不追踪", "这个不用追踪", "这件不用追踪"])) return true;
  return containsAny(text, assetTerms) && containsAny(text, actionTerms);
}

function renderSetupWizardGuide() {
  return `银砚安装向导

如果你已经拿到银砚安装包，在解压目录运行：

powershell -NoProfile -ExecutionPolicy Bypass -File .\\installer\\setup-wizard.ps1

如果你要同时检查 SkillHub CLI 并安装 SkillHub 技能：

powershell -NoProfile -ExecutionPolicy Bypass -File .\\installer\\setup-wizard.ps1 -InstallSkillHubSkill

如果你已经确认 OpenClaw 的频道和目标，并要创建固定时间汇总任务：

powershell -NoProfile -ExecutionPolicy Bypass -File .\\installer\\setup-wizard.ps1 -ConfigureOpenClawCron -Channel qq -To "group:123456"

向导会做这些事：
1. 检查 SkillHub CLI。
2. 可选安装银砚 SkillHub 技能。
3. 安装银砚本地包。
4. 准备 OpenClaw heartbeat workspace。
5. 可选创建 OpenClaw cron。
6. 可选运行安装包验收。`;
}

function isHelpText(text) {
  return [
    "帮助",
    "菜单",
    "功能菜单",
    "新手引导",
    "使用说明",
    "怎么用",
    "如何使用",
    "/帮助",
    "/菜单",
    "help"
  ].includes(text.toLowerCase());
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      parsed._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function runNode(childArgs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, childArgs, {
      stdio: "inherit"
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        error.code = "CHILD_FAILED";
        error.exitCode = code;
        rejectPromise(error);
      }
    });
  });
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function renderHelpMenu() {
  return `📌 银砚菜单

直接像聊天一样说，不用记命令。

记录消费：
今天午饭 38，微信付的
我午餐12块钱

记录未来支出：
明天需要付电费50
下周三还信用卡 3200，招商卡

记录预算和余额：
这个月外卖别超过 300
微信余额 200

查看复盘：
今天花了多少
本周汇总
本月汇总
现金流心跳

处理账本：
看看待复核
查看备份
生成测试报告

安装和自动提醒：
安装银砚并设置自动提醒

本地网页复盘：
源码仓库：打开 yin-yan/web-review/index.html
安装后：打开安装目录里的 web-review/index.html
然后导入本地 ledger.json；注意它不在 skill 目录内部。

定时提醒和汇总：
银砚本体不直接登录 IM，但 OpenClaw/Hermes/QClaw 可以用 heartbeat/cron 主动调度银砚，并把最终结果发送到 IM；本机计划任务只能生成本地输出和日志。`;
}

async function shouldShowFirstUsePrompt() {
  const targetLedger = args.ledger ?? resolve(rootDir, "data", "ledger.json");
  try {
    const raw = await readFile(targetLedger, "utf8");
    if (!raw.trim()) return true;
    const ledger = JSON.parse(raw);
    return !Array.isArray(ledger.events) || ledger.events.length === 0;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    return false;
  }
}

function renderFirstUseSetupPrompt() {
  return `第一次使用建议：先设自动提醒和汇总

你可以把下面这段发给 OpenClaw/Hermes/QClaw，让宿主用 heartbeat/cron 主动调度银砚并发到 IM：

请帮我为 yin-yan 设置自动提醒：
- 每天 21:00 发送待复核和未来支出提醒
- 每天 21:05 发送今日汇总
- 每天 21:08 发送现金流心跳
- 每周日 21:10 发送本周复盘
- 每月 28 日 21:15 发送本月复盘

如果你使用 OpenClaw 原生 cron，可以先打印命令模板，确认频道后再创建：
powershell -NoProfile -ExecutionPolicy Bypass -File .\\installer\\install-openclaw-cron.ps1

如果你只想本机计划任务，可以运行安装器：
powershell -NoProfile -ExecutionPolicy Bypass -File .\\installer\\install.ps1 -ReminderTime "21:00" -DailySummaryTime "21:05" -CashflowSummaryTime "21:08" -WeeklySummaryTime "21:10" -WeeklyDay Sunday -MonthlySummaryTime "21:15" -MonthlySummaryDay 28

不想现在设置也可以，直接开始记账：今天午饭 38，微信付的`;
}

function splitBatchInput(input) {
  const normalized = input.replace(/\r\n/g, "\n").trim();
  const lines = normalized
    .split(/\n+/)
    .map(cleanBatchLine)
    .filter(Boolean);

  if (lines.length > 1) {
    return lines;
  }

  const parts = normalized
    .split(/[;；]/)
    .map(cleanBatchLine)
    .filter(Boolean);

  return parts.length > 1 ? parts : [normalized];
}

function cleanBatchLine(line) {
  return line
    .trim()
    .replace(/^(?:[-*•]|\d+[.、)]|[一二三四五六七八九十]+[、.])\s*/, "")
    .trim();
}

function printUsage() {
  console.log(`Usage:
node yin-yan/scripts/run-command.mjs --text "/初始化"
node yin-yan/scripts/run-command.mjs --text "今天午饭 38，微信付的"
node yin-yan/scripts/run-command.mjs --text "下周三还信用卡 3200，招商卡"
node yin-yan/scripts/run-command.mjs --text "每月 5 号房租 2500"
node yin-yan/scripts/run-command.mjs --heartbeat reminder
node yin-yan/scripts/run-command.mjs --heartbeat daily-summary
node yin-yan/scripts/run-command.mjs --heartbeat weekly-summary
node yin-yan/scripts/run-command.mjs --heartbeat monthly-summary
node yin-yan/scripts/run-command.mjs --text "帮助"
node yin-yan/scripts/run-command.mjs --text "/记 今天午饭 38，微信付的"
node yin-yan/scripts/run-command.mjs --text "/提醒 下周三还信用卡 3200"
node yin-yan/scripts/run-command.mjs --text "/固定 每月 5 号房租 2500"
node yin-yan/scripts/run-command.mjs --text "/余额 微信余额 200"
node yin-yan/scripts/run-command.mjs --text "/复核"
node yin-yan/scripts/run-command.mjs --text "/本月"
node yin-yan/scripts/run-command.mjs --text "/现金流"
node yin-yan/scripts/run-command.mjs --text "/测试报告"`);
}
