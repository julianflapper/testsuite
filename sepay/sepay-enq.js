const net = require("net");

const socket = new net.Socket();

// Replace with your terminal's IP and port
const TERMINAL_IP = "192.168.0.105";
const TERMINAL_PORT = 1234;

// Calculate LRC (Longitudinal Redundancy Check)
function calculateLRC(buffer) {
  return buffer.reduce((lrc, byte) => lrc ^ byte, 0);
}

// Create ENQ command packet
const commandENQ = Buffer.from([0x02, 0x00, 0x02, 0x05, 0x7c, 0x03]); // STX, LEN, CMD, FLAG, ETX
const lrcENQ = calculateLRC(commandENQ);
const fullPacketENQ = Buffer.concat([commandENQ, Buffer.from([lrcENQ])]);

console.log(fullPacketENQ);

socket.connect(TERMINAL_PORT, TERMINAL_IP, () => {
  console.log("Connected to terminal");
  console.log("Sending ENQ command...");
  socket.write(fullPacketENQ); // Send the packet
});

socket.once("data", (data) => {
  console.log("Received response:", data);
  // Process response...
  socket.end(); // Close connection
});

socket.on("error", (err) => {
  console.error("Error:", err);
});
