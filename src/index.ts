#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as osascript from 'node-osascript';

import { AuthManager } from './utils/auth.js';
import { SpotifyApi } from './utils/api.js';
import { ArtistsHandler } from './handlers/artists.js';
import { AlbumsHandler } from './handlers/albums.js';
import { TracksHandler } from './handlers/tracks.js';
import { AudiobooksHandler } from './handlers/audiobooks.js';
import { PlaylistsHandler } from './handlers/playlists.js';

import {
  ArtistArgs,
  ArtistTopTracksArgs,
  ArtistRelatedArtistsArgs,
  ArtistAlbumsArgs,
  MultipleArtistsArgs,
} from './types/artists.js';
import {
  AlbumArgs,
  AlbumTracksArgs,
  MultipleAlbumsArgs,
  NewReleasesArgs,
} from './types/albums.js';
import {
  TrackArgs,
  RecommendationsArgs,
  SearchArgs,
} from './types/tracks.js';
import { AudiobookArgs, MultipleAudiobooksArgs, AudiobookChaptersArgs } from './types/audiobooks.js';
import { PlaylistArgs, PlaylistTracksArgs, PlaylistItemsArgs, ModifyPlaylistArgs, AddTracksToPlaylistArgs, RemoveTracksFromPlaylistArgs, GetCurrentUserPlaylistsArgs } from './types/playlists.js';

