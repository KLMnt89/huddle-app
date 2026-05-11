# Huddle — Real-Time Video Chat App
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0.5-6DB33F?style=flat&logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java-21-ED8B00?style=flat&logo=openjdk&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.0.4-646CFF?style=flat&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ed?style=flat&logo=docker&logoColor=white)
![LiveKit](https://img.shields.io/badge/LiveKit-2.5.8-FF4F00?style=flat&logo=webrtc&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-0.12.6-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-proxy-009639?style=flat&logo=nginx&logoColor=white)

A full-stack video conferencing application built with Spring Boot and React, powered by LiveKit for real-time WebRTC communication.

## Table of Contents
 
1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Default Admin Account](#default-admin-account)
6. [Ports](#ports)
7. [API Overview](#api-overview)
8. [How Invite Links Work](#how-invite-links-work)
9. [Database Migrations](#database-migrations)
10. [Environment Notes](#environment-notes)
11. [Academic Context](#academic-context)

## Features

- **Instant meetings** — create a room in one click and share the invite link
- **Scheduled meetings** — plan meetings with participants from your contacts
- **Guest join** — anyone can join via invite link without an account (enter name as guest)
- **In-call experience**
  - Real-time video and audio (WebRTC via LiveKit)
  - Screen sharing
  - In-call chat (persisted to DB, synced live via DataChannel)
  - Collaborative notes (synced live to all participants, exportable as `.txt`)
  - Participant list with join times
  - Join/leave toasts
- **Contacts** — address book with Online / Busy / Offline status
- **Groups** — organize contacts into groups
- **Notes** — per-meeting notes and per-room notes
- **Dashboard** — live stats, mini calendar, upcoming meetings countdown, active rooms panel
- **Profile** — update name, username, email, password
- **Invite links** — expire after 24 hours; rooms auto-close after 120 minutes
- **Rate limiting** — max 10 rooms per user per hour
- **SSE** — dashboard stats update in real time without polling

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Spring Boot 4.0.5, Java 21 |
| Database | PostgreSQL 15 |
| Video | LiveKit Cloud (WebRTC) |
| Auth | Spring Security + JWT + Refresh Tokens |
| Frontend | React 19 + Vite |
| Reverse proxy | Nginx (Docker) |
| Migrations | Flyway (local) / PostgreSQL init scripts (Docker) |

## Project Structure

```
mux-video-rooms/
├── backend/
│   └── main/
│       ├── java/mk/ukim/finki/muxvideorooms/
│       │   ├── config/        # Security, JWT, CORS, password encoder
│       │   ├── model/         # Entities: User, Room, Meeting, Contact, ...
│       │   ├── model/enums/   # RoomStatus, MeetingStatus, ContactStatus, UserRole
│       │   ├── repository/    # JPA repositories
│       │   ├── service/       # Business logic + LiveKit integration
│       │   └── web/           # REST controllers + GlobalExceptionHandler
│       └── resources/
│           ├── db/migrations/ # Flyway SQL migrations (V1–V8)
│           └── application.properties
├── frontend/
│   └── src/
│       ├── api/               # Axios API client
│       ├── components/        # Sidebar, TopBar, ConfirmModal, PrivateRoute
│       ├── context/           # AuthContext
│       └── pages/             # All page components
├── docker-compose.yml
├── start.sh                   # Start (preserves data)
└── reset.sh                   # Full reset (wipes DB, re-runs migrations)
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- A [LiveKit Cloud](https://livekit.io) account (free tier works)
- An ngrok account (free) — needed for sharing with others via ngrok

### 1. Clone the repository

```bash
git clone https://github.com/mrkskq/Real-Time-Video-Chat-App.git
cd Real-Time-Video-Chat-App
```

### 2. Create the `.env` file

Create a `.env` file in the project root with the following variables:

```env
POSTGRES_DB=muxvideorooms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

LIVEKIT_URL=wss://your-livekit-host.livekit.cloud
LIVEKIT_PUBLIC_URL=wss://your-livekit-host.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

JWT_SECRET=your_base64_encoded_jwt_secret
```

### 3. Start the application

```bash
bash start.sh
```

This runs `docker compose up --build`. Data in the database is preserved between restarts.

Open **http://localhost** in your browser.

### 4. Sharing with others via ngrok
 
By default the app runs only on `http://localhost` — nobody outside your machine can reach it. **ngrok** punches a public HTTPS tunnel to your local port 80, so anyone with the link can open the app in their browser without installing anything.
 
> **How it works under the hood**
>
> ngrok opens a persistent TCP connection from your machine to the ngrok cloud. When a remote user visits the public URL (e.g. `https://abc123.ngrok-free.app`), their browser connects to the ngrok edge servers, which forward the request through that tunnel to your local port 80 (Nginx → React / Spring Boot). The second user never connects directly to your machine — everything flows through the ngrok relay. LiveKit video/audio bypasses this tunnel entirely; it travels peer-to-peer (or through LiveKit's own TURN servers) via WebRTC, so the tunnel only carries the web app itself.
>
> **Only you need to run `docker compose`.** The second user only needs a browser and the public URL — no code, no Docker, no installation.
>
> ```
> You (docker compose UP)              Second user
>         |                                  |
>         | Backend + Frontend + DB          | Browser only
>         | everything runs locally          |
>         |                                  |
>         |←── https://abc123.ngrok-free.app ─→|
>         |                                  |
>         | LiveKit Cloud ══════════════════ | video/audio (WebRTC)
> ```
 
#### Step 1 — Install ngrok
 
Go to [ngrok.com/download](https://ngrok.com/download), download for your OS, and install it.
 
Then sign up (free) at [ngrok.com](https://ngrok.com) and copy your authtoken from the dashboard.
 
Open the **ngrok terminal** (double-click `ngrok.exe` on Windows — it opens its own terminal window) and register your token:
 
```bash
ngrok config add-authtoken YOUR_TOKEN
```
 
#### Step 2 — Make sure the app is running in the background

> You have already done that using `bash start.sh` command
 
#### Step 3 — Start the tunnel
 
In the **ngrok terminal**, run:
 
```bash
ngrok http 80
```
 
You will see output similar to:
 
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:80
```
 
Keep the ngrok terminal open for as long as you want the link to be active. Closing it will terminate the tunnel.
 
#### Step 4 — Add the ngrok URL to CorsConfig.java
 
Spring Security's CORS policy only allows origins you explicitly whitelist. Open `CorsConfig.java` and add your ngrok URL:
 
```java
config.addAllowedOrigin("http://localhost");
config.addAllowedOrigin("http://localhost:5173");
config.addAllowedOrigin("https://abc123.ngrok-free.app"); // ← your ngrok URL
```
 
Then rebuild the containers so the change takes effect:
 
```bash
docker compose down
docker compose up -d --build
```
> **Note:** Do not run `bash reset.sh` here — that script removes the database volume and **all your data will be lost**.
 
#### Step 5 — Share the link
 
Send `https://abc123.ngrok-free.app` to anyone you want to invite. The second user only needs to:
 
1. Open the URL in their browser
2. Register or log in (or join as a guest)
3. Enter the room

That's it — no code, no Docker, no installation required on their end.
 
> **Note:** The free ngrok plan generates a new random URL every time you restart `ngrok http 80`. Update `CorsConfig.java` and rebuild whenever the URL changes.

### Clean reset (wipes all data)

```bash
bash reset.sh
```

Use this when you add new migration files or need a completely fresh database.

## Default Admin Account

On first startup an admin user is created automatically:

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

## Ports

| Service | Port |
|---|---|
| Frontend (Nginx) | `80` → http://localhost |
| Spring Boot API | `8080` |
| PostgreSQL | `5432` |
| Frontend dev server (Vite) | `5173` (outside Docker only) |

## API Overview

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT + refresh token |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate refresh token |

### Rooms
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rooms` | List all rooms |
| GET | `/api/rooms/active` | List active rooms |
| POST | `/api/rooms` | Create a new room |
| POST | `/api/rooms/join/:code` | Join via invite code (public) |
| POST | `/api/rooms/:id/end` | End a room |
| DELETE | `/api/rooms/:id` | Delete a room |
| GET | `/api/rooms/:id/participant-log` | Get participant log |

### Meetings
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/meetings` | List all meetings |
| POST | `/api/meetings` | Schedule a meeting |
| POST | `/api/meetings/:id/start` | Start a meeting (creates LiveKit room) |
| POST | `/api/meetings/:id/end` | End a meeting |
| POST | `/api/meetings/:id/cancel` | Cancel a meeting |

### Other
- `GET /api/contacts` — contacts CRUD
- `GET /api/groups` — groups CRUD
- `GET /api/meetings/:id/notes` — meeting notes CRUD
- `GET /api/rooms/:id/note` — room note (get/save)
- `GET /api/rooms/:id/chat` — chat messages
- `GET /api/sse/subscribe` — SSE stream for real-time dashboard updates

## How Invite Links Work

1. User clicks **Meeting now** → room is created → invite link is generated (`/join/:code`)
2. Link is valid for **24 hours**
3. Logged-in users join automatically using their account name
4. Guests can join without an account by entering their first and last name
5. After 24 hours the backend returns `410 Gone` and the frontend shows an "Link expired" screen
6. Rooms auto-close after **120 minutes** (configurable via `room.auto-close.minutes`)

## Database Migrations

Migrations live in `backend/main/resources/db/migrations/` and run in order:

| File | Description |
|---|---|
| V1 | Core tables (rooms, meetings, contacts, users) |
| V2 | Seed data |
| V3 | LiveKit field rename |
| V4 | Users table updates |
| V5 | Refresh tokens |
| V6 | Chat messages + room notes |
| V7 | lastSeenAt, expiresAt, participant log |
| V8 | Groups |

Flyway is **enabled** for local development and **disabled** in Docker (PostgreSQL runs the SQL files directly on first start via `/docker-entrypoint-initdb.d`).

## Environment Notes

- JWT is stateless; tokens are stored in `localStorage` on the client
- `JwtAuthFilter` updates `User.lastSeenAt` on every request (throttled to 1 DB write per 60s per user)
- Rate limiting uses the display name as key — tracked in memory per JVM instance
- `createdBy` on Room and Meeting is a display name string, not a foreign key to users

## Academic Context

This project was built as part of the **Web Programming** course.
