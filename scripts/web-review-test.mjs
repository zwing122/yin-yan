import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Script, createContext } from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const projectPath = (...segments) => resolve(projectRoot, ...segments);

const source = await readFile(projectPath("web-review", "app.js"), "utf8");
const context = createContext({ console });
new Script(source).runInContext(context);

const behaviorLedger = {
  events: [
    {
      id: "bad_date",
      type: "expense",
      status: "confirmed",
      occurred_at: "bad-date",
      amount: 100,
      direction: "outflow",
      category: "餐饮",
      source: { raw_text: "bad date" },
      review: { required: false, reasons: [] }
    },
    {
      id: "bad_month",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-99-99",
      amount: 200,
      direction: "outflow",
      category: "交通",
      source: { raw_text: "bad month" },
      review: { required: false, reasons: [] }
    },
    {
      id: "negative",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-12",
      amount: -50,
      direction: "outflow",
      category: "日用",
      source: { raw_text: "negative" },
      review: { required: false, reasons: [] }
    },
    {
      id: "valid_income",
      type: "income",
      status: "confirmed",
      occurred_at: "2026-05-10",
      amount: 12000,
      direction: "inflow",
      category: "收入",
      source: { raw_text: "income" },
      review: { required: false, reasons: [] }
    },
    {
      id: "valid_expense",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-11",
      amount: 38,
      direction: "outflow",
      category: "餐饮",
      account: "微信",
      transaction: {
        kind: "withdrawal",
        source_account: "微信",
        destination_account: "餐饮",
        counterparty: "餐饮",
        is_internal_transfer: false,
        firefly_iii: { type: "withdrawal", notes: "test" }
      },
      source: { raw_text: "expense" },
      review: { required: false, reasons: [] }
    },
    {
      id: "small_food_1",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-12",
      amount: 12,
      direction: "outflow",
      category: "餐饮",
      account: "微信",
      transaction: {
        kind: "withdrawal",
        source_account: "微信",
        destination_account: "餐饮",
        counterparty: "餐饮",
        is_internal_transfer: false,
        firefly_iii: { type: "withdrawal", notes: "test" }
      },
      source: { raw_text: "早餐 12" },
      review: { required: false, reasons: [] }
    },
    {
      id: "small_food_2",
      type: "expense",
      status: "confirmed",
      occurred_at: "2026-05-13",
      amount: 18,
      direction: "outflow",
      category: "餐饮",
      account: "微信",
      transaction: {
        kind: "withdrawal",
        source_account: "微信",
        destination_account: "餐饮",
        counterparty: "餐饮",
        is_internal_transfer: false,
        firefly_iii: { type: "withdrawal", notes: "test" }
      },
      source: { raw_text: "咖啡 18" },
      review: { required: false, reasons: [] }
    },
    {
      id: "pending_bill",
      type: "bill_due",
      status: "needs_review",
      due_at: "2026-05-15",
      amount: 129,
      direction: "outflow",
      category: "通信",
      source: { raw_text: "每月 15 号手机套餐 129" },
      review: { required: true, reasons: ["recurrence_unclear"] }
    }
  ],
  profile: {
    latest_balances: [
      { account: "bad", amount: -1 },
      { account: "银行卡", amount: 3400 }
    ],
    known_budgets: [
      { category: "餐饮", amount: 800 },
      { category: "坏预算", amount: -100 }
    ],
    behavior_patterns: []
  },
  heartbeat: { pending_review_ids: [], scheduled_item_ids: [] }
};

const viewModel = context.buildViewModel(behaviorLedger);

