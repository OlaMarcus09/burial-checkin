// ══════════════════════════════════════════════
//  BURIAL SERVICE CHECK-IN SYSTEM — app.js
// ══════════════════════════════════════════════

let guests = JSON.parse(localStorage.getItem('guests') || '[]');
let checkins = JSON.parse(localStorage.getItem('checkins') || '[]');

// ── SAVE ──────────────────────────────────────
function saveAll() {
    localStorage.setItem('guests', JSON.stringify(guests));
    localStorage.setItem('checkins', JSON.stringify(checkins));
    updateDashboard();
}

// ── CSV PARSING (FIXED: correct column indices) ──
const csvInput = document.getElementById('csv-input');
if (csvInput) {
    csvInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines = event.target.result.split('\n');
            const headers = lines[0].toLowerCase();

            // Detect which CSV format was uploaded
            // Format A (entire family): Timestamp, Can you attend, How many, Invited by, Phone, Email, Name
            // Format B (form responses): Timestamp, Can you attend, How many, Invited by, Email
            const isFormatA = headers.includes('name');

            guests = lines.slice(1)
                .filter(l => l.trim().length > 5)
                .map((line, i) => {
                    const col = parseCSVLine(line);

                    let name, info, phone, email;

                    if (isFormatA) {
                        // Format A columns: 0=Timestamp, 1=Attend, 2=HowMany, 3=InvitedBy, 4=Phone, 5=Email, 6=Name
                        name  = (col[6] || col[5] || `Guest ${i + 1}`).replace(/"/g, '').trim();
                        info  = (col[3] || 'General').replace(/"/g, '').trim();
                        phone = (col[4] || '').replace(/"/g, '').trim();
                        email = (col[5] || '').replace(/"/g, '').trim();
                    } else {
                        // Format B columns: 0=Timestamp, 1=Attend, 2=HowMany, 3=InvitedBy, 4=Email
                        name  = (col[4] || `Guest ${i + 1}`).replace(/"/g, '').trim();
                        info  = (col[3] || 'General').replace(/"/g, '').trim();
                        phone = '';
                        email = (col[4] || '').replace(/"/g, '').trim();
                    }

                    if (!name || name.length < 2) return null;

                    return {
                        id: `guest_${i}_${Date.now()}`,  // FIXED: generate clean unique ID
                        name,
                        info,
                        phone,
                        email
                    };
                })
                .filter(Boolean); // remove nulls

            saveAll();
            renderGuests();
            alert(`✓ Loaded ${guests.length} guests successfully!`);
        };
        reader.readAsText(e.target.files[0]);
    };
}

// Proper CSV line parser (handles quoted commas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// ── RENDER GUEST CARDS ────────────────────────
function renderGuests() {
    const grid = document.getElementById('guest-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (guests.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#888;padding:40px;">No guests loaded. Upload a CSV file.</p>';
        return;
    }

    guests.forEach((g, idx) => {
        const isChecked = checkins.includes(g.id);
        const card = document.createElement('div');
        card.className = `card ${isChecked ? 'checked-in' : ''}`;
        card.id = `card-${g.id}`;
        card.innerHTML = `
            <h3>${g.name}</h3>
            <p><small>Invited by: <strong>${g.info}</strong></small></p>
            ${g.phone ? `<p><small>📞 ${g.phone}</small></p>` : ''}
            ${g.email ? `<p><small>✉️ ${g.email}</small></p>` : ''}
            <div class="qr-space" id="qr-${g.id}"></div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-wa" onclick="shareToWhatsApp('${g.id}', '${g.name.replace(/'/g, "\\'")}')">WhatsApp</button>
                <button class="btn" onclick="downloadQR('${g.id}', '${g.name.replace(/'/g, "\\'")}')">Save QR</button>
            </div>
        `;
        grid.appendChild(card);

        // Stagger QR generation so page doesn't freeze
        setTimeout(() => {
            const el = document.getElementById(`qr-${g.id}`);
            if (el && typeof QRCode !== 'undefined') {
                new QRCode(el, {
                    text: g.id,           // QR encodes the guest ID
                    width: 150,
                    height: 150,
                    colorDark: '#1a1410',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }, idx * 40);
    });
}

// ── WHATSAPP SHARE ────────────────────────────
async function shareToWhatsApp(id, name) {
    const el = document.getElementById(`qr-${id}`);
    if (!el) return alert('QR not found. Wait for QRs to finish generating.');
    const canvas = el.querySelector('canvas');
    if (!canvas) return alert('QR not ready yet. Wait a moment and try again.');

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `Pass_${name}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'Burial Service Entry Pass',
                text: `Hello ${name}, please find your entry QR code for the burial service attached.`
            });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share error:', err);
        }
    } else {
        alert('Sharing not supported on this browser. Use Chrome or Safari on mobile, or use the Save QR button instead.');
    }
}

// ── DOWNLOAD QR ───────────────────────────────
function downloadQR(id, name) {
    const el = document.getElementById(`qr-${id}`);
    if (!el) return;
    const canvas = el.querySelector('canvas');
    if (!canvas) return alert('QR not ready yet.');
    const link = document.createElement('a');
    link.download = `${name.replace(/[^a-z0-9]/gi, '_')}_QR.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// ══════════════════════════════════════════════
//  SCANNER  (FIXED: cooldown + empty data warn)
// ══════════════════════════════════════════════
let isProcessing = false;  // FIXED: prevents flood of repeated scans
let scannerStream = null;

async function startScanner() {
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    if (!video || !status) return;

    // FIXED: warn immediately if no guest data is loaded
    if (guests.length === 0) {
        status.innerText = '⚠ No guest data found. Go to the Generator page and upload your CSV first.';
        status.style.color = '#c0392b';
        return;
    }

    status.innerText = `📷 Starting camera… (${guests.length} guests loaded)`;

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        video.srcObject = scannerStream;

        // Let the browser autoplay handle it — calling .play() manually
        // throws a DOMException on some Android browsers
        video.onloadedmetadata = () => video.play().catch(() => {});

        status.innerText = '✅ Scanning — point camera at a QR code';
        status.style.color = '#27ae60';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const scanLoop = () => {
            // FIXED: only process one frame at a time, with a 3s cooldown between scans
            if (!isProcessing && video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, canvas.width, canvas.height, {
                    inversionAttempts: 'dontInvert'
                });

                if (code && code.data) {
                    isProcessing = true;
                    handleMatch(code.data);
                    setTimeout(() => {
                        isProcessing = false;
                        status.innerText = '✅ Scanning — point camera at a QR code';
                        status.style.color = '#27ae60';
                    }, 3000); // 3 second cooldown before next scan
                }
            }
            requestAnimationFrame(scanLoop);
        };

        scanLoop();

    } catch (err) {
        console.error('Camera error:', err);
        status.innerText = '❌ Camera error: ' + (err.message || 'Permission denied. Please allow camera access.');
        status.style.color = '#c0392b';
    }
}

function stopScanner() {
    if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
        scannerStream = null;
    }
    const status = document.getElementById('status');
    if (status) status.innerText = 'Scanner stopped.';
}

// ── HANDLE SCAN MATCH ─────────────────────────
function handleMatch(scannedId) {
    const status = document.getElementById('status');
    const popup = document.getElementById('result-popup');

    // FIXED: guard against empty guest list
    if (guests.length === 0) {
        status.innerText = '⚠ No guests loaded. Go to Generator and upload CSV first.';
        return;
    }

    const guest = guests.find(g => g.id === scannedId);
    if (!guest) {
        // QR exists but not in guest list
        popup.style.display = 'block';
        popup.style.background = '#f8d7da';
        popup.style.borderLeft = '5px solid #c0392b';
        document.getElementById('res-name').innerText = '❌ Not on Guest List';
        document.getElementById('res-detail').innerText = 'This QR code was not found in the RSVP data.';
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        if (status) { status.innerText = '❌ Unknown QR scanned'; status.style.color = '#c0392b'; }
        return;
    }

    popup.style.display = 'block';

    if (checkins.includes(scannedId)) {
        // Already checked in
        popup.style.background = '#fff3cd';
        popup.style.borderLeft = '5px solid #f39c12';
        document.getElementById('res-name').innerText = '⚠ Already Checked In';
        document.getElementById('res-detail').innerText = `${guest.name} — please verify identity.`;
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        if (status) { status.innerText = `⚠ ${guest.name} already checked in`; status.style.color = '#e67e22'; }
    } else {
        // First check-in — success
        checkins.push(scannedId);
        saveAll();
        popup.style.background = '#d4edda';
        popup.style.borderLeft = '5px solid #27ae60';
        document.getElementById('res-name').innerText = `✅ Welcome!`;
        document.getElementById('res-detail').innerText = `${guest.name}\nInvited by: ${guest.info}`;
        if (navigator.vibrate) navigator.vibrate(200);
        if (status) { status.innerText = `✅ ${guest.name} checked in!`; status.style.color = '#27ae60'; }

        // Highlight card on generator page if open
        const card = document.getElementById(`card-${scannedId}`);
        if (card) card.classList.add('checked-in');
    }
}

// ── UTILS ─────────────────────────────────────
function updateDashboard() {
    const total = document.getElementById('total-count');
    const inCount = document.getElementById('in-count');
    const pending = document.getElementById('pending-count');
    if (total) total.innerText = guests.length;
    if (inCount) inCount.innerText = checkins.length;
    if (pending) pending.innerText = guests.length - checkins.length;
}

function downloadReport() {
    let csv = 'Name,Invited By,Phone,Email,Status\n';
    guests.forEach(g => {
        const status = checkins.includes(g.id) ? 'Present' : 'Absent';
        csv += `"${g.name}","${g.info}","${g.phone || ''}","${g.email || ''}",${status}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Attendance_Report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

function resetSystem() {
    if (confirm('This will delete ALL guests and check-in records. Are you sure?')) {
        localStorage.clear();
        location.reload();
    }
}

// ── INIT ──────────────────────────────────────
updateDashboard();
if (document.getElementById('guest-grid')) renderGuests();
