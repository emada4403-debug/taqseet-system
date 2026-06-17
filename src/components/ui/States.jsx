import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ size = 24, className = '' }) {
  return (
    <Loader2
      size={size}
      className={`animate-spin text-primary-500 ${className}`}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <LoadingSpinner size={40} />
        <p className="text-muted text-sm">جاري التحميل...</p>
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton h-4 w-1/3 rounded" />
      <div className="skeleton h-8 w-1/2 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center mb-4">
          <Icon size={28} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-heading mb-2">{title}</h3>
      {description && <p className="text-muted text-sm mb-6 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-danger-50 dark:bg-danger-600/10 flex items-center justify-center mb-4">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-heading mb-2">حدث خطأ</h3>
      <p className="text-muted text-sm mb-6">{error?.message || 'تعذر تحميل البيانات'}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary">
          إعادة المحاولة
        </button>
      )}
    </div>
  )
}
