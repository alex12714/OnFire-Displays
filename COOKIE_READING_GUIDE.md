# Cookie Reading Implementation Guide

## Overview

This guide explains how the JWT cookie is set and read in the Task Management application.

---

## 1. How Cookie is Set (Our Implementation)

### Location: Login Flow

**Files:**
- `/app/frontend/src/pages/Login.js` - QR login
- `/app/frontend/src/services/api.js` - Email/password login

### Code Implementation:

```javascript
// Check if we're in production or localhost
const isProduction = window.location.hostname.includes('onfire.so');

if (isProduction) {
  // Production: Set cookie for *.onfire.so domain
  document.cookie = `jwt=${jwtToken}; Domain=.onfire.so; Secure; Path=/`;
  console.log('✅ Cookie "jwt" set for *.onfire.so domain');
} else {
  // Localhost: Set cookie without domain restriction
  document.cookie = `jwt=${jwtToken}; Path=/`;
  console.log('✅ Cookie "jwt" set for localhost (testing)');
}
```

### Cookie Attributes:

| Attribute | Value | Purpose |
|-----------|-------|---------|
| Name | `jwt` | Cookie identifier |
| Value | JWT token string | Authentication token |
| Domain | `.onfire.so` (production) | Accessible by all subdomains |
| Path | `/` | Available on all routes |
| Secure | Yes (production) | HTTPS only |
| HttpOnly | No | JavaScript can read it |

---

## 2. How to Read Cookie (Your HTML Page)

### Basic Cookie Reading Function:

```javascript
// Parse JWT from cookie
function getJwtFromCookie() {
    const match = document.cookie.match(/jwt=([^;]+)/);
    return match ? match[1] : null;
}

// Usage:
const token = getJwtFromCookie();
console.log('JWT Token:', token);
```

### Complete Implementation with Error Handling:

```javascript
// Get JWT from cookie with validation
function getJwtFromCookie() {
    try {
        // Read all cookies
        const cookies = document.cookie;
        console.log('All cookies:', cookies);
        
        // Extract jwt cookie
        const match = cookies.match(/jwt=([^;]+)/);
        
        if (!match) {
            console.warn('JWT cookie not found');
            return null;
        }
        
        const token = match[1];
        
        // Basic validation - JWT has 3 parts
        if (token.split('.').length !== 3) {
            console.error('Invalid JWT format');
            return null;
        }
        
        console.log('JWT found:', token.substring(0, 50) + '...');
        return token;
    } catch (e) {
        console.error('Error reading JWT cookie:', e);
        return null;
    }
}
```

---

## 3. Decode JWT Payload

```javascript
// Decode JWT payload (base64)
function decodeJwtPayload(token) {
    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        
        // Get the payload (middle part)
        const base64Url = parts[1];
        
        // Convert base64url to base64
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        
        // Decode base64 to string
        const payload = decodeURIComponent(
            atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')
        );
        
        // Parse JSON
        const decoded = JSON.parse(payload);
        console.log('Decoded JWT payload:', decoded);
        
        return decoded;
    } catch (e) {
        console.error('Failed to decode JWT:', e);
        return null;
    }
}

// Usage:
const jwt = getJwtFromCookie();
if (jwt) {
    const payload = decodeJwtPayload(jwt);
    console.log('User ID:', payload.user_id);
    console.log('Email:', payload.email);
    console.log('Expires:', new Date(payload.exp * 1000));
}
```

---

## 4. Complete Test Script for Your HTML Page

Add this to your HTML page to test cookie reading:

