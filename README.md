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
| 🚀 **Multi-language Execution** | Python 3.11, Java 17, C++ (GCC 12), Node.js 18 |
| 🤖 **AI Auto-Debugging** | Automatic error analysis on every failed run |
| 🔄 **Manual Re-analysis** | Re-trigger AI analysis on any past execution |
| 💡 **Smart Input Detection** | Detects `input()`, `Scanner`, `cin`, `readline` — prompts before running |
| 💾 **Code Snippets** | Save, load, and manage named snippets |
| 📊 **Execution History** | Paginated history with runtime stats |
| 📈 **Dashboard Stats** | Total runs, success rate, language breakdown |
| ⚡ **Async Queue** | BullMQ job queue — execution never blocks the API |
| 🔒 **Secure Sandbox** | Docker containers with strict resource + network limits |
| 🛡️ **Rate Limiting** | Per-user limits on execution and AI calls |
| 🔐 **JWT Auth** | Secure signup, login, protected routes |

---

## 🏗️ Architecture
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + Vite) │
│ Vercel / Netlify (PaaS) │
│ │
│ ┌──────────┐ ┌───────────┐ ┌──────────────────┐ ┌───────┐ │
│ │ Login │ │ Dashboard │ │ Editor │ │History│ │
│ │ Signup │ │ Stats │ │ Monaco Editor │ │ + │ │
│ └──────────┘ └───────────┘ │ InputModal │ │ Stats │ │
│ │ OutputConsole │ └───────┘ │
│ │ AIDebugPanel │ │
│ └──────────────────┘ │
└────────────────────────────────┬────────────────────────────────┘
│ HTTPS / REST API
┌────────────────────────────────▼────────────────────────────────┐
│ API SERVICE (Express.js) │
│ AWS EC2 / Render / Railway (IaaS) │
│ │
│ ┌────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│ │ Auth │ │ Code CRUD │ │ Execution Routes │ │
│ │ JWT │ │ Save / Load │ │ POST /executions │ │
│ └────────────┘ └──────────────┘ │ GET /executions/:id│ │
│ │ POST /:id/debug 🤖 │ │
│ Helmet · CORS · Rate Limiter └──────────┬───────────┘ │
│ Input Sanitizer · Error Handler │ BullMQ │
└───────────────────────────────────────────────┼─────────────────┘
│
┌───────────────────────────────────────────────▼─────────────────┐
│ WORKER SERVICE (BullMQ) │
│ Separate process — horizontally scalable │
│ │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Docker Manager │ │
│ │ │ │
│ │ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐ │ │
│ │ │ Python │ │ Java │ │ C++ │ │JavaScript │ │ │
│ │ │Container │ │Container │ │ Cont. │ │ Container │ │ │
│ │ └──────────┘ └──────────┘ └────────┘ └───────────┘ │ │
│ │ │ │
│ │ • 256 MB RAM cap • 50% CPU quota │ │
│ │ • PID limit: 64 • No network access │ │
│ │ • 10s execution timeout • Non-root user │ │
│ └────────────────────────────┬──────────────────────────────┘ │
│ │ exitCode ≠ 0 && !timedOut │
│ ┌────────────────────────────▼──────────────────────────────┐ │
│ │ AI Debug Service 🤖 │ │
│ │ │ │
│ │ NVIDIA NIM API → openai/gpt-oss-120b │ │
│ │ • Streaming SSE response │ │
│ │ • reasoning_content (chain-of-thought) │ │
│ │ • Returns: { explanation, suggestion } │ │
│ │ • Stored in Execution.aiDebug (MongoDB) │ │
│ └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
│ │ │
┌──────▼──────┐ ┌───────▼───────┐ ┌───────▼────────┐
│ MongoDB │ │ Redis │ │ NVIDIA NIM │
│ Atlas │ │ (BullMQ) │ │ AI API │
│ (DBaaS) │ │ (Queue) │ │ (AIaaS) │
└─────────────┘ └───────────────┘ └────────────────┘

