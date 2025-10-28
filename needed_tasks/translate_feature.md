# Translation Feature - POS Awesome

## Budget: 20$~30$

## Objective

**Simple goal**: Make POS language controlled by **POS Profile** only, not User Settings.

Read `posa_language` field from POS Profile and use it to display translations. When a POS Profile has `posa_language = 'ar'`, the POS will open in Arabic. When `posa_language = 'en'`, it will open in English.

## Requirements

### 1. User Interface (POS Profile)

- Add a language selection field to POS Profile
- Field name: `posa_language`
- Field type: Select
- Options:
  - `ar` - Arabic (العربية)
  - `en` - English
- Default value: `ar`
- Place in "POS Settings" section

### 2. Technical Implementation

#### Current System Analysis

- Location: `posawesome/posawesome/page/posapp/posapp.js` (Lines 688-710)
- Current implementation: Hard-coded `const posa_language = 'ar';`
- Translation data: Embedded in same file (~680 lines of translations)
- Vue components use: `__()` function for translations

#### Required Changes

##### A. Read from POS Profile (Instead of Hard-coded Value)

```javascript
// Current (Lines 688-709):
const posa_language = 'ar'; // ❌ Hard-coded

// Required:
// Get language from POS Profile
let posa_language = frappe.get_doc('POS Profile', pos_profile_name).posa_language || 'ar';
```

##### B. Dynamic Language Switching

- Allow changing language without page reload
- Update `window.__messages` when language changes
- Refresh Vue components to show new language

#### Files to Modify

1. **POS Profile Doctype** (`posawesome/posawesome/doctype/pos_profile/`)
   - Add `posa_language` field
   - Migration script to add field to existing profiles

2. **Page File** (`posawesome/posawesome/page/posapp/posapp.js`)
   - Read language from POS Profile instead of hard-coded value
   - Simplify initialization logic
   - Remove duplicate code

3. **JavaScript** (`posawesome/public/js/posapp/posapp.js`)
   - Ensure Vue components can access language
   - Add language change listener if needed

## Constraints

### ❌ NOT ACCEPTED: Complex Code

- No unnecessary functions
- No multiple variables for same purpose
- No redundant checks
- Keep code simple and readable

### ✅ ACCEPTED: Minimal Code

- Single source of truth for language
- Direct reading from POS Profile
- Simple initialization
- Clear comments

## Implementation Plan

### Phase 1: Add Field to POS Profile (2-3 hours)

1. Add `posa_language` field to POS Profile DocType
2. Create migration script
3. Test with existing profiles

### Phase 2: Update posapp.js (4-5 hours)

1. Read language from POS Profile
2. Simplify initialization
3. Remove duplicate code
4. Test with Arabic
5. Test with English

### Phase 3: Dynamic Language Switching (3-4 hours)

1. Add language change listener
2. Update Vue components without reload
3. Test switching between languages

### Phase 4: Testing (5-6 hours)

1. Test all UI elements translate correctly
2. Test buttons and labels
3. Test shift operations
4. Test with multiple POS Profiles
5. Edge cases and error handling

### Phase 5: Documentation (2-3 hours)

1. Update configuration guide
2. Add screenshots
3. Document API changes
4. User guide for language switching

## Current Translation Count

- Arabic translations: ~670 strings
- English translations: 0 (defaults to English)
- Total UI elements to translate: All buttons, labels, and text in POS shift

## Success Criteria

1. ✅ Language field visible in POS Profile
2. ✅ Changing language in profile updates UI immediately
3. ✅ All shift buttons show in selected language
4. ✅ No code complexity beyond necessary
5. ✅ No breaking changes to existing functionality
6. ✅ Works with multiple POS Profiles (different languages)

## Technical Notes

### Translation Flow

```
POS Profile (posa_language='ar')
    ↓
Page Load → Read posa_language
    ↓
Set window.__ = posaTranslate
    ↓
Vue Components use {{ __("Text") }}
    ↓
Display translated text
```

### Key Variables

- **Single variable**: `posa_language` (read from POS Profile)
- **Single function**: `posaTranslate(message)`
- **Single object**: `posaTranslations` (translation data)

## Files Overview

### Modified Files

1. `posawesome/posawesome/doctype/pos_profile/pos_profile.py` - Add field
2. `posawesome/posawesome/page/posapp/posapp.js` - Read from profile
3. `posawesome/posawesome/doctype/pos_profile/pos_profile.json` - Field definition

### No Changes Required

- Vue components (already use `__()`)
- Translation data structure
- Frappe hooks

## Timeline

| Phase                      | Hours     | Status      |
| -------------------------- | --------- | ----------- |
| Phase 1: Add Field         | 2-3       | Pending     |
| Phase 2: Update posapp.js  | 4-5       | Pending     |
| Phase 3: Dynamic Switching | 3-4       | Pending     |
| Phase 4: Testing           | 5-6       | Pending     |
| Phase 5: Documentation     | 2-3       | Pending     |
| **Total**                  | **16-21** | **Pending** |

## Notes

- Budget is 20-30 hours, but estimated work is 16-21 hours
- Extra time allocated for testing and unexpected issues
- Focus on SIMPLE code, avoid over-engineering
- Single source of truth: POS Profile → UI Language
