import PgBoss from 'pg-boss';
import type { JobPayload, EmailJob, InvoiceEmailJob, ProductScrapingJob } from '@repo/types';

let boss: PgBoss | null = null;

export async function getJobQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'mediavault',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',

      // pg-boss configuration
      schema: 'pgboss',
      max: 5,

      // Job configuration
      retryLimit: 3,
      retryDelay: 60,
      retryBackoff: true,
      expireInHours: 24,
    });

    boss.on('error', (error) => {
      console.error('pg-boss error:', error);
    });

    await boss.start();
    console.log('✅ pg-boss job queue started');
  }

  return boss;
}

export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
    console.log('Job queue stopped');
  }
}

// ============ Job Enqueuers ============

export async function queueEmailJob(job: EmailJob): Promise<string> {
  const queue = await getJobQueue();
  const jobId = await queue.send('send_email', job);
  return jobId!;
}

export async function queueInvoiceEmail(job: InvoiceEmailJob): Promise<string> {
  const queue = await getJobQueue();
  const jobId = await queue.send('send_invoice_email', job);
  return jobId!;
}

export async function queueProductScraping(job: ProductScrapingJob): Promise<string> {
  const queue = await getJobQueue();
  const jobId = await queue.send('scrape_products', job);
  return jobId!;
}

export async function queuePDFGeneration(invoiceId: number): Promise<string> {
  const queue = await getJobQueue();
  const jobId = await queue.send('generate_invoice_pdf', { invoice_id: invoiceId });
  return jobId!;
}

// ============ Job Workers ============

export async function registerJobWorkers(): Promise<void> {
  const queue = await getJobQueue();

  // Email sending worker
  await queue.work('send_email', async (job) => {
    const { data } = job;
    console.log('Sending email to:', data.to);

    // TODO: Implement actual email sending (using nodemailer, AWS SES, etc.)
    // For now, just log it
    console.log('Email:', {
      to: data.to,
      subject: data.subject,
      html: data.html.substring(0, 100) + '...',
    });

    return { sent: true };
  });

  // Invoice email worker (generates PDF first, then sends email)
  await queue.work('send_invoice_email', async (job) => {
    const { data } = job;
    console.log('Sending invoice email for invoice:', data.invoice_id);

    // TODO: Implement PDF generation and email sending
    console.log('Invoice email:', {
      to: data.to,
      invoice_id: data.invoice_id,
    });

    return { sent: true };
  });

  // Product scraping worker
  await queue.work('scrape_products', async (job) => {
    const { data } = job;
    console.log('Scraping products from:', data.supplier);

    // TODO: Implement web scraping logic
    console.log('Scraping:', {
      supplier: data.supplier,
      url: data.url,
      category: data.category,
    });

    return { scraped: 0 };
  });

  // PDF generation worker
  await queue.work('generate_invoice_pdf', async (job) => {
    const { data } = job;
    console.log('Generating PDF for invoice:', data.invoice_id);

    // TODO: Implement PDF generation (using puppeteer, pdfkit, etc.)

    return { pdf_path: `/tmp/invoice-${data.invoice_id}.pdf` };
  });

  console.log('✅ Job workers registered');
}

// ============ Job Monitoring ============

export async function getQueueStats() {
  const queue = await getJobQueue();

  const queueNames = ['send_email', 'send_invoice_email', 'scrape_products', 'generate_invoice_pdf'];
  const stats = [];

  for (const queueName of queueNames) {
    const [active, created, completed, failed] = await Promise.all([
      queue.getQueueSize(queueName, { state: 'active' }),
      queue.getQueueSize(queueName, { state: 'created' }),
      queue.getQueueSize(queueName, { state: 'completed' }),
      queue.getQueueSize(queueName, { state: 'failed' }),
    ]);

    stats.push({
      queue: queueName,
      active,
      created,
      completed,
      failed,
    });
  }

  return stats;
}
