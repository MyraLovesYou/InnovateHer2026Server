const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = [];
let deck = [];
let scores = { tradition: 0, construction: 0 };

function createDeck() {
    deck = [...Array(6).fill("Tradition"), ...Array(11).fill("Construction")];
    deck.sort(() => 0.5 - Math.random());
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        const newPlayer = { id: socket.id, name: name, role: 'Unassigned' };
        players.push(newPlayer);
        io.emit('updatePlayerList', players);
    });

    socket.on('startGame', () => {
        if (players.length < 2) return;
        createDeck();
        scores = { tradition: 0, construction: 0 };
        
        let shuffled = [...players].sort(() => 0.5 - Math.random());
        const spyId = shuffled[0].id;

        players.forEach(p => {
            p.role = (p.id === spyId) ? "IU SPY 🚩" : "BOILERMAKER 🚂";
            io.to(p.id).emit('assignRole', p.role);
        });
        io.emit('gameStarted');
    });

    socket.on('startVote', (nominatedName) => {
        // Validation: Check if the name exists in our players array
        const exists = players.some(p => p.name.toLowerCase() === nominatedName.toLowerCase());
        if (exists) {
            io.emit('showVote', nominatedName);
        } else {
            socket.emit('errorMsg', "Student not found on campus!");
        }
    });

    socket.on('submitVote', (voteData) => {
        io.emit('voteResult', voteData);
    });

    socket.on('drawPolicies', () => {
        if (deck.length < 3) createDeck();
        const hand = deck.splice(0, 3);
        socket.emit('policyHand', hand);
    });

    socket.on('enactPolicy', (policy) => {
        if (policy === "Tradition") scores.tradition++;
        else scores.construction++;
        
        io.emit('policyUpdated', { 
            traditionScore: scores.tradition, 
            constructionScore: scores.construction, 
            lastPolicy: policy 
        });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayerList', players);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});