'use strict';

// Mineradio library runtime.  The old provider modules remain in the bundle
// for migration compatibility, but all renderer entry points are redirected
// to the first-party Navidrome/local-library contract here.
var libraryRuntimeState = {
  status: null,
  profiles: [],
  activeProfileId: '',
  loading: false,
  settingsOpen: false,
  lastSearchSource: 'all',
};
var LIBRARY_PROVIDERS = ['navidrome', 'local'];

function libraryProvider(song) {
  song = song || {};
  if (song.type === 'local' || song.source === 'local' || song.provider === 'local' || song.localId || song.localPath || song.localUrl) return 'local';
  if (song.type === 'navidrome' || song.source === 'navidrome' || song.provider === 'navidrome') return 'navidrome';
  return 'navidrome';
}

function libraryStatusAvailable() {
  var status = libraryRuntimeState.status || {};
  var local = status.local || {};
  return !!(status.configured || status.connected || local.trackCount > 0 || (local.roots && local.roots.length));
}

function libraryProviderLabel(provider) {
  return provider === 'local' ? '本地' : 'Navidrome';
}

function libraryProviderShort(provider) {
  return provider === 'local' ? 'LOCAL' : 'ND';
}

function libraryRefreshStatusUi() {
  renderUserBtn();
  updateSearchModeTabs();
  if (typeof updateEmptyHomeVisibility === 'function' && !playing) updateEmptyHomeVisibility({ forceLoad: true });
  if (typeof renderHomeDiscover === 'function') renderHomeDiscover();
  if (typeof updateLikeButtons === 'function') updateLikeButtons();
}

async function fetchLibraryStatus() {
  var status = await apiJson('/api/library/status?t=' + Date.now(), { timeoutMs: 12000 });
  libraryRuntimeState.status = status || {};
  loginStatusChecked = true;
  loginStatusCheckFailed = false;
  var remote = status && status.navidrome || {};
  loginStatus = Object.assign({}, status || {}, {
    provider: 'library',
    loggedIn: !!(status && (status.connected || status.configured)),
    nickname: remote.serverVersion ? 'Navidrome ' + remote.serverVersion : 'Navidrome 音乐库',
    userId: status && status.profile && status.profile.username || '',
    avatar: '',
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
  });
  activeAccountProvider = 'navidrome';
  loginProvider = 'navidrome';
  homeDiscoverState.loggedIn = libraryStatusAvailable();
  homeDiscoverState.loaded = false;
  return status;
}

async function refreshLoginStatus(force) {
  if (libraryRuntimeState.loading && !force) return libraryRuntimeState.status;
  libraryRuntimeState.loading = true;
  try {
    var result = await fetchLibraryStatus();
    await refreshUserPlaylists(!!force);
    if (typeof loadHomeDiscover === 'function') await loadHomeDiscover(true);
    syncLikeStatusForSongs((playQueue || []).concat(playlist || []));
    libraryRefreshStatusUi();
    return result;
  } catch (error) {
    loginStatusChecked = true;
    loginStatusCheckFailed = true;
    libraryRuntimeState.status = { provider: 'library', configured: false, connected: false, local: { roots: [], trackCount: 0, playlists: [] }, error: error.message || 'LIBRARY_STATUS_FAILED' };
    loginStatus = Object.assign({}, libraryRuntimeState.status, { loggedIn: false, provider: 'library' });
    libraryRefreshStatusUi();
    return null;
  } finally {
    libraryRuntimeState.loading = false;
  }
}

function refreshQQLoginStatus() { return Promise.resolve({ provider: 'qq', loggedIn: false }); }
function refreshKugouLoginStatus() { return Promise.resolve({ provider: 'kugou', loggedIn: false }); }
function refreshQishuiLoginStatus() { return Promise.resolve({ provider: 'qishui', loggedIn: false }); }
function refreshSpotifyLoginStatus() { return Promise.resolve({ provider: 'spotify', loggedIn: false }); }
function startQQLoginStatusAutoRefresh() {}
function startKugouLoginStatusAutoRefresh() {}
function startQishuiLoginStatusAutoRefresh() {}
function startSpotifyLoginStatusAutoRefresh() {}
function maybeRunStartupLoginGuide() {}

function platformMeta(provider) {
  provider = provider === 'local' ? 'local' : 'navidrome';
  return provider === 'local'
    ? { key: 'local', short: 'LOCAL', label: '本地音乐', app: '本地音乐', dot: 'local' }
    : { key: 'navidrome', short: 'ND', label: 'Navidrome', app: 'Navidrome', dot: 'navidrome' };
}

function platformStatus(provider) {
  if (provider === 'local') return Object.assign({ provider: 'local', loggedIn: true }, libraryRuntimeState.status && libraryRuntimeState.status.local || {});
  return loginStatus || { provider: 'library', loggedIn: false };
}

function hasPlatformLogin(provider) {
  if (provider === 'local') return libraryStatusAvailable();
  if (provider === 'navidrome' || !provider) return libraryStatusAvailable();
  return false;
}

function hasAnyPlatformLogin() { return libraryStatusAvailable(); }
function firstLoggedProvider() { return (libraryRuntimeState.status && libraryRuntimeState.status.connected) ? 'navidrome' : 'local'; }
function normalizeAccountProviderKey(provider) { return provider === 'local' ? 'local' : 'navidrome'; }
function normalizePlaybackProvider(provider) { return provider === 'local' ? 'local' : 'navidrome'; }
function playbackLoginProvider(song) { return libraryProvider(song); }
function playbackProviderLabel(song) { return libraryProviderLabel(libraryProvider(song)); }
function playbackProviderMembershipText() { return '个人音乐库'; }
function playbackRestrictionNotice(song, data) {
  data = data || {};
  var provider = playbackProviderLabel(song);
  return { category: data.error ? 'url_unavailable' : '', title: provider + ' 暂时无法播放', body: data.message || data.error || '没有返回可播放地址。', action: 'retry', toast: provider + ' 播放失败' };
}
function playbackRestrictionMessage(song, data) { var n = playbackRestrictionNotice(song, data); return n.body || n.title; }
function playbackRestrictionCategory(song, data) { return data && data.error ? 'url_unavailable' : ''; }
function tryAutoPlaybackFallback() { return null; }
function handlePlaybackUnavailable(song, data) {
  hideLoading();
  forcePlaybackControlsInteractive();
  var notice = playbackRestrictionNotice(song, data);
  showToast(notice.toast || notice.title);
  if (typeof showSourceFallbackNotice === 'function') showSourceFallbackNotice(notice.title, notice.body);
}

