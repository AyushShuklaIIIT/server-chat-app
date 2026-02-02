import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    content: { type: String, required: true },
    
    type: { 
      type: String, 
      enum: ["private", "room"], 
      required: true 
    },

    messageType: { 
      type: String, 
      enum: ["text", "image"], 
      default: "text" 
    },

    is_read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;