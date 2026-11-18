
/* ==========================================
   WEATHER DASHBOARD - PRODUCTION QUALITY
   ========================================== */

/* ==========================================
   CONFIGURATION & API
   ========================================== */

const CONFIG = { API_KEY: "31a4b27c4ca595b8db45317dbfa78f5b",
    UNITS: "metric",
    LANG: "en",
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
    MAX_RECENT_SEARCHES: 5,
    MAX_FAVORITES: 5,
    AUTO_REFRESH: 10 * 60 * 1000, // 10 minutes
};

/* ==========================================
   DOM ELEMENTS CACHE
   ========================================== */

const DOM = {
    app: document.getElementById("app"),
    loadingSpinner: document.getElementById("loadingSpinner"),
    errorContainer: document.getElementById("errorContainer"),
    errorMessage: document.getElementById("errorMessage"),
    retryBtn: document.getElementById("retryBtn"),
    
    // Search & Navigation
    cityInput: document.getElementById("cityInput"),
    locationBtn: document.getElementById("locationBtn"),
    suggestions: document.getElementById("suggestions"),
    recentSearches: document.getElementById("recentSearches"),
    favoritesList: document.getElementById("favoritesList"),
    
    // Header
    greeting: document.getElementById("greeting"),
    currentDateTime: document.getElementById("currentDateTime"),
    
    // Current Weather
    weatherIconMain: document.getElementById("weatherIconMain"),
    cityName: document.getElementById("cityName"),
    weatherDescription: document.getElementById("weatherDescription"),
    temperature: document.getElementById("temperature"),
    maxTemp: document.getElementById("maxTemp"),
    minTemp: document.getElementById("minTemp"),
    feelsLike: document.getElementById("feelsLike"),
    favoriteBtn: document.getElementById("favoriteBtn"),
    heroSection: document.getElementById("heroSection"),
    
    // Highlights
    humidity: document.getElementById("humidity"),
    humidityBar: document.getElementById("humidityBar"),
    wind: document.getElementById("wind"),
    windDirection: document.getElementById("windDirection"),
    pressure: document.getElementById("pressure"),
    pressureDetail: document.getElementById("pressureDetail"),
    visibility: document.getElementById("visibility"),
    uv: document.getElementById("uv"),
    uvLevel: document.getElementById("uvLevel"),
    cloudCoverage: document.getElementById("cloudCoverage"),
    sunrise: document.getElementById("sunrise"),
    sunset: document.getElementById("sunset"),
    
    // Forecast
    forecastContainer: document.getElementById("forecastContainer"),
    
    // Air Quality
    aqiValue: document.getElementById("aqiValue"),
    aqiCategory: document.getElementById("aqiCategory"),
    aqiDescription: document.getElementById("aqiDescription"),
    aqiFill: document.getElementById("aqiFill"),
};

/* ==========================================
   STATE MANAGEMENT
   ========================================== */

const STATE = {
    currentCity: "Chandigarh",
    currentWeather: null,
    currentForecast: null,
    favorites: JSON.parse(localStorage.getItem("favorites")) || [],
    recentSearches: JSON.parse(localStorage.getItem("recentSearches")) || [],
    lastFetchTime: 0,
    autoRefreshTimer: null,
};

/* ==========================================
   UTILITY FUNCTIONS - Time & Formatting
   ========================================== */

// Format timestamp to time string (HH:MM)
function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit", 
        hour12: true 
    });
}

// Format timestamp to date string
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("en-US", { 
        weekday: "long", 
        month: "short", 
        day: "numeric" 
    });
}

// Get wind direction from degrees (16-point compass)
function getWindDirection(degrees) {
    if (!degrees && degrees !== 0) return "Unknown";
    const directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

// Get UV index level description
function getUVLevel(uv) {
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very High";
    return "Extreme";
}

// Get AQI category information
function getAQIInfo(aqi) {
    const categories = [
        { range: [0, 50], label: "Good", desc: "Air quality is satisfactory", color: "#51cf66" },
        { range: [51, 100], label: "Fair", desc: "Moderate air pollution", color: "#ffd93d" },
        { range: [101, 150], label: "Moderate", desc: "Members of sensitive groups may experience health effects", color: "#ff9800" },
        { range: [151, 200], label: "Poor", desc: "Some members of the general public may experience health effects", color: "#ff6b6b" },
        { range: [201, 300], label: "Very Poor", desc: "Members of the general public begin to experience health effects", color: "#c92a2a" },
        { range: [301, 500], label: "Severe", desc: "Health alert: The risk of health effects is increased for the general public", color: "#5a1a1a" }
    ];
    
    return categories.find(cat => aqi >= cat.range[0] && aqi <= cat.range[1]) || categories[categories.length - 1];
}

// Update current time and date
function updateDateTime() {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: true
    });
    const date = now.toLocaleDateString("en-US", { 
        weekday: "long", 
        month: "long", 
        day: "numeric" 
    });
    
    DOM.currentDateTime.textContent = `${date} at ${time}`;
    updateGreeting(now.getHours());
}

