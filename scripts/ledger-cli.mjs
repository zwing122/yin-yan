import {
  appendFile,
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
const input = args.text ?? args._.slice(1).join(" ").trim();
const ledgerPath = args.ledger
  ? resolve(process.cwd(), args.ledger)
  : resolve(rootDir, "data", "ledger.json");
const dataDir = dirname(ledgerPath);
const backupDir = resolve(dataDir, "backups");
const rawEventsPath = resolve(dataDir, "raw-events.ndjson");
const maxBackupFiles = 50;
const staleLockMs = 10 * 60 * 1000;

if (!command) {
  printUsage();
  process.exit(1);
}

await mkdir(dataDir, { recursive: true });

try {
  await withLedgerLock(async () => {
    switch (command) {
      case "init":
        await handleInit();
        break;
      case "clear":
        await handleClear(input);
        break;
      case "record":
        await handleRecord("expense", input);
        break;
      case "remind":
        await handleRecord("bill_due", input);
        break;
      case "fixed":
        await handleRecord("fixed_cost", input);
        break;
      case "goal":
        await handleRecord("goal", input);
        break;
      case "balance":
        await handleRecord("account_balance", input);
        break;
      case "asset":
        await handleAssetTracking(input);
        break;
      case "review":
        await handleReview();
        break;
      case "today":
        await handleToday();
        break;
      case "week":
        await handleWeek();
        break;
      case "month":
        await handleMonth();
        break;
      case "cashflow":
        await handleCashflowSummary();
        break;
      case "share-error":
        await handleShareError();
        break;
      case "export":
        console.log(ledgerPath);
        break;
      case "backups":
        await handleBackups();
        break;
      case "restore":
        await handleRestore(input || args.from || "latest");
        break;
      case "heartbeat":
        await handleHeartbeat(args.type ?? input ?? "reminder");
        break;
      default:
        printUsage();
        process.exit(1);
    }
  });
} catch (error) {
  console.error(formatUserFacingError(error));
  process.exit(1);
}

async function handleInit() {
  if (await fileExists(ledgerPath)) {
    const ledger = await readLedger({ createIfMissing: false });
    const count = countEvents(ledger);
    if (!args.force && count > 0) {
      console.log(`账本已存在：${ledgerPath}`);
      console.log(`当前记录数：${count}`);
      console.log("已停止初始化，避免清空已有账本。如确实要重置，请先备份并使用 init --force。");
      return;
    }
    if (!args.force && count === 0) {
      console.log(`账本已存在：${ledgerPath}`);
      await writeLedger(createEmptyLedger(), { allowReset: true, skipBackup: true });
      console.log("当前账本为空，已修复为可用账本。");
      console.log("");
      console.log(renderFirstUseSetupPrompt());
      return;
    }
  }

  await writeLedger(createEmptyLedger(), { allowReset: true });
  console.log("账本已初始化。");
  console.log("");
  console.log(renderFirstUseSetupPrompt());
}

async function handleClear(text) {
  const normalized = normalizeText(text);
  const confirmed = args.confirm === true || normalized === normalizeText("确认清空账本");
  const ledger = await readLedger({ createIfMissing: false });
  const count = countEvents(ledger);

  if (!confirmed) {
    console.log(`清空账本会删除当前 ${count} 条记录。`);
    console.log("系统会先生成本地备份，但不会自动上传或同步。");
    console.log("如果确定要清空，请发送：确认清空账本");
    return;
  }

  await appendRawEvent({ command: "clear", text: text || "确认清空账本" });
  await writeLedger(createEmptyLedger(), { allowEventDrop: true, source: "clear" });
  console.log(`已清空账本。清空前记录数：${count}`);
  console.log("清空前账本已保存到 backups，可发送“查看备份”或“恢复最近备份”。");
}

async function handleRecord(mode, text) {
  if (!text) {
    throw new Error("Missing text. Use --text or provide input after the command.");
  }

  const ledger = await readLedger();
  const isFirstRecord = countEvents(ledger) === 0;
  const recordText = stripDuplicateKeepPrefix(text);
  const allowDuplicate = args.allowDuplicate === true || recordText !== text;
  await appendRawEvent({ command: mode, text });
  if (mode === "account_balance") {
    const balanceDrafts = await parseAccountBalanceDrafts(recordText, ledger, { allowDuplicate });
    if (balanceDrafts.length >= 1) {
      const newEvents = balanceDrafts.filter((draft) => !draft.review.reasons.includes("possible_duplicate"));
      if (newEvents.length === 0) {
        console.log("疑似重复，未写入；如需保留，请补充“这是另一笔”后重新发送。");
        return;
      }
      for (const draft of newEvents) {
        ledger.events.push(draft);
        upsertEntity(ledger.entities.accounts, draft.account);
        upsertEntity(ledger.entities.categories, draft.category);
      }
      refreshHeartbeat(ledger);
      await writeLedger(ledger);
      console.log(newEvents.length > 1 ? renderMultiBalanceConfirmation(newEvents) : renderConfirmation(newEvents[0]));
      if (isFirstRecord) {
        console.log("");
        console.log(renderFirstRecordSetupPrompt());
      }
      return;
    }
  }
  const assetAction = detectAssetTrackingAction(recordText);
  if (assetAction) {
    const result = applyAssetTrackingAction(ledger, assetAction, recordText);
    if (result.handled) {
      refreshHeartbeat(ledger);
      await writeLedger(ledger);
      console.log(result.message);
      return;
    }
  }

  const event = await parseDraftEvent(mode, recordText, ledger, { allowDuplicate });
  if (event.review.reasons.includes("possible_duplicate")) {
    console.log("疑似重复，未写入；如需保留，请补充“这是另一笔”后重新发送。");
    return;
  }
  const assetTracking = inferAssetTrackingCandidate(event, recordText, ledger);
  if (assetTracking) {
    event.asset_tracking = assetTracking;
  }
  ledger.events.push(event);
  upsertEntity(ledger.entities.accounts, event.account);
  upsertEntity(ledger.entities.categories, event.category);
  refreshHeartbeat(ledger);
  await writeLedger(ledger);

  if (event.review.required) {
    console.log(renderReviewQuestion(event));
    if (isFirstRecord) {
      console.log("");
      console.log(renderFirstRecordSetupPrompt());
    }
    return;
  }

  console.log(renderConfirmation(event));
  const assetHint = renderAssetTrackingCandidateHint(event);
  if (assetHint) {
    console.log(assetHint);
  }
  if (isFirstRecord) {
    console.log("");
    console.log(renderFirstRecordSetupPrompt());
  }
}

async function handleAssetTracking(text) {
  if (!text) {
    throw new Error("Missing text. Use --text or provide input after the command.");
  }

  const ledger = await readLedger();
  await appendRawEvent({ command: "asset", text });
  const action = detectAssetTrackingAction(text);
  if (!action) {
    console.log("没有识别到大额消费追踪动作。可以说：这个耳机开始追踪、耳机今天用了、耳机闲置了、这个不追踪。");
    return;
  }

  const result = applyAssetTrackingAction(ledger, action, text);
  if (!result.handled) {
    console.log(result.message);
    return;
  }

  refreshHeartbeat(ledger);
  await writeLedger(ledger);
  console.log(result.message);
}

async function handleReview() {
  const ledger = await readLedger();
  const pending = ledger.events.filter((event) => event.status === "needs_review");

  if (pending.length === 0) {
    console.log("当前没有待复核记录。");
    return;
  }

  console.log(`待复核：${pending.length} 条`);
  for (const [index, event] of pending.entries()) {
    console.log(`${index + 1}. ${event.source.raw_text}`);
    console.log(renderReviewQuestion(event));
  }
}

async function handleToday() {
  const ledger = await readLedger();
  const today = currentDate();
  const events = ledger.events.filter((event) => event.occurred_at === today);
  console.log(renderSummary("今日摘要（仅基于已记录数据）", events, ledger));
}

async function handleWeek() {
  const ledger = await readLedger();
  const recent = ledger.events.filter((event) => withinLastDays(event, 7));
  console.log(renderSummary("本周复盘（仅基于已记录数据）", recent, ledger));
}

async function handleMonth() {
  const ledger = await readLedger();
  const events = ledger.events.filter((event) => inCurrentMonth(event));
  console.log(renderSummary("本月复盘（仅基于已记录数据）", events, ledger));
}

async function handleCashflowSummary() {
  const ledger = await readLedger();
  console.log(renderCashflowSummary(ledger));
}

async function handleShareError() {
  console.log(`解析错误反馈：

原句脱敏版：
今天[餐饮] 38，[账户]付的

系统识别：
类型：
金额：
分类：
账户：
是否要求复核：

正确结果：
类型：
金额：
分类：
账户：
是否应该复核：

备注：`);
}

async function handleBackups() {
  const backups = await listBackups();
  if (backups.length === 0) {
    console.log("当前没有可用账本备份。");
    return;
  }

  console.log("可用账本备份：");
  for (const [index, backup] of backups.slice(0, 10).entries()) {
    console.log(`${index + 1}. ${backup.name}，记录数：${backup.eventCount}，路径：${backup.path}`);
  }
}

async function handleRestore(target) {
  const backups = await listBackups();
  if (backups.length === 0) {
    console.log("当前没有可恢复备份。");
    return;
  }

  const confirmed = args.confirm === true || normalizeText(target) === normalizeText("确认恢复最近备份");
  if (!confirmed) {
    const latest = backups[0];
    console.log("恢复备份会用历史账本覆盖当前账本。");
    console.log(`最近备份：${latest.name}，记录数：${latest.eventCount}`);
    console.log("如果确定要恢复，请发送：确认恢复最近备份");
    return;
  }

  const selected = selectBackup(backups, "latest");
  if (!selected) {
    console.log("没有找到最近备份。");
    await handleBackups();
    return;
  }

  await writeLedger(selected.ledger, { allowEventDrop: true, source: "restore" });
  console.log(`已恢复备份：${selected.name}`);
  console.log(`恢复后记录数：${countEvents(selected.ledger)}`);
}

async function handleHeartbeat(type) {
  const normalized = String(type || "reminder").trim();
  if (["daily", "daily-summary", "today"].includes(normalized)) {
    await handleToday();
    return;
  }
  if (["weekly", "weekly-summary", "week"].includes(normalized)) {
    await handleWeek();
    return;
  }
  if (["monthly", "monthly-summary", "month"].includes(normalized)) {
    await handleMonth();
    return;
  }
  if (["cashflow", "cashflow-summary", "cashflow-heartbeat"].includes(normalized)) {
    await handleCashflowSummary();
    return;
  }
  await handleScheduledReminders(normalized);
}

async function handleScheduledReminders(type) {
  const ledger = await readLedger();
  const horizonDays = type === "upcoming" ? 7 : 0;
  const dueEvents = ledger.events
    .filter((event) => event.due_at && event.status !== "ignored")
    .filter((event) => withinNextDays(event, horizonDays))
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));
  const pendingEvents = ledger.events.filter((event) => event.status === "needs_review");
  const assetReviewLines = renderAssetReviewLines(ledger);
  const budgetLines = renderBudgetAlerts(ledger);
  const spendingSignalLines = renderSpendingSignalReminderLines(ledger);
  const completionLines = renderLedgerCompletionReminders(ledger);
  const cashflowLines = renderCashflowRiskLines(ledger);
  const spendingSignalSection = spendingSignalLines === "- 无" ? "" : `\n重点提醒：\n${spendingSignalLines}\n`;

  if (dueEvents.length === 0 && pendingEvents.length === 0 && assetReviewLines === "- 无" && budgetLines === "- 无" && spendingSignalLines === "- 无" && completionLines === "- 无" && cashflowLines === "- 无") {
    console.log("银砚提醒（仅基于已记录数据）\n\n当前没有到期财务提醒、待复核记录或大额消费复核。");
    return;
  }

  const dueLines = dueEvents.map(renderReminderLine).join("\n") || "- 无";
  const reviewLines = pendingEvents
    .slice(0, 5)
    .map((event) => `- ${event.source.raw_text}`)
    .join("\n") || "- 无";

  console.log(`银砚提醒（仅基于已记录数据）

到期或即将到期：
${dueLines}

待复核：
${reviewLines}

大额消费复核：
${assetReviewLines}

预算提醒：
${budgetLines}
${spendingSignalSection}

现金流提示：
${cashflowLines}

补录建议：
${completionLines}`);
}

