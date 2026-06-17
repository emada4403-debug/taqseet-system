import { format, isAfter, isBefore, isToday, parseISO, differenceInDays } from 'date-fns'
import { ar } from 'date-fns/locale'

// ===================================================
// DATE UTILITIES
// ===================================================
export const formatDate = (date) => {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy')
}

export const formatDateAr = (date) => {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMMM yyyy', { locale: ar })
}

export const formatDateShort = (date) => {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM', { locale: ar })
}

export const isLate = (dueDate) => {
  if (!dueDate) return false
  const d = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return isBefore(d, today)
}

export const isDueToday = (dueDate) => {
  if (!dueDate) return false
  const d = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate
  return isToday(d)
}

export const isDueSoon = (dueDate, days = 7) => {
  if (!dueDate) return false
  const d = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate
  const today = new Date()
  const future = new Date()
  future.setDate(future.getDate() + days)
  return isAfter(d, today) && isBefore(d, future)
}

export const daysOverdue = (dueDate) => {
  if (!dueDate) return 0
  const d = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, differenceInDays(today, d))
}

export const getAgingBucket = (dueDate) => {
  const days = daysOverdue(dueDate)
  if (days === 0) return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

// ===================================================
// NUMBER UTILITIES
// ===================================================
export const formatCurrency = (amount, symbol = 'ج.م') => {
  if (amount === null || amount === undefined) return `${symbol} 0`
  const num = parseFloat(amount) || 0
  return `${symbol} ${num.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  return parseFloat(num).toLocaleString('ar-EG')
}

// ===================================================
// STATUS UTILITIES
// ===================================================
export const getInstallmentStatusLabel = (status) => {
  const labels = {
    pending: 'معلق',
    paid: 'مدفوع',
    late: 'متأخر',
    partial: 'جزئي',
  }
  return labels[status] || status
}

export const getInstallmentStatusClass = (status) => {
  const classes = {
    pending: 'badge-pending',
    paid: 'badge-paid',
    late: 'badge-late',
    partial: 'badge-partial',
  }
  return classes[status] || 'badge-pending'
}

export const getContractStatusLabel = (status) => {
  const labels = {
    active: 'نشط',
    completed: 'مكتمل',
    late: 'متأخر',
    suspended: 'موقوف',
  }
  return labels[status] || status
}

export const getContractStatusClass = (status) => {
  const classes = {
    active: 'badge-active',
    completed: 'badge-completed',
    late: 'badge-late',
    suspended: 'badge-suspended',
  }
  return classes[status] || 'badge-pending'
}

export const getPaymentMethodLabel = (method) => {
  const labels = {
    cash: 'نقدي',
    transfer: 'تحويل',
    check: 'شيك',
    other: 'أخرى',
  }
  return labels[method] || method
}

// ===================================================
// CONTRACT UTILITIES
// ===================================================
export const generateInstallmentDates = (startDate, count, dueDayOverride = null) => {
  const dates = []
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate

  for (let i = 1; i <= count; i++) {
    const date = new Date(start)
    date.setMonth(date.getMonth() + i)
    if (dueDayOverride) {
      date.setDate(Math.min(dueDayOverride, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
    }
    dates.push(date)
  }

  return dates
}

export const calculateContractBalance = (installments) => {
  if (!installments?.length) return { total: 0, paid: 0, remaining: 0 }

  const total = installments.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0)
  const paid = installments.reduce((sum, i) => {
    if (i.status === 'paid') return sum + parseFloat(i.amount || 0)
    if (i.status === 'partial') return sum + (parseFloat(i.amount || 0) - parseFloat(i.remaining_amount || 0))
    return sum
  }, 0)

  return { total, paid, remaining: total - paid }
}

// ===================================================
// WHATSAPP UTILITIES
// ===================================================
export const generateWhatsAppMessage = ({ clientName, amount, dueDate, businessName, installmentNumber, totalInstallments }) => {
  return encodeURIComponent(
    `السلام عليكم ورحمة الله وبركاته 🌙\n\n` +
    `عزيزي/عزيزتي ${clientName}،\n\n` +
    `نتمنى أن تكونوا بخير 😊\n\n` +
    `نود تذكيركم بموعد سداد القسط رقم (${installmentNumber}/${totalInstallments}):\n` +
    `💰 المبلغ: ${formatCurrency(amount)}\n` +
    `📅 تاريخ الاستحقاق: ${formatDate(dueDate)}\n\n` +
    `برجاء السداد في الموعد المحدد.\n` +
    `شكراً لتعاملكم معنا 🙏\n\n` +
    `${businessName}`
  )
}

// ===================================================
// MISC
// ===================================================
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
