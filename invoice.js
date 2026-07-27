let editMode = false;
let currentCurrency = CONFIG.currency || 'USD';

const currencies = {
    USD: { symbol: 'US$', locale: 'en-US', decimals: 2 },
    EUR: { symbol: '€', locale: 'de-DE', decimals: 2 },
    GBP: { symbol: '£', locale: 'en-GB', decimals: 2 },
    BRL: { symbol: 'R$', locale: 'pt-BR', decimals: 2 },
    JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
    CAD: { symbol: 'C$', locale: 'en-CA', decimals: 2 },
    AUD: { symbol: 'A$', locale: 'en-AU', decimals: 2 },
    CHF: { symbol: 'CHF', locale: 'de-CH', decimals: 2 }
};

function formatDate(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

function formatLongDate(date) {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function setDueDateVisibility(isVisible) {
    const dueDateItem = document.getElementById('due-date-item');
    if (!dueDateItem) {
        return;
    }
    dueDateItem.style.display = isVisible ? '' : 'none';
    const datesGrid = dueDateItem.closest('.dates-grid');
    if (datesGrid) {
        datesGrid.classList.toggle('single-date', !isVisible);
    }
}

/**
 * Invoice date = date when the LAST invoiced service is performed (per contract).
 * Issued 1st–5th: last day of previous month (both half and full month).
 * Full month issued 6th onward: last day of current month.
 * Half-month: 6–20 → 15th of current month; 21–31 → last day of current month.
 * @param {Date} issueDate - Date the invoice is issued (e.g. today)
 * @param {boolean} isFullMonth - If true, use full-month rules
 */
function getInvoiceDateFromIssueDate(issueDate, isFullMonth) {
    const y = issueDate.getFullYear();
    const m = issueDate.getMonth();
    const day = issueDate.getDate();
    if (day >= 1 && day <= 5) {
        return getLastDayOfMonth(new Date(y, m - 1, 1));
    }
    if (isFullMonth) {
        return getLastDayOfMonth(new Date(y, m, 1));
    }
    if (day >= 6 && day <= 20) {
        return new Date(y, m, 15);
    }
    return getLastDayOfMonth(new Date(y, m, 1));
}

/**
 * Invoice number: YYMM (full month) or YYMM-N (half-month).
 * Issued 1st–5th: previous month (full = MMYY, half = MMYY-2).
 * Full month issued 6th onward: current month MMYY.
 * Half-month: -1 for 6th–20th (1st–15th), -2 for 21st–end (16th–last).
 * @param {Date} issueDate - Date the invoice is issued (e.g. today)
 * @param {boolean} isFullMonth - If true, return MMYY only (no -1/-2)
 */
function getInvoiceNumber(issueDate, isFullMonth) {
    const day = issueDate.getDate();
    const month = String(issueDate.getMonth() + 1).padStart(2, '0');
    const year = String(issueDate.getFullYear()).slice(-2);
    if (day >= 1 && day <= 5) {
        const prev = new Date(issueDate.getFullYear(), issueDate.getMonth() - 1, 1);
        const prevMonth = String(prev.getMonth() + 1).padStart(2, '0');
        const prevYear = String(prev.getFullYear()).slice(-2);
        return isFullMonth ? `${prevYear}${prevMonth}` : `${prevYear}${prevMonth}-2`;
    }
    if (isFullMonth) {
        return `${year}${month}`;
    }
    if (day >= 6 && day <= 20) {
        return `${year}${month}-1`;
    }
    return `${year}${month}-2`;
}

/**
 * Service period from invoice date (invoice date = last day of services invoiced).
 * Half-month: if 15th → 1st–15th; else → 16th through invoice date.
 * Full month: 1st through last day of that month.
 * @param {boolean} isFullMonth - If true, period is full month
 */
function getServicePeriodDates(date, isFullMonth) {
    const y = date.getFullYear();
    const m = date.getMonth();
    if (isFullMonth) {
        return {
            startDate: new Date(y, m, 1),
            endDate: getLastDayOfMonth(date)
        };
    }
    const day = date.getDate();
    if (day === 15) {
        return {
            startDate: new Date(y, m, 1),
            endDate: new Date(y, m, 15)
        };
    }
    return {
        startDate: new Date(y, m, 16),
        endDate: new Date(y, m, day)
    };
}

function getServicePeriod(date, isFullMonth) {
    const { startDate, endDate } = getServicePeriodDates(date, isFullMonth);
    return `From ${formatLongDate(startDate)} through ${formatLongDate(endDate)}`;
}

function parseInvoiceDate(value) {
    const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) {
        return null;
    }
    const month = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function getLastDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** True if "Full month" radio is selected, false for "Half-month". */
function getInvoicePeriodMode() {
    const full = document.querySelector('input[name="invoice-period"][value="full-month"]');
    return full ? full.checked : false;
}

/**
 * Default line amount: CONFIG.defaultItem.amount is the monthly amount.
 * Full month → monthly amount; half-month → monthly/2 rounded to 2 decimals (e.g. 0.555 → 0.56).
 */
function getDefaultAmountForPeriod(isFullMonth) {
    const monthly = CONFIG.defaultItem.amount;
    if (isFullMonth) {
        return monthly;
    }
    return Math.round((monthly / 2) * 100) / 100;
}

/**
 * Recompute invoice number, invoice date, due date and service period from today and period mode.
 * Call when period type (half/full) changes or on init.
 */
function refreshPeriodDependentFields() {
    const today = new Date();
    const isFullMonth = getInvoicePeriodMode();
    const invoiceDate = getInvoiceDateFromIssueDate(today, isFullMonth);
    if (CONFIG.invoiceNumber === 'auto') {
        document.getElementById('invoice-number').textContent = getInvoiceNumber(today, isFullMonth);
    }
    updateInvoiceDateDependentFields(invoiceDate, isFullMonth);
    // Update default (first) line item amount to match period
    const firstItem = document.querySelector('[data-item]');
    if (firstItem) {
        const amountEl = firstItem.querySelector('[data-amount]');
        if (amountEl) {
            amountEl.textContent = formatAmountValue(getDefaultAmountForPeriod(isFullMonth));
            calculateTotal();
        }
    }
    const invoiceNumber = document.getElementById('invoice-number').textContent;
    document.title = `Invoice #${invoiceNumber} - ${CONFIG.company.name}`;
}

function updateInvoiceDateDependentFields(invoiceDate, isFullMonth) {
    document.getElementById('invoice-date').textContent = formatDate(invoiceDate);

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + (CONFIG.paymentTerms ?? 0));
    document.getElementById('due-date').textContent = formatDate(dueDate);

    const servicePeriod = CONFIG.servicePeriod === 'auto'
        ? getServicePeriod(invoiceDate, isFullMonth)
        : CONFIG.servicePeriod;
    document.querySelectorAll('.service-period-range').forEach(el => {
        el.textContent = servicePeriod;
    });
}

function parseAmount(text) {
    // Remove currency symbols and parse the number
    // Handles formats like "4,500.00" or "4.500,00" or "4500"
    let cleaned = text.replace(/[^0-9.,]/g, '');
    
    // Detect format based on last separator
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
        // European format: 4.500,00 -> comma is decimal separator
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // US format: 4,500.00 -> dot is decimal separator
        cleaned = cleaned.replace(/,/g, '');
    }
    
    return parseFloat(cleaned) || 0;
}

