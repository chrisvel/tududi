# Directory Structure

[← Back to Index](../CLAUDE.md)

---

## Project Root

```
tududi/                      # Repository root
├── README.md                # User-facing documentation
├── CLAUDE.md               # This developer guide (index)
├── LICENSE                 # MIT License
├── package.json            # Root scripts and dependencies (monorepo)
├── package-lock.json       # Dependency lock file
│
├── Configuration Files
├── webpack.config.js       # Frontend build configuration
├── tsconfig.json          # TypeScript config (frontend only)
├── jest.config.js         # Jest config for frontend tests
├── babel.config.js        # Babel transpilation for Jest + Webpack
├── eslint.config.mjs      # ESLint flat config
├── .prettierrc.json       # Prettier code formatting
├── tailwind.config.js     # Tailwind CSS customization
├── .sequelizerc           # Sequelize CLI configuration
├── postcss.config.js      # PostCSS config for Tailwind
│
├── Docker & Deployment
├── Dockerfile             # Production Docker image (multi-stage)
├── docker-compose.yml     # Development Docker setup
├── .dockerignore          # Docker build exclusions
│
├── Git & GitHub
├── .gitignore
├── .github/
│   ├── CONTRIBUTING.md    # Contribution guidelines
│   └── workflows/         # GitHub Actions (if any)
│
├── Source Code
├── backend/               # Express backend → See Backend Structure
├── frontend/              # React frontend → See Frontend Structure
├── public/                # Static assets served by webpack-dev-server / Express
│   ├── sw.js              # Service worker: offline cache + mutation queue
│   ├── manifest.json      # Web app manifest (PWA installability)
│   ├── index.html         # HTML shell template (HtmlWebpackPlugin input)
│   ├── icon-logo.png      # 512×512 app icon
│   ├── apple-touch-icon.png # 180×180 iOS home-screen icon
│   ├── favicon*.{ico,png} # Favicon variants
│   ├── fonts/             # Self-hosted Lora WOFF2 files
│   └── locales/           # i18n JSON translation files (27 locales)
├── dist/                  # Production build output
├── e2e/                   # Playwright E2E tests
├── scripts/               # Build and utility scripts
├── docs/                  # Documentation (this directory)
│
└── Other
    ├── screenshots/       # App screenshots for README
    ├── uploads/           # User file uploads (not in git)
    ├── test-results/      # Playwright test results
    └── node_modules/      # Dependencies
```

---

## Backend Structure

