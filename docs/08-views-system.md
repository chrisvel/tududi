# Views - Smart Saved Searches

This document explains how Views work in tududi from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/views/` and frontend components in `/frontend/components/Views.tsx` and `/frontend/components/ViewDetail.tsx`.

---

## **What Are Views?**

**Views are saved search configurations** that allow you to quickly filter and access tasks, notes, and projects based on specific criteria. Think of them as "smart folders" that automatically show items matching your saved filters.

### Key Concepts

1. **Views save your search criteria, not the items themselves**
   - When you open a view, it runs the search in real-time
   - Results are always up-to-date with your latest data

2. **Views can filter across multiple entity types**
   - Tasks
   - Notes
   - Projects

3. **Views are personal**
   - Each user has their own views
   - Views cannot be shared (unlike projects)

---

## **Creating Views**

### From Universal Search

1. **Open Universal Search** (Cmd/Ctrl + K or click search icon)
2. **Configure your search criteria:**
   - Enter search text
   - Select entity types (Tasks, Notes, Projects)
   - Set priority filter (High, Medium, Low)
   - Set due date filter (Today, This Week, Overdue, etc.)
   - Set defer filter (Deferred, Not Deferred, etc.)
   - Add tags
   - Add extras (Recurring, Subtasks, etc.)

3. **Click "Save as View"**
4. **Enter a name** for your view
5. **Click "Save View"**

### What Gets Saved

When you save a view, it stores:
- **Search query** - The text you searched for
- **Filters** - Entity types (Tasks, Notes, Projects)
- **Priority** - Priority filter setting
- **Due** - Due date filter setting
- **Defer** - Defer filter setting
- **Tags** - Selected tags
- **Extras** - Additional filters (recurring, subtasks, etc.)

The view does **NOT** save:
- Sort order (set per-session when viewing)
- Group by setting (set per-session when viewing)
- Show status (active/completed/all) (set per-session when viewing)

---

## **Accessing Views**

### View List Page

Navigate to `/views` to see all your views:
- Shows all views in a card grid layout
- **Pinned views** appear first (with star icon)
- **Search bar** to filter views by name
- Click any view card to open it

### Pinned Views in Sidebar

**Pinned views appear in the sidebar** for quick access:
- Shows up to all pinned views
- Appears below the main "VIEWS" menu item
- Can be **reordered via drag-and-drop**
- Click the star icon to pin/unpin

---

## **Using Views**

### Opening a View

When you open a view, it displays:
1. **View name** at the top (click to rename)
2. **Action buttons**: Search toggle, Sort/Filter, Info, Pin, Delete
3. **Search criteria info** (click ℹ️ icon to see)
4. **Results grouped by type:**
   - Tasks section
   - Notes section
   - Projects section

### Filtering Results

**Search within view:**
- Click magnifying glass icon to show search input
- Filters results by task name, original name, or note content
- Does not modify the saved view criteria

**Sort tasks:**
- Click sort icon to open dropdown
- Options: Due Date, Name, Priority, Status, Created At
- Choose Ascending or Descending

**Group tasks:**
- Click sort icon → "Group by" section
- Options: None, Project

**Show status:**
- Click sort icon → "Show" section
- **Active** (default) - Shows open tasks only
- **All** - Shows all tasks
- **Completed** - Shows completed tasks only

### Display Behavior

1. **Tasks are shown without subtasks**
   - Only parent tasks appear in view results
   - Subtasks are excluded to avoid duplication

2. **Pagination**
   - Initial load: 20 items
   - Click "Load More" to fetch next 20 items
   - Counter shows "Showing X of Y tasks"

3. **Real-time updates**
   - Results refresh when you complete, update, or delete items
   - Matches are always current

---

## **Managing Views**

### Renaming a View

1. Click on the view name at the top
2. Edit the name inline
3. Press Enter to save, or click outside to save
4. Press Escape to cancel

### Pinning/Unpinning

**Pin a view:**
- Click the star icon (outline)
- View appears in sidebar
- Star turns solid yellow

**Unpin a view:**
- Click the star icon (solid)
- View is removed from sidebar
- Star turns outline gray

**Maximum pins:** Unlimited (but recommended to keep manageable)

### Reordering Pinned Views

**In the sidebar:**
1. **Press and hold** on a pinned view (250ms delay)
2. **Drag** to the desired position
3. **Release** to drop
4. Order is saved automatically

**Keyboard alternative:**
- Use keyboard navigation (if supported)
- Arrow keys to navigate, Space to grab, Arrow keys to move, Space to drop

### Deleting a View

1. Open the view or find it in the view list
2. Click the trash icon
3. Confirm deletion in dialog
4. View is permanently deleted

**Note:** Deleting a view does not delete the items it shows - only the saved search criteria.

---

## **View Data Model**

### View Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Internal database ID |
| `uid` | String | Public unique identifier (used in URLs) |
| `name` | String | View name (required) |
| `user_id` | Integer | Owner of the view |
| `search_query` | String | Text search term (nullable) |
| `filters` | JSON Array | Entity types ["Tasks", "Notes", "Projects"] |
| `priority` | String | Priority filter: "high", "medium", "low" (nullable) |
| `due` | String | Due date filter: "today", "this_week", "overdue", etc. (nullable) |
| `defer` | String | Defer filter: "deferred", "not_deferred", etc. (nullable) |
| `tags` | JSON Array | Tag names to filter by |
| `extras` | JSON Array | Extra filters: "recurring", "subtasks", etc. |
| `is_pinned` | Boolean | Whether view is pinned to sidebar |
| `created_at` | DateTime | When view was created |
| `updated_at` | DateTime | Last modified time |

---

## **Display Rules**

### Results Matching

A view shows items that match **ALL** of the following criteria (AND logic):

1. **Entity type matches filters**
   - If filters = ["Tasks"], only tasks appear
   - If filters = ["Tasks", "Notes"], tasks and notes appear
   - If filters = [], all types appear (rare)

2. **Text matches search query** (if set)
   - Tasks: Matches name, original_name, or note
   - Notes: Matches title or content
   - Projects: Matches name or description

3. **Priority matches** (if set)
   - Only items with that priority level

4. **Due date matches** (if set)
   - Filters based on due date range
   - Options: today, this_week, next_week, overdue, no_due_date

5. **Defer matches** (if set)
   - Filters based on defer status
   - Options: deferred, not_deferred

6. **Has ALL specified tags** (if set)
   - Items must have every tag in the list

7. **Matches extra filters** (if set)
   - recurring: Only recurring tasks
   - subtasks: Only subtasks (usually excluded)

### Empty Results

If no items match, the view shows:
- Empty state icon
- Message: "No items found matching the view criteria"

---

## **Sidebar Integration**

### Sidebar View Order

Pinned views appear in the sidebar in this order:
1. **Custom order** (if user has dragged to reorder)
2. **Fallback order** (creation date, newest first)

The order is stored in the user's `sidebar_settings` profile field as:
```json
{
  "pinnedViewsOrder": ["uid1", "uid2", "uid3"]
}
```

### Sidebar Refresh

The sidebar updates automatically when:
- A view is created
- A view is deleted
- A view is pinned/unpinned
- Pinned views are reordered

**Trigger:** `window.dispatchEvent(new CustomEvent('viewUpdated'))`

---

## **URL Parameters**

When viewing a view at `/views/:uid`, you can use URL parameters to control display:

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| `order_by` | `due_date:asc`, `name:asc`, `priority:desc`, `status:desc`, `created_at:desc` | `created_at:desc` | Task sort order |
| `group_by` | `none`, `project` | `none` | Task grouping |
| `status` | `active`, `all`, `completed` | `active` | Task status filter |
| `search` | Any text | Empty | Search within view results |

**Example:**
```
/views/abc123?order_by=priority:desc&group_by=project&status=all&search=urgent
```

**Behavior:**
- Parameters are synced to URL as you change filters
- Browser back/forward works correctly
- Sharing a URL preserves filters

---

## **Special Features**

### View Criteria Badge

Click the **ℹ️ (info) icon** to see a dropdown showing:
- Entity types filter
- Search text
- Priority filter
- Due date filter
- Defer filter
- Tags filter
- Extras filter

If no criteria are set, shows: "No criteria set"

### Edit Name Inline

Click the view name to edit it inline:
- Auto-focuses input field
- Press Enter to save
- Press Escape to cancel
- Click outside to save
- Empty names are rejected

### Task Interactions

Within a view, you can:
- **Complete/uncomplete** tasks (checkbox)
- **Open task details** (click task name)
- **Update task** (via task detail modal)
- **Delete task** (via task detail modal)

Changes are reflected immediately in the view results.

---

## **Performance & Limits**

### Pagination

- **Initial load:** 20 items per entity type
- **Load more:** Additional 20 items per click
- **Load all:** Fetches remaining items (use with caution on large result sets)

### Search Performance

- Views use the universal search backend
- Searches are **indexed** for performance
- Text search supports **partial matches**
- Tag search requires **exact matches**

### View Limits

- **No limit** on number of views per user
- **No limit** on number of pinned views
- Recommended to keep pinned views manageable (5-10)

---

## **Common Use Cases**

### Example 1: High-Priority Tasks Due This Week

**Criteria:**
- Filters: Tasks
- Priority: High
- Due: this_week

**Result:** Shows all high-priority tasks due within the next 7 days

---

### Example 2: Work Notes

**Criteria:**
- Filters: Notes
- Tags: ["work"]

**Result:** Shows all notes tagged with "work"

---

### Example 3: Overdue Tasks in Project X

**Criteria:**
- Filters: Tasks
- Due: overdue
- Search query: "Project X"

**Result:** Shows all overdue tasks whose name or note contains "Project X"

---

### Example 4: Recurring Tasks

**Criteria:**
- Filters: Tasks
- Extras: ["recurring"]

**Result:** Shows all recurring task templates

---

## **Related Documentation**

- [Today Page Sections](02-today-page-sections.md) - How Today page filters tasks
- [Upcoming View](03-upcoming-view.md) - 7-day upcoming task view
- [Notes System](05-notes-system.md) - How notes work
- [Projects](06-projects.md) - Project organization
- [Architecture Overview](architecture.md) - Technical architecture

**Technical Implementation Files:**
- Backend service: `/backend/modules/views/service.js`
- Backend routes: `/backend/modules/views/routes.js`
- Backend repository: `/backend/modules/views/repository.js`
- View model: `/backend/models/view.js`
- Frontend views list: `/frontend/components/Views.tsx`
- Frontend view detail: `/frontend/components/ViewDetail.tsx`
- Sidebar views: `/frontend/components/Sidebar/SidebarViews.tsx`
- Save view modal: `/frontend/components/UniversalSearch/SaveViewModal.tsx`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Audience:** Developers, AI assistants, and end users