function formatAndValidateAmount(element) {
    const text = element.textContent.trim();
    
    // Parse the numeric value
    const numericValue = parseAmount(text);
    
    // Format with proper locale separators
    element.textContent = formatAmountValue(numericValue);
    
    // Recalculate total
    calculateTotal();
}

function formatAmountValue(value) {
    const currency = currencies[currentCurrency];
    return value.toLocaleString(currency.locale, { 
        minimumFractionDigits: currency.decimals, 
        maximumFractionDigits: currency.decimals 
    });
}

function getCurrencySymbol() {
    return currencies[currentCurrency].symbol;
}

function changeCurrency(code) {
    currentCurrency = code;
    const symbol = getCurrencySymbol();
    
    // Update all currency symbols
    document.querySelectorAll('.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });
    
    // Update all item amounts with new formatting
    document.querySelectorAll('[data-amount]').forEach(el => {
        const numericValue = parseAmount(el.textContent);
        el.textContent = formatAmountValue(numericValue);
    });
    
    // Update total
    calculateTotal();
}

function calculateTotal() {
    const itemAmounts = document.querySelectorAll('[data-amount]');
    let total = 0;
    
    itemAmounts.forEach(el => {
        total += parseAmount(el.textContent);
    });
    
    document.getElementById('total-amount').textContent = formatAmountValue(total);
}

function initializeDefaults() {
    const today = new Date();
    const isFullMonth = getInvoicePeriodMode();
    const invoiceDate = getInvoiceDateFromIssueDate(today, isFullMonth);

    // Company info
    document.getElementById('company-name').textContent = CONFIG.company.name;
    document.getElementById('company-id').textContent = CONFIG.company.id;
    document.getElementById('company-address-line-1').textContent = CONFIG.company.address.line1;
    document.getElementById('company-address-line-2').textContent = CONFIG.company.address.line2;
    document.getElementById('company-address-country').textContent = CONFIG.company.address.country;
    document.getElementById('company-email').textContent = CONFIG.company.email;

    // Client info
    document.getElementById('bill-to-name').textContent = CONFIG.client.name;
    document.getElementById('bill-to-street').textContent = CONFIG.client.address.line1;
    document.getElementById('bill-to-city').textContent = CONFIG.client.address.line2;
    document.getElementById('bill-to-country').textContent = CONFIG.client.address.country;

    // Invoice number and dates (from today + period type: half-month or full month)
    const invoiceNumber = CONFIG.invoiceNumber === 'auto'
        ? getInvoiceNumber(today, isFullMonth)
        : CONFIG.invoiceNumber;
    document.getElementById('invoice-number').textContent = invoiceNumber;
    updateInvoiceDateDependentFields(invoiceDate, isFullMonth);

    // Banking info
    document.getElementById('bank-legal-name').textContent = CONFIG.banking.legalName;
    document.getElementById('bank-name').textContent = CONFIG.banking.bankName;
    document.getElementById('bank-account-type').textContent = CONFIG.banking.accountType;
    document.getElementById('bank-account-number').textContent = CONFIG.banking.accountNumber;
    document.getElementById('bank-routing-number').textContent = CONFIG.banking.routingNumber;
    document.getElementById('bank-address-full').textContent = `${CONFIG.banking.address.line1}, ${CONFIG.banking.address.line2}`;

    // Default item (amount = monthly or half, depending on period)
    const firstItem = document.querySelector('[data-item]');
    if (firstItem) {
        const titleEl = firstItem.querySelector('h3');
        const descEl = firstItem.querySelector('.item-details .period-note');
        const amountEl = firstItem.querySelector('[data-amount]');
        
        if (titleEl) titleEl.textContent = CONFIG.defaultItem.title;
        if (descEl) descEl.textContent = CONFIG.defaultItem.description;
        if (amountEl) amountEl.textContent = formatAmountValue(getDefaultAmountForPeriod(isFullMonth));
    }

    // Currency selector
    document.getElementById('currency-select').value = currentCurrency;
    
    // Update all currency symbols
    const symbol = getCurrencySymbol();
    document.querySelectorAll('.currency-symbol').forEach(el => {
        el.textContent = symbol;
    });

    // Update page title
    document.title = `Invoice #${invoiceNumber} - ${CONFIG.company.name}`;

    const showDueDateToggle = document.getElementById('show-due-date');
    if (showDueDateToggle) {
        showDueDateToggle.checked = false;
        setDueDateVisibility(false);
    }
}

function toggleEditMode() {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    
    const editables = document.querySelectorAll('.editable');
    editables.forEach(el => {
        el.contentEditable = editMode ? 'true' : 'false';
    });

    const toggleBtn = document.querySelector('.edit-mode-toggle');
    toggleBtn.classList.toggle('active', editMode);
    toggleBtn.querySelector('span').textContent = editMode ? 'Exit Edit Mode' : 'Edit Mode';
}

function downloadPDF() {
    // Temporarily exit edit mode for clean PDF
    const wasEditMode = editMode;
    if (wasEditMode) {
        toggleEditMode();
    }
    
    // Apply PDF export styles (black & white professional look)
    document.body.classList.add('pdf-export');
    
    const invoiceContainer = document.querySelector('.invoice-container');
    const invoiceNumber = document.getElementById('invoice-number').textContent;
    const filename = `invoice-${invoiceNumber}.pdf`;
    
    // Prevent html2canvas from clipping borders (overflow: hidden cuts off edges)
    const originalOverflow = invoiceContainer.style.overflow;
    invoiceContainer.style.overflow = 'visible';
    
    const options = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            letterRendering: true,
            scrollX: 0,
            scrollY: 0
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        },
        pagebreak: { mode: ['css', 'avoid-all'] }
    };
    
    const pageCountEl = document.getElementById('page-count');
    if (pageCountEl) {
        pageCountEl.textContent = '';
    }

    function cleanup() {
        invoiceContainer.style.overflow = originalOverflow;
        document.body.classList.remove('pdf-export');
        if (wasEditMode) {
            toggleEditMode();
        }
        if (pageCountEl) {
            pageCountEl.textContent = '1/1';
        }
    }

    html2pdf().set(options).from(invoiceContainer).toPdf().get('pdf').then(pdf => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
            pdf.setPage(pageIndex);
            pdf.setFont('times', 'normal');
            pdf.setFontSize(9);
            const pageText = `${pageIndex}/${totalPages}`;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            pdf.text(pageText, pageWidth - 14, pageHeight - 8, { align: 'right' });
        }
    }).save().then(cleanup).catch(function() {
        cleanup();
    });
}

