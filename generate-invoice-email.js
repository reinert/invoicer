#!/usr/bin/env node

/**
 * Generate a JSON payload describing the email to send with an invoice
 * attached — { to, subject, body, attachment } — for a later "send email"
 * step to consume.
 *
 * Usage:
 *   node generate-invoice-email.js [options]
 *
 * By default this generates the invoice PDF itself (same defaults/flags as
 * generate-invoice.js) and derives the subject/body placeholders from it.
 * Pass --pdf to reuse an already-generated PDF instead.
 *
 * Options:
 *   (invoice generation, ignored if --pdf is given)
 *   --title <text>            Line item title
 *   --description <text>      Line item description
 *   --amount <number>         Line item amount
 *   --billing-period <value>  "half" or "full" (default: half)
 *   --period <text>           Override the auto-computed service period line
 *   --invoice-number <text>   Override the auto-generated invoice number
 *   --pdf-output <path>       Where to save the generated PDF
 *
 *   (email fields)
 *   --pdf <path>               Use an existing PDF instead of generating one
 *                               (requires --invoice-number and --due-date)
 *   --to <email>                Recipient (default: config's email.to)
 *   --subject <template>        Subject template (default: '{period} {subjectInitials} Invoice')
 *   --body <template>           Body template (default: the standard invoice email body)
 *   --subject-initials <text>   Value for {subjectInitials} (default: config's email.subjectInitials)
 *   --sender-name <text>        Value for {senderName} (default: config's email.senderName)
 *   --due-date <MM/DD/YYYY>     Value for {dueDate} (default: the invoice's due date)
 *   --output <path>             Where to write the email JSON (default: invoice-email-<number>.json)
 *   --stdout                    Print the JSON to stdout instead of writing a file
 *   -h, --help                  Show this help
 *
 * Placeholders available in --subject/--body templates:
 *   {period} {dueDate} {invoiceNumber} {senderName} {subjectInitials} {to}
 */

const { parseArgs } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { generateInvoice } = require('./generate-invoice');

// config.js declares `const CONFIG = {...}` without exporting it (it's meant
// to be loaded as a <script> in invoice.html), so evaluate it the same way
// and grab the variable it defines.
function loadConfig() {
    const code = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
    const sandbox = {};
    // eslint-disable-next-line no-new-func
    new Function('exports', `${code}\nexports.CONFIG = CONFIG;`)(sandbox);
    return sandbox.CONFIG;
}

const CONFIG = loadConfig();

const DEFAULT_SUBJECT_TEMPLATE = '{period} {subjectInitials} Invoice';
const DEFAULT_BODY_TEMPLATE = `Hi,

Please find attached my invoice for this billing period due to {dueDate}.

Let me know if you need any additional information.

Thank you.

Regards,
{senderName}`;

function printHelpAndExit(code) {
    console.log(`Generate the invoice email JSON ({ to, subject, body, attachment }).

Usage:
  node generate-invoice-email.js [options]

Invoice generation (ignored if --pdf is given):
  --title <text>              Line item title
  --description <text>        Line item description
  --amount <number>           Line item amount
  --billing-period <value>    "half" or "full" (default: half)
  --period <text>             Override the auto-computed service period line
  --invoice-number <text>     Override the auto-generated invoice number
  --pdf-output <path>         Where to save the generated PDF

Email fields:
  --pdf <path>                 Use an existing PDF instead of generating one
                                (requires --invoice-number and --due-date)
  --to <email>                 Recipient (default: config's email.to)
  --subject <template>         default: '{period} {subjectInitials} Invoice'
  --body <template>            default: the standard invoice email body
  --subject-initials <text>    Value for {subjectInitials}
  --sender-name <text>         Value for {senderName}
  --due-date <MM/DD/YYYY>      Value for {dueDate}
  --output <path>              Where to write the JSON (default: invoice-email-<number>.json)
  --stdout                     Print the JSON to stdout instead of writing a file
  -h, --help                   Show this help

Placeholders available in --subject/--body templates:
  {period} {dueDate} {invoiceNumber} {senderName} {subjectInitials} {to}
`);
    process.exit(code);
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
                'pdf-output': { type: 'string' },
                pdf: { type: 'string' },
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' },
                'subject-initials': { type: 'string' },
                'sender-name': { type: 'string' },
                'due-date': { type: 'string' },
                output: { type: 'string' },
                stdout: { type: 'boolean', default: false },
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

    if (values.pdf && (!values['invoice-number'] || !values['due-date'])) {
        console.error('Error: --pdf requires both --invoice-number and --due-date (no invoice is generated to read them from)');
        printHelpAndExit(1);
    }

    return values;
}

function applyTemplate(template, placeholders) {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(placeholders, key)) {
            return placeholders[key];
        }
        console.error(`Warning: unknown placeholder "${match}" left as-is`);
        return match;
    });
}

async function main() {
    const args = parseCliArgs(process.argv.slice(2));

    let pdfPath;
    let invoiceNumber;
    let dueDate;
    let periodLabel;

    if (args.pdf) {
        pdfPath = path.resolve(process.cwd(), args.pdf);
        if (!fs.existsSync(pdfPath)) {
            console.error(`Error: --pdf file not found: ${pdfPath}`);
            process.exit(1);
        }
        invoiceNumber = args['invoice-number'];
        dueDate = args['due-date'];
        // Without a live invoice date we can't derive the billing period reliably;
        // fall back to the current month (only matters if {period} is used in a template).
        const now = new Date();
        periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else {
        const generated = await generateInvoice({
            title: args.title,
            description: args.description,
            amount: args.amount !== undefined ? Number(args.amount) : undefined,
            billingPeriod: args['billing-period'] === 'full' ? 'full-month' : 'half-month',
            period: args.period,
            invoiceNumber: args['invoice-number'],
            output: args['pdf-output']
        });
        pdfPath = generated.pdfPath;
        invoiceNumber = generated.invoiceNumber;
        dueDate = generated.dueDate;
        periodLabel = generated.periodLabel;
    }

    const to = args.to || CONFIG.email.to;
    const placeholders = {
        period: periodLabel,
        dueDate: args['due-date'] || dueDate,
        invoiceNumber,
        senderName: args['sender-name'] || CONFIG.email.senderName,
        subjectInitials: args['subject-initials'] || CONFIG.email.subjectInitials,
        to
    };

    const subject = applyTemplate(args.subject || DEFAULT_SUBJECT_TEMPLATE, placeholders);
    const body = applyTemplate(args.body || DEFAULT_BODY_TEMPLATE, placeholders);

    const payload = { to, subject, body, attachment: pdfPath };
    const json = JSON.stringify(payload, null, 2);

    if (args.stdout) {
        console.log(json);
        return;
    }

    const outputPath = path.resolve(process.cwd(), args.output || `invoice-email-${invoiceNumber}.json`);
    fs.writeFileSync(outputPath, `${json}\n`);
    console.log(`Invoice email JSON written to ${outputPath}`);
}

main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
});
