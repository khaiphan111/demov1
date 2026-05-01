import { createClient } from '@supabase/supabase-js';
import PayOS from '@payos/node';

const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';
const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';
const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';

let globalPayOS;
let globalSupabase;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');

  try {
    const body = req.body;
    if (!globalSupabase) globalSupabase = createClient(supabaseUrl, supabaseKey);

    if (!globalPayOS) {
      // Cách lấy Class PayOS an toàn nhất trong môi trường ESM
      let PayOSClass = PayOS;
      if (PayOS && PayOS.default) PayOSClass = PayOS.default;
      if (PayOS && PayOS.PayOS) PayOSClass = PayOS.PayOS;
      
      globalPayOS = new PayOSClass({
        clientId: PAYOS_CLIENT_ID,
        apiKey: PAYOS_API_KEY,
        checksumKey: PAYOS_CHECKSUM_KEY
      });
    }

    if (body.callback_query) {
      const chatId = body.callback_query.from.id.toString();
      const data = body.callback_query.data;
      if (data.startsWith('buy_')) await handlePayment(chatId, data.replace('buy_', ''));
      return res.status(200).json({ ok: true });
    }

    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString();
      const text = body.message.text.trim();
      if (text === '/start') await sendMsg(chatId, "👋 Chào mừng bạn! Gõ /buy để mua.");
      else if (text === '/id') await sendMsg(chatId, `🆔 ID: \`${chatId}\``);
      else if (text === '/buy' || text === '/prices') await sendPrices(chatId, text === '/buy');
      else if (text.startsWith('/setprice')) await handleSetPrice(chatId, text);
      else if (chatId === ADMIN_CHAT_ID && text === '/taokey') await handleTaoKey(chatId);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    await sendMsg(ADMIN_CHAT_ID, `⚠️ Lỗi: ${error.message}`);
    return res.status(200).json({ ok: true });
  }
}

async function handlePayment(chatId, type) {
  const { data: pData } = await globalSupabase.from('key_prices').select('*').eq('key_type', type).single();
  if (!pData) return;
  const orderCode = Number(String(Date.now()).slice(-9));
  try {
    const pPayload = {
      orderCode, amount: pData.price, description: `Mua Key ${type}`,
      cancelUrl: 'https://www.arikakhai.com', returnUrl: 'https://www.arikakhai.com'
    };
    
    // Thử gọi hàm với các biến thể tên (đề phòng thư viện bị đổi tên hàm)
    const createFn = globalPayOS.createPaymentLink || globalPayOS.createPaymentOrder || globalPayOS.create;
    const link = await createFn.bind(globalPayOS)(pPayload);
    
    await globalSupabase.from('payments').insert({ order_code: orderCode, telegram_id: chatId, amount: pData.price, key_type_requested: type, status: 'pending' });
    await sendMsg(chatId, `💳 *Gói:* ${pData.name}\n💰 *Giá:* ${pData.price.toLocaleString('vi-VN')}đ`, {
      reply_markup: { inline_keyboard: [[{ text: "🚀 THANH TOÁN NGAY", url: link.checkoutUrl }]] }
    });
  } catch (err) {
    await sendMsg(chatId, `❌ Lỗi: ${err.message}`);
  }
}

async function sendPrices(chatId, showBtns) {
  const { data: prices } = await globalSupabase.from('key_prices').select('*').order('price', { ascending: true });
  let msg = "💰 *BẢNG GIÁ*\n";
  const btns = [];
  prices?.forEach(p => {
    msg += `🔹 ${p.name}: ${p.price.toLocaleString('vi-VN')}đ\n`;
    if (showBtns && p.price > 0) btns.push([{ text: `🛒 Mua ${p.name}`, callback_data: `buy_${p.key_type}` }]);
  });
  await sendMsg(chatId, msg, { reply_markup: showBtns ? { inline_keyboard: btns } : undefined });
}

async function handleSetPrice(chatId, text) {
  const p = text.split(' '); if (p.length < 3) return;
  await globalSupabase.from('key_prices').upsert({ key_type: p[1], price: parseInt(p[2]), name: `Gói ${p[1]}` }, { onConflict: 'key_type' });
  await sendMsg(chatId, "✅ Đã cập nhật giá.");
}

async function handleTaoKey(chatId) {
  const k = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  await globalSupabase.from('access_keys').insert([{ key_code: k, is_used: false, is_active: true }]);
  await sendMsg(chatId, `🔑 Key: \`${k}\``);
}

async function sendMsg(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra })
  });
}
