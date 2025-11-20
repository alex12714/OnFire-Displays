# Task Management HUD - OnFire API Integration Guide

## Overview
This application is now fully integrated with the OnFire API (https://api2.onfire.so) to fetch real tasks, manage conversations/groups, and sync task completions.

## Features Implemented

### 1. Authentication System
- **Login Page**: Users enter their OnFire API credentials (email + password)
- **JWT Token Management**: Access tokens stored securely in localStorage
- **Protected Routes**: Dashboard only accessible after successful authentication
- **Logout Functionality**: Clears tokens and redirects to login

### 2. Conversation/Group Selection
- **Dropdown Selector**: After login, users can select which conversation/group to view tasks from
- **Auto-selection**: First conversation is automatically selected by default
- **Refresh Button**: Reload conversations list on demand
- **Group Filtering**: Only shows group-type conversations from the API

### 3. Real-time Task Management
- **API Integration**: Tasks fetched from OnFire API based on selected conversation
- **Task Display**: Shows active tasks with cover images, titles, and estimated completion coins
- **Dynamic People List**: Automatically extracts assignees from tasks to build the people roster
- **Task Completion**: Clicking an avatar marks the task as completed and syncs with API
- **Task Uncomplete**: Click on completed task thumbnails to undo completion

### 4. Progress Tracking
- **Earnings Progress**: Vertical bar charts showing daily, weekly, and monthly progress
- **Coins Calculation**: Based on task's estimated_time_minutes (10 minutes = 1 coin)
- **Real-time Updates**: Progress bars update immediately after task completion
- **Per-person Tracking**: Each team member has their own progress visualization

### 5. Completed Tasks Gallery
- **Organized by Person**: Completed tasks grouped by who completed them
- **Thumbnail Gallery**: Horizontal scrollable gallery with task images
- **Time Stamps**: Shows how long ago each task was completed
- **Interactive**: Click to undo completion within reasonable timeframe

## API Endpoints Used

### Authentication
```
POST https://api2.onfire.so/rpc/login_user
Body: { "p_email": "user@example.com", "p_password": "password" }
Returns: { access_token, refresh_token, user_data }
```

### Conversations
```
POST https://api2.onfire.so/rpc/get_user_conversations
Body: { "p_conversation_type": "group" }
Headers: Authorization: Bearer {token}
Returns: Array of conversation objects
```

### Tasks
```
GET https://api2.onfire.so/tasks?chat_id=eq.{conversation_id}&order=created_at.desc
Headers: Authorization: Bearer {token}
Returns: Array of task objects
```

### Update Task (Complete/Uncomplete)
```
PATCH https://api2.onfire.so/tasks?id=eq.{task_id}
Body: { status: "completed", completed_by_user_id: "user-id", progress_percentage: 100 }
Headers: Authorization: Bearer {token}
```

## File Structure

```
/app/frontend/src/
├── services/
│   └── api.js                  # OnFire API service class
├── pages/
│   ├── Login.js                # Login page component
│   ├── Login.css               # Login page styles
│   ├── Dashboard.js            # Dashboard with conversation selector
│   ├── Dashboard.css           # Dashboard styles
│   ├── TaskManagementHUD.js    # Main task management interface
│   └── TaskManagementHUD.css   # Task HUD styles
├── components/ui/              # Shadcn UI components
└── App.js                      # Main app with routing
```

## How to Use

### Step 1: Login
1. Navigate to the app (http://localhost:3000)
2. Enter your OnFire API email and password
3. Click "Sign In"

### Step 2: Select Conversation
1. After login, you'll see the dashboard header
2. Use the "Select Group" dropdown to choose a conversation
3. The dropdown shows all your group conversations from OnFire

### Step 3: View and Complete Tasks
1. Tasks from the selected conversation are displayed in cards
2. Each task shows:
   - Cover image
   - Title
   - Coin value (based on estimated time)
   - Avatar buttons for each team member
3. Click an avatar to mark the task as completed by that person
4. A success modal with confetti animation appears
5. The task moves to the "Completed Tasks" section

### Step 4: Track Progress
1. The "Earnings Progress" section shows bar charts for each person
2. Bars represent progress for Day (D), Week (W), and Month (M)
3. Updates automatically when tasks are completed

### Step 5: Manage Completed Tasks
1. Scroll to "Completed Tasks" section
2. View completed tasks organized by person
3. Click on a task thumbnail to undo completion (if needed)

## Data Mapping

### Task Fields Used
- `id`: Unique task identifier
- `title`: Task name displayed on cards
- `description`: Additional task details
- `status`: Used to filter completed vs active tasks
- `cover_image_url`: Main task image
- `attachment_urls`: Fallback images if no cover
- `assignee_user_ids`: Array of assigned user IDs
- `completed_by_user_id`: Who completed the task
- `estimated_time_minutes`: Used to calculate coins
- `chat_id`: Links task to conversation
- `updated_at`: For "time ago" display

### People/Assignees
- Extracted from `assignee_user_ids` and `completed_by_user_id` fields
- Each unique user ID gets:
  - Unique color from palette
  - Initial letter (A, B, C, etc.)
  - Display name (User {first-8-chars-of-id})

### Coins Calculation
```javascript
coins = Math.ceil(task.estimated_time_minutes / 10)
// 30 minutes = 3 coins
// 60 minutes = 6 coins
```

## Security Notes

1. **Token Storage**: Access tokens stored in localStorage
2. **Token Expiration**: Tokens expire after 24 hours
3. **Protected Routes**: Dashboard requires authentication
4. **API Headers**: All API calls include Authorization bearer token

## Future Enhancements

Potential improvements:
1. Token refresh mechanism for expired tokens
2. User profile management
3. Create new tasks from the UI
4. Edit existing tasks
5. Task filtering and search
6. Notifications for task assignments
7. Export progress reports
8. Multi-language support
9. Mobile responsive improvements
10. Offline mode with sync

## Troubleshooting

### Issue: Login fails
- **Solution**: Verify OnFire API credentials are correct
- Check network console for API errors
- Ensure API endpoint is accessible

### Issue: No conversations showing
- **Solution**: Ensure your account has group conversations
- Check API response in browser console
- Verify conversation_type filter is correct

### Issue: Tasks not loading
- **Solution**: Verify conversation has associated tasks with chat_id
- Check task filters in API call
- Ensure tasks have required fields (id, title, etc.)

### Issue: Images not displaying
- **Solution**: Tasks need valid cover_image_url or attachment_urls
- Fallback image is provided if none exist
- Check CORS settings if external images fail

## Support

For OnFire API documentation and support:
- API Base URL: https://api2.onfire.so
- Documentation: See provided API_DOCUMENTATION_EMERGENT.md
- Conversation API: See conversation_api_docs.md

## License

This application integrates with the OnFire API. Ensure you have proper authorization and comply with OnFire's terms of service.
