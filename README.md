# Planes - 3D Dots Game

A three-dimensional version of the classic Dots and Boxes game where players compete to claim cubes by capturing their faces.

## Features

- **3D Grid Gameplay**: Play on configurable 3x3x3, 4x4x4, 5x5x5, or 6x6x6 grids
- **Multiple Game Modes**:
  - Local: Two players on the same device
  - vs AI: Play against an intelligent computer opponent
  - Online: Multiplayer over network (requires server)
- **Interactive 3D Visualization**:
  - Rotate view by dragging
  - Zoom with scroll wheel
  - Line preview on hover
  - Visual feedback for claimed squares and cubes

## Game Rules

1. Players take turns drawing lines between adjacent dots
2. When a player completes a square (face of a cube), they claim it and get another turn
3. A player wins a cube by claiming 4 out of 6 faces
4. The player with the most cubes at the end wins

## Installation

```bash
npm install
```

## Running the Game

### Start the game client:
```bash
npm run dev
```
Open http://localhost:3000 in your browser

### For online multiplayer, also start the server:
```bash
npm run server
```
The server runs on port 3001

## How to Play

1. **Setup**: Choose grid size and game mode
2. **Controls**:
   - Click on dots to draw lines
   - Left-drag to rotate the view
   - Scroll to zoom in/out
3. **Strategy**: Try to complete squares while avoiding giving your opponent easy opportunities

## Tech Stack

- **Frontend**: TypeScript, Web Components, Three.js
- **Build Tool**: Vite
- **3D Graphics**: Three.js
- **Networking**: Socket.io (for online mode)
- **Server**: Express + Socket.io

## Project Structure

```
src/
├── core/           # Game engine and logic
├── components/     # Web Components UI
├── ai/            # AI player implementation
├── network/       # Online multiplayer client
└── main.ts        # Application entry point

server/
└── server.ts      # WebSocket server for online play
```