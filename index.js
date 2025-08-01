const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://futebol-online.vercel.app",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));

const friction = 0.90;
const wallThickness = 10;
const canvasWidth = 1800;
const canvasHeight = 1080;
const goalHeight = 300 * 1.10;
const maxGoals = 5;

let rooms = {};

function createGameState() {
    const radiusPlayer = 30 * 1.5;
    const radiusBall = 30;

    let state = {
        pieces: [],
        ball: { x: canvasWidth / 2, y: canvasHeight / 2, vx: 0, vy: 0, radius: radiusBall, angle: 0, angularVelocity: 0 },
        scoreRed: 0,
        scoreBlue: 0,
        gameStarted: false,
        lastGoalScorer: null
    };

    const addPiece = (props) => state.pieces.push({ id: state.pieces.length, ...props });

    addPiece({ x: wallThickness + radiusPlayer, y: canvasHeight / 2, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth - wallThickness - radiusPlayer, y: canvasHeight / 2, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });

    addPiece({ x: canvasWidth * 0.15, y: canvasHeight * 0.25, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.1, y: canvasHeight * 0.4, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.1, y: canvasHeight * 0.6, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.15, y: canvasHeight * 0.75, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.3, y: canvasHeight * 0.2, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.25, y: canvasHeight * 0.4, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.25, y: canvasHeight * 0.6, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.3, y: canvasHeight * 0.8, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.4, y: canvasHeight * 0.45, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });
    addPiece({ x: canvasWidth * 0.4, y: canvasHeight * 0.55, vx: 0, vy: 0, radius: radiusPlayer, team: 0 });

    addPiece({ x: canvasWidth * 0.85, y: canvasHeight * 0.25, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.9, y: canvasHeight * 0.4, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.9, y: canvasHeight * 0.6, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.85, y: canvasHeight * 0.75, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.7, y: canvasHeight * 0.2, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.75, y: canvasHeight * 0.4, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.75, y: canvasHeight * 0.6, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.7, y: canvasHeight * 0.8, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.6, y: canvasHeight * 0.45, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });
    addPiece({ x: canvasWidth * 0.6, y: canvasHeight * 0.55, vx: 0, vy: 0, radius: radiusPlayer, team: 1 });

    return state;
}

function resolveCollision(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = p1.radius + p2.radius;
    if (dist === 0 || dist >= minDist) return;
    const overlap = minDist - dist;
    const nx = dx / dist;
    const ny = dy / dist;
    p1.x -= nx * overlap / 2;
    p1.y -= ny * overlap / 2;
    p2.x += nx * overlap / 2;
    p2.y += ny * overlap / 2;
    const v1n = p1.vx * nx + p1.vy * ny;
    const v1t = p1.vx * -ny + p1.vy * nx;
    const v2n = p2.vx * nx + p2.vy * ny;
    const v2t = p2.vx * -ny + p2.vy * nx;
    p1.vx = v2n * nx + v1t * -ny;
    p1.vy = v2n * ny + v1t * nx;
    p2.vx = v1n * nx + v2t * -ny;
    p2.vy = v1n * ny + v2t * nx;
}

function updateGame(state) {
    if (!state.gameStarted) return;

    [...state.pieces, state.ball].forEach(p => {
        if (Math.hypot(p.vx, p.vy) > 0.1) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= friction;
            p.vy *= friction;
        } else {
            p.vx = 0; p.vy = 0;
        }
    });

    const goalTop = canvasHeight / 2 - goalHeight / 2;
    const goalBottom = canvasHeight / 2 + goalHeight / 2;

    if (state.ball.y > goalTop && state.ball.y < goalBottom) {
        if (state.ball.x - state.ball.radius < wallThickness) {
            state.scoreBlue++;
            state.lastGoalScorer = 0;
            io.to(state.roomName).emit('goalScored');
            checkWinCondition(state);
            return;
        } else if (state.ball.x + state.ball.radius > canvasWidth - wallThickness) {
            state.scoreRed++;
            state.lastGoalScorer = 1;
            io.to(state.roomName).emit('goalScored');
            checkWinCondition(state);
            return;
        }
    }

    [...state.pieces, state.ball].forEach(p => {

        if (p.y - p.radius < wallThickness) { p.y = p.radius + wallThickness; p.vy *= -0.8; }
        if (p.y + p.radius > canvasHeight - wallThickness) { p.y = canvasHeight - p.radius - wallThickness; p.vy *= -0.8; }

        if (p.x - p.radius < wallThickness && (p.y < goalTop || p.y > goalBottom)) {
            p.x = p.radius + wallThickness;
            p.vx *= -0.8;
        }
        if (p.x + p.radius > canvasWidth - wallThickness && (p.y < goalTop || p.y > goalBottom)) {
            p.x = canvasWidth - p.radius - wallThickness;
            p.vx *= -0.8;
        }
    });

    for (let i = 0; i < state.pieces.length; i++) {
        resolveCollision(state.pieces[i], state.ball);
        for (let j = i + 1; j < state.pieces.length; j++) {
            resolveCollision(state.pieces[i], state.pieces[j]);
        }
    }
}

