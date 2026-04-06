
console.log('Script started loading');

// Medication Data Lists
const commonMeds = [
    "Acetaminophen", "Albuterol", "Amlodipine", "Amoxicillin", "Apixaban", "Aspirin", 
    "Atenolol", "Atorvastatin", "Carvedilol", "Clopidogrel", "Dexmedetomidine", 
    "Enalapril", "Esmolol", "Furosemide", "Gabapentin", "Hydrochlorothiazide", 
    "Ibuprofen", "Insulin Glargine", "Ketamine", "Levothyroxine", "Lisinopril", 
    "Lorazepam", "Losartan", "Metformin", "Metoprolol", "Midazolam", "Omeprazole", 
    "Ondansetron", "Pantoprazole", "Propofol", "Propranolol", "Rosuvastatin", 
    "Valsartan", "Warfarin"
];

// Special alert lists
const betaBlockers = ['Atenolol', 'Carvedilol', 'Esmolol', 'Metoprolol', 'Propranolol'];
const aceArbs = ['Enalapril', 'Lisinopril', 'Losartan', 'Valsartan'];

const doseTimes = ["Today AM", "Today PM", "Last Night", "Yesterday AM", "Yesterday PM", "Unknown"];

// Central Dose Dictionary (mg/kg or mcg/kg)
const doseRanges = {
    "Midazolam": { min: 0.02, max: 0.04, unit: "mg/kg" },
    "Diazepam": { min: 0.1, max: 0.2, unit: "mg/kg" },
    "Lorazepam": { min: 0.02, max: 0.04, unit: "mg/kg" },
    "Dexmedetomidine": { min: 0.5, max: 1.0, unit: "mcg/kg" },
    "Propofol": { min: 1.5, max: 2.5, unit: "mg/kg" },
    "Etomidate": { min: 0.2, max: 0.3, unit: "mg/kg" },
    "Ketamine": { min: 1.0, max: 2.0, unit: "mg/kg" },
    "Methohexital": { min: 1.0, max: 1.5, unit: "mg/kg" },
    "Fentanyl": { min: 12.5, max: 250, unit: "mcg (Total)" },
    "Succinylcholine": { min: 1.0, max: 1.5, unit: "mg/kg" },
    "Rocuronium": { min: 0.6, max: 1.2, unit: "mg/kg" },
    "Cisatracurium": { min: 0.15, max: 0.2, unit: "mg/kg" },
    "Atracurium": { min: 0.4, max: 0.5, unit: "mg/kg" },
    "Mivacurium": { min: 0.15, max: 0.2, unit: "mg/kg" },
    "Vecuronium": { min: 0.08, max: 0.1, unit: "mg/kg" },
    "Esmolol": { min: 0.5, max: 1.0, unit: "mg/kg" },
    "Hydromorphone": { min: 0.2, max: 2.0, unit: "mg (Total)" },
    "Morphine": { min: 2, max: 10, unit: "mg (Total)" },
    "Ketorolac": { min: 15, max: 30, unit: "mg (Total)" },
    "Acetaminophen": { min: 1000, max: 1000, unit: "mg (Total)" },
    "Ondansetron": { min: 0.05, max: 0.1, unit: "mg/kg" },
    "Dexamethasone": { min: 4, max: 10, unit: "mg (Total)" }, 
    "Scopolamine Patch": { min: 1, max: 1.5, unit: "mg (Total)" },
    "Aprepitant": { min: 40, max: 80, unit: "mg (Total)" }, 
    "Droperidol": { min: 0.01, max: 0.02, unit: "mg/kg" }
};

// Build dropdown HTML once
let medOptionsHTML = '<option value="">Select Medication...</option>';
commonMeds.forEach(med => { medOptionsHTML += `<option value="${med}">${med}</option>`; });
medOptionsHTML += '<option value="Other">Other...</option>';

let timeOptionsHTML = '';
doseTimes.forEach(time => { 
    let isSelected = (time === "Today AM") ? "selected" : "";
    timeOptionsHTML += `<option value="${time}" ${isSelected}>${time}</option>`; 
});

let currentMedRow = 0;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    addMedRow();
    calculateApfel();
});

// Dynamic Medication Row Spawner
function addMedRow() {
    if (currentMedRow >= 10) return;
    currentMedRow++;
    const i = currentMedRow;
    
    const row = document.createElement('div');
    row.className = "calc-row";
    row.id = `med-row-${i}`;
    
    row.innerHTML = `
        <select id="med-select-${i}" style="width: 220px;" onchange="handleMedChange(this, ${i})">
            ${medOptionsHTML}
        </select>
        <input type="text" id="med-other-${i}" placeholder="Type name..." style="display: none; width: 160px;" oninput="handleMedInput(${i})">
        <select id="med-time-${i}" style="width: 150px;" onchange="checkMedicationRow(${i})">
            ${timeOptionsHTML}
        </select>
    `;
    
    document.getElementById('meds-container').appendChild(row);
}

function checkMedicationRow(index) {
    const row = document.getElementById(`med-row-${index}`);
    if (!row) return;
    
    const medSelect = document.getElementById(`med-select-${index}`);
    const medTime = document.getElementById(`med-time-${index}`);
    const med = medSelect.value;
    const time = medTime.value;
    const isToday = (time === 'Today AM' || time === 'Today PM');
    
    // Reset alert
    row.classList.remove('alert-row-solid');
    
    if (med === "") return;

    // Beta Blocker Rule: If taking a BB and did NOT take it today -> Alert Red
    if (betaBlockers.includes(med) && !isToday) {
        row.classList.add('alert-row-solid');
    } 
    // ACE/ARB Rule: If taking ACE/ARB and DID take it today -> Alert Red
    else if (aceArbs.includes(med) && isToday) {
        row.classList.add('alert-row-solid');
    }
}

function handleMedChange(selectElement, index) {
    const otherInput = document.getElementById(`med-other-${index}`);
    if (selectElement.value === "Other") {
        otherInput.style.display = "inline-block";
    } else {
        otherInput.style.display = "none";
    }
    
    checkMedicationRow(index);
    
    // Spawn next row if needed
    if (selectElement.value !== "" && index === currentMedRow) {
        addMedRow();
    }
}

