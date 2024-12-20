const net = require("net");

function calculateLRC(buffer) {
  let lrc = 0; // Start with 0, assuming XOR operation starts with a neutral element.

  // Iterate over each byte of the buffer
  for (let i = 0; i < buffer.length; i++) {
    lrc ^= buffer[i]; // XOR current byte with the accumulated result
  }

  return lrc;
}
function checkConnection(host, port) {
  console.log("Checking connection to " + host + ":" + port);
  return new Promise((resolve, reject) => {
    // Create connection buffer
    const bufferWithoutLRC = Buffer.from([
      0x02, // STX
      0x00,
      0x02, // Length (0 bytes for content)
      0x99, // Command 0x99 (Check Connection)
      0x03, // ETX
    ]);

    // Calculate LRC
    const lrc = calculateLRC(
      Buffer.concat([bufferWithoutLRC, Buffer.from([0x00])])
    );

    // Create full buffer with calculated LRC
    const buffer = Buffer.concat([bufferWithoutLRC, Buffer.from([lrc])]);

    console.log("Buffer created");
    console.log(buffer);

    // Create TCP client
    const client = new net.Socket();

    // Handle response
    client.once("data", (data) => {
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
    client.on("error", (err) => {
      console.log("Error");
      reject();
    });
    client.on("timeout", () => {
      client.destroy();
      reject(new Error("ERROR Connection timeout"));
    });

    console.log("Connecting...");
    client.connect(port, host, () => {
      // Send check connection command
      console.log("Writing...");
      client.write(buffer);
    });
  });
}

// Example usage
checkConnection("192.168.0.105", 1234).then(console.log).catch(console.error);
