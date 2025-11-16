let stations = [];
let trips = {};
let upTrack, downTrack;

// Load JSON
fetch("schedule.json")
    .then(r => r.json())
    .then(data => {
        stations = data.stations;
        trips = data.trips;

        buildStationUI();
        setInterval(updateTrains, 500);
    });

/* ------------------------------
   BUILD UI
--------------------------------*/
function buildStationUI() {
    const list = document.getElementById("station-list");
    list.innerHTML = "";

    upTrack = document.getElementById("track-up");
    downTrack = document.getElementById("track-down");

    stations.forEach(st => {
        let div = document.createElement("div");
        div.className = "station";

        div.innerHTML = `
            <div class="station-capsule" data-id="${st.stop_id}">
                <div class="led led-down"></div>
                <div class="station-name">${st.stop_name}</div>
                <div class="led led-up"></div>
            </div>
        `;

        list.appendChild(div);
    });
}



/* ------------------------------
   UPDATE TRAINS
--------------------------------*/
function updateTrains() {
    let now = getSeconds();

    clearLEDs();
    clearDots();

    for (let tripName in trips) {
        animateTrip(trips[tripName], now);
    }

}

function getSeconds() {
    let t = new Date();
    return t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
}

function clearLEDs() {
    document.querySelectorAll(".led").forEach(l => l.classList.remove("active"));
}

function clearDots() {
    document.querySelectorAll(".train-dot").forEach(d => d.remove());
}

/* ------------------------------
   TRIP ANIMATION
--------------------------------*/
function animateTrip(trip, now) {
    for (let i = 0; i < trip.length - 1; i++) {
        const a = trip[i];
        const b = trip[i + 1];

        if (now >= a.departure_s && now <= b.arrival_s) {
            let p = (now - a.departure_s) / (b.arrival_s - a.departure_s);
            placeTrain(a.stop_id, b.stop_id, p, trip);
        }
    }

    trip.forEach(st => {
        if (now >= st.arrival_s && now <= st.departure_s) {
            glowLED(st.stop_id, trip);
        }
    });
}

/* ------------------------------
   LED GLOW
--------------------------------*/
function glowLED(id, trip) {
    let capsule = document.querySelector(`.station-capsule[data-id='${id}']`);
    if (!capsule) return;

    let isDown = trip[0].stop_id === "tripunithura_terminal";
    capsule.querySelector(isDown ? ".led-down" : ".led-up").classList.add("active");
}

/* ------------------------------
   TRAIN DOT POSITION (PERFECT)
--------------------------------*/
function placeTrain(from, to, p, trip) {
    let fromEl = document.querySelector(`.station-capsule[data-id='${from}']`);
    let toEl = document.querySelector(`.station-capsule[data-id='${to}']`);

    if (!fromEl || !toEl) return;

    let fromBox = fromEl.getBoundingClientRect();
    let toBox = toEl.getBoundingClientRect();
    let board = document.getElementById("board").getBoundingClientRect();

    let y = fromBox.top + (toBox.top - fromBox.top) * p;

    let dot = document.createElement("div");
    dot.className = "train-dot";
    dot.innerHTML = `<span class="train-icon">🚆</span>`;

    let isDown = trip[0].stop_id === "tripunithura_terminal";
    let track = isDown ? downTrack : upTrack;

    dot.style.top = `${y - board.top}px`;

    track.appendChild(dot);
}
