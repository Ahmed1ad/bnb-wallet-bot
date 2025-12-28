import TelegramBot from "node-telegram-bot-api";
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

/* ================= CONFIG ================= */
const BOT_TOKEN = process.env.BOT_TOKEN;
const BSCSCAN_API = process.env.BSCSCAN_API;

const WATCHED_ADDRESS =
  "0xbda40164caabdaccf22bcee5986cbff4ec36634d".toLowerCase();

const CHECK_INTERVAL = 30000; // 30 ثانية
const DB_FILE = "./data.json";
/* ========================================= */

if (!BOT_TOKEN || !BSCSCAN_API) {
  console.error("❌ Missing BOT_TOKEN or BSCSCAN_API");
  process.exit(1);
}

/* ================= BOT + SERVER ================= */
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Bot is running"));

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("🚀 Server started on port", PORT);

  const url =
    process.env.RENDER_EXTERNAL_URL ||
    `https://${process.env.RENDER_SERVICE_NAME}.onrender.com`;

  await bot.setWebHook(`${url}/webhook`);
  console.log("✅ Webhook connected");
});
/* =============================================== */

/* ================= DATABASE ================= */
let db = {
  users: [],
  lastBlock: 0
};

if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
/* ============================================ */

/* ================= USERS ================= */
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
      "🔔 مراقبة محفظة واحدة\n" +
      "💰 BNB + BEP20 Tokens\n" +
      "⚡ إشعارات فورية\n\n" +
      "جاهز للعمل ✅",
    { parse_mode: "Markdown" }
  );
});
/* ========================================== */

/* ================= BROADCAST ================= */
function broadcast(text) {
  for (const chatId of db.users) {
    bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  }
}
/* ============================================ */

/* ================= MONITOR ================= */
setInterval(async () => {
  try {
    /* -------- BNB TRANSACTIONS -------- */
    const bnbURL =
      `https://api.bscscan.com/api?module=account&action=txlist` +
      `&address=${WATCHED_ADDRESS}` +
      `&startblock=${db.lastBlock}` +
      `&sort=asc&apikey=${BSCSCAN_API}`;

    const bnbData = await fetch(bnbURL).then(r => r.json());

    if (bnbData.status === "1" && Array.isArray(bnbData.result)) {
      for (const tx of bnbData.result) {
        const blockNumber = Number(tx.blockNumber);
        if (blockNumber <= db.lastBlock) continue;

        db.lastBlock = blockNumber;
        saveDB();

        const amount = (tx.value / 1e18).toFixed(6);
        const incoming = tx.to.toLowerCase() === WATCHED_ADDRESS;

        broadcast(
`🚨 *BNB Transaction*
${incoming ? "⬆️ Incoming" : "⬇️ Outgoing"}
💰 Amount: *${amount} BNB*
👤 From: \`${tx.from}\`
🎯 To: \`${tx.to}\`
🔗 https://bscscan.com/tx/${tx.hash}`
        );
      }
    }

    /* -------- TOKEN TRANSACTIONS -------- */
    const tokenURL =
      `https://api.bscscan.com/api?module=account&action=tokentx` +
      `&address=${WATCHED_ADDRESS}` +
      `&startblock=${db.lastBlock}` +
      `&sort=asc&apikey=${BSCSCAN_API}`;

    const tokenData = await fetch(tokenURL).then(r => r.json());

    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
      for (const tx of tokenData.result) {
        const blockNumber = Number(tx.blockNumber);
        if (blockNumber <= db.lastBlock) continue;

        db.lastBlock = blockNumber;
        saveDB();

        const amount = (tx.value / 10 ** tx.tokenDecimal).toFixed(4);
        const incoming = tx.to.toLowerCase() === WATCHED_ADDRESS;

        broadcast(
`🚨 *Token Transaction*
${incoming ? "⬆️ Incoming" : "⬇️ Outgoing"}
🪙 Token: *${tx.tokenSymbol}*
💰 Amount: *${amount}*
👤 From: \`${tx.from}\`
🎯 To: \`${tx.to}\`
🔗 https://bscscan.com/tx/${tx.hash}`
        );
      }
    }

  } catch (err) {
    console.error("Monitor error:", err.message);
  }
}, CHECK_INTERVAL);
/* ============================================ */
