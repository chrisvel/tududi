# 📝 tududi

`tududi` is the self-hosted task management tool that puts you in control. Organize your life and projects with a clear, hierarchical structure,
smart recurring tasks, and seamless Telegram integration. Get focused, stay productive, and keep your data private.

![Light Mode Screenshot](screenshots/all-light.png)

More screenshots are [available here](#screenshots).

## 🚀 How It Works

This app allows users to manage their tasks, projects, areas, notes, and tags in an organized way. Users can create tasks, projects, areas (to group projects), notes, and tags. Each task can be associated with a project, and both tasks and notes can be tagged for better organization. Projects can belong to areas and can also have multiple notes and tags. This structure helps users categorize and track their work efficiently, whether they’re managing individual tasks, larger projects, or keeping detailed notes.

## 🧠 Philosophy

For the thinking behind tududi, read:

- [Designing a Life Management System That Doesn't Fight Back](https://medium.com/@chrisveleris/designing-a-life-management-system-that-doesnt-fight-back-2fd58773e857)
- [From Task to Table: How I Finally Got to the Korean Burger](https://medium.com/@chrisveleris/from-task-to-table-how-i-finally-got-to-the-korean-burger-01245a14d491)

## ✨ Features

- **Task Management**: Create, update, and delete tasks. Mark tasks as completed and view them by different filters (Today, Upcoming, Someday). Order them by Name, Due Date, Date Created, or Priority.
- **Subtasks**: Break down complex tasks into smaller, manageable subtasks with progress tracking and seamless navigation.
- **Recurring Tasks**: Comprehensive recurring task system with intelligent parent-child relationships:
  - **Multiple Recurrence Patterns**: Daily, weekly, monthly, monthly on specific weekdays, and monthly last day
  - **Completion-Based Recurrence**: Option to repeat based on completion date rather than due date
  - **Smart Parent-Child Linking**: Generated task instances maintain connection to their original recurring pattern
  - **Direct Parent Editing**: Edit recurrence settings directly from any generated task instance
  - **Flexible Scheduling**: Set custom intervals (every 2 weeks, every 3 months, etc.)
  - **End Date Control**: Optional end dates for recurring series
- **Project Sharing & Collaboration**: Share projects with team members and collaborate effectively
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

Get up and running quickly with our comprehensive documentation:

### Quick Start

```bash
docker pull chrisvel/tududi:latest

docker run \
  -e TUDUDI_USER_EMAIL=admin@example.com \
  -e TUDUDI_USER_PASSWORD=your-secure-password \
  -e TUDUDI_SESSION_SECRET=$(openssl rand -hex 64) \
  -v ~/tududi_db:/app/backend/db \
  -v ~/tududi_uploads:/app/backend/uploads \
  -p 3002:3002 \
  -d chrisvel/tududi:latest
```

Navigate to [http://localhost:3002](http://localhost:3002) and login with your credentials.

### 📚 Documentation

For detailed setup instructions, configuration options, and getting started guides, visit:

**[docs.tududi.com](https://docs.tududi.com)**

- **[Installation Guide](https://docs.tududi.com/getting-started/installation)** - Docker, development setup, and deployment
- **[Configuration](https://docs.tududi.com/getting-started/configuration)** - Environment variables and advanced settings
- **[First Steps](https://docs.tududi.com/first-steps)** - Learn the basics and get productive
- **[Project Sharing](https://docs.tududi.com/features/project-sharing)** - Collaborate with your team

## 🚧 Development

Want to contribute or run Tududi from source? Check out our comprehensive development guide:

**[Development Setup Guide](https://docs.tududi.com/#-development-setup)**

Quick overview:

```bash
# Clone and install
git clone https://github.com/chrisvel/tududi.git
cd tududi
npm install

# Start development servers
npm run backend:dev   # Terminal 1 - Backend on :3001
npm run frontend:dev  # Terminal 2 - Frontend on :8080
```

For database management, testing, and detailed development instructions, see [docs.tududi.com](https://docs.tududi.com)

## 🤝 Contributing

Contributions to Tududi are welcome! Whether it's bug fixes, new features, documentation improvements, or translations, we appreciate your help.

**Quick Start:**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Make your changes
4. Run tests (`npm run backend:test && npm run frontend:test`)
5. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
6. Push to your fork (`git push origin feature/AmazingFeature`)
7. Open a Pull Request

For detailed contribution guidelines, development setup, and coding standards, see [docs.tududi.com/contributing](https://docs.tududi.com/contributing)

## 📜 License

This project is licensed under the [MIT License](LICENSE).

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
