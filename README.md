# MCP Spotify Server

A Model Context Protocol (MCP) server that provides access to the Spotify Web API. This server enables interaction with Spotify's music catalog, including searching for tracks, albums, and artists, as well as accessing artist-specific information like top tracks and related artists.

## Features

- Search for tracks, albums, artists, and playlists
- Get artist information including top tracks and related artists
- Get album information and tracks
- Access new releases and recommendations
- Support for both Spotify IDs and URIs
- Automatic token management with client credentials flow

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

3. Build the server:
```bash
npm run build
```

## Available Tools

- `get_access_token`: Get a valid Spotify access token
- `search`: Search for tracks, albums, artists, or playlists
- `get_artist`: Get artist information
- `get_artist_top_tracks`: Get an artist's top tracks
- `get_artist_related_artists`: Get artists similar to a given artist
- `get_artist_albums`: Get an artist's albums
- `get_album`: Get album information
- `get_album_tracks`: Get an album's tracks
- `get_track`: Get track information
- `get_new_releases`: Get new album releases
- `get_recommendations`: Get track recommendations
- And more...

## License

Private repository. All rights reserved.
