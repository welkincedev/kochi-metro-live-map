/**
 * Kochi Metro Geo-Live Operations Engine v9.0
 * PWA + Offline Mode + Nearest Station + Smart UX + Search
 */

// ─── Direction Config ──────────────────────────────────────────────────────────
const DIR_CONFIG = {
    0: { label: 'Thrippunithura', arrow: '→', cssClass: 'south', color: '#a2ff00', glowVar: 'rgba(162,255,0,0.6)', platform: 2 },
    1: { label: 'Aluva',          arrow: '←', cssClass: 'north', color: '#00ffd2', glowVar: 'rgba(0,255,210,0.6)', platform: 1 }
};

class MetroBoard {
    constructor() {
        this.config = {
            activeView: 'map',
            center: [9.9816, 76.2999],
            zoom: 12,
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
            directionFilter: 'all',
            sheetState: 'collapsed',
            lastHUDUpdate: 0
        };

        this.ui = {
            map: null,
            markers: {},
            activeTrains: {},
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

    // ─── Helpers ────────────────────────────────────────────────────────────────

    isMobile() { return window.innerWidth <= 768; }

    // ─── Bootstrap ──────────────────────────────────────────────────────────────

    async init() {
        try {
            this.setupOfflineListeners();
            console.log('🧩 Initializing Metro Engine v9.0...');
            await this.loadData();
            this.setServiceContext();
            this.initMap();
            this.setupUI();
            this.initBottomSheet();
            this.setupMobileFareCalc();
            this.setupGeolocation();
            this.setupSearch();
            this.setupSwipeGestures();
            this.startEngine();
        } catch (err) {
            console.error('Critical System Failure:', err);
            document.getElementById('network-status').textContent = 'OFFLINE';
            document.getElementById('network-status').className = 'offline';
        }
    }

    setupOfflineListeners() {
        const banner = document.getElementById('offline-banner');
        if(!banner) return;
        const updateStatus = () => {
            if(navigator.onLine) {
                banner.classList.add('hidden');
                document.getElementById('network-status').textContent = 'SYSTEM ONLINE';
                document.getElementById('network-status').className = '';
            } else {
                banner.classList.remove('hidden');
                document.getElementById('network-status').textContent = 'OFFLINE';
                document.getElementById('network-status').className = 'offline';
            }
        };
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus(); // Initial check
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
        const day = new Date().getDay();
        this.state.serviceIds = (day === 0) ? ['WE'] : ['WK'];
        console.log(`📅 Service: ${this.state.serviceIds.join(',')}`);
    }

    // ─── Station Selection (Centralized) ────────────────────────────────────────

    selectStation(sid) {
        this.state.selectedStation = sid;
        this.highlightLineStation(sid);

        // Pre-fill fare
        this.ui.elements.originSelect.value = sid;
        const bsOrig = document.getElementById('bs-origin-select');
        if (bsOrig) bsOrig.value = sid;
        this.calculateFare();

        // Auto-scroll line view
        const sidEl = document.getElementById(`ls-${sid}`);
        if (sidEl) {
            const container = document.getElementById('board-overflow-container');
            if(container) {
                const offsetLeft = sidEl.offsetLeft;
                const scrollTarget = offsetLeft - (container.clientWidth / 2) + (sidEl.clientWidth / 2);
                container.scrollTo({ left: scrollTarget, behavior: 'smooth' });
            }
        }

        if (this.isMobile()) {
            this.openBottomSheet(sid);
        } else {
            this.updateStationHUD(sid);
            const isLineActive = document.getElementById('line-view').classList.contains('active');
            if (isLineActive) {
                this.showLineViewTimetable(sid);
            }
        }
    }

    // ─── Map Init ───────────────────────────────────────────────────────────────

    initMap() {
        this.ui.map = L.map('leaflet-map', {
            zoomControl: false,
            attributionControl: false
        }).setView(this.config.center, this.config.zoom);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.ui.map);

        for (const sid in this.data.shapes) {
            const pts = this.data.shapes[sid].map(p => [p.lat, p.lon]);
            const dir = sid.endsWith('_0') ? 0 : 1;
            L.polyline(pts, { color: DIR_CONFIG[dir].color, weight: 2, opacity: 0.2 }).addTo(this.ui.map);
        }

        for (const sid in this.data.stations) {
            const s = this.data.stations[sid];
            const m = L.circleMarker([s.lat, s.lon], {
                radius: this.isMobile() ? 8 : 5,
                fillColor: 'white', fillOpacity: 0.8,
                color: 'rgba(255,255,255,0.1)', weight: this.isMobile() ? 14 : 8
            }).addTo(this.ui.map);

            m.on('click', () => {
                this.selectStation(sid);
            });
            this.ui.markers[sid] = m;
        }

        // Map Zoom Labels
        this.ui.map.on('zoomend', () => this.toggleMapLabels());
        this.toggleMapLabels();

        this.renderLineView();
    }

    toggleMapLabels() {
        const show = this.ui.map.getZoom() >= 14;
        for(const sid in this.ui.markers) {
            const m = this.ui.markers[sid];
            if(show) {
                if(!m.getTooltip()) {
                    m.bindTooltip(this.data.stations[sid].name, {
                        permanent: true, direction: 'bottom', className: 'station-label-tooltip', offset: [0, 8]
                    }).openTooltip();
                }
            } else {
                if(m.getTooltip()) m.unbindTooltip();
            }
        }
    }

    // ─── Line View ──────────────────────────────────────────────────────────────

    renderLineView() {
        const list = document.getElementById('station-list');
        const sorted = Object.values(this.data.stations).sort((a, b) => b.lat - a.lat);
        this.data.stationOrder = sorted.map(s => s.id);

        list.innerHTML = sorted.map(s => `
            <div class="line-station" id="ls-${s.id}" data-sid="${s.id}">
                <div class="station-dot"></div>
                <div class="station-label">${s.name}</div>
            </div>
        `).join('');

        list.querySelectorAll('.line-station').forEach(el => {
            el.addEventListener('click', () => {
                const sid = el.dataset.sid;
                this.selectStation(sid);
            });
        });
    }

    highlightLineStation(sid) {
        document.querySelectorAll('.line-station').forEach(el => {
            const elSid = el.dataset.sid;
            el.classList.toggle('selected', elSid === sid);
            el.classList.toggle('dimmed',   elSid !== sid);
        });
    }

    showLineViewTimetable(sid) {
        const s = this.data.stations[sid];
        if (!s) return;

        const deps = this._getDepartures(sid);
        const fmt  = this._fmtTime.bind(this);
        const now  = this.state.nowSec;

        const renderLtp = (arr, dir) => {
            const cfg = DIR_CONFIG[dir];
            const rows = arr
                .sort((a, b) => a.time - b.time).slice(0, 3)
                .map(d => {
                    const minsAway = Math.max(0, Math.round((d.time - now) / 60));
                    return `<div class="ltp-dep-item">
                        <span class="dep-time">${fmt(d.time)}</span>
                        <span class="dep-mins">${minsAway === 0 ? 'Now' : minsAway + 'm'}</span>
                    </div>`;
                }).join('');
            return rows || '<div class="ltp-dep-item ltp-no-service">No services</div>';
        };

        this.ui.elements.ltpName.textContent = s.name;
        this.ui.elements.ltpDir0.innerHTML = renderLtp(deps[1], 1);
        this.ui.elements.ltpDir1.innerHTML = renderLtp(deps[0], 0);
        this.ui.elements.ltpPopup.classList.remove('hidden');

        this.ui.elements.ltpPopup.style.animation = 'none';
        this.ui.elements.ltpPopup.offsetHeight;
        this.ui.elements.ltpPopup.style.animation = '';
    }

    hideLineViewTimetable() {
        this.ui.elements.ltpPopup.classList.add('hidden');
        document.querySelectorAll('.line-station').forEach(el => el.classList.remove('selected', 'dimmed'));
        this.state.selectedStation = null;
    }

    // ─── UI Setup ───────────────────────────────────────────────────────────────

    setupUI() {
        // Fare dropdowns (desktop)
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
                if (!isLine) this.hideLineViewTimetable();
            });
        });

        // Desktop fare calc
        this.ui.elements.originSelect.addEventListener('change', () => this.calculateFare());
        this.ui.elements.destSelect.addEventListener('change',   () => this.calculateFare());
        if (this.ui.elements.swapBtn) {
            this.ui.elements.swapBtn.addEventListener('click', () => this.swapStations());
        }

        // Direction filter
        this.ui.elements.dirFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.ui.elements.dirFilterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const val = btn.dataset.dir;
                this.state.directionFilter = val === 'all' ? 'all' : parseInt(val, 10);
                this.applyDirectionFilter();
            });
        });

        // Desktop popup close
        this.ui.elements.ltpClose.addEventListener('click', () => this.hideLineViewTimetable());
    }

    setupGeolocation() {
        const btn = document.getElementById('nearest-btn');
        if(!btn) return;
        btn.addEventListener('click', () => {
            if(!navigator.geolocation) {
                alert('Geolocation not supported by browser.');
                return;
            }
            // Add pulse effect
            const originalText = btn.innerHTML;
            btn.innerHTML = '⌛';
            btn.style.opacity = '0.7';
            
            navigator.geolocation.getCurrentPosition((pos) => {
                btn.innerHTML = originalText;
                btn.style.opacity = '1';
                const { latitude: lat1, longitude: lon1 } = pos.coords;
                let minD = Infinity;
                let nearestSid = null;
                
                // Simple Euclidean is fine for short distances
                for(const sid in this.data.stations) {
                    const s = this.data.stations[sid];
                    const d = Math.pow(lat1 - s.lat, 2) + Math.pow(lon1 - s.lon, 2);
                    if(d < minD) {
                        minD = d;
                        nearestSid = sid;
                    }
                }

                if(nearestSid) {
                    this.ui.map.setView([this.data.stations[nearestSid].lat, this.data.stations[nearestSid].lon], 15);
                    this.selectStation(nearestSid);
                }
            }, (err) => {
                btn.innerHTML = originalText;
                btn.style.opacity = '1';
                alert('Could not get location. Make sure permissions are granted.');
            });
        });
    }

    setupSearch() {
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('station-search');
        const resultsList = document.getElementById('search-results');

        if(!searchBtn || !searchInput) return;

        searchBtn.addEventListener('click', () => {
            searchInput.classList.toggle('expanded');
            if(searchInput.classList.contains('expanded')) {
                searchInput.focus();
            } else {
                resultsList.classList.add('hidden');
                searchInput.value = '';
            }
        });

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if(!query) {
                resultsList.classList.add('hidden');
                return;
            }

            const matches = Object.values(this.data.stations)
                .filter(s => s.name.toLowerCase().includes(query))
                .sort((a,b) => a.name.localeCompare(b.name))
                .slice(0, 5); // Limit to top 5

            if(matches.length > 0) {
                resultsList.innerHTML = matches.map(s => `<li data-sid="${s.id}">${s.name}</li>`).join('');
                resultsList.classList.remove('hidden');
            } else {
                resultsList.innerHTML = `<li>No results found</li>`;
                resultsList.classList.remove('hidden');
            }
        });

        resultsList.addEventListener('click', (e) => {
            if(e.target.tagName === 'LI' && e.target.dataset.sid) {
                const sid = e.target.dataset.sid;
                this.selectStation(sid);
                const s = this.data.stations[sid];
                if(s) this.ui.map.setView([s.lat, s.lon], 15);
                
                // Close search
                searchInput.classList.remove('expanded');
                resultsList.classList.add('hidden');
                searchInput.value = '';
            }
        });

        // Close search when clicking on map
        this.ui.map.on('click', () => {
            if(searchInput.classList.contains('expanded')){
                searchInput.classList.remove('expanded');
                resultsList.classList.add('hidden');
            }
        });
    }

    setupSwipeGestures() {
        const container = document.getElementById('display-container');
        if(!container) return;

        let startX = 0, startY = 0;
        
        container.addEventListener('touchstart', (e) => {
            if(e.touches.length > 1) return; // ignore multi-touch
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, {passive: true});

        container.addEventListener('touchend', (e) => {
            if(e.changedTouches.length === 0) return;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const dx = endX - startX;
            const dy = endY - startY;

            // Mostly horizontal swipe and enough distance
            if(Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
                if(dx < 0) {
                    // Swipe Left -> Show LINE View
                    const btn = document.getElementById('toggle-line');
                    if(!btn.classList.contains('active')) btn.click();
                } else {
                    // Swipe Right -> Show MAP View
                    const btn = document.getElementById('toggle-map');
                    if(!btn.classList.contains('active')) btn.click();
                }
            }
        }, {passive: true});
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

    // ─── Mobile Bottom Sheet ────────────────────────────────────────────────────

    /**
     * Returns the translateY value (px) for each sheet state.
     * Computed at call-time so window.innerHeight is always fresh.
     */
    _sheetTranslates() {
        const h = window.innerHeight;
        return {
            collapsed: h - 64,                    // Only handle + hint visible
            default:   Math.round(h * 0.48),      // Half screen
            expanded:  Math.round(h * 0.08)       // Nearly full screen
        };
    }

    setSheetState(state, animate = true) {
        const sheet = document.getElementById('bottom-sheet');
        if (!sheet) return;
        this.state.sheetState = state;
        const t = this._sheetTranslates()[state];
        sheet.style.transition = animate
            ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
            : 'none';
        sheet.style.transform = `translateY(${t}px)`;
        sheet.dataset.state   = state;

        const hint = document.getElementById('bs-hint');
        if (hint) hint.style.display = (state === 'collapsed') ? 'flex' : 'none';
    }

    openBottomSheet(sid) {
        this.updateBottomSheetHUD(sid);
        this.setSheetState('default');
    }

    closeBottomSheet() {
        this.setSheetState('collapsed');
        this.state.selectedStation = null;
        // Also un-highlight line stations
        document.querySelectorAll('.line-station').forEach(el => el.classList.remove('selected', 'dimmed'));
    }

    initBottomSheet() {
        const sheet   = document.getElementById('bottom-sheet');
        const drag    = document.getElementById('bs-drag-area');
        const content = document.getElementById('bs-content');
        const closeBtn = document.getElementById('bs-close-btn');

        if (!sheet) return;

        // Initial collapsed position (no animation on load)
        this.setSheetState('collapsed', false);

        closeBtn.addEventListener('click', () => this.closeBottomSheet());

        // ── Touch gesture tracking ─────────────────────────────────────────────
        let isDragging  = false;
        let startY      = 0;
        let lastY       = 0;
        let startTime   = 0;
        let startTranslate = 0;

        const onTouchStart = (e) => {
            // If content is scrolled down, don't intercept — let it scroll
            if (e.currentTarget === content && content.scrollTop > 2) return;
            isDragging     = true;
            startY         = e.touches[0].clientY;
            lastY          = startY;
            startTime      = Date.now();
            startTranslate = this._sheetTranslates()[this.state.sheetState];
            sheet.style.transition = 'none';
        };

        const onTouchMove = (e) => {
            if (!isDragging) return;
            lastY = e.touches[0].clientY;
            const dy = lastY - startY;
            const translates = this._sheetTranslates();
            const clamped = Math.max(
                translates.expanded - 20,
                Math.min(translates.collapsed + 5, startTranslate + dy)
            );
            sheet.style.transform = `translateY(${clamped}px)`;
            if (Math.abs(dy) > 4) e.preventDefault();
        };

        const onTouchEnd = () => {
            if (!isDragging) return;
            isDragging = false;

            const dy       = lastY - startY;
            const dt       = Math.max(1, Date.now() - startTime);
            const velocity = dy / dt;                   // px/ms
            const translates = this._sheetTranslates();
            const curTranslate = startTranslate + dy;

            let target;
            if (velocity < -0.35) {
                // Flick up
                target = (this.state.sheetState === 'collapsed') ? 'default' : 'expanded';
            } else if (velocity > 0.35) {
                // Flick down
                target = (this.state.sheetState === 'expanded') ? 'default' : 'collapsed';
            } else {
                // Snap to nearest
                const dists = Object.entries(translates).map(([k, v]) => ({ k, d: Math.abs(v - curTranslate) }));
                dists.sort((a, b) => a.d - b.d);
                target = dists[0].k;
            }

            this.setSheetState(target);
        };

        // Attach to drag handle (primary) and content top (secondary)
        drag.addEventListener('touchstart',    onTouchStart, { passive: true });
        drag.addEventListener('touchmove',     onTouchMove,  { passive: false });
        drag.addEventListener('touchend',      onTouchEnd,   { passive: true });

        content.addEventListener('touchstart', onTouchStart, { passive: true });
        content.addEventListener('touchmove',  onTouchMove,  { passive: false });
        content.addEventListener('touchend',   onTouchEnd,   { passive: true });
    }

    // ─── Mobile Bottom Sheet HUD ────────────────────────────────────────────────

    updateBottomSheetHUD(sid) {
        const s = this.data.stations[sid];
        if (!s) return;

        document.getElementById('bs-station-name').textContent = s.name;

        const deps = this._getDepartures(sid);
        document.getElementById('bs-dir1-deps').innerHTML = this._renderPlatformHTML(deps[1], 1);
        document.getElementById('bs-dir0-deps').innerHTML = this._renderPlatformHTML(deps[0], 0);

        const depsDiv = document.getElementById('bs-departures');
        if (depsDiv) depsDiv.classList.remove('hidden');
    }

    // ─── Mobile Fare Calculator ─────────────────────────────────────────────────

    setupMobileFareCalc() {
        const orig = document.getElementById('bs-origin-select');
        const dest = document.getElementById('bs-dest-select');
        if (!orig || !dest) return;

        const sList = Object.values(this.data.stations).sort((a, b) => a.name.localeCompare(b.name));
        sList.forEach(s => {
            const opt = `<option value="${s.id}">${s.name}</option>`;
            orig.innerHTML += opt;
            dest.innerHTML += opt;
        });

        const calc = () => {
            const f = orig.value, t = dest.value;
            if (f && t) {
                const fare = this.data.fares[`${f}_${t}`] || this.data.fares[`${t}_${f}`] || '--';
                document.getElementById('bs-fare-amt').textContent = fare;
                document.getElementById('bs-fare-result').classList.remove('hidden');
            }
        };

        orig.addEventListener('change', calc);
        dest.addEventListener('change', calc);

        const swapBtn = document.getElementById('bs-swap-btn');
        if (swapBtn) {
            swapBtn.addEventListener('click', () => {
                [orig.value, dest.value] = [dest.value, orig.value];
                swapBtn.classList.add('rotating');
                setTimeout(() => swapBtn.classList.remove('rotating'), 400);
                calc();
            });
        }
    }

    // ─── Direction Filter ────────────────────────────────────────────────────────

    applyDirectionFilter() {
        const f = this.state.directionFilter;
        for (const tid in this.ui.activeTrains) {
            const train = this.data.trips[tid];
            if (!train) continue;
            const dir     = train.metadata.direction;
            const visible = f === 'all' || dir === f;

            const mm = this.ui.activeTrains[tid].mapMarker;
            if (mm) mm.setStyle({ fillOpacity: visible ? 1 : 0, opacity: visible ? 1 : 0 });

            const lm = this.ui.activeTrains[tid].lineMarker;
            if (lm) {
                lm.style.opacity       = visible ? '1' : '0';
                lm.style.pointerEvents = visible ? 'auto' : 'none';
            }
        }
    }

    // ─── Engine ─────────────────────────────────────────────────────────────────

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
        const s   = this.state.nowSec;
        const h   = Math.floor(s / 3600).toString().padStart(2, '0');
        const m   = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        this.ui.elements.clock.textContent = `${h}:${m}:${sec}`;
    }

    engineTick() {
        const activeIds = new Set();

        for (const tid in this.data.trips) {
            const trip  = this.data.trips[tid];
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

        this.applyDirectionFilter();

        // Throttle HUD refresh to ~1s to reduce mobile load
        const now = Date.now();
        if (now - this.state.lastHUDUpdate >= 1000) {
            this.state.lastHUDUpdate = now;

            if (this.state.selectedStation) {
                // Desktop HUD
                if (!this.isMobile()) {
                    this.updateStationHUD(this.state.selectedStation);
                    const lineActive = document.getElementById('line-view').classList.contains('active');
                    if (lineActive && !this.ui.elements.ltpPopup.classList.contains('hidden')) {
                        this.showLineViewTimetable(this.state.selectedStation);
                    }
                }

                // Mobile bottom sheet HUD (only if not collapsed)
                if (this.isMobile() && this.state.sheetState !== 'collapsed') {
                    this.updateBottomSheetHUD(this.state.selectedStation);
                }
            }
        }
    }

    // ─── Position Calculation ────────────────────────────────────────────────────

    calculateGeoPosition(tid, trip) {
        for (const stop of trip.stops) {
            if (this.state.nowSec >= stop.arr && this.state.nowSec <= stop.dep) {
                const s = this.data.stations[stop.stop_id];
                this.renderTrain(tid, [s.lat, s.lon], trip.metadata.direction, 'at-station', {
                    s1: stop.stop_id, s2: stop.stop_id, ratio: 0
                });
                return;
            }
        }
        for (let i = 0; i < trip.stops.length - 1; i++) {
            const s1 = trip.stops[i], s2 = trip.stops[i + 1];
            if (this.state.nowSec > s1.dep && this.state.nowSec < s2.arr) {
                const ratio = (this.state.nowSec - s1.dep) / (s2.arr - s1.dep);
                const pos   = this.interpolateAlongShape(trip.metadata.shape_id, s1.stop_id, s2.stop_id, ratio);
                this.renderTrain(tid, pos, trip.metadata.direction, 'moving', { s1: s1.stop_id, s2: s2.stop_id, ratio });
                break;
            }
        }
    }

    interpolateAlongShape(shapeId, fromId, toId, ratio) {
        const shape = this.data.shapes[shapeId];
        const s1    = this.data.stations[fromId];
        const s2    = this.data.stations[toId];
        if (!shape) return [s1.lat + (s2.lat - s1.lat) * ratio, s1.lon + (s2.lon - s1.lon) * ratio];

        const findIdx = (lat, lon) => {
            let min = Infinity, idx = 0;
            shape.forEach((p, i) => {
                const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
                if (d < min) { min = d; idx = i; }
            });
            return idx;
        };
        const idx1    = findIdx(s1.lat, s1.lon);
        const idx2    = findIdx(s2.lat, s2.lon);
        const segment = shape.slice(Math.min(idx1, idx2), Math.max(idx1, idx2) + 1);
        if (idx1 > idx2) segment.reverse();

        const totalPoints   = segment.length;
        const targetPoint   = (totalPoints - 1) * ratio;
        const floor         = Math.floor(targetPoint);
        const ceil          = Math.ceil(targetPoint);
        const internalRatio = targetPoint - floor;
        const p1 = segment[floor];
        const p2 = segment[ceil] || p1;
        return [p1.lat + (p2.lat - p1.lat) * internalRatio, p1.lon + (p2.lon - p1.lon) * internalRatio];
    }

    // ─── Render Train ────────────────────────────────────────────────────────────

    renderTrain(tid, pos, dir, state, lineData) {
        const cfg = DIR_CONFIG[dir] ?? DIR_CONFIG[0];

        if (!this.ui.activeTrains[tid]) {
            const mapMarker = L.circleMarker(pos, {
                radius: 6, fillColor: cfg.color, fillOpacity: 1,
                color: 'white', weight: 2, className: 'train-marker'
            }).addTo(this.ui.map);

            mapMarker.bindTooltip(`<b>${cfg.arrow} ${cfg.label}</b>`, {
                permanent: false, direction: 'top', className: 'train-tooltip'
            });

            this.ui.activeTrains[tid] = {
                mapMarker,
                lineMarker: this.createLineMarker(tid, dir, cfg),
                dir
            };
        } else {
            const t = this.ui.activeTrains[tid];
            t.mapMarker.setLatLng(pos);
            t.mapMarker.setStyle({
                radius:      state === 'at-station' ? 9 : 6,
                fillOpacity: state === 'at-station' ? 0.8 : 1,
                fillColor:   cfg.color
            });
            
            // Add or remove animated trail class
            const el = t.mapMarker.getElement();
            if(el) {
                if(state === 'moving') el.classList.add('moving');
                else el.classList.remove('moving');
            }

            this.updateLineMarkerPos(tid, lineData);
        }
    }

    createLineMarker(tid, dir, cfg) {
        const el = document.createElement('div');
        el.className = `train-marker-line ${cfg.cssClass}`;
        el.id        = `line-train-${tid}`;
        el.innerHTML = `<span class="train-arrow">${cfg.arrow}</span><span class="train-dest">${cfg.label.toUpperCase()}</span>`;
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
        const stationWidth    = this.isMobile() ? 140 : 250;
        const interpolatedIdx = idx1 + (idx2 - idx1) * lineData.ratio;
        marker.style.left     = `${interpolatedIdx * stationWidth + stationWidth / 2}px`;
        marker.style.opacity  = '1';
    }

    // ─── Departure Helpers ──────────────────────────────────────────────────────

    _getDepartures(sid) {
        const deps = { 0: [], 1: [] };
        for (const tid in this.data.trips) {
            const trip = this.data.trips[tid];
            if (!this.state.serviceIds.includes(trip.metadata.service_id)) continue;
            const stop = trip.stops.find(st => st.stop_id === sid);
            if (stop && stop.dep > this.state.nowSec) {
                deps[trip.metadata.direction].push({ time: stop.dep, id: tid });
            }
        }
        return deps;
    }

    _fmtTime(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    /** Shared platform block HTML renderer */
    _renderPlatformHTML(arr, dir) {
        const cfg = DIR_CONFIG[dir];
        const now = this.state.nowSec;
        const fmt = this._fmtTime.bind(this);

        const rows = arr
            .sort((a, b) => a.time - b.time).slice(0, 3)
            .map((d, index) => {
                const minsAway = Math.max(0, Math.round((d.time - now) / 60));
                // Optional styling for next departure
                const isNext = index === 0 && minsAway <= 15 ? 'style="border-left-color: white; opacity: 1;"' : '';
                
                return `<div class="dep-item dep-item--${cfg.cssClass}" ${isNext}>
                    <span class="dep-dest">${cfg.arrow} ${cfg.label}</span>
                    <span class="dep-right">
                        <span class="dep-time-val">${fmt(d.time)}</span>
                        <span class="dep-mins-badge">${minsAway === 0 ? 'Now' : minsAway + 'm'}</span>
                    </span>
                </div>`;
            }).join('') || `<div class="dep-no-service">No upcoming services</div>`;

        return `<div class="platform-block platform--${cfg.cssClass}">
            <div class="platform-header">
                <span class="platform-pill platform-pill--${cfg.cssClass}">PF ${cfg.platform}</span>
                <span class="platform-dest">${cfg.label}</span>
            </div>
            ${rows}
        </div>`;
    }

    // ─── Desktop: Station HUD + Fare Calc ───────────────────────────────────────

    updateStationHUD(sid) {
        const s = this.data.stations[sid];
        if (!s) return;
        this.ui.elements.stationHUD.name.textContent = s.name;
        const deps = this._getDepartures(sid);
        this.ui.elements.stationHUD.dir1.innerHTML = this._renderPlatformHTML(deps[1], 1);
        this.ui.elements.stationHUD.dir0.innerHTML = this._renderPlatformHTML(deps[0], 0);
    }

    calculateFare() {
        const f = this.ui.elements.originSelect.value;
        const t = this.ui.elements.destSelect.value;
        if (f && t) {
            const fare = this.data.fares[`${f}_${t}`] || this.data.fares[`${t}_${f}`] || '--';
            this.ui.elements.fareAmt.textContent = fare;
            this.ui.elements.fareBox.classList.remove('hidden');
        }
    }
}

let board;
window.addEventListener('DOMContentLoaded', () => {
    board = new MetroBoard();
});
