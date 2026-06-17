import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext({})

const ICONS = {
  success: <CheckCircle size={18} className="text-success-600 dark:text-success-400 flex-shrink-0" />,
  error: <XCircle size={18} className="text-danger-600 dark:text-danger-400 flex-shrink-0" />,
  warning: <AlertCircle size={18} className="text-warning-600 dark:text-warning-400 flex-shrink-0" />,
  info: <Info size={18} className="text-primary-600 dark:text-primary-400 flex-shrink-0" />,
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 6000),
    warning: (msg) => addToast(msg, 'warning'),
    info: (msg) => addToast(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" style={{ zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} className="toast">
            {ICONS[t.type]}
            <span className="flex-1 text-slate-700 dark:text-slate-200">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="btn-ghost btn-icon flex-shrink-0 p-1">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
