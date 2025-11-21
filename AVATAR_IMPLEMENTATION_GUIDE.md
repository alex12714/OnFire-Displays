# Avatar Implementation Guide

## Overview
The Task Management HUD now displays user profile pictures (avatars) for all participants in conversations, falling back to colored initials when no avatar is available.

## How It Works

### Data Flow
```
Tasks → Extract User IDs → Fetch User Profiles → Display Avatars or Initials
```

### API Endpoints Used

#### 1. Get User Profiles Data
```javascript
GET https://api2.onfire.so/user_profiles?or=(user_id.eq.{userId1},user_id.eq.{userId2},...)
```

**Query Parameters:**
- `or=(user_id.eq.{userId1},user_id.eq.{userId2},...) ` - Fetch multiple user profiles
- `select=user_id,display_name,profile_photo_url` - Fields to return

**Response:**
```json
[
  {
    "user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
    "display_name": "Alex P.",
    "profile_photo_url": "https://onfire-messenger-dev-space.nyc3.digitaloceanspaces.com/mediafiles/users/avatars/user_avatar_1762337372219.jpg"
  }
]
```

**Full Profile Response (when selecting all fields):**
```json
{
  "id": "9a4873cd-8edd-461f-84d0-ce25bd21c9fd",
  "user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
  "about": "Passionate software developer and tech enthusiast with 8+ years of experience.",
  "date_of_birth": "1992-03-15",
  "profile_photo_url": "https://onfire-messenger-dev-space.nyc3.digitaloceanspaces.com/mediafiles/users/avatars/user_avatar_1762337372219.jpg",
  "wallet_address": "2423",
  "profile_rating": 4.80,
  "profile_status": "personal",
  "created_at": "2025-10-16T12:49:48.843079+00:00",
  "updated_at": "2025-11-05T10:09:44.182779+00:00",
  "display_name": "Alex P.",
  "pronouns": "he/him",
  "occupation": "Senior Software Engineer",
  "skills": "Python, JavaScript, React, Node.js, PostgreSQL, Docker, AWS",
  "interests": "AI/ML, Blockchain, Open Source, Gaming, Travel",
  "social_links": "linkedin.com/in/alexpodbrezsky,github.com/alexpodbrezsky",
  "cover_images": [
    "https://example.com/cover-a.jpg",
    "https://example.com/cover-b.jpg",
    "https://example.com/cover-c.jpg"
  ]
}
```

#### 2. Avatar Field Used
The system uses **`profile_photo_url`** from the `user_profiles` table:
1. `profile.profile_photo_url` - Avatar image URL
2. Fallback to colored initial circle if null

## Implementation Details

### 1. API Service (api.js)

```javascript
// Fetch multiple user profiles
async getUserProfiles(userIds = []) {
  if (!userIds || userIds.length === 0) return [];
  
  const idsFilter = userIds.map(id => `user_id.eq.${id}`).join(',');
  const response = await axios.get(
    `${API_BASE_URL}/user_profiles?or=(${idsFilter})&select=user_id,display_name,profile_photo_url`,
    { headers: this.getAuthHeaders() }
  );
  return response.data || [];
}

// Fetch single user profile
async getUserProfile(userId) {
  const response = await axios.get(
    `${API_BASE_URL}/user_profiles?user_id=eq.${userId}&select=user_id,display_name,profile_photo_url`,
    { headers: this.getAuthHeaders() }
  );
  return response.data?.[0] || null;
}
```

### 2. TaskManagementHUD Component