function renderSummary(title, events, ledger) {
  const expenseTotal = sumAmounts(events.filter((event) => event.type === "expense"));
  const incomeTotal = sumAmounts(events.filter((event) => event.type === "income"));
  const fixedCostTotal = sumAmounts(
    ledger.events.filter(
      (event) => event.type === "fixed_cost" && isRelevantForCurrentWindow(event, title)
    )
  );
  const pendingCount = ledger.heartbeat.pending_review_ids.length;
  const upcomingCount = ledger.heartbeat.scheduled_item_ids.length;
  const categoryLines = renderCategoryBars(events);
  const budgetProgress = renderBudgetProgressBars(ledger);
  const frequentExpenseLines = renderFrequentExpenseLines(events);
  const lowValueFrequentLines = renderLowValueFrequentExpenseLines(events);
  const spendingSignalLines = renderSpendingSignalLines(ledger, { includeMedium: true });
  const spendingSignalSection = spendingSignalLines === "- 无" ? "" : `\n重点提醒：\n${spendingSignalLines}\n`;
  const tomorrowDueLines = renderTomorrowDueLines(ledger);
  const cashflowSnapshot = renderCashflowSnapshot(ledger);
  const profileCompleteness = renderProfileCompleteness(ledger);
  const profileHint = renderProfileHint(ledger);
  const upcomingLine = renderUpcomingSummary(ledger);
  const note = renderSummaryNote(events);

  return `📊 ${title}
仅基于已记录数据

支出合计：${formatMoney(expenseTotal)}
收入合计：${formatMoney(incomeTotal)}
固定支出：${formatMoney(fixedCostTotal)}

${budgetProgress}

${categoryLines}

高频消费：
${frequentExpenseLines}

高频低值消费：
${lowValueFrequentLines}
${spendingSignalSection}

明日需支出：
${tomorrowDueLines}

现金流画像：
${profileCompleteness}
${cashflowSnapshot}
${profileHint}

⚠️ 待复核：${pendingCount} 条
⏰ 未来提醒：${upcomingCount} 条${upcomingLine ? `，${upcomingLine}` : ""}
${note}`;
}

async function parseDraftEvent(mode, text, ledger, options = {}) {
  const now = new Date();
  const budgetRule = mode === "goal" ? inferBudgetRule(text) : null;
  const amount = budgetRule?.limit_type === "count_per_day" ? null : inferAmount(mode, text);
  const account = inferAccount(text, ledger, mode);
  const categoryInfo = await inferCategoryInfo(mode, text);
  const category = categoryInfo.category;
  const type = inferType(mode, text);
  const dueAt = type === "bill_due" || type === "fixed_cost" ? inferDueDate(text, now) : null;
  const occurredAt = hasOccurredDate(type)
    ? inferOccurredDate(text, now)
    : null;
  const direction = inferDirection(type);
  const transaction = inferTransaction({ text, type, account, category });
  const reviewReasons = inferReviewReasons({ text, amount, dueAt, occurredAt, account, category, categoryInfo, type, budgetRule });
  const isDuplicate = !options.allowDuplicate && isPossibleDuplicate(ledger, {
    type,
    occurredAt,
    dueAt,
    amount,
    account,
    category,
    rawText: text
  });
  if (isDuplicate) {
    reviewReasons.push("possible_duplicate");
  }
  const uniqueReviewReasons = Array.from(new Set(reviewReasons));
  const strongReviewReasons = strongReviewReasonsFor({
    text,
    amount,
    account,
    category,
    type,
    reasons: uniqueReviewReasons
  });
  const needsReview = strongReviewReasons.length > 0;

  return {
    id: `evt_${Date.now()}`,
    source: {
      channel: "manual",
      raw_text: text,
      received_at: now.toISOString()
    },
    type,
    status: needsReview ? "needs_review" : "confirmed",
    occurred_at: occurredAt,
    due_at: dueAt,
    amount,
    currency: "CNY",
    direction,
    account,
    category,
    category_l1: categoryInfo.category_l1,
    category_l2: categoryInfo.category_l2,
    budget_rule: budgetRule,
    transaction,
    asset_tracking: null,
    confidence: {
      overall: needsReview ? 0.72 : 0.9,
      fields: {
        amount: amount === null ? 0.1 : 0.99,
        due_at: dueAt ? 0.85 : 0.3,
        account: account ? 0.8 : 0.2,
        category: category ? 0.8 : 0.2
      }
    },
    review: {
      required: needsReview,
      reasons: strongReviewReasons
    },
    tags: inferTags(text),
    notes: ""
  };
}

function inferType(mode, text) {
  if (mode === "account_balance") {
    return "account_balance";
  }
  if (mode !== "expense") {
    return mode;
  }

  if (isPaydayIncomeText(text) || containsAny(text, ["工资", "收入", "收款", "收到"])) {
    return "income";
  }
  if (containsAny(text, ["退款", "退了"])) {
    return "refund";
  }
  if (containsAny(text, ["报销", "垫付"])) {
    return "reimbursement";
  }
  if (containsAny(text, ["还信用卡", "还花呗", "还款"])) {
    return "bill_due";
  }
  if (containsAny(text, ["转账", "提现", "转入", "转出", "转到", "转至", "转给"])) {
    return "transfer";
  }
  return "expense";
}

function hasOccurredDate(type) {
  return ["expense", "income", "refund", "reimbursement", "transfer", "goal", "account_balance"].includes(type);
}

function detectAssetTrackingAction(text) {
  if (containsAny(text, ["开始追踪", "继续追踪", "追踪一下"])) {
    return { kind: "start", itemName: inferAssetItemName(text), expectedUseDays: inferExpectedUseDays(text) };
  }
  if (hasTrackableItemKeyword(text) && containsAny(text, ["预计", "打算"]) && containsAny(text, ["用", "学完", "练完", "看完"])) {
    return { kind: "start", itemName: inferAssetItemName(text), expectedUseDays: inferExpectedUseDays(text) };
  }
  if (containsAny(text, ["不追踪", "不用追踪", "别追踪"])) {
    return { kind: "ignore", itemName: inferAssetItemName(text) };
  }
  if (containsAny(text, ["退货", "退了"])) {
    return { kind: "returned", itemName: inferAssetItemName(text) };
  }
  if (containsAny(text, ["转卖", "卖掉", "二手卖"])) {
    return { kind: "resold", itemName: inferAssetItemName(text) };
  }
  if (containsAny(text, ["闲置", "吃灰"])) {
    return { kind: "idle", itemName: inferAssetItemName(text) };
  }
  if (looksLikeAssetMention(text)) {
    return { kind: "mention", itemName: inferAssetItemName(text) };
  }
  return null;
}

function inferDirection(type) {
  if (type === "income" || type === "refund") {
    return "inflow";
  }
  if (type === "transfer") {
    return "internal";
  }
  if (type === "goal" || type === "account_balance") {
    return "none";
  }
  return "outflow";
}

function inferTransaction({ text, type, account, category }) {
  const kind = transactionKind(type);
  const transferAccounts = type === "transfer" ? inferTransferAccounts(text) : { source: null, destination: null };
  const sourceAccount = transferAccounts.source || (kind === "withdrawal" || kind === "transfer" ? account : null);
  const destinationAccount = transferAccounts.destination ||
    (kind === "deposit" ? account : kind === "withdrawal" ? inferCounterparty(text, category) : null);
  const counterparty = kind === "transfer" ? null : inferCounterparty(text, category);
  return {
    kind,
    source_account: sourceAccount,
    destination_account: destinationAccount,
    counterparty,
    is_internal_transfer: kind === "transfer",
    firefly_iii: {
      type: fireflyTransactionType(kind),
      notes: fireflyMappingNotes(kind)
    }
  };
}

function transactionKind(type) {
  if (type === "income" || type === "refund" || type === "reimbursement") return "deposit";
  if (type === "transfer") return "transfer";
  if (type === "bill_due" || type === "fixed_cost" || type === "subscription") return "bill";
  if (type === "goal") return "budget";
  if (type === "account_balance") return "balance";
  if (type === "expense" || type === "loan") return "withdrawal";
  return "unknown";
}

function fireflyTransactionType(kind) {
  if (kind === "withdrawal" || kind === "bill") return "withdrawal";
  if (kind === "deposit") return "deposit";
  if (kind === "transfer") return "transfer";
  if (kind === "balance") return "opening_balance";
  return null;
}

function fireflyMappingNotes(kind) {
  if (kind === "transfer") return "可映射为 Firefly III transfer，需要 source/destination 两个资产账户。";
  if (kind === "withdrawal" || kind === "bill") return "可映射为 Firefly III withdrawal，destination 可作为商户或费用账户参考。";
  if (kind === "deposit") return "可映射为 Firefly III deposit，source 可作为付款方或收入来源参考。";
  if (kind === "balance") return "可映射为 Firefly III opening balance 或余额校准记录。";
  return "暂未映射。";
}

function inferTransferAccounts(text) {
  const accountNames = ["微信", "微信支付", "支付宝", "银行卡", "招商卡", "招行", "信用卡", "现金"];
  const found = accountNames.filter((name) => text.includes(name));
  if (found.length >= 2) {
    return { source: normalizeAccountName(found[0]), destination: normalizeAccountName(found[1]) };
  }
  const toMatch = text.match(/(?:从|由)(.{1,8}?)(?:转到|转入|到|至)(.{1,8}?)(?:\s|$|，|,|。)/);
  if (toMatch) {
    return { source: normalizeAccountName(toMatch[1]), destination: normalizeAccountName(toMatch[2]) };
  }
  return { source: normalizeAccountName(found[0] || null), destination: null };
}

function inferCounterparty(text, category) {
  const merchantMatch = text.match(/(?:在|去)([^，,。 ]{2,12})(?:花|消费|买|吃|喝)/);
  if (merchantMatch) return merchantMatch[1];
  if (containsAny(text, ["星巴克"])) return "星巴克";
  if (containsAny(text, ["麦当劳"])) return "麦当劳";
  if (containsAny(text, ["瑞幸"])) return "瑞幸";
  if (containsAny(text, ["美团", "饿了么", "外卖"])) return "外卖平台";
  if (containsAny(text, ["信用卡"])) return "信用卡";
  if (containsAny(text, ["花呗"])) return "花呗";
  return category || null;
}

function normalizeAccountName(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (trimmed === "招行") return "招商卡";
  return trimmed.replace(/余额$/, "");
}

async function inferCategory(mode, text) {
  return (await inferCategoryInfo(mode, text)).category;
}

async function inferCategoryInfo(mode, text) {
  const ruleCategory = inferRuleCategoryInfo(mode, text);
  if (ruleCategory.category !== "未分类") return ruleCategory;

  return ruleCategory;
}

