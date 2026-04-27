# Recurring Tasks - Behavior Rules

This document explains how recurring tasks work in TaskNoteTaker from a user behavior perspective. For technical implementation details, see the backend code in `/backend/modules/tasks/recurringTaskService.js`.

---

## **Basic Rules**

1. **A recurring task is a single task that automatically resets itself when completed**
   - You mark it done, and it immediately reappears with a new due date

2. **The task doesn't create copies - it's the same task reusing itself**
   - Same task ID, same title, same details
   - Only the due date changes

3. **Future occurrences are shown in your task list even though they don't exist yet**
   - These are "virtual" - they're previews of what's coming
   - They become real when the previous occurrence is completed

---

## **Completion Behavior**

4. **When you complete a recurring task:**
   - It records that you completed this occurrence
   - It immediately changes to "Not Started" again
   - It gets a new due date based on the pattern

5. **Two ways to calculate the next due date:**
   - **Due-date based** (default): Next occurrence calculated from original due date
     - Example: Task due Monday, you complete it Wednesday → Next is still next Monday
   - **Completion-based**: Next occurrence calculated from when you actually completed it
     - Example: Task due Monday, you complete it Wednesday → Next is 7 days from Wednesday

---

## **Pattern Rules**

6. **Daily recurring:**
   - Every N days from the due date (or completion date)

7. **Weekly recurring:**
   - Every N weeks on specific day(s)
   - Can repeat on multiple days (e.g., every Mon+Wed+Fri)

8. **Monthly recurring:**
   - **Fixed day**: Every N months on day 15
   - **Weekday pattern**: Every N months on "2nd Thursday"
   - **Last day**: Every N months on the last day of the month

9. **Recurring tasks can have an end date:**
   - After that date, the task stops recurring
   - Without an end date, they repeat forever

---

## **Editing Rules**

10. **If you edit the recurrence pattern of a parent task:**
    - Future occurrences update to match the new pattern
    - Past completed occurrences stay in the history unchanged

11. **You can edit individual details (title, priority, notes) on the parent:**
    - Changes apply to future occurrences
    - Past completions keep their original details

12. **If you edit a future occurrence (a virtual instance):**
    - You're actually editing the parent template
    - The change affects all future occurrences

---

## **Display Rules**

13. **Recurring tasks show up multiple times in your lists:**
    - Today's occurrence (if due today)
    - Future occurrences (as previews)
    - Typically shows next 6-7 occurrences

14. **Each occurrence looks like a separate task in the UI:**
    - But it's really the same task showing at different dates

15. **You can see completion history:**
    - Records of when you completed past occurrences
    - Shows your pattern of completing the task

---

## **Special Cases**

16. **If a recurring task is overdue:**
    - It doesn't pile up multiple occurrences
    - Shows the current/next occurrence only
    - Past-due occurrences are skipped automatically

17. **If you delete a recurring task:**
    - The parent template is deleted
    - All future occurrences disappear
    - Past completion history is preserved

18. **Recurring tasks can belong to projects:**
    - Every occurrence inherits the project
    - Changing the project changes it for all future occurrences

---

## **Key Concepts**

### Virtual Instances
Future occurrences that are generated on-the-fly for display purposes. They don't exist in the database as separate tasks - they're computed from the parent task's recurrence pattern.

### Parent Task
The original recurring task that acts as a template. It has `recurring_parent_id = null` and stores the recurrence pattern configuration.

### In-Place Advancement
When you complete a recurring task, the same task record is reused with an updated due date, rather than creating a new task instance.

### Completion History
All past completions are tracked in a separate table (`recurring_completions`) to preserve your completion record even though the task itself advances.

---

## **Analogy**

Think of it like a gym membership that auto-renews - it's one subscription that keeps coming back on a schedule, not multiple separate subscriptions.

---

## **Related Documentation**

- [Architecture Overview](architecture.md) - Technical architecture
- [Backend Patterns](backend-patterns.md) - Module structure
- [Database & Migrations](database.md) - Data model details
- [Common Tasks](common-tasks.md) - How to work with recurring tasks in code

**Technical Implementation Files:**
- Recurrence calculation: `/backend/modules/tasks/recurringTaskService.js`
- Completion handling: `/backend/modules/tasks/routes.js`
- Task model: `/backend/models/task.js`
- Completion tracking: `/backend/models/recurringCompletion.js`

---

**Document Version:** 1.0.0
**Last Updated:** 2026-03-14
**Audience:** Developers, AI assistants, and end users