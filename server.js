const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json()); // To parse JSON bodies
app.use(express.static(path.join(__dirname, 'public')));

// Store latest drone location for new clients
let latestDroneData = null;

// The endpoint that receives GPS data from the simulator
app.post('/update-location', (req, res) => {
    const data = req.body;
    
    if (!data || data.latitude === undefined || data.longitude === undefined) {
        return res.status(400).json({ error: 'Invalid location data' });
    }

    latestDroneData = data;
    
    // Broadcast to all connected clients
    io.emit('location-update', data);
    
    res.json({ message: 'Location updated successfully', data });
});

// Socket.io connection logic
io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);
    
    // Send immediate update to newly connected client if data exists
    if (latestDroneData) {
        socket.emit('location-update', latestDroneData);
    }
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
