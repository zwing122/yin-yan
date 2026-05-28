const SAMPLE_LEDGER = expandSampleLedger({
  schema_version: "0.1",
  currency: "CNY",
  events: [
    {
      id: "sample_income_001",
      type: "income",
      status: "confirmed",
      occurred_at: "2026-05-10",
      amount: 12000,
      currency: "CNY",
      direction: "inflow",
      category: "收入",
      source: { raw_text: "收到工资 12000" },
      review: { required: false, reasons: [] }
    },
    {
      id: "sample_balance_001",
      type: "account_balance",
      status: "confirmed",
      occurred_at: "2026-05-13",
      amount: 3400,
      currency: "CNY",
      direction: "none",
      account: "银行卡",
      category: "账户余额",
      source: { raw_text: "银行卡余额 3400" },
      review: { required: false, reasons: [] }
    },
    {
      id: "sample_expense_001",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-11",
      amount: 39,
      currency: "CNY",
      direction: "outflow",
      account: "微信支付",
      category: "餐饮",
      source: { raw_text: "前天外卖 39" },
      tags: ["takeout"],
      review: { required: false, reasons: [] }
    },
    {
      id: "sample_expense_002",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-12",
      amount: 50,
      currency: "CNY",
      direction: "outflow",
      account: "微信支付",
      category: "生活缴费",
      source: { raw_text: "昨天电费 50" },
      review: { required: false, reasons: [] }
    },
    {
      id: "sample_expense_003",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-13",
      amount: 86,
      currency: "CNY",
      direction: "outflow",
      account: "支付宝",
      category: "日用品",
      source: { raw_text: "今天买日用品 86" },
      review: { required: false, reasons: [] }
    },
    {
      id: "sample_expense_004",
      type: "expense",
      status: "needs_review",
      occurred_at: "2026-05-13",
      amount: 35,
      currency: "CNY",
      direction: "outflow",
      category: "交通",
      source: { raw_text: "今天打车 35" },
      review: { required: true, reasons: ["account_missing"] }
    },
    {
      id: "sample_goal_001",
      type: "goal",
      status: "confirmed",
      occurred_at: "2026-05-13",
      amount: 800,
      currency: "CNY",
      direction: "none",
      category: "餐饮",
      source: { raw_text: "这个月外卖别超过 800" },
      review: { required: false, reasons: [] }
    },
    {
      id: "sample_bill_001",
      type: "bill_due",
      status: "needs_review",
      due_at: "2026-05-15",
      amount: 129,
      currency: "CNY",
      direction: "outflow",
      category: "通信",
      source: { raw_text: "每月 15 号手机套餐 129" },
      review: { required: true, reasons: ["recurrence_unclear"] }
    },
    {
      id: "sample_bill_002",
      type: "bill_due",
      status: "needs_review",
      due_at: "2026-05-20",
      amount: 3200,
      currency: "CNY",
      direction: "outflow",
      account: "招商卡",
      category: "还款",
      source: { raw_text: "下周三还信用卡 3200，招商卡" },
      review: { required: true, reasons: ["repayment_ambiguous"] }
    }
  ],
  profile: {
    latest_balances: [{ account: "银行卡", amount: 3400, currency: "CNY", occurred_at: "2026-05-13" }],
    known_budgets: [{ category: "餐饮", amount: 800, currency: "CNY" }],
    behavior_patterns: [
      { label: "餐饮高频", detail: "当前时间段餐饮出现多次小额记录，适合继续观察。" },
      { label: "待复核集中", detail: "未来账单和缺少账户的记录需要确认。" }
    ]
  },
  heartbeat: {
    pending_review_ids: ["sample_expense_004", "sample_bill_001", "sample_bill_002"],
    scheduled_item_ids: ["sample_bill_001", "sample_bill_002"]
  }
});

function expandSampleLedger(baseLedger) {
  const ledger = cloneLedger(baseLedger);
  const months = [
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"
  ];
  const recurring = [
    { day: "01", type: "fixed_cost", amount: 2800, category: "住房", account: "银行卡", raw: "房租 2800，银行卡自动扣" },
    { day: "05", type: "expense", amount: 129, category: "通信", account: "支付宝", raw: "手机套餐 129" },
    { day: "08", type: "expense", amount: 45, category: "交通", account: "微信支付", raw: "地铁和公交 45" },
    { day: "18", type: "expense", amount: 89, category: "日用品", account: "支付宝", raw: "日用品补货 89" },
    { day: "24", type: "expense", amount: 199, category: "学习", account: "银行卡", raw: "课程订阅 199" }
  ];
  const variable = [
    { day: "03", category: "餐饮", amount: 32, raw: "早餐和咖啡 32", tags: ["coffee"] },
    { day: "06", category: "餐饮", amount: 48, raw: "工作日晚餐 48", tags: ["takeout"] },
    { day: "09", category: "娱乐", amount: 68, raw: "周末电影 68" },
    { day: "12", category: "餐饮", amount: 26, raw: "便利店简餐 26" },
    { day: "15", category: "医疗", amount: 36, raw: "感冒药 36" },
    { day: "19", category: "餐饮", amount: 55, raw: "同事聚餐 AA 55", tags: ["dining"] },
    { day: "22", category: "服饰", amount: 188, raw: "换季衣物 188" },
    { day: "27", category: "交通", amount: 24, raw: "晚高峰打车补贴后 24" }
  ];
  const generated = [];

  months.forEach((month, monthIndex) => {
    generated.push({
      id: `long_${month}_income_salary`,
      type: "income",
      status: "confirmed",
      occurred_at: `${month}-10`,
      amount: 12500 + (monthIndex % 3) * 300,
      currency: "CNY",
      direction: "inflow",
      account: "银行卡",
      category: "收入",
      source: { raw_text: `${month} 工资到账` },
      review: { required: false, reasons: [] }
    });

    generated.push({
      id: `long_${month}_balance_snapshot`,
      type: "account_balance",
      status: "confirmed",
      occurred_at: `${month}-28`,
      amount: 4200 + monthIndex * 260,
      currency: "CNY",
      direction: "none",
      account: "银行卡",
      category: "账户余额",
      source: { raw_text: `${month} 月末银行卡余额快照` },
      review: { required: false, reasons: [] }
    });

    recurring.forEach((item, index) => {
      generated.push({
        id: `long_${month}_recurring_${index + 1}`,
        type: item.type,
        status: "confirmed",
        occurred_at: `${month}-${item.day}`,
        amount: item.amount,
        currency: "CNY",
        direction: "outflow",
        account: item.account,
        category: item.category,
        source: { raw_text: item.raw },
        review: { required: false, reasons: [] }
      });
    });

    variable.forEach((item, index) => {
      generated.push({
        id: `long_${month}_expense_${index + 1}`,
        type: "expense",
        status: "confirmed",
        occurred_at: `${month}-${item.day}`,
        amount: item.amount + ((monthIndex + index) % 4) * 7,
        currency: "CNY",
        direction: "outflow",
        account: index % 2 === 0 ? "微信支付" : "支付宝",
        category: item.category,
        source: { raw_text: item.raw },
        tags: item.tags || [],
        review: { required: false, reasons: [] }
      });
    });

    if (["2025-10", "2026-02", "2026-05"].includes(month)) {
      generated.push({
        id: `long_${month}_review_taxi`,
        type: "expense",
        status: "needs_review",
        occurred_at: `${month}-21`,
        amount: 64 + monthIndex,
        currency: "CNY",
        direction: "outflow",
        category: "交通",
        source: { raw_text: "晚上打车，忘了用哪个账户" },
        review: { required: true, reasons: ["account_missing"] }
      });
    }
  });

  generated.push(
    {
      id: "long_2026_05_bill_rent_next",
      type: "bill_due",
      status: "needs_review",
      due_at: "2026-05-28",
      amount: 2800,
      currency: "CNY",
      direction: "outflow",
      account: "银行卡",
      category: "住房",
      source: { raw_text: "月底房租 2800，确认是否已经自动扣款" },
      review: { required: true, reasons: ["recurrence_unclear"] }
    },
    {
      id: "long_2026_05_reimbursement",
      type: "income",
      status: "needs_review",
      occurred_at: "2026-05-27",
      amount: 368,
      currency: "CNY",
      direction: "inflow",
      category: "报销",
      source: { raw_text: "报销 368 到账？需要确认是不是本月" },
      review: { required: true, reasons: ["date_unclear"] }
    }
  );

  ledger.events = [...generated, ...ledger.events];
  ledger.entities = {
    accounts: ["银行卡", "微信支付", "支付宝", "招商卡"],
    categories: ["收入", "餐饮", "交通", "住房", "通信", "日用品", "学习", "娱乐", "医疗", "服饰", "报销", "还款"]
  };
  ledger.profile = {
    ...ledger.profile,
    latest_balances: [
      { account: "银行卡", amount: 6800, currency: "CNY", occurred_at: "2026-05-28" },
      { account: "微信支付", amount: 520, currency: "CNY", occurred_at: "2026-05-28" },
      { account: "支付宝", amount: 1460, currency: "CNY", occurred_at: "2026-05-28" }
    ],
    known_budgets: [
      { category: "餐饮", amount: 1800, currency: "CNY" },
      { category: "交通", amount: 650, currency: "CNY" },
      { category: "娱乐", amount: 500, currency: "CNY" },
      { category: "学习", amount: 450, currency: "CNY" }
    ],
    known_fixed_costs: [
      { category: "住房", amount: 2800, currency: "CNY", day: 1 },
      { category: "通信", amount: 129, currency: "CNY", day: 5 }
    ],
    behavior_patterns: [
      ...(ledger.profile?.behavior_patterns || []),
      { label: "长周期样例", detail: "示例覆盖 2025-07 至 2026-05，可验证年月日筛选、同比、环比和事件流。" },
      { label: "餐饮高频", detail: "工作日小额餐饮持续出现，适合观察预算和低值高频消费。" }
    ]
  };
  ledger.heartbeat = {
    pending_review_ids: ledger.events
      .filter((event) => event.status === "needs_review" || event.review?.required)
      .map((event) => event.id)
      .filter(Boolean),
    scheduled_item_ids: ledger.events
      .filter((event) => event.due_at && event.status !== "ignored")
      .map((event) => event.id)
      .filter(Boolean)
  };
  return ledger;
}