```
/backend/
│
├── app.js                 # Main Express application entry point
│                          # - Middleware setup (Helmet, CORS, compression)
│                          # - Session management
│                          # - Rate limiting
│                          # - Module registration
│                          # - Swagger integration
│                          # - SPA fallback routing
│
├── modules/               # Feature modules (modular architecture)
│   │
│   ├── tasks/            # Task management (MOST COMPLEX MODULE)
│   │   ├── routes.js            # Express routes
│   │   ├── repository.js        # Data access layer
│   │   ├── recurringTaskService.js
│   │   ├── taskEventService.js
│   │   ├── taskScheduler.js     # Cron-based scheduling
│   │   ├── operations/          # Business logic operations
│   │   │   ├── list.js         # List operations
│   │   │   ├── completion.js   # Status changes
│   │   │   ├── recurring.js    # Recurrence handling
│   │   │   ├── subtasks.js     # Subtask CRUD
│   │   │   ├── tags.js         # Tag assignment
│   │   │   ├── grouping.js     # Grouping logic
│   │   │   ├── sorting.js      # Sort orders
│   │   │   └── parent-child.js # Hierarchy ops
│   │   ├── queries/             # Query builders
│   │   │   ├── query-builders.js
│   │   │   ├── metrics-queries.js
│   │   │   └── metrics-computation.js
│   │   ├── core/                # Core utilities
│   │   │   ├── serializers.js   # Format API responses
│   │   │   ├── parsers.js       # Parse request data
│   │   │   ├── builders.js      # Build database objects
│   │   │   └── comparators.js   # Detect changes
│   │   ├── middleware/
│   │   │   └── access.js        # Access control
│   │   └── utils/
│   │       ├── constants.js
│   │       ├── validation.js
│   │       └── logging.js
│   │
│   ├── projects/         # Project management
│   │   ├── routes.js
│   │   ├── repository.js
│   │   └── utils/
│   │       └── validation.js
│   │
│   ├── areas/            # Area organization
│   ├── goals/            # Goals management (standalone goals system)
│   │   ├── routes.js
│   │   ├── repository.js
│   │   ├── service.js
│   │   └── controller.js
│   ├── notes/            # Notes management, public note links
│   ├── tags/             # Tag system, today/someday system tags
│   ├── comments/         # Task comments, replies, mentions, reactions
│   ├── templates/        # Project templates and marketplace
│   ├── users/            # User profile and settings
│   ├── auth/             # Authentication (login/register/password reset)
│   ├── oidc/             # OIDC/SSO login and provider config
│   ├── oauth/            # OAuth2 protected-resource metadata
│   ├── shares/           # Sharing, invitations & permissions
│   ├── groups/           # Admin-managed user groups
│   ├── people/           # Contacts and assignable people
│   ├── members/          # Workspace members, sign-in links
│   ├── everyone/         # The Everyone board
│   ├── telegram/         # Telegram bot integration
│   ├── caldav/           # CalDAV server and remote calendar sync
│   ├── mcp/              # Model Context Protocol server and tools
│   ├── ai-assistant/     # Daily Brief, task and project insights
│   ├── inbox/            # Inbox items
│   ├── habits/           # Habit tracking
│   ├── notifications/    # Notification system
│   ├── reports/          # GTD report
│   ├── search/           # Universal search
│   ├── views/            # Saved views
│   ├── admin/            # Admin functions
│   ├── admin-ai-usage/   # Admin AI usage (hosted mode)
│   ├── billing/          # Subscriptions and plan limits (hosted mode)
│   ├── landing/          # Marketing pages (TUDUDI_LANDING_HOSTS)
│   ├── demo/             # Public demo sandbox
│   ├── backup/           # Backup/restore (complex)
│   ├── feature-flags/    # Feature flag management
│   ├── quotes/           # Daily quotes
│   └── url/              # URL title extraction (SSRF guarded)
│
├── models/               # Sequelize model definitions (one file per model)
│   ├── index.js         # Model initialization & associations
│   ├── task.js          # Task model (recurrence fields, goal_id)
│   ├── project.js       # Project model (goal_id, is_maintenance, is_template)
│   ├── area.js / goal.js / note.js / tag.js
│   ├── user.js          # User model (bcrypt password, settings)
│   ├── role.js          # admin / user / guest roles
│   ├── permission.js    # Direct shares
│   ├── groupPermission.js, groupShare.js, userGroup.js, userGroupMember.js  # Group sharing
│   ├── person.js, memberSignInLink.js       # People and members
│   ├── comment.js, comment_reaction.js      # Task comments
│   ├── api_token.js, auth_audit_log.js, oidc_identity.js, oidc_state_nonce.js
│   ├── recurringCompletion.js, task_event.js, task_attachment.js
│   ├── inbox_item.js, notification.js, view.js, backup.js, setting.js, action.js
│   ├── caldav_*.js, calendar_token.js       # CalDAV
│   ├── user_project_area.js                 # Per-user area placement of shared projects
│   ├── billing_account.js, billing_event.js, usage_counter.js, waitlist_subscriber.js  # Hosted mode
│   └── rate_limit.js    # Rate limit store
│
├── migrations/           # Database migrations (130+ files)
│   ├── 20250615000001-create-users.js
│   └── ... (timestamped migration files)
│
├── seeders/             # Development seed data
│   ├── dev-seeder.js
│   └── expanded-tasks.js
│
├── middleware/          # Global middleware
│   ├── auth.js         # Authentication (session + Bearer token)
│   ├── authorize.js    # Authorization (permission checking)
│   ├── roles.js        # requireCapability: what a role may create
│   ├── numericIdParam.js # Accept numeric ids on uid routes
│   ├── csrf.js         # CSRF protection
│   ├── captcha.js      # Turnstile captcha (registration, password reset)
│   ├── entitlements.js # Plan limits (hosted mode)
│   ├── demo.js         # Demo sandbox guards
│   ├── uploadsAccess.js # Access checks for uploaded files
│   ├── rateLimiter.js, rateLimitStore.js  # Rate limiting
│   ├── queryLogger.js  # Development query logging
│   └── permissionCache.js
│
├── services/            # Cross-cutting services
│   ├── permissionsService.js      # Main permissions service
│   ├── rolesService.js            # Roles and capabilities (who may create what)
│   ├── workspaceMembers.js        # Who you share with or are in a group with
│   ├── backupService.js           # Backup/restore operations
│   ├── emailService.js            # Email notifications
│   ├── logService.js              # Error logging
│   ├── applyPerms.js              # Apply permissions
│   └── permissionsCalculators.js  # Permission calculations
│
├── shared/              # Shared utilities
│   ├── errors/         # Custom error classes
│   │   ├── AppError.js
│   │   └── index.js    # NotFoundError, ValidationError, ConflictError, UnauthorizedError,
│   │                   # ForbiddenError, ServiceUnavailableError and the plan/billing errors
│   ├── middleware/
│   │   └── errorHandler.js       # Global error handler
│   └── database/
│       └── BaseRepository.js     # Base repository class
│
├── utils/               # Utility functions
│   ├── uid.js          # Generate 15-char unique IDs (nanoid)
│   ├── slug-utils.js   # URL slug handling, UID extraction
│   ├── timezone-utils.js # Timezone conversions, date calculations
│   ├── attachment-utils.js # File handling and validation
│   ├── migration-utils.js  # Database migration helpers (dialect-aware)
│   ├── db-dialect.js       # The only place app code branches on SQLite vs PostgreSQL
│   ├── request-utils.js    # Request utilities
│   └── notificationPreferences.js
│
├── config/              # Configuration
│   ├── config.js       # Environment-based config (includes config.db)
│   ├── database-settings.js # Resolves the database engine from env vars (side-effect free)
│   ├── db.js           # buildSequelizeOptions() shared by app, sequelize-cli and scripts
│   ├── database.js     # sequelize-cli config (wraps db.js)
│   └── swagger.js      # Swagger API schema (30KB)
│
├── docs/                # API documentation
│   └── swagger/
│       └── (swagger doc files)
│
├── scripts/             # Utility scripts
│   ├── db-prepare.js   # Runs on every start: connect, create schema on empty DB, baseline on PostgreSQL
│   ├── db-migrate.js   # Umzug-based migration runner (npm run db:migrate)
│   ├── db-status.js    # Connection and table statistics
│   ├── db-init.js / db-reset.js / db-sync.js / reset-and-seed.js
│   ├── user-create.js  # Create or update a user (used by cmd/start.sh)
│   └── migration-create.js # Scaffold a dialect-safe migration
│
└── tests/               # Backend tests
    ├── helpers/
    │   ├── setup.js        # Per-file database isolation (SQLite file or per-worker PostgreSQL DB)
    │   ├── globalSetup.js  # Creates the per-worker PostgreSQL databases
    │   ├── test-db.js      # Test database naming
    │   └── testUtils.js    # createTestUser, authenticateUser
    ├── unit/           # Unit tests
    │   ├── models/
    │   │   ├── task.test.js
    │   │   ├── project.test.js
    │   │   ├── user.test.js
    │   │   └── ...
    │   ├── middleware/
    │   │   ├── auth.test.js
    │   │   └── authorize.test.js
    │   ├── services/
    │   │   ├── permissionsService.test.js
    │   │   └── applyPerms.test.js
    │   ├── config/
    │   │   └── database-settings.test.js
    │   └── utils/
    │       ├── timezone-utils.test.js
    │       ├── slug-utils.test.js
    │       ├── attachment-utils.test.js
    │       ├── db-dialect.test.js
    │       └── migration-utils.test.js
    │
    ├── integration/    # Integration tests (flat, 110+ files)
    │   ├── tasks.test.js
    │   ├── projects.test.js
    │   ├── comments.test.js
    │   ├── mcp/        # MCP tool tests
    │   └── ...
    ├── upgrade/        # Legacy database upgrade suite
    └── fixtures/legacy # SQLite files produced by older releases
```

