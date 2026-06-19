const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 10000;

let latestQr = null;
let clientReady = false;

// 🔍 دالة مطورة ومحسنة للبحث عن الكروم وإجبار السيرفر على مسار مستقر
function findChromeExecutable() {
    const commonPaths = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser'
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            console.log(`🎯 تم العثور على الكروم في المسار النظامي: ${p}`);
            return p;
        }
    }

    // البحث داخل كاش بوبيتير المتوقع في ريلواي
    const cacheDir = '/home/pptruser/.cache/puppeteer';
    if (fs.existsSync(cacheDir)) {
        try {
            const files = fs.readdirSync(cacheDir, { recursive: true });
            for (const file of files) {
                if (file.endsWith('/chrome') || file.endsWith('/google-chrome')) {
                    const fullPath = path.join(cacheDir, file);
                    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                        console.log(`🎯 تم العثور على الكروم داخل الكاش: ${fullPath}`);
                        return fullPath;
                    }
                }
            }
        } catch (e) {
            console.log("Searching cache failed:", e.message);
        }
    }
    
    // الحل الاحتياطي الأضمن لبيئات Docker/Railway إذا لم تنجح الأداة في التحقق الصريح
    console.log("⚠️ سيتم استخدام المسار الافتراضي للينكس المضمون داخل ريلواي");
    return 'google-chrome-stable'; 
}

const chromePath = findChromeExecutable();

// 🛠️ إعدادات متصفح فائقة الخفة ومقاومة للكراش واستنزاف الذاكرة
const puppeteerConfig = {
    headless: "new", 
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',         
        '--no-zygote',            
        '--single-process',
        '--disable-extensions',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    ],
    timeout: 60000
};

// إسناد المسار المستقر المكتشف أو البديل المضمون
if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
}

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: puppeteerConfig,
    authTimeoutMs: 120000, 
    qrMaxRetries: 15       
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
    client.initialize().catch(e => console.log("Re-init failed:", e.message));
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
            </div>
        `);
    }
    res.send('<h2 style="text-align:center; color:orange; font-family:sans-serif;">⏳ السيرفر يشتغل، انتظر ثواني لتوليد الباركود...</h2>');
});

// مسار إرسال الـ OTP المستقر والخفيف جداً
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        if (!clientReady) return res.status(503).json({ error: 'WhatsApp not connected yet' });

        const { phoneNumber, otpCode } = req.body;
        if (!phoneNumber || !otpCode) return res.status(400).json({ error: 'Phone and OTP required' });

        let cleanNumber = phoneNumber.replace(/\D/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '967' + cleanNumber.substring(1);
        } else if (cleanNumber.startsWith('7') && cleanNumber.length === 9) {
            cleanNumber = '967' + cleanNumber;
        }

        const chatId = cleanNumber + '@c.us';
        const message = `مرحباً بك في تطبيق رواء 💧\n\nرمز التحقق: *${otpCode}*`;

        console.log(`📡 جاري إرسال الرسالة مباشرة إلى: ${chatId} بالرمز: ${otpCode}`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            try {
                await client.sendMessage(chatId, message);
                console.log(`✅ [رواء] طارت الرسالة بنجاح في المحاولة رقم ${attempts + 1}!`);
                return res.json({ success: true, message: 'تم الإرسال بنجاح' });
            } catch (sendError) {
                attempts++;
                lastError = sendError;
                console.warn(`⚠️ محاولة إرسال فاشلة (${attempts}/${maxAttempts}): ${sendError.message}`);
                
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
        }

        throw lastError;

    } catch (error) {
        console.error(`❌ فشل الإرسال نهائياً:`, error.message);
        res.status(200).json({ success: false, error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 سيرفر الواتساب شغال على البورت ${port}`);
});

client.initialize().catch(err => {
    console.error('Failed to initialize:', err);
});
