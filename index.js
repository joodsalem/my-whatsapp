const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 10000;

let latestQr = null;
let clientReady = false;

// 🌟 تعديل إعدادات المتصفح ليوجه مباشرة للكروم المثبت في الـ Docker
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/google-chrome', // 🎯 هنا السحر! تحديد مكان الكروم المضمون
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        timeout: 60000
    }
});

// الأحداث (Events)
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

// الواجهة الرسومية لعرض الباركود
app.get('/', (req, res) => {
    if (clientReady) {
        return res.send('<h2 style="text-align:center; color:green; font-family:sans-serif;">✅ الواتساب متصل بنجاح! تطبيق رواء جاهز.</h2>');
    }
    if (latestQr) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2>👇 امسحي الباركود بجوالك لربط تطبيق رواء:</h2>
                <br>
                <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQr)}&size=300x300" style="border: 2px solid #ccc; padding: 10px; border-radius: 10px;">
                <br><br>
                <p style="color:gray;">حدثي الصفحة إذا انتهت صلاحية الباركود</p>
            </div>
        `);
    }
    res.send('<h2 style="text-align:center; color:orange; font-family:sans-serif;">⏳ السيرفر يشتغل، انتظر ثواني لتوليد الباركود...</h2>');
});

// مسار إرسال الـ OTP
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        if (!clientReady) return res.status(503).json({ error: 'WhatsApp not connected yet' });

        const { phoneNumber, otpCode } = req.body;
        if (!phoneNumber || !otpCode) return res.status(400).json({ error: 'Phone and OTP required' });

        let cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.startsWith('0')) cleanNumber = '967' + cleanNumber.substring(1);
        else if (cleanNumber.startsWith('7') && cleanNumber.length === 9) cleanNumber = '967' + cleanNumber;

        const chatId = cleanNumber + '@c.us';
        const message = `مرحباً بك في تطبيق رواء 💧\n\nرمز التحقق: *${otpCode}*`;

        await client.sendMessage(chatId, message);
        res.json({ success: true, message: 'تم الإرسال بنجاح' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 سيرفر الواتساب شغال على البورت ${port}`);
});

client.initialize().catch(err => {
    console.error('Failed to initialize:', err);
});
