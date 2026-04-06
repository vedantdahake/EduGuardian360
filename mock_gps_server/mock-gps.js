const express = require("express");
const fs = require("fs");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

let route = [];
let currentIndex = 0;

// Load the JSON route
try {
    const data = fs.readFileSync(path.join(__dirname, "../route.json"), "utf8");
    route = JSON.parse(data);
    console.log(`Loaded ${route.length} coordinates.`);
} catch (err) {
    console.error("Error loading route.json", err);
}

app.get("/gps", (req, res) => {
    if (route.length === 0) {
        return res.status(500).json({ error: "Route data not found" });
    }

    // OSRM provides coordinates as [lng, lat]
    const currentCoord = route[currentIndex];
    
    // Increment index to simulate moving, and loop back if we reach the end
    currentIndex++;
    if (currentIndex >= route.length) {
        currentIndex = 0;
    }

    res.json({
        lat: currentCoord[1],
        lng: currentCoord[0],
        index: currentIndex,
        total: route.length
    });
});

app.listen(4000, () => {
    console.log("Mock GPS Server running on port 4000 📡");
    console.log("Serving simulated route: Sri Aurobindo Hospital -> UEC");
});