---

## Frontend Structure

```
/frontend/
│
├── index.tsx            # React application entry point
│                        # - React root initialization
│                        # - i18n setup
│                        # - Dark mode initialization
│                        # - Service worker registration (production)
│                        # - SW update lifecycle + SYNC_COMPLETE handler
│                        # - Dev-mode SW cleanup
│
├── App.tsx              # Root component (13KB)
│                        # - Route definitions
│                        # - User authentication check
│                        # - Route protection
│                        # - Layout wrapper
│
├── Layout.tsx           # Main layout wrapper (21KB)
│                        # - Sidebar integration
│                        # - Navigation
│                        # - Modal management
│
├── components/          # React components (feature-based)
│   │
│   ├── Task/           # Task-related components
│   │   ├── TasksToday.tsx         # Today page
│   │   ├── TodaySettingsDropdown.tsx
│   │   ├── TaskDetails.tsx
│   │   ├── TaskItem.tsx, TaskList.tsx, GroupedTaskList.tsx
│   │   ├── TaskComments.tsx, CommentComposer.tsx
│   │   ├── AreaBalanceBar.tsx, ActiveProjectsSection.tsx, BurndownChart.tsx
│   │   ├── TaskDetails/         # Task detail sidebar cards
│   │   │   ├── TaskProjectCard.tsx
│   │   │   ├── TaskAreaCard.tsx
│   │   │   ├── TaskGoalCard.tsx  # Goal picker card in task detail
│   │   │   ├── TaskTagsCard.tsx
│   │   │   └── ...
│   │   ├── TaskForm/, TaskRow/
│   │   └── ...
│   │
│   ├── Project/        # Project components
│   │   ├── ProjectDetails.tsx
│   │   ├── ProjectModal.tsx
│   │   ├── ProjectItem.tsx
│   │   ├── ProjectShareModal.tsx
│   │   └── ...
│   ├── Projects.tsx    # Projects list page
│   │
│   ├── Area/           # Area components
│   │   ├── AreaDetails.tsx  # Area detail + goals spine + project buckets
│   │   └── AreaModal.tsx
│   │
│   ├── Goal/           # Goal components (standalone goals system)
│   │   ├── GoalDetails.tsx  # Goal detail page (projects + tasks)
│   │   └── GoalModal.tsx    # Create/edit modal
│   │
│   ├── Goals.tsx       # Goals list page (grid, mirrors Areas.tsx)
│   │
│   ├── Note/           # Note components
│   │   ├── NoteDetails.tsx
│   │   ├── NoteModal.tsx
│   │   ├── MarkdownEditor.tsx
│   │   ├── PublicShareModal.tsx
│   │   ├── editor/     # Block editor
│   │   └── ...
│   ├── PublicNote/     # Public note page (/public/notes/:token)
│   │
│   ├── Tag/            # TagDetails, TagInput, TagModal
│   │
│   ├── Sidebar/        # Sidebar sub-components
│   │   ├── SidebarAreas.tsx
│   │   ├── SidebarGoals.tsx   # Goals section (expandable active goals list)
│   │   ├── SidebarTags.tsx
│   │   └── ...
│   │
│   ├── Habits/         # Habit tracking UI
│   ├── Inbox/          # Inbox management
│   ├── Calendar/       # Calendar view
│   ├── Kanban/         # Kanban board
│   ├── Eisenhower/     # Eisenhower matrix
│   ├── Everyone/       # Everyone board
│   ├── People/         # People page (members and contacts)
│   ├── Templates/      # Project templates and marketplace
│   ├── Insights/       # Daily Brief, Productivity and Reports pages
│   ├── Metrics/        # Productivity metrics
│   ├── Productivity/   # Analytics dashboard
│   ├── AI/             # Daily Brief and insights
│   ├── CalDAV/         # CalDAV setup
│   ├── Billing/        # Billing (hosted mode)
│   ├── Notifications/  # Notification system
│   ├── UniversalSearch/ # Search interface
│   │
│   ├── Sidebar.tsx     # Left navigation sidebar
│   ├── Navbar.tsx      # Top navigation bar
│   │
│   ├── Shared/         # Shared UI components
│   │   ├── ConfirmDialog.tsx, DiscardChangesDialog.tsx
│   │   ├── DatePicker.tsx, DateTimePicker.tsx
│   │   ├── *Dropdown.tsx          # Area, Goal, Project, Person, Priority, Status, ...
│   │   ├── ShareModal.tsx         # User/group sharing
│   │   ├── MarkdownRenderer.tsx, MermaidDiagram.tsx
│   │   ├── ToastContext.tsx
│   │   ├── LoadingScreen.tsx
│   │   └── ...
│   │
│   ├── Admin/          # Admin dashboard, users, roles, groups, waitlist, billing, AI usage
│   ├── Backup/         # Backup/restore UI
│   ├── Profile/        # User profile settings
│   │   ├── ProfileSettings.tsx
│   │   ├── tabs/       # General, Security, ApiKeys, AIAssistant, CalDAV, Telegram, ...
│   │   └── ...
│   ├── Auth/           # Password reset, OIDC callback, sign-in link, captcha
│   ├── Login.tsx       # Login page
│   └── Register.tsx    # Registration page
│
├── store/              # Zustand state management
│   └── useStore.ts    # Global store
│                       # - notesStore, areasStore, goalsStore
│                       # - projectsStore, tagsStore, tasksStore
│                       # - inboxStore, habitsStore, userSettingsStore
│
├── contexts/           # React contexts
│   ├── ModalContext.tsx          # Modal state management
│   ├── SidebarContext.tsx        # Sidebar state
│   └── TelegramStatusContext.tsx # Telegram integration status
│
├── hooks/              # Custom React hooks
│   ├── useKeyboardShortcuts.ts   # Keyboard handling
│   ├── useModalManager.ts        # Modal management
│   ├── usePersistedModal.ts      # Modal persistence
│   └── useTasksData.ts           # Task data fetching
│
├── utils/              # Frontend utilities (30+ files)
│   ├── API Services (API client utilities)
│   │   ├── tasksService.ts        # Task API client
│   │   ├── projectsService.ts     # Project API client
│   │   ├── notesService.ts
│   │   ├── tagsService.ts
│   │   ├── areasService.ts
│   │   ├── goalsService.ts        # Goals API client (fetchGoals, fetchGoalByUid, createGoal, updateGoal, deleteGoal)
│   │   ├── profileService.ts      # User profile API
│   │   ├── apiKeysService.ts      # API token management
│   │   ├── searchService.ts       # Search API client
│   │   ├── sharesService.ts       # Project sharing API
│   │   ├── backupService.ts       # Backup/restore API
│   │   ├── inboxService.ts        # Inbox API
│   │   ├── habitsService.ts       # Habits/recurring API
│   │   ├── taskEventService.ts    # Task history API
│   │   ├── taskIntelligenceService.ts # AI-assisted task mgmt
│   │   └── attachmentsService.ts  # File attachment handling
│   │
│   ├── Utilities
│   │   ├── dateUtils.ts           # Date/time helpers
│   │   ├── timezoneUtils.ts       # Timezone handling
│   │   ├── taskSortUtils.ts       # Task sorting logic
│   │   ├── localeUtils.ts         # i18n helpers
│   │   ├── keyboardShortcutsService.ts # Shortcut definitions
│   │   ├── bannersService.ts      # Banner management
│   │   ├── urlService.ts          # URL parsing
│   │   ├── slugUtils.ts           # URL slug handling
│   │   ├── userUtils.ts           # User utilities
│   │   ├── fetcher.ts             # SWR fetcher configuration
│   │   ├── featureFlags.ts        # Feature flag client
│   │   └── swUtils.ts             # Service worker messaging (session/cache)
│   │
│   └── config/
│       └── paths.ts               # API and path configuration
│
├── entities/           # TypeScript interfaces/types
│   ├── Task.ts        # Task type definition
│   ├── Project.ts     # Project type definition
│   ├── Note.ts        # Note type definition
│   ├── User.ts        # User type definition
│   ├── Tag.ts         # Tag type definition
│   ├── Area.ts        # Area type definition
│   ├── TaskEvent.ts   # Task event type
│   ├── Attachment.ts  # Attachment type
│   ├── InboxItem.ts   # Inbox item type
│   └── Metrics.ts     # Metrics type
│
├── i18n.ts             # i18next configuration
│                       # - Language detection
│                       # - Resource loading
│                       # - 24 language support
│
├── styles/             # Global styles
│   ├── globals.css
│   ├── markdown.css
│   └── ...
│
└── __tests__/          # Frontend tests
    ├── setup.ts       # Test configuration
    └── (component tests)
```

