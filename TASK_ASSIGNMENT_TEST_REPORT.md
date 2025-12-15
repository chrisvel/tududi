# Task Assignment Feature - Test Report

**Date:** 2025-12-15
**Status:** ✅ Ready for Testing

---

## ✅ PRE-FLIGHT CHECKS

### Environment Status
- ✅ **Backend Server:** Running on http://localhost:3002
- ✅ **Frontend Server:** Running on http://localhost:8080
- ✅ **Database Schema:** Verified - `assigned_to_user_id` field exists in tasks table

### Database Verification
```bash
$ sqlite3 backend/db/development.sqlite3 "PRAGMA table_info(tasks);" | grep assigned
36|assigned_to_user_id|INTEGER|0||0
```

### API Endpoints Added
- ✅ `POST /api/v1/task/:uid/assign` - Assign task to user
- ✅ `POST /api/v1/task/:uid/unassign` - Remove assignment
- ✅ `GET /api/v1/tasks?assigned_to_me=true` - Filter assigned tasks
- ✅ `GET /api/v1/tasks?assigned_by_me=true` - Filter owned & assigned tasks

---

## 📋 MANUAL TESTING GUIDE

### Setup: Create Test Users

Since you need at least 2 users to test assignment, create them via the UI:

1. **Open:** http://localhost:8080
2. **Register User 1:** (e.g., alice@example.com)
3. **Logout**
4. **Register User 2:** (e.g., bob@example.com)

### Test Case 1: Assign Task to User

**Steps:**
1. Login as **User 1** (alice@example.com)
2. Create a new task (e.g., "Test Assignment Feature")
3. Click on the task to open Task Details
4. Scroll down to find the **"Assigned To"** card
5. Click **"Assign to user"** button
6. Select **User 2** (bob@example.com) from dropdown
7. Click **"Assign"**

**Expected Results:**
- ✅ Task is assigned successfully
- ✅ Success toast message appears: "Task assigned successfully"
- ✅ Assignment card shows User 2's name/email with avatar
- ✅ "Change" and "Unassign" buttons appear

### Test Case 2: Verify Assignee Permissions

**Steps:**
1. **Stay logged in as User 1**
2. Note the task UID from the URL (e.g., `/task/abc123`)
3. **Logout**
4. **Login as User 2** (bob@example.com)
5. Navigate to the assigned task URL directly: http://localhost:8080/task/abc123
6. Try to edit the task (change name, status, etc.)

**Expected Results:**
- ✅ User 2 can **see** the task (has read access)
- ✅ User 2 can **edit** the task (has write access)
- ✅ Task appears in User 2's task list
- ✅ Changes by User 2 are saved successfully

### Test Case 3: Assignee Notification (In-App)

**Steps:**
1. **Login as User 2** (bob@example.com - the assignee)
2. Check the notifications (bell icon in header)

**Expected Results:**
- ✅ Notification appears: "{User 1 name} assigned you the task 'Test Assignment Feature'"
- ✅ Notification type: `task_assigned`
- ✅ Notification level: `info`

### Test Case 4: Complete Assigned Task

**Steps:**
1. **Login as User 2** (bob@example.com - the assignee)
2. Open the assigned task
3. Mark the task as **Completed**
4. **Logout**
5. **Login as User 1** (alice@example.com - the owner)
6. Check notifications

**Expected Results:**
- ✅ User 1 receives notification: "{User 2 name} completed 'Test Assignment Feature'"
- ✅ Notification type: `assigned_task_completed`
- ✅ Notification level: `success`

### Test Case 5: Unassign Task

**Steps:**
1. **Login as User 1** (alice@example.com - the owner)
2. Open a task that's assigned to User 2
3. Click **"Unassign"** button
4. Confirm unassignment

**Expected Results:**
- ✅ Task is unassigned
- ✅ Success toast: "Task unassigned successfully"
- ✅ Assignment card shows **"Assign to user"** button again
- ✅ User 2 loses access to the task (permission removed)

### Test Case 6: Change Assignment

**Steps:**
1. **Login as User 1** (alice@example.com)
2. Create a third test user: **User 3** (charlie@example.com)
3. Assign a task to User 2
4. Click **"Change"** button on assignment card
5. Select **User 3** from dropdown
6. Click **"Assign"**

**Expected Results:**
- ✅ Task is reassigned from User 2 to User 3
- ✅ User 2 loses permission (removed)
- ✅ User 3 gains permission (added)
- ✅ User 2 receives "unassigned" notification
- ✅ User 3 receives "assigned" notification

