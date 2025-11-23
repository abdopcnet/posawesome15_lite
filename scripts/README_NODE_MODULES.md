# Node Modules Management

## نظرة عامة

تم تحسين `node_modules` لتقليل الحجم من 21MB إلى 3.2MB (85% تقليل) عن طريق إزالة dev dependencies غير المطلوبة.

## الحزم المطلوبة فقط

- `vue`: ^3.4.21 (Runtime فقط)
- `mitt`: ^3.0.1 (Event bus)

## الحزم المحذوفة (Dev Dependencies)

- `@vue/*` - Vue compiler (7.6MB) - غير مطلوب في الإنتاج
- `@babel/*` - Babel transpiler (6.0MB) - غير مطلوب في الإنتاج
- `csstype`, `entities`, `magic-string`, `postcss`, `source-map-js`, `nanoid`, `estree-walker`, `picocolors` - أدوات build

## الاستخدام

### نسخ احتياطي
```bash
./scripts/manage_node_modules.sh backup
```

### استعادة النسخة الاحتياطية
```bash
./scripts/manage_node_modules.sh restore
```

### تنظيف dev dependencies
```bash
./scripts/manage_node_modules.sh clean
```

## تثبيت جديد (Production Only)

```bash
npm install --production
```

أو استخدام `.npmrc` الموجود:
```bash
npm install
```

## ملاحظات

- Frappe يقوم بالـ bundling، لذا لا نحتاج dev dependencies
- النسخة المحلية محفوظة في `node_modules.backup`
- عند تثبيت التطبيق، استخدم `restore` بدلاً من `npm install`
