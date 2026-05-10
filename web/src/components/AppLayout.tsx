import { NavLink, Outlet } from 'react-router-dom';

const nav = [
  { to: '/', label: 'Practice', icon: '⌘' },
  { to: '/live-voice', label: 'Live voice', icon: '◉' },
  { to: '/writing', label: 'Writing', icon: '✎' },
  { to: '/history', label: 'History', icon: '◷' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export function AppLayout() {
  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">H</div>
          <div>
            <h1>HintTalk</h1>
            <p>English practice · hints</p>
          </div>
        </div>

        <nav className="nav">
          {nav.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        <section className="daily-card">
          <p className="eyebrow">Frontend demo</p>
          <strong>Local-first UI</strong>
          <div className="progress">
            <span />
          </div>
          <small>Voice/WebRTC backend optional later</small>
        </section>
      </aside>

      <section className="main">
        <Outlet />
      </section>
    </main>
  );
}
