# Transaction Configuration

## Critical Settings

### Required Transaction Fields

When a task is completed, the following transaction is created:

```javascript
{
  transaction_type: 'send',      // MUST be 'send' (not 'buy')
  status: 'completed',            // Transaction is immediately completed
  currency: 'PRF',              // MUST be 'PRF' (3-letter code)
  from_user_id: task.created_by_user_id,  // Task creator pays
  to_user_id: personId,           // Task completer receives
  amount: task.budget_cost,       // Amount from task budget
  net_amount: task.budget_cost,   // Net amount (same as amount, fee is 0)
  fee: 0                          // No transaction fee
}
```

## Key Points

### 1. Transaction Type
- **Value**: `"send"`
- **Why**: Represents sending PROOF tokens from one user to another
- **Not**: `"buy"` (which would be for purchasing something)

### 2. Currency
- **Value**: `"PRF"`
- **Why**: 3-letter currency code for PROOF tokens
- **Not**: `"PROOF"` (too long), `"USD"` or other fiat currencies

### 3. Status
- **Value**: `"completed"`
- **Why**: Transaction is immediately processed and completed
- **Not**: `"pending"` (no approval needed)

## Implementation

### API Service (api.js)

```javascript
async createTransaction(transactionData) {
  const response = await axios.post(
    `${API_BASE_URL}/transactions`,
    {
      transaction_type: 'send',           // ← Fixed value
      status: 'completed',                 // ← Fixed value
      currency: 'PRF',                     // ← Fixed value (3-letter code)
      from_user_id: transactionData.from_user_id,
      to_user_id: transactionData.to_user_id,
      amount: transactionData.amount,
      // ... other fields
    },
    { headers: this.getAuthHeaders() }
  );
  return response.data;
}
```

## Debugging

### Check Transaction in Browser Console

After completing a task, check the console for:

```
Creating transaction: {
  from_user_id: "...",
  to_user_id: "...",
  amount: 50,
  ...
}

Transaction created: {
  id: "...",
  transaction_type: "send",
  currency: "PROOF",
  status: "completed",
  ...
}
```

### Verify Transaction via API

```bash
# Get recent transactions
curl -X GET "https://api2.onfire.so/transactions?order=created_at.desc&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Get transactions for a specific task
curl -X GET "https://api2.onfire.so/transactions?related_entity_id=eq.TASK_ID" \
  -H "Authorization: Bearer $TOKEN"

# Check transaction type and currency
curl -X GET "https://api2.onfire.so/transactions?transaction_type=eq.send&currency=eq.PRF" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Issues

### Issue: No Transaction Appears

**Possible Causes:**
1. Wrong transaction_type (was using "buy")
2. Wrong currency (was using "USD")
3. API error not logged

**Solution:**
- Check browser console for errors
- Look for "Transaction created:" log message
- Check Network tab for POST /transactions response

### Issue: Transaction Rejected by API

**Check:**
```javascript
// In browser console after error
console.error('Error details:', error.response?.data);
```

**Common API Errors:**
- `400 Bad Request` - Missing required fields or invalid values
- `422 Unprocessable Entity` - Invalid transaction_type or currency
- `401 Unauthorized` - Token expired
- `500 Internal Server Error` - Database constraint violation

## Testing Checklist

After implementing changes:

- [ ] Complete a task
- [ ] Check console for "Creating transaction:" log
- [ ] Check console for "Transaction created:" log
- [ ] Verify no errors in console
- [ ] Check Network tab for POST /transactions (status 201)
- [ ] Query transactions API to verify record exists
- [ ] Verify transaction has correct fields:
  - [ ] `transaction_type` = "send"
  - [ ] `currency` = "PROOF"
  - [ ] `status` = "completed"
  - [ ] `amount` = task budget_cost
  - [ ] `from_user_id` = task creator
  - [ ] `to_user_id` = task completer

## Expected API Response

### Successful Transaction Creation

**Status Code**: `201 Created`

**Response Body**:
```json
{
  "id": "generated-uuid-here",
  "transaction_type": "send",
  "status": "completed",
  "from_user_id": "creator-uuid",
  "to_user_id": "completer-uuid",
  "amount": 50,
  "currency": "PROOF",
  "fee": 0,
  "net_amount": 50,
  "related_entity_type": "task",
  "related_entity_id": "task-uuid",
  "description": "Payment for completing task: Clean Kitchen",
  "notes": "Task completed by Alex P.",
  "metadata": {
    "task_id": "task-uuid",
    "task_title": "Clean Kitchen",
    "completed_by": "completer-uuid",
    "conversation_id": "conversation-uuid"
  },
  "initiated_at": "2025-11-20T10:30:00Z",
  "completed_at": "2025-11-20T10:30:00Z",
  "created_at": "2025-11-20T10:30:00Z",
  "updated_at": "2025-11-20T10:30:00Z"
}
```

## Summary

✅ **Correct Configuration:**
- `transaction_type`: `"send"`
- `currency`: `"PRF"` (3-letter code)
- `status`: `"completed"`

❌ **Previous (Incorrect) Configuration:**
- `transaction_type`: `"buy"`
- `currency`: `"USD"` or `"PROOF"` (too long)

🔧 **Changes Made:**
1. Updated API service to use fixed values
2. Removed unnecessary parameters from caller
3. Added detailed logging for debugging
4. Updated documentation

---

*Configuration Last Updated: November 2025*
