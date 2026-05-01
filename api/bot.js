import { createClient } from '@supabase/supabase-js';
import PayOS from '@payos/node';

// === CONFIG ===
const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';

let payos;
let supabase;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is active and waiting for Telegram...');
  }

  try {
    const body = req.body;
    console.log("Bot nhận tin nhắn:", JSON.stringify(body));

    if (!payos) payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);
    if (!supabase) supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Xử lý Callback Query (Bấm nút)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data;

      if (data.startsWith('buy_')) {
        const type = data.replace('buy_', '');
        await handlePaymentRequest(chatId, type);
      }
      return res.status(200).json({ ok: true });
    }

    // 2. Xử lý Tin nhắn Text
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString();
      const text = body.message.text.trim();

      if (text === '/start') {
        await sendWelcomeMessage(chatId);
      } 
      else if (text === '/buy') {
        await sendPriceList(chatId);
      }
      else if (text === '/prices') {
        await sendPriceList(chatId, false);
      }
      else if (chatId === ADMIN_CHAT_ID && text.startsWith('/setprice')) {
        await handleSetPrice(chatId, text);
      }
      else if (chatId === ADMIN_CHAT_ID && text === '/taokey') {
        await handleManualGenKey(chatId);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Lỗi thực thi Bot:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}

async function sendWelcomeMessage(chatId) {
  const msg = `👋 *Chào mừng bạn đến với FB Auto Reg Pro!*\n━━━━━━━━━━━━━━━━━━\nHệ thống nuôi nick & reg account tự động hàng đầu.\n\n🛒 Gõ /buy để xem bảng giá và mua Key.\n🛠 Gõ /prices để xem giá hiện tại.`;
  await sendTelegramMessage(chatId, msg);
}

async function sendPriceList(chatId, showBuyButtons = true) {
  const { data: prices } = await supabase.from('key_prices').select('*').order('price', { ascending: true });
  
  if (!prices || prices.length === 0) {
    return await sendTelegramMessage(chatId, "❌ Chưa có bảng giá trong Database.");
  }

  let msg = "💰 *BẢNG GIÁ BẢN QUYỀN* 💰\n━━━━━━━━━━━━━━━━━━\n";
  const buttons = [];

  prices.forEach(p => {
    msg += `🔹 *${p.name}*: ${p.price.toLocaleString('vi-VN')}đ\n`;
    if (showBuyButtons && p.price > 0) {
      buttons.push([{ text: `🛒 Mua ${p.name}`, callback_data: `buy_${p.key_type}` }]);
    }
  });

  await sendTelegramMessage(chatId, msg, {
    reply_markup: showBuyButtons ? { inline_keyboard: buttons } : undefined
  });
}

async function handlePaymentRequest(chatId, type) {
  const { data: priceData } = await supabase.from('key_prices').select('*').eq('key_type', type).single();
  if (!priceData) return;

  const orderCode = Number(String(Date.now()).slice(-9)); // PayOS orderCode must be integer
  const domain = 'https://www.arikakhai.com';

  try {
    const paymentData = {
      orderCode: orderCode,
      amount: priceData.price,
      description: `Mua Key ${type}`,
      cancelUrl: `${domain}`,
      returnUrl: `${domain}`,
    };

    const paymentLink = await payos.createPaymentLink(paymentData);

    await supabase.from('payments').insert({
      order_code: orderCode,
      telegram_id: chatId,
      amount: priceData.price,
      key_type_requested: type,
      status: 'pending'
    });

    const msg = `💳 *THANH TOÁN ĐƠN HÀNG*\n━━━━━━━━━━━━━━━━━━\n📦 Gói: *${priceData.name}*\n💰 Số tiền: *${priceData.price.toLocaleString('vi-VN')}đ*\n\nMã đơn: \`${orderCode}\``;

    await sendTelegramMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 THANH TOÁN NGAY", url: paymentLink.checkoutUrl }]]
      }
    });
  } catch (err) {
    console.error("Lỗi PayOS:", err);
    await sendTelegramMessage(chatId, "❌ Lỗi khi tạo link thanh toán: " + err.message);
  }
}

async function handleSetPrice(chatId, text) {
  const parts = text.split(' ');
  if (parts.length < 3) return await sendTelegramMessage(chatId, "HD: \`/setprice [type] [price]\`.");
  const type = parts[1];
  const price = parseInt(parts[2]);
  await supabase.from('key_prices').update({ price: price }).eq('key_type', type);
  await sendTelegramMessage(chatId, `✅ Đã cập nhật giá gói *${type}* thành *${price.toLocaleString('vi-VN')}đ*`);
}

async function handleManualGenKey(chatId) {
  const newKeyCode = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  await supabase.from('access_keys').insert([{ key_code: newKeyCode, is_used: false }]);
  await sendTelegramMessage(chatId, `✅ *KEY MỚI:* \`${newKeyCode}\``);
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
    });
  } catch (e) {}
}
