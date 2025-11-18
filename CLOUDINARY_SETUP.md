# إعداد Cloudinary

## الخطوات المطلوبة:

### 1. إنشاء حساب Cloudinary
1. اذهب إلى [cloudinary.com](https://cloudinary.com)
2. سجل حساب مجاني (Free Plan)
3. بعد التسجيل، ستجد في Dashboard:
   - Cloud Name
   - API Key
   - API Secret

### 2. إضافة متغيرات البيئة
أضف المتغيرات التالية إلى ملف `.env.local`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. إعادة تشغيل السيرفر
بعد إضافة المتغيرات، أعد تشغيل سيرفر التطوير:

```bash
npm run dev
```

## الميزات المتاحة:

✅ رفع الصور تلقائياً إلى Cloudinary
✅ تحسين الصور تلقائياً (auto-optimization)
✅ CDN للوصول السريع
✅ حذف الصور من Cloudinary عند الحذف
✅ دعم السحب والإفلات
✅ معاينة الصور قبل الرفع

## المجلدات (Folders):
- `erp-uploads` - المجلد الافتراضي لجميع الصور
- يمكن تخصيص مجلد لكل نوع من الصور عبر prop `folder` في `ImageUploader`

## الخطة المجانية:
- 25 GB/month storage
- 25 GB/month bandwidth
- Unlimited transformations
- Perfect للمشاريع الصغيرة والمتوسطة