assert(viewModel.activeMonth === "2026-05", "expected invalid dates not to choose active month");
assert(viewModel.incomeTotal === 12000, "expected only valid income in total");
assert(viewModel.spendTotal === 68, "expected negative and invalid-date expenses excluded");
assert(viewModel.balance === 3400, "expected negative balances excluded");
assert(viewModel.categoryTotals.length === 1 && viewModel.categoryTotals[0].amount === 68 && viewModel.categoryTotals[0].count === 3, "expected category totals from valid expense only");
assert(viewModel.budgets.length === 1 && viewModel.budgets[0].category === "餐饮", "expected invalid budgets excluded");
assert(viewModel.reviewImpact.length === 1 && viewModel.reviewImpact[0].level === "高", "expected cashflow-affecting pending item in review impact");
assert(viewModel.reviewImpact[0].id === "pending_bill", "expected review impact item to retain source record id");
assert(viewModel.period.start === "2026-05-01" && viewModel.period.end === "2026-05-31", "expected active month period");
assert(viewModel.periodEventCount === 5, "expected valid events in selected period");
assert(viewModel.eventStream.length === 5, "expected period event stream rows");
assert(viewModel.categoryDetails[0].count === 3 && viewModel.categoryDetails[0].average > 22, "expected category detail count and average");
assert(viewModel.lowValueItems.length === 1 && viewModel.lowValueItems[0].count === 2, "expected low-value frequent items");
assert(viewModel.dailyHeatmap.length === 31, "expected daily heatmap rows");
assert(viewModel.futureFixedItems.length === 1 && viewModel.futureFixedItems[0].type === "账单", "expected future/fixed rows");
assert(viewModel.ruleSuggestions.length === 1, "expected local rule suggestion from repeated merchant/category");
assert(viewModel.fireflyMapping.some((item) => item.label.includes("withdrawal") && item.count >= 3), "expected Firefly withdrawal mapping summary");
assert(viewModel.comparisons.spendPrevious.status === "no_baseline", "expected comparison object without baseline");
assert(viewModel.insights.some((item) => item.title.includes("时间段最大支出")), "expected top-category insight");
assert(viewModel.recentAll.length >= viewModel.recent.length, "expected full recent list for review table");
assert(context.trendData([], viewModel.period).length === 31, "expected trend data to support selected period length");
const customPeriodViewModel = context.buildViewModel(behaviorLedger, { preset: "custom", start: "2026-05-12", end: "2026-05-13" });
assert(customPeriodViewModel.period.start === "2026-05-12" && customPeriodViewModel.period.end === "2026-05-13", "expected custom date period to apply");
assert(customPeriodViewModel.periodEventCount === 2, "expected custom period to filter event count");
assert(customPeriodViewModel.spendTotal === 30, "expected custom period totals to follow selected dates");
assert(customPeriodViewModel.eventStream.every((item) => item.date >= "2026-05-12" && item.date <= "2026-05-13"), "expected event stream to follow selected dates");
assert(context.matchesStatusFilter({ status: "confirmed", review: { required: true } }, "needs_review"), "expected review-required records to match needs_review filter");
assert(!context.matchesStatusFilter({ status: "confirmed", review: { required: true } }, "confirmed"), "expected review-required records not to match confirmed filter");
assert(context.recordMatchesQuery(behaviorLedger.events.find((event) => event.id === "pending_bill"), "pending_bill"), "expected organizer search to match record id");
const sampleLedger = context.getSampleLedger();
const sampleDates = sampleLedger.events.map((event) => event.occurred_at || event.due_at).filter(Boolean).sort();
assert(sampleLedger.events.length >= 120, "expected long sample ledger with many events");
assert(sampleDates[0] <= "2025-07-01" && sampleDates[sampleDates.length - 1] >= "2026-05-27", "expected long sample ledger to span a long period");
assert(typeof context.supportsFileSystemAccess === "function", "expected file-system access capability check");
assert(context.supportsFileSystemAccess() === false, "expected file-system access check to be safe without browser APIs");

const editedLedger = context.applyBulkEdit(
  {
    events: [
      {
        id: "pending_1",
        type: "expense",
        status: "needs_review",
        occurred_at: "2026-05-11",
        amount: 38,
        direction: "outflow",
        category: null,
        source: { raw_text: "午饭 38" },
        review: { required: true, reasons: ["category_missing"] }
      },
      {
        id: "confirmed_1",
        type: "expense",
        status: "confirmed",
        occurred_at: "2026-05-12",
        amount: 9,
        direction: "outflow",
        category: "交通",
        source: { raw_text: "地铁 9" },
        review: { required: false, reasons: [] }
      }
    ],
    heartbeat: { pending_review_ids: ["pending_1"], scheduled_item_ids: [] },
    profile: {}
  },
  ["pending_1"],
  { category: "餐饮", confirm: true }
);
const editedEvent = editedLedger.events.find((event) => event.id === "pending_1");
assert(editedEvent.category === "餐饮", "expected bulk category edit");
assert(editedEvent.status === "confirmed", "expected bulk confirm");
assert(editedEvent.review.required === false, "expected review cleared after confirm");
assert(editedEvent.review.reasons.length === 0, "expected review reasons cleared after confirm");
assert(!editedLedger.heartbeat.pending_review_ids.includes("pending_1"), "expected pending id removed after confirm");

const exportText = context.buildExportJson(editedLedger);
assert(exportText.includes('"category": "餐饮"'), "expected export JSON to include edited category");
assert(exportText.endsWith("\n"), "expected export JSON to end with newline");

const html = await readFile(projectPath("web-review", "index.html"), "utf8");
assert(!html.includes('id="categoryPie"'), "expected category pie container to be removed");
assert(!source.includes('renderPie("categoryPie"'), "expected category pie render call to be removed");
assert(html.includes("复盘时间段与事件流"), "expected period selector and event stream to be merged");
assert(html.includes('id="eventStream"'), "expected period event stream container");
assert(html.includes('id="openFileButton"'), "expected file authorization button");
assert(html.includes('id="openFolderButton"'), "expected folder authorization button");
assert(html.includes('id="saveFileButton"'), "expected save-back button");
assert(html.includes('id="saveEditButton"'), "expected organizer save button");
assert(html.includes('id="periodPreset"'), "expected period preset selector");
assert(html.includes('id="applyPeriodButton"'), "expected period apply button");
assert(html.includes('id="roseChart"'), "expected rose chart container");
assert(html.includes('id="calendarHeatmap"'), "expected calendar heatmap container");
assert(html.includes('id="lowValueBubble"'), "expected low-value bubble chart container");
assert(html.includes('id="categoryDetailTable"'), "expected category detail table container");
assert(html.includes('id="futureFixedTable"'), "expected future/fixed table container");
assert(html.includes('id="ruleSuggestionList"'), "expected rule suggestion container");
assert(html.includes('id="fireflyMappingList"'), "expected Firefly mapping container");
assert(html.includes("支出同比"), "expected year-over-year comparison card");
assert(html.includes("支出环比"), "expected period-over-period comparison card");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const dynamicIds = [...source.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const refs = [...source.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
const availableIds = new Set([...ids, ...dynamicIds]);
const missing = [...new Set(refs.filter((id) => !availableIds.has(id)))];
assert(missing.length === 0, `expected all DOM ids to exist, missing: ${missing.join(", ")}`);

console.log("Web review test passed.");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
