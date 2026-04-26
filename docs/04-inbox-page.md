# Inbox Page - Behavior Rules

This document explains how the Inbox page works in tasknotetaker from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/inbox/` and frontend components in `/frontend/components/Inbox/`.

---

## Overview

The **Inbox** is tasknotetaker's quick capture system - a temporary holding area where you can rapidly dump ideas, tasks, notes, and links without worrying about organization. It's designed to get things out of your head fast, then process them later into structured tasks, projects, or notes.

**Key characteristics:**
- Zero friction capture - just type and submit
- Smart parsing of hashtags, projects, and URLs
- AI-powered suggestions for what to create
- Convert items to tasks, notes, or projects
- Integration with Telegram for remote capture

**URL:** `/inbox`

---

## Core Principles

1. **Capture first, organize later**
   - Add items instantly without choosing status, priority, or due dates
   - Process and categorize items when you have time to think

2. **One place for everything**
   - Tasks, notes, bookmarks, random thoughts - all start here
   - Sort them out later into appropriate places

3. **Smart automation helps**
   - System detects patterns in your input
   - Suggests task vs. note vs. project based on content
   - Auto-extracts tags and project references

---

## How to Add Items to Inbox

### Quick Capture Input

Located at the top of the Inbox page:

1. **Type your content** in the text field
   - Plain text: `Remember to buy milk`
   - With tags: `Call dentist #health #urgent`
   - With project: `Review proposal +ClientProject #review`
   - URLs: `https://example.com/article`
   - Mixed: `Read this article https://example.com +Reading #bookmark`

2. **Press Enter or Tab** to submit (configurable in settings)
   - Item is saved to inbox immediately
   - Input clears, ready for next item
   - Can add multiple items rapidly

3. **Input auto-focuses** when you navigate to `/inbox`
   - Keyboard shortcut: `g` then `i` (Go to Inbox)
   - Sidebar navigation clicks auto-focus input

### Telegram Integration

Send messages to your tasknotetaker bot:
- Each message creates an inbox item
- Source is marked as `telegram`
- Appears in your inbox within ~15 seconds
- You get a toast notification when new items arrive

---

## Smart Parsing Rules

The system automatically analyzes your input and extracts metadata:

### 1. Hashtags (Tags)

**Syntax:** `#tagname`

**Rules:**
- Must start with `#` followed by alphanumeric characters, hyphens, or underscores
- Valid: `#work`, `#high-priority`, `#q1_2026`
- Invalid: `#with spaces`, `#emoji🎉`, `#punctuation!`
- Can appear anywhere in the text
- Multiple tags supported: `Task here #work #urgent #review`

**Grouping:**
- Consecutive tags/projects are treated as a group
- Example: `Buy groceries #food #shopping #weekly` → extracts all 3 tags
- Group must be contiguous (separated by spaces from other words)

**Tag creation:**
- If tag doesn't exist, it's created when you convert to task/note/project
- Tags are case-insensitive: `#Work` = `#work` = `#WORK`

### 2. Project References

**Syntax:** `+projectname` or `+"project with spaces"`

**Rules:**
- Must start with `+` followed by project name
- No spaces: `+HomeRenovation`
- With spaces: `+"Home Renovation"` (use quotes)
- Valid: `+work`, `+Q1Planning`, `+"Client Project"`
- Can appear anywhere in the text

**Behavior:**
- If project exists, it's linked automatically
- If project doesn't exist, you'll be prompted to create it
- Only the first project reference is used when converting
- Multiple references are parsed but only first is applied

### 3. URL Detection

**What counts as a URL:**
- Must start with `http://` or `https://`
- Example: `https://example.com`, `http://blog.com/post`

**Special handling:**
- URLs automatically get `#bookmark` tag added
- When converted to note, system tries to fetch page title
- Title extraction has 3-second timeout
- If title fetch fails, URL itself is used as title

**Bookmark auto-tagging:**
- If you add `#bookmark` manually, it's preserved
- If you don't, system adds it automatically for URLs
- Applies to both explicit tags and when converting to note

### 4. Cleaned Content

After parsing, the system creates "cleaned content":
- Original: `Review contract +ClientWork #urgent #review`
- Cleaned: `Review contract`
- Tags and projects are stripped for display/conversion
- Cleaned version is used as task name, note title, or project name

