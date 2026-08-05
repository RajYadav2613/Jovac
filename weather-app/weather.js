
const NEWS_API_KEY = "";
const GROQ_API_KEY = "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const DEFAULT_CITY = "Delhi";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const WMO_ICONS = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "❄️", 73: "❄️", 75: "❄️",
  80: "🌦️", 81: "🌧️", 82: "⛈️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const WMO_DESC = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Moderate showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm + hail", 99: "Thunderstorm + hail",
};

let currentWeatherContext = "";
let currentNewsContext = "";

const cityInput = document.getElementById("city-input");
const searchBtn = document.querySelector(".search-bar button");
const weatherCard = document.getElementById("weather-card");
const forecastCard = document.getElementById("forecast-card");
const forecastRow = document.getElementById("forecast-row");
const weatherError = document.getElementById("weather-error");
const newsGrid = document.getElementById("news-grid");
const newsError = document.getElementById("news-error");
const lastUpdated = document.getElementById("last-updated");
const recentSearches = document.getElementById("recent-searches");

const aiInput = document.getElementById("ai-input");
const aiSendBtn = document.getElementById("ai-send-btn");
const chatMessages = document.getElementById("chat-messages");

function getTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function setLastUpdated(text) {
  if (lastUpdated) lastUpdated.textContent = text;
}

function showWeatherError(message) {
  if (!weatherError) return;
  weatherError.style.display = "block";
  weatherError.textContent = `⚠ ${message}`;
}

function hideWeatherError() {
  if (!weatherError) return;
  weatherError.style.display = "none";
}

function showNewsError(message) {
  if (!newsError) return;
  newsError.style.display = "block";
  newsError.textContent = `⚠ ${message}`;
}

function hideNewsError() {
  if (!newsError) return;
  newsError.style.display = "none";
}

function getRecentSearches() {
  return JSON.parse(localStorage.getItem("recentSearches") || "[]");
}

function saveSearch(city) {
  const next = [city, ...getRecentSearches().filter((item) => item.toLowerCase() !== city.toLowerCase())].slice(0, 5);
  localStorage.setItem("recentSearches", JSON.stringify(next));
  renderSearchChips();
}

function renderSearchChips() {
  if (!recentSearches) return;
  const list = getRecentSearches();
  if (list.length === 0) {
    recentSearches.innerHTML = "";
    return;
  }

  recentSearches.innerHTML = "<span>Recent:</span>" + list.map((city) => {
    const safe = city.replace(/'/g, "\\u0027");
    return `<div class=\"chip\" onclick=\"searchCity('${safe}')\">${city}</div>`;
  }).join("");
}

async function geocodeCity(city) {
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(geoUrl);
  if (!response.ok) {
    throw new Error("Unable to reach location service.");
  }

  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("City not found.");
  }

  return data.results[0];
}