function handleMedInput(index) {
    const otherInput = document.getElementById(`med-other-${index}`);
    if (otherInput.value.trim() !== "" && index === currentMedRow) {
        addMedRow();
    }
}

// -----------------------------------------
// View Toggles (Print vs Edit)
// -----------------------------------------
function togglePreview() {
    populatePrintData();
    const mainContent = document.getElementById('main-content');
    const previewScreen = document.getElementById('preview-screen');

    mainContent.style.display = 'none';
    previewScreen.style.display = 'flex';
    window.scrollTo(0, 0);
}

function closePreview() {
    document.getElementById('main-content').style.display = 'block';
    document.getElementById('preview-screen').style.display = 'none';
    window.scrollTo(0, 0);
}

function executePrint() {
    console.log('=== EXECUTE PRINT STARTED ===');
    console.log('executePrint called');

    try {
        populatePrintData();
        console.log('populatePrintData completed');
    } catch (error) {
        console.error('Error in populatePrintData:', error);
        alert('Error populating print data: ' + error.message);
        return;
    }

    try {
        // Create a new window with just the print content
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        console.log('Print window opened:', printWindow);

        if (!printWindow) {
            console.error('Print window is null - popup blocked');
            alert('Popup blocked! Please allow popups for this site and try again.');
            return;
        }

        // Get the print container content
        const printContainer = document.getElementById('print-container');
        console.log('Print container found:', printContainer);

        if (!printContainer) {
            console.error('Print container not found');
            alert('Print container not found!');
            printWindow.close();
            return;
        }

        const printContent = printContainer.innerHTML;
        console.log('Print content length:', printContent.length);

        // Create HTML for printing using template literal (no embedded <script> to avoid outer script tokenizer issues)
        const printHTML = `<!DOCTYPE html>
<html>
<head>
<title>Anesthetic Care Plan</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: white; color: black; }
.print-container { width: 4.25in; height: 5.5in; background: white; padding: 0.15in; font-size: 7.5pt; color: black; box-sizing: border-box; border: 1px solid #000; margin: 0 auto; }
.print-header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 6px; font-size: 11pt; font-weight: bold; }
.print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.print-section { border: 1px solid #aaa; padding: 4px; border-radius: 2px; }
.print-section h3 { margin-top: 0; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 2px; font-size: 8pt; }
.print-row { display: flex; justify-content: space-between; margin-bottom: 2px; line-height: 1.1; }
.print-row span:first-child { font-weight: bold; margin-right: 5px; }
.med-print-row { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; margin-bottom: 2px; padding-bottom: 1px; }
.med-print-row:last-child { border-bottom: none; }
.scale-fishbone { transform: scale(0.6); transform-origin: top left; }
@media print { body { margin: 0; } .print-container { width: 4.25in !important; height: 5.5in !important; margin: 0 !important; padding: 0.15in !important; box-shadow: none !important; border: 1px dashed #ccc !important; } }
</style>
</head>
<body>
<div class="print-container">
${printContent}
</div>
</body>
</html>`;

        printWindow.document.write(printHTML);
        printWindow.document.close();

        // Print from parent window to avoid nested script, and close when done
        printWindow.focus();
        printWindow.print();
        setTimeout(() => {
            if (!printWindow.closed) printWindow.close();
        }, 1200);
        console.log('HTML written to print window');

        // Add error handling for the print window
        printWindow.onerror = function(msg, url, line) {
            console.error('Print window error:', msg, url, line);
        };

        console.log('Print function completed - window should open with print dialog');
    } catch (error) {
        console.error('Error in executePrint:', error);
        alert('Error in print function: ' + error.message);
    }
}

function testPopup() {
    console.log('=== TEST POPUP STARTED ===');
    console.log('Testing popup...');

    try {
        const testWindow = window.open('', '_blank', 'width=400,height=300');
        console.log('Test window opened:', testWindow);

        if (testWindow) {
            console.log('Writing content to test window...');
            testWindow.document.write('<html><body><h1>Popup Test Successful!</h1><p>This window should close in 3 seconds.</p></body></html>');
            testWindow.document.close();
            console.log('Test window content written');
            setTimeout(() => {
                console.log('Closing test window');
                testWindow.close();
            }, 3000);
            console.log('Popup test passed');
        } else {
            console.error('Test window is null - popup blocked');
            alert('Popup blocked! Please allow popups for this site.');
            console.log('Popup test failed - blocked');
        }
    } catch (error) {
        console.error('Error in testPopup:', error);
        alert('Error testing popup: ' + error.message);
    }
}

// -----------------------------------------
// Feature Toggles (Cardiac, RSI, Airway)
// -----------------------------------------
function togglePacer() {
    const pacerYes = document.querySelector('input[name="pat-pacer"][value="Yes"]').checked;
    const aicdContainer = document.getElementById('aicd-container');
    const settingsContainer = document.getElementById('pacer-settings-container');
    
    if (pacerYes) {
        aicdContainer.style.display = 'flex';
    } else {
        aicdContainer.style.display = 'none';
        settingsContainer.style.display = 'none';
        document.querySelector('input[name="pat-aicd"][value="No"]').checked = true;
        document.getElementById('pat-pacer-settings').value = '';
    }
}

function toggleAicd() {
    const aicdYes = document.querySelector('input[name="pat-aicd"][value="Yes"]').checked;
    const settingsContainer = document.getElementById('pacer-settings-container');
    if (aicdYes) {
        settingsContainer.style.display = 'block';
    } else {
        settingsContainer.style.display = 'none';
        document.getElementById('pat-pacer-settings').value = '';
    }
}

// Fasted Handler (RSI Green & Red)
function handleFastedChange() {
    const fastedNo = document.getElementById('pat-fasted-no').checked;
    const rsiLabel = document.getElementById('rsi-label');
    
    if (fastedNo) {
        rsiLabel.classList.add('text-green');
    } else {
        rsiLabel.classList.remove('text-green');
    }
    checkRsiAlert();
}

