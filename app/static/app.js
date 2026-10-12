let token=localStorage.getItem("guardian_token")||null;

let currentUser=null;
let currentPos=null;
let currentDest=null;
let currentRoute=null;
let currentMode="walking";
// ==========================================
// CONFIDENTIAL SAFETY REPORT EVIDENCE
// ==========================================

let reportEvidenceFiles = [];


// ==========================================
// GuardianMap DEMO NAVIGATION MODE
// ==========================================

// Keep this TRUE while testing the project.
// Change to false when you want real GPS navigation.
const DEMO_NAVIGATION_MODE = true;
let map,userMarker,destMarker,routeLine,reportLayer;
let navIndex=0;
let navWatch=null;
let followTimer=null;
let voiceRecognition=null;
let batterySaver=false;
let activeRoute = null;
let activeRouteCoordinates = [];
let isRerouting = false;
let offRouteCount = 0;
let guardianRecognition = null;
let followVoiceActive = false;
// Navigation testing mode
let simulationMode = false;

const OFF_ROUTE_DISTANCE_METERS = 80;
const OFF_ROUTE_CONFIRMATION_COUNT = 3;

let lastSpokenStep=-1;
let navigationActive=false;
let preWarningStep=-1;

function $(id){return document.getElementById(id)}
function authHeaders(){return token?{"Authorization":"Bearer "+token,"Content-Type":"application/json"}:{"Content-Type":"application/json"}}
async function api(url,options={}){
  const opt={...options,headers:{...(options.body?{"Content-Type":"application/json"}:{}),...(token?{"Authorization":"Bearer "+token}:{}),...(options.headers||{})}};
  const r=await fetch(url,opt); const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.detail||"Something went wrong");
  return data;
}
function toast(msg){const t=$("toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",3500)}

function requireLogin(){if(!token){openAuth();toast("Please log in to save private data.");return false}return true}

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("#modeSeg button").forEach(b=>b.onclick=()=>{document.querySelectorAll("#modeSeg button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");currentMode=b.dataset.mode});
function showPage(name){document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));$("page-"+name).classList.add("active");document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.page===name));$("sidebar").classList.remove("open");if(name==="navigate")setTimeout(()=>map.invalidateSize(),150);if(name==="trusted")loadContacts();if(name==="places")loadPlaces();if(name==="safety")loadReports();if(name==="analytics")loadAnalytics()}

function toggleSidebar(){$("sidebar").classList.toggle("open")}
function toggleRoutePanel(){

    const panel = $("routePanel");

    if (!panel) return;

    panel.classList.toggle("collapsed");

    setTimeout(() => {

        if (map) {
            map.invalidateSize();
        }

    }, 300);
}
function initMap() {

    map = L.map("map").setView(
        [15.8497, 74.4977],
        13
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors"
        }
    ).addTo(map);

    reportLayer = L.layerGroup().addTo(map);
    
    // ==========================================
    // DYUTA DEMO SAFETY LANDMARKS
    // Sample data for prototype demonstration
    // ==========================================

    const policeCheckpoints = [
        {
            lat: 15.8497,
            lng: 74.4977,
            name: "Demo Police Checkpoint 1",
            type: "Police checkpoint"
        },
        {
            lat: 15.8560,
            lng: 74.5020,
            name: "Demo Police Checkpoint 2",
            type: "Police checkpoint"
        },
        {
            lat: 15.8425,
            lng: 74.4905,
            name: "Demo Police Checkpoint 3",
            type: "Police checkpoint"
        },
        {
            lat: 15.8530,
            lng: 74.4915,
            name: "Demo Police Checkpoint 4",
            type: "Police checkpoint"
        }
    ];

    const safeHavens = [
        {
            lat: 15.8497,
            lng: 74.4977,
            name: "Demo Public Safety Point",
            type: "Public safety point",
            open: "Sample availability"
        },
        {
            lat: 15.8560,
            lng: 74.5020,
            name: "Demo Pharmacy",
            type: "Pharmacy",
            open: "Sample availability"
        },
        {
            lat: 15.8425,
            lng: 74.4905,
            name: "Demo Public Help Point",
            type: "Public help point",
            open: "Sample availability"
        }
    ];

    // Layers for the new map features
    const policeLayer = L.layerGroup().addTo(map);
    const safeHavenLayer = L.layerGroup().addTo(map);

    // Remember the layers and demo locations for other functions
    window.dyutaPoliceCheckpoints = policeCheckpoints;
    window.dyutaSafeHavens = safeHavens;
    window.dyutaPoliceLayer = policeLayer;
    window.dyutaSafeHavenLayer = safeHavenLayer;

    // ==========================================
    // POLICE CHECKPOINT MARKERS
    // ==========================================

    policeCheckpoints.forEach(point => {
        L.marker([point.lat, point.lng], {
            icon: L.divIcon({
                className: "dyuta-police-marker",
                html: "<div style='font-size:27px;background:white;border-radius:50%;padding:5px;border:2px solid #2563eb'>👮</div>",
                iconSize: [42, 42],
                iconAnchor: [21, 21]
            })
        })
        .bindPopup(`
            <b>🛡️ ${point.name}</b><br><br>
            Type: ${point.type}<br>
            <b>Prototype status:</b> Sample checkpoint<br><br>
            <small>Not verified as an active police patrol.
            No real response time is available.</small>
        `)
        .addTo(policeLayer);
    });

    // ==========================================
    // SAFE HAVEN RADAR
    // ==========================================

    safeHavens.forEach(place => {
        L.circle([place.lat, place.lng], {
            radius: 200,
            color: "#0284c7",
            weight: 2,
            fillColor: "#38bdf8",
            fillOpacity: 0.15
        }).addTo(safeHavenLayer);

        L.marker([place.lat, place.lng], {
            icon: L.divIcon({
                className: "dyuta-haven-marker",
                html: "<div style='font-size:24px;background:white;border-radius:50%;padding:5px;border:2px solid #0284c7'>🛟</div>",
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            })
        })
        .bindPopup(`
            <b>🛟 ${place.name}</b><br><br>
            Type: ${place.type}<br>
            Status: ${place.open}<br><br>
            <small>Demo landmark. Verify actual services and
            opening hours before relying on this location.</small>
        `)
        .addTo(safeHavenLayer);
    });

    // ==========================================
    // DYUTA SAFETY CONTROL PANEL
    // ==========================================

    
const safetyControl = L.control({ position: "topright" });

safetyControl.onAdd = function () {
    const div = L.DomUtil.create("div", "dyuta-radar-control");

    div.style.cssText =
        "width:255px;max-width:calc(100vw - 90px);" +
        "background:white;border:1px solid #f3c6dc;" +
        "border-radius:14px;overflow:hidden;" +
        "box-shadow:0 4px 14px #0002;font-size:13px;";

    div.innerHTML = `
        <button id="dyutaRadarToggle" type="button"
            aria-expanded="false"
            style="width:100%;display:flex;justify-content:space-between;
            align-items:center;padding:13px;border:0;background:white;
            color:#352044;font-weight:700;font-size:14px;cursor:pointer;">
            <span>🛡️ DYUTA Safety Radar</span>
            <span id="dyutaRadarArrow" style="color:#c21870;font-size:20px">⌄</span>
        </button>

        <div id="dyutaRadarBody" style="display:none;padding:10px;
            max-height:55vh;overflow-y:auto;line-height:1.7;">

            <label style="display:block">
                <input id="policePriorityToggle" type="checkbox">
                Prioritize Police Presence
            </label>

            <label style="display:block;margin-top:6px">
                <input id="policeLayerToggle" type="checkbox" checked>
                Show Police Checkpoints
            </label>

            <label style="display:block">
                <input id="havenLayerToggle" type="checkbox" checked>
                Show Safe Haven Radar
            </label>

            <hr style="margin:8px 0">

            <label for="dyutaDemoTime"><b>Demo time</b></label>
            <select id="dyutaDemoTime" style="width:100%;padding:7px">
                <option value="18">6:00 PM — Busy market</option>
                <option value="23.5">11:30 PM — Late night</option>
            </select>

            <div id="dyutaThreatCard" style="margin-top:8px;padding:9px;
                border-radius:8px;background:#fef3c7;color:#92400e">
                Choose a demo time to view the safety context.
            </div>

            <div id="dyutaNearestHaven" style="margin-top:8px;padding:9px;
                border-radius:8px;background:#e0f2fe;color:#075985">
                📍 Nearest sample Safe Haven will appear here.
            </div>

            <button id="dyutaRefreshRadar" type="button"
                style="margin-top:8px;width:100%;padding:9px;border:0;
                border-radius:7px;background:#0369a1;color:white;cursor:pointer">
                Refresh Safety Radar
            </button>
            <button id="dyutaRefreshRadar" type="button"
    style="margin-top:8px;width:100%;padding:9px;border:0;
    border-radius:7px;background:#0369a1;color:white;cursor:pointer">
    Refresh Safety Radar
</button>

<button id="dyutaEnableNotifications" type="button"
    style="margin-top:8px;width:100%;padding:9px;border:0;
    border-radius:7px;background:#7c3aed;color:white;cursor:pointer">
    Enable Browser Notifications
</button>


            <small style="display:block;margin-top:7px;color:#64748b">
                Demo data only — not live police or crowd information.
            </small>
        </div>
    `;

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);

    return div;
};

safetyControl.addTo(map);


    // Connect the controls after the panel has been added
    setTimeout(() => {
        const policeToggle = $("policePriorityToggle");
        const policeVisibility = $("policeLayerToggle");
        const havenVisibility = $("havenLayerToggle");
        const timeSelect = $("dyutaDemoTime");
        const refreshButton = $("dyutaRefreshRadar");
        const notificationButton = $("dyutaEnableNotifications");
        
const radarToggle = $("dyutaRadarToggle");
const radarBody = $("dyutaRadarBody");
const radarArrow = $("dyutaRadarArrow");

if (radarToggle && radarBody && radarArrow) {
    radarToggle.addEventListener("click", function () {
        const opening = radarBody.style.display === "none";

        radarBody.style.display = opening ? "block" : "none";
        radarArrow.textContent = opening ? "⌃" : "⌄";
        radarToggle.setAttribute("aria-expanded", String(opening));

        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 200);
    });
}


        if (policeVisibility) {
            policeVisibility.addEventListener("change", e => {
                if (e.target.checked) {
                    map.addLayer(policeLayer);
                } else {
                    map.removeLayer(policeLayer);
                }
            });
        }

        if (havenVisibility) {
            havenVisibility.addEventListener("change", e => {
                if (e.target.checked) {
                    map.addLayer(safeHavenLayer);
                } else {
                    map.removeLayer(safeHavenLayer);
                }
            });
        }

        if (policeToggle) {
            policeToggle.addEventListener("change", e => {
                window.dyutaPolicePriority = e.target.checked;

                if (e.target.checked) {
                    toast("Police-priority demo enabled. Recalculate your route.");
                } else {
                    toast("Police-priority demo disabled.");
                }
            });
        }

        if (timeSelect) {
            timeSelect.addEventListener("change", updateDyutaThreatCard);
            timeSelect.addEventListener("change", () => {
    if (currentRoute) loadRouteSafetyPlaces();
});
            updateDyutaThreatCard();
        }

        if (refreshButton) {
            refreshButton.addEventListener("click", updateDyutaSafetyRadar);
        }
        if (notificationButton) {
    notificationButton.addEventListener(
        "click",
        enableDyutaNotifications
    );
}

        updateDyutaSafetyRadar();
    }, 0);



   // ==========================================