function songProviderKey(song) { return libraryProvider(song); }
function songSourceLabel(song) { return libraryProviderLabel(libraryProvider(song)); }
function coverUrlWithSize(url, size) {
  var value = String(url || '').trim();
  if (!value) return '';
  var amount = Math.max(32, Math.min(1200, Number(size) || 600));
  if (/^data:|^blob:|^https?:\/\//i.test(value)) return value;
  if (/^\/api\/(?:library|local)\/cover\b/i.test(value)) return value + (value.indexOf('?') >= 0 ? '&' : '?') + 'size=' + amount;
  if (/^\/|^file:/i.test(value)) return value;
  return '/api/library/cover?id=' + encodeURIComponent(value) + '&size=' + amount;
}
function songCoverSrc(song, size) {
  song = song || {};
  if (typeof getCustomCoverForSong === 'function') {
    var custom = getCustomCoverForSong(song);
    if (custom) return custom;
  }
  if (song.coverDataUrl) return song.coverDataUrl;
  if (song.cover) return coverUrlWithSize(song.cover, size || 220);
  return '';
}
function lyricEndpointForSong(songOrId) {
  var song = songOrId && typeof songOrId === 'object' ? songOrId : {};
  var id = typeof songOrId === 'object' ? (song.id || song.providerSongId || song.localId || '') : String(songOrId || '');
  return '/api/library/lyric?id=' + encodeURIComponent(id) + '&artist=' + encodeURIComponent(song.artist || '') + '&title=' + encodeURIComponent(song.name || song.title || '');
}
function songSourceTagHtml(song, opts) {
  opts = opts || {};
  var provider = libraryProvider(song);
  var label = libraryProviderShort(provider);
  if (opts.switcher) return '<span class="tag-source ' + provider + '">' + label + '</span>';
  return '<span class="tag-source ' + provider + '">' + label + '</span>';
}
function songRequiresVip() { return false; }
function songVipTagHtml() { return ''; }
function searchResultMetaText(song) {
  var bits = [];
  if (song && song.artist) bits.push(song.artist);
  if (song && song.album) bits.push(song.album);
  bits.push(libraryProviderLabel(libraryProvider(song)));
  return bits.join('  · ');
}
function searchResultMetaHtml(song) { return escHtml(searchResultMetaText(song)); }

function updateSearchModeTabs() {
  var tabs = [
    ['search-mode-song', 'song', 'All'],
    ['search-mode-navidrome', 'navidrome', 'Navidrome'],
    ['search-mode-local', 'local', 'Local'],
  ];
  var old = ['search-mode-netease', 'search-mode-qq', 'search-mode-kugou', 'search-mode-qishui', 'search-mode-spotify', 'search-mode-podcast'];
  old.forEach(function (id) { var node = document.getElementById(id); if (node) node.hidden = true; });
  tabs.forEach(function (entry) {
    var node = document.getElementById(entry[0]);
    if (!node) return;
    node.hidden = false;
    node.textContent = entry[2];
    node.classList.toggle('active', searchMode === entry[1]);
    node.setAttribute('aria-selected', searchMode === entry[1] ? 'true' : 'false');
  });
  if ($input) $input.placeholder = searchMode === 'local' ? '搜索本地音乐...' : (searchMode === 'navidrome' ? '搜索 Navidrome...' : '搜索歌曲、歌手...');
  if (typeof updateSearchPillGlassDisplacementMap === 'function') requestAnimationFrame(updateSearchPillGlassDisplacementMap);
}
function isMusicSearchMode() { return true; }
function searchModeProvider(mode) { return mode === 'local' || mode === 'navidrome' ? mode : ''; }
function activeSearchProvidersForMode(mode) {
  var specific = searchModeProvider(mode);
  if (specific) return specific === 'local' || (libraryRuntimeState.status && libraryRuntimeState.status.configured) ? [specific] : [];
  var out = [];
  if (libraryRuntimeState.status && libraryRuntimeState.status.configured) out.push('navidrome');
  if (libraryRuntimeState.status && libraryRuntimeState.status.local) out.push('local');
  return out.length ? out : ['local'];
}
function searchProviderCanSearch(provider) { return activeSearchProvidersForMode(provider).length > 0; }
function searchProviderStatus(provider) { return platformStatus(provider); }
function searchProviderIsLoggedIn(provider) { return hasPlatformLogin(provider); }
function searchProviderLoginNotice(mode) { return mode === 'navidrome' ? '请先在音乐库设置中连接 Navidrome' : '本地音乐库尚未扫描到歌曲'; }
function searchProviderUrl(provider, q, limit, offset) {
  return '/api/library/search?keywords=' + encodeURIComponent(q) + '&source=' + encodeURIComponent(provider === 'local' ? 'local' : 'navidrome') + '&limit=' + encodeURIComponent(limit || 40) + '&offset=' + encodeURIComponent(offset || 0);
}
function mergeUniqueSearchSongPools(existing, incoming) {
  var out = [], seen = {};
  (existing || []).concat(incoming || []).forEach(function (song) {
    if (!song || !song.name) return;
    var key = libraryProvider(song) + ':' + String(song.id || song.name + '|' + song.artist);
    if (seen[key]) return;
    seen[key] = true;
    out.push(song);
  });
  return out.slice(0, MUSIC_SEARCH_MAX_RESULTS || 180);
}
async function fetchMusicSearchResults(q, mode, previousPages) {
  var providers = activeSearchProvidersForMode(mode);
  var pages = previousPages || {};
  var songs = [];
  var nextPages = {};
  for (var i = 0; i < providers.length; i += 1) {
    var provider = providers[i];
    var prev = pages[provider] || {};
    var offset = Number(prev.nextOffset) || 0;
    var limit = provider === 'local' ? 100 : 60;
    var data = await apiJson(searchProviderUrl(provider, q, limit, offset), { timeoutMs: 15000 });
    var incoming = Array.isArray(data && data.songs) ? data.songs : [];
    songs = mergeUniqueSearchSongPools(songs, incoming);
    var nextOffset = Number(data && data.nextOffset);
    if (!isFinite(nextOffset) || nextOffset <= offset) nextOffset = offset + incoming.length;
    nextPages[provider] = { offset: offset, nextOffset: nextOffset, hasMore: !!(data && data.hasMore) || incoming.length >= limit, total: Number(data && data.total) || 0 };
  }
  return { songs: songs, providerPages: nextPages, hasMore: Object.keys(nextPages).some(function (key) { return nextPages[key].hasMore; }) };
}
function doSearch(q, opts) {
  opts = opts || {};
  q = String(q || '').trim();
  if (!q) { if (typeof renderSearchHistory === 'function') renderSearchHistory(); return Promise.resolve(); }
  var requestSeq = ++searchRequestSeq;
  var mode = searchMode;
  setSearchHistorySurface(false);
  return fetchMusicSearchResults(q, mode).then(function (data) {
    if (requestSeq !== searchRequestSeq || mode !== searchMode || ($input && $input.value.trim() !== q)) return;
    var songs = data && data.songs || [];
    if (!songs.length) {
      playlist = [];
      $results.innerHTML = '<div class="search-empty">没有找到相关歌曲</div>';
      $results.classList.add('show');
      return;
    }
    searchLastResultQuery = searchResultKey(q, mode);
    rememberSearchQuery(q);
    pendingSearchProviderPages = { key: searchLastResultQuery, query: q, mode: mode, providerPages: data.providerPages || {}, hasMore: !!data.hasMore };
    renderSongSearchResults(songs);
    if (opts.autoPlayFirst) playSearchResult(0);
  }).catch(function (error) {
    console.warn('[LibrarySearch]', error);
    if (requestSeq === searchRequestSeq) { $results.innerHTML = '<div class="search-empty">媒体库搜索失败，请检查连接或扫描状态</div>'; $results.classList.add('show'); }
  });
}
function setSearchMode(mode) {
  mode = mode === 'local' || mode === 'navidrome' ? mode : 'song';
  if (searchMode === mode) { updateSearchModeTabs(); return; }
  searchMode = mode;
  updateSearchModeTabs();
  clearSearchResults();
  var q = $input ? $input.value.trim() : '';
  if (q) doSearch(q); else if (typeof renderSearchHistory === 'function') renderSearchHistory();
}

function controlSourceProviders() { return [{ key: 'navidrome', label: 'ND', title: 'Navidrome' }, { key: 'local', label: 'LOCAL', title: '本地' }]; }
function controlSourceProviderTitle(provider) { return libraryProviderLabel(provider); }
function toggleControlSourceSwitcher() { showToast('当前媒体库不提供跨源切换'); }

function normalizePlaylistProvider(provider) { return provider === 'local' ? 'local' : 'navidrome'; }
function playlistProviderLabel(provider) { return libraryProviderShort(normalizePlaylistProvider(provider)); }
function playlistProviderName(provider) { return libraryProviderLabel(normalizePlaylistProvider(provider)); }
function playlistPanelKey(provider, id) { return normalizePlaylistProvider(provider) + ':' + String(id || ''); }
function playlistPanelProviderId(provider, id) { return String(id || ''); }
function playlistTracksEndpoint(provider, id, params) {
  params = params || {};
  var query = 'id=' + encodeURIComponent(id || '');
  Object.keys(params).forEach(function (key) { if (params[key] != null && params[key] !== '') query += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]); });
  return '/api/library/playlist/tracks?' + query;
}
function playlistQueueSource(id) {
  var raw = String(id || '');
  var split = raw.indexOf(':');
  var provider = split > 0 && (raw.slice(0, split) === 'local' || raw.slice(0, split) === 'navidrome') ? raw.slice(0, split) : (raw.indexOf('local:') === 0 ? 'local' : 'navidrome');
  var sourceId = provider === 'navidrome' && raw.indexOf('navidrome:') === 0 ? raw.slice(10) : raw;
  return { provider: provider, id: sourceId, requestId: raw };
}
function playlistQueuePageUrl(source, offset, limit) { return playlistTracksEndpoint(source.provider, source.id, { offset: offset || 0, limit: limit || 100 }); }