text


### Cloud Service Mapping

| Concept | Implementation |
|---|---|
| **IaaS** | AWS EC2 / Render — backend + worker |
| **PaaS** | Vercel / Netlify — React frontend |
| **DBaaS** | MongoDB Atlas — users, snippets, executions |
| **AIaaS** | NVIDIA NIM — `openai/gpt-oss-120b` AI debugging |
| **Queue** | Redis + BullMQ — async job processing |
| **Security** | JWT, Helmet, rate limiting, Docker sandbox |

### Auto-Scaling Design
text

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
text


Workers are completely stateless. Scale horizontally by running more
`node worker.js` instances. Queue depth can trigger AWS Auto Scaling
Groups or Kubernetes HPA automatically.

---

## 🤖 AI Debugging Flow
User submits code → Docker container runs it
│
┌────────────▼────────────┐
│ exitCode === 0 ? │
└────────────┬────────────┘
YES │ NO
│ │ │
status: │ status: "failed"
"completed" │ │
│ ▼
│ AI Service triggered
│ automatically in worker
│ │
│ ▼
│ POST integrate.api.nvidia.com
│ model: openai/gpt-oss-120b
│ payload: { language, code, stderr }
│ │
│ ▼
│ SSE stream → accumulated
│ reasoning_content (thinking)
│ content (JSON answer)
│ │
│ ▼
│ Execution.aiDebug = {
│ triggered: true,
│ explanation: "...",
│ suggestion: "...",
│ model: "openai/gpt-oss-120b",
│ tokensUsed: 387,
│ analyzedAt: Date
│ }
│ │
└──────┘
│
Frontend polls → picks up aiDebug
│
AIDebugPanel renders:
🐛 What went wrong → explanation
💡 Suggested fix → code blocks
🔄 Re-analyze → manual retry

text


**Manual Re-analysis:** Users can click "Re-analyze" to trigger a fresh
AI call on any past failed execution via `POST /api/executions/:id/debug`.
This endpoint is rate-limited to **5 calls per 15 minutes per user**.

---

## 💡 Smart Input Detection

DebugSphere detects stdin read calls in your code **before** execution
and prompts you to provide input values — preventing `EOFError` and
similar runtime failures caused by empty stdin.
User clicks ▶ Run
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
│ Program Input Required │
│ │
│ Your code calls input() │
│ 2 times │
│ │
│ 1 [ Alice ] 🗑 │
│ 2 [ 25 ] 🗑 │
│ + Add another input line │
│ │
│ stdin preview: │
│ Alice │
│ 25 │
│ │
│ [Cancel] [▶ Run Code] │
└───────────────────────────────┘
│
└── lines joined with \n → stdin → execution

text


### Detection patterns per language

| Language | Detected patterns |
|---|---|
| **Python** | `input()` |
| **Java** | `scanner.next*()`, `bufferedReader.readLine()` |
| **C++** | `cin >>`, `getline()` |
| **JavaScript** | `rl.question()`, `process.stdin`, `.on('line')` |

---

