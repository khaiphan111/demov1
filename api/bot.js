import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';

// Đổi tên biến để tránh nhầm lẫn tuyệt đối
let GLOBAL_PAYOS_INSTANCE;
let GLOBAL_SUPABASE_CLIENT;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot OK');

  try {
    const body = req.body;
    
    // Khởi tạo Supabase
    if (!GLOBAL_SUPABASE_CLIENT) {
      GLOBAL_SUPABASE_CLIENT = createClient(supabaseUrl, supabaseKey);
    }

    // Khởi tạo PayOS
    if (!GLOBAL_PAYOS_INSTANCE) {
      try {
        const PayOSLib = require('@payos/node');
        // Đối với bản 2.x, Class thường nằm trong .PayOS hoặc .default hoặc chính nó
        const ActualClass = PayOSLib.PayOS || PayOSLib.default || (typeof PayOSLib === 'function' ? PayOSLib : null);
        
        if (!ActualClass) throw new Error("Thư viện PayOS không hợp lệ");

        GLOBAL_PAYOS_INSTANCE = new ActualClass({
          clientId: PAYOS_CLIENT_ID,
          apiKey: PAYOS_API_KEY,
          checksumKey: PAYOS_CHECKSUM_KEY
        });
      } catch (err) {
        // Fallback cho bản cũ 1.x
        const PayOSLib = require('@payos/node');
        const ActualClass = PayOSLib.PayOS || PayOSLib.default || PayOSLib;
        GLOBAL_PAYOS_INSTANCE = new ActualClass(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);
      }
    }

    if (body.callback_query) {
      const chatId = body.callback_query.from.id.toString();
      const data = body.callback_query.data;
      if (data.startsWith('buy_')) await handlePaymentRequest(chatId, data.replace('buy_', ''));
      return res.status(200).json({ ok: true });
    }

    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString();
      const text = body.message.text.trim();
      if (text === '/start') await sendWelcomeMessage(chatId);
      else if (text === '/id') await sendTelegramMessage(chatId, `🆔 ID: \`${chatId}\``);
      else if (text === '/buy' || text === '/prices') await sendPriceList(chatId, text === '/buy');
      else if (text.startsWith('/setprice')) await handleSetPrice(chatId, text);
      else if (chatId === ADMIN_CHAT_ID && text === '/taokey') await handleManualGenKey(chatId);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendTelegramMessage(ADMIN_CHAT_ID, `⚠️ *Hệ thống lỗi:* ${error.message}`);
    return res.status(200).json({ ok: true });
  }
}

async function sendWelcomeMessage(chatId) {
  await sendTelegramMessage(chatId, `👋 *Chào mừng bạn đã quay lại!*\n━━━━━━━━━━━━━━━━━━\n🛒 Gõ /buy để xem bảng giá và mua Key.`);
}

async function sendPriceList(chatId, showButtons) {
  const { data: prices } = await GLOBAL_SUPABASE_CLIENT.from('key_prices').select('*').order('price', { ascending: true });
  if (!prices || prices.length === 0) return await sendTelegramMessage(chatId, "❌ Hệ thống chưa cấu hình bảng giá.");
  
  let msg = "💰 *BẢNG GIÁ DỊCH VỤ* 💰\n━━━━━━━━━━━━━━━━━━\n";
  const buttons = [];
  prices.forEach(p => {
    msg += `🔹 *${p.name}*: ${p.price.toLocaleString('vi-VN')}đ\n`;
    if (showButtons && p.price > 0) {
      buttons.push([{ text: `🛒 Mua ${p.name}`, callback_data: `buy_${p.key_type}` }]);
    }
  });
  
  await sendTelegramMessage(chatId, msg, { reply_markup: showButtons ? { inline_keyboard: buttons } : undefined });
}

async function handlePaymentRequest(chatId, type) {
  const { data: priceData } = await GLOBAL_SUPABASE_CLIENT.from('key_prices').select('*').eq('key_type', type).single();
  if (!priceData) return;
  
  const orderCode = Number(String(Date.now()).slice(-9));
  try {
    const paymentData = {
      orderCode,
      amount: priceData.price,
      description: `Thanh toan Key ${type}`,
      cancelUrl: 'https://www.arikakhai.com',
      returnUrl: 'https://www.arikakhai.com'
    };

    // Gọi hàm tạo link từ instance đã được xác thực
    const paymentLink = await GLOBAL_PAYOS_INSTANCE.createPaymentLink(paymentData);

    await GLOBAL_SUPABASE_CLIENT.from('payments').insert({
      order_code: orderCode,
      telegram_id: chatId,
      amount: priceData.price,
      key_type_requested: type,
      status: 'pending'
    });
    
    await sendTelegramMessage(chatId, `💳 *THÔNG TIN THANH TOÁN*\n━━━━━━━━━━━━━━━━━━\n📦 Gói: *${priceData.name}*\n💰 Giá: *${priceData.price.toLocaleString('vi-VN')}đ*\n\n_Vui lòng nhấn nút bên dưới để thanh toán qua VietQR:_`, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 THANH TOÁN NGAY (VietQR)", url: paymentLink.checkoutUrl }]]
      }
    });
  } catch (err) {
    await sendTelegramMessage(chatId, `❌ Lỗi thanh toán: ${err.message}`);
  }
}

async function handleSetPrice(chatId, text) {
  const parts = text.split(' ');
  if (parts.length < 3) return;
  const type = parts[1];
  const price = parseInt(parts[2]);
  const name = type === 'trial' ? 'Bản dùng thử' : type === 'day' ? 'Gói 1 Ngày' : type === 'month' ? 'Gói 1 Tháng' : 'Gói Vĩnh Viễn';
  
  await GLOBAL_SUPABASE_CLIENT.from('key_prices').upsert({ key_type: type, price, name }, { onConflict: 'key_type' });
  await sendTelegramMessage(chatId, `✅ Đã cập nhật giá gói *${name}*`);
}

async function handleManualGenKey(chatId) {
  const key = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  await GLOBAL_SUPABASE_CLIENT.from('access_keys').insert([{ key_code: key, is_used: false, is_active: true }]);
  await sendTelegramMessage(chatId, `🔑 *VỪA TẠO KEY MỚI:*\n\n\`${key}\``);
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
}
