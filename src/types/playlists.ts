import { MarketParams, PaginationParams } from './common.js';

export interface PlaylistArgs extends MarketParams {
  id: string;
}

export interface PlaylistTracksArgs extends MarketParams, PaginationParams {
  id: string;
  fields?: string;
}

export interface PlaylistItemsArgs extends MarketParams, PaginationParams {
  id: string;
  fields?: string;
}

export interface ModifyPlaylistArgs {
  id: string;
  name?: string;
  public?: boolean;
  collaborative?: boolean;
  description?: string;
}
