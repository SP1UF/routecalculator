// Inicjalizacja Mapy (Domyślnie środek Polski)
const map = L.map('map').setView([52.0693, 19.4803], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;

// --- AUTOCOMPLETE (PODPOWIEDZI MIEJSCOWOŚCI) ---

const startInput = document.getElementById('startCity');
const endInput = document.getElementById('endCity');
const suggestionsStart = document.getElementById('suggestions-start');
const suggestionsEnd = document.getElementById('suggestions-end');

// Funkcja szukająca miast w API Nominatim
async function searchCities(query, listElement, inputElement) {
    if (query.length < 3) {
        listElement.style.display = 'none';
        return;
    }

    // Szukamy tylko w Polsce (countrycodes=pl) i prosimy o szczegóły adresu (addressdetails=1)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=pl&addressdetails=1&limit=5`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        listElement.innerHTML = ''; // Czyścimy starą listę

        if (data.length > 0) {
            listElement.style.display = 'block';
            
            data.forEach(place => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';

                // Budujemy ładny opis: Miasto (Powiat, Województwo)
                const city = place.address.city || place.address.town || place.address.village || place.address.municipality;
                const county = place.address.county ? `, ${place.address.county}` : '';
                const state = place.address.state ? `, ${place.address.state}` : '';
                
                // Jeśli nazwa to np. "Warszawa", to nie chcemy duplikatu w powiecie
                let displayText = city;
                if(place.address.county && !city.includes(place.address.county)) {
                     displayText += ` <span class="suggestion-detail">(${place.address.county})</span>`;
                } else {
                     displayText += ` <span class="suggestion-detail">${state}</span>`;
                }

                div.innerHTML = displayText;

                // Kliknięcie w propozycję
                div.onclick = () => {
                    inputElement.value = city; // Wpisz samą nazwę miasta do inputa
                    listElement.style.display = 'none'; // Ukryj listę
                };

                listElement.appendChild(div);
            });
        } else {
            listElement.style.display = 'none';
        }

    } catch (error) {
        console.error("Błąd pobierania miast:", error);
    }
}

// Nasłuchiwanie pisania (z małym opóźnieniem, żeby nie męczyć API)
let timeoutId;
function handleInput(e, listId, inputId) {
    clearTimeout(timeoutId);
    const list = document.getElementById(listId);
    const input = document.getElementById(inputId);
    
    timeoutId = setTimeout(() => {
        searchCities(e.target.value, list, input);
    }, 300); // Czekaj 300ms po skończeniu pisania
}

// Podpinamy zdarzenia do pól
startInput.addEventListener('input', (e) => handleInput(e, 'suggestions-start', 'startCity'));
endInput.addEventListener('input', (e) => handleInput(e, 'suggestions-end', 'endCity'));

// Ukrywanie listy jak klikniemy gdzieś obok
document.addEventListener('click', (e) => {
    if (e.target !== startInput) suggestionsStart.style.display = 'none';
    if (e.target !== endInput) suggestionsEnd.style.display = 'none';
});


// --- STARA LOGIKA KALKULATORA PONIŻEJ ---

document.getElementById('searchRouteBtn').addEventListener('click', calculateRoute);
document.getElementById('calculateBtn').addEventListener('click', calculateCost);

// Funkcja rysująca trasę (korzystamy z routera OSRM - darmowy)
async function calculateRoute() {
    const start = document.getElementById('startCity').value;
    const end = document.getElementById('endCity').value;

    if (!start || !end) {
        alert("Wpisz obie miejscowości!");
        return;
    }

    // 1. Zamiana nazw miast na współrzędne (Geocoding)
    const coordsStart = await getCoords(start);
    const coordsEnd = await getCoords(end);

    if (!coordsStart || !coordsEnd) {
        alert("Nie znaleziono jednej z miejscowości.");
        return;
    }

    // 2. Wyznaczanie trasy (OSRM)
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStart.lon},${coordsStart.lat};${coordsEnd.lon},${coordsEnd.lat}?overview=full&geometries=geojson`;
    
    try {
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code !== 'Ok') {
            alert("Nie udało się wyznaczyć trasy.");
            return;
        }

        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1); // Metry na km
        
        // Wypełnij pole dystansu
        document.getElementById('distance').value = distanceKm;

        // Rysowanie na mapie
        if (routeLayer) map.removeLayer(routeLayer);
        
        // OSRM zwraca [lon, lat], Leaflet chce [lat, lon], ale GeoJSON to obsługuje automatycznie
        routeLayer = L.geoJSON(route.geometry, {
            style: { color: 'blue', weight: 5 }
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds()); // Dopasuj zoom do trasy

        // Pokaż przycisk Google Maps
        const navDiv = document.getElementById('navButtons');
        navDiv.classList.remove('hidden');
        
        // Zapisz link do Google Maps
        window.googleMapsLink = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&travelmode=driving`;

    } catch (error) {
        console.error(error);
        alert("Błąd połączenia z serwerem map.");
    }
}

// Funkcja pomocnicza do pobierania współrzędnych
async function getCoords(city) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${city}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0] ? { lat: data[0].lat, lon: data[0].lon } : null;
}

function openNav(type) {
    if (type === 'google' && window.googleMapsLink) {
        window.location.href = window.googleMapsLink;
    }
}

function calculateCost() {
    let dist = parseFloat(document.getElementById('distance').value);
    const consumption = parseFloat(document.getElementById('consumption').value);
    const price = parseFloat(document.getElementById('fuelPrice').value);
    const rate = parseFloat(document.getElementById('ratePerKm').value);
    const isRoundTrip = document.getElementById('roundTrip').checked;

    if (!dist || !consumption || !price || !rate) {
        alert("Wypełnij wszystkie pola z liczbami!");
        return;
    }

    if (isRoundTrip) {
        dist = dist * 2;
    }

    // Obliczenia
    const fuelNeeded = (dist * consumption) / 100;
    const fuelCostValue = fuelNeeded * price;
    const totalServiceCost = dist * rate; // Klient płaci stawkę za km (w niej jest paliwo i zysk)
    
    // Zysk = To co klient zapłacił - Koszt paliwa
    const profit = totalServiceCost - fuelCostValue;

    // Wyświetlanie
    document.getElementById('totalPrice').innerText = totalServiceCost.toFixed(2);
    document.getElementById('marginProfit').innerText = profit.toFixed(2);
    document.getElementById('fuelCost').innerText = fuelCostValue.toFixed(2);
    document.getElementById('totalDist').innerText = dist.toFixed(1);

    document.getElementById('result').classList.remove('hidden');
    
    // Scroll do wyniku
    document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
}