let currentViewModel = null;
let currentLedger = null;
let selectedRecordIds = new Set();
let currentSourceLabel = "";
let currentFileHandle = null;
let autoSaveTimer = null;
let periodState = { preset: "active_month", start: "", end: "" };

const CACHE_KEY = "yin-yan.web-review.cached-ledger";
const CACHE_META_KEY = "yin-yan.web-review.cached-meta";
const DB_NAME = "yin-yan-web-review";
const DB_STORE = "handles";
const LEDGER_FILE_HANDLE_KEY = "ledger-file";
const LEDGER_DIRECTORY_HANDLE_KEY = "ledger-directory";

if (typeof document !== "undefined") {
  const input = document.getElementById("ledgerInput");
  const sampleButton = document.getElementById("sampleButton");
  const openFileButton = document.getElementById("openFileButton");
  const openFolderButton = document.getElementById("openFolderButton");
  const saveFileButton = document.getElementById("saveFileButton");
  const periodPreset = document.getElementById("periodPreset");
  const periodStart = document.getElementById("periodStart");
  const periodEnd = document.getElementById("periodEnd");
  const applyPeriodButton = document.getElementById("applyPeriodButton");
  const dropzone = document.getElementById("dropzone");
  const recordSearch = document.getElementById("recordSearch");
  const typeFilter = document.getElementById("typeFilter");
  const statusFilter = document.getElementById("statusFilter");
  const organizerOnly = document.getElementById("organizerOnly");
  const bulkCategory = document.getElementById("bulkCategory");
  const customCategory = document.getElementById("customCategory");
  const bulkCategoryButton = document.getElementById("bulkCategoryButton");
  const bulkConfirmButton = document.getElementById("bulkConfirmButton");
  const saveEditButton = document.getElementById("saveEditButton");
  const exportButton = document.getElementById("exportButton");

  input.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadFile(file);
  });

  sampleButton.addEventListener("click", () => {
    renderLedger(SAMPLE_LEDGER, "示例账本", { cache: false });
  });

  openFileButton.addEventListener("click", openLedgerFile);
  openFolderButton.addEventListener("click", openLedgerFolder);
  saveFileButton.addEventListener("click", saveCurrentLedgerToFile);
  applyPeriodButton.addEventListener("click", () => {
    periodState = {
      preset: periodPreset.value,
      start: periodStart.value,
      end: periodEnd.value
    };
    rerenderCurrentLedger("已切换复盘时间段。", { skipSave: true });
  });
  periodPreset.addEventListener("change", () => {
    if (!currentViewModel) return;
    const nextPeriod = resolvePeriod({ preset: periodPreset.value, start: periodStart.value, end: periodEnd.value }, currentViewModel.activeMonth);
    periodStart.value = nextPeriod.start;
    periodEnd.value = nextPeriod.end;
  });
  for (const control of [periodStart, periodEnd]) {
    control.addEventListener("input", () => {
      periodPreset.value = "custom";
    });
    control.addEventListener("change", () => {
      periodPreset.value = "custom";
    });
  }

  for (const control of [recordSearch, typeFilter, statusFilter, organizerOnly]) {
    control.addEventListener("input", () => {
      if (!currentViewModel) return;
      renderRecentTable("recentTable", filterRecords(currentViewModel.recentAll));
    });
  }

  bulkCategoryButton.addEventListener("click", () => {
    const category = customCategory.value.trim() || bulkCategory.value;
    if (!category) {
      setOrganizerStatus("请先选择或输入分类。");
      return;
    }
    updateLedgerWithBulkEdit({ category });
  });

  bulkConfirmButton.addEventListener("click", () => {
    updateLedgerWithBulkEdit({ confirm: true });
  });

  saveEditButton.addEventListener("click", saveCurrentLedgerToFile);

  exportButton.addEventListener("click", () => {
    if (!currentLedger) {
      setOrganizerStatus("请先导入账本。");
      return;
    }
    downloadText("yin-yan-ledger-edited.json", buildExportJson(currentLedger));
    setOrganizerStatus("已生成导出文件，原始账本不会被自动覆盖。");
  });

  for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  }

  for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  }

  dropzone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await loadFile(file);
  });

  if (new URLSearchParams(window.location.search).get("sample") === "1") {
    renderLedger(SAMPLE_LEDGER, "示例账本", { cache: false });
  } else {
    restoreLastLedger();
  }
}

async function loadFile(file) {
  try {
    const ledger = JSON.parse(await file.text());
    renderLedger(ledger, file.name);
  } catch (error) {
    showError(`无法读取账本：${error.message}`);
    setText("fileStatus", `${file.name} 解析失败`);
  }
}

async function openLedgerFile() {
  if (!supportsFileSystemAccess()) {
    setOrganizerStatus("当前浏览器不支持直接授权文件，请继续使用“选择 JSON”和“导出 JSON”。");
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "银砚 Ledger JSON",
        accept: { "application/json": [".json"] }
      }]
    });
    if (!handle) return;
    await loadFileHandle(handle, "已授权账本文件");
    currentFileHandle = handle;
    await saveHandle(LEDGER_FILE_HANDLE_KEY, handle);
    setOrganizerStatus("已授权账本文件；之后打开页面会尝试自动读取。");
  } catch (error) {
    if (error.name !== "AbortError") showError(`无法授权文件：${error.message}`);
  }
}

async function openLedgerFolder() {
  if (!supportsFileSystemAccess()) {
    setOrganizerStatus("当前浏览器不支持直接授权文件夹，请继续使用“选择 JSON”和“导出 JSON”。");
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const fileHandle = await findLedgerFileInDirectory(handle);
    if (!fileHandle) {
      setOrganizerStatus("没有在该文件夹找到 ledger.json 或其他 JSON 账本文件。");
      return;
    }
    await loadFileHandle(fileHandle, `已授权文件夹：${fileHandle.name}`);
    currentFileHandle = fileHandle;
    await saveHandle(LEDGER_DIRECTORY_HANDLE_KEY, handle);
    await saveHandle(LEDGER_FILE_HANDLE_KEY, fileHandle);
    setOrganizerStatus(`已从目标文件夹读取 ${fileHandle.name}；之后会优先尝试自动读取。`);
  } catch (error) {
    if (error.name !== "AbortError") showError(`无法授权文件夹：${error.message}`);
  }
}

async function loadFileHandle(handle, label) {
  const permission = await ensureHandlePermission(handle, "read");
  if (!permission) {
    setOrganizerStatus("浏览器没有读取权限，请重新授权文件。");
    return;
  }
  const file = await handle.getFile();
  const ledger = JSON.parse(await file.text());
  renderLedger(ledger, label || file.name, { source: "file-handle" });
}

async function restoreLastLedger() {
  const restoredFromFile = await restoreFromSavedHandle();
  if (restoredFromFile) return;
  restoreCachedLedger();
}

async function restoreFromSavedHandle() {
  if (!supportsFileSystemAccess()) return false;
  try {
    const handle = await loadHandle(LEDGER_FILE_HANDLE_KEY);
    if (!handle) return false;
    const permission = await ensureHandlePermission(handle, "read");
    if (!permission) return false;
    currentFileHandle = handle;
    await loadFileHandle(handle, `自动读取：${handle.name}`);
    setOrganizerStatus("已自动读取上次授权的账本文件。");
    return true;
  } catch {
    return false;
  }
}

function restoreCachedLedger() {
  try {
    const text = localStorage.getItem(CACHE_KEY);
    if (!text) return false;
    const meta = JSON.parse(localStorage.getItem(CACHE_META_KEY) || "{}");
    const ledger = JSON.parse(text);
    renderLedger(ledger, meta.label || "浏览器缓存", { cache: false, source: "cache" });
    const time = meta.updated_at ? ` · ${formatDateTime(meta.updated_at)}` : "";
    setOrganizerStatus(`已从浏览器缓存恢复账本${time}。`);
    return true;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_META_KEY);
    return false;
  }
}

