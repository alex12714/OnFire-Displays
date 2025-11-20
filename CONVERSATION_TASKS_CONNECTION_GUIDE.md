# Conversation-Tasks Connection Guide

## Overview
This guide explains how conversations (groups) are connected to tasks in the Task Management HUD application.

## Connection Architecture

### How It Works

```
User Login → Fetch Conversations → Select Conversation → Fetch Tasks (filtered by chat_id)
```

### Data Flow Diagram

```
┌─────────────────┐
│  User Logs In   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Dashboard Component            │
│  - Fetches all conversations    │
│  - User selects one             │
└────────┬────────────────────────┘
         │
         │ conversationId passed as prop
         ▼
┌─────────────────────────────────┐
│  TaskManagementHUD Component    │
│  - Receives conversationId      │
│  - Fetches tasks filtered by:   │
│    chat_id=conversationId        │
└─────────────────────────────────┘
```

## API Endpoints Used

### 1. Fetch Conversations
```javascript
GET https://api2.onfire.so/conversations
```

**Query Parameters:**
- `status=eq.active` - Only active conversations
- `order=last_message_at.desc,created_at.desc` - Most recent first
- `select=id,name,conversation_type,status,description,avatar,message_count,last_message_at,created_at`

**Response Example:**
```json
[
  {
    "id": "1e8de783-044a-4d30-b98c-4bc59ea19734",
    "name": "Family Tasks",
    "conversation_type": "group",
    "status": "active",
    "message_count": 15,
    "last_message_at": "2025-11-20T10:30:00Z",
    "created_at": "2025-11-12T20:21:46Z"
  }
]
```

### 2. Fetch Tasks by Conversation
```javascript
GET https://api2.onfire.so/tasks?chat_id=eq.{conversationId}
```

**Query Parameters:**
- `chat_id=eq.{conversationId}` - **CRITICAL FILTER** - Links tasks to conversation
- `select=id,title,description,status,priority,cover_image_url,attachment_urls,assignee_user_ids,completed_by_user_id,created_at,updated_at,chat_id,estimated_time_minutes`
- `order=created_at.desc` - Newest first

**Response Example:**
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Clean Kitchen",
    "description": "Deep clean the kitchen and organize pantry",
    "status": "pending",
    "priority": 5,
    "cover_image_url": "https://example.com/image.jpg",
    "chat_id": "1e8de783-044a-4d30-b98c-4bc59ea19734",
    "assignee_user_ids": ["user-id-1", "user-id-2"],
    "completed_by_user_id": null,
    "estimated_time_minutes": 60,
    "created_at": "2025-11-20T08:00:00Z",
    "updated_at": "2025-11-20T08:00:00Z"
  }
]
```

## Key Implementation Details

### 1. Conversation Selection (Dashboard.js)

```javascript
const [selectedConversation, setSelectedConversation] = useState(null);
const [conversations, setConversations] = useState([]);

// Load conversations on mount
useEffect(() => {
  loadConversations();
}, []);

// Auto-select first conversation
const loadConversations = async () => {
  const convos = await onFireAPI.getConversations();
  setConversations(convos);
  
  if (convos.length > 0 && !selectedConversation) {
    setSelectedConversation(convos[0].id); // Auto-select first
  }
};
```

### 2. Task Loading (TaskManagementHUD.js)

```javascript
// Reload tasks when conversation changes
useEffect(() => {
  if (conversationId) {
    loadTasks();
  }
}, [conversationId]);

const loadTasks = async () => {
  // Fetch tasks filtered by conversation
  const apiTasks = await onFireAPI.getTasks(conversationId);
  
  // Separate active and completed
  const completed = apiTasks.filter(t => t.status === 'completed');
  const active = apiTasks.filter(t => t.status !== 'completed');
  
  setTasks(active);
  setCompletedTasks(completed);
};
```

### 3. API Service (api.js)

```javascript
async getTasks(conversationId) {
  let url = `${API_BASE_URL}/tasks?select=id,title,description,...`;
  
  // CRITICAL: Filter by chat_id
  if (conversationId) {
    url += `&chat_id=eq.${conversationId}`;
  }
  
  url += '&order=created_at.desc';
  
  const response = await axios.get(url, {
    headers: this.getAuthHeaders()
  });
  
  return response.data;
}
```

## Critical Fields

### Conversation Object
| Field | Purpose |
|-------|---------|
| `id` | **PRIMARY KEY** - Used to filter tasks |
| `name` | Display name in dropdown |
| `conversation_type` | Determines icon (group/channel/one_on_one) |
| `message_count` | Shows activity level |
| `status` | Only 'active' conversations shown |

### Task Object
| Field | Purpose |
|-------|---------|
| `chat_id` | **FOREIGN KEY** - Links to conversation.id |
| `id` | Unique task identifier |
| `title` | Task name |
| `status` | Active vs completed filter |
| `assignee_user_ids` | Array of assigned users |
| `completed_by_user_id` | Who completed it |

## Troubleshooting

### Issue: No Conversations Appear

**Problem:** Dropdown is empty

**Solutions:**
1. Check authentication - token might be expired
2. Verify user has conversations in the system
3. Check browser console for API errors
4. Verify API endpoint is accessible

**Debug Commands:**
```javascript
// In browser console
console.log(localStorage.getItem('onfire_access_token'));
console.log(localStorage.getItem('onfire_user_data'));
```

### Issue: No Tasks Appear

**Problem:** Tasks section shows "No active tasks found"

**Possible Causes:**
1. **Tasks not linked to conversation** - `chat_id` doesn't match
2. **Wrong conversation selected**
3. **All tasks are completed** (check completed section)
4. **Tasks exist but filter is wrong**

**Debug Steps:**
```javascript
// Check what's being fetched
console.log('Conversation ID:', conversationId);
console.log('Loaded tasks:', apiTasks);

