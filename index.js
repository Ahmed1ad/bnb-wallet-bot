import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";

/* ========= CONFIG ========= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const BSCSCAN_API = process.env.BSCSCAN_API;

const WATCHED_ADDRESS =
  "0xbda40164caabdaccf22bcee5986cbff4ec36634d".toLowerCase();

const CHECK_INTERVAL = 60000; // 60 ثانية
/* ========================== */

if (!BOT_TOKEN || !BSCSCAN_API) {
  console.error("Missing ENV variables");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let users = [];
let lastTxHash = null;

/* ========= START ========= */
bot.onText(/\/start/, (msg) => {
  if (!users.includes(msg.chat.id)) {
    users.push(msg.chat.id);
  }

  bot.sendMessage(
    msg.chat.id,
    "🤖 *Wallet Checker Bot*\n\n" +
      "⏱ فحص كل دقيقة\n" +
      "📡 يعتمد على BscScan API\n" +
      "⚠️ الإشعارات مش لحظية\n\n" +
      "جاهز للعمل ✅",
    { parse_mode: "Markdown" }
  );
});
/* ========================= */

/* ========= BROADCAST ========= */
function broadcast(text) {
  users.forEach((id) => {
    bot.sendMessage(id, text, { parse_mode: "Markdown" });
  });
}
/* ============================= */

/* ========= CHECK TX ========= */
async function checkTransactions() {
  try {
    console.log("Checking...");

    const url =
      `https://api.bscscan.com/api?module=account&action=tokentx` +
      `&address=${WATCHED_ADDRESS}` +
      `&sort=desc&apikey=${BSCSCAN_API}`;

    const data = await fetch(url).then((r) => r.json());

    if (data.status !== "1" || !data.result.length) return;

    const latestTx = data.result[0];

    if (latestTx.hash === lastTxHash) return;

    lastTxHash = latestTx.hash;

    const amount = (
      latestTx.value / 10 ** latestTx.tokenDecimal
    ).toFixed(4);

    const incoming =
      latestTx.to.toLowerCase() === WATCHED_ADDRESS;

    broadcast(
`🔔 *New Token Transfer*
${incoming ? "⬆️ Incoming" : "⬇️ Outgoing"}
🪙 Token: *${latestTx.tokenSymbol}*
💰 Amount: *${amount}*
👤 From: \`${latestTx.from}\`
🎯 To: \`${latestTx.to}\`
🔗 https://bscscan.com/tx/${latestTx.hash}`
    );
  } catch (e) {
    console.log("Error:", e.message);
  }
}

setInterval(checkTransactions, CHECK_INTERVAL);
/* ============================== */
