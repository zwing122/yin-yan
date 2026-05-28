import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const projectPath = (...segments) => resolve(projectRoot, ...segments);
const runCommandPath = projectPath("scripts", "run-command.mjs");
const reportScriptPath = projectPath("scripts", "generate-test-report.mjs");
const testRoot = resolve(tmpdir(), `yin-yan-smoke-${process.pid}-${Date.now()}`);
const ledgerPath = resolve(testRoot, "main", "ledger.json");
const backupDir = resolve(testRoot, "main", "backups");
const rawEventsPath = resolve(testRoot, "main", "raw-events.ndjson");
const reportPath = resolve(testRoot, "reports", "smoke-report.json");
const reportTextPath = resolve(testRoot, "reports", "smoke-report.txt");
const blankLedgerPath = resolve(testRoot, "blank", "ledger.json");
const badNoBackupLedgerPath = resolve(testRoot, "bad-no-backup", "ledger.json");
const badReportLedgerPath = resolve(testRoot, "reports", "bad-report-ledger.json");
const pastDueLedgerPath = resolve(testRoot, "past-due", "ledger.json");
const lowReviewLedgerPath = resolve(testRoot, "low-review", "ledger.json");

await mkdir(testRoot, { recursive: true });

await writeTestFile(blankLedgerPath, "");
const blankInitOutput = await run("初始化账本", [], blankLedgerPath);
const blankLedger = JSON.parse(await readFile(blankLedgerPath, "utf8"));
const initOutput = await run("初始化账本");
const helpOutput = await run("帮助");
const firstRecordOutput = await run("今天午饭 38，微信付的");
await run("下周三还信用卡 3200，招商卡");
await run("每月 10 号发工资 12000");
await run("每月 5 号房租 2500");
const budgetOutput = await run("这个月外卖别超过 800");
const fuzzyBudgetOutput = await run("这个月外卖控制一下 300");
await run("看看待复核");
await run("今天花了多少");
await run("本周汇总");
await run("本月汇总");
await run("分享错误");
await run("生成测试报告", [
  "--output",
  reportPath,
  "--reportText",
  reportTextPath,
  "--testId",
  "anon_smoke"
]);
await run("4月5日房租2500，微信付的");
const completionReminder = await runHeartbeat("reminder");
const balanceOutput = await run("微信余额 200，银行卡 3200");
await run("昨天电费50，微信付的");
await Promise.all([
  run("今天咖啡 18，微信付的"),
  run("今天地铁 6，支付宝付的"),
  run("收到工资 12000")
]);
const missingAccountOutput = await run("我午餐12块钱");
const merchantCoffeeOutput = await run("瑞幸18");
const dailyCoffeeCountBudgetOutput = await run("咖啡每天最多2笔");
const recurringPaymentOutput = await run("明天需要付电费50");
const fuzzyRecurringPaymentOutput = await run("明天可能要交电费50");
await run("从微信转到银行卡 100");
await run([
  "今天早餐 12，微信付的",
  "今天买日用品 86，支付宝付的",
  "每月 15 号手机套餐 129"
].join("\n"));
const duplicateBreakfastOutput = await run("今天早餐 12，微信付的");
const invalidDateOutput = await run("2月31日午饭 10");
const invalidMonthOutput = await run("13月1日午饭 10");
await run("初始化账本");
const backupList = await run("查看备份");
await runHeartbeat("reminder");
const dailySummary = await runHeartbeat("daily-summary");
const weeklySummary = await runHeartbeat("weekly-summary");
const monthlySummary = await runHeartbeat("monthly-summary");
const cashflowSummary = await runHeartbeat("cashflow-summary");

const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
const report = JSON.parse(await readFile(reportPath, "utf8"));
const rawEvents = await readFile(rawEventsPath, "utf8");
const backupFiles = (await readdir(backupDir)).filter((name) => name.endsWith(".json"));
const combinedOutput = [initOutput, firstRecordOutput, backupList, dailySummary].join("\n");
const broadSpendingLabel = "\u6d88\u8d39\u9677\u9631";

