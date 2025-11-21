# Transaction Creation Checklist

## What to Check After Tapping Avatar

When you tap an avatar to complete a task, open the browser console (F12) and look for these logs in order:

### Expected Console Output Sequence

```
1. ✅ Preparing transaction data...
2. ✅ Task creator ID: b3dc6d78-37ff-4c83-b163-51c0d30af1d5
3. ✅ Completer ID: b3dc6d78-37ff-4c83-b163-51c0d30af1d5
4. ✅ Amount: 50
5. ✅ Task ID: some-task-uuid
6. ✅ Transaction data prepared: { ... }
7. ✅ Creating transaction with payload: { ... }
8. ✅ Transaction created successfully: { ... }
```

### If Transaction Fails

Look for these error patterns:

#### Missing Creator ID
```
❌ Cannot create transaction: task.created_by_user_id is missing
Full task object: { ... }
```

**Solution**: Task doesn't have `created_by_user_id` field. Check task query includes this field.

#### Missing Completer ID
```
❌ Cannot create transaction: personId is missing
```

**Solution**: Avatar click didn't pass correct user ID.

#### Invalid Amount
```
❌ Cannot create transaction: invalid amount undefined
```

**Solution**: Task doesn't have `budget_cost` and `estimated_time_minutes` is also missing.

#### API Error
```
❌ Transaction creation failed: Request failed with status code 400
Error response: { ... }
```

**Solution**: Check the error response for details about which field is invalid.

## Quick Debug Commands

### Run in Browser Console

```javascript
// 1. Check if token is valid
console.log('Token:', localStorage.getItem('onfire_access_token'));

// 2. Test transaction creation manually
const testTransaction = {
  transaction_type: 'send',
  status: 'completed',
  from_user_id: 'b3dc6d78-37ff-4c83-b163-51c0d30af1d5',
  to_user_id: 'b3dc6d78-37ff-4c83-b163-51c0d30af1d5',
  amount: 50,
  currency: 'PRF',
  fee: 0,
  net_amount: 50,
  related_entity_type: 'task',
  description: 'Test from console',
  notes: 'Testing'
};

fetch('https://api2.onfire.so/transactions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('onfire_access_token')}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify(testTransaction)
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => console.log('Result:', data))
.catch(err => console.error('Error:', err));

// 3. Check task data structure
// (After selecting a task, this should be logged automatically)
```

## Network Tab Check

1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "transactions"
4. Complete a task
5. Look for POST request to `/transactions`

### Check Request

**Headers:**
```
Authorization: Bearer eyJhbGci...
Content-Type: application/json
Prefer: return=representation
```

**Payload (should look like):**
```json
{
  "transaction_type": "send",
  "status": "completed",
  "from_user_id": "b3dc6d78-...",
  "to_user_id": "b3dc6d78-...",
  "amount": 50,
  "currency": "PRF",
  "fee": 0,
  "net_amount": 50,
  "related_entity_type": "task",
  "related_entity_id": "task-uuid",
  "description": "Payment for completing task: ...",
  "notes": "Task completed by ..."
}
```

### Check Response

**Success (201 Created):**
```json
[{
  "id": "generated-uuid",
  "transaction_type": "send",
  "status": "completed",
  ...
}]
```

**Error (400 Bad Request):**
```json
{
  "code": "PGRST...",
  "details": "...",
  "hint": "...",
  "message": "..."
}
```

## Validation Points

### Before Transaction Creation

The app now validates:

1. ✅ `task.created_by_user_id` exists and is not null
2. ✅ `personId` exists and is not null
3. ✅ `amount` is greater than 0
4. ✅ `taskId` is present

If any validation fails, transaction won't be attempted and error logged.

## Working curl vs App Comparison

### Your Working curl
```bash
curl -X POST "https://api2.onfire.so/transactions" \
  -H "Authorization: Bearer ..." \
  -H "Prefer: return=representation" \
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
    "notes": "Testing transaction creation"
  }'
```

**Note**: No `related_entity_id` field!

### App Payload (Updated)
```javascript
{
  "transaction_type": "send",
  "status": "completed",
  "from_user_id": "...",
  "to_user_id": "...",
  "amount": 50,
  "currency": "PRF",
  "fee": 0,
  "net_amount": 50,
  "related_entity_type": "task",
  "related_entity_id": "task-uuid",  // Optional, only if present
  "description": "...",
  "notes": "..."
}
```

**Changes Made:**
1. `related_entity_id` is now optional
2. Only added if `transactionData.related_entity_id` exists
3. Converted to string to ensure correct format

## Testing Steps

### Step 1: Complete a Task
1. Login to app
2. Select a conversation
3. Click an avatar on a task
4. Watch console

### Step 2: Verify Logs
Check console shows:
- ✅ "Preparing transaction data..."
- ✅ Task creator ID logged
- ✅ Completer ID logged
- ✅ Amount logged
- ✅ "Transaction data prepared:"
- ✅ "Creating transaction with payload:"
- ✅ "✅ Transaction created successfully:"

### Step 3: Verify Network
Check Network tab shows:
- POST to /transactions
- Status 201 Created
- Response includes transaction ID

### Step 4: Verify Result
```javascript
// Check transaction was created
fetch('https://api2.onfire.so/transactions?order=created_at.desc&limit=1', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('onfire_access_token')}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('Latest transaction:', data));
```

## Common Issues

### Issue 1: No POST Request Visible
**Cause**: JavaScript error before fetch
**Solution**: Check console for errors before transaction attempt

### Issue 2: 401 Unauthorized
**Cause**: Token expired
**Solution**: Logout and login again

### Issue 3: 400 Bad Request
**Cause**: Invalid field value
**Solution**: Check error response for which field is wrong

### Issue 4: Silent Failure
**Cause**: Validation failed before API call
**Solution**: Check console for validation error messages

### Issue 5: CORS Error
**Cause**: Browser blocking request
**Solution**: Check if API allows requests from localhost

## Changes Made to Fix Transaction Creation

### 1. Made `related_entity_id` Optional
```javascript
// Only add if it's provided and valid
if (transactionData.related_entity_id) {
  payload.related_entity_id = String(transactionData.related_entity_id);
}
```

### 2. Added Validation
```javascript
if (!task.created_by_user_id) {
  console.error('Cannot create transaction: task.created_by_user_id is missing');
  return;
}
```

### 3. Enhanced Logging
```javascript
console.log('Creating transaction with payload:', JSON.stringify(payload, null, 2));
```

### 4. Better Error Handling
```javascript
try {
  const result = await onFireAPI.createTransaction(transactionData);
  console.log('✅ Transaction created successfully:', result);
} catch (txError) {
  console.error('❌ Transaction creation failed:', txError.message);
}
```

## Next Steps

1. Complete a task in the app
2. Copy all console output
3. Copy Network tab request/response
4. Share logs to identify exact issue

The enhanced logging will show exactly where the process succeeds or fails.

---

*Last Updated: November 2025*