## 📁 Project Structure
DebugSphere/
├── docker-compose.yml # MongoDB + Redis services
├── README.md
│
├── backend/
│ ├── Dockerfile
│ ├── package.json
│ ├── server.js # Express API entry point
│ ├── worker.js # BullMQ worker + AI trigger
│ └── src/
│ ├── config/
│ │ ├── database.js # MongoDB connection with retry
│ │ └── redis.js # Redis connection
│ ├── controllers/
│ │ ├── authController.js # register, login, me
│ │ ├── codeController.js # snippet CRUD
│ │ └── executionController.js # execute, poll, history,
│ │ # stats, analyzeWithAI ← NEW
│ ├── middleware/
│ │ ├── auth.js # JWT verification
│ │ ├── errorHandler.js # global error handler
│ │ └── rateLimiter.js # api, execution, auth,
│ │ # aiDebug limiters ← NEW
│ ├── models/
│ │ ├── User.js
│ │ ├── CodeSnippet.js
│ │ └── Execution.js # + aiDebug sub-schema ← NEW
│ ├── routes/
│ │ ├── authRoutes.js
│ │ ├── codeRoutes.js
│ │ └── executionRoutes.js # + POST /:id/debug ← NEW
│ ├── services/
│ │ ├── aiService.js # NVIDIA NIM integration ← NEW
│ │ ├── dockerManager.js # Docker execution engine
│ │ └── queueService.js # BullMQ queue producer
│ └── utils/
│ └── sanitizer.js
│
├── docker/
│ ├── python/Dockerfile
│ ├── java/Dockerfile
│ ├── cpp/Dockerfile
│ └── javascript/Dockerfile
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
│ ├── AIDebugPanel.jsx # AI results UI ← NEW
│ ├── CodeEditor.jsx # Monaco editor wrapper
│ ├── InputModal.jsx # Smart stdin prompt ← NEW
│ ├── LanguageSelector.jsx
│ ├── Navbar.jsx # DebugSphere branding ← UPDATED
│ ├── OutputConsole.jsx # + AIDebugPanel ← UPDATED
│ ├── ProtectedRoute.jsx
│ └── StatsCard.jsx
├── context/
│ └── AuthContext.jsx
├── pages/
│ ├── Dashboard.jsx
│ ├── Editor.jsx # + input detection + AI ← UPDATED
│ ├── History.jsx
│ ├── Login.jsx
│ └── Signup.jsx
└── services/
└── api.js # + analyzeWithAI() ← UPDATED

text


---

