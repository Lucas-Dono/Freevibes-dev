# FreeVibes Web - Quick Start Guide

<div align="center">
  <img src="../../public/logo.png" alt="FreeVibes Web Logo" width="200" />
  <h3>Music Explorer with Multiple Sources and Integrated Player</h3>
</div>

<div align="center">
  
  [🏠 Home](../../README.md) | [📚 Technical Documentation](TECHNICAL.md) | [📝 Changelog](CHANGELOG.md)
  
</div>

---

## Index

- [Description](#-description)
- [Features](#-features)
- [Installation](#-installation)
- [Architecture](#-architecture)
- [Basic Usage](#-basic-usage)
- [Development](#-development)
- [Deployment](#-deployment)
- [Licenses](#-licenses)

## Description

FreeVibes Web is an application I've developed to unify content from multiple music platforms such as YouTube, Spotify, and Last.fm into a single modern and easy-to-use interface. It allows you to search, discover, play, and manage music from various sources without having to switch between different applications.

### Why FreeVibes Web?

- **All-in-one**: Access content from multiple platforms through a single interface
- **No restrictions**: Play FreeVibes without limitations, even in the background
- **Personalized experience**: Create playlists, manage favorites, and discover new music
- **Modern interface**: Clean and intuitive design adaptable to any device

## Features

- **Unified player** for YouTube, Spotify, and Last.fm content
- **Universal search** that retrieves results from multiple sources
- **Personalized recommendations** based on your preferences and history
- **Genre explorer** with categories and recommendations
- **Custom playlists** to organize your music
- **Offline mode** (coming soon)
- **Cross-device synchronization** (coming soon)

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher
- Python 3.8 or higher (for the FreeVibes service)
- A modern browser (Chrome, Firefox, Edge, Safari)

### Local Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/youtube-music-web.git
cd youtube-music-web
```

2. **Set up environment variables**

Create a `.env` file in the project root with the following variables:

```
YOUTUBE_API_KEY=your_youtube_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
LASTFM_API_KEY=your_lastfm_api_key
```

3. **Install dependencies and run in development**

```bash
# Install dependencies
npm install

# Start all services
npm run dev:all
```

Or if you prefer to start each service separately:

```bash
# Python server (FreeVibes API)
cd python-api
pip install -r requirements.txt
python app.py

# Node.js server (Proxy)
cd node-server
npm install
node server.js

# Next.js Frontend
npm run dev
```

4. **Access the application**

Open your browser and go to: http://localhost:3000

## Architecture

The system I've designed consists of three main components:

1. **Next.js Frontend** - The main user interface
   - Technologies: Next.js 14, React, TailwindCSS
   - Deployed on: Vercel

2. **Node.js Proxy Server** - API to intermediate between the frontend and different sources
   - Technologies: Express, Node.js, Axios
   - Deployed on: Render

3. **FreeVibes API in Python** - Specialized service to access FreeVibes
   - Technologies: Flask, ytmusicapi
   - Deployed on: Render

For more details about the architecture, check the [Technical Documentation](TECHNICAL.md).

## Basic Usage

### Main Navigation

- **Explore**: Discover music by genres, popular artists, and new releases
- **Search**: Find songs, artists, albums, and playlists from multiple sources
- **Library**: Access your favorites, playlists, and playback history
- **Player**: Complete control over playback with queue, repeat, and shuffle

### Universal Search

1. Type your query in the search field
2. Results are displayed grouped by category (songs, artists, albums)
3. Use filters to specify the desired source (YouTube, Spotify, Last.fm)

### Player

- Standard controls: play/pause, previous/next, volume
- Playback queue: view and manage upcoming songs
- Modes: repeat (song/list), shuffle, automix

## Development

### Project Structure

```
youtube-music-web/
├── app/                   # Next.js application
│   ├── (routes)/          # Application routes
│   ├── api/               # Next.js API routes
│   └── components/        # React components
├── node-server/           # Node.js proxy server
│   └── server.js          # Server entry point
├── python-api/            # FreeVibes API
│   └── app.py             # Flask application
├── public/                # Static files
└── docs/                  # Documentation
```

### Available Scripts

- `npm run dev`: Starts the Next.js frontend
- `npm run build`: Builds the application for production
- `npm run start`: Starts the production version
- `npm run dev:all`: Starts all services (frontend, node, python)

### Contributions

If you want to contribute to the project:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Deployment

### Vercel (Frontend)

1. Connect your GitHub repository to Vercel
2. Configure the necessary environment variables
3. Automatic deployment with each push to the main branch

### Render (Backend - Node.js and Python)

Configure each service separately according to the [Technical Documentation](TECHNICAL.md).

## Licenses

- **Source code**: [MIT](../../LICENSE)
- **YouTube** and **Spotify**: The use of their APIs is subject to their own terms of service

---

<div align="center">
  <p>© 2025 FreeVibes Web</p>
</div> 