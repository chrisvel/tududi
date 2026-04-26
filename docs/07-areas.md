# Areas - Behavior Rules

This document explains how areas work in tasknotetaker from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/areas/` and frontend components in `/frontend/components/Area/`.

---

## Overview

**Areas** are the highest level of organization in tasknotetaker, representing major life domains or responsibility categories. They provide a way to group projects into meaningful top-level segments.

**Key characteristics:**
- Represent broad life domains (Work, Personal, Health, Finance, etc.)
- Sit at the top of the organizational hierarchy
- Provide high-level grouping for projects
- Simple structure with just name and description
- User-specific (each user has their own areas)
- Optional organizational layer (projects can exist without areas)

**Hierarchy Position:**
```
Areas (highest level - life domains)
  └── Projects (mid level - specific goals)
        └── Tasks (actionable items)
              └── Subtasks
```

**URL:** `/areas`

---

## Core Principles

1. **Areas are top-level organizational containers**
   - They represent the broadest categories of your life and work
   - Examples: Work, Personal, Health, Finance, Learning, Home

2. **Areas are optional**
   - Projects can exist without belonging to an area
   - Areas provide structure but aren't required

3. **Areas don't cascade delete**
   - Deleting an area orphans its projects, doesn't delete them
   - This prevents accidental data loss
   - Orphaned projects remain accessible

4. **Areas are simple by design**
   - Just a name and optional description
   - No status, priority, or due dates
   - Focus is on categorization, not task management

5. **One project, one area**
   - A project can belong to at most one area
   - But an area can contain many projects

---

## Hierarchy

```
Areas (highest level - life domains)
  └── Projects (mid level - specific goals/initiatives)
        ├── Tasks (actionable items)
        └── Notes (reference material)
```

**Example structure:**
```
Area: "Work"
  ├── Project: "Q1 Marketing Campaign"
  │     ├── Task: "Design landing page"
  │     └── Task: "Write email copy"
  ├── Project: "Website Redesign"
  │     └── Task: "Research design trends"
  └── Project: "Team Onboarding"

Area: "Personal"
  ├── Project: "Home Renovation"
  │     ├── Task: "Get contractor quotes"
  │     └── Task: "Choose paint colors"
  └── Project: "Learn Spanish"
        └── Task: "Complete Duolingo lesson"

Area: "Health"
  └── Project: "Exercise Routine"
        ├── Task: "Go for morning run"
        └── Task: "Meal prep for the week"
```

---

## Area Properties

### Basic Information

1. **Name** (required)
   - The area title
   - Examples: "Work", "Personal", "Health", "Finance", "Learning"
   - Displayed in uppercase on area cards
   - Sorted alphabetically

2. **Description** (optional)
   - Longer explanation of what this area encompasses
   - Helps clarify the scope and purpose
   - Displayed on area card in smaller text
   - Example: "Work related projects and professional development"

3. **UID** (auto-generated)
   - Unique identifier for the area
   - Used in URLs and API calls
   - Cannot be changed

4. **User ID** (system-managed)
   - Links area to the user who created it
   - Areas are private to each user
   - Cannot be shared between users

---

## Area Lifecycle

### Creating an Area

**Ways to create:**
1. Navigate to `/areas`
2. Click "New Area" button (if implemented)
3. Use the area modal to enter details

**Required fields:**
- Name (must not be empty or just whitespace)

**Default values:**
- Description: Empty string

**Auto-generated:**
- UID (unique identifier)
- User ID (current user)
- Timestamps (created_at, updated_at)

**Example:**
```
Name: "Work"
Description: "Professional projects, career development, and work-related tasks"
```

### Editing an Area

**What you can edit:**
- Name (required, cannot be empty)
- Description (optional)

**What you cannot edit:**
- UID
- User ID
- Created timestamp

**How to edit:**
1. Navigate to `/areas`
2. Hover over area card
3. Click three-dot menu (appears on hover)
4. Click "Edit"
5. Modify fields in modal
6. Click "Save" or "Update Area"

**Validation:**
- Name cannot be empty
- Name cannot be only whitespace
- Whitespace is trimmed from name

### Deleting an Area

**What happens:**
1. Area record is deleted from database
2. **Projects belonging to area are orphaned** (area_id set to null)
3. Projects are NOT deleted
4. Tasks and notes within projects are unaffected

**What is NOT deleted:**
- Projects (they become orphaned, with no area)
- Tasks within projects
- Notes within projects
- Any data except the area itself

**How to delete:**
1. Navigate to `/areas`
2. Hover over area card
3. Click three-dot menu
4. Click "Delete"
5. Confirm deletion in dialog

**Who can delete:**
- Area owner only
- Admin users (if admin functionality exists)

**No undo:**
- Deletion is permanent for the area
- But projects can be manually reassigned to a new area

**Finding orphaned projects after deletion:**
1. Go to Projects page
2. Filter by "No Area"
3. Re-assign to a new area if needed

---

## Using Areas

### Viewing Areas

**Areas List Page:**
- URL: `/areas`
- Shows all areas for current user
- Displayed as a responsive grid
- Grid adapts to screen size:
  - Mobile: 1 column
  - Tablet: 2 columns
  - Desktop: 3 columns
  - Large desktop: 4 columns

**Area Cards:**
Each card displays:
- Area name (uppercase, centered, large font)
- Description (if provided, smaller text, centered)
- Three-dot menu (appears on hover)
  - Edit option
  - Delete option

**Card Layout:**
- Fixed height (120px)
- Centered content
- Hover effect (slight opacity change)
- Click card to view projects in that area

### Linking to Projects

**From area card:**
- Clicking an area card navigates to: `/projects?area={uid}-{slug}`
- This filters the Projects page to show only projects in that area
- Example: `/projects?area=abc123-work`

**Slug generation:**
- Area name converted to lowercase
- Non-alphanumeric characters replaced with hyphens
- Leading/trailing hyphens removed
- Example: "My Work Area" → "my-work-area"

**From area detail page:**
- Displays link: "View projects in {area name}"
- Clicking navigates to filtered projects view

### Grouping Projects by Area

**On Projects page:**
- Add query parameter: `?grouped=true`
- Projects grouped under their area names
- Special "No Area" group for orphaned projects

**Example grouped view:**
```
Work
  ├── Q1 Marketing Campaign (75% complete)
  ├── Website Redesign (30% complete)
  └── Client Onboarding (done)

