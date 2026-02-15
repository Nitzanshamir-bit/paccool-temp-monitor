# מדריך פריסה - PACCOOL Temperature Monitor
# Deployment Guide - PACCOOL Temperature Monitor

## אופציית פריסה מומלצת: Render.com
## Recommended Deployment: Render.com

### למה Render.com?
- ✅ חינם לשימוש בסיסי (Free tier)
- ✅ תמיכה מלאה ב-Node.js
- ✅ SSL/HTTPS אוטומטי
- ✅ קל לתפעול
- ✅ עדכונים אוטומטיים מ-GitHub

---

## שלב 1: הכנת הקוד

### 1.1 צור חשבון GitHub (אם אין לך)
1. לך ל-https://github.com
2. לחץ על "Sign up"
3. צור חשבון חינם

### 1.2 צור repository חדש
1. לחץ על הכפתור הירוק "+ New repository"
2. שם ה-repository: `paccool-temp-monitor`
3. בחר: **Private** (פרטי - חשוב!)
4. **אל** תסמן "Initialize with README"
5. לחץ "Create repository"

### 1.3 העלה את הקוד ל-GitHub

פתח terminal/cmd בתיקיית הפרויקט:
```bash
cd "c:\Users\May\Google Drive\ai projects\demo\paccool-temp-app"
```

הרץ את הפקודות הבאות:
```bash
# Initialize git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - PACCOOL Temperature Monitor"

# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/paccool-temp-monitor.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**שים לב:** תצטרך להזין את פרטי ההתחברות שלך ל-GitHub

---

## שלב 2: פריסה ל-Render.com

### 2.1 צור חשבון Render
1. לך ל-https://render.com
2. לחץ "Get Started"
3. התחבר עם חשבון GitHub שלך (מומלץ)

### 2.2 צור Web Service חדש
1. לחץ "New +" בפינה הימנית העליונה
2. בחר "Web Service"
3. חבר את ה-repository: `paccool-temp-monitor`
4. לחץ "Connect"

### 2.3 הגדר את השירות

מלא את הפרטים הבאים:

**Name:** `paccool-temp-monitor` (או שם אחר לבחירתך)

**Region:** `Frankfurt` (הכי קרוב לישראל)

**Branch:** `main`

**Root Directory:** השאר ריק

**Runtime:** `Node`

**Build Command:**
```
npm install
```

**Start Command:**
```
npm start
```

**Instance Type:** `Free`

### 2.4 הגדר Environment Variables
גלול למטה ל-"Environment Variables"

לחץ "Add Environment Variable"

הוסף את המשתנים הבאים:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | `[Generate]` - לחץ על Generate |

### 2.5 פרוס את האפליקציה
1. לחץ "Create Web Service" בתחתית הדף
2. Render יתחיל לבנות ולפרוס את האפליקציה (זה לוקח 2-5 דקות)
3. המתן עד שתראה "Live" בירוק

### 2.6 קבל את ה-URL שלך
אחרי שהפריסה הושלמה, תקבל URL כמו:
```
https://paccool-temp-monitor.onrender.com
```

**זה ה-URL שתשתמש בו באתר שלך!**

---

## שלב 3: הוספה לאתר WordPress (dubishamir.co.il)

### אופציה A: דף עם iframe (מומלץ)

1. התחבר ל-WordPress Admin:
   ```
   https://my.upress.co.il/account/websites/dubishamir.co.il
   ```

2. עבור ל-**עמודים > הוסף חדש**

3. שם העמוד: `ניטור טמפרטורה` או `Login`

4. בחר "HTML Block" או "Custom HTML"

5. הדבק את הקוד הזה:
   ```html
   <style>
   .paccool-iframe-container {
     width: 100%;
     height: 100vh;
     min-height: 600px;
     border: none;
     overflow: hidden;
   }
   .paccool-iframe {
     width: 100%;
     height: 100%;
     border: none;
   }
   </style>

   <div class="paccool-iframe-container">
     <iframe
       src="https://YOUR-APP-URL.onrender.com"
       class="paccool-iframe"
       title="ניטור טמפרטורה PACCOOL"
       allowfullscreen>
     </iframe>
   </div>
   ```

6. **החלף** `YOUR-APP-URL.onrender.com` ב-URL האמיתי שקיבלת מ-Render

7. שמור כ-**טיוטה** (Draft)

8. URL של הדף יהיה:
   ```
   https://dubishamir.co.il/login
   ```
   או
   ```
   https://dubishamir.co.il/temperature-monitor
   ```

### אופציה B: קישור ישיר

פשוט צור דף עם קישור:
```html
<a href="https://YOUR-APP-URL.onrender.com" target="_blank">
  לחץ כאן לניטור טמפרטורה
</a>
```

---

## שלב 4: בדיקה

1. פתח את ה-URL שקיבלת מ-Render
2. בדוק שדף ההתחברות מופיע בעברית
3. התחבר עם פרטי PACCOOL של אחד הלקוחות
4. ודא שהטמפרטורה מוצגת נכון

---

## שלב 5: פרסום באתר WordPress

כשהכל עובד:
1. חזור לעמוד ב-WordPress
2. שנה מ-"Draft" ל-**"Publish"**
3. שתף את ה-URL עם הלקוחות שלך

---

## עדכון האפליקציה בעתיד

כשתרצה לעדכן את האפליקציה:

```bash
# Make your changes to the code
# Then:
git add .
git commit -m "תיאור השינוי"
git push origin main
```

Render יזהה את השינוי וי**פרוס אוטומטית** את הגרסה החדשה!

---

## פתרון בעיות

### האפליקציה לא עולה
- בדוק ב-Render Logs: לחץ על "Logs" בדף השירות
- ודא ש-Node version תואם (18.x or higher)

### שגיאת CORS
- ודא שה-iframe src תואם לדומיין שקיבלת מ-Render

### הלקוחות לא יכולים להתחבר
- ודא שהם משתמשים בפרטי ההתחברות שלהם ל-PACCOOL
- בדוק ב-Render Logs אם יש שגיאות

---

## תמיכה

אם יש בעיות:
1. בדוק את ה-Logs ב-Render
2. נסה לפתוח את ה-URL ישירות בדפדפן
3. בדוק שהאפליקציה עובדת locally: `npm start`

---

## אבטחה

⚠️ **חשוב:**
- שמור את ה-GitHub repository כ-**Private**
- **אל** תשתף את פרטי ההתחברות של הלקוחות
- כל לקוח נכנס עם הפרטים שלו ל-PACCOOL
- האפליקציה לא שומרת סיסמאות (מלבד "זכור אותי" מוצפן)

---

## עלויות

- **Render.com Free Tier:**
  - ✅ חינם לחלוטין
  - ⚠️ האפליקציה "נרדמת" אחרי 15 דקות של חוסר פעילות
  - ⚠️ טעינה ראשונה יכולה לקחת 30-60 שניות (כי היא "מתעוררת")

- **אם תרצה שהאפליקציה תהיה תמיד ער:**
  - Render.com: $7/חודש (Starter plan)
  - Railway.app: ~$5/חודש
  - Heroku: $7/חודש

---

**בהצלחה! 🚀**

אם יש שאלות או בעיות, תודיע לי ואעזור.
