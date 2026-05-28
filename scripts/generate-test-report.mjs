import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const defaultLedgerPath = resolve(rootDir, "samples", "ledger.sample.json");
const defaultOutputPath = resolve(rootDir, "samples", "test-report.generated.json");

const args = parseArgs(process.argv.slice(2));
const ledgerPath = resolve(process.cwd(), args.ledger ?? defaultLedgerPath);
const outputPath = resolve(process.cwd(), args.output ?? defaultOutputPath);
const textOutputPath = args.text ? resolve(process.cwd(), args.text) : null;

try {
  const ledger = readLedgerInput(await readFile(ledgerPath, "utf8"), ledgerPath);
  const report = generateReport(ledger, {
    testId: args.testId ?? "anon_local",
    start: args.start ?? inferStartDate(ledger),
    end: args.end ?? inferEndDate(ledger),
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const textReport = renderTextReport(report);
  if (textOutputPath) {
    await mkdir(dirname(textOutputPath), { recursive: true });
    await writeFile(textOutputPath, `${textReport}\n`, "utf8");
  }

  console.log(textReport);
  console.log("");
  console.log(`JSON report written to: ${outputPath}`);
  if (textOutputPath) {
    console.log(`Text report written to: ${textOutputPath}`);
  }
} catch (error) {
  console.error(error?.message ?? String(error));
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {};

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    i += 1;
  }

  return parsed;
}

function readLedgerInput(raw, label) {
  let ledger;
  try {
    ledger = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`无法生成测试报告：账本 JSON 损坏。路径：${label}`);
    }
    throw error;
  }

  assertLedgerContract(ledger, label);
  return ledger;
}

function assertLedgerContract(ledger, label) {
  const prefix = `无法生成测试报告：账本不符合 ledger.schema.json 基础契约。路径：${label}`;
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) {
    throw new Error(`${prefix}\n原因：顶层必须是对象。`);
  }
  if (ledger.schema_version !== "0.1") {
    throw new Error(`${prefix}\n原因：schema_version 必须是 0.1。`);
  }
  if (!Array.isArray(ledger.events)) {
    throw new Error(`${prefix}\n原因：events 必须是数组。`);
  }
  if (!ledger.profile || typeof ledger.profile !== "object" || Array.isArray(ledger.profile)) {
    throw new Error(`${prefix}\n原因：缺少 profile 对象。`);
  }
  if (!ledger.entities || typeof ledger.entities !== "object") {
    throw new Error(`${prefix}\n原因：缺少 entities 对象。`);
  }
  if (!Array.isArray(ledger.entities.accounts) || !Array.isArray(ledger.entities.categories)) {
    throw new Error(`${prefix}\n原因：entities.accounts 和 entities.categories 必须是数组。`);
  }
  if (!ledger.heartbeat || typeof ledger.heartbeat !== "object") {
    throw new Error(`${prefix}\n原因：缺少 heartbeat 对象。`);
  }
  if (!Array.isArray(ledger.heartbeat.pending_review_ids) || !Array.isArray(ledger.heartbeat.scheduled_item_ids)) {
    throw new Error(`${prefix}\n原因：heartbeat.pending_review_ids 和 heartbeat.scheduled_item_ids 必须是数组。`);
  }
}

function generateReport(ledger, options) {
  const events = Array.isArray(ledger.events) ? ledger.events : [];
  const recordsByType = countBy(events, (event) => event.type ?? "unknown");
  const reviewRequired = events.filter((event) => event.review?.required).length;
  const reviewCompleted = events.filter(
    (event) => event.review?.required && event.status === "confirmed"
  ).length;
  const parserFailures = events.filter((event) => event.type === "unknown").length;

  return {
    schema_version: "0.1",
    test_id: options.testId,
    period: {
      start: options.start,
      end: options.end,
    },
    usage: {
      days_used: countUsedDays(events),
      records_created: events.length,
      heartbeat_sent: Number(ledger.metrics?.heartbeat_sent ?? 0),
      heartbeat_replied: Number(ledger.metrics?.heartbeat_replied ?? 0),
      weekly_report_generated: Boolean(ledger.metrics?.weekly_report_generated ?? false),
    },
    records_by_type: recordsByType,
    quality: {
      review_required: reviewRequired,
      review_completed: reviewCompleted,
      parser_failures: parserFailures,
      top_review_reasons: topReviewReasons(events),
    },
    feedback: {
      rating: null,
      continue_intent: null,
      most_useful: "",
      most_annoying: "",
      next_improvement: "",
    },
  };
}

function renderTextReport(report) {
  const typeLines = Object.entries(report.records_by_type)
    .map(([type, count]) => `- ${type}: ${count}`)
    .join("\n");
  const reasonLines = report.quality.top_review_reasons
    .map((reason) => `- ${reason}`)
    .join("\n");

  return `银砚 Skill 7 天匿名测试报告

测试 ID：${report.test_id}
使用天数：${report.usage.days_used}/7
记录条数：${report.usage.records_created}
待复核条数：${report.quality.review_required}
已复核条数：${report.quality.review_completed}
心跳提醒次数：${report.usage.heartbeat_sent}
心跳回复次数：${report.usage.heartbeat_replied}
周报是否生成：${report.usage.weekly_report_generated ? "是" : "否"}

主要记录类型：
${typeLines || "- 无"}

常见复核原因：
${reasonLines || "- 无"}

主观评分：
是否愿意继续使用：
最有用的地方：
最烦的地方：
希望下一步改进：`;
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function countUsedDays(events) {
  const days = new Set();

  for (const event of events) {
    const date = event.occurred_at ?? event.due_at ?? event.source?.received_at?.slice(0, 10);
    if (date) {
      days.add(date);
    }
  }

  return Math.min(days.size, 7);
}

function topReviewReasons(events) {
  const reasons = [];

  for (const event of events) {
    for (const reason of event.review?.reasons ?? []) {
      reasons.push(reason);
    }
  }

  return Object.entries(countBy(reasons, (reason) => reason))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason]) => reason);
}

function inferStartDate(ledger) {
  return inferBoundaryDate(ledger, "first") ?? today();
}

function inferEndDate(ledger) {
  return inferBoundaryDate(ledger, "last") ?? today();
}

function inferBoundaryDate(ledger, boundary) {
  const dates = (ledger.events ?? [])
    .flatMap((event) => [
      event.occurred_at,
      event.due_at,
      event.source?.received_at?.slice(0, 10),
    ])
    .filter(Boolean)
    .sort();

  if (dates.length === 0) {
    return null;
  }

  return boundary === "first" ? dates[0] : dates[dates.length - 1];
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
