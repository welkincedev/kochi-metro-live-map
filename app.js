/**
 * Kochi Metro Geo-Live Operations Engine v6.0
 * Ultra-Precise Shape Interpolation + Real GTFS Timetable
 * Service-Aware Routing (WK/WE)
 */

class MetroBoard {
    constructor() {
        this.config = {
            activeView: 'map',
            center: [9.9816, 76.2999],
            zoom: 12,
            refreshRate: 1000 // UI Refresh
        };

        this.data = {
            stations: {},
            trips: {},
            shapes: {},
            fares: {},
            calendar: {},
            stationOrder: [] // Sorted sequence for Line View
        };

        this.state = {
            selectedStation: null,
            nowSec: 0,
            serviceIds: [] // Currently valid services (WK/WE)
        };

        this.ui = {
            map: null,
            markers: {},
            activeTrains: {},
            polylines: {},
            elements: {
                clock: document.getElementById('clock-value'),
                viewToggle: [document.getElementById('toggle-map'), document.getElementById('toggle-line')],
                originSelect: document.getElementById('origin-select'),
                destSelect: document.getElementById('dest-select'),
                fareAmt: document.getElementById('fare-amt'),
                fareBox: document.getElementById('fare-result'),
                stationHUD: {
                    name: document.getElementById('hud-station-name'),
                    dir0: document.getElementById('dir0-deps'),
                    dir1: document.getElementById('dir1-deps')
                },
                swapBtn: document.getElementById('swap-btn')
            }
        };

        this.init();
    }

    async init() {
        try {
            console.log("🧩 Initializing Senior Data Systems...");
            await this.loadData();
            this.setServiceContext();
            this.initMap();
            this.setupUI();
            this.startEngine();
        } catch (err) {
            console.error("Critical System Failure:", err);
            document.getElementById('network-status').textContent = "OFFLINE";
            document.getElementById('network-status').className = "offline";
        }
    }

    async loadData() {
        const fetchJSON = (url) => fetch(url).then(r => r.json());
        const [st, tr, sh, fr] = await Promise.all([
            fetchJSON('stations.json'),
            fetchJSON('trips.json'),
            fetchJSON('shapes.json'),
            fetchJSON('fares.json')
        ]);

        this.data = { stations: st, trips: tr, shapes: sh, fares: fr };
    }

    setServiceContext() {
        const day = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
        // KMRL Logic: WK = Mon-Sat (1-6), WE = Sun (0)
        this.state.serviceIds = (day === 0) ? ['WE'] : ['WK'];
        console.log(`📅 Service Context: ${this.state.serviceIds.join(',')}`);
    }