function playlistCatalogProviderArray(provider) { return provider === 'local' ? (window.__mineradioLocalPlaylists || []) : (window.__mineradioNavidromePlaylists || []); }
function setPlaylistCatalogProviderArray(provider, rows) {
  rows = Array.isArray(rows) ? rows : [];
  if (provider === 'local') window.__mineradioLocalPlaylists = rows; else window.__mineradioNavidromePlaylists = rows;
}
function playlistCatalogProviderLoggedIn(provider) { return provider === 'local' ? libraryStatusAvailable() : !!(libraryRuntimeState.status && libraryRuntimeState.status.configured); }
function renderUserPlaylistsList() {
  var root = document.getElementById('pl-list');
  if (!root) return;
  if (!userPlaylists.length) { root.innerHTML = '<div class="library-empty">暂无歌单。连接 Navidrome 或选择本地音乐文件夹后会自动生成。</div>'; return; }
  root.innerHTML = userPlaylists.map(function (pl, index) {
    var provider = normalizePlaylistProvider(pl.provider || pl.source);
    var cover = pl.cover ? songCoverSrc({ cover: pl.cover, provider: provider }, 88) : '';
    var img = cover ? '<img src="' + escHtml(cover) + '" alt="" loading="lazy" onerror="this.style.opacity=.2">' : '<div class="library-playlist-cover">' + escHtml(libraryProviderShort(provider)) + '</div>';
    return '<div class="pl-card" data-playlist-provider="' + provider + '" data-playlist-id="' + escHtml(String(pl.id || '')) + '" data-playlist-title="' + escHtml(pl.name || '') + '" data-playlist-index="' + index + '">' + img + '<div style="flex:1;min-width:0"><div class="pl-name">' + escHtml(pl.name || '未命名歌单') + '<span class="tag-source ' + provider + '" style="margin-left:6px">' + libraryProviderShort(provider) + '</span></div><div class="pl-sub">' + (Number(pl.trackCount) || 0) + ' 首 · ' + escHtml(pl.creator || pl.owner || '') + '</div></div></div>';
  }).join('');
}
async function refreshUserPlaylists(force) {
  try {
    var data = await apiJson('/api/library/playlists?t=' + (force ? Date.now() : ''));
    if (data && data.error && !(data.playlists || []).length) throw new Error(data.message || data.error);
    var all = (data && data.playlists || []).map(function (pl) { return Object.assign({}, pl, { provider: pl.provider === 'local' ? 'local' : 'navidrome', source: pl.provider === 'local' ? 'local' : 'navidrome' }); });
    userPlaylists = all;
    neteasePlaylists = [];
    qqPlaylists = [];
    kugouPlaylists = [];
    qishuiPlaylists = [];
    spotifyPlaylists = [];
    setPlaylistCatalogProviderArray('local', all.filter(function (pl) { return pl.provider === 'local'; }));
    setPlaylistCatalogProviderArray('navidrome', all.filter(function (pl) { return pl.provider === 'navidrome'; }));
    playlistCatalogRevision += 1;
    renderUserPlaylistsList({ animate: false });
    if (typeof scheduleShelfRebuild === 'function') scheduleShelfRebuild('library-playlists-refresh', true);
    return data;
  } catch (error) {
    userPlaylists = [];
    var root = document.getElementById('pl-list');
    if (root) root.innerHTML = '<div class="library-empty">歌单读取失败，请点击“刷新”重试。<br><small>' + escHtml(error && error.message || 'NAVIDROME_PLAYLISTS_FAILED') + '</small></div>';
    if (typeof scheduleShelfRebuild === 'function') scheduleShelfRebuild('library-playlists-error', true);
    return null;
  }
}
function renderMyPodcastCollections() { var node = document.getElementById('podcast-list'); if (node) node.innerHTML = ''; }
var libraryPlaylistDetailState = { provider: '', id: '', title: '', tracks: [] };
function closeLibraryPlaylistDetail() {
  var detail = document.querySelector('.library-playlist-detail');
  if (detail && detail.parentNode) detail.parentNode.removeChild(detail);
  document.querySelectorAll('#pl-list .pl-card.expanded').forEach(function (node) { node.classList.remove('expanded'); });
}
function renderLibraryPlaylistDetail(card, provider, id, title, tracks) {
  closeLibraryPlaylistDetail();
  if (!card || !card.parentNode) return;
  card.classList.add('expanded');
  var detail = document.createElement('div');
  detail.className = 'library-playlist-detail';
  detail.innerHTML = '<div class="library-playlist-detail-head"><div><b>' + escHtml(title || '歌单详情') + '</b><small>' + tracks.length + ' 首 · ' + escHtml(libraryProviderLabel(provider)) + '</small></div><button type="button" class="modal-btn primary" data-library-play-all>播放全部</button></div>' +
    '<div class="library-playlist-detail-list">' + tracks.map(function (song, index) {
      var cover = songCoverSrc(song, 56);
      return '<button type="button" class="library-playlist-track" data-library-track-index="' + index + '">' + (cover ? '<img src="' + escHtml(cover) + '" alt="">' : '<span class="library-playlist-track-dot"></span>') + '<span><b>' + escHtml(song.name || '') + '</b><small>' + escHtml(song.artist || '') + (song.album ? ' · ' + escHtml(song.album) : '') + '</small></span></button>';
    }).join('') + '</div>';
  card.parentNode.insertBefore(detail, card.nextSibling);
  detail.querySelector('[data-library-play-all]').onclick = function () { loadLibraryTracksIntoQueue(tracks, title, 0, true); };
  detail.querySelectorAll('[data-library-track-index]').forEach(function (node) {
    node.onclick = function () { loadLibraryTracksIntoQueue(tracks, title, Number(node.dataset.libraryTrackIndex) || 0, true); };
  });
}
function loadLibraryTracksIntoQueue(tracks, title, startIndex, autoplay) {
  tracks = (tracks || []).map(cloneSong);
  if (!tracks.length) return false;
  playQueue = tracks;
  currentIdx = Math.max(0, Math.min(tracks.length - 1, Number(startIndex) || 0));
  queueHydrationState = { token: (queueHydrationState.token || 0) + 1, active: false, loading: false, provider: libraryProvider(tracks[currentIdx]), playlistId: '', sourceId: '', title: title || '', total: tracks.length, nextOffset: tracks.length, hasMore: false, loaded: tracks.length, error: '', promise: null, timer: 0, queueRef: playQueue, warmPagesRemaining: 0, pausedForBuffer: false };
  safeRenderQueuePanel('library-detail-play', { animate: true, scrollCurrent: true, deferWhenHidden: false });
  if (typeof safeSwitchPlaylistTab === 'function') safeSwitchPlaylistTab('queue', 'library-detail-play');
  if (typeof safeShelfRebuild === 'function') safeShelfRebuild('library-detail-play', true);
  if (autoplay) playQueueAt(currentIdx);
  return true;
}
async function openPlaylistPanelDetail(provider, id, title) {
  provider = normalizePlaylistProvider(provider);
  var card = Array.prototype.slice.call(document.querySelectorAll('#pl-list .pl-card')).filter(function (node) { return node.getAttribute('data-playlist-provider') === provider && node.getAttribute('data-playlist-id') === String(id); })[0];
  if (!card) return;
  if (card.nextElementSibling && card.nextElementSibling.classList.contains('library-playlist-detail')) { closeLibraryPlaylistDetail(); return; }
  closeLibraryPlaylistDetail();
  var loading = document.createElement('div'); loading.className = 'library-playlist-detail library-settings-muted'; loading.textContent = '正在载入歌单…'; card.parentNode.insertBefore(loading, card.nextSibling);
  try {
    var result = await apiJson(playlistTracksEndpoint(provider, id, { offset: 0, limit: 500 }), { timeoutMs: 16000 });
    if (loading.parentNode) loading.parentNode.removeChild(loading);
    var tracks = (result && result.tracks || []).map(cloneSong);
    libraryPlaylistDetailState = { provider: provider, id: String(id), title: title || '', tracks: tracks };
    renderLibraryPlaylistDetail(card, provider, id, title, tracks);
  } catch (error) {
    loading.textContent = '歌单载入失败';
  }
}

