'use strict';

// Small Subsonic/OpenSubsonic client used by the local Mineradio gateway.
// Credentials deliberately stay in this process; callers only receive the
// normalized media records and same-origin proxy URLs.
const crypto = require('crypto');

const SUBSONIC_VERSION = '1.16.1';
const CLIENT_NAME = 'Mineradio';

class NavidromeError extends Error {
  constructor(message, code, statusCode, details) {
    super(message || code || 'NAVIDROME_ERROR');
    this.name = 'NavidromeError';
    this.code = code || 'NAVIDROME_ERROR';
    this.statusCode = Number(statusCode) || 502;
    this.details = details || null;
  }
}

function text(value, fallback) {
  const out = String(value == null ? '' : value).trim();
  return out || (fallback == null ? '' : String(fallback));
}

function number(value, fallback) {
  const out = Number(value);
  return Number.isFinite(out) ? out : (fallback == null ? 0 : fallback);
}

function normalizeBaseUrl(value) {
  const raw = text(value).replace(/\/+$/, '');
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    throw new NavidromeError('Navidrome 地址无效', 'NAVIDROME_INVALID_URL', 400);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new NavidromeError('Navidrome 仅支持 HTTP 或 HTTPS', 'NAVIDROME_INVALID_PROTOCOL', 400);
  }
  parsed.hash = '';
  parsed.search = '';
  const clean = parsed.toString().replace(/\/+$/, '');
  return /\/rest$/i.test(clean) ? clean.slice(0, -5) : clean;
}

function normalizeConfig(input) {
  input = input || {};
  return {
    id: text(input.id || input.profileId),
    name: text(input.name || input.label || input.username || 'Navidrome'),
    url: normalizeBaseUrl(input.url || input.baseUrl || input.serverUrl),
    username: text(input.username || input.user),
    password: text(input.password),
    token: text(input.token),
    salt: text(input.salt),
    apiKey: text(input.apiKey),
    enabled: input.enabled !== false,
    createdAt: number(input.createdAt),
    updatedAt: number(input.updatedAt),
  };
}

function publicConfig(input) {
  const cfg = normalizeConfig(input);
  return {
    id: cfg.id,
    name: cfg.name,
    url: cfg.url,
    username: cfg.username,
    enabled: cfg.enabled,
    configured: !!(cfg.url && cfg.username && (cfg.password || cfg.token || cfg.apiKey)),
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  };
}

function mapArtist(raw) {
  raw = raw || {};
  const id = text(raw.id || raw.artistId);
  return {
    id,
    artistId: id,
    name: text(raw.name || raw.artist),
    cover: text(raw.coverArt || raw.cover),
    albumCount: number(raw.albumCount),
    songCount: number(raw.songCount),
    provider: 'navidrome',
    source: 'navidrome',
  };
}

function mapAlbum(raw) {
  raw = raw || {};
  const id = text(raw.id || raw.albumId);
  return {
    id,
    albumId: id,
    name: text(raw.name || raw.album),
    album: text(raw.name || raw.album),
    artist: text(raw.artist || raw.albumArtist),
    artistId: text(raw.artistId),
    albumArtist: text(raw.albumArtist || raw.artist),
    cover: text(raw.coverArt || raw.cover),
    year: number(raw.year),
    songCount: number(raw.songCount || raw.song_count),
    playCount: number(raw.playCount),
    provider: 'navidrome',
    source: 'navidrome',
  };
}

function mapTrack(raw) {
  raw = raw || {};
  const id = text(raw.id || raw.songId);
  const artist = text(raw.artist || raw.artistName || raw.albumArtist);
  const album = text(raw.album || raw.albumName);
  return {
    id,
    providerSongId: id,
    provider: 'navidrome',
    source: 'navidrome',
    type: 'navidrome',
    name: text(raw.title || raw.name || id),
    title: text(raw.title || raw.name || id),
    artist,
    artists: artist ? [{ id: text(raw.artistId), name: artist }] : [],
    artistId: text(raw.artistId),
    album,
    albumId: text(raw.albumId),
    albumArtist: text(raw.albumArtist || artist),
    albumMid: text(raw.albumId),
    cover: text(raw.coverArt || raw.cover),
    duration: Math.max(0, Math.round(number(raw.duration) * 1000)),
    track: number(raw.track || raw.trackNumber),
    disc: number(raw.discNumber || raw.disc),
    year: number(raw.year),
    genre: text(raw.genre),
    bitRate: number(raw.bitRate || raw.bitrate),
    suffix: text(raw.suffix || raw.format),
    contentType: text(raw.contentType),
    size: number(raw.size),
    starred: !!raw.starred,
    playable: true,
  };
}

