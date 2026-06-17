import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '@/hooks/useApi'
import { useToast } from '@/context/ToastContext'
import { PageLoader } from '@/components/ui/States'
import { Settings, Save, Building2, User, Calendar, DollarSign } from 'lucide-react'

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const toast = useToast()

  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    default_due_day: 1,
    currency: 'EGP',
    currency_symbol: 'ج.م',
  })

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name || '',
        owner_name: settings.owner_name || '',
        default_due_day: settings.default_due_day || 1,
        currency: settings.currency || 'EGP',
        currency_symbol: settings.currency_symbol || 'ج.م',
      })
    }
  }, [settings])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({ id: settings.id, ...form })
      toast.success('تم حفظ الإعدادات بنجاح ✓')
    } catch (err) {
      toast.error(err.message || 'فشل حفظ الإعدادات')
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-heading">الإعدادات</h1>
        <p className="text-muted text-sm">بيانات النظام والتفضيلات</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Info */}
        <div className="card p-5 space-y-4">
          <h2 className="font-bold text-heading flex items-center gap-2">
            <Building2 size={18} className="text-primary-600" />
            بيانات النشاط التجاري
          </h2>

          <div className="form-group">
            <label className="label">اسم النشاط / المحل</label>
            <input
              className="input"
              placeholder="محل أبو يوسف للتقسيط"
              value={form.business_name}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="label">اسم صاحب العمل</label>
            <input
              className="input"
              placeholder="محمد أحمد"
              value={form.owner_name}
              onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
            />
          </div>
        </div>

        {/* Payment Settings */}
        <div className="card p-5 space-y-4">
          <h2 className="font-bold text-heading flex items-center gap-2">
            <Calendar size={18} className="text-primary-600" />
            إعدادات الأقساط
          </h2>

          <div className="form-group">
            <label className="label">يوم الاستحقاق الافتراضي من الشهر</label>
            <input
              type="number"
              className="input"
              min="1"
              max="28"
              value={form.default_due_day}
              onChange={e => setForm(f => ({ ...f, default_due_day: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-muted mt-1">
              سيُستخدم هذا اليوم تلقائياً عند إنشاء عقود جديدة
            </p>
          </div>
        </div>

        {/* Currency Settings */}
        <div className="card p-5 space-y-4">
          <h2 className="font-bold text-heading flex items-center gap-2">
            <DollarSign size={18} className="text-primary-600" />
            إعدادات العملة
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">رمز العملة</label>
              <select
                className="input"
                value={form.currency}
                onChange={e => {
                  const map = { EGP: 'ج.م', USD: '$', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك' }
                  setForm(f => ({ ...f, currency: e.target.value, currency_symbol: map[e.target.value] || 'ج.م' }))
                }}
              >
                <option value="EGP">جنيه مصري (EGP)</option>
                <option value="USD">دولار أمريكي (USD)</option>
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="AED">درهم إماراتي (AED)</option>
                <option value="KWD">دينار كويتي (KWD)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">رمز العرض</label>
              <input
                className="input"
                value={form.currency_symbol}
                onChange={e => setForm(f => ({ ...f, currency_symbol: e.target.value }))}
                placeholder="ج.م"
              />
            </div>
          </div>
        </div>

        {/* App Info */}
        <div className="card p-5 bg-surface-50 dark:bg-surface-800">
          <h3 className="font-bold text-heading mb-3 flex items-center gap-2">
            <Settings size={16} className="text-muted" />
            معلومات التطبيق
          </h3>
          <div className="space-y-2 text-sm text-muted">
            <div className="flex justify-between">
              <span>الإصدار</span>
              <span className="font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>قاعدة البيانات</span>
              <span>Supabase PostgreSQL</span>
            </div>
            <div className="flex justify-between">
              <span>التقنية</span>
              <span>React + Tailwind CSS</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full btn-lg"
          disabled={updateSettings.isPending}
        >
          <Save size={18} />
          {updateSettings.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </form>
    </div>
  )
}
