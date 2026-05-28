import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const testRoot = resolve(tmpdir(), `yin-yan-asset-${process.pid}-${Date.now()}`);
const ledgerPath = resolve(testRoot, "ledger.json");
const cliPath = resolve(projectRoot, "scripts", "run-command.mjs");

await mkdir(testRoot, { recursive: true });

await run("每月10号发工资3000");
await run("买了椅子300");
let ledger = await readLedger();
let chairAtThreshold = ledger.events.find((event) => event.source.raw_text === "买了椅子300");
assert(chairAtThreshold, "expected chair-at-threshold purchase event");
assert(chairAtThreshold.asset_tracking?.candidate === true, "expected purchase equal to 10 percent monthly income to become candidate");
assert(chairAtThreshold.asset_tracking.reason_codes.includes("large_amount"), "expected equal-to-monthly-income threshold to use large_amount reason");

await run("买了耳机300");
ledger = await readLedger();
let earphoneAtThreshold = ledger.events.find((event) => event.source.raw_text === "买了耳机300");
assert(earphoneAtThreshold, "expected earphone-at-threshold purchase event");
assert(earphoneAtThreshold.asset_tracking?.candidate === true, "expected item keyword at 10 percent monthly income to become candidate");

await run("买了椅子320");
ledger = await readLedger();
let chair = ledger.events.find((event) => event.source.raw_text === "买了椅子320");
assert(chair, "expected chair purchase event");
assert(chair.asset_tracking?.candidate === true, "expected purchase above 10 percent monthly income to become candidate");
assert(chair.asset_tracking.reason_codes.includes("large_amount"), "expected monthly-income threshold to use large_amount reason");

await run("买了降噪耳机1299");
ledger = await readLedger();
let earphone = ledger.events.find((event) => event.source.raw_text === "买了降噪耳机1299");
assert(earphone, "expected earphone purchase event");
assert(earphone.asset_tracking?.candidate === true, "expected large purchase candidate");
assert(earphone.asset_tracking.status === "needs_confirm", "expected candidate to need confirmation");
assert(earphone.asset_tracking.item_name === "降噪耳机", "expected item name");
assert(!("usage_count" in earphone.asset_tracking), "expected no usage_count field");

await run("房租4200");
ledger = await readLedger();
const rent = ledger.events.find((event) => event.source.raw_text === "房租4200");
assert(rent, "expected rent event");
assert(!rent.asset_tracking, "expected rent not to become asset tracking candidate");

await run("工资卡转到支付宝1200");
ledger = await readLedger();
const transfer = ledger.events.find((event) => event.source.raw_text === "工资卡转到支付宝1200");
assert(transfer, "expected transfer event");
assert(!transfer.asset_tracking, "expected transfer not to become asset tracking candidate");

const startOutput = await run("这个耳机开始追踪，预计用一年");
ledger = await readLedger();
earphone = ledger.events.find((event) => event.source.raw_text === "买了降噪耳机1299");
assert(startOutput.includes("已开始追踪"), "expected start tracking confirmation");
assert(earphone.asset_tracking.status === "tracking", "expected tracking status");
assert(earphone.asset_tracking.expected_use_days === 365, "expected expected_use_days 365");
assert(earphone.asset_tracking.next_review_at === relativeDate(30), "expected 30-day review date");

const mentionOutput = await run("耳机今天用了");
ledger = await readLedger();
earphone = ledger.events.find((event) => event.source.raw_text === "买了降噪耳机1299");
assert(mentionOutput.includes("不等于真实使用次数"), "expected mention caveat");
assert(earphone.asset_tracking.mention_count === 1, "expected one mention");
assert(earphone.asset_tracking.mention_logs.length === 1, "expected mention log");
assert(earphone.asset_tracking.mention_logs[0].raw_text === "耳机今天用了", "expected mention raw text");
assert(earphone.asset_tracking.days_since_purchase === 0, "expected same-day mention interval");
assert(!("usage_count" in earphone.asset_tracking), "expected still no usage_count field");

await run("买了键盘699");
const ignoreOutput = await run("这个不追踪");
ledger = await readLedger();
const keyboard = ledger.events.find((event) => event.source.raw_text === "买了键盘699");
assert(ignoreOutput.includes("已设置为不追踪"), "expected ignore confirmation");
assert(keyboard.asset_tracking.status === "ignored", "expected ignored status");

earphone = ledger.events.find((event) => event.source.raw_text === "买了降噪耳机1299");
earphone.asset_tracking.next_review_at = relativeDate(0);
earphone.asset_tracking.last_mentioned_at = null;
earphone.asset_tracking.mention_count = 0;
earphone.asset_tracking.mention_logs = [];
earphone.occurred_at = relativeDate(-30);
await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

const reminderOutput = await runHeartbeat("reminder");
assert(reminderOutput.includes("大额消费复核"), "expected asset review section");
assert(reminderOutput.includes("降噪耳机"), "expected asset review item");
assert(reminderOutput.includes("再次提到 0 次"), `expected mention count in reminder, got:\n${reminderOutput}`);

console.log("asset-tracking-test passed");

async function run(text) {
  return runNode([cliPath, "--ledger", ledgerPath, "--text", text]);
}

async function runHeartbeat(type) {
  return runNode([cliPath, "--ledger", ledgerPath, "--heartbeat", type]);
}

async function readLedger() {
  return JSON.parse(await readFile(ledgerPath, "utf8"));
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
        rejectPromise(new Error(`Command failed: ${args.join(" ")}\n${stdout}\n${stderr}`));
      }
    });
  });
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