function handleRsiCheck(checkbox) {
    if (checkbox.id === 'ind-rsi-yes' && checkbox.checked) {
        document.getElementById('ind-rsi-no').checked = false;
    } else if (checkbox.id === 'ind-rsi-no' && checkbox.checked) {
        document.getElementById('ind-rsi-yes').checked = false;
    }
    checkRsiAlert();
}

function checkRsiAlert() {
    const fastedNo = document.getElementById('pat-fasted-no').checked;
    const rsiNo = document.getElementById('ind-rsi-no').checked;
    const rsiRow = document.getElementById('row-ind-rsi');

    // If Not Fasted, and they click No for RSI -> Big Red Alert
    if (fastedNo && rsiNo) {
        rsiRow.classList.add('alert-row-solid');
    } else {
        rsiRow.classList.remove('alert-row-solid');
    }
}

// -----------------------------------------
// Labs, MH, and Sux Checks
// -----------------------------------------
function checkLabs() {
    const kInput = document.getElementById('pat-k');
    const kVal = parseFloat(kInput.value);
    
    if (!isNaN(kVal) && kVal > 5.0) { 
        kInput.style.color = 'red'; 
        kInput.style.fontWeight = 'bold'; 
    } else { 
        kInput.style.color = ''; 
        kInput.style.fontWeight = ''; 
    }
    checkMhSuccs();
}

function handleMhChange() {
    const mhYes = document.querySelector('input[name="hx-mh"][value="Yes"]')?.checked || false;
    const tivaLabel = document.getElementById('tiva-label');
    
    if (mhYes) {
        tivaLabel.classList.add('text-green');
    } else {
        tivaLabel.classList.remove('text-green');
    }
    
    // Restrict Inhalational Options to only N2O
    const inhalSelect = document.getElementById('ind-inhalation');
    const options = inhalSelect.options;

    for (let i = 0; i < options.length; i++) {
        const val = options[i].value;
        if (val === 'Sevoflurane' || val === 'Desflurane' || val === 'Isoflurane') {
            options[i].disabled = mhYes;
            options[i].style.display = mhYes ? 'none' : 'block';
        }
    }

    // Clear if current choice is contraindicated
    if (mhYes && ['Sevoflurane','Desflurane','Isoflurane'].includes(inhalSelect.value)) {
        inhalSelect.value = '';
    }
    
    checkMhSuccs();
}

function checkMhSuccs() {
    const mhYes = document.querySelector('input[name="hx-mh"][value="Yes"]')?.checked || false;
    const paralytic = document.getElementById('ind-paralytic').value;
    const kVal = parseFloat(document.getElementById('pat-k').value);
    const highK = (!isNaN(kVal) && kVal > 5.0);
    const paralyticRow = document.getElementById('row-ind-paralytic');
    const warningSpan = document.getElementById('sux-k-warning');
    
    if (paralytic === 'Succinylcholine' && (mhYes || highK)) {
        paralyticRow.classList.add('alert-row-solid');
        
        if (highK) { 
            warningSpan.textContent = `CONTRAINDICATED: K+ is ${kVal}`; 
            warningSpan.style.display = 'inline'; 
        } else {
            warningSpan.style.display = 'none';
        }
    } else {
        paralyticRow.classList.remove('alert-row-solid');
        warningSpan.style.display = 'none';
    }
}

function checkSuxAlert() {
    // Check for Pseudo Def overlay
    const px = document.getElementById('ind-paralytic');
    const pseudoYes = document.querySelector('input[name="hx-pseudo"][value="Yes"]')?.checked;
    
    if (px.value === 'Succinylcholine' && pseudoYes) {
        document.getElementById('pseudo-alert-overlay').style.display = 'flex'; 
        px.value = ''; 
        updateDoseRange(px, 'ind-paralytic-dose', 'nmb-range');
    }
    // Then check MH / K logic
    checkMhSuccs();
}

// -----------------------------------------
// Dosing Logistics
// -----------------------------------------
function refreshAllDoseRanges() {
    const list = [
        'anx-med-select', 'ind-agent-select', 'ind-adrenergic', 'ind-paralytic', 'ind-pain',
        'plan-antiemetic-1', 'plan-antiemetic-2', 'plan-antiemetic-3', 'plan-antiemetic-4'
    ];
    list.forEach(id => {
        let el = document.getElementById(id); 
        if(el && el.value) el.dispatchEvent(new Event('change'));
    });
}

function getUnitForDrug(drug) {
    if (!doseRanges[drug]) return ""; 
    return doseRanges[drug].unit.split('/')[0].replace(' (Total)', '');
}

function updateDoseRange(selectEl, doseInputId, spanId) {
    const drug = selectEl.value; 
    const doseIn = document.getElementById(doseInputId); 
    const span = document.getElementById(spanId);
    const weight = parseFloat(document.getElementById('pat-weight-kg').value) || 0;
    
    if (doseRanges[drug]) {
        let rng = doseRanges[drug];
        let txt = `Range: ${rng.min} - ${rng.max} ${rng.unit}`;
        
        // If the medication is per-kg, and we have a valid weight, calculate the absolute dose range
        if (weight > 0 && rng.unit.includes('/kg')) {
            let absMin = parseFloat((rng.min * weight).toFixed(1)); 
            let absMax = parseFloat((rng.max * weight).toFixed(1));
            let absUnit = rng.unit.split('/')[0];
            
            txt += ` (Total: ${absMin} - ${absMax} ${absUnit})`;
            doseIn.dataset.min = absMin; 
            doseIn.dataset.max = absMax;
        } else {
            // Either weight is 0, or it's a fixed-dose med
            doseIn.dataset.min = rng.min; 
            doseIn.dataset.max = rng.max;
        }
        span.textContent = txt;
    } else {
        span.textContent = ""; 
        doseIn.dataset.min = ""; 
        doseIn.dataset.max = "";
    }
    validateDose(doseIn);
}

function validateDose(el) {
    const v = parseFloat(el.value); 
    const min = parseFloat(el.dataset.min); 
    const max = parseFloat(el.dataset.max);
    
    if (!isNaN(v) && !isNaN(min) && !isNaN(max)) {
        if (v < min || v > max) {
            el.style.color = 'red'; 
            el.style.fontWeight = 'bold';
        } else {
            el.style.color = ''; 
            el.style.fontWeight = '';
        }
    } else {
        el.style.color = ''; 
        el.style.fontWeight = '';
    }
}

