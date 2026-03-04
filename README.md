# FridgeMate

A full-stack web application for sharing kitchen content with authentication, profiles, and AI integration.

## Project Structure

```
FridgeMate/
├── client/      # React TypeScript app
├── server/      # Node.js Express server
└── README.md
```

## Setup

### Client
```bash
cd client
npm install
npm start
```

### Server
```bash
cd server
npm install
npm run dev
```

## Tech Stack

- **Client**: React 18, TypeScript, CSS Modules
- **Server**: Node.js, Express, TypeScript, MongoDB
- **Auth**: JWT + Refresh tokens
- **Real-time**: Socket.io
