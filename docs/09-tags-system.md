# Tags System - Behavior Rules

This document explains how the Tags system works in tasknotetaker from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/tags/` and frontend components in `/frontend/components/Tags.tsx` and `/frontend/components/Tag/`.

---

## Overview

**Tags** are tasknotetaker's flexible labeling and categorization system - a way to organize and group related items across tasks, notes, and projects. Unlike the hierarchical organization of Areas > Projects > Tasks, tags provide a flat, cross-cutting way to find and filter content.

**Key characteristics:**
- Work across all content types (tasks, notes, projects)
- User-scoped (each user has their own tag set)
- Unique per user (no duplicate tag names)
- Auto-created on-the-fly
- Case-insensitive
- Character restrictions for URL safety
- Maximum 50 characters per tag name

**URL:** `/tags` (tag list) or `/tag/:uid-:slug` (tag detail page)

---

## Core Principles

1. **Cross-entity organization**
   - Same tag can be applied to tasks, notes, and projects
   - Creates horizontal connections across hierarchical boundaries
   - Enables finding related items regardless of their type

2. **Flexible categorization**
   - No predefined taxonomy
   - Create tags as needed
   - No hierarchy (tags are flat)
   - Multiple tags per item (up to 10 tags per task/note/project)

3. **User-scoped isolation**
   - Each user has their own tag namespace
   - Tags are not shared between users
   - Even in shared projects, tags remain user-specific
   - Deleting a tag only affects your view

---

## Tag Structure

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **UID** | String | Auto | Unique identifier (immutable) |
| **Name** | String | Yes | Tag name (unique per user) |
| **User ID** | Integer | Auto | Owner of the tag |
| **Created At** | Timestamp | Auto | Creation timestamp |
| **Updated At** | Timestamp | Auto | Last modification timestamp |

### Unique Identifier

- Each tag has a **UID** (unique identifier): `uid` field
- Used in URLs: `/tag/abc123def456-tag-name`
- Immutable - persists through renames
- Format: Generated unique string (8+ characters)

### Validation Rules

**Tag name restrictions:**
- **Length:** 1-50 characters (after trimming whitespace)
- **Invalid characters:** `# % & { } \ < > * ? / $ ! ' " @ + \` | =`
- **Valid characters:** Letters, numbers, spaces, hyphens, underscores
- **Case:** Stored as-is, but treated case-insensitively for uniqueness
  - ✅ Valid examples: `work`, `Work Projects`, `Q1-2026`, `backend_dev`
  - ❌ Invalid examples (contain special chars): `foo/bar`, `price$`, `email@domain`
  - ❌ Invalid: `#hashtag` - the `#` character cannot be part of the tag name

> **Note about Inbox hashtag syntax:** When using the Inbox quick capture, you can type `#work` and the system will extract `work` as the tag name. The `#` is a syntax marker, not part of the actual tag. Similarly, project references like `+ProjectName` use `+` as a marker, and the project name cannot contain `+`.

**Uniqueness:**
- Tag names must be unique per user (case-insensitive)
- `work` = `Work` = `WORK` (same tag)
- Error if you try to create a duplicate: "A tag with the name 'work' already exists"

**Automatic cleanup:**
- Leading/trailing whitespace trimmed automatically
- Example: `"  productivity  "` becomes `"productivity"`

---

## Creating Tags

### Method 1: Auto-Creation (Most Common)

Tags are automatically created when you add them to a task, note, or project:

1. **From task creation/edit:**
   - In task form, click "Add tags" or tag icon
   - Type tag name in input field
   - Press Enter or comma
   - If tag doesn't exist, it's created automatically
   - Tag is immediately applied to the task

2. **From note creation/edit:**
   - In note edit mode, click tag icon
   - Type tag name and press Enter
   - Auto-created and applied

3. **From project form:**
   - Similar to tasks - type and press Enter
   - Auto-created and linked to project

**Auto-creation behavior:**
- No confirmation required
- Tag appears in tag list immediately
- Available for autocomplete in other forms
- Validation errors shown inline

### Method 2: Direct Creation

**From Tags page:**
1. Navigate to `/tags`
2. No "Create Tag" button exists
3. Tags are created implicitly by using them