### Test Case 7: API Filter - Assigned To Me

**Steps:**
1. **Login as User 2** (bob@example.com)
2. Ensure User 2 has tasks assigned to them
3. Open browser DevTools > Network tab
4. Navigate to Tasks page
5. Look for API call to `/api/v1/tasks`

**Manual API Test:**
```bash
# Get session cookie first by logging in via browser
# Then test API:
curl -X GET 'http://localhost:3002/api/v1/tasks?assigned_to_me=true' \
  -H 'Cookie: connect.sid=YOUR_SESSION_COOKIE' \
  --cookie-jar cookies.txt
```

**Expected Results:**
- ✅ Returns only tasks assigned to User 2
- ✅ Each task has `assigned_to_user_id: {User 2 ID}`
- ✅ Each task includes `AssignedTo` object with user details

### Test Case 8: API Filter - Assigned By Me

**Steps:**
1. **Login as User 1** (alice@example.com - the owner)
2. Ensure User 1 has assigned tasks to others

**Manual API Test:**
```bash
curl -X GET 'http://localhost:3002/api/v1/tasks?assigned_by_me=true' \
  -H 'Cookie: connect.sid=YOUR_SESSION_COOKIE' \
  --cookie-jar cookies.txt
```

**Expected Results:**
- ✅ Returns only tasks where User 1 is owner AND assigned to someone else
- ✅ Each task has `user_id: {User 1 ID}`
- ✅ Each task has non-null `assigned_to_user_id`

---

## 🐛 KNOWN LIMITATIONS

1. **UserSelector uses admin endpoint:** The UserSelector component fetches users from `/api/admin/users` which requires admin permissions. This should be changed to a public user list endpoint or filtered to only show relevant users.

2. **No AssignedTasksView yet:** The dedicated "Assigned" view with tabs is not implemented (optional task).

3. **No assignee badge in task lists:** TaskItem.tsx doesn't show assignee avatars in list view yet (optional task).

---

## 🔧 TROUBLESHOOTING

### Issue: "Failed to load users" in UserSelector
**Cause:** Current user is not an admin
**Solution:**
- Make first user admin: `UPDATE users SET admin = 1 WHERE id = 1;`
- OR implement a public `/api/v1/users` endpoint

### Issue: Cannot see assigned tasks
**Cause:** Permission not created properly
**Check:**
```sql
SELECT * FROM permissions WHERE resource_type = 'task' AND propagation = 'assignment';
```

### Issue: No notifications received
**Check:** User notification preferences
```sql
SELECT notification_preferences FROM users WHERE id = {user_id};
```

---

## ✅ TESTING CHECKLIST

Use this checklist when testing:

- [ ] Backend server is running (port 3002)
- [ ] Frontend server is running (port 8080)
- [ ] Database has `assigned_to_user_id` field
- [ ] Created at least 2 test users
- [ ] Can open task details page
- [ ] Assignment card appears in task details
- [ ] Can select user from dropdown
- [ ] Can assign task to user
- [ ] Assignee receives notification
- [ ] Assignee can view assigned task
- [ ] Assignee can edit assigned task
- [ ] Can mark assigned task as complete
- [ ] Owner receives completion notification
- [ ] Can unassign task
- [ ] Can change assignment from one user to another
- [ ] Permission is removed on unassignment
- [ ] API filter `assigned_to_me=true` works
- [ ] API filter `assigned_by_me=true` works

---

## 📊 TEST RESULTS

**Fill in after testing:**

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Assign task | ⬜ | |
| 2. Assignee permissions | ⬜ | |
| 3. Assignee notification | ⬜ | |
| 4. Complete notification | ⬜ | |
| 5. Unassign task | ⬜ | |
| 6. Change assignment | ⬜ | |
| 7. API filter: assigned_to_me | ⬜ | |
| 8. API filter: assigned_by_me | ⬜ | |

**Legend:** ✅ Pass | ❌ Fail | ⚠️ Partial | ⬜ Not Tested

---

## 🚀 NEXT STEPS

After successful testing:
1. ✅ Fix any bugs discovered
2. ✅ Implement optional UI enhancements (if desired)
3. ✅ Write automated tests
4. ✅ Update user documentation
5. ✅ Deploy to production

---

**Tested By:** _________________
**Date:** _________________
**Overall Result:** ⬜ Pass | ⬜ Fail | ⬜ Needs Work
