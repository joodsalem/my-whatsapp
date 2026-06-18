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

// 🔍 دالة ذكية للبحث عن المتصفح داخل بيئة الـ Docker لمنع أخطاء المسارات
function findChromeExecutable() {
    // المسارات الشائعة في حاويات قوقل و Puppeteer
    const commonPaths = [
        '/usr/bin/chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/home/pptruser/.cache/puppeteer'
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p) && fs.lstatSync(p).isFile()) {
            console.log(`🎯 تم العثور على الكروم في: ${p}`);
            return p;
        }
    }
    
    // إذا لم يجد في المسارات المباشرة، يبحث داخل الكاش الخاص بـ Puppeteer
    const cacheDir = '/home/pptruser/.cache/puppeteer';
    if (fs.existsSync(cacheDir)) {
        try {
            const files = fs.readdirSync(cacheDir, { recursive: true });
            for (const file of files) {
                if (file.endsWith('/chrome') || file.endsWith('/google-chrome')) {
                    const fullPath = path.join(cacheDir, file);
                    if (fs.statSync(fullPath).isFile()) {
                        console.log(`🎯 تم العثور على الكروم داخل الكاش: ${fullPath}`);
                        return fullPath;
                    }
                }
            }
        } catch (e) {
            console.log("Searching cache failed:", e.message);
        }
    }
    
    console.log("⚠️ لم يتم العثور على مسار مخصص، سيتم الاعتماد على التعيين التلقائي لـ Puppeteer");
    return null;
}

const chromePath = findChromeExecutable();

// إعدادات الـ Client المخصصة والمستقرة لـ Docker مع تحسين استهلاك الرام
const puppeteerConfig = {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',         // 🌟 تسريع تشغيل المتصفح الأولي
        '--no-zygote',            // 🌟 توفير الرام داخل بيئة السيرفر الضعيفة
        '--single-process',       // 🌟 منع الكروم من فتح عمليات متعددة تستهلك السيرفر
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    ],
    timeout: 0 // 🎯 إلغاء مهلة المتصفح لتجنب الانهيار المفاجئ أثناء محاولة نقل البيانات للجوال
};

// إذا وجدنا المسار الذكي نقوم بتعيينه فوراً
if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
}

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: puppeteerConfig,
    authTimeoutMs: 120000, // 🎯 إعطاء السيرفر مهلة دقيقتين كاملتين لتهيئة الجلسة بدلاً من 45 ثانية
    qrMaxRetries: 10       // 🎯 إتاحة إعادة توليد كود الـ QR لمرات أكثر قبل الاستسلام
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
                <p style="color:gray;">حدثي الصفحة إذا انتهت صلاحية الباركود، وامسحيه بسرعة فور ظهوره</p>
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