const breakfastEvents = ledger.events.filter((event) => event.source.raw_text === "今天早餐 12，微信付的");
const missingAccountLunch = ledger.events.find((event) => event.source.raw_text === "我午餐12块钱");
const merchantCoffee = ledger.events.find((event) => event.source.raw_text === "瑞幸18");
const dailyCoffeeBudget = ledger.events.find((event) => event.source.raw_text === "咖啡每天最多2笔");
const unclearElectricityBill = ledger.events.find((event) => event.source.raw_text === "明天需要付电费50");
const balanceSnapshots = ledger.events.filter((event) => event.source.raw_text === "微信余额 200，银行卡 3200");
const pastBill = ledger.events.find((event) => event.source.raw_text === "昨天电费50，微信付的");
const incomeEvents = ledger.events.filter((event) => event.type === "income");
const transferEvent = ledger.events.find((event) => event.source.raw_text === "从微信转到银行卡 100");
const invalidDateEvents = ledger.events.filter((event) =>
  ["2月31日午饭 10", "13月1日午饭 10"].includes(event.source.raw_text)
);

assert(ledger.events.length === 24, "expected 24 ledger events");
assert(blankInitOutput.includes("第一次使用建议"), "expected blank ledger first-use prompt");
assert(blankLedger.events.length === 0, "expected blank ledger repaired to empty ledger");
assert(ledger.profile, "expected cashflow profile");
assert(ledger.profile.payday.day_of_month === 10, "expected payday profile");
assert(ledger.profile.monthly_income.amount === 12000, "expected monthly income profile");
assert(ledger.profile.latest_balances.length >= 1, "expected latest balance profile");
assert(ledger.profile.known_fixed_costs.length >= 1, "expected fixed cost profile");
assert(ledger.profile.known_budgets.length >= 1, "expected budget profile");
assert(cashflowSummary.includes("现金流心跳"), "expected cashflow heartbeat");
assert(cashflowSummary.includes("现金流画像"), "expected profile completeness in cashflow summary");
assert(cashflowSummary.includes("未来 7 天"), "expected seven-day cashflow section");
assert(cashflowSummary.includes("预算："), "expected budget line in cashflow summary");
assert(cashflowSummary.includes("█") && cashflowSummary.includes("░"), "expected text progress bars in cashflow summary");
assert(cashflowSummary.includes("本月分类支出"), "expected monthly category section in cashflow summary");
assert(cashflowSummary.includes("高频消费"), "expected frequent expense section in cashflow summary");
assert(cashflowSummary.includes("高频低值消费"), "expected low-value frequent expense section in cashflow summary");
assert(cashflowSummary.includes("均 ¥"), "expected low-value frequent expense average in cashflow summary");
assert(cashflowSummary.includes("重点提醒"), "expected key reminder section in cashflow summary");
assert(
  ["高频低值提醒", "预算速度提醒", "每日笔数提醒", "订阅/固定支出提醒", "待付款集中提醒", "大额低提及提醒"].some((label) => cashflowSummary.includes(label)),
  "expected concrete spending signal in cashflow summary"
);
assert(!cashflowSummary.includes(broadSpendingLabel), "expected cashflow summary not to use broad spending label");
assert(helpOutput.includes("银砚菜单"), "expected help menu title");
assert(helpOutput.includes("直接像聊天一样说"), "expected natural language guidance");
assert(helpOutput.includes("安装目录里的 web-review/index.html"), "expected installed web-review path guidance");
assert(helpOutput.includes("不在 skill 目录内部"), "expected web-review skill directory boundary");
assert(helpOutput.includes("第一次使用建议"), "expected first-use setup prompt for empty ledger");
assert(helpOutput.includes("每天 21:05 发送今日汇总"), "expected daily summary setup prompt");
assert(initOutput.includes("第一次使用建议"), "expected init first-use setup prompt");
assert(firstRecordOutput.includes("建议设置每日提醒"), "expected short first record setup prompt");
assert(!firstRecordOutput.includes("每天 21:05 发送今日汇总"), "expected first record setup prompt to stay short");
assert(!ledger.events.some((event) => event.source.raw_text === "帮助"), "expected help not to be recorded");
assert(ledger.heartbeat.pending_review_ids.length >= 1, "expected pending review item");
assert(completionReminder.includes("补录建议"), "expected ledger completion reminder section");
assert(completionReminder.includes("历史项目"), "expected historical project reminder");
assert(completionReminder.includes("过去账单"), "expected past bill reminder");
assert(completionReminder.includes("账户余额"), "expected balance snapshot reminder");
assert(budgetOutput.includes("已设置：外卖预算 ¥800"), "expected budget confirmation");
assert(!budgetOutput.includes("已记录：外卖 ¥800"), "expected budget not to look like expense");
assert(fuzzyBudgetOutput.includes("已设置：外卖预算 ¥300"), "expected fuzzy budget confirmation");
assert(balanceOutput.includes("已记录 2 个余额快照"), "expected multi balance snapshot confirmation");
assert(balanceOutput.includes("微信 ¥200"), "expected WeChat balance confirmation");
assert(balanceOutput.includes("银行卡 ¥3200"), "expected bank card balance confirmation");
assert(!balanceOutput.includes("微信支付 ¥200"), "expected balance account not to look like payment method");
assert(balanceSnapshots.length === 2, "expected two account balance events from one input");
assert(
  balanceSnapshots.every((event) => event.status === "confirmed" && event.review.required === false),
  "expected multi account balance snapshots to be confirmed"
);
assert(
  ledger.profile.latest_balances.some((item) => item.account === "微信" && item.amount === 200),
  "expected WeChat latest balance profile"
);
assert(
  ledger.profile.latest_balances.some((item) => item.account === "银行卡" && item.amount === 3200),
  "expected bank card latest balance profile"
);
assert(cashflowSummary.includes("已知可用余额：¥3400"), "expected cashflow balance to include all latest balances");
assert(transferEvent.type === "transfer", "expected transfer event");
assert(transferEvent.direction === "internal", "expected transfer internal direction");
assert(transferEvent.transaction.kind === "transfer", "expected transfer transaction kind");
assert(transferEvent.transaction.source_account === "微信", "expected transfer source account");
assert(transferEvent.transaction.destination_account === "银行卡", "expected transfer destination account");
assert(transferEvent.transaction.firefly_iii.type === "transfer", "expected Firefly III transfer mapping");
assert(pastBill.occurred_at === relativeDate(-1), "expected yesterday bill date");
assert(incomeEvents.every((event) => event.occurred_at), "expected income events to have occurred_at");
assert(missingAccountOutput.includes("已记录：正餐 ¥12"), "expected small clear expense to be recorded");
assert(missingAccountOutput.includes("支付方式未填写"), "expected missing account to be explicit without guessing payment method");
assert(missingAccountLunch.status === "confirmed", "expected small clear expense to avoid strong review");
assert(missingAccountLunch.account === null, "expected missing account to stay null");
assert(
  !ledger.heartbeat.pending_review_ids.includes(missingAccountLunch.id),
  "expected small clear expense not to enter pending review"
);
assert(merchantCoffeeOutput.includes("已记录：咖啡 ¥18"), "expected merchant cue coffee confirmation");
assert(!merchantCoffeeOutput.includes("品牌"), "expected no brand dimension in confirmation");
assert(merchantCoffee.category_l1 === "餐饮", "expected merchant cue coffee category_l1");
assert(merchantCoffee.category_l2 === "咖啡", "expected merchant cue coffee category_l2");
assert(merchantCoffee.category === "咖啡", "expected merchant cue coffee compatibility category");
assert(!("brand" in merchantCoffee), "expected no brand field in event");
assert(!("merchant" in merchantCoffee), "expected no merchant field in event");
assert(merchantCoffee.account === null, "expected merchant cue coffee not to guess account");
assert(dailyCoffeeCountBudgetOutput.includes("已设置：咖啡每日最多 2 笔"), "expected daily count budget confirmation");
assert(dailyCoffeeBudget.budget_rule.limit_type === "count_per_day", "expected count-per-day budget rule");
assert(dailyCoffeeBudget.budget_rule.count === 2, "expected daily count budget limit");
assert(dailySummary.includes("咖啡每日笔数"), "expected daily count budget in summary");
assert(
  recurringPaymentOutput.includes("一次性") && recurringPaymentOutput.includes("每月"),
  "expected recurring payment question"
);
assert(unclearElectricityBill.status === "needs_review", "expected electricity recurrence review");
assert(
  unclearElectricityBill.review.reasons.includes("recurrence_unclear"),
  "expected recurrence_unclear review reason"
);
assert(unclearElectricityBill.due_at, "expected tomorrow due date for electricity bill");
assert(fuzzyRecurringPaymentOutput.includes("一次性") && fuzzyRecurringPaymentOutput.includes("每月"), "expected fuzzy recurring payment question");
assert(
  ledger.events.some(
    (event) =>
      event.source.raw_text === "明天可能要交电费50" &&
      event.type === "bill_due" &&
      event.status === "needs_review" &&
      event.review.reasons.includes("recurrence_unclear")
  ),
  "expected fuzzy future payment to be recorded for review"
);
assert(duplicateBreakfastOutput.includes("疑似重复，未写入"), "expected duplicate breakfast skip output");
assert(breakfastEvents.length === 1, "expected duplicate breakfast not to be written");
assert(invalidDateOutput.includes("日期不明确或无效"), "expected invalid date correction question");
assert(invalidMonthOutput.includes("日期不明确或无效"), "expected invalid month correction question");
assert(
  invalidDateEvents.length === 2 &&
  invalidDateEvents.every((event) => event.occurred_at === null && event.review.reasons.includes("date_missing")),
  "expected invalid dates to be stored without bogus occurred_at"
);
assert(report.usage.records_created === 6, "expected 6 report records");
assert(report.test_id === "anon_smoke", "expected smoke test id");
assert(rawEvents.includes("今天早餐 12"), "expected raw input event log");
assert(rawEvents.includes("微信余额 200，银行卡 3200"), "expected raw balance event log");
assert(backupFiles.length > 0, "expected backup files");
assert(backupList.includes("可用账本备份"), "expected backup list output");
assert(dailySummary.includes("📊"), "expected visual summary title");
assert(dailySummary.includes("预算："), "expected budget line in daily summary");
assert(dailySummary.includes("█") && dailySummary.includes("░"), "expected text progress bars");
assert(dailySummary.includes("外卖"), "expected dining budget category in daily summary");
assert(dailySummary.includes("高频消费"), "expected frequent expense section");
assert(dailySummary.includes("高频低值消费"), "expected low-value frequent expense section");
assert(dailySummary.includes("重点提醒"), "expected key reminder section in daily summary");
assert(dailySummary.includes("次"), "expected frequent expense count");
assert(dailySummary.includes("明日需支出"), "expected tomorrow due section");
assert(dailySummary.includes("生活缴费"), "expected tomorrow due item");
assert(weeklySummary.includes("高频消费"), "expected frequent expense section in weekly summary");
assert(monthlySummary.includes("高频消费"), "expected frequent expense section in monthly summary");
assert(weeklySummary.includes("高频低值消费"), "expected low-value frequent expense section in weekly summary");
assert(monthlySummary.includes("高频低值消费"), "expected low-value frequent expense section in monthly summary");
assert(weeklySummary.includes("重点提醒"), "expected key reminder section in weekly summary");
assert(monthlySummary.includes("重点提醒"), "expected key reminder section in monthly summary");
assert(
  ledger.profile.behavior_patterns.some((pattern) => pattern.label.includes("餐饮")),
  "expected dining behavior pattern after 3+ dining records"
);
assert(!cashflowSummary.includes("- 暂无明显行为标签。"), "expected behavior pattern lines in cashflow summary");
assert(dailySummary.includes("⚠️ 待复核"), "expected pending review line");
assert(dailySummary.includes("⏰ 未来提醒"), "expected upcoming reminder line");
assert(!containsNoisyOutput(combinedOutput), "expected no process or technical chatter");

