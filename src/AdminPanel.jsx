import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function AdminPanel() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch existing keys on load
  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    const { data, error } = await supabase
      .from('access_keys')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setKeys(data);
    }
  };

  const generateKey = async () => {
    setLoading(true);
    const newKeyCode = 'KEY-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    const { data, error } = await supabase
      .from('access_keys')
      .insert([{ key_code: newKeyCode, is_used: false }])
      .select();

    if (error) {
      alert("Lỗi tạo key: " + error.message);
    } else if (data) {
      setKeys([data[0], ...keys]);
    }
    setLoading(false);
  };

  return (
    <div className="panel admin-panel">
      <div className="panel-header">
        <h2>🛠️ Quản trị viên (Admin)</h2>
        <p>Tạo và quản lý các mã truy cập</p>
      </div>
      
      <button 
        className="btn primary-btn" 
        onClick={generateKey}
        disabled={loading}
      >
        {loading ? 'Đang tạo...' : '+ Tạo mã Key mới'}
      </button>
      
      <div className="keys-container">
        <h3>Danh sách Key hiện có:</h3>
        {keys.length === 0 ? (
          <p className="empty-state">Chưa có mã key nào được tạo.</p>
        ) : (
          <ul className="key-list">
            {keys.map(k => (
              <li key={k.id} className={`key-item ${k.is_used ? 'used' : 'active'}`}>
                <span className="key-code">{k.key_code}</span>
                <span className="key-status">
                  {k.is_used ? '🔴 Đã sử dụng' : '🟢 Sẵn sàng'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
