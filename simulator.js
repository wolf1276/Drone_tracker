const http = require('http');

// Simple drone initial state
let latitude = 37.7749; // Start near San Francisco
let longitude = -122.4194;
let battery = 100;
let speed = 25; // m/s

// Configuration for server
const SERVER_URL = 'http://localhost:4000/update-location';

console.log('Starting drone simulator...');

setInterval(() => {
    // Simulate movement
    // Small random changes to lat/lon
    // Roughly 1 degree latitude = ~111km. 0.0001 is about 11 meters
    latitude += (Math.random() - 0.5) * 0.0005;
    longitude += (Math.random() - 0.5) * 0.0005;
    
    // Simulate battery drain
    battery -= 0.1;
    if (battery <= 0) battery = 0;

    // Vary speed slightly
    speed += (Math.random() - 0.5) * 5;
    if (speed < 0) speed = 0;
    if (speed > 50) speed = 50;

    const payload = JSON.stringify({
        latitude: parseFloat(latitude.toFixed(6)),
        longitude: parseFloat(longitude.toFixed(6)),
        battery: parseFloat(battery.toFixed(1)),
        speed: parseFloat(speed.toFixed(1)),
        timestamp: Date.now()
    });

    const options = {
        hostname: 'localhost',
        port: 4000,
        path: '/update-location',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                 console.log(`Success: Sent GPS Data -> Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}, Speed: ${speed.toFixed(1)}m/s, Battery: ${battery.toFixed(1)}%`);
            } else {
                 console.log(`Error: Server responded with HTTP ${res.statusCode} - ${responseData}`);
            }
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}. Is the server running?`);
    });

    req.write(payload);
    req.end();

}, 1000); // Sends every 1 second
