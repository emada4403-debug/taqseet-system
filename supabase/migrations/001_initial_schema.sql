-- ===================================================
-- نظام إدارة التقسيط - مخطط قاعدة البيانات
-- Installment Credit Management System - DB Schema
-- ===================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===================================================
-- SETTINGS
-- ===================================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT DEFAULT 'نظام التقسيط',
  owner_name TEXT DEFAULT 'صاحب العمل',
  default_due_day INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'EGP',
  currency_symbol TEXT DEFAULT 'ج.م',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- CLIENTS (العملاء)
-- ===================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  national_id TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- SUPPLIERS / CREDITORS (الموردون / الدائنون)
-- ===================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- CONTRACTS (العقود)
-- ===================================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('RECEIVABLE', 'PAYABLE')),
  -- For RECEIVABLE: client_id is set; For PAYABLE: supplier_id is set
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  item_description TEXT NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  down_payment DECIMAL(12, 2) DEFAULT 0,
  installment_count INTEGER NOT NULL,
  installment_amount DECIMAL(12, 2) NOT NULL,
  start_date DATE NOT NULL,
  due_day INTEGER NOT NULL DEFAULT 1, -- Day of month payment is due
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'late', 'suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- INSTALLMENTS (الأقساط)
-- ===================================================
CREATE TABLE IF NOT EXISTS installments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  remaining_amount DECIMAL(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'partial')),
  payment_date DATE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'transfer', 'check', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- PAYMENTS (المدفوعات)
-- ===================================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  installment_id UUID REFERENCES installments(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'transfer', 'check', 'other')),
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================
-- ROW LEVEL SECURITY (RLS)
-- ===================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Settings policies
CREATE POLICY "Users can manage their own settings" ON settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Clients policies
CREATE POLICY "Users can manage their own clients" ON clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Suppliers policies
CREATE POLICY "Users can manage their own suppliers" ON suppliers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Contracts policies
CREATE POLICY "Users can manage their own contracts" ON contracts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Installments policies
CREATE POLICY "Users can manage their own installments" ON installments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can manage their own payments" ON payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===================================================
-- INDEXES
-- ===================================================
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX idx_contracts_user_id ON contracts(user_id);
CREATE INDEX idx_contracts_client_id ON contracts(client_id);
CREATE INDEX idx_contracts_supplier_id ON contracts(supplier_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_installments_contract_id ON installments(contract_id);
CREATE INDEX idx_installments_user_id ON installments(user_id);
CREATE INDEX idx_installments_due_date ON installments(due_date);
CREATE INDEX idx_installments_status ON installments(status);
CREATE INDEX idx_payments_installment_id ON payments(installment_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);

-- ===================================================
-- UPDATED_AT TRIGGER
-- ===================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_installments_updated_at BEFORE UPDATE ON installments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
