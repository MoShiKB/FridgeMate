# תיעוד API - FridgeMate

## תוכן עניינים
1. [מידע כללי](#מידע-כללי)
2. [אימות (Authentication)](#אימות-authentication)
3. [נקודות קצה (Endpoints)](#נקודות-קצה-endpoints)
4. [דוגמאות שימוש](#דוגמאות-שימוש)
5. [טיפול בשגיאות](#טיפול-בשגיאות)

---

## מידע כללי

### Base URL
```
http://localhost:3001
```

### Swagger Documentation
תיעוד אינטראקטיבי זמין ב:
```
http://localhost:3001/api-docs
```

### Content-Type
כל הבקשות צריכות להיות עם:
```
Content-Type: application/json
```

### Authentication
רוב ה-API דורש אימות באמצעות JWT Token. יש לשלוח את ה-Token ב-Header:
```
Authorization: Bearer <accessToken>
```

---

## אימות (Authentication)

### זרימת האימות

1. **הרשמה/התחברות** - קבלת `accessToken` ו-`refreshToken`
2. **שימוש ב-accessToken** - לכל בקשה מוגנת, יש לשלוח את ה-accessToken ב-Header
3. **רענון Token** - כאשר ה-accessToken פג תוקף, יש להשתמש ב-refreshToken לקבלת accessToken חדש
4. **התנתקות** - ביטול ה-refreshToken

---

## נקודות קצה (Endpoints)

### 1. בדיקת בריאות השרת (Health Check)

#### `GET /health`

בודק אם השרת פועל.

**בקשה:**
```http
GET /health
```

**תגובה מוצלחת (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. הרשמה (Register)

#### `POST /auth/register`

יוצר משתמש חדש במערכת.

**בקשה:**
```http
POST /auth/register
Content-Type: application/json

{
  "userName": "johndoe",
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**פרמטרים:**
- `userName` (string, חובה) - שם המשתמש
- `email` (string, חובה) - כתובת אימייל
- `password` (string, חובה) - סיסמה (מינימום 6 תווים)

**תגובה מוצלחת (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "userName": "johndoe",
    "email": "john.doe@example.com",
    "role": "user",
    "profileImage": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**שגיאות אפשריות:**
- `400` - משתמש כבר קיים או שגיאת ולידציה
- `500` - שגיאת שרת

---

### 3. התחברות (Login)

#### `POST /auth/login`

מתחבר למשתמש קיים ומחזיר Tokens.

**בקשה:**
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**פרמטרים:**
- `email` (string, חובה) - כתובת אימייל
- `password` (string, חובה) - סיסמה

**תגובה מוצלחת (200):**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**שגיאות אפשריות:**
- `400` - פרטי התחברות לא תקינים
- `500` - שגיאת שרת

**חשוב:** יש לשמור את שני ה-Tokens:
- `accessToken` - לשימוש בכל בקשה מוגנת (פג תוקף תוך זמן קצר)
- `refreshToken` - לרענון ה-accessToken (פג תוקף תוך זמן ארוך יותר)

---

### 4. התנתקות (Logout)

#### `POST /auth/logout`

מתנתק מהמערכת ומבטל את ה-refreshToken.

**בקשה:**
```http
POST /auth/logout
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**הערה:** ה-userId נלקח אוטומטית מה-accessToken, אין צורך לשלוח אותו ב-body.

**תגובה מוצלחת (200):**
```json
{
  "message": "Logged out successfully"
}
```

**שגיאות אפשריות:**
- `403` - לא מאומת (חסר או לא תקין accessToken)
- `500` - שגיאת שרת

---

### 5. רענון Token (Refresh Token)

#### `POST /auth/refresh-token`

מקבל accessToken חדש באמצעות refreshToken תקין.

**בקשה:**
```http
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**פרמטרים:**
- `refreshToken` (string, חובה) - ה-refreshToken שקיבלתם בהתחברות

**תגובה מוצלחת (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**שגיאות אפשריות:**
- `400` - refreshToken לא תקין או פג תוקף
- `500` - שגיאת שרת

**שימוש מומלץ:** כאשר אתם מקבלים שגיאת 403 על בקשה מוגנת, נסו לרענן את ה-accessToken לפני שתציגו למשתמש שגיאה.

---

### 6. התחברות עם Google

#### `GET /auth/login/google`

מתחיל תהליך התחברות עם Google OAuth.

**בקשה:**
```http
GET /auth/login/google
```

**תגובה:**
השרת מפנה (302 Redirect) לדף ההתחברות של Google.

**שימוש:**
פשוט פתחו את ה-URL הזה בדפדפן או הפנו את המשתמש אליו.

---

#### `GET /auth/login/google/callback`

נקודת החזרה מ-Google OAuth (לא צריך לקרוא ישירות).

**תגובה:**
השרת מפנה ל-URL הבא עם Tokens:
```
/auth/google/callback?accessToken=<token>&refreshToken=<token>
```

**הערה:** זהו endpoint פנימי של השרת. השרת מטפל בו אוטומטית לאחר שהמשתמש מאשר את ההתחברות ב-Google.

---

### 7. קבלת כל המשתמשים

#### `GET /user`

מחזיר רשימה של כל המשתמשים במערכת.

**בקשה:**
```http
GET /user
Authorization: Bearer <accessToken>
```

**תגובה מוצלחת (200):**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "userName": "johndoe",
    "email": "john@example.com",
    "profileImage": "https://example.com/image.jpg",
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "_id": "507f1f77bcf86cd799439012",
    "userName": "janedoe",
    "email": "jane@example.com",
    "profileImage": null,
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**שגיאות אפשריות:**
- `403` - לא מאומת

---

### 8. קבלת משתמש לפי ID

#### `GET /user/:id`

מחזיר פרטי משתמש ספציפי לפי ID.

**בקשה:**
```http
GET /user/507f1f77bcf86cd799439011
Authorization: Bearer <accessToken>
```

**פרמטרים:**
- `id` (path parameter, חובה) - ה-ID של המשתמש

**תגובה מוצלחת (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userName": "johndoe",
  "email": "john@example.com",
  "profileImage": "https://example.com/image.jpg",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**שגיאות אפשריות:**
- `404` - משתמש לא נמצא
- `403` - לא מאומת

---

### 9. עדכון פרופיל משתמש

#### `PUT /user/:id`

מעדכן את פרטי הפרופיל של המשתמש המחובר.

**בקשה:**
```http
PUT /user/507f1f77bcf86cd799439011
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "userName": "newusername",
  "profileImage": "https://example.com/new-image.jpg"
}
```

**פרמטרים:**
- `id` (path parameter, חובה) - ה-ID של המשתמש (חייב להתאים למשתמש המחובר)
- `userName` (string, אופציונלי) - שם משתמש חדש
- `profileImage` (string, אופציונלי) - URL לתמונת פרופיל חדשה

**הערה:** ה-userId נלקח אוטומטית מה-accessToken. יש לוודא שה-ID ב-URL תואם למשתמש המחובר.

**תגובה מוצלחת (200):**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userName": "newusername",
  "email": "john@example.com",
  "profileImage": "https://example.com/new-image.jpg",
  "role": "user",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z"
}
```

**שגיאות אפשריות:**
- `404` - משתמש לא נמצא
- `403` - לא מאומת

---

## דוגמאות שימוש

### דוגמה ב-JavaScript/TypeScript (Fetch API)

```javascript
const BASE_URL = 'http://localhost:3001';

// 1. הרשמה
async function register(userName, email, password) {
  const response = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userName, email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }
  
  return await response.json();
}

// 2. התחברות
async function login(email, password) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }
  
  const data = await response.json();
  
  // שמירת Tokens ב-localStorage או state management
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  
  return data;
}

// 3. קבלת משתמש לפי ID (דורש אימות)
async function getUserById(userId) {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(`${BASE_URL}/user/${userId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  if (response.status === 403) {
    // נסו לרענן את ה-Token
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // נסו שוב עם ה-Token החדש
      return getUserById(userId);
    }
    throw new Error('Authentication failed');
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get user');
  }
  
  return await response.json();
}

// 4. רענון Access Token
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    return false;
  }
  
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!response.ok) {
      // Refresh token פג תוקף - צריך להתחבר מחדש
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return false;
    }
    
    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    return true;
  } catch (error) {
    return false;
  }
}

