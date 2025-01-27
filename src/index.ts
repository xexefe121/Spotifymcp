#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosError } from 'axios';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const BASE_URL = 'https://api.spotify.com/v1';

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables are required');
}

interface TokenInfo {
  accessToken: string;
  expiresAt: number;
}

interface SpotifyErrorResponse {
  error: {
    status: number;
    message: string;
  };
}

interface SearchArgs {
  query: string;
  type: 'track' | 'album' | 'artist' | 'playlist';
  limit?: number;
}

interface ArtistArgs {
  id: string;
}

interface AlbumArgs {
  id: string;
}

interface AlbumTracksArgs {
  id: string;
  limit?: number;
  offset?: number;
}

interface MultipleAlbumsArgs {
  ids: string[];
}

interface MultipleArtistsArgs {
  ids: string[];
}

interface TrackArgs {
  id: string;
}

interface NewReleasesArgs {
  country?: string;
  limit?: number;
  offset?: number;
}

interface RecommendationsArgs {
  seed_tracks?: string[];
  seed_artists?: string[];
  seed_genres?: string[];
  limit?: number;
}

interface ArtistAlbumsArgs {
  id: string;
  include_groups?: ('album' | 'single' | 'appears_on' | 'compilation')[];
  limit?: number;
  offset?: number;
}

interface ArtistTopTracksArgs {
  id: string;
  market?: string;
}

interface ArtistRelatedArtistsArgs {
  id: string;
}

