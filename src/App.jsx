import { useState, useEffect } from 'react';
import AdminPanel from './AdminPanel';
import UserPanel from './UserPanel';
import './index.css';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', onLocationChange);
    return () => window.removeEventListener('popstate', onLocationChange);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>{currentPath === '/admin' ? 'Khu Vực Quản Trị' : 'Hệ Thống Quản Lý Kích Hoạt'}</h1>
        <p>{currentPath === '/admin' ? 'Trang nội bộ dành riêng cho Admin' : 'Bảo mật nội dung của bạn bằng mã truy cập một lần'}</p>
      </header>
      
      <main className="main-content" style={{ display: 'flex', justifyContent: 'center' }}>
        {currentPath === '/admin' ? <AdminPanel /> : <UserPanel />}
      </main>
      
      <footer className="app-footer">
        <p>Powered by React & Supabase</p>
      </footer>
    </div>
  );
}

export default App;