function switchPlaylistTab(tab, opts) {
  opts = opts || {};
  tab = tab === 'playlists' ? 'playlists' : 'queue';
  queueViewTab = tab;
  if (opts.save !== false && typeof savePlaylistPanelTabPreference === 'function') savePlaylistPanelTabPreference(tab);
  var queueTab = document.getElementById('tab-queue');
  var playlistTab = document.getElementById('tab-pl');
  if (queueTab) queueTab.classList.toggle('active', tab === 'queue');
  if (playlistTab) playlistTab.classList.toggle('active', tab === 'playlists');
  var podcastTab = document.getElementById('tab-podcast'); if (podcastTab) podcastTab.hidden = true;
  var queuePane = document.getElementById('queue-pane'); if (queuePane) queuePane.style.display = tab === 'queue' ? '' : 'none';
  var playlistPane = document.getElementById('pl-pane'); if (playlistPane) playlistPane.style.display = tab === 'playlists' ? '' : 'none';
  var podcastPane = document.getElementById('podcast-pane'); if (podcastPane) podcastPane.style.display = 'none';
  if (tab === 'playlists' && opts.refresh !== false) refreshUserPlaylists(false);
  if (opts.animate !== false && typeof animatePlaylistPanelCurrentTab === 'function') animatePlaylistPanelCurrentTab(document.getElementById('playlist-panel'));
}
function normalizePlaylistPanelTab(tab) { return tab === 'playlists' ? 'playlists' : 'queue'; }
function preparePlaylistPanelTabOnOpen(panel) { if (!playQueue.length && queueViewTab === 'queue') switchPlaylistTab('playlists', { save: false, animate: false, refresh: true }); else if (queueViewTab === 'playlists') refreshUserPlaylists(false); }

