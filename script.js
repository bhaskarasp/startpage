// Utility: Local Storage with fallback
const storage = {
  get(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch {}
  }
};

// Toast notification
function toast(msg, type='ok', timeout=2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show';
  if (type === 'error') el.style.background = '#ef4444ee';
  else if (type === 'ok') el.style.background = '';
  setTimeout(()=>{ el.className=''; }, timeout);
}

// Theme
function applyTheme(theme) {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  document.getElementById('mode-toggle').textContent =
    (document.documentElement.getAttribute('data-theme') === 'dark') ? '☀️' : '🌙';
}
function initTheme() {
  const savedTheme = storage.get('theme', 'auto');
  applyTheme(savedTheme);
  document.getElementById('theme-select').value = savedTheme;
}

// Theme toggle button
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('mode-toggle').addEventListener('click', () => {
    let current = document.documentElement.getAttribute('data-theme');
    let next = current === 'dark' ? 'light' : 'dark';
    storage.set('theme', next);
    applyTheme(next);
  });
});

// Background customization
function applyBg(type, url) {
  document.body.classList.remove('bg-gradient');
  if (type === 'gradient') {
    document.body.classList.add('bg-gradient');
    document.getElementById('background-overlay').style.backgroundImage = '';
    document.getElementById('background-overlay').style.opacity = '0.25';
  } else if (type === 'custom' && url) {
    document.body.classList.remove('bg-gradient');
    document.getElementById('background-overlay').style.backgroundImage = `url('${url.replace(/'/g, "%27")}')`;
    document.getElementById('background-overlay').style.opacity = '0.20';
  } else { // default
    document.body.classList.remove('bg-gradient');
    document.getElementById('background-overlay').style.backgroundImage = '';
    document.getElementById('background-overlay').style.opacity = '0.18';
  }
}
function initBg() {
  const bgType = storage.get('bgType', 'default');
  const bgUrl = storage.get('backgroundUrl', '');
  document.getElementById('bg-type').value = bgType;
  document.getElementById('bg-url').value = bgUrl;
  document.getElementById('bg-url-label').style.display = (bgType === 'custom') ? '' : 'none';
  applyBg(bgType, bgUrl);
}

// Settings Modal
function openSettings() {
  document.getElementById('settings-modal').setAttribute('aria-hidden', 'false');
  document.getElementById('settings-form').querySelector('input,select,button').focus();
}
function closeSettings() {
  document.getElementById('settings-modal').setAttribute('aria-hidden', 'true');
}
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
document.getElementById('settings-reset').addEventListener('click', () => {
  localStorage.clear();
  toast('Settings reset!', 'ok');
  location.reload();
});
// Modal keyboard/focus trap
document.getElementById('settings-modal').addEventListener('keydown', function(e){
  if (e.key === 'Escape') closeSettings();
  if (e.key !== 'Tab') return;
  const focusable = this.querySelectorAll('input,select,button');
  const first = focusable[0], last = focusable[focusable.length-1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus(); e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus(); e.preventDefault();
  }
});
document.getElementById('settings-modal').addEventListener('click', function(e){
  if (e.target === this) closeSettings();
});
document.getElementById('bg-type').addEventListener('change', function(){
  document.getElementById('bg-url-label').style.display = this.value === 'custom' ? '' : 'none';
});

document.getElementById('settings-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const bgType = document.getElementById('bg-type').value;
  const bgUrl = document.getElementById('bg-url').value.trim();
  const theme = document.getElementById('theme-select').value;
  storage.set('bgType', bgType);
  storage.set('backgroundUrl', bgUrl);
  storage.set('theme', theme);
  applyBg(bgType, bgUrl);
  applyTheme(theme);
  // Widgets toggling
  document.querySelectorAll('.widget-toggle').forEach(cb => {
    storage.set(`widget:${cb.value}:visible`, cb.checked);
    document.getElementById(cb.value).style.display = cb.checked ? '' : 'none';
  });
  closeSettings();
  toast('Settings saved!');
});
function initWidgetToggles() {
  document.querySelectorAll('.widget-toggle').forEach(cb => {
    const visible = storage.get(`widget:${cb.value}:visible`, true);
    cb.checked = visible;
    document.getElementById(cb.value).style.display = visible ? '' : 'none';
  });
}
// Hide widget by close button
document.querySelectorAll('.widget-close').forEach(btn => {
  btn.addEventListener('click', function() {
    const widget = this.closest('.widget');
    widget.style.display = 'none';
    storage.set(`widget:${widget.id}:visible`, false);
    document.querySelectorAll('.widget-toggle').forEach(cb => {
      if (cb.value === widget.id) cb.checked = false;
    });
    toast(widget.querySelector('.widget-header span').textContent + " hidden. Use settings to restore.");
  });
});

