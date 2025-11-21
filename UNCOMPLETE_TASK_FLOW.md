# Uncomplete Task Flow

## Overview

When a user taps on a completed task thumbnail in the completed section, the task status changes from `completed` to `not_started` and moves back to the available tasks section.

## User Flow

```
User taps completed task → Confirmation dialog → PATCH status to not_started → Move to active tasks
```

## Implementation

### 1. API Call (PATCH)

```javascript
async uncompleteTask(taskId) {
  return this.updateTask(taskId, {
    status: 'not_started',          // Change from 'completed' to 'not_started'
    completed_by_user_id: null,     // Clear who completed it
    progress_percentage: 0,         // Reset progress
    updated_at: new Date().toISOString()
  });
}
```

**Endpoint:**
```
PATCH https://api2.onfire.so/tasks?id=eq.{taskId}
```

**Payload:**
```json
{
  "status": "not_started",
  "completed_by_user_id": null,
  "progress_percentage": 0,
  "updated_at": "2025-11-21T12:30:00Z"
}
```

### 2. UI Update (Immediate)

```javascript
const uncompleteTask = async (taskId) => {
  // 1. Update API
  await onFireAPI.uncompleteTask(taskId);
  
  // 2. Find task in completed list
  const completedTask = completedTasks.find(t => t.id === taskId);
  
  // 3. Create reverted version
  const revertedTask = {
    ...completedTask,
    status: 'not_started',
    completed_by_user_id: null,
    progress_percentage: 0
  };
  
  // 4. Remove from completed section
  setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
  
  // 5. Add back to active tasks (at beginning)
  setTasks(prev => [revertedTask, ...prev]);
};
```

## Status Values

### Task Status Lifecycle

```
not_started → in_progress → completed → not_started (uncomplete)
```

| Status | Description | When Set |
|--------|-------------|----------|
| `not_started` | Task hasn't been started yet | Initial state, after uncomplete |
| `in_progress` | Task is being worked on | Manual update (not used in current app) |
| `completed` | Task is finished | When user completes task |

### Why "not_started" Instead of "pending"

The database likely uses `not_started` as the initial status for tasks that haven't been touched yet. Using `not_started` when uncompleting maintains consistency with the original state.

## User Experience

### Click Flow

1. **User sees completed task thumbnail**
   ```
   [Completed Section]
   Alex
   5 total
   [Thumbnail 1] [Thumbnail 2] [Thumbnail 3]
   ```

2. **User clicks thumbnail**
   - Task immediately disappears from completed section
   - Task reappears in available tasks section
   - Progress bars update (coins decrease)
   - No confirmation dialog (instant action)

### Visual Feedback

**Before Uncomplete:**
```
Available Tasks: 7 tasks
Completed Tasks: Alex (3 tasks)
```

**After Uncomplete:**
```
Available Tasks: 8 tasks
Completed Tasks: Alex (2 tasks)
```

## Code Flow

### handleTaskThumbnailClick

```javascript
const handleTaskThumbnailClick = (task) => {
  // Directly uncomplete without confirmation - instant action
  uncompleteTask(task.id);
};
```

### State Updates

```javascript
// Remove from completed
setCompletedTasks(prevCompleted => 
  prevCompleted.filter(t => t.id !== taskId)
);

// Add back to active (at start of array)
setTasks(prevTasks => 
  [revertedTask, ...prevTasks]
);
```

Using `[revertedTask, ...prevTasks]` adds the task to the beginning of the active list, making it easily visible.

## Error Handling

```javascript
try {
  await onFireAPI.uncompleteTask(taskId);
  // Update UI
} catch (error) {
  console.error('Error uncompleting task:', error);
  // Revert by reloading from API
  loadTasks();
}
```

If the API call fails:
1. Error is logged to console
2. Full data reload ensures UI matches server state
3. User sees the task return to completed section

## Console Logs

When uncompleting a task:

```
Uncompleting task: c5b66750-64db-4486-ac3a-96172a787c8a
Task status changed to not_started
UI updated - task moved back to active section
```

## Differences: Complete vs Uncomplete

### Complete Task
- Status: `not_started` → `completed`
- Shows success modal
- Creates transaction
- Adds `completed_by_user_id`
- Moves to completed section

### Uncomplete Task
- Status: `completed` → `not_started`
- No modal (silent action)
- No transaction reversal (transactions remain)
- Clears `completed_by_user_id`
- Moves to active section

## Transaction Handling

**Important:** Uncompleting a task CREATES a reversal transaction.

### Reversal Transaction

When a task is uncompleted, a new transaction is created with `transaction_type: 'unsend'` and **negative amount**:

```javascript
const reversalData = {
  from_user_id: completedTask.created_by_user_id,  // Same as original
  to_user_id: completedTask.completed_by_user_id,  // Same as original
  amount: -amount,                                  // NEGATIVE amount (e.g., -3)
  currency: 'PRF',
  fee: 0,
  net_amount: -amount,                              // NEGATIVE net amount
  related_entity_type: 'task',
  description: `Reversal for uncompleted task: ${task.title}`,
  notes: `Task uncompleted by ${person.name}`,
  metadata: {
    task_id: taskId,
    task_title: task.title,
    uncompleted_by: completed_by_user_id,
    conversation_id: conversationId,
    reversal: true
  }
};

await createReversalTransaction(reversalData);
```

### Transaction Types

| Type | When Created | Amount | Direction | Purpose |
|------|-------------|--------|-----------|---------|
| `send` | Task completed | Positive (+50) | creator → completer | Payment for work |
| `unsend` | Task uncompleted | Negative (-50) | creator → completer | Reversal/refund |

**Key Difference:** The negative amount in `unsend` transactions automatically reverses the balance when calculating totals.

## Testing

### Test Steps

1. Complete a task (creates transaction, moves to completed)
2. Click on completed task thumbnail
3. Confirm removal
4. Verify:
   - ✅ Task disappears from completed section
   - ✅ Task appears in active section
   - ✅ Progress bars update (coins decrease)
   - ✅ Person's total coins decrease
   - ✅ Can complete the same task again
   - ✅ Console shows logs

### Expected Behavior

**Completed task thumbnail click:**
- Task moves immediately (no confirmation)
- Instant feedback, no delays
- No page refresh needed
- Can be completed again right away

**Progress update:**
- Person's coin total decreases
- Progress bars shrink proportionally
- If person has no more completed tasks, they disappear from completed section

## API Request Example

```bash
# Uncomplete a task
curl -X PATCH "https://api2.onfire.so/tasks?id=eq.c5b66750-64db-4486-ac3a-96172a787c8a" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "not_started",
    "completed_by_user_id": null,
    "progress_percentage": 0,
    "updated_at": "2025-11-21T12:30:00Z"
  }'
```

## Summary

✅ **Implemented:**
- PATCH request to update task status to `not_started`
- Immediate UI update (optimistic)
- No confirmation dialog (instant action)
- Console logging for debugging
- Error recovery with full reload

🎯 **Key Points:**
- Status changes to `not_started` (not `pending`)
- `completed_by_user_id` set to `null`
- Task moves from completed to active section
- Creates reversal transaction with type `unsend`
- Instant visual feedback

🔄 **Reversible:**
- User can uncomplete and re-complete tasks
- Each completion creates a new transaction
- History is maintained in transactions table

---

*Last Updated: November 2025*
