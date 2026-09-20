# People, Members and Roles

[← Back to Index](../CLAUDE.md)

---

## Overview

Tududi is meant for one person, a family or a small team. This page defines the words used for the people in a workspace, who can be assigned a task, what a member without an email is, and what an admin, a user and a guest can do.

For sign-up, login, profiles and API tokens see [User Management](08-user-management.md). For sharing with several people at once see [User Groups](18-user-groups.md).

---

## The words

| Word | Meaning |
| --- | --- |
| **Member** | Someone with an account on this instance. That includes an account added without an email. |
| **Contact** | A person you keep track of who has no account: a plumber, a teacher, a grandparent. A contact belongs to the user who added it, and nobody else sees it. |
| **Person** | An entry a task can be assigned to. Every account has one of its own, and contacts are people too. The assignee lists show people. |
| **Group** | A named set of members an admin maintains. See [User Groups](18-user-groups.md). |
| **Share** | Giving a member or a group access to a project, area, goal, note or task. |
| **Workspace** | Informal: the people you share something with, in either direction, plus everyone who is in a group with you. |
| **Role** | Admin, user or guest. A role decides what an account can create and manage. |
| **Capability** | One thing a role allows, such as adding people. A single account can have more or fewer than its role. |

---

## Behavior

### Contacts and your own person

1. **The People page (`/people`) lists your own people.** That is your contacts and the person that stands for your own account, marked "(me)". Other members do not appear on this page. They appear in assignee lists, in groups and on the Everyone board.

2. **A contact has a name, a relationship (family, work, friend or other), an email, a phone number, notes and a color.** Names are unique per user. A contact can be archived.

3. **A contact that has tasks assigned to it cannot be deleted.** Archive it or unassign the tasks first.

4. **Every account gets its own person when it is created.** It is named after the account: first and last name, else the part of the email before the `@`, else `Member`. A name that would clash with one of your contacts gets " (me)" added. Renaming the account renames the person, and renaming the person renames the account.

5. **A contact can be linked to an account.** Linking is only allowed to someone in your workspace (an admin can link anyone), and only one contact per account. Contacts that were linked earlier are not affected by these rules. A linked contact is not listed a second time next to the account's own person.

6. **Contacts stay private.** What another member gets to see of your account in an assignee list is its name and color, never the email, phone number or notes.

### Assigning a task

7. **The assignee list depends on where the task is.**
    - **A task in a project:** your contacts, the project owner and everyone the project is shared with. Access through a shared area or goal, or through a group, counts the same as a direct share (`GET /api/projects/:uid/assignable-people`).
    - **A task that is not in a project:** your contacts and everyone in your workspace (`GET /api/people/assignable`).

8. **Assigning a task to a member notifies them and gives them access to that task.** They get a `task_assigned` notification (channels follow their notification preferences), the task appears in their lists and in "Assigned to me", and they can open and complete it even if they cannot otherwise see its project.

9. **Assigning a task to a contact is only a label.** A contact has no account, so nobody is notified and nothing is shared.

10. **A member who cannot sign in is managed by the people who share their tasks.** Tasks assigned to them stay editable by whoever owns or shares the task or project.

### Members without an email

11. **An admin can add a member with just a name.** In Admin > Access > Users, leave the email blank and fill in the name. This is meant for someone who has no email address, such as a child or another household member.

12. **Such a member cannot sign in yet.** There is no password and nothing to sign in with, and no invitation or verification email is sent. The list shows "No email" and "Can't sign in yet".

13. **Everything else works like any other member.** They get their own person, can be put in groups, can be given shares, and can be assigned tasks. Assigned tasks show on the Everyone board.

14. **An email can be added later, but not removed.** Adding one is the first step to inviting them. Emails stay unique across accounts. Any number of accounts can have no email.

### Roles and capabilities

15. **There are three roles: admin, user and guest.** Admin manages accounts, roles and groups and can do everything. A user can add people and create projects, areas and goals. A guest works inside what is shared with them or assigned to them and creates none of those.

16. **The capabilities are `create_people`, `invite_members` and `create_projects`.** An admin can give one account more or fewer than its role, for example letting one user invite others. The role table, how overrides are stored, and where the server enforces them are in [User Management](08-user-management.md#user-roles--permissions).

17. **The Roles tab in Admin > Access shows each role, how many accounts hold it and what it may do.** The role and permissions of an account are set in the Users tab when adding or editing it. The roles themselves are fixed for now.

### The Everyone board

18. **`/everyone` shows what each person in your workspace has on.** The sidebar link appears once you share with someone or are in a group with someone, and can be hidden under Profile > Sidebar.

19. **There is one column per person.** You come first, then members, then contacts that have tasks. A member with nothing to do still gets a column. Each column groups tasks into Overdue, Today, Tomorrow, Upcoming (the next seven days) and No date. Tasks due more than a week away are left off until they get closer.

20. **A task is shown under its assignee, or under whoever created it if nobody is assigned.** Habits are left out, and a recurring task is shown once with its current due date. Days are worked out in your own timezone. You can open and complete tasks from the board.

---

## API summary

| Endpoint | What it does |
| --- | --- |
| `GET /api/people` | Your own people. Filters: `archived`, `sort`, `relationship_type`, `unlinked` |
| `GET /api/people/assignable` | Your people plus everyone in your workspace, for tasks outside a project |
| `GET /api/projects/:uid/assignable-people` | Who a task in this project can be assigned to |
| `POST`, `PATCH`, `DELETE /api/people[/:uid]` | Add, change or remove one of your contacts. Adding needs `create_people` |
| `GET /api/everyone` | The Everyone board |
| `GET /api/admin/roles` | The three roles, their default capabilities and how many accounts hold each (admin) |
| `POST /api/admin/users`, `PUT /api/admin/users/:id` | Create or change an account, including `role`, `capabilities` and an optional email (admin) |

---

## Limits today

- A member without an email cannot sign in. There is no login link or PIN yet.
- Only an admin can create accounts. The `invite_members` capability is stored and editable, but nothing outside the admin pages uses it yet.
- Contacts and members are separate records. Linking a contact to an account keeps both, and assignee lists show that person only once.
- The Roles tab is read only. The set of roles and their defaults live in code.
