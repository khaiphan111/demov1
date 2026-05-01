import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';
const supabase = createClient(supabaseUrl, supabaseKey);

function UserPanel() {
  const [keyCode, setKeyCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!keyCode) return;
    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('access_keys')
        .select('*')
        .eq('key_code', keyCode)
        .single();

      if (fetchError || !data) {
        setError('Mã kích hoạt không tồn tại hoặc không hợp lệ.');
      } else if (!data.is_active) {
        setError('Mã này đã bị vô hiệu hóa bởi quản trị viên.');
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="panel success-panel">
        <div className="success-icon">✨</div>
        <h2>Xác Minh Thành Công!</h2>
        <p style={{color: '#94a3b8', marginBottom: '2rem'}}>Chào mừng bạn đến với hệ thống FB Auto Reg Pro.</p>
        <button className="btn action-btn" onClick={() => setSuccess(false)}>QUAY LẠI</button>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Kích Hoạt Bản Quyền</h2>
        <p>Vui lòng nhập mã Key bạn đã mua để bắt đầu</p>
      </div>

      <div className="key-form">
        <input 
          type="text" 
          className="key-input"
          placeholder="Dán mã Key tại đây..."
          value={keyCode}
          onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
        />
        
        {error && <p className="error-message" style={{marginBottom: '1rem', color: '#f43f5e'}}>{error}</p>}

        <button 
          className="btn action-btn" 
          onClick={handleVerify}
          disabled={loading || !keyCode}
        >
          {loading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN KÍCH HOẠT'}
        </button>

        <button 
          className="btn secondary-btn" 
          style={{marginTop: '1rem', fontSize: '0.9rem'}}
          onClick={async () => {
            alert('Đang gửi thông báo test về Bot...');
            await fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isTest: true })
            });
          }}
        >
          🔔 KIỂM TRA KẾT NỐI BOT
        </button>
        
        <p style={{marginTop: '2rem', fontSize: '0.85rem', color: '#64748b', textAlign: 'center'}}>
          Bạn chưa có Key? Hãy liên hệ Telegram để mua tự động.
        </p>
      </div>
    </div>
  );
}

export default UserPanel;