**Limitation:** You cannot create standalone tags - they must be created by associating them with a task, note, or project.

### Method 3: From Inbox (Hashtag Parsing)

**Automatic tag extraction:**
1. Capture item in Inbox: `Review #quarterly-report +Work`
2. System detects `#quarterly-report` and extracts `quarterly-report` as the tag name
3. When converting to task/note, tag is auto-created
4. Applied to the resulting item

**Hashtag rules:**
- Must start with `#` followed by valid tag characters
- The `#` is a syntax marker, not part of the tag name
- Example: Typing `#work-item` in Inbox creates tag `work-item` (without the `#`)

---

## Using Tags

### Adding Tags to Tasks

**During task creation:**
1. Click "+ Add Task" or open task form
2. Scroll to "Tags" section
3. Click tag icon or "Add tags"
4. Tag input field appears
5. Type tag name (autocomplete suggests existing tags)
6. Press Enter or comma to add
7. Repeat for multiple tags (max 10)
8. Save task

**During task editing:**
1. Open task detail modal
2. Click "Tags" card or tag icon
3. Same input flow as creation
4. Changes save automatically

**Tag input features:**
- **Autocomplete:** Shows matching existing tags as you type
- **Keyboard navigation:** Arrow keys to navigate suggestions, Enter to select
- **Multiple selection:** Add up to 10 tags per task
- **Remove tag:** Click × on tag chip
- **Create new:** Type non-existent tag, press Enter
- **Backspace removal:** Press Backspace on empty input to remove last tag

### Adding Tags to Notes

**In note edit mode:**
1. Open note in edit mode
2. Click tag icon (🏷️) in metadata section
3. Tag input appears
4. Type and press Enter to add tags
5. Auto-saves after 1 second

**Tag display in notes:**
- Preview mode: Tags shown as clickable links below title
- Edit mode: Tag input with chips
- Click tag → Navigate to tag page

### Adding Tags to Projects

**In project form:**
1. Create or edit project
2. "Tags" field in form
3. Same tag input component
4. Type, autocomplete, and select
5. Save project

**Project tag behavior:**
- Tags inherited by tasks? **No** - tags are independent per entity
- Changing project tags doesn't affect existing tasks
- Tags help group projects by theme/category

---

## Tag Management

### Editing Tags

**Rename a tag:**
1. Navigate to `/tags` or `/tag/:uid-slug`
2. Click **edit icon** (pencil) on tag
3. Tag modal opens
4. Change tag name
5. Click "Save"
6. All associations update automatically

**What updates when you rename:**
- Tag name updates across all tasks, notes, projects using it
- URLs update to use new slug
- Autocomplete suggestions reflect new name
- No broken links (UID remains the same)

**Rename restrictions:**
- Must follow validation rules (1-50 chars, valid characters)
- Cannot rename to existing tag name (conflict error)

### Deleting Tags

**Confirmation required:**

**From tags list page:**
1. Navigate to `/tags`
2. Hover over tag card
3. Click **delete icon** (trash)
4. Confirmation dialog: "Are you sure you want to delete the tag 'tag-name'?"
5. Confirm or cancel

**From tag detail page:**
1. Navigate to `/tag/:uid-slug`
2. Click delete button (top right)
3. Confirmation dialog
4. Confirm → Redirects to `/tags`

**What gets deleted:**
- Tag record itself
- All associations with tasks (from `tasks_tags` table)
- All associations with notes (from `notes_tags` table)
- All associations with projects (from `projects_tags` table)

**What's preserved:**
- Tasks, notes, and projects themselves (only tag link removed)
- No cascading deletion
- Other tags remain intact

**No undo:**
- Deletion is immediate and irreversible
- All items lose the tag permanently

---

## Tag Pages and Navigation

### Tags List Page (`/tags`)

**Layout:**
- Alphabetical grouping (A, B, C, ...)
- Each group shows tags starting with that letter
- Search bar at top (collapsible)
- Grid layout (1-3 columns based on screen size)

**Tag display:**
- Tag name (truncated if long)
- Edit button (on hover)
- Delete button (on hover)
- Click tag name → Navigate to tag detail page