// 📹 CCTV COVERAGE LAYER
// ==========================================

const cctvLayer = L.layerGroup().addTo(map);

const cctvLocations = [

    {
        lat: 15.8497,
        lng: 74.4977,
        name: "Registered CCTV Point 1",
        status: "Known CCTV coverage"
    },

    {
        lat: 15.8560,
        lng: 74.5020,
        name: "Registered CCTV Point 2",
        status: "Known CCTV coverage"
    },

    {
        lat: 15.8425,
        lng: 74.4905,
        name: "Registered CCTV Point 3",
        status: "Known CCTV coverage"
    }

];

cctvLocations.forEach(camera => {

    // 📹 CCTV marker
    L.marker(
        [camera.lat, camera.lng]
    )
    .bindPopup(`
        <div style="min-width:210px;">
            <b style="font-size:15px;">
                📹 CCTV Coverage
            </b>

            <br><br>

            <b>Location:</b><br>
            ${camera.name}

            <br><br>

            <b>Status:</b>
            <span style="color:#16a34a;font-weight:bold;">
                🟢 ${camera.status}
            </span>

            <br><br>

            <small>
                Registered/known CCTV information.
                This is not a live camera feed.
            </small>
        </div>
    `)
    .addTo(cctvLayer);


    // 🟢 Indicative CCTV coverage area
    L.circle(
        [camera.lat, camera.lng],
        {
            radius: 350,
            color: "#16a34a",
            weight: 2,
            fillColor: "#22c55e",
            fillOpacity: 0.16
        }
    )
    .bindPopup(`
        <b>🟢 Indicative CCTV Coverage Area</b>
        <br><br>
        ${camera.name}
        <br><br>
        <small>
            This area represents an indicative coverage zone
            around a registered/known CCTV location.
            It is not a live camera signal.
        </small>
    `)
    .addTo(cctvLayer);

});


    // ==========================================
    // 🗺️ MAP CLICK
    // ==========================================

    map.on(
        "click",
        e => {

            selectDestination(
                e.latlng.lat,
                e.latlng.lng,
                `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`
            );

        }
    );

}
async function useLocation(){
 if(!navigator.geolocation){toast("This browser does not support location.");return}
 toast("Getting your current location...");
 navigator.geolocation.getCurrentPosition(p=>{
   currentPos={lat:p.coords.latitude,lng:p.coords.longitude};
   $("originText").value=`${currentPos.lat.toFixed(6)}, ${currentPos.lng.toFixed(6)}`;
   if(userMarker)userMarker.setLatLng(currentPos);else userMarker=L.marker(currentPos).addTo(map).bindPopup("Your current location");
   userMarker.openPopup();map.setView(currentPos,16);
   if (typeof updateDyutaSafetyRadar === "function") {
    updateDyutaSafetyRadar();
}
   toast("Current location detected.");
 },e=>toast("Location unavailable: "+e.message),{enableHighAccuracy:true,timeout:15000,maximumAge:3000});
}
async function searchPlace(){
 const q=$("destinationInput").value.trim();if(!q)return toast("Enter a destination.");
 $("searchResults").textContent="Searching...";
 try{
  const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q="+encodeURIComponent(q),{headers:{"Accept-Language":"en"}});
  const rows=await r.json();$("searchResults").innerHTML="";
  if(!rows.length){$("searchResults").textContent="No places found.";return}
  rows.forEach(x=>{const d=document.createElement("div");d.className="result";d.textContent=x.display_name;d.onclick=()=>selectDestination(+x.lat,+x.lon,x.display_name);$("searchResults").appendChild(d)});
 }catch(e){$("searchResults").textContent="Search needs an internet connection."}
}
function selectDestination(lat,lng,name){
 currentDest={lat,lng,name};$("destinationInput").value=name;$("searchResults").innerHTML="";
 if(destMarker)destMarker.setLatLng(currentDest);else destMarker=L.marker(currentDest).addTo(map).bindPopup("Destination");
 destMarker.bindPopup(name).openPopup();map.setView(currentDest,15);
}
async function goQuick(label){
 if(!requireLogin())return;
 const places=await api("/api/places");
 const p=places.find(x=>x.label.toLowerCase()===label.toLowerCase());
 if(!p)return toast(`No ${label} saved. Search it first, then save it.`);
 selectDestination(p.latitude,p.longitude,p.address||p.label);
}
async function calculateRoute(priority="balanced"){
if(!currentPos){

    currentPos = {
        lat: 15.8497,
        lng: 74.4977
    };

}
 if(!currentDest)return toast("Search, tap the map, or select a saved place.");
 $("routeCards").innerHTML="Calculating real route...";
 try{
  const r=await api("/api/navigation/route",{method:"POST",body:JSON.stringify({origin_lat:currentPos.lat,origin_lng:currentPos.lng,destination_lat:currentDest.lat,destination_lng:currentDest.lng,mode:currentMode})});
  currentRoute=r;
  if(routeLine)map.removeLayer(routeLine);
  routeLine=L.polyline(r.points,{weight:7,opacity:.9,color:priority==="safest"?"#159567":"#4255c8"}).addTo(map);
  map.fitBounds(routeLine.getBounds(),{padding:[45,45]});
  await loadRouteSafetyPlaces();
  
  const alternatives=[
    ["Fastest",Math.max(35,r.safety_score-8),Math.max(1,Math.round(r.duration_min*.88))],
    ["Balanced",r.safety_score,r.duration_min],
    ["Safest",Math.min(98,r.safety_score+6),Math.round(r.duration_min*1.12)]
  ];
    const mlProb = r.ml_probabilities || {};

  const mlPrediction =
    r.ml_prediction === 0 ? "Low" :
    r.ml_prediction === 1 ? "Moderate" :
    r.ml_prediction === 2 ? "High" :
    r.risk_level || "Unknown";

  $("routeCards").innerHTML =
    alternatives.map(x =>
      `<div class="routeCard">
        <strong>${x[0]} Route</strong><br>
        ${r.distance_km} km • ${x[2]} min • Safety <b>${x[1]}/100</b>
      </div>`
    ).join("") +

    `<div class="metric">
      <strong>🛡️ GuardianMap Safety Assessment</strong><br><br>

      <strong>Safety Score:</strong> ${r.safety_score}/100<br>
      <strong>Risk Level:</strong> ${r.risk_level}<br>
      <strong>ML Prediction:</strong> ${mlPrediction}<br><br>

      <strong>ML Risk Probabilities</strong><br>
      Low: ${((mlProb.Low || 0) * 100).toFixed(1)}%<br>
      Moderate: ${((mlProb.Moderate || 0) * 100).toFixed(1)}%<br>
      High: ${((mlProb.High || 0) * 100).toFixed(1)}%<br><br>

      <strong>Nearby Safety Reports:</strong> ${r.nearby_report_count ?? 0}<br>
      <strong>Nearest Report:</strong> ${
        r.safety_features?.nearest_report_distance_km != null
          ? (r.safety_features.nearest_report_distance_km * 1000).toFixed(0) + " m"
          : "N/A"
      }<br>
      <strong>Safe Places:</strong> ${r.safety_features?.safe_place_count ?? 0}<br><br>

      ${r.explanation}<br>
      <small>Routing source: ${r.source}</small>
    </div>`;
  $("startNavigation").disabled=false;
 }catch(e){$("routeCards").textContent=e.message;toast(e.message)}
}