---

## E2E Tests Structure

```
/e2e/
├── tests/              # Playwright test specs
│   ├── caldav-client.spec.ts
│   ├── inbox.spec.ts
│   ├── notes-editor.spec.ts
│   ├── registration.spec.ts
│   ├── share-target.spec.ts
│   └── today-view.spec.ts
└── bin/
    ├── run-e2e.sh          # Test runner script
    └── run-single-test.sh  # Run one spec
```

---

## Critical Paths Reference

Quick lookup table for common development tasks:

| Task | Primary Location | Related Files |
|------|------------------|---------------|
| **Add backend feature** | `/backend/modules/[feature]/` | routes.js, repository.js, operations/ |
| **Create new model** | `/backend/models/[model].js` | Also update `/backend/models/index.js` for associations |
| **Database migration** | `/backend/migrations/TIMESTAMP-name.js` | Create with `npm run migration:create` |
| **Add React component** | `/frontend/components/[Feature]/ComponentName.tsx` | - |
| **Define API routes** | `/backend/modules/[module]/routes.js` | - |
| **Business logic** | `/backend/modules/[module]/operations/` | Or service files in module |
| **Global frontend state** | `/frontend/store/useStore.ts` | Zustand store |
| **API client** | `/frontend/utils/[resource]Service.ts` | - |
| **TypeScript types** | `/frontend/entities/[Type].ts` | Interface definitions |
| **Backend unit tests** | `/backend/tests/unit/[category]/` | models/, middleware/, services/, utils/ |
| **Backend integration tests** | `/backend/tests/integration/[module]/` | - |
| **E2E tests** | `/e2e/tests/[feature].spec.ts` | Playwright specs |
| **Middleware** | `/backend/middleware/[name].js` | auth.js, authorize.js, etc. |
| **Shared utilities** | `/backend/utils/` or `/frontend/utils/` | Depends on context |
| **Error classes** | `/backend/shared/errors/` | Custom error types |
| **Swagger docs** | `/backend/config/swagger.js` | API schema definitions |

---

[← Back to Index](../CLAUDE.md)