function mapPlaylist(raw) {
  raw = raw || {};
  const id = text(raw.id || raw.playlistId);
  return {
    id,
    provider: 'navidrome',
    source: 'navidrome',
    name: text(raw.name || id),
    cover: text(raw.coverArt || raw.cover),
    trackCount: number(raw.songCount || raw.trackCount),
    duration: number(raw.duration),
    owner: text(raw.owner),
    public: !!raw.public,
    created: text(raw.created),
    changed: text(raw.changed),
    readOnly: false,
  };
}

function normalizeSearchPayload(body) {
  body = body || {};
  const result = body.searchResult3 || body.searchResult || body;
  const songs = Array.isArray(result.song) ? result.song.map(mapTrack).filter(item => item.id) : [];
  const albums = Array.isArray(result.album) ? result.album.map(mapAlbum).filter(item => item.id) : [];
  const artists = Array.isArray(result.artist) ? result.artist.map(mapArtist).filter(item => item.id) : [];
  return {
    songs,
    tracks: songs,
    albums,
    artists,
    total: Math.max(number(result.songCount), songs.length),
  };
}

class NavidromeClient {
  constructor(config, options) {
    options = options || {};
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = Math.max(1500, number(options.timeoutMs, 12000));
    this.config = normalizeConfig(config);
  }

  setConfig(config) {
    this.config = normalizeConfig(config);
    return this;
  }

  get publicConfig() {
    return publicConfig(this.config);
  }

  get configured() {
    return !!(this.config.url && this.config.username && (this.config.password || this.config.token || this.config.apiKey));
  }

  restBase() {
    return this.config.url ? this.config.url + '/rest' : '';
  }

  authParams() {
    const cfg = this.config;
    const params = new URLSearchParams();
    if (cfg.apiKey) {
      params.set('apiKey', cfg.apiKey);
    } else {
      const salt = cfg.salt || crypto.randomBytes(8).toString('hex');
      const token = cfg.token || crypto.createHash('md5').update(cfg.password + salt).digest('hex');
      params.set('u', cfg.username);
      params.set('t', token);
      params.set('s', salt);
    }
    params.set('v', SUBSONIC_VERSION);
    params.set('c', CLIENT_NAME);
    params.set('f', 'json');
    return params;
  }

