import { NavLink } from 'react-router-dom';
import { CalendarDays, Users, Gamepad2, Settings, Menu, X, Crosshair, Trophy } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/', icon: CalendarDays, label: '赛程中心' },
  { to: '/tournaments', icon: Trophy, label: '赛事' },
  { to: '/teams', icon: Users, label: '战队' },
  { to: '/players', icon: Gamepad2, label: '选手' },
  { to: '/admin', icon: Settings, label: '管理员' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-lg text-gray-800 hover:text-primary transition-colors">
            <Crosshair className="w-6 h-6 text-primary" />
            <span className="hidden sm:inline">CS2 Tracker</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-800"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {sidebarOpen && (
          <nav className="md:hidden bg-white border-t border-gray-200 px-2 pb-3">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
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

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-gray-400 text-sm">
        <p>CS2 Tracker — 朋友赛事数据追踪平台</p>
      </footer>
    </div>
  );
}
