const fs = require('fs');
const path = require('path');

const GTFS_DIR = path.join(__dirname, 'KMRLOpenData');

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l);
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, i) => {
            obj[header.trim()] = values[i] ? values[i].trim() : null;
            return obj;
        }, {});
    });
}

function timeToSeconds(timeStr) {
    if (!timeStr) return null;
    const [h, m, s] = timeStr.split(':').map(Number);
    return (h * 3600) + (m * 60) + s;
}

async function preprocess() {
    console.log("🚀 Starting Kochi Metro GTFS Preprocessing...");

    // 1. Stations
    console.log("Parsing stops.txt...");
    const stopsRaw = parseCSV(path.join(GTFS_DIR, 'stops.txt'));
    const stations = {};
    stopsRaw.forEach(s => {
        stations[s.stop_id] = {
            id: s.stop_id,
            name: s.stop_name,
            lat: parseFloat(s.stop_lat),
            lon: parseFloat(s.stop_lon)
        };
    });
    fs.writeFileSync('stations.json', JSON.stringify(stations, null, 2));

    // 2. Shapes
    console.log("Parsing shapes.txt...");
    const shapesRaw = parseCSV(path.join(GTFS_DIR, 'shapes.txt'));
    const shapes = {};
    shapesRaw.forEach(s => {
        if (!shapes[s.shape_id]) shapes[s.shape_id] = [];
        shapes[s.shape_id].push({
            lat: parseFloat(s.shape_pt_lat),
            lon: parseFloat(s.shape_pt_lon),
            seq: parseInt(s.shape_pt_sequence),
            dist: parseFloat(s.shape_dist_traveled || 0)
        });
    });
    // Sort shape points
    for (const sid in shapes) {
        shapes[sid].sort((a, b) => a.seq - b.seq);
    }
    fs.writeFileSync('shapes.json', JSON.stringify(shapes, null, 2));

    // 3. Fares
    console.log("Parsing fares...");
    const fareAttr = parseCSV(path.join(GTFS_DIR, 'fare_attributes.txt'));
    const fareRules = parseCSV(path.join(GTFS_DIR, 'fare_rules.txt'));
    const fareTable = {};
    fareAttr.forEach(fa => { fareTable[fa.fare_id] = parseFloat(fa.price); });
    
    const fares = {};
    fareRules.forEach(fr => {
        const key = `${fr.origin_id}_${fr.destination_id}`;
        fares[key] = fareTable[fr.fare_id] || 0;
    });
    fs.writeFileSync('fares.json', JSON.stringify(fares, null, 2));

    // 4. Trips
    console.log("Parsing trips and stop_times...");
    const tripsRaw = parseCSV(path.join(GTFS_DIR, 'trips.txt'));
    const stopTimesRaw = parseCSV(path.join(GTFS_DIR, 'stop_times.txt'));
    
    const tripsMetadata = {};
    tripsRaw.forEach(t => {
        tripsMetadata[t.trip_id] = {
            direction: parseInt(t.direction_id), // 0=Aluva, 1=Tripunithura
            shape_id: t.shape_id,
            service_id: t.service_id
        };
    });

    const trips = {};
    stopTimesRaw.forEach(st => {
        const tid = st.trip_id;
        if (!trips[tid]) {
            trips[tid] = {
                metadata: tripsMetadata[tid],
                stops: []
            };
        }
        trips[tid].stops.push({
            stop_id: st.stop_id,
            arr: timeToSeconds(st.arrival_time),
            dep: timeToSeconds(st.departure_time),
            seq: parseInt(st.stop_sequence)
        });
    });

    // Sort stops in each trip
    for (const tid in trips) {
        trips[tid].stops.sort((a, b) => a.seq - b.seq);
    }

    fs.writeFileSync('trips.json', JSON.stringify(trips, null, 2));

    console.log("✅ Preprocessing Complete!");
}

preprocess();
