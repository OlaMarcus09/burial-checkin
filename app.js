let guests = JSON.parse(localStorage.getItem('guests') || '[]');
let checkins = JSON.parse(localStorage.getItem('checkins') || '[]');

// --- CSV HANDLING ---
const csvInput = document.getElementById('csv-input');
if (csvInput) {
    csvInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            guests = lines.slice(1).filter(l => l.trim()).map((line, i) => {
                const col = line.split(',');
                return { id: `G-${i}`, name: col[1] || 'Guest', info: col[4] || '' };
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
        const card = document.createElement('div');
        card.className = `card ${checkins.includes(g.id) ? 'checked-in' : ''}`;
        card.innerHTML = `
            <h3>${g.name}</h3>
            <div class="qr-space" id="qr-${g.id}"></div>
            <button class="btn btn-wa" onclick="shareToWhatsApp('${g.id}', '${g.name}')">Share to WhatsApp</button>
        `;
        grid.appendChild(card);
        new QRCode(document.getElementById(`qr-${g.id}`), { text: g.id, width: 150, height: 150 });
    });
}

// --- WHATSAPP SHARE FEATURE ---
async function shareToWhatsApp(id, name) {
    const canvas = document.querySelector(`#qr-${id} canvas`);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `QR_${name}.png`, { type: 'image/png' });

    // Try Web Share API (Works on Mobile Chrome/Safari)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'Your Entry Pass',
                text: `Hello ${name}, here is your QR code for the burial service check-in.`
            });
        } catch (err) { console.error("Share failed", err); }
    } else {
        alert("Your browser doesn't support direct file sharing. Please download the image and send manually.");
    }
}

// --- SCANNER LOGIC ---
async function startScanner() {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const loop = () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (code) handleMatch(code.data);
        }
        requestAnimationFrame(loop);
    };
    loop();
}

function handleMatch(id) {
    const guest = guests.find(g => g.id === id);
    const popup = document.getElementById('result-popup');
    if (!guest) return;

    if (checkins.includes(id)) {
        popup.style.background = "#fff3cd";
        document.getElementById('res-name').innerText = "Already Checked In";
    } else {
        checkins.push(id);
        localStorage.setItem('checkins', JSON.stringify(checkins));
        popup.style.background = "#d4edda";
        document.getElementById('res-name').innerText = "✓ " + guest.name;
    }
    popup.style.display = "block";
}

if (guests.length > 0) renderGuests();