// 5. עדכון פרופיל
async function updateProfile(userId, updates) {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(`${BASE_URL}/user/${userId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  
  if (response.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return updateProfile(userId, updates);
    }
    throw new Error('Authentication failed');
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update profile');
  }
  
  return await response.json();
}

// 6. התנתקות
async function logout() {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  // נקה את ה-Tokens גם אם הבקשה נכשלה
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  
  return response.ok;
}
```

### דוגמה ב-Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor להוספת Token אוטומטית
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor לטיפול בשגיאות 403 ורענון Token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 403 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${api.defaults.baseURL}/auth/refresh-token`, {
            refreshToken,
          });
          
          const { accessToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          // הפנה למסך התחברות
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

// שימוש
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refreshToken) => api.post('/auth/refresh-token', { refreshToken }),
};

export const userAPI = {
  getAllUsers: () => api.get('/user'),
  getUserById: (id) => api.get(`/user/${id}`),
  updateProfile: (id, data) => api.put(`/user/${id}`, data),
};
```

---

## טיפול בשגיאות

### קודי סטטוס נפוצים

- **200** - הצלחה
- **201** - נוצר בהצלחה (הרשמה)
- **302** - הפניה (Google OAuth)
- **400** - בקשה לא תקינה (ולידציה, משתמש קיים, וכו')
- **403** - לא מאומת (חסר או לא תקין Token)
- **404** - לא נמצא (משתמש לא קיים)
- **500** - שגיאת שרת

### מבנה שגיאה טיפוסי

```json
{
  "error": "Error message",
  "message": "Detailed error message"
}
```

### זרימת טיפול בשגיאות מומלצת

1. **403 Forbidden** - נסו לרענן את ה-accessToken באמצעות refreshToken
2. **400 Bad Request** - בדקו את הנתונים שנשלחו והציגו הודעת שגיאה למשתמש
3. **404 Not Found** - המשאב המבוקש לא קיים
4. **500 Server Error** - שגיאת שרת, נסו שוב מאוחר יותר

---

## הערות חשובות

1. **שמירת Tokens:** מומלץ לשמור את ה-Tokens ב-localStorage או ב-state management (Redux, Zustand, וכו')

2. **רענון אוטומטי:** מומלץ ליישם interceptor שירענן את ה-accessToken אוטומטית כאשר הוא פג תוקף

3. **Google OAuth:** עבור התחברות עם Google, יש להפנות את המשתמש ל-`/auth/login/google` והשרת יטפל בהשאר

4. **Base URL:** בעת פריסה לפרודקשן, יש לעדכן את ה-Base URL בהתאם

5. **CORS:** השרת תומך ב-CORS, אך יש לוודא שה-Origin של הפרונטאנד מורשה

---

## שאלות נפוצות

**Q: מה לעשות אם ה-accessToken פג תוקף?**  
A: השתמשו ב-refreshToken כדי לקבל accessToken חדש. אם גם ה-refreshToken פג תוקף, המשתמש צריך להתחבר מחדש.

**Q: איך יודעים מה ה-userId של המשתמש המחובר?**  
A: ה-userId מוטמע ב-accessToken. ניתן לפענח אותו בצד הלקוח או לשלוח בקשה ל-`/user/:id` עם ה-ID מה-Token.

**Q: האם ניתן לעדכן את הסיסמה?**  
A: כרגע לא קיים endpoint לעדכון סיסמה. יש להוסיף זאת בעתיד.

**Q: מה ההבדל בין accessToken ל-refreshToken?**  
A: accessToken משמש לאימות בקשות ופג תוקף תוך זמן קצר. refreshToken משמש לרענון accessToken ופג תוקף תוך זמן ארוך יותר.

---

**תאריך עדכון אחרון:** 28 בינואר 2026  
**גרסת API:** 1.0.0
