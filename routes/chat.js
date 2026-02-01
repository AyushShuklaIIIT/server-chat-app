import express from 'express';
const router = express.Router();
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import auth from '../middleware/auth.js';

router.get('/users', auth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.userId } }).select('-password');
        res.json(users);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/rooms', auth, async (req, res) => {
    try {
        const rooms = await Room.find({ members: req.user.userId });
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/rooms', auth, async (req, res) => {
    try {
        const { name, type, members } = req.body;
        const allMembers = [...new Set([...members, req.user.userId])];

        const newRoom = new Room({
            name,
            type,
            members: allMembers,
            admin: req.user.userId
        });

        await newRoom.save();
        res.json(newRoom);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/history/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const currentUserId = req.user.userId;

    // console.log(`🔍 Fetching ${type} history for ID: ${id}`);

    let messages;

    if (type === 'room') {
      messages = await Message.find({ room_id: id })
        .populate('sender_id', 'username avatar')
        .sort({ createdAt: 1 });
    } else {
      messages = await Message.find({
        $or: [
          { sender_id: currentUserId, receiver_id: id },
          { sender_id: id, receiver_id: currentUserId }
        ]
      })
      .populate('sender_id', 'username avatar')
      .sort({ createdAt: 1 });
    }

    // console.log(`Found ${messages.length} messages`);
    res.json(messages);
  } catch (err) {
    console.error("History Error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete('/rooms/:roomId', auth, async (req, res) => {
  try {
    await Message.deleteMany({ room_id: req.params.roomId });
    await Room.findByIdAndDelete(req.params.roomId);
    res.json({ message: 'Room deleted' });
  } catch {
    res.status(500).json({ message: 'Server Error' });
  }
});

router.delete('/messages/:messageId', auth, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: 'Message not found' });

    if (msg.sender_id.toString() !== req.user.userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await Message.findByIdAndDelete(req.params.messageId);
    res.json({ message: 'Message deleted' });
  } catch {
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;