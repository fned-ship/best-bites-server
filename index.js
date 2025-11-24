const express = require("express");
const http = require("http");
const cors = require("cors") ;  //  It allows your server to handle requests from different origins (domains)
const mongoose = require('mongoose');
const { Server } = require("socket.io"); // live updates
const path = require('path');
const app = express();

//create server 

const server = http.createServer(app);

//envirenement variable
const dotenv = require('dotenv');
dotenv.config();

// port
const port = process.env.PORT || 3001;
//gemini 
const GEMINI_API_KEY=process.env.GEMINI_API_KEY
//server url
const serverURL=process.env.serverURL   
//client
const clientDomainName=process.env.ClientDomainName;

const emailUserName=process.env.emailAdress;

//middelware
app.use(express.json()) ; // Parses incoming requests with JSON payloads.
app.use(express.urlencoded({ extended: true })) // Parses incoming requests with URL-encoded payloads, supporting complex objects.
app.use(cors())  //Allow all origins to access the API 
app.use('/imagesProfile', express.static(path.join(__dirname, 'public/imagesProfile')));



//connect to db
const uri = process.env.ATLAS_URI;
mongoose.connect(uri) // {useNewUrlParser: true,useUnifiedTopology: true,}
.then(() => {
    console.log("MongoDB database connection established successfully");
    // Perform operations on the database
})
.catch((err) => {
    console.error("Error connecting to MongoDB:", err);
});

//routes
let signupRoute=require('./routes/signupRoute');
let activateRouter=require('./routes/activateRouter');
let loginRouter=require('./routes/loginRouter');
let resetRouter=require('./routes/resetRouter');
let analyticsRouter=require("./routes/analyticsRouter");
let orderRouter=require("./routes/orderRouter");
let productRouter=require("./routes/productRouter");
let stockRouter=require("./routes/stockRouter");

stockRouter(app);
productRouter(app);
orderRouter(app);
analyticsRouter(app);
signupRoute(app,clientDomainName,emailUserName);
activateRouter(app);
loginRouter(app);
resetRouter(app,clientDomainName,emailUserName);

//socket.io
// const io = new Server(server, {
//     cors: {
//         origin: clientDomainName,
//         methods: ["GET", "POST"],
//     },  
// });

// socket connection
// io.on("connection", (socket) => {
    
// });


//listening to the port
server.listen(port,()=>{
    console.log("port connected at "+port);
})