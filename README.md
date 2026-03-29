````markdown
# 🐛 DebugSphere — AI-Powered Cloud Code Execution & Debugging Platform

> Write, run, and debug code in the cloud with automatic AI-powered error analysis.
> Supports Python, Java, C++, and JavaScript — all inside secure Docker containers.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green?logo=mongodb)](https://mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-required-blue?logo=docker)](https://docker.com)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA%20NIM-GPT--OSS%20120B-76b900?logo=nvidia)](https://build.nvidia.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [AI Debugging Flow](#-ai-debugging-flow)
- [Smart Input Detection](#-smart-input-detection)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start-local-development)
- [Environment Variables](#-environment-variables)
- [npm Scripts](#-npm-scripts)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Production Deployment](#-production-deployment)
- [Docker Compose](#-docker-composeyml)
- [Testing the AI Feature](#-testing-the-ai-feature)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

**DebugSphere** is a production-ready cloud code execution platform similar to
HackerRank or Replit — but with a built-in AI debugging assistant powered by
**NVIDIA NIM (GPT-OSS 120B)**.

When your code fails, DebugSphere automatically:
1. Detects the error and exit code
2. Sends the code + error to NVIDIA's AI API
3. Streams back an explanation and a concrete fix suggestion
4. Displays it instantly in the UI alongside your output

No more googling stack traces. Just write, run, and let AI guide the fix.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🚀 **Multi-language Execution** | Python 3.11, Java 17, C++ GCC 12, Node.js 18 |
| 🤖 **AI Auto-Debugging** | Automatic error analysis on every failed run |
| 🔄 **Manual Re-analysis** | Re-trigger AI analysis on any past execution |
| 💡 **Smart Input Detection** | Detects input(), Scanner, cin, readline and prompts before running |
| 💾 **Code Snippets** | Save, load, and manage named snippets |
| 📊 **Execution History** | Paginated history with runtime stats |
| 📈 **Dashboard Stats** | Total runs, success rate, language breakdown |
| ⚡ **Async Queue** | BullMQ job queue — execution never blocks the API |
| 🔒 **Secure Sandbox** | Docker containers with strict resource and network limits |
| 🛡️ **Rate Limiting** | Per-user limits on execution and AI calls |
| 🔐 **JWT Auth** | Secure signup, login, protected routes |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND  (React + Vite)                     │
│  Vercel / Netlify  (PaaS)                                       │
│                                                                 │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  ┌───────┐  │
│  │  Login   │  │ Dashboard │  │     Editor       │  │History│  │
│  │  Signup  │  │   Stats   │  │  Monaco Editor   │  │  +    │  │
│  └──────────┘  └───────────┘  │  InputModal      │  │ Stats │  │
│                                │  OutputConsole   │  └───────┘  │
│                                │  AIDebugPanel    │             │
│                                └──────────────────┘             │
└────────────────────────────────┬────────────────────────────────┘
                                 │  HTTPS / REST API
┌────────────────────────────────▼────────────────────────────────┐
│                    API SERVICE  (Express.js)                    │
│  AWS EC2 / Render / Railway  (IaaS)                             │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │    Auth    │  │  Code CRUD   │  │  Execution Routes    │    │
│  │    JWT     │  │  Save / Load │  │  POST /executions    │    │
│  └────────────┘  └──────────────┘  │  GET  /executions/:id│    │
│                                    │  POST /:id/debug  🤖  │    │
│  Helmet · CORS · Rate Limiter      └──────────┬───────────┘    │
│  Input Sanitizer · Error Handler              │ BullMQ          │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
┌───────────────────────────────────────────────▼─────────────────┐
│                    WORKER SERVICE  (BullMQ)                     │
│  Separate process — horizontally scalable                       │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Docker Manager                          │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐  │  │
│  │  │  Python  │  │   Java   │  │  C++   │  │JavaScript │  │  │
│  │  │Container │  │Container │  │  Cont. │  │ Container │  │  │
│  │  └──────────┘  └──────────┘  └────────┘  └───────────┘  │  │
│  │                                                           │  │
│  │  • 256 MB RAM cap      • 50% CPU quota                   │  │
│  │  • PID limit: 64       • No network access               │  │
│  │  • 10s execution timeout  • Non-root user                │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │  exitCode != 0 and not timedOut │
│  ┌────────────────────────────▼──────────────────────────────┐  │
│  │                   AI Debug Service  🤖                    │  │
│  │                                                           │  │
│  │   NVIDIA NIM API  →  openai/gpt-oss-120b                  │  │
│  │   • Streaming SSE response                                │  │
│  │   • reasoning_content  (chain-of-thought)                 │  │
│  │   • Returns: { explanation, suggestion }                  │  │
│  │   • Stored in Execution.aiDebug  (MongoDB)                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                         │                    │
   ┌──────▼──────┐          ┌───────▼───────┐   ┌───────▼────────┐
   │   MongoDB   │          │     Redis     │   │  NVIDIA NIM    │
   │   Atlas     │          │   (BullMQ)    │   │  AI API        │
   │   (DBaaS)   │          │   (Queue)     │   │  (AIaaS)       │
   └─────────────┘          └───────────────┘   └────────────────┘
```

### Cloud Service Mapping

| Concept | Implementation |
|---|---|
| **IaaS** | AWS EC2 / Render — backend and worker |
| **PaaS** | Vercel / Netlify — React frontend |
| **DBaaS** | MongoDB Atlas — users, snippets, executions |
| **AIaaS** | NVIDIA NIM — openai/gpt-oss-120b AI debugging |
| **Queue** | Redis + BullMQ — async job processing |
| **Security** | JWT, Helmet, rate limiting, Docker sandbox |

### Auto-Scaling Design

```
                        Load Balancer
                       ┌──────┴──────┐
                API-1     API-2     API-N        ← horizontal scale
                       └──────┬──────┘
                           Redis Queue
                       ┌──────┴──────┐
               Worker-1   Worker-2   Worker-N    ← scale on queue depth
                       └──────┬──────┘
                          NVIDIA NIM
                      (per-failure AI call)
```

Workers are completely stateless. Scale horizontally by running more
node worker.js instances. Queue depth can trigger AWS Auto Scaling
Groups or Kubernetes HPA automatically.

---

## 🤖 AI Debugging Flow

```
User submits code  →  Docker container runs it
                               │
              ┌────────────────▼────────────────┐
              │         exitCode === 0 ?         │
              └────────────────┬────────────────┘
                   YES         │        NO
                   │           │        │
             status:           │    status: "failed"
          "completed"          │        │
                               │        ▼
                               │    aiService.analyzeError()
                               │    called automatically in worker
                               │        │
                               │        ▼
                               │    POST integrate.api.nvidia.com
                               │    model: openai/gpt-oss-120b
                               │    body:  { language, code, stderr }
                               │        │
                               │        ▼
                               │    SSE stream accumulated:
                               │    reasoning_content  →  thinking
                               │    content            →  JSON answer
                               │        │
                               │        ▼
                               │    Execution.aiDebug saved:
                               │    {
                               │      triggered:   true,
                               │      explanation: "...",
                               │      suggestion:  "...",
                               │      model:       "openai/gpt-oss-120b",
                               │      tokensUsed:  387,
                               │      analyzedAt:  Date
                               │    }
                               └────────┘
                                        │
                                Frontend polls → picks up aiDebug
                                        │
                                AIDebugPanel renders:
                                🐛 What went wrong   →  explanation
                                💡 Suggested fix     →  code blocks
                                🔄 Re-analyze        →  manual retry
```

Manual Re-analysis: Users can click Re-analyze to trigger a fresh
AI call on any past failed execution via POST /api/executions/:id/debug.
This endpoint is rate-limited to 5 calls per 15 minutes per user.

---

## 💡 Smart Input Detection

DebugSphere detects stdin read calls in your code before execution
and prompts you to provide input values — preventing EOFError and
similar runtime failures caused by empty stdin.

```
User clicks Run
        │
        ▼
detectInputCalls(code, language)
        │
        ├── 0 detected ──────────────────────→ execute immediately
        │
        └── 1+ detected AND stdin is empty
                │
                ▼
        ┌───────────────────────────────┐
        │   Program Input Required      │
        │                               │
        │  Your code calls input()      │
        │  2 times                      │
        │                               │
        │  1  [ Alice          ]  🗑     │
        │  2  [ 25             ]  🗑     │
        │  + Add another input line     │
        │                               │
        │  stdin preview:               │
        │  Alice                        │
        │  25                           │
        │                               │
        │  [ Cancel ]   [ ▶ Run Code ]  │
        └───────────────────────────────┘
                │
                └── lines joined with \n → stdin → execution
```

### Detection patterns per language

| Language | Detected patterns |
|---|---|
| **Python** | `input()` |
| **Java** | `scanner.next*()`, `bufferedReader.readLine()` |
| **C++** | `cin >>`, `getline()` |
| **JavaScript** | `rl.question()`, `process.stdin`, `.on('line')` |

---

## 📁 Project Structure

```
DebugSphere/
├── docker-compose.yml                  # MongoDB + Redis services
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js                       # Express API entry point
│   ├── worker.js                       # BullMQ worker + AI trigger
│   └── src/
│       ├── config/
│       │   ├── database.js             # MongoDB connection with retry
│       │   └── redis.js                # Redis connection
│       ├── controllers/
│       │   ├── authController.js       # register, login, me
│       │   ├── codeController.js       # snippet CRUD
│       │   └── executionController.js  # execute, poll, history,
│       │                               # stats, analyzeWithAI
│       ├── middleware/
│       │   ├── auth.js                 # JWT verification
│       │   ├── errorHandler.js         # global error handler
│       │   └── rateLimiter.js          # api, execution, auth,
│       │                               # aiDebug limiters
│       ├── models/
│       │   ├── User.js
│       │   ├── CodeSnippet.js
│       │   └── Execution.js            # includes aiDebug sub-schema
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── codeRoutes.js
│       │   └── executionRoutes.js      # includes POST /:id/debug
│       ├── services/
│       │   ├── aiService.js            # NVIDIA NIM integration
│       │   ├── dockerManager.js        # Docker execution engine
│       │   └── queueService.js         # BullMQ queue producer
│       └── utils/
│           └── sanitizer.js
│
├── docker/
│   ├── python/Dockerfile
│   ├── java/Dockerfile
│   ├── cpp/Dockerfile
│   └── javascript/Dockerfile
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── components/
        │   ├── AIDebugPanel.jsx         # AI results UI
        │   ├── CodeEditor.jsx           # Monaco editor wrapper
        │   ├── InputModal.jsx           # Smart stdin prompt
        │   ├── LanguageSelector.jsx
        │   ├── Navbar.jsx               # DebugSphere branding
        │   ├── OutputConsole.jsx        # includes AIDebugPanel
        │   ├── ProtectedRoute.jsx
        │   └── StatsCard.jsx
        ├── context/
        │   └── AuthContext.jsx
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── Editor.jsx               # input detection + AI state
        │   ├── History.jsx
        │   ├── Login.jsx
        │   └── Signup.jsx
        └── services/
            └── api.js                   # includes analyzeWithAI()
```

---

## 🔧 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | >= 18 | Backend and frontend tooling |
| **Docker Desktop** | Latest | Container execution + MongoDB/Redis |
| **MongoDB** | 7.0 | User data, snippets, execution logs |
| **Redis** | 7.2 | BullMQ job queue |
| **NVIDIA NIM API Key** | — | AI debugging — free key at https://build.nvidia.com |

---

## 🚀 Quick Start (Local Development)

### Step 1 — Clone the repository

```bash
git clone https://github.com/yourname/debugsphere.git
cd debugsphere
```

### Step 2 — Start infrastructure

```bash
# Starts MongoDB on :27017 and Redis on :6379
docker compose up -d mongodb redis

# Verify both are running
docker ps
```

### Step 3 — Build language executor images

```bash
docker build -t debugsphere-python     ./docker/python
docker build -t debugsphere-java       ./docker/java
docker build -t debugsphere-cpp        ./docker/cpp
docker build -t debugsphere-javascript ./docker/javascript
```

### Step 4 — Configure backend

```bash
cd backend
npm install
# Create backend/.env — see Environment Variables section below
```

### Step 5 — Start backend services

```bash
# Option A — start API and worker together (recommended)
npm run dev:all

# Option B — start separately in two terminals
npm run dev          # Terminal 1: API server on :5000
npm run worker:dev   # Terminal 2: BullMQ worker
```

Wait for both of these lines before continuing:

```
✅  API server running on port 5000
🔄  Worker listening for jobs …
```

### Step 6 — Start frontend

```bash
cd frontend
npm install
npm run dev
# Opens on http://localhost:5173
```

### Step 7 — Open the app

```
http://localhost:5173
```

Sign up for an account and start coding!

---

## 🌍 Environment Variables

### backend/.env

```bash
# ════════════════════════════════════════════════════════════
# DebugSphere — Backend Environment Variables
# Copy this to backend/.env and fill in your values
# Never commit .env to version control
# ════════════════════════════════════════════════════════════

# ── Server ───────────────────────────────────────────────────
PORT=5000
FRONTEND_URL=http://localhost:5173

# ── MongoDB ──────────────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/debugsphere

# ── Redis ────────────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=          # uncomment if Redis requires auth

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_long_random_string_in_production
JWT_EXPIRES_IN=7d

# ── Docker Execution Engine ───────────────────────────────────
EXECUTION_TIMEOUT=10000        # ms — max run time per container
DOCKER_MEMORY_LIMIT=268435456  # bytes — 256 MB per container
DOCKER_CPU_QUOTA=50000         # 50% CPU per 100ms period
HOST_TEMP_DIR=C:/tmp/debugsphere   # Windows path
# HOST_TEMP_DIR=/tmp/debugsphere   # Linux / Mac path

# ── NVIDIA NIM AI ─────────────────────────────────────────────
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
AI_MODEL=openai/gpt-oss-120b

# ── AI Generation Parameters ──────────────────────────────────
AI_TEMPERATURE=1
AI_TOP_P=1
AI_MAX_TOKENS=4096

# ── AI Streaming Timeouts ─────────────────────────────────────
AI_FIRST_CHUNK_TIMEOUT=60000   # 60s wait for first token
AI_IDLE_TIMEOUT=30000          # 30s max gap between chunks

# ── Feature Flag ──────────────────────────────────────────────
AI_ENABLED=true                # set to "false" to disable AI globally
```

### frontend/.env

```bash
# ════════════════════════════════════════════════════════════
# DebugSphere — Frontend Environment Variables
# All vars must be prefixed with VITE_ to reach the browser
# Never put secrets here — this bundle ships to the browser
# ════════════════════════════════════════════════════════════

# Development
VITE_API_URL=http://localhost:5000/api

# Production — replace with your deployed backend URL
# VITE_API_URL=https://api.debugsphere.com/api
```

---

## 📦 npm Scripts

### Backend (`cd backend`)

```bash
npm run dev          # API server with nodemon (auto-restart on changes)
npm run start        # API server production mode (no nodemon)
npm run worker       # BullMQ worker production mode
npm run worker:dev   # BullMQ worker with nodemon
npm run dev:all      # API + worker together via concurrently
```

### Frontend (`cd frontend`)

```bash
npm run dev          # Vite dev server with HMR on :5173
npm run build        # Production build output to dist/
npm run preview      # Preview production build locally
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create a new account |
| POST | /api/auth/login | No | Sign in and receive JWT token |
| GET | /api/auth/me | Yes | Get current user profile |

### Executions

| Method | Endpoint | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | /api/executions | Yes | 10 / min | Submit code for execution |
| GET | /api/executions/:id | Yes | 200 / 15min | Poll execution status and result |
| GET | /api/executions/history | Yes | 200 / 15min | Paginated execution history |
| GET | /api/executions/stats | Yes | 200 / 15min | Aggregate statistics |
| POST | /api/executions/:id/debug | Yes | 5 / 15min / user | Manual AI re-analysis |

### Code Snippets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/code/save | Yes | Save a new code snippet |
| GET | /api/code/snippets | Yes | List all snippets for current user |
| GET | /api/code/snippets/:id | Yes | Get a single snippet by ID |
| PUT | /api/code/snippets/:id | Yes | Update an existing snippet |
| DELETE | /api/code/snippets/:id | Yes | Delete a snippet |

### Example — Submit and poll an execution

```bash
# Step 1 — Submit code for execution
curl -X POST http://localhost:5000/api/executions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "x = 10\nprint(y)",
    "input": ""
  }'

# Response
# {
#   "success": true,
#   "data": {
#     "executionId": "abc123",
#     "status": "queued",
#     "warnings": []
#   }
# }

# Step 2 — Poll until status is completed, failed, or timeout
curl http://localhost:5000/api/executions/abc123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response when failed with AI debug included
# {
#   "success": true,
#   "data": {
#     "status": "failed",
#     "output": "",
#     "error": "NameError: name 'y' is not defined on line 2",
#     "runtime": 312,
#     "exitCode": 1,
#     "aiDebug": {
#       "triggered": true,
#       "explanation": "Variable y was used on line 2 but was never defined.",
#       "suggestion": "Replace print(y) with print(x) since x is defined above.",
#       "model": "openai/gpt-oss-120b",
#       "tokensUsed": 284,
#       "analyzedAt": "2026-03-29T14:22:01.000Z",
#       "aiError": ""
#     }
#   }
# }
```

---

## 🔒 Security

### Authentication and Authorization

- JWT tokens are signed with `JWT_SECRET` and expire after `JWT_EXPIRES_IN`
- All execution and snippet endpoints require a valid Bearer token
- Users can only access their own executions and snippets
- Token checked on every request via auth middleware

### Rate Limiting

| Limiter | Limit | Scope | Endpoint |
|---|---|---|---|
| executionLimiter | 10 requests / 1 min | per IP | POST /api/executions |
| aiDebugLimiter | 5 requests / 15 min | per user ID | POST /api/executions/:id/debug |
| apiLimiter | 200 requests / 15 min | per IP | all other endpoints |
| authLimiter | 20 requests / 15 min | per IP | /api/auth/* |

### Docker Sandbox

Every code execution runs in a freshly created isolated Docker container:

```
Memory limit     256 MB hard cap       prevents memory bombs
CPU quota        50 percent            prevents CPU starvation
PID limit        64 max processes      prevents fork bombs
Network          completely disabled   no internet from containers
Privileges       no-new-privileges     prevents escalation
User             non-root UID 1000     sandboxed execution
Timeout          10 seconds max        container force-killed
Cleanup          AutoRemove true       no leftover containers
Temp files       deleted after run     no disk accumulation
```

### HTTP Security

- **Helmet.js** sets CSP, HSTS, X-Frame-Options, and other secure headers
- **CORS** configured with explicit origin allowlist and `credentials: true`
- **Input sanitization** strips dangerous patterns before code reaches Docker
- **Error handler** never leaks stack traces to the client in production

---

## ☁️ Production Deployment

### Frontend → Vercel (recommended)

```bash
cd frontend
npm run build
npx vercel --prod

# Set in Vercel dashboard under Environment Variables:
# VITE_API_URL = https://api.yourdomain.com/api
```

### Backend API → Render

```
1. Connect your GitHub repository to https://render.com
2. Create a new Web Service with these settings:
   Root directory:  backend
   Build command:   npm install
   Start command:   node server.js
3. Add all variables from backend/.env in the Environment tab
```

### Worker → Render Background Worker

```
1. Create a new Background Worker on Render with these settings:
   Root directory:  backend
   Build command:   npm install
   Start command:   node worker.js
2. Use the same environment variables as the API service above
```

### Database → MongoDB Atlas

```
1. Create a free M0 cluster at https://cloud.mongodb.com
2. Add your server IP to the IP Access List
3. Create a database user with read/write permissions
4. Copy the connection string and set:
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/debugsphere
```

### Queue → Redis Cloud

```
1. Create a free Redis instance at https://redis.io/try-free
2. Copy the connection details and set in backend/.env:
   REDIS_HOST=your-redis-hostname
   REDIS_PORT=your-redis-port
   REDIS_PASSWORD=your-redis-password
```

### AI → NVIDIA NIM

```
1. Sign up and get a free API key at https://build.nvidia.com
2. Set in backend/.env:
   NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
   AI_MODEL=openai/gpt-oss-120b
```

---

## 🐳 docker-compose.yml

```yaml
version: "3.8"

services:

  # ── MongoDB ────────────────────────────────────────────────
  mongodb:
    image: mongo:7.0
    container_name: debugsphere-mongo
    restart: unless-stopped
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: debugsphere
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis ──────────────────────────────────────────────────
  redis:
    image: redis:7.2-alpine
    container_name: debugsphere-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo_data:
  redis_data:
```

---

## 🧪 Testing the AI Feature

### Setup

```bash
# Terminal 1 — infrastructure
docker compose up -d
docker ps   # confirm mongo + redis are running

# Terminal 2 — backend API + worker
cd backend
npm run dev:all

# Terminal 3 — frontend
cd frontend
npm run dev
```

### Manual test steps

```bash
# 1. Open http://localhost:5173 and create an account

# 2. In the Editor, select Python and write broken code:
x = 10
print(y)      # y is not defined — will cause NameError

# 3. Click the Run button

# 4. Watch Terminal 2 (worker) for AI logs:
# ⚙️  Processing job 58 | execution 69c926...
# 🤖  Triggering AI analysis for execution 69c926...
# 📡  → POST https://integrate.api.nvidia.com/v1/chat/completions
# 📡  → Model: openai/gpt-oss-120b
# 📡  ← HTTP Status: 200
# 📡  ← First chunk received — streaming...
# ✅  AI analysis complete in 4.2s — 387 tokens

# 5. In the browser, the AIDebugPanel appears automatically below the error:
# 🐛 What went wrong:  "Variable y was used without being defined..."
# 💡 Suggested fix:    "Change print(y) to print(x)..."
# 🔄 Re-analyze button available for a fresh analysis
```

### Test smart input detection

```bash
# Write Python code that reads input:
name = input("Enter your name: ")
print(f"Hello, {name}!")

# Click Run without filling the stdin textarea
# The InputModal appears automatically:
# "Your code calls input() 1 time"
# [ Enter your name here ]
# [ Cancel ]  [ Run Code ]
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

3. Make your changes and commit

```bash
git commit -m "feat: add your feature description"
```

4. Push to your fork

```bash
git push origin feature/your-feature-name
```

5. Open a Pull Request against the `main` branch

### Commit message convention

```
feat:     new feature
fix:      bug fix
docs:     documentation changes
style:    formatting only
refactor: code restructure without feature change
test:     adding tests
chore:    build process or tooling changes
```

---

## 📄 License

MIT © 2026 DebugSphere

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the
Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

---

<div align="center">

**DebugSphere** — Write code. Break things. Let AI fix it.

Built with ❤️ using Node.js · React · Docker · MongoDB · NVIDIA NIM

**[⬆ Back to top](#-debugsphere--ai-powered-cloud-code-execution--debugging-platform)**

</div>
````
