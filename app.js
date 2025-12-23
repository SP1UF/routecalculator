// 1. Rejestracja Service Workera
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW zarejestrowany'))
            .catch(err => console.log('SW błąd:', err));
    });
}

// 2. Detekcja trybu wyświetlania (App vs Browser)
function checkDisplayMode() {
    const installGuide = document.getElementById('install-guide');
    const appContent = document.getElementById('app-content');
    
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
        installGuide.style.display = 'none';
        appContent.classList.remove('hidden-app');
    } else {
        installGuide.style.display = 'flex';
    }
}
checkDisplayMode();

// 3. Logika Kalkulatora
const distanceInput = document.getElementById('distance');
const roundTripInput = document.getElementById('roundTrip');
const consumptionInput = document.getElementById('consumption');
const fuelPriceInput = document.getElementById('fuelPrice');
const rateInput = document.getElementById('ratePerKm'); // Stawka za km
const calculateBtn = document.getElementById('calculateBtn');
const resultDiv = document.getElementById('result');

// Ładowanie ustawień
function loadSettings() {
    if(localStorage.getItem('fuelPrice')) fuelPriceInput.value = localStorage.getItem('fuelPrice');
    if(localStorage.getItem('consumption')) consumptionInput.value = localStorage.getItem('consumption');
    if(localStorage.getItem('ratePerKm')) rateInput.value = localStorage.getItem('ratePerKm');
}

// Zapisywanie ustawień
function saveSettings() {
    localStorage.setItem('fuelPrice', fuelPriceInput.value);
    localStorage.setItem('consumption', consumptionInput.value);
    localStorage.setItem('ratePerKm', rateInput.value);
}

function calculate() {
    let distOneWay = parseFloat(distanceInput.value);
    const consumption = parseFloat(consumptionInput.value);
    const price = parseFloat(fuelPriceInput.value);
    const ratePerKm = parseFloat(rateInput.value) || 0;
    const isRoundTrip = roundTripInput.checked;

    if (isNaN(distOneWay) || isNaN(consumption) || isNaN(price)) {
        alert("Wypełnij dystans, spalanie i cenę paliwa.");
        return;
    }

    // Całkowity dystans
    let totalDist = distOneWay;
    if (isRoundTrip) {
        totalDist = distOneWay * 2;
    }

    // Koszty
    const fuelNeeded = (totalDist / 100) * consumption;
    const fuelCost = fuelNeeded * price;
    
    // Zysk (Stawka za km * dystans)
    const marginAmount = totalDist * ratePerKm;
    
    // Suma
    const total = fuelCost + marginAmount;

    // Wynik
    document.getElementById('totalPrice').innerText = total.toFixed(2);
    document.getElementById('marginProfit').innerText = marginAmount.toFixed(2);
    document.getElementById('fuelCost').innerText = fuelCost.toFixed(2);
    document.getElementById('totalDist').innerText = totalDist.toFixed(1);

    resultDiv.classList.remove('hidden');
    saveSettings();
}

calculateBtn.addEventListener('click', calculate);
loadSettings();