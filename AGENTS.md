## 1. FIELD NAMING & DATA INTEGRITY 📌
1. Use only real DB field names from the schema.  
2. No fake/temp/abbrev fields; only actual table fields.  
3. Verify fields via DB schema or DocType JSON before use.  

## 2. CODE ANALYSIS PRINCIPLES 🧭
1. Base answers on actual code analysis only.  
2. Understand architecture before proposing solutions.  
3. Read the real files; no guesses.  

## 3. CORE SYSTEM APPLICATIONS REFERENCE 🏛️
1. Reference `/home/frappe/frappe-bench/apps/frappe` for patterns.  
2. Reference `/home/frappe/frappe-bench/apps/erpnext` for patterns.  
3. Search these apps to learn structure and best practices.  

## 4. DATABASE MODIFICATION PROTOCOL 🔒
1. Never modify DB without explicit permission.  
2. Always ask before DROP/ALTER/INSERT/UPDATE.  

## 4.1. DATABASE FIELD QUERY PROTOCOL ✅
1. Use: `bench --site all mariadb -e "DESCRIBE \`tabTableName\`;\"` to inspect fields.  
2. Replace `TableName` with actual DocType (e.g., `tabPOS Profile`).  
3. Never assume field names; always verify first.  

### 4.2. RULE COMMAND TROUBLESHOOTING PROTOCOL
1. If a rule command fails, check syntax, bench env, site, DB connection, table exists.  
2. If blocked, explain cause, ask user to run, fallback to DocType JSON only as last resort.  
3. Document any command failure and its cause.  

## 5. DEVELOPMENT WORKFLOW 🧭
1. Manual read/write; avoid bulk modify commands.  
2. Update `plan.md` before changes; document modifications.  
3. Read files fully before editing; use read tools, not broad search.  

## 6. CODE QUALITY STANDARDS 🎛️
1. Review syntax every time before saving.  
2. Keep formatting consistent; follow project style.  
3. Write English comments above sections (not beside code).  

## 7. COMMUNICATION & VERIFICATION ✅
1. Start responses with numbered points.  
2. End every response with ✅.  
3. Include rules summary when user asks "show rules"/"what rules".  
4. Use simple, concise English friendly to Arabic readers.  
5. In responses, list applied rules under heading `Applied rules:` followed by one line per section in this exact format (no numbers):  
   - `📌 FIELD NAMING & DATA INTEGRITY`  
   - `🧭 CODE ANALYSIS PRINCIPLES`  
   - `🏛️ CORE SYSTEM APPLICATIONS REFERENCE`  
   - `🔒 DATABASE MODIFICATION PROTOCOL`  
   - `🧭 DEVELOPMENT WORKFLOW`  
   - `🎛️ CODE QUALITY STANDARDS`  
   - `✅ COMMUNICATION & VERIFICATION`  
