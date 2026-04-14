const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    socket.on('create-room', (adminName) => {
        socket.join(adminName);
    });

    socket.on('join-room', (adminName, userName) => {
        socket.join(adminName);
        socket.to(adminName).emit('user-joined', socket.id, userName);
    });

    socket.on('signal', (toId, signalData) => {
        io.to(toId).emit('signal', socket.id, signalData);
    });

    socket.on('chat-message', (room, userName, message) => {
        io.to(room).emit('chat-message', userName, message);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});