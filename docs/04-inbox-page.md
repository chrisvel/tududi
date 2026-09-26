# Inbox Page - Behavior Rules

This document explains how the Inbox page works in tududi from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/inbox/` and frontend components in `/frontend/components/Inbox/`.

---

## Overview

The **Inbox** is tududi's quick capture system - a temporary holding area where you can rapidly dump ideas, tasks, notes, and links without worrying about organization. It's designed to get things out of your head fast, then process them later into structured tasks, projects, or notes.

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

### The Add box (Inbox, Task, Note, Project)

One box is used everywhere you add something. It is the input at the top of the Inbox page, a popover under the blue **Add** button in the navbar (wide screens), and a sheet opened by the round **Add** button at the bottom of the screen (phones and tablets, hidden on the Inbox page and while editing a task or note). `Alt+Shift+T` and the sidebar's New > Task open it on **Task**. Every other entry point opens it on **Inbox**.

**Add to.** A row of choices next to the Add button decides what the text becomes: Inbox, Task, Note or Project. Nothing is guessed. The selected choice is what gets created, and the box always starts on Inbox when it opens.

| Add to | First line | Other lines | Also read from the first line |
|--------|-----------|-------------|-------------------------------|
| Inbox | kept exactly as typed | kept exactly as typed | applied later, when the item is converted |
| Task | title | notes | due date, recurrence, `@person`, `#tags`, `+Project` |
| Note | title | body | `#tags`, `+Project` (a note has no due date, so date words stay in the title) |
| Project | name | description | due date, `#tags` |

Dates and `@person` are read from the first line only, so a date mentioned further down a long note never becomes its due date. `#tags` are read anywhere in the text. An unknown `#tag` or `+Project` is created when you add.

**Several lines.** By default everything you type becomes one item. When the text has more than one line, the box says so in one sentence ("This will be 1 task. The first line is the title and the other 2 lines are its notes.") with a link to switch to **One item per line**, which makes one item per non-empty line and strips list markers such as `-`, `*` and `1.`. If one line fails to save, the lines that were not saved stay in the box.

**Files.** Paste, drop, or pick files with the paperclip button and they are saved with whatever the text becomes. An Inbox item, task or project keeps them as attachments. A note gets them in its text, after what was typed: images show inline and other files become links. A pasted screenshot on its own is enough: its file name becomes the title. Pasted images are renamed from the browser's generic `image.png` to `Pasted image <date time>.png`. When a copy carries both text and a picture (spreadsheet cells, for example), the text is pasted and the picture is ignored. With One item per line, the files go on the first item. Each file must be under the server's upload limit, and one item holds up to 20. If a file fails to upload, the item is still saved and the failed file names are shown.

When an Inbox item with files becomes a task, project or note, its files move there (for a note, into its text). Deleting an Inbox item deletes its files. Inbox files are visible only to their owner.

**Enter.** On a computer keyboard Enter adds and Shift+Enter starts a new line. On a touch device Return starts a new line and the Add button adds, with a Line break button available if Return is set to add. Ctrl or Cmd + Enter always adds. Both defaults can be changed under Profile > Keyboard Shortcuts > Adding items, along with One item per line. These settings are kept on the device.

**Confirmation and Undo.** There is no toast. One quiet line under the box says what was saved ("Saved "Call Sam" to Inbox.") with an Undo link, and it stays until you type again. Undo deletes what was just created. Closing the popover or sheet keeps any half-typed text, and focus returns to where it was.

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

### Share Sheet (installed PWA)

Share a link or selected text from another app (Android, or desktop Chrome/Edge) and pick tududi:
- The app opens on `/inbox` with the shared title, text and URL prefilled in Quick Capture
- Nothing is saved yet — edit it, then press Enter or pick Task / Note / Project
- Smart parsing, URL preview and suggestions behave exactly as if you had typed it
- If your session expired, you land on login first and the shared content is restored afterwards

See [PWA & Offline Support](15-pwa.md) for the manifest configuration and limitations (text/links only, not available on iOS).

### Telegram Integration

Send messages to your tududi bot:
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

### 4. Due Dates

Write a date in plain English and it becomes the task's due date:

- `Call plumber tomorrow`, `Submit form today`
- `Book table next fri`, `Pay invoice on monday`
- `Follow up in 3 days`, `Renew passport Oct 12`

**Rules:**
- Dates are worked out in your timezone. For an item that sat in the inbox, relative dates count from when it was captured: "tomorrow" in an item added on Monday means Tuesday, even if you convert it on Wednesday.
- Only one date is used. With more than one, the last one wins.
- The date words are removed from the task name. A phrase with a time (`tomorrow at 3pm`) still sets the date but stays in the name, because due dates have no time.
- Bare words that are usually just words are ignored: `may`, `march`, `sun`, `sat`, `wed`, and numbers on their own. Nothing inside a `#tag`, `+project`, `@person` or URL is read as a date.
- A calendar chip under the input shows the date. Its × keeps the words as plain text and nothing is parsed from that phrase.

