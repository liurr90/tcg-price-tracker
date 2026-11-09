const API_BASE = '/api';

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchGames() {
  const res = await fetch(`${API_BASE}/games`);
  if (!res.ok) throw new Error('Failed to fetch games');
  return res.json();
}

export async function fetchSets(gameId = '', status = '') {
  let url = `${API_BASE}/sets?`;
  if (gameId) url += `game=${encodeURIComponent(gameId)}&`;
  if (status) url += `status=${encodeURIComponent(status)}&`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch sets');
  return res.json();
}

export async function fetchCards(params = {}) {
  const query = new URLSearchParams();
  if (params.game) query.append('game', params.game);
  if (params.sets) {
    const setsVal = Array.isArray(params.sets) ? params.sets.join(',') : params.sets;
    if (setsVal) query.append('sets', setsVal);
  } else if (params.set) {
    const setVal = Array.isArray(params.set) ? params.set.join(',') : params.set;
    if (setVal) query.append('sets', setVal);
  }
  if (params.search) query.append('search', params.search);
  if (params.rarity) query.append('rarity', params.rarity);
  if (params.sort) query.append('sort', params.sort);
  if (params.graded_only) query.append('graded_only', 'true');
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit || 24);

  const res = await fetch(`${API_BASE}/cards?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
}

export async function fetchCardDetails(cardId) {
  const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(cardId)}`);
  if (!res.ok) throw new Error('Failed to fetch card details');
  return res.json();
}

export async function triggerLiveQuery(cardId) {
  const res = await fetch(`${API_BASE}/cards/${encodeURIComponent(cardId)}/live-price`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to execute live price query');
  return res.json();
}

export async function triggerPriceSync(gameId = null) {
  const res = await fetch(`${API_BASE}/sync/prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game: gameId })
  });
  if (!res.ok) throw new Error('Failed to trigger price sync');
  return res.json();
}

export async function fetchSyncStatus() {
  const res = await fetch(`${API_BASE}/sync/status`);
  if (!res.ok) throw new Error('Failed to fetch sync status');
  return res.json();
}

export async function fetchSetStats() {
  const res = await fetch(`${API_BASE}/sets/stats`);
  if (!res.ok) throw new Error('Failed to fetch set stats');
  return res.json();
}

export async function fetchImageStats() {
  const res = await fetch(`${API_BASE}/images/status`);
  if (!res.ok) throw new Error('Failed to fetch image stats');
  return res.json();
}

export async function triggerImageDownload(options = {}) {
  const res = await fetch(`${API_BASE}/images/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  if (!res.ok) throw new Error('Failed to start image download');
  return res.json();
}

export async function stopImageDownload() {
  const res = await fetch(`${API_BASE}/images/stop`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to stop image download');
  return res.json();
}

export async function fetchCompressionStatus() {
  const res = await fetch(`${API_BASE}/images/compress/status`);
  if (!res.ok) throw new Error('Failed to fetch compression status');
  return res.json();
}

export async function triggerCompression() {
  const res = await fetch(`${API_BASE}/images/compress`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to trigger compression');
  return res.json();
}


