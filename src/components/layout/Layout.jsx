import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useDashboard } from '@/hooks/useApi'
import { isSupabaseConfigured, resetLocalDatabase } from '@/lib/supabase'
import {
  LayoutDashboard, Users, Store, FileText, Calendar,
  BarChart3, Settings, LogOut, Menu, X, Moon, Sun,
  TrendingUp, TrendingDown, Bell, Package, Wallet
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'الرئيسية', exact: true },
  { to: '/receivables', icon: TrendingUp, label: 'المديونيات', badge: 'receivables' },
  { to: '/payables', icon: TrendingDown, label: 'المستحقات', badge: 'payables' },
  { to: '/contracts/new', icon: FileText, label: 'عقد جديد' },
  { to: '/calendar', icon: Calendar, label: 'التقويم' },
  { to: '/reports', icon: BarChart3, label: 'التقارير' },
  { to: '/settings', icon: Settings, label: 'الإعدادات' },
]

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    }
    return false
  })

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  return [dark, setDark]
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useDarkMode()
  const { signOut, user } = useAuth()
  const { data: dashboard } = useDashboard()
  const location = useLocation()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const lateCount = dashboard?.lateCount || 0

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      {/* TOP HEADER (mobile) */}
      <header className="lg:hidden sticky top-0 z-30 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 px-4 h-14 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="btn-ghost btn-icon"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">ت</span>
          </div>
          <span className="font-bold text-heading text-sm">نظام التقسيط</span>
        </div>

        <div className="flex items-center gap-2">
          {lateCount > 0 && (
            <div className="relative">
              <Bell size={20} className="text-danger-500" />
              <span className="absolute -top-1 -left-1 w-4 h-4 bg-danger-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                {lateCount > 9 ? '9+' : lateCount}
              </span>
            </div>
          )}
          <button onClick={() => setDark(d => !d)} className="btn-ghost btn-icon">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR OVERLAY (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside
          className={`sidebar transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          } lg:static lg:h-screen`}
        >
          {/* Logo */}
          <div className="p-5 border-b border-surface-100 dark:border-surface-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-base">ت</span>
                </div>
                <div>
                  <div className="font-bold text-heading text-sm leading-tight">نظام التقسيط</div>
                  <div className="text-[11px] text-muted">إدارة أعمالك</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="btn-ghost btn-icon lg:hidden">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Late Alert Banner */}
          {lateCount > 0 && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-danger-50 dark:bg-danger-600/10 border border-danger-200 dark:border-danger-600/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-danger-500 pulse-ring flex-shrink-0" />
                <span className="text-xs font-semibold text-danger-700 dark:text-danger-400">
                  {lateCount} قسط متأخر
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                <item.icon size={18} />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Bottom Controls */}
          <div className="p-3 border-t border-surface-100 dark:border-surface-700 space-y-1">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <span className="text-primary-700 dark:text-primary-400 text-xs font-bold">
                  {user?.email?.[0]?.toUpperCase() || 'م'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-heading truncate">{user?.email}</div>
              </div>
            </div>

            <button
              onClick={() => setDark(d => !d)}
              className="sidebar-link w-full"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
              <span>{dark ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
            </button>

            <button
              onClick={signOut}
              className="sidebar-link w-full text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-600/10 hover:text-danger-700"
            >
              <LogOut size={17} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto">
          {!isSupabaseConfigured && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-300 flex flex-col sm:flex-row items-center justify-center gap-2">
              <span>⚠️ <strong>وضع التجربة المحلي (Local Demo Mode)</strong> - يتم حفظ البيانات في المتصفح فقط.</span>
              <button 
                onClick={resetLocalDatabase} 
                className="px-2 py-0.5 rounded bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors cursor-pointer text-[10px]"
              >
                إعادة تعيين البيانات (Reset)
              </button>
            </div>
          )}
          <div className="max-w-6xl mx-auto p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