async function fetchWeatherByCoords(latitude, longitude) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`;
  const response = await fetch(weatherUrl);
  if (!response.ok) {
    throw new Error("Unable to fetch weather data.");
  }

  return response.json();
}

function renderWeather(location, weatherData) {
  const current = weatherData.current || {};
  const daily = weatherData.daily || {};
  const weatherCode = current.weather_code ?? 0;
  const temp = Math.round(current.temperature_2m ?? 0);
  const humidity = current.relative_humidity_2m ?? "N/A";
  const wind = current.wind_speed_10m ?? "N/A";

  weatherCard.innerHTML = `
    <div class="card-label">Current Weather</div>
    <div class="weather-main">
      <div class="weather-icon">${WMO_ICONS[weatherCode] || "🌡️"}</div>
      <div>
        <div class="weather-temp">${temp}°C</div>
      </div>
    </div>
    <div class="weather-city">${location.name}, ${location.country || location.admin1 || ""}</div>
    <div class="weather-desc">${WMO_DESC[weatherCode] || "Unknown"}</div>
    <div class="weather-stats" style="margin-top:16px">
      <div class="stat-box">
        <div class="stat-label">Humidity</div>
        <div class="stat-value">${humidity}%</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Wind</div>
        <div class="stat-value">${wind} km/h</div>
      </div>
    </div>
  `;

  currentWeatherContext = `City: ${location.name}, ${location.country || ""}. Temperature: ${temp}°C. Condition: ${WMO_DESC[weatherCode] || "Unknown"}. Humidity: ${humidity}%. Wind: ${wind} km/h.`;

  forecastCard.style.display = "block";
  forecastRow.innerHTML = (daily.time || []).map((dateStr, index) => {
    const date = new Date(dateStr);
    const code = daily.weather_code?.[index] ?? 0;
    const max = Math.round(daily.temperature_2m_max?.[index] ?? 0);
    const min = Math.round(daily.temperature_2m_min?.[index] ?? 0);
    return `
      <div class="forecast-item">
        <div class="f-day">${index === 0 ? "Today" : DAYS[date.getDay()]}</div>
        <div class="f-icon">${WMO_ICONS[code] || "🌡️"}</div>
        <div class="f-temp">${max}° / ${min}°</div>
      </div>
    `;
  }).join("");
}

async function fetchNewsForCity(city) {
  if (NEWS_API_KEY) {
    const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(city)}&lang=en&max=6&apikey=${NEWS_API_KEY}`;
    const response = await fetch(gnewsUrl);
    if (!response.ok) {
      throw new Error("News service unavailable.");
    }

    const data = await response.json();
    return (data.articles || []).map((item) => ({
      title: item.title,
      url: item.url,
      source: item.source?.name || "News",
      date: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "",
    }));
  }

  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(city)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error("News service unavailable.");
  }

  const data = await response.json();
  return (data.items || []).slice(0, 6).map((item) => ({
    title: item.title,
    url: item.link,
    source: item.author || "Google News",
    date: item.pubDate ? new Date(item.pubDate).toDateString() : "",
  }));
}

function renderNews(items) {
  if (!items.length) {
    newsGrid.innerHTML = '<div style="color:var(--muted); font-size:0.85rem; padding:12px">No news found for this search.</div>';
    currentNewsContext = "";
    return;
  }

  newsGrid.innerHTML = items.map((item) => `
    <a class="news-card" href="${item.url || "#"}" target="_blank" rel="noopener">
      <div class="news-source">${item.source || "News"}</div>
      <div class="news-title">${item.title || "Untitled"}</div>
      <div class="news-date">${item.date || ""}</div>
    </a>
  `).join("");

  currentNewsContext = "Recent headlines: " + items.slice(0, 4).map((item) => item.title).join(" | ");
}

async function fetchAll() {
  const city = cityInput.value.trim();
  if (!city) {
    alert("Enter a city name");
    return;
  }

  hideWeatherError();
  hideNewsError();
  setLastUpdated("Loading...");

  weatherCard.innerHTML = `
    <div class="card-label">Current Weather</div>
    <div class="skeleton sk-big"></div>
    <div class="skeleton sk-line" style="width:60%"></div>
    <div class="skeleton sk-line" style="width:40%"></div>
  `;
  forecastCard.style.display = "none";
  newsGrid.innerHTML = `
    <div class="loading-news">
      <div class="skeleton sk-line" style="width:80%; margin-bottom:14px"></div>
      <div class="skeleton sk-line" style="width:60%"></div>
    </div>
  `;

  try {
    const location = await geocodeCity(city);
    const weatherData = await fetchWeatherByCoords(location.latitude, location.longitude);
    renderWeather(location, weatherData);
    saveSearch(city);
  } catch (error) {
    showWeatherError(error.message || "Weather data unavailable.");
    weatherCard.innerHTML = '<div class="card-label">Current Weather</div><p style="color:var(--muted); font-size:0.85rem">—</p>';
  }

  try {
    const newsItems = await fetchNewsForCity(city);
    renderNews(newsItems);
  } catch (error) {
    showNewsError(error.message || "News data unavailable.");
    newsGrid.innerHTML = "";
  }

  setLastUpdated(`Updated ${getTime()}`);
}

function getChatHistory() {
  return JSON.parse(localStorage.getItem("chatHistory") || "[]");
}

function saveChatHistory(history) {
  localStorage.setItem("chatHistory", JSON.stringify(history.slice(-12)));
}