```javascript
const loadTasks = async () => {
  // 1. Load tasks
  const apiTasks = await onFireAPI.getTasks(conversationId);
  
  // 2. Extract unique user IDs
  const uniqueUserIds = new Set();
  apiTasks.forEach(task => {
    if (task.assignee_user_ids) {
      task.assignee_user_ids.forEach(id => uniqueUserIds.add(id));
    }
    if (task.completed_by_user_id) {
      uniqueUserIds.add(task.completed_by_user_id);
    }
  });
  
  // 3. Fetch user profiles with avatars
  const userProfiles = await onFireAPI.getUserProfiles(Array.from(uniqueUserIds));
  
  // 4. Create profile map (keyed by user_id)
  const profileMap = {};
  userProfiles.forEach(profile => {
    profileMap[profile.user_id] = profile;
  });
  
  // 5. Generate people list with avatars
  const peopleList = Array.from(uniqueUserIds).map((userId, index) => {
    const profile = profileMap[userId];
    
    return {
      id: userId,
      name: profile?.display_name || `User ${userId.substring(0, 8)}`,
      initial: (profile?.display_name || 'U')[0].toUpperCase(),
      avatar: profile?.profile_photo_url || null,
      color: colors[index % colors.length]
    };
  });
  
  setPeople(peopleList);
};
```

### 3. Avatar Rendering

```jsx
<div 
  className="avatar" 
  style={{ background: person.avatar ? 'transparent' : person.color }}
>
  {person.avatar ? (
    <img 
      src={person.avatar} 
      alt={person.name} 
      className="avatar-image" 
    />
  ) : (
    person.initial
  )}
</div>
```

## CSS Styling

```css
.avatar {
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  border: 2px solid rgba(255, 255, 255, 0.4);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  position: absolute;
  top: 0;
  left: 0;
}
```

## Where Avatars Appear

### 1. Progress Section
- Large avatars (90px) showing each person's progress
- Displays in earnings progress bars

### 2. Task Cards
- Medium avatars (55px) in avatar assignment row
- Click to assign task to that person

### 3. Completed Tasks Gallery
- Small avatars (60px) next to completed task thumbnails
- Shows who completed each task

## Fallback Behavior

### No Avatar Available
When `user.avatar` and `user.profile_picture_url` are both null:

```javascript
// Displays colored circle with initial
<div className="avatar" style={{ background: '#ff6b35' }}>
  J
</div>
```

### Avatar Load Error
If image fails to load, browser shows broken image icon. To improve this:

```jsx
<img 
  src={person.avatar} 
  alt={person.name} 
  className="avatar-image"
  onError={(e) => {
    e.target.style.display = 'none';
    e.target.parentElement.textContent = person.initial;
    e.target.parentElement.style.background = person.color;
  }}
/>
```

## Testing Avatars

### 1. Check User Data
```javascript
// In browser console after login
const userData = await onFireAPI.getUser('user-id-here');
console.log('User avatar:', userData.avatar);
console.log('Profile picture:', userData.profile_picture_url);
```

### 2. Check API Response
```bash
# Using curl
curl -X GET "https://api2.onfire.so/user_profiles?user_id=eq.USER_ID&select=user_id,display_name,profile_photo_url" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Verify Image URL
```bash
# Check if image URL is accessible
curl -I "https://cdn.example.com/avatars/user-123.jpg"
```

## Common Issues & Solutions

### Issue: Avatars Not Showing

**Possible Causes:**
1. User has no avatar set in profile
2. Avatar URL is broken/expired
3. CORS issues with image CDN
4. Network error fetching users

**Debug Steps:**
```javascript
// 1. Check if users data is fetched
console.log('Fetched users:', usersData);

// 2. Check avatar URLs
usersData.forEach(user => {
  console.log(`${user.name}: avatar=${user.avatar}, profile_pic=${user.profile_picture_url}`);
});

// 3. Check network tab for failed image requests
// Look for 404 or CORS errors
```

**Solutions:**
```javascript
// Add error handling for missing avatars
const avatar = user?.avatar || user?.profile_picture_url || null;

// Add onError handler to img tag
<img 
  src={person.avatar} 
  onError={(e) => {
    console.error('Avatar load failed:', person.avatar);
    // Show fallback
  }}
/>
```

### Issue: CORS Errors

**Problem:** Avatar images blocked by CORS policy

**Solution:**
1. Ensure avatar URLs are from allowed origins
2. Use proxy if needed
3. Or use initials as fallback

```javascript
// Check if URL is accessible
const isImageAccessible = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};
```

### Issue: Slow Loading

**Problem:** Fetching user data for many users is slow

**Solution: Implement caching**
```javascript
const userCache = new Map();