function addItem() {
    const itemsList = document.getElementById('items-list');
    const invoiceDateField = document.getElementById('invoice-date');
    const parsedInvoiceDate = invoiceDateField ? parseInvoiceDate(invoiceDateField.textContent) : null;
    const baseDate = parsedInvoiceDate || new Date();
    const isFullMonth = getInvoicePeriodMode();
    const servicePeriod = CONFIG.servicePeriod === 'auto'
        ? getServicePeriod(baseDate, isFullMonth)
        : CONFIG.servicePeriod;
    const defaultAmount = formatAmountValue(getDefaultAmountForPeriod(isFullMonth));
    const symbol = getCurrencySymbol();
    
    const newItem = document.createElement('div');
    newItem.className = 'item-row';
    newItem.setAttribute('data-item', '');
    newItem.innerHTML = `
        <div class="item-details">
            <h3 class="editable" contenteditable="true">New Service</h3>
            <p>
                <span class="editable period-note" contenteditable="true">Service description</span><br>
                <span class="editable service-period-range" contenteditable="true">${servicePeriod}</span>.
            </p>
        </div>
        <div class="item-amount">
            <span class="currency-symbol">${symbol}</span>
            <span class="amount-value editable" contenteditable="true" data-amount>${defaultAmount}</span>
        </div>
        <button class="remove-item-btn" onclick="removeItem(this)" title="Remove item">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
        </button>
    `;
    
    itemsList.appendChild(newItem);
    
    // Add event listeners for the new amount field
    const amountField = newItem.querySelector('[data-amount]');
    attachAmountListeners(amountField);
    
    // Recalculate total
    calculateTotal();
    
    // Focus on the title for immediate editing
    newItem.querySelector('h3').focus();
}

