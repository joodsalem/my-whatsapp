const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;

// حفظ الباركود في متغير لعرضه كصورة نظيفة
let latestQr = null;

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

// استقبال الباركود وحفظه
client.on('qr', (qr) => {
    console.log('⚠️ تم توليد باركود جديد، يمكنك رؤيته عبر الرابط الآن!');
    latestQr = qr;
});

// تأكيد الاتصال
client.on('ready', () => {
    console.log('\n✅✅ [واتساب متصل وجاهز!]');
    latestQr = null; // نمسح الباركود بعد نجاح الاتصال
});

client.on('disconnected', (reason) => {
    console.log('⚠️ تم تسجيل الخروج من الواتساب، السبب:', reason);
    latestQr = null;
});

// الرابط السحري اللي بيفتح لك الباركود كصورة واضحة في المتصفح أو الجوال
app.get('/', (req, res) => {
    if (latestQr) {
        res.send(`
            <div style="text-align:center; margin-top:50px; font-family:Arial;">
                <h2>👇 امسحي الباركود بجوالك لربط تطبيق رواء:</h2>
                <div style="margin: 20px auto; padding: 20px; background: white; display: inline-block; border: 2px solid #ccc;">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}" />
                </div>
                <p style="color:gray; margin-top:20px;">حدثي الصفحة إذا انتهت صلاحية الباركود أو تأخر في الظهور</p>
            </div>
        `);
    } else if (client.pupBrowser) {
        res.send('<h2 style="text-align:center; margin-top:50px; color:green;">✅ الواتساب متصل وجاهز وشغال 100%!</h2>');
    } else {
        res.send('<h2 style="text-align:center; margin-top:50px; color:orange;">⏳ جاري تجهيز الباركود، انتظر ثواني وحدث الصفحة...</h2>');
    }
});

// الـ Endpoint لإرسال الـ OTP من الـ C#
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
    console.log(`🚀 سيرفر الواتساب شغال على البورت ${port}`);
});

client.initialize();
