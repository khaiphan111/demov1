import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';

let supabase;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Webhook OK');

  try {
    if (!supabase) supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.body;
    if (!body || body.desc === 'confirm-webhook' || !body.data) {
      return res.status(200).json({ success: true, message: 'Confirmed' });
    }

    // 1. Xác thực chữ ký webhook thủ công
    const data = body.data;
    const sortedData = `amount=${data.amount}&description=${data.description}&orderCode=${data.orderCode}&paymentLinkId=${data.paymentLinkId}&reason=${data.reason}&status=${data.status}`;
    const expectedSignature = crypto.createHmac('sha256', PAYOS_CHECKSUM_KEY).update(sortedData).digest('hex');

    if (body.signature !== expectedSignature) {
       console.error("Sai chữ ký Webhook");
       return res.status(200).json({ success: false, message: 'Invalid signature' });
    }

    // 2. Xử lý khi thanh toán thành công
    if (data.status === 'PAID') {
      const orderCode = data.orderCode;
      const { data: paymentRecord } = await supabase.from('payments').select('*').eq('order_code', orderCode).eq('status', 'pending').single();

      if (paymentRecord) {
        const type = paymentRecord.key_type_requested;
        const newKeyCode = 'KEY-' + type.toUpperCase() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        
        await supabase.from('access_keys').insert({ key_code: newKeyCode, key_type: type, is_used: false, is_active: true });
        await supabase.from('payments').update({ status: 'completed', key_generated: newKeyCode, completed_at: new Date().toISOString() }).eq('id', paymentRecord.id);
        
        const successMsg = `✅ *THANH TOÁN THÀNH CÔNG*\n━━━━━━━━━━━━━━━━━━\nMã đơn: \`${orderCode}\`\n🔑 *Key:* \`${newKeyCode}\`\n📦 Gói: *${type.toUpperCase()}*`;
        await sendTelegramMessage(paymentRecord.telegram_id, successMsg);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(200).json({ success: false, error: error.message });
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  } catch (e) {}
}