**Search functionality:**
- Case-insensitive
- Substring matching
- Real-time filtering
- No regex support

**Empty state:**
- "No tags found" when search returns zero results
- No tags exist → Empty list (no special message)

### Tag Detail Page (`/tag/:uid-slug`)

**URL format:**
- UID + slug: `/tag/abc123def-quarterly-report`
- UID only (fallback): `/tag/abc123def`
- Name (legacy, URL-encoded): `/tag/quarterly-report`

**Page sections:**
1. **Header:**
   - Tag name as title
   - Search button (collapsible)
   - Edit button (pencil icon)
   - Delete button (trash icon)

2. **Summary stats:**
   - Tasks count (with icon)
   - Notes count (with icon)
   - Projects count (with icon)

3. **Tasks section:**
   - All tasks with this tag
   - Filter by status: Open / All / Completed
   - Sort options: Due Date, Name, Priority, Status, Created At
   - Group by: None / Project
   - Search within tasks
   - TaskList or GroupedTaskList component

4. **Notes section:**
   - All notes with this tag
   - List view with title, content preview
   - Edit/delete buttons (on hover)
   - Click note → Navigate to note detail

5. **Projects section:**
   - All projects with this tag
   - ProjectItem component
   - Filter by status (active/completed)
   - Completion percentage shown

**Interactive features:**
- Sort and filter tasks without page reload
- Search updates results in real-time
- Click any item → Navigate to detail page
- Edit/delete actions on tag propagate immediately

**Empty state:**
- "No items found with the tag 'tag-name'" when no tasks/notes/projects exist
- Search returns zero results → "No tasks available"

---

## Tag Display and Rendering

### In Task Lists

**Tag display:**
- Small chips/badges below task name
- Truncated if many tags
- Clickable → Navigate to tag page
- Color: Gray background, dark text
- Icon: Tag icon (🏷️) before tag list

**Hover behavior:**
- Underline on hover
- Cursor changes to pointer
- Tooltip with full tag name (if truncated)

### In Note Previews

**Metadata row:**
- Tags shown after project (if any)
- Format: `🏷️ tag1, tag2, tag3`
- Each tag is a clickable link
- Comma-separated list

### In Project Cards

**Tag display:**
- Similar to tasks - chips or inline list
- Shown in project metadata
- Clickable links to tag pages

### Tag Chips Styling

**Default appearance:**
- Background: Light gray (`bg-gray-200`)
- Text: Dark gray (`text-gray-700`)
- Font size: Extra small (`text-xs`)
- Padding: Small (`px-2.5 py-0.5`)
- Border radius: Rounded (`rounded`)

**Dark mode:**
- Background: Dark gray (`bg-gray-700`)
- Text: Light gray (`text-gray-300`)

**Remove button (in edit mode):**
- × symbol
- Hover effect: Darker color
- Click to remove tag from item

---

## Tag Input Component

### Features

**Autocomplete:**
- Shows existing tags matching your input
- Filters out already-selected tags
- Debounced (300ms delay)
- Keyboard navigable (Arrow Up/Down)
- Enter to select

**Keyboard shortcuts:**
- `Enter` - Add tag (highlighted suggestion or new tag)
- `,` (comma) - Add tag and continue typing
- `Backspace` - Remove last tag (when input is empty)
- `Escape` - Close dropdown
- `Arrow Up/Down` - Navigate suggestions

**Tag limits:**
- Maximum 10 tags per item
- Input disabled after reaching limit
- No error message, just prevents adding more

**Visual feedback:**
- Selected tags shown as chips above input
- Placeholder: "Type to add tags..."
- Dropdown with suggestions (max height 240px, scrollable)
- Highlighted suggestion on hover/keyboard navigation

### Autocomplete Behavior

**Matching:**
- Case-insensitive
- Substring matching anywhere in tag name
- Example: "dev" matches "backend-dev", "development", "DevOps"

**Dropdown display:**
- Only shows tags not already selected
- Up to 10 suggestions (scrollable if more)
- Highlighted first match by default
- Mouseover changes highlight