---

## Intelligent Suggestions

The system analyzes your content and suggests what type of item to create:

### Suggestion Logic

**1. Suggests TASK when:**
- Content starts with an action verb (detected using NLP)
- Has a project reference
- Examples:
  - ✅ `Call John +Work` → Suggests Task (verb "Call")
  - ✅ `Review proposal +ClientProject` → Suggests Task (verb "Review")
  - ✅ `Fix the bug +Development` → Suggests Task (verb "Fix")

**2. Suggests NOTE when:**
- Content is a URL (bookmark)
- Has explicit `#bookmark` tag
- Has a project reference but no action verb
- Examples:
  - ✅ `https://example.com/article +Reading` → Suggests Note (URL)
  - ✅ `Meeting notes from today +Project1 #bookmark` → Suggests Note (bookmark tag)
  - ✅ `Important info +Work` → Suggests Note (no verb)

**3. No suggestion when:**
- No project reference
- Just plain text or tags without context
- Examples:
  - ⚪ `Random thought #idea` → No suggestion
  - ⚪ `Buy milk` → No suggestion
  - ⚪ `https://example.com` → Shows URL icon, but no suggestion (no project)

### Visual Indicators

**Suggestion badges:**
- Blue "Task" badge appears if suggested as task
- Purple "Note" badge appears if suggested as note
- Reason shown in tooltip: "verb detected", "bookmark tag", "URL detected"

**Icons:**
- 🌐 Globe icon: Bookmark/URL content
- 📄 Document icon: Plain text
- 📝 Purple document: Long-form text (has title + content)

---

## Converting Inbox Items

Each inbox item can be converted to three types:

### 1. Convert to Task

**What happens:**
1. Opens the task detail page in edit mode
2. Pre-fills task name with cleaned content
3. Applies tags from hashtags
4. Links to project if project reference found
5. Status defaults to "Not Started"
6. After saving, inbox item is marked as "processed"

**Use cases:**
- Action items: `Call dentist #health`
- Work tasks: `Review PR #dev +ProjectX`
- Todos with deadlines: `Submit report #work #urgent`

**Keyboard shortcut in quick capture:**
- `Ctrl+T` (Windows/Linux) or `Cmd+T` (Mac) to convert to task directly

### 2. Convert to Note

**What happens:**
1. Opens note modal
2. Pre-fills note content with original text
3. If URL: fetches page title and uses as note title (3s timeout)
4. Applies tags from hashtags + `#bookmark` if URL
5. Links to project if project reference found
6. After saving, inbox item is marked as "processed"

**Use cases:**
- Bookmarks: `https://article.com +Reading`
- Ideas: `New feature idea for app +Development`
- Reference material: `Meeting notes from today +ClientProject`

**Keyboard shortcut in quick capture:**
- `Ctrl+N` (Windows/Linux) or `Cmd+N` (Mac) to convert to note directly

### 3. Convert to Project

**What happens:**
1. Opens project modal
2. Pre-fills project name with cleaned content
3. Applies tags from hashtags
4. Status defaults to "Planned"
5. After saving, inbox item is marked as "processed"

**Use cases:**
- New initiatives: `Website redesign #q1 #priority`
- Areas of work: `Home renovation #personal`
- Client work: `New client onboarding #clients`

**Keyboard shortcut in quick capture:**
- `Ctrl+P` (Windows/Linux) or `Cmd+P` (Mac) to convert to project directly

### Direct Creation vs. Modal Editing

**For tasks:** System immediately navigates to task detail page for editing
- No modal - you edit inline on the task page
- Gives you full access to all task fields
- Back button returns to inbox

**For notes and projects:** Modal opens for editing
- Edit within overlay modal
- Save or cancel without leaving inbox page
- More lightweight for quick additions

---

## Inbox Item Lifecycle

### States

1. **Added** (status: `added`)
   - Freshly created item
   - Appears in inbox list
   - Awaiting processing

2. **Processed** (status: `processed`)
   - Converted to task, note, or project
   - Removed from inbox view
   - Stored in database for history (not deleted)

### Processing

**What "processing" means:**
- Marks item as `processed`
- Removes from visible inbox
- Preserves in database for audit trail
- Cannot be un-processed (one-way action)

