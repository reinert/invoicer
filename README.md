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
    // 'auto' = MMYY based on current date (e.g., '0126' for January 2026)
    // Or set a specific value like '0525-1'
    invoiceNumber: 'auto',

    // Days until due date (from invoice date)
    paymentTerms: 30,

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

### Currency

Select a currency from the dropdown. All amounts will be reformatted with the appropriate symbol and locale formatting.

### Due Date

Toggle **Include Due Date** to show or hide the due date field. The due date is calculated based on the `paymentTerms` setting.

### Download PDF

Click **Download PDF** to generate and download a clean, professional invoice. The PDF filename follows the format `invoice-{number}.pdf`.

## File Structure

```
invoicer/
├── invoice.html      # Main invoice template
├── invoice.css       # Styles (web + print/PDF)
├── invoice.js        # Invoice logic and interactions
├── config.js         # Your personal configuration (gitignored)
├── config.example.js # Configuration template
└── README.md         # This file
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

- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) — PDF generation (loaded via CDN)
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) & [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) — Typography (Google Fonts)

## License

MIT
