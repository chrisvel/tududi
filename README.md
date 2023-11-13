# tu | du | di

`tu|du|di` is a task and project management web application built with Sinatra. It allows users to efficiently manage their tasks and projects, categorize them into different areas, and track due dates. `tu|du|di` is designed to be intuitive and easy to use, providing a seamless experience for personal productivity.

## Features

- **Task Management**: Create, update, and delete tasks. Mark tasks as completed and view them by different filters (Today, Upcoming, Someday).
- **Project Tracking**: Organize tasks into projects. Each project can contain multiple tasks.
- **Area Categorization**: Group projects into areas for better organization and focus.
- **Due Date Tracking**: Set due dates for tasks and view them based on due date categories.
- **Responsive Design (in progress)**: Accessible from various devices, ensuring a consistent experience across desktops, tablets, and mobile phones.

## Getting Started

### Prerequisites

Before you begin, ensure you have met the following requirements:
- Ruby (version 3.2.2 or higher)
- Sinatra
- SQLite3
- Puma

### Installation

To install `tu|du|di`, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/chrisvel/tu-du-di.git
   ```
2. Navigate to the project directory:
   ```bash
   cd tu-du-di
   ```
3. Install the required gems:
   ```bash
   bundle install
   ```

#### SSL setup

1. Create and enter the directory:
   ```bash
   mkdir certs
   ```

2. Navigate to the certs directory:
   ```bash
   cd certs
   ```

2. Create the key and cert:
   ```bash
   openssl genrsa -out server.key 2048
   openssl req -new -x509 -key server.key -out server.crt -days 365
   ```

### Usage

To start the application, run the following command in your terminal:

```bash
puma -C app/config/puma.rb
```

Open your browser and navigate to `http://localhost:9292` to access the application.

## Contributing

Contributions to `tu|du|di` are welcome. To contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/AmazingFeature`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5. Push to the branch (`git push origin feature/AmazingFeature`).
6. Open a pull request.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

If you have any questions or comments about `tu|du|di`, please feel free to [open an issue](https://github.com/chrisvel/tu-du-di/issues) or contact the developer directly.

---

README created by [Chris Veleris](https://github.com/chrisvel) for `tu|du|di`.
