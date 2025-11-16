# 🚇 Kochi Metro Live Board  
A real-time metro tracking UI with animated train movement, station LEDs, and dynamic timetable logic.  
Inspired by MetroBoard (Instagram) — recreated from scratch with clean animations, modern UI, and real Kochi Metro timings.

---

## 📱 Overview

**Kochi Metro Live Board** is a fully animated, web-based metro information display that visualizes real-time train movement between all 24 Kochi Metro stations.

It includes:

- 🟦 Real-time animated train movement  
- 🟩 Separate UP (right) and DOWN (left) track lines  
- 🔵 Smooth cyan train-dot animation  
- 🟢 LED glow for active stations  
- ⚪ Real metro-style capsules  
- 📄 Timetable converted from Kochi Metro's official timings  
- 🌙 Designed for mobile-first usage  
- 🎨 Metro-inspired UI design from scratch  

This project is designed to feel like a **live metro operations screen**, built entirely in HTML, CSS, and JavaScript.

---

## 🤝 Contributing

Suggestions, feature ideas, and improvements are welcome.  
You can open an Issue or PR directly in this repository.

---

## ⭐ Support

If you found this project interesting or useful, please consider giving it a **⭐ star**.  
It helps the project grow and motivates further improvements.

---

## 🎯 Purpose

This project demonstrates:

- Real-time animation  
- Front-end UI engineering  
- Timetable-based data modeling  
- CSS metro-style layout building  
- Smooth DOM interpolation  
- Clean and responsive design  
- A complete “product-like” implementation  

---

## 🎨 Inspiration

Inspired by:

- **MetroBoard (Instagram)** → for the visual concept  
- **Kochi Metro Rail Ltd. (KMRL)** → for exact timetable references  

All logic, styling, animations, and implementation were engineered independently.

---

## 🧠 How It Works

### 1. The timetable (`schedule.json`)
Contains:
- Station list  
- Every train trip (UP and DOWN directions)  
- Arrival and departure times converted into **seconds of the day**

### 2. The animation engine (`app.js`)
Every second, it:

✔ Clears old train positions  
✔ Calculates where each train should be  
✔ Interpolates position between stations  
✔ Animates the blue train-dot  
✔ Lights the correct LED based on direction  

### 3. UI Layer (`style.css`)
Handles:
- Capsules  
- Track lines (UP → right, DOWN → left)  
- LED glow states  
- Blue train movement  
- Responsive layout  

---

## 🛠️ Tech Stack

| Layer         | Technology                      |
|---------------|---------------------------------|
| UI            | HTML5                           |
| Styling       | CSS3                            |
| Logic         | JavaScript                      |
| Data          | JSON (Kochi Metro schedule)     |
| Animation     | DOM interpolation + timing loop |
| Compatibility | Fully mobile-responsive         |

---

## 📂 Project Structure

/index.html → Main document
/style.css → Metro UI theme + animations
/app.js → Real-time train animation engine
/schedule.json → Kochi Metro timetable (formatted)

---

## 📸 Screenshots  
(Add your own UI screenshots here after deploying)

---

## 📱 Future Roadmap (Mobile App Version)

Planned enhancements:

- 🚆 Live countdown per station  
- 🔊 Arrival voice announcements  
- 🌐 Real API for timetable updates  
- 🎨 Theme selector (Neon / Classic / Minimal)  
- 🗺️ Interactive Kochi Metro route map  
- ⭐ Favorite station bookmarking  
- 📍 Nearest station detection (GPS)  

Open to suggestions and feature requests!

---

## 🧩 Why This Project Stands Out

- Built fully from scratch  
- Real-time logic — not a static UI  
- Uses real train schedules  
- High-performance animation  
- Clean metro-themed interface  
- Perfect for recruiters and portfolio showcases  
- Expandable into a real mobile application  

---

## 🙏 Credits

- **KMRL (Kochi Metro Rail Ltd.)** — timetable reference  
- **MetroBoard (Instagram)** — visual inspiration  

All code, graphics, and animations created by me.

---

## 📬 Contact

**GitHub:** (your profile link)  
**LinkedIn:** (your LinkedIn link)  
**Instagram:** (optional)