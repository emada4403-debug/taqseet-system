-- Migration: Add manual pricing and profit calculation columns to contracts
ALTER TABLE contracts
ADD COLUMN purchase_price DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN profit DECIMAL(12, 2) DEFAULT 0;
