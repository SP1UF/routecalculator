// ZMIENNE GLOBALNE
let selectedStart = null;
let selectedEnd = null;
let isIOSDevice = false;

window.onload = function() {
    checkPlatform();
    initMap();
    
    // NAPRAWA BŁĘDU GRAFICZNEGO PO POWROCIE NA IPHONE
    // Wymusza przewinięcie na górę i ponowne sprawdzenie widoku
    window.addEventListener('pageshow', function(event) {
        checkPlatform();
        window.scrollTo(0, 0);
    });
};

function checkPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    isIOSDevice = /iPhone|iPad|iPod/.test(userAgent) && !window.MSStream;

    const isStandaloneLegacy = window.navigator.standalone === true;
    const isStandaloneModern = window.matchMedia('(display-mode: standalone)').matches;
    const isApp = isStandaloneLegacy || isStandaloneModern;

    const guide = document.getElementById('install-guide');
    const app = document.getElementById('app-content');

    // Instrukcja tylko dla iPhone w przeglądarce Safari
    if (isIOSDevice && !isApp) {
        if(guide) guide.classList.remove('hidden');
        if(app) app.classList.add('hidden');
    } else {
        if(guide) guide.classList.add('hidden');
        if(app) app.classList.remove('hidden');
    }
}

// MAPA
let map;
let routeLayer = null;

function initMap() {
    map = L.map('map').setView([52.0693, 19.4803], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// PODPOWIEDZI (AUTOCOMPLETE)
const startInput = document.getElementById('startCity');
const endInput = document.getElementById('endCity');

async function searchCities(query, listElement, inputElement, isStart) {
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

                const city = place.address.city || place.address.town || place.address.village || place.name;
                const county = place.address.county || ''; 
                const state = place.address.state || '';

                let detailText = '';
                if (county && !city.includes(county)) detailText = `(${county})`; 
                else if (state) detailText = `(${state})`;

                div.innerHTML = `<strong>${city}</strong> <span class="suggestion-detail">${detailText}</span>`;

                div.onclick = () => {
                    inputElement.value = `${city} ${detailText}`;
                    
                    // ZAPISUJEMY WSPÓŁRZĘDNE (Naprawa błędu Węgier)
                    const exactCoords = { lat: place.lat, lon: place.lon };
                    
                    if (isStart) selectedStart = exactCoords;
                    else selectedEnd = exactCoords;

                    listElement.style.display = 'none';
                };

                listElement.appendChild(div);
            });
        } else {
            listElement.style.display = 'none';
        }
    } catch (error) { console.error(error); }
}

// Obsługa inputów
let timeoutId;
function handleInput(e, listId, inputId, isStart) {
    clearTimeout(timeoutId);
    if (isStart) selectedStart = null;
    else selectedEnd = null;

    const list = document.getElementById(listId);
    const input = document.getElementById(inputId);
    timeoutId = setTimeout(() => { searchCities(e.target.value, list, input, isStart); }, 300);
}

startInput.addEventListener('input', (e) => handleInput(e, 'suggestions-start', 'startCity', true));
endInput.addEventListener('input', (e) => handleInput(e, 'suggestions-end', 'endCity', false));

document.addEventListener('click', (e) => {
    if (e.target !== startInput) document.getElementById('suggestions-start').style.display = 'none';
    if (e.target !== endInput) document.getElementById('suggestions-end').style.display = 'none';
});

// OBLICZANIE TRASY
document.getElementById('searchRouteBtn').addEventListener('click', calculateRoute);
document.getElementById('calculateBtn').addEventListener('click', calculateCost);

async function calculateRoute() {
    let p1 = selectedStart;
    let p2 = selectedEnd;

    // Fallback gdyby ktoś wpisał ręcznie
    if (!p1 && startInput.value) p1 = await getCoordsFallback(startInput.value);
    if (!p2 && endInput.value) p2 = await getCoordsFallback(endInput.value);

    if (!p1 || !p2) {
        alert("Wybierz miejscowości z listy!");
        return;
    }

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${p1.lon},${p1.lat};${p2.lon},${p2.lat}?overview=full&geometries=geojson`;
    
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

        // Generuj przyciski (Google, Apple, Yanosik)
        generateMapButtons(p1, p2);

    } catch (error) { alert("Błąd połączenia."); }
}

// --- LINKI DO MAP I YANOSIKA ---
function generateMapButtons(start, end) {
    const navDiv = document.getElementById('navButtons');
    navDiv.innerHTML = ''; 
    navDiv.classList.remove('hidden');

    // 1. GOOGLE MAPS (Link typu "dir" = nawigacja)
    const googleLink = `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}&destination=${end.lat},${end.lon}&travelmode=driving`;
    
    // 2. APPLE MAPS (Link typu "saddr/daddr" = nawigacja)
    const appleLink = `http://maps.apple.com/?saddr=${start.lat},${start.lon}&daddr=${end.lat},${end.lon}&dirflg=d`;

    // 3. YANOSIK
    // Android: Próba wymuszenia Intentu
    // iOS: Otwarcie aplikacji przez URL scheme (yanosik://)
    let yanosikLink = "#";
    if (isIOSDevice) {
        yanosikLink = "yanosik://";
    } else {
        // Android Intent - próbuje uruchomić Yanosika
        yanosikLink = `intent://#Intent;scheme=yanosik;package=pl.neptis.yanosik.mobi.android;end`; 
    }

    // -- TWORZENIE PRZYCISKÓW --

    // Google Maps
    const btnGoogle = document.createElement('button');
    btnGoogle.className = 'nav-btn google';
    btnGoogle.innerText = 'Google Maps ↗';
    btnGoogle.onclick = () => window.open(googleLink, '_blank');
    navDiv.appendChild(btnGoogle);

    // Apple Maps (Tylko iOS)
    if (isIOSDevice) {
        const btnApple = document.createElement('button');
        btnApple.className = 'nav-btn apple'; 
        btnApple.innerText = 'Apple Maps ↗';
        btnApple.onclick = () => window.location.href = appleLink;
        navDiv.appendChild(btnApple);
    }

    // Yanosik (Wszędzie)
    const btnYanosik = document.createElement('button');
    btnYanosik.className = 'nav-btn yanosik';
    btnYanosik.innerText = 'Yanosik ↗';
    // Dodajemy obsługę błędu (gdyby nie było Yanosika)
    btnYanosik.onclick = () => {
        window.location.href = yanosikLink;
        // Opcjonalnie: setTimeout(() => alert("Nie znaleziono Yanosika"), 2000);
    };
    navDiv.appendChild(btnYanosik);
}

async function getCoordsFallback(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${city}&countrycodes=pl&limit=1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) { return null; }
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