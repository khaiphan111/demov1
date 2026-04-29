import { useState } from 'react';
import { supabase } from './supabaseClient';

function UserPanel() {
  const [inputKey, setInputKey] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const checkKey = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!inputKey.trim()) {
      setError('Vui lòng nhập mã Key!');
      return;
    }

    setLoading(true);

    // Truy vấn xem key có trong database không
    const { data, error: fetchError } = await supabase
      .from('access_keys')
      .select('*')
      .eq('key_code', inputKey.trim())
      .single();

    if (fetchError || !data) {
      setError("Key không hợp lệ hoặc không tồn tại!");
      setLoading(false);
      return;
    }

    if (data.is_used) {
      setError("Key này đã được sử dụng!");
      setLoading(false);
      return;
    }

    // Nếu key đúng và chưa dùng, cập nhật trạng thái key thành "đã dùng"
    const { error: updateError } = await supabase
      .from('access_keys')
      .update({ is_used: true })
      .eq('id', data.id);

    if (updateError) {
      setError("Có lỗi xảy ra khi xác thực key!");
    } else {
      setIsLoggedIn(true);
      // Gửi thông báo về Telegram thông qua API
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyCode: data.key_code })
        });
      } catch (err) {
        console.error("Lỗi gửi thông báo:", err);
      }
    }
    setLoading(false);
  };

  if (isLoggedIn) {
    return (
      <div className="panel user-panel success-panel">
        <div className="success-icon">✨</div>
        <h2>Đăng nhập thành công!</h2>
        <p>Chào mừng bạn đến với khu vực nội dung VIP.</p>
        <button className="btn secondary-btn" onClick={() => setIsLoggedIn(false)}>Đăng xuất</button>
      </div>
    );
  }

  return (
    <div className="panel user-panel">
      <div className="panel-header">
        <h2>👤 Khu vực Người dùng</h2>
        <p>Nhập mã kích hoạt của bạn để tiếp tục</p>
      </div>
      
      <form onSubmit={checkKey} className="key-form">
        <input 
          type="text" 
          className="key-input"
          placeholder="VD: KEY-ABCD1234" 
          value={inputKey} 
          onChange={(e) => setInputKey(e.target.value.toUpperCase())} 
        />
        {error && <p className="error-message">{error}</p>}
        <button 
          type="submit" 
          className="btn action-btn"
          disabled={loading}
        >
          {loading ? 'Đang kiểm tra...' : 'Truy cập ngay'}
        </button>
      </form>
    </div>
  );
}

export default UserPanel;
