// --- 1. SETUP SYSTEMOWY ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW error:', err));
    });
}

function checkDisplayMode() {
    const installGuide = document.getElementById('install-guide');
    const appContent = document.getElementById('app-content');
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
        installGuide.style.display = 'none';
        appContent.classList.remove('hidden-app');
        // Inicjalizacja mapy dopiero gdy aplikacja jest widoczna (ważne dla Leaflet)
        setTimeout(initMap, 500); 
    } else {
        installGuide.style.display = 'flex';
    }
}
checkDisplayMode();


// --- 2. LOGIKA MAPY (LEAFLET + OSRM) ---
let map;
let routeLayer;

function initMap() {
    // Ustawienie mapy na Polskę
    map = L.map('map').setView([52.069, 19.480], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);
}

// Funkcja szukająca współrzędnych miasta (Nominatim API)
async function getCoords(city) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${city}`);
    const data = await response.json();
    if (data && data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
    }
    throw new Error(`Nie znaleziono miasta: ${city}`);
}

const searchRouteBtn = document.getElementById('searchRouteBtn');
const startInput = document.getElementById('startCity');
const endInput = document.getElementById('endCity');
const navButtons = document.getElementById('navButtons');

searchRouteBtn.addEventListener('click', async () => {
    const startCity = startInput.value;
    const endCity = endInput.value;

    if (!startCity || !endCity) {
        alert("Wpisz miasto startowe i docelowe.");
        return;
    }

    searchRouteBtn.textContent = "Szukam trasy...";
    searchRouteBtn.disabled = true;

    try {
        // 1. Pobierz współrzędne
        const startCoords = await getCoords(startCity);
        const endCoords = await getCoords(endCity);

        // 2. Pobierz trasę (OSRM API - Darmowe)
        const routerUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}?overview=full&geometries=geojson`;
        
        const routeResp = await fetch(routerUrl);
        const routeData = await routeResp.json();

        if (routeData.code !== "Ok") throw new Error("Nie znaleziono trasy drogowej.");

        // 3. Wyciągnij dane
        const route = routeData.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1); // Metry na km
        const geometry = route.geometry;

        // 4. Rysuj na mapie
        if (routeLayer) map.removeLayer(routeLayer);
        
        routeLayer = L.geoJSON(geometry, {
            style: { color: 'blue', weight: 5, opacity: 0.7 }
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

        // 5. Wpisz dane do kalkulatora
        document.getElementById('distance').value = distanceKm;
        
        // Pokaż przyciski nawigacji
        navButtons.classList.remove('hidden');

        // Uruchom przeliczanie kosztów
        calculate(); 

    } catch (error) {
        alert("Błąd: " + error.message + ". Sprawdź internet lub nazwy miast.");
    } finally {
        searchRouteBtn.textContent = "Znajdź trasę i pobierz km";
        searchRouteBtn.disabled = false;
    }
});

// Funkcja otwierająca zewnętrzne aplikacje
window.openNav = function(type) {
    const start = startInput.value;
    const end = endInput.value;
    
    if (type === 'google') {
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${start}&destination=${end}`, '_blank');
    } else if (type === 'apple') {
        window.open(`http://maps.apple.com/?saddr=${start}&daddr=${end}`, '_blank');
    }
};


// --- 3. LOGIKA KALKULATORA (Ta sama co wcześniej) ---
const distanceInput = document.getElementById('distance');
const roundTripInput = document.getElementById('roundTrip');
const consumptionInput = document.getElementById('consumption');
const fuelPriceInput = document.getElementById('fuelPrice');
const rateInput = document.getElementById('ratePerKm');
const calculateBtn = document.getElementById('calculateBtn');
const resultDiv = document.getElementById('result');

function loadSettings() {
    if(localStorage.getItem('fuelPrice')) fuelPriceInput.value = localStorage.getItem('fuelPrice');
    if(localStorage.getItem('consumption')) consumptionInput.value = localStorage.getItem('consumption');
    if(localStorage.getItem('ratePerKm')) rateInput.value = localStorage.getItem('ratePerKm');
    // Opcjonalnie zapisane miasta
    if(localStorage.getItem('startCity')) startInput.value = localStorage.getItem('startCity');
}

function saveSettings() {
    localStorage.setItem('fuelPrice', fuelPriceInput.value);
    localStorage.setItem('consumption', consumptionInput.value);
    localStorage.setItem('ratePerKm', rateInput.value);
    localStorage.setItem('startCity', startInput.value); // Zapamiętaj start
}

function calculate() {
    let distOneWay = parseFloat(distanceInput.value);
    const consumption = parseFloat(consumptionInput.value);
    const price = parseFloat(fuelPriceInput.value);
    const ratePerKm = parseFloat(rateInput.value) || 0;
    const isRoundTrip = roundTripInput.checked;

    if (isNaN(distOneWay) || isNaN(consumption) || isNaN(price)) return;

    let totalDist = distOneWay;
    if (isRoundTrip) totalDist = distOneWay * 2;

    const fuelNeeded = (totalDist / 100) * consumption;
    const fuelCost = fuelNeeded * price;
    const marginAmount = totalDist * ratePerKm;
    const total = fuelCost + marginAmount;

    document.getElementById('totalPrice').innerText = total.toFixed(2);
    document.getElementById('marginProfit').innerText = marginAmount.toFixed(2);
    document.getElementById('fuelCost').innerText = fuelCost.toFixed(2);
    document.getElementById('totalDist').innerText = totalDist.toFixed(1);

    resultDiv.classList.remove('hidden');
    saveSettings();
}

calculateBtn.addEventListener('click', calculate);
loadSettings();