async function loadPlaylistIntoQueueById(id, autoplay, title, opts) {
  opts = opts || {};
  var source = playlistQueueSource(id);
  var data = null;
  try { data = await apiJson(playlistTracksEndpoint(source.provider, source.id, { offset: 0, limit: 500 }), { timeoutMs: 16000 }); } catch (error) { showToast('歌单载入失败'); return false; }
  var tracks = (data && data.tracks || []).map(cloneSong);
  if (!tracks.length) { showToast('歌单为空'); return false; }
  playQueue = tracks;
  currentIdx = Math.max(0, Math.min(tracks.length - 1, Number(opts.startIndex) || 0));
  queueHydrationState = { token: (queueHydrationState.token || 0) + 1, active: false, loading: false, provider: source.provider, playlistId: id, sourceId: source.id, title: title || '', total: tracks.length, nextOffset: tracks.length, hasMore: false, loaded: tracks.length, error: '', promise: null, timer: 0, queueRef: playQueue, warmPagesRemaining: 0, pausedForBuffer: false };
  safeRenderQueuePanel('library-playlist-load', { animate: true, scrollCurrent: true, deferWhenHidden: false });
  if (typeof safeSwitchPlaylistTab === 'function') safeSwitchPlaylistTab('queue', 'library-playlist-load'); else switchPlaylistTab('queue', { save: false });
  if (typeof safeShelfRebuild === 'function') safeShelfRebuild('library-playlist-load', true);
  if (autoplay) await playQueueAt(currentIdx, { preserveHomeState: !!opts.preserveHomeState });
  showToast('载入: ' + (title || '歌单'));
  return true;
}

async function loadHomeDiscover(force) {
  if (homeDiscoverState.loading && !force) return;
  var token = ++homeDiscoverToken;
  homeDiscoverState.loading = true;
  try {
    var data = await apiJson('/api/library/home?t=' + Date.now(), { timeoutMs: 16000 });
    if (token !== homeDiscoverToken) return;
    homeDiscoverState.loggedIn = libraryStatusAvailable();
    homeDiscoverState.mode = 'library';
    homeDiscoverState.songs = (data && (data.dailySongs || data.songs) || []).map(cloneSong);
    homeDiscoverState.playlists = (data && data.playlists || []).map(function (item) { return Object.assign({}, item); });
    homeDiscoverState.podcasts = [];
    homeDiscoverState.error = data && data.error || '';
    homeDiscoverState.updatedAt = Number(data && data.updatedAt) || Date.now();
    homeDiscoverState.loaded = true;
  } catch (error) {
    homeDiscoverState.error = error.message || 'LIBRARY_HOME_FAILED';
    homeDiscoverState.loggedIn = libraryStatusAvailable();
    homeDiscoverState.loaded = true;
  } finally {
    if (token === homeDiscoverToken) homeDiscoverState.loading = false;
    if (typeof renderHomeDiscover === 'function') renderHomeDiscover();
  }
}

