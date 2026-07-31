'use strict';

// A deliberately small local-library index. The target library is a few
// hundred files, so a versioned JSON index keeps the packaged app simple and
// avoids native database modules while still supporting incremental scans.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.oga', '.opus', '.wav', '.webm']);
const COVER_NAMES = ['cover.jpg', 'cover.jpeg', 'cover.png', 'folder.jpg', 'folder.jpeg', 'folder.png', 'front.jpg', 'front.jpeg', 'front.png'];
const LOCAL_LIBRARY_METADATA_VERSION = 2;

function text(value, fallback) {
  const out = String(value == null ? '' : value).trim();
  return out || (fallback == null ? '' : String(fallback));
}

const EMBEDDED_LYRIC_TAG_RE = /^(?:LYRICS|UNSYNCEDLYRICS|SYNCEDLYRICS|LYRICS3|USLT|SYLT)(?::.*)?$/i;

function lyricTimestamp(value) {
  const milliseconds = Math.max(0, Math.round(number(value)));
  const minutes = Math.floor(milliseconds / 60000);
  const seconds = Math.floor(milliseconds / 1000) % 60;
  const fraction = milliseconds % 1000;
  return '[' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(fraction).padStart(3, '0') + ']';
}

function lyricText(value) {
  if (Array.isArray(value)) return value.map(item => lyricText(item)).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    if (Array.isArray(value.syncText) && value.syncText.length) {
      const synced = value.syncText.map(item => {
        const line = text(item && item.text);
        return line ? lyricTimestamp(item && item.timestamp) + line : '';
      }).filter(Boolean).join('\n');
      if (synced) return synced;
    }
    return text(value.text || value.value || value.lyrics);
  }
  return text(value);
}

function embeddedLyrics(metadata) {
  metadata = metadata || {};
  const native = metadata.native || {};
  const entries = [];
  Object.keys(native).forEach(format => {
    const tags = Array.isArray(native[format]) ? native[format] : [native[format]];
    tags.forEach(tag => {
      const id = text(tag && tag.id).toUpperCase();
      if (EMBEDDED_LYRIC_TAG_RE.test(id)) entries.push({ id, value: tag.value });
    });
  });

  const priorities = ['SYNCEDLYRICS', 'LYRICS', 'UNSYNCEDLYRICS', 'LYRICS3', 'SYLT', 'USLT'];
  for (const priority of priorities) {
    const value = entries
      .filter(entry => entry.id === priority || entry.id.startsWith(priority + ':'))
      .map(entry => lyricText(entry.value))
      .filter(Boolean)
      .join('\n');
    if (value) return value;
  }
  return lyricText(metadata.common && metadata.common.lyrics);
}

function number(value, fallback) {
  const out = Number(value);
  return Number.isFinite(out) ? out : (fallback == null ? 0 : fallback);
}

function normalizedPath(value) {
  try { return path.resolve(String(value || '')).replace(/[\\/]+$/, ''); } catch (_) { return ''; }
}

function pathKey(value) {
  return normalizedPath(value).toLowerCase();
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function safeFileName(value) {
  return String(value || '').replace(/[^a-z0-9_.-]+/gi, '_').slice(0, 80) || 'cover';
}

function titleFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[._]+/g, ' ').trim() || path.basename(filePath);
}

function artistParts(value) {
  if (Array.isArray(value)) return value.map(item => text(item && (item.name || item), '')).filter(Boolean);
  return text(value).split(/\s*(?:\/|、|,|＆|&)\s*/).map(item => item.trim()).filter(Boolean);
}

function mapPictureType(picture) {
  const format = text(picture && picture.format).toLowerCase();
  if (format.includes('png')) return '.png';
  if (format.includes('webp')) return '.webp';
  return '.jpg';
}

function normalizeRoots(roots) {
  const out = [];
  const seen = new Set();
  (Array.isArray(roots) ? roots : [roots]).forEach(value => {
    const root = normalizedPath(value);
    const key = pathKey(root);
    if (!root || !key || seen.has(key)) return;
    seen.add(key);
    out.push(root);
  });
  return out;
}

