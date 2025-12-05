# Cookie Authentication Verification Guide

## JWT Cookie is Set Correctly ✅

After testing, the JWT cookie is being set with the correct format and contains all necessary claims.

### JWT Payload Structure:
```json
{
  "user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
  "email": "alex@lanos-logic.com",
  "role": "authenticated",
  "iat": 1764943693,
  "exp": 1765030093
}
```

## Potential Issue in Your HTML Code

Your code queries the API with:
```javascript
const response = await fetch(`https://api2.onfire.so/users?id=eq.${userId}&select=first_name,last_name,email,avatar`
```

**Problem:** The OnFire API uses `profile_photo_url` or `avatar_url`, not `avatar`.

### Corrected API Query:

```javascript
// Fetch user details from API - CORRECTED VERSION
async function fetchUserDetails(userId, jwt) {
    try {
        const response = await fetch(`https://api2.onfire.so/users?id=eq.${userId}&select=first_name,last_name,email,profile_photo_url,avatar_url`, {
            headers: {
                'Authorization': `Bearer ${jwt}`
            }
        });
        const users = await response.json();
        return users[0] || null;
    } catch (e) {
        console.error('Failed to fetch user details:', e);
        return null;
    }
}
```

### Updated Display Function:

```javascript
// Display user info - UPDATED VERSION
async function displayUserInfo() {
    const jwt = getJwtFromCookie();
    const avatarContainer = document.getElementById('user-avatar-container');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const authStatus = document.getElementById('auth-status');

    if (!jwt) {
        userName.textContent = 'Anonymous User';
        userEmail.textContent = 'Not logged in';
        authStatus.textContent = 'Anonymous';
        authStatus.className = 'auth-status anonymous';
        avatarContainer.innerHTML = '<div class="user-avatar-placeholder">?</div>';
        return;
    }

    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.user_id) {
        userName.textContent = 'Invalid Token';
        userEmail.textContent = '';
        authStatus.textContent = 'Error';
        authStatus.className = 'auth-status anonymous';
        avatarContainer.innerHTML = '<div class="user-avatar-placeholder">!</div>';
        return;
    }

    // Show email from JWT immediately
    userName.textContent = payload.email.split('@')[0];
    userEmail.textContent = payload.email;
    authStatus.textContent = 'Authenticated';
    authStatus.className = 'auth-status authenticated';

    // Fetch full user details
    const user = await fetchUserDetails(payload.user_id, jwt);
    if (user) {
        const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || payload.email.split('@')[0];
        userName.textContent = fullName;
        userEmail.textContent = user.email || payload.email;
        
        // Try both avatar field names
        const avatarUrl = user.profile_photo_url || user.avatar_url;
        
        if (avatarUrl) {
            avatarContainer.innerHTML = `<img class="user-avatar" src="${avatarUrl}" alt="Avatar" onerror="this.outerHTML='<div class=user-avatar-placeholder>${fullName.charAt(0).toUpperCase()}</div>'">`;
        } else {
            avatarContainer.innerHTML = `<div class="user-avatar-placeholder">${fullName.charAt(0).toUpperCase()}</div>`;
        }
    } else {
        avatarContainer.innerHTML = `<div class="user-avatar-placeholder">${payload.email.charAt(0).toUpperCase()}</div>`;
    }
}
```

## Testing Checklist

### On Your HTML Page:

1. **Check if cookie is readable:**
   ```javascript
   console.log('All cookies:', document.cookie);
   console.log('JWT:', getJwtFromCookie());
   ```

2. **Verify JWT decoding:**
   ```javascript
   const jwt = getJwtFromCookie();
   const payload = decodeJwtPayload(jwt);
   console.log('JWT Payload:', payload);
   ```

3. **Test API call:**
   ```javascript
   const jwt = getJwtFromCookie();
   const payload = decodeJwtPayload(jwt);
   fetch(`https://api2.onfire.so/users?id=eq.${payload.user_id}&select=*`, {
       headers: { 'Authorization': `Bearer ${jwt}` }
   }).then(r => r.json()).then(console.log);
   ```

## Common Issues and Solutions

### Issue 1: Cookie Not Found
**Symptom:** `getJwtFromCookie()` returns null

**Solutions:**
- Check if you're on the correct domain (*.onfire.so)
- On localhost, cookie will be set without domain restriction
- Verify cookie is not expired (check exp claim in JWT)

### Issue 2: CORS Error
**Symptom:** API requests fail with CORS error

**Solution:**
- OnFire API should allow requests from *.onfire.so domains
- Check browser console for specific CORS errors
- Ensure `Authorization` header is included

### Issue 3: 401 Unauthorized
**Symptom:** API returns 401 status

**Solutions:**
- JWT might be expired (check `exp` claim)
- JWT format might be incorrect
- User might need to re-login

### Issue 4: Avatar Not Displaying
**Symptom:** Avatar field is null or undefined

**Solution:**
- Use `profile_photo_url` or `avatar_url` instead of `avatar`
- Query with: `select=first_name,last_name,email,profile_photo_url,avatar_url`
- Handle both field names in your display code

## Production Deployment Notes

When deployed to *.onfire.so:
1. Cookie domain will be `.onfire.so`
2. Cookie will be accessible across all subdomains
3. Iframe at api2.onfire.so can read the cookie
4. No CORS issues between subdomains

## Cookie Verification Command

Run this in browser console after login:
```javascript
// Check if JWT cookie exists
const jwt = document.cookie.match(/jwt=([^;]+)/);
console.log('JWT Cookie:', jwt ? 'Found ✅' : 'Not Found ❌');

if (jwt) {
    // Decode and display payload
    const token = jwt[1];
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('Payload:', payload);
    console.log('User ID:', payload.user_id);
    console.log('Email:', payload.email);
    console.log('Expires:', new Date(payload.exp * 1000));
}
```
