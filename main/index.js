const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = [];

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('Student connected:', socket.id);

    socket.on('joinGame', (name) => {
        const newPlayer = { id: socket.id, name: name, role: 'Unassigned' };
        players.push(newPlayer);
        io.emit('updatePlayerList', players);
    });

    socket.on('startGame', () => {
        if (players.length < 2) return;
        
        // Assign Roles
        let shuffled = [...players].sort(() => 0.5 - Math.random());
        const spyId = shuffled[0].id;

        players.forEach(p => {
            p.role = (p.id === spyId) ? "IU SPY 🚩" : "BOILERMAKER 🚂";
            io.to(p.id).emit('assignRole', p.role);
        });
    });

    // VOTING MECHANIC
    socket.on('startVote', (nominatedName) => {
        io.emit('showVote', nominatedName);
    });

    socket.on('submitVote', (voteData) => {
        // Broadcast the result to everyone
        io.emit('voteResult', { name: voteData.name, choice: voteData.choice });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayerList', players);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});