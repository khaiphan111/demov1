const TELEGRAM_TOKEN = '8319448508:AAG8OKP4aZ10g0kHA1BwijC_pn_PJheSEPs';
const ADMIN_CHAT_ID = '5964340237';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { keyCode, isTest } = req.body;
    const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    let msg = "";
    if (isTest) {
      msg = `🔔 *KIỂM TRA KẾT NỐI BOT* 🔔\n━━━━━━━━━━━━━━━━━━\n✅ Bot của bạn đang hoạt động bình thường!\n⏰ *Thời gian:* ${vnTime}\n\n_Thông báo này được gửi từ trang Web của bạn._`;
    } else {
      msg = `🔔 *THÔNG BÁO SỬ DỤNG KEY* 🔔\n━━━━━━━━━━━━━━━━━━\n🔑 *Key:* \`${keyCode}\`\n⏰ *Thời gian:* ${vnTime}\n✅ *Trạng thái:* Đăng nhập thành công`;
    }

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
    res.status(500).json({ error: 'Failed to send notification' });
  }
}
