# Transaction Flow Guide

## Overview
When a user completes a task, the system automatically creates a financial transaction to track payment for the completed work.

## Transaction Flow

```
User clicks avatar → Task marked complete → Transaction created → Task reloads → Modal closes
```

### Step-by-Step Process

1. **User Action**: User clicks on an avatar to mark task as completed
2. **Validation**: System checks if task and person exist, prevents duplicate submissions
3. **Show Modal**: Success modal appears immediately with confetti animation
4. **API Calls** (in sequence):
   - Mark task as completed (PATCH /tasks)
   - Create transaction record (POST /transactions)
5. **Reload Data**: After 3.5 seconds, reload tasks to reflect changes
6. **Close Modal**: Modal closes after 3 seconds

## Transaction Data Structure

### API Endpoint
```
POST https://api2.onfire.so/transactions
```

### Transaction Fields

| Field | Value | Description |
|-------|-------|-------------|
| `transaction_type` | `"send"` | Type of transaction (sending payment) |
| `status` | `"completed"` | Transaction completed successfully |
| `from_user_id` | Task creator's ID | Who pays (task creator) |
| `to_user_id` | Completer's ID | Who receives payment (person who completed) |
| `amount` | `task.budget_cost` | Payment amount from task budget |
| `currency` | `"PROOF"` | Currency code (PROOF tokens) |
| `fee` | `0` | Transaction fee (if any) |
| `net_amount` | `task.budget_cost` | Net amount after fees |
| `related_entity_type` | `"task"` | Entity type (task) |
| `related_entity_id` | `taskId` | Task ID reference |
| `description` | Task completion message | Human-readable description |
| `notes` | Who completed it | Additional notes |
| `metadata` | JSON object | Structured metadata |

### Example Transaction Payload

```json
{
  "transaction_type": "send",
  "status": "completed",
  "from_user_id": "creator-user-id-uuid",
  "to_user_id": "completer-user-id-uuid",
  "amount": 50,
  "currency": "PROOF",
  "fee": 0,
  "net_amount": 50,
  "related_entity_type": "task",
  "related_entity_id": "task-id-uuid",
  "description": "Payment for completing task: Clean Kitchen",
  "notes": "Task completed by Alex P.",
  "metadata": {
    "task_id": "task-id-uuid",
    "task_title": "Clean Kitchen",
    "completed_by": "completer-user-id-uuid",
    "conversation_id": "conversation-id-uuid"
  },
  "initiated_at": "2025-11-20T10:30:00Z",
  "completed_at": "2025-11-20T10:30:00Z",
  "created_at": "2025-11-20T10:30:00Z",
  "updated_at": "2025-11-20T10:30:00Z"
}
```

## Implementation Details

### 1. API Service (api.js)

```javascript
async createTransaction(transactionData) {
  const response = await axios.post(
    `${API_BASE_URL}/transactions`,
    {
      transaction_type: 'send',
      status: 'completed',
      from_user_id: transactionData.from_user_id,
      to_user_id: transactionData.to_user_id,
      amount: transactionData.amount,
      currency: 'PROOF',
      fee: transactionData.fee || 0,
      net_amount: transactionData.net_amount || transactionData.amount,
      related_entity_type: transactionData.related_entity_type || 'task',
      related_entity_id: transactionData.related_entity_id,
      description: transactionData.description || '',
      metadata: transactionData.metadata || {},
      notes: transactionData.notes || '',
      initiated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { headers: this.getAuthHeaders() }
  );
  return response.data;
}
```

### 2. Task Completion with Transaction (TaskManagementHUD.js)

```javascript
const completeTask = async (taskId, personId) => {
  const task = tasks.find(t => t.id === taskId);
  const person = people.find(p => p.id === personId);
  
  if (!task || !person) return;
  
  // Prevent duplicate calls
  if (showModal) return;
  
  const coins = Math.ceil((task.estimated_time_minutes || 30) / 10);
  const amount = task.budget_cost || coins;
  
  // Show success modal
  setModalData({ personName: person.name, taskTitle: task.title, coins });
  setShowModal(true);
  
  try {
    // 1. Mark task as completed
    await onFireAPI.completeTask(taskId, personId);
    
    // 2. Create transaction (type: send, currency: PROOF)
    await onFireAPI.createTransaction({
      from_user_id: task.created_by_user_id,
      to_user_id: personId,
      amount: amount,
      related_entity_id: taskId,
      description: `Payment for completing task: ${task.title}`,
      notes: `Task completed by ${person.name}`,
      metadata: {
        task_id: taskId,
        task_title: task.title,
        completed_by: personId,
        conversation_id: conversationId
      }
    });
    
    // 3. Reload tasks
    setTimeout(() => loadTasks(), 3500);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  // Close modal after 3 seconds
  setTimeout(() => setShowModal(false), 3000);
};
```

## Budget Cost Priority

The transaction amount is determined by:

1. **Primary**: `task.budget_cost` - Explicit budget set for the task
2. **Fallback**: Calculated coins based on `estimated_time_minutes`

```javascript
const amount = task.budget_cost || Math.ceil((task.estimated_time_minutes || 30) / 10);
```

## Duplicate Modal Prevention

### Problem
The modal was showing twice due to:
- Multiple state updates
- Task reload triggering re-renders
- No guard against duplicate clicks