  buildUrl(endpoint, params) {
    if (!this.configured) throw new NavidromeError('尚未配置 Navidrome 账号', 'NAVIDROME_NOT_CONFIGURED', 401);
    const url = new URL(this.restBase() + '/' + String(endpoint || '').replace(/^\/+/, '') + '.view');
    const auth = this.authParams();
    auth.forEach((value, key) => url.searchParams.set(key, value));
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) value.forEach(item => url.searchParams.append(key, String(item)));
        else url.searchParams.set(key, String(value));
      });
    }
    return url;
  }

  async request(endpoint, params, options) {
    options = options || {};
    if (typeof this.fetchImpl !== 'function') throw new NavidromeError('当前 Node 环境不支持 fetch', 'NAVIDROME_FETCH_UNAVAILABLE', 500);
    const target = this.buildUrl(endpoint, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, number(options.timeoutMs, this.timeoutMs)));
    try {
      const response = await this.fetchImpl(target, {
        method: options.method || 'GET',
        headers: Object.assign({ Accept: 'application/json' }, options.headers || {}),
        signal: controller.signal,
      });
      let body = null;
      try { body = await response.json(); } catch (_) { body = null; }
      if (!response.ok) {
        throw new NavidromeError('Navidrome 请求失败：HTTP ' + response.status, 'NAVIDROME_HTTP_' + response.status, response.status, body);
      }
      const root = body && (body['subsonic-response'] || body.subsonicResponse || body);
      if (!root || String(root.status || '').toLowerCase() === 'failed') {
        const error = root && root.error || {};
        throw new NavidromeError(text(error.message, 'Navidrome 返回失败'), text(error.code, 'NAVIDROME_UPSTREAM_ERROR'), 502, body);
      }
      return root;
    } catch (error) {
      if (error instanceof NavidromeError) throw error;
      if (error && error.name === 'AbortError') throw new NavidromeError('Navidrome 请求超时', 'NAVIDROME_TIMEOUT', 504);
      throw new NavidromeError(error && error.message || '无法连接 Navidrome', 'NAVIDROME_NETWORK_ERROR', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  async requestBinary(endpoint, params, options) {
    options = options || {};
    const target = this.buildUrl(endpoint, params);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, number(options.timeoutMs, this.timeoutMs)));
    try {
      const response = await this.fetchImpl(target, {
        method: options.method || 'GET',
        headers: Object.assign({}, options.headers || {}),
        signal: controller.signal,
      });
      if (!response.ok) throw new NavidromeError('Navidrome 媒体请求失败：HTTP ' + response.status, 'NAVIDROME_HTTP_' + response.status, response.status);
      // Subsonic binary endpoints may encode authentication/provider errors as
      // a JSON document with HTTP 200.  Never forward that document as audio or
      // cover bytes to Chromium.
      const contentType = String(response.headers && response.headers.get && response.headers.get('content-type') || '').toLowerCase();
      if (/json/.test(contentType) && typeof response.json === 'function') {
        let body = null;
        try { body = await response.json(); } catch (_) { body = null; }
        const root = body && (body['subsonic-response'] || body.subsonicResponse || body);
        const error = root && root.error || {};
        throw new NavidromeError(text(error.message, 'Navidrome 媒体请求返回了错误'), text(error.code, 'NAVIDROME_UPSTREAM_ERROR'), 502, body);
      }
      return response;
    } catch (error) {
      if (error instanceof NavidromeError) throw error;
      if (error && error.name === 'AbortError') throw new NavidromeError('Navidrome 媒体请求超时', 'NAVIDROME_TIMEOUT', 504);
      throw new NavidromeError(error && error.message || '无法连接 Navidrome', 'NAVIDROME_NETWORK_ERROR', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  streamUrl(id, params) {
    return this.buildUrl('stream', Object.assign({ id: text(id), estimateContentLength: 'true' }, params || {})).toString();
  }

  async ping() {
    const root = await this.request('ping');
    return {
      ok: true,
      serverVersion: text(root.version),
      apiVersion: SUBSONIC_VERSION,
      type: text(root.type, 'navidrome'),
      openSubsonic: !!(root.openSubsonic || root.serverType === 'navidrome'),
    };
  }

  async search(query, offset, limit) {
    const count = Math.max(1, Math.min(200, number(limit, 40)));
    const start = Math.max(0, number(offset));
    return normalizeSearchPayload(await this.request('search3', {
      query: text(query),
      songCount: count,
      songOffset: start,
      albumCount: Math.min(100, count),
      albumOffset: start,
      artistCount: Math.min(100, count),
      artistOffset: start,
    }));
  }

  async albumListPage(type, size, offset) {
    const root = await this.request('getAlbumList2', {
      type: text(type, 'newest'),
      size: Math.max(1, Math.min(500, number(size, 50))),
      offset: Math.max(0, number(offset)),
    });
    const payload = root.albumList2 || root.albumList || {};
    const list = Array.isArray(payload.album) ? payload.album : [];
    const albums = list.map(mapAlbum).filter(item => item.id);
    const start = Math.max(0, number(offset));
    const pageSize = Math.max(1, Math.min(500, number(size, 50)));
    const reportedTotal = number(payload.total) || number(payload.count) || 0;
    return {
      albums,
      total: reportedTotal || null,
      offset: start,
      limit: pageSize,
      nextOffset: start + list.length,
      // Some Subsonic implementations omit `total`; a full page is still a
      // useful continuation hint and the next request will terminate cleanly
      // with an empty page when the catalogue ends.
      hasMore: reportedTotal > start + list.length || (!reportedTotal && list.length >= pageSize),
    };
  }

  async albumList(type, size, offset) {
    return (await this.albumListPage(type, size, offset)).albums;
  }

  async randomSongs(size) {
    const root = await this.request('getRandomSongs', { size: Math.max(1, Math.min(500, number(size, 30))) });
    const list = root.randomSongs && root.randomSongs.song || [];
    return Array.isArray(list) ? list.map(mapTrack).filter(item => item.id) : [];
  }

  async starred(size) {
    const root = await this.request('getStarred2', { count: Math.max(1, Math.min(500, number(size, 100))) });
    const list = root.starred2 && root.starred2.song || root.starred && root.starred.song || [];
    return Array.isArray(list) ? list.map(mapTrack).filter(item => item.id) : [];
  }

  async recentlyPlayed(size) {
    const root = await this.request('getRecentlyPlayed', { size: Math.max(1, Math.min(500, number(size, 50))) });
    const list = root.recentlyPlayed && root.recentlyPlayed.entry || [];
    return Array.isArray(list) ? list.map(mapTrack).filter(item => item.id) : [];
  }

  async playlists() {
    const root = await this.request('getPlaylists');
    const list = root.playlists && root.playlists.playlist || [];
    return Array.isArray(list) ? list.map(mapPlaylist).filter(item => item.id) : [];
  }

  async playlist(id) {
    const root = await this.request('getPlaylist', { id: text(id) });
    const payload = root.playlist || {};
    const tracks = Array.isArray(payload.entry) ? payload.entry.map(mapTrack).filter(item => item.id) : [];
    return { playlist: mapPlaylist(payload), tracks, total: tracks.length };
  }

  async album(id) {
    const root = await this.request('getAlbum', { id: text(id) });
    const payload = root.album || {};
    const songs = Array.isArray(payload.song) ? payload.song.map(mapTrack).filter(item => item.id) : [];
    const album = mapAlbum(payload);
    if (!album.cover && songs[0] && songs[0].cover) album.cover = songs[0].cover;
    if (!album.songCount) album.songCount = songs.length;
    return { album, songs, tracks: songs, total: songs.length };
  }

  async artist(id) {
    const root = await this.request('getArtist', { id: text(id) });
    const payload = root.artist || {};
    const albums = Array.isArray(payload.album) ? payload.album.map(mapAlbum).filter(item => item.id) : [];
    // Subsonic's getArtist response contains album summaries rather than a
    // flat hot-song list.  Resolve those summaries so Mineradio's artist
    // detail view can still play the artist's catalogue.
    const albumResults = await Promise.allSettled(albums.slice(0, 24).map(album => this.album(album.id)));
    const seen = new Set();
    const songs = [];
    albumResults.forEach(result => {
      if (result.status !== 'fulfilled') return;
      (result.value && result.value.tracks || []).forEach(song => {
        if (!song || !song.id || seen.has(song.id)) return;
        seen.add(song.id);
        songs.push(song);
      });
    });
    return { artist: mapArtist(payload), albums, songs, tracks: songs, total: songs.length || albums.length };
  }

  async song(id) {
    const root = await this.request('getSong', { id: text(id) });
    return mapTrack(root.song || {});
  }

  async lyrics(id, artist, title) {
    try {
      const root = await this.request('getLyricsBySongId', { id: text(id) });
      const payload = root.lyricsList || root.lyrics || root;
      const structured = payload && (payload.structuredLyrics || payload.structured_lyrics);
      const firstStructured = Array.isArray(structured) ? structured[0] : structured;
      const synced = (firstStructured && (firstStructured.line || firstStructured.lines))
        || (payload && (payload.line || payload.lines))
        || [];
      const plain = text(
        payload && (payload.lyrics || payload.value)
        || firstStructured && (firstStructured.lyrics || firstStructured.value)
      ) || (Array.isArray(synced) ? synced.map(line => text(line && (line.value || line.text))).filter(Boolean).join('\n') : '');
      return { provider: 'navidrome', songId: text(id), raw: payload, lyrics: plain, synced: Array.isArray(synced) ? synced : [] };
    } catch (error) {
      // Older Subsonic servers do not expose getLyricsBySongId and report
      // either a numeric Subsonic error code or a provider-specific method
      // error.  Fall back to the artist/title endpoint for those cases while
      // still surfacing network and authentication failures to the gateway.
      const code = String(error && error.code || '').toUpperCase();
      if (!['NAVIDROME_UPSTREAM_ERROR', 'SONG_NOT_FOUND', 'METHOD_NOT_FOUND', '10', '20'].includes(code)
        && !/LYRIC|METHOD.*NOT|SONG.*NOT/.test(code)) throw error;
      const root = await this.request('getLyrics', { artist: text(artist), title: text(title) });
      const payload = root.lyrics || {};
      return { provider: 'navidrome', songId: text(id), raw: payload, lyrics: payload.value || payload.lyrics || '', synced: [] };
    }
  }

  async setStar(id, starred) {
    const endpoint = starred ? 'star' : 'unstar';
    await this.request(endpoint, { id: text(id) });
    return { ok: true, id: text(id), starred: !!starred };
  }

  async scrobble(id, submission) {
    await this.request('scrobble', { id: text(id), submission: submission === false ? 'false' : 'true', time: Date.now() });
    return { ok: true, id: text(id), submission: submission !== false };
  }

  async createPlaylist(name, songIds) {
    const root = await this.request('createPlaylist', { name: text(name, 'Mineradio 歌单'), songId: (songIds || []).map(text) });
    return mapPlaylist(root.playlist || {});
  }

  async updatePlaylist(id, fields) {
    const params = Object.assign({ playlistId: text(id) }, fields || {});
    if (Array.isArray(params.songId)) params.songId = params.songId.map(text);
    const root = await this.request('updatePlaylist', params);
    return mapPlaylist(root.playlist || { id: text(id), name: params.name });
  }

  async deletePlaylist(id) {
    await this.request('deletePlaylist', { id: text(id) });
    return { ok: true, id: text(id) };
  }
}

module.exports = {
  NavidromeClient,
  NavidromeError,
  normalizeConfig,
  publicConfig,
  mapTrack,
  mapAlbum,
  mapArtist,
  mapPlaylist,
  normalizeSearchPayload,
  SUBSONIC_VERSION,
};