function checkWinCondition(state) {
    let winner = null;
    if (state.scoreRed >= maxGoals) winner = 'Time Vermelho';
    if (state.scoreBlue >= maxGoals) winner = 'Time Azul';

    if (winner) {
        io.to(state.roomName).emit('gameOver', { winner: winner });

        clearInterval(rooms[state.roomName].interval);
        delete rooms[state.roomName];
        broadcastRoomList();
    } else {
        startNewRound(state);
    }
}

function startNewRound(state) {
    const originalState = createGameState();
    state.pieces = originalState.pieces;
    state.ball = originalState.ball;
    state.gameStarted = false;

    let countdown = 5;
    const countdownInterval = setInterval(() => {
        io.to(state.roomName).emit('countdown', countdown);
        countdown--;
        if (countdown < 0) {
            clearInterval(countdownInterval);
            state.gameStarted = true;
        }
    }, 1000);
}

function getPublicRooms() {
    const publicRooms = {};
    for (const roomName in rooms) {
        publicRooms[roomName] = {
            playerCount: rooms[roomName].players.length,
            hasPassword: !!rooms[roomName].password,
        };
    }
    return publicRooms;
}

function broadcastRoomList() {
    io.emit('roomList', getPublicRooms());
}

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);
    socket.emit('roomList', getPublicRooms());

    socket.on('createRoom', ({ roomName, password }) => {
        if (rooms[roomName]) {
            return socket.emit('joinError', 'Uma sala com este nome já existe.');
        }
        socket.join(roomName);
        rooms[roomName] = {
            players: [socket.id],
            password: password,
            state: createGameState(),
        };
        rooms[roomName].state.roomName = roomName;
        socket.emit('waitingForOpponent');
        broadcastRoomList();
    });

    socket.on('joinRoom', ({ roomName, password }) => {
        const room = rooms[roomName];
        if (!room) {
            return socket.emit('joinError', 'Sala não encontrada.');
        }
        if (room.players.length >= 2) {
            return socket.emit('joinError', 'A sala está cheia.');
        }
        if (room.password && room.password !== password) {
            return socket.emit('joinError', 'Senha incorreta.');
        }

        socket.join(roomName);
        room.players.push(socket.id);
        
        const player1Id = room.players[0];
        const player2Id = room.players[1];

        io.to(player1Id).emit('gameStart', { team: 0, state: room.state });
        io.to(player2Id).emit('gameStart', { team: 1, state: room.state });
        
        room.interval = setInterval(() => {
            updateGame(room.state);
            io.to(roomName).emit('gameState', room.state);
        }, 1000 / 60);

        startNewRound(room.state);
        broadcastRoomList();
    });

    socket.on('playerAction', (data) => {
        const roomName = Array.from(socket.rooms)[1];
        const room = rooms[roomName];
        if (!room) return;

        const playerIndex = room.players.indexOf(socket.id);
        const piece = room.state.pieces.find(p => p.id === data.pieceId);

        if (piece && piece.team === playerIndex && room.state.gameStarted) {
            piece.vx = data.vx;
            piece.vy = data.vy;
        }
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectado:', socket.id);
        for (const roomName in rooms) {
            const room = rooms[roomName];
            const playerIndex = room.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                io.to(roomName).emit('opponentLeft');
                if (room.interval) {
                    clearInterval(room.interval);
                }
                delete rooms[roomName];
                broadcastRoomList();
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
