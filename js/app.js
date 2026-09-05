/* ==========================================================================
   ALERTORA AI — Master Application Controller & UI Renderer
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  // Application State
  const state = {
    currentView: "landing", // landing, dashboard, map, predictions, alerts, precautions, eoc, mysafety, analytics, fusion, about
    selectedLocationId: "chennai",
    selectedHazard: "THUNDERSTORM",
    selectedTimelineHourIndex: 0,
    activeMapLayer: "radar",
    map: null,
    radarOverlay: null,
    riskPolygons: [],
    stormSimulationActive: false,
    stormSimulationInterval: null,
    countdownSeconds: 5076, // 01:24:36
    countdownInterval: null,
    notificationsEnabled: {
      severe: true,
      lightning: true,
      hail: true,
      cloudburst: true,
      sms: true,
      app: true
    },
    analyticsCharts: {}
  };

  // DOM Cache
  const views = {
    landing: document.getElementById("view-landing"),
    dashboard: document.getElementById("view-dashboard"),
    map: document.getElementById("view-map"),
    predictions: document.getElementById("view-predictions"),
    alerts: document.getElementById("view-alerts"),
    precautions: document.getElementById("view-precautions"),
    eoc: document.getElementById("view-eoc"),
    mysafety: document.getElementById("view-mysafety"),
    analytics: document.getElementById("view-analytics"),
    fusion: document.getElementById("view-fusion"),
    about: document.getElementById("view-about")
  };

  // Initialize Landing Canvas Radar Animation
  initRadarCanvas();

  // Navigation Setup
  setupNavigation();

  // Load Data & Initial Setup
  const locations = await window.alertoraAPI.getLocations();
  populateLocationSelector(locations);
  startCountdownTimer();

  // Button Listeners
  document.getElementById("btn-launch-dashboard").addEventListener("click", () => switchView("dashboard"));
  document.getElementById("btn-explore-how").addEventListener("click", () => switchView("about"));
  document.getElementById("btn-sim-storm").addEventListener("click", toggleStormSimulation);
  document.getElementById("btn-notif-modal").addEventListener("click", toggleNotificationModal);
  document.getElementById("btn-close-notif").addEventListener("click", toggleNotificationModal);
  document.getElementById("location-selector").addEventListener("change", (e) => handleLocationChange(e.target.value));

  // Initialize Map on tab switch or dashboard load
  let mapInitialized = false;

  // View Switcher Function
  function switchView(targetView) {
    state.currentView = targetView;

    // Toggle Landing vs Dashboard Layout
    if (targetView === "landing") {
      document.getElementById("app-header").classList.add("hidden");
      document.getElementById("app-main-container").classList.add("hidden");
      views.landing.classList.remove("hidden");
      return;
    }

    document.getElementById("app-header").classList.remove("hidden");
    document.getElementById("app-main-container").classList.remove("hidden");
    views.landing.classList.add("hidden");

    // Hide all main views
    Object.keys(views).forEach(k => {
      if (k !== "landing" && views[k]) {
        views[k].classList.add("hidden");
      }
    });

    // Show active target view
    if (views[targetView]) {
      views[targetView].classList.remove("hidden");
    }

    // Active Tab Highlight in Header
    document.querySelectorAll(".nav-link").forEach(link => {
      if (link.dataset.view === targetView) {
        link.classList.add("text-cyan-400", "border-b-2", "border-cyan-400", "font-semibold");
        link.classList.remove("text-gray-400");
      } else {
        link.classList.remove("text-cyan-400", "border-b-2", "border-cyan-400", "font-semibold");
        link.classList.add("text-gray-400");
      }
    });

    // Initialize components based on view
    if ((targetView === "dashboard" || targetView === "map") && !mapInitialized) {
      setTimeout(() => {
        initGISMap();
        mapInitialized = true;
      }, 100);
    } else if (targetView === "map" && state.map) {
      setTimeout(() => state.map.invalidateSize(), 150);
    }

    if (targetView === "analytics") {
      renderAnalyticsCharts();
    }
    if (targetView === "precautions") {
      renderPrecautionsView(state.selectedHazard);
    }
    if (targetView === "eoc") {
      renderEOCView();
    }
    if (targetView === "alerts") {
      renderAlertsView();
    }
    if (targetView === "mysafety") {
      renderMySafetyView();
    }
    if (targetView === "predictions") {
      renderPredictionsView();
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Populate Location Dropdown
  function populateLocationSelector(locList) {
    const sel = document.getElementById("location-selector");
    sel.innerHTML = "";
    locList.forEach(l => {
      const opt = document.createElement("option");
      opt.value = l.id;
      opt.textContent = `${l.name} (${l.currentRisk})`;
      sel.appendChild(opt);
    });
    sel.value = state.selectedLocationId;
    updateDashboardForLocation(state.selectedLocationId);
  }

  // Handle Location Change
  async function handleLocationChange(locId) {
    state.selectedLocationId = locId;
    updateDashboardForLocation(locId);

    // Pan map if initialized
    const loc = ALERTORA_DATA.locations.find(l => l.id === locId);
    if (loc && state.map) {
      state.map.flyTo([loc.lat, loc.lng], 10, { animate: true, duration: 1.2 });
    }
  }

  // Update UI Elements with Selected Location Data
  function updateDashboardForLocation(locId) {
    const loc = ALERTORA_DATA.locations.find(l => l.id === locId) || ALERTORA_DATA.locations[0];

    // Current metrics
    document.getElementById("location-name-display").textContent = loc.name;
    document.getElementById("metric-temp").textContent = `${loc.temp}°C`;
    document.getElementById("metric-humidity").textContent = `${loc.humidity}%`;
    document.getElementById("metric-wind").textContent = `${loc.windSpeed} km/h`;
    document.getElementById("metric-rain").textContent = `${loc.rainfallRate} mm/h`;
    
    // Risk Badge
    const riskBadge = document.getElementById("metric-risk-badge");
    riskBadge.textContent = loc.currentRisk;
    riskBadge.className = `px-3 py-1 rounded-full text-xs font-bold font-mono uppercase border ${getRiskBadgeClass(loc.currentRisk)}`;

    // ETA & Next Event
    document.getElementById("countdown-location").textContent = loc.name;
    document.getElementById("countdown-hazard-type").textContent = loc.nextHazardType;

    // Render AI Nowcast Timeline
    renderNowcastTimeline(loc.nowcast);

    // Render Hazards Summary Cards
    renderHazardCards(loc);

    // Render XAI Panel
    renderXAIPanel();

    // If MySafety view is active, update it
    if (state.currentView === "mysafety") {
      renderMySafetyView();
    }
  }

  // Helper for Risk Badge Classes
  function getRiskBadgeClass(risk) {
    switch (risk) {
      case "EXTREME": return "bg-red-950/60 text-red-400 border-red-500/50 animate-pulse-red";
      case "HIGH": return "bg-orange-950/60 text-orange-400 border-orange-500/50";
      case "MODERATE": return "bg-yellow-950/60 text-yellow-400 border-yellow-500/50";
      default: return "bg-emerald-950/60 text-emerald-400 border-emerald-500/50";
    }
  }

  // Render AI Nowcast Timeline (0-6 Hours)
  function renderNowcastTimeline(nowcastData) {
    const timelineContainer = document.getElementById("nowcast-timeline-bars");
    const hourSelectorContainer = document.getElementById("nowcast-hour-buttons");

    if (!timelineContainer || !hourSelectorContainer) return;

    hourSelectorContainer.innerHTML = "";
    nowcastData.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.className = `px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        idx === state.selectedTimelineHourIndex
          ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
          : "bg-slate-800/80 text-gray-300 hover:bg-slate-700"
      }`;
      btn.innerHTML = `<span class="block text-[10px] opacity-75">${item.time}</span>${item.hour}`;
      btn.addEventListener("click", () => {
        state.selectedTimelineHourIndex = idx;
        renderNowcastTimeline(nowcastData);
      });
      hourSelectorContainer.appendChild(btn);
    });

    const activeItem = nowcastData[state.selectedTimelineHourIndex] || nowcastData[0];

    timelineContainer.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="glass-panel p-3 rounded-lg border-slate-800">
          <div class="text-xs text-gray-400">Thunderstorm</div>
          <div class="text-2xl font-bold font-mono text-cyan-400 mt-1">${activeItem.thunderstorm}%</div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div class="bg-cyan-400 h-1.5 rounded-full" style="width: ${activeItem.thunderstorm}%"></div>
          </div>
        </div>

        <div class="glass-panel p-3 rounded-lg border-slate-800">
          <div class="text-xs text-gray-400">Hail Prob.</div>
          <div class="text-2xl font-bold font-mono text-amber-400 mt-1">${activeItem.hail}%</div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div class="bg-amber-400 h-1.5 rounded-full" style="width: ${activeItem.hail}%"></div>
          </div>
        </div>

        <div class="glass-panel p-3 rounded-lg border-slate-800">
          <div class="text-xs text-gray-400">Cloudburst Risk</div>
          <div class="text-2xl font-bold font-mono text-orange-400 mt-1">${activeItem.cloudburst}%</div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div class="bg-orange-400 h-1.5 rounded-full" style="width: ${activeItem.cloudburst}%"></div>
          </div>
        </div>

        <div class="glass-panel p-3 rounded-lg border-slate-800">
          <div class="text-xs text-gray-400">Lightning Strikes</div>
          <div class="text-2xl font-bold font-mono text-red-400 mt-1">${activeItem.lightning}%</div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div class="bg-red-400 h-1.5 rounded-full" style="width: ${activeItem.lightning}%"></div>
          </div>
        </div>

        <div class="glass-panel p-3 rounded-lg border-slate-800">
          <div class="text-xs text-gray-400">Rain Intensity</div>
          <div class="text-2xl font-bold font-mono text-blue-400 mt-1">${activeItem.rainfall} <span class="text-xs font-normal">mm/h</span></div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div class="bg-blue-400 h-1.5 rounded-full" style="width: ${Math.min(100, activeItem.rainfall)}%"></div>
          </div>
        </div>

        <div class="glass-panel p-3 rounded-lg border-slate-800">
          <div class="text-xs text-gray-400">Downburst Wind</div>
          <div class="text-2xl font-bold font-mono text-indigo-400 mt-1">${activeItem.wind} <span class="text-xs font-normal">km/h</span></div>
          <div class="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div class="bg-indigo-400 h-1.5 rounded-full" style="width: ${Math.min(100, activeItem.wind * 1.2)}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  // Render 4 Hazard Cards
  function renderHazardCards(loc) {
    const container = document.getElementById("severe-hazard-cards");
    if (!container) return;

    const hazards = ALERTORA_DATA.hazardsSummary;
    container.innerHTML = "";

    hazards.forEach(h => {
      const card = document.createElement("div");
      card.className = "glass-panel p-4 rounded-xl glass-card-interactive flex flex-col justify-between cursor-pointer border-slate-800 hover:border-cyan-500/40";
      card.addEventListener("click", () => {
        state.selectedHazard = h.id.toUpperCase();
        switchView("precautions");
      });

      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">${h.icon}</span>
            <span class="px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase ${getRiskBadgeClass(h.riskLevel)}">${h.riskLevel}</span>
          </div>
          <h4 class="text-sm font-bold text-gray-200 tracking-wide uppercase font-mono">${h.title}</h4>
          <p class="text-xs text-gray-400 mt-1">${h.description}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800/80 flex items-end justify-between">
          <div>
            <div class="text-[10px] text-gray-400 uppercase font-mono">AI Probability</div>
            <div class="text-2xl font-bold font-mono glow-cyan" style="color: ${h.color}">${h.probability}%</div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-gray-400 uppercase font-mono">Expected ETA</div>
            <div class="text-sm font-semibold font-mono text-gray-200">${h.eta}</div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // Render Explainable AI Factor Contributions
  function renderXAIPanel() {
    const container = document.getElementById("xai-factors-container");
    if (!container) return;

    container.innerHTML = "";
    ALERTORA_DATA.xaiFactors.forEach(f => {
      const row = document.createElement("div");
      row.className = "mb-3";
      row.innerHTML = `
        <div class="flex justify-between text-xs mb-1">
          <span class="text-gray-300 font-medium">${f.factor}</span>
          <span class="font-mono text-cyan-400 font-bold">+${f.weight}% Contribution</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-2">
          <div class="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full" style="width: ${f.weight * 2.5}%"></div>
        </div>
        <div class="text-[10px] text-gray-400 mt-0.5">${f.description}</div>
      `;
      container.appendChild(row);
    });
  }

  // Initialize GIS Interactive Map (Leaflet)
  function initGISMap() {
    const mapElement = document.getElementById("gis-map-container");
    if (!mapElement || state.map) return;

    // Create Leaflet Map centered on Chennai / Tamil Nadu
    state.map = L.map("gis-map-container", {
      center: [13.0827, 80.2707],
      zoom: 9,
      zoomControl: true
    });

    // Dark Map Tile Layer (CartoDB Dark Matter)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | Alertora AI GIS',
      maxZoom: 18,
      subdomains: "abcd"
    }).addTo(state.map);

    // Render Location Markers & Risk Polygons
    renderMapOverlays();

    // Map Click Listener to pick custom coordinates
    state.map.on("click", (e) => {
      const { lat, lng } = e.latlng;
      openCustomLocationModal(lat.toFixed(4), lng.toFixed(4));
    });

    // Layer Controls Event Listeners
    document.querySelectorAll(".map-layer-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".map-layer-btn").forEach(b => b.classList.remove("bg-cyan-500", "text-black", "font-bold"));
        btn.classList.add("bg-cyan-500", "text-black", "font-bold");
        state.activeMapLayer = btn.dataset.layer;
        updateMapLayers();
      });
    });
  }

  // Render Map Overlays & Risk Polygons
  function renderMapOverlays() {
    if (!state.map) return;

    // Simulated Storm Radar Circle Overlay
    state.radarOverlay = L.circle([13.12, 80.18], {
      color: "#ef4444",
      fillColor: "#ef4444",
      fillOpacity: 0.35,
      radius: 28000
    }).addTo(state.map);
    state.radarOverlay.bindTooltip("<b>Storm Core Active</b><br>Reflectivity: 54.2 dBZ", { permanent: false, direction: "top" });

    // Secondary Moderate Risk Polygon
    const polygon = L.polygon([
      [13.25, 79.85],
      [13.40, 80.15],
      [13.10, 80.35],
      [12.90, 80.05]
    ], {
      color: "#f97316",
      fillColor: "#f97316",
      fillOpacity: 0.2
    }).addTo(state.map);
    polygon.bindTooltip("<b>High Convective Risk Zone</b><br>0-6 Hr Forecast Area", { permanent: false });

    // Markers for all Tamil Nadu locations
    ALERTORA_DATA.locations.forEach(loc => {
      const markerColor = loc.currentRisk === "EXTREME" ? "#ef4444" : (loc.currentRisk === "HIGH" ? "#f97316" : "#f59e0b");
      
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color:${markerColor}; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px ${markerColor}"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).addTo(state.map);

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <div class="flex items-center justify-between border-b border-slate-700 pb-1 mb-2">
            <span class="font-bold text-sm text-cyan-400 font-mono">${loc.name}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${getRiskBadgeClass(loc.currentRisk)}">${loc.currentRisk}</span>
          </div>
          <div class="text-xs space-y-1 text-gray-300">
            <div><b>Temp:</b> ${loc.temp}°C | <b>Humidity:</b> ${loc.humidity}%</div>
            <div><b>Rain Intensity:</b> ${loc.rainfallRate} mm/hr</div>
            <div><b>Next Storm ETA:</b> <span class="text-amber-400 font-mono font-bold">${loc.nextHazardETA}</span></div>
          </div>
          <button onclick="window.selectLocationFromMap('${loc.id}')" class="mt-3 w-full bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold py-1 px-2 rounded transition">
            View Full Nowcast & Precautions
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
    });
  }

  // Global Map Selection Helper
  window.selectLocationFromMap = function(locId) {
    document.getElementById("location-selector").value = locId;
    handleLocationChange(locId);
    switchView("dashboard");
  };

  // Update Layer Filter Effects
  function updateMapLayers() {
    if (!state.radarOverlay) return;
    const layer = state.activeMapLayer;

    if (layer === "lightning") {
      state.radarOverlay.setStyle({ fillColor: "#3b82f6", color: "#3b82f6" });
    } else if (layer === "cloudburst") {
      state.radarOverlay.setStyle({ fillColor: "#ef4444", color: "#ef4444" });
    } else if (layer === "hail") {
      state.radarOverlay.setStyle({ fillColor: "#f59e0b", color: "#f59e0b" });
    } else {
      state.radarOverlay.setStyle({ fillColor: "#06b6d4", color: "#06b6d4" });
    }
  }

  // Open Custom Coordinate Location Drawer
  function openCustomLocationModal(lat, lng) {
    const modal = document.getElementById("location-profile-modal");
    if (!modal) return;

    document.getElementById("modal-coords").textContent = `Lat: ${lat}°N, Lng: ${lng}°E`;
    document.getElementById("modal-sim-temp").textContent = `${(28 + Math.random() * 5).toFixed(1)}°C`;
    document.getElementById("modal-sim-humidity").textContent = `${Math.floor(75 + Math.random() * 20)}%`;
    document.getElementById("modal-sim-prob").textContent = `${Math.floor(65 + Math.random() * 30)}%`;
    modal.classList.remove("hidden");

    document.getElementById("btn-close-loc-modal").onclick = () => modal.classList.add("hidden");
  }

  // Start Live Ticking Storm Countdown Timer
  function startCountdownTimer() {
    if (state.countdownInterval) clearInterval(state.countdownInterval);

    state.countdownInterval = setInterval(() => {
      if (state.countdownSeconds <= 0) {
        state.countdownSeconds = 7200; // Reset loop
      }
      state.countdownSeconds--;

      const hrs = Math.floor(state.countdownSeconds / 3600);
      const mins = Math.floor((state.countdownSeconds % 3600) / 60);
      const secs = state.countdownSeconds % 60;

      const pad = (n) => String(n).padStart(2, '0');
      document.getElementById("timer-hours").textContent = pad(hrs);
      document.getElementById("timer-minutes").textContent = pad(mins);
      document.getElementById("timer-seconds").textContent = pad(secs);

      // Simple mode countdown
      const timerSimple = document.getElementById("timer-simple-display");
      if (timerSimple) {
        timerSimple.textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
      }
    }, 1000);
  }

  // Interactive Demo Storm Simulation Loop
  function toggleStormSimulation() {
    const btn = document.getElementById("btn-sim-storm");

    if (state.stormSimulationActive) {
      clearInterval(state.stormSimulationInterval);
      state.stormSimulationActive = false;
      btn.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-2 animate-ping"></span>Start Storm Simulation`;
      btn.classList.remove("bg-red-600", "text-white");
      btn.classList.add("bg-slate-800", "text-cyan-400");
      showToast("Simulation Paused", "Storm trajectory simulation has been paused.");
    } else {
      state.stormSimulationActive = true;
      btn.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-white mr-2"></span>Pause Simulation`;
      btn.classList.remove("bg-slate-800", "text-cyan-400");
      btn.classList.add("bg-red-600", "text-white", "animate-pulse");

      showToast("⛈ STORM SIMULATION RUNNING", "Simulating storm movement across Tamil Nadu over 6 hours.");

      let simStep = 0;
      state.stormSimulationInterval = setInterval(() => {
        simStep++;
        
        // Move storm circle overlay
        if (state.radarOverlay && state.map) {
          const currentCenter = state.radarOverlay.getLatLng();
          state.radarOverlay.setLatLng([currentCenter.lat + 0.005, currentCenter.lng + 0.008]);
          state.radarOverlay.setRadius(28000 + (simStep * 1500));
        }

        // Dynamically update nowcast hazard values
        const currentLoc = ALERTORA_DATA.locations.find(l => l.id === state.selectedLocationId);
        if (currentLoc && currentLoc.nowcast) {
          currentLoc.nowcast.forEach(item => {
            item.thunderstorm = Math.min(100, item.thunderstorm + Math.floor(Math.random() * 5));
            item.lightning = Math.min(100, item.lightning + Math.floor(Math.random() * 6));
          });
          renderNowcastTimeline(currentLoc.nowcast);
        }

        // Show live warning notification at step 3
        if (simStep === 3) {
          showToast("🔴 EMERGENCY ALERT GENERATED", "Tiruvallur District: Hail & Lightning strike density exceeded threshold!", "RED");
          playAlertTone();
        }
      }, 2500);
    }
  }

  // Audio Warning Feedback Generator
  function playAlertTone() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log("Audio play blocked by browser policy.");
    }
  }

  // Render AI Safety Precautions View
  function renderPrecautionsView(hazardKey) {
    const hazardData = ALERTORA_DATA.precautionsDatabase[hazardKey] || ALERTORA_DATA.precautionsDatabase["THUNDERSTORM"];

    // Update buttons active state
    document.querySelectorAll(".precaution-hazard-btn").forEach(btn => {
      if (btn.dataset.hazard === hazardKey) {
        btn.classList.add("bg-cyan-500", "text-black", "font-bold");
        btn.classList.remove("bg-slate-800", "text-gray-300");
      } else {
        btn.classList.remove("bg-cyan-500", "text-black", "font-bold");
        btn.classList.add("bg-slate-800", "text-gray-300");
      }
    });

    document.getElementById("precaution-hazard-title").textContent = hazardData.hazard;

    // Render Govt Precautions
    const govtContainer = document.getElementById("precautions-govt-list");
    govtContainer.innerHTML = "";
    hazardData.government.forEach((item, i) => {
      const li = document.createElement("li");
      li.className = "flex items-start space-x-3 text-sm text-gray-300";
      li.innerHTML = `
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-bold text-xs flex items-center justify-center font-mono">${i + 1}</span>
        <span>${item}</span>
      `;
      govtContainer.appendChild(li);
    });

    // Render Public Precautions
    const publicContainer = document.getElementById("precautions-public-list");
    publicContainer.innerHTML = "";
    hazardData.public.forEach((item, i) => {
      const li = document.createElement("li");
      li.className = "flex items-start space-x-3 text-sm text-gray-300";
      li.innerHTML = `
        <span class="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center justify-center font-mono">✓</span>
        <span>${item}</span>
      `;
      publicContainer.appendChild(li);
    });
  }

  // Render Emergency Alerts View
  function renderAlertsView() {
    const container = document.getElementById("alerts-feed-container");
    if (!container) return;

    container.innerHTML = "";
    ALERTORA_DATA.alertsFeed.forEach(alert => {
      const alertCard = document.createElement("div");
      const borderClass = alert.severity === "RED" ? "border-red-500/60 bg-red-950/20" : (alert.severity === "ORANGE" ? "border-orange-500/50 bg-orange-950/20" : "border-yellow-500/40 bg-yellow-950/20");
      
      alertCard.className = `glass-panel p-5 rounded-xl border-l-4 ${borderClass} mb-4`;
      alertCard.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
          <div class="flex items-center space-x-3">
            <span class="px-2.5 py-1 rounded text-xs font-bold font-mono uppercase ${getRiskBadgeClass(alert.severity)}">${alert.severity} ALERT</span>
            <h3 class="text-base font-bold text-white font-mono">${alert.title}</h3>
          </div>
          <div class="text-xs text-gray-400 font-mono">${alert.timestamp} | Confidence: ${alert.confidence}%</div>
        </div>

        <div class="text-sm text-gray-300 mb-4">${alert.summary}</div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg text-xs mb-4">
          <div><span class="text-gray-500 block">Target Location</span><span class="font-bold text-gray-200 font-mono">${alert.location}</span></div>
          <div><span class="text-gray-500 block">Expected Arrival</span><span class="font-bold text-amber-400 font-mono">${alert.eta}</span></div>
          <div><span class="text-gray-500 block">Hazard Types</span><span class="font-bold text-cyan-400 font-mono">${alert.hazardTypes.join(", ")}</span></div>
          <div><span class="text-gray-500 block">Required Action</span><span class="font-bold text-red-400 font-mono">${alert.action}</span></div>
        </div>

        <div class="flex justify-end space-x-3">
          <button onclick="window.alertoraAPI.triggerPublicWarning('${alert.location}').then(r => alert(r.message))" class="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition font-mono">
            BroadCast Public Warning
          </button>
          <button onclick="window.switchAppView('precautions')" class="bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 text-xs font-bold px-4 py-2 rounded-lg transition font-mono">
            View Precautions
          </button>
        </div>
      `;
      container.appendChild(alertCard);
    });
  }

  // Render Government EOC Command Center View
  function renderEOCView() {
    const tbody = document.getElementById("eoc-district-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    ALERTORA_DATA.eocDistricts.forEach(row => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-800 hover:bg-slate-800/40 transition";
      tr.innerHTML = `
        <td class="p-3 font-bold font-mono text-cyan-400">${row.district}</td>
        <td class="p-3 text-gray-300 text-xs font-mono">${row.hazard}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono ${getRiskBadgeClass(row.risk)}">${row.risk}</span></td>
        <td class="p-3 text-amber-400 font-mono text-xs font-bold">${row.eta}</td>
        <td class="p-3 text-gray-300 font-mono text-xs">${row.confidence}</td>
        <td class="p-3 text-gray-300 text-xs">${row.populationAtRisk}</td>
        <td class="p-3 text-gray-400 text-xs">${row.infraAtRisk}</td>
        <td class="p-3">
          <button onclick="window.alertoraAPI.triggerPublicWarning('${row.district}').then(r => alert(r.message))" class="bg-cyan-500/20 hover:bg-cyan-500 text-cyan-400 hover:text-black border border-cyan-500/40 text-[11px] font-bold px-2.5 py-1 rounded transition font-mono">
            ${row.actionRequired}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Render Public Safety Mode ("My Safety")
  function renderMySafetyView() {
    const loc = ALERTORA_DATA.locations.find(l => l.id === state.selectedLocationId) || ALERTORA_DATA.locations[0];

    document.getElementById("mysafety-loc-name").textContent = loc.name;
    document.getElementById("mysafety-risk-banner").className = `p-4 rounded-xl border mb-6 flex items-center justify-between ${getRiskBadgeClass(loc.currentRisk)}`;
    document.getElementById("mysafety-risk-text").textContent = `⚠️ ${loc.currentRisk} ${loc.nextHazardType.toUpperCase()} ALERT`;
  }

  // Render AI Prediction Engine Status View
  function renderPredictionsView() {
    const pipelineContainer = document.getElementById("predictions-pipeline-container");
    if (!pipelineContainer) return;

    pipelineContainer.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-xs font-mono">
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">1. DATA INGESTION</div>
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">2. QUALITY CHECK</div>
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">3. SPATIAL ALIGN</div>
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">4. FEATURE EXTRACTION</div>
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">5. AI NOWCAST MODEL</div>
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">6. HAZARD PROB.</div>
        <div class="p-3 rounded-lg glass-panel border-cyan-500/30">7. RISK CLASS</div>
        <div class="p-3 rounded-lg glass-panel border-red-500/50 bg-red-950/30 font-bold">8. PUBLIC ALERT</div>
      </div>
    `;
  }

  // Render Analytics Page Charts using Chart.js
  function renderAnalyticsCharts() {
    if (typeof Chart === "undefined") return;

    // Chart 1: 6-Hour Hazard Probabilities
    const ctx1 = document.getElementById("chart-hazard-timeline");
    if (ctx1 && !state.analyticsCharts.hazardTimeline) {
      state.analyticsCharts.hazardTimeline = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: ['NOW', '+1 HR', '+2 HR', '+3 HR', '+4 HR', '+5 HR', '+6 HR'],
          datasets: [
            { label: 'Thunderstorm %', data: [72, 87, 94, 89, 65, 42, 25], borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.1)', fill: true, tension: 0.4 },
            { label: 'Cloudburst Risk %', data: [34, 58, 76, 68, 42, 20, 8], borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)', fill: true, tension: 0.4 },
            { label: 'Lightning Strike %', data: [68, 89, 96, 83, 58, 35, 18], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.4 }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.4)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.4)' }, max: 100 }
          }
        }
      });
    }

    // Chart 2: Rainfall Intensity Curve
    const ctx2 = document.getElementById("chart-rainfall-intensity");
    if (ctx2 && !state.analyticsCharts.rainfall) {
      state.analyticsCharts.rainfall = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['NOW', '+1 HR', '+2 HR', '+3 HR', '+4 HR', '+5 HR', '+6 HR'],
          datasets: [{
            label: 'Predicted Rainfall (mm/hr)',
            data: [25, 52, 85, 60, 30, 15, 5],
            backgroundColor: '#3b82f6',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: '#cbd5e1' } } },
          scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.4)' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.4)' } }
          }
        }
      });
    }
  }

  // Setup Navigation Clicks
  function setupNavigation() {
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = link.dataset.view;
        switchView(targetView);
      });
    });

    document.querySelectorAll(".precaution-hazard-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.selectedHazard = btn.dataset.hazard;
        renderPrecautionsView(state.selectedHazard);
      });
    });

    window.switchAppView = switchView;
  }

  // Notification Preferences Drawer Toggle
  function toggleNotificationModal() {
    const modal = document.getElementById("notif-modal");
    if (modal) modal.classList.toggle("hidden");
  }

  // Toast Generator
  function showToast(title, message, severity = "CYAN") {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) return;

    const toast = document.createElement("div");
    const borderColor = severity === "RED" ? "border-red-500" : "border-cyan-500";
    toast.className = `glass-panel p-4 rounded-xl border-l-4 ${borderColor} text-white shadow-2xl transition-all duration-500 max-w-sm font-mono`;
    toast.innerHTML = `
      <div class="font-bold text-xs ${severity === "RED" ? "text-red-400" : "text-cyan-400"} uppercase">${title}</div>
      <div class="text-xs text-gray-300 mt-1">${message}</div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-x-full");
      setTimeout(() => toast.remove(), 500);
    }, 4500);
  }

  // Initialize Canvas Animated Radar Sweep on Landing Page
  function initRadarCanvas() {
    const canvas = document.getElementById("radar-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    let angle = 0;
    function draw() {
      ctx.fillStyle = "rgba(7, 11, 20, 0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.85;

      // Draw concentric radar rings
      ctx.strokeStyle = "rgba(6, 182, 212, 0.15)";
      ctx.lineWidth = 1.5;
      for (let r = 0.2; r <= 1.0; r += 0.2) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, maxRadius * r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw crosshairs
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX, centerY + maxRadius);
      ctx.stroke();

      // Radar Sweep Line
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle);

      const gradient = ctx.createConicGradient(0, 0, 0);
      gradient.addColorStop(0, "rgba(6, 182, 212, 0.4)");
      gradient.addColorStop(0.2, "rgba(6, 182, 212, 0.05)");
      gradient.addColorStop(1, "transparent");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, maxRadius, 0, Math.PI / 2);
      ctx.lineTo(0, 0);
      ctx.fill();

      ctx.restore();

      angle += 0.02;
      requestAnimationFrame(draw);
    }
    draw();
  }

  // Set default view
  switchView("landing");
});
