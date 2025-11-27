const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    sender: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    imagesFiles: {
        type: [String] 
    },
    otherFiles: {
        type: [String] 
    },
    timestamp: {
        type: Date,
        default: Date.now 
    }
}, { _id: true }); // Mongoose will automatically assign an ID to each message sub-document

const ChatSchema = new Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    client_id: {
        type: String,
        required: true 
    },
    delivery_id: {
        type: String,
        required: true  
    },
    messages: {
        type: [MessageSchema], 
        default: []
    }
});

const Chat = mongoose.model('Chatboxes', ChatSchema);

module.exports = Chat;