const schema = JSON.parse(await readFile(projectPath("schemas", "ledger.schema.json"), "utf8"));
assert(
  schema.$defs.event.properties.review.properties.reasons.items.enum.includes("possible_duplicate"),
  "expected possible_duplicate in ledger schema"
);
const sampleLedger = JSON.parse(
  await readFile(projectPath("skills", "yin-yan", "assets", "sample-ledger.json"), "utf8")
);
assert(sampleLedger.profile, "expected packaged sample ledger profile");

for (const queryText of [
  "这个月预算还剩多少",
  "工资到账了吗",
  "最近吃饭有点多吗",
  "我没有花钱，只是测试一下",
  "不要清空账本，我只是问怎么备份",
  "下周不需要还信用卡了"
]) {
  const before = JSON.parse(await readFile(ledgerPath, "utf8")).events.length;
  const output = await run(queryText);
  const after = JSON.parse(await readFile(ledgerPath, "utf8")).events.length;
  assert(before === after, `expected no ledger write for query: ${queryText}`);
  assert(!output.includes("已记录："), `expected no record confirmation for query: ${queryText}`);
  assert(!output.includes("已记录余额："), `expected no balance confirmation for query: ${queryText}`);
}

const clearWarning = await run("清空账本");
const afterWarningLedger = JSON.parse(await readFile(ledgerPath, "utf8"));
assert(clearWarning.includes("确认清空账本"), "expected clear confirmation prompt");
assert(afterWarningLedger.events.length === 24, "expected clear warning to keep ledger");

