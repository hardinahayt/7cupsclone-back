const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Test Client: Connected to local proxy");
    const rooms = ["3e569932f45ed09bdd8ac237dcb898b7", "Noni"];
    console.log("Test Client: Emitting addToRooms", rooms);
    socket.emit("addToRooms", rooms);
});

socket.onAny((event, ...args) => {
    console.log(`Test Client received event: ${event}`, JSON.stringify(args, null, 2));
});

socket.on("disconnect", () => {
    console.log("Test Client: Disconnected");
});
