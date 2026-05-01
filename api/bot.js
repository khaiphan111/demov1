import { createClient } from '@supabase/supabase-js';
import PayOS from '@payos/node';

// === CONFIGURATION ===
const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';

const payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe'; // Ideally use Service Role Key for updates
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running...');
  }

  try {
    const body = req.body;

    // 1. Handle Callback Queries (Button Clicks)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const chatId = callbackQuery.message.chat.id.toString();
      const data = callbackQuery.data; // e.g., "buy_month"

      if (data.startsWith('buy_')) {
        const type = data.replace('buy_', '');
        await handlePaymentRequest(chatId, type);
      }
      
      return res.status(200).json({ ok: true });
    }

    // 2. Handle Text Messages
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
        // Existing functionality
        await handleManualGenKey(chatId);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Bot Error:', error);
    res.status(200).send('OK'); // Always 200 for Telegram
  }
}

async function sendWelcomeMessage(chatId) {
  const msg = `
👋 *Chào mừng bạn đến với FB Auto Reg Pro!*
━━━━━━━━━━━━━━━━━━
Hệ thống cung cấp giải pháp nuôi nick & reg account tự động hàng đầu.

🛒 Gõ /buy để xem bảng giá và mua Key tự động.
🛠 Gõ /prices để xem bảng giá hiện tại.
  `;
  await sendTelegramMessage(chatId, msg);
}

async function sendPriceList(chatId, showBuyButtons = true) {
  const { data: prices, error } = await supabase.from('key_prices').select('*').order('price', { ascending: true });
  
  if (error || !prices) {
    return await sendTelegramMessage(chatId, "❌ Lỗi lấy bảng giá từ Database.");
  }

  let msg = "💰 *BẢNG GIÁ KEY BẢN QUYỀN* 💰\n━━━━━━━━━━━━━━━━━━\n";
  const buttons = [];

  prices.forEach(p => {
    msg += `🔹 *${p.name}*: ${p.price.toLocaleString('vi-VN')}đ\n`;
    if (showBuyButtons && p.price > 0) {
      buttons.push([{ text: `Mua ${p.name}`, callback_data: `buy_${p.key_type}` }]);
    }
  });

  msg += "\n_Sau khi thanh toán, Key sẽ được gửi trực tiếp tại đây._";

  await sendTelegramMessage(chatId, msg, {
    reply_markup: showBuyButtons ? { inline_keyboard: buttons } : undefined
  });
}

async function handlePaymentRequest(chatId, type) {
  // 1. Get price info
  const { data: priceData } = await supabase.from('key_prices').select('*').eq('key_type', type).single();
  if (!priceData) return;

  const orderCode = Date.now(); // Unique order code
  const domain = 'https://' + process.env.VERCEL_URL; // Or your real domain

  try {
    // 2. Create PayOS Link
    const paymentData = {
      orderCode: orderCode,
      amount: priceData.price,
      description: `Mua Key ${type}`,
      cancelUrl: `${domain}/cancel`,
      returnUrl: `${domain}/success`,
    };

    const paymentLink = await payos.createPaymentLink(paymentData);

    // 3. Save pending payment to DB
    await supabase.from('payments').insert({
      order_code: orderCode,
      telegram_id: chatId,
      amount: priceData.price,
      key_type_requested: type,
      status: 'pending'
    });

    const msg = `
💳 *THANH TOÁN ĐƠN HÀNG*
━━━━━━━━━━━━━━━━━━
📦 Gói: *${priceData.name}*
💰 Số tiền: *${priceData.price.toLocaleString('vi-VN')}đ*

Mã đơn: \`${orderCode}\`

👇 *Nhấn vào nút dưới đây để thanh toán:*
    `;

    await sendTelegramMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 THANH TOÁN NGAY", url: paymentLink.checkoutUrl }]]
      }
    });

  } catch (err) {
    console.error("PayOS Error:", err);
    await sendTelegramMessage(chatId, "❌ Có lỗi xảy ra khi tạo link thanh toán.");
  }
}

async function handleSetPrice(chatId, text) {
  // Format: /setprice [type] [price]
  const parts = text.split(' ');
  if (parts.length < 3) return await sendTelegramMessage(chatId, "Sử dụng: \`/setprice [type] [price]\`\nVí dụ: \`/setprice month 150000\`");

  const type = parts[1];
  const price = parseInt(parts[2]);

  const { error } = await supabase.from('key_prices').update({ price: price }).eq('key_type', type);

  if (error) {
    await sendTelegramMessage(chatId, `❌ Lỗi cập nhật: ${error.message}`);
  } else {
    await sendTelegramMessage(chatId, `✅ Đã cập nhật giá gói *${type}* thành *${price.toLocaleString('vi-VN')}đ*`);
  }
}

async function handleManualGenKey(chatId) {
  const newKeyCode = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const { error } = await supabase.from('access_keys').insert([{ key_code: newKeyCode, is_used: false }]);

  if (error) {
    await sendTelegramMessage(chatId, `❌ Lỗi tạo Key: ${error.message}`);
  } else {
    await sendTelegramMessage(chatId, `✅ *KEY THỦ CÔNG:* \`${newKeyCode}\``);
  }
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
}
