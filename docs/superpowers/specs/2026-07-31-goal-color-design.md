# Goal Color Field — Design Spec

**Date:** 2026-07-31
**Status:** Approved

## Overview

Add a `color` field to Goals so users can assign a color when creating or editing a goal. The chosen color surfaces on goal cards in the Goals list view (taking precedence over the inherited area color) and as a colored left border on goal rows in the Area detail page.

## Scope

This follows the existing pattern used by Areas and Projects — the shared `ColorPicker` component and a nullable `STRING` color column.

## Data Layer

**Backend model** (`backend/models/goal.js`):
- Add `color: { type: DataTypes.STRING, allowNull: true }` to the field definitions.

**Migration** (`backend/migrations/<timestamp>-add-color-to-goals.js`):
- `queryInterface.addColumn('goals', 'color', { type: Sequelize.STRING, allowNull: true })`
- Down: `queryInterface.removeColumn('goals', 'color')`

**Frontend entity** (`frontend/entities/Goal.ts`):
- Add `color?: string` to the `Goal` interface.

**GoalsService** (`backend/modules/goals/service.js`):
- In `create`: destructure `color` from `data`, pass `color: color || null` to repository.
- In `update`: include `if (color !== undefined) updates.color = color || null`.

## GoalModal

**File:** `frontend/components/Goal/GoalModal.tsx`

- Add `color` to `getDefaultForm()` as `''`.
- When loading an existing goal in the `useEffect`, populate `color: goal.color ?? ''`.
- Include `color` in `hasUnsavedChanges` comparison.
- Import `ColorPicker` from `'../Shared/ColorPicker'`.
- Add a Color section below the Target Date field, matching AreaModal's style:
  ```
  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
    {t('forms.color', 'Color')}
  </label>
  <ColorPicker
    value={formData.color || ''}
    onChange={(color) => setFormData((prev) => ({ ...prev, color: color || '' }))}
  />
  ```
- Pass `color` through in `handleSubmit` (already spread via `...formData`; ensure the `onSave` call doesn't strip it).

## Goals List View

**File:** `frontend/components/Goals.tsx`

- Change: `const areaColor = goal.Area?.color;` → `const effectiveColor = goal.color || goal.Area?.color;`
- Replace all references to `areaColor` / `hasColor` with `effectiveColor` / `hasColor` (where `hasColor = !!effectiveColor`).
- Replace `style={{ backgroundColor: areaColor }}` with `style={{ backgroundColor: effectiveColor }}`.
- No other logic changes — all existing color-conditional class strings continue to work.

## Area Detail Page

**File:** `frontend/components/Area/AreaDetails.tsx`

- On the goal row `<Link>` element, add a dynamic left border when the goal has a color:
  - Add `border-l-4` class when `goal.color` is set; `border-l-0` (or omit) otherwise.
  - Set `style={{ borderLeftColor: goal.color }}` when `goal.color` is set.

## Out of Scope

- Goal detail / single-goal page color display.
- Color used in sidebar or navigation.
- Any other entity types.
