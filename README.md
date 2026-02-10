# My Tasks Planner

A desktop task manager application built with Electron, React, and TypeScript.

## Features

- Task management with drag-and-drop support
- Rich text editing with TipTap
- Flow-based visualization with React Flow
- Smooth animations with Framer Motion
- Integrated AI chat via Usable Chat embed

## Tech Stack

- **Framework**: Electron + Vite
- **Frontend**: React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Lucide React icons
- **State Management**: TanStack Query
- **Drag & Drop**: @hello-pangea/dnd
- **Rich Text**: TipTap
- **Flow Diagrams**: React Flow + ELK.js

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Usable Chat embed token (see below)

### Installation

```bash
# Install dependencies
bun install

# Copy environment file and configure
cp .env.example .env
```

### Configuration

Edit the `.env` file with your Usable embed token:

```bash
VITE_USABLE_EMBED_TOKEN=your-embed-token-here
```

### Development

```bash
# Start development server
bun run dev
```

### Build

```bash
# Build for production
bun run build

# Preview production build
bun run preview
```

## Getting the Usable Embed Token

To get an embed token for the integrated AI chat:

1. **Create an Embed Configuration in Usable**
   - Navigate to [Usable Chat](https://chat.usable.ai) and log in
   - Go to the embed configuration interface
   - Create a new embed configuration with:
     - **Name**: A descriptive name (e.g., "My Tasks Planner Chat")
     - **Description**: Purpose of this embed
     - Configure UI settings, theme, and thinking mode as needed

2. **Generate an Embed Key**
   - Click the key icon on your embed config card
   - Click "+ Generate Key"
   - Fill in the required fields:
     - **Label**: Identifies this key (e.g., "Development", "Production")
     - **Allowed Sites**: Add the origins that can use this embed:
       - For development: `http://localhost:3000`
       - For Electron apps: `file://` or your app's protocol
     - **Expiration Date**: Optional - leave empty for no expiration
   - Click "Generate Key" to create the token

3. **Copy the Token**
   - After generation, copy the embed token (starts with `uc_`)
   - Add it to your `.env` file as `VITE_USABLE_EMBED_TOKEN`

### Multiple Environments

You can generate multiple keys for different environments:
- **Development**: `http://localhost:3000`, no expiration
- **Staging**: Your staging URL, no expiration
- **Production**: Your production URL, no expiration

## Project Structure

```
src/
├── main/        # Electron main process
├── preload/     # Electron preload scripts
├── renderer/    # React frontend
└── shared/      # Shared utilities
```

## License

MIT
