let guests = JSON.parse(localStorage.getItem('guests') || '[]');
let checkins = JSON.parse(localStorage.getItem('checkins') || '[]');

// --- DATA HANDLING ---
function saveAll() {
    localStorage.setItem('guests', JSON.stringify(guests));
    localStorage.setItem('checkins', JSON.stringify(checkins));
    updateDashboard();
}

// --- CSV PARSING ---
const csvInput = document.getElementById('csv-input');
if (csvInput) {
    csvInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            guests = lines.slice(1).filter(l => l.trim().length > 5).map((line, i) => {
                const col = line.split(',');
                // Matches the "Master" file columns: ID, Name, Email, Phone, InvitedBy
                return { 
                    id: col[0] || `ID-${i}`, 
                    name: (col[1] || "Guest").replace(/"/g, ""), 
                    info: col[4] || "General" 
                };
            });
            saveAll();
            renderGuests();
        };
        reader.readAsText(e.target.files[0]);
    };
}

function renderGuests() {
    const grid = document.getElementById('guest-grid');
    if (!grid) return;
    grid.innerHTML = '';
    guests.forEach(g => {
        const isChecked = checkins.includes(g.id);
        const card = document.createElement('div');
        card.className = `card ${isChecked ? 'checked-in' : ''}`;
        card.innerHTML = `
            <h3>${g.name}</h3>
            <p><small>Invited by: ${g.info}</small></p>
            <div class="qr-space" id="qr-${g.id}"></div>
            <button class="btn btn-wa" onclick="shareToWhatsApp('${g.id}', '${g.name}')">WhatsApp Invite</button>
        `;
        grid.appendChild(card);
        new QRCode(document.getElementById(`qr-${g.id}`), { text: g.id, width: 150, height: 150 });
    });
}

// --- WHATSAPP SHARE ---
async function shareToWhatsApp(id, name) {
    const canvas = document.querySelector(`#qr-${id} canvas`);
    if(!canvas) return alert("Generate QRs first!");
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `Pass_${name}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'Burial Entry Pass',
                text: `Hello ${name}, here is your entry QR code for the service.`
            });
        } catch (err) { console.log("Share cancelled"); }
    } else {
        alert("Sharing not supported on this browser. Use Safari or Chrome mobile.");
    }
}

// --- SCANNER ---
async function startScanner() {
    const video = document.getElementById('video');
    if (!video) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanLoop = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
                if (code) handleMatch(code.data);
            }
            requestAnimationFrame(scanLoop);
        };
        scanLoop();
    } catch (err) {
        document.getElementById('status').innerText = "Camera Error. Check Permissions.";
    }
}

function handleMatch(scannedId) {
    const guest = guests.find(g => g.id === scannedId);
    const popup = document.getElementById('result-popup');
    if (!guest) return;

    popup.style.display = "block";
    if (checkins.includes(scannedId)) {
        popup.style.background = "#fff3cd";
        document.getElementById('res-name').innerText = "Already Checked In";
        document.getElementById('res-detail').innerText = guest.name;
    } else {
        checkins.push(scannedId);
        saveAll();
        popup.style.background = "#d4edda";
        document.getElementById('res-name').innerText = "✓ Welcome";
        document.getElementById('res-detail').innerText = guest.name;
        if (navigator.vibrate) navigator.vibrate(200);
    }
}

// --- UTILS ---
function updateDashboard() {
    if(document.getElementById('total-count')) {
        document.getElementById('total-count').innerText = guests.length;
        document.getElementById('in-count').innerText = checkins.length;
    }
}

function downloadReport() {
    let csv = "ID,Name,Status\n";
    guests.forEach(g => {
        csv += `${g.id},${g.name},${checkins.includes(g.id) ? 'Present' : 'Absent'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Attendance_Report.csv';
    a.click();
}

function resetSystem() {
    if(confirm("This will delete all guests and check-ins. Continue?")) {
        localStorage.clear();
        location.reload();
    }
}

// Init
updateDashboard();
if (document.getElementById('guest-grid')) renderGuests();
