# 📝 tududi

`tududi` is the self-hosted task management tool that puts you in control. Organize your life and projects with a clear, hierarchical structure,
smart recurring tasks, and seamless Telegram integration. Get focused, stay productive, and keep your data private.

![Light Mode Screenshot](screenshots/all-light.png)

More screenshots [here](#screenshots).

## 🚀 How It Works

This app allows users to manage their tasks, projects, areas, notes, and tags in an organized way. Users can create tasks, projects, areas (to group projects), notes, and tags. Each task can be associated with a project, and both tasks and notes can be tagged for better organization. Projects can belong to areas and can also have multiple notes and tags. This structure helps users categorize and track their work efficiently, whether they’re managing individual tasks, larger projects, or keeping detailed notes.

## 🧠 Philosophy

For the thinking behind tududi, read:
- [Designing a Life Management System That Doesn't Fight Back](https://medium.com/@chrisveleris/designing-a-life-management-system-that-doesnt-fight-back-2fd58773e857)
- [From Task to Table: How I Finally Got to the Korean Burger](https://medium.com/@chrisveleris/from-task-to-table-how-i-finally-got-to-the-korean-burger-01245a14d491)

## ✨ Features

- **Task Management**: Create, update, and delete tasks. Mark tasks as completed and view them by different filters (Today, Upcoming, Someday). Order them by Name, Due Date, Date Created, or Priority.
- **Recurring Tasks**: tududi features a sophisticated recurring task system designed to handle complex scheduling needs while maintaining an intuitive user experience
- **Quick Notes**: Create, update, delete, or assign text notes to projects.
- **Tags**: Create tags for tasks and notes to enhance organization.
- **Project Tracking**: Organize tasks into projects. Each project can contain multiple tasks and/or multiple notes.
- **Area Categorization**: Group projects into areas for better organization and focus.
- **Due Date Tracking**: Set due dates for tasks and view them based on due date categories.
- **Responsive Design**: Accessible from various devices, ensuring a consistent experience across desktops, tablets, and mobile phones.
- **Multi-Language Support**: Available in 24 languages with full localization support for a truly global productivity experience.
- **Telegram Integration**:
  - Create tasks directly through Telegram messages
  - Receive daily digests of your tasks
  - Quick capture of ideas and todos on the go

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
- `PUID`, `GUID` - Run with specified user and group ID (instead of defaults 1001/1001)
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
# TUDUDI_ALLOWED_ORIGINS not set - defaults to localhost only
```

##### Production with Reverse Proxy
```bash
export TUDUDI_USER_EMAIL=admin@yourdomain.com
export TUDUDI_USER_PASSWORD=your-secure-password-here
export TUDUDI_SESSION_SECRET=$(openssl rand -hex 64)
export TUDUDI_ALLOWED_ORIGINS=https://tududi.yourdomain.com
```

### 🚀 Running with Docker

```bash
docker run \
  -e TUDUDI_USER_EMAIL=myemail@example.com \
  -e TUDUDI_USER_PASSWORD=mysecurepassword \
  -e TUDUDI_SESSION_SECRET=$(openssl rand -hex 64) \
  -e TUDUDI_ALLOWED_ORIGINS=https://tududi,http://tududi:3002 \
  -e PUID=1001 \
  -e GUID=1001 \
  -v ~/tududi_db:/app/backend/db \
  -v ~/tududi_uploads:/app/backend/uploads \
  -p 3002:3002 \
  -d chrisvel/tududi:latest
```

Navigate to [http://localhost:3002](http://localhost:3002) and login with your credentials.

## 📱 Telegram Integration Setup

tududi includes built-in Telegram integration that allows you to create tasks directly from Telegram messages. This feature is optional and can be configured after installation.

### 🤖 Creating a Telegram Bot

1. **Start a chat with @BotFather** on Telegram
2. **Create a new bot**:
   ```
   /newbot
   ```
3. **Choose a name** for your bot (e.g., "My tududi Bot")
4. **Choose a username** for your bot (must end with "bot", e.g., "mytududi_bot")
5. **Save the bot token** - BotFather will provide a token like `123456789:ABCdefGHIjklMNOpqrSTUvwxyz`

### ⚙️ Configuring Telegram Integration

#### Method: Through the Web Interface (Recommended)

1. **Login to tududi** and go to Settings
2. **Navigate to the Telegram tab**
3. **Paste your bot token** from BotFather
4. **Click "Setup Telegram"** - this will:
   - Validate your bot token
   - Display your bot's username
   - Provide a direct link to start chatting with your bot
5. **Start chatting** with your bot by clicking the provided link or searching for your bot in Telegram
6. **Send your first message** to your bot - it will automatically appear in your tududi inbox!

### 🔄 How It Works

1. **Message Collection**: tududi polls your bot every 30 seconds for new messages
2. **Automatic Inbox Creation**: Every message sent to your bot creates a new item in your tududi inbox
3. **Duplicate Prevention**: The same message won't create multiple inbox items
4. **Processing**: You can then process inbox items into tasks, projects, or notes

### 📊 Telegram Settings Overview

In the Telegram settings tab, you can:

- **Bot Setup**: Configure your bot token and view connection status
- **Polling Control**: Start/stop message polling manually
- **Bot Information**: View bot username and connection status
- **Test Integration**: Send a test message to verify connectivity
- **Task Summaries**: Enable/disable daily task summary notifications

### 🔧 Troubleshooting

**Bot not receiving messages:**
- Verify your bot token is correct
- Ensure you've started a conversation with your bot in Telegram
- Check that polling is active in the Telegram settings
- Verify your server can reach Telegram's API (check firewall settings)

**Messages not appearing in inbox:**
- Check the polling status in Telegram settings
- Verify your bot token hasn't expired
- Ensure your account is properly connected to the bot

**Bot setup failing:**
- Double-check your bot token format (should be like `123456789:ABCdefGHIjklMNOpqrSTUvwxyz`)
- Verify your bot is active and not deleted
- Check your internet connection

### 🔒 Security Considerations

- **Bot tokens are stored securely** in your local database
- **Only you can send messages** to your bot (private by default)
- **No data is shared** with third parties - everything runs on your self-hosted instance
- **Tokens are encrypted** in transit and at rest

### 🚫 Disabling Telegram Integration

To completely disable Telegram integration:

1. **Via Interface**: Simply don't configure a bot token in the settings
2. **Remove Bot Token**: Delete your bot token from the Telegram settings to stop all integration

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
   # Install all dependencies (frontend and backend)
   npm install
   ```

### 📂 Database Setup

The database will be automatically initialized when you start the Express backend. For manual database operations:

```bash
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
```

### 🔄 Database Migrations

For schema changes, use Sequelize migrations (similar to Rails/Ruby migrations):

```bash
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
npm run user:create dev@example.com password123
```

#### Default Development Credentials

If no environment variables are set, you can use the default development credentials:
- Email: `dev@example.com`  
- Password: `password123`

### 🚀 Usage

To start the application for development:

1. **Start the Express backend** (in one terminal):
   ```bash
   npm run backend:dev    # Development mode with auto-reload
   # Or: npm run backend:start  # Production mode
   ```
   The backend will run on `http://localhost:3001`

2. **Start the frontend development server** (in another terminal):
   ```bash
   npm run frontend:dev
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
npm run backend:test

# Frontend tests  
npm run frontend:test
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

[![Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da?logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/fkbeJ9CmcH)  
[![Reddit](https://img.shields.io/reddit/subreddit-subscribers/tududi?color=ff4500&label=Reddit&logo=reddit&logoColor=white&style=for-the-badge)](https://www.reddit.com/r/tududi/)

## 🌟 Please check my other projects!

- **[Reconya](https://reconya.com)** - Network reconnaissance and asset discovery tool
- **[BreachHarbor](https://breachharbor.com)** - Cybersecurity suite for digital asset protection  
- **[Hevetra](https://hevetra.com)** - Digital tracking for child health milestones

# Screenshots

![Light Mode Screenshot](screenshots/all-light.png)

![Dark Mode Screenshot](screenshots/all-dark.png)

![Light Mobile Screenshot](screenshots/mobile-all-light.png)

![Dark Mobile Screenshot](screenshots/mobile-all-dark.png)
---

README created by [Chris Veleris](https://github.com/chrisvel) for `tududi`.