// -----------------------------------------
// Patient Demographics & Vitals Math
// -----------------------------------------
function handleGenderChange() {
    const gender = document.getElementById('pat-gender').value;
    const eblSelect = document.getElementById('plan-ebl-type');
    
    if (gender === 'M') {
        eblSelect.value = '75';
    } else if (gender === 'F') {
        eblSelect.value = '65';
    }
    updateIBWandTV(); 
    refreshAllDoseRanges();
}

function handleAnxCheck(checkbox) {
    const medContainer = document.getElementById('anx-med-container');
    if (checkbox.id === 'ind-anx-yes' && checkbox.checked) {
        document.getElementById('ind-anx-no').checked = false;
        medContainer.style.display = 'flex';
    } else if (checkbox.id === 'ind-anx-no' && checkbox.checked) {
        document.getElementById('ind-anx-yes').checked = false;
        medContainer.style.display = 'none';
    } else if (!document.getElementById('ind-anx-yes').checked) {
        medContainer.style.display = 'none';
    }
}

function recalculateFromHeight() {
    const feet = parseInt(document.getElementById('pat-feet').value) || 0; 
    const inches = parseInt(document.getElementById('pat-inches').value) || 0;
    if(feet > 0 || inches > 0) {
        document.getElementById('pat-cm').value = (((feet * 12) + inches) * 2.54).toFixed(1);
    }
    recalcWeightChain();
}

function recalculateFromCm() {
    const cm = parseFloat(document.getElementById('pat-cm').value) || 0;
    if(cm > 0) { 
        let tot = cm / 2.54; 
        document.getElementById('pat-feet').value = Math.floor(tot / 12) || ""; 
        document.getElementById('pat-inches').value = Math.round(tot % 12); 
    } else { 
        document.getElementById('pat-feet').value = ""; 
        document.getElementById('pat-inches').value = ""; 
    }
    recalcWeightChain();
}

function recalculateFromWeightKg() {
    const kg = parseFloat(document.getElementById('pat-weight-kg').value) || 0;
    document.getElementById('pat-weight-lbs').value = kg > 0 ? (kg * 2.20462).toFixed(1) : "";
    recalcWeightChain();
}

function recalculateFromWeightLbs() {
    const lbs = parseFloat(document.getElementById('pat-weight-lbs').value) || 0;
    document.getElementById('pat-weight-kg').value = lbs > 0 ? (lbs / 2.20462).toFixed(1) : "";
    recalcWeightChain();
}

function recalculateFromBMI() {
    const cm = parseFloat(document.getElementById('pat-cm').value) || 0;
    const hm = cm / 100; 
    const bmi = parseFloat(document.getElementById('pat-bmi').value) || 0;
    if(hm > 0 && bmi > 0) {
        let kg = bmi * (hm * hm); 
        document.getElementById('pat-weight-kg').value = kg.toFixed(1); 
        document.getElementById('pat-weight-lbs').value = (kg * 2.20462).toFixed(1);
    }
    recalcWeightChain(true);
}

function recalcWeightChain(skipBMI = false) {
    const cm = parseFloat(document.getElementById('pat-cm').value) || 0;
    const hm = cm / 100; 
    const kg = parseFloat(document.getElementById('pat-weight-kg').value) || 0;
    
    document.getElementById('plan-fluid-weight').value = kg > 0 ? kg : "";
    
    if(hm > 0 && kg > 0 && !skipBMI) {
        document.getElementById('pat-bmi').value = (kg / (hm * hm)).toFixed(1);
    }
    
    updateIBWandTV(); 
    refreshAllDoseRanges();
}

function syncHct() { 
    document.getElementById('plan-ebl-start').value = document.getElementById('pat-hct').value; 
}

function updateIBWandTV() {
    const gen = document.getElementById('pat-gender').value; 
    const cm = parseFloat(document.getElementById('pat-cm').value) || 0;
    const res = document.getElementById('pat-stats-result');
    
    if(cm === 0 || gen === "") { 
        res.style.display = 'none'; 
        return; 
    }
    
    let ibw = 0;
    if (gen === 'M') {
        ibw = 50.0 + 2.3 * ((cm / 2.54) - 60);
    } else if (gen === 'F') {
        ibw = 45.5 + 2.3 * ((cm / 2.54) - 60);
    }
    
    if((cm / 2.54) < 60) ibw = gen === 'M' ? 50 : 45.5;
    
    res.style.display = 'block';
    res.innerHTML = `<strong>Ideal Body Wt (IBW):</strong> ${ibw.toFixed(1)} kg | <strong>Target TV (4-8 mL/kg IBW):</strong> <span style="color:#0645ad; font-weight:bold;">${Math.round(ibw*4)} - ${Math.round(ibw*8)} mL</span>`;
}

// -----------------------------------------
// Airway & History Alerts
// -----------------------------------------
function checkAirway(r) { 
    const rr = r.closest('.risk-row');
    if(r.value > 2) rr.classList.add('alert'); else rr.classList.remove('alert'); 
    updateAirwayAlerts(); 
}
function checkTMD(r) { 
    const rr = r.closest('.risk-row');
    if(r.value < 4) rr.classList.add('alert'); else rr.classList.remove('alert'); 
    updateAirwayAlerts(); 
}
function checkGap(r) { 
    const rr = r.closest('.risk-row');
    if(r.value < 4) rr.classList.add('alert'); else rr.classList.remove('alert'); 
    updateAirwayAlerts(); 
}
function checkMandibular(r) { 
    const rr = r.closest('.risk-row'); 
    rr.classList.remove('alert','alert-yellow'); 
    if(r.value === '2') rr.classList.add('alert-yellow'); 
    else if(r.value === '3') rr.classList.add('alert'); 
    updateAirwayAlerts(); 
}
function checkAtlanto(r) { 
    const rr = r.closest('.risk-row');
    if(r.value === 'Limited Mobility') rr.classList.add('alert'); else rr.classList.remove('alert'); 
    updateAirwayAlerts(); 
}