function showLoginModal() { openLibrarySettings(); }
function closeLoginModal() { var node = document.getElementById('login-modal'); if (node) node.classList.remove('show'); closeLibrarySettings(); }
function showUserModal() { openLibrarySettings(); }
function closeUserModal() { closeLibrarySettings(); }
function onUserBtnClick() { openLibrarySettings(); }
function logoutActiveAccount() { openLibrarySettings(); }
function openProviderLogin() { openLibrarySettings(); }
function renderUserBtn() {
  var btn = document.getElementById('user-btn');
  if (!btn) return;
  btn.classList.remove('logged-out', 'login-eye-avatar', 'external-account-pills', 'multi-account');
  btn.classList.add('logged-in');
  btn.title = '音乐库设置';
  btn.innerHTML = '<span class="library-user-mark" aria-hidden="true">' + (libraryRuntimeState.status && libraryRuntimeState.status.connected ? 'ND' : '♪') + '</span>';
  btn.onclick = function () { openLibrarySettings(); };
}

function ensureLibrarySettingsModal() {
  var existing = document.getElementById('library-settings-modal');
  if (existing) return existing;
  var mask = document.createElement('div');
  mask.id = 'library-settings-modal';
  mask.className = 'modal-mask';
  mask.innerHTML = '<div class="modal library-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="library-settings-title">' +
    '<div class="login-panel-head"><div><b id="library-settings-title">音乐库设置</b><small>Navidrome 账号 · 本地文件夹</small></div><button class="login-panel-close" type="button" data-library-close>×</button></div>' +
    '<div class="library-settings-body">' +
    '<section class="library-settings-section"><div class="library-settings-section-head"><b>Navidrome 账号</b><button class="fx-mini-btn ghost" type="button" data-library-add>新增账号</button></div><div id="library-profile-list"></div>' +
    '<div class="library-profile-editor" id="library-profile-editor"><label>名称<input id="library-profile-name" type="text" autocomplete="off"></label><label>服务器地址<input id="library-profile-url" type="url" placeholder="https://music.example.com" autocomplete="url"></label><label>用户名<input id="library-profile-username" type="text" autocomplete="username"></label><label>密码<input id="library-profile-password" type="password" autocomplete="current-password" placeholder="仅保存到系统安全存储"></label><div class="library-settings-actions"><button class="modal-btn" type="button" data-library-test>测试连接</button><button class="modal-btn primary" type="button" data-library-save>保存并切换</button></div><div id="library-profile-status" class="library-settings-status" role="status"></div></div></section>' +
    '<section class="library-settings-section"><div class="library-settings-section-head"><b>本地音乐文件夹</b><span id="library-local-count" class="library-settings-muted"></span></div><p class="library-settings-help">递归扫描 MP3、FLAC、M4A、OGG、WAV 等文件，读取标签、内嵌封面和同目录 LRC。</p><div id="library-root-list" class="library-root-list"></div><div class="library-settings-actions"><button class="modal-btn" type="button" data-library-choose-roots>选择文件夹</button><button class="modal-btn" type="button" data-library-rescan>重新扫描</button></div><div id="library-local-status" class="library-settings-status" role="status"></div></section>' +
    '</div><div class="btn-row"><button class="modal-btn" type="button" data-library-close>完成</button></div></div>';
  document.body.appendChild(mask);
  mask.addEventListener('click', function (event) { if (event.target === mask || event.target.closest('[data-library-close]')) closeLibrarySettings(); });
  mask.querySelector('[data-library-add]').addEventListener('click', function () { librarySettingsNewProfile(); });
  mask.querySelector('[data-library-test]').addEventListener('click', function () { librarySettingsTestProfile(); });
  mask.querySelector('[data-library-save]').addEventListener('click', function () { librarySettingsSaveProfile(); });
  mask.querySelector('[data-library-choose-roots]').addEventListener('click', function () { librarySettingsChooseRoots(); });
  mask.querySelector('[data-library-rescan]').addEventListener('click', function () { librarySettingsRescan(); });
  return mask;
}
function openLibrarySettings() {
  var mask = ensureLibrarySettingsModal();
  libraryRuntimeState.settingsOpen = true;
  mask.classList.add('show');
  mask.style.display = 'flex';
  renderLibrarySettings();
  if (!libraryRuntimeState.profiles.length) librarySettingsLoadProfiles();
}
function closeLibrarySettings() { var mask = document.getElementById('library-settings-modal'); if (mask) { mask.classList.remove('show'); mask.style.display = ''; } libraryRuntimeState.settingsOpen = false; }
function currentLibraryProfileDraft() {
  var value = function (id) { var node = document.getElementById(id); return node ? String(node.value || '').trim() : ''; };
  return { id: libraryRuntimeState.activeProfileId || '', name: value('library-profile-name'), url: value('library-profile-url'), username: value('library-profile-username'), password: value('library-profile-password') };
}
function renderLibrarySettings() {
  var list = document.getElementById('library-profile-list');
  if (list) list.innerHTML = libraryRuntimeState.profiles.length ? libraryRuntimeState.profiles.map(function (profile) {
    return '<div class="library-profile-row' + (profile.active ? ' active' : '') + '"><div><b>' + escHtml(profile.name || profile.username || 'Navidrome') + '</b><small>' + escHtml(profile.url || '') + ' · ' + escHtml(profile.username || '') + '</small></div><div class="library-profile-row-actions">' + (profile.active ? '<span class="library-profile-active">当前</span>' : '<button type="button" data-library-activate="' + escHtml(profile.id) + '">切换</button>') + '<button type="button" data-library-edit="' + escHtml(profile.id) + '">编辑</button><button type="button" data-library-delete="' + escHtml(profile.id) + '">删除</button></div></div>';
  }).join('') : '<div class="library-settings-muted">尚未配置 Navidrome 账号；本地音乐可直接使用。</div>';
  if (list) {
    list.querySelectorAll('[data-library-activate]').forEach(function (node) { node.onclick = function () { librarySettingsActivate(node.dataset.libraryActivate); }; });
    list.querySelectorAll('[data-library-edit]').forEach(function (node) { node.onclick = function () { librarySettingsEdit(node.dataset.libraryEdit); }; });
    list.querySelectorAll('[data-library-delete]').forEach(function (node) { node.onclick = function () { librarySettingsDelete(node.dataset.libraryDelete); }; });
  }
  var status = libraryRuntimeState.status || {};
  var local = status.local || {};
  var count = document.getElementById('library-local-count'); if (count) count.textContent = (Number(local.trackCount) || 0) + ' 首';
  var roots = document.getElementById('library-root-list'); if (roots) roots.innerHTML = (local.roots || []).length ? local.roots.map(function (root) { return '<div>' + escHtml(root.name || root.path || '') + '</div>'; }).join('') : '<div class="library-settings-muted">未选择文件夹</div>';
  var profile = libraryRuntimeState.profiles.filter(function (item) { return item.id === libraryRuntimeState.activeProfileId || item.active; })[0] || {};
  ['name', 'url', 'username'].forEach(function (key) { var node = document.getElementById('library-profile-' + key); if (node && !node.value) node.value = profile[key] || ''; });
}
async function librarySettingsLoadProfiles() {
  if (!window.desktopWindow || typeof window.desktopWindow.getNavidromeProfiles !== 'function') return;
  var result = await window.desktopWindow.getNavidromeProfiles();
  if (result && result.ok) { libraryRuntimeState.profiles = result.profiles || []; libraryRuntimeState.activeProfileId = result.activeId || ''; renderLibrarySettings(); }
}
function librarySettingsNewProfile() { libraryRuntimeState.activeProfileId = ''; ['name', 'url', 'username', 'password'].forEach(function (key) { var node = document.getElementById('library-profile-' + key); if (node) node.value = ''; }); var status = document.getElementById('library-profile-status'); if (status) status.textContent = '填写新的 Navidrome 账号'; }
function librarySettingsEdit(id) { var profile = libraryRuntimeState.profiles.filter(function (item) { return item.id === id; })[0]; if (!profile) return; libraryRuntimeState.activeProfileId = id; ['name', 'url', 'username'].forEach(function (key) { var node = document.getElementById('library-profile-' + key); if (node) node.value = profile[key] || ''; }); var pass = document.getElementById('library-profile-password'); if (pass) pass.value = ''; var status = document.getElementById('library-profile-status'); if (status) status.textContent = '密码留空表示沿用已保存凭据'; }
async function librarySettingsTestProfile() { var status = document.getElementById('library-profile-status'); if (status) status.textContent = '正在连接…'; var result = window.desktopWindow && await window.desktopWindow.testNavidromeProfile(currentLibraryProfileDraft()); if (status) status.textContent = result && result.ok ? '连接成功 · Navidrome 可用' : ('连接失败 · ' + (result && (result.message || result.error) || '请检查地址、账号和密码')); }
async function librarySettingsSaveProfile() { var draft = currentLibraryProfileDraft(); var status = document.getElementById('library-profile-status'); if (status) status.textContent = '正在保存…'; if (!window.desktopWindow || typeof window.desktopWindow.saveNavidromeProfile !== 'function') { if (status) status.textContent = '当前环境不是 Electron 桌面版'; return; } var result = await window.desktopWindow.saveNavidromeProfile(Object.assign({}, draft, { activate: true })); if (!result || !result.ok) { if (status) status.textContent = result && (result.message || result.error) || '保存失败'; return; } libraryRuntimeState.profiles = result.profiles || []; libraryRuntimeState.activeProfileId = result.activeId || draft.id; await refreshLoginStatus(true); renderLibrarySettings(); if (status) status.textContent = '已保存并切换'; }
async function librarySettingsActivate(id) { var result = window.desktopWindow && await window.desktopWindow.activateNavidromeProfile(id); if (result && result.ok) { libraryRuntimeState.profiles = result.profiles || []; libraryRuntimeState.activeProfileId = result.activeId || id; await refreshLoginStatus(true); renderLibrarySettings(); } }
async function librarySettingsDelete(id) { if (!confirm('删除这个 Navidrome 账号配置？')) return; var result = window.desktopWindow && await window.desktopWindow.deleteNavidromeProfile(id); if (result && result.ok) { libraryRuntimeState.profiles = result.profiles || []; libraryRuntimeState.activeProfileId = result.activeId || ''; await refreshLoginStatus(true); renderLibrarySettings(); } }
async function librarySettingsChooseRoots() { var status = document.getElementById('library-local-status'); if (status) status.textContent = '正在扫描…'; var result = window.desktopWindow && await window.desktopWindow.chooseLocalLibraryRoots(); if (result && result.ok) { libraryRuntimeState.status = Object.assign({}, libraryRuntimeState.status, { local: result.status }); await refreshUserPlaylists(true); await loadHomeDiscover(true); renderLibrarySettings(); if (status) status.textContent = '扫描完成 · ' + (result.status.trackCount || 0) + ' 首'; } else if (status && !(result && result.canceled)) status.textContent = result && (result.error || result.message) || '选择文件夹失败'; }
async function librarySettingsRescan() { var status = document.getElementById('library-local-status'); if (status) status.textContent = '正在重新扫描…'; var result = window.desktopWindow && await window.desktopWindow.rescanLocalLibrary(true); if (result && result.ok) { libraryRuntimeState.status = Object.assign({}, libraryRuntimeState.status, { local: result.status }); await refreshUserPlaylists(true); await loadHomeDiscover(true); renderLibrarySettings(); if (status) status.textContent = '扫描完成 · ' + (result.status.trackCount || 0) + ' 首'; } else if (status) status.textContent = result && (result.error || result.message) || '扫描失败'; }

