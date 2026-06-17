import { useState } from 'react'
import { useCalendar, useSettings } from '@/hooks/useApi'
import { formatCurrency, getInstallmentStatusClass } from '@/lib/utils'
import { PageLoader } from '@/components/ui/States'
import PaymentModal from '@/components/ui/PaymentModal'
import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'
import { format, getDaysInMonth, startOfMonth, getDay, parseISO, isToday, isSameDay } from 'date-fns'
import { ar } from 'date-fns/locale'

const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

function InstallmentDot({ status }) {
  const colors = {
    paid: 'bg-success-500',
    late: 'bg-danger-500',
    partial: 'bg-warning-500',
    pending: 'bg-primary-400',
  }
  return <div className={`calendar-dot ${colors[status] || 'bg-slate-400'}`} />
}

export default function CalendarPage() {
  const today = new Date()
  const [currentDate, setCurrentDate] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedInstallment, setSelectedInstallment] = useState(null)

  const { data: calendarData, isLoading } = useCalendar(currentDate.year, currentDate.month)
  const { data: settings } = useSettings()
  const symbol = settings?.currency_symbol || 'ج.م'

  const daysInMonth = getDaysInMonth(new Date(currentDate.year, currentDate.month - 1))
  const firstDay = getDay(startOfMonth(new Date(currentDate.year, currentDate.month - 1)))

  const prevMonth = () => {
    setCurrentDate(d => {
      if (d.month === 1) return { year: d.year - 1, month: 12 }
      return { ...d, month: d.month - 1 }
    })
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentDate(d => {
      if (d.month === 12) return { year: d.year + 1, month: 1 }
      return { ...d, month: d.month + 1 }
    })
    setSelectedDate(null)
  }

  const getDateKey = (day) =>
    `${currentDate.year}-${String(currentDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const selectedInstallments = selectedDate ? (calendarData?.[getDateKey(selectedDate)] || []) : []

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-heading">التقويم</h1>
        <p className="text-muted text-sm">جميع مواعيد الأقساط</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {[
          { color: 'bg-primary-400', label: 'معلق' },
          { color: 'bg-success-500', label: 'مدفوع' },
          { color: 'bg-danger-500', label: 'متأخر' },
          { color: 'bg-warning-500', label: 'جزئي' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${item.color}`} />
            <span className="text-muted">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Card */}
      <div className="card overflow-hidden">
        {/* Month Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-100 dark:border-surface-700">
          <button onClick={nextMonth} className="btn-ghost btn-icon">
            <ChevronRight size={18} />
          </button>
          <h2 className="font-bold text-heading text-lg">
            {MONTHS_AR[currentDate.month - 1]} {currentDate.year}
          </h2>
          <button onClick={prevMonth} className="btn-ghost btn-icon">
            <ChevronLeft size={18} />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-surface-100 dark:border-surface-700">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {/* Empty cells for first week */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dateKey = getDateKey(day)
            const dayInstallments = calendarData?.[dateKey] || []
            const isSelected = selectedDate === day
            const isTodayDay = today.getDate() === day &&
              today.getMonth() + 1 === currentDate.month &&
              today.getFullYear() === currentDate.year

            const hasLate = dayInstallments.some(i => i.status === 'late')
            const hasPending = dayInstallments.some(i => i.status === 'pending')
            const hasPaid = dayInstallments.some(i => i.status === 'paid')
            const hasPartial = dayInstallments.some(i => i.status === 'partial')

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={`calendar-day relative transition-all duration-150 ${
                  isTodayDay ? 'today' : ''
                } ${
                  isSelected ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30' : ''
                }`}
              >
                <span className="text-sm font-medium">{day}</span>
                {dayInstallments.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                    {hasLate && <InstallmentDot status="late" />}
                    {hasPending && <InstallmentDot status="pending" />}
                    {hasPartial && <InstallmentDot status="partial" />}
                    {hasPaid && <InstallmentDot status="paid" />}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDate && (
        <div className="card p-5">
          <h3 className="font-bold text-heading mb-4">
            أقساط يوم {selectedDate} {MONTHS_AR[currentDate.month - 1]}
          </h3>

          {selectedInstallments.length === 0 ? (
            <div className="text-center py-6 text-muted">
              <Calendar size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد أقساط في هذا اليوم</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedInstallments.map(inst => {
                const type = inst.contracts?.type
                const party = type === 'RECEIVABLE'
                  ? inst.contracts?.clients?.name
                  : inst.contracts?.suppliers?.name

                return (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                  >
                    <div>
                      <div className="font-semibold text-heading text-sm">{party}</div>
                      <div className="text-xs text-muted">{inst.contracts?.item_description}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {type === 'RECEIVABLE' ? '📥 مديونية' : '📤 مستحقة'}
                        {' · '}قسط #{inst.installment_number}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-sm">{formatCurrency(inst.remaining_amount, symbol)}</div>
                        <span className={getInstallmentStatusClass(inst.status) + ' mt-0.5'}>
                          {inst.status === 'paid' ? 'مدفوع' : inst.status === 'late' ? 'متأخر' : inst.status === 'partial' ? 'جزئي' : 'معلق'}
                        </span>
                      </div>
                      {inst.status !== 'paid' && (
                        <button
                          onClick={() => setSelectedInstallment(inst)}
                          className="btn-primary btn-sm"
                        >
                          دفع
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <PaymentModal
        installment={selectedInstallment}
        isOpen={!!selectedInstallment}
        onClose={() => setSelectedInstallment(null)}
        currencySymbol={symbol}
      />
    </div>
  )
}
