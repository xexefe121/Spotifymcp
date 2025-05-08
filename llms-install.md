# spotify_macos_mcp AI Installation Guide (llms-install.md)

This document provides instructions for AI assistants (like Cline) to perform a one-click installation of the spotify_macos_mcp server.

## End-User Prerequisites

Before installation, the AI assistant should confirm or inform the end-user about the following prerequisites:

1.  **Node.js**: Version 16 or higher must be installed.
2.  **macOS**: The playback control features of this server are specific to macOS. API-only features may work cross-platform, but the primary value includes macOS control.
3.  **Spotify Desktop App (macOS)**: Must be installed and running for playback control tools to function.
4.  **Spotify API Credentials**: The user will need a **Client ID** and a **Client Secret** from a registered Spotify application. If they don't have these, they can be obtained from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

## Installation Steps for AI Agent

### Step 1: Clone Repository

1.  Clone the `spotify_macos_mcp` repository to a suitable local directory.
    ```bash
    git clone https://github.com/xexefe121/spotify_macos_mcp.git <target_directory>/spotify_macos_mcp
    ```
2.  **Action**: Determine and record the absolute path to the cloned `<target_directory>/spotify_macos_mcp`. Let's call this `CLONED_REPO_PATH`.

### Step 2: Install Dependencies

1.  Navigate into the cloned repository and install npm dependencies. This will also run the initial build script.
    ```bash
    cd <CLONED_REPO_PATH> && npm install
    ```

### Step 3: Gather Spotify Credentials from End-User

1.  **Action**: Prompt the end-user to provide their Spotify **Client ID**. Store this as `USER_SPOTIFY_CLIENT_ID`.
2.  **Action**: Prompt the end-user to provide their Spotify **Client Secret**. Store this as `USER_SPOTIFY_CLIENT_SECRET`.
3.  **Guidance for User**: If the user does not have these credentials, instruct them to:
    *   Visit the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
    *   Log in or create an account.
    *   Create a new application (e.g., named "Cline MCP Integration").
    *   Note down the Client ID and Client Secret provided for their new application.

### Step 4: Configure Cline MCP Settings

1.  **Action**: Locate the active Cline MCP settings JSON file.
    *   For VS Code on macOS, this is typically: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
    *   Adapt the path if a different Cline environment is detected.
2.  **Action**: Read the content of this JSON file.
3.  **Action**: Construct the new MCP server configuration entry. The server name should be `spotify_macos_mcp`:
    ```json
    {
      "spotify_macos_mcp": {
        "command": "node",
        "args": ["<CLONED_REPO_PATH>/build/index.js"],
        "env": {
          "SPOTIFY_CLIENT_ID": "<USER_SPOTIFY_CLIENT_ID>",
          "SPOTIFY_CLIENT_SECRET": "<USER_SPOTIFY_CLIENT_SECRET>"
        },
        "disabled": false,
        "autoApprove": []
      }
    }
    ```
    *   **Important**:
        *   Replace `<CLONED_REPO_PATH>` with the actual absolute path recorded in Step 1 (e.g., `/Users/username/mcp_servers/spotify_macos_mcp`).
        *   Replace `<USER_SPOTIFY_CLIENT_ID>` with the Client ID obtained in Step 3.
        *   Replace `<USER_SPOTIFY_CLIENT_SECRET>` with the Client Secret obtained in Step 3.
4.  **Action**: Add this new `spotify_macos_mcp` object as a key-value pair within the top-level `mcpServers` object in the parsed JSON settings. Ensure existing configurations are preserved.
5.  **Action**: Write the modified JSON content back to the settings file.

### Step 5: Finalize Installation

1.  **Action**: Inform the end-user that the spotify_macos_mcp server installation is complete.
2.  **Action**: Suggest that Cline might need to rescan MCP servers, or the IDE might need a restart, for the new tools to become available.
3.  **Optional Verification**: Suggest the user can test the integration by asking Cline to use a Spotify command, for example: "Cline, what song is currently playing on Spotify?" (assuming Spotify is running and playing music on their Mac).

---
End of `llms-install.md` content.