// Verify task has correct chat_id
// In OnFire system, ensure task.chat_id === conversation.id
```

**Manual Verification:**
```bash
# Get conversation ID
CONV_ID="your-conversation-id"

# Check if tasks exist for this conversation
curl -X GET "https://api2.onfire.so/tasks?chat_id=eq.$CONV_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: Tasks Show for Wrong Conversation

**Problem:** Tasks from multiple conversations appear

**Solution:** Verify the `chat_id` filter is being applied correctly

```javascript
// In TaskManagementHUD.js
console.log('Fetching tasks for:', conversationId);

// In api.js getTasks method
console.log('Full URL:', url);
// Should see: ...tasks?...&chat_id=eq.{conversationId}
```

### Issue: Dropdown Hidden Behind Content

**Problem:** Select dropdown menu not visible

**Solution:** Already fixed with z-index CSS

```css
/* In Dashboard.css */
[data-radix-portal] {
  z-index: 9999 !important;
}

[data-radix-popper-content-wrapper] {
  z-index: 9999 !important;
}
```

## Data Requirements

### Setting Up Tasks in OnFire

To ensure tasks appear correctly:

1. **Create a conversation** (group/channel/one_on_one)
2. **Create tasks and set the `chat_id` field**:
   ```json
   {
     "title": "Task Name",
     "description": "Task description",
     "chat_id": "conversation-id-here",
     "status": "pending",
     "estimated_time_minutes": 60
   }
   ```

3. **Assign users** (optional):
   ```json
   {
     "assignee_user_ids": ["user-id-1", "user-id-2"]
   }
   ```

### Verifying the Connection

```bash
# 1. Get your conversations
GET /conversations

# 2. Pick a conversation ID from the response
CONV_ID="1e8de783-044a-4d30-b98c-4bc59ea19734"

# 3. Check tasks for that conversation
GET /tasks?chat_id=eq.$CONV_ID

# 4. If empty, create a test task
POST /tasks
{
  "title": "Test Task",
  "chat_id": "1e8de783-044a-4d30-b98c-4bc59ea19734",
  "status": "pending"
}
```

## Component Communication Flow

```
┌──────────────────────────────────────────────────┐
│              App.js (Router)                      │
│  ┌─────────────────────────────────────────────┐ │
│  │   Login.js                                   │ │
│  │   - Authenticates user                       │ │
│  │   - Stores token                             │ │
│  │   - Redirects to /dashboard                  │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────┐
│              Dashboard.js                         │
│  ┌─────────────────────────────────────────────┐ │
│  │ Header                                       │ │
│  │  - Welcome message                           │ │
│  │  - Conversation selector dropdown            │ │
│  │  - Refresh button                            │ │
│  │  - Logout button                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ TaskManagementHUD                            │ │
│  │  Props: { conversationId }                   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────┐
│        TaskManagementHUD.js                       │
│  ┌─────────────────────────────────────────────┐ │
│  │ Conversation Info Panel                      │ │
│  │  - Shows current conversation ID             │ │
│  │  - Task statistics                           │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ Progress Section                             │ │
│  │  - Per-person earnings bars                  │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ Available Tasks Grid                         │ │
│  │  - Filtered by conversationId                │ │
│  │  - Click avatar to complete                  │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ Completed Tasks Gallery                      │ │
│  │  - Grouped by person                         │ │
│  │  - Click thumbnail to undo                   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Console Logging for Debugging

The application includes comprehensive console logging:

```javascript
// Dashboard.js
console.log('Loaded conversations:', convos);

// TaskManagementHUD.js
console.log('Loading tasks for conversation:', conversationId);
console.log('Loaded tasks:', apiTasks);
console.log(`Found ${active.length} active tasks and ${completed.length} completed tasks`);
console.log('Generated people list:', peopleList);
```

**To view logs:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for the above messages
4. Verify data is loading correctly

## Testing Checklist

- [ ] User can log in successfully
- [ ] Conversations appear in dropdown
- [ ] Dropdown shows conversation names (not just IDs)
- [ ] Dropdown shows conversation types (emoji icons)
- [ ] Dropdown shows message counts
- [ ] Selecting a conversation triggers task reload
- [ ] Tasks appear for selected conversation
- [ ] Tasks have correct chat_id
- [ ] No tasks from other conversations appear
- [ ] Completing a task syncs to API
- [ ] Task moves to completed section
- [ ] Progress bars update correctly
- [ ] People list shows correct users
- [ ] Console logs show correct data
- [ ] Error messages display when no data found

## Production Deployment Notes

Before deploying to production:

1. **Remove console.log statements** (optional for security)
2. **Add error reporting** (e.g., Sentry, LogRocket)
3. **Implement token refresh** for expired tokens
4. **Add loading states** for better UX
5. **Implement retry logic** for failed API calls
6. **Add analytics** to track conversation/task usage
7. **Optimize API calls** (caching, debouncing)
8. **Test with large datasets** (100+ conversations, 1000+ tasks)

## Support

For issues or questions:
- Check browser console for errors
- Verify API responses in Network tab
- Review this guide's troubleshooting section
- Check OnFire API documentation
- Contact development team

---

*Last Updated: November 2025*