**Create new tag:**
- If no matches, shows "+ Create 'tag-name'"
- Or just press Enter to create
- Validation happens on creation attempt

---

## Tag Organization

### Alphabetical Grouping

**Tags list page:**
- Groups by first letter (uppercase)
- A, B, C, ..., Z
- Special characters/numbers grouped together
- Within each group, sorted alphabetically (case-insensitive)

**Sorting:**
- Global sort: Alphabetical by name
- No custom sorting options
- Case-insensitive sort (A = a)

### User-Scoped Tags

**Privacy:**
- Tags are private to each user
- Other users cannot see your tags
- Shared projects: Each collaborator has their own tags

**Example scenario:**
- User A tags project with `#urgent` (creates tag `urgent`)
- User B (collaborator) doesn't see `#urgent` in their tag list
- User B can create their own `urgent` tag independently

### No Tag Hierarchy

**Flat structure:**
- Tags don't have parent/child relationships
- No nesting (e.g., `work/backend` is one tag, not a hierarchy)
- Workaround: Use naming conventions (`work-backend`, `work-frontend`)

**Multi-level categorization:**
- Not supported natively
- Use prefixes: `project-alpha`, `project-beta`
- Or combine tags: Add both `work` and `backend` to same item

---

## Search and Filtering

### Search Tags (Tags List Page)

**How to search:**
1. Navigate to `/tags`
2. Click search icon (top right)
3. Search input expands
4. Type query
5. Results filter in real-time

**Search behavior:**
- **Case insensitive:** "work" matches "Work", "WORK"
- **Substring matching:** "dev" matches "development", "backend-dev"
- **Single query:** No multi-word AND/OR logic
- **No fuzzy matching:** Exact substring required

**Search scope:**
- Tag name only
- Does not search tags' associated items

### Filter by Tag (Content Pages)

**Task filtering:**
- API endpoint: `GET /api/tasks?tag=tag-name`
- Frontend: Navigate via tag page → Shows tasks with that tag

**Note filtering:**
- API endpoint: `GET /api/notes?tag=tag-name`
- URL query parameter: `/notes?tag=bookmark`

**Project filtering:**
- No dedicated API endpoint
- Tag detail page filters projects client-side

**Multiple tag filtering:**
- Not supported in UI
- API supports single tag filter only
- Workaround: Use tag detail page + search

---

## Integration with Other Features

### Inbox Integration

**Hashtag parsing:**
- Inbox items can include `#tag-name` syntax
- Example: `Buy groceries #home #errands`
- When converting to task: Tags `home` and `errands` auto-created and applied
- Note: The `#` is only a syntax marker in Inbox, not part of the actual tag name

**Smart suggestions:**
- Inbox processor detects hashtags
- Suggests converting to task/note with tags pre-filled

**URL detection:**
- Inbox items with URLs suggest "Note"
- Can include tags: `https://example.com #bookmark #reading`

### Task Integration

**Task creation:**
- Tag input in task form
- Auto-save when tags change
- Tags persist with task

**Recurring tasks:**
- Tags applied to parent task
- All future occurrences inherit tags
- Changing tags on parent updates all future instances

**Subtasks:**
- Can have different tags than parent
- No automatic inheritance
- Independent tag management

### Note Integration

**Note tagging:**
- Tag input in edit mode
- Tags shown in preview mode as links
- Click tag → Navigate to tag page

**Auto-save behavior:**
- Tag changes trigger auto-save
- 1-second debounce
- Save status indicator updates

### Project Integration

**Project tagging:**
- Tag field in project form
- Tags help categorize projects
- Useful for filtering project list

**Shared projects:**
- Tags remain user-specific
- Collaborators don't see your tags
- Each user maintains their own tag set for shared projects

---

## Common Workflows

### Workflow 1: Tag-Based Task Management

**Scenario:** Organize tasks by context (e.g., @home, @office, @phone)

1. Create tasks and tag them:
   - "Fix garage door" → `#home`, `#maintenance` (creates tags `home` and `maintenance`)
   - "Review budget report" → `#office`, `#finance` (creates tags `office` and `finance`)
   - "Call dentist" → `#phone`, `#health` (creates tags `phone` and `health`)