**When items are auto-processed:**
- When you convert to task and save
- When you convert to note and save
- When you convert to project and save

**Manual processing:**
- Not directly exposed in UI
- Happens automatically on conversion
- No "Mark as processed" button needed

---

## Editing Inbox Items

### Inline Editing

**How to edit:**
1. Click anywhere on the inbox item text
2. Item expands into editable composer
3. Modify text, add/remove tags or projects
4. Press Enter or click outside to save
5. Press Esc to cancel changes

**What you can edit:**
- Full content/text
- Add or remove hashtags
- Add or remove project references
- URLs are preserved as text

**Editing rules:**
- If content unchanged, no update is sent
- Editing re-runs smart parsing
- Suggestions update based on new content
- Keyboard shortcuts (Ctrl+T, Ctrl+N, Ctrl+P) work while editing

### Composer Footer Actions

While editing, you see action buttons:
- **Task** button: Convert to task with current content
- **Note** button: Convert to note with current content
- **Project** button: Convert to project with current content
- **Delete** button: Remove inbox item permanently

---

## Deleting Inbox Items

### Confirmation

**Steps:**
1. Click Delete button in composer footer
2. Confirmation dialog appears
3. Confirm or cancel

**What gets deleted:**
- Inbox item is permanently removed from database
- NOT marked as processed - it's deleted
- No undo option

### When to delete vs. process

**Delete when:**
- Item is no longer relevant
- Duplicate entry
- Captured by mistake
- Spam/noise

**Process when:**
- Item becomes task/note/project
- Actually converting to structured content
- Want to preserve in audit trail

---

## Pagination and Loading

### Initial Load

- Shows **20 items** by default
- Most recent items first (newest at top)
- Loading screen while fetching

### Load More

**When "Load More" button appears:**
- You have more than 20 items
- Shows: "Showing X of Y items"
- Button at bottom of list

**How it works:**
1. Click "Load More" button
2. Fetches next 20 items
3. Appends to current list
4. Updates count display
5. Button disappears when all items loaded

**URL state:**
- After loading more: URL updates to `?loaded=40` (or current count)
- Bookmarking preserves loaded count
- Refreshing page maintains loaded count from URL

**No infinite scroll:**
- Manual "Load More" button only
- Intentional - prevents accidental loading
- Better performance for large inboxes

---

## Auto-Refresh and Polling

### Background Polling

