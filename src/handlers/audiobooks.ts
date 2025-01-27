import { SpotifyApi } from '../utils/api.js';
import { AudiobookArgs } from '../types/audiobooks.js';

export class AudiobooksHandler {
  constructor(private api: SpotifyApi) {}

  private extractAudiobookId(id: string): string {
    return id.startsWith('spotify:audiobook:') ? id.split(':')[2] : id;
  }

  async getAudiobook(args: AudiobookArgs) {
    const audiobookId = this.extractAudiobookId(args.id);
    const { market } = args;

    const params = { market };
    return this.api.makeRequest(
      `/audiobooks/${audiobookId}${this.api.buildQueryString(params)}`
    );
  }
}