// Update greeting based on time of day
function updateGreeting(hour) {
    let greeting = "Good Morning";
    if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
    else if (hour >= 17 && hour < 21) greeting = "Good Evening";
    else if (hour >= 21 || hour < 5) greeting = "Good Night";
    
    DOM.greeting.textContent = greeting;
}

/* ==========================================
   UI STATE MANAGEMENT
   ========================================== */

function showLoading() {
    DOM.loadingSpinner.classList.remove("hidden");
    DOM.errorContainer.classList.remove("show");
}

function hideLoading() {
    DOM.loadingSpinner.classList.add("hidden");
}

function showError(message) {
    DOM.errorMessage.textContent = message || "Unable to fetch weather data. Please try again.";
    DOM.errorContainer.classList.add("show");
    hideLoading();
}

function hideError() {
    DOM.errorContainer.classList.remove("show");
}

/* ==========================================
   STORAGE FUNCTIONS
   ========================================== */

// Save recent search to localStorage
function saveRecentSearch(city) {
    if (!city || STATE.recentSearches.includes(city)) return;
    
    STATE.recentSearches.unshift(city);
    STATE.recentSearches = STATE.recentSearches.slice(0, CONFIG.MAX_RECENT_SEARCHES);
    localStorage.setItem("recentSearches", JSON.stringify(STATE.recentSearches));
    renderRecentSearches();
}

// Save favorite city
function saveFavorite(city) {
    if (!city || STATE.favorites.includes(city)) return;
    
    if (STATE.favorites.length >= CONFIG.MAX_FAVORITES) {
        STATE.favorites.pop();
    }
    STATE.favorites.unshift(city);
    localStorage.setItem("favorites", JSON.stringify(STATE.favorites));
    renderFavorites();
    updateFavoriteButton();
}

// Remove favorite city
function removeFavorite(city) {
    STATE.favorites = STATE.favorites.filter(fav => fav !== city);
    localStorage.setItem("favorites", JSON.stringify(STATE.favorites));
    renderFavorites();
    updateFavoriteButton();
}

/* ==========================================
   RENDERING FUNCTIONS
   ========================================== */

// Render recent searches
function renderRecentSearches() {
    DOM.recentSearches.innerHTML = STATE.recentSearches
        .map(city => `<button class="search-tag" onclick="searchCity('${city}')" title="Search ${city}">${city}</button>`)
        .join("");
}

// Render favorite cities
function renderFavorites() {
    DOM.favoritesList.innerHTML = STATE.favorites
        .map(city => `<button class="favorite-tag" onclick="searchCity('${city}')" title="Search ${city}">${city}</button>`)
        .join("");
}

// Update favorite button state
function updateFavoriteButton() {
    if (STATE.favorites.includes(STATE.currentCity)) {
        DOM.favoriteBtn.classList.add("active");
    } else {
        DOM.favoriteBtn.classList.remove("active");
    }
}

/* ==========================================
   API FUNCTIONS
   ========================================== */

// Fetch current weather data
async function fetchWeatherData(city) {
    try {
        showLoading();
        hideError();
        
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`"${city}" not found. Please check the spelling and try again.`);
            } else if (response.status === 429) {
                throw new Error("API rate limit exceeded. Please try again later.");
            }
            throw new Error("Failed to fetch weather data. Please try again.");
        }
        
        const data = await response.json();
        STATE.currentWeather = data;
        STATE.currentCity = data.name;
        STATE.lastFetchTime = Date.now();
        
        saveRecentSearch(city);
        hideLoading();
        
        return data;
    } catch (error) {
        showError(error.message);
        throw error;
    }
}

// Fetch 7-day forecast data
async function fetchForecastData(lat, lon) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Failed to fetch forecast");
        
        const data = await response.json();
        STATE.currentForecast = data;
        return data;
    } catch (error) {
        console.error("Forecast fetch error:", error);
        return null;
    }
}

