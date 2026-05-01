import { createClient } from '@supabase/supabase-js';
import PayOS from '@payos/node';

const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';

const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';

const payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // PayOS sends a POST request to this webhook
  if (req.method !== 'POST') {
    return res.status(200).send('Webhook is active');
  }

  try {
    const body = req.body;
    
    // 1. Verify Webhook (Standard PayOS Verification)
    // Note: In some environments, raw body is needed.
    const webhookData = payos.verifyPaymentWebhookData(body);

    if (webhookData.success || webhookData.desc === 'success') {
      const orderCode = webhookData.orderCode;
      
      // 2. Find the pending payment in Database
      const { data: paymentRecord, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('order_code', orderCode)
        .eq('status', 'pending')
        .single();

      if (paymentRecord && !fetchError) {
        // 3. Payment is valid! Generate the Key.
        const type = paymentRecord.key_type_requested;
        const newKeyCode = 'KEY-' + type.toUpperCase() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        // 4. Save Key to access_keys table
        await supabase.from('access_keys').insert({
          key_code: newKeyCode,
          key_type: type,
          is_used: false,
          is_active: true
        });

        // 5. Update payment status
        await supabase.from('payments').update({
          status: 'completed',
          key_generated: newKeyCode,
          completed_at: new Date().toISOString()
        }).eq('id', paymentRecord.id);

        // 6. Notify User via Telegram
        const successMsg = `
✅ *THANH TOÁN THÀNH CÔNG* ✅
━━━━━━━━━━━━━━━━━━
Cảm ơn bạn đã ủng hộ! Đây là mã kích hoạt của bạn:

🔑 *Key:* \`${newKeyCode}\`
📦 Gói: *${type.toUpperCase()}*

_Hãy copy mã này và nhập vào Tool để bắt đầu sử dụng._
        `;
        await sendTelegramMessage(paymentRecord.telegram_id, successMsg);
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(200).json({ success: false }); // Always return 200 to PayOS
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });
}