function publicTrack(raw) {
  raw = raw || {};
  const copy = Object.assign({}, raw);
  delete copy.filePath;
  delete copy.coverFile;
  delete copy.lyricFile;
  copy.provider = 'local';
  copy.source = 'local';
  copy.type = 'local';
  copy.localId = text(raw.id);
  copy.id = text(raw.id);
  copy.localKey = text(raw.id);
  copy.localUrl = '/api/library/stream?id=' + encodeURIComponent(copy.id);
  copy.playable = true;
  if (raw.coverFile || raw.cover) copy.cover = raw.cover || '/api/local/cover?id=' + encodeURIComponent(copy.id);
  else copy.cover = '';
  return copy;
}

function publicPlaylist(raw) {
  raw = raw || {};
  // Keep the opaque track IDs on the server-side representation.  They are
  // not filesystem paths or credentials and are required to resolve a local
  // playlist after the index is reloaded.  The client may ignore this field,
  // while getPlaylist() uses it to materialize the current track metadata.
  const trackIds = Array.isArray(raw.trackIds) ? raw.trackIds.map(text).filter(Boolean) : [];
  return {
    id: text(raw.id),
    provider: 'local',
    source: 'local',
    name: text(raw.name, '本地音乐'),
    cover: text(raw.cover),
    trackCount: trackIds.length || number(raw.trackCount),
    trackIds,
    creator: 'Mineradio 本地媒体库',
    readOnly: raw.readOnly !== false,
    auto: raw.auto !== false,
    kind: text(raw.kind, 'auto'),
  };
}

class LocalLibrary {
  constructor(options) {
    options = options || {};
    this.indexFile = path.resolve(options.indexFile || path.join(__dirname, 'data', 'local-library.json'));
    this.cacheDir = path.resolve(options.cacheDir || path.join(path.dirname(this.indexFile), 'local-library-cache'));
    this.parseFileImpl = options.parseFile || null;
    if (!this.parseFileImpl) {
      try {
        const mm = require('music-metadata');
        this.parseFileImpl = mm.parseFile;
      } catch (_) {
        this.parseFileImpl = null;
      }
    }
    this.roots = [];
    this.tracks = [];
    this.playlists = [];
    this.favorites = new Set();
    this.loaded = false;
    this.scanState = { running: false, queued: false, progress: 0, total: 0, current: '', startedAt: 0, finishedAt: 0, error: '', added: 0, updated: 0, removed: 0 };
    this.watchers = new Map();
    this.scanTimer = null;
    this.scanPromise = null;
  }

