# Deployment Steps

## Google Apps Script mein kya karna hai

1. GAS editor open karein: https://script.google.com/home
2. **Index.html** file select karein
3. Poora content delete karein
4. Neeche diye raw GitHub link se copy karke paste karein:
   https://raw.githubusercontent.com/alokkmohan/PM-SHRI-School-activity-monitoring-tool/master/appsscript/Index.html
5. Save karein (Ctrl+S)
6. **Deploy → Manage deployments → Edit (pencil) → New version → Deploy**
7. Naya URL copy karein

## index.html mein URL update karna (GitHub Pages)

`index.html` mein do jagah GAS URL update karna hoga:

- Line 122: `src="https://script.google.com/...` (iframe ke liye)
- Line 136: `href="https://script.google.com/...` (mobile button ke liye)

## Is baar ke changes (jo GAS mein dalne hain)

- PDF files upload ho sakti hain (image ke saath)
- Activity tabs: pehle sirf Activity 1 dikhega
- Activity 1 submit karne ke baad Activity 2 tab auto-open hoga
- "+" button se aage ki activities add ho sakti hain
