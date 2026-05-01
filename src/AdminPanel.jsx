import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jfakdzjxphypjtfwwoqp.supabase.co';
const supabaseKey = 'sb_publishable_CEOW9PCaWqX4DCLE0PoJkg_Y-9pDxbe';
const supabase = createClient(supabaseUrl, supabaseKey);

function AdminPanel() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    setLoading(true);
    const { data } = await supabase.from('access_keys').select('*').order('created_at', { ascending: false });
    if (data) setKeys(data);
    setLoading(false);
  };

  return (
    <div className="panel" style={{maxWidth: '800px'}}>
      <div className="panel-header">
        <span className="admin-badge">Hệ Thống Admin</span>
        <h2>Quản Lý License Key</h2>
        <p>Danh sách toàn bộ Key đang hoạt động trên hệ thống</p>
      </div>

      <div style={{maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem'}}>
        {keys.length > 0 ? (
          <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
            <thead>
              <tr style={{borderBottom: '1px solid var(--card-border)', color: 'var(--text-dim)'}}>
                <th style={{padding: '12px'}}>KEY CODE</th>
                <th style={{padding: '12px'}}>LOẠI</th>
                <th style={{padding: '12px'}}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                  <td style={{padding: '12px', fontFamily: 'monospace'}}>{k.key_code}</td>
                  <td style={{padding: '12px'}}>{k.key_type}</td>
                  <td style={{padding: '12px'}}>
                    <span style={{
                      color: k.is_used ? '#f43f5e' : '#10b981',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {k.is_used ? 'ĐÃ DÙNG' : 'CHƯA DÙNG'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{textAlign: 'center', color: 'var(--text-dim)', padding: '2rem'}}>Đang tải dữ liệu...</p>
        )}
      </div>

      <button className="btn secondary-btn" onClick={fetchKeys} disabled={loading}>
        LÀM MỚI DANH SÁCH
      </button>
    </div>
  );
}

export default AdminPanel;
