import React, { useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext';
import Dashboard from './pages/Dashboard';
import ProjectDetails from './pages/ProjectDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import ApiKeys from './pages/ApiKeys';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

// ─── Icons ───────────────────────────────────────────────
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  projects: "M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z M8 10h8 M8 14h5",
  keys: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
  menu: "M4 6h16M4 12h16M4 18h16",
  bot: "M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73C10.4 5.39 10 4.74 10 4a2 2 0 0 1 2-2zM5 14v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6",
};

const NAV_ITEMS = [
  { to: '/', label: 'Projects', icon: ICONS.projects, end: true },
  { to: '/keys', label: 'API Keys', icon: ICONS.keys },
];

// ─── Sidebar ─────────────────────────────────────────────
const Sidebar = ({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? '64px' : '240px',
        transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Logo + collapse toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '20px 0' : '20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        minHeight: '64px', flexShrink: 0
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon d={ICONS.bot} size={16} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', whiteSpace: 'nowrap' }}>AI Platform</div>
              <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>Knowledge Base</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon d={ICONS.bot} size={16} />
          </div>
        )}
        {!collapsed && (
          <button onClick={onToggle} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <Icon d={ICONS.chevronLeft} size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
            <Icon d={ICONS.chevronRight} size={16} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
        {!collapsed && <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', letterSpacing: '0.08em', padding: '4px 8px 8px', textTransform: 'uppercase' }}>Navigation</div>}
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '9px 10px',
              borderRadius: 8, marginBottom: 2,
              textDecoration: 'none',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: isActive ? '#818cf8' : '#94a3b8',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'background 0.15s, color 0.15s',
            })}
          >
            <Icon d={item.icon} size={17} />
            {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {!collapsed && (
          <div style={{ padding: '6px 10px', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Signed in as</div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          </div>
        )}
        <button
          onClick={logout}
          title="Logout"
          style={{
            width: '100%', background: 'none', border: 'none', color: '#94a3b8',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            padding: collapsed ? '8px 0' : '8px 10px', borderRadius: 8,
            fontSize: 13, justifyContent: collapsed ? 'center' : 'flex-start',
            transition: 'color 0.15s, background 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <Icon d={ICONS.logout} size={16} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
};

// ─── Top bar ─────────────────────────────────────────────
const Topbar = ({ sidebarCollapsed, onToggleSidebar }: { sidebarCollapsed: boolean; onToggleSidebar: () => void }) => {
  const { user } = useAuth();
  return (
    <header style={{
      height: 56, background: '#fff', borderBottom: '1px solid #e2e8f0',
      display: 'flex', alignItems: 'center', paddingRight: 24,
      position: 'sticky', top: 0, zIndex: 30, flexShrink: 0
    }}>
      <button
        onClick={onToggleSidebar}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
          padding: '0 16px', height: '100%', display: 'flex', alignItems: 'center'
        }}
      >
        <Icon d={ICONS.menu} size={18} />
      </button>
      <div style={{ flex: 1 }} />
      <div style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: 13
      }}>
        {user?.email?.[0]?.toUpperCase() || 'U'}
      </div>
    </header>
  );
};

// ─── Layout ──────────────────────────────────────────────
const Layout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar sidebarCollapsed={collapsed} onToggleSidebar={() => setCollapsed(c => !c)} />
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};

// ─── App ─────────────────────────────────────────────────
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><Layout><ProjectDetails /></Layout></ProtectedRoute>} />
      <Route path="/keys" element={<ProtectedRoute><Layout><ApiKeys /></Layout></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