### Solution
```javascript
// Prevent duplicate calls
if (showModal) return;

// Delay task reload until after modal displays
setTimeout(() => loadTasks(), 3500);
```

## Error Handling

### API Errors

```javascript
try {
  await onFireAPI.completeTask(taskId, personId);
  await onFireAPI.createTransaction(transactionData);
} catch (error) {
  console.error('Error completing task or creating transaction:', error);
  // Modal still closes even on error
  // Consider showing error message to user
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired | Re-authenticate user |
| 400 Bad Request | Missing required fields | Check transaction payload |
| 404 Not Found | Invalid task/user ID | Verify IDs exist |
| 500 Server Error | Database error | Retry or contact support |

## Transaction Verification

### Check Transaction Created

```javascript
// In browser console after completing task
console.log('Transaction created for task:', taskId);

// Manual API check
curl -X GET "https://api2.onfire.so/transactions?related_entity_id=eq.{taskId}" \
  -H "Authorization: Bearer $TOKEN"
```

### Expected Response

```json
[
  {
    "id": "transaction-uuid-here",
    "transaction_type": "buy",
    "status": "completed",
    "from_user_id": "creator-uuid",
    "to_user_id": "completer-uuid",
    "amount": 50,
    "currency": "USD",
    "related_entity_type": "task",
    "related_entity_id": "task-uuid",
    "description": "Payment for completing task: Clean Kitchen",
    "created_at": "2025-11-20T10:30:00Z"
  }
]
```

## Testing

### Manual Testing Steps

1. **Login** to the application
2. **Select a conversation** from dropdown
3. **View available tasks**
4. **Click an avatar** to complete a task
5. **Verify**:
   - Success modal shows once (not twice)
   - Modal displays correct name and task
   - Modal closes after 3 seconds
   - Task moves to completed section
   - Progress bars update

### Verify Transaction

```bash
# Get transactions for a specific task
TASK_ID="task-uuid-here"
curl -X GET "https://api2.onfire.so/transactions?related_entity_id=eq.$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Get transactions for a specific user (recipient)
USER_ID="user-uuid-here"
curl -X GET "https://api2.onfire.so/transactions?to_user_id=eq.$USER_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Console Logging

The application logs transaction creation:

```javascript
console.log('Task marked as completed');
console.log('Transaction created successfully');
```

Check browser console (F12) for these messages.

## Metadata Structure

The `metadata` field stores additional context:

```json
{
  "task_id": "task-uuid",
  "task_title": "Clean Kitchen",
  "completed_by": "user-uuid",
  "conversation_id": "conversation-uuid"
}
```

This allows for:
- Transaction history tracking
- Task completion analytics
- Conversation-level reporting
- User performance metrics

## Future Enhancements

### Potential Features

1. **Transaction Reversal**
   - Allow undoing transactions when uncompleting tasks
   - Track reversal history

2. **Partial Payments**
   - Split payments among multiple users
   - Percentage-based distribution

3. **Transaction Fees**
   - Platform fees for transactions
   - Calculate net_amount after fees

4. **Payment Methods**
   - Support different payment methods
   - External payment gateway integration

5. **Transaction History View**
   - User dashboard showing all transactions
   - Filter by date, amount, status
   - Export to CSV

6. **Balance Tracking**
   - User wallet/balance system
   - Real-time balance updates
   - Withdrawal functionality

## Troubleshooting

### Issue: Transaction Not Created

**Debug Steps:**
```javascript
// Check task has budget_cost
console.log('Task:', task);
console.log('Budget cost:', task.budget_cost);

// Check user IDs
console.log('From user:', task.created_by_user_id);
console.log('To user:', personId);

// Check API response
try {
  const result = await onFireAPI.createTransaction(data);
  console.log('Transaction result:', result);
} catch (error) {
  console.error('Transaction error:', error.response?.data);
}
```

### Issue: Modal Shows Twice

**Fixed by:**
- Guard condition: `if (showModal) return;`
- Delayed task reload: `setTimeout(() => loadTasks(), 3500);`
- Single state update pattern

### Issue: Wrong Transaction Amount

**Check:**
1. Task has `budget_cost` field
2. Fallback calculation is correct
3. Amount is not null/undefined

```javascript
const amount = task.budget_cost || Math.ceil((task.estimated_time_minutes || 30) / 10);
console.log('Transaction amount:', amount);
```

## API Requirements

### Required Fields in Task

For transaction creation, tasks must have:
- `id` - Task identifier
- `title` - Task name
- `created_by_user_id` - Creator (payer)
- `budget_cost` - Payment amount (or estimated_time_minutes for fallback)

### Task Query Update

The task query now includes `budget_cost`:

```javascript
select=id,title,description,status,priority,cover_image_url,attachment_urls,
       assignee_user_ids,completed_by_user_id,created_at,updated_at,
       chat_id,estimated_time_minutes,created_by_user_id,budget_cost
```

## Summary

✅ **Implemented:**
- Single modal display (no duplicates)
- Automatic transaction creation on task completion
- Payment from task creator to task completer
- Amount based on task budget_cost
- Metadata tracking for analytics
- Error handling and logging

🎯 **Key Features:**
- Prevents duplicate transactions
- Links transactions to tasks
- Tracks payment history
- Supports future reporting

📊 **Data Flow:**
- Task completion → Transaction creation → Data reload → UI update

---

*Last Updated: November 2025*