// Fetch air quality data
async function fetchAirQuality(lat, lon) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) throw new Error("Failed to fetch air quality");
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Air quality fetch error:", error);
        return null;
    }
}

// Fetch UV Index data
async function fetchUVIndex(lat, lon) {
    try {
        const url = `https://api.openweathermap.org/data/2.5/uvi?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        DOM.uv.textContent = Math.round(data.value);
        DOM.uvLevel.textContent = getUVLevel(data.value);
    } catch (error) {
        console.error("UV Index fetch error:", error);
        DOM.uv.textContent = "N/A";
    }
}

/* ==========================================
   UPDATE UI FUNCTIONS
   ========================================== */

// Update current weather display
function updateCurrentWeather(weather) {
    // Main weather card
    DOM.weatherIconMain.src = "assets/images/weather.avif";
    DOM.weatherIconMain.alt = weather.weather[0].description;
    
    DOM.cityName.textContent = weather.name;
    DOM.weatherDescription.textContent = weather.weather[0].description;
    DOM.temperature.textContent = `${Math.round(weather.main.temp)}°`;
    DOM.maxTemp.textContent = `${Math.round(weather.main.temp_max)}°`;
    DOM.minTemp.textContent = `${Math.round(weather.main.temp_min)}°`;
    DOM.feelsLike.textContent = `Feels Like ${Math.round(weather.main.feels_like)}°`;
    
    updateHighlights(weather);
    updateFavoriteButton();
    updateBackgroundGradient(weather.weather[0].main);
}

// Update highlights/stats cards
function updateHighlights(weather) {
    // Humidity
    DOM.humidity.textContent = `${weather.main.humidity}%`;
    const humidityFill = DOM.humidityBar.querySelector(".progress-fill");
    humidityFill.style.width = `${weather.main.humidity}%`;
    
    // Wind
    DOM.wind.textContent = `${Math.round(weather.wind.speed)} km/h`;
    DOM.windDirection.textContent = getWindDirection(weather.wind.deg);
    
    // Pressure
    DOM.pressure.textContent = `${weather.main.pressure} hPa`;
    const pressureNormal = weather.main.pressure >= 1010 && weather.main.pressure <= 1015;
    DOM.pressureDetail.textContent = pressureNormal ? "Normal" : weather.main.pressure > 1015 ? "High" : "Low";
    
    // Visibility
    DOM.visibility.textContent = `${(weather.visibility / 1000).toFixed(1)} km`;
    
    // Cloud coverage
    DOM.cloudCoverage.textContent = `${weather.clouds.all}%`;
    
    // Sunrise & Sunset
    DOM.sunrise.textContent = formatTime(weather.sys.sunrise);
    DOM.sunset.textContent = formatTime(weather.sys.sunset);
    
    // Fetch UV Index
    fetchUVIndex(weather.coord.lat, weather.coord.lon);
}

// Update 7-day forecast
async function updateForecast(lat, lon) {
    const forecast = await fetchForecastData(lat, lon);
    if (!forecast) return;
    
    // Group forecast by day (take one entry per day at 12:00)
    const dailyForecasts = [];
    const seenDays = new Set();
    
    forecast.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.toLocaleDateString();
        
        if (!seenDays.has(day)) {
            seenDays.add(day);
            dailyForecasts.push(item);
        }
    });
    
    // Render next 7 days
    DOM.forecastContainer.innerHTML = dailyForecasts.slice(0, 7)
        .map(item => {
            const date = new Date(item.dt * 1000);
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
            
            return `
                <div class="forecast-card" title="${item.weather[0].description}">
                    <div class="forecast-day">${dayName}</div>
                    <div class="forecast-icon">
                        <img src="assets/images/weather.avif" alt="${item.weather[0].description}" style="width: 50px; height: 50px; object-fit: contain;">
                    </div>
                    <div class="forecast-temp">${Math.round(item.main.temp_max)}°</div>
                    <div class="forecast-condition">${item.weather[0].main}</div>
                </div>
            `;
        })
        .join("");
}

// Update air quality display
async function updateAirQuality(lat, lon) {
    const aq = await fetchAirQuality(lat, lon);
    if (!aq) return;
    
    const aqi = aq.list[0].main.aqi;
    const aqiScore = aqi * 50; // Convert OpenWeather AQI (1-5) to 0-250 scale
    const aqiInfo = getAQIInfo(aqiScore);
    
    DOM.aqiValue.textContent = Math.round(aqiScore);
    DOM.aqiCategory.textContent = aqiInfo.label;
    DOM.aqiDescription.textContent = aqiInfo.desc;
    DOM.aqiFill.style.width = `${(aqiScore / 500) * 100}%`;
    DOM.aqiFill.style.background = aqiInfo.color;
}

// Update background gradient based on weather
function updateBackgroundGradient(weatherCondition) {
    const gradients = {
        "Clear": "linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(135, 206, 235, 0.1))",
        "Clouds": "linear-gradient(135deg, rgba(169, 169, 169, 0.15), rgba(192, 192, 192, 0.1))",
        "Rain": "linear-gradient(135deg, rgba(100, 149, 237, 0.2), rgba(70, 130, 180, 0.1))",
        "Drizzle": "linear-gradient(135deg, rgba(135, 206, 250, 0.15), rgba(100, 149, 237, 0.1))",
        "Thunderstorm": "linear-gradient(135deg, rgba(75, 0, 130, 0.2), rgba(138, 43, 226, 0.1))",
        "Snow": "linear-gradient(135deg, rgba(240, 248, 255, 0.15), rgba(230, 230, 250, 0.1))",
        "Mist": "linear-gradient(135deg, rgba(211, 211, 211, 0.15), rgba(169, 169, 169, 0.1))",
        "Fog": "linear-gradient(135deg, rgba(200, 200, 200, 0.15), rgba(180, 180, 180, 0.1))",
    };
    
    const gradient = gradients[weatherCondition] || "linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(255, 107, 107, 0.1))";
    if (DOM.heroSection.querySelector(".weather-backdrop")) {
        DOM.heroSection.querySelector(".weather-backdrop").style.background = gradient;
    }
}

/* ==========================================
   MAIN FUNCTIONS
   ========================================== */

// Search for city weather
async function searchCity(city = DOM.cityInput.value.trim()) {
    if (!city) {
        showError("Please enter a city name");
        return;
    }
    
    try {
        const weather = await fetchWeatherData(city);
        updateCurrentWeather(weather);
        
        // Fetch additional data
        await updateForecast(weather.coord.lat, weather.coord.lon);
        await updateAirQuality(weather.coord.lat, weather.coord.lon);
        
        DOM.cityInput.value = "";
    } catch (error) {
        console.error("Search error:", error);
    }
}

// Get current location and weather
function getCurrentLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation is not supported by your browser");
        return;
    }
    
    showLoading();
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${CONFIG.API_KEY}&units=${CONFIG.UNITS}`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error("Failed to fetch weather");
                
                const weather = await response.json();
                STATE.currentWeather = weather;
                STATE.currentCity = weather.name;
                
                updateCurrentWeather(weather);
                await updateForecast(latitude, longitude);
                await updateAirQuality(latitude, longitude);
                
                hideLoading();
                hideError();
            } catch (error) {
                showError(error.message);
            }
        },
        (error) => {
            showError("Unable to access your location. Please check permissions.");
            hideLoading();
        }
    );
}

