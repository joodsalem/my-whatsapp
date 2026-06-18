FROM ghcr.io/puppeteer/puppeteer:24.1.0

# تعيين مجلد العمل داخل السيرفر
WORKDIR /app

# نسخ ملفات الحزم
COPY package*.json ./

# تثبيت الحزم (النسخة الجاهزة بها الكروم ومكتباته تلقائياً)
RUN npm install

# نسخ باقي ملفات المشروع
COPY . .

# منفذ السيرفر الافتراضي لـ Render
EXPOSE 10000

# أمر تشغيل السيرفر
CMD ["node", "index.js"]
