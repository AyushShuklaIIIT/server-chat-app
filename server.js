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
    console.log(`🔍 Socket Attempting Connection... Token: ${token ? 'Present' : 'Missing'}`);
    
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
    console.log(`Socket connected: ${socket.id}`);
    console.log(`User connected: ${socket.userId}`);

    await User.findByIdAndUpdate(socket.userId, { status: 'online' });
    io.emit('user_status', { userId: socket.userId, status: 'online'});

    socket.join(socket.userId);
    console.log(`User ${socket.userId} joined room: ${socket.userId}`)

    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.userId} joined room ${roomId}`);
    });

    socket.on('send_message', async (data) => {
    console.log("1️⃣ SERVER RECEIVED DATA:", data);

    try {
      const { content, type, room_id, sender_id } = data;

      if (!content || !type || !room_id) {
        console.error("❌ MISSING FIELDS. Content:", content, "Type:", type, "Room/Receiver:", room_id);
        return;
      }

      console.log("2️⃣ PREPARING TO SAVE...");

      const newMessage = new Message({
        sender_id: socket.userId,
        content: content,
        type: type,
        room_id: type === 'room' ? room_id : null,
        receiver_id: type === 'private' ? room_id : null 
      });

      console.log("3️⃣ MODEL INSTANCE CREATED:", newMessage);

      const savedMessage = await newMessage.save();
      
      console.log("✅ SUCCESS! SAVED TO DB:", savedMessage._id);
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
        console.log(`User disconnected: ${socket.userId}`);
        await User.findByIdAndUpdate(socket.userId, { status: 'offline' });
        io.emit('user_status', { userId: socket.userId, status: 'offline'});
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));