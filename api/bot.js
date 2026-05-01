import { createClient } from '@supabase/supabase-js';
import { PayOS } from '@payos/node';

const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999ebb94dd4e50ca209dbca3872';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';

let supabase;
let payos;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Bot OK');

  try {
    const body = req.body;
    if (!supabase) supabase = createClient(supabaseUrl, supabaseKey);
    if (!payos) {
      payos = new PayOS({ clientId: PAYOS_CLIENT_ID, apiKey: PAYOS_API_KEY, checksumKey: PAYOS_CHECKSUM_KEY });
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
      if (text === '/start') await sendTelegramMessage(chatId, "👋 Chào mừng bạn! Gõ /buy để mua Key.");
      else if (text === '/id') await sendTelegramMessage(chatId, `🆔 ID: \`${chatId}\``);
      else if (text === '/buy' || text === '/prices') await sendPriceList(chatId, text === '/buy');
      else if (chatId === ADMIN_CHAT_ID) {
        if (text === '/admin' || text === '/help') await handleAdminHelp(chatId);
        else if (text.startsWith('/setprice')) await handleSetPrice(chatId, text);
        else if (text.startsWith('/taokey')) await handleTaoKey(chatId, text);
        else if (text.startsWith('/checkkey')) await handleCheckKey(chatId, text);
        else if (text.startsWith('/thuhoi')) await handleThuHoiKey(chatId, text);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendTelegramMessage(ADMIN_CHAT_ID, `⚠️ Lỗi hệ thống: ${error.message}`);
    return res.status(200).json({ ok: true });
  }
}

async function handlePaymentRequest(chatId, type) {
  const { data: priceData } = await supabase.from('key_prices').select('*').eq('key_type', type).single();
  if (!priceData) return;

  const orderCode = Number(String(Date.now()).slice(-9));
  const amount = priceData.price;
  const description = `Mua Key ${type}`;
  const cancelUrl = 'https://www.arikakhai.com';
  const returnUrl = 'https://www.arikakhai.com';

  try {
    const paymentData = {
      orderCode, amount, description, cancelUrl, returnUrl
    };

    const result = await payos.paymentRequests.create(paymentData);
    const paymentLink = result.checkoutUrl;

    await supabase.from('payments').insert({
      order_code: orderCode, telegram_id: chatId, amount: amount, key_type_requested: type, status: 'pending'
    });
    
    await sendTelegramMessage(chatId, `💳 *THANH TOÁN*\n━━━━━━━━━━━━━━━━━━\n📦 Gói: *${priceData.name}*\n💰 Giá: *${amount.toLocaleString('vi-VN')}đ*`, {
      reply_markup: {
        inline_keyboard: [[{ text: "🚀 THANH TOÁN QUA VIETQR", url: paymentLink }]]
      }
    });
  } catch (err) {
    await sendTelegramMessage(chatId, `❌ Lỗi tạo thanh toán: ${err.message}`);
  }
}

async function sendPriceList(chatId, showButtons) {
  const { data: prices } = await supabase.from('key_prices').select('*').order('price', { ascending: true });
  if (!prices || prices.length === 0) return await sendTelegramMessage(chatId, "❌ Chưa có bảng giá.");
  let msg = "💰 *BẢNG GIÁ DỊCH VỤ*\n━━━━━━━━━━━━━━━━━━\n";
  const buttons = [];
  prices.forEach(p => {
    msg += `🔹 *${p.name}*: ${p.price.toLocaleString('vi-VN')}đ\n`;
    if (showButtons && p.price > 0) buttons.push([{ text: `🛒 Mua ${p.name}`, callback_data: `buy_${p.key_type}` }]);
  });
  await sendTelegramMessage(chatId, msg, { reply_markup: showButtons ? { inline_keyboard: buttons } : undefined });
}

async function handleSetPrice(chatId, text) {
  const parts = text.split(' ');
  if (parts.length < 3) return;
  const type = parts[1];
  const price = parseInt(parts[2]);
  const name = type === 'trial' ? 'Bản dùng thử' : type === 'day' ? 'Gói 1 Ngày' : type === 'month' ? 'Gói 1 Tháng' : 'Gói Vĩnh Viễn';
  await supabase.from('key_prices').upsert({ key_type: type, price, name }, { onConflict: 'key_type' });
  await sendTelegramMessage(chatId, `✅ Đã cập nhật giá gói *${name}*`);
}

async function handleTaoKey(chatId, text) {
  const parts = text.split(' ');
  const type = parts[1] || 'trial';
  const amount = parseInt(parts[2]) || 1;
  
  if (amount > 50) return await sendTelegramMessage(chatId, "❌ Chỉ được tạo tối đa 50 key 1 lần.");
  
  const keys = [];
  let msg = `🔑 *ĐÃ TẠO ${amount} KEY GÓI ${type.toUpperCase()}*\n━━━━━━━━━━━━━━━━━━\n`;
  
  for (let i = 0; i < amount; i++) {
    const key = `KEY-${type.toUpperCase()}-` + Math.random().toString(36).substring(2, 10).toUpperCase();
    keys.push({ key_code: key, key_type: type, is_used: false, is_active: true });
    msg += `\`${key}\`\n`;
  }
  
  await supabase.from('access_keys').insert(keys);
  await sendTelegramMessage(chatId, msg);
}

async function handleCheckKey(chatId, text) {
  const parts = text.split(' ');
  if (parts.length < 2) return await sendTelegramMessage(chatId, "❌ Vui lòng nhập mã Key. Ví dụ: `/checkkey KEY-DAY-1234`");
  const keyCode = parts[1].trim();
  
  const { data: keyData } = await supabase.from('access_keys').select('*').eq('key_code', keyCode).single();
  if (!keyData) return await sendTelegramMessage(chatId, `❌ Không tìm thấy Key: \`${keyCode}\``);
  
  const status = keyData.is_active ? (keyData.is_used ? "🔴 Đã sử dụng" : "🟢 Chưa sử dụng") : "⚫ Đã thu hồi";
  
  let msg = `🔍 *THÔNG TIN KEY*\n━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔑 Mã Key: \`${keyData.key_code}\`\n`;
  msg += `📦 Loại gói: *${keyData.key_type || 'N/A'}*\n`;
  msg += `📊 Trạng thái: *${status}*\n`;
  if (keyData.hwid) msg += `💻 HWID Máy: \`${keyData.hwid}\`\n`;
  if (keyData.expires_at) msg += `⏳ Hạn sử dụng: ${new Date(keyData.expires_at).toLocaleString('vi-VN')}\n`;
  
  await sendTelegramMessage(chatId, msg);
}

async function handleThuHoiKey(chatId, text) {
  const parts = text.split(' ');
  if (parts.length < 2) return await sendTelegramMessage(chatId, "❌ Vui lòng nhập mã Key. Ví dụ: `/thuhoi KEY-DAY-1234`");
  const keyCode = parts[1].trim();
  
  const { data: keyData } = await supabase.from('access_keys').select('*').eq('key_code', keyCode).single();
  if (!keyData) return await sendTelegramMessage(chatId, `❌ Không tìm thấy Key: \`${keyCode}\``);
  
  await supabase.from('access_keys').update({ is_active: false }).eq('key_code', keyCode);
  await sendTelegramMessage(chatId, `✅ Đã thu hồi/vô hiệu hóa Key:\n\`${keyCode}\``);
}

async function handleAdminHelp(chatId) {
  let msg = `⚙️ *BẢNG LỆNH DÀNH CHO ADMIN* ⚙️\n━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `*1. Cấu hình bảng giá:*\n`;
  msg += `👉 \`/setprice [gói] [giá]\`\n`;
  msg += `_Các gói: trial, day, month, lifetime_\n\n`;
  
  msg += `*2. Quản lý Key (License):*\n`;
  msg += `👉 \`/taokey [gói] [số_lượng]\`\n`;
  msg += `_Tạo nhiều Key cùng lúc (VD: /taokey day 5)_\n`;
  msg += `👉 \`/checkkey [mã_key]\`\n`;
  msg += `_Xem thông tin, trạng thái, người dùng của Key_\n`;
  msg += `👉 \`/thuhoi [mã_key]\`\n`;
  msg += `_Vô hiệu hóa Key lập tức_\n\n`;
  
  msg += `*3. Lệnh cơ bản (ai cũng dùng được):*\n`;
  msg += `👉 \`/buy\` hoặc \`/prices\`: Xem bảng giá\n`;
  msg += `👉 \`/id\`: Lấy Chat ID hiện tại\n`;
  
  await sendTelegramMessage(chatId, msg);
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
}
