let map;
let marker;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Session Check
    const rfid = localStorage.getItem("user_rfid");
    const parentName = localStorage.getItem("parent_name");
    
    if (!rfid || !parentName) {
        window.location.href = "index.html";
        return;
    }

    // 2. Initial DOM Setup
    document.getElementById("welcomeMessage").innerText = `Welcome, ${parentName}`;
    document.getElementById("childNameTitle").innerText = localStorage.getItem("child_name") || "Student";
    document.getElementById("rfidDisplay").innerText = `Tag: ${rfid}`;
    document.getElementById("busDisplay").innerText = `Bus: ${localStorage.getItem("bus_id") || "--"}`;

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "index.html";
    });

    // 3. Fetch Initial Data & Init Map
    await fetchTrackingData(rfid);

    // 4. Set interval for live updates (every 5 seconds)
    setInterval(() => fetchTrackingData(rfid), 5000);
});

// Tab Switcher Logic
window.switchTab = function(tabName) {
    const btnDashboard = document.getElementById("tab-dashboard");
    const btnContacts = document.getElementById("tab-contacts");
    const btnSoshistory = document.getElementById("tab-soshistory");
    const viewDashboard = document.getElementById("view-dashboard");
    const viewContacts = document.getElementById("view-contacts");
    const viewSoshistory = document.getElementById("view-soshistory");

    if (tabName === 'dashboard') {
        btnDashboard.className = "tab active";
        btnContacts.className = "tab inactive";
        if(btnSoshistory) btnSoshistory.className = "tab inactive";
        viewDashboard.style.display = "grid";
        viewContacts.style.display = "none";
        if(viewSoshistory) viewSoshistory.style.display = "none";
        
        // Fix leaflet map not rendering fully if initialized while hidden
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    } else if (tabName === 'contacts') {
        btnDashboard.className = "tab inactive";
        btnContacts.className = "tab active";
        if(btnSoshistory) btnSoshistory.className = "tab inactive";
        viewDashboard.style.display = "none";
        viewContacts.style.display = "block";
        if(viewSoshistory) viewSoshistory.style.display = "none";
    } else if (tabName === 'soshistory') {
        btnDashboard.className = "tab inactive";
        btnContacts.className = "tab inactive";
        if(btnSoshistory) btnSoshistory.className = "tab active";
        viewDashboard.style.display = "none";
        viewContacts.style.display = "none";
        if(viewSoshistory) viewSoshistory.style.display = "block";
        
        // Fetch history data
        const currentBusId = localStorage.getItem("bus_id");
        if (currentBusId) {
            fetchSosHistory(currentBusId);
        }
    }
}

