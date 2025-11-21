# related_entity_id Fix

## Issue Found

The transaction creation was failing with:

```
Error: invalid input syntax for type integer: "c5b66750-64db-4486-ac3a-96172a787c8a"
```

## Root Cause

The `related_entity_id` field in the `transactions` table expects an **INTEGER**, but we were passing a **UUID string** (the task ID).

```javascript
// ❌ This fails
{
  related_entity_id: "c5b66750-64db-4486-ac3a-96172a787c8a"  // UUID string
}
```

## Database Schema

```sql
-- transactions table
related_entity_id INTEGER  -- expects integer, not UUID
```

The database was designed expecting an integer ID, but tasks use UUID primary keys.

## Solution

**Remove `related_entity_id` from transaction payload** and store the task reference in `metadata` instead:

```javascript
// ✅ This works
{
  transaction_type: 'send',
  status: 'completed',
  from_user_id: '...',
  to_user_id: '...',
  amount: 50,
  currency: 'PRF',
  // related_entity_id: NOT INCLUDED (would cause type error)
  related_entity_type: 'task',
  description: 'Payment for completing task: ...',
  notes: 'Task completed by ...',
  metadata: {
    task_id: "c5b66750-64db-4486-ac3a-96172a787c8a",  // Store UUID here
    task_title: "Clean Kitchen",
    completed_by: "...",
    conversation_id: "..."
  }
}
```

## Why This Works

1. **Metadata is flexible**: Can store any JSON structure
2. **No type constraint**: UUID strings work fine in metadata
3. **Related entity type still tracked**: `related_entity_type: 'task'` indicates it's task-related
4. **Task ID preserved**: Full UUID stored in `metadata.task_id`

## Comparison

### Your Working curl Command

```bash
curl -X POST "https://api2.onfire.so/transactions" \
  -d '{
    "transaction_type": "send",
    "status": "completed",
    "from_user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
    "to_user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
    "amount": 50,
    "currency": "PRF",
    "fee": 0,
    "net_amount": 50,
    "related_entity_type": "task",
    "description": "Test PROOF transaction",
    "notes": "Testing"
  }'
```

**Note**: No `related_entity_id` field! That's why it worked.

### Previous App Payload (Failed)

```javascript
{
  transaction_type: 'send',
  status: 'completed',
  from_user_id: '...',
  to_user_id: '...',
  amount: 50,
  currency: 'PRF',
  related_entity_id: "c5b66750-64db-4486-ac3a-96172a787c8a",  // ❌ Type error
  related_entity_type: 'task',
  description: '...',
  notes: '...'
}
```

**Error**: Database expected integer for `related_entity_id`, got UUID string.

### Fixed App Payload (Works)

```javascript
{
  transaction_type: 'send',
  status: 'completed',
  from_user_id: '...',
  to_user_id: '...',
  amount: 50,
  currency: 'PRF',
  // related_entity_id removed ✅
  related_entity_type: 'task',
  description: '...',
  notes: '...',
  metadata: {
    task_id: "c5b66750-64db-4486-ac3a-96172a787c8a"  // ✅ Stored here
  }
}
```

## Query Transactions by Task

Since the task ID is now in metadata, you can query it like this:

```bash
# Get transactions for a specific task
curl -X GET "https://api2.onfire.so/transactions?metadata->>task_id=eq.c5b66750-64db-4486-ac3a-96172a787c8a" \
  -H "Authorization: Bearer $TOKEN"
```

Or in JavaScript:

```javascript
// Find transactions for a task
const taskId = "c5b66750-64db-4486-ac3a-96172a787c8a";

fetch(`https://api2.onfire.so/transactions?related_entity_type=eq.task`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(transactions => {
  // Filter by task_id in metadata
  const taskTransactions = transactions.filter(tx => 
    tx.metadata?.task_id === taskId
  );
  console.log('Transactions for task:', taskTransactions);
});
```

## Additional Fix: Scoping Error

Also fixed the `payload is not defined` error by moving payload outside try-catch:

### Before (Error)
```javascript
try {
  const payload = { ... };
  // ... use payload
} catch (error) {
  console.error('Request payload was:', payload);  // ❌ ReferenceError
}
```

### After (Fixed)
```javascript
const payload = { ... };  // ✅ Defined in outer scope

try {
  // ... use payload
} catch (error) {
  console.error('Request payload was:', payload);  // ✅ Accessible
}
```

## Expected Console Output After Fix

When you complete a task, you should now see:

```
✅ Preparing transaction data...
✅ Task creator ID: b3dc6d78-37ff-4c83-b163-51c0d30af1d5
✅ Completer ID: b3dc6d78-37ff-4c83-b163-51c0d30af1d5
✅ Amount: 50
✅ Task ID: c5b66750-64db-4486-ac3a-96172a787c8a
✅ Transaction data prepared: {
  "from_user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
  "to_user_id": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
  "amount": 50,
  "fee": 0,
  "net_amount": 50,
  "related_entity_type": "task",
  "description": "Payment for completing task: Clean Kitchen",
  "notes": "Task completed by Alex",
  "metadata": {
    "task_id": "c5b66750-64db-4486-ac3a-96172a787c8a",
    "task_title": "Clean Kitchen",
    "completed_by": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5",
    "conversation_id": "..."
  }
}
✅ Creating transaction with payload: { ... }
✅ Transaction created successfully: [{ ... }]
```

## Database Design Note

The mismatch between `related_entity_id INTEGER` and task UUIDs suggests:

1. **Option A**: Database was designed for integer entity IDs
2. **Option B**: Different entity types (products, courses) use integer IDs
3. **Option C**: Field is optional and should be null for UUID entities

Our solution (store in metadata) works for all cases.

## Summary

✅ **Fixed:**
- Removed `related_entity_id` from payload (type mismatch)
- Task UUID now stored in `metadata.task_id`
- Fixed scoping error for `payload` variable

✅ **Benefits:**
- Transaction creation now works
- Task reference preserved in metadata
- No type errors
- Follows working curl example

✅ **Testing:**
- Complete a task
- Check console shows "Transaction created successfully"
- Query transactions API to verify record exists

---

*Last Updated: November 2025*
