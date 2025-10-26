
docs/tasks/needed_tasks/csv-translation-implementation.md
i want translation simple
so i dont want complexity and api's

example
@https://github.com/abdopcnet/posawesome_dev/blob/main/posawesome/posawesome/page/posapp/posapp.js

i want exact translation logic to be implemented here also
https://github.com/abdopcnet/posawesome15_lite/blob/main/posawesome/posawesome/page/posapp/posapp.js

Use __() for all user-facing text:
Labels (<label>)
Button text (<span>)
Tooltips (:title)



# 🌐 Task: Multi-Language Support Implementation

**💰 Budget**: $30 (Non-negotiable)

**👨‍💻 Developer**: TBD

**💳 Payment**: All payment methods accepted

**🎯 Priority**: 🔥 High

**📊 Status**: ⏳ Pending

**⏰ Delivery Time**: 1 day only (Non-negotiable)

**🔧 Feature**: Multi-Language Support for POS Interface

**📖 Description**:

Implement multi-language support system in POS Awesome using existing `posa_language` field in POS Profile. When loading the application, load texts and buttons in the language specified in the profile. Support languages: English, Arabic, Portuguese, Spanish.

**🛠️ Technical Requirements**:

- Use `posa_language` field in POS Profile (Select type)
- Load translation files (CSV): `en.csv`, `ar.csv`, `es.csv`, `pt.csv`
- Apply translations to all texts and buttons in the interface
- Automatic language switching when changing profile
- Translation system completely independent from frappe

**🎯 Implementation**:

**Frontend**: Read `posa_language` value, load appropriate CSV file, apply translations to interface elements

**Backend**: Add API endpoint to load translation files, check file existence, return translations

**📋 Deliverables**:

- Translation system independent from frappe
- Frontend logic to apply translations
- Backend API to load translations
- Testing documentation

**🎯 Success Criteria**:

- ✅ `posa_language` field controls interface language
- ✅ Translation completely independent from frappe
- ✅ Automatic language switching when changing profile
- ✅ Support for required languages
- ✅ Fast performance in loading translations
- ✅ No application errors

**📁 Files to be Created/Modified**:

1. `posawesome/translations/en.csv` - English translation file
2. `posawesome/translations/ar.csv` - Arabic translation file
3. `posawesome/translations/pt.csv` - Portuguese translation file
4. `posawesome/translations/es.csv` - Spanish translation file
5. `posawesome/posawesome/api/translations.py` - API to load translations
6. Frontend files - Apply translation system in Vue components

**📝 Notes**:

- Reference project: [POS-Awesome-V15](https://github.com/defendicon/POS-Awesome-V15)
- Feature #24: "Supports multiple languages with language selection per POS Profile"
- Must follow application work policy
- Follow existing code standards
- Use same project technologies (Vue.js + Vuetify)
