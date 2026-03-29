/**
 * Kochi Metro Live Map Engine v2.5
 * Features: 60fps Interpolation, Trip Filtering, Directional SVGs, Time Warp
 */

class MetroApp {
    constructor() {
        this.stations = [];
        this.trips = [];
        this.filter = 'all';
        
        // Simulation Time State
        this.baseRealTime = Date.now();
        this.baseSimTime = this.getRealSeconds();
        this.speedFactor = 1;

        // DOM Cache
        this.elements = {
            stationList: document.getElementById('station-list'),
            clock: document.getElementById('clock-value'),
            board: document.getElementById('board'),
            trackUp: document.getElementById('track-up'),
            trackDown: document.getElementById('track-down'),
            filterBtns: document.querySelectorAll('.filter-btn'),
            speedSlider: document.getElementById('speed-slider'),
            speedValue: document.getElementById('speed-value'),
            departureSlots: document.getElementById('departure-slots')
        };

        this.init();
    }

    async init() {
        try {
            const response = await fetch('schedule.json');
            const data = await response.json();
            
            this.stations = data.stations;
            this.trips = data.trips;

            this.renderStations();
            this.setupEventListeners();
            this.startEngine();
        } catch (err) {
            console.error("Failed to initialize Metro Map:", err);
            document.getElementById('status-indicator').textContent = "ERROR";
            document.getElementById('status-indicator').className = "offline";
        }
    }

    setupEventListeners() {
        // Filter Buttons
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filter = btn.dataset.filter;
            });
        });

        // Speed Slider
        this.elements.speedSlider.addEventListener('input', (e) => {
            const newSpeed = parseInt(e.target.value);
            
            // Re-anchor simulation time to prevent jumps when changing speed
            const currentSimTime = this.getSimSeconds();
            this.baseRealTime = Date.now();
            this.baseSimTime = currentSimTime;
            
            this.speedFactor = newSpeed;
            this.elements.speedValue.textContent = `${newSpeed}x`;
        });
    }

    renderStations() {
        this.elements.stationList.innerHTML = this.stations.map(st => `
            <div class="station" data-id="${st.stop_id}">
                <div class="station-capsule">
                    <div class="led led-down" data-id="${st.stop_id}"></div>
                    <span class="station-name">${st.stop_name}</span>
                    <div class="led led-up" data-id="${st.stop_id}"></div>
                </div>
            </div>
        `).join('');

        // Cache LED elements
        this.leds = { up: {}, down: {} };
        this.stations.forEach(st => {
            this.leds.up[st.stop_id] = document.querySelector(`.station[data-id="${st.stop_id}"] .led-up`);
            this.leds.down[st.stop_id] = document.querySelector(`.station[data-id="${st.stop_id}"] .led-down`);
        });
    }

    getRealSeconds() {
        const now = new Date();
        return (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    }

    getSimSeconds() {
        const elapsedRealMs = Date.now() - this.baseRealTime;
        const elapsedSimSec = (elapsedRealMs / 1000) * this.speedFactor;
        return (this.baseSimTime + elapsedSimSec) % 86400; // Wrap around 24h
    }

    formatTime(sec) {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    startEngine() {
        const loop = () => {
            const nowSec = this.getSimSeconds();
            this.elements.clock.textContent = this.formatTime(nowSec);
            this.processLogic(nowSec);
            this.updateDepartures(nowSec);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    processLogic(nowSec) {
        // Reset state
        Object.values(this.leds.up).forEach(el => el.classList.remove('active-up'));
        Object.values(this.leds.down).forEach(el => el.classList.remove('active-down'));
        
        const existingTrainIds = new Set();
        
        for (const tripId in this.trips) {
            const trip = this.trips[tripId];
            const startTime = trip[0].arrival_s;
            const endTime = trip[trip.length - 1].departure_s;

            if (nowSec >= startTime && nowSec <= endTime) {
                const isDown = trip[0].stop_id === "tripunithura_terminal";
                if (this.filter !== 'all') {
                    if (this.filter === 'up' && isDown) continue;
                    if (this.filter === 'down' && !isDown) continue;
                }
                existingTrainIds.add(tripId);
                this.updateTripState(tripId, trip, nowSec, isDown);
            }
        }

        document.querySelectorAll('.train-node').forEach(node => {
            if (!existingTrainIds.has(node.id)) node.remove();
        });
    }

    updateTripState(tripId, trip, nowSec, isDown) {
        let trainAtStation = false;
        for (const stop of trip) {
            if (nowSec >= stop.arrival_s && nowSec <= stop.departure_s) {
                const led = isDown ? this.leds.down[stop.stop_id] : this.leds.up[stop.stop_id];
                if (led) led.classList.add(isDown ? 'active-down' : 'active-up');
                trainAtStation = true;
                this.removeTrainNode(tripId);
                break;
            }
        }

        if (!trainAtStation) {
            for (let i = 0; i < trip.length - 1; i++) {
                const depStop = trip[i];
                const arrStop = trip[i + 1];
                if (nowSec > depStop.departure_s && nowSec < arrStop.arrival_s) {
                    const progress = (nowSec - depStop.departure_s) / (arrStop.arrival_s - depStop.departure_s);
                    this.renderTrainNode(tripId, depStop.stop_id, arrStop.stop_id, progress, isDown);
                    break;
                }
            }
        }
    }

    renderTrainNode(id, fromId, toId, progress, isDown) {
        let node = document.getElementById(id);
        if (!node) {
            node = document.createElement('div');
            node.id = id;
            node.className = `train-node ${isDown ? 'down' : 'up'}`;
            node.innerHTML = `
                <div class="train-visual">
                    <svg class="train-chevron" viewBox="0 0 24 24">
                        <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/>
                    </svg>
                </div>
            `;
            this.elements.board.appendChild(node);
        }

        const fromEl = document.querySelector(`.station[data-id="${fromId}"]`);
        const toEl = document.querySelector(`.station[data-id="${toId}"]`);
        
        if (fromEl && toEl) {
            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();
            const boardRect = this.elements.board.getBoundingClientRect();

            const startY = fromRect.top - boardRect.top + (fromRect.height / 2);
            const endY = toRect.top - boardRect.top + (toRect.height / 2);
            const currentY = startY + (endY - startY) * progress;
            const trackX = isDown ? (boardRect.width / 2 - 140) : (boardRect.width / 2 + 140);

            node.style.top = `${currentY - 14}px`;
            node.style.left = `${trackX}px`;
        }
    }

    updateDepartures(nowSec) {
        const upcoming = [];
        for (const tripId in this.trips) {
            const trip = this.trips[tripId];
            const startTime = trip[0].arrival_s;
            if (startTime > nowSec && startTime < nowSec + 1800) { // Next 30 mins
                upcoming.push({ id: tripId, time: startTime, isDown: trip[0].stop_id === "tripunithura_terminal" });
            }
        }

        upcoming.sort((a,b) => a.time - b.time);
        
        this.elements.departureSlots.innerHTML = upcoming.slice(0, 5).map(u => `
            <div class="departure-tile ${u.isDown ? 'down' : 'up'}">
                <span class="dir">${u.isDown ? 'SOUTHBOUND' : 'NORTHBOUND'}</span>
                <span class="time">${this.formatTime(u.time)}</span>
            </div>
        `).join('') || '<span class="no-data">No departures in next 30m</span>';
    }

    removeTrainNode(id) {
        const node = document.getElementById(id);
        if (node) node.remove();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new MetroApp();
});