**How it works:**
- Every **15 seconds**, checks for new items
- Fetches updated inbox from server
- Preserves current scroll position
- Maintains loaded count (doesn't reset to 20)

**What triggers updates:**
- Telegram messages arrive
- Other devices add items
- Web app open in multiple tabs

**Notifications:**
- Toast notification when new Telegram item detected
- Shows first item's content
- If multiple items: shows count of additional items
- Example: "New item from Telegram: Buy milk" + "2 more new items added"

### Manual Refresh

**Keyboard shortcut:**
- `r` key: Force refresh inbox
- Fetches latest items immediately
- Useful if polling missed an update

**When refresh happens automatically:**
- After you create an item via quick capture
- After you delete an item
- After you convert an item (it's removed)
- Navigation to/from inbox page

---

## Keyboard Shortcuts

### Global (anywhere in app)

| Shortcut | Action |
|----------|--------|
| `g` then `i` | Go to Inbox page |

### On Inbox page

| Shortcut | Action |
|----------|--------|
| `r` | Refresh inbox items |
| Focus in input | Type to add item |
| `Enter` or `Tab` | Submit item (configurable in settings) |

### In quick capture composer

| Shortcut (Win/Linux) | Shortcut (Mac) | Action |
|----------------------|----------------|--------|
| `Ctrl+T` | `Cmd+T` | Convert to Task |
| `Ctrl+N` | `Cmd+N` | Convert to Note |
| `Ctrl+P` | `Cmd+P` | Convert to Project |
| `Ctrl+Enter` | `Cmd+Enter` | Save to inbox instead of converting |
| `Esc` | `Esc` | Cancel editing |

### While editing item

| Shortcut | Action |
|----------|--------|
| `Esc` | Cancel editing, revert changes |
| Click outside | Save changes |
| `Enter` | Save changes (if not multiline) |

---

## Special Features

### 1. Project Creation on the Fly

**When converting:**
- If you reference a project that doesn't exist: `+NewProject`
- System prompts to create the project
- Project created with name "NewProject", status "Planned"
- Task/note is then linked to newly created project

**Workflow:**
1. Add inbox item: `Review docs +NewClientProject #urgent`
2. Click "Task" to convert
3. System detects `NewClientProject` doesn't exist
4. Project created automatically
5. Task is linked to new project

### 2. Tag Creation on the Fly

**When converting:**
- If you use hashtag that doesn't exist: `#newtag`
- Tag is created automatically during conversion
- No confirmation needed
- Tag appears in tag list immediately

**Case insensitivity:**
- `#Work`, `#work`, `#WORK` all resolve to same tag
- First occurrence determines the canonical case
- Subsequent uses are normalized to existing tag

### 3. URL Title Extraction

**For bookmarks:**
- When converting URL to note
- System fetches the webpage
- Extracts `<title>` tag from HTML
- Uses as note title
- 3-second timeout - if it fails, uses URL as title

**Example:**
- Input: `https://example.com/article`
- System fetches page, finds title: "10 Tips for Productivity"
- Note created with title: "10 Tips for Productivity"
- Content: `https://example.com/article`
- Tags: `#bookmark` (auto-added)

### 4. Multi-Source Capture

**Sources tracked:**
- `web`: Added via web interface (quick capture)
- `telegram`: Added via Telegram bot
- `api`: Added via REST API (rare)

**Why it matters:**
- Can filter by source (not in UI, but in database)
- Telegram items show notification on arrival
- Useful for debugging integration issues

### 5. Long-Form Content

**Handling multi-line input:**
- Quick capture supports multi-line (Shift+Enter for new line)
- First line becomes `title`
- Full text stored as `content`
- Title shown in inbox list
- Content accessible when editing

**Visual indicator:**
- Purple document icon for items with title+content
- Gray document icon for plain text items
- Globe icon for URLs/bookmarks

---

## Display and Organization

### Sort Order

**Inbox items are always sorted by:**
- Creation date descending (newest first)
- No other sort options available
- Newest items at top encourages processing fresh captures

### No Filtering

**Intentional limitation:**
- No search within inbox
- No tag filtering
- No project filtering
- Philosophy: Inbox is temporary - process items, don't organize them here

### No Grouping

**All items in flat list:**
- No grouping by date
- No grouping by source
- No grouping by tags/projects
- Keeps it simple and fast to scan

---

## Example Workflows

### Workflow 1: Quick Task Capture

**Scenario:** You remember a task while working on something else

1. Press `g` then `i` to open inbox
2. Type: `Email report to manager +Work #urgent`
3. Press Enter
4. System suggests "Task" (verb detected)
5. Click "Task" button or press Ctrl+T
6. Task detail page opens with:
   - Name: "Email report to manager"
   - Project: Work
   - Tags: #urgent
7. Set due date, priority, etc.
8. Save task
9. Inbox item auto-processed and removed

### Workflow 2: Bookmark Collection

**Scenario:** Found an interesting article to read later

1. Navigate to `/inbox`
2. Paste URL: `https://medium.com/article +Reading`
3. Press Enter
4. System shows globe icon (URL detected)
5. Click "Note" button or press Ctrl+N
6. System fetches article title: "How to Learn Faster"
7. Note modal opens:
   - Title: "How to Learn Faster"
   - Content: `https://medium.com/article`
   - Project: Reading
   - Tags: #bookmark (auto-added)
8. Save note
9. Inbox item removed

### Workflow 3: Telegram to Task

**Scenario:** You're away from computer, send task to Telegram bot

1. Send message to Telegram bot: `Buy birthday gift for mom #personal #shopping`
2. Within 15 seconds, item appears in web inbox
3. Toast notification: "New item from Telegram: Buy birthday gift for mom"
4. Later, at computer, open `/inbox`
5. See the item with tags parsed: #personal, #shopping
6. Click to edit, add project: `+PersonalLife`
7. Click "Task" to convert
8. Set due date (her birthday)
9. Save - task created, inbox cleared

### Workflow 4: Batch Processing

**Scenario:** Morning routine - clear out yesterday's inbox

1. Open `/inbox` - see 8 items
2. First item: `Call plumber #home` → Click "Task", set due today, save
3. Second item: `https://article.com +Reading` → Click "Note", save
4. Third item: `Random idea for app` → Edit, add `+ProjectIdeas`, click "Note"
5. Fourth item: `Buy milk` → Delete (already done)
6. Continue through all items
7. Inbox empty - ready for new day

### Workflow 5: Quick Project Ideation

**Scenario:** Brainstorming new project ideas

1. Press `g` then `i`
2. Type rapid-fire ideas:
   - `Redesign homepage #q2 #design`
   - `Build mobile app #q2 #dev`
   - `Customer research #q1 #research`
3. Later, convert each to projects:
   - Each becomes a project with tags
   - Start fleshing out project details
   - Add tasks to each project

---

## Common Patterns

### Pattern: URL → Note with Bookmark Tag

**Input:** `https://example.com +Reading`
**Result:**
- System detects URL
- Auto-adds `#bookmark` tag
- Suggests "Note"
- Fetches page title
- Creates note linked to Reading project

### Pattern: Verb + Project → Task

**Input:** `Review proposal +ClientWork #urgent`
**Result:**
- System detects verb "Review"
- Suggests "Task"
- Creates task:
  - Name: "Review proposal"
  - Project: ClientWork
  - Tags: #urgent

### Pattern: No Project → No Suggestion

**Input:** `Random thought #idea`
**Result:**
- No project reference
- No suggestion shown
- Can manually convert to task, note, or project
- Tags are still parsed

### Pattern: Multi-Tag Grouping

**Input:** `Task here #work #urgent #review and more text`
**Result:**
- All consecutive tags extracted: work, urgent, review
- Cleaned content: "Task here and more text"
- Tags group is contiguous at end of thought

---

## Troubleshooting

### "My tags aren't being detected"

**Check:**
1. Are tags alphanumeric + hyphens/underscores only?
   - ❌ `#tag with spaces`
   - ✅ `#tag-with-hyphens`
2. Are tags separated by spaces from words?
   - ❌ `word#tag`
   - ✅ `word #tag`

### "My project reference isn't working"

**Check:**
1. Did you use `+` prefix?
   - ❌ `Project Name`
   - ✅ `+ProjectName`
2. Does project name have spaces? Use quotes:
   - ❌ `+Client Project`
   - ✅ `+"Client Project"`
3. Does the project exist? System links only to existing projects

### "Inbox item didn't get processed after conversion"

**Possible causes:**
- Conversion failed (check for error toast)
- Network error during save
- Item still showing because page didn't refresh
- Try manual refresh with `r` key

### "Telegram items not appearing"

**Check:**
1. Is Telegram bot properly configured? (Settings > Telegram)
2. Wait up to 15 seconds for polling cycle
3. Check inbox for toast notification
4. Try manual refresh with `r` key
5. Verify bot token is correct in settings

### "URL title extraction failed"

**Why it happens:**
- Website blocks scraping/bots
- Website requires JavaScript to load
- Network timeout (3 seconds)
- Invalid URL format

**What to do:**
- System falls back to using URL as title
- You can manually edit title in note modal
- URL content is still saved correctly

---

## Related Documentation

- [Today Page Sections](02-today-page-sections.md) - How tasks flow from inbox to Today
- [Architecture Overview](architecture.md) - Technical architecture
- [Development Workflow](development-workflow.md) - Working with the codebase
- [Common Tasks](common-tasks.md) - How to modify inbox functionality

**Technical Implementation Files:**
- Inbox processing service: `/backend/modules/inbox/inboxProcessingService.js`
- Inbox model: `/backend/models/inbox_item.js`
- Inbox API routes: `/backend/modules/inbox/routes.js`
- Inbox controller: `/backend/modules/inbox/controller.js`
- Frontend components: `/frontend/components/Inbox/`
- Quick capture input: `/frontend/components/Inbox/QuickCaptureInput.tsx`
- Item detail: `/frontend/components/Inbox/InboxItemDetail.tsx`
- Inbox service: `/frontend/utils/inboxService.ts`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Audience:** Developers, AI assistants, and end users