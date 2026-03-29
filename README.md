# 🚇 Kochi Metro Geo-Live Operations Display

A high-fidelity, data-driven metro visualization system that transforms official GTFS data into a **real-time, geographically accurate transit operations dashboard**.

---

## 🌍 Overview

This project recreates the Kochi Metro network as a **live operational display**, combining real timetable data with geographic mapping to simulate actual train movement across the city.

It is designed to feel like a **control-room interface**, prioritizing accuracy, clarity, and performance over decorative simulation.

---

## 🧠 Data Engine

* **GTFS-Based Architecture**
  Built on official transit datasets including stops, trips, stop_times, shapes, and fare data.

* **Preprocessing Pipeline**
  A custom script (`preprocess.js`) converts raw GTFS CSV files into optimized JSON for fast client-side rendering.

* **Service-Aware Logic**
  Automatically detects weekday/weekend schedules and filters trips accordingly.

* **Time Normalization**
  Converts timetable data into seconds (`arrival_s`, `departure_s`) for precise calculations.

---

## 🗺️ Geo-Live Map

* **Geographic Accuracy**
  Uses real latitude/longitude coordinates and track geometry to match Kochi’s metro alignment.

* **Leaflet Integration**
  Interactive dark-mode map with station markers and glowing track paths.

* **Real-Time Train Movement**

  * Smooth 60fps interpolation using `requestAnimationFrame`
  * Trains follow real curved paths from GTFS `shapes.txt`

---

## 🚆 Train State System

Each train behaves based on real timetable logic:

* **At Station**

  * Train docks at station marker
  * Subtle pulsing animation indicates dwell time

* **In Transit**

  * Smooth movement between stations
  * Position calculated from departure → next arrival

* **Inactive**

  * Trains not within the active time window are not rendered

---

## 📊 Station Intelligence

* **Interactive Station Selection**

  * Click any station to view live data

* **Departure Board**

  * Displays next 3 departures
  * Split by direction:

    * **Northbound → Aluva**
    * **Southbound → Tripunithura**

---

## 💰 Fare Calculator

* Select origin and destination stations

* Instantly view:

  * Fare (₹)
  * Estimated travel context

* Powered by preprocessed fare matrix from GTFS data

---

## 🎟 Ticketing Integration

Includes a direct link to the official Kochi Metro ticketing platform for real-world usage.

---

## 🔄 Dual View System

* **Map View** → Real geographic visualization
* **Line View** → Abstract horizontal metro diagram

---

## 📱 Responsive Design

* Mobile-first layout
* Horizontal scrolling support
* Optimized for low-end devices

---

## ⚙️ Performance Optimizations

* Active trip filtering (only renders relevant trains)
* Efficient animation loop using `requestAnimationFrame`
* Lightweight vanilla JavaScript (no heavy frameworks)

---

## 🛠 Tech Stack

* HTML5
* CSS3 (Custom Properties, Glassmorphism UI)
* JavaScript (ES6 Modules)
* Leaflet.js

---

## 📂 Data Structure

```
/data
  stations.json
  trips.json
  shapes.json
  fares.json
```

---

## 🚀 Getting Started

1. Clone the repository
2. Run preprocessing (if using raw GTFS):

```
node preprocess.js
```

3. Open `index.html` in your browser

---

## 💡 Usage Tip

Click on any station marker to instantly view the **next upcoming trains**, fully synced with the official schedule.

---

## 🎯 Project Goal

To build a **real-time metro operations display** that is:

* Accurate
* Performant
* Intuitive
* Visually refined

---

## 🔮 Future Enhancements

* Train identification system
* Network load analytics
* Map-based congestion heatmap
* Progressive Web App (PWA) support

---

## 📜 License

This project uses publicly available transit data.
Please verify usage rights before commercial deployment.

---

## 🙌 Acknowledgements

* Kochi Metro Rail Limited (KMRL) for open data
* OpenStreetMap contributors
* Leaflet.js community

---