```html
<script>
    // Test Suite for Cookie Reading
    function testCookieReading() {
        console.log('=== COOKIE READING TEST ===\n');
        
        // Test 1: Check if any cookies exist
        console.log('1. All cookies:');
        console.log(document.cookie || '(no cookies)');
        console.log('');
        
        // Test 2: Try to get JWT cookie
        console.log('2. JWT Cookie:');
        const jwt = getJwtFromCookie();
        if (jwt) {
            console.log('✅ JWT found');
            console.log('   Length:', jwt.length);
            console.log('   Preview:', jwt.substring(0, 50) + '...');
        } else {
            console.log('❌ JWT not found');
            console.log('   Possible reasons:');
            console.log('   - User not logged in');
            console.log('   - Wrong cookie name');
            console.log('   - Cookie expired');
            console.log('   - Domain mismatch');
        }
        console.log('');
        
        // Test 3: Decode JWT
        if (jwt) {
            console.log('3. JWT Payload:');
            const payload = decodeJwtPayload(jwt);
            if (payload) {
                console.log('✅ JWT decoded successfully');
                console.log('   user_id:', payload.user_id || '(missing)');
                console.log('   email:', payload.email || '(missing)');
                console.log('   role:', payload.role || '(missing)');
                console.log('   issued:', payload.iat ? new Date(payload.iat * 1000).toISOString() : '(missing)');
                console.log('   expires:', payload.exp ? new Date(payload.exp * 1000).toISOString() : '(missing)');
                
                // Check if expired
                if (payload.exp) {
                    const now = Math.floor(Date.now() / 1000);
                    if (now > payload.exp) {
                        console.log('   ⚠️ TOKEN EXPIRED');
                    } else {
                        const remaining = payload.exp - now;
                        console.log('   ✅ Valid for', Math.floor(remaining / 3600), 'hours');
                    }
                }
            } else {
                console.log('❌ Failed to decode JWT');
            }
        }
        console.log('');
        
        // Test 4: Test API call
        if (jwt) {
            console.log('4. Testing API Call:');
            const payload = decodeJwtPayload(jwt);
            if (payload && payload.user_id) {
                fetch(`https://api2.onfire.so/users?id=eq.${payload.user_id}&select=first_name,last_name,email,profile_photo_url`, {
                    headers: {
                        'Authorization': `Bearer ${jwt}`
                    }
                })
                .then(response => {
                    console.log('   API Response Status:', response.status);
                    if (response.ok) {
                        console.log('   ✅ API call successful');
                        return response.json();
                    } else {
                        console.log('   ❌ API call failed:', response.statusText);
                        return null;
                    }
                })
                .then(data => {
                    if (data && data[0]) {
                        console.log('   User data:', data[0]);
                    }
                })
                .catch(error => {
                    console.log('   ❌ API error:', error.message);
                });
            }
        }
        
        console.log('\n=== TEST COMPLETE ===');
    }
    
    // Run test on page load
    testCookieReading();
</script>
```

---

## 5. Browser DevTools Inspection

### Step-by-Step:

1. **Open DevTools** (F12 or Right-click → Inspect)

2. **Go to Application Tab**

3. **Navigate to Cookies**
   - In left sidebar: Storage → Cookies
   - Select your domain (localhost or *.onfire.so)

4. **Look for `jwt` Cookie**
   - Should see: Name = `jwt`
   - Value = long string (eyJhbGc...)
   - Domain = `.onfire.so` or `localhost`
   - Path = `/`

5. **Console Test**
   ```javascript
   // Quick test in console
   document.cookie.includes('jwt=')
   ```

---

## 6. Common Issues and Solutions

### Issue 1: Cookie Not Found

**Symptoms:**
```javascript
getJwtFromCookie() // returns null
```

**Debug Steps:**
```javascript
// Check all cookies
console.log('All cookies:', document.cookie);

// Check if jwt exists
console.log('JWT exists:', document.cookie.includes('jwt='));

// List all cookie names
const cookieNames = document.cookie.split('; ').map(c => c.split('=')[0]);
console.log('Cookie names:', cookieNames);
```

**Possible Causes:**
- User not logged in yet
- Cookie expired (check exp claim)
- Domain mismatch (localhost vs .onfire.so)
- Cookie was cleared

### Issue 2: Cookie Exists But Can't Read

**Symptoms:**
```javascript
// In DevTools: jwt cookie visible
// In code: getJwtFromCookie() returns null
```

**Possible Causes:**
- Cookie name has extra spaces
- Cookie value is encoded differently
- JavaScript typo in regex

**Debug:**
```javascript
// Try different patterns
const patterns = [
    /jwt=([^;]+)/,           // Original
    /jwt\s*=\s*([^;]+)/,     // With whitespace
    /\bjwt=([^;]+)/          // Word boundary
];

patterns.forEach((pattern, i) => {
    const match = document.cookie.match(pattern);
    console.log(`Pattern ${i}:`, match ? match[1].substring(0, 20) : 'no match');
});
```

### Issue 3: JWT Decodes But Missing Claims

**Symptoms:**
```javascript
payload.user_id // undefined
payload.email   // undefined
```

**Debug:**
```javascript
const jwt = getJwtFromCookie();
const parts = jwt.split('.');

console.log('JWT Parts:', parts.length); // Should be 3

// Decode each part
parts.forEach((part, i) => {
    try {
        const decoded = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
        console.log(`Part ${i}:`, decoded);
    } catch (e) {
        console.log(`Part ${i}: Not JSON or invalid`);
    }
});
```

### Issue 4: API Call Fails (401 Unauthorized)

**Symptoms:**
```javascript
fetch('https://api2.onfire.so/users?...', {
    headers: { 'Authorization': `Bearer ${jwt}` }
})
// Returns: 401 Unauthorized
```

**Debug:**
```javascript
// Check token format
const jwt = getJwtFromCookie();
console.log('JWT length:', jwt.length);
console.log('JWT parts:', jwt.split('.').length);
console.log('Starts with eyJ:', jwt.startsWith('eyJ'));