function inferRuleCategoryInfo(mode, text) {
  if (mode === "goal") {
    return inferBudgetCategoryInfo(text);
  }
  if (mode === "fixed_cost") {
    if (containsAny(text, ["房租"])) return categoryInfo("住房", "房租");
    if (containsAny(text, ["套餐", "话费"])) return categoryInfo("生活", "通信");
    if (containsAny(text, ["云", "服务器"])) return categoryInfo("工作", "云服务");
    return categoryInfo("固定支出", "固定支出");
  }
  if (mode === "account_balance") return categoryInfo("资产", "账户余额");

  const merchantCategory = inferMerchantCategory(text);
  if (merchantCategory) {
    return categoryInfo(merchantCategory.category_l1, merchantCategory.category_l2);
  }

  if (containsAny(text, ["外卖", "美团外卖", "饿了么"])) return categoryInfo("餐饮", "外卖");
  if (containsAny(text, ["咖啡"])) return categoryInfo("餐饮", "咖啡");
  if (containsAny(text, ["奶茶", "茶饮", "果茶"])) return categoryInfo("餐饮", "茶饮");
  if (containsAny(text, ["饮料", "可乐", "矿泉水", "瓶装水"])) return categoryInfo("餐饮", "饮料");
  if (containsAny(text, ["小吃", "夜宵", "炸鸡", "烧烤", "关东煮"])) return categoryInfo("餐饮", "小吃");
  if (containsAny(text, ["零食", "薯片", "便利店"])) return categoryInfo("餐饮", "零食饮料");
  if (containsAny(text, ["午饭", "午餐", "晚饭", "晚餐", "早餐", "早饭", "餐饮", "食堂", "聚餐"])) return categoryInfo("餐饮", "正餐");
  if (containsAny(text, ["打车", "地铁", "公交"])) return categoryInfo("交通", "市内交通");
  if (containsAny(text, ["房租", "租金"])) return categoryInfo("住房", "房租");
  if (containsAny(text, ["电费", "水费", "燃气", "物业费", "宽带", "网费"])) return categoryInfo("生活", "生活缴费");
  if (containsAny(text, ["工资", "收入", "收款", "收到"])) return categoryInfo("收入", "工资收入");
  if (containsAny(text, ["信用卡", "花呗", "还款"])) return categoryInfo("负债", "还款");
  if (containsAny(text, ["退款"])) return categoryInfo("调整", "退款");
  if (containsAny(text, ["报销", "垫付"])) return categoryInfo("调整", "报销");
  if (containsAny(text, ["订阅", "套餐"])) return categoryInfo("生活", "订阅");
  return mode === "bill_due" ? categoryInfo("待付款", "待付款") : categoryInfo(null, null);
}

function inferBudgetCategory(text) {
  return inferBudgetCategoryInfo(text).category;
}

function inferBudgetCategoryInfo(text) {
  const category = inferRuleCategoryInfo("expense", text);
  if (category.category) return category;
  if (containsAny(text, ["交通"])) return categoryInfo("交通", "市内交通");
  if (containsAny(text, ["娱乐", "电影", "游戏"])) return categoryInfo("娱乐", "娱乐");
  if (containsAny(text, ["日用品", "超市"])) return categoryInfo("生活", "日用品");
  if (containsAny(text, ["手机", "话费", "套餐"])) return categoryInfo("生活", "通信");
  return categoryInfo("消费目标", "消费目标");
}

function categoryInfo(categoryL1, categoryL2, extra = {}) {
  return {
    category_l1: categoryL1,
    category_l2: categoryL2,
    category: categoryL2 || categoryL1 || "未分类"
  };
}

function inferMerchantCategory(text) {
  return merchantCategoryCatalog().find((item) => item.aliases.some((alias) => text.includes(alias))) ?? null;
}

function merchantCategoryCatalog() {
  return [
    merchantCategoryRule(["瑞幸", "luckin", "luckin coffee"], "餐饮", "咖啡"),
    merchantCategoryRule(["库迪", "cotti", "cotti coffee"], "餐饮", "咖啡"),
    merchantCategoryRule(["星巴克", "starbucks"], "餐饮", "咖啡"),
    merchantCategoryRule(["Manner", "manner"], "餐饮", "咖啡"),
    merchantCategoryRule(["蓝瓶", "Blue Bottle", "blue bottle"], "餐饮", "咖啡"),
    merchantCategoryRule(["Tims", "tims", "天好咖啡"], "餐饮", "咖啡"),
    merchantCategoryRule(["喜茶"], "餐饮", "茶饮"),
    merchantCategoryRule(["奈雪", "奈雪的茶"], "餐饮", "茶饮"),
    merchantCategoryRule(["霸王茶姬"], "餐饮", "茶饮"),
    merchantCategoryRule(["茶百道"], "餐饮", "茶饮"),
    merchantCategoryRule(["蜜雪冰城", "蜜雪"], "餐饮", "茶饮"),
    merchantCategoryRule(["古茗"], "餐饮", "茶饮"),
    merchantCategoryRule(["沪上阿姨"], "餐饮", "茶饮"),
    merchantCategoryRule(["美团外卖"], "餐饮", "外卖"),
    merchantCategoryRule(["饿了么"], "餐饮", "外卖"),
    merchantCategoryRule(["麦当劳", "麦记"], "餐饮", "快餐"),
    merchantCategoryRule(["肯德基", "KFC", "kfc"], "餐饮", "快餐")
  ];
}

function merchantCategoryRule(aliases, categoryL1, categoryL2) {
  return { aliases, category_l1: categoryL1, category_l2: categoryL2 };
}

function inferBudgetRule(text) {
  const scopeInfo = inferBudgetCategoryInfo(text);
  const countMatch = text.match(/(?:每天|每日|一天)[^0-9]*(?:最多|不超过|别超过|控制在|少于)?\s*(\d+(?:\.\d+)?)\s*(?:笔|次|杯|单)/);
  if (countMatch) {
    return {
      scope: scopeInfo.category_l2 ? "category_l2" : "category_l1",
      category_l1: scopeInfo.category_l1,
      category_l2: scopeInfo.category_l2,
      limit_type: "count_per_day",
      period: "day",
      count: Number(countMatch[1]),
      amount: null
    };
  }
  const amount = inferAmount("goal", text);
  return {
    scope: scopeInfo.category_l2 ? "category_l2" : "category_l1",
    category_l1: scopeInfo.category_l1,
    category_l2: scopeInfo.category_l2,
    limit_type: "amount_month",
    period: "month",
    count: null,
    amount
  };
}

function inferAccount(text, ledger, mode = "expense") {
  const knownAccounts = ledger.entities.accounts.map((account) => account.name);
  for (const account of knownAccounts) {
    if (text.includes(account)) {
      return account;
    }
  }
  if (mode === "account_balance") {
    if (containsAny(text, ["微信"])) return "微信";
    if (containsAny(text, ["支付宝"])) return "支付宝";
  }
  if (containsAny(text, ["微信"])) return "微信支付";
  if (containsAny(text, ["支付宝"])) return "支付宝";
  if (containsAny(text, ["招商卡", "招行"])) return "招商卡";
  if (containsAny(text, ["信用卡"])) return "信用卡";
  return null;
}

async function parseAccountBalanceDrafts(text, ledger, options = {}) {
  const matches = parseAccountBalancePairs(text);
  if (matches.length <= 1) {
    return matches.length === 1
      ? [await parseDraftEvent("account_balance", `${matches[0].account}余额 ${matches[0].amount}`, ledger, options)]
      : [];
  }

  const drafts = [];
  for (const [index, match] of matches.entries()) {
    const event = await parseDraftEvent("account_balance", `${match.account}余额 ${match.amount}`, ledger, options);
    event.id = `${event.id}_${index + 1}`;
    event.source.raw_text = text;
    event.amount = match.amount;
    event.account = match.account;
    event.category = "账户余额";
    event.status = "confirmed";
    event.review.required = false;
    event.review.reasons = [];
    event.confidence.overall = 0.9;
    event.confidence.fields.account = 0.9;
    drafts.push(event);
  }
  return drafts;
}

function parseAccountBalancePairs(text) {
  const normalized = String(text ?? "")
    .replace(/[，,；;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const accountPattern = "(微信|支付宝|银行卡|储蓄卡|借记卡|信用卡|现金|招商卡|招行|余额宝)";
  const pairs = [];
  const directPattern = new RegExp(`${accountPattern}(?:余额|还剩|可用余额|有|里有|卡里)?\\s*(?:¥|￥)?\\s*(\\d+(?:\\.\\d+)?)`, "g");
  for (const match of normalized.matchAll(directPattern)) {
    const account = normalizeBalanceAccount(match[1]);
    const amount = Number(match[2]);
    if (!account || !Number.isFinite(amount)) continue;
    pairs.push({ account, amount, index: match.index ?? 0 });
  }

  const trailingPattern = new RegExp(`${accountPattern}\\s*(?:余额|还剩|可用余额|有|里有|卡里)\\s*(?:¥|￥)?\\s*(\\d+(?:\\.\\d+)?)`, "g");
  for (const match of normalized.matchAll(trailingPattern)) {
    const account = normalizeBalanceAccount(match[1]);
    const amount = Number(match[2]);
    if (!account || !Number.isFinite(amount)) continue;
    pairs.push({ account, amount, index: match.index ?? 0 });
  }

  const unique = new Map();
  for (const pair of pairs.sort((left, right) => left.index - right.index)) {
    const key = `${pair.account}:${pair.amount}`;
    if (!unique.has(key)) unique.set(key, pair);
  }
  return Array.from(unique.values());
}

function normalizeBalanceAccount(account) {
  if (!account) return null;
  if (["储蓄卡", "借记卡"].includes(account)) return "银行卡";
  if (account === "招行") return "招商卡";
  return account;
}

function inferDueDate(text, now) {
  if (text.includes("下周三")) {
    return nextWeekday(now, 3);
  }

  if (containsAny(text, ["今天", "今日"])) {
    return formatDate(now);
  }
  if (text.includes("明天")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return formatDate(date);
  }
  if (text.includes("后天")) {
    const date = new Date(now);
    date.setDate(date.getDate() + 2);
    return formatDate(date);
  }

  const monthDayMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    return dateFromParts(now.getFullYear(), month, day);
  }

  const monthlyMatch = text.match(/每月\s*(\d{1,2})\s*号/);
  if (monthlyMatch) {
    const day = Number(monthlyMatch[1]);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const nextDate = new Date(year, month - 1, day);
    if (formatDate(nextDate) < currentDate()) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    return formatDate(nextDate);
  }

  return null;
}

function inferPayday(text) {
  const monthlyMatch = text.match(/每月\s*(\d{1,2})\s*号.*(?:发工资|工资|发薪|发薪日|薪水|收入)/);
  if (monthlyMatch) return Number(monthlyMatch[1]);
  const afterKeywordMatch = text.match(/(?:发薪日|发工资|发薪|工资).*?每月\s*(\d{1,2})\s*号/);
  if (afterKeywordMatch) return Number(afterKeywordMatch[1]);
  return null;
}

function isPaydayIncomeText(text) {
  return inferPayday(text) !== null || containsAny(text, ["发工资", "发薪", "发薪日", "薪水"]);
}

function inferOccurredDate(text, now) {
  if (text.includes("前天")) {
    const date = new Date(now);
    date.setDate(date.getDate() - 2);
    return formatDate(date);
  }
  if (text.includes("昨天")) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return formatDate(date);
  }

  const monthDayMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1]);
    const day = Number(monthDayMatch[2]);
    return dateFromParts(now.getFullYear(), month, day);
  }

  return currentDate();
}

function inferAmount(mode, text) {
  const matches = Array.from(text.matchAll(/(\d+(?:\.\d+)?)/g), (match) => Number(match[1]));
  if (matches.length === 0) return null;
  if (mode === "fixed_cost" || mode === "bill_due") {
    return matches[matches.length - 1];
  }
  if (
    (containsAny(text, ["每月", "下周", "今天", "明天", "后天", "昨天", "前天"]) ||
      /\d{1,2}\s*月\s*\d{1,2}\s*日/.test(text)) &&
    matches.length > 1
  ) {
    return matches[matches.length - 1];
  }
  return matches[0];
}

function inferReviewReasons({ text, amount, dueAt, occurredAt, account, category, type, budgetRule }) {
  const reasons = [];

  if (amount === null && !(type === "goal" && budgetRule?.limit_type === "count_per_day")) reasons.push("amount_missing");
  if (type === "unknown") reasons.push("type_unknown");
  if (
    !account &&
    (type === "expense" || type === "account_balance" || containsAny(text, ["微信", "支付宝", "卡", "现金", "转"]))
  ) {
    reasons.push("account_missing");
  }
  if (!category) reasons.push("category_missing");
  if (type === "bill_due" && !dueAt) reasons.push("due_date_missing");
  if (hasOccurredDate(type) && !occurredAt) reasons.push("date_missing");
  if (isRecurringPaymentUnclear(text, type)) reasons.push("recurrence_unclear");
  if (type === "transfer") reasons.push("transfer_ambiguous");
  if (type === "refund") reasons.push("refund_ambiguous");
  if (type === "reimbursement") reasons.push("reimbursement_ambiguous");
  if (type === "loan") reasons.push("loan_ambiguous");
  if (containsAny(text, ["还信用卡", "还花呗", "还款"])) reasons.push("repayment_ambiguous");

  return Array.from(new Set(reasons));
}

