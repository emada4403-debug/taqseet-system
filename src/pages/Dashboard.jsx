import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard, useSettings } from '@/hooks/useApi'
import { formatCurrency, formatDate, getInstallmentStatusClass, getInstallmentStatusLabel } from '@/lib/utils'
import { PageLoader, ErrorState } from '@/components/ui/States'
import PaymentModal from '@/components/ui/PaymentModal'
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Calendar, Clock, ChevronLeft, ArrowUpRight, Wallet, ArrowUp, ArrowDown, Activity
} from 'lucide-react'

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className={`stat-card border-r-4 ${color} transition-all duration-300 hover:shadow-lg dark:hover:shadow-black/20`}>
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
    <div className="flex items-center justify-between py-3 border-b border-surface-100 dark:border-surface-700 last:border-0 hover:bg-surface-50/50 dark:hover:bg-surface-800/10 px-2 rounded-lg transition-colors">
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

function CollectionProgress({ rate, collected, remaining, symbol }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (rate / 100) * circumference

  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-bold text-heading text-sm flex items-center gap-2">
        <TrendingUp size={16} className="text-success-600" />
        مؤشر تحصيل المديونيات
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6 justify-center py-2">
        {/* SVG Progress Circle */}
        <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="56"
              cy="56"
              r={radius}
              className="text-surface-200 dark:text-surface-700"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
            />
            <circle
              cx="56"
              cy="56"
              r={radius}
              className="text-success-500 dark:text-success-400"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-xl font-black text-heading leading-none">
              {rate.toFixed(0)}%
            </span>
            <span className="text-[9px] text-muted block mt-0.5">مُحصّل</span>
          </div>
        </div>

        {/* Details legend */}
        <div className="space-y-3 flex-1 w-full">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5 text-muted">
              <div className="w-2 h-2 rounded-full bg-success-500" />
              <span>المحصل الفعلي</span>
            </div>
            <span className="font-bold text-heading">{formatCurrency(collected, symbol)}</span>
          </div>
          <div className="flex justify-between items-center text-xs pt-2 border-t border-surface-100 dark:border-surface-700">
            <div className="flex items-center gap-1.5 text-muted">
              <div className="w-2 h-2 rounded-full bg-surface-300 dark:bg-surface-600" />
              <span>المتبقي للتحصيل</span>
            </div>
            <span className="font-bold text-heading">{formatCurrency(remaining, symbol)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecentTransactions({ payments, symbol }) {
  return (
    <div className="card p-5 space-y-4">
      <h3 className="font-bold text-heading text-sm flex items-center gap-2">
        <Activity size={16} className="text-primary-600" />
        العمليات الأخيرة
      </h3>
      {payments.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <p className="text-xs">لا توجد عمليات سداد مسجلة مؤخراً.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(p => {
            const isReceivable = p.contracts?.type === 'RECEIVABLE'
            const partyName = isReceivable
              ? p.contracts?.clients?.name
              : p.contracts?.suppliers?.name

            return (
              <div key={p.id} className="flex items-center justify-between text-xs py-2 border-b border-surface-100 dark:border-surface-700 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                    isReceivable ? 'bg-success-50 text-success-700 dark:bg-success-950/20 dark:text-success-400' : 'bg-danger-50 text-danger-700 dark:bg-danger-950/20 dark:text-danger-400'
                  }`}>
                    {isReceivable ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </div>
                  <div>
                    <div className="font-bold text-heading text-sm leading-none">{partyName || 'غير معروف'}</div>
                    <div className="text-[10px] text-muted mt-1 leading-none">
                      {p.contracts?.item_description} · {formatDate(p.payment_date)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-mono text-xs font-extrabold ${isReceivable ? 'text-success-600' : 'text-danger-600'}`}>
                    {isReceivable ? '+' : '-'}{formatCurrency(p.amount, symbol)}
                  </span>
                  <span className="block text-[9px] text-muted">
                    {{ cash: 'نقدي', transfer: 'تحويل', check: 'شيك', other: 'أخرى' }[p.method] || 'نقدي'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
    todayInstallments, weekInstallments, lateCount, allInstallments,
    recentPayments, totalCollected, collectionRate
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

      {/* Main Grid Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Columns (Visual analysis & Activities) */}
        <div className="lg:col-span-1 space-y-6">
          <CollectionProgress
            rate={collectionRate}
            collected={totalCollected}
            remaining={totalReceivables}
            symbol={symbol}
          />
          <RecentTransactions
            payments={recentPayments}
            symbol={symbol}
          />
        </div>

        {/* Right Columns (Installments lists) */}
        <div className="lg:col-span-2 space-y-6">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
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
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-danger-600 dark:text-danger-400" />
                  </div>
                  <h2 className="font-bold text-heading">الأقساط المتأخرة</h2>
                </div>
                <span className="badge-late">{lateInstallments.length}</span>
              </div>
              <div className="space-y-1">
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
