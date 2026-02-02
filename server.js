import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import Message from './models/Message.js';
import User from './models/User.js';

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: [process.env.CLIENT_URL || "http://localhost:3000", "http://127.0.0.1:5173"], credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

try {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');
} catch (err) {
  console.log(err);
  process.exit(1);
}

const io = new Server(server, {
    cors: {
        origin: [process.env.CLIENT_URL || "http://localhost:3000", "http://127.0.0.1:5173"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

io.use(async (socket, next) => {
    try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: No Token'));
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    console.error("⛔ Socket Auth Failed:", err.message);
    next(new Error('Authentication error: Invalid Token'));
  }
});

io.on('connection', async (socket) => {
    await User.findByIdAndUpdate(socket.userId, { status: 'online' });
    io.emit('user_status', { userId: socket.userId, status: 'online'});

    socket.join(socket.userId);

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('send_message', async (data) => {
    try {
      const { content, type, room_id, messageType } = data;

      if (!content || !type || !room_id) {
        console.error("❌ MISSING FIELDS:", data);
        return;
      }

      const newMessage = new Message({
        sender_id: socket.userId,
        content: content,
        type: type,
        messageType: messageType || 'text',
        room_id: type === 'room' ? room_id : null,
        receiver_id: type === 'private' ? room_id : null 
      });

      const savedMessage = await newMessage.save();
      const populatedMessage = await savedMessage.populate('sender_id', 'username avatar');

      if (type === 'room') {
        io.to(room_id).emit('receive_message', populatedMessage);
      } else {
        io.to(room_id).emit('receive_message', populatedMessage);
        io.to(socket.userId).emit('receive_message', populatedMessage);
      }

    } catch (err) {
      console.error("❌ CRASH DURING SAVE:");
      console.error(err);
    }
  });

    socket.on('typing', ({ chatId, isTyping }) => {
        socket.to(chatId).emit('user_typing', { userId: socket.userId, chatId, isTyping });
    });
    
    socket.on('disconnect', async () => {
        await User.findByIdAndUpdate(socket.userId, { status: 'offline' });
        io.emit('user_status', { userId: socket.userId, status: 'offline'});
    });
});

app.get('/', (req, res) => {
  res.send('API is running successfully');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));