// Fetch Data from Backend
async function fetchTrackingData(rfid) {
    try {
        const response = await fetch(`http://localhost:3000/track/${rfid}`);
        const data = await response.json();

        if (data.bus) {
            document.getElementById("driverNameTitle").innerText = data.bus.driver_name;
            document.getElementById("driverPhoneSpan").innerText = data.bus.driver_phone;
        }

        if (data.location && data.location.lat && data.location.lng) {
            updateMap(data.location.lat, data.location.lng, data.location.status);
        }

        // Fetch attendance status
        const attResponse = await fetch(`http://localhost:3000/attendance`);
        const attData = await attResponse.json();
        const myAtt = attData.filter(a => a.rfid === rfid);
        
        if (myAtt.length > 0) {
            // Find the latest IN and OUT
            const latest = myAtt[0];
            const isBoarded = latest.status === "IN";
            
            if (isBoarded) {
                document.getElementById("boardedStatusCol").className = "status-indicator status-green";
                document.getElementById("boardedStatusText").innerText = `${latest.time}`;
                document.getElementById("droppedStatusCol").className = "status-indicator status-gray";
                document.getElementById("droppedStatusText").innerText = "Not yet";
            } else {
                // If latest is OUT, they dropped off. Let's find the IN before it.
                document.getElementById("boardedStatusCol").className = "status-indicator status-green";
                document.getElementById("boardedStatusText").innerText = "Completed";
                document.getElementById("droppedStatusCol").className = "status-indicator status-green";
                document.getElementById("droppedStatusText").innerText = `${latest.time}`;
            }
        }

        // Fetch SOS alerts
        const sosResponse = await fetch(`http://localhost:3000/sos`);
        const sosData = await sosResponse.json();
        const alertsContainer = document.getElementById("alertsContainer");
        
        // Filter alerts for our bus
        const myAlerts = sosData.filter(s => s.bus_id === data.bus.bus_id && s.status === "active");
        
        if (myAlerts.length > 0) {
            let html = '';
            myAlerts.forEach(alert => {
                html += `
                <div class="card alert-card danger" style="margin-bottom: 8px; padding: 12px; font-size: 14px; position:relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <i class="fa-solid fa-triangle-exclamation"></i> <strong>SOS ALERT!</strong><br>
                            <span style="font-size:12px; opacity:0.9">${alert.time}</span>
                        </div>
                    </div>
                </div>`;
            });
            alertsContainer.innerHTML = html;
        } else {
            alertsContainer.innerHTML = `
            <div class="card alert-card" style="margin-bottom: 0; padding: 12px; font-size: 14px; background-color: #f0fdf4; border-color: #bbf7d0; color: #166534;">
                <i class="fa-solid fa-check-circle"></i> No active alerts. Everything is normal.
            </div>`;
        }

    } catch (error) {
        console.error("Failed to fetch tracking data", error);
    }
}

// Update Map Position
function updateMap(lat, lng, status) {
    if (!map) {
        // Initialize Map
        map = L.map('map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Custom Bus Icon
        const busIcon = L.icon({
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        marker = L.marker([lat, lng], {icon: busIcon}).addTo(map)
            .bindPopup(`<b>Bus Location</b><br/>Status: ${status}`)
            .openPopup();
    } else {
        // Update existing map
        map.setView([lat, lng]);
        marker.setLatLng([lat, lng]);
        marker.setPopupContent(`<b>Bus Location</b><br/>Status: ${status}`);
    }
}

// Fetch SOS History
async function fetchSosHistory(bus_id) {
    const container = document.getElementById("sosHistoryContainer");
    container.innerHTML = `<div class="card" style="padding: 12px; font-size: 14px; color: var(--text-light);">Loading history...</div>`;
    
    try {
        const response = await fetch(`http://localhost:3000/sos/history/${bus_id}`);
        const data = await response.json();
        
        if (data.length === 0) {
            container.innerHTML = `<div class="card" style="padding: 12px; font-size: 14px; color: var(--text-light);">No SOS records found for this bus.</div>`;
            return;
        }
        
        let html = '';
        data.forEach(alert => {
            const isPassive = alert.status === "passive";
            const borderStyle = isPassive ? 'border-left: 4px solid var(--text-light);' : 'border-left: 4px solid var(--red);';
            const statusBadge = isPassive 
                ? '<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px; float:right; border:1px solid #e2e8f0; color: #64748b; font-weight: 500;">Passive</span>'
                : '<span style="background:var(--red); color: white; padding:2px 6px; border-radius:4px; font-size:11px; float:right; font-weight: 500;">Active</span>';
                
            html += `
            <div class="card" style="padding: 15px; margin-bottom: 0px; ${borderStyle}">
                ${statusBadge}
                <div style="font-weight: 600; margin-bottom:4px;">
                    ${isPassive ? '<i class="fa-solid fa-clock-rotate-left" style="color:var(--text-light)"></i>' : '<i class="fa-solid fa-triangle-exclamation" style="color:var(--red)"></i>'} 
                    SOS Trigger
                </div>
                <div style="font-size: 13px; color: var(--text-light);">
                    ${alert.time}
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        
    } catch (err) {
        console.error("Failed to load history", err);
        container.innerHTML = `<div class="card" style="padding: 12px; font-size: 14px; color: var(--red);">Error loading history.</div>`;
    }
}
