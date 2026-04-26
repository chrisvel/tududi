# Notes System - Behavior Rules

This document explains how the Notes system works in TaskNoteTaker from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/notes/` and frontend components in `/frontend/components/Notes.tsx`.

---

## Overview

**Notes** are TaskNoteTaker's flexible capture and reference system - a place to store information, ideas, bookmarks, meeting notes, and any other content that doesn't fit the structured task workflow. Unlike tasks, notes don't have due dates, priorities, or completion states - they're purely informational.

**Key characteristics:**
- Rich text support via Markdown
- Optional project association
- Tag-based organization
- Color customization (10 predefined colors)
- Focus mode for distraction-free writing
- Auto-save every 1 second
- Search across title and content

**URL:** `/notes` or `/notes/:uid`

---

## Core Principles

1. **Information, not action**
   - Notes store knowledge, not tasks
   - No due dates, priorities, or status tracking
   - Permanent reference material vs. temporary to-dos

2. **Flexible structure**
   - Can be standalone or linked to projects
   - Tag-based categorization
   - Full Markdown formatting support

3. **Seamless capture**
   - Auto-save prevents data loss
   - Quick creation from inbox items
   - Inline editing without modals

---

## Note Structure

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **Title** | String | No | Note heading (untitled if empty) |
| **Content** | Text | No | Main note body (Markdown supported) |
| **Project** | Reference | No | Associated project |
| **Tags** | Array | No | Categorization tags |
| **Color** | String | No | Background color (visual organization) |
| **Created At** | Timestamp | Auto | Creation timestamp |
| **Updated At** | Timestamp | Auto | Last modification timestamp |

### Unique Identifier

- Each note has a **UID** (unique identifier): `uid` field
- Used in URLs: `/notes/abc123def456`
- Immutable - persists through all edits

---

## Creating Notes

### Method 1: Direct Creation

**From Notes page:**
1. Navigate to `/notes`
2. Click **+ icon** in top right
3. New note opens in edit mode
4. Start typing - auto-saves after 1 second
5. No explicit "Save" required

**Keyboard shortcut:**
- `n` (while on Notes page) - Create new note

### Method 2: From Inbox

**Convert inbox item to note:**
1. Capture item in Inbox: `Article link https://example.com +Reading #bookmark`
2. Click "Note" button or press Ctrl+N (Cmd+N on Mac)
3. System creates note with:
   - Title: Fetched from URL (or URL itself if fetch fails)
   - Content: Full inbox text
   - Project: Linked from `+Reading`
   - Tags: Extracted from `#bookmark`
4. Inbox item marked as processed

**See:** [Inbox Page documentation](04-inbox-page.md) for details

### Method 3: From Project Page

**Via project view:**
1. Open project detail page
2. Click "Add Note" in notes section
3. Note pre-linked to current project
4. Start editing

---

## Editing Notes

### Inline Editing

**How it works:**
1. Click on a note in the list to preview it
2. Click anywhere on the preview (title or content)
3. Note switches to edit mode
4. Changes auto-save every 1 second
5. Press Escape to save and exit edit mode

**Save behavior:**
- **Auto-save:** Triggers 1 second after you stop typing
- **Save status indicators:**
  - ✓ Saved (green) - Changes persisted
  - Saving... (blue) - Upload in progress
  - • Unsaved changes (amber) - Save failed or pending

**What triggers auto-save:**
- Typing in title field
- Typing in content field
- Changing project
- Adding/removing tags
- Changing note color

### Title Editing

**Rules:**
- Title is optional - can be blank
- Blank titles show as "Untitled Note" in UI
- Auto-save only triggers if title is non-empty
- Click title in preview mode to enter edit mode

### Content Editing

**Markdown support:**
- Full GitHub-flavored Markdown
- Headings: `# H1`, `## H2`, `### H3`
- Lists: `- item` or `1. item`
- Links: `[text](url)`
- Bold: `**text**`
- Italic: `_text_`
- Code: `` `inline` `` or triple backticks for blocks
- Checkboxes: `- [ ] unchecked` or `- [x] checked`

**Preview rendering:**
- Content renders as formatted Markdown in preview mode
- Click to edit - shows raw Markdown
- Live preview updates on save

### Multi-line Editing

