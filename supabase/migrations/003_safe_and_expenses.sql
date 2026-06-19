-- ===================================================
-- نظام التقسيط - حركة الخزينة والمصروفات
-- Phase 2: Safe & Expense Management Schema
-- ===================================================

-- 1. Create expenses table (جدول المصروفات الإدارية)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('rent', 'electricity', 'salaries', 'marketing', 'maintenance', 'other')),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create safe_transactions table (جدول حركة الخزينة)
CREATE TABLE IF NOT EXISTS safe_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')), -- deposit (وارد) / withdrawal (منصرف)
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payment_received', 'supplier_paid', 'expense', 'manual_deposit', 'manual_withdrawal', 'contract_downpayment')),
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for expenses
CREATE POLICY "Users can manage their own expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policies for safe_transactions
CREATE POLICY "Users can manage their own safe_transactions" ON safe_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_safe_transactions_user_id ON safe_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_safe_transactions_date ON safe_transactions(transaction_date);
