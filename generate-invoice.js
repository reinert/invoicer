#!/usr/bin/env node

/**
 * Generate the invoice PDF from the command line, headlessly driving the
 * same invoice.html + downloadPDF() flow used in the browser.
 *
 * Usage:
 *   node generate-invoice.js [options]
 *
 * Options:
 *   --title <text>            Line item title (default: config's defaultItem.title)
 *   --description <text>      Line item description (default: config's defaultItem.description)
 *   --amount <number>         Line item amount (default: computed from the billing period)
 *   --billing-period <value>  "half" (half-month) or "full" (full month) (default: half)
 *   --period <text>           Override the auto-computed service period line
 *                             (e.g. "From July 16, 2026 through July 31, 2026")
 *   --invoice-number <text>   Override the auto-generated invoice number
 *   --output <path>           Output PDF path (default: invoice-<number>.pdf in the cwd)
 *   -h, --help                Show this help
 *
 * Also usable as a module:
 *   const { generateInvoice } = require('./generate-invoice');
 *   const { pdfPath, invoiceNumber, invoiceDate, dueDate, periodLabel } =
 *       await generateInvoice({ title, description, amount, billingPeriod, period, invoiceNumber, output });
 */

const { parseArgs } = require('node:util');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const puppeteer = require('puppeteer');

const BILLING_PERIOD_MAP = {
    half: 'half-month',
    'half-month': 'half-month',
    full: 'full-month',
    'full-month': 'full-month'
};

function printHelpAndExit(code) {
    console.log(`Generate the invoice PDF from the command line.

Usage:
  node generate-invoice.js [options]

Options:
  --title <text>            Line item title (default: config's defaultItem.title)
  --description <text>      Line item description (default: config's defaultItem.description)
  --amount <number>         Line item amount (default: computed from the billing period)
  --billing-period <value>  "half" (half-month) or "full" (full month) (default: half)
  --period <text>           Override the auto-computed service period line
                            (e.g. "From July 16, 2026 through July 31, 2026")
  --invoice-number <text>   Override the auto-generated invoice number
  --output <path>           Output PDF path (default: invoice-<number>.pdf in the cwd)
  -h, --help                Show this help
`);
    process.exit(code);
}

function normalizeBillingPeriod(value) {
    const billingPeriod = BILLING_PERIOD_MAP[value];
    if (!billingPeriod) {
        throw new Error(`--billing-period must be "half" or "full", got "${value}"`);
    }
    return billingPeriod;
}

function normalizeAmount(value) {
    if (value === undefined) {
        return undefined;
    }
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        throw new Error(`--amount must be a number, got "${value}"`);
    }
    return amount;
}

function parseCliArgs(argv) {
    let values;
    try {
        ({ values } = parseArgs({
            args: argv,
            options: {
                title: { type: 'string' },
                description: { type: 'string' },
                amount: { type: 'string' },
                'billing-period': { type: 'string', default: 'half' },
                period: { type: 'string' },
                'invoice-number': { type: 'string' },
                output: { type: 'string' },
                help: { type: 'boolean', short: 'h', default: false }
            }
        }));
    } catch (err) {
        console.error(`Error: ${err.message}`);
        printHelpAndExit(1);
    }

    if (values.help) {
        printHelpAndExit(0);
    }

    let billingPeriod;
    let amount;
    try {
        billingPeriod = normalizeBillingPeriod(values['billing-period']);
        amount = normalizeAmount(values.amount);
    } catch (err) {
        console.error(`Error: ${err.message}`);
        printHelpAndExit(1);
    }

    return {
        title: values.title,
        description: values.description,
        amount,
        billingPeriod,
        period: values.period,
        invoiceNumber: values['invoice-number'],
        output: values.output
    };
}