// Toggle favorite city
function toggleFavorite() {
    if (STATE.favorites.includes(STATE.currentCity)) {
        removeFavorite(STATE.currentCity);
    } else {
        saveFavorite(STATE.currentCity);
    }
}

// Auto-refresh weather data
function startAutoRefresh() {
    if (STATE.autoRefreshTimer) clearInterval(STATE.autoRefreshTimer);
    
    STATE.autoRefreshTimer = setInterval(() => {
        if (STATE.currentCity) {
            searchCity(STATE.currentCity);
        }
    }, CONFIG.AUTO_REFRESH);
}

/* ==========================================
   EVENT LISTENERS
   ========================================== */

// Search event listeners
DOM.cityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchCity();
});

// Location button
DOM.locationBtn.addEventListener("click", getCurrentLocation);

// Favorite button
DOM.favoriteBtn.addEventListener("click", toggleFavorite);

// Retry button
DOM.retryBtn.addEventListener("click", () => {
    searchCity(STATE.currentCity || "Chandigarh");
});

// Update time every minute
setInterval(updateDateTime, 60000);

/* ==========================================
   INITIALIZATION
   ========================================== */

function init() {
    // Update date/time
    updateDateTime();
    
    // Render saved data
    renderRecentSearches();
    renderFavorites();
    
    // Start auto-refresh
    startAutoRefresh();
    
    // Load default city
    searchCity(STATE.currentCity);
}

// Start app when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