2. Navigate to tag page to see filtered view:
   - `/tag/home` → All home tasks
   - `/tag/phone` → All phone-related tasks

3. Complete tasks in batches by context:
   - At home? View `#home` tag, complete all tasks
   - Have phone? View `#phone` tag, make all calls

### Workflow 2: Cross-Project Tracking

**Scenario:** Track all "urgent" items across multiple projects

1. Tag urgent tasks/notes/projects with `#urgent` (creates tag `urgent`)
2. Navigate to `/tag/urgent`
3. See all urgent items regardless of project
4. Filter and sort as needed
5. Update status, priorities, etc.

### Workflow 3: Thematic Note Organization

**Scenario:** Collect bookmarks, articles, and references by topic

1. Save articles as notes with tags:
   - "React Hooks Guide" → `#development`, `#react`, `#reference`
   - "Design Patterns" → `#development`, `#patterns`, `#reference`

2. Navigate to `/tag/development` to see all dev-related notes
3. Or `/tag/reference` for all reference materials

### Workflow 4: Quarterly Review

**Scenario:** Review all items related to Q1 goals

1. During Q1, tag relevant tasks/notes/projects with `#q1-2026` (creates tag `q1-2026`)
2. At end of quarter, navigate to `/tag/q1-2026`
3. See all items related to Q1 goals
4. Review completion rates
5. Archive or re-tag for next quarter

### Workflow 5: Tag Cleanup

**Scenario:** Remove unused or redundant tags

1. Navigate to `/tags`
2. Search for old tags
3. Click tag to see what items use it
4. If empty or obsolete, delete tag
5. If overlapping (e.g., `work` and `work-related`), rename or consolidate

---

## Troubleshooting

### "Tag name contains invalid characters"

**Possible causes:**
1. Using restricted characters in the tag name itself: `# % & { } \ < > * ? / $ ! ' " @ + \` | =`
2. Example: Trying to create a tag literally named `#hashtag` (the `#` character is not allowed in tag names)

**Solution:**
- Remove invalid characters
- Use hyphens or underscores: `hashtag`, `hash-tag`
- Remember: When typing `#hashtag` in Inbox, the system creates tag `hashtag` (without the `#`)

### "A tag with the name 'X' already exists"

**Cause:** Tag names are unique per user (case-insensitive)

**Example:**
- You have tag `Work`
- Try to create `work` → Error (same tag)

**Solution:**
- Use existing tag
- Or create variation: `work-projects`, `work-tasks`

### "Tag disappeared after creating task"

**Possible causes:**
1. Task creation failed (network error)
2. Tag wasn't saved before closing form
3. Browser refresh before save completed

**Solution:**
- Check task exists in task list
- Open task → Check tags section
- Re-add tag if missing

### "Cannot add more than 10 tags"

**Cause:** Tag limit per item is 10

**Solution:**
- Remove less important tags
- Or consolidate tags (e.g., merge `urgent` and `high-priority` into one)

### "Tag page shows wrong items"

**Possible causes:**
1. Cached data (page not refreshed)
2. Tag was renamed, URL slug outdated
3. Items were untagged recently

**Solution:**
- Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`
- Navigate via `/tags` list (ensures correct UID)
- Check item details to confirm tag association

---

## Best Practices

### Naming Conventions

1. **Be consistent:**
   - Choose singular vs. plural: `project` vs. `projects`
   - Stick with convention across all tags

2. **Use prefixes for grouping:**
   - `status-active`, `status-pending`, `status-done`
   - `area-work`, `area-personal`, `area-health`

3. **Keep names short but descriptive:**
   - ✅ `backend-dev`, `urgent`, `q1-2026`
   - ❌ `this-is-a-really-long-tag-name-that-describes-too-much`

4. **Use hyphens or underscores for multi-word:**
   - ✅ `project-alpha`, `meeting_notes`
   - ❌ `project alpha` (spaces are valid but harder to read)

### Organization

1. **Limit tag proliferation:**
   - Don't create tags for one-off uses
   - Reuse existing tags when possible
   - Regularly review and delete unused tags

2. **Use tags for cross-cutting concerns:**
   - Themes that span multiple projects: `#urgent`, `#waiting-on` (Inbox syntax)
   - Contexts: `#home`, `#office`, `#errands` (Inbox syntax)
   - Time periods: `#q1-2026`, `#january` (Inbox syntax)