function renderLedger(ledger, label, options = {}) {
  currentLedger = cloneLedger(ledger);
  currentSourceLabel = label;
  selectedRecordIds = new Set();
  const viewModel = buildViewModel(currentLedger);
  currentViewModel = viewModel;
  applyViewModel(viewModel);
  syncPeriodControls(viewModel.period);
  renderHealthCheck(checkLedgerHealth(currentLedger));
  setText("fileStatus", `${label} · ${viewModel.eventCount} 条记录 · ${viewModel.activeMonth}`);
  setNotice("账本已在浏览器本地完成解析，页面会自动保存一份浏览器缓存；授权文件后可保存回原 JSON。");
  if (options.cache !== false) persistLedgerCache(label);
}

function rerenderCurrentLedger(message, options = {}) {
  if (!currentLedger) return;
  const viewModel = buildViewModel(currentLedger);
  currentViewModel = viewModel;
  applyViewModel(viewModel);
  syncPeriodControls(viewModel.period);
  renderHealthCheck(checkLedgerHealth(currentLedger));
  setText("fileStatus", `已编辑 · ${viewModel.eventCount} 条记录 · ${viewModel.period.label}`);
  if (message) setOrganizerStatus(message);
  if (options.skipSave) return;
  persistLedgerCache(currentSourceLabel || "已编辑账本");
  scheduleAutoSaveToFile();
}

function buildViewModel(ledger, nextPeriodState = periodState) {
  const events = Array.isArray(ledger.events) ? ledger.events.filter((item) => item.status !== "ignored") : [];
  const calculationEvents = events.filter(isCalculableEvent);
  const activeMonth = pickActiveMonth(calculationEvents);
  const period = resolvePeriod(nextPeriodState, activeMonth);
  const periodEvents = calculationEvents.filter((item) => isWithinRange(eventDate(item), period.start, period.end));
  const periodIncome = periodEvents.filter(isIncome);
  const periodExpenses = periodEvents.filter(isRealizedExpense);
  const previousPeriod = shiftPeriod(period, -period.days);
  const yearPeriod = shiftPeriodYears(period, -1);
  const previousEvents = calculationEvents.filter((item) => isWithinRange(eventDate(item), previousPeriod.start, previousPeriod.end));
  const yearEvents = calculationEvents.filter((item) => isWithinRange(eventDate(item), yearPeriod.start, yearPeriod.end));
  const pending = events.filter((item) => item.status === "needs_review" || item.review?.required);
  const upcoming = events
    .filter((item) => isCalculableEvent(item) && item.due_at && withinNextDays(item, 7))
    .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)));
  const incomeTotal = sum(periodIncome);
  const spendTotal = sum(periodExpenses);
  const previousIncomeTotal = sum(previousEvents.filter(isIncome));
  const previousSpendTotal = sum(previousEvents.filter(isRealizedExpense));
  const yearIncomeTotal = sum(yearEvents.filter(isIncome));
  const yearSpendTotal = sum(yearEvents.filter(isRealizedExpense));
  const previousExpenses = previousEvents.filter(isRealizedExpense);
  const yearExpenses = yearEvents.filter(isRealizedExpense);
  const profile = ledger.profile || {};
  const currentCategoryTotals = categoryTotals(periodExpenses);
  const previousCategoryTotals = categoryTotals(previousExpenses);
  const yearCategoryTotals = categoryTotals(yearExpenses);

  return {
    activeMonth,
    period,
    eventCount: events.length,
    periodEventCount: periodEvents.length,
    balance: totalBalance(profile),
    incomeTotal,
    spendTotal,
    netTotal: incomeTotal - spendTotal,
    comparisons: {
      spendPrevious: compareTotals(spendTotal, previousSpendTotal),
      spendYear: compareTotals(spendTotal, yearSpendTotal),
      incomePrevious: compareTotals(incomeTotal, previousIncomeTotal),
      incomeYear: compareTotals(incomeTotal, yearIncomeTotal),
      previousPeriod,
      yearPeriod,
      previousSpendTotal,
      yearSpendTotal,
      previousIncomeTotal,
      yearIncomeTotal
    },
    upcomingTotal: sum(upcoming),
    pending,
    reviewImpact: reviewImpactItems(pending),
    categoryTotals: currentCategoryTotals,
    categoryDetails: categoryDetailRows(currentCategoryTotals, previousCategoryTotals, yearCategoryTotals, spendTotal),
    lowValueItems: lowValueFrequentItems(periodExpenses),
    dailyHeatmap: dailyHeatmapRows(periodExpenses, period),
    futureFixedItems: futureFixedRows(events),
    ruleSuggestions: ruleSuggestionItems(events),
    fireflyMapping: fireflyMappingItems(events),
    budgets: currentMonthBudgets(ledger, activeMonth),
    trend: trendData(periodEvents, period),
    eventStream: eventStreamRows(periodEvents),
    upcoming,
    recent: recentEvents(events),
    recentAll: recentEvents(events, 200),
    cashflowStatus: cashflowStatus(incomeTotal, spendTotal, pending.length),
    patterns: profile.behavior_patterns || [],
    insights: buildInsights({ incomeTotal, spendTotal, pending, upcoming, monthExpenses: periodExpenses, ledger, activeMonth, period })
  };
}

function applyViewModel(viewModel) {
  setText("balance", money(viewModel.balance));
  setText("monthIncome", money(viewModel.incomeTotal));
  setText("monthSpend", money(viewModel.spendTotal));
  setText("monthNet", money(viewModel.netTotal));
  setText("upcoming", money(viewModel.upcomingTotal));
  setText("pendingTotal", `${viewModel.pending.length}`);
  setText("activeMonth", `${viewModel.period.label} · ${viewModel.periodEventCount} 条记录`);
  setText("cashflowStatus", viewModel.cashflowStatus);
  setText("pendingCount", `${viewModel.pending.length} 条记录`);
  setText("recordTotal", `${viewModel.periodEventCount} 条记录`);
  setText("periodSummary", viewModel.period.label);
  renderComparison("spendPrevious", viewModel.comparisons.spendPrevious, viewModel.comparisons.previousSpendTotal, viewModel.comparisons.previousPeriod);
  renderComparison("spendYear", viewModel.comparisons.spendYear, viewModel.comparisons.yearSpendTotal, viewModel.comparisons.yearPeriod);
  renderComparison("incomePrevious", viewModel.comparisons.incomePrevious, viewModel.comparisons.previousIncomeTotal, viewModel.comparisons.previousPeriod);
  renderComparison("incomeYear", viewModel.comparisons.incomeYear, viewModel.comparisons.yearIncomeTotal, viewModel.comparisons.yearPeriod);

  document.getElementById("monthNet").style.color = viewModel.netTotal >= 0 ? "var(--accent)" : "var(--danger)";

  renderTrend("trendChart", viewModel.trend);
  renderBars("categoryBars", viewModel.categoryTotals, viewModel.spendTotal, "secondary");
  renderEventStream("eventStream", viewModel.eventStream);
  renderRose("roseChart", viewModel.categoryTotals, viewModel.spendTotal);
  renderBudgetBars("budgetBars", viewModel.budgets, viewModel.categoryTotals);
  renderCategoryDetailTable("categoryDetailTable", viewModel.categoryDetails);
  renderCalendarHeatmap("calendarHeatmap", viewModel.dailyHeatmap);
  renderLowValueTable("lowValueTable", viewModel.lowValueItems);
  renderLowValueBubble("lowValueBubble", viewModel.lowValueItems);
  renderFutureFixedTable("futureFixedTable", viewModel.futureFixedItems);
  renderRuleSuggestions("ruleSuggestionList", viewModel.ruleSuggestions);
  renderFireflyMapping("fireflyMappingList", viewModel.fireflyMapping);
  renderReviewImpact("reviewImpactList", viewModel.reviewImpact);
  renderInsights("insightList", viewModel.insights);
  renderList("pendingList", viewModel.pending.slice(0, 6), renderPendingItem);
  renderList("upcomingList", viewModel.upcoming.slice(0, 6), renderUpcomingItem);
  renderRecentTable("recentTable", filterRecords(viewModel.recentAll));
}

function syncPeriodControls(period) {
  if (typeof document === "undefined" || !period) return;
  const start = document.getElementById("periodStart");
  const end = document.getElementById("periodEnd");
  if (start) start.value = period.start;
  if (end) end.value = period.end;
}