## 🔧 Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 18 | Backend + frontend tooling |
| **Docker Desktop** | Latest | Container execution + MongoDB/Redis |
| **MongoDB** | 7.0 | User data, snippets, execution logs |
| **Redis** | 7.2 | BullMQ job queue |
| **NVIDIA NIM API Key** | — | AI debugging ([get free key](https://build.nvidia.com)) |

---

## 🚀 Quick Start (Local Development)

### Step 1 — Clone the repository

```bash
git clone https://github.com/yourname/debugsphere.git
cd debugsphere
Step 2 — Start infrastructure
Bash

# Starts MongoDB on :27017 and Redis on :6379
docker compose up -d mongodb redis

# Verify both are running:
docker ps
Step 3 — Build language executor images
Bash

docker build -t debugsphere-python     ./docker/python
docker build -t debugsphere-java       ./docker/java
docker build -t debugsphere-cpp        ./docker/cpp
docker build -t debugsphere-javascript ./docker/javascript
Step 4 — Configure backend
Bash

cd backend
npm install

# Create your .env file (see Environment Variables section)
# Minimum required: MONGODB_URI, REDIS_HOST, JWT_SECRET, NVIDIA_API_KEY
Step 5 — Start backend services
Bash

# Option A — start API + worker together (recommended)
npm run dev:all

# Option B — start separately (two terminals)
npm run dev          # Terminal 1: API server on :5000
npm run worker:dev   # Terminal 2: BullMQ worker
Wait for both of these lines before continuing:

text

✅  API server running on port 5000
🔄  Worker listening for jobs …
Step 6 — Start frontend
Bash

# New terminal
cd frontend
npm install
npm run dev          # starts on :5173
Step 7 — Open the app
text

http://localhost:5173
Sign up for an account and start coding!

🌍 Environment Variables
backend/.env
Bash

# ════════════════════════════════════════════════════
# DebugSphere — Backend Environment Variables
# ════════════════════════════════════════════════════

# ── Server ───────────────────────────────────────────
PORT=5000
FRONTEND_URL=http://localhost:5173

# ── MongoDB ──────────────────────────────────────────
MONGODB_URI=mongodb://localhost:27017/debugsphere

# ── Redis ────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=          # uncomment if Redis needs auth

# ── JWT ──────────────────────────────────────────────
JWT_SECRET=change_this_to_a_long_random_string_in_production
JWT_EXPIRES_IN=7d

# ── Docker Execution Engine ───────────────────────────
EXECUTION_TIMEOUT=10000        # ms — max run time per container
DOCKER_MEMORY_LIMIT=268435456  # bytes — 256 MB
DOCKER_CPU_QUOTA=50000         # 50% CPU per 100ms period
HOST_TEMP_DIR=C:/tmp/debugsphere  # Windows
# HOST_TEMP_DIR=/tmp/debugsphere  # Linux / Mac

# ── NVIDIA NIM AI ─────────────────────────────────────
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
AI_MODEL=openai/gpt-oss-120b

# ── AI Generation Parameters ──────────────────────────
AI_TEMPERATURE=1
AI_TOP_P=1
AI_MAX_TOKENS=4096

# ── AI Streaming Timeouts ─────────────────────────────
AI_FIRST_CHUNK_TIMEOUT=60000   # 60s — wait for first token
AI_IDLE_TIMEOUT=30000          # 30s — max gap between chunks

# ── Feature Flag ─────────────────────────────────────
AI_ENABLED=true                # set to "false" to disable AI globally
frontend/.env
Bash

# ════════════════════════════════════════════════════
# DebugSphere — Frontend Environment Variables
# All vars must be prefixed VITE_ to reach the browser
# ════════════════════════════════════════════════════

# Development
VITE_API_URL=http://localhost:5000/api

# Production — replace with your deployed backend URL
# VITE_API_URL=https://api.debugsphere.com/api
📦 npm Scripts
Backend (cd backend)
Bash

npm run dev          # API server with nodemon (auto-restart)
npm run start        # API server production (no nodemon)
npm run worker       # BullMQ worker production
npm run worker:dev   # BullMQ worker with nodemon
npm run dev:all      # API + worker together via concurrently
Frontend (cd frontend)
Bash

npm run dev          # Vite dev server with HMR on :5173
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
📡 API Reference
Authentication
Method	Endpoint	Auth	Description
POST	/api/auth/register	❌	Create a new account
POST	/api/auth/login	❌	Sign in, receive JWT
GET	/api/auth/me	✅	Get current user profile
Executions
Method	Endpoint	Auth	Rate Limit	Description
POST	/api/executions	✅	10/min	Submit code for execution
GET	/api/executions/:id	✅	200/15min	Poll execution status + result
GET	/api/executions/history	✅	200/15min	Paginated execution history
GET	/api/executions/stats	✅	200/15min	Aggregate statistics
POST	/api/executions/:id/debug	✅	5/15min/user	Manual AI re-analysis
Code Snippets
Method	Endpoint	Auth	Description
POST	/api/code/save	✅	Save a new snippet
GET	/api/code/snippets	✅	List all user snippets
GET	/api/code/snippets/:id	✅	Get a single snippet
PUT	/api/code/snippets/:id	✅	Update a snippet
DELETE	/api/code/snippets/:id	✅	Delete a snippet
Example — Submit and poll execution
Bash

# 1. Submit code
curl -X POST http://localhost:5000/api/executions \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(1 + 1)",
    "input": ""
  }'

# Response:
# { "success": true, "data": { "executionId": "abc123", "status": "queued" } }

# 2. Poll until complete
curl http://localhost:5000/api/executions/abc123 \
  -H "Authorization: Bearer YOUR_JWT"

# Response (on failure — includes AI debug):
# {
#   "success": true,
#   "data": {
#     "status": "failed",
#     "output": "",
#     "error": "NameError: name 'x' is not defined",
#     "runtime": 312,
#     "aiDebug": {
#       "triggered": true,
#       "explanation": "You used variable x without defining it first.",
#       "suggestion": "Define x before using it: x = 10",
#       "model": "openai/gpt-oss-120b",
#       "tokensUsed": 284,
#       "analyzedAt": "2026-03-29T14:22:01.000Z"
#     }
#   }
# }
🔒 Security
Authentication & Authorization
JWT tokens — signed with JWT_SECRET, expire after JWT_EXPIRES_IN
All execution and snippet endpoints require a valid Bearer token
Users can only access their own executions and snippets
Rate Limiting
Limiter	Limit	Applies To
executionLimiter	10 requests / 1 min	POST /api/executions
aiDebugLimiter	5 requests / 15 min / user	POST /api/executions/:id/debug
apiLimiter	200 requests / 15 min	All other endpoints
authLimiter	20 requests / 15 min	Auth endpoints
Docker Sandbox
Every code execution runs in a freshly created Docker container with:

text

Memory:        256 MB hard cap      (prevents memory bombs)
CPU:           50% quota            (prevents CPU starvation)
PIDs:          max 64               (prevents fork bombs)
Network:       disabled             (no internet access)
Privileges:    no-new-privileges    (prevents escalation)
User:          non-root (UID 1000)  (sandboxed)
Timeout:       10 seconds           (killed if exceeded)
AutoRemove:    true                 (no leftover containers)
HTTP Security
Helmet.js — sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.)
CORS — explicit origin allowlist, credentials: true
Input sanitization — blocklist for dangerous code patterns before execution
☁️ Production Deployment
Frontend → Vercel (recommended)
Bash

cd frontend
npm run build
npx vercel --prod

# Set environment variable in Vercel dashboard:
# VITE_API_URL = https://api.yourdomain.com/api
Backend API → Render
Connect your GitHub repo to Render
Create a Web Service with:
Build command: npm install
Start command: node server.js
Root directory: backend
Set all environment variables from backend/.env
Worker → Render Background Worker
Create a Background Worker on Render with:
Build command: npm install
Start command: node worker.js
Root directory: backend
Use the same environment variables as the API service
Database → MongoDB Atlas
text

1. Create free M0 cluster at https://cloud.mongodb.com
2. Whitelist your server IPs (or 0.0.0.0/0 for all)
3. Create a database user
4. Set: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/debugsphere
Queue → Redis Cloud
text

1. Create free instance at https://redis.io/try-free
2. Set: REDIS_HOST=your-redis-host
        REDIS_PORT=your-redis-port
        REDIS_PASSWORD=your-redis-password
AI → NVIDIA NIM
text

1. Get free API key at https://build.nvidia.com
2. Set: NVIDIA_API_KEY=nvapi-...
        AI_MODEL=openai/gpt-oss-120b
🐳 Docker Compose Reference
YAML

# docker-compose.yml — local development infrastructure

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

  redis:
    image: redis:7.2-alpine
    container_name: debugsphere-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
🧪 Testing the AI Feature
Bash

# 1. Start all services
docker compose up -d
cd backend && npm run dev:all    # Terminal 1
cd frontend && npm run dev       # Terminal 2

# 2. Open http://localhost:5173 and sign up

# 3. In the editor, write broken Python code:
x = 10
print(y)          # y is not defined

# 4. Click Run — execution will fail

# 5. Watch worker terminal for:
# 🤖  Triggering AI analysis...
# 📡  ← HTTP Status: 200
# ✅  AI analysis complete in 4.2s — 387 tokens

# 6. In the UI, the AIDebugPanel appears automatically:
# 🐛 What went wrong: "Variable y is not defined..."
# 💡 Suggested fix:   "Change print(y) to print(x)..."
🤝 Contributing
Fork the repository
Create a feature branch: git checkout -b feature/your-feature
Commit your changes: git commit -m 'Add your feature'
Push to the branch: git push origin feature/your-feature
Open a Pull Request
📄 License
MIT © 2026 DebugSphere

<div align="center">
Built with ❤️ using Node.js · React · Docker · MongoDB · NVIDIA NIM

⬆ Back to top

</div> ```