const clearOutput = await run("确认清空账本");
const clearedLedger = JSON.parse(await readFile(ledgerPath, "utf8"));
assert(clearOutput.includes("已清空账本"), "expected confirmed clear output");
assert(clearedLedger.events.length === 0, "expected confirmed clear to empty ledger");

const restoreWarning = await run("恢复最近备份");
const afterRestoreWarningLedger = JSON.parse(await readFile(ledgerPath, "utf8"));
assert(restoreWarning.includes("确认恢复最近备份"), "expected restore confirmation prompt");
assert(afterRestoreWarningLedger.events.length === 0, "expected restore warning to keep cleared ledger");

await run("确认恢复最近备份");
const restoredLedger = JSON.parse(await readFile(ledgerPath, "utf8"));
assert(restoredLedger.events.length === 24, "expected restore to pre-clear backup");

await run("初始化账本", [], lowReviewLedgerPath);
await run("今天打车 35", [], lowReviewLedgerPath);
await run("昨天外卖 45", [], lowReviewLedgerPath);
await run("前天外卖 39", [], lowReviewLedgerPath);
const lowReviewLedger = JSON.parse(await readFile(lowReviewLedgerPath, "utf8"));
assert(lowReviewLedger.events.length === 3, "expected low-review ledger events");
assert(
  lowReviewLedger.events.every((event) => event.status === "confirmed"),
  "expected small clear missing-account expenses to stay confirmed"
);
assert(
  lowReviewLedger.heartbeat.pending_review_ids.length === 0,
  "expected small clear missing-account expenses not to enter heartbeat pending review"
);