function updateAirwayAlerts() {
    // Check if any airway parameter triggered an alert
    const arr = ['row-mallampati','row-tmd','row-gap','row-mand','row-atlanto'];
    let hasAlert = arr.some(id => {
        let el = document.getElementById(id); 
        return el && (el.classList.contains('alert') || el.classList.contains('alert-yellow'));
    });
    
    const airwaySelect = document.getElementById('ind-airway-method'); 
    const methodRow = document.getElementById('row-ind-airway');
    
    if (hasAlert && airwaySelect.value === 'DL') {
        methodRow.classList.add('alert-row-solid');
    } else {
        methodRow.classList.remove('alert-row-solid');
    }
}

// -----------------------------------------
// APFEL & Antiemetics
// -----------------------------------------
function updateAntiemeticOptions() {
    const sels = [1,2,3,4].map(i => document.getElementById(`plan-antiemetic-${i}`));
    const vals = sels.map(s => s.value).filter(v => v !== "");
    
    sels.forEach(s => { 
        Array.from(s.options).forEach(o => { 
            if(o.value !== "") {
                // Disable if selected elsewhere
                o.disabled = vals.includes(o.value) && o.value !== s.value; 
            }
        }); 
    });
}

function calculateApfel() {
    let score = 0; 
    if(document.getElementById('pat-gender').value === 'F') score++;
    // Confirmed 1 point for non-smoker per APFEL rules
    if(document.getElementById('pat-smoker-no') && document.getElementById('pat-smoker-no').checked) score++;
    if(document.querySelector('input[name="hx-ponv"][value="Yes"]')?.checked) score++;
    if(document.querySelector('input[name="plan-opioid"][value="Yes"]')?.checked) score++;
    
    let risk = score === 1 ? "10%" : score === 2 ? "20%" : score === 3 ? "60%" : score === 4 ? "80%" : "<10%";
    let rec = score === 0 ? "0 or 1 antiemetic" : score < 3 ? "2 antiemetics" : "3-4 antiemetics";
    let target = score === 0 ? 0 : score < 3 ? 2 : 3;
    
    let selCount = document.getElementById('tiva-box').checked ? 1 : 0;
    for(let i=1; i<=4; i++) { 
        if(document.getElementById(`plan-antiemetic-${i}`).value !== "") selCount++; 
    }
    
    const div = document.getElementById('apfel-result');
    if (selCount >= target) {
        div.style.backgroundColor = '#d4edda'; 
        div.style.borderColor = '#c3e6cb'; 
        div.style.color = '#155724';
    } else {
        div.style.backgroundColor = '#f8d7da'; 
        div.style.borderColor = '#f5c6cb'; 
        div.style.color = '#721c24';
    }
    
    div.innerHTML = `<strong>APFEL Score:</strong> ${score}/4 (Risk: ${risk})<br><strong>Recommendation:</strong> ${rec}<br><strong>Currently Selected:</strong> ${selCount} <em>(TIVA counts as 1)</em>`;
    
    updateAntiemeticOptions();
}

function checkMets(r) { 
    const row = r.closest('.risk-row');
    if(r.value === 'Yes') row.classList.add('alert'); else row.classList.remove('alert'); 
}

function toggleRisk(r) { 
    const row = r.closest('.risk-row');
    if(r.value === 'Yes') row.classList.add('alert'); else row.classList.remove('alert'); 
    if(r.name === 'hx-pseudo' && r.value === 'Yes') checkSuxAlert(); 
}

function toggleGeneralOptions() {
    try {
        const anesTypeEl = document.getElementById('anes-type');
        const generalOptionsEl = document.getElementById('general-options');
        const tivaContainerEl = document.getElementById('tiva-container');
        
        if (!anesTypeEl) {
            console.error('toggleGeneralOptions: anes-type not found');
            return;
        }
        if (!generalOptionsEl) {
            console.error('toggleGeneralOptions: general-options not found');
            return;
        }
        if (!tivaContainerEl) {
            console.error('toggleGeneralOptions: tiva-container not found');
            return;
        }

        const t = anesTypeEl.value;
        console.log('toggleGeneralOptions() -> selected type:', t);

        generalOptionsEl.style.display = t === 'General' ? 'block' : 'none';
        tivaContainerEl.style.display = t === 'General' ? 'flex' : 'none';
        console.log('toggleGeneralOptions() complete');
    } catch (error) {
        console.error('toggleGeneralOptions error:', error);
    }
}

function toggleTivaReason() {
    const chk = document.getElementById('tiva-box').checked;
    document.getElementById('tiva-reason-wrapper').style.display = chk ? 'flex' : 'none';
    document.getElementById('inhalation-row').style.display = chk ? 'none' : 'flex';
}

// -----------------------------------------
// Fluid & ABL Math
// -----------------------------------------
function calculateFluidPlan() {
    const weight = parseFloat(document.getElementById('plan-fluid-weight').value) || 0; 
    const npo = parseFloat(document.getElementById('plan-fluid-npo').value) || 0; 
    const trauma = parseFloat(document.getElementById('plan-fluid-trauma').value) || 0;
    const resDiv = document.getElementById('plan-fluid-result');
    
    if(weight <= 0) { 
        resDiv.innerHTML = "<span style='color:red; font-weight:bold;'>Please enter patient weight above first.</span>"; 
        resDiv.style.display = "block"; 
        return; 
    }
    
    let maint = weight <= 10 ? weight * 4 : weight <= 20 ? 40 + (weight - 10) * 2 : 60 + (weight - 20);
    const def = maint * npo; 
    const ts = weight * trauma;
    
    window.calcFluidMaint = maint; 
    window.calcFluidDeficit = def; 
    window.calcFluidTrauma = ts;
    
    window.calcHr1 = maint + (def / 2) + ts; 
    window.calcHr2 = maint + (def / 4) + ts; 
    window.calcHr3 = maint + (def / 4) + ts; 
    window.calcHr4 = maint + ts;
    
    resDiv.innerHTML = `
        <strong>Maintenance Rate:</strong> ${maint} mL/hr<br>
        <strong>Total NPO Deficit:</strong> ${def} mL<br>
        <strong>3rd Space Loss:</strong> ${ts} mL/hr<br>
        <hr style="margin:8px 0; border-top: 1px dashed #ccc;">
        <strong style="color:#0645ad;">Explicit Hourly Fluid Plan (Maint + Deficit + Trauma):</strong><br>
        <strong>1st Hour:</strong> ${window.calcHr1} mL<br>
        <strong>2nd Hour:</strong> ${window.calcHr2} mL<br>
        <strong>3rd Hour:</strong> ${window.calcHr3} mL<br>
        <strong>4th Hour+:</strong> ${window.calcHr4} mL/hr
    `;
    resDiv.style.display = "block";
}

