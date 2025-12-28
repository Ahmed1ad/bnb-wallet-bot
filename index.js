import TelegramBot from "node-telegram-bot-api";
import fetch from "node-fetch";
import fs from "fs";

const BOT_TOKEN = "7069425588:AAHum419wO6f-pCQK0ighkg7ZcTGPls9LQw";
const BSCSCAN_API = "W4R52WUPUCUI5D3JZTI6JCBCAZGW4SKECZ";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const DB_FILE = "./wallets.json";

const loadDB = () =>
  fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : {};

const saveDB = (data) =>
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

let db = loadDB();

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🤖 *BNB Wallet Alert Bot*\n\n" +
      "أوامر البوت:\n" +
      "/add ADDRESS\n" +
      "/remove ADDRESS\n" +
      "/list\n",
    { parse_mode: "Markdown" }
  );
});

// /add
bot.onText(/\/add (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const address = match[1].toLowerCase();

  if (!db[chatId]) db[chatId] = {};
  db[chatId][address] = { lastTx: null };
  saveDB(db);

  bot.sendMessage(chatId, `✅ تم إضافة المحفظة:\n${address}`);
});

// /remove
bot.onText(/\/remove (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const address = match[1].toLowerCase();

  if (db[chatId] && db[chatId][address]) {
    delete db[chatId][address];
    saveDB(db);
    bot.sendMessage(chatId, "🗑️ تم حذف المحفظة");
  }
});

// /list
bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const wallets = db[chatId] ? Object.keys(db[chatId]) : [];

  bot.sendMessage(
    chatId,
    wallets.length
      ? wallets.join("\n")
      : "❌ لا يوجد محافظ مضافة"
  );
});

// 🔁 فحص التحويلات كل 15 ثانية
setInterval(async () => {
  for (const chatId in db) {
    for (const address in db[chatId]) {
      const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${BSCSCAN_API}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== "1") continue;

      const tx = data.result[0];
      if (!tx) continue;

      if (db[chatId][address].lastTx !== tx.hash) {
        db[chatId][address].lastTx = tx.hash;
        saveDB(db);

        const amount = (tx.value / 1e18).toFixed(6);
        const direction =
          tx.to.toLowerCase() === address ? "⬆️ Incoming" : "⬇️ Outgoing";

        const message = `
🚨 *BNB Transaction Alert*

📍 Wallet:
\`${address}\`

${direction}
💰 Amount: *${amount} BNB*
👤 From: \`${tx.from}\`
🎯 To: \`${tx.to}\`
🔗 Tx Hash:
https://bscscan.com/tx/${tx.hash}
        `;

        bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
      }
    }
  }
}, 15000);
