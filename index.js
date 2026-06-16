const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: {
        headless: true,
        executablePath: '/opt/render/project/src/.puppeteer_cache/chrome/linux-146.0.7680.31/chrome-linux64/chrome',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n👇 امسح هذا الـ QR Code بجوالك لربط تطبيق رواء (لمرة واحدة فقط):');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n✅✅ [واتساب متصل وجاهز!] السيرفر مستعد الآن للاستخدام مجاناً وبدون باركود مجدداً.');
});

client.on('disconnected', (reason) => {
    console.log('⚠️ تم تسجيل الخروج من الواتساب، السبب:', reason);
});

app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { phoneNumber, otpCode } = req.body;
        if (!phoneNumber || !otpCode) {
            return res.status(400).json({ error: 'رقم الجوال ورمز التحقق مطلوبان' });
        }
        let cleanNumber = phoneNumber.replace(/\D/g, ''); 
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '967' + cleanNumber.substring(1);
        } else if (cleanNumber.startsWith('7') && cleanNumber.length === 9) {
            cleanNumber = '967' + cleanNumber;
        }
        const chatId = cleanNumber + '@c.us';
        const message = `مرحباً بك في تطبيق رواء 💧\n\nرمز التحقق الخاص بك هو: *${otpCode}*\n\nلا تشارك هذا الرمز مع أحد لدواعي الأمان.`;
        await client.sendMessage(chatId, message);
        console.log(`🚀 [رواء] تم إرسال الرمز [${otpCode}] إلى الرقم [${cleanNumber}] بنجاح.`);
        res.status(200).json({ success: true, message: 'تم الإرسال بنجاح' });
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرسالة عبر واتساب' });
    }
});

app.listen(port, () => {
    console.log(`🚀 سيرفر الواتساب شغال بصمت على البورت ${port}`);
    console.log('جاري فحص الجلسة السابقة أو تهيئة الباركود الجديد، انتظر ثواني...');
});

client.initialize();
