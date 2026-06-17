import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import Layout from '@/components/layout/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Receivables from '@/pages/Receivables'
import ClientDetail from '@/pages/ClientDetail'
import Payables from '@/pages/Payables'
import SupplierDetail from '@/pages/SupplierDetail'
import NewContract from '@/pages/NewContract'
import CalendarPage from '@/pages/Calendar'
import Reports from '@/pages/Reports'
import SettingsPage from '@/pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
})

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto shadow-lg">
            <span className="text-white text-2xl font-bold">ت</span>
          </div>
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (user) return <Navigate to="/" replace />

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      } />

      <Route path="/receivables" element={
        <ProtectedRoute><Receivables /></ProtectedRoute>
      } />

      <Route path="/receivables/:id" element={
        <ProtectedRoute><ClientDetail /></ProtectedRoute>
      } />

      <Route path="/payables" element={
        <ProtectedRoute><Payables /></ProtectedRoute>
      } />

      <Route path="/payables/:id" element={
        <ProtectedRoute><SupplierDetail /></ProtectedRoute>
      } />

      <Route path="/contracts/new" element={
        <ProtectedRoute><NewContract /></ProtectedRoute>
      } />

      <Route path="/calendar" element={
        <ProtectedRoute><CalendarPage /></ProtectedRoute>
      } />

      <Route path="/reports" element={
        <ProtectedRoute><Reports /></ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
