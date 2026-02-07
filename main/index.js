const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let players = [];
let deck = [];
let enactedPolicies = { tradition: [], construction: [] };
let votes = {}; 
let currentPres = null;
let currentVP = null;

function createDeck() {
    deck = [...Array(6).fill("Tradition"), ...Array(11).fill("Construction")];
    deck.sort(() => 0.5 - Math.random());
}

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    socket.on('joinGame', (name) => {
        players.push({ id: socket.id, name: name, role: 'Unassigned' });
        io.emit('updatePlayerList', players);
    });

    socket.on('startGame', () => {
        if (players.length < 5) return socket.emit('errorMsg', "Need 5+ players!");
        createDeck();
        enactedPolicies = { tradition: [], construction: [] };
        let shuffled = [...players].sort(() => 0.5 - Math.random());
        players.forEach((p, i) => {
            if (p.id === shuffled[0].id) p.role = "THE BISON 🦬";
            else if (p.id === shuffled[1].id) p.role = "HOOSIER SPY 🚩";
            else p.role = "BOILERMAKER 🚂";
            io.to(p.id).emit('assignRole', p.role);
        });
        io.emit('gameStarted');
    });

    // Phase 1: Nomination
    socket.on('nominateVP', (vpName) => {
        const nominee = players.find(p => p.name.toLowerCase() === vpName.toLowerCase());
        const president = players.find(p => p.id === socket.id);
        
        if (nominee && president) {
            currentPres = president;
            currentVP = nominee;
            votes = {}; // Reset votes for new election
            io.emit('showVote', { president: president.name, vp: nominee.name });
        }
    });

    // Phase 2: Voting
    socket.on('submitVote', (voteData) => {
        votes[socket.id] = voteData.choice;
        io.emit('statusMsg', `${voteData.name} has cast their ballot.`);

        // Check if all players have voted
        if (Object.keys(votes).length === players.length) {
            const yesVotes = Object.values(votes).filter(v => v === 'Boiler Up!').length;
            const noVotes = players.length - yesVotes;

            if (yesVotes > noVotes) {
                io.emit('electionPassed', { 
                    msg: `Election Passed! ${yesVotes}-${noVotes}. President ${currentPres.name}, draw your policies.`,
                    presId: currentPres.id 
                });
            } else {
                io.emit('electionFailed', `Election Failed ${yesVotes}-${noVotes}. The Presidency moves on.`);
            }
        }
    });

    // Phase 3: Legislative Session
    socket.on('drawPolicies', () => {
        if (socket.id !== currentPres.id) return;
        if (deck.length < 3) createDeck();
        const hand = deck.splice(0, 3);
        socket.emit('presidentHand', hand);
    });

    socket.on('presidentDiscard', (remainingTwo) => {
        io.to(currentVP.id).emit('vpHand', remainingTwo);
    });

    socket.on('enactPolicy', (policy) => {
        const policyObj = { type: policy, pres: currentPres.name, vp: currentVP.name };
        if (policy === "Tradition") enactedPolicies.tradition.push(policyObj);
        else enactedPolicies.construction.push(policyObj);
        io.emit('policyUpdated', enactedPolicies);
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('updatePlayerList', players);
    });
});

server.listen(3000, () => { console.log('Server running at http://localhost:3000'); });