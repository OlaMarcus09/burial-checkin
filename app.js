// Load data from LocalStorage
let guests = JSON.parse(localStorage.getItem('guests') || '[]');
let checkins = JSON.parse(localStorage.getItem('checkins') || '[]');

// --- DATA PERSISTENCE ---
function saveCheckins() {
    localStorage.setItem('checkins', JSON.stringify(checkins));
}

// --- GENERATOR PAGE LOGIC ---
const csvInput = document.getElementById('csv-input');
if (csvInput) {
    csvInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            // Improved CSV parsing for your specific files
            guests = lines.slice(1).filter(l => l.trim()).map((line, i) => {
                const col = line.split(',');
                return { 
                    id: `ID-${i}`, 
                    name: col[6] || col[1] || 'Unknown Guest', 
                    info: col[3] || '' 
                };
            });
            localStorage.setItem('guests', JSON.stringify(guests));
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
            <p><small>${g.info}</small></p>
            <div class="qr-space" id="qr-${g.id}"></div>
            <button class="btn btn-wa" onclick="shareToWhatsApp('${g.id}', '${g.name}')">WhatsApp Invite</button>
        `;
        grid.appendChild(card);
        new QRCode(document.getElementById(`qr-${g.id}`), { text: g.id, width: 150, height: 150 });
    });
}

// --- SCANNER PAGE LOGIC ---
async function startScanner() {
    const video = document.getElementById('video');
    if (!video) return; // Exit if not on scanner page

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = stream;
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const loop = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);
                
                if (code) {
                    handleMatch(code.data);
                }
            }
            requestAnimationFrame(loop);
        };
        loop();
    } catch (err) {
        document.getElementById('status').innerText = "Error: Camera access denied.";
        console.error(err);
    }
}

function handleMatch(scannedId) {
    const guest = guests.find(g => g.id === scannedId);
    const popup = document.getElementById('result-popup');
    const nameEl = document.getElementById('res-name');
    
    if (!guest) {
        popup.style.display = "block";
        popup.style.background = "#fee";
        nameEl.innerText = "Unknown Code";
        return;
    }

    if (checkins.includes(scannedId)) {
        popup.style.display = "block";
        popup.style.background = "#fff3cd";
        nameEl.innerText = guest.name + " (Already In)";
    } else {
        checkins.push(scannedId);
        saveCheckins();
        popup.style.display = "block";
        popup.style.background = "#d4edda";
        nameEl.innerText = "✓ Welcome, " + guest.name;
        
        // Vibrate phone on success
        if (navigator.vibrate) navigator.vibrate(200);
    }
}

// Run render if on Generator page
if (document.getElementById('guest-grid')) renderGuests();
