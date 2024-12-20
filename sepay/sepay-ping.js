const net = require("net");

const ipAddress = "192.168.0.105";
const port = 1234;
const transactionCreate = {
  reference: "AAA-000",
  amount: 10,
};

sendPacket({ ipAddress, port, transactionCreate });

function sendPacket(params) {
  const { ipAddress, port, transactionCreate } = params;
  // Validate input
  if (!ipAddress) {
    console.error(
      "Please provide the IP address as the first parameter (optionally port as second)."
    );
    return;
  }

  console.log(`Sending to ${ipAddress}:${port}`);
  const client = new net.Socket();

  const data = Buffer.from([0x93]);
  console.log(data);

  client.on("data", (data) => {
    console.error("DATA: ", data);
    client.end(); // Close the connection
  });

  client.on("error", (err) => {
    console.error("Error:", err.message);
  });

  client.on("close", () => {
    console.log("Connection closed.");
  });

  client.on("end", () => {
    console.log("disconnected from server");
  });

  // Connect to the server
  client.connect(port, ipAddress, () => {
    console.log("Connected to server...");
    client.write(data, (err) => {
      if (err) {
        console.error("Failed to send data:", err.message);
      } else {
        console.log("Data sent successfully...");
      }
    });
  });
}
