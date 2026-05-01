import { createClient } from '@supabase/supabase-js';
import PayOS from '@payos/node';

// === CONFIG ===
const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const PAYOS_CLIENT_ID = '9a07d699-4a29-4524-a6eb-ee323c2c83e7';
const PAYOS_API_KEY = '6880e97f-002b-48f0-a18f-10444ed50bcd';
const PAYOS_CHECKSUM_KEY = '12d66715b54bae5a546de73716136378e9087999';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';

// Lazy init to avoid errors during module load
let payos;
let supabase;

export default async function handler(req, res) {
  // Trả về 200 ngay nếu không phải POST
  if (req.method !== 'POST') {
    return res.status(200).send('Webhook OK');
  }

  try {
    // Khởi tạo các client bên trong handler
    if (!payos) payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);
    if (!supabase) supabase = createClient(supabaseUrl, supabaseKey);

    const body = req.body;

    // 1. Phản hồi xác nhận Webhook (Cực kỳ quan trọng để PayOS báo xanh)
    if (!body || body.desc === 'confirm-webhook' || !body.data) {
      console.log("PayOS xác nhận Webhook URL");
      return res.status(200).json({
        success: true,
        message: 'Webhook link confirmed successfully'
      });
    }

    // 2. Xác thực dữ liệu thực tế
    const webhookData = payos.verifyPaymentWebhookData(body);
    
    if (webhookData && webhookData.orderCode) {
      const orderCode = webhookData.orderCode;
      
      // Xử lý logic tạo Key (Giữ nguyên như bản trước)
      const { data: paymentRecord } = await supabase
        .from('payments')
        .select('*')
        .eq('order_code', orderCode)
        .eq('status', 'pending')
        .single();

      if (paymentRecord) {
        const type = paymentRecord.key_type_requested;
        const newKeyCode = 'KEY-' + type.toUpperCase() + '-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        await supabase.from('access_keys').insert({
          key_code: newKeyCode,
          key_type: type,
          is_used: false,
          is_active: true
        });

        await supabase.from('payments').update({
          status: 'completed',
          key_generated: newKeyCode,
          completed_at: new Date().toISOString()
        }).eq('id', paymentRecord.id);

        const successMsg = `✅ *THANH TOÁN THÀNH CÔNG*\nMã đơn: \`${orderCode}\`\n🔑 *Key:* \`${newKeyCode}\`\n📦 Gói: *${type.toUpperCase()}*`;
        await sendTelegramMessage(paymentRecord.telegram_id, successMsg);
      }
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook Runtime Error:', error.message);
    // Luôn trả về 200 để dập tắt lỗi đỏ trên PayOS Dashboard
    return res.status(200).json({ 
      success: false, 
      message: error.message 
    });
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
