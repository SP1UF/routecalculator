// ZMIENNE GLOBALNE
let selectedStart = null;
let selectedEnd = null;
let isIOSDevice = false;

window.onload = function() {
    checkPlatform();
    initMap();
    
    // ZABEZPIECZENIE PRZED BIAŁYM EKRANEM PO POWROCIE
    window.addEventListener('pageshow', function(event) {
        // Jeśli strona została załadowana z cache (powrót przyciskiem wstecz)
        if (event.persisted) {
            checkPlatform();
            window.scrollTo(0, 0);
        }
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

                // To co widzimy na liście
                div.innerHTML = `<strong>${city}</strong> <span class="suggestion-detail">${detailText}</span>`;

                div.onclick = () => {
                    // 1. Wpisujemy PEŁNĄ NAZWĘ do pola (np. "Dobra (powiat łobeski)")
                    // To jest kluczowe - ta nazwa pójdzie do Google Maps!
                    inputElement.value = `${city} ${detailText}`;
                    
                    // 2. Zapisujemy współrzędne dla OSRM (żeby wyliczyć kilometry wewnątrz apki)
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

    // Fallback dla wpisywania ręcznego
    if (!p1 && startInput.value) p1 = await getCoordsFallback(startInput.value);
    if (!p2 && endInput.value) p2 = await getCoordsFallback(endInput.value);

    if (!p1 || !p2) {
        alert("Wybierz miejscowości z listy!");
        return;
    }

    // OSRM (liczenie km) nadal używa współrzędnych - to jest OK
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

        // Generuj przyciski (Tutaj jest zmiana logiczna!)
        generateMapButtons();

    } catch (error) { alert("Błąd połączenia."); }
}

// --- LINKI DO MAP I YANOSIKA (POPRAWIONE) ---
function generateMapButtons() {
    const navDiv = document.getElementById('navButtons');
    navDiv.innerHTML = ''; 
    navDiv.classList.remove('hidden');

    // Pobieramy TEKST z pól (np. "Dobra (powiat łobeski)")
    // Dzięki temu Google Maps dostanie nazwę, a nie cyferki.
    // A dzięki dopiskowi w nawiasie, nie pomyli z Węgrami.
    const startName = encodeURIComponent(startInput.value);
    const endName = encodeURIComponent(endInput.value);

    // 1. GOOGLE MAPS (Otwieramy po nazwie)
    // api=1 & origin=NAZWA & destination=NAZWA
    const googleLink = `https://www.google.com/maps/dir/?api=1&origin=${startName}&destination=${endName}&travelmode=driving`;
    
    // 2. APPLE MAPS (Otwieramy po nazwie)
    const appleLink = `http://maps.apple.com/?saddr=${startName}&daddr=${endName}&dirflg=d`;

    // 3. YANOSIK (Tu musimy użyć współrzędnych, bo Yanosik słabo radzi sobie z nazwami z zewnątrz)
    // Ale Yanosik to mniejszy problem wizualny.
    let yanosikLink = "#";
    if (selectedEnd) {
        if (isIOSDevice) {
            yanosikLink = "yanosik://"; // iOS nie pozwala łatwo wyznaczyć trasy z linku w Yanosiku
        } else {
             // Android Intent
            yanosikLink = `intent://#Intent;scheme=yanosik;package=pl.neptis.yanosik.mobi.android;end`; 
        }
    }

    // -- TWORZENIE PRZYCISKÓW --

    // Google Maps
    const btnGoogle = document.createElement('button');
    btnGoogle.className = 'nav-btn google';
    btnGoogle.innerText = 'Google Maps ↗';
    // FIX BIAŁEGO EKRANU: window.open zamiast location.href
    btnGoogle.onclick = (e) => {
        e.preventDefault();
        window.open(googleLink, '_system'); // _system wymusza zewnętrzną aplikację/przeglądarkę
    };
    navDiv.appendChild(btnGoogle);

    // Apple Maps (Tylko iOS)
    if (isIOSDevice) {
        const btnApple = document.createElement('button');
        btnApple.className = 'nav-btn apple'; 
        btnApple.innerText = 'Apple Maps ↗';
        btnApple.onclick = (e) => {
             e.preventDefault();
             window.open(appleLink, '_system');
        };
        navDiv.appendChild(btnApple);
    }

    // Yanosik (Wszędzie)
    const btnYanosik = document.createElement('button');
    btnYanosik.className = 'nav-btn yanosik';
    btnYanosik.innerText = 'Yanosik ↗';
    btnYanosik.onclick = (e) => {
        e.preventDefault();
        window.location.href = yanosikLink; // Yanosik to deep link, tutaj href jest bezpieczniejszy
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