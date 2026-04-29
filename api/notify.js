const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keyCode } = req.body;
    
    // Format the time nicely for VN timezone
    const timeOptions = { timeZone: 'Asia/Ho_Chi_Minh', hour12: false };
    const vnTime = new Date().toLocaleString('vi-VN', timeOptions);

    const msg = `
🔔 *THÔNG BÁO SỬ DỤNG KEY* 🔔
━━━━━━━━━━━━━━━━━━
🔑 *Key:* \`${keyCode}\`
⏰ *Thời gian:* ${vnTime}
✅ *Trạng thái:* Đăng nhập thành công

_Hệ thống tự động đã kích hoạt cho người dùng này._
    `;

    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown'
      })
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Notify error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}
