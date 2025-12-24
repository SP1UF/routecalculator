// 1. INICJALIZACJA I WYKRYWANIE PLATFORMY
window.onload = function() {
    checkPlatform();
    
    // Inicjalizacja mapy po załadowaniu
    initMap();
};

function checkPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPhone|iPad|iPod/.test(userAgent) && !window.MSStream;

    // PODWÓJNE SPRAWDZANIE "INSTALACJI"
    // 1. Stara metoda (dla starszych iOS)
    const isStandaloneLegacy = window.navigator.standalone === true;
    // 2. Nowa metoda (dla nowych iOS)
    const isStandaloneModern = window.matchMedia('(display-mode: standalone)').matches;
    
    // Jeśli spełniony jest którykolwiek warunek, uznajemy że jest zainstalowana
    const isApp = isStandaloneLegacy || isStandaloneModern;

    const guide = document.getElementById('install-guide');
    const app = document.getElementById('app-content');

    // Logika: Pokaż instrukcję TYLKO jeśli to iOS i NIE jest zainstalowane (nie jest App)
    if (isIOS && !isApp) {
        guide.classList.remove('hidden'); // Pokaż instrukcję
        app.classList.add('hidden');      // Ukryj apkę
    } else {
        // W każdym innym przypadku (Android, PC, lub ZAINSTALOWANE na iOS)
        guide.classList.add('hidden');    // Ukryj instrukcję
        app.classList.remove('hidden');   // Pokaż apkę
    }
}

// 2. MAPA
let map;
let routeLayer = null;

function initMap() {
    map = L.map('map').setView([52.0693, 19.4803], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// --- PODPOWIEDZI MIAST (AUTOCOMPLETE) ---

const startInput = document.getElementById('startCity');
const endInput = document.getElementById('endCity');

async function searchCities(query, listElement, inputElement) {
    if (query.length < 3) {
        listElement.style.display = 'none';
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=pl&addressdetails=1&limit=5`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        listElement.innerHTML = ''; 

        if (data.length > 0) {
            listElement.style.display = 'block';
            
            data.forEach(place => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';

                // Nazwa miasta
                const city = place.address.city || place.address.town || place.address.village || place.name;
                
                // Powiat i Województwo
                const county = place.address.county || ''; 
                const state = place.address.state || '';

                let detailText = '';
                if (county && !city.includes(county)) {
                    detailText = `(${county})`; 
                } else if (state) {
                    detailText = `(${state})`;
                }

                div.innerHTML = `<strong>${city}</strong> <span class="suggestion-detail">${detailText}</span>`;

                div.onclick = () => {
                    inputElement.value = city;
                    listElement.style.display = 'none';
                };

                listElement.appendChild(div);
            });
        } else {
            listElement.style.display = 'none';
        }

    } catch (error) {
        console.error("Błąd API:", error);
    }
}

let timeoutId;
function handleInput(e, listId, inputId) {
    clearTimeout(timeoutId);
    const list = document.getElementById(listId);
    const input = document.getElementById(inputId);
    timeoutId = setTimeout(() => { searchCities(e.target.value, list, input); }, 300);
}

startInput.addEventListener('input', (e) => handleInput(e, 'suggestions-start', 'startCity'));
endInput.addEventListener('input', (e) => handleInput(e, 'suggestions-end', 'endCity'));

document.addEventListener('click', (e) => {
    if (e.target !== startInput) document.getElementById('suggestions-start').style.display = 'none';
    if (e.target !== endInput) document.getElementById('suggestions-end').style.display = 'none';
});

// --- OBLICZANIE TRASY ---

document.getElementById('searchRouteBtn').addEventListener('click', calculateRoute);
document.getElementById('calculateBtn').addEventListener('click', calculateCost);

async function calculateRoute() {
    const start = startInput.value;
    const end = endInput.value;

    if (!start || !end) { alert("Wpisz obie miejscowości!"); return; }

    const coordsStart = await getCoords(start);
    const coordsEnd = await getCoords(end);

    if (!coordsStart || !coordsEnd) { alert("Nie znaleziono miejscowości."); return; }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStart.lon},${coordsStart.lat};${coordsEnd.lon},${coordsEnd.lat}?overview=full&geometries=geojson`;
    
    try {
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code !== 'Ok') { alert("Błąd trasy."); return; }

        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        
        document.getElementById('distance').value = distanceKm;

        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(route.geometry, { style: { color: 'blue', weight: 5 } }).addTo(map);
        map.fitBounds(routeLayer.getBounds());

        document.getElementById('navButtons').classList.remove('hidden');
        window.googleMapsLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&travelmode=driving`;

    } catch (error) { alert("Błąd mapy."); }
}

async function getCoords(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${city}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
}

function openNav(type) {
    if (type === 'google' && window.googleMapsLink) window.location.href = window.googleMapsLink;
}

function calculateCost() {
    let dist = parseFloat(document.getElementById('distance').value);
    const consumption = parseFloat(document.getElementById('consumption').value);
    const price = parseFloat(document.getElementById('fuelPrice').value);
    const rate = parseFloat(document.getElementById('ratePerKm').value);
    const isRoundTrip = document.getElementById('roundTrip').checked;

    if (!dist || !consumption || !price || !rate) return;

    if (isRoundTrip) dist *= 2;

    const fuelNeeded = (dist * consumption) / 100;
    const fuelCostValue = fuelNeeded * price;
    const totalServiceCost = dist * rate;
    const profit = totalServiceCost - fuelCostValue;

    document.getElementById('totalPrice').innerText = totalServiceCost.toFixed(2);
    document.getElementById('marginProfit').innerText = profit.toFixed(2);
    document.getElementById('fuelCost').innerText = fuelCostValue.toFixed(2);
    document.getElementById('totalDist').innerText = dist.toFixed(1);

    document.getElementById('result').classList.remove('hidden');
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
}