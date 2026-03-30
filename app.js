/**
 * Kochi Metro Geo-Live Operations Engine v7.0
 * Direction-Aware Labels + Station Interaction (Line + Map)
 * Service-Aware Routing (WK/WE) | Destination-Based Train Labels
 */

// ─── Direction Config ─────────────────────────────────────────────────────────
// direction === 0 → Northbound → Aluva  (trip starts at TPHT, ends at ALVA)
// direction === 1 → Southbound → Tripunithura (trip starts at ALVA, ends at TPHT)
const DIR_CONFIG = {
    0: {
        label:    'Aluva',
        arrow:    '←',
        cssClass: 'north',
        color:    '#00ffd2',   // --accent-cyan
        glowVar:  'rgba(0,255,210,0.6)'
    },
    1: {
        label:    'Thrippunithura',
        arrow:    '→',
        cssClass: 'south',
        color:    '#a2ff00',   // --accent-lime
        glowVar:  'rgba(162,255,0,0.6)'
    }
};

class MetroBoard {
    constructor() {
        this.config = {
            activeView: 'map',
            center: [9.9816, 76.2999],
            zoom: 12,
            refreshRate: 1000
        };

        this.data = {
            stations: {},
            trips: {},
            shapes: {},
            fares: {},
            stationOrder: []
        };

        this.state = {
            selectedStation: null,
            nowSec: 0,
            serviceIds: [],
            directionFilter: 'all'   // 'all' | 0 | 1
        };

        this.ui = {
            map: null,
            markers: {},
            activeTrains: {},
            polylines: {},
            elements: {
                clock:        document.getElementById('clock-value'),
                viewToggle:   [document.getElementById('toggle-map'), document.getElementById('toggle-line')],
                originSelect: document.getElementById('origin-select'),
                destSelect:   document.getElementById('dest-select'),
                fareAmt:      document.getElementById('fare-amt'),
                fareBox:      document.getElementById('fare-result'),
                stationHUD: {
                    name: document.getElementById('hud-station-name'),
                    dir0: document.getElementById('dir0-deps'),
                    dir1: document.getElementById('dir1-deps')
                },
                swapBtn:       document.getElementById('swap-btn'),
                dirFilterBtns: document.querySelectorAll('.dir-filter-btn'),
                ltpPopup:      document.getElementById('line-timetable-popup'),
                ltpName:       document.getElementById('ltp-station-name'),
                ltpDir0:       document.getElementById('ltp-dir0'),
                ltpDir1:       document.getElementById('ltp-dir1'),
                ltpClose:      document.getElementById('ltp-close')
            }
        };

        this.init();
    }

    // ─── Bootstrap ─────────────────────────────────────────────────────────────