function appendMessage(role, text, time) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const content = document.createElement("div");
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = text;

  const stamp = document.createElement("div");
  stamp.className = "msg-time";
  stamp.textContent = time || getTime();

  content.appendChild(bubble);
  content.appendChild(stamp);
  msg.appendChild(avatar);
  msg.appendChild(content);
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  if (document.getElementById("typing-msg")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "msg ai";
  wrapper.id = "typing-msg";
  wrapper.innerHTML = `
    <div class="msg-avatar">AI</div>
    <div>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTyping() {
  const typing = document.getElementById("typing-msg");
  if (typing) typing.remove();
}

function buildGroqMessages(userText, history) {
  const contextBlock = [
    currentWeatherContext ? `Weather context: ${currentWeatherContext}` : "",
    currentNewsContext ? `News context: ${currentNewsContext}` : "",
  ].filter(Boolean).join("\n");

  const messages = [
    {
      role: "system",
      content: "You are Mausam AI assistant. Reply naturally, clearly, and helpfully.",
    },
  ];

  history.slice(-8).forEach((item) => {
    messages.push({
      role: item.role === "ai" ? "assistant" : "user",
      content: item.text,
    });
  });

  if (contextBlock) {
    messages.push({ role: "system", content: contextBlock });
  }

  messages.push({ role: "user", content: userText });
  return messages;
}

async function getGroqReply(userText, history) {
  if (!GROQ_API_KEY) {
    throw new Error("Groq API key missing.");
  }

  const models = [GROQ_MODEL, "llama-3.1-8b-instant"].filter((model, index, arr) => arr.indexOf(model) === index);
  let lastError = "Groq assistant request failed.";

  for (const model of models) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: buildGroqMessages(userText, history),
        temperature: 0.5,
        max_tokens: 280,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      lastError = data.error?.message || "Groq assistant request failed.";
      continue;
    }

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (reply) {
      return reply;
    }
  }

  throw new Error(lastError);
}

async function sendMessage() {
  const userText = aiInput.value.trim();
  if (!userText) {
    alert("Enter a message");
    return;
  }

  aiInput.value = "";
  appendMessage("user", userText);

  const history = getChatHistory();
  history.push({ role: "user", text: userText, time: getTime() });
  saveChatHistory(history);

  aiSendBtn.disabled = true;
  showTyping();

  try {
    const reply = await getGroqReply(userText, history);
    removeTyping();
    appendMessage("ai", reply);
    history.push({ role: "ai", text: reply, time: getTime() });
    saveChatHistory(history);
  } catch (error) {
    removeTyping();
    appendMessage("ai", "I am having trouble right now. Please try again.");
    console.error(error);
  } finally {
    aiSendBtn.disabled = false;
  }
}

function clearChat() {
  localStorage.removeItem("chatHistory");
  chatMessages.innerHTML = `
    <div class="msg ai">
      <div class="msg-avatar">✦</div>
      <div>
        <div class="msg-bubble">Hello! I'm your AI assistant. Ask me anything about weather, news, or any topic you're curious about.</div>
        <div class="msg-time">Just now</div>
      </div>
    </div>
  `;
}

function renderChatHistory() {
  const welcome = chatMessages.querySelector(".msg.ai");
  chatMessages.innerHTML = "";
  if (welcome) chatMessages.appendChild(welcome);

  getChatHistory().forEach((entry) => {
    appendMessage(entry.role, entry.text, entry.time);
  });
}

function useSuggestion(element) {
  aiInput.value = element.textContent || "";
  sendMessage();
}

function searchCity(name) {
  cityInput.value = name;
  fetchAll();
}

cityInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") fetchAll();
});

aiInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") sendMessage();
});

if (searchBtn) {
  searchBtn.addEventListener("click", fetchAll);
}

window.fetchAll = fetchAll;
window.sendMessage = sendMessage;
window.clearChat = clearChat;
window.useSuggestion = useSuggestion;
window.searchCity = searchCity;

cityInput.value = cityInput.value.trim() || DEFAULT_CITY;
renderSearchChips();
renderChatHistory();
fetchAll();

