# Spreadsheet import and export

Tasks go out to Excel or CSV and come back in from either. An import is checked row by row before anything is saved, and can be undone for 7 days. Exported files carry each task's UID, so a sheet can be exported, edited, and imported again to update the same tasks.

## Where it is

| Place | What it does |
|---|---|
| Project page, **⋯** menu | **Import from spreadsheet…** (tasks go into this project), **Export to Excel**, **Export to CSV** (this project's tasks) |
| **Projects** page, **Import** button | Import with no project chosen, typically a sheet with a Project column |
| **Profile → Import & export** | Import, download the template, export every task you can see, recent imports with **Undo** |

## Export

`GET /api/export/tasks?format=xlsx|csv` with optional `project_uid`, `area_uid` and `include_completed=false`. One row per task the user can see (own, shared, assigned), habits and generated occurrences of repeating tasks left out. Projects alphabetically, each subtask right under its parent.

Columns: UID, Name, Project, Area, Parent (name, for reading), Parent UID, Status, Priority, Start, Due, Defer until, Estimate (min), Assignee, Tags, Note, Completed at, Created at. Headers and status/priority words are in the user's language. Dates are the user's wall clock; whole-day dates have no time.

- **XLSX**: frozen header row, filter buttons, real date cells, and dropdowns on Status and Priority.
- **CSV**: UTF-8 with a byte order mark (so Excel reads accents), comma separated. A cell starting with `= + - @` gets a leading `'` so Excel does not run it as a formula; import strips it again.

`GET /api/export/template?format=xlsx|csv` is an empty sheet with two example rows and, in XLSX, a "How to fill this in" sheet. The task export stays open to accounts without a subscription, like the backup export.

## Import

Four steps, each an API call on an import job (`import_jobs` table):

1. **Upload** `POST /api/imports` (multipart `file`, optional `encoding`): `.xlsx` or `.csv`/`.tsv`/`.txt`, 5 MB, the first 5,000 rows and 60 columns of every visible sheet. Old binary `.xls` is refused with a hint to save as `.xlsx`. CSV encoding is UTF-8 or UTF-16 with a BOM; anything else is read as Windows-1252 and the wizard offers the other Windows code pages (Greek 1253, Cyrillic 1251, Central European 1250…) and Shift JIS, GBK, Big5, EUC-KR. The separator (`,` `;` tab `|`) is detected. Merged cells count once (top-left), formulas give their cached result, hidden sheets are skipped. The parsed rows are stored on the job; uploads not committed are deleted after a day, when the wizard is closed, or once the user has more than five waiting.
2. **Columns** The header row is detected (title rows above it are skipped) and can be changed with `POST /api/imports/:uid/columns`. Each column gets a suggested target from its header, matched against English synonyms ("Deadline", "Owner", "Task name"…) and the exported headers in all 26 languages. Targets: a task field, **Keep in the note** (adds `Header: value` lines to the note, the default for unknown columns that hold data), or **Don't import**. The user also picks where tasks go: an existing project, a new project, the Project column (unknown project names become new projects, the Area column places them), or no project.
3. **Review** `POST /api/imports/:uid/preview` runs the whole import as a dry run and returns counts, the new projects, and every row with its errors (row skipped) and warnings (row imported with that field left out).
4. **Commit** `POST /api/imports/:uid/commit` runs the same analysis and writes everything in one transaction. `POST /api/imports/:uid/undo` takes it back.

### How cells are read

| Field | Accepted |
|---|---|
| Status | tududi's own words in any language, common words from other tools (to do, doing, on hold, complete, yes/no, ✓), percentages (0% not started, 100% done, else in progress). Anything else is listed in the review for the user to match up |
| Priority | low/medium/high in any language, normal, urgent, critical, P1–P4. Others are matched up like statuses |
| Dates | `2026-11-20`, `2026-11-20 14:30`, `20/11/2026`, `11/20/2026`, `20.11.26`, Excel date cells, written dates (`12 March 2027`). Day-first or month-first is settled per column from values that can only be read one way; when none decide it the review asks, defaulting to month-first only for `en-US` browsers |
| Estimate | minutes (`90`), `1h 30m`, `1,5h`, `1:30`, days counted as 8 hours; tasks hold 5 minutes to 12 hours |
| Assignee | name or email of someone the user can assign to (their people plus workspace members). Unknown names are listed for matching |
| Tags | separated by `,` `;` or `|`, a leading `#` dropped. Missing tags are created |
| Completed at | used as the completion time for rows imported as done |

### Subtasks

Picked automatically, or chosen in the review:

- **Parent column**: a UID (of a row in the file or an existing task), or a name. Names match a row of the file in the same project first, then any row, then an existing top-level task of that project.
- **WBS / outline numbers**: `1`, `1.1`, `1.2` (`1.0` counts as `1`).
- **Indented rows** in Excel: cell indentation or grouped (outline) rows, as Smartsheet and MS Project exports have.

Subtasks in tududi are one level deep, so a third level goes under its top-level ancestor, with a warning. A subtask always moves into its parent's project.

### Updating tasks

When a UID column is mapped and **Update tasks that are already in tududi** is on (the default), rows whose UID matches a task the user can edit update that task instead of creating one. Only mapped columns change, and an empty cell leaves the field as it is (`clear_blanks: true` in the API clears it instead). Keep-in-the-note columns are not added to updated tasks, so re-importing does not stack lines in the note. Moving a task to another project only happens with the Project column as the target. A UID that matches nothing makes a new task, with a warning.

### Undo

Available for 7 days, from the wizard's last step or **Profile → Import & export**. It deletes the tasks the import created, puts updated tasks back to their earlier fields and tags, and removes projects and areas the import created if nothing is left in them. Tags it created stay. A task someone changed after the import is left as it is (created or updated), and the response says how many were kept; subtasks left behind move to the top level.

## Limits and safeguards

| What | Limit |
|---|---|
| Upload | 5 MB, `.csv` `.tsv` `.txt` `.xlsx` (`.xls` named files only if they are really `.xlsx`) |
| Rows, columns | 5,000 data rows and 60 columns per sheet; the job is flagged as cut short |
| Excel unpacked | 24 MB of XML in at most 2,000 zip entries, measured by inflating every entry before ExcelJS sees the file (declared sizes and the entry count in the end record are not trusted); password-protected and ZIP64 files are refused; at most two Excel files are parsed at once per process |
| Stored text | 8 million characters (as JSON) per file, which also stops shared strings repeating one long cell |
| Cells | dates over 64 characters, estimates over 32 and status, priority and assignee words over 100 are not parsed (they cannot be valid, and the parsers slow down on long input) |
| One import | 200 new projects, 50 new areas, 500 new tags, 20 tags per task; above that the review shows a problem instead of importing |

Access follows the task API:

- Tasks go only into projects the user owns or has a read-write share on. A project named in the sheet that the user cannot write to becomes a new project of their own.
- A UID updates a task only if the user can edit it; otherwise the row is a new task, with the same warning as an unknown UID, so UIDs cannot be probed.
- An existing task takes subtasks only if it is in a project the user can write to, or is their own task outside any project. Being assigned a task in someone else's private project is not enough.
- Assignees, also when matched by hand in the review, must be people the user can assign to. Status and priority choices are checked against their ranges.
- A job belongs to its uploader; every endpoint answers 404 to anyone else. Commit and undo claim the job atomically, so running either twice at once does it once.
- Updates are written to task history and newly assigned people are notified, as in the app. Webhooks are not sent for the importer's own tasks (one per row would flood a receiver), but are sent as usual to the owners of shared tasks the import changed.
- Exports only contain tasks the user can see; a visible subtask's parent is named only if the user can see the parent too.

## Notes for developers

- Module: `backend/modules/spreadsheets/` (`core/files.js` reads and writes files, `core/columns.js` and `core/values.js` match headers and cells, `analyze.js` builds the plan, `importService.js` commits and undoes it, `exportService.js`).
- Task rows are built with the same `buildTaskAttributes` / `buildUpdateAttributes` as the task API. Creates and updates pass `skipWebhooks: true`, so an import does not send one webhook per row.
- The plan limits (`max_tasks`, `max_projects`) are checked before commit.
- Status, priority and header words come from `public/locales/*/translation.json` (`status.*`, `priority.*`, `spreadsheet.columns.*`), read from `backend/dist/locales` in production.
- Undo shares `destroyTaskRows` (`backend/modules/tasks/operations/deletion.js`) with `DELETE /api/task/:uid`.
- Not imported: comments, attachments, dependencies, repeating rules, custom fields.
- Rows that repeat the header row (exports that start every group with its own header) are skipped. A group's title row above it is imported as a task of its own; its row shows in the review.