**Textarea behavior:**
- Content field is a resizable textarea
- Minimum height: 300px
- Expands to fill available vertical space
- Shift+Enter for new lines

---

## Note Organization

### Projects

**Linking notes to projects:**
1. In edit mode, click **project icon** or "Add project"
2. Dropdown shows all available projects
3. Select project or choose "No Project" to unlink
4. Auto-saves immediately

**Project behavior:**
- Notes can belong to 0 or 1 project (not multiple)
- Changing projects moves the note
- Deleting a project unlinks all its notes (notes remain)
- Project appears in note metadata (preview and edit mode)

**Permission handling:**
- Can only link notes to projects you have write access to
- Shared projects: respects collaboration permissions
- Attempting to link to restricted project shows error

### Tags

**Adding tags:**
1. In edit mode, click **tag icon** or "Add tags"
2. Tag input field appears
3. Type tag name and press Enter
4. Select from existing tags (autocomplete) or create new
5. Tags save immediately with note

**Tag rules:**
- **Valid characters:** Alphanumeric, hyphens, underscores
  - ✅ `work`, `high-priority`, `q1_2026`
  - ❌ `tag with spaces`, `emoji🎉`, `punctuation!`
- **Case insensitive:** `Work` = `work` = `WORK`
- **Auto-create:** New tags created on-the-fly
- **Multiple tags:** No limit on number per note

**Removing tags:**
- Click **X** on tag chip in tag input
- Changes save immediately

**Tag navigation:**
- Click tag name in preview mode → Go to tag page
- Shows all tasks/notes/projects with that tag

### Colors

**Note color feature:**
- **Feature flag:** `ENABLE_NOTE_COLOR` (enabled by default)
- **10 predefined colors:** Red, Orange, Amber, Green, Teal, Blue, Indigo, Purple, Pink, Grey
- **None option:** Default white/dark background

**Setting color:**
1. Click **⋮ menu** (three vertical dots) in top right
2. Color palette grid appears
3. Click desired color swatch
4. Background changes immediately
5. Auto-saves

**Color behavior:**
- Applies to entire note background (edit and preview)
- Text color adjusts automatically (dark text on light colors, light text on dark colors)
- Persists across sessions
- Visible in note preview (full panel uses color)

