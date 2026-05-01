import { createClient } from '@supabase/supabase-js';
import PayOS from '@payos/node';

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
    return res.status(200).send('Bot is active');
  }

  try {
    const body = req.body;
    if (!body) return res.status(200).json({ ok: true });

    if (!payos) {
      try {
        const PayOSClass = PayOS.PayOS || PayOS.default || PayOS;
        if (typeof PayOSClass !== 'function') {
           throw new Error(`Không tìm thấy hàm tạo PayOS. Kiểu hiện tại: ${typeof PayOSClass}. Nội dung: ${JSON.stringify(PayOS)}`);
        }
        payos = new PayOSClass(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);
      } catch (e) {
        await sendTelegramMessage(ADMIN_CHAT_ID, `❌ Lỗi khởi tạo PayOS: ${e.message}`);
        throw e;
      }
    }
    if (!supabase) supabase = createClient(supabaseUrl, supabaseKey);

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

    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString();
      const text = body.message.text.trim();

      if (text === '/start') {
        await sendWelcomeMessage(chatId);
      } else if (text === '/buy') {
        await sendPriceList(chatId);
      } else if (text === '/prices') {
        await sendPriceList(chatId, false);
      } else if (chatId === ADMIN_CHAT_ID && text.startsWith('/setprice')) {
        await handleSetPrice(chatId, text);
      } else if (chatId === ADMIN_CHAT_ID && text === '/taokey') {
        await handleManualGenKey(chatId);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Bot Runtime Error:', error);
    // Gửi lỗi về Telegram cho Admin để biết lỗi gì
    try {
      await sendTelegramMessage(ADMIN_CHAT_ID, `⚠️ *BOT ERROR* ⚠️\n━━━━━━━━━━━━━━━━━━\n\`${error.message}\``);
    } catch (e) {}
    return res.status(200).json({ ok: true }); // Vẫn trả về 200 cho Telegram
  }
}

async function sendWelcomeMessage(chatId) {
  const msg = `👋 *Chào mừng bạn đến với FB Auto Reg Pro!*\n━━━━━━━━━━━━━━━━━━\n🛒 Gõ /buy để mua Key.\n🛠 Gõ /prices để xem giá.`;
  await sendTelegramMessage(chatId, msg);
}

async function sendPriceList(chatId, showBuyButtons = true) {
  const { data: prices, error } = await supabase.from('key_prices').select('*').order('price', { ascending: true });
  if (error || !prices || prices.length === 0) {
    return await sendTelegramMessage(chatId, "❌ Lỗi: Chưa có bảng giá.");
  }

  let msg = "💰 *BẢNG GIÁ* 💰\n━━━━━━━━━━━━━━━━━━\n";
  const buttons = [];
  prices.forEach(p => {
    msg += `🔹 *${p.name}*: ${p.price.toLocaleString('vi-VN')}đ\n`;
    if (showBuyButtons && p.price > 0) {
      buttons.push([{ text: `🛒 Mua ${p.name}`, callback_data: `buy_${p.key_type}` }]);
    }
  });

  await sendTelegramMessage(chatId, msg, { reply_markup: showBuyButtons ? { inline_keyboard: buttons } : undefined });
}

async function handlePaymentRequest(chatId, type) {
  const { data: priceData } = await supabase.from('key_prices').select('*').eq('key_type', type).single();
  if (!priceData) return;

  const orderCode = Number(String(Date.now()).slice(-9));
  try {
    const paymentLink = await payos.createPaymentLink({
      orderCode,
      amount: priceData.price,
      description: `Mua Key ${type}`,
      cancelUrl: 'https://www.arikakhai.com',
      returnUrl: 'https://www.arikakhai.com'
    });

    await supabase.from('payments').insert({ order_code: orderCode, telegram_id: chatId, amount: priceData.price, key_type_requested: type });

    await sendTelegramMessage(chatId, `💳 *THANH TOÁN GÓI ${priceData.name.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━\n💰 Giá: *${priceData.price.toLocaleString('vi-VN')}đ*\nMã đơn: \`${orderCode}\``, {
      reply_markup: { inline_keyboard: [[{ text: "🚀 THANH TOÁN NGAY", url: paymentLink.checkoutUrl }]] }
    });
  } catch (err) {
    await sendTelegramMessage(chatId, "❌ Lỗi tạo link: " + err.message);
  }
}

async function handleSetPrice(chatId, text) {
  const parts = text.split(' ');
  if (parts.length < 3) return;
  await supabase.from('key_prices').update({ price: parseInt(parts[2]) }).eq('key_type', parts[1]);
  await sendTelegramMessage(chatId, `✅ Đã cập nhật giá gói *${parts[1]}*`);
}

async function handleManualGenKey(chatId) {
  const key = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  await supabase.from('access_keys').insert([{ key_code: key, is_used: false }]);
  await sendTelegramMessage(chatId, `🔑 *KEY MỚI:* \`${key}\``);
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
}
