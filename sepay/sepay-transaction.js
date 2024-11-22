const net = require("net");

/**
 * Helper function to calculate LRC (Longitudinal Redundancy Check)
 */
function calculateLRC(data) {
  return data.reduce((lrc, byte) => lrc ^ byte, 0);
}

/**
 * Builds a Sepay packet
 */
function buildPacket(command, content = "") {
  const STX = 0x02; // Start of text
  const ETX = 0x03; // End of text
  const FLAG = "|".charCodeAt(0); // Separator
  const CMD = command.charCodeAt(0);

  // Convert content to buffer
  const contentBuffer = Buffer.from(content, "utf8");
  const len = contentBuffer.length + 2; // CMD + FLAG + content length
  const lenBuffer = Buffer.from([Math.floor(len / 256), len % 256]);

  const packet = Buffer.concat([
    Buffer.from([STX]), // Start of packet
    lenBuffer, // Length
    Buffer.from([CMD]), // Command
    Buffer.from([FLAG]), // Flag
    contentBuffer, // Content
    Buffer.from([ETX]), // End of packet
  ]);

  // Calculate LRC
  const lrc = calculateLRC(packet.slice(1)); // Exclude STX
  return Buffer.concat([packet, Buffer.from([lrc])]);
}

/**
 * Parses a Sepay response packet
 */
function parseResponse(data) {
  const STX = 0x02;
  const ETX = 0x03;

  if (data[0] !== STX || data[data.length - 2] !== ETX) {
    throw new Error("Invalid packet structure");
  }

  const len = data.readUInt16BE(1);
  const cmd = String.fromCharCode(data[3]);
  const content = data.slice(5, 5 + len - 2).toString("utf8");
  const lrc = data[data.length - 1];

  // Verify LRC
  if (calculateLRC(data.slice(1, -1)) !== lrc) {
    throw new Error("LRC mismatch");
  }

  return { cmd, content };
}

/**
 * Connects to the Sepay terminal
 */
class SepayClient {
  constructor(ip, port) {
    this.ip = ip;
    this.port = port;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      this.client.connect(this.port, this.ip, () => resolve());
      this.client.on("error", (err) => {
        console.log("ERROR!!");
        reject();
      });
    });
  }

  sendPacket(packet) {
    return new Promise((resolve, reject) => {
      console.log("Sending Packet:", packet.toString("hex"));
      this.client.on("data", (data) => {
        console.log("Received Packet: ", data);
        try {
          const response = parseResponse(data);
          console.log("Packet success: ", data);
          resolve(response);
        } catch (error) {
          console.log("Error sending packet: ", error.message);
          reject(error);
        }
      });
      console.log("Sending...");
      const sent = this.client.write(packet);
      console.log("Sent: ", sent);
    });
  }

  close() {
    this.client.destroy();
  }
}

/**
 * Creates a payment transaction
 */
async function createTransaction(client, amount, reference, merchantRef = "") {
  console.log("Starting transaction...");
  const amountInCents = String(amount * 100).padStart(12, "0");
  const content = `${amountInCents}|${reference}|${merchantRef}|0`;

  console.log("Amount: ", amountInCents);
  console.log("Content: ", content);

  const packet = buildPacket("\x01", content);

  console.log("Packet: ", packet);

  const response = await client.sendPacket(packet);
  console.log("Create Transaction Response: ", response);
  return response;
}

/**
 * Checks the status of a transaction
 */
async function checkTransactionStatus(client, reference) {
  console.log("Checking transaction status...");
  const content = `${reference}`;
  const packet = buildPacket("\x03", content);

  console.log("Packet: ", packet);

  const response = await client.sendPacket(packet);
  console.log("Transaction Status Response:", response);
  return response;
}

/**
 * Checks the status of the terminal
 */
async function checkTerminalStatus(client, reference) {
  console.log("Checking terminal status...");
  const packet = buildPacket("\x05");
  console.log("Packet: ", packet);

  const response = await client.sendPacket(packet);
  console.log("Terminal Status Response:", response);
  return response;
}

/**
 * Example usage
 */
(async () => {
  const ip = "192.168.0.105"; // Replace with terminal IP
  const port = 1234; // Replace with terminal port
  const client = new SepayClient(ip, port);

  try {
    console.log("Connecting to Sepay terminal...");
    await client.connect();

    console.log("Connected!");

    client.on("data", (data) => {
      console.log("Received Packet: ", data);
    });

    const data = Buffer.from([0x93]);
    console.log(data);
    client.write(data, (err) => {
      if (err) {
        console.error("Failed to send data:", err.message);
      } else {
        console.log("SENT.");
      }
      client.end(); // Close the connection
    });

    // const terminalStatus = await checkTerminalStatus(client);
    // console.log("Terminal Status: ", terminalStatus);

    // Example: Create a transaction
    // const transactionResponse = await createTransaction(
    //   client,
    //   12.34,
    //   "AAA-123",
    //   "MRCHT45"
    // );
    // console.log("Transaction Response: ", transactionResponse);

    // Example: Check transaction status
    // const statusResponse = await checkTransactionStatus(client, "AAA-123");
    // console.log("Status: ", statusResponse);
  } catch (error) {
    console.error("Error: ", error.message);
  } finally {
    client.close();
  }
  console.log("DONE!");
})();