class SpotifyServer {
  private server: Server;
  private tokenInfo: TokenInfo | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-spotify',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.tokenInfo && Date.now() < this.tokenInfo.expiresAt) {
      return this.tokenInfo.accessToken;
    }

    // Get new token
    try {
      const response = await axios.post('https://accounts.spotify.com/api/token', 
        new URLSearchParams({
          grant_type: 'client_credentials'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
          }
        }
      );

      this.tokenInfo = {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in * 1000)
      };

      return this.tokenInfo.accessToken;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to get Spotify access token: ${error.response?.data?.error ?? error.message}`
        );
      }
      throw error;
    }
  }

  private async makeApiRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', data?: any): Promise<T> {
    try {
      const token = await this.getAccessToken();
      const response = await axios({
        method,
        url: `${BASE_URL}${path}`,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        data
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const spotifyError = error.response?.data as SpotifyErrorResponse;
        throw new McpError(
          ErrorCode.InternalError,
          `Spotify API error: ${spotifyError?.error?.message ?? error.message}`
        );
      }
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_access_token',
          description: 'Get a valid Spotify access token for API requests',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          },
        },
        {
          name: 'search',
          description: 'Search for tracks, albums, artists, or playlists',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              },
              type: {
                type: 'string',
                description: 'Type of item to search for',
                enum: ['track', 'album', 'artist', 'playlist']
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results (1-50)',
                minimum: 1,
                maximum: 50,
                default: 20
              }
            },
            required: ['query', 'type']
          },
        },
        {
          name: 'get_multiple_artists',
          description: 'Get Spotify catalog information for multiple artists',
          inputSchema: {
            type: 'object',
            properties: {
              ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Spotify artist IDs or URIs (max 50)',
                maxItems: 50
              }
            },
            required: ['ids']
          },
        },
        {
          name: 'get_artist',
          description: 'Get Spotify catalog information for an artist',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the artist'
              }
            },
            required: ['id']
          },
        },
        {
          name: 'get_album_tracks',
          description: 'Get Spotify catalog information for an album\'s tracks',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the album'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of tracks to return (1-50)',
                minimum: 1,
                maximum: 50,
                default: 20
              },
              offset: {
                type: 'number',
                description: 'The index of the first track to return',
                minimum: 0,
                default: 0
              }
            },
            required: ['id']
          },
        },
        {
          name: 'get_multiple_albums',
          description: 'Get Spotify catalog information for multiple albums',
          inputSchema: {
            type: 'object',
            properties: {
              ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Spotify album IDs or URIs (max 20)',
                maxItems: 20
              }
            },
            required: ['ids']
          },
        },
        {
          name: 'get_album',
          description: 'Get Spotify catalog information for an album',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the album'
              }
            },
            required: ['id']
          },
        },
        {
          name: 'get_track',
          description: 'Get Spotify catalog information for a track',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the track'
              }
            },
            required: ['id']
          },
        },
        {
          name: 'get_available_genres',
          description: 'Get a list of available genre seeds for recommendations',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          },
        },
        {
          name: 'get_new_releases',
          description: 'Get a list of new album releases featured in Spotify',
          inputSchema: {
            type: 'object',
            properties: {
              country: {
                type: 'string',
                description: 'Optional. A country code (ISO 3166-1 alpha-2)'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of releases to return (1-50)',
                minimum: 1,
                maximum: 50,
                default: 20
              },
              offset: {
                type: 'number',
                description: 'The index of the first release to return',
                minimum: 0,
                default: 0
              }
            }
          },
        },
        {
          name: 'get_recommendations',
          description: 'Get track recommendations based on seed tracks, artists, or genres',
          inputSchema: {
            type: 'object',
            properties: {
              seed_tracks: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Spotify track IDs or URIs'
              },
              seed_artists: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of Spotify artist IDs or URIs'
              },
              seed_genres: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of genre names'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of recommendations (1-100)',
                minimum: 1,
                maximum: 100,
                default: 20
              }
            },
            required: []
          },
        },
        {
          name: 'get_artist_albums',
          description: 'Get Spotify catalog information about an artist\'s albums',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the artist'
              },
              include_groups: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['album', 'single', 'appears_on', 'compilation']
                },
                description: 'Optional. Filter by album types'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of albums to return (1-50)',
                minimum: 1,
                maximum: 50,
                default: 20
              },
              offset: {
                type: 'number',
                description: 'The index of the first album to return',
                minimum: 0,
                default: 0
              }
            },
            required: ['id']
          },
        },
        {
          name: 'get_artist_top_tracks',
          description: 'Get Spotify catalog information about an artist\'s top tracks',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the artist'
              },
              market: {
                type: 'string',
                description: 'Optional. An ISO 3166-1 alpha-2 country code'
              }
            },
            required: ['id']
          },
        },
        {
          name: 'get_artist_related_artists',
          description: 'Get Spotify catalog information about artists similar to a given artist',
          inputSchema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'The Spotify ID or URI for the artist'
              }
            },
            required: ['id']
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'get_access_token': {
            const token = await this.getAccessToken();
            return {
              content: [{ type: 'text', text: token }],
            };
          }

          case 'search': {
            if (!request.params.arguments || 
                typeof request.params.arguments.query !== 'string' ||
                !['track', 'album', 'artist', 'playlist'].includes(request.params.arguments.type as string)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid search arguments. Required: query (string) and type (track|album|artist|playlist)'
              );
            }
            const args: SearchArgs = {
              query: request.params.arguments.query,
              type: request.params.arguments.type as 'track' | 'album' | 'artist' | 'playlist',
              limit: typeof request.params.arguments.limit === 'number' ? request.params.arguments.limit : 20
            };
            const { query, type, limit } = args;
            const results = await this.makeApiRequest(`/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
            };
          }

          case 'get_multiple_artists': {
            if (!request.params.arguments || !Array.isArray(request.params.arguments.ids)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid arguments. Required: ids (array of strings)'
              );
            }
            
            const { ids } = request.params.arguments;
            
            if (ids.length === 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'At least one artist ID must be provided'
              );
            }

            if (ids.length > 50) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Maximum of 50 artist IDs allowed'
              );
            }

            // Extract IDs from URIs if provided
            const artistIds = ids.map(id => 
              id.startsWith('spotify:artist:') ? id.split(':')[2] : id
            );

            const artists = await this.makeApiRequest(`/artists?ids=${artistIds.join(',')}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(artists, null, 2) }],
            };
          }

          case 'get_artist': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid artist arguments. Required: id (string)'
              );
            }
            const { id } = request.params.arguments;
            // Extract ID from URI if provided
            const artistId = id.startsWith('spotify:artist:') ? id.split(':')[2] : id;
            const artist = await this.makeApiRequest(`/artists/${artistId}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(artist, null, 2) }],
            };
          }

          case 'get_album_tracks': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid arguments. Required: id (string)'
              );
            }

            const args: AlbumTracksArgs = {
              id: request.params.arguments.id,
              limit: typeof request.params.arguments.limit === 'number' ? request.params.arguments.limit : 20,
              offset: typeof request.params.arguments.offset === 'number' ? request.params.arguments.offset : 0
            };
            const { id, limit = 20, offset = 0 } = args;

            // Extract ID from URI if provided
            const albumId = id.startsWith('spotify:album:') ? id.split(':')[2] : id;

            // Validate limit and offset
            if (limit < 1 || limit > 50) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Limit must be between 1 and 50'
              );
            }

            if (offset < 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Offset must be non-negative'
              );
            }

            const tracks = await this.makeApiRequest(
              `/albums/${albumId}/tracks?limit=${limit}&offset=${offset}`
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(tracks, null, 2) }],
            };
          }

          case 'get_multiple_albums': {
            if (!request.params.arguments || !Array.isArray(request.params.arguments.ids)) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid arguments. Required: ids (array of strings)'
              );
            }
            
            const { ids } = request.params.arguments;
            
            if (ids.length === 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'At least one album ID must be provided'
              );
            }

            if (ids.length > 20) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Maximum of 20 album IDs allowed'
              );
            }

            // Extract IDs from URIs if provided
            const albumIds = ids.map(id => 
              id.startsWith('spotify:album:') ? id.split(':')[2] : id
            );

            const albums = await this.makeApiRequest(`/albums?ids=${albumIds.join(',')}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(albums, null, 2) }],
            };
          }

          case 'get_album': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid album arguments. Required: id (string)'
              );
            }
            const { id } = request.params.arguments;
            // Extract ID from URI if provided
            const albumId = id.startsWith('spotify:album:') ? id.split(':')[2] : id;
            const album = await this.makeApiRequest(`/albums/${albumId}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(album, null, 2) }],
            };
          }

          case 'get_track': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid track arguments. Required: id (string)'
              );
            }
            const { id } = request.params.arguments;
            // Extract ID from URI if provided
            const trackId = id.startsWith('spotify:track:') ? id.split(':')[2] : id;
            const track = await this.makeApiRequest(`/tracks/${trackId}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(track, null, 2) }],
            };
          }

          case 'get_available_genres': {
            const genres = await this.makeApiRequest('/recommendations/available-genre-seeds');
            return {
              content: [{ type: 'text', text: JSON.stringify(genres, null, 2) }],
            };
          }

          case 'get_new_releases': {
            if (!request.params.arguments) {
              request.params.arguments = {};
            }

            const { 
              country,
              limit = 20,
              offset = 0
            } = request.params.arguments || {};

            // Validate limit and offset
            if (typeof limit !== 'number' || limit < 1 || limit > 50) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Limit must be between 1 and 50'
              );
            }

            if (typeof offset !== 'number' || offset < 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Offset must be non-negative'
              );
            }

            // Build query parameters
            const params = new URLSearchParams();
            params.set('limit', limit.toString());
            params.set('offset', offset.toString());
            if (typeof country === 'string') {
              params.set('country', country);
            }

            const releases = await this.makeApiRequest(`/browse/new-releases?${params.toString()}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(releases, null, 2) }],
            };
          }

          case 'get_recommendations': {
            if (!request.params.arguments) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid recommendations arguments'
              );
            }
            const args: RecommendationsArgs = {
              seed_tracks: Array.isArray(request.params.arguments.seed_tracks) ? request.params.arguments.seed_tracks : [],
              seed_artists: Array.isArray(request.params.arguments.seed_artists) ? request.params.arguments.seed_artists : [],
              seed_genres: Array.isArray(request.params.arguments.seed_genres) ? request.params.arguments.seed_genres : [],
              limit: typeof request.params.arguments.limit === 'number' ? request.params.arguments.limit : 20
            };
            const { 
              seed_tracks = [], 
              seed_artists = [], 
              seed_genres = [], 
              limit = 20 
            } = args;
            
            // Validate at least one seed is provided
            if (seed_tracks.length + seed_artists.length + seed_genres.length === 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'At least one seed (tracks, artists, or genres) must be provided'
              );
            }

            // Extract IDs from URIs if provided
            const trackIds = seed_tracks.map((id) => 
              typeof id === 'string' && id.startsWith('spotify:track:') ? id.split(':')[2] : id
            );
            const artistIds = seed_artists.map((id) =>
              typeof id === 'string' && id.startsWith('spotify:artist:') ? id.split(':')[2] : id
            );

            // Build query parameters with proper encoding
            const params = new URLSearchParams();
            if (trackIds.length) params.set('seed_tracks', trackIds.join(','));
            if (artistIds.length) params.set('seed_artists', artistIds.join(','));
            if (seed_genres.length) params.set('seed_genres', seed_genres.join(','));
            params.set('limit', limit.toString());

            const url = `/recommendations?${params.toString()}`;
            console.error('Making request to:', `${BASE_URL}${url}`); // Debug log
            const recommendations = await this.makeApiRequest(url);
            return {
              content: [{ type: 'text', text: JSON.stringify(recommendations, null, 2) }],
            };
          }

          case 'get_artist_related_artists': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid arguments. Required: id (string)'
              );
            }

            const { id } = request.params.arguments;

            // Extract ID from URI if provided
            const artistId = id.startsWith('spotify:artist:') ? id.split(':')[2] : id;

            const relatedArtists = await this.makeApiRequest(`/artists/${artistId}/related-artists/`);
            return {
              content: [{ type: 'text', text: JSON.stringify(relatedArtists, null, 2) }],
            };
          }

          case 'get_artist_top_tracks': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid arguments. Required: id (string)'
              );
            }

            const args: ArtistTopTracksArgs = {
              id: request.params.arguments.id,
              market: typeof request.params.arguments.market === 'string' ? 
                request.params.arguments.market : undefined
            };

            const { id, market } = args;

            // Extract ID from URI if provided
            const artistId = id.startsWith('spotify:artist:') ? id.split(':')[2] : id;

            // Build query parameters
            const params = new URLSearchParams();
            if (market) {
              params.set('market', market);
            }

            // Market is required for top tracks
            if (!market) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'market parameter is required for top tracks'
              );
            }

            const topTracks = await this.makeApiRequest(
              `/artists/${artistId}/top-tracks?market=${market}`
            );
            return {
              content: [{ type: 'text', text: JSON.stringify(topTracks, null, 2) }],
            };
          }

          case 'get_artist_albums': {
            if (!request.params.arguments || typeof request.params.arguments.id !== 'string') {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Invalid arguments. Required: id (string)'
              );
            }

            const args: ArtistAlbumsArgs = {
              id: request.params.arguments.id,
              include_groups: Array.isArray(request.params.arguments.include_groups) ? 
                request.params.arguments.include_groups : undefined,
              limit: typeof request.params.arguments.limit === 'number' ? 
                request.params.arguments.limit : 20,
              offset: typeof request.params.arguments.offset === 'number' ? 
                request.params.arguments.offset : 0
            };

            const { id, include_groups, limit = 20, offset = 0 } = args;

            // Extract ID from URI if provided
            const artistId = id.startsWith('spotify:artist:') ? id.split(':')[2] : id;

            // Validate limit and offset
            if (limit < 1 || limit > 50) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Limit must be between 1 and 50'
              );
            }

            if (offset < 0) {
              throw new McpError(
                ErrorCode.InvalidParams,
                'Offset must be non-negative'
              );
            }

            // Build query parameters
            const params = new URLSearchParams();
            params.set('limit', limit.toString());
            params.set('offset', offset.toString());
            if (include_groups) {
              params.set('include_groups', include_groups.join(','));
            }

            const albums = await this.makeApiRequest(`/artists/${artistId}/albums?${params.toString()}`);
            return {
              content: [{ type: 'text', text: JSON.stringify(albums, null, 2) }],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Unexpected error: ${error}`
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
