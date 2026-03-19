// ══════════════════════════════════════════════
//  BURIAL SERVICE CHECK-IN SYSTEM — app.js
// ══════════════════════════════════════════════

let guests = JSON.parse(localStorage.getItem('guests') || '[]');
let checkins = JSON.parse(localStorage.getItem('checkins') || '[]');

// ── SAVE DATA ─────────────────────────────────
function saveAll() {
    localStorage.setItem('guests', JSON.stringify(guests));
    localStorage.setItem('checkins', JSON.stringify(checkins));
    updateDashboard();
}

// ── CSV PARSING ───────────────────────────────
const csvInput = document.getElementById('csv-input');
if (csvInput) {
    csvInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            const headers = lines[0].toLowerCase();
            const isFormatA = headers.includes('name');

            guests = lines.slice(1)
                .filter(l => l.trim().length > 5)
                .map((line, i) => {
                    const col = parseCSVLine(line);
                    let name, info, phone, email;

                    if (isFormatA) {
                        // Format A: Timestamp, Attend, HowMany, InvitedBy, Phone, Email, Name
                        name  = (col[6] || col[5] || `Guest ${i + 1}`).replace(/"/g, '').trim();
                        info  = (col[3] || 'General').replace(/"/g, '').trim();
                        phone = (col[4] || '').replace(/"/g, '').trim();
                        email = (col[5] || '').replace(/"/g, '').trim();
                    } else {
                        // Format B: Timestamp, Attend, HowMany, InvitedBy, Email
                        name  = (col[4] || `Guest ${i + 1}`).replace(/"/g, '').trim();
                        info  = (col[3] || 'General').replace(/"/g, '').trim();
                        phone = '';
                        email = (col[4] || '').replace(/"/g, '').trim();
                    }

                    if (!name || name.length < 2) return null;

                    return {
                        id: `guest_${i}_${Date.now()}`,
                        name, info, phone, email
                    };
                })
                .filter(Boolean);

            saveAll();
            renderGuests();
            alert(`✓ Loaded ${guests.length} guests successfully!`);
        };
        reader.readAsText(e.target.files[0]);
    };
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += ch; }
    }
    result.push(current);
    return result;
}

// ── RENDER GUESTS ─────────────────────────────
function renderGuests() {
    const grid = document.getElementById('guest-grid');
    if (!grid) return;
    grid.innerHTML = (guests.length === 0) ? '<p>No guests loaded. Upload CSV.</p>' : '';

    guests.forEach((g, idx) => {
        const isChecked = checkins.includes(g.id);
        const card = document.createElement('div');
        card.className = `card ${isChecked ? 'checked-in' : ''}`;
        card.id = `card-${g.id}`;
        card.innerHTML = `
            <h3>${g.name}</h3>
            <p><small>Invited by: <strong>${g.info}</strong></small></p>
            <div class="qr-space" id="qr-${g.id}"></div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-wa" onclick="shareToWhatsApp('${g.id}', '${g.name.replace(/'/g, "\\'")}')">WhatsApp</button>
                <button class="btn" onclick="downloadQR('${g.id}', '${g.name.replace(/'/g, "\\'")}')">Save QR</button>
            </div>
        `;
        grid.appendChild(card);

        setTimeout(() => {
            const el = document.getElementById(`qr-${g.id}`);
            if (el && typeof QRCode !== 'undefined') {
                new QRCode(el, { text: g.id, width: 150, height: 150 });
            }
        }, idx * 40);
    });
}

// ── WHATSAPP & DOWNLOAD ──────────────────────
async function shareToWhatsApp(id, name) {
    const el = document.getElementById(`qr-${id}`);
    const canvas = el.querySelector('canvas');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `Pass_${name}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Entry Pass', text: `Hello ${name}, here is your entry QR code.` });
    } else {
        alert('Sharing not supported. Please use the Save QR button.');
    }
}

function downloadQR(id, name) {
    const canvas = document.getElementById(`qr-${id}`).querySelector('canvas');
    const link = document.createElement('a');
    link.download = `${name}_QR.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// ── SCANNER LOGIC ─────────────────────────────
let isProcessing = false;
let scannerStream = null;

async function startScanner() {
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    if (guests.length === 0) return;

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = scannerStream;
        video.onloadedmetadata = () => video.play().catch(() => {});

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanLoop = () => {
            if (!isProcessing && video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height);

                if (code && code.data) {
                    isProcessing = true;
                    handleMatch(code.data);
                    setTimeout(() => { isProcessing = false; }, 3000); // 3s cooldown
                }
            }
            if (scannerStream) requestAnimationFrame(scanLoop);
        };
        scanLoop();
    } catch (err) { status.innerText = '❌ Camera error: ' + err.message; }
}

function stopScanner() {
    if (scannerStream) { scannerStream.getTracks().forEach(t => t.stop()); scannerStream = null; }
}

function handleMatch(scannedId) {
    const popup = document.getElementById('result-popup');
    const guest = guests.find(g => g.id === scannedId);

    popup.style.display = 'block';
    if (!guest) {
        popup.style.background = '#f8d7da';
        document.getElementById('res-name').innerText = '❌ Unknown Code';
        return;
    }

    if (checkins.includes(scannedId)) {
        popup.style.background = '#fff3cd';
        document.getElementById('res-name').innerText = '⚠ Already In';
        document.getElementById('res-detail').innerText = guest.name;
    } else {
        checkins.push(scannedId);
        saveAll();
        popup.style.background = '#d4edda';
        document.getElementById('res-name').innerText = '✅ Welcome';
        document.getElementById('res-detail').innerText = `${guest.name}\nInvited by: ${guest.info}`;
        if (navigator.vibrate) navigator.vibrate(200);
    }
}

// ── DASHBOARD ─────────────────────────────────
function updateDashboard() {
    const total = document.getElementById('total-count');
    const inCount = document.getElementById('in-count');
    const pending = document.getElementById('pending-count');
    if (total) total.innerText = guests.length;
    if (inCount) inCount.innerText = checkins.length;
    if (pending) pending.innerText = guests.length - checkins.length;
}

function downloadReport() {
    let csv = 'Name,Invited By,Status\n';
    guests.forEach(g => { csv += `"${g.name}","${g.info}",${checkins.includes(g.id) ? 'Present' : 'Absent'}\n`; });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Attendance.csv'; a.click();
}

function resetSystem() {
    if (confirm('Delete all data?')) { localStorage.clear(); location.reload(); }
}

updateDashboard();
if (document.getElementById('guest-grid')) renderGuests();