async getUsers(userIds) {
  // Check cache first
  const uncachedIds = userIds.filter(id => !userCache.has(id));
  
  if (uncachedIds.length === 0) {
    return userIds.map(id => userCache.get(id));
  }
  
  // Fetch only uncached users
  const users = await this.fetchUsersFromAPI(uncachedIds);
  
  // Update cache
  users.forEach(user => userCache.set(user.id, user));
  
  return userIds.map(id => userCache.get(id));
}
```

## Avatar Upload Flow

If you want to allow users to upload avatars:

### 1. Upload Endpoint
```javascript
async uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const response = await axios.post(
    `${API_BASE_URL}/upload/avatar`,
    formData,
    {
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  
  return response.data.avatar_url;
}
```

### 2. Update User Profile
```javascript
async updateUserAvatar(avatarUrl) {
  await axios.patch(
    `${API_BASE_URL}/users?id=eq.${this.userData.id}`,
    { avatar: avatarUrl },
    { headers: this.getAuthHeaders() }
  );
}
```

## Performance Optimization

### 1. Lazy Loading
```jsx
<img 
  src={person.avatar} 
  loading="lazy"
  alt={person.name}
/>
```

### 2. Image Size Optimization
Request optimized sizes from CDN:
```javascript
const getOptimizedAvatar = (url, size = 100) => {
  if (!url) return null;
  // Add query params for CDN optimization
  return `${url}?w=${size}&h=${size}&fit=crop`;
};
```

### 3. Preload Important Avatars
```javascript
// Preload current user's avatar
const preloadAvatar = (url) => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  document.head.appendChild(link);
};

if (userData.avatar) {
  preloadAvatar(userData.avatar);
}
```

## API Field Reference

### User Profile Object Fields
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Profile record identifier |
| `user_id` | UUID | User identifier (FK) |
| `display_name` | String | User's display name |
| `profile_photo_url` | String (URL) | Avatar image URL |
| `about` | String | User bio/description |
| `date_of_birth` | Date | Birth date |
| `occupation` | String | Job title |
| `skills` | String | Comma-separated skills |
| `interests` | String | User interests |
| `pronouns` | String | Preferred pronouns |
| `cover_images` | Array | Cover photo URLs |

### Expected Avatar URL Format
```
https://onfire-messenger-dev-space.nyc3.digitaloceanspaces.com/mediafiles/users/avatars/user_avatar_{timestamp}.jpg
```

Example:
```
https://onfire-messenger-dev-space.nyc3.digitaloceanspaces.com/mediafiles/users/avatars/user_avatar_1762337372219.jpg
```

## Browser Console Testing

```javascript
// Test user profile fetch
const testProfiles = await onFireAPI.getUserProfiles(['user-id-1', 'user-id-2']);
console.log('User Profiles:', testProfiles);

// Test single user profile
const testProfile = await onFireAPI.getUserProfile('user-id-here');
console.log('User avatar:', testProfile.profile_photo_url);

// Check if avatar loads
const img = new Image();
img.onload = () => console.log('Avatar loads successfully');
img.onerror = () => console.log('Avatar failed to load');
img.src = 'https://avatar-url-here.jpg';
```

## Summary

✅ **Implemented Features:**
- Fetch user profiles from `/users` endpoint
- Display avatar images in all person circles
- Fallback to colored initials when no avatar
- Proper error handling for missing/broken avatars
- CSS styling with `object-fit: cover` for proper image display
- Support for both `avatar` and `profile_picture_url` fields

🔧 **Customization Options:**
- Adjust avatar sizes via CSS variables
- Add image lazy loading
- Implement caching for better performance
- Add avatar upload functionality
- Customize fallback appearance

📊 **Performance:**
- Single API call fetches all users at once
- Images load from CDN (fast)
- Fallback to initials is instant
- No blocking on avatar load

---

*Last Updated: November 2025*
