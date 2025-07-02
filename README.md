# 📝 tududi

`tududi` is the self-hosted task management tool that puts you in control. Organize your life and projects with a clear, hierarchical structure,
smart recurring tasks, and seamless Telegram integration. Get focused, stay productive, and keep your data private.

![Light Mode Screenshot](screenshots/all-light.png)

![Dark Mode Screenshot](screenshots/all-dark.png)

![Light Mobile Screenshot](screenshots/mobile-all-light.png)

![Dark Mobile Screenshot](screenshots/mobile-all-dark.png)

## 🚀 How It Works

This app allows users to manage their tasks, projects, areas, notes, and tags in an organized way. Users can create tasks, projects, areas (to group projects), notes, and tags. Each task can be associated with a project, and both tasks and notes can be tagged for better organization. Projects can belong to areas and can also have multiple notes and tags. This structure helps users categorize and track their work efficiently, whether they’re managing individual tasks, larger projects, or keeping detailed notes.


## ✨ Features

- **Task Management**: Create, update, and delete tasks. Mark tasks as completed and view them by different filters (Today, Upcoming, Someday). Order them by Name, Due Date, Date Created, or Priority.
- **Recurring Tasks**: Comprehensive recurring task system with intelligent parent-child relationships:
  - **Multiple Recurrence Patterns**: Daily, weekly, monthly, monthly on specific weekdays, and monthly last day
  - **Completion-Based Recurrence**: Option to repeat based on completion date rather than due date
  - **Smart Parent-Child Linking**: Generated task instances maintain connection to their original recurring pattern
  - **Direct Parent Editing**: Edit recurrence settings directly from any generated task instance
  - **Flexible Scheduling**: Set custom intervals (every 2 weeks, every 3 months, etc.)
  - **End Date Control**: Optional end dates for recurring series
- **Quick Notes**: Create, update, delete, or assign text notes to projects.
- **Tags**: Create tags for tasks and notes to enhance organization.
- **Project Tracking**: Organize tasks into projects. Each project can contain multiple tasks and/or multiple notes.
- **Area Categorization**: Group projects into areas for better organization and focus.
- **Due Date Tracking**: Set due dates for tasks and view them based on due date categories.
- **Responsive Design**: Accessible from various devices, ensuring a consistent experience across desktops, tablets, and mobile phones.
- **Multi-Language Support**: Available in multiple languages including English, German (de), Greek (el), Spanish (es), Japanese (jp), and Ukrainian (ua) among others.
- **Telegram Integration**:
  - Create tasks directly through Telegram messages
  - Receive daily digests of your tasks
  - Quick capture of ideas and todos on the go

## 🔄 Recurring Tasks

Tududi features a sophisticated recurring task system designed to handle complex scheduling needs while maintaining an intuitive user experience.

### Recurrence Patterns

- **Daily**: Repeat every N days
- **Weekly**: Repeat every N weeks, optionally on specific weekdays
- **Monthly**: Repeat every N months on a specific date
- **Monthly Weekday**: Repeat on the Nth occurrence of a weekday (e.g., "2nd Tuesday of every month")
- **Monthly Last Day**: Repeat on the last day of every month

### Smart Parent-Child Relationships

When a recurring task generates new instances:
- Each generated task maintains a link to its parent recurring task
- Generated tasks display as "Recurring Task Instance" with inherited settings
- Users can edit the parent's recurrence pattern directly from any child task
- Changes to parent settings affect all future instances in the series

### Completion-Based Recurrence

Choose between two recurrence behaviors:
- **Due Date Based** (default): Next task scheduled based on original due date
- **Completion Based**: Next task scheduled based on when the task is actually completed

This is particularly useful for tasks like "Weekly grocery shopping" where you want the next instance to appear a week after you complete it, regardless of when it was originally due.

### Example Use Cases

- **Daily Habits**: "Take vitamins" (daily)
- **Weekly Routines**: "Grocery shopping" (every Sunday, completion-based)
- **Monthly Bills**: "Pay rent" (1st of every month)
- **Quarterly Reviews**: "Team performance review" (1st Monday of every 3 months)
- **Maintenance Tasks**: "Change air filter" (every 3 months, completion-based)