### 5. Recurrence

`every ...` phrases make a recurring task, starting at the first matching day:

| You write | Repeats |
|-----------|---------|
| `every day`, `daily` (at the end) | Every day |
| `every 3 days`, `every other week`, `every 2 months` | That interval |
| `every week`, `weekly` (at the end) | Every week |
| `every weekday` | Monday to Friday |
| `every mon, wed and fri` | Those weekdays |
| `every month`, `monthly` (at the end) | Every month |
| `every month on the 15th`, `every 15th` | That day of the month |
| `every first monday`, `every last friday` | That weekday of the month |
| `every last day of the month` | The last day of each month |

`daily`, `weekly` and `monthly` only count as the last word, so `Write weekly report` stays a plain name.

### 6. People (@person)

**Syntax:** `@name` or `@"Full Name"`

- Type `@` to pick from the people the task can be assigned to. Names with spaces are inserted in quotes.
- The list is the same as the assignee list (see [People, Members & Roles](19-people-and-roles.md)): the project's list when the text has a `+project`, otherwise your contacts and your workspace.
- A full name matches first. A first name matches only when one person has it.
- A matched person is removed from the name and the task is assigned to them (members are notified as usual). An `@word` that matches nobody stays in the text, so email addresses and handles are safe.

### 7. Cleaned Content

After parsing, the system creates "cleaned content":
- Original: `Review contract tomorrow @Maria +ClientWork #urgent`
- Cleaned: `Review contract`
- Tags, projects, the date or recurrence phrase and a matched person are stripped
- Cleaned version is used as task name, note title, or project name

---

## Intelligent Suggestions

In the Add box the destination is always chosen explicitly, so these suggestions no longer create anything automatically. The legacy suggestion logic below still describes how the backend classifies text (`suggested_type`), which the Inbox uses when converting items.

The system analyzes your content and suggests what type of item to create:

### Suggestion Logic

**1. Suggests TASK when:**
- Content has a due date, a recurrence or a matched `@person` (and no URL), or
- Content starts with an action verb (detected using NLP) and has a project reference
- Examples:
  - ✅ `Call plumber tomorrow` → Suggests Task (date)
  - ✅ `Ask @Maria about rent` → Suggests Task (person)
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
- No project reference, date or person
- Just plain text or tags without context
- Examples:
  - ⚪ `Random thought #idea` → No suggestion
  - ⚪ `Buy milk` → No suggestion
  - ⚪ `https://example.com` → Shows URL icon, but no suggestion (no project)

### Visual Indicators

**Suggestion badges:**
- Blue "Task" badge appears if suggested as task
- Purple "Note" badge appears if suggested as note
- Reason shown in tooltip: "verb detected", "date detected", "person detected", "bookmark tag", "URL detected"

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
| `Enter` | Add (Shift+Enter for a new line; changeable in Profile > Keyboard Shortcuts) |
| `Alt+Shift+T` | Open the Add box on Task (anywhere in the app) |

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

## Analyze API

`POST /api/inbox/analyze-text` parses text without saving anything. The composer calls it as you type; Telegram, MCP or API clients can call it too.

**Body:**
- `content` (required)
- `reference_date` (optional, ISO 8601): what "today" means for relative dates. Defaults to now; a future value is capped at now.
- `parse_dates` (optional): `false` skips dates and recurrence.

**Response fields:** `parsed_tags`, `parsed_projects`, `cleaned_content`, `parsed_due_date` (`YYYY-MM-DD`, also the first occurrence of a recurrence), `parsed_date_text` (the matched phrase), `parsed_recurrence` (`recurrence_type` plus the matching `recurrence_*` fields, or `null`), `parsed_person` (the name as typed), `parsed_assignee` (`{ uid, name }` or `null`), `suggested_type`, `suggested_reason`.

To create the task, send `parsed_due_date` as `due_date`, the `parsed_recurrence` fields as they are, and `parsed_assignee.uid` as `assigned_to`.

---

## Related Documentation

- [Today Page Sections](02-today-page-sections.md) - How tasks flow from inbox to Today
- [Architecture Overview](architecture.md) - Technical architecture
- [Development Workflow](development-workflow.md) - Working with the codebase
- [Common Tasks](common-tasks.md) - How to modify inbox functionality

**Technical Implementation Files:**
- Inbox processing service: `/backend/modules/inbox/inboxProcessingService.js`
- Date, recurrence and @person parsing: `/backend/modules/inbox/nlpParsers.js`
- Inbox model: `/backend/models/inbox_item.js`
- Inbox API routes: `/backend/modules/inbox/routes.js`
- Inbox controller: `/backend/modules/inbox/controller.js`
- Frontend components: `/frontend/components/Inbox/`
- Quick capture input: `/frontend/components/Inbox/QuickCaptureInput.tsx`
- Item detail: `/frontend/components/Inbox/InboxItemDetail.tsx`
- Inbox service: `/frontend/utils/inboxService.ts`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-09-25
**Audience:** Developers, AI assistants, and end users