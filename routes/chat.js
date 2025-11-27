let Chat = require('../models/chat');
const multer = require("multer");
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("image")) {
      cb(null, path.join(__dirname, '../public/images'));
    } else {
      cb(null, path.join(__dirname, '../public/files'));
    }
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}_${Math.random()}_${file.originalname}`;
    cb(null, fileName);
  },
});

const upload = multer({ storage });

let chatRouter=(app,io)=>{

    // GET chat by id
    app.get("/getchat/:id", async (req, res) => {
        try {
            const chat = await Chat.findOne({ id: req.params.id });
            if (!chat) return res.status(404).json({ message: "Chat not found" });
            res.json(chat);
        } catch (err) { res.status(500).json(err); }
    });


    app.post("/send/:chatId",upload.array("files", 10), async (req, res) => {
        try {
            const chatId = req.params.chatId;
            const { sender, text } = req.body;

            let images = [];
            let otherFiles = [];

            req.files.forEach(file => {
                if (file.mimetype.startsWith("image")) {
                    images.push("/images/" + file.filename);
                } else {
                    otherFiles.push("/files/" + file.filename);
                }
            });

            const newMessage = {
                sender,
                text,
                imagesFiles: images,
                otherFiles,
                timestamp: new Date()
            };

            const chat = await Chat.findOneAndUpdate(
                { id: chatId },
                { $push: { messages: newMessage } },
                { new: true }
            );

            // Emit socket (server will broadcast)
            io.to(chatId).emit("newMessage", newMessage);

            res.json(newMessage);

        } catch (err) { res.status(500).json(err); }
    });

    // CREATE new chat (one time)
    app.post("/createnewchat", async (req, res) => {
        try {
            const { id, client_id, delivery_id } = req.body;

            const existing = await Chat.findOne({ id });
            if (existing) return res.json(existing);

            const chat = await Chat.create({ id, client_id, delivery_id, messages: [] });
            res.json(chat);

        } catch (err) { res.status(500).json(err); }
    });

}


module.exports = chatRouter;