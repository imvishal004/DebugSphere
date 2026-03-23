# ⚡ CloudExecX — Cloud-Native Auto-Scaling Code Execution Platform

A production-ready online code execution platform (like a simplified HackerRank)
that lets users write, run, and manage code in **Python, Java, C++, and JavaScript**
inside secure Docker containers.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                    │
│  Vercel / Netlify (PaaS)                                 │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Login   │  │Dashboard │  │ Editor   │  │ History   │ │
│  │ Signup  │  │ Stats    │  │ Monaco   │  │ Paginated │ │
│  └─────────┘  └──────────┘  └──────────┘  └───────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │  HTTPS / REST
┌────────────────────────▼─────────────────────────────────┐
│                    API SERVICE (Express)                  │
│  AWS EC2 / Render / Railway (IaaS)                       │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Auth     │  │ Code CRUD    │  │ Execution Ctrl    │  │
│  │ JWT      │  │ Save/Load    │  │ Queue Producer     │  │
│  └──────────┘  └──────────────┘  └─────────┬─────────┘  │
│  Rate Limiting · Input Sanitization · Helmet             │
└────────────────────────┬─────────────────────────────────┘
                         │  BullMQ (Redis)
┌────────────────────────▼─────────────────────────────────┐
│                   WORKER SERVICE                         │
│  (Separate process / container – horizontally scalable)  │
│  ┌──────────────────────────────────────────────────┐    │
│  │              Docker Manager                       │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌────────┐  │    │
│  │  │ Python   │ │  Java    │ │ C++  │ │  JS    │  │    │
│  │  │Container │ │Container │ │Cont. │ │Cont.   │  │    │
│  │  └──────────┘ └──────────┘ └──────┘ └────────┘  │    │
│  │  • 256 MB RAM  • 50% CPU  • No network          │    │
│  │  • PID limit   • 10s timeout  • Non-root         │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
          │                              │
   ┌──────▼──────┐               ┌───────▼────────┐
   │  MongoDB    │               │   Redis        │
   │  Atlas      │               │   (Queue)      │
   │  (DBaaS)    │               └────────────────┘
   └─────────────┘
```

## Cloud Service Mapping

| Concept               | Implementation                                    |
| ---------------------- | ------------------------------------------------- |
| **IaaS**               | AWS EC2 / Render for backend + worker deployment  |
| **PaaS**               | Vercel / Netlify for frontend hosting              |
| **DBaaS**              | MongoDB Atlas for Users, Snippets, Executions     |
| **Storage as a Service** | MongoDB GridFS / AWS S3 for large code artifacts |
| **Security as a Service** | JWT auth, Helmet, rate limiting, Docker sandbox  |

## Auto-Scaling Design

```
                    Load Balancer
                    ┌───┴───┐
               API-1    API-2    API-N   (Horizontal)
                    └───┬───┘
                     Redis Queue
                    ┌───┴───┐
            Worker-1  Worker-2  Worker-N  (Scale based on queue depth)
```

Workers are stateless – scale horizontally by running more instances.
Queue depth triggers autoscaling (AWS Auto Scaling Groups, K8s HPA, etc.).

---

## Prerequisites

- **Node.js** ≥ 18
- **Docker** (running)
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud)

## Quick Start (Local Development)

### 1. Clone & Install

```bash
git clone https://github.com/yourname/cloudexecx.git
cd cloudexecx
```

### 2. Start Infrastructure (MongoDB + Redis)

```bash
docker compose up -d mongodb redis
```

### 3. Build Executor Images

```bash
docker build -t cloudexecx-python     ./docker/python
docker build -t cloudexecx-java       ./docker/java
docker build -t cloudexecx-cpp        ./docker/cpp
docker build -t cloudexecx-javascript ./docker/javascript
```

### 4. Backend Setup

```bash
cd backend
cp .env.example .env          # edit values if needed
npm install
npm run dev                   # starts API on :5000
```

### 5. Worker Setup (new terminal)

```bash
cd backend
npm run dev:worker            # starts BullMQ worker
```

### 6. Frontend Setup (new terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # starts on :3000
```

Open **http://localhost:3000**, sign up, and start coding!

---

## Production Deployment

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
# Set env: VITE_API_URL=https://your-api.example.com/api
```

### Backend → Render / Railway

1. Push `backend/` to GitHub.
2. Create a Web Service on Render pointing to `server.js`.
3. Create a Background Worker on Render pointing to `worker.js`.
4. Set environment variables (MongoDB Atlas URI, Redis Cloud URL, JWT secret).
5. Mount Docker socket or use a Docker-in-Docker sidecar.

### Database → MongoDB Atlas

1. Create free M0 cluster at https://cloud.mongodb.com.
2. Get connection string and set as `MONGODB_URI`.

---

## API Reference

| Method | Endpoint               | Auth | Description                |
| ------ | ---------------------- | ---- | -------------------------- |
| POST   | /api/auth/register     | ❌   | Create account             |
| POST   | /api/auth/login        | ❌   | Sign in, receive JWT       |
| GET    | /api/auth/me           | ✅   | Current user profile       |
| POST   | /api/executions        | ✅   | Submit code for execution  |
| GET    | /api/executions/:id    | ✅   | Poll execution status      |
| GET    | /api/executions/history| ✅   | Paginated history          |
| GET    | /api/executions/stats  | ✅   | Aggregate statistics       |
| POST   | /api/code/save         | ✅   | Save a code snippet        |
| GET    | /api/code/snippets     | ✅   | List saved snippets        |
| GET    | /api/code/snippets/:id | ✅   | Get single snippet         |
| PUT    | /api/code/snippets/:id | ✅   | Update snippet             |
| DELETE | /api/code/snippets/:id | ✅   | Delete snippet             |

---

## Security Measures

1. **JWT Authentication** – all API endpoints protected
2. **Rate Limiting** – 10 executions/min, 200 API calls/15 min
3. **Input Sanitization** – blocklist for dangerous patterns
4. **Docker Sandboxing**:
   - `NetworkMode: none` – no internet access
   - `Memory: 256 MB` – prevents memory bombs
   - `CpuQuota: 50%` – prevents CPU starvation
   - `PidsLimit: 64` – prevents fork bombs
   - `no-new-privileges` – prevents privilege escalation
   - Non-root user (UID 1000)
5. **Execution Timeout** – containers killed after 10 seconds
6. **Helmet.js** – secure HTTP headers

## License

MIT