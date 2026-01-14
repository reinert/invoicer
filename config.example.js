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
    // Set to 'auto' for MMYY format based on current date
    // Or set a specific value like '0525'
    invoiceNumber: 'auto',

    // Payment Terms (days until due date)
    paymentTerms: 30,

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
        accountNumber: 'XXXXXXXXXXXX'
    }
};
