import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard, useSettings } from '@/hooks/useApi'
import { formatCurrency, formatDate, getInstallmentStatusClass, getInstallmentStatusLabel } from '@/lib/utils'
import { PageLoader, ErrorState } from '@/components/ui/States'
import PaymentModal from '@/components/ui/PaymentModal'
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Calendar, Clock, ChevronLeft, ArrowUpRight, Wallet
} from 'lucide-react'

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className={`stat-card border-r-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
          {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color.replace('border-', 'bg-').replace('-500', '-50').replace('-600', '-50')} dark:bg-white/5`}>
          <Icon size={22} className={color.replace('border-', 'text-')} />
        </div>
      </div>
    </div>
  )
}

function InstallmentItem({ installment, onPay, symbol }) {
  const contractType = installment.contracts?.type
  const party = contractType === 'RECEIVABLE'
    ? installment.contracts?.clients?.name
    : installment.contracts?.suppliers?.name
  const isReceivable = contractType === 'RECEIVABLE'

  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-100 dark:border-surface-700 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isReceivable ? 'bg-success-50 dark:bg-success-600/10' : 'bg-danger-50 dark:bg-danger-600/10'}`}>
          {isReceivable
            ? <TrendingUp size={16} className="text-success-600 dark:text-success-400" />
            : <TrendingDown size={16} className="text-danger-600 dark:text-danger-400" />
          }
        </div>
        <div>
          <div className="font-semibold text-heading text-sm">{party || 'غير محدد'}</div>
          <div className="text-xs text-muted">
            {formatDate(installment.due_date)} · قسط #{installment.installment_number}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-bold text-sm">{formatCurrency(installment.remaining_amount, symbol)}</div>
          <span className={getInstallmentStatusClass(installment.status)}>
            {getInstallmentStatusLabel(installment.status)}
          </span>
        </div>
        <button
          onClick={() => onPay(installment)}
          className="btn-primary btn-sm"
        >
          دفع
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useDashboard()
  const { data: settings } = useSettings()
  const [selectedInstallment, setSelectedInstallment] = useState(null)
  const symbol = settings?.currency_symbol || 'ج.م'

  if (isLoading) return <PageLoader />
  
  const handleRetry = () => {
    refetch()
  }

  if (error) return <ErrorState error={error} onRetry={handleRetry} />

  const {
    totalReceivables, totalPayables, netCash,
    todayInstallments, weekInstallments, lateCount, allInstallments
  } = data

  const lateInstallments = allInstallments?.filter(i => i.status === 'late') || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">الرئيسية</h1>
          <p className="text-muted text-sm mt-0.5">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/contracts/new" className="btn-primary">
          <span>+ عقد جديد</span>
        </Link>
      </div>

      {/* Late Alert */}
      {lateCount > 0 && (
        <div className="alert-danger">
          <AlertTriangle size={18} className="flex-shrink-0" />
          <div>
            <span className="font-bold">تنبيه: </span>
            <span>يوجد {lateCount} قسط متأخر يحتاج إلى متابعة عاجلة</span>
          </div>
          <Link to="/receivables" className="mr-auto btn-danger btn-sm">عرض</Link>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المديونيات"
          value={formatCurrency(totalReceivables, symbol)}
          icon={TrendingUp}
          color="border-success-500 text-success-600"
          sub="على العملاء"
        />
        <StatCard
          label="إجمالي المستحقات"
          value={formatCurrency(totalPayables, symbol)}
          icon={TrendingDown}
          color="border-danger-500 text-danger-600"
          sub="للموردين"
        />
        <StatCard
          label="صافي المحفظة"
          value={formatCurrency(netCash, symbol)}
          icon={Wallet}
          color={netCash >= 0 ? "border-primary-500 text-primary-600" : "border-danger-500 text-danger-600"}
          sub="المديونيات ناقص المستحقات"
        />
        <StatCard
          label="أقساط متأخرة"
          value={lateCount}
          icon={AlertTriangle}
          color="border-warning-500 text-warning-600"
          sub="تحتاج متابعة"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Installments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <Clock size={16} className="text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="font-bold text-heading">مستحقات اليوم</h2>
            </div>
            <span className="badge-active">{todayInstallments?.length || 0}</span>
          </div>

          {todayInstallments?.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm">لا توجد مستحقات اليوم</p>
            </div>
          ) : (
            <div>
              {todayInstallments?.map(i => (
                <InstallmentItem
                  key={i.id}
                  installment={i}
                  onPay={setSelectedInstallment}
                  symbol={symbol}
                />
              ))}
            </div>
          )}
        </div>

        {/* This Week */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-warning-50 dark:bg-warning-600/10 flex items-center justify-center">
                <Calendar size={16} className="text-warning-600 dark:text-warning-400" />
              </div>
              <h2 className="font-bold text-heading">مستحقات هذا الأسبوع</h2>
            </div>
            <span className="badge-pending">{weekInstallments?.length || 0}</span>
          </div>

          {weekInstallments?.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-sm">لا توجد مستحقات هذا الأسبوع</p>
            </div>
          ) : (
            <div>
              {weekInstallments?.slice(0, 5).map(i => (
                <InstallmentItem
                  key={i.id}
                  installment={i}
                  onPay={setSelectedInstallment}
                  symbol={symbol}
                />
              ))}
              {weekInstallments?.length > 5 && (
                <p className="text-xs text-center text-muted mt-2">
                  + {weekInstallments.length - 5} أقساط أخرى
                </p>
              )}
            </div>
          )}
        </div>

        {/* Late Installments */}
        {lateInstallments.length > 0 && (
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-danger-600 dark:text-danger-400" />
                </div>
                <h2 className="font-bold text-heading">الأقساط المتأخرة</h2>
              </div>
              <span className="badge-late">{lateInstallments.length}</span>
            </div>
            <div>
              {lateInstallments.slice(0, 6).map(i => (
                <InstallmentItem
                  key={i.id}
                  installment={i}
                  onPay={setSelectedInstallment}
                  symbol={symbol}
                />
              ))}
              {lateInstallments.length > 6 && (
                <div className="text-center mt-3">
                  <Link to="/receivables" className="btn-ghost btn-sm">
                    عرض الكل ({lateInstallments.length})
                    <ChevronLeft size={14} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/receivables', icon: TrendingUp, label: 'المديونيات', color: 'text-success-600' },
          { to: '/payables', icon: TrendingDown, label: 'المستحقات', color: 'text-danger-600' },
          { to: '/calendar', icon: Calendar, label: 'التقويم', color: 'text-primary-600' },
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className="card-hover p-4 flex flex-col items-center gap-2 text-center"
          >
            <item.icon size={22} className={item.color} />
            <span className="text-sm font-medium text-heading">{item.label}</span>
            <ArrowUpRight size={14} className="text-muted" />
          </Link>
        ))}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        installment={selectedInstallment}
        isOpen={!!selectedInstallment}
        onClose={() => setSelectedInstallment(null)}
        currencySymbol={symbol}
      />
    </div>
  )
}
