import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' }, // We'll generate initials on frontend if empty
    status: { type: String, default: 'offline' },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;