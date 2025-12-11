// Rejestracja Service Workera
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW zarejestrowany'))
            .catch(err => console.log('SW błąd:', err));
    });
}

// --- DETEKCJA TRYBU APLIKACJI ---
function checkDisplayMode() {
    const installGuide = document.getElementById('install-guide');
    const appContent = document.getElementById('app-content');
    
    // Sprawdzenie dla iOS (navigator.standalone) oraz standardowe (matchMedia)
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
        // Jesteśmy w aplikacji - pokaż kalkulator
        installGuide.style.display = 'none';
        appContent.classList.remove('hidden-app');
    } else {
        // Jesteśmy w przeglądarce - pokaż instrukcję, kalkulator ukryty przez CSS
        installGuide.style.display = 'flex';
    }
}

// Uruchom sprawdzanie przy starcie
checkDisplayMode();


// --- LOGIKA KALKULATORA ---

const distanceInput = document.getElementById('distance');
const roundTripInput = document.getElementById('roundTrip');
const consumptionInput = document.getElementById('consumption');
const fuelPriceInput = document.getElementById('fuelPrice');
const marginInput = document.getElementById('margin');
const calculateBtn = document.getElementById('calculateBtn');
const resultDiv = document.getElementById('result');

function loadSettings() {
    if(localStorage.getItem('fuelPrice')) fuelPriceInput.value = localStorage.getItem('fuelPrice');
    if(localStorage.getItem('consumption')) consumptionInput.value = localStorage.getItem('consumption');
    if(localStorage.getItem('margin')) marginInput.value = localStorage.getItem('margin');
}

function saveSettings() {
    localStorage.setItem('fuelPrice', fuelPriceInput.value);
    localStorage.setItem('consumption', consumptionInput.value);
    localStorage.setItem('margin', marginInput.value);
}

function calculate() {
    let dist = parseFloat(distanceInput.value);
    const consumption = parseFloat(consumptionInput.value);
    const price = parseFloat(fuelPriceInput.value);
    const marginPercent = parseFloat(marginInput.value) || 0;
    const isRoundTrip = roundTripInput.checked;

    if (isNaN(dist) || isNaN(consumption) || isNaN(price)) {
        alert("Proszę uzupełnić pola liczbowe (dystans, spalanie, cena).");
        return;
    }

    if (isRoundTrip) {
        dist = dist * 2;
    }

    // 1. Koszt samego paliwa
    const fuelNeeded = (dist / 100) * consumption;
    const fuelCost = fuelNeeded * price;
    
    // 2. Kwota marży (zysku)
    // Jeśli marża to np. 20% od kosztów, to: koszt * 0.20
    const marginAmount = fuelCost * (marginPercent / 100);
    
    // 3. Cena całkowita
    const total = fuelCost + marginAmount;

    // Wyświetlanie wyników
    document.getElementById('totalPrice').innerText = total.toFixed(2);
    document.getElementById('marginProfit').innerText = marginAmount.toFixed(2); // Twój zysk
    document.getElementById('fuelCost').innerText = fuelCost.toFixed(2);
    document.getElementById('totalDist').innerText = dist.toFixed(1);

    resultDiv.classList.remove('hidden');
    
    saveSettings();
}

calculateBtn.addEventListener('click', calculate);
loadSettings();;