// WEATHER WIDGET: with manual city, unit toggle, error/retry, cache
const weatherDescMap = {
  0: ["Clear", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Depositing rime fog", "🌫️"], 51: ["Drizzle", "🌦️"], 53: ["Drizzle", "🌦️"],
  55: ["Drizzle", "🌦️"], 56: ["Freezing Drizzle", "🌧️"], 57: ["Freezing Drizzle", "🌧️"],
  61: ["Rain", "🌧️"], 63: ["Rain", "🌧️"], 65: ["Rain", "🌧️"], 66: ["Freezing Rain", "🌧️"],
  67: ["Freezing Rain", "🌧️"], 71: ["Snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Snow", "🌨️"],
  77: ["Snow grains", "🌨️"], 80: ["Showers", "🌦️"], 81: ["Showers", "🌦️"], 82: ["Showers", "🌦️"],
  85: ["Snow showers", "🌨️"], 86: ["Snow showers", "🌨️"], 95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm", "⛈️"], 99: ["Thunderstorm", "⛈️"]
};
async function fetchWeatherAPI(lat, lon, units='c') {
  let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
  if (units === 'f') url += '&temperature_unit=fahrenheit';
  const r = await fetch(url); return r.json();
}
async function fetchCoordsByCity(city) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
  const d = await r.json();
  if (d.results && d.results.length) {
    return {lat: d.results[0].latitude, lon: d.results[0].longitude, city: d.results[0].name};
  }
  throw new Error('City not found');
}
function weatherUnitSymbol(unit) { return (unit === 'f' ? '°F' : '°C'); }
function weatherCityOrLocal() {
  return storage.get('weather:city', '') || 'Local';
}
function renderWeatherWidget(state = {}) {
  const el = document.getElementById('weather-content');
  const city = storage.get('weather:city', '');
  const unit = storage.get('weather:unit', 'c');
  // Form for city/unit
  el.innerHTML = `
    <div class="weather-form-row">
      <input class="weather-city-input" id="weather-city-input" placeholder="City or leave blank for auto" value="${city || ''}" aria-label="Weather city">
      <button class="weather-unit-btn" id="weather-unit-btn" title="Toggle °C/°F" aria-label="Toggle °C/°F">${weatherUnitSymbol(unit)}</button>
      <button class="weather-unit-btn" id="weather-refresh-btn" title="Refresh weather" aria-label="Refresh weather">⟳</button>
    </div>
    <div id="weather-result">${state.html || '<span class="loader"></span>'}</div>
    ${state.error ? `<div style="color:var(--color-danger);">${state.error} <button id="weather-retry-btn">Retry</button></div>` : ''}
  `;
  // Event handlers
  document.getElementById('weather-unit-btn').onclick = () => {
    const newUnit = (unit === 'c' ? 'f' : 'c');
    storage.set('weather:unit', newUnit);
    loadWeather();
  };
  document.getElementById('weather-city-input').onchange = e => {
    storage.set('weather:city', e.target.value.trim());
    loadWeather();
  };
  document.getElementById('weather-refresh-btn').onclick = loadWeather;
  if (document.getElementById('weather-retry-btn')) {
    document.getElementById('weather-retry-btn').onclick = loadWeather;
  }
}
async function loadWeather() {
  renderWeatherWidget();
  const el = document.getElementById('weather-result');
  const city = storage.get('weather:city', '');
  const unit = storage.get('weather:unit', 'c');
  let coords = null;
  let weatherCacheKey = `weathercache:${city || 'auto'}:${unit}`;
  // Try cache first
  const cache = storage.get(weatherCacheKey, null);
  if (cache && Date.now() - cache.time < 15*60*1000) { // 15 min cache
    el.innerHTML = cache.html;
    return;
  }
  try {
    if (city) {
      coords = await fetchCoordsByCity(city);
    } else {
      coords = storage.get('weather:coords', null);
      if (!coords) {
        coords = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            pos => resolve({lat: pos.coords.latitude, lon: pos.coords.longitude}),
            () => resolve(null), {timeout: 6000}
          );
        });
        storage.set('weather:coords', coords);
      }
      if (!coords) throw new Error('Location unavailable');
    }
    const data = await fetchWeatherAPI(coords.lat, coords.lon, unit);
    if (!data.current_weather) throw new Error('Weather unavailable');
    const w = data.current_weather;
    const [desc, icon] = weatherDescMap[w.weathercode] || ["?", "❓"];
    const html = `
      <span class="weather-temp">${Math.round(w.temperature)}${weatherUnitSymbol(unit)}</span>
      <span class="weather-desc">${icon} ${desc}</span>
      <span class="weather-location">${coords.city || data.timezone || 'Local'}</span>
    `;
    el.innerHTML = html;
    storage.set(weatherCacheKey, {html, time: Date.now()});
  } catch (e) {
    el.innerHTML = `<span style="color:var(--color-danger);">Weather unavailable. <button id="weather-retry-btn">Retry</button></span>`;
    if (document.getElementById('weather-retry-btn')) document.getElementById('weather-retry-btn').onclick = loadWeather;
  }
}