await writeTestFile(ledgerPath, "{bad json");
const badJsonResult = await runExpectFailure("今天午饭 12");
assert(badJsonResult.stderr.includes("账本 JSON 损坏"), "expected friendly bad JSON message");
assert(badJsonResult.stderr.includes("查看备份"), "expected backup recovery hint for bad JSON");
assert(badJsonResult.stderr.includes("确认恢复最近备份"), "expected restore instruction with backups");
assert(!badJsonResult.stderr.includes("SyntaxError"), "expected no raw SyntaxError stack for bad JSON");

await writeTestFile(badNoBackupLedgerPath, "{bad json");
const badNoBackupResult = await runExpectFailure("今天午饭 12", [], badNoBackupLedgerPath);
assert(badNoBackupResult.stderr.includes("账本 JSON 损坏"), "expected bad JSON message without backups");
assert(badNoBackupResult.stderr.includes("当前没有检测到可用备份"), "expected no-backup recovery message");
assert(badNoBackupResult.stderr.includes("手动复制并保存这个损坏文件"), "expected manual copy hint");
assert(!badNoBackupResult.stderr.includes("确认恢复最近备份"), "expected no restore instruction without backups");

await writeTestFile(
  pastDueLedgerPath,
  `${JSON.stringify({
    schema_version: "0.1",
    currency: "CNY",
    events: [
      {
        id: "evt_past_due",
        source: {
          channel: "manual",
          raw_text: "过期账单",
          received_at: `${relativeDate(-2)}T00:00:00.000Z`
        },
        type: "bill_due",
        status: "confirmed",
        occurred_at: null,
        due_at: relativeDate(-1),
        amount: 999,
        currency: "CNY",
        direction: "outflow",
        account: "银行卡",
        category: "还款",
        confidence: { overall: 0.9, fields: {} },
        review: { required: false, reasons: [] },
        tags: [],
        notes: ""
      }
    ],
    entities: { accounts: [], categories: [] },
    heartbeat: { pending_review_ids: [], scheduled_item_ids: [] },
    profile: {}
  }, null, 2)}\n`
);
const pastDueCashflow = await run("现金流心跳", [], pastDueLedgerPath);
assert(!pastDueCashflow.includes("¥999"), "expected overdue due item not to be counted as future spend");