function calculateEBLPlan() {
    const w = parseFloat(document.getElementById('plan-fluid-weight').value) || 0; 
    const eF = parseFloat(document.getElementById('plan-ebl-type').value) || 0; 
    const sH = parseFloat(document.getElementById('plan-ebl-start').value) || 0; 
    const tH = parseFloat(document.getElementById('plan-ebl-target').value) || 0;
    const rd = document.getElementById('plan-ebl-result');
    
    if(w <= 0 || sH <= 0 || tH <= 0) { 
        rd.innerHTML = "<span style='color:red; font-weight:bold;'>Please ensure Weight, Start HCT, and Target HCT are filled.</span>"; 
        rd.style.display = "block"; 
        return; 
    }
    if (tH >= sH) {
        rd.innerHTML = "<span style='color:red; font-weight:bold;'>Target HCT must be lower than Starting HCT.</span>"; 
        rd.style.display = "block"; 
        return; 
    }
    
    const ebv = w * eF; 
    const abl = ebv * ((sH - tH) / sH);
    
    window.calcEbv = Math.round(ebv); 
    window.calcAbl = Math.round(abl);
    
    rd.innerHTML = `<strong>EBV:</strong> ${window.calcEbv} mL<br><strong>ABL:</strong> <span style="color:#0645ad; font-weight:bold; font-size:1.1em;">${window.calcAbl} mL</span>`; 
    rd.style.display = "block";
}

