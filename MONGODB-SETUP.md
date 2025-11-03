# إعداد MongoDB للـ ERP Multi-Entreprises

## المشكلة الحالية
❌ **خطأ المصادقة مع MongoDB Atlas**: `bad auth : Authentication failed`

## الحلول المتاحة

### الحل الأول: إعداد MongoDB Atlas (مستحسن)

1. **تشغيل سكريبت الإعداد**:
   ```bash
   npm run setup-mongo
   ```

2. **أدخل بيانات MongoDB Atlas**:
   - اسم المستخدم
   - كلمة المرور
   - اسم الكلستر
   - Project ID (اختياري)

3. **تأكد من إعدادات MongoDB Atlas**:
   - ✅ **Network Access**: أضف IP الخاص بك أو `0.0.0.0/0` للجميع
   - ✅ **Database Access**: تأكد أن المستخدم له صلاحيات `readWrite`
   - ✅ **Cluster Status**: تأكد أن الكلستر نشط

### الحل الثاني: MongoDB محلي مع Docker

1. **تثبيت Docker Desktop**:
   - تحميل من: https://www.docker.com/products/docker-desktop

2. **تشغيل MongoDB**:
   ```bash
   docker-compose -f docker-compose.mongo.yml up -d
   ```

3. **تحديث ملف البيئة**:
   ```env
   MONGODB_URI=mongodb://erp_user:erp_password@localhost:27017/erp-multi-company
   ```

### الحل الثالث: MongoDB محلي (بدون Docker)

1. **تثبيت MongoDB Community**:
   - تحميل من: https://www.mongodb.com/try/download/community

2. **تشغيل MongoDB**:
   ```bash
   mongod
   ```

3. **تحديث ملف البيئة**:
   ```env
   MONGODB_URI=mongodb://localhost:27017/erp-multi-company
   ```

## اختبار الاتصال

```bash
# اختبار MongoDB Atlas
npm run test-mongo

# اختبار MongoDB المحلي
npm run test-local-mongo

# إصلاح MongoDB Atlas
npm run fix-mongo
```

## إنشاء المستخدم الافتراضي

بعد نجاح الاتصال:

```bash
# إنشاء مستخدم إداري افتراضي
npm run create-admin
```

## استكشاف الأخطاء

### خطأ: `bad auth : Authentication failed`
- ✅ تحقق من اسم المستخدم وكلمة المرور
- ✅ تحقق من صلاحيات المستخدم في MongoDB Atlas
- ✅ تحقق من أن IP مسموح في Network Access

### خطأ: `ECONNREFUSED`
- ✅ تحقق من أن MongoDB يعمل
- ✅ تحقق من المنفذ (27017)
- ✅ تحقق من إعدادات الجدار الناري

### خطأ: `ENOTFOUND`
- ✅ تحقق من اتصال الإنترنت
- ✅ تحقق من صحة URL الاتصال

## الملفات المهمة

- `.env.local` - متغيرات البيئة
- `docker-compose.mongo.yml` - إعداد MongoDB مع Docker
- `scripts/mongo-init.js` - تهيئة قاعدة البيانات
- `scripts/test-mongo.js` - اختبار الاتصال

## الدعم

إذا استمرت المشاكل:
1. تحقق من سجلات MongoDB Atlas
2. جرب الاتصال من MongoDB Compass
3. تأكد من إعدادات الشبكة والأمان

