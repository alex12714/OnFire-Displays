# Transaction Summary API Integration

## Overview

The progress bars now display real earnings data from the `/rpc/transactions_summary` API endpoint, showing actual daily, weekly, and monthly transaction amounts for each person.

## API Endpoint

### Request
```
POST https://api2.onfire.so/rpc/transactions_summary
```

**Payload:**
```json
{
  "p_user_uuid": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

### Response
```json
[
  {
    "currency": "PRF",
    "daily_summary": {
      "2025-11-21": -12.00
    },
    "weekly_summary": {
      "2025-11-17": -12.00
    },
    "monthly_summary": {
      "2025-11": -12.00
    },
    "total_amount": -12.00,
    "transaction_count": 4
  }
]
```

## Implementation

### 1. API Service Method

```javascript
async getTransactionSummary(userId) {
  const response = await axios.post(
    `${API_BASE_URL}/rpc/transactions_summary`,
    { p_user_uuid: userId },
    { headers: this.getAuthHeaders() }
  );
  return response.data?.[0] || null;
}
```

### 2. Load Summaries for All People

```javascript
const loadTransactionSummaries = async () => {
  const summaries = {};
  
  for (const person of people) {
    const summary = await onFireAPI.getTransactionSummary(person.id);
    if (summary) {
      summaries[person.id] = summary;
    }
  }
  
  setTransactionSummaries(summaries);
};
```

Called automatically when `people` array changes:

```javascript
useEffect(() => {
  if (people.length > 0) {
    loadTransactionSummaries();
  }
}, [people]);
```

### 3. Parse and Display Data

```javascript
const getPersonProgress = (personId) => {
  const summary = transactionSummaries[personId];
  
  if (summary) {
    // Extract today's amount
    const today = new Date().toISOString().split('T')[0];
    const dailyAmount = Math.abs(summary.daily_summary?.[today] || 0);
    
    // Extract latest week amount
    const weekKeys = Object.keys(summary.weekly_summary || {});
    const latestWeek = weekKeys[weekKeys.length - 1];
    const weeklyAmount = Math.abs(summary.weekly_summary[latestWeek] || 0);
    
    // Extract current month amount
    const currentMonth = new Date().toISOString().substring(0, 7); // "2025-11"
    const monthlyAmount = Math.abs(summary.monthly_summary?.[currentMonth] || 0);
    
    return {
      daily: dailyAmount,
      weekly: weeklyAmount,
      monthly: monthlyAmount,
      dayHeight: Math.min((dailyAmount / 10) * 100, 100),
      weekHeight: Math.min((weeklyAmount / 50) * 100, 100),
      monthHeight: Math.min((monthlyAmount / 200) * 100, 100)
    };
  }
  
  // Fallback to calculated values
  return { ... };
};
```

## Data Structure

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `currency` | String | Currency code (PRF) |
| `daily_summary` | Object | Amounts per day (date → amount) |
| `weekly_summary` | Object | Amounts per week (week start date → amount) |
| `monthly_summary` | Object | Amounts per month (YYYY-MM → amount) |
| `total_amount` | Number | Lifetime total amount |
| `transaction_count` | Integer | Total number of transactions |

### Date Formats

```javascript
// Daily summary keys
"2025-11-21"  // ISO date format (YYYY-MM-DD)

// Weekly summary keys
"2025-11-17"  // Week start date (Monday)

// Monthly summary keys
"2025-11"     // Year-month format (YYYY-MM)
```

## Handling Negative Values

Amounts can be negative (spending) or positive (earning):

```javascript
// Use Math.abs to always show positive values in UI
const amount = Math.abs(summary.daily_summary[today] || 0);
```

**Why negative?**
- When user completes task: earns money (positive)
- When user creates task: spends money (negative)
- Net result can be negative if spending > earning

**Display decision:**
- Show absolute values in progress bars
- Always display as positive amounts
- Users see "earnings" regardless of net positive/negative

## Visual Representation

### Progress Bars

Each person now shows:

```
[Avatar]
Name

$12   $45   $120
[D]   [W]   [M]
```

Where:
- **D (Daily)**: Today's transactions (absolute value)
- **W (Weekly)**: This week's transactions (absolute value)
- **M (Monthly)**: This month's transactions (absolute value)

### Bar Heights

Calculated proportionally:

```javascript
// Daily bar height (max 100%)
dayHeight = Math.min((dailyAmount / 10) * 100, 100)

// Weekly bar height (max 100%)
weekHeight = Math.min((weeklyAmount / 50) * 100, 100)

