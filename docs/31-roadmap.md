# Roadmap

The Roadmap page (`/roadmap`, in the sidebar) shows one calendar quarter across everything the user can see: areas, the projects in them, and the tasks in those projects, with goals pinned on top. Where the project Timeline answers "how does this project run", the Roadmap answers "how does the quarter look".

The same chart is the **Timeline** tab on an area's page, narrowed to that area and its goals.

## Reading the chart

- **Goals** sit in the first row as diamonds on their target date, with a dashed line running down the chart. Only active and achieved goals with a target date inside the quarter show; the row also says how many are outside it. Achieved goals are lighter.
- **Area and project rows** have a summary bar from the earliest start to the latest finish of the tasks below them.
- **Task rows** use the same marks as the project Timeline: a bar from start to due date, a diamond for a task with only a due date, a short faded bar for one with only a start. Open tasks past their due date are orange, done tasks grey.
- A line marks today. Bars that run past the quarter are cut at its edge.

Areas start open and projects closed. Rows open and close with their arrow, or all at once with **Expand all** and **Collapse all**; the choice is remembered per browser. The quarter is in the URL (`?q=2026-Q4`).

Clicking a task opens it in the side panel. Area, project and goal names go to their pages. The chart does not move tasks: dates are changed on the project Timeline or on the task.

## What counts

- **Summary dates:** a task's start, or its due date if it has no start. A task with one date counts as a single day. Done tasks count, so a project's start stays where it really was. The bar covers all the project's tasks, including ones outside the quarter.
- **Tasks left out:** subtasks, recurring instances, habits, cancelled and archived tasks. Undated tasks don't draw anything.
- **A project with no dated tasks** falls back to its own start and due dates, drawn faded and labelled "project dates". With neither, the row says "No dates yet".
- **Projects shown:** every active project, even with nothing in this quarter. Finished projects only when they overlap the quarter. Cancelled projects never.
- **Areas shown:** those with a project to show, in the user's own area order. Projects without an area are in a "No area" group at the end. A shared project sits where the viewer filed it, as on the Projects page, or in "No area" if its area isn't visible to them.

## API

`GET /api/roadmap`

| Param | Meaning |
|---|---|
| `from` | First day, `YYYY-MM-DD`. Without it, the current quarter in the user's timezone. A malformed value gets a 400 |
| `days` | Length of the window, 1 to 186 (default 92). Ignored without `from` |
| `area_uid` | Only this area and its goals. An unknown or inaccessible area gets a 404 |

The response has `from`, `to`, `goals`, `goals_outside` and `areas`. Each area has `start`, `end` and `projects`; each project has `start`, `end`, `dated_from_tasks`, `task_count` and the `tasks` overlapping the window. Dates are local days in the user's timezone. All of it follows the usual ownership and sharing rules.

The code is in `backend/modules/roadmap/`; `core/rollup.js` holds the rules above. The chart is `frontend/components/Roadmap/RoadmapChart.tsx`.
