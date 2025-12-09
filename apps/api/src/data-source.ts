import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Client } from './entities/Client.js';
import { Estimate } from './entities/Estimate.js';
import { EstimateItem } from './entities/EstimateItem.js';
import { Invoice } from './entities/Invoice.js';
import { InvoiceItem } from './entities/InvoiceItem.js';
import { Product } from './entities/Product.js';
import { Revenue } from './entities/Revenue.js';
import { Settings } from './entities/Settings.js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'mediavault',
  synchronize: false, // Never use true in production!
  logging: process.env.NODE_ENV === 'development',
  entities: [Client, Estimate, EstimateItem, Invoice, InvoiceItem, Product, Revenue, Settings],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
  // Connection pool limits (Issue #13)
  extra: {
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
});
