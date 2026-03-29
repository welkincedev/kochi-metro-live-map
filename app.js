/**
 * Kochi Metro Network Status Board v3.0
 * Strict Timetable Engine (Real-Time Operations)
 */

class MetroApp {
    constructor() {
        this.stations = [];
        this.trips = [];
        this.filter = 'all';
        
        this.elements = {
            stationList: document.getElementById('station-list'),
            clock: document.getElementById('clock-value'),
            board: document.getElementById('board'),
            filterBtns: document.querySelectorAll('.filter-btn')
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
            console.error("System Error:", err);
            document.getElementById('status-indicator').textContent = "OFFLINE";
            document.getElementById('status-indicator').className = "offline";
        }
    }

    setupEventListeners() {
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.elements.filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filter = btn.dataset.filter;
            });
        });
    }

    renderStations() {
        this.elements.stationList.innerHTML = this.stations.map(st => `
            <div class="station" data-id="${st.stop_id}">
                <div class="station-capsule">
                    <div class="station-header">
                        <div class="led led-down" title="Southbound"></div>
                        <span class="station-name">${st.stop_name}</span>
                        <div class="led led-up" title="Northbound"></div>
                    </div>
                    <div class="departure-board-mini" id="dep-${st.stop_id}">
                        <!-- Trip rows injected here -->
                    </div>
                </div>
            </div>
        `).join('');

        // Cache LEDs and Mini-boards
        this.uiCache = {};
        this.stations.forEach(st => {
            this.uiCache[st.stop_id] = {
                ledUp: document.querySelector(`.station[data-id="${st.stop_id}"] .led-up`),
                ledDown: document.querySelector(`.station[data-id="${st.stop_id}"] .led-down`),
                miniBoard: document.getElementById(`dep-${st.stop_id}`)
            };
        });
    }

    getRealTimeSeconds() {
        const now = new Date();
        return (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    }

    formatTime(sec) {
        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(sec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    startEngine() {
        const loop = () => {
            const nowSec = this.getRealTimeSeconds();
            this.elements.clock.textContent = this.formatTime(nowSec);
            
            this.updateTrainMovements(nowSec);
            this.updatePerStationBoards(nowSec);
            
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updateTrainMovements(nowSec) {
        // Reset LEDs
        Object.values(this.uiCache).forEach(ui => {
            ui.ledUp.classList.remove('active-up');
            ui.ledDown.classList.remove('active-down');
        });

        const activeTripIds = new Set();

        for (const tripId in this.trips) {
            const trip = this.trips[tripId];
            const startTime = trip[0].arrival_s;
            const endTime = trip[trip.length - 1].departure_s;

            if (nowSec >= startTime && nowSec <= endTime) {
                const isNorthbound = trip[0].stop_id === "tripunithura_terminal"; // UP
                const isSouthbound = trip[0].stop_id === "aluva"; // DOWN
                
                // Filter logic
                if (this.filter === 'up' && !isNorthbound) continue;
                if (this.filter === 'down' && !isSouthbound) continue;

                activeTripIds.add(tripId);
                this.calculateTrainPosition(tripId, trip, nowSec, isNorthbound);
            }
        }

        // Cleanup out-of-service trains
        document.querySelectorAll('.train-node').forEach(node => {
            if (!activeTripIds.has(node.id)) node.remove();
        });
    }

    calculateTrainPosition(tripId, trip, nowSec, isUp) {
        let currentPos = null;

        // 1. Check if train is AT a station
        for (const stop of trip) {
            if (nowSec >= stop.arrival_s && nowSec <= stop.departure_s) {
                const ui = this.uiCache[stop.stop_id];
                if (ui) {
                    if (isUp) ui.ledUp.classList.add('active-up');
                    else ui.ledDown.classList.add('active-down');
                }
                
                // Position node exactly at station
                currentPos = { from: stop.stop_id, to: stop.stop_id, progress: 0 };
                break;
            }
        }

        // 2. Check if train is BETWEEN stations
        if (!currentPos) {
            for (let i = 0; i < trip.length - 1; i++) {
                const dep = trip[i];
                const arr = trip[i + 1];

                if (nowSec > dep.departure_s && nowSec < arr.arrival_s) {
                    const progress = (nowSec - dep.departure_s) / (arr.arrival_s - dep.departure_s);
                    currentPos = { from: dep.stop_id, to: arr.stop_id, progress: progress };
                    break;
                }
            }
        }

        if (currentPos) {
            this.renderTrain(tripId, currentPos.from, currentPos.to, currentPos.progress, isUp);
        }
    }

    renderTrain(id, fromId, toId, progress, isUp) {
        let node = document.getElementById(id);
        if (!node) {
            node = document.createElement('div');
            node.id = id;
            node.className = `train-node ${isUp ? 'up' : 'down'}`;
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

            // Vertical position (Corrected to middle of capsules)
            const startY = fromRect.top - boardRect.top + (fromRect.height / 2);
            const endY = toRect.top - boardRect.top + (toRect.height / 2);
            const currentY = startY + (endY - startY) * progress;

            // Track alignment (Visual UP/Down tracks)
            const trackX = isUp ? (boardRect.width / 2 + 150) : (boardRect.width / 2 - 150);

            node.style.top = `${currentY - 14}px`;
            node.style.left = `${trackX}px`;
            
            // Rotation: Northbound (UP) points UP (0deg), Southbound (DOWN) points DOWN (180deg)
            const chevron = node.querySelector('.train-chevron');
            chevron.style.transform = isUp ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }

    updatePerStationBoards(nowSec) {
        // Only refresh every few seconds if needed, but rAF is fine too
        this.stations.forEach(st => {
            const upcoming = [];
            
            for (const tripId in this.trips) {
                const trip = this.trips[tripId];
                const stop = trip.find(s => s.stop_id === st.stop_id);
                
                if (stop && stop.departure_s > nowSec && stop.departure_s < nowSec + 3600) {
                    const isUp = trip[0].stop_id === "tripunithura_terminal";
                    upcoming.push({ time: stop.departure_s, isUp: isUp });
                }
            }

            upcoming.sort((a,b) => a.time - b.time);
            
            const board = this.uiCache[st.stop_id].miniBoard;
            const top3 = upcoming.slice(0, 3);
            
            if (top3.length > 0) {
                board.innerHTML = top3.map(u => `
                    <div class="mini-dep-row ${u.isUp ? 'up' : 'down'}">
                        <span class="dir-label">${u.isUp ? 'Northbound' : 'Southbound'}</span>
                        <span class="time">${this.formatTime(u.time).substring(0, 5)}</span>
                    </div>
                `).join('');
            } else {
                board.innerHTML = `<span class="mini-dep-row" style="opacity:0.3">No more trips today</span>`;
            }
        });
    }
}

// System Launch
window.addEventListener('DOMContentLoaded', () => {
    new MetroApp();
});
