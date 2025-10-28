#### Frontend Policy

**Memory Management Rules:**

- ✅ Event listeners cleanup in `beforeDestroy`/`onBeforeUnmount`
- ✅ Timer and interval cleanup
- ✅ Event bus cleanup
- ✅ DOM references release

**UI/UX Rules:**

- Vue.js + HTML + CSS only (NO Vuetify)
- NO caching (only temp operations batches)
- NO animations or heavy CSS
- Simple structure only

**CSS Styling Method (MANDATORY):**

- ✅ Use **direct inline styles** in the `style` attribute
- ✅ Format CSS properties on multiple lines (one property per line)
- ✅ Keep CSS organized and readable
- ✅ Use direct CSS values (not JavaScript functions)
- ❌ NO style functions like `getXxxStyle()`
- ❌ NO computed properties that return style objects
- ❌ NO conditional logic in style functions
- ❌ NO complex JavaScript style calculations

**Example - Correct Method:**

```html
<button
  style="
    width: 28px;
    height: 28px;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    background-color: #f8f8f8;
    cursor: pointer;
  "
  @click="doSomething"
>
  Click Me
</button>
```

**Asset Management:**

- ✅ Local CDN only - no external requests
- ✅ Local fonts and Material Design Icons
- ✅ Minimize dependencies, named imports only

**API Call Rules (MANDATORY):**

- Use `api_mapper.js` for all API calls
- 1 API calls to submit invoice
- Clear temp cache after successful API call