await writeTestFile(
  badReportLedgerPath,
  `${JSON.stringify({ schema_version: "0.1", currency: "CNY", events: [], entities: { accounts: [], categories: [] }, heartbeat: { pending_review_ids: [], scheduled_item_ids: [] } }, null, 2)}\n`
);
const badReportResult = await runNodeExpectFailure([
  reportScriptPath,
  "--ledger",
  badReportLedgerPath,
  "--output",
  reportPath
]);
assert(badReportResult.stderr.includes("缺少 profile 对象"), "expected report schema contract failure");

await rm(testRoot, { recursive: true, force: true });
console.log("Smoke test passed.");

async function run(text, extraArgs = [], targetLedger = ledgerPath) {
  const args = [
    runCommandPath,
    "--ledger",
    targetLedger,
    "--text",
    text,
    ...extraArgs
  ];
  return await runNode(args);
}

async function runExpectFailure(text, extraArgs = [], targetLedger = ledgerPath) {
  const args = [
    runCommandPath,
    "--ledger",
    targetLedger,
    "--text",
    text,
    ...extraArgs
  ];
  return await runNodeExpectFailure(args);
}

async function runHeartbeat(type) {
  const args = [
    runCommandPath,
    "--ledger",
    ledgerPath,
    "--heartbeat",
    type
  ];
  return await runNode(args);
}

function runNode(args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise(stdout);
      } else {
        rejectPromise(new Error(`Command failed: ${args.join(" ")}\n${stderr}`));
      }
    });
  });
}

function runNodeExpectFailure(args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("exit", (code) => {
      if (code !== 0) {
        resolvePromise({ code, stdout, stderr });
      } else {
        rejectPromise(new Error(`Expected command to fail: ${args.join(" ")}\n${stdout}`));
      }
    });
  });
}

async function writeTestFile(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function relativeDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function containsNoisyOutput(text) {
  return [
    "任务准备",
    "调度完成",
    "正在生成回复",
    "请求",
    "我来",
    "Recorded",
    "Pending reviews",
    "Reasons:",
    "evt_"
  ].some((pattern) => text.includes(pattern));
}
