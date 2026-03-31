# 🐛 DebugSphere — AI-Powered Cloud Code Execution & Debugging Platform

> Write, run, and debug code in the cloud with automatic AI-powered error analysis.
> Supports Python, Java, C++, and JavaScript — all inside secure isolated containers.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)](https://mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash-red?logo=redis)](https://upstash.com)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA%20NIM-GPT--OSS%20120B-76b900?logo=nvidia)](https://build.nvidia.com)
[![Deployed](https://img.shields.io/badge/Deployed-Render-purple?logo=render)](https://render.com)
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
- [Quick Start — Local Development](#-quick-start--local-development)
- [Environment Variables](#-environment-variables)
- [npm Scripts](#-npm-scripts)
- [API Reference](#-api-reference)
- [Security](#-security)
- [Production Deployment](#-production-deployment-render)
- [Docker Compose](#-docker-composeyml--local-dev)
- [Testing the AI Feature](#-testing-the-ai-feature)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌐 Overview

**DebugSphere** is a production-ready cloud code execution platform similar to
HackerRank or Replit — but with a built-in AI debugging assistant powered by
**NVIDIA NIM (openai/gpt-oss-120b)**.

When your code fails, DebugSphere automatically:
1. Detects the error and exit code from the isolated execution
2. Sends the code + stderr to NVIDIA's AI API via streaming SSE
3. Streams back a chain-of-thought explanation and concrete fix suggestion
4. Stores the result in MongoDB and displays it instantly in the UI

No more googling stack traces. Just write, run, and let AI guide the fix.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🚀 **Multi-language Execution** | Python 3, Java 17, C++ GCC, Node.js 18 |
| 🤖 **AI Auto-Debugging** | Automatic error analysis on every failed run via NVIDIA NIM |
| 🔄 **Manual Re-analysis** | Re-trigger AI on any past failed execution |
| 💡 **Smart Input Detection** | Detects `input()`, `Scanner`, `cin`, `readline` — prompts before running |
| 💾 **Code Snippets** | Save, load, and manage named snippets |
| 📊 **Execution History** | Paginated history with runtime stats |
| 📈 **Dashboard Stats** | Total runs, success rate, language breakdown |
| ⚡ **Async Queue** | BullMQ job queue — execution never blocks the API |
| 🔒 **Isolated Execution** | Child process sandbox with timeout, output cap, env sanitization |
| 🛡️ **Rate Limiting** | Per-user limits on execution and AI calls |
| 🔐 **JWT Auth** | Secure signup, login, protected routes |
| ☁️ **Cloud Ready** | Deployed on Render free tier — no Docker socket required |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND  (React + Vite)                     │
│  Vercel                                                         │
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
│              API + WORKER SERVICE  (Express + BullMQ)           │
│  Render Free Tier — single Node.js process                      │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │    Auth    │  │  Code CRUD   │  │  Execution Routes    │    │
│  │    JWT     │  │  Save / Load │  │  POST /executions    │    │
│  └────────────┘  └──────────────┘  │  GET  /executions/:id│    │
│                                    │  POST /:id/debug  🤖  │    │
│  trust proxy · Helmet · CORS       └──────────┬───────────┘    │
│  Rate Limiter · Error Handler                 │ BullMQ          │
│                                               │                 │
│  ┌────────────────────────────────────────────▼──────────────┐  │
│  │              BullMQ Worker (same process)                  │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │           isolatedExecutor.js                        │  │  │
│  │  │                                                     │  │  │
│  │  │  child_process.spawn() per execution                │  │  │
│  │  │  ┌──────────┐ ┌──────┐ ┌────────┐ ┌────────────┐   │  │  │
│  │  │  │ python3  │ │ java │ │  g++   │ │   node     │   │  │  │
│  │  │  │ solution │ │ Main │ │solution│ │ solution   │   │  │  │
│  │  │  │  .py     │ │.java │ │  .cpp  │ │    .js     │   │  │  │
│  │  │  └──────────┘ └──────┘ └────────┘ └────────────┘   │  │  │
│  │  │  • 10s timeout      • 1MB output cap               │  │  │
│  │  │  • stdin piped      • env sanitized                │  │  │
│  │  │  • temp dir cleanup • never throws (worker safe)   │  │  │
│  │  └──────────────────────────┬──────────────────────────┘  │  │
│  │                             │ exitCode ≠ 0 && !timedOut    │  │
│  │  ┌──────────────────────────▼──────────────────────────┐  │  │
│  │  │              aiService.js  🤖                        │  │  │
│  │  │  NVIDIA NIM → openai/gpt-oss-120b                    │  │  │
│  │  │  • Streaming SSE via Node.js https module           │  │  │
│  │  │  • reasoning_content (chain-of-thought)             │  │  │
│  │  │  • Returns { explanation, suggestion }              │  │  │
│  │  │  • Stored in Execution.aiDebug (MongoDB)            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                         │                    │
   ┌──────▼──────┐          ┌───────▼───────┐   ┌───────▼────────┐
   │   MongoDB   │          │     Redis     │   │  NVIDIA NIM    │
   │   Atlas     │          │   Upstash     │   │  AI API        │
   │   (DBaaS)   │          │   (Queue)     │   │  (AIaaS)       │
   └─────────────┘          └───────────────┘   └────────────────┘
```

### Cloud Service Mapping

| Concept | Implementation |
|---|---|
| **PaaS** | Render free tier — API + Worker in one Node.js process |
| **Frontend** | Vercel — React + Vite |
| **DBaaS** | MongoDB Atlas — users, snippets, executions |
| **Queue** | Upstash Redis + BullMQ — async job processing |
| **AIaaS** | NVIDIA NIM — `openai/gpt-oss-120b` streaming AI |
| **Runtime JDK** | Downloaded at startup to `/tmp/jdk` via `start.js` |

---

## 🤖 AI Debugging Flow

```
User submits code → isolatedExecutor runs it via child_process
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
                               │    POST integrate.api.nvidia.com
                               │    model: openai/gpt-oss-120b
                               │    stream: true
                               │        │
                               │        ▼
                               │    SSE chunks accumulated:
                               │    reasoning_content → thinking
                               │    content           → JSON answer
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
                                🐛 What went wrong  → explanation
                                💡 Suggested fix    → code blocks
                                🔄 Re-analyze       → manual retry
```

---

## 💡 Smart Input Detection

DebugSphere scans your code for stdin read calls **before** execution.
If found and stdin is empty, it shows a modal to collect input first.
This prevents `EOFError`, `NoSuchElementException`, and similar stdin errors.

```
User clicks Run
        │
        ▼
detectInputCalls(code, language)
        │
        ├── 0 detected ──────────────────→ execute immediately
        │
        └── 1+ detected AND stdin empty
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
                └── lines.join("\n") → stdin → execution
```

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
├── render.yaml                         # Render deployment config
├── README.md
│
├── backend/
│   ├── server.js                       # Express API + starts worker
│   ├── worker.js                       # BullMQ worker (exportable)
│   ├── start.js                        # Render startup — downloads JDK
│   ├── package.json
│   └── src/
│       ├── config/
│       │   ├── database.js             # MongoDB with retry logic
│       │   └── redis.js                # Upstash / local Redis
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── codeController.js
│       │   └── executionController.js  # + analyzeWithAI()
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── errorHandler.js
│       │   └── rateLimiter.js          # + aiDebugLimiter
│       ├── models/
│       │   ├── User.js
│       │   ├── CodeSnippet.js
│       │   └── Execution.js            # + aiDebug sub-schema
│       ├── routes/
│       │   ├── authRoutes.js
│       │   ├── codeRoutes.js
│       │   └── executionRoutes.js      # + POST /:id/debug
│       └── services/
│           ├── aiService.js            # NVIDIA NIM SSE streaming
│           ├── isolatedExecutor.js     # child_process execution engine
│           └── queueService.js         # BullMQ producer
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── components/
        │   ├── AIDebugPanel.jsx         # AI results + code blocks
        │   ├── CodeEditor.jsx           # Monaco editor (h-full fix)
        │   ├── InputModal.jsx           # Smart stdin prompt
        │   ├── LanguageSelector.jsx
        │   ├── Navbar.jsx               # DebugSphere branding
        │   ├── OutputConsole.jsx        # Output + AI panel integrated
        │   ├── ProtectedRoute.jsx
        │   └── StatsCard.jsx
        ├── context/
        │   └── AuthContext.jsx
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── Editor.jsx               # Full height layout fix
        │   ├── History.jsx
        │   ├── Login.jsx
        │   └── Signup.jsx
        └── services/
            └── api.js
```

---

## 🔧 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | >= 20 | Backend runtime |
| **Docker Desktop** | Latest | Local MongoDB + Redis |
| **MongoDB Atlas** | Free M0 | Cloud database |
| **Upstash Redis** | Free | Cloud queue (no card needed) |
| **NVIDIA NIM API Key** | — | AI debugging — [get free key](https://build.nvidia.com) |

> **Java, Python, G++** are installed automatically at runtime by `start.js`
> when deployed on Render. For local dev, install them manually.

---

## 🚀 Quick Start — Local Development

### Step 1 — Clone

```bash
git clone https://github.com/yourname/debugsphere.git
cd debugsphere
```

### Step 2 — Start local infrastructure

```bash
docker compose up -d
docker ps   # confirm mongo + redis running
```

### Step 3 — Backend setup

```bash
cd backend
npm install
# Create backend/.env — see Environment Variables section
```

### Step 4 — Start backend

```bash
# Start API server + worker together
npm run dev:all

# OR separately:
npm run dev          # Terminal 1 — API server :5000
npm run worker:dev   # Terminal 2 — BullMQ worker
```

Wait for:
```
✅  API server running on port 5000
📦  MongoDB connected
🔄  Worker listening for jobs …
```

### Step 5 — Start frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

---

## 🌍 Environment Variables

### `backend/.env`

```bash
# ══════════════════════════════════════════════════════════
# DebugSphere — Backend Environment Variables
# ══════════════════════════════════════════════════════════

# ── Server ──────────────────────────────────────────────
PORT=5000
FRONTEND_URL=http://localhost:5173

# ── MongoDB Atlas ────────────────────────────────────────
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/debugsphere

# ── Redis — Upstash (use REDIS_URL for cloud) ────────────
REDIS_URL=rediss://default:TOKEN@host.upstash.io:6379

# ── JWT ──────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d

# ── Execution Engine (isolatedExecutor) ──────────────────
EXECUTION_TIMEOUT=10000          # ms
HOST_TEMP_DIR=/tmp/debugsphere   # Linux/Render
# HOST_TEMP_DIR=C:/tmp/debugsphere  # Windows local dev

# ── NVIDIA NIM AI ────────────────────────────────────────
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
AI_MODEL=openai/gpt-oss-120b

# ── AI Generation ────────────────────────────────────────
AI_TEMPERATURE=1
AI_TOP_P=1
AI_MAX_TOKENS=4096

# ── AI Streaming Timeouts ────────────────────────────────
AI_FIRST_CHUNK_TIMEOUT=60000     # 60s wait for first token
AI_IDLE_TIMEOUT=30000            # 30s max gap between chunks

# ── Feature Flag ─────────────────────────────────────────
AI_ENABLED=true
```

### `frontend/.env`

```bash
# Development
VITE_API_URL=http://localhost:5000/api

# Production
# VITE_API_URL=https://debugsphere-api.onrender.com/api
```

---

## 📦 npm Scripts

### Backend

```bash
npm run start        # node start.js  (Render — downloads JDK then starts)
npm run dev          # nodemon server.js  (local API only)
npm run worker:dev   # nodemon worker.js  (local worker only)
npm run dev:all      # API + worker via concurrently
```

### Frontend

```bash
npm run dev          # Vite dev server :5173
npm run build        # Production build → dist/
npm run preview      # Preview production build
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Sign in, receive JWT |
| GET | /api/auth/me | Yes | Current user profile |

### Executions

| Method | Endpoint | Auth | Rate Limit | Description |
|---|---|---|---|---|
| POST | /api/executions | Yes | 10/min | Submit code |
| GET | /api/executions/:id | Yes | 200/15min | Poll result + aiDebug |
| GET | /api/executions/history | Yes | 200/15min | Paginated history |
| GET | /api/executions/stats | Yes | 200/15min | Aggregate stats |
| POST | /api/executions/:id/debug | Yes | 5/15min/user | Manual AI re-analysis |

### Code Snippets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/code/save | Yes | Save snippet |
| GET | /api/code/snippets | Yes | List snippets |
| GET | /api/code/snippets/:id | Yes | Get snippet |
| PUT | /api/code/snippets/:id | Yes | Update snippet |
| DELETE | /api/code/snippets/:id | Yes | Delete snippet |

### Example — Poll response with AI debug

```json
{
  "success": true,
  "data": {
    "status": "failed",
    "output": "",
    "error": "NameError: name 'y' is not defined on line 2",
    "runtime": 312,
    "exitCode": 1,
    "aiDebug": {
      "triggered": true,
      "explanation": "Variable y was used on line 2 but was never defined.",
      "suggestion": "Replace print(y) with print(x) since x is defined above.",
      "model": "openai/gpt-oss-120b",
      "tokensUsed": 284,
      "analyzedAt": "2026-03-31T14:22:01.000Z",
      "aiError": ""
    }
  }
}
```

---

## 🔒 Security

### Authentication
- JWT tokens signed with `JWT_SECRET`, expire after `JWT_EXPIRES_IN`
- All execution and snippet routes require valid Bearer token
- Users can only access their own data

### Rate Limiting

| Limiter | Limit | Scope |
|---|---|---|
| `executionLimiter` | 10 / min | per IP |
| `aiDebugLimiter` | 5 / 15 min | per user ID |
| `apiLimiter` | 200 / 15 min | per IP |
| `authLimiter` | 20 / 15 min | per IP |

### Isolated Execution (isolatedExecutor.js)

```
Timeout:       10s hard kill via SIGKILL
Output cap:    1MB stdout + 1MB stderr
Stdin:         piped then closed (EOF signalled)
Environment:   sanitized — no server secrets exposed
Temp dir:      UUID per execution, deleted in finally{}
Error handling: all spawn errors resolve() — worker never crashes
```

### HTTP Security
- `app.set("trust proxy", 1)` — correct IP behind Render load balancer
- **Helmet.js** — CSP, HSTS, X-Frame-Options headers
- **CORS** — explicit origin allowlist with credentials
- **Input sanitization** — dangerous patterns stripped before execution

---

## ☁️ Production Deployment (Render)

### Services Required

```
1. Render Web Service     → API + Worker (single process)
2. MongoDB Atlas          → Free M0 cluster (no card)
3. Upstash Redis          → Free Redis (no card)
4. Vercel                 → Frontend (no card)
5. NVIDIA NIM             → AI API key (no card)
```

### render.yaml

```yaml
services:
  - type: web
    name: debugsphere-api
    runtime: node
    rootDir: backend
    buildCommand: npm install
    startCommand: node start.js server
    plan: free
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: FRONTEND_URL
        sync: false
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: EXECUTION_TIMEOUT
        value: 10000
      - key: HOST_TEMP_DIR
        value: /tmp/debugsphere
      - key: NVIDIA_API_KEY
        sync: false
      - key: AI_MODEL
        value: openai/gpt-oss-120b
      - key: AI_TEMPERATURE
        value: 1
      - key: AI_TOP_P
        value: 1
      - key: AI_MAX_TOKENS
        value: 4096
      - key: AI_FIRST_CHUNK_TIMEOUT
        value: 60000
      - key: AI_IDLE_TIMEOUT
        value: 30000
      - key: AI_ENABLED
        value: true
```

### How `start.js` Works

```
node start.js
      │
      ▼
Check if javac in PATH
      │
      ├── YES → configure JAVA_HOME → start server.js
      │
      └── NO → download Adoptium Temurin 17 to /tmp/jdk (~185MB)
               extract tar.gz → set JAVA_HOME=/tmp/jdk
               set PATH=/tmp/jdk/bin:$PATH
               verify javac works
                    │
                    ▼
               node server.js
                    │
              ┌─────┴──────┐
         Express API   BullMQ Worker
         port 10000    (same process)
```

### Step-by-step Deploy

```bash
# 1. Push to GitHub
git push origin main

# 2. Render Dashboard → New → Blueprint → connect repo
#    Render reads render.yaml automatically

# 3. Set secret env vars in Render dashboard:
#    MONGODB_URI, REDIS_URL, JWT_SECRET, NVIDIA_API_KEY, FRONTEND_URL

# 4. Deploy — first boot takes ~2min (JDK download)
#    Subsequent boots use cached /tmp/jdk if still warm

# 5. Update frontend env:
#    VITE_API_URL=https://debugsphere-api.onrender.com/api

# 6. Deploy frontend to Vercel:
cd frontend && npx vercel --prod
```

### Expected Startup Logs

```
[start.js] ════════════════════════════════════════════
[start.js]   DebugSphere startup
[start.js]   Node: v20.x.x
[start.js] ════════════════════════════════════════════
[start.js] ☕  Java not found — downloading portable JDK...
[start.js]   25% (46MB / 185MB)
[start.js]   50% (92MB / 185MB)
[start.js]   75% (138MB / 185MB)
[start.js]   100% (185MB / 185MB)
[start.js] Extraction complete
[start.js] ✅  javac: javac 17.0.11
[start.js] ── Runtime ────────────────────────────────
[start.js]   ✅  node:    v20.x.x
[start.js]   ✅  python3: Python 3.10.12
[start.js]   ✅  javac:   javac 17.0.11
[start.js]   ✅  java:    openjdk version "17.0.11"
[start.js]   ✅  g++:     g++ (Ubuntu 11.4.0)
[start.js] ────────────────────────────────────────────
[start.js] Starting: node server.js
📦  MongoDB connected
✅  API server running on port 10000
🔴  Redis connected
✅  Redis ready
🔄  Worker listening for jobs …
```

---

## 🐳 docker-compose.yml — Local Dev

```yaml
version: "3.8"

services:

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

```bash
# 1. Start everything
docker compose up -d
cd backend && npm run dev:all
cd frontend && npm run dev

# 2. Open http://localhost:5173 — sign up

# 3. Write broken Python:
x = 10
print(y)       # y not defined

# 4. Click Run

# 5. Worker logs:
# ⚙️  Processing job 1 | execution abc123
# ▶️   Running python | abc12345 | 10000ms
# 🤖  Triggering AI analysis for execution abc123
# 📡  → POST https://integrate.api.nvidia.com/v1/chat/completions
# 📡  ← HTTP Status: 200
# 📡  ← First chunk received — streaming…
# ✅  AI analysis complete in 4.2s — 387 tokens
# ✅  Job 1 finished in 4532ms

# 6. UI shows AIDebugPanel automatically:
# 🐛 What went wrong:  "Variable y was used without being defined..."
# 💡 Suggested fix:    "Change print(y) to print(x)..."
# 🔄 Re-analyze button for fresh analysis

# 7. Test smart input detection:
# Write: name = input("Enter name: ")
# Click Run without filling stdin
# → InputModal appears asking for input
```

---

## 🔑 Key Technical Decisions

| Decision | Reason |
|---|---|
| **isolatedExecutor instead of Docker** | Render free tier has read-only filesystem — no apt-get, no Docker socket |
| **JDK downloaded at runtime** | Build environment ≠ runtime environment on Render free tier |
| **Worker merged into server.js** | Render free tier allows only one service per web instance |
| **Upstash Redis** | Free Redis with TLS — no credit card required |
| **SSE streaming for AI** | Reduces time-to-first-token perception — shows thinking in logs |
| **resolve() not reject() in spawn errors** | Prevents unhandled error events from crashing the merged worker |
| **trust proxy: 1** | Render sits behind load balancer — required for rate limiting to work |
| **h-full on CodeEditor** | Monaco requires real pixel height — flex-1 alone gives 0px |

---

## 🤝 Contributing

```bash
# 1. Fork the repo
# 2. Create feature branch
git checkout -b feature/your-feature

# 3. Commit
git commit -m "feat: your feature description"

# 4. Push and open PR
git push origin feature/your-feature
```

---

## 📄 License

MIT © 2026 DebugSphere

---

<div align="center">

**DebugSphere** — Write code. Break things. Let AI fix it.

Built with Node.js · React · MongoDB · Redis · NVIDIA NIM · Render

**[⬆ Back to top](#-debugsphere--ai-powered-cloud-code-execution--debugging-platform)**

</div>