const net = require("net");

const HOST = "localhost"; // Change to the server address
const PORT = 8080; // Change to the server port

const headers = [
  "Host: localhost",
  "User-Agent: Slow-Client",
  "Accept: text/html",
  "Connection: keep-alive"
];

const socket = net.createConnection(PORT, HOST, () => {
  console.log("Connected to server");

  // Send the first request line
  socket.write("GET / HTTP/1.1\r\n");

  let i = 0;

  // Function to send headers one by one with delay
  function sendNextHeader () {
    if (i < headers.length) {
      socket.write(headers[i] + "\r\n");
      console.log(`Sent: ${headers[i]}`);
      i++;
      setTimeout(sendNextHeader, 3000); // 3-second delay per header
    } else {
      // End headers with an empty line to indicate request completion
      setTimeout(() => {
        socket.write("\r\n");
        console.log("Finished sending headers.");
      }, 3000);
    }
  }

  // Start sending headers slowly
  sendNextHeader();
});

socket.on("data", (data) => {
  console.log("Received response:", data.toString());
  socket.end();
});

socket.on("end", () => {
  console.log("Disconnected from server");
});

socket.on("error", (err) => {
  console.error("Socket error:", err);
});
