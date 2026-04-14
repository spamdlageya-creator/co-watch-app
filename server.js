const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Функция для рассылки кол-ва зрителей
function updateRoomStats(roomName) {
    const clients = io.sockets.adapter.rooms.get(roomName);
    const count = clients ? clients.size : 0;
    io.to(roomName).emit('room-stats', { viewerCount: count });
}

io.on('connection', (socket) => {
    socket.on('create-room', (adminName) => {
        socket.join(adminName);
        updateRoomStats(adminName);
    });

    socket.on('join-room', (adminName, userName) => {
        socket.join(adminName);
        socket.to(adminName).emit('user-joined', socket.id, userName);
        updateRoomStats(adminName);
    });

    socket.on('signal', (toId, signalData) => {
        io.to(toId).emit('signal', socket.id, signalData);
    });

    socket.on('chat-message', (room, data) => {
        // Пересылаем объект с id, текстом, автором и цитатой
        io.to(room).emit('chat-message', data);
    });

    socket.on('add-reaction', (room, messageId, emoji) => {
        io.to(room).emit('update-reaction', { messageId, emoji });
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            // Используем setTimeout, чтобы дождаться выхода из комнаты
            setTimeout(() => updateRoomStats(room), 100);
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Live on port ${PORT}`));
