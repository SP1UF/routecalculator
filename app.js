// --- ZMIENNE GLOBALNE (To jest serce naprawy) ---
// Tutaj trzymamy współrzędne GPS wybranej miejscowości.
// Dzięki temu nie szukamy jej drugi raz po nazwie.
let selectedStart = null; // { lat: 12.34, lon: 56.78 }
let selectedEnd = null;
let isIOSDevice = false;

window.onload = function() {
    checkPlatform();
    initMap();
};

function checkPlatform() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    // Sprawdzamy czy to sprzęt Apple
    isIOSDevice = /iPhone|iPad|iPod/.test(userAgent) && !window.MSStream;

    // Sprawdzanie czy aplikacja jest zainstalowana (ukrywanie instrukcji)
    const isStandaloneLegacy = window.navigator.standalone === true;
    const isStandaloneModern = window.matchMedia('(display-mode: standalone)').matches;
    const isApp = isStandaloneLegacy || isStandaloneModern;

    const guide = document.getElementById('install-guide');
    const app = document.getElementById('app-content');

    // Pokazujemy instrukcję TYLKO na iPhone w przeglądarce (nie w apce)
    if (isIOSDevice && !isApp) {
        if(guide) guide.classList.remove('hidden');
        if(app) app.classList.add('hidden');
    } else {
        if(guide) guide.classList.add('hidden');
        if(app) app.classList.remove('hidden');
    }
}

// --- MAPA ---
let map;
let routeLayer = null;