function checkLedgerHealth(ledger) {
  const issues = [];
  const add = (level, message) => issues.push({ level, message });

  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    return {
      status: "error",
      summary: "账本无法识别：顶层必须是 JSON 对象。",
      issues: [{ level: "error", message: "导入文件不是 ledger 对象，请检查是否选错文件。" }]
    };
  }

  if (ledger.schema_version !== "0.1") add("error", "schema_version 缺失或不是 0.1。");
  if (!Array.isArray(ledger.events)) add("error", "events 缺失或不是数组，复盘结果可能不可信。");
  if (!ledger.profile || typeof ledger.profile !== "object" || Array.isArray(ledger.profile)) {
    add("warning", "缺少 profile 对象，现金流画像、余额和预算可能不完整。");
  }
  if (!ledger.entities || typeof ledger.entities !== "object") {
    add("warning", "缺少 entities 对象，账户和分类整理能力会变弱。");
  } else {
    if (!Array.isArray(ledger.entities.accounts)) add("warning", "entities.accounts 缺失或不是数组。");
    if (!Array.isArray(ledger.entities.categories)) add("warning", "entities.categories 缺失或不是数组。");
  }
  if (!ledger.heartbeat || typeof ledger.heartbeat !== "object") {
    add("warning", "缺少 heartbeat 对象，待复核和未来提醒计数可能不准。");
  }

  const events = Array.isArray(ledger.events) ? ledger.events : [];
  const eventIds = new Set();
  const today = new Date(currentDate());
  let negativeAmounts = 0;
  let invalidAmounts = 0;
  let invalidDates = 0;
  let futureOccurred = 0;
  let missingRawText = 0;
  let missingCategory = 0;
  let missingAccountExpenses = 0;
  let duplicateIds = 0;

  for (const [index, event] of events.entries()) {
    const label = event.id || `第 ${index + 1} 条`;
    if (!event.id) add("warning", `${label} 缺少 id，后续复核引用会不稳定。`);
    if (event.id && eventIds.has(event.id)) duplicateIds += 1;
    if (event.id) eventIds.add(event.id);
    if (!event.type) add("warning", `${label} 缺少 type。`);
    if (!event.status) add("warning", `${label} 缺少 status。`);
    if (!event.source?.raw_text) missingRawText += 1;
    if (!event.category && event.type !== "account_balance") missingCategory += 1;
    if (event.type === "expense" && !event.account) missingAccountExpenses += 1;

    if (event.amount !== null && event.amount !== undefined) {
      const amount = Number(event.amount);
      if (Number.isNaN(amount)) invalidAmounts += 1;
      if (amount < 0) negativeAmounts += 1;
    }

    for (const field of ["occurred_at", "due_at"]) {
      const value = event[field];
      if (!value) continue;
      if (!isDateString(value)) {
        invalidDates += 1;
        continue;
      }
      if (field === "occurred_at" && new Date(value) > today) futureOccurred += 1;
    }
  }

  if (duplicateIds) add("error", `${duplicateIds} 条记录 id 重复，会影响复核和去重。`);
  if (invalidAmounts) add("error", `${invalidAmounts} 条记录金额不是有效数字。`);
  if (negativeAmounts) add("error", `${negativeAmounts} 条记录金额为负数。`);
  if (invalidDates) add("error", `${invalidDates} 个日期不是 YYYY-MM-DD 格式。`);
  if (futureOccurred) add("warning", `${futureOccurred} 条已发生记录日期在未来，可能是记错日期或应作为未来支出。`);
  if (missingRawText) add("warning", `${missingRawText} 条记录缺少原始文本，后续复核难度会增加。`);
  if (missingCategory) add("info", `${missingCategory} 条记录缺少分类，可在后续整理台批量归类。`);
  if (missingAccountExpenses) add("info", `${missingAccountExpenses} 条支出缺少账户，现金流分账户复盘会不完整。`);

  const heartbeat = ledger.heartbeat || {};
  const pendingIds = Array.isArray(heartbeat.pending_review_ids) ? heartbeat.pending_review_ids : [];
  const scheduledIds = Array.isArray(heartbeat.scheduled_item_ids) ? heartbeat.scheduled_item_ids : [];
  const missingPending = pendingIds.filter((id) => !eventIds.has(id)).length;
  const missingScheduled = scheduledIds.filter((id) => !eventIds.has(id)).length;
  if (missingPending) add("warning", `${missingPending} 个待复核引用找不到对应记录。`);
  if (missingScheduled) add("warning", `${missingScheduled} 个未来提醒引用找不到对应记录。`);

  const needsReview = events.filter((event) => event.status === "needs_review" || event.review?.required).length;
  if (needsReview >= 5) add("info", `当前有 ${needsReview} 条待复核，建议先集中处理，否则复盘可信度会下降。`);

  const status = issues.some((item) => item.level === "error")
    ? "error"
    : issues.some((item) => item.level === "warning")
      ? "warning"
      : "ok";
  const summary = status === "ok"
    ? "账本结构正常，可以继续查看复盘。"
    : `发现 ${countIssues(issues, "error")} 个需修正、${countIssues(issues, "warning")} 个建议复核的问题。`;

  return { status, summary, issues };
}

function renderHealthCheck(result) {
  const badge = document.getElementById("healthBadge");
  const issues = result.issues || [];
  const errors = countIssues(issues, "error");
  const warnings = countIssues(issues, "warning");
  const infos = countIssues(issues, "info");
  const label = result.status === "ok" ? "结构正常" : result.status === "error" ? "需要修正" : "建议复核";

  badge.className = `health-badge ${result.status === "warning" ? "warn" : result.status}`;
  badge.textContent = label;
  setText("healthSummary", result.summary);
  setText("healthErrors", String(errors));
  setText("healthWarnings", String(warnings));
  setText("healthInfos", String(infos));

  const list = document.getElementById("healthIssues");
  if (!issues.length) {
    list.innerHTML = `<li class="muted">未发现结构性问题。</li>`;
    return;
  }
  list.innerHTML = issues
    .slice(0, 12)
    .map((item) => `
      <li>
        <span class="health-level ${item.level}">${healthLevelLabel(item.level)}</span>
        <span class="health-message">${escapeHtml(item.message)}</span>
      </li>
    `)
    .join("");
}

function countIssues(issues, level) {
  return issues.filter((item) => item.level === level).length;
}

function healthLevelLabel(level) {
  if (level === "error") return "需修正";
  if (level === "warning") return "复核";
  return "提示";
}

