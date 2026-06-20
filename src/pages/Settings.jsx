import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '@/hooks/useApi'
import { useToast } from '@/context/ToastContext'
import { PageLoader } from '@/components/ui/States'
import { Settings, Save, Building2, User, Calendar, DollarSign, Database, Download, Trash2 } from 'lucide-react'
import { supabase, isSupabaseConfigured, resetLocalDatabase } from '@/lib/supabase'

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

  const handleBackup = async () => {
    try {
      const { data: clients } = await supabase.from('clients').select('*')
      const { data: suppliers } = await supabase.from('suppliers').select('*')
      const { data: contracts } = await supabase.from('contracts').select('*')
      const { data: installments } = await supabase.from('installments').select('*')
      const { data: payments } = await supabase.from('payments').select('*')
      const { data: dbSettings } = await supabase.from('settings').select('*')
      const { data: expenses } = await supabase.from('expenses').select('*')

      const backupData = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        data: {
          clients: clients || [],
          suppliers: suppliers || [],
          contracts: contracts || [],
          installments: installments || [],
          payments: payments || [],
          settings: dbSettings || [],
          expenses: expenses || []
        }
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`
      const downloadAnchor = document.createElement('a')
      downloadAnchor.setAttribute('href', jsonString)
      downloadAnchor.setAttribute('download', `taqseet_backup_${new Date().toISOString().split('T')[0]}.json`)
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()

      toast.success('تم تصدير وتحميل النسخة الاحتياطية بنجاح ✓')
    } catch (err) {
      toast.error('فشل تصدير النسخة الاحتياطية: ' + err.message)
    }
  }

  const handleClear = async () => {
    const isConfirmed = window.confirm(
      '🚨 تحذير هام جداً:\n\nهل أنت متأكد من رغبتك في مسح كافة البيانات بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء وسيتم حذف جميع العقود، العملاء، المدفوعات والموردين.'
    )
    if (!isConfirmed) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('لم يتم العثور على جلسة مستخدم نشطة.')

      if (!isSupabaseConfigured) {
        resetLocalDatabase()
        toast.success('تمت إعادة تعيين قاعدة البيانات التجريبية بنجاح ✓')
        return
      }

      // Sequential deletions to respect constraints
      await supabase.from('payments').delete().eq('user_id', user.id)
      await supabase.from('installments').delete().eq('user_id', user.id)
      await supabase.from('contracts').delete().eq('user_id', user.id)
      await supabase.from('clients').delete().eq('user_id', user.id)
      await supabase.from('suppliers').delete().eq('user_id', user.id)
      await supabase.from('expenses').delete().eq('user_id', user.id)
      await supabase.from('safe_transactions').delete().eq('user_id', user.id)

      toast.success('تم مسح وإعادة تعيين كافة بياناتك بنجاح ✓')
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      toast.error('فشل مسح البيانات: ' + err.message)
    }
  }

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

        {/* Data Management Tools */}
        <div className="card p-5 space-y-4 border-2 border-dashed border-red-300 dark:border-red-900/30">
          <h2 className="font-bold text-heading flex items-center gap-2 text-red-600">
            <Database size={18} />
            إدارة البيانات والنسخ الاحتياطي
          </h2>
          <p className="text-muted text-xs leading-relaxed">
            يمكنك تحميل نسخة احتياطية من كافة البيانات المسجلة بالنظام بصيغة ملف JSON لاستعادتها لاحقاً، أو مسح كافة البيانات لإعادة تهيئة النظام بالكامل.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleBackup}
              className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5"
            >
              <Download size={16} />
              <span>تحميل نسخة احتياطية (Backup)</span>
            </button>
            
            <button
              type="button"
              onClick={handleClear}
              className="btn bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/20 dark:border-red-900/30 dark:text-red-400 flex-1 flex items-center justify-center gap-2 py-2.5"
            >
              <Trash2 size={16} />
              <span>مسح كافة البيانات (Reset)</span>
            </button>
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