function removeItem(button) {
    const itemRow = button.closest('.item-row');
    const itemsList = document.getElementById('items-list');
    
    // Don't remove if it's the last item
    if (itemsList.querySelectorAll('.item-row').length <= 1) {
        alert('Cannot remove the last item. An invoice must have at least one item.');
        return;
    }
    
    itemRow.remove();
    calculateTotal();
}

function initializeEventListeners() {
    // Recalculate total when any item amount changes
    document.querySelectorAll('[data-amount]').forEach(el => {
        el.addEventListener('input', calculateTotal);
        el.addEventListener('blur', function() {
            formatAndValidateAmount(this);
        });
        el.addEventListener('keydown', handleAmountKeydown);
    });

    // Update title when invoice number changes
    document.getElementById('invoice-number').addEventListener('input', function() {
        document.title = `Invoice #${this.textContent} - ${CONFIG.company.name}`;
    });

    const showDueDateToggle = document.getElementById('show-due-date');
    if (showDueDateToggle) {
        showDueDateToggle.addEventListener('change', function() {
            setDueDateVisibility(this.checked);
        });
    }

    const invoiceDateField = document.getElementById('invoice-date');
    if (invoiceDateField) {
        invoiceDateField.addEventListener('blur', function() {
            const parsedDate = parseInvoiceDate(this.textContent);
            if (parsedDate) {
                updateInvoiceDateDependentFields(parsedDate, getInvoicePeriodMode());
            }
        });
    }

    document.querySelectorAll('input[name="invoice-period"]').forEach(function(radio) {
        radio.addEventListener('change', refreshPeriodDependentFields);
    });
}

function handleAmountKeydown(e) {
    // Allow: backspace, delete, tab, escape, enter, arrows
    if ([8, 9, 27, 13, 46, 37, 38, 39, 40].includes(e.keyCode)) {
        return;
    }
    
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if ((e.ctrlKey || e.metaKey) && [65, 67, 86, 88].includes(e.keyCode)) {
        return;
    }
    
    // Allow: numbers (0-9), period, comma
    const allowedChars = /[0-9.,]/;
    if (!allowedChars.test(e.key)) {
        e.preventDefault();
    }
}

function attachAmountListeners(element) {
    element.addEventListener('input', calculateTotal);
    element.addEventListener('blur', function() {
        formatAndValidateAmount(this);
    });
    element.addEventListener('keydown', handleAmountKeydown);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeDefaults();
    calculateTotal();
    initializeEventListeners();
});