function renderTrend(id, items) {
  const target = document.getElementById(id);
  if (!items.some((item) => item.income || item.expense)) {
    target.className = "chart-empty";
    target.textContent = "暂无当前时间段现金流记录";
    return;
  }

  const width = 900;
  const height = 250;
  const top = 22;
  const bottom = 36;
  const left = 38;
  const right = 18;
  const maxValue = Math.max(...items.map((item) => Math.max(item.income, item.expense)), 1);
  const xStep = (width - left - right) / Math.max(items.length - 1, 1);
  const y = (value) => height - bottom - (value / maxValue) * (height - top - bottom);
  const points = (key) => items.map((item, index) => `${left + index * xStep},${y(item[key])}`).join(" ");
  const labels = items
    .filter((_, index) => index === 0 || index === items.length - 1 || index % 5 === 0)
    .map((item, index) => {
      const sourceIndex = items.indexOf(item);
      return `<text x="${left + sourceIndex * xStep}" y="${height - 10}" text-anchor="middle">${escapeHtml(item.day)}</text>`;
    })
    .join("");

  target.className = "chart";
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="时间段现金流趋势">
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#dce5e1" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#dce5e1" />
      <polyline points="${points("income")}" fill="none" stroke="#13795b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <polyline points="${points("expense")}" fill="none" stroke="#176b87" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      ${labels}
      <text x="${width - 170}" y="24" fill="#13795b">收入</text>
      <text x="${width - 94}" y="24" fill="#176b87">支出</text>
    </svg>
  `;
}

function renderBars(id, items, total, variant = "") {
  const target = document.getElementById(id);
  if (!items.length || total <= 0) {
    target.className = "bars empty";
    target.textContent = "暂无数据";
    return;
  }

  target.className = "bars";
  target.innerHTML = items.slice(0, 7).map((item) => {
    const percent = Math.round((item.amount / total) * 100);
    return `
      <div class="bar-row">
        <div class="bar-meta"><span>${escapeHtml(item.category)}</span><strong>${money(item.amount)} · ${percent}%</strong></div>
        <div class="bar-track"><div class="bar-fill ${variant}" style="--value:${Math.min(percent, 100)}%"></div></div>
      </div>
    `;
  }).join("");
}

function renderRose(id, items, total) {
  const target = document.getElementById(id);
  const visibleItems = items.filter((item) => item.amount > 0).slice(0, 6);
  if (!visibleItems.length || total <= 0) {
    target.className = "rose-empty";
    target.textContent = "暂无数据";
    return;
  }

  const palette = ["#176b87", "#13795b", "#c1772d", "#7c5c9f", "#b95050", "#5f6f52"];
  const maxAmount = Math.max(...visibleItems.map((item) => item.amount), 1);
  const center = 100;
  const baseRadius = 24;
  const maxRadius = 86;
  const slice = (Math.PI * 2) / visibleItems.length;
  const segments = visibleItems.map((item, index) => {
    const start = index * slice - Math.PI / 2;
    const end = start + slice * 0.88;
    const radius = baseRadius + Math.sqrt(item.amount / maxAmount) * (maxRadius - baseRadius);
    const path = sectorPath(center, center, radius, start, end);
    return `<path d="${path}" fill="${palette[index % palette.length]}" opacity="0.88"><title>${escapeHtml(item.category)} ${money(item.amount)}</title></path>`;
  }).join("");
  const legend = visibleItems.map((item, index) => {
    const percent = Math.round((item.amount / total) * 100);
    return `<li><span class="pie-dot" style="--dot:${palette[index % palette.length]}"></span><span>${escapeHtml(item.category)}</span><strong>${percent}%</strong></li>`;
  }).join("");

  target.className = "rose-chart";
  target.innerHTML = `
    <div class="rose-wrap">
      <svg class="rose-svg" viewBox="0 0 200 200" role="img" aria-label="消费类型玫瑰图">
        <circle cx="${center}" cy="${center}" r="${baseRadius}" fill="#fff" stroke="#edf2ef" />
        ${segments}
      </svg>
      <ul class="pie-legend">${legend}</ul>
    </div>
  `;
}

function renderCategoryDetailTable(id, rows) {
  const target = document.getElementById(id);
  if (!rows.length) {
    target.innerHTML = `<div class="chart-empty">暂无分类明细</div>`;
    return;
  }
  target.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr>
          <th>分类</th>
          <th>金额</th>
          <th>占比</th>
          <th>次数</th>
          <th>平均单笔</th>
          <th>环比</th>
          <th>同比</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${money(row.amount)}</td>
            <td>${row.percent}%</td>
            <td>${row.count}</td>
            <td>${money(row.average)}</td>
            <td>${formatCompareCell(row.previousCompare)}</td>
            <td>${formatCompareCell(row.yearCompare)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderLowValueTable(id, rows) {
  const target = document.getElementById(id);
  if (!rows.length) {
    target.innerHTML = `<div class="chart-empty">暂无高频低值消费</div>`;
    return;
  }
  target.innerHTML = `
    <table class="stats-table compact">
      <thead>
        <tr>
          <th>分类</th>
          <th>次数</th>
          <th>合计</th>
          <th>均价</th>
          <th>典型记录</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.category)}</td>
            <td>${row.count}</td>
            <td>${money(row.amount)}</td>
            <td>${money(row.average)}</td>
            <td>${escapeHtml(row.example)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderLowValueBubble(id, rows) {
  const target = document.getElementById(id);
  if (!rows.length) {
    target.className = "bubble-empty";
    target.textContent = "暂无数据";
    return;
  }
  const width = 420;
  const height = 250;
  const left = 44;
  const right = 20;
  const top = 18;
  const bottom = 36;
  const maxCount = Math.max(...rows.map((row) => row.count), 1);
  const maxAmount = Math.max(...rows.map((row) => row.amount), 1);
  const maxAverage = Math.max(...rows.map((row) => row.average), 1);
  const x = (count) => left + (count / maxCount) * (width - left - right);
  const y = (amount) => height - bottom - (amount / maxAmount) * (height - top - bottom);
  const palette = ["#176b87", "#13795b", "#c1772d", "#7c5c9f", "#b95050", "#5f6f52"];
  const circles = rows.slice(0, 8).map((row, index) => {
    const radius = 8 + (row.average / maxAverage) * 18;
    return `
      <g>
        <circle cx="${x(row.count)}" cy="${y(row.amount)}" r="${radius}" fill="${palette[index % palette.length]}" opacity="0.74" />
        <text x="${x(row.count)}" y="${Math.max(14, y(row.amount) - radius - 5)}" text-anchor="middle">${escapeHtml(row.category)}</text>
      </g>
    `;
  }).join("");
  target.className = "bubble-chart";
  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="高频低值消费气泡图">
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#dce5e1" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#dce5e1" />
      ${circles}
      <text x="${width - 72}" y="${height - 10}">次数</text>
      <text x="8" y="20">合计</text>
    </svg>
  `;
}

function renderCalendarHeatmap(id, rows) {
  const target = document.getElementById(id);
  if (!rows.length) {
    target.className = "heatmap-empty";
    target.textContent = "暂无数据";
    return;
  }
  const maxAmount = Math.max(...rows.map((row) => row.amount), 1);
  target.className = "heatmap";
  target.innerHTML = rows.map((row) => {
    const level = row.amount <= 0 ? 0 : Math.max(1, Math.ceil((row.amount / maxAmount) * 4));
    return `<div class="heat-cell level-${level}" title="${escapeHtml(row.date)} ${money(row.amount)}"><span>${row.date.slice(8)}</span></div>`;
  }).join("");
}

function renderFutureFixedTable(id, rows) {
  const target = document.getElementById(id);
  if (!rows.length) {
    target.innerHTML = `<div class="chart-empty">暂无固定支出或未来支出</div>`;
    return;
  }
  target.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>类型</th>
          <th>事项</th>
          <th>金额</th>
          <th>账户</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.date)}</td>
            <td>${escapeHtml(row.type)}</td>
            <td>${escapeHtml(row.title)}</td>
            <td>${money(row.amount)}</td>
            <td>${escapeHtml(row.account || "-")}</td>
            <td>${escapeHtml(row.status)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderRuleSuggestions(id, items) {
  const target = document.getElementById(id);
  if (!items.length) {
    target.innerHTML = `<li><b>暂无规则建议</b><span>同类商户或分类出现多次后会生成建议</span></li>`;
    return;
  }
  target.innerHTML = items.map((item) => `
    <li>
      <b>${escapeHtml(item.title)}</b>
      <span>${escapeHtml(item.detail)}</span>
    </li>
  `).join("");
}

function renderFireflyMapping(id, items) {
  const target = document.getElementById(id);
  if (!items.length) {
    target.innerHTML = `<li><b>暂无可映射记录</b><span>新记录会逐步补充 transaction 映射信息</span></li>`;
    return;
  }
  target.innerHTML = items.map((item) => `
    <li>
      <div>
        <b>${escapeHtml(item.label)}</b>
        <span>${escapeHtml(item.detail)}</span>
      </div>
      <span class="impact-badge">${item.count}</span>
    </li>
  `).join("");
}

function renderBudgetBars(id, budgets, categoryItems) {
  const target = document.getElementById(id);
  if (!budgets.length) {
    target.className = "bars empty";
    target.textContent = "暂无预算";
    return;
  }

  const spentByCategory = new Map(categoryItems.map((item) => [item.category, item.amount]));
  target.className = "bars";
  target.innerHTML = budgets.map((budget) => {
    const spent = spentByCategory.get(budget.category) || 0;
    const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;
    const warn = percent >= 80 ? " warn" : "";
    return `
      <div class="bar-row">
        <div class="bar-meta"><span>${escapeHtml(budget.category)}</span><strong>${money(spent)} / ${money(budget.amount)} · ${percent}%</strong></div>
        <div class="bar-track"><div class="bar-fill${warn}" style="--value:${Math.min(percent, 100)}%"></div></div>
      </div>
    `;
  }).join("");
}

function renderComparison(prefix, comparison, baselineTotal, baselinePeriod) {
  const value = document.getElementById(`${prefix}Compare`);
  const detail = document.getElementById(`${prefix}Detail`);
  if (!comparison || comparison.status === "no_baseline") {
    value.textContent = "无可比数据";
    value.className = "neutral";
    detail.textContent = `${formatPeriodLabel(baselinePeriod)}：${money(baselineTotal || 0)}`;
    return;
  }
  const sign = comparison.delta > 0 ? "+" : "";
  value.textContent = `${sign}${money(comparison.delta)} · ${sign}${comparison.percent}%`;
  value.className = comparison.delta > 0 ? "up" : comparison.delta < 0 ? "down" : "neutral";
  detail.textContent = `${formatPeriodLabel(baselinePeriod)}：${money(baselineTotal)}`;
}

function renderList(id, items, renderItem) {
  const target = document.getElementById(id);
  if (!items.length) {
    target.innerHTML = `<li><b>暂无记录</b><span>导入更多账本后会自动更新</span></li>`;
    return;
  }
  target.innerHTML = items.map((item) => `<li>${renderItem(item)}</li>`).join("");
}

function renderReviewImpact(id, items) {
  const target = document.getElementById(id);
  if (!items.length) {
    target.innerHTML = `<li><b>暂无高优先级复核</b><span>当前待复核不会明显影响现金流判断</span></li>`;
    return;
  }
  target.innerHTML = items.map((item) => `
    <li>
      <div>
        <b>${escapeHtml(item.title)}</b>
        <span>${escapeHtml(item.detail)}</span>
      </div>
      <button class="impact-badge" type="button" data-review-id="${escapeHtml(item.id || "")}">${escapeHtml(item.level)}</button>
    </li>
  `).join("");
  for (const button of target.querySelectorAll("[data-review-id]")) {
    button.addEventListener("click", () => focusReviewRecord(button.dataset.reviewId));
  }
}

function renderInsights(id, insights) {
  const target = document.getElementById(id);
  if (!insights.length) {
    target.innerHTML = `<li><b>等待更多记录</b><span>连续记录几天后，这里会显示高频消费、预算和现金流提醒。</span></li>`;
    return;
  }
  target.innerHTML = insights.slice(0, 5).map((item) => `
    <li>
      <b>${escapeHtml(item.title)}</b>
      <span>${escapeHtml(item.detail)}</span>
    </li>
  `).join("");
}

function renderPendingItem(item) {
  const reason = item.review?.reasons?.join("、") || "需要确认";
  return `<b>${escapeHtml(item.source?.raw_text || item.category || "待复核记录")}</b><span>${escapeHtml(reason)} · ${money(item.amount)}</span>`;
}

function renderUpcomingItem(item) {
  return `<b>${escapeHtml(item.due_at)} · ${escapeHtml(item.category || "未来支出")}</b><span>${money(item.amount)}${item.account ? ` · ${escapeHtml(item.account)}` : ""}</span>`;
}

function renderEventStream(id, items) {
  const target = document.getElementById(id);
  if (!items.length) {
    target.className = "event-stream-empty";
    target.textContent = "当前时间段暂无可复盘事件";
    return;
  }
  target.className = "event-stream";
  target.innerHTML = `
    <ol>
      ${items.slice(0, 80).map((item) => `
        <li class="${item.needsReview ? "needs-review" : ""}">
          <time>${escapeHtml(item.date)}</time>
          <div>
            <b>${escapeHtml(item.title)}</b>
            <span>${escapeHtml(item.detail)}</span>
          </div>
          <strong class="${item.direction}">${money(item.amount)}</strong>
        </li>
      `).join("")}
    </ol>
  `;
}

function renderRecentTable(id, items) {
  const target = document.getElementById(id);
  updateSelectedCount();
  if (!items.length) {
    target.innerHTML = `<div class="chart-empty">暂无记录</div>`;
    return;
  }

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th><input id="selectVisibleRecords" type="checkbox" aria-label="选择当前列表"></th>
          <th>日期</th>
          <th>类型</th>
          <th>分类</th>
          <th>金额</th>
          <th>状态</th>
          <th>原始记录</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td><input class="record-check" type="checkbox" data-id="${escapeHtml(item.id || "")}" ${selectedRecordIds.has(item.id) ? "checked" : ""} aria-label="选择记录"></td>
            <td>${escapeHtml(eventDate(item) || "-")}</td>
            <td>${escapeHtml(typeLabel(item))}</td>
            <td>${escapeHtml(item.category || "未分类")}</td>
            <td class="amount">${money(item.amount)}</td>
            <td>${statusPill(item)}</td>
            <td>${escapeHtml(item.source?.raw_text || item.notes || "-")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  bindTableSelection(items);
}

function filterRecords(events) {
  if (typeof document === "undefined") return events.slice(0, 20);
  const query = document.getElementById("recordSearch")?.value.trim().toLowerCase() || "";
  const type = document.getElementById("typeFilter")?.value || "";
  const status = document.getElementById("statusFilter")?.value || "";
  const organizerOnly = document.getElementById("organizerOnly")?.checked ?? false;
  return events
    .filter((event) => !organizerOnly || isOrganizerCandidate(event))
    .filter((event) => !type || event.type === type)
    .filter((event) => matchesStatusFilter(event, status))
    .filter((event) => recordMatchesQuery(event, query))
    .slice(0, 50);
}

function focusReviewRecord(id) {
  if (!id || !currentViewModel) return;
  selectedRecordIds = new Set([id]);
  const search = document.getElementById("recordSearch");
  const status = document.getElementById("statusFilter");
  const organizerOnly = document.getElementById("organizerOnly");
  if (search) search.value = id;
  if (status) status.value = "needs_review";
  if (organizerOnly) organizerOnly.checked = false;
  renderRecentTable("recentTable", filterRecords(currentViewModel.recentAll));
  document.getElementById("records-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setOrganizerStatus("已定位到这条待复核记录，可直接确认或批量改分类。");
}

function matchesStatusFilter(event, status) {
  if (!status) return true;
  const needsReview = event.status === "needs_review" || event.review?.required;
  if (status === "needs_review") return needsReview;
  if (status === "confirmed") return event.status === "confirmed" && !needsReview;
  return event.status === status;
}

function recordMatchesQuery(event, query) {
  if (!query) return true;
  const normalized = String(query).toLowerCase();
  return [
    event.id,
    event.source?.raw_text,
    event.category,
    event.account,
    event.type,
    event.status
  ].some((value) => String(value || "").toLowerCase().includes(normalized));
}

function bindTableSelection(items) {
  const selectAll = document.getElementById("selectVisibleRecords");
  const checks = Array.from(document.querySelectorAll(".record-check"));
  if (selectAll) {
    selectAll.checked = items.length > 0 && items.every((item) => selectedRecordIds.has(item.id));
    selectAll.addEventListener("change", () => {
      for (const item of items) {
        if (!item.id) continue;
        if (selectAll.checked) selectedRecordIds.add(item.id);
        else selectedRecordIds.delete(item.id);
      }
      renderRecentTable("recentTable", filterRecords(currentViewModel.recentAll));
    });
  }
  for (const check of checks) {
    check.addEventListener("change", () => {
      const id = check.dataset.id;
      if (!id) return;
      if (check.checked) selectedRecordIds.add(id);
      else selectedRecordIds.delete(id);
      updateSelectedCount();
    });
  }
  updateSelectedCount();
}

function updateLedgerWithBulkEdit(patch) {
  if (!currentLedger) {
    setOrganizerStatus("请先导入账本。");
    return;
  }
  if (selectedRecordIds.size === 0) {
    setOrganizerStatus("请先选择要整理的记录。");
    return;
  }
  currentLedger = applyBulkEdit(currentLedger, Array.from(selectedRecordIds), patch);
  const count = selectedRecordIds.size;
  selectedRecordIds = new Set();
  rerenderCurrentLedger(`已整理 ${count} 条记录，请导出 JSON 后再覆盖原账本。`);
}

function applyBulkEdit(ledger, ids, patch) {
  const idSet = new Set(ids);
  const nextLedger = cloneLedger(ledger);
  const events = Array.isArray(nextLedger.events) ? nextLedger.events : [];
  for (const event of events) {
    if (!idSet.has(event.id)) continue;
    if (patch.category) {
      event.category = patch.category;
    }
    if (patch.confirm) {
      event.status = "confirmed";
      event.review = { required: false, reasons: [] };
    }
  }
  refreshLedgerReferences(nextLedger);
  return nextLedger;
}

function refreshLedgerReferences(ledger) {
  const events = Array.isArray(ledger.events) ? ledger.events : [];
  if (!ledger.heartbeat || typeof ledger.heartbeat !== "object") {
    ledger.heartbeat = { pending_review_ids: [], scheduled_item_ids: [] };
  }
  ledger.heartbeat.pending_review_ids = events
    .filter((event) => event.status === "needs_review" || event.review?.required)
    .map((event) => event.id)
    .filter(Boolean);
  ledger.heartbeat.scheduled_item_ids = events
    .filter((event) => event.due_at && event.status !== "ignored")
    .map((event) => event.id)
    .filter(Boolean);
}

function buildExportJson(ledger) {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

function isOrganizerCandidate(event) {
  return event.status === "needs_review" ||
    event.review?.required ||
    !event.category ||
    event.category === "未分类";
}

function currentMonthBudgets(ledger, activeMonth) {
  const profileBudgets = Array.isArray(ledger.profile?.known_budgets)
    ? ledger.profile.known_budgets.filter((item) => isValidNonNegativeAmount(item.amount))
    : [];
  const goalBudgets = (ledger.events || [])
    .filter((item) => item.type === "goal" && isCalculableEvent(item) && eventDate(item).startsWith(activeMonth))
    .map((item) => ({ category: item.category || "预算", amount: Number(item.amount) }));
  const merged = new Map();
  for (const budget of [...profileBudgets, ...goalBudgets]) {
    if (!budget.category || !isValidNonNegativeAmount(budget.amount)) continue;
    merged.set(budget.category, { category: budget.category, amount: Number(budget.amount) });
  }
  return Array.from(merged.values());
}

function categoryTotals(events) {
  const groups = new Map();
  for (const event of events) {
    const category = event.category || "未分类";
    const current = groups.get(category) || { category, amount: 0, count: 0 };
    current.amount += Number(event.amount);
    current.count += 1;
    groups.set(category, current);
  }
  return Array.from(groups.values())
    .sort((a, b) => b.amount - a.amount);
}

function categoryDetailRows(currentItems, previousItems, yearItems, total) {
  const previousMap = new Map(previousItems.map((item) => [item.category, item.amount]));
  const yearMap = new Map(yearItems.map((item) => [item.category, item.amount]));
  return currentItems.map((item) => ({
    category: item.category,
    amount: item.amount,
    count: item.count,
    average: item.count > 0 ? item.amount / item.count : 0,
    percent: total > 0 ? Math.round((item.amount / total) * 100) : 0,
    previousCompare: compareTotals(item.amount, previousMap.get(item.category) || 0),
    yearCompare: compareTotals(item.amount, yearMap.get(item.category) || 0)
  }));
}

function lowValueFrequentItems(events) {
  const groups = new Map();
  for (const event of events) {
    const amount = Number(event.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 30) continue;
    const category = event.category || "未分类";
    const current = groups.get(category) || { category, count: 0, amount: 0, example: "" };
    current.count += 1;
    current.amount += amount;
    if (!current.example) current.example = event.source?.raw_text || `${category} ${amount}`;
    groups.set(category, current);
  }
  return Array.from(groups.values())
    .filter((item) => item.count >= 2)
    .map((item) => ({ ...item, average: item.count > 0 ? item.amount / item.count : 0 }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount)
    .slice(0, 8);
}

function dailyHeatmapRows(events, period) {
  const rows = trendData(events, period).map((row) => ({
    date: row.date,
    amount: row.expense
  }));
  return rows.length > 120 ? rows.filter((_, index) => index % Math.ceil(rows.length / 120) === 0) : rows;
}

function futureFixedRows(events) {
  return events
    .filter((event) => ["bill_due", "fixed_cost"].includes(event.type) || event.due_at)
    .filter((event) => event.status !== "ignored" && isValidNonNegativeAmount(event.amount))
    .map((event) => ({
      date: event.due_at || event.occurred_at || safeEventDate(event) || "-",
      type: typeLabel(event),
      title: event.source?.raw_text || event.category || "未来支出",
      amount: Number(event.amount),
      account: event.account || "",
      status: event.status === "needs_review" || event.review?.required ? "待复核" : "已确认"
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 20);
}

function ruleSuggestionItems(events) {
  const groups = new Map();
  for (const event of events) {
    if (event.status === "ignored") continue;
    const merchant = event.transaction?.counterparty || event.transaction?.destination_account || event.category;
    if (!merchant || !event.category) continue;
    const key = `${merchant}:${event.category}:${event.account || ""}`;
    const current = groups.get(key) || {
      merchant,
      category: event.category,
      account: event.account || "",
      count: 0
    };
    current.count += 1;
    groups.set(key, current);
  }
  return Array.from(groups.values())
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item) => ({
      title: `包含“${item.merchant}” -> ${item.category}`,
      detail: `${item.count} 条相似记录${item.account ? `，常用账户：${item.account}` : ""}。后续可沉淀为本地自动归类规则。`
    }));
}

function fireflyMappingItems(events) {
  const counts = new Map();
  for (const event of events) {
    if (event.status === "ignored") continue;
    const type = event.transaction?.firefly_iii?.type || fallbackFireflyType(event);
    if (!type) continue;
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  const labels = {
    withdrawal: "支出 withdrawal",
    deposit: "收入 deposit",
    transfer: "转账 transfer",
    opening_balance: "余额 opening balance"
  };
  return Array.from(counts.entries())
    .map(([type, count]) => ({
      label: labels[type] || type,
      count,
      detail: fireflyMappingDescription(type)
    }))
    .sort((a, b) => b.count - a.count);
}

function fallbackFireflyType(event) {
  if (event.type === "income" || event.direction === "inflow") return "deposit";
  if (event.type === "transfer" || event.direction === "internal") return "transfer";
  if (event.type === "account_balance") return "opening_balance";
  if (event.direction === "outflow" || ["expense", "bill_due", "fixed_cost"].includes(event.type)) return "withdrawal";
  return null;
}

function fireflyMappingDescription(type) {
  if (type === "transfer") return "需要 source_account 和 destination_account 才能高质量迁移。";
  if (type === "withdrawal") return "支出、账单、固定成本可作为 withdrawal 迁移。";
  if (type === "deposit") return "收入、退款、报销到账可作为 deposit 迁移。";
  if (type === "opening_balance") return "余额快照可作为 opening balance 或余额校准参考。";
  return "预留映射。";
}

function eventStreamRows(events) {
  return [...events]
    .sort((a, b) => eventDate(a).localeCompare(eventDate(b)) || String(a.id || "").localeCompare(String(b.id || "")))
    .map((event) => {
      const needsReview = event.status === "needs_review" || event.review?.required;
      const direction = isIncome(event)
        ? "inflow"
        : isRealizedExpense(event) || event.type === "bill_due" || event.type === "fixed_cost"
          ? "outflow"
          : "neutral";
      const reason = needsReview ? ` · 待复核：${(event.review?.reasons || ["需要确认"]).join("、")}` : "";
      return {
        id: event.id,
        date: eventDate(event),
        amount: Number(event.amount),
        direction,
        needsReview,
        title: `${typeLabel(event)} · ${event.category || "未分类"}`,
        detail: `${event.source?.raw_text || event.notes || event.account || "无原始文本"}${reason}`
      };
    });
}

function reviewImpactItems(pending) {
  return pending
    .map((event) => {
      const reasons = Array.isArray(event.review?.reasons) ? event.review.reasons : [];
      const affectsCashflow = event.type === "bill_due" ||
        event.type === "fixed_cost" ||
        reasons.includes("due_date_missing") ||
        reasons.includes("recurrence_unclear") ||
        reasons.includes("amount_missing");
      const affectsAccount = reasons.includes("account_missing") || event.type === "account_balance";
      const affectsCategory = reasons.includes("category_missing") || event.category === "未分类" || !event.category;
      const level = affectsCashflow ? "高" : affectsAccount ? "中" : "低";
      const detail = affectsCashflow
        ? "会影响未来支出、预算或现金流判断"
        : affectsAccount
          ? "会影响分账户复盘和支付方式判断"
          : affectsCategory
            ? "适合后续在整理台批量归类"
            : "建议确认后提升复盘可信度";
      return {
        id: event.id,
        title: event.source?.raw_text || event.category || "待复核记录",
        detail,
        level,
        rank: level === "高" ? 0 : level === "中" ? 1 : 2
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 5);
}

function buildInsights({ incomeTotal, spendTotal, pending, upcoming, monthExpenses, ledger, activeMonth, period }) {
  const insights = [];
  const categoryItems = categoryTotals(monthExpenses);
  const topCategory = categoryItems[0];
  const budgets = currentMonthBudgets(ledger, activeMonth);
  const budgetByCategory = new Map(budgets.map((item) => [item.category, item.amount]));
  const diningCount = monthExpenses.filter((event) =>
    ["餐饮", "外卖"].includes(event.category) || (event.tags || []).includes("takeout")
  ).length;

  if (topCategory) {
    const percent = spendTotal > 0 ? Math.round((topCategory.amount / spendTotal) * 100) : 0;
    insights.push({
      title: `时间段最大支出：${topCategory.category}`,
      detail: `${money(topCategory.amount)}，占已记录支出 ${percent}%。`
    });
  }

  for (const item of categoryItems) {
    const budget = budgetByCategory.get(item.category);
    if (!budget || budget <= 0) continue;
    const percent = Math.round((item.amount / budget) * 100);
    if (percent >= 80) {
      insights.push({
        title: `${item.category}预算接近上限`,
        detail: `已用 ${money(item.amount)} / ${money(budget)}，进度 ${percent}%。`
      });
    }
  }

  if (diningCount >= 3) {
    insights.push({
      title: "餐饮/外卖高频",
      detail: `当前时间段已记录 ${diningCount} 次，适合观察是否需要设预算。`
    });
  }

  if (upcoming.length > 0) {
    insights.push({
      title: "未来 7 天有确定支出",
      detail: `共 ${upcoming.length} 条，合计 ${money(sum(upcoming))}。`
    });
  }

  if (pending.length >= 3) {
    insights.push({
      title: "待复核偏多",
      detail: `${pending.length} 条记录会影响复盘可信度，建议先处理高优先级。`
    });
  }

  if (incomeTotal > 0 && spendTotal > incomeTotal) {
    insights.push({
      title: "当前时间段支出高于收入",
      detail: `已记录支出比收入多 ${money(spendTotal - incomeTotal)}。`
    });
  }

  return insights;
}

function trendData(events, period) {
  const days = daysBetween(period.start, period.end) + 1;
  const rows = Array.from({ length: days }, (_, index) => {
    const date = addDays(period.start, index);
    return {
      date,
      day: trendLabel(date, index, days),
      income: 0,
      expense: 0
    };
  });
  const rowByDate = new Map(rows.map((row) => [row.date, row]));

  for (const event of events) {
    const date = eventDate(event);
    const row = rowByDate.get(date);
    if (!row) continue;
    if (isIncome(event)) row.income += Number(event.amount);
    if (isRealizedExpense(event)) row.expense += Number(event.amount);
  }
  return rows;
}

function resolvePeriod(state, activeMonth) {
  const today = currentDate();
  if (state.preset === "last_30_days") {
    const start = addDays(today, -29);
    return periodObject(start, today, "最近 30 天");
  }
  if (state.preset === "current_year") {
    const year = today.slice(0, 4);
    return periodObject(`${year}-01-01`, today, "今年");
  }
  if (state.preset === "custom") {
    const start = isDateString(state.start) ? state.start : `${activeMonth}-01`;
    const fallbackEnd = monthEnd(activeMonth);
    const end = isDateString(state.end) ? state.end : fallbackEnd;
    return periodObject(start <= end ? start : end, start <= end ? end : start, "自定义");
  }
  return periodObject(`${activeMonth}-01`, monthEnd(activeMonth), activeMonth);
}

function periodObject(start, end, label) {
  const days = daysBetween(start, end) + 1;
  return {
    start,
    end,
    days,
    label: `${label} · ${start} 至 ${end}`
  };
}

function compareTotals(current, baseline) {
  const delta = current - baseline;
  if (!baseline) return { status: "no_baseline", delta, percent: null };
  return {
    status: "ok",
    delta,
    percent: Math.round((delta / baseline) * 100)
  };
}

function shiftPeriod(period, offsetDays) {
  const start = addDays(period.start, offsetDays);
  const end = addDays(period.end, offsetDays);
  return periodObject(start, end, "上一周期");
}

function shiftPeriodYears(period, offsetYears) {
  const start = addYears(period.start, offsetYears);
  const end = addYears(period.end, offsetYears);
  return periodObject(start, end, "去年同期");
}

function isWithinRange(date, start, end) {
  return isDateString(date) && date >= start && date <= end;
}

function monthEnd(month) {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

function daysBetween(start, end) {
  return Math.max(0, Math.round((dateFromString(end) - dateFromString(start)) / 86400000));
}

function addDays(dateString, days) {
  const date = dateFromString(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function addYears(dateString, years) {
  const date = dateFromString(dateString);
  date.setFullYear(date.getFullYear() + years);
  return formatDate(date);
}

function dateFromString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function trendLabel(date, index, totalDays) {
  if (totalDays <= 45) return date.slice(5);
  if (index === 0 || index === totalDays - 1 || date.endsWith("-01")) return date.slice(5);
  return "";
}

function formatPeriodLabel(period) {
  if (!period) return "对比周期";
  return `${period.start} 至 ${period.end}`;
}

function sectorPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarPoint(cx, cy, radius, endAngle);
  const end = polarPoint(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function polarPoint(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function formatCompareCell(comparison) {
  if (!comparison || comparison.status === "no_baseline") return "无可比";
  const sign = comparison.delta > 0 ? "+" : "";
  return `${sign}${money(comparison.delta)} / ${sign}${comparison.percent}%`;
}

function recentEvents(events, limit = 10) {
  return [...events]
    .sort((a, b) => safeEventDate(b).localeCompare(safeEventDate(a)))
    .slice(0, limit);
}

function totalBalance(profile) {
  const balances = Array.isArray(profile.latest_balances) ? profile.latest_balances : [];
  if (!balances.length) return null;
  const validBalances = balances.filter((item) => isValidNonNegativeAmount(item.amount));
  if (!validBalances.length) return null;
  return validBalances.reduce((total, item) => total + Number(item.amount), 0);
}

function sum(events) {
  return events.reduce((total, item) => total + Number(item.amount), 0);
}

function isIncome(event) {
  return event.type === "income" || event.direction === "inflow";
}

function isRealizedExpense(event) {
  return event.type === "expense" || (event.direction === "outflow" && event.occurred_at && event.type !== "bill_due");
}

function eventDate(event) {
  return event.occurred_at || event.due_at || event.source?.received_at?.slice(0, 10) || "";
}

function safeEventDate(event) {
  const date = eventDate(event);
  return isDateString(date) ? date : "";
}

function pickActiveMonth(events) {
  const monthCounts = new Map();
  for (const event of events) {
    const date = eventDate(event);
    if (!isDateString(date)) continue;
    const month = date.slice(0, 7);
    monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
  }
  if (!monthCounts.size) return currentDate().slice(0, 7);
  return Array.from(monthCounts.entries()).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
}

function withinNextDays(event, days) {
  if (!isDateString(event.due_at)) return false;
  const current = new Date(currentDate());
  const target = new Date(event.due_at);
  const diff = (target - current) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function currentDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidNonNegativeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

function isCalculableEvent(event) {
  return isDateString(eventDate(event)) && isValidNonNegativeAmount(event.amount);
}

function cashflowStatus(income, spend, pendingCount) {
  if (!income && !spend) return "等待记录";
  if (pendingCount > 0) return "需要复核";
  if (income >= spend) return "现金流为正";
  return "支出偏高";
}

function typeLabel(item) {
  const labels = {
    income: "收入",
    expense: "支出",
    bill_due: "账单",
    fixed_cost: "固定成本",
    goal: "预算",
    account_balance: "余额"
  };
  return labels[item.type] || item.type || "记录";
}

function statusPill(item) {
  const needsReview = item.status === "needs_review" || item.review?.required;
  const label = needsReview ? "待复核" : "已确认";
  const className = needsReview ? "review" : "confirmed";
  return `<span class="pill ${className}">${label}</span>`;
}

function money(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2
  }).format(Number(value));
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function setNotice(message) {
  const notice = document.getElementById("privacyNotice");
  notice.classList.remove("error");
  notice.textContent = message;
}

function showError(message) {
  const notice = document.getElementById("privacyNotice");
  notice.classList.add("error");
  notice.textContent = message;
}

function updateSelectedCount() {
  if (typeof document === "undefined") return;
  setText("selectedCount", `已选 ${selectedRecordIds.size} 条`);
}

function setOrganizerStatus(message) {
  setText("organizerStatus", message);
}

function persistLedgerCache(label) {
  if (!currentLedger || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, buildExportJson(currentLedger));
    localStorage.setItem(CACHE_META_KEY, JSON.stringify({
      label,
      updated_at: new Date().toISOString()
    }));
  } catch {
    setOrganizerStatus("浏览器缓存空间不足，建议导出 JSON 备份。");
  }
}

function scheduleAutoSaveToFile() {
  if (!currentFileHandle) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveCurrentLedgerToFile({ silent: true });
  }, 600);
}

async function saveCurrentLedgerToFile(options = {}) {
  if (!currentLedger) {
    setOrganizerStatus("请先导入账本。");
    return false;
  }
  if (!currentFileHandle) {
    if (!options.silent) {
      setOrganizerStatus("还没有授权原始文件；可先点“授权文件”，或使用“导出 JSON”。");
    }
    return false;
  }
  try {
    const permission = await ensureHandlePermission(currentFileHandle, "readwrite");
    if (!permission) {
      if (!options.silent) setOrganizerStatus("浏览器没有写入权限，请重新授权文件。");
      return false;
    }
    const writable = await currentFileHandle.createWritable();
    await writable.write(buildExportJson(currentLedger));
    await writable.close();
    persistLedgerCache(currentSourceLabel || currentFileHandle.name);
    setOrganizerStatus(`已保存到 ${currentFileHandle.name}。`);
    return true;
  } catch (error) {
    if (!options.silent) showError(`无法保存到文件：${error.message}`);
    return false;
  }
}

function supportsFileSystemAccess() {
  return typeof window !== "undefined" &&
    typeof window.showOpenFilePicker === "function" &&
    typeof window.showDirectoryPicker === "function" &&
    typeof indexedDB !== "undefined";
}

async function ensureHandlePermission(handle, mode) {
  if (!handle || typeof handle.queryPermission !== "function") return false;
  const options = { mode };
  if (await handle.queryPermission(options) === "granted") return true;
  if (typeof handle.requestPermission !== "function") return false;
  return await handle.requestPermission(options) === "granted";
}

async function findLedgerFileInDirectory(directoryHandle) {
  const preferred = ["ledger.json", "yin-yan-ledger.json"];
  for (const name of preferred) {
    try {
      return await directoryHandle.getFileHandle(name);
    } catch {
      // Continue to scan other JSON files in the selected directory.
    }
  }
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".json")) return entry;
  }
  return null;
}

function openHandleDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveHandle(key, handle) {
  const db = await openHandleDb();
  await dbTransaction(db, "readwrite", (store) => store.put(handle, key));
  db.close();
}

async function loadHandle(key) {
  const db = await openHandleDb();
  const handle = await dbTransaction(db, "readonly", (store) => store.get(key));
  db.close();
  return handle;
}

function dbTransaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, mode);
    const request = operation(transaction.objectStore(DB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cloneLedger(ledger) {
  return JSON.parse(JSON.stringify(ledger || {}));
}

function getSampleLedger() {
  return cloneLedger(SAMPLE_LEDGER);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if (typeof module !== "undefined") {
  module.exports = {
    SAMPLE_LEDGER,
    buildViewModel,
    checkLedgerHealth,
    applyBulkEdit,
    buildExportJson,
    getSampleLedger,
    matchesStatusFilter,
    recordMatchesQuery,
    categoryTotals,
    currentMonthBudgets,
    trendData,
    totalBalance
  };
}