// CALENDAR WIDGET
function loadCalendar() {
  const el = document.getElementById('calendar-content');
  const today = new Date();
  const year = today.getFullYear(), month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month+1, 0);
  let html = `<table class="calendar-table"><thead><tr>`;
  const days = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  days.forEach(d => html += `<th>${d}</th>`);
  html += `</tr></thead><tbody><tr>`;
  for (let i = 0; i < firstDay.getDay(); i++) html += `<td class="calendar-other-month"></td>`;
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const isToday = (d === today.getDate());
    html += `<td class="${isToday ? 'calendar-today' : ''}">${d}</td>`;
    if ((firstDay.getDay() + d) % 7 === 0) html += `</tr><tr>`;
  }
  html += `</tr></tbody></table>`;
  el.innerHTML = html;
}

// TO-DO WIDGET: undo, drag/drop, animation
let lastDeletedTodo = null;
function renderTodos() {
  const list = document.getElementById('todo-list');
  let todos = storage.get('todos', []);
  list.innerHTML = '';
  if (!todos.length) {
    list.innerHTML = `<li style="color:var(--color-muted);">No tasks.</li>`;
    return;
  }
  todos.forEach((todo, idx) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' completed' : '');
    li.setAttribute('draggable', 'true');
    li.setAttribute('data-idx', idx);
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${todo.done ? 'checked' : ''} data-idx="${idx}">
      <span>${todo.text}</span>
      <button class="todo-remove" data-idx="${idx}" aria-label="Remove">&times;</button>
    `;
    list.appendChild(li);
  });
}
function initTodos() {
  renderTodos();
  document.getElementById('todo-form').addEventListener('submit', function(e){
    e.preventDefault();
    const input = document.getElementById('todo-input');
    let todos = storage.get('todos', []);
    const text = input.value.trim();
    if (text) {
      todos.push({text, done:false});
      storage.set('todos', todos);
      input.value = '';
      renderTodos();
      toast('Task added!');
    }
  });
  document.getElementById('todo-list').addEventListener('change', function(e){
    if (e.target.classList.contains('todo-checkbox')) {
      let idx = +e.target.dataset.idx;
      let todos = storage.get('todos', []);
      todos[idx].done = e.target.checked;
      storage.set('todos', todos);
      renderTodos();
    }
  });
  document.getElementById('todo-list').addEventListener('click', function(e){
    if (e.target.classList.contains('todo-remove')) {
      let idx = +e.target.dataset.idx;
      let todos = storage.get('todos', []);
      lastDeletedTodo = {todo: todos[idx], idx};
      todos.splice(idx,1);
      storage.set('todos', todos);
      renderTodos();
      // Undo button
      toast('Task deleted. <button class="todo-undo" onclick="undoTodoDelete()">Undo</button>', 'ok', 3000);
    }
  });
  // Drag and drop
  let dragIdx = null;
  document.getElementById('todo-list').addEventListener('dragstart', function(e){
    dragIdx = +e.target.getAttribute('data-idx');
    e.dataTransfer.effectAllowed = 'move';
  });
  document.getElementById('todo-list').addEventListener('dragover', function(e){
    e.preventDefault();
    if (e.target.classList.contains('todo-item')) e.target.style.background = 'var(--color-border)';
  });
  document.getElementById('todo-list').addEventListener('dragleave', function(e){
    if (e.target.classList.contains('todo-item')) e.target.style.background = '';
  });
  document.getElementById('todo-list').addEventListener('drop', function(e){
    e.preventDefault();
    if (e.target.classList.contains('todo-item')) {
      const dropIdx = +e.target.getAttribute('data-idx');
      let todos = storage.get('todos', []);
      const [moved] = todos.splice(dragIdx,1);
      todos.splice(dropIdx,0,moved);
      storage.set('todos', todos);
      renderTodos();
      e.target.style.background = '';
    }
  });
}
window.undoTodoDelete = function() {
  if (lastDeletedTodo) {
    let todos = storage.get('todos', []);
    todos.splice(lastDeletedTodo.idx, 0, lastDeletedTodo.todo);
    storage.set('todos', todos);
    lastDeletedTodo = null;
    renderTodos();
    toast('Task restored!');
  }
};

// NEWS WIDGET: source selection, caching, error/retry
const defaultFeeds = [
  {name: 'Google News', url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'},
  {name: 'Hacker News', url: 'https://news.ycombinator.com/rss'},
  {name: 'BBC World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml'}
];
function getNewsFeeds() {
  return storage.get('newsFeeds', defaultFeeds);
}
function setNewsFeeds(feeds) {
  storage.set('newsFeeds', feeds);
}
function renderNewsWidget(state = {}) {
  const el = document.getElementById('news-content');
  const feeds = getNewsFeeds();
  const selectedFeed = storage.get('newsFeedSelected', feeds[0].url);
  let feedOptions = feeds.map(f => `<option value="${f.url}">${f.name}</option>`).join('');
  el.innerHTML = `
    <div class="news-source-row">
      <select class="news-feed-select" id="news-feed-select">${feedOptions}</select>
      <input class="news-feed-url-input" id="news-feed-url-input" placeholder="Add RSS URL">
      <button class="news-add-source-btn" id="news-add-source-btn" title="Add feed" aria-label="Add news source">+</button>
    </div>
    <div id="news-items">${state.html || '<span class="loader"></span>'}</div>
    ${state.error ? `<div style="color:var(--color-danger);">${state.error} <button id="news-retry-btn">Retry</button></div>` : ''}
  `;
  document.getElementById('news-feed-select').value = selectedFeed;
  // Handlers
  document.getElementById('news-feed-select').onchange = e => {
    storage.set('newsFeedSelected', e.target.value);
    loadNews();
  };
  document.getElementById('news-add-source-btn').onclick = () => {
    const url = document.getElementById('news-feed-url-input').value.trim();
    if (url) {
      const feeds = getNewsFeeds();
      feeds.push({name: url.replace(/^https?:\/\/(www\.)?/i,''), url});
      setNewsFeeds(feeds);
      storage.set('newsFeedSelected', url);
      loadNews();
      toast('Feed added!');
    }
  };
  if (document.getElementById('news-retry-btn')) {
    document.getElementById('news-retry-btn').onclick = loadNews;
  }
}
async function loadNews() {
  renderNewsWidget();
  const el = document.getElementById('news-items');
  const feedUrl = storage.get('newsFeedSelected', getNewsFeeds()[0].url);
  const cacheKey = `newscache:${feedUrl}`;
  // Try cache
  const cache = storage.get(cacheKey, null);
  if (cache && Date.now() - cache.time < 15*60*1000) {
    el.innerHTML = cache.html;
    return;
  }
  try {
    // RSS2JSON public API
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
    const r = await fetch(apiUrl);
    const data = await r.json();
    if (!data.items || !data.items.length) throw new Error();
    let html = '';
    data.items.slice(0,6).forEach(item=>{
      html += `<div class="news-item">
        <a href="${item.link}" class="news-title" target="_blank" rel="noopener">${item.title}</a>
        <span class="news-source">${item.author || item.source?.title || ''}</span>
      </div>`;
    });
    el.innerHTML = html;
    storage.set(cacheKey, {html, time: Date.now()});
  } catch {
    el.innerHTML = `<span style="color:var(--color-danger);">News unavailable. <button id="news-retry-btn">Retry</button></span>`;
    if (document.getElementById('news-retry-btn')) document.getElementById('news-retry-btn').onclick = loadNews;
  }
}

// CLOCK WIDGET: 12/24h toggle
function updateClock() {
  const now = new Date();
  const is24h = storage.get('clock24h', true);
  let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
  let dispH = h, ampm = '';
  if (!is24h) {
    ampm = h >= 12 ? ' PM' : ' AM';
    dispH = h % 12 || 12;
  }
  document.getElementById('clock').textContent =
    `${dispH.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}${ampm}`;
  document.getElementById('date').textContent =
    now.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});
}
setInterval(()=>{if(document.getElementById('clock'))updateClock();}, 1000);
document.addEventListener('DOMContentLoaded',()=>{
  updateClock();
  document.getElementById('clock-toggle').onclick = ()=>{
    const cur = storage.get('clock24h', true);
    storage.set('clock24h', !cur);
    updateClock();
  };
});

// QUOTE WIDGET: next quote, cache, fallback
async function fetchRandomQuote() {
  try {
    const r = await fetch('https://zenquotes.io/api/random');
    const data = await r.json();
    if (data && data[0]) return data[0];
    throw new Error();
  } catch {
    // fallback
    return {
      q: "Be yourself; everyone else is already taken.",
      a: "Oscar Wilde"
    }
  }
}
function renderQuoteWidget(state={}) {
  const el = document.getElementById('quote-content');
  el.innerHTML = `<span class="loader"></span>`;
  fetchRandomQuote().then(q=>{
    el.innerHTML = `<span>"${q.q}"</span><span class="quote-author">- ${q.a}</span>
      <button id="next-quote" class="inline-btn" aria-label="Next quote">⟳</button>`;
    document.getElementById('next-quote').onclick = ()=>renderQuoteWidget();
  });
}

// BOOKMARKS: favicons, drag-and-drop, import/export
function renderBookmarks() {
  const list = document.getElementById('bookmarks-list');
  let bookmarks = storage.get('bookmarks', []);
  list.innerHTML = '';
  if (!bookmarks.length) {
    list.innerHTML = `<li style="color:var(--color-muted);">No bookmarks.</li>`;
    return;
  }
  bookmarks.forEach((bm, idx) => {
    const li = document.createElement('li');
    li.className = 'bookmark-item';
    li.setAttribute('draggable', 'true');
    li.setAttribute('data-idx', idx);
    li.innerHTML = `
      <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(bm.url)}" class="bookmark-favicon" alt="">
      <a href="${bm.url}" class="bookmark-link" target="_blank" rel="noopener">${bm.title}</a>
      <button class="bookmark-remove" data-idx="${idx}" aria-label="Remove">&times;</button>
    `;
    list.appendChild(li);
  });
}
function initBookmarks() {
  renderBookmarks();
  document.getElementById('bookmark-form').addEventListener('submit', function(e){
    e.preventDefault();
    let url = document.getElementById('bookmark-url').value.trim();
    let title = document.getElementById('bookmark-title').value.trim();
    if (url && title) {
      let bookmarks = storage.get('bookmarks', []);
      bookmarks.push({url, title});
      storage.set('bookmarks', bookmarks);
      document.getElementById('bookmark-url').value = '';
      document.getElementById('bookmark-title').value = '';
      renderBookmarks();
      toast('Bookmark added!');
    }
  });
  document.getElementById('bookmarks-list').addEventListener('click', function(e){
    if (e.target.classList.contains('bookmark-remove')) {
      let idx = +e.target.dataset.idx;
      let bookmarks = storage.get('bookmarks', []);
      bookmarks.splice(idx,1);
      storage.set('bookmarks', bookmarks);
      renderBookmarks();
      toast('Bookmark deleted!');
    }
  });
  // Drag and drop
  let dragIdx = null;
  document.getElementById('bookmarks-list').addEventListener('dragstart', function(e){
    dragIdx = +e.target.getAttribute('data-idx');
    e.dataTransfer.effectAllowed = 'move';
  });
  document.getElementById('bookmarks-list').addEventListener('dragover', function(e){
    e.preventDefault();
    if (e.target.classList.contains('bookmark-item')) e.target.style.background = 'var(--color-border)';
  });
  document.getElementById('bookmarks-list').addEventListener('dragleave', function(e){
    if (e.target.classList.contains('bookmark-item')) e.target.style.background = '';
  });
  document.getElementById('bookmarks-list').addEventListener('drop', function(e){
    e.preventDefault();
    if (e.target.classList.contains('bookmark-item')) {
      const dropIdx = +e.target.getAttribute('data-idx');
      let bookmarks = storage.get('bookmarks', []);
      const [moved] = bookmarks.splice(dragIdx,1);
      bookmarks.splice(dropIdx,0,moved);
      storage.set('bookmarks', bookmarks);
      renderBookmarks();
      e.target.style.background = '';
    }
  });
}

// --- INITIALIZATION (with lazy load for widgets) ---
document.addEventListener('DOMContentLoaded', () => {
  // Background, theme, widget toggles
  initBg();
  initTheme();
  initWidgetToggles();
  // Lazy load widgets only if visible
  if (!document.getElementById('weather-widget').hidden) loadWeather();
  if (!document.getElementById('calendar-widget').hidden) loadCalendar();
  if (!document.getElementById('todo-widget').hidden) initTodos();
  if (!document.getElementById('news-widget').hidden) loadNews();
  if (!document.getElementById('quote-widget').hidden) renderQuoteWidget();
  if (!document.getElementById('bookmarks-widget').hidden) initBookmarks();
});

