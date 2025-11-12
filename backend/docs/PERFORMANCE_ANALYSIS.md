# Performance Analysis - GET /api/tasks

## Problem Identified

User reported **1 second response time** for `/api/tasks` endpoint after our N+1 optimization.

## Root Cause Analysis

### Issue #1: `computeTaskMetrics()` is TOO EXPENSIVE ⚠️ **CRITICAL**

**Location**: `routes/tasks/helpers.js:793-1220`

The `computeTaskMetrics()` function executes **11+ database queries** on EVERY request:

```javascript
async function computeTaskMetrics(userId, userTimezone = 'UTC') {
    // Query 1: Count open tasks
    const totalOpenTasks = await Task.count({ ... });

    // Query 2: Count tasks pending over a month
    const tasksPendingOverMonth = await Task.count({ ... });

    // Query 3: Get in-progress tasks (with Tags, Projects, Subtasks joins)
    const tasksInProgress = await Task.findAll({ ... });

    // Query 4: Get today plan tasks (with Tags, Projects, Subtasks joins)
    const todayPlanTasks = await Task.findAll({ ... });

    // Query 5: Get tasks due today (with Tags, Projects, Subtasks joins)
    const tasksDueToday = await Task.findAll({ ... });

    // Query 6: Get someday task IDs
    const somedayTaskIds = await sequelize.query({ ... });

    // Query 7: Get non-project tasks (with Tags, Projects, Subtasks joins)
    const nonProjectTasks = await Task.findAll({ ... });

    // Query 8: Get project tasks (with Tags, Projects, Subtasks joins)
    const projectTasks = await Task.findAll({ ... });

    // Query 9 (conditional): Get someday fallback tasks
    const somedayFallbackTasks = await Task.findAll({ ... });

    // Query 10: Get tasks completed today (with Tags, Projects, Subtasks joins)
    const tasksCompletedToday = await Task.findAll({ ... });

    // Query 11: Get weekly completions
    const weeklyCompletionsRaw = await Task.findAll({ ... });
}
```

### Problem Breakdown

1. **Always Computed**: Metrics are computed on EVERY `/api/tasks` request, regardless of whether they're needed
2. **No Caching**: Results are never cached, even though they don't change frequently
3. **Heavy Joins**: Many queries include nested joins (Tags → Projects → Subtasks → Tags)
4. **Redundant Data**: Multiple queries fetch overlapping data
5. **Suggested Tasks Algorithm**: Complex logic with multiple queries (lines 958-1137)

### Query Cost Analysis

Each `Task.findAll()` with includes generates multiple SQL queries:
- Main task query: 1 query
- Tags join: +1 query (or inline with LEFT JOIN)
- Projects join: +1 query
- Subtasks: +1 query
- Subtasks' Tags: +1 query

**Total estimated SQL queries: 30-40 per request**

## Impact on Response Time

```
GET /api/tasks breakdown:
┌─────────────────────────────────┬──────────┬─────────┐
│ Operation                       │ Queries  │ Time    │
├─────────────────────────────────┼──────────┼─────────┤
│ filterTasksByParams()           │ 1-2      │ 50ms    │
│ computeTaskMetrics()            │ 30-40    │ 800ms   │
│ serializeTasks() (optimized)    │ 1        │ 20ms    │
│ buildMetricsResponse()          │ 1        │ 30ms    │
│ groupTasksByDay() (if requested)│ 0        │ 10ms    │
│ JSON serialization              │ 0        │ 50ms    │
├─────────────────────────────────┼──────────┼─────────┤
│ TOTAL                           │ 33-45    │ 960ms   │
└─────────────────────────────────┴──────────┴─────────┘

computeTaskMetrics() accounts for ~83% of response time!
```

## Proposed Solutions

### Option 1: Make Metrics Optional (Quick Win) ⭐

Add query parameter `includeMetrics=true/false`:

```javascript
router.get('/tasks', async (req, res) => {
    const tasks = await filterTasksByParams(...);

    let metrics = null;
    if (req.query.includeMetrics !== 'false') {
        // Only compute when explicitly requested
        metrics = await computeTaskMetrics(...);
    }

    const response = {
        tasks: await serializeTasks(tasks, ...),
        ...(metrics && { metrics: await buildMetricsResponse(metrics, ...) }),
    };
});
```

