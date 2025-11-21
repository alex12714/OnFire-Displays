# Transaction Creation Debug Guide

## Current Implementation

### What Happens When Task is Completed

1. User clicks avatar on task card
2. `completeTask()` function is called
3. Task is marked as completed (PATCH /tasks)
4. Transaction is created (POST /transactions)
5. Console logs the result

## Debug Steps

### Step 1: Check Browser Console

After completing a task, you should see these logs in order:

```javascript
// 1. Transaction data being prepared
Creating transaction: {
  from_user_id: "...",
  to_user_id: "...",
  amount: 50,
  fee: 0,
  net_amount: 50,
  related_entity_type: "task",
  related_entity_id: "...",
  description: "Payment for completing task: ...",
  notes: "Task completed by ...",
  metadata: {...}
}

// 2. Payload being sent to API
Creating transaction with payload: {
  transaction_type: "send",
  status: "completed",
  from_user_id: "...",
  to_user_id: "...",
  amount: 50,
  currency: "PROOF",
  fee: 0,
  net_amount: 50,
  related_entity_type: "task",
  related_entity_id: "...",
  description: "...",
  notes: "..."
}

// 3. Success response
Transaction created successfully: {...}

// OR Error response
Error creating transaction: Error: ...
Error response: {...}
Error status: 400 (or other error code)
```

### Step 2: Check Network Tab

1. Open DevTools (F12)
2. Go to Network tab
3. Complete a task
4. Look for request to `/transactions`
5. Check:
   - Request Method: `POST`
   - Request URL: `https://api2.onfire.so/transactions`
   - Status Code: Should be `201 Created`
   - Request Headers: Should include `Authorization: Bearer ...`
   - Request Payload: Check the JSON being sent
   - Response: Check what the API returns

### Step 3: Common Error Responses

#### 400 Bad Request
```json
{
  "code": "PGRST102",
  "details": "...",
  "hint": "...",
  "message": "..."
}
```

**Possible Causes:**
- Missing required fields
- Invalid field types
- Database constraint violation

**Solution:**
- Check which field is mentioned in error
- Verify field names match database schema
- Check field values are correct type

#### 401 Unauthorized
```json
{
  "message": "JWT expired"
}
```

**Solution:**
- Re-login to get fresh token
- Check token is being sent in Authorization header

#### 404 Not Found
```
Cannot POST /transactions
```

**Solution:**
- Endpoint doesn't exist or is disabled
- Check API base URL is correct
- Verify you have access to transactions table

#### 422 Unprocessable Entity
```json
{
  "code": "22P02",
  "details": "invalid input syntax for type uuid",
  "message": "..."
}
```

**Possible Causes:**
- Invalid UUID format for user IDs
- String sent where number expected
- Invalid enum value (e.g., wrong transaction_type)

**Solution:**
- Verify `from_user_id` and `to_user_id` are valid UUIDs
- Check `amount` is a number
- Verify `transaction_type` is accepted by database

## Test Transaction Manually

### Using curl

```bash
# Set your token
TOKEN="your-jwt-token-here"

# Test transaction creation
curl -X POST "https://api2.onfire.so/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "transaction_type": "send",
    "status": "completed",
    "from_user_id": "creator-user-uuid",
    "to_user_id": "completer-user-uuid",
    "amount": 50,
    "currency": "PROOF",
    "fee": 0,
    "net_amount": 50,
    "related_entity_type": "task",
    "related_entity_id": "task-uuid",
    "description": "Test transaction",
    "notes": "Testing"
  }' \
  -v
```

### Expected Successful Response

**Status Code**: `201 Created`

**Headers**:
```
Content-Type: application/json
Location: /transactions?id=eq.{new-transaction-id}
```

**Body**:
```json
[{
  "id": "generated-uuid",
  "transaction_type": "send",
  "status": "completed",
  "from_user_id": "creator-user-uuid",
  "to_user_id": "completer-user-uuid",
  "amount": 50,
  "currency": "PROOF",
  "fee": 0,
  "net_amount": 50,
  "related_entity_type": "task",
  "related_entity_id": "task-uuid",
  "description": "Test transaction",
  "notes": "Testing",
  "created_at": "2025-11-20T10:30:00Z",
  "updated_at": "2025-11-20T10:30:00Z"
}]
```

## Verify Transaction Was Created

### Method 1: Browser Console

```javascript
// Get the task ID you just completed
const taskId = "your-task-id";

// Check if transaction exists
const response = await fetch(
  `https://api2.onfire.so/transactions?related_entity_id=eq.${taskId}`,
  {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('onfire_access_token')}`,
      'Content-Type': 'application/json'
    }
  }
);

const transactions = await response.json();
console.log('Transactions for task:', transactions);
```

### Method 2: curl

