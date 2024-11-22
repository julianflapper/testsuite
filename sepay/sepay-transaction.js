const net = require("net");

function calculateLRC(buffer) {
  // XOR all bytes from STX to ETX
  return buffer.slice(0, -1).reduce((lrc, byte) => lrc ^ byte, 0);
}

function checkConnection(host, port) {
  console.log("Checking connection to " + host + ":" + port);
  return new Promise((resolve, reject) => {
    // Create connection buffer
    const bufferWithoutLRC = Buffer.from([
      0x02, // STX
      0x00,
      0x00, // Length (0 bytes for content)
      0x99, // Command 0x99 (Check Connection)
      0x03, // ETX
    ]);

    // Calculate LRC
    const lrc = calculateLRC(
      Buffer.concat([bufferWithoutLRC, Buffer.from([0x00])])
    );

    // Create full buffer with calculated LRC
    const buffer = Buffer.concat([bufferWithoutLRC, Buffer.from([lrc])]);

    // Create TCP client
    const client = new net.Socket();

    // Set connection timeout
    client.setTimeout(5000);

    client.connect(port, host, () => {
      // Send check connection command
      client.write(buffer);
    });

    // Handle response
    client.on("data", (data) => {
      console.log("DATA RECEIVED: " + data);
      // Parse response according to protocol
      const responseCode = data[4];
      const applicationVersion = data.slice(5).toString("utf8").split("/")[0];
      const configVersion = data.slice(5).toString("utf8").split("/")[1];

      resolve({
        connectionOk: responseCode === 0x00,
        applicationVersion,
        configVersion,
      });

      client.destroy();
    });

    // Handle errors
    client.on("error", reject);
    client.on("timeout", () => {
      client.destroy();
      reject(new Error("Connection timeout"));
    });
  });
}

// Example usage
checkConnection("192.168.0.105", 1234).then(console.log).catch(console.error);
