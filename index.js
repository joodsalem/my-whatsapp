const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// البورت المحلي المعتمد لتطبيقكِ
const port = 10000;

let latestQr = null;
let clientReady = false;

// 🛠️ إعدادات المتصفح فائقة الخفة المتوافقة مع ويندوز وجهازكِ المحلي
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
        '--disable-extensions'
    ]
};

// تشغيل الـ Client بالاعتماد على محرك بوبيتير الافتراضي المرفق مع الـ npm install في جهازكِ
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
    console.log('⚠️ تم توليد باركود جديد (QR Code). افتحي المتصفح لمسحه بجوالكِ!');
    latestQr = qr;
});

client.on('ready', () => {
    console.log('✅ تم اتصال واتساب لابتوبكِ بنجاح! تطبيق رواء جاهز لاستلام الطلبات.');
    clientReady = true;
    latestQr = null;
});

client.on('disconnected', (reason) => {
    console.log('⚠️ تم قطع الاتصال:', reason);
    clientReady = false;
    latestQr = null;
    client.initialize().catch(e => console.log("إعادة تشغيل الاتصال فشلت:", e.message));
});

// الواجهة الرسومية لعرض الباركود محلياً
app.get('/', (req, res) => {
    if (clientReady) {
        return res.send('<h2 style="text-align:center; color:green; font-family:sans-serif; margin-top:50px;">✅ الواتساب متصل بنجاح على جهازكِ! نظام رواء يعمل بكفاءة.</h2>');
    }
    if (latestQr) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h2>👇 امسحي الباركود بجوالكِ لربط واتساب رواء:</h2>
                <br>
                <img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(latestQr)}&size=300x300" style="border: 2px solid #ccc; padding: 10px; border-radius: 10px;">
                <br><br>
                <p style="color:gray;">ملاحظة: افتحي هذه الصفحة من جوال آخر أو خلي لابتوبكِ شغال وامسحيها بسرعة.</p>
            </div>
        `);
    }
    res.send('<h2 style="text-align:center; color:orange; font-family:sans-serif; margin-top:50px;">⏳ السيرفر يعمل، انتظر ثواني معدودة لتوليد الباركود...</h2>');
});

// مسار إرسال الـ OTP المستقر والسريع جداً من جهازكِ
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

        // انتظار بسيط جداً
        await new Promise(resolve => setTimeout(resolve, 500));

        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;

        while (attempts < maxAttempts) {
            try {
                await client.sendMessage(chatId, message);
                console.log(`✅ [رواء] طارت الرسالة من جهازكِ بنجاح في المحاولة رقم ${attempts + 1}!`);
                return res.json({ success: true, message: 'تم الإرسال بنجاح' });
            } catch (sendError) {
                attempts++;
                lastError = sendError;
                console.warn(`⚠️ محاولة إرسال فاشلة (${attempts}/${maxAttempts}): ${sendError.message}`);
                
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        throw lastError;

    } catch (error) {
        console.error(`❌ فشل الإرسال النهائي:`, error.message);
        res.status(200).json({ success: false, error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 سيرفر الواتساب شغال محلياً على البورت ${port}`);
});

client.initialize().catch(err => {
    console.error('Failed to initialize:', err);
});