// -----------------------------------------
// DOM Population for Printing
// -----------------------------------------
function populatePrintData() {
    // Demographics
    document.getElementById('pr-name').textContent = `${document.getElementById('pat-initials').value || "_"} (Sched: ${document.getElementById('pat-sched-surg-time').value || "_"} | Len: ${document.getElementById('pat-surg-length').value || "_"})`;
    document.getElementById('pr-age-gen').textContent = `${document.getElementById('pat-age').value || "_"} yrs / ${document.getElementById('pat-gender').value || ""}`;
    
    let cm = document.getElementById('pat-cm').value; 
    let ft = document.getElementById('pat-feet').value; 
    let inc = document.getElementById('pat-inches').value;
    let hStr = "__";
    if (cm) {
        hStr = `${cm} cm`;
        if (ft || inc) hStr += ` (${ft || 0}' ${inc || 0}")`;
    } else if (ft || inc) {
        hStr = `${ft || 0}' ${inc || 0}"`;
    }
    
    document.getElementById('pr-height').textContent = hStr;
    document.getElementById('pr-weight').textContent = document.getElementById('pat-weight-kg').value ? `${document.getElementById('pat-weight-kg').value} kg` : "";
    document.getElementById('pr-bmi').textContent = document.getElementById('pat-bmi').value || "_";
    document.getElementById('pr-surgery').textContent = document.getElementById('pat-surgery').value || "";
    document.getElementById('pr-position').textContent = document.getElementById('pat-position').value || "";
    
    document.getElementById('pr-fasted').textContent = document.getElementById('pat-fasted-yes').checked ? "Yes" : document.getElementById('pat-fasted-no').checked ? "No" : "_";
    document.getElementById('pr-smoker').textContent = document.getElementById('pat-smoker-yes').checked ? "Yes" : document.getElementById('pat-smoker-no').checked ? "No" : "_";

    // Cardiac
    if (document.querySelector('input[name="pat-pacer"][value="Yes"]').checked) {
        document.getElementById('pr-pacer-row').style.display = 'flex';
        let pStr = "Pacemaker";
        if (document.querySelector('input[name="pat-aicd"][value="Yes"]').checked) pStr += " / AICD";
        let set = document.getElementById('pat-pacer-settings').value;
        if (set) pStr += ` (Settings: ${set})`;
        document.getElementById('pr-pacer').textContent = pStr;
    } else {
        document.getElementById('pr-pacer-row').style.display = 'none';
    }

    // Lytes & Chem
    let lytes = ['na','k','cl','mg','bun','cr','ica','ca','alb','ast','alt','glu'].map(x => document.getElementById('pat-'+x).value);
    
    if (!lytes.some(x => x)) {
        document.getElementById('pr-fishbone').style.display = 'none'; 
        document.getElementById('pr-lytes-empty').style.display = 'inline-block';
    } else {
        document.getElementById('pr-fishbone').style.display = 'flex'; 
        document.getElementById('pr-lytes-empty').style.display = 'none';
        
        document.getElementById('fb-na').textContent = lytes[0]; 
        document.getElementById('fb-cl').textContent = lytes[2]; 
        document.getElementById('fb-mg').textContent = lytes[3]; 
        document.getElementById('fb-bun').textContent = lytes[4]; 
        document.getElementById('fb-cr').textContent = lytes[5]; 
        document.getElementById('fb-glu').textContent = lytes[11];
        
        // High K Red Alert Formatting in Print
        let kv = parseFloat(lytes[1]); 
        if (!isNaN(kv) && kv > 5) {
            document.getElementById('fb-k').innerHTML = `<span style="color:red">${lytes[1]}</span>`;
        } else {
            document.getElementById('fb-k').textContent = lytes[1] || "";
        }
        
        let o = []; 
        if(lytes[6]) o.push(`iCa: ${lytes[6]}`); 
        if(lytes[7]) o.push(`Ca: ${lytes[7]}`); 
        if(lytes[8]) o.push(`Alb: ${lytes[8]}`); 
        if(lytes[9]) o.push(`AST: ${lytes[9]}`); 
        if(lytes[10]) o.push(`ALT: ${lytes[10]}`);
        document.getElementById('fb-others').innerHTML = o.join('<br>');
    }

    // CBC X Fishbone
    let cbc = ['wbc','hgb','hct','plt','pt','inr','ptt'].map(x => document.getElementById('pat-'+x).value);
    
    if(!cbc.slice(0,4).some(x => x)) {
        document.getElementById('pr-cbc-fishbone').style.display = 'none'; 
        document.getElementById('pr-cbc-empty').style.display = 'inline-block';
    } else {
        document.getElementById('pr-cbc-fishbone').style.display = 'block'; 
        document.getElementById('pr-cbc-empty').style.display = 'none';
        
        document.getElementById('fb-wbc').textContent = cbc[0]; 
        document.getElementById('fb-hgb').textContent = cbc[1]; 
        document.getElementById('fb-hct').textContent = cbc[2]; 
        document.getElementById('fb-plt').textContent = cbc[3];
    }
    
    let coags = []; 
    if(cbc[4]) coags.push(`PT: ${cbc[4]}`); 
    if(cbc[5]) coags.push(`INR: ${cbc[5]}`); 
    if(cbc[6]) coags.push(`PTT: ${cbc[6]}`);
    document.getElementById('fb-coags').innerHTML = coags.join('<br>');
    
    if(!cbc.slice(0,4).some(x => x)) {
        document.getElementById('pr-cbc-empty').textContent = coags.length > 0 ? coags.join(', ') : "_";
    }

    // PMH
    let pmh = Array.from(document.querySelectorAll('.pmh-box:checked')).map(cb => cb.value);
    document.querySelectorAll('#pmh-texts input').forEach(inp => { 
        if(inp.value.trim()) pmh.push(inp.value.trim()); 
    });
    document.getElementById('pr-pmh').textContent = pmh.length > 0 ? pmh.join(', ') : "None";

    // Meds List
    let mHtml = "";
    for(let i=1; i<=currentMedRow; i++) {
        let s = document.getElementById(`med-select-${i}`); 
        if(!s) continue;
        let md = s.value; 
        if (md === 'Other') md = document.getElementById(`med-other-${i}`).value;
        let time = document.getElementById(`med-time-${i}`).value;
        
        if(md.trim()) {
            mHtml += `<div class="med-print-row"><span>${md}</span><span>${time || '-'}</span></div>`;
        }
    }
    document.getElementById('pr-meds-list').innerHTML = mHtml || "<em>None</em>";

    // History Alerts
    ['aw','ponv','famhx','mh','pseudo'].forEach(k => {
        let isYes = document.querySelector(`input[name="hx-${k}"][value="Yes"]`)?.checked;
        document.getElementById(`pr-row-${k}`).style.display = isYes ? 'flex' : 'none';
    });
    
    let metsVal = document.querySelector('input[name="hx-mets"]:checked')?.value || "";
    document.getElementById('pr-mets').textContent = metsVal; 
    document.getElementById('pr-row-mets').style.color = (metsVal === 'Yes') ? 'red' : '';
    
    // Airway Exam Formatter
    ['mallampati','tmd','interincisor','mandibular','atlanto'].forEach(k => {
        let printName = k === 'interincisor' ? 'gap' : k;
        let inputName = k === 'mandibular' ? 'airway-' : 'exam-';
        
        let el = document.getElementById(`pr-${printName}`); 
        if (!el) return; // Skip if element doesn't exist
        
        el.textContent = document.querySelector(`input[name="${inputName}${k}"]:checked`)?.value || "_";
        
        const rowId = printName === 'mandibular' ? 'row-mand' : `row-${printName}`;
        let r = document.getElementById(rowId); 
        if (r && el.parentElement) {
            if (r.classList.contains('alert')) {
                el.parentElement.style.color = 'red';
            } else if (r.classList.contains('alert-yellow')) {
                el.parentElement.style.color = '#856404';
            } else {
                el.parentElement.style.color = '';
            }
        }
    });

    // Plan Details
    let at = document.getElementById('anes-type').value; 
    let tv = document.getElementById('tiva-box').checked;
    
    document.getElementById('pr-anes-type').textContent = (tv && at === 'General') ? 'General (TIVA)' : (at || "_");
    
    if (tv && at === 'General') {
        document.getElementById('pr-tiva-info').style.display = 'flex'; 
        let tr = document.getElementById('tiva-reason').value;
        document.getElementById('pr-tiva-reason').textContent = (tr === 'Other') ? document.getElementById('tiva-other-text').value : (tr || "_");
    } else {
        document.getElementById('pr-tiva-info').style.display = 'none';
    }
    
    if (at === 'General') {
        document.getElementById('pr-gen-anes-block').style.display = 'block';
        
        let aw = document.getElementById('ind-airway-method'); 
        let prAw = document.getElementById('pr-airway');
        prAw.textContent = aw.value; 
        
        if (document.getElementById('row-ind-airway').classList.contains('alert-row-solid')) {
            prAw.style.color = 'red';
            prAw.style.fontWeight = 'bold';
        } else {
            prAw.style.color = '';
            prAw.style.fontWeight = '';
        }
        
        document.getElementById('pr-rsi').textContent = document.getElementById('ind-rsi-yes').checked ? "Yes" : "No";
        if (document.getElementById('row-ind-rsi').classList.contains('alert-row-solid')) {
             document.getElementById('pr-rsi').parentElement.style.color = 'red';
             document.getElementById('pr-rsi').parentElement.style.fontWeight = 'bold';
        } else {
             document.getElementById('pr-rsi').parentElement.style.color = '';
             document.getElementById('pr-rsi').parentElement.style.fontWeight = '';
        }
        
        if (document.getElementById('ind-anx-yes').checked) { 
            let m = document.getElementById('anx-med-select').value; 
            let d = document.getElementById('anx-med-dose').value;
            document.getElementById('pr-anx').textContent = m ? `${m} ${d ? `(${d} ${getUnitForDrug(m)})` : ''}` : "None"; 
        } else {
            document.getElementById('pr-anx').textContent = "None";
        }
        
        let indAg = document.getElementById('ind-agent-select').value;
        let indD = document.getElementById('ind-dose').value;
        document.getElementById('pr-ind').textContent = indAg ? `${indAg} ${indD ? `(${indD} ${getUnitForDrug(indAg)})` : ''}` : "";
        
        let bAg = document.getElementById('ind-adrenergic').value;
        let bD = document.getElementById('ind-adrenergic-dose').value;
        document.getElementById('pr-blunt').textContent = bAg ? `${bAg} ${bD ? `(${bD} ${getUnitForDrug(bAg)})` : ''}` : "";
        
        let pAg = document.getElementById('ind-paralytic').value;
        let pD = document.getElementById('ind-paralytic-dose').value;
        document.getElementById('pr-nmb').textContent = pAg ? `${pAg} ${pD ? `(${pD} ${getUnitForDrug(pAg)})` : ''}` : "";
        
        if (document.getElementById('row-ind-paralytic').classList.contains('alert-row-solid')) {
            document.getElementById('pr-nmb').parentElement.style.color = 'red';
            document.getElementById('pr-nmb').parentElement.style.fontWeight = 'bold';
        } else {
            document.getElementById('pr-nmb').parentElement.style.color = '';
            document.getElementById('pr-nmb').parentElement.style.fontWeight = '';
        }
        
        let pnAg = document.getElementById('ind-pain').value;
        let pnD = document.getElementById('ind-pain-dose').value;
        document.getElementById('pr-pain').textContent = pnAg ? `${pnAg} ${pnD ? `(${pnD} ${getUnitForDrug(pnAg)})` : ''}` : "None";

        document.getElementById('pr-inhal-row').style.display = tv ? 'none' : 'flex'; 
        let inhAg = document.getElementById('ind-inhalation').value;
        let inhM = document.getElementById('ind-mac-plan').value;
        document.getElementById('pr-inhal').textContent = inhAg ? `${inhAg} ${inhM ? `(${inhM})` : ''}` : "";
    } else {
        document.getElementById('pr-gen-anes-block').style.display = 'none';
    }

    let anti = []; 
    for(let i=1; i<=4; i++) { 
        let m = document.getElementById(`plan-antiemetic-${i}`).value; 
        let d = document.getElementById(`plan-antiemetic-dose-${i}`).value; 
        if(m) anti.push(`${m} ${d ? `(${d} ${getUnitForDrug(m)})` : ''}`); 
    }
    document.getElementById('pr-antiemetic').textContent = anti.join(', ') || "None";

    // Fluid Data 
    document.getElementById('pr-fluid-type').textContent = document.getElementById('plan-fluid-type').value || "None";
    document.getElementById('pr-fluid-maint').textContent = window.calcFluidMaint ? `${window.calcFluidMaint} mL/hr` : "";
    document.getElementById('pr-fluid-deficit').textContent = window.calcFluidDeficit ? `${window.calcFluidDeficit} mL` : "";
    document.getElementById('pr-fluid-trauma').textContent = window.calcFluidTrauma ? `${window.calcFluidTrauma} mL/hr` : "";
    
    document.getElementById('pr-fluid-hr1').textContent = window.calcHr1 ? `${window.calcHr1} mL` : "";
    document.getElementById('pr-fluid-hr2').textContent = window.calcHr2 ? `${window.calcHr2} mL` : "";
    document.getElementById('pr-fluid-hr3').textContent = window.calcHr3 ? `${window.calcHr3} mL` : "";
    document.getElementById('pr-fluid-hr4').textContent = window.calcHr4 ? `${window.calcHr4} mL/hr` : "";

    document.getElementById('pr-ebv').textContent = window.calcEbv ? `${window.calcEbv} mL` : "";
    document.getElementById('pr-abl').textContent = window.calcAbl ? `${window.calcAbl} mL` : "";
}

