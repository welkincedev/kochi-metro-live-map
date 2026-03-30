# 🚇 Kochi Metro Geo-Live Operations Display — v2.52

A high-fidelity, data-driven metro visualization system that transforms official GTFS data into a **real-time, geographically accurate transit operations dashboard**.

---

## 🌍 Overview

Version **2.52** introduces major improvements in **direction clarity, station interaction, and operational realism**, evolving the system into a more intuitive and production-ready metro display.

This project focuses on **accuracy over simulation**, ensuring all train movements and station data are derived strictly from timetable logic.

---

## 🧠 Data Engine

* **GTFS-Based Architecture**
  Built on official transit datasets (`stops`, `stop_times`, `trips`, `shapes`, `fare`).

* **Preprocessing Pipeline**
  `preprocess.js` converts raw GTFS CSV into optimized JSON:

  * `stations.json`
  * `trips.json`
  * `shapes.json`
  * `fares.json`

* **Service-Aware Filtering**
  Automatically detects weekday/weekend schedules.

* **Time Normalization**
  Uses `arrival_s` and `departure_s` for precise calculations.

---

## 🗺️ Geo-Live Map

* **Leaflet-Powered Map View**
  Real geographic visualization with dark theme.

* **Accurate Track Rendering**
  Uses `shapes.json` to follow real metro curvature.

* **60 FPS Train Movement**

  * Smooth interpolation using `requestAnimationFrame`
  * Real-time position based on timetable

---

## 🚆 Direction System (v2.52 Upgrade)

Direction is now **fully corrected and intuitive**:

| Direction  | Destination    | Color   | Platform   |
| ---------- | -------------- | ------- | ---------- |
| Northbound | Aluva          | #00ffd2 | Platform 1 |
| Southbound | Thrippunithura | Lime    | Platform 2 |

* Train numbers replaced with **destination labels**
* Visual clarity improved using:

  * Color coding
  * Directional movement

---

## 🚉 Station Interaction (Improved)

* Click any station (Map View or Line View) to:

  * View live departures
  * See platform-based grouping

* **Unified behavior across views**
  (Map and Line now behave consistently)

---

## 📊 Platform-Based Departure System (NEW)

Each station displays departures like a real metro:

### Platform 1 — Aluva (Northbound)

* Next 3 departures

### Platform 2 — Thrippunithura (Southbound)

* Next 3 departures

* Color-coded for quick identification

* Clean, minimal layout

---

## 📏 Line View (Horizontal Layout)

* Stations arranged:
  **Aluva → Thrippunithura (Left → Right)**

* Fully interactive:

  * Click stations → show timetable
  * Trains move correctly along axis

* Synced with Map View logic

---

## 💰 Fare Calculator

* Select:

  * From station
  * To station

* Displays:

  * Fare (₹)
  * Based on official fare matrix

---

## 🎟 Ticketing Integration (Updated)

* WhatsApp-based booking support:

📱 **Book via WhatsApp:**
`+91 88957 48848`

* Pre-filled message for quick access

---

## 🎨 UI / UX Design

* Glassmorphic station elements
* Neon-inspired metro theme
* Clean, minimal interface

### Improvements in v2.52:

* Removed unnecessary Station HUD
* Reduced visual clutter
* Improved direction understanding
* Consistent interaction model

---

## ⚙️ Performance Optimizations

* Active trip filtering (only current trains rendered)
* Efficient animation loop (`requestAnimationFrame`)
* Lightweight architecture (no heavy frameworks)

---

## 📱 Responsive Design

* Mobile-first layout
* Horizontal scroll support
* Optimized for low-end devices

---

## 🛠 Tech Stack

* HTML5
* CSS3 (Custom Properties)
* JavaScript (ES6 Modules)
* Leaflet.js

---

## 📂 Project Structure

```id="w8t3me"
/data
  stations.json
  trips.json
  shapes.json
  fares.json

index.html
style.css
app.js
preprocess.js
```

---

## 🚀 Getting Started

1. Clone the repository

2. (Optional) Process GTFS data:

```id="c7kjq1"
node preprocess.js
```

3. Open:

```id="m5lqz9"
index.html
```

---

## 💡 Usage Tips

* Click any station to view live departures
* Use Map / Line toggle for different perspectives
* Use fare calculator for quick trip cost

---

## 🎯 Project Goal

To build a **real-time metro operations display** that is:

* Accurate
* Intuitive
* Performant
* Production-ready

---

## 🔮 Future Enhancements

* Train identification system
* Network load analytics
* Heatmap visualization
* PWA support

---

## 📜 License

Uses publicly available transit data.
Verify usage permissions before commercial deployment.

---

## 🙌 Acknowledgements

* Kochi Metro Rail Limited (KMRL)
* OpenStreetMap contributors
* Leaflet.js community

---