    async init() {
        try {
            console.log('🧩 Initializing Metro Engine v7.0...');
            await this.loadData();
            this.setServiceContext();
            this.initMap();
            this.setupUI();
            this.startEngine();
        } catch (err) {
            console.error('Critical System Failure:', err);
            document.getElementById('network-status').textContent = 'OFFLINE';
            document.getElementById('network-status').className = 'offline';
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
        const day = new Date().getDay(); // 0=Sun
        this.state.serviceIds = (day === 0) ? ['WE'] : ['WK'];
        console.log(`📅 Service: ${this.state.serviceIds.join(',')}`);
    }

    // ─── Map Init ──────────────────────────────────────────────────────────────

    initMap() {
        this.ui.map = L.map('leaflet-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(this.config.center, this.config.zoom);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.ui.map);

        // Track shapes
        for (const sid in this.data.shapes) {
            const pts = this.data.shapes[sid].map(p => [p.lat, p.lon]);
            const dir = sid.endsWith('_1') ? 1 : 0;
            L.polyline(pts, {
                color: DIR_CONFIG[dir].color,
                weight: 2,
                opacity: 0.2
            }).addTo(this.ui.map);
        }

        // Station markers
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

    // ─── Line View ─────────────────────────────────────────────────────────────

    renderLineView() {
        const list = document.getElementById('station-list');
        // Sort north-to-south (Aluva → TPHT) by descending latitude
        const sorted = Object.values(this.data.stations).sort((a, b) => b.lat - a.lat);
        this.data.stationOrder = sorted.map(s => s.id);

        list.innerHTML = sorted.map(s => `
            <div class="line-station" id="ls-${s.id}" data-sid="${s.id}">
                <div class="station-dot"></div>
                <div class="station-label">${s.name}</div>
            </div>
        `).join('');

        // Attach click handlers (event delegation would also work)
        list.querySelectorAll('.line-station').forEach(el => {
            el.addEventListener('click', () => {
                const sid = el.dataset.sid;
                this.state.selectedStation = sid;
                this.updateStationHUD(sid);
                this.highlightLineStation(sid);
                this.showLineViewTimetable(sid);
            });
        });
    }

    /**
     * Highlight the clicked station in Line View, dim others.
     */
    highlightLineStation(sid) {
        document.querySelectorAll('.line-station').forEach(el => {
            const elSid = el.dataset.sid;
            el.classList.toggle('selected', elSid === sid);
            el.classList.toggle('dimmed',   elSid !== sid);
        });
    }

    /**
     * Show the floating timetable popup in Line View.
     */
    showLineViewTimetable(sid) {
        const s = this.data.stations[sid];
        if (!s) return;

        const deps = this._getDepartures(sid);
        const fmt  = this._fmtTime.bind(this);
        const now  = this.state.nowSec;

        const renderLtp = (arr) => arr
            .sort((a, b) => a.time - b.time)
            .slice(0, 3)
            .map(d => {
                const minsAway = Math.max(0, Math.round((d.time - now) / 60));
                return `<div class="ltp-dep-item">
                    <span class="dep-time">${fmt(d.time)}</span>
                    <span class="dep-mins">${minsAway === 0 ? 'Now' : minsAway + 'm'}</span>
                </div>`;
            }).join('') || '<div class="ltp-dep-item" style="opacity:0.5">No services</div>';

        this.ui.elements.ltpName.textContent  = s.name;
        this.ui.elements.ltpDir0.innerHTML    = renderLtp(deps[0]);
        this.ui.elements.ltpDir1.innerHTML    = renderLtp(deps[1]);
        this.ui.elements.ltpPopup.classList.remove('hidden');

        // Force re-animation
        this.ui.elements.ltpPopup.style.animation = 'none';
        this.ui.elements.ltpPopup.offsetHeight;   // reflow
        this.ui.elements.ltpPopup.style.animation = '';
    }

    hideLineViewTimetable() {
        this.ui.elements.ltpPopup.classList.add('hidden');
        // Un-highlight
        document.querySelectorAll('.line-station').forEach(el => {
            el.classList.remove('selected', 'dimmed');
        });
        this.state.selectedStation = null;
    }

    // ─── UI Setup ──────────────────────────────────────────────────────────────

    setupUI() {
        // Fare dropdowns
        const sList = Object.values(this.data.stations).sort((a, b) => a.name.localeCompare(b.name));
        sList.forEach(s => {
            const opt = `<option value="${s.id}">${s.name}</option>`;
            this.ui.elements.originSelect.innerHTML += opt;
            this.ui.elements.destSelect.innerHTML   += opt;
        });

        // View toggle
        this.ui.elements.viewToggle.forEach(btn => {
            btn.addEventListener('click', () => {
                this.ui.elements.viewToggle.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const isLine = btn.id.includes('line');
                document.getElementById('map-view').classList.toggle('active', !isLine);
                document.getElementById('line-view').classList.toggle('active', isLine);
                // Hide popup when switching views
                if (!isLine) this.hideLineViewTimetable();
            });
        });

        // Fare inputs
        this.ui.elements.originSelect.addEventListener('change', () => this.calculateFare());
        this.ui.elements.destSelect.addEventListener('change',   () => this.calculateFare());

        // Swap btn
        if (this.ui.elements.swapBtn) {
            this.ui.elements.swapBtn.addEventListener('click', () => this.swapStations());
        }

        // Direction filter buttons
        this.ui.elements.dirFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.ui.elements.dirFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.dir;
                this.state.directionFilter = val === 'all' ? 'all' : parseInt(val, 10);
                this.applyDirectionFilter();
            });
        });