function songAccountProvider(song) { return libraryProvider(song); }
function playlistAccountProvider(playlist) { return libraryProvider(playlist); }
function songAccountLoginStatus(provider) { return platformStatus(provider); }
function isSongAccountLoggedIn(provider) { return hasPlatformLogin(provider); }
function songAccountUnsupportedMessage(provider, action) { return provider === 'local' ? '' : ''; }
function ensureLoggedInForAction() { return true; }
function songAccountAdapter(provider) { return { provider: provider, label: libraryProviderLabel(provider), like: true, likeCheckUrl: '/api/library/song/like/check', likeCheckParam: 'ids', likeUrl: '/api/library/song/like', collect: provider === 'navidrome', createPlaylist: provider === 'navidrome', playlistAddUrl: '/api/library/playlist/add-song', playlistCreateUrl: '/api/library/playlist/create', playlistTracksUrl: '/api/library/playlist/tracks' }; }
function songAccountIdentityValues(song) { return [song && (song.id || song.providerSongId || song.localId)].filter(Boolean).map(String); }
function songAccountId(song) { return songAccountIdentityValues(song)[0] || ''; }
function songAccountStateKey(song) { var id = songAccountId(song); return id ? libraryProvider(song) + ':' + id : ''; }
function isCloudSong(song) { return libraryProvider(song) === 'navidrome'; }
function isSongLiked(song) { var key = songAccountStateKey(song); return !!(key && likedSongMap[key]); }
function syncLikeStatusForSongs(songs) {
  var ids = (songs || []).map(songAccountId).filter(Boolean); if (!ids.length) return;
  apiJson('/api/library/song/like/check?ids=' + encodeURIComponent(ids.join(','))).then(function (data) { Object.keys(data && data.liked || {}).forEach(function (id) { var song = (songs || []).filter(function (item) { return songAccountId(item) === id; })[0]; var key = song && songAccountStateKey(song); if (key) likedSongMap[key] = !!data.liked[id]; }); updateLikeButtons(); refreshSearchResultActionStates(); }).catch(function () {});
}
async function toggleLikeSong(song) {
  var id = songAccountId(song); if (!id) return; var next = !isSongLiked(song); var key = songAccountStateKey(song); likedSongMap[key] = next; updateLikeButtons(song); try { var result = await apiJson('/api/library/song/like', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song: song, like: next }) }); if (result && result.error) throw new Error(result.message || result.error); showToast(next ? '已加入收藏' : '已取消收藏'); } catch (error) { likedSongMap[key] = !next; updateLikeButtons(song); showToast('收藏操作失败'); } refreshSearchResultActionStates(); }

