import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff, Lock, Mail, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'

export default function Login() {
  const { signIn } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(form.email, form.password)
    } catch (err) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 40%, #0ea5e9 100%)'
      }}
      dir="rtl"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/3 blur-3xl" />
      </div>

      {/* Floating stat cards (decorative) */}
      <div className="absolute top-16 right-8 hidden lg:block">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-white w-48">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center">
              <TrendingUp size={16} className="text-green-300" />
            </div>
            <span className="text-xs opacity-75">إجمالي المديونيات</span>
          </div>
          <div className="text-xl font-bold">ج.م 42,500</div>
          <div className="text-xs opacity-60 mt-1">3 عقود نشطة</div>
        </div>
      </div>

      <div className="absolute bottom-24 left-8 hidden lg:block">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-white w-48">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-400/20 flex items-center justify-center">
              <TrendingDown size={16} className="text-orange-300" />
            </div>
            <span className="text-xs opacity-75">إجمالي المستحقات</span>
          </div>
          <div className="text-xl font-bold">ج.م 18,000</div>
          <div className="text-xs opacity-60 mt-1">مورد واحد</div>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="relative w-full max-w-md">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-sm border border-white/30 mb-4 shadow-2xl">
            <DollarSign size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">نظام التقسيط</h1>
          <p className="text-white/70 text-sm">إدارة أعمالك التجارية بسهولة</p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-surface-800 rounded-3xl shadow-2xl p-8 border border-white/20">
          <h2 className="text-xl font-bold text-heading mb-6 text-center">تسجيل الدخول</h2>

          {error && (
            <div className="alert-danger mb-4 rounded-xl">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="form-group">
              <label className="label">البريد الإلكتروني</label>
              <div className="relative">
                <input
                  type="email"
                  className="input pr-10"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  autoComplete="email"
                  dir="ltr"
                />
                <Mail size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="label">كلمة المرور</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10 pl-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                  dir="ltr"
                />
                <Lock size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full btn-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                'دخول'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-surface-100 dark:border-surface-700">
            <p className="text-center text-xs text-muted">
              نظام إدارة التقسيط الشخصي — جميع بياناتك آمنة ومشفرة
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center text-white">
          {[
            { emoji: '🔒', label: 'آمن ومشفر' },
            { emoji: '📱', label: 'يعمل على الموبايل' },
            { emoji: '⚡', label: 'سريع وسهل' },
          ].map(f => (
            <div key={f.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-xl mb-1">{f.emoji}</div>
              <div className="text-xs opacity-80">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