// Add event listeners for buttons
console.log('Setting up event listeners...');

function setupEventListeners() {
    console.log('Setting up event listeners function called');
    
    // Top buttons
    const topPreviewBtn = document.getElementById('top-preview-btn');
    const topPrintBtn = document.getElementById('top-print-btn');
    console.log('Top preview button found:', topPreviewBtn);
    console.log('Top print button found:', topPrintBtn);

    if (topPreviewBtn) {
        topPreviewBtn.addEventListener('click', function() {
            console.log('Top preview button clicked');
            togglePreview();
        });
    }

    if (topPrintBtn) {
        topPrintBtn.addEventListener('click', function() {
            console.log('Top print button clicked');
            executePrint();
        });
    }

    // Bottom buttons
    const previewBtn = document.getElementById('preview-btn');
    const printBtn = document.getElementById('print-btn');
    const testPopupBtn = document.getElementById('test-popup-btn');
    const jsTestBtn = document.getElementById('js-test-btn');
    console.log('Bottom buttons found:', {previewBtn, printBtn, testPopupBtn, jsTestBtn});

    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            console.log('Bottom preview button clicked');
            togglePreview();
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', function() {
            console.log('Bottom print button clicked');
            executePrint();
        });
    }

    // Ensure anesthesia dropdown behavior is always wired
    const anesTypeSelect = document.getElementById('anes-type');
    if (anesTypeSelect) {
        anesTypeSelect.addEventListener('change', function() {
            console.log('anes-type change event (setupEventListeners) ->', this.value);
            toggleGeneralOptions();
        });
    }

    if (testPopupBtn) {
        testPopupBtn.addEventListener('click', function() {
            console.log('Test popup button clicked');
            testPopup();
        });
    }

    if (jsTestBtn) {
        jsTestBtn.addEventListener('click', function() {
            console.log('JS test button clicked');
            alert('JavaScript is working!');
        });
    }
    
    console.log('Event listeners setup complete');
}

if (document.readyState === 'loading') {
    console.log('Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', function() {
        setupEventListeners();
        toggleGeneralOptions();
    });
} else {
    console.log('Document already loaded, setting up immediately');
    setupEventListeners();
    toggleGeneralOptions();
}
