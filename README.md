# Invoice Generator

A simple, elegant browser-based invoice generator. Create professional invoices, edit them in real-time, and export to PDF — no server required.

![Invoice Generator Preview](https://img.shields.io/badge/status-ready-teal)

## Features

- **Edit Mode** — Click to toggle edit mode and modify any field directly in the invoice
- **Multi-Currency Support** — USD, EUR, GBP, BRL, JPY, CAD, AUD, CHF with proper locale formatting
- **PDF Export** — Download clean, professional PDFs ready to send
- **Auto-Generated Fields** — Invoice numbers and service periods based on current date
- **Multiple Line Items** — Add or remove invoice items as needed
- **Configurable Defaults** — Set your company info, client details, and banking information once
- **Due Date Toggle** — Show or hide due date based on your needs
- **Billing Period** — Switch between half-month and full-month billing cycles
- **CLI Tools** — Generate the PDF, an email JSON, and a Gmail draft/send, all from the command line

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/invoicer.git
   cd invoicer
   ```

2. **Create your configuration file**
   ```bash
   cp config.example.js config.js
   ```

3. **Edit `config.js`** with your company information (see [Configuration](#configuration))

4. **Open `invoice.html`** in your browser

5. **Edit, customize, and download** your invoice as PDF

For the CLI tools (PDF/email generation without opening a browser tab), also run `npm install` — see [CLI Tools](#cli-tools).

## Configuration

Copy `config.example.js` to `config.js` and customize with your information:

```javascript
const CONFIG = {
    // Your company information
    company: {
        name: 'YOUR COMPANY NAME',
        id: 'XX.XXX.XXX/XXXX-XX',           // Tax ID / Registration number
        email: 'your@email.com',
        address: {
            line1: '123 Main Street, Suite 100',
            line2: 'City, State ZIP',
            country: 'Country'
        }
    },

    // Default client (can be edited in the invoice)
    client: {
        name: 'CLIENT NAME',
        address: {
            line1: '456 Client Avenue',
            line2: 'Client City, State ZIP',
            country: 'Country'
        }
    },

    // Default currency: USD, EUR, GBP, BRL, JPY, CAD, AUD, CHF
    currency: 'USD',

    // Invoice number format
    // 'auto' = YYMM based on current date (e.g., '2601' for January 2026)
    // Or set a specific value like '2505-1'
    invoiceNumber: 'auto',

    // Days added to the due date, on top of the last day of the billing
    // cycle. 0 = due on the last day of the billing cycle.
    paymentTerms: 0,

    // Default service item
    defaultItem: {
        title: 'Service Title',
        description: 'Description of the services provided',
        amount: 0.00
    },

    // Service period format
    // 'auto' = current month (e.g., "From January 1, 2026 through January 31, 2026")
    // Or set a specific value like 'Q4 2025'
    servicePeriod: 'auto',

    // Banking information for payments
    banking: {
        legalName: 'YOUR COMPANY NAME',
        email: 'your@email.com',
        address: {
            line1: '123 Bank Street',
            line2: 'City, State ZIP',
            country: 'Country'
        },
        bankName: 'Bank Name',
        accountType: 'Checking',
        routingNumber: 'XXXXXXXXX',
        accountNumber: 'XXXXXXXXXXXX'
    },

    // Defaults for generate-invoice-email.js (all overridable via CLI flags)
    email: {
        to: 'ap@client.com',
        subjectInitials: 'YI',
        senderName: 'Your Name'
    }
};
```

## Usage

### Edit Mode

Click the **Edit Mode** button to enable editing. All highlighted fields become editable:
- Company and client information
- Invoice number and dates
- Item descriptions and amounts
- Banking details

Changes are reflected in real-time.

### Adding/Removing Items

- Click **Add Item** to add a new line item
- Click the **×** button on any item to remove it (at least one item required)

### Billing Period

Choose **Half-month** or **Full month** to switch the billing cycle. This drives the auto-computed invoice number, invoice date, due date, service period, and the default line item amount (half the monthly rate for half-month).

### Currency

Select a currency from the dropdown. All amounts will be reformatted with the appropriate symbol and locale formatting.

### Due Date

Toggle **Include Due Date** to show or hide the due date field. The due date defaults to the last day of the billing cycle, plus the `paymentTerms` setting (in days) if you want extra time beyond that.

### Download PDF

Click **Download PDF** to generate and download a clean, professional invoice. The PDF filename follows the format `invoice-{number}.pdf`.

## CLI Tools

Three scripts drive the same invoice.html headlessly (via Puppeteer), for generating an invoice and emailing it without opening a browser. Run `npm install` once first.

### Generate the PDF

```bash
node generate-invoice.js [options]
```

| Flag | Description |
| --- | --- |
| `--title <text>` | Line item title (default: config's `defaultItem.title`) |
| `--description <text>` | Line item description (default: config's `defaultItem.description`) |
| `--amount <number>` | Line item amount (default: computed from the billing period) |
| `--billing-period <half\|full>` | Billing cycle (default: `half`) |
| `--period <text>` | Override the auto-computed service period line |
| `--invoice-number <text>` | Override the auto-generated invoice number |
| `--output <path>` | Output PDF path (default: `invoice-<number>.pdf`) |

### Generate the email JSON

```bash
node generate-invoice-email.js [invoice flags...] [email flags...]
```

Generates the invoice PDF (same flags as above) and writes a JSON payload — `{ to, subject, body, attachment }` — meant to be handed to `send-invoice-email.js` or any other email tool.

| Flag | Description |
| --- | --- |
| `--pdf <path>` | Reuse an existing PDF instead of generating one (requires `--invoice-number` and `--due-date`) |
| `--to <email>` | Recipient (default: config's `email.to`) |
| `--subject <template>` | default: `'{period} {subjectInitials} Invoice'` |
| `--body <template>` | default: the standard invoice email body |
| `--subject-initials <text>` | Value for `{subjectInitials}` (default: config's `email.subjectInitials`) |
| `--sender-name <text>` | Value for `{senderName}` (default: config's `email.senderName`) |
| `--due-date <MM/DD/YYYY>` | Value for `{dueDate}` (default: the invoice's computed due date) |
| `--output <path>` | Where to write the JSON (default: `invoice-email-<number>.json`) |
| `--stdout` | Print the JSON instead of writing a file |

`--subject`/`--body` templates support these placeholders: `{period} {dueDate} {invoiceNumber} {senderName} {subjectInitials} {to}`.

### Create a Gmail draft, or send it

```bash
node send-invoice-email.js --json invoice-email-2607-2.json          # creates a Gmail draft
node send-invoice-email.js --json invoice-email-2607-2.json --send   # sends it immediately
```

Reads the JSON from `generate-invoice-email.js` and authenticates to Gmail with an **App Password** — no Google Cloud project or OAuth needed:

1. Enable [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification) on the sending account, if not already on
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. `cp .env.example .env` and fill in `GMAIL_USER` and `GMAIL_APP_PASSWORD`

Without `--json`, `--to`/`--subject`/`--body`/`--attachment` can be passed individually instead.

Chain the three together:

```bash
node generate-invoice-email.js --stdout | node send-invoice-email.js --json /dev/stdin
```

## File Structure

```
invoicer/
├── invoice.html                # Main invoice template
├── invoice.css                 # Styles (web + print/PDF)
├── invoice.js                  # Invoice logic and interactions
├── config.js                   # Your personal configuration (gitignored)
├── config.example.js           # Configuration template
├── generate-invoice.js         # CLI: generate the invoice PDF
├── generate-invoice-email.js   # CLI: generate the invoice email JSON
├── send-invoice-email.js       # CLI: create/send the Gmail draft
├── .env                        # Gmail App Password (gitignored)
├── .env.example                # .env template
├── package.json                # CLI dependencies
└── README.md                   # This file
```

## Tips

- **Invoice Date**: Edit the invoice date and other date-dependent fields (due date, service period) will update automatically
- **Amount Formatting**: Enter amounts in any format (1000, 1,000, 1.000,00) — they'll be auto-formatted based on the selected currency
- **Service Period**: Set `servicePeriod: 'auto'` to automatically use the current month, or specify a custom period like `'Q1 2026'` or `'January - March 2026'`

## Privacy

Your `config.js` file contains personal/business information. Make sure to:
- Add `config.js` to your `.gitignore`
- Never commit `config.js` to a public repository
- Only share `config.example.js` as a template

## Dependencies

Browser page:
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) — PDF generation (loaded via CDN)
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) & [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — Typography (Google Fonts)

CLI tools (`npm install`):
- [Puppeteer](https://pptr.dev/) — headlessly drives invoice.html to generate the PDF
- [Nodemailer](https://nodemailer.com/) — sends the email over SMTP
- [ImapFlow](https://imapflow.com/) — creates the Gmail draft via IMAP
- [dotenv](https://github.com/motdotla/dotenv) — loads `.env` for Gmail credentials

## License

MIT
