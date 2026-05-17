import { NavLink } from 'react-router-dom';
import { CalendarDays, Users, Gamepad2, Settings, Menu, X, Crosshair, Trophy } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: CalendarDays, label: '赛程' },
  { to: '/tournaments', icon: Trophy, label: '赛事' },
  { to: '/teams', icon: Users, label: '战队' },
  { to: '/players', icon: Gamepad2, label: '选手' },
  { to: '/admin', icon: Settings, label: '管理' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-sm text-text hover:text-accent transition-colors">
            <Crosshair className="w-5 h-5 text-accent" />
            <span className="hidden sm:inline tracking-wide">CS2 TRACKER</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted hover:text-text hover:bg-border/50'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <button
            className="md:hidden p-2 text-muted hover:text-text"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {sidebarOpen && (
          <nav className="md:hidden bg-surface border-t border-border px-2 pb-3">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted hover:text-text hover:bg-border/50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border py-3 text-center text-muted text-xs">
        <p>CS2 Tracker — 朋友赛事数据追踪平台</p>
      </footer>
    </div>
  );
}
