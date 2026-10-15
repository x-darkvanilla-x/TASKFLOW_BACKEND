# Follow Up - Backend API

A robust, enterprise-grade RESTful API built with **NestJS**, **TypeScript**, and **MongoDB (Mongoose)**. This service powers authentication, task lifecycle management, team member assignments, statistics generation, and data filtering for the Follow Up System.

---

## 🛠️ Tech Stack & Core Libraries

- **Framework:** [NestJS v11](https://nestjs.com/) (TypeScript)
- **Database:** [MongoDB](https://www.mongodb.com/) with [Mongoose v9](https://mongoosejs.com/) ODM
- **Authentication:** [JSON Web Tokens (JWT)](https://jwt.io/) (`@nestjs/jwt`), Passwords hashed with `bcryptjs`
- **Validation & Transformation:** `class-validator`, `class-transformer`
- **Configuration:** `@nestjs/config` for environment variables
- **Testing:** [Jest](https://jestjs.io/) & [SuperTest](https://github.com/ladjs/supertest)

---

## ✨ Features

- 🔐 **Authentication System:**
  - Standard User Registration & Login with hashed passwords.
  - Instant One-Click **Guest Login** generating temporary isolated user sessions.
  - Guard-protected endpoints utilizing JWT Bearer tokens.
- 📋 **Comprehensive Task Management:**
  - Full CRUD capabilities for tasks (Create, Read, Update, Delete).
  - Nested **Subtasks** management with due dates, priorities, and assignees.
  - **Resource links** attachment (links/URLs per task).
  - Support for tags, avatar colors, assignees, due dates, priority levels, and statuses (`todo`, `in-progress`, `done`, `doing`, `completed`, `on-hold`).
- 🔍 **Filtering & Search:**
  - Query parameters for status, priority, and full-text keyword search across titles and descriptions.
- 📊 **Task Analytics & Statistics:**
  - Aggregated counts per status (`todo`, `in-progress`, `completed`, total tasks).
- 👥 **Team Members Management:**
  - Create and fetch user-scoped workspace team members.
- 🛡️ **Robust Architecture & Global Interceptors:**
  - Global `ValidationPipe` for automatic payload validation and whitelist enforcement.
  - Global `HttpExceptionFilter` producing consistent error structures.
  - Global `ResponseInterceptor` wrapping responses in a standardized JSON payload structure.

---

## 📁 Architecture & File Structure

```text
backend/
├── src/
│   ├── auth/                      # Authentication logic & JWT strategy
│   │   ├── dto/                   # Auth Request DTOs (login, register, guest)
│   │   ├── auth.controller.ts     # Auth endpoints (/api/auth)
│   │   ├── auth.guard.ts          # JwtAuthGuard protecting routes
│   │   ├── auth.module.ts         # NestJS Auth module definition
│   │   └── auth.service.ts        # Auth logic, JWT sign, bcrypt hashing
│   ├── tasks/                     # Task management domain
│   │   ├── dto/                   # Task DTOs (create, update, filter)
│   │   ├── task.schema.ts         # Mongoose Task schema & Enums
│   │   ├── tasks.controller.ts    # Task endpoints (/api/tasks)
│   │   ├── tasks.module.ts        # Task module imports & providers
│   │   └── tasks.service.ts       # Database queries, filters, CRUD logic
│   ├── members/                   # Team members domain
│   │   ├── dto/                   # Member DTOs
│   │   ├── member.schema.ts       # Mongoose Member schema
│   │   ├── members.controller.ts  # Member endpoints (/api/members)
│   │   ├── members.module.ts      # Member module
│   │   └── members.service.ts     # Member persistence logic
│   ├── users/                     # User domain & schema
│   │   └── user.schema.ts         # Mongoose User schema (Email, Password, Name, isGuest)
│   ├── common/                    # Shared global utilities
│   │   ├── http-exception.filter.ts # Global Exception Filter
│   │   └── response.interceptor.ts  # Global Response Normalizer
│   ├── app.module.ts              # Root Application Module
│   └── main.ts                    # Bootstrap entry point (CORS, Pipes, Filters)
├── test/                          # End-to-end (e2e) tests
├── .env                           # Environment variables configuration
├── nest-cli.json                  # Nest CLI configuration
├── package.json                   # Dependencies and scripts
└── tsconfig.json                  # TypeScript compiler settings
```

---

## 💾 Database Schemas

### 1. Task Schema (`Task`)
| Field | Type | Description | Default / Constraints |
|---|---|---|---|
| `title` | `String` | Task title | Required, Max 200 chars |
| `description` | `String` | Detailed task description | Max 1000 chars |
| `status` | `Enum` | `todo`, `doing`, `in-progress`, `completed`, `done`, `on-hold` | Default: `todo` |
| `priority` | `Enum` | `low`, `medium`, `high` | Default: `medium` |
| `dueDate` | `String` | Target completion date | Optional |
| `assignee` | `String` | Assigned team member name | Optional |
| `avatarColor` | `String` | Visual color code for assignee avatar | Optional |
| `tags` | `[String]` | Array of categories/labels | Default: `[]` |
| `subtasks` | `[Subtask]` | Array of nested subtasks (`id`, `title`, `priority`, `assignee`, `dueDate`) | Default: `[]` |
| `resources` | `[Resource]`| Array of attached link objects (`id`, `title`, `url`) | Default: `[]` |
| `userId` | `String` | ID of owning user | Required, Indexed |

### 2. User Schema (`User`)
| Field | Type | Description |
|---|---|---|
| `name` | `String` | User display name |
| `email` | `String` | Unique user email (Optional for guests) |
| `password` | `String` | Hashed password using bcrypt |
| `isGuest` | `Boolean` | Flag indicating guest session |

---

## ⚙️ Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
# MongoDB Connection String (Local MongoDB or MongoDB Atlas)
MONGODB_URI=mongodb://localhost:27017/taskmanager

# Secret key used for signing JWT tokens
JWT_SECRET=taskmanager-super-secret-key-2024

# Port for NestJS server
PORT=3001
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: Active local MongoDB service running on `mongodb://localhost:27017` OR a MongoDB Atlas cluster URI.

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Configure Environment
```bash
cp .env.example .env # Or create .env directly using the guide above
```

### Step 3: Run Development Server
```bash
npm run start:dev
```
The NestJS server will start in watch mode at **`http://localhost:3001`** (API Base URL: `http://localhost:3001/api`).

---

## 📜 Available NPM Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Launches the API in watch/development mode |
| `npm run build` | Compiles TypeScript code into production JS in `/dist` |
| `npm run start:prod` | Runs the compiled production build from `/dist/main` |
| `npm run test` | Executes unit tests with Jest |
| `npm run test:e2e` | Runs end-to-end integration tests |
| `npm run test:cov` | Generates test coverage report |
| `npm run lint` | Runs ESLint and automatically fixes code style issues |
| `npm run format` | Formats code files using Prettier |

---

## 📡 API Reference & Documentation

All response payloads follow the standardized structure returned by `ResponseInterceptor`:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Auth Endpoints (`/api/auth`)

#### 1. One-Click Guest Login
- **Endpoint:** `POST /api/auth/guest`
- **Body:**
  ```json
  {
    "name": "Guest Explorer"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1Ni...",
      "user": {
        "id": "67a9...",
        "name": "Guest Explorer",
        "isGuest": true
      }
    }
  }
  ```

#### 2. User Registration
- **Endpoint:** `POST /api/auth/register` (or `/api/auth/signup`)
- **Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```

#### 3. User Login
- **Endpoint:** `POST /api/auth/login`
- **Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```

---

### Task Endpoints (`/api/tasks`)
*Requires Header: `Authorization: Bearer <token>`*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tasks` | Get all user tasks (supports filters) |
| `GET` | `/api/tasks/stats` | Get count aggregations by task status |
| `GET` | `/api/tasks/:id` | Get details of a single task by ID |
| `POST` | `/api/tasks` | Create a new task |
| `PATCH` | `/api/tasks/:id` | Update an existing task |
| `DELETE` | `/api/tasks/:id` | Delete a task |

#### Query Parameters for GET `/api/tasks`:
- `status`: Filter by status (`todo`, `in-progress`, `done`, `doing`, `completed`, `on-hold`)
- `priority`: Filter by priority (`low`, `medium`, `high`)
- `search`: Search keyword matching `title` or `description`

#### Example Payload - Create / Update Task (`POST /api/tasks`):
```json
{
  "title": "Design System Implementation",
  "description": "Create reusable UI components and color tokens",
  "status": "in-progress",
  "priority": "high",
  "dueDate": "2026-08-15",
  "assignee": "Alex Rivera",
  "avatarColor": "#3B82F6",
  "tags": ["Frontend", "Design"],
  "subtasks": [
    {
      "id": "sub-1",
      "title": "Button component",
      "priority": "high",
      "assignee": "Alex Rivera",
      "dueDate": "2026-08-12"
    }
  ],
  "resources": [
    {
      "id": "res-1",
      "title": "Figma Specs",
      "url": "https://figma.com/file/sample"
    }
  ]
}
```

---

### Team Members Endpoints (`/api/members`)
*Requires Header: `Authorization: Bearer <token>`*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/members` | List all team members for current user workspace |
| `POST` | `/api/members` | Add a new team member |

---

## 🛡️ Error Handling

Errors return standard HTTP status codes along with a structured JSON body produced by `HttpExceptionFilter`:

```json
{
  "success": false,
  "statusCode": 400,
  "message": ["title should not be empty", "priority must be a valid enum value"],
  "error": "Bad Request",
  "timestamp": "2026-08-10T21:21:28.000Z"
}
```
