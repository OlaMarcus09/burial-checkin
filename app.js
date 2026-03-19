// ══════════════════════════════════════════════
//  BURIAL SERVICE CHECK-IN — app.js
//
//  HOW IT WORKS:
//  Each QR code contains the guest's full details
//  as a JSON string, e.g:
//  {"n":"Babatunde Afolabi","i":"Adekunle"}
//
//  The scanner reads this JSON directly from the QR.
//  It does NOT need to look up anything in localStorage.
//  This means it works perfectly even if the scanner
//  phone has never had the CSV uploaded to it.
// ══════════════════════════════════════════════

let guests   = JSON.parse(localStorage.getItem('guests')   || '[]');
let checkins = JSON.parse(localStorage.getItem('checkins') || '[]');
// NOTE: checkins stores guest NAMES (not random IDs)
// so duplicate detection works across devices

// ── SAVE ──────────────────────────────────────
function saveAll() {
    localStorage.setItem('guests',   JSON.stringify(guests));
    localStorage.setItem('checkins', JSON.stringify(checkins));
    updateDashboard();
}

// ── CSV PARSER — handles quoted commas correctly ──
function parseCSVLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// ── CSV UPLOAD ────────────────────────────────
const csvInput = document.getElementById('csv-input');
if (csvInput) {
    csvInput.onchange = (e) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const lines   = event.target.result.split('\n');
            const headers = lines[0].toLowerCase();

            // Format A (entire family sheet):
            //   col: 0=Timestamp, 1=Attend, 2=HowMany, 3=InvitedBy, 4=Phone, 5=Email, 6=Name
            // Format B (form responses sheet):
            //   col: 0=Timestamp, 1=Attend, 2=HowMany, 3=InvitedBy, 4=Email
            const isFormatA = headers.includes('name');

            guests = lines.slice(1)
                .filter(l => l.trim().length > 5)
                .map((line, i) => {
                    const col = parseCSVLine(line);
                    let name, info, phone, email;

                    if (isFormatA) {
                        name  = (col[6] || col[5] || '').replace(/"/g, '').trim();
                        info  = (col[3] || 'General').replace(/"/g, '').trim();
                        phone = (col[4] || '').replace(/"/g, '').trim();
                        email = (col[5] || '').replace(/"/g, '').trim();
                    } else {
                        name  = (col[4] || '').replace(/"/g, '').trim();
                        info  = (col[3] || 'General').replace(/"/g, '').trim();
                        phone = '';
                        email = (col[4] || '').replace(/"/g, '').trim();
                    }

                    if (!name || name.length < 2) return null;

                    // ── KEY CHANGE ──
                    // The QR code contains this JSON string directly.
                    // Scanner reads n (name) and i (invitedBy) straight
                    // from the QR — no localStorage lookup at all.
                    const qrPayload = JSON.stringify({ n: name, i: info });

                    return { id: qrPayload, name, info, phone, email };
                })
                .filter(Boolean);

            saveAll();
            renderGuests();
            alert(`✓ ${guests.length} guests loaded! QR codes are generating...`);
        };
        reader.readAsText(e.target.files[0]);
    };
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
        const isChecked = checkins.includes(g.name);
        const card      = document.createElement('div');
        card.className  = `card ${isChecked ? 'checked-in' : ''}`;
        card.id         = `card-${idx}`;

        const safeName = g.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        card.innerHTML = `
            <h3>${g.name}</h3>
            <p><small>Invited by: <strong>${g.info}</strong></small></p>
            ${g.phone ? `<p><small>📞 ${g.phone}</small></p>` : ''}
            ${g.email ? `<p><small>✉️ ${g.email}</small></p>` : ''}
            <div class="qr-space" id="qr-${idx}"></div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-wa" onclick="shareToWhatsApp(${idx},'${safeName}')">WhatsApp</button>
                <button class="btn"        onclick="downloadQR(${idx},'${safeName}')">Save QR</button>
            </div>
        `;
        grid.appendChild(card);

        // Stagger QR generation so page doesn't freeze on large lists
        setTimeout(() => {
            const el = document.getElementById(`qr-${idx}`);
            if (!el) return;
            if (typeof QRCode === 'undefined') {
                el.innerHTML = '<p style="color:red;font-size:0.75rem;">qrcode.min.js not loaded</p>';
                return;
            }
            new QRCode(el, {
                text: g.id,   // JSON: {"n":"Guest Name","i":"InvitedBy"}
                width: 150,
                height: 150,
                colorDark:    '#1a1410',
                colorLight:   '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }, idx * 40);
    });
}

// ── WHATSAPP SHARE ────────────────────────────
async function shareToWhatsApp(idx, name) {
    const el = document.getElementById(`qr-${idx}`);
    if (!el) return alert('QR not found.');
    const canvas = el.querySelector('canvas');
    if (!canvas) return alert('QR not ready yet. Wait a moment and try again.');

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], `Pass_${name}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: 'Burial Service Entry Pass',
                text: `Hello ${name}, here is your QR code entry pass for the burial service.`
            });
        } catch (err) {
            if (err.name !== 'AbortError') console.error('Share error:', err);
        }
    } else {
        alert('Sharing not supported on this browser. Use the Save QR button instead.');
    }
}

// ── DOWNLOAD QR ───────────────────────────────
function downloadQR(idx, name) {
    const el = document.getElementById(`qr-${idx}`);
    if (!el) return;
    const canvas = el.querySelector('canvas');
    if (!canvas) return alert('QR not ready yet. Wait a moment.');
    const link    = document.createElement('a');
    link.download = `${name.replace(/[^a-z0-9]/gi, '_')}_QR.png`;
    link.href     = canvas.toDataURL();
    link.click();
}

// ══════════════════════════════════════════════
//  SCANNER
// ══════════════════════════════════════════════
let isProcessing  = false;
let scannerStream = null;

async function startScanner() {
    const video  = document.getElementById('video');
    const status = document.getElementById('status');
    if (!video || !status) return;

    status.innerText   = '📷 Starting camera…';
    status.style.color = '';

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        video.srcObject = scannerStream;
        video.onloadedmetadata = () => video.play().catch(() => {});

        status.innerText   = '✅ Scanning — point camera at a QR code';
        status.style.color = '#27ae60';

        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext('2d');

        const scanLoop = () => {
            if (!isProcessing && video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width  = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                const code = jsQR(
                    ctx.getImageData(0, 0, canvas.width, canvas.height).data,
                    canvas.width,
                    canvas.height,
                    { inversionAttempts: 'dontInvert' }
                );

                if (code && code.data) {
                    isProcessing = true;
                    handleMatch(code.data);
                    setTimeout(() => {
                        isProcessing = false;
                        status.innerText   = '✅ Scanning — point camera at a QR code';
                        status.style.color = '#27ae60';
                    }, 3000);
                }
            }
            if (scannerStream) requestAnimationFrame(scanLoop);
        };

        scanLoop();

    } catch (err) {
        status.innerText   = '❌ Camera error: ' + (err.message || 'Permission denied.');
        status.style.color = '#c0392b';
    }
}

function stopScanner() {
    if (scannerStream) {
        scannerStream.getTracks().forEach(t => t.stop());
        scannerStream = null;
    }
    const status = document.getElementById('status');
    if (status) { status.innerText = 'Scanner stopped.'; status.style.color = ''; }
}

// ── HANDLE SCAN ───────────────────────────────
// Reads guest name & invitedBy directly from the QR JSON.
// No localStorage guest list lookup needed at all.
function handleMatch(rawData) {
    const status    = document.getElementById('status');
    const popup     = document.getElementById('result-popup');
    const resName   = document.getElementById('res-name');
    const resDetail = document.getElementById('res-detail');

    let guestName = '';
    let invitedBy = '';

    try {
        const parsed = JSON.parse(rawData);
        guestName = (parsed.n || '').trim();
        invitedBy = (parsed.i || '').trim();
    } catch (e) {
        popup.style.display    = 'block';
        popup.style.background = '#f8d7da';
        popup.style.borderLeft = '5px solid #c0392b';
        resName.innerText   = '❌ Invalid QR Code';
        resDetail.innerText = 'This QR was not generated by this system.';
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        return;
    }

    if (!guestName) {
        popup.style.display    = 'block';
        popup.style.background = '#f8d7da';
        popup.style.borderLeft = '5px solid #c0392b';
        resName.innerText   = '❌ Empty QR Code';
        resDetail.innerText = 'No guest name found in this QR.';
        return;
    }

    popup.style.display = 'block';

    if (checkins.includes(guestName)) {
        popup.style.background = '#fff3cd';
        popup.style.borderLeft = '5px solid #f39c12';
        resName.innerText   = '⚠ Already Checked In';
        resDetail.innerText = `${guestName}\nPlease verify their identity.`;
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
        if (status) { status.innerText = `⚠ ${guestName} already checked in`; status.style.color = '#e67e22'; }
    } else {
        checkins.push(guestName);
        saveAll();
        popup.style.background = '#d4edda';
        popup.style.borderLeft = '5px solid #27ae60';
        resName.innerText   = '✅ Welcome!';
        resDetail.innerText = `${guestName}\nInvited by: ${invitedBy}`;
        if (navigator.vibrate) navigator.vibrate(200);
        if (status) { status.innerText = `✅ ${guestName} checked in!`; status.style.color = '#27ae60'; }
    }
}

// ── UTILS ─────────────────────────────────────
function updateDashboard() {
    const total   = document.getElementById('total-count');
    const inCount = document.getElementById('in-count');
    const pending = document.getElementById('pending-count');
    if (total)   total.innerText   = guests.length;
    if (inCount) inCount.innerText = checkins.length;
    if (pending) pending.innerText = guests.length - checkins.length;
}

function downloadReport() {
    let csv = 'Name,Invited By,Phone,Email,Status\n';
    guests.forEach(g => {
        const st = checkins.includes(g.name) ? 'Present' : 'Absent';
        csv += `"${g.name}","${g.info}","${g.phone || ''}","${g.email || ''}",${st}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Attendance_Report.csv'; a.click();
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
