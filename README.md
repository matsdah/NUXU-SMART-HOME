# NUXU — Smart Home Management

A modern smart home management web application built with Vue 3, Vite, and TypeScript. Control IoT devices, create automated routines, organize rooms, and monitor activity logs — all in real time.

Developed as part of the **Human-Computer Interaction (HCI)** course at **ITBA** (Instituto Tecnológico de Buenos Aires).

## Features

- **Device Control** — manage lights, AC, blinds, alarms, speakers, ovens, fridges, doors, taps, and vacuums with device-specific control panels
- **Homes & Rooms** — organize devices across multiple homes and rooms with drag-and-drop reordering
- **Routines** — create automated routines with scheduling and multi-device actions
- **Activity Logs** — view real-time event history via WebSocket
- **Authentication** — register, login, email verification, and password recovery
- **Settings** — user preferences and home configuration
- **Responsive Design** — works on desktop and mobile

## Tech Stack

| Layer            | Technology                  |
| ---------------- | --------------------------- |
| Framework        | Vue 3 (Composition API)     |
| Language         | TypeScript                  |
| Build Tool       | Vite                        |
| State Management | Pinia                       |
| Routing          | Vue Router                  |
| Real-time        | Socket.IO                   |
| Email            | EmailJS                     |
| Linting          | Stylelint, html-validate    |

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/matsdah/HCI_TP2.git
   cd HCI_TP2/frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your `VITE_API_KEY`.

4. **Start the development server**

   ```bash
   npm run dev
   ```

## Available Scripts

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `npm run dev`            | Start Vite dev server                |
| `npm run build`          | Type-check and build for production  |
| `npm run preview`        | Preview production build             |
| `npm run type-check`     | Run TypeScript type checking         |
| `npm run validate:html`  | Validate HTML in Vue templates       |
| `npm run validate:css`   | Lint CSS with Stylelint              |

## Project Structure

```text
frontend/src/
├── app/                  # App-level config (router, stores)
├── modules/
│   ├── auth/             # Login, register, recovery, verification
│   ├── devices/          # Device cards and control panels
│   ├── homes/            # Home management dashboard
│   ├── logs/             # Activity log viewer
│   ├── rooms/            # Room management
│   ├── routines/         # Routine creation and scheduling
│   └── settings/         # User and home settings
├── services/             # API client, WebSocket, email
└── shared/               # Reusable components, composables, styles
```

## Authors

ITBA — HCI Course, 2025
