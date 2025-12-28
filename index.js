import TelegramBot from "node-telegram-bot-api";
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

/* ================== CONFIG ================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
const BSCSCAN_API = process.env.BSCSCAN_API;

const WATCHED_ADDRESS =
  "0x55d398326f99059fF775485246999027B3197955".toLowerCase();

const CHECK_INTERVAL = 15000; // 15 seconds
const DB_FILE = "./data.json";
/* ============================================ */

if (!BOT_TOKEN || !BSCSCAN_API) {
  console.error("❌ Missing BOT_TOKEN or BSCSCAN_API");
  process.exit(1);
}

/* ================== BOT + SERVER ================== */
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server started on port", PORT);

  const url =
    process.env.RENDER_EXTERNAL_URL ||
    `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;

  bot
    .setWebHook(`${url}/webhook`)
    .then(() => console.log("✅ Webhook connected"))
    .catch((err) =>
      console.log("⚠️ Webhook error (non-fatal):", err.message)
    );
});
/* ============================================ */

/* ================== DATABASE ================== */
let db = {
  users: [],
  lastBNBTx: null,
  lastTokenTx: null,
};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

const saveDB = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
};
/* ============================================ */

/* ================== USERS ================== */
bot.on("message", (msg) => {
  if (!db.users.includes(msg.chat.id)) {
    db.users.push(msg.chat.id);
    saveDB();
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🤖 *Wallet Monitor Bot*\n\n" +
      "🔔 البوت بيراقب عنوان واحد ثابت\n" +
      "💰 أي تحويل BNB أو USDT أو أي عملة BEP20\n" +
      "⚡ الإشعارات بتوصلك تلقائي\n\n" +
      "سيب البوت مفتوح وهتوصلك كل الحركات 🔥",
    { parse_mode: "Markdown" }
  );
});
/* ============================================ */

/* ================== BROADCAST ================== */
function broadcast(text) {
  db.users.forEach((chatId) => {
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  });
}
/* ============================================ */

/* ================== MONITOR ================== */
setInterval(async () => {
  try {
    /* -------- BNB Transactions -------- */
    const bnbURL = `https://api.bscscan.com/api?module=account&action=txlist&address=${WATCHED_ADDRESS}&sort=desc&apikey=${BSCSCAN_API}`;
    const bnbData = await fetch(bnbURL).then((r) => r.json());

    if (bnbData.status === "1" && bnbData.result.length) {
      const tx = bnbData.result[0];

      if (tx.hash !== db.lastBNBTx) {
        db.lastBNBTx = tx.hash;
        saveDB();

        const amount = (tx.value / 1e18).toFixed(6);
        const incoming = tx.to.toLowerCase() === WATCHED_ADDRESS;

        broadcast(`
🚨 *BNB Transaction*

${incoming ? "⬆️ Incoming" : "⬇️ Outgoing"}
💰 Amount: *${amount} BNB*
👤 From: \`${tx.from}\`
🎯 To: \`${tx.to}\`
🔗 https://bscscan.com/tx/${tx.hash}
        `);
      }
    }

    /* -------- TOKEN Transactions (USDT + ALL BEP20) -------- */
    const tokenURL = `https://api.bscscan.com/api?module=account&action=tokentx&address=${WATCHED_ADDRESS}&sort=desc&apikey=${BSCSCAN_API}`;
    const tokenData = await fetch(tokenURL).then((r) => r.json());

    if (tokenData.status === "1" && tokenData.result.length) {
      const tx = tokenData.result[0];

      if (tx.hash !== db.lastTokenTx) {
        db.lastTokenTx = tx.hash;
        saveDB();

        const amount =
          (tx.value / 10 ** tx.tokenDecimal).toFixed(4);
        const incoming = tx.to.toLowerCase() === WATCHED_ADDRESS;

        broadcast(`
🚨 *Token Transaction*

${incoming ? "⬆️ Incoming" : "⬇️ Outgoing"}
🪙 Token: *${tx.tokenSymbol}*
💰 Amount: *${amount}*
👤 From: \`${tx.from}\`
🎯 To: \`${tx.to}\`
🔗 https://bscscan.com/tx/${tx.hash}
        `);
      }
    }
  } catch (e) {
    console.log("Monitor error:", e.message);
  }
}, CHECK_INTERVAL);
/* ============================================ */
