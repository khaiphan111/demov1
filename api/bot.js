import { createClient } from '@supabase/supabase-js';

const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

// Initialize Supabase Client
const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe'; // Ideally use Service Role Key, but this works for now if RLS is disabled
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running...');
  }

  try {
    const body = req.body;
    
    // Check if there is a message
    if (body.message && body.message.text) {
      const chatId = body.message.chat.id.toString();
      const text = body.message.text.trim();

      // Only allow the admin to use commands
      if (chatId === ADMIN_CHAT_ID) {
        
        if (text === '/taokey') {
          // Generate new key
          const newKeyCode = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
          
          const { data, error } = await supabase
            .from('access_keys')
            .insert([{ key_code: newKeyCode, is_used: false }])
            .select();

          if (error) {
            await sendTelegramMessage(chatId, `❌ *Lỗi tạo Key:*\n${error.message}`);
          } else {
            const msg = `
✅ *TẠO KEY THÀNH CÔNG* ✅
━━━━━━━━━━━━━━━━━━
🔑 *Mã Key:* \`${newKeyCode}\`
Trạng thái: 🟢 Chưa sử dụng

_Hãy copy mã này và gửi cho khách hàng._
            `;
            await sendTelegramMessage(chatId, msg);
          }
        } 
        else if (text === '/start') {
          const msg = `
👋 *Xin chào Admin!*
━━━━━━━━━━━━━━━━━━
Đây là hệ thống quản lý Key tự động.

🛠 *Các lệnh hỗ trợ:*
👉 /taokey - Tạo một mã truy cập mới ngay lập tức
          `;
          await sendTelegramMessage(chatId, msg);
        }
      } else {
        // Not admin
        await sendTelegramMessage(chatId, "⛔️ _Bạn không có quyền sử dụng bot này._");
      }
    }
    
    // Always return 200 to acknowledge Telegram
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}