3. **Combine with hierarchy:**
   - Use projects for structure (Areas > Projects > Tasks)
   - Use tags for flexible categorization
   - Example: Project "Website Redesign", tag `#frontend` on relevant tasks

### Maintenance

1. **Regular cleanup:**
   - Monthly: Review tag list, delete unused tags
   - Quarterly: Consolidate similar tags
   - Rename outdated tags (e.g., `2025` → `2026`)

2. **Tag naming audit:**
   - Ensure consistency (singular vs. plural)
   - Fix typos: `developement` → `development`
   - Merge duplicates: `work` and `work-related` → choose one

3. **Document tag taxonomy:**
   - Create a note listing standard tags and their meanings
   - Tag it with `#reference`, `#tags` (Inbox syntax creates tags `reference` and `tags`)
   - Share with team if using shared projects

---

## Limitations and Constraints

### Current Limitations

1. **No tag hierarchy:**
   - Flat structure only
   - No parent-child relationships
   - Workaround: Use naming conventions (`parent-child`)

2. **User-scoped only:**
   - Cannot share tags with other users
   - Collaborators on shared projects have separate tag sets
   - No team-wide tag taxonomy

3. **Single tag filter:**
   - Cannot filter by multiple tags simultaneously in UI
   - API supports single tag filter only
   - Workaround: Use tag detail page + search

4. **No tag colors/icons:**
   - All tags display the same (gray chips)
   - No visual customization
   - Cannot assign colors or emojis

5. **10 tag limit per item:**
   - Tasks, notes, projects limited to 10 tags each
   - No warning when approaching limit
   - Must remove existing tag to add new one

6. **No tag usage statistics:**
   - Cannot see how many items use a tag (without visiting tag page)
   - No "popular tags" or "recently used"
   - Tag count not shown in tag list

### Technical Constraints

1. **Character restrictions:**
   - Invalid chars: `# % & { } \ < > * ? / $ ! ' " @ + \` | =`
   - Limits URL-friendly tag names
   - No emoji support

2. **50-character limit:**
   - Tag names truncated at 50 characters
   - Long descriptive names not possible

3. **Case-insensitive uniqueness:**
   - Cannot have `Work` and `work` as separate tags
   - Display preserves case, but uniqueness ignores it

4. **No batch operations:**
   - Cannot bulk-tag items
   - Cannot mass-rename tags
   - Must edit one at a time

---

## Related Documentation

- [Inbox Page](04-inbox-page.md) - Hashtag parsing and tag auto-creation
- [Notes System](05-notes-system.md) - Tagging notes
- [Projects](06-projects.md) - Tagging projects
- [Today Page Sections](02-today-page-sections.md) - Task filtering
- [Architecture Overview](architecture.md) - Technical architecture
- [Development Workflow](development-workflow.md) - Working with the codebase

**Technical Implementation Files:**
- Tag model: `/backend/models/tag.js`
- Tag service: `/backend/modules/tags/service.js`
- Tag controller: `/backend/modules/tags/controller.js`
- Tag repository: `/backend/modules/tags/repository.js`
- Tag validation: `/backend/modules/tags/validation.js`
- Tag API routes: `/backend/modules/tags/routes.js`
- Tags list component: `/frontend/components/Tags.tsx`
- Tag detail component: `/frontend/components/Tag/TagDetails.tsx`
- Tag input component: `/frontend/components/Tag/TagInput.tsx`
- Tag modal: `/frontend/components/Tag/TagModal.tsx`
- Tags service (frontend): `/frontend/utils/tagsService.ts`

**Database Tables:**
- `tags` - Tag definitions
- `tasks_tags` - Task-tag associations (many-to-many)
- `notes_tags` - Note-tag associations (many-to-many)
- `projects_tags` - Project-tag associations (many-to-many)

---

**Document Version:** 1.0.1
**Last Updated:** 2026-03-23
**Audience:** Developers, AI assistants, and end users