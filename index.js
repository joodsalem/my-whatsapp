const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const port = 3000;

// التعديل السري هنا: ربط مسار الكروم المستخرج مباشرة بالكود لتخطي عناد النسخ
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "rawa_session"
    }),
    puppeteer: {
        headless: true, // يشتغل في الخلفية بصمت
        executablePath: '/opt/render/.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome',
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

// 2. عرض الـ QR Code في التيرمينال
client.on('qr', (qr) => {
    console.log('\n👇 امسح هذا الـ QR Code بجوالك لربط تطبيق رواء (لمرة واحدة فقط):');
    qrcode.generate(qr, { small: true });
});

// 3. رسالة تأكيد عند نجاح الاتصال وتذكر الجلسة
client.on('ready', () => {
    console.log('\n✅✅ [واتساب متصل وجاهز!] السيرفر مستعد الآن للاستخدام مجاناً وبدون باركود مجدداً.');
});

// في حال انقطع الاتصال أو سجلت خروج من الجوال
client.on('disconnected', (reason) => {
    console.log('⚠️ تم تسجيل الخروج من الواتساب، السبب:', reason);
});

// 4. الـ Endpoint الجاهزة لاستقبال الطلبات من الـ C#
app.post('/api/send-whatsapp', async (req, res) => {
    try {
        const { phoneNumber, otpCode } = req.body;

        if (!phoneNumber || !otpCode) {
            return res.status(400).json({ error: 'رقم الجوال ورمز التحقق مطلوبان' });
        }

        // --- منطق أرقام اليمن (967) ---
        let cleanNumber = phoneNumber.replace(/\D/g, ''); 

        if (cleanNumber.startsWith('0')) {
            cleanNumber = '967' + cleanNumber.substring(1);
        } else if (cleanNumber.startsWith('7') && cleanNumber.length === 9) {
            cleanNumber = '967' + cleanNumber;
        }
        // ----------------------------------

        const chatId = cleanNumber + '@c.us';
        const message = `مرحباً بك في تطبيق رواء 💧\n\nرمز التحقق الخاص بك هو: *${otpCode}*\n\nلا تشارك هذا الرمز مع أحد لدواعي الأمان.`;

        // إرسال الرسالة
        await client.sendMessage(chatId, message);
        
        console.log(`🚀 [رواء] تم إرسال الرمز [${otpCode}] إلى الرقم [${cleanNumber}] بنجاح.`);
        res.status(200).json({ success: true, message: 'تم الإرسال بنجاح' });

    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إرسال الرسالة عبر واتساب' });
    }
});

// 5. تشغيل السيرفر
app.listen(port, () => {
    console.log(`🚀 سيرفر الواتساب شغال بصمت على البورت ${port}`);
    console.log('جاري فحص الجلسة السابقة أو تهيئة الباركود الجديد، انتظر ثواني...');
});

client.initialize();
