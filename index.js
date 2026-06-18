const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

let latestQr = null;
let clientReady = false;

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: {
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-resources'
        ],
        timeout: 30000
    }
});

client.on('qr', (qr) => {
    console.log('⚠️ QR Code generated');
    latestQr = qr;
});

client.on('ready', () => {
    console.log('✅ WhatsApp Connected!');
    clientReady = true;
    latestQr = null;
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Disconnected:', reason);
    clientReady = false;
    latestQr = null;
});

app.get('/', (req, res) => {
    if (!clientReady) {
        return res.send('<h2 style="text-align:center; color:red;">❌ WhatsApp Not Connected</h2>');
    }
    res.send('<h2 style="text-align:center; color:green;">✅ WhatsApp Connected!</h2>');
});

app.post('/api/send-whatsapp', async (req, res) => {
    try {
        if (!clientReady) {
            return res.status(503).json({ error: 'WhatsApp not connected yet' });
        }

        const { phoneNumber, otpCode } = req.body;
        if (!phoneNumber || !otpCode) {
            return res.status(400).json({ error: 'Phone and OTP required' });
        }

        let cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '967' + cleanNumber.substring(1);
        } else if (cleanNumber.startsWith('7') && cleanNumber.length === 9) {
            cleanNumber = '967' + cleanNumber;
        }

        const chatId = cleanNumber + '@c.us';
        const message = `مرحباً بك في تطبيق رواء 💧\n\nرمز التحقق: *${otpCode}*`;

        await client.sendMessage(chatId, message);
        console.log(`✅ OTP sent to ${cleanNumber}`);
        res.json({ success: true, message: 'تم الإرسال بنجاح' });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${port}`);
});

client.initialize().catch(err => {
    console.error('Failed to initialize:', err);
    process.exit(1);
});
const puppeteerConfig = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
    ]
};

// إذا كان هناك PUPPETEER_EXECUTABLE_PATH فاستخدمه
if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    puppeteerConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
}

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: puppeteerConfig
});
