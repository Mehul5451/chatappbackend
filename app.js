const express = require("express");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const port = process.env.PORT || 3000;


dotenv.config();
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

require("./conn");
const { ChatUser, Message } = require("./modu");

const io = new Server(server, {
  cors: {
    origin: [ "*"],
    methods: ["GET", "POST"]
  }
});

const userSocketMap = {};

// Middleware
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

// Routes
app.post("/submit", async (req, res) => {
  const { name, email, phone, password } = req.body;
  const existing = await ChatUser.findOne({ email });
  if (existing) return res.status(409).send("User already exists");

  const hash = await bcrypt.hash(password, 10);
  const newUser = new ChatUser({ name, email, phone, password: hash });
  await newUser.save();
  res.status(201).send("User registered successfully");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await ChatUser.findOne({ email });
  if (!user) return res.status(404).send("User not found");

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).send("Invalid credentials");

  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  res.status(200).json({ token, user });
});

app.get("/getuser", verifyToken, async (req, res) => {
  const users = await ChatUser.find({ _id: { $ne: req.user.id } });
  res.json(users);
});


app.get("/user/:id", async (req, res) => {
  try {
    const user = await ChatUser.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");
    res.json(user);
  } catch (err) {
    res.status(500).send("Server error");
  }
});



app.get('/messages/:userId/:peerId', async (req, res) => {
  const { userId, peerId } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: peerId },
        { senderId: peerId, receiverId: userId },
      ]
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

   app.delete('/messages/:id', async (req, res) => {
     try {
       const message = await Message.findByIdAndDelete(req.params.id);
       if (!message) return res.status(404).json({ error: "Message not found" });
       res.status(200).json({ success: true });
     } catch (err) {
       res.status(500).json({ error: "Server error" });
     }
   });
   






// routes/auth.js or wherever you handle auth
app.post("/logout", (req, res) => {
  // If you're storing refresh tokens in DB, remove them here
  res.status(200).json({ message: "Logout successful" });
});


// Socket.IO
io.on("connection", (socket) => {
  socket.on("register_user", (userId) => {
  userSocketMap[userId] = socket.id;
  socket.join(userId);
  });

  


 socket.on("send_message", async ({ senderId, receiverId, message }) => {
  // Save to DB
  const newMsg = new Message({ senderId, receiverId, message });
  await newMsg.save();

  // Emit to receiver
  io.to(receiverId).emit("receive_message", {
    from: senderId,
    to: receiverId,
    text: message,
  });
});

  socket.on("disconnect", () => {
    for (const [userId, socketId] of Object.entries(userSocketMap)) {
      if (socketId === socket.id) {
        delete userSocketMap[userId];
      }
    }
  });
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