```bash
# Get transactions for a specific task
TASK_ID="your-task-id"
curl -X GET "https://api2.onfire.so/transactions?related_entity_id=eq.$TASK_ID" \
  -H "Authorization: Bearer $TOKEN"

# Get recent transactions
curl -X GET "https://api2.onfire.so/transactions?order=created_at.desc&limit=5" \
  -H "Authorization: Bearer $TOKEN"

# Get transactions by type and currency
curl -X GET "https://api2.onfire.so/transactions?transaction_type=eq.send&currency=eq.PROOF" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Issues and Solutions

### Issue 1: related_entity_id Type Mismatch

**Error**: `invalid input syntax for type bigint` or `invalid input syntax for type uuid`

**Cause**: The `related_entity_id` field might expect a different type

**Solution**: Check the database schema for transactions table

```sql
-- Check the transactions table schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
  AND column_name = 'related_entity_id';
```

If it expects a UUID (not string), ensure task IDs are UUIDs.
If it expects an integer, you'll need to convert or use a different field.

### Issue 2: Missing Database Columns

**Error**: `column "metadata" of relation "transactions" does not exist`

**Cause**: The field doesn't exist in the database

**Solution**: Remove fields that don't exist or update database schema

```javascript
// Remove metadata if column doesn't exist
const payload = {
  transaction_type: 'send',
  status: 'completed',
  from_user_id: transactionData.from_user_id,
  to_user_id: transactionData.to_user_id,
  amount: transactionData.amount,
  currency: 'PROOF',
  // ... other fields only
  // metadata: ... // Remove if column doesn't exist
};
```

### Issue 3: Invalid Enum Values

**Error**: `invalid input value for enum transaction_type: "send"`

**Cause**: Database doesn't recognize "send" as valid transaction_type

**Solution**: Check what values are accepted

```sql
-- Check enum values
SELECT unnest(enum_range(NULL::transaction_type));
```

Common valid values might be: `transfer`, `payment`, `deposit`, `withdrawal`

Try changing to:
```javascript
transaction_type: 'transfer', // or 'payment'
```

### Issue 4: Foreign Key Constraint

**Error**: `insert or update on table "transactions" violates foreign key constraint`

**Cause**: `from_user_id` or `to_user_id` doesn't exist in users table

**Solution**: Verify user IDs exist

```javascript
// Log user IDs before creating transaction
console.log('From user:', task.created_by_user_id);
console.log('To user:', personId);

// Verify they're not null/undefined
if (!task.created_by_user_id || !personId) {
  console.error('Invalid user IDs');
  return;
}
```

## Enhanced Error Logging

The code now includes comprehensive error logging:

```javascript
try {
  const response = await axios.post(...);
  console.log('Transaction created successfully:', response.data);
} catch (error) {
  console.error('Error creating transaction:', error);
  console.error('Error response:', error.response?.data);
  console.error('Error status:', error.response?.status);
  console.error('Error headers:', error.response?.headers);
}
```

Check all these logs to understand what went wrong.

## Testing Workflow

1. **Login** to the app
2. **Open DevTools** (F12)
3. **Go to Console tab**
4. **Complete a task** by clicking an avatar
5. **Watch for logs**:
   - "Creating transaction:"
   - "Creating transaction with payload:"
   - "Transaction created successfully:" OR "Error creating transaction:"
6. **Check Network tab**:
   - Find POST /transactions request
   - Check status code
   - View request/response details
7. **Verify transaction**:
   - Query API for transaction
   - Check it appears in database

## Database Schema Check

To understand what fields are required:

```sql
-- Get transactions table schema
\d transactions

-- Get NOT NULL constraints
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions';

-- Get check constraints
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_schema = 'public';
```

## Next Steps If Transaction Still Fails

1. Copy the exact error message from console
2. Copy the payload being sent
3. Try the curl command with the same data
4. Check if it's a permissions issue (can you read from /transactions?)
5. Verify the transactions table exists and is accessible
6. Check if there are any database triggers preventing inserts

## Quick Test

Run this in browser console after logging in:

```javascript
// Test if we can read transactions
fetch('https://api2.onfire.so/transactions?limit=1', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('onfire_access_token')}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('Can read transactions:', data))
.catch(err => console.error('Cannot read transactions:', err));

// Test if we can write (with minimal data)
fetch('https://api2.onfire.so/transactions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('onfire_access_token')}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    transaction_type: 'send',
    status: 'completed',
    from_user_id: 'test-uuid',
    to_user_id: 'test-uuid',
    amount: 1,
    currency: 'PROOF'
  })
})
.then(r => r.text())
.then(data => console.log('Write test result:', data))
.catch(err => console.error('Write test error:', err));
```

---

*Last Updated: November 2025*
