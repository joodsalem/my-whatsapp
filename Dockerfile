FROM ghcr.io/puppeteer/puppeteer:24.1.0

# تحويل الصلاحيات للمستخدم الخارق لضمان تثبيت الحزم بدون مشاكل
USER root

# تعيين مجلد العمل
WORKDIR /app

# نسخ ملفات الحزم
COPY package*.json ./

# تثبيت الحزم بصلاحيات كاملة وتجنب مشاكل الأذونات
RUN npm install --unsafe-perm

# نسخ باقي ملفات المشروع بالكامل وتغيير ملكيتها للمستخدم الافتراضي
COPY . .
RUN chown -R pptruser:pptruser /app

# الرجوع للمستخدم الآمن الخاص بب puppeteer لتشغيل التطبيق
USER pptruser

# منفذ السيرفر
EXPOSE 10000

# أمر تشغيل السيرفر
CMD ["node", "index.js"]
