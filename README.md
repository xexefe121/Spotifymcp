# Spotify MCP Server for Vibecoder

This is a Model Context Protocol (MCP) server designed to integrate with AI assistants like Cline (within cline, cursor or other IDE). It provides access to the Spotify Web API for music data retrieval and includes tools for controlling the Spotify macOS desktop application via AppleScript.

## Features

*   **Spotify Web API Integration:**
    *   Search for tracks, albums, artists, and playlists.
    *   Retrieve detailed information about artists, albums, tracks, and audiobooks.
    *   Access new releases and recommendations.
    *   Manage user playlists (view, modify, add/remove tracks).
    *   Handles API authentication using Client Credentials Flow.
*   **macOS Playback Control:**
    *   Control the Spotify desktop application running on macOS.
    *   Play/pause, skip next/previous track.
    *   Retrieve current track information.
    *   Initiate playback of a specific track via its Spotify URI.

## Prerequisites

1.  **Node.js**: Version 16 or higher.
2.  **macOS**: Required for the playback control features. API features work cross-platform.
3.  **Spotify Desktop App (macOS)**: Must be installed and running for playback control tools to function.
4.  **Spotify API Credentials**:
    *   Register an application on the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
    *   Obtain your **Client ID** and **Client Secret**.

## Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/xexefe121/spotify_macos_mcp.git
    cd spotify_macos_mcp
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```
    This installs necessary packages, including `node-osascript` for macOS control, and runs the initial build.

3.  **Build the Project** (Run if you modify the source code):
    ```bash
    npm run build
    ```

## Configuration

Configure the server in your MCP client's settings file. For the Claude VS Code Extension on macOS, the path is typically:
`/Users/shadmansian/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

Add an entry within the `mcpServers` object:

```json
{
  "mcpServers": {
    "spotify_macos_mcp": { // Choose a unique server name
      "command": "node",
      // *** Use the full, absolute path to the build output ***
      "args": ["/full/path/to/your/spotify_macos_mcp/build/index.js"],
      "env": {
        "SPOTIFY_CLIENT_ID": "YOUR_SPOTIFY_CLIENT_ID",
        "SPOTIFY_CLIENT_SECRET": "YOUR_SPOTIFY_CLIENT_SECRET"
      },
      "disabled": false,
      "autoApprove": [] // Optional: Add tool names to auto-approve
    }
    // ... other server configurations ...
  }
}
```

**Configuration Notes:**

*   Replace `/full/path/to/your/spotify_macos_mcp` with the **absolute path** to the cloned repository directory. Do not use relative paths or shell shortcuts like `~`.
*   Replace `YOUR_SPOTIFY_CLIENT_ID` and `YOUR_SPOTIFY_CLIENT_SECRET` with your actual Spotify API credentials.
*   Ensure the server name (e.g., `"spotify_macos_mcp"`) is unique among your configured MCP servers.

## Available Tools

The server exposes the following tools to the connected AI assistant:

### Web API Tools
*   `get_access_token`: Obtain an API access token.
*   `search`: Search Spotify content.
*   `get_artist`, `get_multiple_artists`, `get_artist_top_tracks`, `get_artist_related_artists`, `get_artist_albums`: Artist information retrieval.
*   `get_album`, `get_multiple_albums`, `get_album_tracks`: Album information retrieval.
*   `get_track`: Track information retrieval.
*   `get_available_genres`: List available genre seeds.
*   `get_new_releases`: Get new album releases.
*   `get_recommendations`: Get track recommendations.
*   `get_audiobook`, `get_multiple_audiobooks`, `get_audiobook_chapters`: Audiobook information retrieval.
*   `get_playlist`, `get_playlist_tracks`, `get_playlist_items`, `modify_playlist`, `add_tracks_to_playlist`, `remove_tracks_from_playlist`, `get_current_user_playlists`: Playlist management.

### macOS Playback Control Tools
*   `spotify_play_pause`: Toggle playback.
*   `spotify_next`: Skip to the next track.
*   `spotify_previous`: Go to the previous track.
*   `spotify_get_current_track`: Get details of the currently playing track.
*   `spotify_play_track`: Play a specific track by its Spotify URI.

## Troubleshooting

*   **Check MCP Client Logs**: Consult the logs provided by your MCP client (e.g., Claude VS Code Extension logs) for specific error messages from the server.
*   **API Errors**: Verify Client ID/Secret and ensure the application is active on the Spotify Developer Dashboard. Check for rate limiting.
*   **macOS Control Errors**:
    *   Confirm the Spotify desktop app is running.
    *   Check macOS permissions: `System Settings > Privacy & Security > Automation` and `Accessibility`. Your terminal, VS Code, or Node might need permission to control Spotify via Apple Events.
    *   Double-check the absolute path configured in the `args` of your MCP settings.
*   **Build Issues**: Ensure `npm run build` completed successfully after any code changes.

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode with auto-rebuild
npm run watch
```

## License

MIT License

---
Repository: [https://github.com/xexefe121/spotify_macos_mcp](https://github.com/xexefe121/spotify_macos_mcp)
Based on work from `https://github.com/pashpashpash/mcp-spotify?tab=readme-ov-file` and `superseoworld/mcp-spotify`.
