#!/usr/bin/env node

/**
 * Turn an invoice email JSON ({ to, subject, body, attachment }) into an
 * actual Gmail draft, or send it, over SMTP/IMAP using a Gmail App Password
 * (see .env.example for how to get one — no Cloud Console/OAuth needed).
 *
 * Usage:
 *   node send-invoice-email.js --json invoice-email-2607-2.json         # creates a Gmail draft
 *   node send-invoice-email.js --json invoice-email-2607-2.json --send  # sends it immediately
 *
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD in .env (see .env.example).
 */

require('dotenv').config({ quiet: true });

const { parseArgs } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { ImapFlow } = require('imapflow');

function printHelpAndExit(code) {
    console.log(`Create a Gmail draft (or send) for an invoice email JSON.

Usage:
  node send-invoice-email.js --json <path> [options]

Options:
  --json <path>       Path to the JSON produced by generate-invoice-email.js
  --to <email>         Override the JSON's "to"
  --subject <text>     Override the JSON's "subject"
  --body <text>        Override the JSON's "body"
  --attachment <path>  Override the JSON's "attachment"
  --send                Actually send the email instead of just creating a draft
  -h, --help            Show this help

Auth: reads GMAIL_USER / GMAIL_APP_PASSWORD from .env (see .env.example).
`);
    process.exit(code);
}

function parseCliArgs(argv) {
    let values;
    try {
        ({ values } = parseArgs({
            args: argv,
            options: {
                json: { type: 'string' },
                to: { type: 'string' },
                subject: { type: 'string' },
                body: { type: 'string' },
                attachment: { type: 'string' },
                send: { type: 'boolean', default: false },
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

    return values;
}

function loadEmailPayload(args) {
    let payload = {};
    if (args.json) {
        const jsonPath = path.resolve(process.cwd(), args.json);
        if (!fs.existsSync(jsonPath)) {
            console.error(`Error: --json file not found: ${jsonPath}`);
            process.exit(1);
        }
        payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }

    const to = args.to || payload.to;
    const subject = args.subject || payload.subject;
    const body = args.body || payload.body;
    const attachment = args.attachment || payload.attachment;

    if (!to || !subject || !body) {
        console.error('Error: "to", "subject" and "body" are required (via --json or individual flags)');
        process.exit(1);
    }
    if (attachment && !fs.existsSync(path.resolve(process.cwd(), attachment))) {
        console.error(`Error: attachment not found: ${attachment}`);
        process.exit(1);
    }

    return { to, subject, body, attachment };
}

function requireCredentials() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
        console.error('Error: GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env (see .env.example)');
        process.exit(1);
    }
    return { user, pass };
}

function buildMailOptions({ user, to, subject, body, attachment }) {
    const mailOptions = {
        from: user,
        to,
        subject,
        text: body
    };
    if (attachment) {
        mailOptions.attachments = [
            { filename: path.basename(attachment), path: path.resolve(process.cwd(), attachment) }
        ];
    }
    return mailOptions;
}

async function composeRawMessage(mailOptions) {
    const composer = new MailComposer(mailOptions);
    return new Promise((resolve, reject) => {
        composer.compile().build((err, message) => {
            if (err) reject(err);
            else resolve(message);
        });
    });
}

async function sendEmail(credentials, mailOptions) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: credentials
    });
    const info = await transporter.sendMail(mailOptions);
    transporter.close();
    return info;
}

async function createDraft(credentials, mailOptions) {
    const rawMessage = await composeRawMessage(mailOptions);

    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: credentials,
        logger: false
    });

    await client.connect();
    try {
        const mailboxes = await client.list();
        const draftsBox = mailboxes.find((m) => m.specialUse === '\\Drafts');
        const draftsPath = draftsBox ? draftsBox.path : '[Gmail]/Drafts';

        const result = await client.append(draftsPath, rawMessage, ['\\Draft']);
        return { mailbox: draftsPath, uid: result.uid };
    } finally {
        await client.logout();
    }
}

async function main() {
    const args = parseCliArgs(process.argv.slice(2));
    const { to, subject, body, attachment } = loadEmailPayload(args);
    const credentials = requireCredentials();
    const mailOptions = buildMailOptions({ user: credentials.user, to, subject, body, attachment });

    if (args.send) {
        const info = await sendEmail(credentials, mailOptions);
        console.log(`Email sent to ${to} (messageId: ${info.messageId})`);
    } else {
        const { mailbox, uid } = await createDraft(credentials, mailOptions);
        console.log(`Draft created in ${mailbox} (uid: ${uid}) — open Gmail to review it.`);
    }
}

main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
});