// Check expiration
const payload = decodeJwtPayload(jwt);
const now = Math.floor(Date.now() / 1000);
console.log('Token expired:', now > payload.exp);

// Test with curl (in terminal)
// curl -H "Authorization: Bearer YOUR_TOKEN" https://api2.onfire.so/users?select=*
```

---

## 7. Cross-Domain Cookie Reading

### Important Notes:

**Same-Site Cookies:**
- Cookie set on `app.onfire.so` can be read by `api2.onfire.so` if Domain=`.onfire.so`
- Cookie set on `localhost` cannot be read by `api2.onfire.so`

**Iframe Context:**
```javascript
// In iframe at https://api2.onfire.so/s/hybQ1
function getJwtFromParentOrSelf() {
    try {
        // Try to read from current domain
        const jwt = getJwtFromCookie();
        if (jwt) return jwt;
        
        // If in iframe, parent might have it
        if (window !== window.parent) {
            // Note: This only works if same domain
            return window.parent.getJwtFromCookie();
        }
    } catch (e) {
        console.error('Cannot access parent cookie:', e);
    }
    return null;
}
```

---

## 8. Complete Working Example

```html
<!DOCTYPE html>
<html>
<head>
    <title>Cookie Test Page</title>
</head>
<body>
    <h1>JWT Cookie Test</h1>
    <div id="result"></div>

    <script>
        // Cookie reading function
        function getJwtFromCookie() {
            const match = document.cookie.match(/jwt=([^;]+)/);
            return match ? match[1] : null;
        }

        // Decode function
        function decodeJwtPayload(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = decodeURIComponent(
                    atob(base64).split('').map(c => {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    }).join('')
                );
                return JSON.parse(payload);
            } catch (e) {
                console.error('Failed to decode JWT:', e);
                return null;
            }
        }

        // Display result
        function displayResult() {
            const resultDiv = document.getElementById('result');
            const jwt = getJwtFromCookie();
            
            if (!jwt) {
                resultDiv.innerHTML = '<p style="color: red;">❌ JWT cookie not found</p>';
                return;
            }
            
            const payload = decodeJwtPayload(jwt);
            
            if (!payload) {
                resultDiv.innerHTML = '<p style="color: red;">❌ Failed to decode JWT</p>';
                return;
            }
            
            resultDiv.innerHTML = `
                <p style="color: green;">✅ JWT Cookie Found!</p>
                <ul>
                    <li><strong>User ID:</strong> ${payload.user_id}</li>
                    <li><strong>Email:</strong> ${payload.email}</li>
                    <li><strong>Role:</strong> ${payload.role}</li>
                    <li><strong>Issued:</strong> ${new Date(payload.iat * 1000).toLocaleString()}</li>
                    <li><strong>Expires:</strong> ${new Date(payload.exp * 1000).toLocaleString()}</li>
                </ul>
            `;
        }

        // Run on load
        displayResult();
    </script>
</body>
</html>
```

---

## 9. Verification Checklist

Use this checklist to verify cookie implementation:

- [ ] **Set Cookie:** Check DevTools → Application → Cookies
- [ ] **Cookie Name:** Verify it's `jwt` (lowercase)
- [ ] **Cookie Value:** Should start with `eyJ`
- [ ] **Domain:** `.onfire.so` in production, `localhost` in dev
- [ ] **Path:** Should be `/`
- [ ] **Read Cookie:** `getJwtFromCookie()` returns string
- [ ] **Decode JWT:** Payload has `user_id`, `email`, `role`
- [ ] **API Call:** Bearer token works with OnFire API
- [ ] **Not Expired:** Check `exp` claim vs current time
- [ ] **Console Logs:** No errors in browser console

---

## 10. Need Help?

If cookie reading still doesn't work:

1. Copy this into your browser console:
   ```javascript
   console.log('=== COOKIE DEBUG ===');
   console.log('All cookies:', document.cookie);
   console.log('Domain:', window.location.hostname);
   console.log('Protocol:', window.location.protocol);
   console.log('JWT match:', document.cookie.match(/jwt=([^;]+)/));
   ```

2. Check the output and verify:
   - Cookie string is not empty
   - JWT pattern matches
   - Domain is correct

3. If still failing, the issue is likely:
   - Cookie not being set (check login flow)
   - Wrong domain (localhost vs .onfire.so)
   - Cookie expired (re-login)