    initMap() {
        this.ui.map = L.map('leaflet-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(this.config.center, this.config.zoom);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.ui.map);

        // Render Tracks (Geo-Shapes)
        for (const sid in this.data.shapes) {
            const pts = this.data.shapes[sid].map(p => [p.lat, p.lon]);
            const isSouth = sid.endsWith('_1');
            
            L.polyline(pts, {
                color: isSouth ? 'var(--accent-cyan)' : 'var(--accent-lime)',
                weight: 2,
                opacity: 0.2
            }).addTo(this.ui.map);
        }

        // Render Stations
        for (const sid in this.data.stations) {
            const s = this.data.stations[sid];
            const m = L.circleMarker([s.lat, s.lon], {
                radius: 5,
                fillColor: 'white',
                fillOpacity: 0.8,
                color: 'rgba(255,255,255,0.1)',
                weight: 8
            }).addTo(this.ui.map);
            
            m.on('click', () => {
                this.state.selectedStation = sid;
                this.updateStationHUD(sid);
            });
            this.ui.markers[sid] = m;
        }

        this.renderLineView();
    }

    renderLineView() {
        const list = document.getElementById('station-list');
        // Sort stations from Aluva to TPHT (North to South)
        const sorted = Object.values(this.data.stations).sort((a,b) => b.lat - a.lat); 
        this.data.stationOrder = sorted.map(s => s.id);

        list.innerHTML = sorted.map(s => `
            <div class="line-station" onclick="board.updateStationHUD('${s.id}')">
                <div class="station-dot"></div>
                <div class="station-label">${s.name}</div>
            </div>
        `).join('');
    }

    setupUI() {
        // Populate Fares
        const sList = Object.values(this.data.stations).sort((a,b) => a.name.localeCompare(b.name));
        sList.forEach(s => {
            const opt = `<option value="${s.id}">${s.name}</option>`;
            this.ui.elements.originSelect.innerHTML += opt;
            this.ui.elements.destSelect.innerHTML += opt;
        });

        // View Toggles
        this.ui.elements.viewToggle.forEach(btn => {
            btn.addEventListener('click', () => {
                this.ui.elements.viewToggle.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const isLine = btn.id.includes('line');
                document.getElementById('map-view').classList.toggle('active', !isLine);
                document.getElementById('line-view').classList.toggle('active', isLine);
            });
        });

        this.ui.elements.originSelect.addEventListener('change', () => this.calculateFare());
        this.ui.elements.destSelect.addEventListener('change', () => this.calculateFare());
        
        if (this.ui.elements.swapBtn) {
            this.ui.elements.swapBtn.addEventListener('click', () => this.swapStations());
        }
    }

    swapStations() {
        const s1 = this.ui.elements.originSelect;
        const s2 = this.ui.elements.destSelect;
        const tmp = s1.value;
        s1.value = s2.value;
        s2.value = tmp;
        
        // Animation
        const btn = this.ui.elements.swapBtn;
        btn.classList.add('rotating');
        setTimeout(() => btn.classList.remove('rotating'), 400);

        this.calculateFare();
    }

    getNowSeconds() {
        const now = new Date();
        return (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    }

    startEngine() {
        const loop = () => {
            this.state.nowSec = this.getNowSeconds();
            this.updateClock();
            this.engineTick();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    updateClock() {
        const s = this.state.nowSec;
        this.ui.elements.clock.textContent = `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    }

    engineTick() {
        const activeIds = new Set();

        for (const tid in this.data.trips) {
            const trip = this.data.trips[tid];
            // ❌ Extra Check: Service Filter
            if (!this.state.serviceIds.includes(trip.metadata.service_id)) continue;

            const start = trip.stops[0].arr;
            const end = trip.stops[trip.stops.length-1].dep;

            if (this.state.nowSec >= start && this.state.nowSec <= end) {
                activeIds.add(tid);
                this.calculateGeoPosition(tid, trip);
            }
        }

        // Cleanup Inactive
        for (const tid in this.ui.activeTrains) {
            if (!activeIds.has(tid)) {
                // Map Cleanup
                if (this.ui.activeTrains[tid].mapMarker) this.ui.activeTrains[tid].mapMarker.remove();
                // Line Cleanup
                if (this.ui.activeTrains[tid].lineMarker) this.ui.activeTrains[tid].lineMarker.remove();
                
                delete this.ui.activeTrains[tid];
            }
        }

        // Auto-refresh HUD if station selected
        if (this.state.selectedStation) this.updateStationHUD(this.state.selectedStation);
    }

    calculateGeoPosition(tid, trip) {
        let pos = null;
        let state = 'moving';

        // 1. Station Check
        for (const stop of trip.stops) {
            if (this.state.nowSec >= stop.arr && this.state.nowSec <= stop.dep) {
                const s = this.data.stations[stop.stop_id];
                pos = [s.lat, s.lon];
                state = 'at-station';
                this.renderTrain(tid, pos, trip.metadata.direction, state, {
                    s1: stop.stop_id,
                    s2: stop.stop_id,
                    ratio: 0
                });
                return;
            }
        }

        // 2. Shape-based Transit Interpolation
        for (let i=0; i < trip.stops.length-1; i++) {
            const s1 = trip.stops[i];
            const s2 = trip.stops[i+1];
            
            if (this.state.nowSec > s1.dep && this.state.nowSec < s2.arr) {
                const ratio = (this.state.nowSec - s1.dep) / (s2.arr - s1.dep);
                pos = this.interpolateAlongShape(trip.metadata.shape_id, s1.stop_id, s2.stop_id, ratio);
                this.renderTrain(tid, pos, trip.metadata.direction, 'moving', {
                    s1: s1.stop_id,
                    s2: s2.stop_id,
                    ratio: ratio
                });
                break;
            }
        }
    }

    interpolateAlongShape(shapeId, fromId, toId, ratio) {
        const shape = this.data.shapes[shapeId];
        const s1 = this.data.stations[fromId];
        const s2 = this.data.stations[toId];

        // Linear Fallback if shape missing
        if (!shape) {
            return [s1.lat + (s2.lat - s1.lat) * ratio, s1.lon + (s2.lon - s1.lon) * ratio];
        }

        // Find station points in shape (closest lat/lon match)
        const findIdx = (lat, lon) => {
            let min = Infinity, idx = 0;
            shape.forEach((p, i) => {
                const d = Math.pow(p.lat - lat, 2) + Math.pow(p.lon - lon, 2);
                if (d < min) { min = d; idx = i; }
            });
            return idx;
        };

        const idx1 = findIdx(s1.lat, s1.lon);
        const idx2 = findIdx(s2.lat, s2.lon);

        const segment = shape.slice(Math.min(idx1, idx2), Math.max(idx1, idx2) + 1);
        if (idx1 > idx2) segment.reverse();

        // Interpolate along segment path
        const totalPoints = segment.length;
        const targetPoint = (totalPoints - 1) * ratio;
        const floor = Math.floor(targetPoint);
        const ceil = Math.ceil(targetPoint);
        const internalRatio = targetPoint - floor;

        const p1 = segment[floor];
        const p2 = segment[ceil] || p1;

        return [
            p1.lat + (p2.lat - p1.lat) * internalRatio,
            p1.lon + (p2.lon - p1.lon) * internalRatio
        ];
    }

    renderTrain(tid, pos, dir, state, lineData) {
        if (!this.ui.activeTrains[tid]) {
            this.ui.activeTrains[tid] = {
                mapMarker: L.circleMarker(pos, {
                    radius: 6,
                    fillColor: dir === 0 ? 'var(--accent-lime)' : 'var(--accent-cyan)',
                    fillOpacity: 1,
                    color: 'white',
                    weight: 2,
                    className: 'train-marker'
                }).addTo(this.ui.map),
                lineMarker: this.createLineMarker(tid, dir)
            };
        } else {
            // Update Map
            this.ui.activeTrains[tid].mapMarker.setLatLng(pos);
            this.ui.activeTrains[tid].mapMarker.setStyle({
                radius: state === 'at-station' ? 9 : 6,
                fillOpacity: state === 'at-station' ? 0.8 : 1
            });
            
            // Update Line View Position
            this.updateLineMarkerPos(tid, lineData);
        }
    }

    createLineMarker(tid, dir) {
        const el = document.createElement('div');
        el.className = `train-marker-line ${dir === 0 ? 'north' : 'south'}`;
        el.id = `line-train-${tid}`;
        el.innerHTML = tid.split('_')[1] || 'M';
        document.getElementById('train-layer-line').appendChild(el);
        return el;
    }

    updateLineMarkerPos(tid, lineData) {
        const marker = this.ui.activeTrains[tid].lineMarker;
        if (!marker || !lineData) return;

        const idx1 = this.data.stationOrder.indexOf(lineData.s1);
        const idx2 = this.data.stationOrder.indexOf(lineData.s2);

        if (idx1 === -1 || idx2 === -1) return;

        const interpolatedIdx = idx1 + (idx2 - idx1) * lineData.ratio;
        const xBase = interpolatedIdx * 250 + 125;
        
        marker.style.left = `${xBase}px`;
        marker.style.opacity = '1';
    }

    calculateFare() {
        const f = this.ui.elements.originSelect.value;
        const t = this.ui.elements.destSelect.value;
        if (f && t) {
            const fare = this.data.fares[`${f}_${t}`] || this.data.fares[`${t}_${f}`] || "--";
            this.ui.elements.fareAmt.textContent = fare;
            this.ui.elements.fareBox.classList.remove('hidden');
        }
    }

    updateStationHUD(sid) {
        const s = this.data.stations[sid];
        this.ui.elements.stationHUD.name.textContent = s.name;
        
        const deps = [ [], [] ]; // index 0 and 1
        for (const tid in this.data.trips) {
            const trip = this.data.trips[tid];
            if (!this.state.serviceIds.includes(trip.metadata.service_id)) continue;
            
            const stop = trip.stops.find(st => st.stop_id === sid);
            if (stop && stop.dep > this.state.nowSec) {
                const item = { time: stop.dep, id: tid };
                deps[trip.metadata.direction].push(item);
            }
        }

        const fmt = (sec) => `${Math.floor(sec/3600)}:${Math.floor((sec%3600)/60).toString().padStart(2,'0')}`;
        const renderList = (arr) => arr.sort((a,b)=>a.time-b.time).slice(0,3).map(d => `<div class="dep-item"><span>TRN ${d.id.split('_')[1]}</span><span>${fmt(d.time)}</span></div>`).join('') || '<div class="dep-item">No Services</div>';

        this.ui.elements.stationHUD.dir0.innerHTML = renderList(deps[0]);
        this.ui.elements.stationHUD.dir1.innerHTML = renderList(deps[1]);
    }
}

let board;
window.addEventListener('DOMContentLoaded', () => { 
    board = new MetroBoard(); 
});
