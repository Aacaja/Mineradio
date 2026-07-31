'use strict';

// A first-party catalogue surface for the Navidrome/local library.  The
// existing left panel remains useful for the queue, but it is deliberately
// transient; this browser gives the library a stable home-page entry and
// keeps album browsing independent from the visual shelf.
(function installLibraryBrowser() {
  var state = {
    open: false,
    view: 'albums',
    source: '',
    sort: 'alphabeticalByName',
    albums: [],
    playlists: [],
    offset: 0,
    total: 0,
    hasMore: false,
    loading: false,
    error: '',
    detail: null,
    detailLoading: false,
    detailError: '',
    token: 0,
  };

  function browserNode(id) { return document.getElementById(id); }

  function browserStatus() {
    return (typeof libraryRuntimeState === 'object' && libraryRuntimeState && libraryRuntimeState.status) || {};
  }

  function browserHasRemote() {
    var status = browserStatus();
    return !!(status.configured || status.connected || status.navidrome && (status.navidrome.configured || status.navidrome.connected));
  }

  function browserHasLocal() {
    var local = browserStatus().local || {};
    return !!(Number(local.trackCount) || Array.isArray(local.roots) && local.roots.length);
  }

  function browserDefaultSource() {
    if (browserHasRemote()) return 'navidrome';
    if (browserHasLocal()) return 'local';
    return 'navidrome';
  }

  function browserSourceLabel(source) { return source === 'local' ? '本地音乐' : 'Navidrome'; }

  function browserCover(item, size) {
    if (!item) return '';
    if (typeof songCoverSrc === 'function') return songCoverSrc(item, size || 240);
    return item.cover || '';
  }

  function browserInitials(text) {
    var chars = Array.from(String(text || '音乐').replace(/\s+/g, ''));
    return chars.slice(0, 2).join('') || '♪';
  }

  function browserFormatDuration(value) {
    var seconds = Math.max(0, Math.round(Number(value || 0) / 1000));
    if (!seconds) return '';
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function browserEnsure() {
    var existing = browserNode('library-browser-mask');
    if (existing) return existing;
    var mask = document.createElement('div');
    mask.id = 'library-browser-mask';
    mask.className = 'modal-mask library-browser-mask';
    mask.setAttribute('aria-hidden', 'true');
    mask.innerHTML = '<div class="modal library-browser-dialog" role="dialog" aria-modal="true" aria-labelledby="library-browser-title">' +
      '<div class="library-browser-head">' +
      '<button type="button" class="library-browser-back" data-library-browser-back aria-label="返回音乐库" hidden>‹</button>' +
      '<div class="library-browser-heading"><div class="library-browser-kicker">MY LIBRARY · A</div><h2 id="library-browser-title">音乐库</h2><p id="library-browser-subtitle">浏览你的 Navidrome 专辑、歌曲和歌单</p></div>' +
      '<button type="button" class="library-browser-close" data-library-browser-close aria-label="关闭音乐库">×</button>' +
      '</div>' +
      '<div id="library-browser-toolbar" class="library-browser-toolbar"></div>' +
      '<div id="library-browser-status" class="library-browser-status" role="status" aria-live="polite"></div>' +
      '<div id="library-browser-body" class="library-browser-body"></div>' +
      '</div>';
    document.body.appendChild(mask);

    mask.addEventListener('click', function (event) {
      if (event.target === mask || event.target.closest('[data-library-browser-close]')) closeLibraryBrowser();
    });
    mask.querySelector('[data-library-browser-back]').addEventListener('click', function () {
      state.detail = null;
      state.detailError = '';
      state.detailLoading = false;
      renderLibraryBrowser();
    });
    mask.addEventListener('click', handleLibraryBrowserClick);
    mask.addEventListener('change', function (event) {
      var select = event.target && event.target.closest ? event.target.closest('[data-library-browser-sort]') : null;
      if (!select || state.detail || state.view !== 'albums') return;
      state.sort = select.value || 'alphabeticalByName';
      loadLibraryBrowserAlbums(true);
    });
    browserNode('library-browser-body').addEventListener('scroll', function () {
      if (!state.open || state.detail || state.view !== 'albums' || state.loading || !state.hasMore) return;
      var body = browserNode('library-browser-body');
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 420) loadLibraryBrowserAlbums(false);
    }, { passive: true });
    return mask;
  }

  function browserToolbarHtml() {
    if (state.detail) {
      return '<div class="library-browser-detail-toolbar"><span>' + (state.detail.kind === 'playlist' ? '歌单详情 · ' : '专辑详情 · ') + escHtml(browserSourceLabel(state.detail.provider)) + '</span>' +
        '<button type="button" class="library-browser-tool-btn" data-library-browser-panel>打开左侧歌单</button></div>';
    }
    var sources = [];
    if (browserHasRemote()) sources.push('<button type="button" class="library-browser-source' + (state.source === 'navidrome' ? ' active' : '') + '" data-library-browser-source="navidrome">Navidrome</button>');
    if (browserHasLocal()) sources.push('<button type="button" class="library-browser-source' + (state.source === 'local' ? ' active' : '') + '" data-library-browser-source="local">本地音乐</button>');
    if (!sources.length) sources.push('<button type="button" class="library-browser-source active" data-library-browser-source="navidrome">Navidrome</button>');
    var sortControl = state.view === 'albums'
      ? '<select class="library-browser-sort" data-library-browser-sort aria-label="专辑排序">' +
        '<option value="alphabeticalByName"' + (state.sort === 'alphabeticalByName' ? ' selected' : '') + '>按专辑名</option>' +
        '<option value="alphabeticalByArtist"' + (state.sort === 'alphabeticalByArtist' ? ' selected' : '') + '>按艺术家</option>' +
        '<option value="newest"' + (state.sort === 'newest' ? ' selected' : '') + '>最新加入</option></select>'
      : '';
    return '<div class="library-browser-tabs" role="tablist" aria-label="音乐库内容">' +
      '<button type="button" role="tab" aria-selected="' + (state.view === 'albums' ? 'true' : 'false') + '" class="library-browser-tab' + (state.view === 'albums' ? ' active' : '') + '" data-library-browser-view="albums">专辑</button>' +
      '<button type="button" role="tab" aria-selected="' + (state.view === 'playlists' ? 'true' : 'false') + '" class="library-browser-tab' + (state.view === 'playlists' ? ' active' : '') + '" data-library-browser-view="playlists">歌单</button>' +
      '</div><div class="library-browser-toolbar-right"><div class="library-browser-sources">' + sources.join('') + '</div>' +
      sortControl + '<button type="button" class="library-browser-tool-btn" data-library-browser-refresh>刷新</button><button type="button" class="library-browser-tool-btn" data-library-browser-settings>设置</button></div>';
  }

  function browserStatusHtml() {
    if (state.loading && !state.albums.length && !state.playlists.length && !state.detail) return '正在整理你的音乐库…';
    if (state.error && !state.albums.length && !state.playlists.length) return '<span class="library-browser-error">' + escHtml(state.error) + '</span>';
    if (state.detailLoading) return '正在读取专辑歌曲…';
    if (state.detailError) return '<span class="library-browser-error">' + escHtml(state.detailError) + '</span>';
    return '';
  }

  function browserEmptyHtml(message, action) {
    return '<div class="library-browser-empty"><div class="library-browser-empty-icon">♪</div><b>' + escHtml(message) + '</b><span>' +
      (action || '连接 Navidrome 或在设置中选择本地音乐文件夹后，这里会显示你的内容。') + '</span></div>';
  }

  function renderAlbumCard(album, index) {
    var cover = browserCover(album, 320);
    var provider = album.provider === 'local' ? 'local' : 'navidrome';
    var coverImage = cover ? '<img src="' + escHtml(cover) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove(\'has-cover\');this.remove()">' : '';
    return '<button type="button" class="library-album-card" data-library-album-index="' + index + '">' +
      '<span class="library-album-cover' + (cover ? ' has-cover' : '') + '">' + coverImage + '<span>' + escHtml(browserInitials(album.name || album.album)) + '</span></span>' +
      '<span class="library-album-name">' + escHtml(album.name || album.album || '未命名专辑') + '</span>' +
      '<span class="library-album-meta">' + escHtml(album.artist || album.albumArtist || '未知艺术家') + '</span>' +
      '<span class="library-album-count">' + (Number(album.songCount) || 0) + ' 首 · ' + escHtml(provider === 'local' ? '本地' : 'ND') + '</span>' +
      '</button>';
  }

  function renderAlbums() {
    var body = browserNode('library-browser-body');
    if (!body) return;
    var cards = state.albums.map(renderAlbumCard).join('');
    if (!cards && !state.loading) {
      body.innerHTML = browserEmptyHtml('还没有可浏览的专辑');
      return;
    }
    body.innerHTML = '<div class="library-browser-section-head"><div><b>全部专辑</b><small>' +
      (state.total ? state.total + ' 张 · 点进专辑查看全部歌曲' : (state.albums.length ? state.albums.length + ' 张已加载 · 点进专辑查看全部歌曲' : '点进专辑查看歌曲')) +
      '</small></div><span class="library-browser-section-note">点击封面即可播放</span></div>' +
      '<div class="library-album-grid">' + cards + '</div>' +
      (state.loading ? '<div class="library-browser-more">正在载入更多专辑…</div>' : (state.hasMore ? '<div class="library-browser-more">向下滚动继续浏览</div>' : ''));
  }

  function renderPlaylistCard(playlistItem, index) {
    var cover = browserCover({ cover: playlistItem.cover, provider: playlistItem.provider }, 220);
    var coverImage = cover ? '<img src="' + escHtml(cover) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove(\'has-cover\');this.remove()">' : '';
    return '<button type="button" class="library-playlist-card" data-library-playlist-index="' + index + '">' +
      '<span class="library-playlist-card-cover' + (cover ? ' has-cover' : '') + '">' + coverImage + '<span>' + escHtml(browserInitials(playlistItem.name)) + '</span></span>' +
      '<span class="library-playlist-card-copy"><b>' + escHtml(playlistItem.name || '未命名歌单') + '</b><small>' +
      (Number(playlistItem.trackCount) || 0) + ' 首 · ' + escHtml(playlistItem.creator || playlistItem.owner || browserSourceLabel(playlistItem.provider)) + '</small></span>' +
      '<span class="library-browser-chevron">›</span></button>';
  }

  function renderPlaylists() {
    var body = browserNode('library-browser-body');
    if (!body) return;
    if (!state.playlists.length && !state.loading) {
      body.innerHTML = browserEmptyHtml('还没有读取到歌单', 'Navidrome 歌单会在连接成功后自动出现在这里。');
      return;
    }
    body.innerHTML = '<div class="library-browser-section-head"><div><b>我的歌单</b><small>' + state.playlists.length + ' 个</small></div><button type="button" class="library-browser-tool-btn" data-library-browser-panel>打开左侧歌单</button></div>' +
      '<div class="library-playlist-grid">' + state.playlists.map(renderPlaylistCard).join('') + '</div>' +
      (state.loading ? '<div class="library-browser-more">正在刷新歌单…</div>' : '');
  }

  function renderDetail() {
    var body = browserNode('library-browser-body');
    if (!body || !state.detail) return;
    var detail = state.detail;
    var album = detail.album || {};
    var tracks = detail.tracks || detail.songs || [];
    var cover = browserCover(album, 520);
    var coverHtml = cover
      ? '<div class="library-detail-cover has-cover"><img src="' + escHtml(cover) + '" alt="" decoding="async" onerror="this.parentNode.classList.remove(\'has-cover\');this.remove()"><span>' + escHtml(browserInitials(album.name || detail.title)) + '</span></div>'
      : '<div class="library-detail-cover"><span>' + escHtml(browserInitials(album.name || detail.title)) + '</span></div>';
    var rows = tracks.map(function (song, index) {
      var thumb = browserCover(song, 84);
      var thumbHtml = thumb
        ? '<span class="library-detail-track-cover"><img src="' + escHtml(thumb) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()"><i>' + (index + 1) + '</i></span>'
        : '<span class="library-detail-track-cover"><i>' + (index + 1) + '</i></span>';
      return '<button type="button" class="library-detail-track" data-library-detail-track="' + index + '">' + thumbHtml +
        '<span class="library-detail-track-number">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="library-detail-track-copy"><b>' + escHtml(song.name || song.title || '未知歌曲') + '</b><small>' + escHtml(song.artist || album.artist || '未知艺术家') + '</small></span>' +
        '<span class="library-detail-track-duration">' + escHtml(browserFormatDuration(song.duration)) + '</span><span class="library-detail-track-play">▶</span></button>';
    }).join('');
    var kindLabel = detail.kind === 'playlist' ? 'PLAYLIST' : 'ALBUM';
    var moreButton = detail.kind === 'playlist' && detail.hasMore
      ? '<button type="button" class="library-browser-tool-btn" data-library-detail-more>' + (detail.loadingMore ? '正在加载…' : '继续加载歌曲') + '</button>'
      : '';
    body.innerHTML = '<div class="library-album-detail-head">' + coverHtml + '<div class="library-album-detail-copy"><div class="library-browser-kicker">' + escHtml(browserSourceLabel(album.provider || detail.provider)) + ' · ' + kindLabel + '</div><h3>' + escHtml(album.name || detail.title || '专辑详情') + '</h3><p>' + escHtml(album.artist || album.albumArtist || '未知艺术家') + '</p><span>' + tracks.length + (detail.total ? '/' + detail.total : '') + ' 首' + (album.year ? ' · ' + album.year : '') + '</span><button type="button" class="library-browser-play-all" data-library-detail-play>播放全部</button></div></div>' +
      '<div class="library-browser-section-head library-detail-section-head"><div><b>歌曲</b><small>点击任意歌曲开始播放</small></div></div>' +
      (rows ? '<div class="library-detail-track-list">' + rows + '</div>' : browserEmptyHtml(detail.kind === 'playlist' ? '这个歌单没有可播放歌曲' : '这个专辑没有可播放歌曲')) + moreButton;
  }

  function renderLibraryBrowser() {
    var mask = browserEnsure();
    var toolbar = browserNode('library-browser-toolbar');
    var body = browserNode('library-browser-body');
    var status = browserNode('library-browser-status');
    var title = browserNode('library-browser-title');
    var subtitle = browserNode('library-browser-subtitle');
    var back = mask.querySelector('[data-library-browser-back]');
    if (!toolbar || !body || !status) return;
    if (state.detail) {
      title.textContent = state.detail.album && state.detail.album.name || state.detail.title || '专辑详情';
      subtitle.textContent = '专辑内歌曲 · 点击即可播放';
      back.hidden = false;
      toolbar.innerHTML = browserToolbarHtml();
      renderDetail();
    } else {
      title.textContent = '音乐库';
      subtitle.textContent = state.view === 'albums' ? '浏览全部专辑，点进专辑查看和播放歌曲' : 'Navidrome 歌单与本地自动歌单';
      back.hidden = true;
      toolbar.innerHTML = browserToolbarHtml();
      if (state.view === 'playlists') renderPlaylists(); else renderAlbums();
    }
    status.innerHTML = browserStatusHtml();
  }

  function setBrowserView(view) {
    if (state.detail) return;
    state.view = view === 'playlists' ? 'playlists' : 'albums';
    state.error = '';
    if (state.view === 'playlists') {
      state.playlists = Array.isArray(userPlaylists) ? userPlaylists.slice() : [];
      renderLibraryBrowser();
      loadLibraryBrowserPlaylists();
    } else {
      state.albums = [];
      state.offset = 0;
      state.total = 0;
      state.hasMore = false;
      renderLibraryBrowser();
      loadLibraryBrowserAlbums(true);
    }
  }

  async function loadLibraryBrowserAlbums(reset) {
    if (state.loading || state.detail || state.view !== 'albums') return;
    if (reset) {
      state.albums = [];
      state.offset = 0;
      state.total = 0;
      state.hasMore = false;
      state.error = '';
    } else if (!state.hasMore) return;
    state.loading = true;
    var token = ++state.token;
    renderLibraryBrowser();
    try {
      var query = '/api/library/albums?source=' + encodeURIComponent(state.source || browserDefaultSource()) + '&sort=' + encodeURIComponent(state.sort) + '&limit=48&offset=' + encodeURIComponent(state.offset);
      var data = await apiJson(query, { timeoutMs: 20000 });
      if (token !== state.token || !state.open) return;
      var incoming = Array.isArray(data && data.albums) ? data.albums : [];
      var seen = Object.create(null);
      state.albums.forEach(function (item) {
        if (item) seen[(item.provider || state.source) + ':' + (item.id || item.albumId)] = true;
      });
      var uniqueIncoming = incoming.filter(function (item) {
        var key = (item && (item.provider || state.source) || '') + ':' + (item && (item.id || item.albumId) || '');
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
      state.albums = state.albums.concat(uniqueIncoming);
      state.total = data && data.total != null ? (Number(data.total) || 0) : 0;
      state.offset = Number(data && data.nextOffset);
      if (!isFinite(state.offset) || state.offset <= (Number(data && data.offset) || 0)) state.offset = (Number(data && data.offset) || 0) + incoming.length;
      state.hasMore = !!(data && data.hasMore) && incoming.length > 0;
      state.error = data && (data.message || data.error) || '';
    } catch (error) {
      if (token === state.token) state.error = error && (error.message || error.error) || '专辑目录读取失败，请检查连接。';
    } finally {
      if (token === state.token) {
        state.loading = false;
        renderLibraryBrowser();
      }
    }
  }

  async function loadLibraryBrowserPlaylists() {
    if (state.loading || state.detail || state.view !== 'playlists') return;
    state.loading = true;
    state.error = '';
    var token = ++state.token;
    renderLibraryBrowser();
    try {
      await refreshUserPlaylists(false);
      if (token !== state.token || !state.open) return;
      state.playlists = Array.isArray(userPlaylists) ? userPlaylists.slice() : [];
    } catch (error) {
      if (token === state.token) state.error = error && error.message || '歌单读取失败，请检查连接。';
    } finally {
      if (token === state.token) {
        state.loading = false;
        renderLibraryBrowser();
      }
    }
  }

  async function openLibraryBrowserDetail(item, kind) {
    if (!item || !item.id) return;
    state.detail = {
      kind: kind,
      id: String(item.id),
      provider: item.provider === 'local' ? 'local' : 'navidrome',
      album: kind === 'album' ? item : null,
      title: item.name || '',
      tracks: [],
      total: Number(item.trackCount) || 0,
      nextOffset: 0,
      hasMore: kind === 'playlist',
      loadingMore: false,
    };
    state.detailLoading = true;
    state.detailError = '';
    var token = ++state.token;
    renderLibraryBrowser();
    try {
      var endpoint = kind === 'playlist'
        ? '/api/library/playlist/tracks?id=' + encodeURIComponent(item.id) + '&offset=0&limit=500'
        : '/api/library/album?id=' + encodeURIComponent(item.id);
      var data = await apiJson(endpoint, { timeoutMs: 20000 });
      if (token !== state.token || !state.open) return;
      var tracks = (data && (data.tracks || data.songs) || []).map(cloneSong);
      if (data && data.error && !tracks.length) throw new Error(data.message || data.error);
      state.detail = {
        kind: kind,
        id: String(item.id),
        provider: item.provider === 'local' ? 'local' : 'navidrome',
        album: kind === 'album' ? Object.assign({}, item, data && data.album || {}) : { name: item.name, artist: item.creator || item.owner, cover: item.cover, provider: item.provider },
        title: item.name || '',
        tracks: tracks,
        total: Math.max(tracks.length, Number(data && (data.total || data.playlist && data.playlist.trackCount)) || Number(item.trackCount) || 0),
        nextOffset: Math.max(Number(data && data.nextOffset) || tracks.length, tracks.length),
        hasMore: kind === 'playlist' && !!(data && data.hasMore),
        loadingMore: false,
      };
    } catch (error) {
      if (token === state.token) state.detailError = error && error.message || '内容读取失败，请重试。';
    } finally {
      if (token === state.token) {
        state.detailLoading = false;
        renderLibraryBrowser();
      }
    }
  }

  async function loadMoreLibraryBrowserPlaylistTracks() {
    var detail = state.detail;
    if (!detail || detail.kind !== 'playlist' || detail.loadingMore || !detail.hasMore) return false;
    var offset = Math.max(0, Number(detail.nextOffset) || detail.tracks.length);
    var token = ++state.token;
    detail.loadingMore = true;
    renderLibraryBrowser();
    try {
      var data = await apiJson('/api/library/playlist/tracks?id=' + encodeURIComponent(detail.id) + '&offset=' + offset + '&limit=500', { timeoutMs: 20000 });
      if (token !== state.token || !state.open || state.detail !== detail) return false;
      var incoming = (data && data.tracks || []).map(cloneSong);
      var seen = Object.create(null);
      detail.tracks.forEach(function (song) { if (song && song.id) seen[String(song.id)] = true; });
      incoming.forEach(function (song) { if (song && song.id && !seen[String(song.id)]) { seen[String(song.id)] = true; detail.tracks.push(song); } });
      detail.total = Math.max(detail.total || 0, Number(data && (data.total || data.playlist && data.playlist.trackCount)) || 0, detail.tracks.length);
      detail.nextOffset = Math.max(offset + incoming.length, Number(data && data.nextOffset) || 0, detail.tracks.length);
      detail.hasMore = !!(data && data.hasMore) && incoming.length > 0 && detail.nextOffset > offset;
      return incoming.length > 0;
    } catch (error) {
      if (token === state.token) showToast('后续歌曲加载失败，请重试');
      return false;
    } finally {
      if (token === state.token && state.detail === detail) {
        detail.loadingMore = false;
        renderLibraryBrowser();
      }
    }
  }

  function playLibraryBrowserTracks(tracks, title, index) {
    tracks = (tracks || []).map(cloneSong);
    if (!tracks.length) { showToast('没有可播放的歌曲'); return; }
    if (state.detail && state.detail.kind === 'playlist' && state.detail.id && typeof loadPlaylistIntoQueueById === 'function') {
      Promise.resolve(loadPlaylistIntoQueueById(state.detail.id, true, title || '歌单', {
        seedTracks: tracks,
        startIndex: Number(index) || 0,
        total: state.detail.total,
        nextOffset: state.detail.nextOffset,
        hasMore: state.detail.hasMore,
        preserveHomeState: true,
      })).catch(function (error) { console.warn('[LibraryBrowserPlaylistPlay]', error); showToast('歌单播放启动失败'); });
      return;
    }
    if (typeof loadLibraryTracksIntoQueue === 'function') {
      loadLibraryTracksIntoQueue(tracks, title || '音乐库', Number(index) || 0, true);
      return;
    }
    playQueue = tracks;
    currentIdx = Math.max(0, Math.min(tracks.length - 1, Number(index) || 0));
    safeRenderQueuePanel('library-browser-play');
    safeShelfRebuild('library-browser-play', true);
    playQueueAt(currentIdx);
  }

  function openLibraryBrowser(view) {
    var mask = browserEnsure();
    state.open = true;
    state.view = view === 'playlists' ? 'playlists' : 'albums';
    state.source = state.source || browserDefaultSource();
    state.detail = null;
    state.error = '';
    state.detailError = '';
    mask.classList.add('show');
    mask.setAttribute('aria-hidden', 'false');
    renderLibraryBrowser();
    if (state.view === 'playlists') loadLibraryBrowserPlaylists();
    else loadLibraryBrowserAlbums(true);
  }

  function closeLibraryBrowser() {
    var mask = browserNode('library-browser-mask');
    state.open = false;
    state.token += 1;
    state.loading = false;
    state.detailLoading = false;
    if (mask) {
      mask.classList.remove('show');
      mask.setAttribute('aria-hidden', 'true');
    }
  }

  function openLibraryBrowserSettings() {
    closeLibraryBrowser();
    if (typeof openLibrarySettings === 'function') openLibrarySettings();
  }

  function openLibraryEntry(view) {
    var available = browserHasRemote() || browserHasLocal() || homeDiscoverState && homeDiscoverState.loggedIn;
    if (!available && typeof openLibrarySettings === 'function') {
      openLibrarySettings();
      return;
    }
    openLibraryBrowser(view || 'albums');
  }

  function openLibraryBrowserPlaylistPanel() {
    closeLibraryBrowser();
    if (typeof openPlaylistPanelTab === 'function') openPlaylistPanelTab('playlists', true);
    if (typeof refreshUserPlaylists === 'function') refreshUserPlaylists(true);
  }

  function handleLibraryBrowserClick(event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-library-browser-view],[data-library-browser-source],[data-library-browser-refresh],[data-library-browser-panel],[data-library-browser-settings],[data-library-album-index],[data-library-playlist-index],[data-library-detail-more],[data-library-detail-play],[data-library-detail-track]') : null;
    if (!target) return;
    event.preventDefault();
    if (target.hasAttribute('data-library-browser-view')) { setBrowserView(target.getAttribute('data-library-browser-view')); return; }
    if (target.hasAttribute('data-library-browser-source')) {
      state.source = target.getAttribute('data-library-browser-source') || browserDefaultSource();
      state.view = 'albums';
      state.detail = null;
      state.albums = [];
      state.offset = 0;
      state.total = 0;
      state.hasMore = false;
      renderLibraryBrowser();
      loadLibraryBrowserAlbums(true);
      return;
    }
    if (target.hasAttribute('data-library-browser-refresh')) {
      if (state.view === 'playlists') loadLibraryBrowserPlaylists(); else loadLibraryBrowserAlbums(true);
      return;
    }
    if (target.hasAttribute('data-library-browser-settings')) { openLibraryBrowserSettings(); return; }
    if (target.hasAttribute('data-library-browser-panel')) { openLibraryBrowserPlaylistPanel(); return; }
    if (target.hasAttribute('data-library-album-index')) {
      var album = state.albums[Number(target.getAttribute('data-library-album-index'))];
      openLibraryBrowserDetail(album, 'album');
      return;
    }
    if (target.hasAttribute('data-library-playlist-index')) {
      var playlistItem = state.playlists[Number(target.getAttribute('data-library-playlist-index'))];
      openLibraryBrowserDetail(playlistItem, 'playlist');
      return;
    }
    if (target.hasAttribute('data-library-detail-more')) {
      loadMoreLibraryBrowserPlaylistTracks();
      return;
    }
    if (target.hasAttribute('data-library-detail-play')) {
      playLibraryBrowserTracks(state.detail && state.detail.tracks, state.detail && state.detail.title || state.detail && state.detail.album && state.detail.album.name, 0);
      return;
    }
    if (target.hasAttribute('data-library-detail-track')) {
      playLibraryBrowserTracks(state.detail && state.detail.tracks, state.detail && state.detail.title || state.detail && state.detail.album && state.detail.album.name, Number(target.getAttribute('data-library-detail-track')) || 0);
    }
  }

  document.addEventListener('keydown', function (event) {
    if (state.open && event.key === 'Escape') closeLibraryBrowser();
  });

  // This is the important routing fix: the home library card opens content,
  // while the account button continues to open the connection settings.
  window.openLibraryBrowser = openLibraryBrowser;
  window.closeLibraryBrowser = closeLibraryBrowser;
  window.openHomeLibrary = function () { openLibraryEntry('albums'); };
  window.openHomeDashboardLibrary = function () { openLibraryEntry('albums'); };
  window.openLibraryBrowserSettings = openLibraryBrowserSettings;
  window.openLibraryBrowserPlaylistPanel = openLibraryBrowserPlaylistPanel;
})();
