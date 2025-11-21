# Negative Reversal Amounts

## Change Made

Reversal transactions (type: `unsend`) now use **negative amounts** to automatically reverse the balance.

## Before vs After

### Before
```javascript
// Reversal transaction
{
  transaction_type: "unsend",
  amount: 50,          // Positive
  net_amount: 50       // Positive
}
```

**Problem:** Both send and unsend transactions add to the total, making it difficult to track reversals.

### After
```javascript
// Reversal transaction
{
  transaction_type: "unsend",
  amount: -50,         // NEGATIVE
  net_amount: -50      // NEGATIVE
}
```

**Benefit:** Negative amount automatically subtracts from total when calculating summaries.

## How It Works

### Task Completion Flow

1. **User completes task for $50:**
   ```javascript
   {
     transaction_type: "send",
     amount: 50,
     net_amount: 50
   }
   ```
   
2. **User uncompletes same task:**
   ```javascript
   {
     transaction_type: "unsend",
     amount: -50,        // Negative!
     net_amount: -50     // Negative!
   }
   ```

3. **Net result:**
   ```
   Total = 50 + (-50) = 0
   ```

## Balance Calculation

### Transaction Summary API

The `/rpc/transactions_summary` endpoint calculates totals:

```sql
SELECT 
  SUM(amount) as total_amount,
  SUM(CASE WHEN date = TODAY() THEN amount ELSE 0 END) as daily_total
FROM transactions
WHERE to_user_id = user_uuid
```

With negative amounts:
- Positive transactions add to balance
- Negative transactions subtract from balance
- Net result is accurate

### Example

User's transactions:

| Date | Type | Amount | Running Total |
|------|------|--------|---------------|
| 11-20 | send | +50 | 50 |
| 11-20 | send | +30 | 80 |
| 11-21 | send | +20 | 100 |
| 11-21 | unsend | -30 | 70 |
| 11-21 | send | +10 | 80 |

**Daily summary:**
```javascript
{
  "2025-11-20": 80,      // 50 + 30
  "2025-11-21": 0        // 20 - 30 + 10
}
```

## Implementation

### Creating Reversal Transaction

```javascript
// Calculate amount from task
const amount = task.budget_cost || Math.ceil(task.estimated_time_minutes / 10);

// Create reversal with negative amount
const reversalData = {
  from_user_id: task.created_by_user_id,
  to_user_id: task.completed_by_user_id,
  amount: -amount,        // Make it negative
  fee: 0,
  net_amount: -amount,    // Make it negative
  related_entity_type: 'task',
  description: `Reversal for uncompleted task: ${task.title}`,
  notes: `Task uncompleted by ${person.name}`,
  metadata: { reversal: true, ... }
};

await onFireAPI.createReversalTransaction(reversalData);
```

### API Request

```bash
curl -X POST "https://api2.onfire.so/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_type": "unsend",
    "status": "completed",
    "from_user_id": "creator-uuid",
    "to_user_id": "completer-uuid",
    "amount": -50,
    "currency": "PRF",
    "fee": 0,
    "net_amount": -50,
    "related_entity_type": "task",
    "description": "Reversal for uncompleted task: Clean Kitchen",
    "notes": "Task uncompleted by Alex"
  }'
```

## Progress Bar Updates

With negative amounts, progress bars automatically reflect reversals:

### Before Uncomplete
```
Alex's earnings: $80
  Daily: $20
  Weekly: $80
  Monthly: $80
```

### After Uncomplete (reversed $30 transaction)
```
Alex's earnings: $50
  Daily: -$10   (shown as $10 with Math.abs)
  Weekly: $50
  Monthly: $50
```

The transaction summary API recalculates totals including negative amounts.

## Benefits

### 1. Automatic Balance Correction
```javascript
// No manual adjustment needed
const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
// Negative transactions automatically subtract
```

### 2. Audit Trail
```javascript
// Find all reversals
const reversals = transactions.filter(tx => 
  tx.transaction_type === 'unsend' && tx.amount < 0
);
```

### 3. Accurate Reporting
```javascript
// Daily earnings (including reversals)
const dailyEarnings = transactions
  .filter(tx => tx.date === today)
  .reduce((sum, tx) => sum + tx.amount, 0);
// Automatically accounts for negative reversals
```

### 4. Clear Intent
- Positive amount = earning
- Negative amount = reversal/refund
- Transaction type clarifies context

## Database Storage

Transactions table now stores:

```sql
id          | type   | amount | net_amount
------------|--------|--------|------------
uuid-1      | send   | 50.00  | 50.00
uuid-2      | send   | 30.00  | 30.00
uuid-3      | unsend | -30.00 | -30.00  ← Negative
uuid-4      | send   | 10.00  | 10.00
```

## Console Logging

When creating reversal transaction:

```
Creating reversal transaction: {
  from_user_id: "...",
  to_user_id: "...",
  amount: -50,          ← Negative
  net_amount: -50,      ← Negative
  ...
}

Creating reversal transaction with payload: {
  "transaction_type": "unsend",
  "amount": -50,
  "net_amount": -50,
  ...
}

✅ Reversal transaction created: {
  "id": "...",
  "amount": -50,        ← Stored as negative
  ...
}
```

## Testing

### Verify Negative Amounts

1. Complete a task ($50)
2. Check transaction: amount should be +50
3. Uncomplete the task
4. Check reversal transaction: amount should be -50
5. Check summary API: totals should reflect reversal

### Query Transactions

```bash
# Get user's transactions
curl -X GET "https://api2.onfire.so/transactions?to_user_id=eq.USER_ID&order=created_at.desc" \
  -H "Authorization: Bearer $TOKEN"

# Should see:
[
  { "transaction_type": "send", "amount": 50 },
  { "transaction_type": "unsend", "amount": -50 }
]
```

### Check Summary

```bash
# Get transaction summary
curl -X POST "https://api2.onfire.so/rpc/transactions_summary" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"p_user_uuid":"USER_ID"}'

# Should see:
{
  "total_amount": 0,  // 50 + (-50) = 0
  "daily_summary": { "2025-11-21": 0 },
  ...
}
```

## Edge Cases

### Multiple Completions/Reversals

```
Task completed:  +50
Task uncompleted: -50
Task completed:  +50
Task uncompleted: -50
Total: 0
```

### Partial Reversals

If task amount changes between completion and reversal:

```javascript
// Original completion
{ amount: 50 }

// Amount changed to 60 in task

// Reversal uses current amount
{ amount: -60 }

// Net: 50 - 60 = -10
```

**Recommendation:** Reversal should use original transaction amount, not current task amount.

## Summary

✅ **Implemented:**
- Reversal transactions use negative amounts
- amount: -value
- net_amount: -value
- Automatically subtracts from totals

✅ **Benefits:**
- Accurate balance calculation
- Clear audit trail
- Simplified reporting
- Self-correcting totals

✅ **Impact:**
- Progress bars reflect true earnings
- Summary API returns correct totals
- Reversals clearly identified

---

*Last Updated: November 2025*