async function waitForDownload(downloadDir, timeoutMs = 60000) {
    const start = Date.now();
    let lastSize = -1;
    let stableCount = 0;

    while (Date.now() - start < timeoutMs) {
        const files = fs.readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload'));
        if (files.length > 0) {
            const filePath = path.join(downloadDir, files[0]);
            const { size } = fs.statSync(filePath);
            if (size > 0 && size === lastSize) {
                stableCount += 1;
                if (stableCount >= 2) {
                    return;
                }
            } else {
                stableCount = 0;
            }
            lastSize = size;
        }
        await new Promise((r) => setTimeout(r, 200));
    }

    throw new Error('Timed out waiting for the PDF download to complete');
}

/**
 * Render invoice.html headlessly with the given overrides, download the PDF,
 * and return the resulting file path plus the invoice metadata that ended up
 * on the page (useful for anything downstream, e.g. an email JSON).
 */
async function generateInvoice(opts = {}) {
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicer-pdf-'));
    const browser = await puppeteer.launch({ headless: true });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 1400 });

        const client = await page.createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadDir
        });

        const invoiceHtmlPath = path.join(__dirname, 'invoice.html');
        await page.goto(`file://${invoiceHtmlPath}`, { waitUntil: 'load' });

        await page.evaluate((o) => {
            if (o.billingPeriod) {
                const radio = document.querySelector(
                    `input[name="invoice-period"][value="${o.billingPeriod}"]`
                );
                if (radio && !radio.checked) {
                    radio.checked = true;
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            if (o.invoiceNumber) {
                const el = document.getElementById('invoice-number');
                el.textContent = o.invoiceNumber;
                document.title = `Invoice #${o.invoiceNumber} - ${CONFIG.company.name}`;
            }

            if (o.period) {
                document.querySelectorAll('.service-period-range').forEach((el) => {
                    el.textContent = o.period;
                });
            }

            const firstItem = document.querySelector('[data-item]');
            if (firstItem) {
                if (o.title) {
                    const titleEl = firstItem.querySelector('h3');
                    if (titleEl) titleEl.textContent = o.title;
                }
                if (o.description) {
                    const descEl = firstItem.querySelector('.period-note');
                    if (descEl) descEl.textContent = o.description;
                }
                if (o.amount !== undefined) {
                    const amountEl = firstItem.querySelector('[data-amount]');
                    if (amountEl) amountEl.textContent = formatAmountValue(o.amount);
                }
            }

            calculateTotal();
        }, opts);

        const { invoiceNumber, invoiceDate, dueDate } = await page.evaluate(() => ({
            invoiceNumber: document.getElementById('invoice-number').textContent,
            invoiceDate: document.getElementById('invoice-date').textContent,
            dueDate: document.getElementById('due-date').textContent
        }));

        await page.evaluate(() => downloadPDF());
        await waitForDownload(downloadDir);

        const downloadedFiles = fs.readdirSync(downloadDir);
        if (downloadedFiles.length === 0) {
            throw new Error('No file was downloaded');
        }
        const downloadedPath = path.join(downloadDir, downloadedFiles[0]);

        const pdfPath = path.resolve(
            process.cwd(),
            opts.output || `invoice-${invoiceNumber}.pdf`
        );
        fs.copyFileSync(downloadedPath, pdfPath);

        // invoiceDate is MM/DD/YYYY; the period label is that month's "YYYY-MM".
        const [invoiceMonth, , invoiceYear] = invoiceDate.split('/');
        const periodLabel = `${invoiceYear}-${invoiceMonth}`;

        return { pdfPath, invoiceNumber, invoiceDate, dueDate, periodLabel };
    } finally {
        await browser.close();
        fs.rmSync(downloadDir, { recursive: true, force: true });
    }
}

async function main() {
    const opts = parseCliArgs(process.argv.slice(2));
    const { pdfPath } = await generateInvoice(opts);
    console.log(`Invoice PDF written to ${pdfPath}`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error(err.stack || err.message);
        process.exit(1);
    });
}

module.exports = { generateInvoice };