function updatePlaybackQualityUi() { var label = document.getElementById('quality-btn-label'); if (label) label.textContent = '原始'; var button = document.getElementById('quality-btn'); if (button) button.title = '媒体库原始音质'; var list = document.getElementById('quality-option-list'); if (list) list.innerHTML = '<div class="quality-option active" style="padding:10px 12px">媒体库原始音质</div>'; }
function setPlaybackQuality() { showToast('媒体库使用原始音频质量'); }
function playbackQualityOptions() { return [{ key: 'lossless', title: '原始音质', sub: 'Navidrome / 本地文件' }]; }
function getProviderPlaybackQuality() { return 'lossless'; }
function getPlaybackQualityForSong() { return 'lossless'; }
function normalizePlaybackQualityForProvider() { return 'lossless'; }
function playbackQualityLabel() { return '原始音质'; }
function playbackQualityShortLabel() { return '原始'; }

// The legacy homepage renderer is still useful for its visual layout, but its
// fallback copy and tile list mention platform login/radio features.  Wrap it
// once at runtime so those strings and actions cannot reappear when the local
// library is empty or a status refresh redraws the homepage.
var libraryLegacyRenderHomeDiscover = window.renderHomeDiscover;
window.renderHomeDiscover = function () {
  if (typeof libraryLegacyRenderHomeDiscover === 'function') libraryLegacyRenderHomeDiscover();
  var loggedIn = !!(homeDiscoverState && homeDiscoverState.loggedIn);
  var subtitle = document.getElementById('home-subtitle');
  if (subtitle) subtitle.textContent = loggedIn
    ? '从 Navidrome 歌单、最近播放和本地音乐开始。'
    : '连接 Navidrome 或选择本地文件夹即可开始，也可以直接搜索或导入本地音乐。';
  var note = document.getElementById('home-rail-note');
  if (note && !loggedIn) note.textContent = '连接 Navidrome 或选择本地文件夹后开始';
  var meta = document.getElementById('home-weather-meta');
  if (meta) meta.innerHTML = ['Navidrome', '本地音乐', '自动歌单'].map(function (item) {
    return '<span class="home-weather-pill">' + escHtml(item) + '</span>';
  }).join('');
};
window.fallbackHomeTiles = function () {
  return [
    { kind: 'library', title: '打开音乐库设置', sub: '连接 Navidrome 或选择文件夹' },
    { kind: 'search', title: '搜索一首歌', sub: '在你的媒体库中查找', query: '' },
    { kind: 'local', title: '导入本地音乐', sub: '本地文件也能可视化' },
    { kind: 'guide', title: '看看视觉舞台', sub: '粒子 / 歌词 / 封面' },
  ];
};
var libraryLegacyOpenHomeLibrary = window.openHomeLibrary;
window.openHomeLibrary = function () {
  if (typeof openLibrarySettings === 'function') openLibrarySettings();
  else if (typeof libraryLegacyOpenHomeLibrary === 'function') libraryLegacyOpenHomeLibrary();
};

function bindLibraryRuntime() {
  ensureLibrarySettingsModal();
  updateSearchModeTabs();
  renderUserBtn();
  var panel = document.getElementById('pl-pane');
  if (panel) { var chip = panel.querySelector('.queue-chip'); if (chip) chip.textContent = 'Navidrome / 本地歌单'; }
  var podcastTab = document.getElementById('tab-podcast'); if (podcastTab) podcastTab.hidden = true;
  fetchLibraryStatus().then(function () { libraryRefreshStatusUi(); }).catch(function () {});
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindLibraryRuntime, { once: true }); else bindLibraryRuntime();
