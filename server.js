const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const activeRooms = {}; 
const userSockets = {}; 

io.on('connection', (socket) => {
    socket.on('create-room', (adminName) => {
        if (activeRooms[adminName]) return socket.emit('error-msg', 'Ник занят!');
        activeRooms[adminName] = { adminId: socket.id, users: {} };
        userSockets[socket.id] = { room: adminName, nick: adminName };
        socket.join(adminName);
        socket.emit('room-ready', true);
    });

    socket.on('join-room', (adminName, userName) => {
        if (!activeRooms[adminName]) return socket.emit('error-msg', 'Трансляция не найдена!');
        if (Object.values(activeRooms[adminName].users).includes(userName)) return socket.emit('error-msg', 'Ник уже занят в этой комнате!');

        activeRooms[adminName].users[socket.id] = userName;
        userSockets[socket.id] = { room: adminName, nick: userName };
        socket.join(adminName);
        socket.emit('room-ready', false);
        socket.to(adminName).emit('user-joined', socket.id, userName);
    });

    // ЛОГИКА КИКА (Только для админа)
    socket.on('kick-user', (targetId) => {
        const info = userSockets[socket.id];
        if (info && activeRooms[info.room] && activeRooms[info.room].adminId === socket.id) {
            io.to(targetId).emit('kicked-notice'); // Уведомляем бедолагу
            const targetSocket = io.sockets.sockets.get(targetId);
            if (targetSocket) targetSocket.leave(info.room);
        }
    });

    socket.on('signal', (toId, signalData) => io.to(toId).emit('signal', socket.id, signalData));
    
    socket.on('stop-stream-notice', (room) => {
        socket.to(room).emit('stream-cleared');
    });

    socket.on('chat-message', (room, userName, message) => {
        io.to(room).emit('chat-message', { id: socket.id, user: userName, text: message });
    });

    socket.on('disconnect', () => {
        const info = userSockets[socket.id];
        if (info) {
            if (activeRooms[info.room]) {
                delete activeRooms[info.room].users[socket.id];
                socket.to(info.room).emit('user-left', info.nick);
                if (activeRooms[info.room].adminId === socket.id) {
                    delete activeRooms[info.room];
                    socket.to(info.room).emit('error-msg', 'Админ завершил стрим');
                }
            }
            delete userSockets[socket.id];
        }
    });
});

server.listen(3000, () => console.log('Work on port 3000'));
