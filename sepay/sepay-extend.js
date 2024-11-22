const net = require("net");

const socket = new net.Socket();

// Replace with your terminal's IP and port
const TERMINAL_IP = "192.168.0.105";
const TERMINAL_PORT = 1234;

// Calculate LRC (Longitudinal Redundancy Check)
function calculateLRC(buffer) {
  return buffer.reduce((lrc, byte) => lrc ^ byte, 0);
}

const commandExtMode = Buffer.from([0x02, 0x00, 0x01, 0x95, 0x7c, 0x03]); // STX, LEN, CMD, FLAG, ETX
const lrcExtMode = calculateLRC(commandExtMode);
const fullPacketExtMode = Buffer.concat([
  commandExtMode,
  Buffer.from([lrcExtMode]),
]);

socket.connect(TERMINAL_PORT, TERMINAL_IP, () => {
  console.log("Connected to terminal");
  console.log("Sending Enable Extended Mode command...");
  socket.write(fullPacketExtMode); // Send the packet
});

socket.once("data", (data) => {
  console.log("Received response:", data);
  // Process response...
  socket.end(); // Close connection
});

socket.on("error", (err) => {
  console.error("Error:", err);
});