function initMap() {
    map = L.map('map').setView([52.0693, 19.4803], 6); // Środek Polski
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// --- PODPOWIEDZI MIAST I WYBÓR (AUTOCOMPLETE) ---

const startInput = document.getElementById('startCity');
const endInput = document.getElementById('endCity');

async function searchCities(query, listElement, inputElement, isStart) {
    if (query.length < 3) {
        listElement.style.display = 'none';
        return;
    }

    // Szukamy tylko w Polsce
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

                // Budowanie ładnej nazwy
                const city = place.address.city || place.address.town || place.address.village || place.name;
                const county = place.address.county || ''; 
                const state = place.address.state || '';

                let detailText = '';
                if (county && !city.includes(county)) {
                    detailText = `(${county})`; 
                } else if (state) {
                    detailText = `(${state})`;
                }

                // Wyświetlanie na liście
                div.innerHTML = `<strong>${city}</strong> <span class="suggestion-detail">${detailText}</span>`;

                // --- TU JEST NAPRAWA BŁĘDU ---
                div.onclick = () => {
                    // 1. Wpisujemy nazwę do pola (żebyś widział co wybrałeś)
                    inputElement.value = `${city} ${detailText}`;
                    
                    // 2. ZAPISUJEMY WSPÓŁRZĘDNE NA SZTYWNO
                    const exactCoords = { lat: place.lat, lon: place.lon };
                    
                    if (isStart) {
                        selectedStart = exactCoords; // Zapisz Start
                        console.log("Wybrano Start:", selectedStart);
                    } else {
                        selectedEnd = exactCoords;   // Zapisz Cel
                        console.log("Wybrano Cel:", selectedEnd);
                    }

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

// Obsługa pisania w polu
let timeoutId;
function handleInput(e, listId, inputId, isStart) {
    clearTimeout(timeoutId);
    
    // Jeśli użytkownik zmazał tekst i pisze od nowa, KASUJEMY wybrane współrzędne
    if (isStart) selectedStart = null;
    else selectedEnd = null;

    const list = document.getElementById(listId);
    const input = document.getElementById(inputId);
    timeoutId = setTimeout(() => { searchCities(e.target.value, list, input, isStart); }, 300);
}

// Podpinanie zdarzeń
startInput.addEventListener('input', (e) => handleInput(e, 'suggestions-start', 'startCity', true));
endInput.addEventListener('input', (e) => handleInput(e, 'suggestions-end', 'endCity', false));

// Kliknięcie obok zamyka listę
document.addEventListener('click', (e) => {
    if (e.target !== startInput) document.getElementById('suggestions-start').style.display = 'none';
    if (e.target !== endInput) document.getElementById('suggestions-end').style.display = 'none';
});

// --- OBLICZANIE TRASY ---

document.getElementById('searchRouteBtn').addEventListener('click', calculateRoute);
document.getElementById('calculateBtn').addEventListener('click', calculateCost);

async function calculateRoute() {
    // 1. Sprawdzamy, czy mamy wybrane współrzędne z listy
    let p1 = selectedStart;
    let p2 = selectedEnd;

    // Zabezpieczenie: Jeśli ktoś wpisał "Warszawa" ręcznie i nie kliknął z listy
    // to spróbujemy to znaleźć, ale lepiej klikać z listy.
    if (!p1 && startInput.value) p1 = await getCoordsFallback(startInput.value);
    if (!p2 && endInput.value) p2 = await getCoordsFallback(endInput.value);

    if (!p1 || !p2) {
        alert("Wybierz miejscowości z listy podpowiedzi!");
        return;
    }

    // 2. Wysyłamy KONKRETNE WSPÓŁRZĘDNE do silnika trasy (OSRM)
    // Kolejność w OSRM to: lon,lat
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${p1.lon},${p1.lat};${p2.lon},${p2.lat}?overview=full&geometries=geojson`;
    
    try {
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code !== 'Ok') {
            alert("Nie udało się wyznaczyć trasy.");
            return;
        }

        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        
        document.getElementById('distance').value = distanceKm;

        // Rysowanie trasy na mapie
        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.geoJSON(route.geometry, { style: { color: 'blue', weight: 5 } }).addTo(map);
        
        // Dopasowanie mapy do trasy
        map.fitBounds(routeLayer.getBounds());

        // 3. GENEROWANIE PRZYCISKÓW (Google / Apple)
        generateMapButtons(p1, p2);

    } catch (error) {
        console.error(error);
        alert("Błąd połączenia z mapą.");
    }
}

// Generowanie przycisków nawigacji
function generateMapButtons(start, end) {
    const navDiv = document.getElementById('navButtons');
    navDiv.innerHTML = ''; // Czyścimy stare
    navDiv.classList.remove('hidden');

    // Link do Google Maps (dla wszystkich) - używamy LAT i LON
    const googleLink = `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lon}&destination=${end.lat},${end.lon}&travelmode=driving`;
    
    // Link do Apple Maps (tylko iOS) - używamy LAT i LON
    const appleLink = `maps:?saddr=${start.lat},${start.lon}&daddr=${end.lat},${end.lon}&dirflg=d`;

    // Przycisk Google Maps (Zawsze widoczny)
    const btnGoogle = document.createElement('button');
    btnGoogle.className = 'nav-btn google';
    btnGoogle.innerText = 'Otwórz w Google Maps ↗';
    btnGoogle.onclick = () => window.open(googleLink, '_blank');
    navDiv.appendChild(btnGoogle);

    // Przycisk Apple Maps (Tylko dla iPhone/iPad)
    if (isIOSDevice) {
        const btnApple = document.createElement('button');
        btnApple.className = 'nav-btn apple'; 
        btnApple.innerText = 'Otwórz w Apple Maps ↗';
        btnApple.style.backgroundColor = 'black'; 
        btnApple.style.color = 'white';
        btnApple.style.marginTop = '10px';
        
        // Na iPhone otwiera aplikację Mapy
        btnApple.onclick = () => window.location.href = appleLink;
        
        navDiv.appendChild(btnApple);
    }
}

// Funkcja awaryjna (tylko jak ktoś nie kliknie w listę)
async function getCoordsFallback(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${city}&countrycodes=pl&limit=1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
    } catch(e) { return null; }
}

function calculateCost() {
    // Prosta matematyka kosztów
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