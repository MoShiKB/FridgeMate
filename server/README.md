# FridgeMate Server

Backend authentication API for FridgeMate.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your MongoDB URI and JWT secrets.

3. **Run the server:**
   ```bash
   npm run start:dev
   ```
## API Documentation

Swagger UI available at: `http://localhost:3001/api-docs`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start development server |
| `npm test` | Run tests |