        // Line-view timetable close button
        this.ui.elements.ltpClose.addEventListener('click', () => this.hideLineViewTimetable());
    }

    swapStations() {
        const s1 = this.ui.elements.originSelect;
        const s2 = this.ui.elements.destSelect;
        [s1.value, s2.value] = [s2.value, s1.value];

        const btn = this.ui.elements.swapBtn;
        btn.classList.add('rotating');
        setTimeout(() => btn.classList.remove('rotating'), 400);
        this.calculateFare();
    }

    // ─── Direction Filter ──────────────────────────────────────────────────────

    /**
     * Show/hide train markers based on selected direction.
     * Only touches opacity/pointerEvents — no re-render.
     */
    applyDirectionFilter() {
        const f = this.state.directionFilter;

        for (const tid in this.ui.activeTrains) {
            const train = this.data.trips[tid];
            if (!train) continue;
            const dir = train.metadata.direction;
            const visible = f === 'all' || dir === f;

            // Map marker
            const mm = this.ui.activeTrains[tid].mapMarker;
            if (mm) {
                mm.setStyle({ fillOpacity: visible ? 1 : 0, opacity: visible ? 1 : 0 });
            }

            // Line marker
            const lm = this.ui.activeTrains[tid].lineMarker;
            if (lm) {
                lm.style.opacity = visible ? '1' : '0';
                lm.style.pointerEvents = visible ? 'auto' : 'none';
            }
        }
    }

    // ─── Engine ────────────────────────────────────────────────────────────────

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
        const h = Math.floor(s / 3600).toString().padStart(2, '0');
        const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        this.ui.elements.clock.textContent = `${h}:${m}:${sec}`;
    }

    engineTick() {
        const activeIds = new Set();

        for (const tid in this.data.trips) {
            const trip = this.data.trips[tid];
            if (!this.state.serviceIds.includes(trip.metadata.service_id)) continue;

            const start = trip.stops[0].arr;
            const end   = trip.stops[trip.stops.length - 1].dep;

            if (this.state.nowSec >= start && this.state.nowSec <= end) {
                activeIds.add(tid);
                this.calculateGeoPosition(tid, trip);
            }
        }

        // Remove departed trains
        for (const tid in this.ui.activeTrains) {
            if (!activeIds.has(tid)) {
                const t = this.ui.activeTrains[tid];
                if (t.mapMarker)  t.mapMarker.remove();
                if (t.lineMarker) t.lineMarker.remove();
                delete this.ui.activeTrains[tid];
            }
        }

        // Re-apply filter after tick (new trains may have appeared)
        this.applyDirectionFilter();

        // Refresh HUD & popup for selected station
        if (this.state.selectedStation) {
            this.updateStationHUD(this.state.selectedStation);
            // Refresh popup too if line view is active
            const lineActive = document.getElementById('line-view').classList.contains('active');
            if (lineActive && !this.ui.elements.ltpPopup.classList.contains('hidden')) {
                this.showLineViewTimetable(this.state.selectedStation);
            }
        }
    }

    // ─── Position Calculation ─────────────────────────────────────────────────

    calculateGeoPosition(tid, trip) {
        // At-station check
        for (const stop of trip.stops) {
            if (this.state.nowSec >= stop.arr && this.state.nowSec <= stop.dep) {
                const s = this.data.stations[stop.stop_id];
                this.renderTrain(tid, [s.lat, s.lon], trip.metadata.direction, 'at-station', {
                    s1: stop.stop_id, s2: stop.stop_id, ratio: 0
                });
                return;
            }
        }

        // Between-stops interpolation
        for (let i = 0; i < trip.stops.length - 1; i++) {
            const s1 = trip.stops[i];
            const s2 = trip.stops[i + 1];

            if (this.state.nowSec > s1.dep && this.state.nowSec < s2.arr) {
                const ratio = (this.state.nowSec - s1.dep) / (s2.arr - s1.dep);
                const pos   = this.interpolateAlongShape(trip.metadata.shape_id, s1.stop_id, s2.stop_id, ratio);
                this.renderTrain(tid, pos, trip.metadata.direction, 'moving', {
                    s1: s1.stop_id, s2: s2.stop_id, ratio
                });
                break;
            }
        }
    }

    interpolateAlongShape(shapeId, fromId, toId, ratio) {
        const shape = this.data.shapes[shapeId];
        const s1    = this.data.stations[fromId];
        const s2    = this.data.stations[toId];

        if (!shape) {
            return [s1.lat + (s2.lat - s1.lat) * ratio, s1.lon + (s2.lon - s1.lon) * ratio];
        }

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

        const totalPoints  = segment.length;
        const targetPoint  = (totalPoints - 1) * ratio;
        const floor        = Math.floor(targetPoint);
        const ceil         = Math.ceil(targetPoint);
        const internalRatio = targetPoint - floor;
        const p1 = segment[floor];
        const p2 = segment[ceil] || p1;

        return [
            p1.lat + (p2.lat - p1.lat) * internalRatio,
            p1.lon + (p2.lon - p1.lon) * internalRatio
        ];
    }

    // ─── Render Train ──────────────────────────────────────────────────────────

    renderTrain(tid, pos, dir, state, lineData) {
        const cfg = DIR_CONFIG[dir] ?? DIR_CONFIG[0];

        if (!this.ui.activeTrains[tid]) {
            // ── First render ──
            const mapMarker = L.circleMarker(pos, {
                radius:      6,
                fillColor:   cfg.color,
                fillOpacity: 1,
                color:       'white',
                weight:      2,
                className:   'train-marker'
            }).addTo(this.ui.map);

            // Map tooltip showing destination
            mapMarker.bindTooltip(
                `<b>${cfg.arrow} ${cfg.label}</b>`,
                { permanent: false, direction: 'top', className: 'train-tooltip' }
            );

            this.ui.activeTrains[tid] = {
                mapMarker,
                lineMarker: this.createLineMarker(tid, dir, cfg),
                dir
            };
        } else {
            // ── Update ──
            const t = this.ui.activeTrains[tid];
            t.mapMarker.setLatLng(pos);
            t.mapMarker.setStyle({
                radius:      state === 'at-station' ? 9 : 6,
                fillOpacity: state === 'at-station' ? 0.8 : 1,
                fillColor:   cfg.color
            });

            this.updateLineMarkerPos(tid, lineData);
        }
    }

    /**
     * Create the horizontal line-view train pill.
     * Shows: [arrow] [DESTINATION]
     */
    createLineMarker(tid, dir, cfg) {
        const el = document.createElement('div');
        el.className = `train-marker-line ${cfg.cssClass}`;
        el.id        = `line-train-${tid}`;
        el.innerHTML = `
            <span class="train-arrow">${cfg.arrow}</span>
            <span class="train-dest">${cfg.label.toUpperCase()}</span>
        `;
        el.style.opacity = '0';
        document.getElementById('train-layer-line').appendChild(el);
        return el;
    }

    updateLineMarkerPos(tid, lineData) {
        const marker = this.ui.activeTrains[tid]?.lineMarker;
        if (!marker || !lineData) return;

        const idx1 = this.data.stationOrder.indexOf(lineData.s1);
        const idx2 = this.data.stationOrder.indexOf(lineData.s2);
        if (idx1 === -1 || idx2 === -1) return;

        const interpolatedIdx = idx1 + (idx2 - idx1) * lineData.ratio;
        const xBase           = interpolatedIdx * 250 + 125;   // 250px per station
        marker.style.left     = `${xBase}px`;
        marker.style.opacity  = '1';
    }

    // ─── Fare Calculator ───────────────────────────────────────────────────────

    calculateFare() {
        const f = this.ui.elements.originSelect.value;
        const t = this.ui.elements.destSelect.value;
        if (f && t) {
            const fare = this.data.fares[`${f}_${t}`] || this.data.fares[`${t}_${f}`] || '--';
            this.ui.elements.fareAmt.textContent = fare;
            this.ui.elements.fareBox.classList.remove('hidden');
        }
    }

    // ─── Station HUD ───────────────────────────────────────────────────────────

    /**
     * Shared helper — returns { 0: [...], 1: [...] } departure arrays.
     */
    _getDepartures(sid) {
        const deps = { 0: [], 1: [] };
        for (const tid in this.data.trips) {
            const trip = this.data.trips[tid];
            if (!this.state.serviceIds.includes(trip.metadata.service_id)) continue;

            const stop = trip.stops.find(st => st.stop_id === sid);
            if (stop && stop.dep > this.state.nowSec) {
                const dir = trip.metadata.direction;
                deps[dir].push({ time: stop.dep, id: tid });
            }
        }
        return deps;
    }

    _fmtTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    updateStationHUD(sid) {
        const s = this.data.stations[sid];
        if (!s) return;
        this.ui.elements.stationHUD.name.textContent = s.name;

        const deps = this._getDepartures(sid);
        const fmt  = this._fmtTime.bind(this);

        const dirLabel = (dir) => DIR_CONFIG[dir];

        const renderHUD = (arr, dir) => {
            const cfg = dirLabel(dir);
            return arr
                .sort((a, b) => a.time - b.time)
                .slice(0, 3)
                .map(d => `<div class="dep-item">
                    <span>${cfg.arrow} ${cfg.label}</span>
                    <span>${fmt(d.time)}</span>
                </div>`).join('') || '<div class="dep-item">No Services</div>';
        };

        this.ui.elements.stationHUD.dir0.innerHTML = renderHUD(deps[0], 0);
        this.ui.elements.stationHUD.dir1.innerHTML = renderHUD(deps[1], 1);
    }
}

let board;
window.addEventListener('DOMContentLoaded', () => {
    board = new MetroBoard();
});
