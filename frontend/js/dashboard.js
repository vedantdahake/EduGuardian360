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
    const viewDashboard = document.getElementById("view-dashboard");
    const viewContacts = document.getElementById("view-contacts");

    if (tabName === 'dashboard') {
        btnDashboard.className = "tab active";
        btnContacts.className = "tab inactive";
        viewDashboard.style.display = "grid";
        viewContacts.style.display = "none";
        
        // Fix leaflet map not rendering fully if initialized while hidden
        if (map) {
            setTimeout(() => map.invalidateSize(), 100);
        }
    } else {
        btnDashboard.className = "tab inactive";
        btnContacts.className = "tab active";
        viewDashboard.style.display = "none";
        viewContacts.style.display = "block";
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
                <div class="card alert-card danger" style="margin-bottom: 8px; padding: 12px; font-size: 14px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> 
                    <strong>SOS ALERT!</strong> ${alert.time}
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
