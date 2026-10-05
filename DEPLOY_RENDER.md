# Deploying TigerDB Full-Stack Application to Render.com

This guide explains how to deploy the entire TigerDB Desktop Memory Agent application (React Frontend + FastAPI Backend + Memory Intelligence Engine) to **Render.com** using a single Docker container.

---

## 🚀 Key Highlights

1. **Entire Application in One Docker Container**:
   - The multi-stage `Dockerfile` compiles the Vite React frontend into static assets and packages the FastAPI Python backend.
   - FastAPI serves both the REST API endpoints (`/api/...`) and the interactive Web HUD UI (`/`).

2. **Fault-Tolerant "No Database" Mode**:
   - **Zero Startup Errors**: If PostgreSQL/TimescaleDB/pgvector is not provisioned or unreachable, the application **never crashes or raises 500 errors**.
   - **Simulated In-Memory Memory Store**: All endpoints (`/api/health`, `/api/morning/briefing`, `/api/timeline`, `/api/memory/overview`, `/api/graph/...`, `/api/memory/mia-search`, `/api/voice/interact`) return rich fallback memory records and interactive DAG graphs.
   - **Plug-and-Play Database Connection**: If you later attach a PostgreSQL database with pgvector, the system automatically detects `DATABASE_URL` and switches to live persistent database mode with zero code changes.

3. **Render Dynamic Port Compliant**:
   - Automatically binds to the port provided by Render via the `$PORT` environment variable (defaults to `8000`).

---

## 🛠️ Option 1: Deploy via Render Web Dashboard (Recommended)

### Step 1: Push Code to GitHub / GitLab
Make sure your TigerDB repository is pushed to your Git provider (GitHub or GitLab):
```bash
git add .
git commit -m "Add Dockerfile, Render config, and fault-tolerant offline DB mode"
git push origin main
```

### Step 2: Create a New Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your Git repository containing TigerDB.
4. Set the following configuration:
   - **Name**: `tigerdb-memory-agent` (or any name you choose)
   - **Region**: Choose the closest region (e.g., Oregon, Frankfurt)
   - **Branch**: `main`
   - **Runtime**: **Docker**
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: **Free** (or Starter)

### Step 3: Configure Environment Variables (Optional)
In the Render dashboard under **Environment Variables**, add:
- `NVIDIA_API_KEY`: *(Optional)* Your NVIDIA NIM API key (`nvapi-...`) for live LLM reasoning. If omitted, the system uses its built-in offline developer assistant responses.
- `NVIDIA_MODEL`: `meta/llama-3.2-11b-vision-instruct` (or your preferred model)

*(Note: You do **not** need to add any database credentials. The app runs smoothly without a database).*

### Step 4: Click Deploy
Click **Create Web Service**. Render will:
1. Build the Node.js frontend (`npm run build`).
2. Package the Python backend and dependencies.
3. Launch the container and verify `/api/health`.

Once deployed, Render gives you a public URL (e.g. `https://tigerdb-memory-agent.onrender.com`). Open it in your browser to interact with the full Web HUD!

---

## 📄 Option 2: Deploy via Render Blueprint (`render.yaml`)

Render supports 1-click Blueprints using the included `render.yaml`:
1. In the Render Dashboard, click **New +** → **Blueprint**.
2. Select your repository.
3. Render reads `render.yaml`, configures the Docker web service, sets the health check path (`/api/health`), and prompts for optional `NVIDIA_API_KEY`.
4. Click **Apply**.

---

## 🐳 Testing Locally with Docker

You can test the exact Render Docker container on your local machine:

### 1. Build the Docker Image
```bash
docker build -t tigerdb-render .
```

### 2. Run the Container (Without Database)
```bash
docker run -p 8000:8000 -e TIGERDB_PORT=59999 tigerdb-render
```

### 3. Open in Browser
- **Web HUD**: [http://localhost:8000](http://localhost:8000)
- **API Health Check**: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Memory Overview**: [http://localhost:8000/api/memory/overview](http://localhost:8000/api/memory/overview)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

All endpoints will return 200 OK responses with rich data and zero errors!