function strongReviewReasonsFor({ amount, account, category, type, reasons }) {
  return reasons.filter((reason) => {
    if (reason === "account_missing" && isLowImpactMissingAccount({ amount, account, category, type, reasons })) {
      return false;
    }
    return true;
  });
}

function isLowImpactMissingAccount({ amount, account, category, type, reasons }) {
  if (type !== "expense") return false;
  if (account) return false;
  if (!reasons.includes("account_missing")) return false;
  const otherReasons = reasons.filter((reason) => reason !== "account_missing");
  if (otherReasons.length > 0) return false;
  if (!category) return false;
  if (amount === null || amount === undefined) return false;
  return Number(amount) > 0 && Number(amount) <= 100;
}

function isRecurringPaymentUnclear(text, type) {
  if (type !== "bill_due" && type !== "fixed_cost") return false;
  if (!looksLikeRecurringPayment(text)) return false;
  return !hasRecurrenceHint(text);
}

function looksLikeRecurringPayment(text) {
  return containsAny(text, [
    "电费",
    "水费",
    "燃气",
    "燃气费",
    "物业",
    "物业费",
    "网费",
    "宽带",
    "房租",
    "租金",
    "话费",
    "手机套餐",
    "套餐",
    "会员",
    "订阅",
    "保险"
  ]);
}

function hasRecurrenceHint(text) {
  return containsAny(text, [
    "每月",
    "每周",
    "每年",
    "每季度",
    "每半年",
    "每天",
    "固定",
    "长期",
    "周期",
    "自动扣",
    "扣款",
    "订阅",
    "一次性",
    "只这次",
    "临时",
    "单次",
    "这次"
  ]);
}

function isPossibleDuplicate(ledger, draft) {
  if (draft.amount === null || draft.amount === undefined) return false;
  const draftDate = draft.occurredAt ?? draft.dueAt;
  if (!draftDate) return false;

  return ledger.events.some((event) => {
    if (event.status === "ignored") return false;
    if (event.type !== draft.type) return false;
    if ((event.occurred_at ?? event.due_at) !== draftDate) return false;
    if (Number(event.amount) !== Number(draft.amount)) return false;
    if ((event.account ?? "") !== (draft.account ?? "")) return false;
    if ((event.category ?? "") !== (draft.category ?? "")) return false;
    return hasSimilarText(event.source?.raw_text ?? "", draft.rawText);
  });
}

function hasSimilarText(left, right) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function normalizeText(text) {
  return String(text)
    .replace(/\s+/g, "")
    .replace(/[，,。.!！?？；;]/g, "");
}

function stripDuplicateKeepPrefix(text) {
  return String(text)
    .replace(/^(?:确认保留|保留这条|这是另一笔|这是一笔新的)\s*[:：]?\s*/, "")
    .trim();
}

function inferAssetTrackingCandidate(event, text, ledger) {
  if (!isAssetTrackableExpense(event)) return null;

  const reasons = assetTrackingReasonCodes(event, text, ledger);
  if (reasons.length === 0) return null;

  const itemName = inferAssetItemName(text) || event.category_l2 || event.category || "大额消费";
  return {
    candidate: true,
    status: "needs_confirm",
    item_name: itemName,
    reason_codes: reasons,
    confidence: assetTrackingConfidence(reasons),
    expected_review_days: 30,
    next_review_at: addDays(event.occurred_at || currentDate(), 30),
    expected_use_days: null,
    mention_count: 0,
    mention_logs: [],
    first_mentioned_at: null,
    last_mentioned_at: null,
    days_since_purchase: null,
    days_since_last_mention: null,
    state: "unknown",
    review_status: "pending"
  };
}

function isAssetTrackableExpense(event) {
  if (!event || event.type !== "expense") return false;
  if (event.direction === "internal") return false;
  if (event.transaction?.kind && event.transaction.kind !== "withdrawal") return false;
  if (isEssentialCategory(event.category_l1, event.category_l2, event.category)) return false;
  return true;
}

function assetTrackingReasonCodes(event, text, ledger) {
  const reasons = [];
  if (!isLargeAssetAmount(event, ledger)) return reasons;
  reasons.push("large_amount");
  if (isTrackableCategory(event.category_l1, event.category_l2, event.category)) reasons.push("trackable_category");
  if (hasTrackableItemKeyword(text)) reasons.push("item_keyword");
  return reasons;
}

function isLargeAssetAmount(event, ledger) {
  const amount = Number(event.amount);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const monthlyIncome = Number(ledger?.profile?.monthly_income?.amount);
  if (Number.isFinite(monthlyIncome) && monthlyIncome > 0 && amount >= monthlyIncome * 0.1) {
    return true;
  }
  return amount >= 500;
}

function isEssentialCategory(...values) {
  return values
    .filter(Boolean)
    .some((value) => containsAny(value, ["住房", "房租", "生活缴费", "通勤", "医疗", "还款", "负债", "收入", "交通"]));
}

function isTrackableCategory(...values) {
  return values
    .filter(Boolean)
    .some((value) => containsAny(value, ["数码", "家电", "服饰", "美妆", "课程", "会员", "工具", "旅行装备", "装备", "购物"]));
}

function hasTrackableItemKeyword(text) {
  return containsAny(text, assetItemKeywords());
}

function assetItemKeywords() {
  return ["降噪耳机", "耳机", "相机", "手机", "电脑", "平板", "键盘", "显示器", "课程", "会员", "鞋", "包", "工具", "设备", "家电"];
}

function assetTrackingConfidence(reasons) {
  return Math.min(0.95, 0.55 + reasons.length * 0.12);
}

function inferAssetItemName(text) {
  for (const keyword of assetItemKeywords().sort((a, b) => b.length - a.length)) {
    if (text.includes(keyword)) return keyword;
  }

  const cleaned = String(text)
    .replace(/这个|这件|今天|本周|这周|开始追踪|继续追踪|追踪一下|预计|用一年|用半年|用三个月|三个月|一个月|一年|半年|不追踪|不用追踪|别追踪|退货了|退货|退了|转卖了|转卖|卖掉了|卖掉|闲置了|闲置|吃灰了|吃灰|用了|用过|学习了|学了|买了|买|花了|入手/g, "")
    .replace(/\d+(?:\.\d+)?\s*(?:元|块|次|天|个月|年)?/g, "")
    .replace(/[，,。.!！?？；;：:\s]/g, "")
    .trim();
  return cleaned.length >= 2 && cleaned.length <= 12 ? cleaned : null;
}

function inferExpectedUseDays(text) {
  if (containsAny(text, ["一年", "1年"])) return 365;
  if (containsAny(text, ["半年", "六个月", "6个月"])) return 180;
  if (containsAny(text, ["三个月", "3个月"])) return 90;
  if (containsAny(text, ["一个月", "1个月"])) return 30;
  const match = text.match(/预计[^0-9]*(\d+)\s*天/);
  return match ? Number(match[1]) : null;
}

function looksLikeAssetMention(text) {
  return hasTrackableItemKeyword(text) && containsAny(text, ["用了", "用过", "今天用", "还在用", "学习", "学了", "练了", "戴了", "带了"]);
}

function applyAssetTrackingAction(ledger, action, rawText) {
  const target = findAssetTrackingTarget(ledger, action.itemName);
  if (!target) {
    return { handled: false, message: "没有找到对应的大额消费追踪候选。可以先记录：买了降噪耳机1299。" };
  }

  const tracking = target.asset_tracking;
  if (action.kind === "start") {
    tracking.status = "tracking";
    tracking.expected_use_days = action.expectedUseDays ?? tracking.expected_use_days ?? null;
    tracking.expected_review_days = tracking.expected_review_days ?? 30;
    tracking.next_review_at = tracking.next_review_at || addDays(target.occurred_at || currentDate(), tracking.expected_review_days);
    tracking.review_status = "pending";
    tracking.state = tracking.state === "unknown" ? "using" : tracking.state;
    return { handled: true, message: `已开始追踪：${tracking.item_name}。30 天后会提醒你复核它是否还在用。` };
  }
  if (action.kind === "ignore") {
    tracking.status = "ignored";
    tracking.review_status = "done";
    return { handled: true, message: `已设置为不追踪：${tracking.item_name}。` };
  }
  if (action.kind === "returned" || action.kind === "resold") {
    tracking.status = "ended";
    tracking.state = action.kind;
    tracking.review_status = "done";
    appendAssetMention(target, rawText);
    return { handled: true, message: `已更新：${tracking.item_name}${action.kind === "returned" ? "已退货" : "已转卖"}。` };
  }
  if (action.kind === "idle") {
    tracking.state = "idle";
    tracking.review_status = "done";
    appendAssetMention(target, rawText);
    return { handled: true, message: `已更新：${tracking.item_name}已闲置。` };
  }
  if (action.kind === "mention") {
    if (tracking.status === "needs_confirm") tracking.status = "tracking";
    if (tracking.state === "unknown") tracking.state = "using";
    appendAssetMention(target, rawText);
    return { handled: true, message: `已记录再次提到：${tracking.item_name}。这不等于真实使用次数，只用于查看购买后的再次出现间隔。` };
  }
  return { handled: false, message: "没有识别到大额消费追踪动作。" };
}

function findAssetTrackingTarget(ledger, itemName) {
  const candidates = ledger.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.asset_tracking?.candidate && !["ignored", "ended"].includes(event.asset_tracking.status))
    .sort((a, b) => {
      const byDate = String(b.event.occurred_at || b.event.source?.received_at || "").localeCompare(String(a.event.occurred_at || a.event.source?.received_at || ""));
      return byDate || b.index - a.index;
    });
  if (itemName) {
    const normalized = normalizeText(itemName);
    const matched = candidates.find(({ event }) => {
      const target = normalizeText(event.asset_tracking.item_name || "");
      return target.includes(normalized) || normalized.includes(target);
    });
    if (matched) return matched.event;
  }
  return candidates[0]?.event ?? null;
}

function appendAssetMention(event, rawText) {
  const tracking = event.asset_tracking;
  const date = currentDate();
  const previous = tracking.last_mentioned_at || tracking.first_mentioned_at || null;
  const daysSincePurchase = daysBetween(event.occurred_at || date, date);
  const daysSinceLastMention = previous ? daysBetween(previous, date) : null;
  const log = {
    date,
    raw_text: rawText,
    days_since_purchase: daysSincePurchase,
    days_since_last_mention: daysSinceLastMention
  };
  if (!Array.isArray(tracking.mention_logs)) tracking.mention_logs = [];
  tracking.mention_logs.push(log);
  tracking.mention_count = tracking.mention_logs.length;
  tracking.first_mentioned_at = tracking.first_mentioned_at || date;
  tracking.last_mentioned_at = date;
  tracking.days_since_purchase = daysSincePurchase;
  tracking.days_since_last_mention = daysSinceLastMention;
}

function renderAssetTrackingCandidateHint(event) {
  const tracking = event.asset_tracking;
  if (!tracking || tracking.status !== "needs_confirm") return null;
  return `这笔可能适合做“大额消费使用追踪”：${tracking.item_name}。如果想追踪，可以说：这个${tracking.item_name}开始追踪。`;
}

function renderAssetReviewLines(ledger) {
  const today = currentDate();
  const lines = ledger.events
    .filter((event) => event.asset_tracking?.status === "tracking" && event.asset_tracking.review_status === "pending")
    .filter((event) => event.asset_tracking.next_review_at && event.asset_tracking.next_review_at <= today)
    .slice(0, 5)
    .map((event) => renderAssetReviewLine(event));
  return lines.join("\n") || "- 无";
}

function renderAssetReviewLine(event) {
  const tracking = event.asset_tracking;
  const amount = event.amount === null || event.amount === undefined ? "金额待确认" : `¥${event.amount}`;
  const days = daysBetween(event.occurred_at || currentDate(), currentDate());
  const last = tracking.last_mentioned_at ? `${daysBetween(tracking.last_mentioned_at, currentDate())} 天前` : "暂无";
  return `- ${tracking.item_name} ${amount}：购买约 ${days} 天，记录中再次提到 ${tracking.mention_count || 0} 次，最近一次：${last}。可回复“${tracking.item_name}还在用 / ${tracking.item_name}闲置了 / ${tracking.item_name}退货了 / ${tracking.item_name}转卖了 / 这个不追踪”。`;
}