Personal
  ├── Home Renovation (in progress)
  └── Learn Spanish (planned)

No Area
  └── Random Ideas (not started)
```

**Benefits:**
- High-level overview of work distribution
- See balance across life domains
- Identify areas with too many/few projects

---

## Display Rules

### Area Cards (Grid View)

**Information shown:**
- Area name (bold, uppercase, 18px)
- Description (if exists, 12px, gray text)
- Three-dot menu (visible on hover)

**Visual design:**
- Light background: `bg-gray-50` (light mode)
- Dark background: `bg-gray-900` (dark mode)
- Rounded corners with shadow
- Fixed height: 120px
- Centered text alignment
- Hover: Slight opacity reduction (90%)

**Interaction:**
- Click anywhere on card → Navigate to projects filtered by area
- Click three-dot menu → Show edit/delete options
- Hover card → Show three-dot menu

**Sorting:**
- Areas always sorted alphabetically by name (A-Z)
- Case-insensitive sorting
- Consistent across all views

### Empty State

**When no areas exist:**
- Shows message: "No areas found" (translated)
- Prompts user to create their first area

---

## Area-Project Relationship

### Assigning Projects to Areas

**Ways to assign:**
1. **During project creation:**
   - Select area from dropdown in project modal
   - Area dropdown shows all user's areas alphabetically

2. **When editing existing project:**
   - Open project detail or edit modal
   - Change area in dropdown
   - Can set to "No Area" to orphan project

3. **Bulk operations (if implemented):**
   - Select multiple projects
   - Assign to area in bulk

**Project can have:**
- One area (normal case)
- No area (orphaned - still valid)
- Cannot have multiple areas

### Area Display on Projects

**On project cards:**
- Area name shown as a label/tag
- Usually displayed below project name
- Clickable link to filter by area

**On project detail page:**
- Area name displayed in metadata section
- Linked to area's projects list
- Can be changed inline (if editable)

**On project forms:**
- Dropdown selector for area
- Includes "No Area" option
- Sorted alphabetically

### Orphaned Projects

**What are orphaned projects:**
- Projects with no area assigned (`area_id = null`)
- Created without an area, or area was deleted
- Perfectly valid state

**How to find:**
1. Navigate to Projects page
2. Filter by "No Area"
3. Or use grouped view - they appear in "No Area" section

**How to fix (if desired):**
1. Open orphaned project
2. Edit project details
3. Select an area from dropdown
4. Save changes

**Not a problem:**
- Areas are optional organizational tools
- Projects work perfectly fine without areas
- Some users prefer not to use areas at all

---

## Common Workflows

### Workflow 1: Set Up Life Domains

**Scenario:** Initial organization of your life

1. Navigate to `/areas`
2. Create areas for major life domains:
   - Work
   - Personal
   - Health
   - Finance
   - Learning
   - Home
3. Add descriptions to clarify scope:
   - Work: "Professional projects and career development"
   - Personal: "Personal goals and hobbies"
   - Health: "Fitness, nutrition, and wellness"
4. Assign existing projects to appropriate areas
5. Review grouped projects view for balance

### Workflow 2: Organize Projects into Areas

**Scenario:** You have many unorganized projects

1. Go to Projects page
2. Filter by "No Area" to see orphaned projects
3. For each project:
   - Open project detail
   - Consider its nature (work, personal, etc.)
   - Assign to appropriate area
4. Use grouped view to verify organization
5. Adjust as needed

### Workflow 3: Focus on Specific Life Domain

**Scenario:** You want to focus on work projects only

1. Navigate to `/areas`
2. Click on "Work" area card
3. See only work-related projects
4. Review active projects in work domain
5. Identify stalled projects
6. Plan next actions

### Workflow 4: Review Life Balance

**Scenario:** Check if you're balanced across domains

1. Navigate to `/projects?grouped=true`
2. See projects grouped by area
3. Count projects in each area
4. Identify areas with:
   - Too many projects (overcommitted)
   - Too few projects (neglected domain)
   - All completed projects (ready for new initiatives)
5. Make adjustments to achieve balance

### Workflow 5: Reorganize Life Structure

**Scenario:** Your life structure has changed

1. Navigate to `/areas`
2. Edit area names/descriptions to reflect new reality
3. Consider creating new areas:
   - New job → New work area or split areas
   - New hobby → Personal or new Learning area
4. Delete obsolete areas (projects become orphaned)
5. Re-assign orphaned projects to new structure
6. Review and refine

---

## Integration with Other Features

### Areas and Projects Page

**Filtering by area:**
- URL: `/projects?area={uid}-{slug}`
- Shows only projects in that area
- Breadcrumb or header shows current area filter
- Can clear filter to see all projects

**Grouping by area:**
- URL: `/projects?grouped=true`
- Projects organized under area headings
- Collapsible sections (if implemented)
- Shows "No Area" group for orphaned projects

### Areas and Project Detail Page

**Area shown on project:**
- Displayed in metadata section
- Linked to area's projects list
- Can edit to change or remove area (if permissions allow)

### Areas and Navigation

**Sidebar (if areas shown):**
- May show top areas for quick access
- Click to navigate to area's projects
- Usually shows 3-5 most used areas

**Quick filters:**
- Projects page may have area pills/tags
- Click to toggle area filter
- Multiple areas can be selected (OR logic)

---

## Best Practices

### Naming Areas

**Good area names:**
- Short and clear: "Work", "Personal", "Health"
- Broad categories, not specific projects
- Parallel structure: All nouns or all adjectives
- Examples: "Work", "Home", "Health", "Finance"

**Avoid:**
- Overly specific: "Q1 Marketing" (that's a project)
- Too many areas (diminishes organizational value)
- Overlapping categories: "Work" and "Career" (redundant)
- Vague names: "Stuff", "Things", "Other"

### Structuring Your Areas

**Recommended approach:**
- Start with 4-7 major areas
- Based on life domains, not task types
- Examples:
  - Professional: Work, Business
  - Personal: Personal, Family, Social
  - Self-improvement: Health, Learning
  - Maintenance: Home, Finance

**Too many areas:**
- Defeats the purpose of high-level organization
- Hard to remember and maintain
- Projects get scattered
- Consider: Do you really need that area?

**Too few areas:**
- Everything in "Work" and "Personal"
- Loses organizational granularity
- Consider: Are you neglecting important life domains?

### Using Descriptions

**Good descriptions:**
- Clarify the scope of the area
- Help with project assignment decisions
- Examples:
  - "Work": "Professional projects, career development, and work relationships"
  - "Health": "Physical fitness, nutrition, mental wellness, and medical care"
  - "Learning": "Online courses, reading, language learning, and skill development"

**When to skip descriptions:**
- Area name is self-explanatory ("Personal", "Work")
- You're the only user and know what it means

### Maintaining Your Areas

**Regular review:**
- Every 3-6 months, review your areas
- Are they still relevant to your life?
- Do you need to add/remove/rename areas?
- Are projects correctly categorized?

**When life changes:**
- New job → Adjust work areas
- New responsibility → Add new area
- Completed major goal → Remove or repurpose area

---

## Troubleshooting

### "My projects disappeared when I deleted the area"

**What happened:**
- Projects are not deleted, they're orphaned
- They still exist in your database

**How to find:**
1. Go to Projects page
2. Filter by "No Area"
3. You'll see all orphaned projects
4. Re-assign to a new area if needed

### "I can't see my area in the projects dropdown"

**Possible causes:**
1. Area belongs to different user (not shared)
2. Area was deleted
3. Frontend cache issue

**How to fix:**
1. Refresh the page
2. Check `/areas` page to confirm area exists
3. If missing, recreate the area

### "Area cards not showing in grid"

**Possible causes:**
1. No areas created yet
2. Loading state
3. API error

**How to check:**
1. Wait for loading to complete
2. Check browser console for errors
3. Verify `/api/areas` endpoint returns data
4. Create first area if none exist

### "Projects grouped view not working"

**Checklist:**
1. Is `?grouped=true` in URL?
2. Do projects have `area_id` set?
3. Are areas loaded in global state?
4. Check browser console for errors

### "Can't delete an area"

**Possible reasons:**
1. You're not the owner (areas can't be shared)
2. Network error
3. Permission issue

**Alternative:**
- If you can't delete, just don't use it
- Remove all projects from the area
- It won't show up in grouped views

---

## Use Cases

### 1. **Life-Work Balance Monitoring**

Areas help you see if you're:
- Overcommitting in work area
- Neglecting personal projects
- Ignoring health/fitness
- Balancing across all domains

**Action:** Review grouped projects view monthly

### 2. **Context Switching**

When switching contexts (work → personal):
- Click area card to see relevant projects
- Focus on that domain exclusively
- Avoid distraction from other areas

**Action:** Use area filters during focused work sessions

### 3. **Goal Setting Across Life Domains**

Ensure you have:
- Active projects in each important area
- Balance between maintenance and growth
- Projects in neglected domains

**Action:** Set quarterly goals per area

### 4. **Delegation and Collaboration**

Though areas themselves aren't shared:
- Projects within areas can be shared
- Use areas to organize shared vs. personal work
- Example: "Work" area has shared team projects

**Action:** Keep team projects in shared areas

### 5. **Year-End Review**

At year end, review each area:
- How many projects completed?
- Which areas were neglected?
- Where did you make most progress?
- What needs attention next year?

**Action:** Annual area-by-area retrospective

---

## Technical Notes

### Data Model

**Database table:** `areas`

**Columns:**
- `id` (integer, primary key, auto-increment)
- `uid` (string, unique, auto-generated)
- `name` (string, required)
- `description` (string, optional)
- `user_id` (integer, foreign key to users table)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Indexes:**
- Primary key on `id`
- Unique index on `uid`
- Index on `user_id` (for fast user-based queries)

### API Endpoints

**GET /api/areas**
- List all areas for current user
- Sorted alphabetically by name
- Returns: Array of area objects

**GET /api/areas/:uid**
- Get single area by UID
- Returns: Area object

**POST /api/areas**
- Create new area
- Body: `{ name, description }`
- Returns: Created area object (201)

**PATCH /api/areas/:uid**
- Update existing area
- Body: `{ name?, description? }`
- Returns: Updated area object

**DELETE /api/areas/:uid**
- Delete area (orphans projects)
- Returns: 204 No Content

**Authentication:**
- All endpoints require authentication
- 401 if not authenticated

### Validation Rules

**Name validation:**
- Required (cannot be null or undefined)
- Cannot be empty string
- Cannot be only whitespace
- Whitespace trimmed before saving

**Description validation:**
- Optional
- Can be empty string or null
- Stored as empty string if not provided

**UID validation:**
- Must be valid string format
- Checked when getting/updating/deleting

---

## Related Documentation

- [Projects Behavior](06-projects.md) - How areas relate to projects
- [Today Page Sections](02-today-page-sections.md) - How area filtering affects Today view
- [Architecture Overview](architecture.md) - Technical architecture
- [Backend Patterns](backend-patterns.md) - Module structure
- [Database & Migrations](database.md) - Data model details
- [Directory Structure](directory-structure.md) - File locations

**Technical Implementation Files:**
- Area model: [/backend/models/area.js](../backend/models/area.js)
- Areas service: [/backend/modules/areas/service.js](../backend/modules/areas/service.js)
- Areas controller: [/backend/modules/areas/controller.js](../backend/modules/areas/controller.js)
- Areas repository: [/backend/modules/areas/repository.js](../backend/modules/areas/repository.js)
- Areas routes: [/backend/modules/areas/routes.js](../backend/modules/areas/routes.js)
- Areas validation: [/backend/modules/areas/validation.js](../backend/modules/areas/validation.js)
- Frontend components: [/frontend/components/Area/](../frontend/components/Area/)
- Areas list page: [/frontend/components/Areas.tsx](../frontend/components/Areas.tsx)
- Area detail page: [/frontend/components/Area/AreaDetails.tsx](../frontend/components/Area/AreaDetails.tsx)
- Area modal: [/frontend/components/Area/AreaModal.tsx](../frontend/components/Area/AreaModal.tsx)
- Areas API client: [/frontend/utils/areasService.ts](../frontend/utils/areasService.ts)
- Integration tests: [/backend/tests/integration/areas.test.js](../backend/tests/integration/areas.test.js)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Audience:** Developers, AI assistants, and end users