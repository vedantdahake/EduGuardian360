const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ---------------- DATABASE CONNECTION ----------------

mongoose.connect("mongodb+srv://ved_admin:ghost123@cluster0.7plz4s4.mongodb.net/eduguardian360")
.then(() => {
  console.log("MongoDB Connected ✅");

  // 🔥 START SERVER ONLY AFTER DB CONNECTS
  app.listen(3000, () => {
    console.log("Server running on port 3000 🚀");
  });

})
.catch(err => console.log("DB Error ❌", err));


// ---------------- BASIC SERVER TEST ----------------

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});


// ---------------- USER MODEL ----------------

const User = mongoose.model("User", {
  child_name: String,
  rfid: String,
  parent_name: String,
  bus_id: String
});


// ---------------- GET ALL USERS ----------------

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- LOGIN ----------------

app.post("/login", async (req, res) => {
  try {
    const { rfid, parent_name } = req.body;
    
    if (!rfid || !parent_name) {
      return res.status(400).json({ message: "RFID and Parent Name are required" });
    }

    const user = await User.findOne({ rfid: rfid });

    if (!user) {
      return res.status(404).json({ message: "Invalid RFID" });
    }

    // Case-insensitive comparison for parent name
    if (user.parent_name.trim().toLowerCase() !== parent_name.trim().toLowerCase()) {
      return res.status(401).json({ message: "Invalid Parent Name" });
    }

    res.json({
      message: "Login successful",
      user: user
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- RFID SCAN ----------------

app.get("/scan/:rfid", async (req, res) => {
  try {
    const user = await User.findOne({ rfid: req.params.rfid });

    if (!user) return res.json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- BUS MODEL ----------------

const Bus = mongoose.model("Bus", {
  bus_id: String,
  bus_number: String,
  driver_name: String,
  driver_phone: String
});

// ---------------- GET DRIVER INFO FOR PARENT ----------------

app.get("/driver-info/:parent_name", async (req, res) => {
  try {
    // 1. Find the child document associated with this parent
    const user = await User.findOne({ parent_name: req.params.parent_name });
    
    if (!user) return res.json({ message: "Parent not found in database" });

    // 2. Find the specific bus assigned to their child
    const bus = await Bus.findOne({ bus_id: user.bus_id });

    if (!bus) return res.json({ message: "No bus assigned to this child yet" });

    // 3. Return only exactly what the parent needs to see
    res.json({
      child_name: user.child_name,
      bus_number: bus.bus_number,
      driver_name: bus.driver_name,
      driver_phone: bus.driver_phone
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- LOCATION MODEL ----------------

const Location = mongoose.model("Location", {
  bus_id: String,
  lat: Number,
  lng: Number,
  status: String
});


// ---------------- TRACK ----------------

app.get("/track/:rfid", async (req, res) => {
  try {
    const user = await User.findOne({ rfid: req.params.rfid });

    if (!user) return res.json({ message: "User not found" });

    const bus = await Bus.findOne({ bus_id: user.bus_id });
    const location = await Location.findOne({ bus_id: user.bus_id });

    res.json({
      child: user.child_name,
      parent: user.parent_name,
      bus,
      location
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- UPDATE LOCATION ----------------

app.get("/update-location", async (req, res) => {
  try {
    const bus_id = req.query.bus_id || "bus_01";
    const lat = req.query.lat ? parseFloat(req.query.lat) : 23.30 + Math.random();
    const lng = req.query.lng ? parseFloat(req.query.lng) : 77.40 + Math.random();
    
    await Location.updateOne(
      { bus_id: bus_id },
      {
        lat: lat,
        lng: lng,
        status: "moving"
      }
    );

    res.send("Location updated 🚀");
  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- SOS MODEL ----------------

const SOS = mongoose.model("SOS", {
  bus_id: String,
  message: String,
  time: String,
  status: String
});


// ---------------- SOS TRIGGER ----------------

app.get("/sos/:bus_id", async (req, res) => {
  try {
    const bus_id = req.params.bus_id;

    const sos = new SOS({
      bus_id,
      message: "Emergency Button Pressed!",
      time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      status: "active"
    });

    await sos.save();

    const users = await User.find({ bus_id });

    const parents = users.map(u => ({
      child: u.child_name,
      parent: u.parent_name
    }));

    res.json({
      alert: "SOS Broadcasted 🚨",
      bus_id,
      notified_parents: parents
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- GET SOS ----------------

app.get("/sos", async (req, res) => {
  try {
    const alerts = await SOS.find({ status: "active" });
    res.json(alerts);
  } catch (err) {
    res.json({ error: err.message });
  }
});



// ---------------- GET SOS HISTORY ----------------

app.get("/sos/history/:bus_id", async (req, res) => {
  try {
    const history = await SOS.find({ bus_id: req.params.bus_id }).sort({ _id: -1 });
    res.json(history);
  } catch (err) {
    res.json({ error: err.message });
  }
});

// ---------------- ATTENDANCE ----------------

const Attendance = mongoose.model("Attendance", {
  rfid: String,
  child_name: String,
  bus_id: String,
  status: String,
  time: String
});


app.get("/scan-entry/:rfid", async (req, res) => {
  try {
    const user = await User.findOne({ rfid: req.params.rfid });

    if (!user) return res.json({ message: "User not found" });

    const last = await Attendance.findOne({ rfid: req.params.rfid }).sort({ time: -1 });

    let newStatus = "IN";
    if (last && last.status === "IN") newStatus = "OUT";

    const record = new Attendance({
      rfid: req.params.rfid,
      child_name: user.child_name,
      bus_id: user.bus_id,
      status: newStatus,
      time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    });

    await record.save();

    res.json({
      message: "Attendance recorded",
      child: user.child_name,
      status: newStatus,
      time: record.time
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});


// ---------------- GET ATTENDANCE ----------------

app.get("/attendance", async (req, res) => {
  try {
    const data = await Attendance.find().sort({ time: -1 });
    res.json(data);
  } catch (err) {
    res.json({ error: err.message });
  }
});


// ================ ADMIN ROUTES ================

// ---------------- ADMIN: ADD STUDENT ----------------

app.post("/admin/add-student", async (req, res) => {
  try {
    const { rfid, child_name, parent_name, bus_id } = req.body;
    if (!rfid || !child_name || !parent_name || !bus_id) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const existing = await User.findOne({ rfid });
    if (existing) {
      return res.status(409).json({ error: "RFID already registered" });
    }
    const user = new User({ rfid: rfid.toUpperCase(), child_name, parent_name, bus_id });
    await user.save();
    res.json({ message: "Student added successfully ✅", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- ADMIN: ADD BUS ----------------

app.post("/admin/add-bus", async (req, res) => {
  try {
    const { bus_id, bus_number, driver_name, driver_phone } = req.body;
    if (!bus_id || !bus_number || !driver_name || !driver_phone) {
      return res.status(400).json({ error: "All fields are required" });
    }
    await Bus.updateOne(
      { bus_id },
      { bus_id, bus_number, driver_name, driver_phone },
      { upsert: true }
    );
    res.json({ message: "Bus info saved successfully ✅", bus_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---------------- ADMIN: UPDATE SOS STATUS ----------------

app.patch("/admin/sos/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["active", "passive"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'active' or 'passive'" });
    }
    const updated = await SOS.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "SOS alert not found" });
    res.json({ message: `SOS marked as ${status} ✅`, alert: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});