**Accessibility:**
- Luminance calculation ensures readable text contrast
- Dark colors → White text (#ffffff)
- Light colors → Dark gray text (#333333)

---

## Note Views

### List View (Left Panel)

**Default behavior:**
- Shows all notes in scrollable list
- Most recent first (by default)
- Each item displays:
  - Title (bold, truncated)
  - Content preview (first 100 characters, 2 lines max)
  - Last updated date

**Active note indicator:**
- Blue vertical bar on left edge
- Highlighted background (white/gray-900)
- Indicates currently selected note

**Empty state:**
- "No notes found" message
- Appears when search returns zero results
- Or when user has no notes

### Preview Mode (Right Panel)

**When note selected:**
- Full title at top (large, bold)
- Metadata row:
  - 🕐 Last updated date
  - 📁 Project (clickable link if assigned)
  - 🏷️ Tags (clickable links)
- Content rendered as Markdown below
- Click anywhere to enter edit mode

**Click behavior:**
- Title → Enter edit mode
- Content → Enter edit mode
- Project link → Navigate to project page
- Tag link → Navigate to tag page

**Empty state:**
- "Select a note to preview" message
- Shows when no note is selected (desktop only)

### Edit Mode (Right Panel)

**Layout:**
- Title input at top (large, 2rem font)
- Metadata controls:
  - 🕐 Last updated or "New"
  - 📁 Project selector
  - 🏷️ Tag manager
- Save status indicator (✓ Saved / Saving... / • Unsaved)
- Content textarea (full height)
- **⋮ menu** (options):
  - Color picker
  - Save button
  - Delete button (if note exists)

**Back button (mobile):**
- ← Back to list
- Appears only on mobile/tablet views
- Saves note before returning

**Keyboard shortcuts:**
- `Esc` - Save and exit edit mode (if title exists)
- `Ctrl/Cmd+S` - Manual save (implicit - auto-save handles this)

---

## Focus Mode

**Purpose:** Distraction-free editing for deep work

**Entering focus mode:**
1. Click **expand icon** (↗️) in top right
2. Note expands to full screen
3. Hides sidebar, navigation, and note list

**What's visible in focus mode:**
- Note title (editable)
- Note content (editable)
- Minimal toolbar:
  - Close button (top right)
  - Save status
- Optional: Project and tag buttons (collapsed)

**Exiting focus mode:**
- Click **X** or **close button**
- Press `Esc` key
- Returns to standard two-panel view

**Auto-save in focus mode:**
- Same 1-second debounce
- Save status indicator remains visible
- Changes persist automatically

---

## Searching and Filtering

### Search

**How to search:**
1. Enter query in search box (top of note list)
2. Results filter in real-time
3. Searches both title AND content

**Search behavior:**
- **Case insensitive:** "markdown" matches "Markdown", "MARKDOWN"
- **Substring matching:** "task" matches "tasks", "multitasking"
- **Multi-word:** All words must appear (AND logic)
- **No regex:** Plain text search only

**Search scope:**
- Title field
- Content field (full text)
- Does NOT search tags or project names

### Sorting

**Sort options:**
1. **Created At** (default) - Newest first
2. **Title** - Alphabetical A-Z
3. **Updated** - Most recently modified first

**How to sort:**
- Click **sort icon** (top of note list)
- Select sort option from dropdown
- List re-orders immediately

**Sort persistence:**
- Persists during session
- Resets to "Created At" on page reload

### Tag Filtering

**Via URL query:**
- `/notes?tag=bookmark` - Show only notes with #bookmark tag
- API endpoint: `GET /api/notes?tag=bookmark`
- Filter by single tag only (not multiple)

**No UI filter currently:**
- Must use URL directly or navigate via tag page
- Click tag in note preview → Navigates to tag page showing all tagged items

---

## Deleting Notes

### Confirmation Required

**Steps:**
1. Select note or enter edit mode
2. Click **⋮ menu** (three dots)
3. Click **Delete** (red text)
4. Confirmation dialog appears:
   - "Are you sure you want to delete this note?"
   - Shows note title
5. Confirm or cancel

**What gets deleted:**
- Note record (title, content, metadata)
- Tag associations (note-tag links)
- Project association (if any)

**What's preserved:**
- Project (unlinking only)
- Tags (remain in tag list)
- No note history (deletion is permanent)

**No undo:**
- Deletion is immediate and irreversible
- No trash/archive feature
- Ensure confirmation before proceeding

---

## Responsive Behavior

### Desktop (≥768px)

**Two-panel layout:**
- Left panel: Note list (fixed width: 320px)
- Right panel: Preview/edit (flexible width)
- Both panels visible simultaneously

**Auto-selection:**
- First note auto-selected on page load
- Clicking note updates right panel
- No "back" navigation needed

### Mobile/Tablet (<768px)

**Single panel:**
- Shows note list OR preview/edit (not both)
- Clicking note → Hides list, shows preview
- "← Back to list" button → Returns to list

**Navigation flow:**
1. View note list
2. Tap note → Preview opens (list hidden)
3. Tap anywhere → Edit mode
4. Tap "← Back" → Returns to list

---

## Integration with Other Features

### Inbox Integration

**Creating notes from inbox:**
- Inbox items with URLs suggest "Note"
- Inbox items with `#bookmark` tag suggest "Note"
- Conversion preserves tags and project references
- See: [Inbox Page documentation](04-inbox-page.md)

**URL title extraction:**
- System fetches webpage `<title>` tag
- 3-second timeout
- Falls back to URL if fetch fails
- Auto-adds `#bookmark` tag

### Project Integration

**Notes in project view:**
- Project detail page shows associated notes
- "Add Note" button creates pre-linked note
- Notes count appears in project card
- Deleting project unlinks notes (notes remain)

**Shared project notes:**
- Respects collaboration permissions
- Read-only access: Can view notes, cannot edit
- Read-write access: Can create/edit/delete notes
- Admin access: Full control

### Tag Integration

**Tag page shows notes:**
- `/tag/:uid` lists all tasks, notes, projects with tag
- Notes appear in dedicated "Notes" section
- Clicking note → Opens in Notes page

**Tag management:**
- Tags created via notes appear in tag list
- Deleting tag removes from all notes
- Renaming tag (if supported) updates all notes

---

## Auto-Save Behavior

### Debounced Save

**How it works:**
1. User types in title or content
2. Save status changes to "• Unsaved changes"
3. After 1 second of inactivity, triggers save
4. Status changes to "Saving..."
5. On success: "✓ Saved"
6. On failure: "• Unsaved changes" (stays amber)

**Debounce settings:**
- **Delay:** 1000ms (1 second)
- **Trailing:** Yes (saves after typing stops)
- **Leading:** No (doesn't save on first keystroke)

### What Triggers Save

**Auto-save triggers:**
- Title field changes
- Content field changes
- Project selection changes
- Tag additions/removals
- Color changes

**No save triggers:**
- Focusing input fields
- Scrolling
- Opening dropdowns
- Viewing preview mode

### Save Guarantees

**When navigation occurs:**
- Leaving Notes page → Pending saves complete first
- Selecting different note → Current note saves first
- Mobile "Back" button → Saves before hiding panel

**Error handling:**
- Network failure → Status shows "• Unsaved changes"
- No automatic retry (user must trigger re-save by editing)
- Console error logged for debugging

**Edge case - empty title:**
- Auto-save only triggers if `title` is non-empty
- Empty title note → Not saved to server
- User must enter title to persist note

---

## Display and Rendering

### Markdown Rendering

**Supported syntax:**
- **Headings:** `#`, `##`, `###`, `####`, `#####`, `######`
- **Bold:** `**text**` or `__text__`
- **Italic:** `*text*` or `_text_`
- **Links:** `[text](url)` or `<url>`
- **Lists:** `- item` (unordered) or `1. item` (ordered)
- **Checkboxes:** `- [ ] todo` or `- [x] done`
- **Code:** `` `inline` `` or ` ```language\nblock\n``` `
- **Blockquotes:** `> quote`
- **Horizontal rules:** `---` or `***`
- **Tables:** Pipe-separated cells
- **Images:** `![alt](url)` (rendered as `<img>`)

**Rendering engine:**
- Uses `MarkdownRenderer` component
- Safe HTML escaping (prevents XSS)
- Syntax highlighting for code blocks
- Opens external links in new tab

### Title Display

**Preview mode:**
- Large heading (2rem font size)
- Medium weight (500)
- Truncated if very long (responsive)
- Shows "Untitled Note" if empty

**Edit mode:**
- Full-width input field
- Same size/weight as preview (2rem/500)
- Placeholder: "Note title..."
- Auto-focus on new note creation

### Content Display

**Preview mode:**
- Rendered Markdown with styling
- Text size: 0.875rem (14px) on mobile, 1rem (16px) on desktop
- Line height: 1.5
- Scrollable if content exceeds viewport

**Edit mode:**
- Plain textarea (raw Markdown)
- Minimum height: 300px
- Expands to fill vertical space
- Monospace font (not specified, browser default)
- Placeholder: "Write your note content here... (Markdown supported)"

### Color-Aware Text

**Text color adjustment:**
- Background luminance calculated from hex color
- Luminance < 0.4 → White text (#ffffff)
- Luminance ≥ 0.4 → Dark gray text (#333333)
- Applies to title, content, and metadata text

**Formula:**
```
luminance = (0.299 * R + 0.587 * G + 0.114 * B) / 255
```

---

## Keyboard Shortcuts

### Global (anywhere in app)

| Shortcut | Action |
|----------|--------|
| `g` then `n` | Go to Notes page |

### On Notes page

| Shortcut | Action |
|----------|--------|
| `n` | Create new note |
| Click note | Open in preview mode |

### In edit mode

| Shortcut | Action |
|----------|--------|
| `Esc` | Save and exit edit mode (if title exists) |
| `Tab` | Navigate between fields |

### In focus mode

| Shortcut | Action |
|----------|--------|
| `Esc` | Exit focus mode |
| Click X | Close focus mode |

---

## Common Workflows

### Workflow 1: Quick Note Capture

**Scenario:** Capture a fleeting idea

1. Press `g` then `n` to open Notes page
2. Click **+** to create new note
3. Type title: "Product idea - Voice control"
4. Write content:
   ```markdown
   ## Overview
   Users want hands-free interaction

   ## Features
   - Voice commands for task creation
   - Smart parsing of natural language
   - Integration with existing task flow
   ```
5. Auto-saves after 1 second
6. Add tags: `#product`, `#ideas`
7. Link to project: "Product Roadmap"
8. Press Esc to exit edit mode

### Workflow 2: Meeting Notes

**Scenario:** Documenting a client meeting

1. Navigate to `/notes`
2. Create new note
3. Title: "Client Meeting - Acme Corp - 2026-03-14"
4. Content:
   ```markdown
   ## Attendees
   - John (Acme Corp CEO)
   - Sarah (Product Manager)
   - Me

   ## Discussion
   - Requested new reporting dashboard
   - Timeline: Q2 2026
   - Budget: $50k

   ## Action Items
   - [ ] Send proposal by Monday
   - [ ] Schedule follow-up call
   - [ ] Share mockups
   ```
5. Link to project: "Acme Corp"
6. Add tags: `#meetings`, `#clients`, `#acme`
7. Auto-saves throughout
8. Click "Focus mode" for distraction-free review

### Workflow 3: Bookmark Collection

**Scenario:** Save an article to read later

1. From Inbox: `https://example.com/article +Reading #bookmark`
2. Press `Ctrl+N` (or `Cmd+N`)
3. System:
   - Fetches title: "10 Tips for Better Focus"
   - Creates note with URL as content
   - Links to "Reading" project
   - Adds `#bookmark` tag
4. Note auto-saved and opens in edit mode
5. Add notes below URL:
   ```markdown
   https://example.com/article

   ## Key Takeaways
   - Pomodoro technique
   - Single-tasking
   - Environment matters
   ```
6. Press Esc to save and exit

### Workflow 4: Knowledge Base

**Scenario:** Building a personal wiki

1. Create note: "Git Cheatsheet"
2. Content:
   ```markdown
   ## Common Commands

   ### Branching
   - `git branch <name>` - Create branch
   - `git checkout <name>` - Switch branch
   - `git checkout -b <name>` - Create and switch

   ### Committing
   - `git add .` - Stage all changes
   - `git commit -m "message"` - Commit with message
   - `git commit --amend` - Amend last commit

   ### Remote
   - `git push origin <branch>` - Push to remote
   - `git pull` - Fetch and merge
   ```
3. Add tags: `#reference`, `#git`, `#dev`
4. Link to project: "Developer Resources"
5. Set color: Blue (for tech references)
6. Bookmark `/notes/:uid` for quick access

### Workflow 5: Weekly Review

**Scenario:** Process and organize accumulated notes

1. Navigate to `/notes`
2. Sort by "Updated" to see recent notes
3. Search for "meeting" to find unprocessed meeting notes
4. For each note:
   - Review content
   - Extract action items → Convert to tasks
   - Add relevant tags
   - Link to appropriate projects
   - Archive or delete if no longer needed
5. Search for untagged notes (manual review)
6. Ensure all bookmarks are properly categorized

---

## Troubleshooting

### "Auto-save not working"

**Possible causes:**
1. Title is empty → Auto-save only triggers with non-empty title
2. Network error → Check browser console for errors
3. Session expired → Re-authenticate
4. Debounce hasn't elapsed → Wait 1 second after typing

**Solution:**
- Add a title (at minimum)
- Check network connection
- Refresh page and re-login if needed
- Observe save status indicator

### "Note disappeared after creating"

**Likely cause:** Empty title + navigated away

**What happened:**
- Created note without title
- Auto-save didn't trigger (requires title)
- Navigated away → Note not persisted

**Prevention:**
- Always add a title before leaving edit mode
- Check for "✓ Saved" status before navigating

### "Markdown not rendering"

**Check:**
1. Are you in edit mode? (shows raw Markdown)
2. Switch to preview mode (click note in list or press Esc)
3. Ensure Markdown syntax is correct
   - ❌ `#Heading` (no space)
   - ✅ `# Heading` (space required)

### "Can't link note to project"

**Possible causes:**
1. Project doesn't exist → Create project first
2. No write access to project → Check collaboration permissions
3. Project is archived → Unarchive or choose different project

**Solution:**
- Verify project exists in project list
- Check permissions with project owner
- Select different project

### "Tags not saving"

**Check:**
1. Tag name has invalid characters?
   - Use only alphanumeric, hyphens, underscores
2. Network error during save?
   - Check browser console
3. Tag input didn't close properly?
   - Click outside tag input to trigger save

### "Color not appearing"

**Check:**
1. Is `ENABLE_NOTE_COLOR` feature flag enabled?
   - Check with admin/developer
2. Browser caching issue?
   - Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`
3. Dark mode conflict?
   - Try switching theme

---

## Best Practices

### Organization

1. **Use consistent tagging:**
   - Create a tag hierarchy: `#project-ideas`, `#project-specs`, `#project-retros`
   - Avoid tag proliferation: Reuse existing tags

2. **Link notes to projects:**
   - Project-specific notes → Link to project
   - General knowledge → Leave unlinked or create "Resources" project

3. **Color coding:**
   - Develop personal system: Red = urgent, Blue = reference, Green = ideas
   - Or by topic: Purple = client work, Teal = personal

### Content

1. **Use Markdown effectively:**
   - Headings for structure
   - Lists for clarity
   - Checkboxes for tracking follow-ups within notes
   - Code blocks for technical snippets

2. **Include metadata:**
   - Date in title for meeting notes: "Meeting - Client - 2026-03-14"
   - Context in content: "Source: [Article](url)"

3. **Break up long notes:**
   - Split into multiple notes by subtopic
   - Link between notes using markdown links
   - Use tags to group related notes

### Maintenance

1. **Regular review:**
   - Weekly: Process new notes, add tags, link to projects
   - Monthly: Archive or delete obsolete notes
   - Quarterly: Reorganize tag system

2. **Search before creating:**
   - Check if similar note exists
   - Consolidate duplicates

3. **Bookmark frequently accessed:**
   - Copy note URL: `/notes/:uid`
   - Save in browser bookmarks for quick access

---

## Limitations and Constraints

### Current Limitations

1. **No note history/versions:**
   - Edits overwrite previous content
   - No undo beyond current session
   - Workaround: Use external version control for critical notes

2. **Single project per note:**
   - Cannot link note to multiple projects
   - Workaround: Duplicate note or use tags for cross-referencing

3. **No hierarchical notes:**
   - Flat structure only (no sub-notes)
   - Workaround: Use Markdown headings and lists

4. **No collaborative editing:**
   - Only one user can edit at a time
   - No conflict resolution
   - Last save wins (potential data loss)

5. **No attachments:**
   - Cannot upload files/images to notes
   - Workaround: Host elsewhere, link via Markdown

6. **Limited rich text:**
   - Markdown only (no WYSIWYG editor)
   - No inline images (must use external URLs)
   - No tables with complex formatting

### Technical Constraints

1. **Search limitations:**
   - No fuzzy matching
   - No search within tags/projects
   - No advanced operators (AND, OR, NOT)

2. **Performance:**
   - All notes loaded at once (no pagination)
   - Slow with 1000+ notes
   - No virtualized scrolling

3. **Mobile experience:**
   - Single-panel only (no split view)
   - Harder to reference multiple notes

---

## Related Documentation

- [Inbox Page](04-inbox-page.md) - Quick capture and conversion to notes
- [Today Page Sections](02-today-page-sections.md) - Task-focused workflow
- [Architecture Overview](architecture.md) - Technical architecture
- [Development Workflow](development-workflow.md) - Working with the codebase
- [Common Tasks](common-tasks.md) - How to modify notes functionality

**Technical Implementation Files:**
- Note model: `/backend/models/note.js`
- Note service: `/backend/modules/notes/service.js`
- Note controller: `/backend/modules/notes/controller.js`
- Note repository: `/backend/modules/notes/repository.js`
- Note API routes: `/backend/modules/notes/routes.js`
- Notes component: `/frontend/components/Notes.tsx`
- Note modal: `/frontend/components/Note/NoteModal.tsx`
- Note focus mode: `/frontend/components/Note/NoteFocusMode.tsx`
- Markdown renderer: `/frontend/components/Shared/MarkdownRenderer.tsx`
- Note service (frontend): `/frontend/utils/notesService.ts`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Audience:** Developers, AI assistants, and end users