// Monthly bar height (max 100%)
monthHeight = Math.min((monthlyAmount / 200) * 100, 100)
```

**Scaling factors:**
- Daily: $10 = 100% height
- Weekly: $50 = 100% height
- Monthly: $200 = 100% height

## Fallback Behavior

If API data is unavailable:

```javascript
if (summary) {
  // Use API data
  return { daily, weekly, monthly };
} else {
  // Fallback: calculate from completed tasks
  const totalCoins = calculateFromTasks();
  return { 
    daily: totalCoins,
    weekly: totalCoins,
    monthly: totalCoins
  };
}
```

**Fallback triggers when:**
- API call fails
- User has no transactions yet
- Network error
- Summary endpoint unavailable

## Console Logging

When summaries load:

```
Loading transaction summaries for people: [...]
Transaction summary for Alex: {
  currency: "PRF",
  daily_summary: { "2025-11-21": -12 },
  weekly_summary: { "2025-11-17": -12 },
  monthly_summary: { "2025-11": -12 },
  total_amount: -12,
  transaction_count: 4
}
Transaction summary for Sam: { ... }
All transaction summaries loaded: { ... }
```

## Real-time Updates

Summaries are refreshed when:

1. **People list changes** (new users added)
   ```javascript
   useEffect(() => {
     if (people.length > 0) {
       loadTransactionSummaries();
     }
   }, [people]);
   ```

2. **After task completion** (automatic via API)
   - Transaction created
   - Summary updates on next API call

3. **Manual refresh** (future enhancement)
   - Add refresh button
   - Reload summaries on demand

## Performance Optimization

### Current Implementation

```javascript
// Sequential loading
for (const person of people) {
  const summary = await onFireAPI.getTransactionSummary(person.id);
}
```

**Pros:**
- Simple implementation
- Easy to debug
- Works reliably

**Cons:**
- Slower with many people (5 people = 5 sequential API calls)

### Optimized Version (Future)

```javascript
// Parallel loading
const promises = people.map(person => 
  onFireAPI.getTransactionSummary(person.id)
);
const results = await Promise.all(promises);
```

**Benefits:**
- Faster with many people
- All requests in parallel
- Better user experience

## Testing

### Verify Integration Works

1. Complete a task
2. Check console for "Loading transaction summaries"
3. Check console shows summary data for each person
4. Verify progress bars display amounts
5. Complete another task
6. Reload page - summaries should persist

### Expected Console Output

```
Loading transaction summaries for people: [
  { id: "user-1", name: "Alex", ... },
  { id: "user-2", name: "Sam", ... }
]

Transaction summary for Alex: {
  currency: "PRF",
  daily_summary: { "2025-11-21": 50 },
  weekly_summary: { "2025-11-17": 150 },
  monthly_summary: { "2025-11": 450 },
  total_amount: 450,
  transaction_count: 12
}

All transaction summaries loaded: {
  "user-1": { ... },
  "user-2": { ... }
}
```

### Check API Response

```bash
# Manual test
curl -X POST "https://api2.onfire.so/rpc/transactions_summary" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "p_user_uuid": "b3dc6d78-37ff-4c83-b163-51c0d30af1d5"
  }'
```

## Troubleshooting

### Issue: Progress Bars Show $0

**Possible Causes:**
1. No transactions for user yet
2. API call failed
3. Today's date not in daily_summary
4. User hasn't completed any tasks

**Debug:**
```javascript
console.log('Transaction summary:', transactionSummaries);
console.log('Today:', new Date().toISOString().split('T')[0]);
console.log('Daily summary:', summary?.daily_summary);
```

### Issue: Bars Not Updating After Task Completion

**Cause:** Summaries not reloaded after transaction

**Solution:** Add manual reload or wait for next page load

```javascript
// After task completion
await onFireAPI.createTransaction(data);
await loadTransactionSummaries(); // Reload summaries
```

### Issue: API Returns Empty Array

**Cause:** User has no transactions

**Expected:** Fallback to calculated values works

## Benefits

✅ **Accurate Data**: Shows real transaction amounts from database
✅ **Time Periods**: Separate daily, weekly, monthly tracking
✅ **Scalable**: Works with any number of users
✅ **Fallback**: Graceful degradation if API unavailable
✅ **Real-time**: Updates when people list changes
✅ **Simple**: Clean API integration

## Summary

- **API endpoint**: POST /rpc/transactions_summary
- **Fetches**: Daily, weekly, monthly transaction summaries
- **Displays**: Real earnings data in progress bars
- **Handles**: Negative values (absolute display)
- **Fallback**: Calculated values if API unavailable
- **Performance**: Sequential loading (can optimize)

---

*Last Updated: November 2025*