## 🗺️ Roadmap

Check out our [GitHub Project](https://github.com/users/chrisvel/projects/2) for planned features and progress.

## 🛠️ Getting Started

### Quick Start with Docker

**One simple command**, that's all it takes to run tududi with Docker.

First pull the latest image:

```bash
docker pull chrisvel/tududi:latest
```

### ⚙️ Environment Variables

The following environment variables are used to configure tududi:

#### Required Variables:
- `TUDUDI_USER_EMAIL` - Initial admin user's email address (e.g., `admin@example.com`)
- `TUDUDI_USER_PASSWORD` - Initial admin user's password (use a strong password!)
- `TUDUDI_SESSION_SECRET` - Session encryption key (generate with `openssl rand -hex 64`)

#### Optional Variables:
- `TUDUDI_INTERNAL_SSL_ENABLED` - Set to 'true' if using HTTPS internally (default: false)
- `TUDUDI_ALLOWED_ORIGINS` - Controls CORS access for different deployment scenarios:
  - Not set: Only allows localhost origins
  - Specific domains: `https://tududi.com,http://localhost:3002`
  - Allow all (development only): Set to empty string `""`

#### Common Configuration Examples:

##### Local Development
```bash
export TUDUDI_USER_EMAIL=dev@local.test
export TUDUDI_USER_PASSWORD=devpassword123
export TUDUDI_SESSION_SECRET=$(openssl rand -hex 64)
export TUDUDI_INTERNAL_SSL_ENABLED=false
# TUDUDI_ALLOWED_ORIGINS not set - defaults to localhost only
```

##### Production with Reverse Proxy
```bash
export TUDUDI_USER_EMAIL=admin@yourdomain.com
export TUDUDI_USER_PASSWORD=your-secure-password-here
export TUDUDI_SESSION_SECRET=$(openssl rand -hex 64)
export TUDUDI_INTERNAL_SSL_ENABLED=true
export TUDUDI_ALLOWED_ORIGINS=https://tududi.yourdomain.com
```

### 🚀 Running with Docker

```bash
docker run \
  -e TUDUDI_USER_EMAIL=myemail@example.com \
  -e TUDUDI_USER_PASSWORD=mysecurepassword \
  -e TUDUDI_SESSION_SECRET=$(openssl rand -hex 64) \
  -e TUDUDI_INTERNAL_SSL_ENABLED=false \
  -e TUDUDI_ALLOWED_ORIGINS=https://tududi,http://tududi:3002 \
  -v ~/tududi_db:/app/backend/db \
  -p 3002:3002 \
  -d chrisvel/tududi:latest
```

Navigate to [http://localhost:3002](http://localhost:3002) and login with your credentials.

### 🔑 Authentication

The application uses session-based authentication with secure cookies. For development:
- Frontend runs on port 8080 with webpack dev server
- Backend runs on port 3001 and handles authentication
- CORS is configured to allow cross-origin requests during development
- In production (Docker), both frontend and backend run on the same port (3002)

## 🚧 Development

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (version 20 or higher)
- Express.js
- SQLite3
- npm
- ReactJS

### 🏗 Installation

To install `tududi`, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/chrisvel/tududi.git
   ```
2. Navigate to the project directory:
   ```bash
   cd tududi
   ```
3. Install the required dependencies:
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

### 🔒 SSL Setup (Optional)

For HTTPS support, create SSL certificates:

1. Create and enter the directory:
   ```bash
   mkdir backend/certs
   cd backend/certs
   ```
2. Create the key and cert:
   ```bash
   openssl genrsa -out server.key 2048
   openssl req -new -x509 -key server.key -out server.crt -days 365
   cd ../..
   ```

### 📂 Database Setup

The database will be automatically initialized when you start the Express backend. For manual database operations:

```bash
cd backend

# Initialize database (creates tables, drops existing data)
npm run db:init

# Sync database (creates tables if they don't exist)
npm run db:sync

# Migrate database (alters existing tables to match models)
npm run db:migrate

# Reset database (drops and recreates all tables)
npm run db:reset

# Check database status and connection
npm run db:status

cd ..
```

### 🔄 Database Migrations

For schema changes, use Sequelize migrations (similar to Rails/Ruby migrations):

```bash
cd backend

# Create a new migration
npm run migration:create add-description-to-tasks

# Run pending migrations
npm run migration:run

# Check migration status
npm run migration:status

# Rollback last migration
npm run migration:undo

# Rollback all migrations
npm run migration:undo:all

cd ..
```

#### Creating a New Migration Example:
```bash
# 1. Create the migration file
npm run migration:create add-priority-to-projects

# 2. Edit the generated file in migrations/ folder:
# - Add your schema changes in the 'up' function
# - Add rollback logic in the 'down' function

# 3. Run the migration
npm run migration:run
```

### 👤 User Setup

#### For Development

Set environment variables to automatically create the initial user:

```bash
export TUDUDI_USER_EMAIL=dev@example.com
export TUDUDI_USER_PASSWORD=password123
export TUDUDI_SESSION_SECRET=$(openssl rand -hex 64)
```

Or create a user manually:
```bash
cd backend
npm run user:create dev@example.com password123
cd ..
```

#### Default Development Credentials

If no environment variables are set, you can use the default development credentials:
- Email: `dev@example.com`  
- Password: `password123`

### 🚀 Usage

To start the application for development:

1. **Start the Express backend** (in one terminal):
   ```bash
   cd backend
   npm run dev    # Development mode with auto-reload
   # Or: npm start  # Production mode
   ```
   The backend will run on `http://localhost:3001`

2. **Start the frontend development server** (in another terminal):
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:8080`

3. **Access the application**: Open your browser to `http://localhost:8080`

### Port Configuration

- **Development Frontend**: `http://localhost:8080` (webpack dev server)
- **Development Backend**: `http://localhost:3001` (Express API server)
- **Docker/Production**: `http://localhost:3002` (combined frontend + backend)

The webpack dev server automatically proxies API calls and locales to the backend server.

### 🔍 Testing 

To run tests:

```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd ..
npm test
```

#### Test Coverage

The application includes comprehensive test coverage for:
- **Backend API endpoints** (tasks, projects, areas, notes, tags, auth)
- **Database models and migrations**
- **Recurring task service and date calculations**
- **Frontend components and utilities**
- **Authentication and session management**

**Note**: Comprehensive test coverage for the new recurring tasks functionality is planned and will include:
- Recurring task generation algorithms
- Parent-child relationship management
- Date calculation edge cases
- Frontend recurring task components
- Integration tests for complete recurring task workflows

The application has been fully migrated from Ruby/Sinatra to a functional programming Express.js implementation.

## 🤝 Contributing

Contributions to `tududi` are welcome. To contribute:

1. Fork the repository.
2. Create a new branch (\`git checkout -b feature/AmazingFeature\`).
3. Make your changes.
4. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`).
5. Push to the branch (\`git push origin fexature/AmazingFeature\`).
6. Open a pull request.

## 📜 License

This project is licensed for free personal use, with consent required for commercial use. Refer to the LICENSE for further details.

## 📬 Contact

For questions or comments, please [open an issue](https://github.com/chrisvel/tududi/issues) or contact the developer directly.

Join the tududi community:

[![Discord](https://img.shields.io/discord/1234567890?color=7289da&label=Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/sd3jhSQKYA)  
[![Reddit](https://img.shields.io/reddit/subreddit-subscribers/tududi?color=ff4500&label=Reddit&logo=reddit&logoColor=white&style=for-the-badge)](https://www.reddit.com/r/tududi/)

## 🌟 Please check my other projects!

- **[Reconya](https://reconya.com)** - Network reconnaissance and asset discovery tool
- **[BreachHarbor](https://breachharbor.com)** - Cybersecurity suite for digital asset protection  
- **[Hevetra](https://hevetra.com)** - Digital tracking for child health milestones

---

README created by [Chris Veleris](https://github.com/chrisvel) for `tududi`.
