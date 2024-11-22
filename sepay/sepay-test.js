const net = require("net");

function sendPacket(ipAddress, port = 1234) {
  // Validate input
  if (!ipAddress) {
    console.error(
      "Please provide the IP address as the first parameter (optionally port as second)."
    );
    return;
  }

  console.log(`Sending to ${ipAddress}:${port}`);
  const client = new net.Socket();

  // Data to send (equivalent to { 0x93 } in C++)
  const data = Buffer.from([0x93]);

  // Connect to the server
  client.connect(port, ipAddress, () => {
    console.log("Connected to server.");
    client.write(data, (err) => {
      if (err) {
        console.error("Failed to send data:", err.message);
      } else {
        console.log("Data sent successfully.");
      }
      client.end(); // Close the connection
    });
  });

  client.on("error", (err) => {
    console.error("Error:", err.message);
  });

  client.on("close", () => {
    console.log("Connection closed.");
  });
}

// Example usage
const args = process.argv.slice(2); // Command-line arguments
const ipAddress = args[0];
const port = args[1] ? parseInt(args[1], 10) : 1234;

sendPacket(ipAddress, port);