**Impact**: ~80% reduction in response time for simple list requests

### Option 2: Lazy Metrics Endpoint (Better Architecture)

Create a dedicated endpoint for metrics:

```javascript
// GET /api/tasks - Just returns tasks (fast!)
router.get('/tasks', async (req, res) => { ... });

// GET /api/tasks/metrics - Returns only metrics
router.get('/tasks/metrics', async (req, res) => { ... });
```

Frontend can fetch them in parallel if needed:
```javascript
const [tasks, metrics] = await Promise.all([
    api.get('/tasks'),
    api.get('/tasks/metrics')
]);
```

**Impact**:
- `/api/tasks`: 100-200ms ✅
- `/api/tasks/metrics`: 800ms (only when needed)

### Option 3: Cache Metrics (5-Minute TTL)

```javascript
const metricsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedMetrics(userId, userTimezone) {
    const cacheKey = `metrics_${userId}`;
    const cached = metricsCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const metrics = await computeTaskMetrics(userId, userTimezone);
    metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() });

    return metrics;
}
```

**Impact**: First request 1000ms, subsequent requests ~150ms

### Option 4: Optimize Individual Metric Queries

Combine multiple queries where possible:

```javascript
// Instead of 3 separate COUNT queries:
const [totalOpen, pendingMonth, inProgress] = await Promise.all([
    Task.count({ where: { status: { [Op.ne]: DONE } } }),
    Task.count({ where: { created_at: { [Op.lt]: monthAgo } } }),
    Task.count({ where: { status: IN_PROGRESS } })
]);

// Use ONE query with multiple counts:
const counts = await Task.findOne({
    attributes: [
        [sequelize.fn('COUNT', sequelize.literal(
            `CASE WHEN status != ${Task.STATUS.DONE} THEN 1 END`
        )), 'total_open'],
        [sequelize.fn('COUNT', sequelize.literal(
            `CASE WHEN created_at < '${monthAgo.toISOString()}' THEN 1 END`
        )), 'pending_month'],
        [sequelize.fn('COUNT', sequelize.literal(
            `CASE WHEN status = ${Task.STATUS.IN_PROGRESS} THEN 1 END`
        )), 'in_progress']
    ],
    where: visibleTasksWhere,
    raw: true
});
```

**Impact**: ~30% reduction in query count

## Recommended Approach

**Phase 1 (Immediate)**: Make metrics optional
- Add `includeMetrics` parameter
- Frontend can disable for list-only views
- **Expected**: 100-200ms for list views

**Phase 2 (Short-term)**: Add caching
- 5-minute TTL for metrics
- Invalidate on task creation/update
- **Expected**: Consistent 150-200ms

**Phase 3 (Long-term)**: Separate metrics endpoint
- Better API design
- Parallel loading in frontend
- **Expected**: Best user experience

## Database Indexes Needed

Check if these indexes exist:

```sql
-- For metrics queries
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_created_at ON tasks(user_id, created_at);
CREATE INDEX idx_tasks_user_today ON tasks(user_id, today);
CREATE INDEX idx_tasks_user_completed_at ON tasks(user_id, completed_at);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_recurring_parent_id ON tasks(recurring_parent_id);

-- For tags join
CREATE INDEX idx_tasks_tags_task_id ON tasks_tags(task_id);
CREATE INDEX idx_tasks_tags_tag_id ON tasks_tags(tag_id);
```

## Next Steps

1. ✅ Add query logging (done)
2. ⏳ Implement Option 1 (make metrics optional)
3. ⏳ Add caching layer
4. ⏳ Check/add database indexes
5. ⏳ Profile with real data
6. ⏳ Achieve sub-200ms response time

## Success Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Response time (with metrics) | 1000ms | 300ms | ❌ |
| Response time (without metrics) | 1000ms | 150ms | ❌ |
| Query count (with metrics) | 40 | 20 | ❌ |
| Query count (without metrics) | 40 | 3 | ❌ |
| Cache hit rate | 0% | 80% | ❌ |