function inferTags(text) {
  const tags = [];
  if (text.includes("每月")) tags.push("monthly");
  if (containsAny(text, ["下周", "明天", "后天"])) tags.push("upcoming");
  if (isPaydayIncomeText(text)) tags.push("payday");
  if (containsAny(text, ["外卖"])) tags.push("takeout");
  if (containsAny(text, ["报销", "垫付"])) tags.push("reimbursement");
  return tags;
}

function renderConfirmation(event) {
  const amount = event.amount === null || event.amount === undefined ? "金额待确认" : `¥${event.amount}`;
  const category = event.category ?? "未分类";
  const account = event.account ? `，${event.account}` : "";
  const accountMissing = !event.account && event.type === "expense" ? "。支付方式未填写" : "";
  if (event.type === "account_balance") {
    return `已记录余额快照：${renderBalanceAccountName(event.account)} ${amount}`;
  }
  if (event.type === "goal") {
    if (event.budget_rule?.limit_type === "count_per_day") {
      return `已设置：${category}每日最多 ${event.budget_rule.count} 笔`;
    }
    return `已设置：${category}预算 ${amount}`;
  }
  return `已记录：${category} ${amount}${account}${accountMissing}`;
}

function renderMultiBalanceConfirmation(events) {
  const lines = events.map((event) => {
    const amount = event.amount === null || event.amount === undefined ? "金额待确认" : `¥${event.amount}`;
    return `- ${renderBalanceAccountName(event.account)} ${amount}`;
  });
  return `已记录 ${events.length} 个余额快照：\n${lines.join("\n")}`;
}

function renderBalanceAccountName(account) {
  if (!account) return "账户待确认";
  if (account === "微信支付") return "微信";
  return account;
}

function renderReviewQuestion(event) {
  if (event.review.reasons.includes("possible_duplicate")) {
    return "需要确认：这条记录和已有记录很像，可能重复，是否保留？";
  }
  if (event.review.reasons.includes("repayment_ambiguous")) {
    return "需要确认：这是还款提醒还是普通支出？";
  }
  if (event.review.reasons.includes("transfer_ambiguous")) {
    return "需要确认：这是账户间转账，还是普通支出？";
  }
  if (event.review.reasons.includes("due_date_missing")) {
    return "需要确认：这条未来事项的到期日是什么？";
  }
  if (event.review.reasons.includes("date_missing")) {
    return "需要确认：这条记录的日期不明确或无效，请补充正确日期。";
  }
  if (event.review.reasons.includes("recurrence_unclear")) {
    return "需要确认：这笔付款是一次性的，还是每月/固定周期都要付？";
  }
  if (event.review.reasons.includes("account_missing")) {
    return "需要确认：这笔是用微信、支付宝、银行卡还是现金支付的？";
  }
  return "需要确认：这条记录还有缺失字段，请补充金额、日期、账户或分类。";
}

function refreshHeartbeat(ledger) {
  ledger.heartbeat.pending_review_ids = ledger.events
    .filter((event) => event.status === "needs_review")
    .map((event) => event.id);

  ledger.heartbeat.scheduled_item_ids = ledger.events
    .filter((event) => event.due_at && event.status !== "ignored")
    .map((event) => event.id);
}

function upsertEntity(collection, name) {
  if (!name) return;
  if (collection.some((entity) => entity.name === name)) return;
  collection.push({
    id: `ent_${Date.now()}_${collection.length + 1}`,
    name,
    created_from: "natural_language",
    status: "active"
  });
}

function createEmptyLedger() {
  return {
    schema_version: "0.1",
    currency: "CNY",
    events: [],
    profile: createEmptyProfile(),
    entities: {
      accounts: [],
      categories: []
    },
    heartbeat: {
      pending_review_ids: [],
      scheduled_item_ids: []
    }
  };
}

function createEmptyProfile() {
  return {
    payday: null,
    monthly_income: null,
    latest_balances: [],
    known_fixed_costs: [],
    known_repayments: [],
    known_subscriptions: [],
    known_budgets: [],
    behavior_patterns: [],
    completeness: {
      completed: 0,
      total: 6,
      missing: [
        "payday",
        "monthly_income",
        "latest_balance",
        "fixed_costs",
        "repayments_or_subscriptions",
        "budgets"
      ]
    },
    updated_at: null
  };
}

async function readLedger(options = {}) {
  const { createIfMissing = true } = options;
  try {
    const raw = await readFile(ledgerPath, "utf8");
    const normalizedRaw = stripBom(raw);
    if (!normalizedRaw.trim()) {
      const empty = createEmptyLedger();
      if (createIfMissing) {
        await writeLedger(empty, { allowReset: true, skipBackup: true });
      }
      return empty;
    }
    return validateLedger(parseLedgerJson(normalizedRaw, ledgerPath), ledgerPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      const empty = createEmptyLedger();
      if (createIfMissing) {
        await writeLedger(empty, { allowReset: true, skipBackup: true });
      }
      return empty;
    }
    throw error;
  }
}

async function writeLedger(ledger, options = {}) {
  ledger.profile = refreshProfile(ledger);
  validateLedger(ledger, "draft ledger");

  const previousLedger = await readExistingLedger();
  guardAgainstUnexpectedDataLoss(previousLedger, ledger, options);

  if (previousLedger && !options.skipBackup) {
    await backupCurrentLedger(previousLedger);
  }

  const serialized = `${JSON.stringify(ledger, null, 2)}\n`;
  JSON.parse(serialized);

  const tmpPath = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, serialized, "utf8");
  JSON.parse(await readFile(tmpPath, "utf8"));
  await rename(tmpPath, ledgerPath);
  await pruneBackups();
}

async function readExistingLedger() {
  try {
    const raw = await readFile(ledgerPath, "utf8");
    const normalizedRaw = stripBom(raw);
    if (!normalizedRaw.trim()) return null;
    return validateLedger(parseLedgerJson(normalizedRaw, ledgerPath), ledgerPath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function stripBom(text) {
  return String(text).replace(/^\uFEFF/, "");
}

function parseLedgerJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      const friendly = new Error(
        [
          "账本 JSON 损坏，当前操作已停止，避免继续写坏账本。",
          `账本路径：${label}`
        ].join("\n")
      );
      friendly.code = "LEDGER_JSON_INVALID";
      throw friendly;
    }
    throw error;
  }
}

function formatUserFacingError(error) {
  if (error?.code === "LEDGER_JSON_INVALID") {
    return appendBackupRecoveryHint(error.message);
  }
  return error?.message ?? String(error);
}

function appendBackupRecoveryHint(message) {
  const backupCount = countBackupFilesSync();
  if (backupCount > 0) {
    return [
      message,
      `当前检测到 ${backupCount} 个可用备份。可以发送“查看备份”，确认后再发送“确认恢复最近备份”。`
    ].join("\n");
  }
  return [
    message,
    "当前没有检测到可用备份。请先手动复制并保存这个损坏文件。",
    "如果要重新开始，可以发送“初始化账本”创建新账本；不要直接覆盖唯一的损坏文件。"
  ].join("\n");
}

function countBackupFilesSync() {
  try {
    return readdirSync(backupDir).filter((name) => name.endsWith(".json")).length;
  } catch {
    return 0;
  }
}

function validateLedger(ledger, label) {
  if (!ledger || typeof ledger !== "object") {
    throw new Error(`Invalid ledger ${label}: expected object`);
  }
  if (!Array.isArray(ledger.events)) {
    throw new Error(`Invalid ledger ${label}: events must be an array`);
  }
  ledger.profile = refreshProfile(ledger);
  if (!ledger.entities || typeof ledger.entities !== "object") {
    ledger.entities = { accounts: [], categories: [] };
  }
  if (!Array.isArray(ledger.entities.accounts)) {
    ledger.entities.accounts = [];
  }
  if (!Array.isArray(ledger.entities.categories)) {
    ledger.entities.categories = [];
  }
  if (!ledger.heartbeat || typeof ledger.heartbeat !== "object") {
    ledger.heartbeat = { pending_review_ids: [], scheduled_item_ids: [] };
  }
  if (!Array.isArray(ledger.heartbeat.pending_review_ids)) {
    ledger.heartbeat.pending_review_ids = [];
  }
  if (!Array.isArray(ledger.heartbeat.scheduled_item_ids)) {
    ledger.heartbeat.scheduled_item_ids = [];
  }
  return ledger;
}

function guardAgainstUnexpectedDataLoss(previousLedger, nextLedger, options = {}) {
  if (!previousLedger) return;
  if (options.allowEventDrop || options.allowReset || options.source === "restore") return;

  const previousCount = countEvents(previousLedger);
  const nextCount = countEvents(nextLedger);
  if (previousCount > 0 && nextCount === 0) {
    throw new Error(
      [
        `账本保护已拦截：记录数将从 ${previousCount} 变为 0。`,
        "这可能是异常清空。请先查看备份：backups，或恢复最近备份：restore latest。"
      ].join("\n")
    );
  }
  if (nextCount < previousCount) {
    throw new Error(
      [
        `账本保护已拦截：记录数将从 ${previousCount} 变为 ${nextCount}。`,
        "当前操作不允许减少记录。请确认是否需要恢复或显式重置。"
      ].join("\n")
    );
  }
}

async function backupCurrentLedger(ledger) {
  await mkdir(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `ledger-${timestampForFile()}.json`);
  await copyFile(ledgerPath, backupPath);

  const copied = validateLedger(JSON.parse(await readFile(backupPath, "utf8")), backupPath);
  if (countEvents(copied) !== countEvents(ledger)) {
    throw new Error(`Backup verification failed: ${backupPath}`);
  }
}

