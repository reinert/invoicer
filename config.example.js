/**
 * Invoice Configuration Template
 * 
 * Copy this file to config.js and edit with your personal information:
 *   cp config.example.js config.js
 */

const CONFIG = {
    // Company Information
    company: {
        name: 'YOUR COMPANY NAME',
        id: 'XX.XXX.XXX/XXXX-XX',
        email: 'your@email.com',
        address: {
            line1: '123 Main Street, Suite 100',
            line2: 'City, State ZIP',
            country: 'Country'
        }
    },

    // Default Client
    client: {
        name: 'CLIENT NAME',
        address: {
            line1: '456 Client Avenue',
            line2: 'Client City, State ZIP',
            country: 'Country'
        }
    },

    // Default Currency (USD, EUR, GBP, BRL, JPY, CAD, AUD, CHF)
    currency: 'USD',

    // Invoice Number Format
    // Set to 'auto' for YYMM format based on current date
    // Or set a specific value like '2505'
    invoiceNumber: 'auto',

    // Payment Terms (days added to the due date, on top of the last day of
    // the billing cycle). 0 = due on the last day of the billing cycle.
    paymentTerms: 0,

    // Default Service Item
    defaultItem: {
        title: 'Service Title',
        description: 'Description of the services provided',
        amount: 12345678.90
    },

    // Service Period Format
    // Set to 'auto' for previous month (e.g., "December 2025")
    // Or set a specific value like 'Q4 2025'
    servicePeriod: 'auto',

    // Banking Information (Company Account)
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
        accountNumber: 'XXXXXXXXXXXX',
        // Optional reference the payer should include with the transfer
        // (e.g. 'FFC123456'). Leave empty to hide the field on the invoice.
        additionalMessage: ''
    },

    // Defaults for `generate-invoice-email.js` (all overridable via CLI flags)
    email: {
        to: 'ap@client.com',
        subjectInitials: 'YI',
        senderName: 'Your Name'
    }
};
