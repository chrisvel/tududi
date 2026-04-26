# Directory Structure

[← Back to Index](../CLAUDE.md)

---

## Project Root

```
/Users/chris/c0deLab/ProjectLand/tasknotetaker/
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
├── public/                # Static assets (fonts, locales, images)
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
/Users/chris/c0deLab/ProjectLand/tasknotetaker/backend/
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
│   ├── notes/            # Notes management
│   ├── tags/             # Tag system
│   ├── users/            # User management
│   ├── auth/             # Authentication (login/register)
│   ├── shares/           # Project sharing & permissions
│   ├── telegram/         # Telegram bot integration
│   ├── inbox/            # Inbox items
│   ├── habits/           # Habit tracking
│   ├── notifications/    # Notification system
│   ├── search/           # Universal search
│   ├── views/            # Saved views
│   ├── admin/            # Admin functions
│   ├── backup/           # Backup/restore (33KB, complex)
│   ├── feature-flags/    # Feature flag management
│   ├── quotes/           # Daily quotes
│   └── url/              # URL handling
│
├── models/               # Sequelize model definitions
│   ├── index.js         # Model initialization & associations
│   ├── task.js          # Task model (recurrence fields)
│   ├── project.js       # Project model
│   ├── area.js          # Area model
│   ├── note.js          # Note model
│   ├── tag.js           # Tag model
│   ├── user.js          # User model (bcrypt password, settings)
│   ├── permission.js    # Permission/sharing model
│   ├── apiToken.js      # API token model
│   ├── recurringCompletion.js
│   ├── taskEvent.js     # Task audit log
│   ├── taskAttachment.js
│   ├── inboxItem.js
│   ├── notification.js
│   ├── role.js
│   ├── view.js
│   ├── backup.js
│   ├── setting.js
│   └── action.js
│
├── migrations/           # Database migrations (64+ files)
│   ├── 20240101120000-initial-schema.js
│   ├── 20240115140000-add-recurring-tasks.js
│   └── ... (timestamped migration files)
│
├── seeders/             # Database seed data
│   └── (seed files if any)
│
├── middleware/          # Global middleware
│   ├── auth.js         # Authentication (session + Bearer token)
│   ├── authorize.js    # Authorization (permission checking)
│   ├── rateLimiter.js  # Rate limiting config (5 different limiters)
│   ├── queryLogger.js  # Development query logging
│   └── permissionCache.js
│
├── services/            # Cross-cutting services
│   ├── permissionsService.js      # Main permissions service
│   ├── backupService.js           # Backup/restore operations
│   ├── emailService.js            # Email notifications
│   ├── logService.js              # Error logging
│   ├── applyPerms.js              # Apply permissions
│   └── permissionsCalculators.js  # Permission calculations
│
├── shared/              # Shared utilities
│   ├── errors/         # Custom error classes
│   │   ├── AppError.js
│   │   ├── NotFoundError.js
│   │   ├── ValidationError.js
│   │   ├── ConflictError.js
│   │   ├── UnauthorizedError.js
│   │   └── ForbiddenError.js
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
│   ├── migration-utils.js  # Database migration helpers
│   ├── request-utils.js    # Request utilities
│   └── notificationPreferences.js
│
├── config/              # Configuration
│   ├── config.js       # Environment-based config
│   ├── database.js     # Sequelize database config
│   └── swagger.js      # Swagger API schema (30KB)
│
├── docs/                # API documentation
│   └── swagger/
│       └── (swagger doc files)
│
├── scripts/             # Utility scripts
│   └── (database management scripts)
│
└── tests/               # Backend tests
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
    │   └── utils/
    │       ├── timezone-utils.test.js
    │       ├── slug-utils.test.js
    │       ├── attachment-utils.test.js
    │       └── migration-utils.test.js
    │
    └── integration/    # Integration tests (47+ test directories)
        ├── tasks/
        │   ├── tasks.test.js
        │   ├── subtasks.test.js
        │   └── recurring.test.js
        ├── projects/
        ├── areas/
        ├── notes/
        ├── tags/
        ├── auth/
        ├── shares/
        └── ...
```

---

## Frontend Structure

```
/Users/chris/c0deLab/ProjectLand/tasknotetaker/frontend/
│
├── index.tsx            # React application entry point
│                        # - React root initialization
│                        # - i18n setup
│                        # - Dark mode initialization
│                        # - Service worker cleanup
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
│   │   ├── TasksToday.tsx
│   │   ├── TaskDetails.tsx
│   │   ├── TaskForm.tsx
│   │   ├── TaskItem.tsx
│   │   ├── TaskList.tsx
│   │   ├── TaskFilters.tsx
│   │   ├── SubtaskList.tsx
│   │   └── ...
│   │
│   ├── Project/        # Project components
│   │   ├── ProjectDetails.tsx
│   │   ├── ProjectForm.tsx
│   │   ├── ProjectList.tsx
│   │   ├── ProjectCard.tsx
│   │   └── ...
│   │
│   ├── Area/           # Area components
│   │   ├── AreaDetails.tsx
│   │   ├── AreaForm.tsx
│   │   └── ...
│   │
│   ├── Note/           # Note components
│   │   ├── NoteDetails.tsx
│   │   ├── NoteForm.tsx
│   │   └── ...
│   │
│   ├── Tag/            # Tag components
│   ├── Habits/         # Recurring tasks UI
│   ├── Inbox/          # Inbox management
│   │
│   ├── Calendar/       # Calendar view (27KB)
│   │   └── Calendar.tsx
│   │
│   ├── Sidebar.tsx     # Left navigation sidebar
│   ├── Navbar.tsx      # Top navigation bar
│   │
│   ├── Metrics/        # Productivity metrics
│   │   └── ...
│   │
│   ├── Notifications/  # Notification system
│   ├── UniversalSearch/ # Search interface
│   │
│   ├── Shared/         # Shared UI components (41 items)
│   │   ├── Modal components
│   │   │   ├── Modal.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   └── ...
│   │   ├── Form inputs
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── DatePicker.tsx
│   │   │   └── ...
│   │   ├── ToastContext.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   └── ...
│   │
│   ├── Admin/          # Admin panel
│   ├── Backup/         # Backup/restore UI
│   ├── Profile/        # User profile settings
│   │   ├── ProfileSettings.tsx
│   │   ├── ApiTokens.tsx
│   │   └── ...
│   ├── Productivity/   # Analytics dashboard
│   └── Login/Register  # Auth pages
│       ├── Login.tsx
│       └── Register.tsx
│
├── store/              # Zustand state management
│   └── useStore.ts    # Global store (28KB)
│                       # - Task state & cache
│                       # - Project state & cache
│                       # - UI state (modals, filters, selections)
│                       # - Cache management functions
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
│   │   └── featureFlags.ts        # Feature flag client
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
/Users/chris/c0deLab/ProjectLand/tasknotetaker/e2e/
├── tests/              # Playwright test specs
│   ├── login.spec.ts
│   ├── tasks.spec.ts
│   ├── projects.spec.ts
│   ├── subtasks.spec.ts
│   ├── recurring-tasks.spec.ts
│   └── ...
└── bin/
    └── run-e2e.sh     # Test runner script
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
