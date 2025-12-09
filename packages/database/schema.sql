-- MediaVault PostgreSQL Database Schema
-- Drop tables if they exist (for clean migrations)
DROP TABLE IF EXISTS estimate_items CASCADE;
DROP TABLE IF EXISTS estimates CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS revenue CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    company VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_email ON clients(email);

-- Settings table (singleton table with one row)
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    business_name VARCHAR(255) NOT NULL,
    business_owner VARCHAR(255) NOT NULL,
    business_email VARCHAR(255) NOT NULL,
    business_phone VARCHAR(50) NOT NULL,
    business_address TEXT NOT NULL,
    business_website VARCHAR(255),
    vat_enabled BOOLEAN DEFAULT false,
    vat_rate DECIMAL(5,2) DEFAULT 20.00,
    markup_percentage DECIMAL(5,2) DEFAULT 30.00,
    currency VARCHAR(3) DEFAULT 'GBP',
    bank_details TEXT,
    paypal_email VARCHAR(255),
    logo_base64 TEXT,
    logo_path VARCHAR(500),
    brand_color VARCHAR(7),
    terms_conditions TEXT,
    payment_instructions TEXT,
    company_tax_id VARCHAR(50),
    company_registration VARCHAR(50),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_settings_singleton CHECK (id = 1)
);

-- Estimates table
CREATE TABLE estimates (
    id SERIAL PRIMARY KEY,
    number VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    validity_date DATE,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'converted')),
    notes TEXT,
    payment_terms TEXT,
    terms_conditions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_estimates_client ON estimates(client_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_date ON estimates(date DESC);

-- Estimate items table
CREATE TABLE estimate_items (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    discount DECIMAL(5,2) DEFAULT 0,
    section VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_estimate_items_estimate ON estimate_items(estimate_id);

-- Invoices table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    number VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    vat_amount DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'sent', 'pending', 'paid', 'overdue')),
    payment_method VARCHAR(50),
    paid_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(date DESC);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- Invoice items table
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Products table (for catalog and web scraping)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(255) NOT NULL,
    supplier VARCHAR(255) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    vat_rate DECIMAL(5,2),
    image_url TEXT,
    supplier_url TEXT,
    feed_source VARCHAR(20) NOT NULL CHECK (feed_source IN ('manual', 'affiliate', 'api')),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_supplier ON products(supplier);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('english', name));

-- Revenue tracking table
CREATE TABLE revenue (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    total DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    profit DECIMAL(10,2) NOT NULL,
    markup_percentage DECIMAL(5,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revenue_date ON revenue(date DESC);
CREATE INDEX idx_revenue_client ON revenue(client_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings row
INSERT INTO settings (
    id,
    business_name,
    business_owner,
    business_email,
    business_phone,
    business_address,
    currency
) VALUES (
    1,
    'Your Business Name',
    'Owner Name',
    'contact@yourbusiness.com',
    '+44 1234 567890',
    '123 Business Street, City, Postcode',
    'GBP'
) ON CONFLICT (id) DO NOTHING;
