const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Хранилище состояния сервера
const activeRooms = {}; // { 'RoomName': { adminId: '...', users: { 'socketId': 'Nickname' } } }
const userSockets = {}; // { 'socketId': { room: 'RoomName', nick: 'Nickname' } }

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // СОЗДАНИЕ КОМНАТЫ
    socket.on('create-room', (adminName) => {
        if (activeRooms[adminName]) {
            return socket.emit('error-msg', 'Комната с таким ником уже существует! Придумайте другой ник или закройте старую вкладку.');
        }
        
        activeRooms[adminName] = { adminId: socket.id, users: {} };
        activeRooms[adminName].users[socket.id] = adminName;
        userSockets[socket.id] = { room: adminName, nick: adminName };
        
        socket.join(adminName);
        socket.emit('room-ready', true); // Подтверждаем создание
    });

    // ПОДКЛЮЧЕНИЕ К КОМНАТЕ
    socket.on('join-room', (adminName, userName) => {
        if (!activeRooms[adminName]) {
            return socket.emit('error-msg', 'Такой трансляции не существует! Проверьте ник админа.');
        }
        
        // Проверка занятости ника
        const existingUsers = Object.values(activeRooms[adminName].users);
        if (existingUsers.includes(userName)) {
            return socket.emit('error-msg', 'Этот ник уже занят в чате! Выберите другой.');
        }

        activeRooms[adminName].users[socket.id] = userName;
        userSockets[socket.id] = { room: adminName, nick: userName };

        socket.join(adminName);
        socket.emit('room-ready', false); // Подтверждаем вход
        socket.to(adminName).emit('user-joined', socket.id, userName);
    });

    // WEBRTC СИГНАЛИНГ
    socket.on('signal', (toId, signalData) => {
        io.to(toId).emit('signal', socket.id, signalData);
    });

    // ЧАТ
    socket.on('chat-message', (room, userName, message) => {
        io.to(room).emit('chat-message', userName, message);
    });

    // ОТКЛЮЧЕНИЕ (Выход из трансляции)
    socket.on('disconnect', () => {
        const info = userSockets[socket.id];
        if (info) {
            const { room, nick } = info;
            
            if (activeRooms[room]) {
                delete activeRooms[room].users[socket.id];
                // Уведомляем всех, что человек вышел
                socket.to(room).emit('user-left', nick);
                
                // Если вышел админ - удаляем комнату
                if (activeRooms[room].adminId === socket.id) {
                    delete activeRooms[room];
                    socket.to(room).emit('error-msg', 'Админ завершил трансляцию (отключился).');
                }
            }
            delete userSockets[socket.id];
        }
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