class SpotifyServer {
  private validateArgs<T>(args: Record<string, unknown> | undefined, requiredFields: string[]): T {
    if (!args) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Arguments are required'
      );
    }

    for (const field of requiredFields) {
      if (!(field in args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Missing required field: ${field}`
        );
      }
    }

    return args as unknown as T;
  }

  private server: Server;
  private authManager: AuthManager;
  private api: SpotifyApi;
  private artistsHandler: ArtistsHandler;
  private albumsHandler: AlbumsHandler;
  private tracksHandler: TracksHandler;
  private audiobooksHandler: AudiobooksHandler;
  private playlistsHandler: PlaylistsHandler;

  private async executeAppleScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Explicitly type err and result as any since @types/node-osascript is unavailable
      osascript.execute(script, (err: any, result: any) => {
        if (err) {
          console.error('AppleScript Error:', err);
          // Try to provide a more specific error if Spotify isn't running
          if (err.message && err.message.includes('-1728')) { // Error code for "Can't get application"
               // Use InternalError as ExternalResourceNotFound is not defined in McpError
               reject(new McpError(ErrorCode.InternalError, 'Spotify application not found or not running.'));
          } else {
               // Use InternalError as ExternalError is not defined in McpError
               reject(new McpError(ErrorCode.InternalError, `AppleScript execution failed: ${err.message || 'Unknown error'}`));
          }
        } else {
          // Ensure result is a string, provide default if undefined/null
          resolve(result ? result.toString() : 'Success');
        }
      });
    });
  }


  constructor() {
    this.server = new Server(
      {
        name: 'mcp-spotify',
        version: '0.4.4', // Consider incrementing version if making significant changes
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.authManager = new AuthManager();
    this.api = new SpotifyApi(this.authManager);
    this.artistsHandler = new ArtistsHandler(this.api);
    this.albumsHandler = new AlbumsHandler(this.api);
    this.tracksHandler = new TracksHandler(this.api);
    this.audiobooksHandler = new AudiobooksHandler(this.api);
    this.playlistsHandler = new PlaylistsHandler(this.api);

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Existing API tools...
        {
          name: 'get_access_token',
          description: 'Get a valid Spotify access token for API requests',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'search',
          description: 'Search for tracks, albums, artists, or playlists',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              type: { type: 'string', description: 'Type of item to search for', enum: ['track', 'album', 'artist', 'playlist'] },
              limit: { type: 'number', description: 'Maximum number of results (1-50)', minimum: 1, maximum: 50, default: 20 }
            },
            required: ['query', 'type']
          },
        },
        {
          name: 'get_artist',
          description: 'Get Spotify catalog information for an artist',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI for the artist' } }, required: ['id'] },
        },
        {
          name: 'get_multiple_artists',
          description: 'Get Spotify catalog information for multiple artists',
          inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify artist IDs or URIs (max 50)', maxItems: 50 } }, required: ['ids'] },
        },
        {
          name: 'get_artist_top_tracks',
          description: 'Get Spotify catalog information about an artist\'s top tracks',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI for the artist' }, market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' } }, required: ['id'] },
        },
        {
          name: 'get_artist_related_artists',
          description: 'Get Spotify catalog information about artists similar to a given artist',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI for the artist' } }, required: ['id'] },
        },
        {
          name: 'get_artist_albums',
          description: 'Get Spotify catalog information about an artist\'s albums',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI for the artist' },
              include_groups: { type: 'array', items: { type: 'string', enum: ['album', 'single', 'appears_on', 'compilation'] }, description: 'Optional. Filter by album types' },
              limit: { type: 'number', description: 'Maximum number of albums to return (1-50)', minimum: 1, maximum: 50, default: 20 },
              offset: { type: 'number', description: 'The index of the first album to return', minimum: 0, default: 0 }
            },
            required: ['id']
          },
        },
        {
          name: 'get_album',
          description: 'Get Spotify catalog information for an album',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI for the album' } }, required: ['id'] },
        },
        {
          name: 'get_album_tracks',
          description: 'Get Spotify catalog information for an album\'s tracks',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI for the album' },
              limit: { type: 'number', description: 'Maximum number of tracks to return (1-50)', minimum: 1, maximum: 50, default: 20 },
              offset: { type: 'number', description: 'The index of the first track to return', minimum: 0, default: 0 }
            },
            required: ['id']
          },
        },
        {
          name: 'get_multiple_albums',
          description: 'Get Spotify catalog information for multiple albums',
          inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify album IDs or URIs (max 20)', maxItems: 20 } }, required: ['ids'] },
        },
        {
          name: 'get_track',
          description: 'Get Spotify catalog information for a track',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI for the track' } }, required: ['id'] },
        },
        {
          name: 'get_available_genres',
          description: 'Get a list of available genre seeds for recommendations',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'get_new_releases',
          description: 'Get a list of new album releases featured in Spotify',
          inputSchema: {
            type: 'object',
            properties: {
              country: { type: 'string', description: 'Optional. A country code (ISO 3166-1 alpha-2)' },
              limit: { type: 'number', description: 'Maximum number of releases to return (1-50)', minimum: 1, maximum: 50, default: 20 },
              offset: { type: 'number', description: 'The index of the first release to return', minimum: 0, default: 0 }
            }
          },
        },
        {
          name: 'get_recommendations',
          description: 'Get track recommendations based on seed tracks, artists, or genres',
          inputSchema: {
            type: 'object',
            properties: {
              seed_tracks: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track IDs or URIs' },
              seed_artists: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify artist IDs or URIs' },
              seed_genres: { type: 'array', items: { type: 'string' }, description: 'Array of genre names' },
              limit: { type: 'number', description: 'Maximum number of recommendations (1-100)', minimum: 1, maximum: 100, default: 20 }
            },
            required: []
          },
        },
        {
          name: 'get_audiobook',
          description: 'Get Spotify catalog information for an audiobook',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI for the audiobook' }, market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' } }, required: ['id'] },
        },
        {
          name: 'get_multiple_audiobooks',
          description: 'Get Spotify catalog information for multiple audiobooks',
          inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify audiobook IDs or URIs (max 50)', maxItems: 50 }, market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' } }, required: ['ids'] },
        },
        {
          name: 'get_audiobook_chapters',
          description: 'Get Spotify catalog information about an audiobook\'s chapters',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI for the audiobook' },
              market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' },
              limit: { type: 'number', description: 'Maximum number of chapters to return (1-50)', minimum: 1, maximum: 50 },
              offset: { type: 'number', description: 'The index of the first chapter to return', minimum: 0 }
            },
            required: ['id']
          },
        },
        {
          name: 'get_playlist',
          description: 'Get a playlist owned by a Spotify user',
          inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'The Spotify ID or URI of the playlist' }, market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' } }, required: ['id'] },
        },
        {
          name: 'get_playlist_tracks',
          description: 'Get full details of the tracks of a playlist',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI of the playlist' },
              market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' },
              fields: { type: 'string', description: 'Optional. Filters for the query' },
              limit: { type: 'number', description: 'Optional. Maximum number of tracks to return (1-100)', minimum: 1, maximum: 100 },
              offset: { type: 'number', description: 'Optional. Index of the first track to return', minimum: 0 }
            },
            required: ['id']
          },
        },
        {
          name: 'get_playlist_items',
          description: 'Get full details of the items of a playlist',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI of the playlist' },
              market: { type: 'string', description: 'Optional. An ISO 3166-1 alpha-2 country code' },
              fields: { type: 'string', description: 'Optional. Filters for the query' },
              limit: { type: 'number', description: 'Optional. Maximum number of items to return (1-100)', minimum: 1, maximum: 100 },
              offset: { type: 'number', description: 'Optional. Index of the first item to return', minimum: 0 }
            },
            required: ['id']
          },
        },
        {
          name: 'modify_playlist',
          description: 'Change a playlist\'s name and public/private state',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI of the playlist' },
              name: { type: 'string', description: 'Optional. New name for the playlist' },
              public: { type: 'boolean', description: 'Optional. If true the playlist will be public' },
              collaborative: { type: 'boolean', description: 'Optional. If true, the playlist will become collaborative' },
              description: { type: 'string', description: 'Optional. New description for the playlist' }
            },
            required: ['id']
          },
        },
        {
          name: 'add_tracks_to_playlist',
          description: 'Add one or more tracks to a playlist',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI of the playlist' },
              uris: { type: 'array', items: { type: 'string' }, description: 'Array of Spotify track URIs to add' },
              position: { type: 'number', description: 'Optional. The position to insert the tracks (zero-based)', minimum: 0 }
            },
            required: ['id', 'uris']
          },
        },
        {
          name: 'remove_tracks_from_playlist',
          description: 'Remove one or more tracks from a playlist',
          inputSchema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'The Spotify ID or URI of the playlist' },
              tracks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    uri: { type: 'string', description: 'Spotify URI of the track to remove' },
                    positions: { type: 'array', items: { type: 'number' }, description: 'Optional positions of the track to remove' }
                  },
                  required: ['uri']
                },
                description: 'Array of objects containing Spotify track URIs to remove'
              },
              snapshot_id: { type: 'string', description: 'Optional. The playlist\'s snapshot ID' }
            },
            required: ['id', 'tracks']
          },
        },
        {
          name: 'get_current_user_playlists',
          description: 'Get a list of the playlists owned or followed by the current Spotify user',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Maximum number of playlists to return (1-50)', minimum: 1, maximum: 50 },
              offset: { type: 'number', description: 'The index of the first playlist to return', minimum: 0 }
            }
          },
        },
        // New AppleScript tools
        {
          name: 'spotify_play_pause',
          description: 'Toggle play/pause on the Spotify macOS app',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'spotify_next',
          description: 'Skip to the next track on the Spotify macOS app',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'spotify_previous',
          description: 'Go to the previous track on the Spotify macOS app',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'spotify_get_current_track',
          description: 'Get the currently playing track info from the Spotify macOS app',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'spotify_play_track',
          description: 'Play a specific track on the Spotify macOS app using its URI',
          inputSchema: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description: 'The Spotify URI of the track to play (e.g., spotify:track:TRACK_ID)'
              }
            },
            required: ['uri']
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          // Existing API tool cases...
          case 'get_access_token': {
            const token = await this.authManager.getAccessToken();
            return { content: [{ type: 'text', text: token }] };
          }
          case 'search': {
            const args = this.validateArgs<SearchArgs>(request.params.arguments, ['query', 'type']);
            const result = await this.tracksHandler.search(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_artist': {
            const args = this.validateArgs<ArtistArgs>(request.params.arguments, ['id']);
            const result = await this.artistsHandler.getArtist(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_multiple_artists': {
            const args = this.validateArgs<MultipleArtistsArgs>(request.params.arguments, ['ids']);
            const result = await this.artistsHandler.getMultipleArtists(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_artist_top_tracks': {
            const args = this.validateArgs<ArtistTopTracksArgs>(request.params.arguments, ['id']);
            const result = await this.artistsHandler.getArtistTopTracks(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_artist_related_artists': {
            const args = this.validateArgs<ArtistRelatedArtistsArgs>(request.params.arguments, ['id']);
            const result = await this.artistsHandler.getArtistRelatedArtists(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_artist_albums': {
            const args = this.validateArgs<ArtistAlbumsArgs>(request.params.arguments, ['id']);
            const result = await this.artistsHandler.getArtistAlbums(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_album': {
            const args = this.validateArgs<AlbumArgs>(request.params.arguments, ['id']);
            const result = await this.albumsHandler.getAlbum(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_album_tracks': {
            const args = this.validateArgs<AlbumTracksArgs>(request.params.arguments, ['id']);
            const result = await this.albumsHandler.getAlbumTracks(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_multiple_albums': {
            const args = this.validateArgs<MultipleAlbumsArgs>(request.params.arguments, ['ids']);
            const result = await this.albumsHandler.getMultipleAlbums(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_track': {
            const args = this.validateArgs<TrackArgs>(request.params.arguments, ['id']);
            const result = await this.tracksHandler.getTrack(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_available_genres': {
            const result = await this.tracksHandler.getAvailableGenres();
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_new_releases': {
            const args = this.validateArgs<NewReleasesArgs>(request.params.arguments || {}, []);
            const result = await this.albumsHandler.getNewReleases(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_recommendations': {
            const args = this.validateArgs<RecommendationsArgs>(request.params.arguments || {}, []);
            const result = await this.tracksHandler.getRecommendations(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_audiobook': {
            const args = this.validateArgs<AudiobookArgs>(request.params.arguments, ['id']);
            const result = await this.audiobooksHandler.getAudiobook(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_multiple_audiobooks': {
            const args = this.validateArgs<MultipleAudiobooksArgs>(request.params.arguments, ['ids']);
            const result = await this.audiobooksHandler.getMultipleAudiobooks(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_audiobook_chapters': {
            const args = this.validateArgs<AudiobookChaptersArgs>(request.params.arguments, ['id']);
            const result = await this.audiobooksHandler.getAudiobookChapters(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_playlist': {
            const args = this.validateArgs<PlaylistArgs>(request.params.arguments, ['id']);
            const result = await this.playlistsHandler.getPlaylist(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_playlist_tracks': {
            const args = this.validateArgs<PlaylistTracksArgs>(request.params.arguments, ['id']);
            const result = await this.playlistsHandler.getPlaylistTracks(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_playlist_items': {
            const args = this.validateArgs<PlaylistItemsArgs>(request.params.arguments, ['id']);
            const result = await this.playlistsHandler.getPlaylistItems(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'modify_playlist': {
            const args = this.validateArgs<ModifyPlaylistArgs>(request.params.arguments, ['id']);
            const result = await this.playlistsHandler.modifyPlaylist(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'add_tracks_to_playlist': {
            const args = this.validateArgs<AddTracksToPlaylistArgs>(request.params.arguments, ['id', 'uris']);
            const result = await this.playlistsHandler.addTracksToPlaylist(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'remove_tracks_from_playlist': {
            const args = this.validateArgs<RemoveTracksFromPlaylistArgs>(request.params.arguments, ['id', 'tracks']);
            const result = await this.playlistsHandler.removeTracksFromPlaylist(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
          case 'get_current_user_playlists': {
            const args = this.validateArgs<GetCurrentUserPlaylistsArgs>(request.params.arguments || {}, []);
            const result = await this.playlistsHandler.getCurrentUserPlaylists(args);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }

          // New AppleScript Playback Control Tool Cases
          case 'spotify_play_pause': {
            const result = await this.executeAppleScript('tell application "Spotify" to playpause');
            return { content: [{ type: 'text', text: result }] };
          }
          case 'spotify_next': {
            const result = await this.executeAppleScript('tell application "Spotify" to next track');
            return { content: [{ type: 'text', text: result }] };
          }
          case 'spotify_previous': {
            const result = await this.executeAppleScript('tell application "Spotify" to previous track');
            return { content: [{ type: 'text', text: result }] };
          }
          case 'spotify_get_current_track': {
            const script = `
              tell application "Spotify"
                if player state is playing or player state is paused then
                  set trackName to name of current track
                  set artistName to artist of current track
                  set albumName to album of current track
                  return "Track: " & trackName & "\\nArtist: " & artistName & "\\nAlbum: " & albumName
                else
                  return "Spotify is not playing or paused."
                end if
              end tell
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }
          case 'spotify_play_track': {
            const args = this.validateArgs<{ uri: string }>(request.params.arguments, ['uri']);
            if (!args.uri || !args.uri.startsWith('spotify:track:')) {
                 throw new McpError(ErrorCode.InvalidParams, 'Invalid Spotify track URI format. Expected "spotify:track:TRACK_ID".');
            }
            // Script to play track and reactivate previous app using bundle identifier
            const script = `
              set currentAppID to ""
              try
                tell application "System Events"
                  set frontApp to first application process whose frontmost is true
                  set currentAppID to bundle identifier of frontApp
                end tell
              end try
              
              tell application "Spotify" to play track "${args.uri}"
              
              delay 1.0 -- Keep 1 second delay
              
              if currentAppID is not "" then
                try
                  -- Activate using the bundle identifier
                  tell application id currentAppID to activate
                end try
              end if
            `;
            const result = await this.executeAppleScript(script);
            return { content: [{ type: 'text', text: result }] };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          // Re-throw MCP errors directly
          throw error;
        }
        // Wrap other errors as InternalError
        console.error(`Error handling tool ${request.params.name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Unexpected error processing tool ${request.params.name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Spotify MCP server running on stdio');
  }
}

const server = new SpotifyServer();
server.run().catch(console.error);