async function loadRouteSafetyPlaces() {
    if (!currentRoute?.points?.length) {
        return;
    }

    const policeLayer = window.dyutaPoliceLayer;
    const havenLayer = window.dyutaSafeHavenLayer;

    if (!policeLayer || !havenLayer) return;

    policeLayer.clearLayers();
    havenLayer.clearLayers();

    const routePoints = currentRoute.points.map(p =>
        Array.isArray(p)
            ? { lat: Number(p[0]), lng: Number(p[1]) }
            : { lat: Number(p.lat), lng: Number(p.lng) }
    ).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (!routePoints.length) return;

    const lats = routePoints.map(p => p.lat);
    const lngs = routePoints.map(p => p.lng);

    // Search within roughly 1 km of the route bounds.
    const south = Math.min(...lats) - 0.01;
    const north = Math.max(...lats) + 0.01;
    const west = Math.min(...lngs) - 0.01;
    const east = Math.max(...lngs) + 0.01;
    const bbox = `${south},${west},${north},${east}`;

   
const query = `
  [out:json][timeout:25];
  (
    node["amenity"~"^(police|pharmacy|hospital|clinic|school|college|university|bus_station)$"](${bbox});
    way["amenity"~"^(police|pharmacy|hospital|clinic|school|college|university|bus_station)$"](${bbox});

    node["shop"~"^(convenience|supermarket)$"](${bbox});
    way["shop"~"^(convenience|supermarket)$"](${bbox});
    
node["shop"="chemist"](${bbox});
way["shop"="chemist"](${bbox});

    node["man_made"="surveillance"](${bbox});
way["man_made"="surveillance"](${bbox});

    node["public_transport"="station"](${bbox});

    node["junction"="roundabout"]["name"](${bbox});
    way["junction"="roundabout"]["name"](${bbox});
    way["highway"~"^(primary|secondary|trunk)$"]["name"](${bbox});
  );
  out center tags;
`;


    try {
        toast("Finding police and support locations along your route...");

        const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded;charset=UTF-8"
                },
                body: "data=" + encodeURIComponent(query)
            }
        );

        if (!response.ok) {
            throw new Error("OpenStreetMap search is temporarily unavailable.");
        }

        const result = await response.json();
        const seen = new Set();
        const policePlaces = [];
        const supportPlaces = [];

        function escapeHTML(value) {
            return String(value ?? "").replace(/[&<>"']/g, ch => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[ch]);
        }

        for (const item of result.elements || []) {
            const tags = item.tags || {};

            const lat = Number(item.lat ?? item.center?.lat);
            const lng = Number(item.lon ?? item.center?.lon);

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            // Keep only landmarks within 500 m of the selected route.
            const distance = distanceFromPointToRoute(lat, lng);
            if (distance > 500) continue;

            const key = `${item.type}-${item.id}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const amenity = tags.amenity || "";
            const shop = tags.shop || "";
            const name = tags.name || tags.operator ||
                ({
                    police: "Police location",
                    pharmacy: "Pharmacy",
                    hospital: "Hospital",
                    clinic: "Clinic",
                    school: "School",
                    college: "College",
                    university: "University",
                    bus_station: "Bus station",
                    convenience: "Convenience store",
                    supermarket: "Supermarket"
                }[amenity || shop] || "Public transport station");

           
const isPolice = amenity === "police";
const isSchool = ["school", "college", "university"].includes(amenity);
const isPharmacy =
    amenity === "pharmacy" || shop === "chemist";

const isMedical =
    isPharmacy || ["hospital", "clinic"].includes(amenity);
const isRoundabout = tags.junction === "roundabout";
const isMainRoad = ["primary", "secondary", "trunk"].includes(tags.highway);

const demoHour = Number($("dyutaDemoTime")?.value ?? 18);
const isSchoolTime = demoHour >= 10 && demoHour < 17;

// Project demonstration assumptions.
// These are not live-verified opening hours or police presence.
let demoHours = tags.opening_hours || "Hours not listed";
let safetyScore = 55;
let safetyLabel = "General public location";

if (isPolice) {
    safetyScore = 95;
    safetyLabel = "Police support nearby";
    demoHours = tags.opening_hours || "Hours not verified";
} else if (/apollo/i.test(name) && isMedical) {
    safetyScore = 92;
    safetyLabel = "Demo 24×7 medical support";
    demoHours = "24×7 (demo assumption)";
} else if (isMedical) {
    safetyScore = 85;
    safetyLabel = "Medical support";
} else if (isSchool) {
    safetyScore = isSchoolTime ? 78 : 35;
    safetyLabel = isSchoolTime
        ? "Demo active-hours zone"
        : "School-hours zone — outside demo hours";
    demoHours = "10:00 AM–5:00 PM (demo assumption)";
} else if (amenity === "bus_station" ||
           tags.public_transport === "station") {
    safetyScore = 72;
    safetyLabel = "Public transport activity";
} else if (isRoundabout || isMainRoad) {
    safetyScore = 68;
    safetyLabel = "Main-road / public-activity indicator";
} else if (shop === "convenience" || shop === "supermarket") {
    safetyScore = 70;
    safetyLabel = "Public activity / shop nearby";
}

if (demoHour >= 23 && !isPolice &&
    !(/apollo/i.test(name) && isMedical)) {
    safetyScore = Math.max(20, safetyScore - 15);
}

const place = {
    lat,
    lng,
    name,
    type: amenity || shop || tags.highway ||
          tags.junction || tags.public_transport || "support location",
    open: demoHours,
    safetyScore,
    safetyLabel,
    distanceToRoute: Math.round(distance),
    id: key
};


            if (isPolice) {
                policePlaces.push(place);
            } else {
                supportPlaces.push(place);
            }

           
const icon = isPolice ? "👮" :
    isPharmacy ? "💊" :
    ["hospital", "clinic"].includes(amenity) ? "🏥" :
    ["school", "college", "university"].includes(amenity) ? "🎓" :
    amenity === "bus_station" ||
    tags.public_transport === "station" ? "🚌" :
    isRoundabout ? "⭕" :
    isMainRoad ? "🛣️" : "🏪";


            const marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className: "dyuta-route-place-marker",
                    html: `<div style="
                        background:white;
                        border:2px solid ${isPolice ? "#2563eb" : "#0284c7"};
                        border-radius:50%;
                        width:36px;height:36px;
                        display:flex;align-items:center;
                        justify-content:center;font-size:21px;
                        box-shadow:0 2px 6px #0003">
                        ${icon}
                    </div>`,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                })
            });

            marker.bindPopup(`
                <b>${escapeHTML(icon + " " + name)}</b><br>
                Type: ${escapeHTML(place.type)}<br>
                Approx. distance from route: ${place.distanceToRoute} m<br>
                Demo safety rating: <b>${place.safetyScore}/100</b><br>
Category: ${escapeHTML(place.safetyLabel)}<br>
                Listed opening hours: ${escapeHTML(place.open)}<br><br>
                <small>OpenStreetMap listing. Opening status and
                actual safety or police presence are not verified live.</small>
            `);

            if (isPolice) {
                marker.addTo(policeLayer);
            } else {
                // Visual highlight around the landmark only.
                // This is NOT a guaranteed safe zone.
                L.circle([lat, lng], {
                    radius: 100,
                    color: "#0284c7",
                    weight: 1,
                    dashArray: "4 5",
                    fillColor: "#38bdf8",
                    fillOpacity: 0.08
                }).addTo(havenLayer);

                marker.addTo(havenLayer);
            }
        }

        window.dyutaPoliceCheckpoints = policePlaces;
        window.dyutaSafeHavens = supportPlaces;
        
const allPlaces = [...policePlaces, ...supportPlaces]
    .sort((a, b) => a.distanceToRoute - b.distanceToRoute);

const nearestPlaces = allPlaces.slice(0, 3);

if (nearestPlaces.length) {
    const summary = nearestPlaces.map(place =>
        `${place.name}, approximately ${place.distanceToRoute} metres from your route`
    ).join(". ");

    // Voice guidance
    if ("speechSynthesis" in window) {
        speak("DYUTA route update. Nearby support locations. " + summary);
    }

    // Desktop/browser notifications
    if ("Notification" in window &&
        Notification.permission === "granted") {
        new Notification("DYUTA route update", {
            body: nearestPlaces.map(place =>
                `${place.name} — ${place.distanceToRoute} m from route`
            ).join("\n")
        });
    } else {
        toast("Nearby support locations found. Enable browser notifications for alerts.");
    }
} else {
    toast("No mapped support locations found near this route.");
}


        updateDyutaSafetyRadar();

        toast(
            `Route scan complete: ${policePlaces.length} police listings and ` +
            `${supportPlaces.length} support locations found nearby.`
        );

    } catch (error) {
        console.error("Route safety-place search failed:", error);
        toast("Could not load nearby landmarks. Check your internet and retry.");
    }
}


function distanceFromPointToRoute(userLat, userLng) {
    const points = currentRoute?.points || [];
    if (!points.length) return Infinity;

    let minimumDistance = Infinity;

    for (const point of points) {
        const routeLat = Number(
            Array.isArray(point) ? point[0] : point.lat
        );
        const routeLng = Number(
            Array.isArray(point) ? point[1] : point.lng
        );

        if (!Number.isFinite(routeLat) ||
            !Number.isFinite(routeLng)) {
            continue;
        }

        const distance = distanceBetween(
            userLat, userLng, routeLat, routeLng
        );

        minimumDistance = Math.min(minimumDistance, distance);
    }

    return minimumDistance;
}

function checkOffRoute(){

    if(!navigationActive){
        return;
    }

    if(isRerouting){
        return;
    }

    if(!currentPos){
        return;
    }

    if(
        !currentRoute ||
        !currentRoute.points ||
        currentRoute.points.length === 0
    ){
        return;
    }


    const distanceFromRoute =
        distanceFromPointToRoute(
            currentPos.lat,
            currentPos.lng
        );


    console.log(
        "Distance from route:",
        Math.round(distanceFromRoute),
        "meters"
    );


    if(
        distanceFromRoute >
        OFF_ROUTE_DISTANCE_METERS
    ){

        offRouteCount++;

        console.log(
            "Possible off-route reading:",
            offRouteCount
        );

    }
    else{

        offRouteCount = 0;

    }


    if(
        offRouteCount >=
        OFF_ROUTE_CONFIRMATION_COUNT
    ){

        rerouteFromCurrentLocation();

    }
}
// ==========================================
// Haversine distance
// ==========================================

function haversineDistanceKm(
    lat1,
    lng1,
    lat2,
    lng2
){

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI / 180;

    const dLng =
        (lng2 - lng1) *
        Math.PI / 180;

    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2)
        +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}
// ==========================================
// Automatic Safe Rerouting
// ==========================================

// ==========================================
// Automatic Safe Rerouting
// ==========================================

async function rerouteFromCurrentLocation(){

    if(isRerouting){
        return;
    }

    if(!currentPos || !currentDest){
        toast("Current location or destination is missing.");
        return;
    }

    isRerouting = true;

    console.log(
        "🚨 OFF ROUTE DETECTED"
    );

    // -----------------------------------------
    // Voice warning FIRST
    // -----------------------------------------

    speak(
        "You are off the planned route. Recalculating your route now."
    );

    toast(
        "⚠️ You are off route. Recalculating..."
    );

    try{

        // -----------------------------------------
        // Ask backend for a NEW route
        // from the simulated/current position
        // -----------------------------------------

        const r = await api(
            "/api/navigation/route",
            {
                method: "POST",

                body: JSON.stringify({

                    origin_lat:
                        currentPos.lat,

                    origin_lng:
                        currentPos.lng,

                    destination_lat:
                        currentDest.lat,

                    destination_lng:
                        currentDest.lng,

                    mode:
                        currentMode || "walking"
                })
            }
        );

        // -----------------------------------------
        // SAVE NEW ROUTE
        // -----------------------------------------

        currentRoute = r;

        // Start new route from beginning
        navIndex = 0;

        lastSpokenStep = -1;

        preWarningStep = -1;

        offRouteCount = 0;

        // -----------------------------------------
        // REMOVE OLD ROUTE
        // -----------------------------------------

        if(routeLine){

            map.removeLayer(
                routeLine
            );

            routeLine = null;
        }

        // -----------------------------------------
        // DRAW NEW ROUTE
        // -----------------------------------------

        routeLine =
            L.polyline(
                r.points,
                {
                    weight: 7,
                    opacity: 0.9,
                    color: "#e4474c"
                }
            ).addTo(map);

        // -----------------------------------------
        // Keep simulated user at
        // the OFF-ROUTE position
        // -----------------------------------------

        moveDemoMarker(
            currentPos
        );

        // -----------------------------------------
        // Show new route on map
        // -----------------------------------------

        map.fitBounds(
            routeLine.getBounds(),
            {
                padding: [45,45]
            }
        );

        // -----------------------------------------
        // Show first instruction
        // -----------------------------------------

        renderNavStep();

        const firstStep =
            r.steps &&
            r.steps.length
                ? r.steps[0].text
                : "Continue toward your destination.";

        // -----------------------------------------
        // Tell user rerouting succeeded
        // -----------------------------------------

        toast(
            "✅ New route found. Navigation resumed."
        );

        speak(
            "You are now on the new route. " +
            firstStep
        );

        console.log(
            "✅ NEW ROUTE:",
            r
        );

    }catch(error){

        console.error(
            "❌ Rerouting failed:",
            error
        );

        toast(
            "⚠️ Could not automatically recalculate the route."
        );

        speak(
            "I could not recalculate the route."
        );

    }finally{

        isRerouting = false;
    }
}
// ==========================================
// Move GuardianMap User Marker
// ==========================================

function moveDemoMarker(position){

    if(!position){
        return;
    }

    if(userMarker){

        userMarker.setLatLng(
            position
        );

    }else{

        userMarker =
            L.marker(position)
                .addTo(map)
                .bindPopup(
                    "📍 Your simulated location"
                );
    }

    // Keep map centered on simulated location
    map.panTo(
        position,
        {
            animate: true,
            duration: 0.5
        }
    );
    if (typeof updateDyutaSafetyRadar === "function") {
    updateDyutaSafetyRadar();
}

}
function startNavigation(){

    if(!currentRoute || !currentDest){
        toast("Please calculate a route first.");
        return;
    }

    navIndex = 0;

lastSpokenStep = -1;

preWarningStep = -1;

simulationMode = false;


    isRerouting = false;

    navigationActive = true;

    $("navDestination").textContent =
        currentDest.name || "Destination";

    const nextButton =
        document.querySelector(
            'button[onclick="nextStep()"]'
        );

    if(nextButton){
        nextButton.style.display = "block";
    }

    $("navModal").classList.remove("hidden");

    renderNavStep();

    speak(
        "Safe navigation started. " +
        $("navInstruction").textContent
    );


    // ==========================================
    // DEMO MODE
    // ==========================================

    if(DEMO_NAVIGATION_MODE){

        // Start from the beginning of the route
        if(
            currentRoute.points &&
            currentRoute.points.length > 0
        ){

            const firstPoint =
                currentRoute.points[0];

            currentPos = {
                lat: firstPoint[0],
                lng: firstPoint[1]
            };

            moveDemoMarker(currentPos);

            map.panTo(currentPos);
        }

        toast(
            "🧪 Demo Navigation Mode ON"
        );

        console.log(
            "GuardianMap Demo Navigation started."
        );

        return;
    }


    // ==========================================
    // REAL GPS MODE
    // ==========================================

    if(!navigator.geolocation){

        toast(
            "Live location is not supported by this browser."
        );

        return;
    }

    if(navWatch !== null){

        navigator.geolocation.clearWatch(
            navWatch
        );
    }

    navWatch =
        navigator.geolocation.watchPosition(

            position => {

                currentPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                moveDemoMarker(
                    currentPos
                );

                map.panTo(
                    currentPos
                );

               // -----------------------------------
// LIVE GPS NAVIGATION
// -----------------------------------

if(!simulationMode){

    // Check if user reached the next turn
    checkNavigationProgress();

    // Check whether real GPS location
    // has moved away from the planned route
    checkOffRoute();
}
            },

            error => {

                console.error(
                    "GPS error:",
                    error
                );

                toast(
                    "Unable to update your location."
                );
            },

            {
                enableHighAccuracy: true,
                maximumAge: 2000,
                timeout: 10000
            }
        );
}
// ==========================================
async function checkOffRoute(forceSimulation = false){

    if(!navigationActive){
        return;
    }

    if(isRerouting){
        return;
    }

    if(!currentPos){
        return;
    }

    if(
        !currentRoute ||
        !currentRoute.points ||
        currentRoute.points.length === 0
    ){
        return;
    }

    // -----------------------------------------
    // Calculate distance from planned route
    // -----------------------------------------

    const distanceFromRoute =
        distanceFromPointToRoute(
            currentPos.lat,
            currentPos.lng
        );

    console.log(
        "📍 Current position:",
        currentPos
    );

    console.log(
        "📏 Distance from route:",
        Math.round(distanceFromRoute),
        "meters"
    );

    // -----------------------------------------
    // OFF ROUTE THRESHOLD
    // -----------------------------------------


    if(
        distanceFromRoute >
        OFF_ROUTE_DISTANCE_METERS
    ){

        offRouteCount++;

        console.warn(
            "⚠️ Possible off-route reading:",
            offRouteCount,
            "/",
            OFF_ROUTE_CONFIRMATION_COUNT
        );

    }else{

        offRouteCount = 0;

        console.log(
            "✅ User is on the planned route."
        );
    }

    // -----------------------------------------
    // CONFIRM OFF ROUTE
    // -----------------------------------------

    if(
        offRouteCount >=
        OFF_ROUTE_CONFIRMATION_COUNT
    ){

        console.warn(
            "🚨 OFF ROUTE CONFIRMED"
        );

        // Reset counter immediately
        offRouteCount = 0;

        await rerouteFromCurrentLocation(
            forceSimulation
        );
    }
}
function speak(text){

    if(!("speechSynthesis" in window)){
        console.log("Voice is not supported.");
        return;
    }

    window.speechSynthesis.cancel();

    const speech =
        new SpeechSynthesisUtterance(text);

    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);
}

async function enableDyutaNotifications() {
    if (!("Notification" in window)) {
        toast("Browser notifications are not supported.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
            toast("DYUTA browser notifications enabled.");
        } else {
            toast("Notifications were not enabled.");
        }
    } catch (error) {
        console.error("Notification permission error:", error);
        toast("Could not enable browser notifications.");
    }
}


function distanceBetween(lat1, lng1, lat2, lng2){

    const R = 6371000;

    const dLat = (lat2 - lat1) * Math.PI / 180;

    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

    return R * c;
}


function getNavigationTarget(stepIndex){

    const points = currentRoute.points || [];

    const steps = currentRoute.steps || [];

    if(!points.length){
        return null;
    }

    // Last navigation step points to destination
    if(stepIndex >= steps.length - 1){

        return {
            lat: currentDest.lat,
            lng: currentDest.lng
        };
    }

    // Match each instruction approximately
    // to a point on the route
    const pointIndex = Math.floor(
        ((stepIndex + 1) / steps.length) *
        (points.length - 1)
    );

    const point = points[pointIndex];

    if(!point){
        return null;
    }

    // If point is [latitude, longitude]
    if(Array.isArray(point)){

        return {
            lat: point[0],
            lng: point[1]
        };
    }

    return {
        lat: point.lat,
        lng: point.lng
    };
}


function checkNavigationProgress(){

    if(!navigationActive){
        return;
    }

    if(!currentPos || !currentRoute){
        return;
    }

    const steps = currentRoute.steps || [];

    // Check if destination reached
    if(currentDest){

        const destinationDistance = distanceBetween(

            currentPos.lat,
            currentPos.lng,

            currentDest.lat,
            currentDest.lng
        );

        if(destinationDistance < 20){

            completeNavigation();

            return;
        }
    }

    if(navIndex >= steps.length){
        return;
    }

    const target = getNavigationTarget(navIndex);

    if(!target){
        return;
    }

    const distance = distanceBetween(

        currentPos.lat,
        currentPos.lng,

        target.lat,
        target.lng
    );

    // Distance required to move to next instruction
    let arrivalDistance = 15;

    if(currentMode === "car"){
        arrivalDistance = 30;
    }

    if(currentMode === "cycling"){
        arrivalDistance = 20;
    }

    // Give warning before reaching the next turn
    if(
        distance < 80 &&
        distance > arrivalDistance &&
        preWarningStep !== navIndex
    ){

        preWarningStep = navIndex;

        const nextInstruction =
            steps[navIndex].text;

        speak(
            "In approximately " +
            Math.round(distance) +
            " metres. " +
            nextInstruction
        );
    }

    // Automatically move to next instruction
    if(distance <= arrivalDistance){

        navIndex++;

        preWarningStep = -1;

        renderNavStep();

        if(navIndex < steps.length){

            speak(
                $("navInstruction").textContent
            );
        }
        else{

            completeNavigation();
        }
    }
}


function renderNavStep(){

    const steps = currentRoute.steps || [];

    if(navIndex >= steps.length){

        $("navInstruction").textContent =
            "🎉 You have reached your destination safely.";

        $("navProgress").textContent =
            "Navigation completed.";

        return;
    }

    const step = steps[navIndex];

    $("navInstruction").textContent =
        step.text;

    $("navProgress").textContent =
        `Step ${navIndex + 1} of ${steps.length} • ${step.distance_m || 0} m`;
}

function nextStep(){

    if(
        !currentRoute ||
        !currentRoute.steps ||
        currentRoute.steps.length === 0
    ){
        toast(
            "No active navigation route."
        );

        return;
    }

    // -----------------------------------------
    // DEMO MODE
    // -----------------------------------------

    simulationMode = true;

    // Stop real GPS while testing
    if(navWatch !== null){

        navigator.geolocation.clearWatch(
            navWatch
        );

        navWatch = null;
    }

    // -----------------------------------------
    // Get next route position
    // -----------------------------------------

    const target =
        getNavigationTarget(navIndex);

    if(target){

        currentPos = {

            lat: target.lat,

            lng: target.lng
        };

        moveDemoMarker(
            currentPos
        );

        console.log(
            "🧪 SIMULATED POSITION:",
            currentPos
        );
    }

    // -----------------------------------------
    // Move to next instruction
    // -----------------------------------------

    navIndex++;

    if(
        navIndex >=
        currentRoute.steps.length
    ){

        completeNavigation();

        return;
    }

    // Reset warning state
    preWarningStep = -1;

    lastSpokenStep = navIndex;

    // Display instruction
    renderNavStep();

    // Voice instruction
    const instruction =
        $("navInstruction").textContent;

    speak(
        instruction
    );

    toast(
        "📍 Moved to next route instruction."
    );
}
// ==========================================
// DEMO: Simulate Off-Route Situation
// ==========================================

async function simulateOffRoute(){

    if(!DEMO_NAVIGATION_MODE){

        toast(
            "Demo Navigation Mode is OFF."
        );

        return;
    }

    if(!navigationActive){

        toast(
            "Start Safe Navigation first."
        );

        return;
    }

    if(!currentRoute){

        toast(
            "Calculate a route first."
        );

        return;
    }

    if(!currentPos){

        toast(
            "Current simulated location is unavailable."
        );

        return;
    }

    // -----------------------------------------
    // Move simulated user OFF the route
    // -----------------------------------------

    currentPos = {

        lat:
            currentPos.lat + 0.005,

        lng:
            currentPos.lng + 0.005
    };

    // -----------------------------------------
    // Move blue location marker
    // -----------------------------------------

    moveDemoMarker(
        currentPos
    );

    console.log(
        "🧪 SIMULATED OFF-ROUTE LOCATION:",
        currentPos
    );

    toast(
        "🧪 You are now OFF the planned route."
    );

    speak(
        "You have moved off the planned route."
    );

    // -----------------------------------------
    // Check OFF ROUTE immediately
    // -----------------------------------------

    await checkOffRoute(true);

    // -----------------------------------------
    // Run two more checks
    // to confirm the condition
    // -----------------------------------------

    setTimeout(
        () => checkOffRoute(true),
        500
    );

    setTimeout(
        () => checkOffRoute(true),
        1000
    );
}
function completeNavigation(){

    if(!navigationActive){
        return;
    }

    navigationActive = false;

    $("navInstruction").textContent =
        "🎉 You have reached your destination safely.";

    $("navProgress").textContent =
        "Navigation completed successfully.";

    // Hide the navigation buttons/controls
    const nextButton = document.querySelector(
        'button[onclick="nextStep()"]'
    );

    if(nextButton){
        nextButton.style.display = "none";
    }

    speak(
        "You have reached your destination safely. Navigation completed."
    );

    toast(
        "🎉 You have reached your destination safely!"
    );

    if(navWatch !== null){

        navigator.geolocation.clearWatch(navWatch);

        navWatch = null;
    }
}

function stopNavigation(){

    navigationActive = false;

    $("navModal").classList.add("hidden");

    if(navWatch !== null){

        navigator.geolocation.clearWatch(navWatch);

        navWatch = null;
    }

    if("speechSynthesis" in window){

        window.speechSynthesis.cancel();
    }
}
async function findSafeHaven(){

    if(!currentPos){
        await new Promise(resolve=>{
            useLocation();
            setTimeout(resolve,1600);
        });
    }

    if(!currentPos){
        return toast("Current location is required.");
    }

    try{

        const d = await api(
            "/api/navigation/safe-haven",
            {
                method:"POST",

                body:JSON.stringify({
                    lat:currentPos.lat,
                    lng:currentPos.lng
                })
            }
        );

        // Save Safe Haven destination
        currentDest = {
            lat:d.safe_haven.latitude,
            lng:d.safe_haven.longitude,
            name:d.safe_haven.name +
                 " — " +
                 d.safe_haven.type
        };

        // Save Safe Haven route
        currentRoute = d.route;

        // Show destination marker
        selectDestination(
            currentDest.lat,
            currentDest.lng,
            currentDest.name
        );

        // Remove old route
        if(routeLine){
            map.removeLayer(routeLine);
        }

        // Draw Safe Haven route
        routeLine = L.polyline(
            currentRoute.points,
            {
                weight:8,
                color:"#e4474c"
            }
        ).addTo(map);

        // Show complete route on map
        map.fitBounds(
            routeLine.getBounds(),
            {
                padding:[45,45]
            }
        );

        // Go to navigation page
        showPage("navigate");

        // Show where Safe Haven is
        toast(
            "Safe Haven found: " +
            d.safe_haven.name
        );

        // IMPORTANT:
        // Automatically start navigation
        setTimeout(()=>{
            startNavigation();
        },800);

    }
    catch(e){

        console.error(e);

        toast(
            "Could not start Safe Haven navigation: " +
            e.message
        );
    }
}
async function stalkingMode(){await findSafeHaven();showPage("follow");startFollow();toast("Stalking Safety Mode: public safe haven selected; Home is not used.");}
function batteryMode(){batterySaver=!batterySaver;toast(batterySaver?"Battery Saver enabled: reduced background behaviour.":"Battery Saver disabled.");}
function toggleVoice(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR)return toast("Voice recognition is not supported by this browser.");
 if(voiceRecognition){voiceRecognition.stop();voiceRecognition=null;return toast("Voice demo stopped.");}
 voiceRecognition=new SR();voiceRecognition.continuous=true;voiceRecognition.interimResults=false;voiceRecognition.lang="en-IN";
voiceRecognition.onresult = e => {

    const text =
        e.results[
            e.results.length - 1
        ][0].transcript.toLowerCase();

    console.log(
        "VOICE HEARD:",
        text
    );

    if (
        text.includes("guardian help") ||
        text.includes("guardian, help")
    ) {

        toast(
            "🚨 Guardian Help detected!"
        );

        activateVoiceEmergency();

    }

};
 voiceRecognition.onend=()=>{if(voiceRecognition)try{voiceRecognition.start()}catch{}};
 voiceRecognition.start();toast('Voice demo enabled. Say "Guardian Help".');
}
function speak(text, callback){

    if(
        !("speechSynthesis" in window)
    ){
        console.log(
            "Voice is not supported."
        );

        return;
    }

    window.speechSynthesis.cancel();

    const speech =
        new SpeechSynthesisUtterance(
            text
        );

    speech.rate = 0.9;

    speech.pitch = 1;

    speech.volume = 1;

    speech.onend = function(){

        if(callback){
            callback();
        }
    };

    window.speechSynthesis.speak(
        speech
    );
}


function startVoiceListening() {
    if (!followVoiceActive || window.emergencyActive) return;

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        $("checkinBox").innerHTML = `
            <div class="metric">
                Voice recognition is not supported.
                Please use the safety buttons.
            </div>`;
        return;
    }

    if (guardianRecognition) {
        try {
            guardianRecognition.abort();
        } catch (e) {}
        guardianRecognition = null;
    }

    const recognition = new SpeechRecognition();
    guardianRecognition = recognition;

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    $("checkinBox").innerHTML = `
        <div class="metric">
            <b>🎤 Guardian is listening...</b><br>
            Say "I'm safe" or "Help me".
        </div>`;

    recognition.onresult = function (event) {
        if (!followVoiceActive || window.emergencyActive) return;

        const message = Array.from(event.results[0])
            .map(result => result.transcript)
            .join(" ")
            .toLowerCase()
            .trim();

        console.log("Guardian heard:", message);
        handleVoiceResponse(message);
    };

    recognition.onerror = function (event) {
        console.error("Recognition error:", event.error);

        if (event.error === "not-allowed" ||
            event.error === "service-not-allowed") {
            $("checkinBox").innerHTML = `
                <div class="metric">
                    <b>Microphone permission denied.</b><br>
                    Allow microphone access in Chrome settings.
                </div>`;
        } else if (event.error === "no-speech") {
            $("checkinBox").innerHTML = `
                <div class="metric">
                    <b>No speech detected.</b><br>
                    Please try again or use a button.
                </div>`;
        }
    };

    recognition.onend = function () {
        if (guardianRecognition === recognition) {
            guardianRecognition = null;
        }
        console.log("Guardian recognition ended.");
    };

    try {
        recognition.start();
    } catch (error) {
        console.error("Could not start recognition:", error);
    }
}



function handleVoiceResponse(message) {
    const text = message.toLowerCase().trim();

    const needsHelp =
        /\b(help|emergency|danger|unsafe|save me)\b/.test(text) ||
        text.includes("not safe") ||
        text.includes("following me");

    if (needsHelp) {
        followVoiceActive = false;

        if (guardianRecognition) {
            try {
                guardianRecognition.abort();
            } catch (e) {}
            guardianRecognition = null;
        }

        activateVoiceEmergency();
        return;
    }

    const isSafe =
        /\bsafe\b/.test(text) ||
        /\b(yes|okay|ok|fine)\b/.test(text);

    if (isSafe) {
        $("checkinBox").innerHTML = `
            <div class="metric">
                <b>💚 Safety confirmed!</b><br>
                Guardian will continue checking on you.
            </div>`;

        toast("Safety confirmed.");

        speak(
            "I'm glad you are safe.",
            function () {
                if (followVoiceActive && !window.emergencyActive) {
                    startVoiceListening();
                }
            }
        );
        return;
    }

    $("checkinBox").innerHTML = `
        <div class="metric">
            <b>⚠️ I couldn't understand.</b><br>
            Please say "I'm safe" or "Help me".
        </div>`;

    speak(
        "Please say I am safe, or say help me.",
        function () {
            if (followVoiceActive && !window.emergencyActive) {
                startVoiceListening();
            }
        }
    );
}

async function activateVoiceEmergency(silent = false) {

    // Prevent emergency from activating multiple times
    if (window.emergencyActive) {
        return;
    }

    window.emergencyActive = true;

    const emergencyOutput = $("emergencyOutput");
    const checkinBox = $("checkinBox");
    const followStatus = $("followStatus");


    // ---------------------------------
    // Stop normal Follow Me timer
    // ---------------------------------

    if (followTimer) {
        clearInterval(followTimer);
        followTimer = null;
    }


    // ---------------------------------
    // Show initial emergency status
    // ---------------------------------

    const initialEmergencyHTML = `
        <div class="metric emergency-box">

            <b class="emergency-title">
                🚨 EMERGENCY ASSISTANCE ACTIVE
            </b>

            <br><br>

            ${silent
                ? "Silent SOS activated."
                : "Voice distress command detected."
            }

            <br><br>

            📍 Getting your location...

            <br>

            👨‍👩‍👧 Preparing Trusted Circle response...

        </div>
    `;


    if (emergencyOutput) {
        emergencyOutput.innerHTML = initialEmergencyHTML;
    }

    if (checkinBox) {
        checkinBox.innerHTML = initialEmergencyHTML;
    }

    if (followStatus) {
        followStatus.innerHTML = initialEmergencyHTML;
    }


    // ---------------------------------
    // Emergency notification
    // ---------------------------------

    if (silent) {

        toast("🚨 Silent SOS activated.");

    } else {

        toast("🚨 Emergency mode activated!");

        speak(
            "I heard that you need help. I am activating emergency assistance now."
        );

    }


    try {

        // ---------------------------------
        // 1. Get latest current location
        // ---------------------------------

        await new Promise((resolve, reject) => {

            if (!navigator.geolocation) {

                reject(
                    new Error(
                        "Geolocation is not supported by this browser."
                    )
                );

                return;
            }


            navigator.geolocation.getCurrentPosition(

                position => {

                    currentPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };

                    resolve();

                },

                error => {
                    reject(error);
                },

                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }

            );

        });


        // ---------------------------------
        // 2. Get Trusted Circle contacts
        // ---------------------------------

        let contacts = [];

        try {

            if (token) {
                contacts = await api("/api/contacts");
            }

        } catch (error) {

            console.error(
                "Could not load trusted contacts:",
                error
            );

        }


        // ---------------------------------
        // 3. Select first Trusted Contact
        // ---------------------------------

        let emergencyContact = null;

        if (
            Array.isArray(contacts) &&
            contacts.length > 0
        ) {

            emergencyContact = contacts[0];

        }


        // ---------------------------------
        // 4. Create current location link
        // ---------------------------------

        const locationLink =
            "https://www.google.com/maps?q=" +
            currentPos.lat +
            "," +
            currentPos.lng;


        // ---------------------------------
        // 5. Create emergency message
        // ---------------------------------

        const emergencyMessage =
            "🚨 EMERGENCY! I need help. " +
            "My current location is: " +
            locationLink +
            " Please contact me immediately.";


        // Save emergency message globally

        window.guardianEmergencyMessage =
            emergencyMessage;


        // ---------------------------------
// 6. Emergency response
// ---------------------------------

if (emergencyContact) {

    const emergencyHTML = `
        <div class="metric emergency-box">

            <b class="emergency-title">
                🚨 EMERGENCY MODE ACTIVE
            </b>

            <br><br>

            <b>Trusted Contact:</b>
            ${emergencyContact.name}

            <br>

            <b>Relationship:</b>
            ${emergencyContact.relation || "Trusted Contact"}

            <br><br>

            📍 Your current location has been captured.

            <br><br>

            <a
                href="${locationLink}"
                target="_blank"
                style="color:#e4474c;font-weight:bold;"
            >
                📍 Open Current Location
            </a>

            <br><br>

            <button
                class="danger"
                onclick="callEmergencyContact('${emergencyContact.phone}')"
                style="width:100%; margin-top:10px;"
            >
                📞 Call ${emergencyContact.name}
            </button>

            <br><br>

            <button
                class="primary full"
                onclick="sendEmergencySMS('${emergencyContact.phone}')"
            >
                💬 Send Emergency SMS
            </button>

            <br><br>

            <button
                class="danger"
                onclick="callEmergencyServices()"
                style="width:100%;"
            >
                🚨 Call 112 Emergency
            </button>

            <br><br>

            <button
                class="primary full"
                onclick="copyEmergencyMessage()"
            >
                📋 Copy Emergency Message
            </button>

            <br><br>

            <button
                class="primary full"
                onclick="findSafeHaven()"
            >
                🛡️ Navigate to Safe Haven
            </button>

        </div>
    `;

    // Show emergency result on Emergency page
    if (emergencyOutput) {
        emergencyOutput.innerHTML = emergencyHTML;
    }

    // Show result on Follow Me page only if it exists
    if (checkinBox) {
        checkinBox.innerHTML = emergencyHTML;
    }

    // Update Follow Me status only if it exists
    if (followStatus) {

        followStatus.innerHTML = `
            <div class="metric emergency-box">

                <b class="emergency-title">
                    🚨 EMERGENCY RESPONSE READY
                </b>

                <br><br>

                📍 Location captured

                <br><br>

                👤 Trusted Contact found:
                ${emergencyContact.name}

                <br><br>

                📞 Call your trusted contact immediately.

            </div>
        `;

    }

    speak(
        "Emergency mode is active. " +
        "Your current location has been captured. " +
        "Your trusted contact is " +
        emergencyContact.name +
        ". You can call your trusted contact immediately."
    );

}else {

            // ---------------------------------
            // No trusted contact found
            // ---------------------------------

            const noContactHTML = `
                <div class="metric emergency-box">

                    <b class="emergency-title">
                        🚨 EMERGENCY MODE ACTIVE
                    </b>

                    <br><br>

                    ⚠️ No Trusted Contact was found.

                    <br><br>

                    📍 Your current location has been captured.

                    <br><br>

                    <a
                        href="${locationLink}"
                        target="_blank"
                        style="color:#e4474c;font-weight:bold;"
                    >
                        📍 Open Current Location
                    </a>

                    <br><br>

                    <button
                        class="primary full"
                        onclick="copyEmergencyMessage()"
                    >
                        📋 Copy Emergency Message
                    </button>

                    <br><br>

                    <button
                        class="primary full"
                        onclick="findSafeHaven()"
                    >
                        🛡️ Navigate to Safe Haven
                    </button>

                </div>
            `;


            if (emergencyOutput) {
                emergencyOutput.innerHTML = noContactHTML;
            }

            if (checkinBox) {
                checkinBox.innerHTML = noContactHTML;
            }


            if (followStatus) {

                followStatus.innerHTML = `
                    <div class="metric emergency-box">

                        <b class="emergency-title">
                            ⚠️ TRUSTED CONTACT NOT FOUND
                        </b>

                        <br><br>

                        Your location was captured.

                        <br><br>

                        Add a trusted contact for faster emergency response.

                    </div>
                `;

            }


            speak(
                "I could not find a saved trusted contact. " +
                "Your current location has been captured. " +
                "You can open your location or navigate to a safe place."
            );

        }


    } catch (error) {

        console.error(
            "EMERGENCY ACTIVATION ERROR:",
            error
        );


        const errorHTML = `
            <div class="metric emergency-box">

                <b class="emergency-title">
                    ⚠️ EMERGENCY LOCATION ERROR
                </b>

                <br><br>

                Guardian could not access your current location.

                <br><br>

                Please allow location permission in your browser
                and try again.

            </div>
        `;


        if (emergencyOutput) {
            emergencyOutput.innerHTML = errorHTML;
        }

        if (checkinBox) {
            checkinBox.innerHTML = errorHTML;
        }

        if (followStatus) {
            followStatus.innerHTML = errorHTML;
        }


        speak(
            "I could not access your location. Please allow location permission."
        );


        toast(
            "Location permission is required for emergency assistance."
        );


        // Allow user to activate again
        window.emergencyActive = false;

    }

}
function callEmergencyContact(phone) {

    if (!phone) {
        toast("Emergency contact phone number is not available.");
        return;
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    window.location.href = "tel:" + cleanPhone;
}


function copyEmergencyMessage() {

    const message = window.guardianEmergencyMessage;

    if (!message) {
        toast("Emergency message is not ready yet.");
        return;
    }

    navigator.clipboard.writeText(message)
        .then(() => {
            toast("🚨 Emergency message copied!");
        })
        .catch(() => {
            toast("Could not copy the emergency message.");
        });
}
function sendEmergencySMS(phone) {

    if (!phone) {
        toast("Trusted contact phone number is not available.");
        return;
    }

    const message = window.guardianEmergencyMessage;

    if (!message) {
        toast("Emergency message is not ready yet.");
        return;
    }

    const cleanPhone =
        String(phone).replace(/\D/g, "");

    window.location.href =
        "sms:" +
        cleanPhone +
        "?body=" +
        encodeURIComponent(message);
}


function callEmergencyServices() {

    window.location.href = "tel:112";

}



function startFollow() {
    const seconds = Number($("checkInterval").value) || 30;

    if (followTimer) {
        clearInterval(followTimer);
        followTimer = null;
    }

    followVoiceActive = true;
    window.emergencyActive = false;

    $("followStatus").innerHTML = `
        <div class="metric">
            <b>🛡️ Follow Me is active.</b><br>
            Guardian is checking your safety.
        </div>`;

    function askSafetyQuestion() {
        if (!followVoiceActive || window.emergencyActive) return;

        if (guardianRecognition) {
            try {
                guardianRecognition.abort();
            } catch (e) {}
            guardianRecognition = null;
        }

        speak(
            "Are you safe? Please say I am safe, or say help me.",
            function () {
                if (followVoiceActive && !window.emergencyActive) {
                    startVoiceListening();
                }
            }
        );
    }

    askSafetyQuestion();

    followTimer = setInterval(
        askSafetyQuestion,
        Math.max(10, seconds) * 1000
    );

    toast("Virtual escort started.");
}

function stopFollow() {
    followVoiceActive = false;

    if (followTimer) {
        clearInterval(followTimer);
        followTimer = null;
    }

    if (guardianRecognition) {
        try {
            guardianRecognition.abort();
        } catch (e) {}
        guardianRecognition = null;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    $("followStatus").innerHTML =
        "<div class='metric'>Follow Me stopped.</div>";

    toast("Follow Me stopped.");
}

function checkIn(value) {
    if (value === "safe") {
        handleVoiceResponse("I am safe");
    } else if (value === "help") {
        handleVoiceResponse("I need help");
    }
}

async function loadContacts(){
 if(!token){$("contactsList").innerHTML="<p>Log in to manage your Trusted Circle.</p>";return}
 try{$("contactsList").innerHTML=(await api("/api/contacts")).map(c=>`<div class="listItem"><b>${c.name}</b> — ${c.relation}<br><small>${c.phone}</small><button class="danger" onclick="deleteContact(${c.id})">Remove</button></div>`).join("")||"<p>No contacts yet.</p>"}catch(e){toast(e.message)}
}
async function addContact(){
 if(!requireLogin())return;
 try{await api("/api/contacts",{method:"POST",body:JSON.stringify({name:$("contactName").value,relation:$("contactRelation").value||"Trusted contact",phone:$("contactPhone").value})});toast("Trusted contact added.");$("contactName").value=$("contactRelation").value=$("contactPhone").value="";loadContacts()}catch(e){toast(e.message)}
}
async function deleteContact(id){await api("/api/contacts/"+id,{method:"DELETE"});loadContacts()}
async function loadPlaces() {

    if (!token) {
        $("placesList").innerHTML = `
            <div class="emptyState">
                <h3>🔐 Login Required</h3>
                <p>Please log in to view and manage your saved places.</p>
            </div>
        `;
        return;
    }

    try {

        const places = await api("/api/places");

        if (!places || places.length === 0) {

            $("placesList").innerHTML = `
                <div class="emptyState">
                    <div style="font-size:45px;">📍</div>

                    <h3>No Saved Places Yet</h3>

                    <p>
                        Save your Home, Office, College or other important places
                        for quick and safer navigation.
                    </p>
                </div>
            `;

            return;
        }


        $("placesList").innerHTML = places.map(place => {

            let icon = "📍";

            const label = place.label.toLowerCase();

            if (label === "home") {
                icon = "🏠";
            }
            else if (label === "office") {
                icon = "🏢";
            }
            else if (label === "college") {
                icon = "🎓";
            }
            else if (label.includes("hospital")) {
                icon = "🏥";
            }

            return `

                <div class="savedPlaceCard">

                    <div class="savedPlaceHeader">

                        <div>

                            <div class="placeTitle">
                                ${icon}
                                ${place.label}
                            </div>

                            <div class="placeAddress">
                                ${place.address}
                            </div>

                        </div>

                    </div>


                    <div class="placeActions">

                        <button
                            class="primaryAction"
                            onclick="useSavedPlace(
                                ${place.latitude},
                                ${place.longitude},
                                ${JSON.stringify(place.address)}
                            )"
                        >
                            🧭 Navigate
                        </button>


                        <button
                            class="danger"
                            onclick="deletePlace(${place.id})"
                        >
                            🗑 Delete
                        </button>

                    </div>

                </div>

            `;

        }).join("");

    }
    catch (error) {

        console.error("Error loading places:", error);

        $("placesList").innerHTML = `
            <div class="emptyState">

                <h3>⚠️ Could Not Load Saved Places</h3>

                <p>
                    ${error.message}
                </p>

            </div>
        `;

        toast(error.message);
    }
}



async function savePlace() {

    if (!requireLogin()) return;


    if (!currentDest) {

        toast(
            "Please first select a destination from the map or search."
        );

        return;
    }


    const label =
        $("placeLabel").value.trim();


    const address =
        $("placeAddress").value.trim()
        || currentDest.name;


    if (!label) {

        toast(
            "Please enter a name such as Home, Office or College."
        );

        return;
    }


    try {

        await api(
            "/api/places",
            {
                method: "POST",

                body: JSON.stringify({

                    label: label,

                    address: address,

                    latitude: currentDest.lat,

                    longitude: currentDest.lng

                })
            }
        );


        toast(
            "📍 " + label + " saved successfully!"
        );


        $("placeLabel").value = "";

        $("placeAddress").value = "";


        await loadPlaces();

    }
    catch (error) {

        console.error(
            "Error saving place:",
            error
        );

        toast(
            "Could not save place: "
            + error.message
        );

    }

}



function useSavedPlace(
    latitude,
    longitude,
    address
) {

    selectDestination(
        latitude,
        longitude,
        address
    );


    showPage("navigate");


    toast(
        "Destination selected. You can now start safe navigation."
    );

}



async function deletePlace(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this saved place?"
    );


    if (!confirmed) return;


    try {

        await api(
            "/api/places/" + id,
            {
                method: "DELETE"
            }
        );


        toast(
            "Saved place deleted."
        );


        await loadPlaces();

    }
    catch (error) {

        console.error(
            "Error deleting place:",
            error
        );


        toast(
            error.message
        );

    }

}

async function analyzeReport(){

    if(!requireLogin()){
        return;
    }


    const description =
        $("reportDescription").value.trim();


    if(!description){
        return toast(
            "Please describe what happened before using Guardian AI."
        );
    }


    if(description.length < 10){
        return toast(
            "Please provide a little more detail about the incident."
        );
    }


    if(!currentPos){

    $("reportLocationInfo").textContent =
        "📍 Getting your current location...";

    try{

        const position = await new Promise(
            (resolve, reject) => {

                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 30000
                    }
                );

            }
        );

        currentPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        $("reportLocationInfo").textContent =
            "📍 Current incident location detected.";

    }
    catch(error){

        $("reportLocationInfo").textContent =
            "⚠️ Location unavailable. Analysis can still continue.";

        console.warn(
            "Location unavailable:",
            error.message
        );

    }

}

    const analyzeButton =
        $("analyzeReportBtn");


    $("reportAiLoading").style.display =
        "block";


    $("reportAiResult").style.display =
        "none";


    analyzeButton.disabled =
        true;


    analyzeButton.textContent =
        "🤖 Guardian AI is analyzing...";


    try{

        const result =
            await api(
                "/api/reports/analyze",
                {
                    method:"POST",

                    body:JSON.stringify({

                        description:description,

                        latitude:currentPos.lat,

                        longitude:currentPos.lng

                    })
                }
            );


        $("aiSuggestedCategory").textContent =
            result.category;


        $("aiSuggestedSeverity").textContent =
            result.severity + " / 5";


        $("aiRiskLevel").textContent =
            result.risk_level;


        $("aiConfidence").textContent =
            result.confidence + "%";


        $("aiReason").textContent =
            result.reason;


        $("aiRecommendation").textContent =
            result.recommendation;


        $("reportAiResult").style.display =
            "block";


        $("reportVerificationCard").style.display =
            "block";


        /*
        Automatically put Guardian AI's
        suggestions into the final report.
        */


        const categorySelect =
            $("reportCategory");


        for(
            const option
            of categorySelect.options
        ){

            if(
                option.value.toLowerCase()
                ===
                result.category.toLowerCase()
            ){

                categorySelect.value =
                    option.value;

                break;

            }

        }


        $("reportSeverity").value =
            String(result.severity);


        toast(
            "Guardian AI analysis completed. Review and confirm the report."
        );

    }


    catch(error){

        console.error(
            "Guardian AI analysis error:",
            error
        );


        toast(
            error.message ||
            "Guardian AI could not analyze this report."
        );

    }


    finally{

        $("reportAiLoading").style.display =
            "none";


        analyzeButton.disabled =
            false;


        analyzeButton.textContent =
            "✨ Analyze with Guardian AI";

    }

}
function handleReportEvidence(files) {

    reportEvidenceFiles = Array.from(files || []);

    const preview = $("evidencePreview");

    if (!preview) return;

    if (reportEvidenceFiles.length === 0) {
        preview.innerHTML = "";
        return;
    }

    preview.innerHTML = reportEvidenceFiles.map((file, index) => {

        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

        return `
            <div class="evidence-item">
                <span>
                    📎 ${file.name}
                    <small>(${sizeMB} MB)</small>
                </span>

                <button
                    type="button"
                    onclick="removeReportEvidence(${index})">
                    ✕
                </button>
            </div>
        `;

    }).join("");
}

function removeReportEvidence(index) {

    reportEvidenceFiles.splice(index, 1);

    const preview = $("evidencePreview");

    if (!preview) return;

    preview.innerHTML = reportEvidenceFiles.map((file, i) => {

        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

        return `
            <div class="evidence-item">
                <span>
                    📎 ${file.name}
                    <small>(${sizeMB} MB)</small>
                </span>

                <button
                    type="button"
                    onclick="removeReportEvidence(${i})">
                    ✕
                </button>
            </div>
        `;

    }).join("");
}

async function submitReport() {

    if (!requireLogin()) return;

    if (!currentPos) {
        return toast("Use your current location first.");
    }

    const description =
        $("reportDescription").value.trim();

    if (!description) {
        return toast("Please describe what happened.");
    }

    // ------------------------------------------
    // CONFIDENTIAL REPORT DATA
    // ------------------------------------------

    const formData = new FormData();

    formData.append(
        "category",
        $("reportCategory").value
    );

    formData.append(
        "severity",
        $("reportSeverity").value
    );

    formData.append(
        "description",
        description
    );

    formData.append(
        "latitude",
        currentPos.lat
    );

    formData.append(
        "longitude",
        currentPos.lng
    );

    // Mark this as a confidential safety report
    formData.append(
        "confidential",
        "true"
    );

    // ------------------------------------------
    // ATTACH EVIDENCE
    // ------------------------------------------

    reportEvidenceFiles.forEach(file => {

        formData.append(
            "evidence",
            file
        );

    });

    // ------------------------------------------
    // SUBMIT
    // ------------------------------------------

    try {

        const response = await fetch(
            "/api/reports",
            {
                method: "POST",

                headers: token
                    ? {
                        "Authorization":
                            "Bearer " + token
                    }
                    : {},

                body: formData
            }
        );

        const data =
            await response.json().catch(() => ({}));

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Could not submit confidential report."
            );

        }

        toast(
            data.message ||
            "🔒 Confidential safety report submitted."
        );

        // ------------------------------------------
        // CLEAR FORM
        // ------------------------------------------

        $("reportDescription").value = "";

        reportEvidenceFiles = [];

        const evidenceInput =
            $("reportEvidence");

        if (evidenceInput) {
            evidenceInput.value = "";
        }

        const evidencePreview =
            $("evidencePreview");

        if (evidencePreview) {
            evidencePreview.innerHTML = "";
        }

        loadReports();
        loadMyConfidentialReports();

    } catch (error) {

        console.error(
            "Confidential report submission error:",
            error
        );

        toast(
            error.message ||
            "Could not submit the report."
        );
    }
}
async function loadReports(){
    try {
        const rows = await api("/api/reports");

        reportLayer.clearLayers();

        // Only show non-confidential reports publicly
        const publicReports = rows.filter(r => !r.confidential);

        $("reportFeed").innerHTML =
            publicReports.map(r => `
                <div class="reportItem">
                    <b>${escapeHtml(r.category)}</b>
                    • Severity ${r.severity}
                    <br>
                    <small>${escapeHtml(r.description)}</small>
                </div>
            `).join("") ||
            "<p>No public safety reports yet.</p>";

        publicReports.forEach(r => {
            L.circleMarker(
                [r.latitude, r.longitude],
                {
                    radius: 7,
                    color: "#e4474c"
                }
            )
            .bindPopup(`
                <b>${escapeHtml(r.category)}</b>
                <br>
                ${escapeHtml(r.description)}
            `)
            .addTo(reportLayer);
        });

        $("pulseBox").textContent =
            publicReports.length
                ? Math.max(45, 92 - publicReports.length * 4) + "/100"
                : "92/100";

        $("pulseText").textContent =
            publicReports.length
                ? `${publicReports.length} public safety reports currently contribute to community advisory signals.`
                : "No public safety reports in the project database.";

    } catch(e) {
        console.error("Report loading error:", e);
        toast(e.message);
    }
}
async function loadMyConfidentialReports() {
    if (!token) return;

    try {
        const rows = await api("/api/reports/my-confidential");

        const box = $("myConfidentialReports");

        if (!box) return;

        if (!rows.length) {
            box.innerHTML = `
                <div class="metric">
                    No confidential reports submitted yet.
                </div>
            `;
            return;
        }

        box.innerHTML = rows.map(r => `
            <div class="reportItem">
                <strong>🔒 ${escapeHtml(r.category)}</strong>

                <br>
                <small>
                    Severity: ${r.severity}/5
                </small>

                <br>
                <small>
                    Status:
                    <b>${escapeHtml(r.review_status || "Pending")}</b>
                </small>

                <br>
                <small>
                    Evidence:
                    ${r.evidence_uploaded ? "📎 Attached" : "No evidence"}
                </small>

                <br>
                <small>
                    Submitted:
                    ${new Date(r.created_at).toLocaleString()}
                </small>
            </div>
        `).join("");

    } catch (error) {
        console.error("Confidential reports error:", error);
        toast("Could not load your confidential reports.");
    }
}
/*async function askAI(){
 const q=$("aiQuestion").value.trim();if(!q)return;
 $("chatMessages").innerHTML+=`<div class="userMsg">${escapeHtml(q)}</div>`;$("aiQuestion").value="";
 try{const d=await api("/api/ai/chat",{method:"POST",body:JSON.stringify({question:q,route:currentRoute})});$("chatMessages").innerHTML+=`<div class="aiMsg">${escapeHtml(d.answer)}</div>`;if(d.action==="safe_haven")findSafeHaven()}catch(e){toast(e.message)}
}*/
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
async function startWorkSession(){
 if(!$("shiftTime").value)toast("Add your expected departure time for better planning.");
 showPage("follow");startFollow();toast("Late-shift safety session started.");
}
function rideCheck(){
 const cab=$("cabNumber").value.trim(),driver=$("driverName").value.trim();
 $("rideOutput").innerHTML=`<div class="metric"><b>Demo ride verification</b><br>${cab?"Cab: "+cab:"Cab number not entered"}<br>${driver?"Driver: "+driver:"Driver name not entered"}<br>Share journey details with a trusted contact before travelling. This project does not claim real verification without an official data source.</div>`;
}
function workCheckin(){$("workOutput").innerHTML="<div class='metric'>Arrival check-in started for this browser session. Use Follow Me for periodic checks.</div>";showPage("follow")}
async function loadAnalytics(){
 if(!token){$("analyticsGrid").innerHTML="<div class='stat'>Log in to see your private analytics.</div>";return}
 try{const d=await api("/api/analytics");$("analyticsGrid").innerHTML=`<div class="stat">Total trips<b>${d.total_trips}</b></div><div class="stat">Average safety<b>${d.average_safety_score||"--"}</b></div><div class="stat">Night trips<b>${d.night_trips}</b></div><div class="stat">Emergency reports<b>${d.emergency_reports}</b></div>`}catch(e){toast(e.message)}
}
async function saveCurrentTrip(){
 if(!token||!currentRoute||!currentDest||!currentPos)return;
 try{await api("/api/trips",{method:"POST",body:JSON.stringify({destination_name:currentDest.name,origin_lat:currentPos.lat,origin_lng:currentPos.lng,destination_lat:currentDest.lat,destination_lng:currentDest.lng,safety_score:currentRoute.safety_score,distance_km:currentRoute.distance_km,duration_min:currentRoute.duration_min,status:"completed"})})}catch{}
}
async function saveSettings(){
 if(!requireLogin())return;
 try{const d=await api("/api/settings",{method:"PUT",body:JSON.stringify({safety_mode:$("safetyToggle").checked,dark_mode:$("darkToggle").checked})});applyDark(d.dark_mode);toast("Settings saved.")}catch(e){toast(e.message)}
}
function applyDark(on){document.body.classList.toggle("dark",!!on);$("darkToggle").checked=!!on}
function clearLocalSession() {
    localStorage.removeItem("guardian_token");

    token = null;
    currentUser = null;

    updateProfile();

    toast("You have been logged out.");
}


function openAuth() {

    // If already logged in, don't show login again
    if (token && currentUser) {
        toast("You are already logged in as " + currentUser.name + ".");
        return;
    }

    authTab("login");

    $("authModal").classList.remove("hidden");
}


function closeAuth() {
    $("authModal").classList.add("hidden");
}


function authTab(type) {

    $("loginTab").classList.toggle(
        "selected",
        type === "login"
    );

    $("registerTab").classList.toggle(
        "selected",
        type === "register"
    );


    if (type === "login") {

        $("authForm").innerHTML = `

            <input
                id="authEmail"
                placeholder="Email address"
                type="email"
                autocomplete="email"
            >

            <input
                id="authPassword"
                placeholder="Password"
                type="password"
                autocomplete="current-password"
            >

            <button
                id="authSubmitButton"
                class="primary full"
                onclick="submitAuth('login')"
            >
                Login
            </button>

        `;

    }

    else {

        $("authForm").innerHTML = `

            <input
                id="authName"
                placeholder="Full name"
                type="text"
                autocomplete="name"
            >

            <input
                id="authEmail"
                placeholder="Email address"
                type="email"
                autocomplete="email"
            >

            <input
                id="authPassword"
                placeholder="Password (minimum 6 characters)"
                type="password"
                autocomplete="new-password"
            >

            <button
                id="authSubmitButton"
                class="primary full"
                onclick="submitAuth('register')"
            >
                Create Account
            </button>

        `;
    }
}


async function submitAuth(type) {

    const email = $("authEmail").value.trim().toLowerCase();
    const password = $("authPassword").value;


    // ----------------------------
    // FRONTEND VALIDATION
    // ----------------------------

    if (!email) {
        toast("Please enter your email address.");
        return;
    }


    if (!email.includes("@")) {
        toast("Please enter a valid email address.");
        return;
    }


    if (!password) {
        toast("Please enter your password.");
        return;
    }


    if (type === "register") {

        const name = $("authName").value.trim();

        if (!name) {
            toast("Please enter your full name.");
            return;
        }


        if (password.length < 6) {
            toast("Password must contain at least 6 characters.");
            return;
        }
    }


    // ----------------------------
    // PREVENT DOUBLE CLICK
    // ----------------------------

    const button = $("authSubmitButton");

    if (button) {
        button.disabled = true;

        button.textContent =
            type === "login"
                ? "Logging in..."
                : "Creating account...";
    }


    try {

        let body;


        if (type === "login") {

            body = {
                email: email,
                password: password
            };

        }

        else {

            body = {
                name: $("authName").value.trim(),
                email: email,
                password: password
            };

        }


        const data = await api(
            "/api/auth/" + type,
            {
                method: "POST",
                body: JSON.stringify(body)
            }
        );


        // ----------------------------
        // SAVE SESSION
        // ----------------------------

        token = data.token;

        localStorage.setItem(
            "guardian_token",
            token
        );


        currentUser = data.user;


        updateProfile();


        closeAuth();


        toast(
            type === "login"
                ? "Welcome back, " + currentUser.name + "!"
                : "Account created successfully. Welcome, " + currentUser.name + "!"
        );


        // Load user's private data
        loadContacts();
        loadPlaces();
        loadAnalytics();


    }

    catch (error) {

        console.error(
            "Authentication error:",
            error
        );


        const message =
            error.message ||
            "Something went wrong. Please try again.";


        // ----------------------------
        // FRIENDLY ERROR HANDLING
        // ----------------------------

        if (
            type === "register" &&
            message.toLowerCase().includes("already registered")
        ) {

            toast(
                "This email already has an account. Please log in instead."
            );

            authTab("login");

            setTimeout(() => {

                $("authEmail").value = email;

            }, 50);

        }

        else {

            toast(message);

        }

    }

    finally {

        const submitButton =
            $("authSubmitButton");

        if (submitButton) {

            submitButton.disabled = false;

            submitButton.textContent =
                type === "login"
                    ? "Login"
                    : "Create Account";

        }

    }
}


function updateProfile() {

    if (currentUser) {

        $("profileName").textContent =
            currentUser.name;

        $("profileEmail").textContent =
            currentUser.email;

        $("avatar").textContent =
            currentUser.name
                .charAt(0)
                .toUpperCase();

    }

    else {

        $("profileName").textContent =
            "Guest";

        $("profileEmail").textContent =
            "Log in to save your safety data";

        $("avatar").textContent =
            "G";

    }
}


async function restoreSession() {

    // No saved session
    if (!token) {

        currentUser = null;

        updateProfile();

        return;
    }


    try {

        // Verify token with backend
        currentUser =
            await api("/api/auth/me");


        updateProfile();


        if (currentUser.safety_mode !== undefined) {

            $("safetyToggle").checked =
                currentUser.safety_mode;

        }


        if (currentUser.dark_mode !== undefined) {

            applyDark(
                currentUser.dark_mode
            );

        }


        // Load private data only after
        // the user is successfully restored
        loadContacts();
        loadPlaces();


    }

    catch (error) {

        console.log(
            "Session expired or invalid."
        );


        localStorage.removeItem(
            "guardian_token"
        );


        token = null;

        currentUser = null;


        updateProfile();

    }
}
window.addEventListener("beforeunload",saveCurrentTrip);
initMap();restoreSession();
// ==========================================
// 📹 CCTV LEGEND TOGGLE
// ==========================================

const cctvLegend = document.getElementById("cctvLegend");
const cctvLegendToggle = document.getElementById("cctvLegendToggle");

if (cctvLegend && cctvLegendToggle) {

    cctvLegendToggle.addEventListener("click", function () {

        cctvLegend.classList.toggle("collapsed");

        if (cctvLegend.classList.contains("collapsed")) {

            cctvLegendToggle.textContent = "›";
            cctvLegendToggle.setAttribute(
                "aria-label",
                "Show CCTV information"
            );

        } else {

            cctvLegendToggle.textContent = "‹";
            cctvLegendToggle.setAttribute(
                "aria-label",
                "Hide CCTV information"
            );

        }

    });

}


document.addEventListener("DOMContentLoaded", () => { 
    const analyzeButton = document.getElementById("analyzeReportBtn"); 
 
    if (analyzeButton) { 
        analyzeButton.addEventListener("click", () => { 
            console.log("Guardian AI button clicked"); 
            analyzeReport(); 
        }); 
    } 
});

// ==========================================
// 🚨 SILENT SOS - MOBILE + PC
// Works even when Emergency page loads dynamically
// ==========================================

document.addEventListener("pointerdown", function (event) {

    const sosButton = event.target.closest("#silentSOSButton");

    if (!sosButton) {
        return;
    }

    // PC: activate immediately on mouse press
    if (event.pointerType === "mouse") {
        return;
    }

    event.preventDefault();

    sosButton.dataset.sosHolding = "true";
    sosButton.innerHTML = "🚨 KEEP HOLDING...";

    const sosStatus =
        document.getElementById("sosHoldStatus");

    if (sosStatus) {
        sosStatus.innerText =
            "Keep holding... SOS will activate";
    }

    sosButton._sosTimer = setTimeout(function () {

        if (sosButton.dataset.sosHolding !== "true") {
            return;
        }

        sosButton.dataset.sosHolding = "activated";

        sosButton.innerHTML =
            "🚨 SOS ACTIVATED";

        if (sosStatus) {
            sosStatus.innerText =
                "Emergency assistance is starting...";
        }

        console.log("🚨 MOBILE SOS ACTIVATED");

        activateVoiceEmergency(true);

    }, 3000);

});


document.addEventListener("pointerup", function (event) {

    const sosButton = event.target.closest("#silentSOSButton");

    if (!sosButton) {
        return;
    }

    // PC: single click
    if (event.pointerType === "mouse") {

        if (sosButton.dataset.sosActivated === "true") {
            return;
        }

        sosButton.dataset.sosActivated = "true";

        sosButton.innerHTML =
            "🚨 SOS ACTIVATED";

        const sosStatus =
            document.getElementById("sosHoldStatus");

        if (sosStatus) {
            sosStatus.innerText =
                "Emergency assistance is starting...";
        }

        console.log("🚨 PC SOS CLICKED");

        activateVoiceEmergency(true);

        return;
    }


    // Mobile release
    if (sosButton._sosTimer) {

        clearTimeout(sosButton._sosTimer);

        sosButton._sosTimer = null;
    }

    if (sosButton.dataset.sosHolding === "activated") {
        return;
    }

    sosButton.dataset.sosHolding = "false";

    sosButton.innerHTML =
        "🚨 SOS — HOLD / CLICK";

    const sosStatus =
        document.getElementById("sosHoldStatus");

    if (sosStatus) {
        sosStatus.innerText =
            "Mobile: press and hold for 3 seconds | PC: click once";
    }

});


document.addEventListener("pointercancel", function (event) {

    const sosButton = event.target.closest("#silentSOSButton");

    if (!sosButton) {
        return;
    }

    if (sosButton._sosTimer) {

        clearTimeout(sosButton._sosTimer);

        sosButton._sosTimer = null;
    }

    sosButton.dataset.sosHolding = "false";

    sosButton.innerHTML =
        "🚨 SOS — HOLD / CLICK";

});

function enterDyuta() {
    const landingPage = document.getElementById("landingPage");

    if (landingPage) {
        landingPage.classList.add("landingHidden");
    }
}

    // ==========================================
    // DYUTA: CONTEXTUAL SAFETY DEMO
    // ==========================================

    function updateDyutaThreatCard() {
        const timeSelect = $("dyutaDemoTime");
        const card = $("dyutaThreatCard");

        if (!timeSelect || !card) return;

        const lateNight = Number(timeSelect.value) >= 23;

        if (lateNight) {
            card.style.background = "#fee2e2";
            card.style.color = "#991b1b";

            card.innerHTML = `
                <b>🌙 Late-night risk indicator</b><br>
                Sample scenario: low foot traffic and possible
                poor lighting.<br>
                <b>Suggestion:</b> Compare a main-road route and
                check available local information.
            `;
        } else {
            card.style.background = "#fef3c7";
            card.style.color = "#92400e";

            card.innerHTML = `
                <b>👥 Busy-market risk indicator</b><br>
                Sample scenario: heavy crowd. Crowds may increase
                the risk of pickpocketing or unwanted contact.<br>
                <b>Suggestion:</b> Keep belongings secure and
                stay aware of your surroundings.
            `;
        }
    }

    // ==========================================
    // DYUTA: NEAREST SAMPLE SAFE HAVEN
    // ==========================================

    function updateDyutaSafetyRadar() {
        const output = $("dyutaNearestHaven");

        if (!output) return;

        if (!currentPos) {
            output.innerHTML = `
                <b>📍 Nearest Safe Haven</b><br>
                Select Use My Location or use the demo location
                to calculate distances.
            `;
            return;
        }

        const places = window.dyutaSafeHavens || [];

        if (!places.length) {
            output.textContent = "No sample Safe Havens configured.";
            return;
        }

        let nearest = null;
        let nearestDistance = Infinity;

        places.forEach(place => {
            const distanceKm = haversineDistanceKm(
                currentPos.lat,
                currentPos.lng,
                place.lat,
                place.lng
            );

            if (distanceKm < nearestDistance) {
                nearestDistance = distanceKm;
                nearest = place;
            }
        });

        if (!nearest) return;

        const distanceMeters = Math.round(nearestDistance * 1000);

        output.innerHTML = `
            <b>🛟 Nearest Sample Safe Haven</b><br>
            ${nearest.name}<br>
            Approximate straight-line distance:
            <b>${distanceMeters} m</b><br>
            <small>Not walking distance or a verified open facility.</small>
        `;
    }