  async init() {
    await this.load();
    if (this.parseFileImpl && this.roots.length && this.tracks.some(item => number(item.metadataVersion) !== LOCAL_LIBRARY_METADATA_VERSION)) {
      await this.scan({ force: false });
    }
    this.refreshWatchers();
    return this;
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(this.indexFile, 'utf8'));
      if (parsed && parsed.version === 1) {
        this.roots = normalizeRoots(parsed.roots || []);
        this.tracks = Array.isArray(parsed.tracks) ? parsed.tracks.filter(item => item && item.id && item.filePath) : [];
        this.favorites = new Set(Array.isArray(parsed.favorites) ? parsed.favorites.map(text) : []);
        this.tracks.forEach(item => { item.starred = this.favorites.has(item.id); });
        this.buildPlaylists();
      }
    } catch (_) {
      this.roots = [];
      this.tracks = [];
      this.playlists = [];
    }
    this.loaded = true;
    return this;
  }

  async save() {
    await fs.promises.mkdir(path.dirname(this.indexFile), { recursive: true });
    const payload = {
      version: 1,
      savedAt: Date.now(),
      roots: this.roots.slice(),
      tracks: this.tracks,
      favorites: Array.from(this.favorites),
    };
    const temp = this.indexFile + '.tmp-' + process.pid;
    await fs.promises.writeFile(temp, JSON.stringify(payload), 'utf8');
    await fs.promises.rename(temp, this.indexFile);
  }

  status() {
    return {
      ok: true,
      version: 1,
      roots: this.roots.map(root => ({ path: root, name: path.basename(root) || root, available: fs.existsSync(root) })),
      trackCount: this.tracks.length,
      playlistCount: this.playlists.length,
      scanning: !!this.scanState.running,
      scan: Object.assign({}, this.scanState),
      parser: this.parseFileImpl ? 'music-metadata' : 'filename-fallback',
      updatedAt: this.scanState.finishedAt || 0,
    };
  }

  async setRoots(roots, options) {
    options = options || {};
    this.roots = normalizeRoots(roots);
    this.refreshWatchers();
    if (options.scan !== false) await this.scan({ force: !!options.force });
    else await this.save();
    return this.status();
  }

  async addRoot(root, options) {
    return this.setRoots(this.roots.concat([root]), options);
  }

  async removeRoot(root) {
    const key = pathKey(root);
    this.roots = this.roots.filter(item => pathKey(item) !== key);
    this.refreshWatchers();
    await this.scan({ force: true });
    return this.status();
  }

  refreshWatchers() {
    const wanted = new Map(this.roots.map(root => [pathKey(root), root]));
    for (const [key, watcher] of this.watchers.entries()) {
      if (!wanted.has(key)) {
        try { watcher.close(); } catch (_) { }
        this.watchers.delete(key);
      }
    }
    for (const [key, root] of wanted.entries()) {
      if (this.watchers.has(key) || !fs.existsSync(root)) continue;
      try {
        const watcher = fs.watch(root, { recursive: true }, () => this.queueScan());
        watcher.on('error', () => {
          try { watcher.close(); } catch (_) { }
          this.watchers.delete(key);
        });
        this.watchers.set(key, watcher);
      } catch (_) {
        try {
          const watcher = fs.watch(root, () => this.queueScan());
          watcher.on('error', () => {
            try { watcher.close(); } catch (_) { }
            this.watchers.delete(key);
          });
          this.watchers.set(key, watcher);
        } catch (_) { }
      }
    }
  }

  queueScan() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      this.scan().catch(error => console.warn('[LocalLibrary] watcher scan failed:', error.message));
    }, 700);
    if (this.scanTimer && this.scanTimer.unref) this.scanTimer.unref();
  }

  async walk(root) {
    const files = [];
    const visited = new Set();
    const visit = async current => {
      const key = pathKey(current);
      if (!key || visited.has(key)) return;
      visited.add(key);
      let entries;
      try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch (_) { return; }
      for (const entry of entries) {
        if (!entry || entry.name.startsWith('.')) continue;
        const target = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await visit(target);
        } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          files.push(target);
        }
      }
    };
    await visit(root);
    return files;
  }

  findCached(filePath, stat, oldByPath) {
    const previous = oldByPath.get(pathKey(filePath));
    if (!previous) return null;
    if (this.parseFileImpl && number(previous.metadataVersion) !== LOCAL_LIBRARY_METADATA_VERSION) return null;
    if (number(previous.size) !== number(stat.size) || Math.round(number(previous.mtimeMs)) !== Math.round(number(stat.mtimeMs))) return null;
    return Object.assign({}, previous, { filePath });
  }

  async parseTrack(filePath, stat) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    let metadata = null;
    let common = {};
    let format = {};
    try {
      if (this.parseFileImpl) {
        metadata = await this.parseFileImpl(filePath, { skipCovers: false, duration: true });
        common = metadata && metadata.common || {};
        format = metadata && metadata.format || {};
      }
    } catch (_) { }
    const title = text(common.title, titleFromFile(filePath));
    const artists = artistParts(common.artists || common.artist);
    const albumArtist = text(common.albumartist || common.albumArtist, artists[0] || path.basename(path.dirname(filePath)) || '未知艺术家');
    const album = text(common.album, path.basename(path.dirname(filePath)) || '未分类专辑');
    const id = 'local:' + hash(pathKey(filePath));
    const track = {
      id,
      provider: 'local',
      source: 'local',
      type: 'local',
      name: title,
      title,
      artist: artists.join(' / ') || albumArtist,
      artists: artists.map(name => ({ id: 'local:artist:' + hash(name.toLowerCase()), name })),
      artistId: 'local:artist:' + hash(albumArtist.toLowerCase()),
      album,
      albumArtist,
      albumId: 'local:album:' + hash((albumArtist + '\n' + album).toLowerCase()),
      cover: '',
      duration: Math.max(0, Math.round(number(format.duration) * 1000)),
      track: number(common.track && (common.track.no || common.track.number)),
      disc: number(common.disk && (common.disk.no || common.disk.number)),
      year: number(common.year),
      genre: text(common.genre),
      bitRate: number(format.bitrate || format.bitRate),
      suffix: ext.slice(1),
      contentType: text(format.codec),
      size: number(stat.size),
      mtimeMs: number(stat.mtimeMs),
      metadataVersion: LOCAL_LIBRARY_METADATA_VERSION,
      addedAt: Date.now(),
      filePath,
      coverFile: '',
      lyricFile: '',
      lyrics: embeddedLyrics(metadata),
    };
    const sidecarLrc = filePath.replace(new RegExp('\\' + ext + '$', 'i'), '.lrc');
    try {
      if (fs.existsSync(sidecarLrc)) {
        track.lyricFile = sidecarLrc;
        track.lyrics = await fs.promises.readFile(sidecarLrc, 'utf8');
      }
    } catch (_) { }
    const sidecarCover = await this.findCoverFile(path.dirname(filePath));
    if (sidecarCover) track.coverFile = sidecarCover;
    const picture = common.picture && common.picture[0];
    if (!track.coverFile && picture && picture.data) {
      try {
        await fs.promises.mkdir(this.cacheDir, { recursive: true });
        const coverFile = path.join(this.cacheDir, safeFileName(id) + mapPictureType(picture));
        if (!fs.existsSync(coverFile) || (await fs.promises.stat(coverFile)).size !== picture.data.length) {
          await fs.promises.writeFile(coverFile, picture.data);
        }
        track.coverFile = coverFile;
      } catch (_) { }
    }
    return track;
  }

  async findCoverFile(directory) {
    // Windows is case-insensitive, while indexes can also be created on a
    // case-sensitive filesystem.  Read the directory once and compare names
    // case-insensitively so `Cover.JPG` behaves like `cover.jpg` everywhere.
    try {
      const entries = await fs.promises.readdir(directory, { withFileTypes: true });
      const byName = new Map(entries.filter(entry => entry && entry.isFile()).map(entry => [String(entry.name).toLowerCase(), entry.name]));
      for (const name of COVER_NAMES) {
        const actual = byName.get(name.toLowerCase());
        if (!actual) continue;
        const candidate = path.join(directory, actual);
        try {
          const stat = await fs.promises.stat(candidate);
          if (stat.isFile() && stat.size > 0) return candidate;
        } catch (_) { }
      }
    } catch (_) { }
    return '';
  }

  buildPlaylists() {
    const tracks = this.tracks.slice().sort((a, b) => (number(a.track) - number(b.track)) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
    const byKey = new Map();
    const add = (id, name, trackIds, cover, kind) => {
      if (!trackIds.length) return;
      byKey.set(id, { id, name, trackIds: Array.from(new Set(trackIds)), cover: cover || '', kind: kind || 'auto', readOnly: true, auto: true });
    };
    add('local:playlist:all', '全部本地音乐', tracks.map(item => item.id), tracks[0] && publicTrack(tracks[0]).cover, 'all');
    const rootGroups = new Map();
    const directoryGroups = new Map();
    tracks.forEach(track => {
      const file = normalizedPath(track.filePath);
      const root = this.roots.find(item => pathKey(file) === pathKey(item) || pathKey(file).startsWith(pathKey(item) + path.sep.toLowerCase()));
      if (root) {
        const rootKey = 'root:' + pathKey(root);
        const rootGroup = rootGroups.get(rootKey) || { root, ids: [], cover: '' };
        rootGroup.ids.push(track.id);
        if (!rootGroup.cover) rootGroup.cover = publicTrack(track).cover;
        rootGroups.set(rootKey, rootGroup);
      }
      const dir = path.dirname(file);
      // The selected root already gets a dedicated root playlist; do not
      // duplicate it as a same-named directory playlist.
      if (this.roots.some(rootPath => pathKey(rootPath) === pathKey(dir))) return;
      const dirKey = 'dir:' + pathKey(dir);
      const dirGroup = directoryGroups.get(dirKey) || { dir, ids: [], cover: '' };
      dirGroup.ids.push(track.id);
      if (!dirGroup.cover) dirGroup.cover = publicTrack(track).cover;
      directoryGroups.set(dirKey, dirGroup);
    });
    rootGroups.forEach(group => add('local:playlist:root:' + hash(pathKey(group.root)), path.basename(group.root) || group.root, group.ids, group.cover, 'folder'));
    directoryGroups.forEach(group => add('local:playlist:dir:' + hash(pathKey(group.dir)), path.basename(group.dir) || group.dir, group.ids, group.cover, 'folder'));
    const albumGroups = new Map();
    tracks.forEach(track => {
      const key = track.albumId || 'local:album:' + hash(track.album || track.name);
      const group = albumGroups.get(key) || { name: track.album || '未分类专辑', artist: track.albumArtist || track.artist, ids: [], cover: '' };
      group.ids.push(track.id);
      if (!group.cover) group.cover = publicTrack(track).cover;
      albumGroups.set(key, group);
    });
    albumGroups.forEach((group, key) => add('local:playlist:album:' + key.replace(/^local:album:/, ''), '专辑 · ' + group.name, group.ids, group.cover, 'album'));
    this.playlists = Array.from(byKey.values()).map(publicPlaylist);
  }

  async scan(options) {
    options = options || {};
    if (this.scanPromise) {
      this.scanState.queued = true;
      return this.scanPromise;
    }
    this.scanPromise = (async () => {
      this.scanState = { running: true, queued: false, progress: 0, total: 0, current: '', startedAt: Date.now(), finishedAt: 0, error: '', added: 0, updated: 0, removed: 0 };
      const previous = this.tracks.slice();
      const oldByPath = new Map(previous.map(item => [pathKey(item.filePath), item]));
      const files = [];
      for (const root of this.roots) files.push.apply(files, await this.walk(root));
      this.scanState.total = files.length;
      const next = [];
      const seen = new Set();
      for (let index = 0; index < files.length; index += 1) {
        const filePath = files[index];
        this.scanState.progress = index;
        this.scanState.current = filePath;
        let stat;
        try { stat = await fs.promises.stat(filePath); } catch (_) { continue; }
        const key = pathKey(filePath);
        if (seen.has(key)) continue;
        seen.add(key);
        let track = !options.force && this.findCached(filePath, stat, oldByPath);
        if (!track) {
          track = await this.parseTrack(filePath, stat);
          if (oldByPath.has(key)) this.scanState.updated += 1;
          else this.scanState.added += 1;
        }
        next.push(track);
      }
      this.scanState.removed = previous.filter(item => !seen.has(pathKey(item.filePath))).length;
      this.tracks = next.sort((a, b) => (number(a.track) - number(b.track)) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
      this.tracks.forEach(item => { item.starred = this.favorites.has(item.id); });
      this.buildPlaylists();
      await this.save();
      this.scanState.progress = files.length;
      this.scanState.current = '';
      this.scanState.running = false;
      this.scanState.finishedAt = Date.now();
      return this.status();
    })().catch(error => {
      this.scanState.running = false;
      this.scanState.error = error.message || 'LOCAL_SCAN_FAILED';
      this.scanState.finishedAt = Date.now();
      throw error;
    }).finally(() => {
      this.scanPromise = null;
      if (this.scanState.queued) {
        this.scanState.queued = false;
        this.queueScan();
      }
    });
    return this.scanPromise;
  }

  findTrack(id) {
    const key = text(id);
    return this.tracks.find(item => item.id === key) || null;
  }

  search(query, limit, offset) {
    const q = text(query).toLowerCase();
    const start = Math.max(0, number(offset));
    const size = Math.max(1, Math.min(500, number(limit, 40)));
    if (!q) return { songs: [], tracks: [], albums: [], artists: [], total: 0 };
    const songs = this.tracks.filter(item => [item.name, item.artist, item.album, item.albumArtist, item.filePath].join(' ').toLowerCase().includes(q));
    const albums = new Map();
    const artists = new Map();
    songs.forEach(item => {
      if (item.albumId && !albums.has(item.albumId)) albums.set(item.albumId, { id: item.albumId, albumId: item.albumId, name: item.album, album: item.album, artist: item.albumArtist || item.artist, cover: publicTrack(item).cover, songCount: 0, provider: 'local', source: 'local' });
      if (item.albumId) albums.get(item.albumId).songCount += 1;
      const artistId = item.artistId || 'local:artist:' + hash(item.artist);
      if (!artists.has(artistId)) artists.set(artistId, { id: artistId, artistId, name: item.albumArtist || item.artist, songCount: 0, provider: 'local', source: 'local' });
      artists.get(artistId).songCount += 1;
    });
    const page = songs.slice(start, start + size).map(publicTrack);
    return { songs: page, tracks: page, albums: Array.from(albums.values()).slice(0, size), artists: Array.from(artists.values()).slice(0, size), total: songs.length };
  }

  getPlaylist(id) {
    const playlist = this.playlists.find(item => item.id === text(id));
    if (!playlist) return null;
    const tracks = playlist.trackIds.map(trackId => this.findTrack(trackId)).filter(Boolean).map(publicTrack);
    return { playlist, tracks, total: tracks.length };
  }

  isFavorite(id) {
    return this.favorites.has(text(id));
  }

  async setFavorite(id, value) {
    const key = text(id);
    if (!this.findTrack(key)) return false;
    if (value) this.favorites.add(key);
    else this.favorites.delete(key);
    await this.save();
    return true;
  }

  album(id) {
    const key = text(id);
    const tracks = this.tracks.filter(item => item.albumId === key || item.album === key);
    if (!tracks.length) return null;
    const first = tracks[0];
    return {
      album: {
        id: first.albumId || key,
        albumId: first.albumId || key,
        name: first.album,
        album: first.album,
        artist: first.albumArtist || first.artist,
        cover: publicTrack(first).cover,
        songCount: tracks.length,
        provider: 'local',
        source: 'local',
      },
      songs: tracks.map(publicTrack),
      tracks: tracks.map(publicTrack),
      total: tracks.length,
    };
  }

  artist(id) {
    const key = text(id);
    const tracks = this.tracks.filter(item => item.artistId === key || item.albumArtist === key || item.artist === key);
    if (!tracks.length) return null;
    const first = tracks[0];
    const albums = this.albums(500).filter(item => tracks.some(track => track.albumId === item.id));
    return {
      artist: { id: first.artistId || key, artistId: first.artistId || key, name: first.albumArtist || first.artist, provider: 'local', source: 'local' },
      albums,
      songs: tracks.map(publicTrack),
      tracks: tracks.map(publicTrack),
      total: tracks.length,
    };
  }

  albums(limit) {
    const map = new Map();
    this.tracks.forEach(track => {
      const key = track.albumId || track.album;
      if (!map.has(key)) map.set(key, { id: key, albumId: key, name: track.album, album: track.album, artist: track.albumArtist || track.artist, cover: publicTrack(track).cover, songCount: 0, provider: 'local', source: 'local' });
      map.get(key).songCount += 1;
    });
    return Array.from(map.values()).slice(0, Math.max(1, number(limit, 100)));
  }

  async readCover(id) {
    const track = this.findTrack(id);
    if (!track) return null;
    const file = track.coverFile || await this.findCoverFile(path.dirname(track.filePath));
    if (!file) return null;
    try { return { file, contentType: /\.png$/i.test(file) ? 'image/png' : (/\.webp$/i.test(file) ? 'image/webp' : 'image/jpeg') }; } catch (_) { return null; }
  }

  async readLyrics(id) {
    const track = this.findTrack(id);
    if (!track) return null;
    let lyric = text(track.lyrics);
    if (track.lyricFile) {
      try { lyric = await fs.promises.readFile(track.lyricFile, 'utf8'); } catch (_) { }
    }
    return { provider: 'local', songId: track.id, lyric, lrc: lyric, trans: '' };
  }

  fileForStream(id) {
    const track = this.findTrack(id);
    if (!track || !track.filePath) return null;
    return fs.existsSync(track.filePath) ? track : null;
  }

  close() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    for (const watcher of this.watchers.values()) {
      try { watcher.close(); } catch (_) { }
    }
    this.watchers.clear();
  }
}

module.exports = {
  LocalLibrary,
  AUDIO_EXTENSIONS,
  publicTrack,
  publicPlaylist,
  normalizeRoots,
};