async function listBackups() {
  let names = [];
  try {
    names = await readdir(backupDir);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const backups = [];
  for (const name of names.filter((item) => item.endsWith(".json"))) {
    const path = resolve(backupDir, name);
    try {
      const ledger = validateLedger(JSON.parse(await readFile(path, "utf8")), path);
      const info = await stat(path);
      backups.push({
        name,
        path,
        mtimeMs: info.mtimeMs,
        ledger,
        eventCount: countEvents(ledger)
      });
    } catch {
      // Ignore unreadable backup files when listing recovery candidates.
    }
  }

  return backups.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function selectBackup(backups, target) {
  if (!target || target === "latest") {
    return backups[0] ?? null;
  }

  const index = Number(target);
  if (Number.isInteger(index) && index > 0) {
    return backups[index - 1] ?? null;
  }

  return backups.find((backup) => backup.name === target || backup.path === target) ?? null;
}

async function pruneBackups() {
  const backups = await listBackups();
  const staleBackups = backups.slice(maxBackupFiles);
  await Promise.all(staleBackups.map((backup) => rm(backup.path, { force: true })));
}

async function appendRawEvent(payload) {
  await appendFile(
    rawEventsPath,
    `${JSON.stringify({
      received_at: new Date().toISOString(),
      ...payload
    })}\n`,
    "utf8"
  );
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function withLedgerLock(fn) {
  const lockPath = `${ledgerPath}.lock`;
  const startedAt = Date.now();
  let handle = null;

  while (!handle) {
    try {
      handle = await open(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const lockInfo = await stat(lockPath).catch(() => null);
      if (lockInfo && Date.now() - lockInfo.mtimeMs > staleLockMs) {
        throw new Error(`Ledger lock may be stale: ${lockPath}. Please close other writers, then remove the lock if no process is using it.`);
      }
      if (Date.now() - startedAt > 5000) {
        throw new Error(`Ledger is busy: ${lockPath}`);
      }
      await sleep(50);
    }
  }

  try {
    return await fn();
  } finally {
    await handle.close();
    await rm(lockPath, { force: true });
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function countEvents(ledger) {
  return Array.isArray(ledger?.events) ? ledger.events.length : 0;
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
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

function countBy(items, getKey) {
  return items.reduce((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}

function sumAmounts(events) {
  return events.reduce((total, event) => total + (event.amount ?? 0), 0);
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern));
}

function withinLastDays(event, days) {
  const date = event.occurred_at ?? event.due_at;
  if (!date) return false;
  const current = parseDateOnly(currentDate());
  const target = parseDateOnly(date);
  if (!current || !target) return false;
  const diff = (current - target) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff < days;
}

function withinNextDays(event, days) {
  if (!event.due_at) return false;
  const current = parseDateOnly(currentDate());
  const target = parseDateOnly(event.due_at);
  if (!current || !target) return false;
  const diff = (target - current) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function isRelevantForCurrentWindow(event, title) {
  if (title.includes("今日")) {
    return event.due_at === currentDate() || event.occurred_at === currentDate();
  }
  if (title.includes("本月")) {
    return inCurrentMonth(event);
  }
  return withinLastDays(event, 7);
}

function inCurrentMonth(event) {
  const date = event.occurred_at ?? event.due_at;
  if (!date) return false;
  if (!parseDateOnly(date)) return false;
  return date.slice(0, 7) === currentDate().slice(0, 7);
}

function nextWeekday(now, targetWeekday) {
  const date = new Date(now);
  const currentWeekday = date.getDay();
  let diff = targetWeekday - currentWeekday;
  if (diff <= 0) diff += 7;
  date.setDate(date.getDate() + diff);
  return formatDate(date);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function currentDate() {
  return formatDate(new Date());
}

function relativeDate(offsetDays) {
  const date = parseDateOnly(currentDate());
  date.setDate(date.getDate() + offsetDays);
  return formatDate(date);
}

function addDays(dateText, days) {
  const date = parseDateOnly(dateText) || parseDateOnly(currentDate());
  date.setDate(date.getDate() + Number(days || 0));
  return formatDate(date);
}

function daysBetween(startText, endText) {
  const start = parseDateOnly(startText);
  const end = parseDateOnly(endText);
  if (!start || !end) return null;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function daysFromCurrent(dateText) {
  const current = parseDateOnly(currentDate());
  const target = parseDateOnly(dateText);
  if (!current || !target) return Number.POSITIVE_INFINITY;
  return (current - target) / (1000 * 60 * 60 * 24);
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return formatDate(date);
}

function parseDateOnly(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const formatted = dateFromParts(year, month, day);
  if (formatted !== String(value)) return null;
  return new Date(year, month - 1, day);
}

function renderReminderLine(event) {
  const amount = event.amount === null || event.amount === undefined ? "金额待确认" : `${event.amount} ${event.currency ?? "CNY"}`;
  const account = event.account ? `，账户：${event.account}` : "";
  return `- ${event.due_at}：${event.source.raw_text}（${amount}${account}）`;
}

function renderCategoryBars(events) {
  const expenseEvents = events.filter((event) => event.type === "expense");
  const total = sumAmounts(expenseEvents);
  if (total <= 0) {
    return "分类支出：暂无";
  }

  return categoryTotals(expenseEvents)
    .slice(0, 5)
    .map((item) => {
      const percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;
      return `${categoryIcon(item.category)} ${item.category}  ${formatMoney(item.amount)}  ${renderBar(percent)} ${percent}%`;
    })
    .join("\n");
}

function categoryTotals(events) {
  const totals = new Map();
  for (const event of events) {
    const category = event.category ?? "未分类";
    totals.set(category, (totals.get(category) ?? 0) + (event.amount ?? 0));
  }
  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

function renderFrequentExpenseLines(events) {
  const expenseEvents = events.filter((event) => event.type === "expense" && event.status !== "ignored");
  if (expenseEvents.length === 0) return "- 暂无";

  const totals = new Map();
  for (const event of expenseEvents) {
    const category = event.category ?? "未分类";
    const current = totals.get(category) ?? { category, count: 0, amount: 0 };
    current.count += 1;
    current.amount += event.amount ?? 0;
    totals.set(category, current);
  }

  return Array.from(totals.values())
    .sort((left, right) => right.count - left.count || right.amount - left.amount)
    .slice(0, 3)
    .map((item) => `${categoryIcon(item.category)} ${item.category}  ${item.count} 次  ${formatMoney(item.amount)}`)
    .join("\n");
}

function renderLowValueFrequentExpenseLines(events) {
  const lowValueEvents = events.filter(
    (event) => event.type === "expense" &&
      event.status !== "ignored" &&
      (event.amount ?? 0) > 0 &&
      (event.amount ?? 0) <= 30
  );
  if (lowValueEvents.length < 2) return "- 暂无";

  const totals = new Map();
  for (const event of lowValueEvents) {
    const category = event.category ?? "未分类";
    const current = totals.get(category) ?? { category, count: 0, amount: 0 };
    current.count += 1;
    current.amount += event.amount ?? 0;
    totals.set(category, current);
  }

  const grouped = Array.from(totals.values())
    .filter((item) => item.count >= 2 || lowValueEvents.length >= 3)
    .sort((left, right) => right.count - left.count || right.amount - left.amount)
    .slice(0, 3);
  if (grouped.length === 0) return "- 暂无";

  return grouped
    .map((item) => {
      const average = item.count > 0 ? item.amount / item.count : 0;
      return `${categoryIcon(item.category)} ${item.category}  ${item.count} 次  ${formatMoney(item.amount)}  均 ${formatMoney(average)}`;
    })
    .join("\n");
}

function renderCashflowSummary(ledger) {
  const profileLine = renderProfileCompleteness(ledger);
  const snapshot = renderCashflowSnapshot(ledger);
  const currentMonthEvents = ledger.events.filter((event) => inCurrentMonth(event));
  const budgetProgress = renderBudgetProgressBars(ledger);
  const categoryLines = renderCategoryBars(currentMonthEvents);
  const frequentExpenseLines = renderFrequentExpenseLines(currentMonthEvents);
  const lowValueFrequentLines = renderLowValueFrequentExpenseLines(currentMonthEvents);
  const riskLines = renderCashflowRiskLines(ledger);
  const behaviorLines = renderBehaviorPatternLines(ledger);
  const spendingSignalLines = renderSpendingSignalLines(ledger, { includeMedium: true });
  const spendingSignalSection = spendingSignalLines === "- 无" ? "" : `\n重点提醒：\n${spendingSignalLines}\n`;
  const hint = renderProfileHint(ledger);

  return `📊 现金流心跳
仅基于已记录数据和你手动提供的余额估算

${profileLine}
${snapshot}

${budgetProgress}

本月分类支出：
${categoryLines}

高频消费：
${frequentExpenseLines}

高频低值消费：
${lowValueFrequentLines}
${spendingSignalSection}

未来 7 天现金流：
${riskLines}

消费行为：
${behaviorLines}

${hint}`;
}

function renderCashflowSnapshot(ledger) {
  const balance = totalLatestBalance(ledger);
  const dueTotal = upcomingDueTotal(ledger, 7);
  const payday = ledger.profile?.payday?.day_of_month ?? null;
  const daysToPayday = payday ? daysUntilDayOfMonth(payday) : null;
  const dailyAvailable = balance !== null && daysToPayday !== null && daysToPayday > 0
    ? Math.floor((balance - dueTotal) / daysToPayday)
    : null;
  const lines = [
    `已知可用余额：${balance === null ? "缺失" : formatMoney(balance)}`,
    `未来 7 天确定支出：${formatMoney(dueTotal)}`,
    `距离下次发薪：${daysToPayday === null ? "缺失" : `${daysToPayday} 天`}`,
    `预估每日可自由支配：${dailyAvailable === null ? "缺失" : formatMoney(dailyAvailable)}`
  ];
  return lines.join("\n");
}

function renderProfileCompleteness(ledger) {
  const completeness = ledger.profile?.completeness ?? createEmptyProfile().completeness;
  return `现金流画像：${completeness.completed}/${completeness.total} 已补全`;
}

function renderProfileHint(ledger) {
  const missing = ledger.profile?.completeness?.missing ?? [];
  if (missing.includes("payday")) {
    return "下一步最有用：发薪日。你可以说：每月 10 号发工资 12000。";
  }
  if (missing.includes("latest_balance")) {
    return "下一步最有用：主要账户余额。你可以说：微信余额 200，银行卡 3200。";
  }
  if (missing.includes("budgets")) {
    return "下一步最有用：预算偏好。你可以说：这个月外卖别超过 300。";
  }
  return "画像已足够生成基础现金流心跳。";
}

function renderCashflowRiskLines(ledger) {
  const lines = [];
  const balance = totalLatestBalance(ledger);
  const dueTotal = upcomingDueTotal(ledger, 7);
  const recentDailySpend = averageDailySpend(ledger, 7);
  const payday = ledger.profile?.payday?.day_of_month ?? null;
  const daysToPayday = payday ? daysUntilDayOfMonth(payday) : null;

  if (dueTotal > 0) {
    lines.push(`- 未来 7 天已记录确定支出 ${formatMoney(dueTotal)}。`);
  }
  if (balance !== null && dueTotal > balance * 0.6) {
    lines.push("- 如果余额信息仍准确，未来 7 天现金流会比较紧。");
  }
  if (balance !== null && daysToPayday !== null && daysToPayday > 0 && recentDailySpend > 0) {
    const dailyAvailable = (balance - dueTotal) / daysToPayday;
    if (dailyAvailable < recentDailySpend) {
      lines.push(`- 发薪日前日均可用约 ${formatMoney(dailyAvailable)}，低于近 7 天日均支出 ${formatMoney(recentDailySpend)}。`);
    }
  }
  if (ledger.heartbeat.pending_review_ids.length >= 3) {
    lines.push(`- 待复核 ${ledger.heartbeat.pending_review_ids.length} 条，复盘准确性会受影响。`);
  }
  const budgetAlerts = renderBudgetAlerts(ledger);
  if (budgetAlerts !== "- 无") lines.push(...budgetAlerts.split("\n"));

  return lines.slice(0, 5).join("\n") || "- 暂无明显现金流压力。";
}

function renderSpendingSignalLines(ledger, options = {}) {
  const signals = detectSpendingSignals(ledger)
    .filter((signal) => options.includeMedium || signal.priority === "high")
    .slice(0, 5);
  if (signals.length === 0) return "- 无";
  return signals.map((signal) => `- ${signal.title}：${signal.detail} 建议：${signal.action}`).join("\n");
}

function renderSpendingSignalReminderLines(ledger) {
  return renderSpendingSignalLines(ledger, { includeMedium: false });
}

function detectSpendingSignals(ledger) {
  const events = Array.isArray(ledger.events)
    ? ledger.events.filter((event) => event.status !== "ignored")
    : [];
  const currentMonthExpenses = events.filter((event) => event.type === "expense" && inCurrentMonth(event));
  const signals = [
    ...detectLowValueSignals(currentMonthExpenses),
    ...detectBudgetSpeedSignals(ledger),
    ...detectSubscriptionSignals(ledger, events),
    ...detectDelayedPaymentSignals(ledger),
    ...detectLargePurchaseLowMentionSignals(events)
  ];
  return signals.sort((left, right) => signalRank(left) - signalRank(right));
}

function detectLowValueSignals(expenses) {
  const lowValueEvents = expenses.filter((event) => {
    const amount = Number(event.amount ?? 0);
    return amount > 0 && amount <= 30;
  });
  const groups = groupExpenseEventsByCategory(lowValueEvents);
  return groups
    .filter((item) => item.count >= 3 || (item.count >= 2 && item.amount >= 50))
    .slice(0, 2)
    .map((item) => ({
      code: "low_value_frequent",
      priority: item.count >= 5 || item.amount >= 100 ? "high" : "medium",
      title: "高频低值提醒",
      detail: `本月 ${item.count} 次，合计 ${formatMoney(item.amount)}，均 ${formatMoney(item.amount / item.count)}。`,
      action: `${item.category}可以先设每日笔数上限，例如“${item.category}每天最多 1 笔”。`
    }));
}

function detectBudgetSpeedSignals(ledger) {
  return currentMonthBudgets(ledger)
    .map((budget) => {
      if (budget.limit_type === "count_per_day") {
        const daily = todayBudgetCount(ledger, budget);
        const limit = budget.count ?? 0;
        if (limit > 0 && daily.count >= limit) {
          return {
            code: "budget_daily_count",
            priority: daily.count > limit ? "high" : "medium",
            title: "每日笔数提醒",
            detail: `今天已记录 ${daily.count}/${limit} 笔。`,
            action: "如果这是临时情况，可以不改；如果经常发生，降低触发场景或调整上限。"
          };
        }
        return null;
      }
      const limit = budget.amount ?? 0;
      if (limit <= 0) return null;
      const spent = currentMonthBudgetSpend(ledger, budget);
      const percent = spent / limit;
      const monthProgress = currentMonthProgress();
      if (percent >= 1 || (percent >= 0.8 && percent > monthProgress + 0.25)) {
        return {
          code: "budget_speed",
          priority: percent >= 1 ? "high" : "medium",
          title: "预算速度提醒",
          detail: `已用 ${formatMoney(spent)} / ${formatMoney(limit)}，进度 ${Math.round(percent * 100)}%。`,
          action: `先检查本月是否还有同类固定支出，必要时说“${budget.category}本月暂停新增”。`
        };
      }
      return null;
    })
    .filter(Boolean);
}

function detectSubscriptionSignals(ledger, events) {
  const subscriptionEvents = events.filter((event) =>
    event.type === "subscription" ||
    event.type === "fixed_cost" ||
    containsAny(event.category ?? "", ["订阅", "会员"]) ||
    containsAny(event.source?.raw_text ?? "", ["订阅", "会员", "自动扣", "扣款", "套餐"])
  );
  const total = sumAmounts(subscriptionEvents.filter((event) => inCurrentMonth(event) || withinNextDays(event, 30)));
  if (subscriptionEvents.length < 2 && total < 100) return [];
  return [{
    code: "subscription_accumulation",
    priority: total >= 200 || subscriptionEvents.length >= 3 ? "high" : "medium",
    title: "订阅/固定支出提醒",
    detail: `已记录 ${subscriptionEvents.length} 条订阅或固定支出，近期合计 ${formatMoney(total)}。`,
    action: "月末复盘时逐条确认是否还在使用，不确定的先标记待复核。"
  }];
}

function detectDelayedPaymentSignals(ledger) {
  const upcoming = ledger.events
    .filter((event) => event.due_at && event.status !== "ignored" && withinNextDays(event, 14))
    .filter((event) => ["bill_due", "fixed_cost"].includes(event.type) || containsAny(event.category ?? "", ["还款", "账单", "生活缴费"]));
  const total = sumAmounts(upcoming);
  if (upcoming.length === 0 || total < 300) return [];
  return [{
    code: "delayed_payment",
    priority: total >= 1000 || upcoming.length >= 3 ? "high" : "medium",
    title: "待付款集中提醒",
    detail: `未来 14 天已记录 ${upcoming.length} 条待付款，合计 ${formatMoney(total)}。`,
    action: "不要只看本月已花金额，先把这些待付款从可用余额里扣掉。"
  }];
}

function detectLargePurchaseLowMentionSignals(events) {
  const today = currentDate();
  return events
    .filter((event) => event.asset_tracking?.status === "tracking")
    .map((event) => {
      const tracking = event.asset_tracking;
      const days = daysBetween(event.occurred_at || today, today);
      const mentionCount = tracking.mention_count || 0;
      if (days === null || days < 30 || mentionCount > 0) return null;
      return {
        code: "large_purchase_low_mention",
        priority: Number(event.amount ?? 0) >= 1000 ? "high" : "medium",
        title: "大额低提及提醒",
        detail: `购买约 ${days} 天，记录中再次提到 ${mentionCount} 次。`,
        action: `如果还在用，可以说“${tracking.item_name}还在用”；如果闲置了，可以说“${tracking.item_name}闲置了”。`
      };
    })
    .filter(Boolean);
}

function groupExpenseEventsByCategory(events) {
  const totals = new Map();
  for (const event of events) {
    const category = event.category ?? "未分类";
    const current = totals.get(category) ?? { category, count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(event.amount ?? 0);
    totals.set(category, current);
  }
  return Array.from(totals.values())
    .sort((left, right) => right.count - left.count || right.amount - left.amount);
}

function currentMonthProgress() {
  const today = parseDateOnly(currentDate());
  if (!today) return 0;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return today.getDate() / daysInMonth;
}

function signalRank(signal) {
  return signal.priority === "high" ? 0 : 1;
}

function renderBehaviorPatternLines(ledger) {
  const patterns = ledger.profile?.behavior_patterns ?? [];
  if (patterns.length === 0) return "- 暂无明显行为标签。";
  return patterns.slice(0, 5).map((pattern) => `- ${pattern.label}：${pattern.detail}`).join("\n");
}

function refreshProfile(ledger) {
  const profile = createEmptyProfile();
  const activeEvents = Array.isArray(ledger.events)
    ? ledger.events.filter((event) => event.status !== "ignored")
    : [];

  const paydayEvent = [...activeEvents]
    .reverse()
    .find((event) => event.type === "income" && isPaydayIncomeText(event.source?.raw_text ?? ""));
  if (paydayEvent) {
    const day = inferPayday(paydayEvent.source.raw_text);
    profile.payday = day ? {
      day_of_month: day,
      source_event_id: paydayEvent.id,
      updated_at: paydayEvent.source.received_at
    } : null;
    if (paydayEvent.amount !== null && paydayEvent.amount !== undefined) {
      profile.monthly_income = {
        amount: paydayEvent.amount,
        currency: paydayEvent.currency ?? "CNY",
        source_event_id: paydayEvent.id,
        updated_at: paydayEvent.source.received_at
      };
    }
  }

  profile.latest_balances = latestBalanceSnapshots(activeEvents);
  profile.known_fixed_costs = latestKnownItems(activeEvents, (event) => event.type === "fixed_cost");
  profile.known_repayments = latestKnownItems(activeEvents, (event) => event.type === "bill_due" || event.category === "还款");
  profile.known_subscriptions = latestKnownItems(activeEvents, (event) => event.type === "subscription" || event.category === "订阅");
  profile.known_budgets = currentMonthBudgets(ledger).map((budget) => ({
    category: budget.category,
    amount: budget.amount,
    currency: ledger.currency ?? "CNY"
  }));
  profile.behavior_patterns = detectBehaviorPatterns(ledger);
  profile.completeness = profileCompleteness(profile);
  profile.updated_at = new Date().toISOString();
  return profile;
}

function latestBalanceSnapshots(events) {
  const latest = new Map();
  for (const event of events) {
    if (event.type !== "account_balance") continue;
    if (event.amount === null || event.amount === undefined) continue;
    const account = event.account ?? "未确认账户";
    latest.set(account, {
      account,
      amount: event.amount,
      currency: event.currency ?? "CNY",
      occurred_at: event.occurred_at,
      source_event_id: event.id
    });
  }
  return Array.from(latest.values());
}

function latestKnownItems(events, predicate) {
  const latest = new Map();
  for (const event of events) {
    if (!predicate(event)) continue;
    if (event.amount === null || event.amount === undefined) continue;
    const key = `${event.category ?? "事项"}:${event.account ?? ""}`;
    latest.set(key, {
      category: event.category ?? "事项",
      amount: event.amount,
      currency: event.currency ?? "CNY",
      due_at: event.due_at,
      account: event.account,
      source_event_id: event.id
    });
  }
  return Array.from(latest.values());
}

function profileCompleteness(profile) {
  const checks = [
    ["payday", Boolean(profile.payday)],
    ["monthly_income", Boolean(profile.monthly_income)],
    ["latest_balance", profile.latest_balances.length > 0],
    ["fixed_costs", profile.known_fixed_costs.length > 0],
    ["repayments_or_subscriptions", profile.known_repayments.length > 0 || profile.known_subscriptions.length > 0],
    ["budgets", profile.known_budgets.length > 0]
  ];
  const missing = checks.filter(([, done]) => !done).map(([name]) => name);
  return {
    completed: checks.length - missing.length,
    total: checks.length,
    missing
  };
}

function detectBehaviorPatterns(ledger) {
  const events = ledger.events.filter((event) => event.status !== "ignored");
  const currentMonthExpenses = events.filter((event) => event.type === "expense" && inCurrentMonth(event));
  const patterns = [];
  const diningEvents = currentMonthExpenses.filter((event) =>
    event.category_l1 === "餐饮" || event.category === "餐饮" || (event.tags ?? []).includes("takeout")
  );
  const takeoutEvents = currentMonthExpenses.filter((event) => (event.tags ?? []).includes("takeout"));
  if (diningEvents.length >= 3) {
    patterns.push({
      code: "takeout_high_frequency",
      label: "餐饮高频",
      detail: `本月餐饮记录 ${diningEvents.length} 次，合计 ${formatMoney(sumAmounts(diningEvents))}`
    });
  }
  if (takeoutEvents.length >= 3) {
    patterns.push({
      code: "takeout_only_high_frequency",
      label: "外卖高频",
      detail: `本月外卖记录 ${takeoutEvents.length} 次，合计 ${formatMoney(sumAmounts(takeoutEvents))}`
    });
  }
  const smallExpenses = currentMonthExpenses.filter((event) => (event.amount ?? 0) > 0 && (event.amount ?? 0) <= 30);
  if (smallExpenses.length >= 5) {
    patterns.push({
      code: "small_high_frequency",
      label: "小额高频",
      detail: `本月小额消费 ${smallExpenses.length} 次，合计 ${formatMoney(sumAmounts(smallExpenses))}`
    });
  }
  const weekendExpenses = currentMonthExpenses.filter((event) => {
    const date = new Date(event.occurred_at);
    const day = date.getDay();
    return day === 0 || day === 6;
  });
  const total = sumAmounts(currentMonthExpenses);
  const weekendTotal = sumAmounts(weekendExpenses);
  if (total > 0 && weekendTotal / total >= 0.4) {
    patterns.push({
      code: "weekend_spend_high",
      label: "周末支出偏高",
      detail: `周末支出占本月 ${Math.round((weekendTotal / total) * 100)}%`
    });
  }
  const reimbursements = events.filter((event) => event.type === "reimbursement");
  if (reimbursements.length > 0) {
    patterns.push({
      code: "reimbursement_pending",
      label: "垫付/报销待跟进",
      detail: `已记录 ${reimbursements.length} 条报销或垫付相关事项`
    });
  }
  return patterns;
}

function totalLatestBalance(ledger) {
  const balances = ledger.profile?.latest_balances ?? [];
  if (balances.length === 0) return null;
  return balances.reduce((total, item) => total + (item.amount ?? 0), 0);
}

function upcomingDueTotal(ledger, days) {
  return sumAmounts(
    ledger.events.filter((event) =>
      event.due_at &&
      event.status !== "ignored" &&
      withinNextDays(event, days)
    )
  );
}

function averageDailySpend(ledger, days) {
  const total = sumAmounts(
    ledger.events.filter((event) =>
      event.type === "expense" &&
      event.status !== "ignored" &&
      withinLastDays(event, days)
    )
  );
  return total / days;
}

function daysUntilDayOfMonth(dayOfMonth) {
  const today = new Date(currentDate());
  const target = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (formatDate(target) < currentDate()) {
    target.setMonth(target.getMonth() + 1);
  }
  return Math.max(0, Math.ceil((target - today) / (1000 * 60 * 60 * 24)));
}

function renderBudgetProgressBars(ledger) {
  const budgets = currentMonthBudgets(ledger);
  if (budgets.length === 0) {
    return "预算进度：暂无";
  }

  return budgets.map((budget) => {
    if (budget.limit_type === "count_per_day") {
      const daily = todayBudgetCount(ledger, budget);
      const limit = budget.count ?? 0;
      const percent = limit > 0 ? Math.round((daily.count / limit) * 100) : 0;
      const status = daily.count > limit ? `超出 ${daily.count - limit} 笔` : `还可 ${Math.max(0, limit - daily.count)} 笔`;
      return `${categoryIcon(budget.category)} ${budget.category}每日笔数：${daily.count} / ${limit} ${renderBar(percent)} ${percent}%（${status}）`;
    }
    const spent = currentMonthBudgetSpend(ledger, budget);
    const limit = budget.amount ?? 0;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const remaining = limit - spent;
    const status = remaining < 0 ? `超出 ${formatMoney(Math.abs(remaining))}` : `剩余 ${formatMoney(remaining)}`;
    return `${categoryIcon(budget.category)} ${budget.category}预算：${formatMoney(spent)} / ${formatMoney(limit)} ${renderBar(percent)} ${percent}%（${status}）`;
  }).join("\n");
}

function renderTomorrowDueLines(ledger) {
  const tomorrow = relativeDate(1);
  const dueEvents = ledger.events
    .filter((event) => event.due_at === tomorrow && event.status !== "ignored")
    .sort((left, right) => {
      const leftAmount = left.amount ?? 0;
      const rightAmount = right.amount ?? 0;
      return rightAmount - leftAmount;
    });

  if (dueEvents.length === 0) return "- 暂无";

  return dueEvents
    .slice(0, 3)
    .map((event) => {
      const category = event.category ?? "事项";
      const amount = event.amount === null || event.amount === undefined ? "金额待确认" : formatMoney(event.amount);
      const account = event.account ? `，${event.account}` : "";
      return `- ${category} ${amount}${account}`;
    })
    .join("\n");
}

function renderUpcomingSummary(ledger) {
  const upcoming = ledger.events
    .filter((event) => event.due_at && event.status !== "ignored")
    .filter((event) => withinNextDays(event, 7))
    .sort((left, right) => String(left.due_at).localeCompare(String(right.due_at)))[0];

  if (!upcoming) return "";
  const amount = upcoming.amount === null || upcoming.amount === undefined
    ? "金额待确认"
    : formatMoney(upcoming.amount);
  return `${upcoming.due_at} ${upcoming.category ?? "事项"} ${amount}`;
}

function renderSummaryNote(events) {
  if (events.length === 0) {
    return "今天如果还有漏记，可以直接补一句。";
  }
  return "数据不完整时，复盘只代表已记录部分。";
}

function renderFirstUseSetupPrompt() {
  return `第一次使用建议：先设自动提醒和汇总

你可以把下面这段发给 OpenClaw/Hermes/QClaw 或本机安装器：

请帮我为 yin-yan 设置自动提醒：
- 每天 21:00 发送待复核和未来支出提醒
- 每天 21:05 发送今日汇总
- 每天 21:08 发送现金流心跳
- 每周日 21:10 发送本周复盘
- 每月 28 日 21:15 发送本月复盘

如果你只想本机计划任务，可以运行安装器：
powershell -NoProfile -ExecutionPolicy Bypass -File .\\installer\\install.ps1 -ReminderTime "21:00" -DailySummaryTime "21:05" -CashflowSummaryTime "21:08" -WeeklySummaryTime "21:10" -WeeklyDay Sunday -MonthlySummaryTime "21:15" -MonthlySummaryDay 28

不想现在设置也可以，直接开始记账：今天午饭 38，微信付的`;
}

function renderFirstRecordSetupPrompt() {
  return "建议设置每日提醒，发送“帮助”查看设置方式。";
}

function renderBar(percent, width = 10) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const filled = Math.round((normalized / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function categoryIcon(category) {
  if (containsAny(category, ["餐饮", "外卖", "午饭", "晚饭", "早餐", "咖啡", "正餐", "茶饮", "小吃", "饮料", "零食"])) return "🍱";
  if (containsAny(category, ["交通", "地铁", "公交", "打车"])) return "🚇";
  if (containsAny(category, ["日用品", "超市"])) return "🛒";
  if (containsAny(category, ["房租", "住房"])) return "🏠";
  if (containsAny(category, ["通信", "手机", "话费"])) return "📱";
  if (containsAny(category, ["订阅", "会员"])) return "🔁";
  if (containsAny(category, ["还款", "信用卡"])) return "💳";
  if (containsAny(category, ["收入", "工资"])) return "💰";
  return "•";
}

function formatMoney(amount) {
  const value = Number(amount ?? 0);
  return `¥${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function renderBudgetProgress(ledger) {
  const budgets = currentMonthBudgets(ledger);
  if (budgets.length === 0) return "无";

  return budgets.map((budget) => {
    if (budget.limit_type === "count_per_day") {
      const daily = todayBudgetCount(ledger, budget);
      return `${budget.category} 今日 ${daily.count}/${budget.count} 笔`;
    }
    const spent = currentMonthBudgetSpend(ledger, budget);
    const limit = budget.amount ?? 0;
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    const status = remaining < 0 ? `超出 ${Math.abs(remaining)}` : `剩余 ${remaining}`;
    return `${budget.category} ${spent}/${limit}，${status}，已用 ${percent}%`;
  }).join("；");
}

function renderBudgetAlerts(ledger) {
  const alerts = currentMonthBudgets(ledger)
    .map((budget) => {
      if (budget.limit_type === "count_per_day") {
        const daily = todayBudgetCount(ledger, budget);
        const limit = budget.count ?? 0;
        if (limit > 0 && daily.count > limit) {
          return `- ${budget.category}今日笔数已超：${daily.count}/${limit}`;
        }
        if (limit > 0 && daily.count === limit) {
          return `- ${budget.category}今日笔数已到上限：${daily.count}/${limit}`;
        }
        return null;
      }
      const spent = currentMonthBudgetSpend(ledger, budget);
      const limit = budget.amount ?? 0;
      if (limit <= 0) return null;
      const percent = spent / limit;
      if (percent >= 1) {
        return `- ${budget.category}预算已超：${spent}/${limit}`;
      }
      if (percent >= 0.8) {
        return `- ${budget.category}预算接近上限：${spent}/${limit}`;
      }
      return null;
    })
    .filter(Boolean);

  return alerts.join("\n") || "- 无";
}

function renderLedgerCompletionReminders(ledger) {
  const lines = [
    renderHistoricalProjectReminder(ledger),
    renderPastBillReminder(ledger),
    renderBalanceSnapshotReminder(ledger)
  ].filter(Boolean);

  return lines.slice(0, 3).join("\n") || "- 无";
}

function renderHistoricalProjectReminder(ledger) {
  const candidate = ledger.events
    .filter((event) => event.status !== "ignored")
    .filter(isHistoricalReminderCandidate)
    .filter((event) => event.amount !== null && event.amount !== undefined)
    .find((event) => !hasCurrentMonthSimilarRecord(ledger, event));

  if (!candidate) return null;

  const category = candidate.category ?? "固定项目";
  return `- 历史项目：之前记录过${category}${formatMoney(candidate.amount)}，本期如已发生可补一句“本月${category}${candidate.amount}已付”。`;
}

function isHistoricalReminderCandidate(event) {
  const date = eventDate(event);
  if (!date || date.slice(0, 7) >= currentDate().slice(0, 7)) return false;
  if (event.type === "fixed_cost" || event.type === "bill_due") return true;
  if (event.type !== "expense") return false;
  return isRecurringLikeCategory(event.category ?? "");
}

function eventDate(event) {
  return event.occurred_at ?? event.due_at ?? null;
}

function isRecurringLikeCategory(category) {
  return containsAny(category, ["房租", "生活缴费", "通信", "订阅", "还款", "固定支出"]);
}

function hasCurrentMonthSimilarRecord(ledger, target) {
  return ledger.events.some((event) => {
    if (event.id === target.id) return false;
    if (event.status === "ignored") return false;
    if (event.type === "goal" || event.type === "account_balance") return false;
    if (!inCurrentMonth(event)) return false;
    if ((event.category ?? "") !== (target.category ?? "")) return false;
    if (target.amount !== null && target.amount !== undefined && Number(event.amount) !== Number(target.amount)) {
      return false;
    }
    return true;
  });
}

function renderPastBillReminder(ledger) {
  const pastDates = [relativeDate(-1), relativeDate(-2)];
  const hasRecentPastExpense = ledger.events.some((event) =>
    event.status !== "ignored" &&
    event.type === "expense" &&
    pastDates.includes(event.occurred_at)
  );

  if (hasRecentPastExpense) return null;
  return "- 过去账单：如果昨天或前天有漏记支出/缴费，可以直接补一句“昨天电费50，微信付的”。";
}

function renderBalanceSnapshotReminder(ledger) {
  const hasRecentBalance = ledger.events.some((event) =>
    event.status !== "ignored" &&
    event.type === "account_balance" &&
    event.occurred_at &&
    daysFromCurrent(event.occurred_at) <= 7
  );

  if (hasRecentBalance) return null;

  const accountName = balanceExampleAccountName(ledger);
  return `- 账户余额：建议每周补一次主要账户余额，例如“${accountName}余额 200”。`;
}

function balanceExampleAccountName(ledger) {
  const account = ledger.entities.accounts.find((item) => item.status !== "archived")?.name;
  if (!account) return "微信";
  return account.replace(/支付$/, "");
}

function currentMonthBudgets(ledger) {
  const seen = new Map();
  for (const event of ledger.events) {
    if (event.type !== "goal") continue;
    if (!inCurrentMonth(event)) continue;
    if (!event.amount && event.budget_rule?.limit_type !== "count_per_day") continue;
    const key = budgetKey(event.budget_rule ?? event);
    seen.set(key, event);
  }
  return Array.from(seen.values()).map((event) => ({
    category: event.category ?? "消费目标",
    category_l1: event.category_l1 ?? event.budget_rule?.category_l1 ?? null,
    category_l2: event.category_l2 ?? event.budget_rule?.category_l2 ?? event.category ?? null,
    amount: event.budget_rule?.amount ?? event.amount,
    count: event.budget_rule?.count ?? null,
    limit_type: event.budget_rule?.limit_type ?? "amount_month",
    period: event.budget_rule?.period ?? "month",
    scope: event.budget_rule?.scope ?? "category_l2"
  }));
}

function currentMonthCategorySpend(ledger, category) {
  return sumAmounts(
    ledger.events.filter((event) =>
      event.type === "expense" &&
      event.category === category &&
      inCurrentMonth(event)
    )
  );
}

function currentMonthBudgetSpend(ledger, budget) {
  return sumAmounts(
    ledger.events.filter((event) =>
      event.type === "expense" &&
      eventMatchesBudget(event, budget) &&
      inCurrentMonth(event)
    )
  );
}

function todayBudgetCount(ledger, budget) {
  const events = ledger.events.filter((event) =>
    event.type === "expense" &&
    eventMatchesBudget(event, budget) &&
    event.occurred_at === currentDate()
  );
  return { count: events.length, events };
}

function eventMatchesBudget(event, budget) {
  if (budget.category_l2) return event.category_l2 === budget.category_l2 || event.category === budget.category_l2;
  if (budget.category_l1) return event.category_l1 === budget.category_l1 || event.category === budget.category_l1;
  return event.category === budget.category;
}

function budgetKey(budget) {
  return [
    budget.limit_type ?? "amount_month",
    budget.category_l2 ?? budget.category ?? "",
    budget.category_l1 ?? "",
    budget.period ?? "month"
  ].join(":");
}

function printUsage() {
  console.log(`Usage:
node yin-yan/scripts/ledger-cli.mjs init
node yin-yan/scripts/ledger-cli.mjs record --text "今天午饭 38，微信付的"
node yin-yan/scripts/ledger-cli.mjs remind --text "下周三还信用卡 3200"
node yin-yan/scripts/ledger-cli.mjs fixed --text "每月 5 号房租 2500"
node yin-yan/scripts/ledger-cli.mjs goal --text "这个月外卖别超过 800"
node yin-yan/scripts/ledger-cli.mjs balance --text "微信余额 200"
node yin-yan/scripts/ledger-cli.mjs review
node yin-yan/scripts/ledger-cli.mjs today
node yin-yan/scripts/ledger-cli.mjs week
node yin-yan/scripts/ledger-cli.mjs month
node yin-yan/scripts/ledger-cli.mjs heartbeat --type reminder
node yin-yan/scripts/ledger-cli.mjs heartbeat --type daily-summary
node yin-yan/scripts/ledger-cli.mjs heartbeat --type weekly-summary
node yin-yan/scripts/ledger-cli.mjs share-error
node yin-yan/scripts/ledger-cli.mjs export`);
}
