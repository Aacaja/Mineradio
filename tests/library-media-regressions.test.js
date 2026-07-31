'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { LocalLibrary } = require('../local-library');

function extractFunction(source, name) {
  const declaration = new RegExp('function\\s+' + name + '\\s*\\(').exec(source);
  assert.ok(declaration, 'missing function ' + name);
  const bodyStart = source.indexOf('{', declaration.index + declaration[0].length);
  assert.ok(bodyStart >= 0, 'missing body for ' + name);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(declaration.index, index + 1);
    }
  }
  assert.fail('unterminated function ' + name);
}

async function testEmbeddedLyricsExtraction() {
  const library = new LocalLibrary({
    parseFile: async () => ({
      common: {
        title: '测试歌曲',
        artist: '测试歌手',
        album: '测试专辑',
      },
      format: { duration: 12 },
      native: {
        vorbis: [{ id: 'UNSYNCEDLYRICS', value: '第一行歌词\n第二行歌词' }],
      },
    }),
  });
  const track = await library.parseTrack(path.join(__dirname, 'embedded-lyrics.flac'), { size: 1, mtimeMs: 1 });
  assert.equal(track.lyrics, '第一行歌词\n第二行歌词');

  const syncedLibrary = new LocalLibrary({
    parseFile: async () => ({
      common: {
        title: '同步歌曲',
        artist: '测试歌手',
        lyrics: [{
          text: '第一行\n第二行',
          syncText: [
            { timestamp: 1250, text: '第一行' },
            { timestamp: 4800, text: '第二行' },
          ],
        }],
      },
      format: { duration: 12 },
      native: {},
    }),
  });
  const syncedTrack = await syncedLibrary.parseTrack(path.join(__dirname, 'synced-lyrics.flac'), { size: 1, mtimeMs: 1 });
  assert.equal(syncedTrack.lyrics, '[00:01.250]第一行\n[00:04.800]第二行');
  assert.equal(syncedTrack.metadataVersion, 2);

  const cached = new Map([[syncedTrack.filePath, Object.assign({}, syncedTrack, { metadataVersion: 1 })]]);
  assert.equal(syncedLibrary.findCached(syncedTrack.filePath, { size: 1, mtimeMs: 1 }, cached), null);
}

function testPlainLyricsAndPlaybackProxyContract() {
  const lyricSource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/06-lyrics/00-lyrics-fetch-parse.js'), 'utf8');
  const lyricContext = {
    isNoLyricText(value) {
      const compact = String(value || '').replace(/\s+/g, '').replace(/[，,。.!！?？、~～]/g, '');
      return !compact || compact === '暂无歌词' || compact === '纯音乐请欣赏';
    },
  };
  vm.runInNewContext([
    extractFunction(lyricSource, 'finalizeLyricLineDurations'),
    extractFunction(lyricSource, 'parsePlainLyricText'),
    'globalThis.parsePlainLyricText = parsePlainLyricText;',
  ].join('\n'), lyricContext);
  const plain = lyricContext.parsePlainLyricText('第一行\n第二行');
  assert.deepEqual(Array.from(plain, line => line.text), ['第一行', '第二行']);
  assert.equal(plain[0].source, 'plain');
  assert.equal(plain[1].t, 4.8);

  const playbackSource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/05-playback/13-playback-start-audio.js'), 'utf8');
  const playbackContext = {};
  vm.runInNewContext([
    extractFunction(playbackSource, 'playbackAudioUrlForResolvedData'),
    'globalThis.playbackAudioUrlForResolvedData = playbackAudioUrlForResolvedData;',
  ].join('\n'), playbackContext);
  assert.equal(
    playbackContext.playbackAudioUrlForResolvedData({ url: '/api/library/stream?id=navidrome%3A1' }, 'navidrome'),
    '/api/library/stream?id=navidrome%3A1',
  );
  assert.equal(
    playbackContext.playbackAudioUrlForResolvedData({ url: 'https://media.example/song.flac' }, 'navidrome'),
    '/api/audio?url=https%3A%2F%2Fmedia.example%2Fsong.flac',
  );
  assert.match(playbackSource, /playbackProvider === 'navidrome'[\s\S]*\/api\/library\/song\/url/);
}

function testLibraryCoverAndPlaylistShelfRouting() {
  const coverSource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/05-playback/01-cover-custom-map.js'), 'utf8');
  const coverContext = {};
  vm.runInNewContext([
    extractFunction(coverSource, 'isInlineCoverSrc'),
    extractFunction(coverSource, 'isProxyableCoverUrl'),
    extractFunction(coverSource, 'coverProxySrc'),
    'globalThis.coverProxySrc = coverProxySrc;',
  ].join('\n'), coverContext);
  assert.equal(coverContext.coverProxySrc('/api/library/cover?id=cover-1&size=88'), '/api/library/cover?id=cover-1&size=88');
  assert.match(coverContext.coverProxySrc('https://media.example/cover.jpg'), /^\/api\/cover\?url=/);

  const coverLoaderSource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/03-beat/05-cover-loading-crop.js'), 'utf8');
  assert.match(coverLoaderSource, /var proxiedUrl = coverProxySrc\(directUrl\)/);
  assert.match(coverLoaderSource, /directUrl = String\(directUrl \|\| ''\)\.trim\(\)/);

  const librarySource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/08-library/00-library-runtime.js'), 'utf8');
  assert.match(librarySource, /scheduleShelfRebuild\('library-playlists-refresh'/);
  assert.match(librarySource, /\/api\/library\/playlist\/tracks/);

  const shelfSource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/04-shelf/01-manager-core.js'), 'utf8');
  const contentSource = fs.readFileSync(path.join(__dirname, '..', 'public/js/modules/04-shelf/03-content-list-manager.js'), 'utf8');
  assert.match(shelfSource, /pl\.provider === 'navidrome'/);
  assert.match(shelfSource, /pl\.provider === 'local'/);
  assert.match(shelfSource, /songCoverSrc\(\{ cover: pl\.cover/);
  assert.match(contentSource, /navidromePlaylistId/);
  assert.match(contentSource, /\/api\/library\/playlist\/tracks/);
}

async function run() {
  await testEmbeddedLyricsExtraction();
  testPlainLyricsAndPlaybackProxyContract();
  testLibraryCoverAndPlaylistShelfRouting();
  console.log('[OK] Navidrome playback, embedded FLAC lyrics, cover URLs, and playlist routing regressions verified.');
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
