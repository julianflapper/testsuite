const net = require("net");

/**
 * Helper function to calculate LRC (Longitudinal Redundancy Check)
 */
function calculateLRC(data) {
  return data.reduce((lrc, byte) => lrc ^ byte, 0);
}

/**
 * Builds a Sepay packet following the specification:
 * STX LEN CMD FLAG CONTENT ETX LRC
 */
function buildPacket(command, content = "") {
  const STX = 0x02; // Start of text
  const ETX = 0x03; // End of text
  const FLAG = 0x7c; // '|' character
  const CMD = typeof command === "string" ? command.charCodeAt(0) : command;

  // Convert content to buffer if it's a string
  const contentBuffer = Buffer.from(content, "utf8");

  // Calculate length: CMD (1) + FLAG (1) + content length
  const len = 2 + contentBuffer.length;
  const lenBuffer = Buffer.from([Math.floor(len / 256), len % 256]);

  // Build the main packet (excluding STX and LRC)
  const packetContent = Buffer.concat([
    lenBuffer, // Length (2 bytes)
    Buffer.from([CMD]), // Command (1 byte)
    Buffer.from([FLAG]), // Flag (1 byte)
    contentBuffer, // Content (n bytes)
    Buffer.from([ETX]), // ETX (1 byte)
  ]);

  // Calculate LRC over everything except STX
  const lrc = calculateLRC(packetContent);

  // Combine everything into final packet
  return Buffer.concat([
    Buffer.from([STX]), // STX
    packetContent, // Main packet content
    Buffer.from([lrc]), // LRC
  ]);
}

/**
 * Parses a Sepay response packet
 */
function parseResponse(data) {
  const STX = 0x02;
  const ETX = 0x03;

  // Validate packet structure
  if (data[0] !== STX || data[data.length - 2] !== ETX) {
    throw new Error("Invalid packet structure");
  }

  // Parse length from first two bytes after STX
  const len = (data[1] << 8) + data[2];

  // Get command byte
  const cmd = data[3];

  // Extract content (everything between FLAG and ETX)
  const content = data.slice(5, data.length - 2).toString("utf8");

  // Get LRC
  const lrc = data[data.length - 1];

  // Verify LRC
  const calculatedLRC = calculateLRC(data.slice(1, data.length - 1));
  if (calculatedLRC !== lrc) {
    throw new Error("LRC mismatch");
  }

  return { cmd, content };
}

class SepayClient {
  constructor(ip, port) {
    this.ip = ip;
    this.port = port;
    this.client = null;
    this.responseHandlers = new Map();
    this.extendedMode = false; // Track if we're in extended mode
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();

      this.client.on("data", (data) => {
        try {
          console.log("Received raw data:", data.toString("hex"));
          const response = parseResponse(data);
          console.log("Parsed response:", response);

          // Handle ACK/NACK in extended mode
          if (this.extendedMode) {
            if (response.cmd === 0x06) {
              // ACK
              console.log("Received ACK");
              return;
            } else if (response.cmd === 0x15) {
              // NACK
              console.log("Received NACK");
              // Implement retry logic here
              return;
            }
          }

          // Handle the response based on command
          const handler = this.responseHandlers.get(response.cmd);
          if (handler) {
            handler.resolve(response);
            this.responseHandlers.delete(response.cmd);
          }
        } catch (error) {
          console.error("Error parsing response:", error);
          // Reject any pending handlers if we can't parse the response
          for (const handler of this.responseHandlers.values()) {
            handler.reject(error);
          }
          this.responseHandlers.clear();
        }
      });

      this.client.on("error", (error) => {
        console.error("Socket error:", error);
        reject(error);
      });

      this.client.connect(this.port, this.ip, async () => {
        console.log("Connected to terminal");
        try {
          // Enable extended mode on connection
          await this.setExtendedMode(true);
          // Set ECR only mode
          await this.setECRMode();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async sendCommand(command, content = "") {
    if (!this.client) {
      throw new Error("Not connected to terminal");
    }

    const packet = buildPacket(command, content);
    console.log("Sending packet:", packet.toString("hex"));

    return new Promise((resolve, reject) => {
      // If in extended mode and not a simple command, wait for ACK first
      const isSimpleCommand = [
        0x05, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
      ].includes(command);

      if (this.extendedMode && !isSimpleCommand) {
        // Store handler for ACK
        this.responseHandlers.set(0x06, {
          resolve: async () => {
            // After ACK, wait for actual response
            try {
              const response = await this.waitForResponse(command);
              resolve(response);
            } catch (error) {
              reject(error);
            }
          },
          reject,
        });
      } else {
        // Store handler for direct response
        this.responseHandlers.set(command, { resolve, reject });
      }

      this.client.write(packet, (error) => {
        if (error) {
          this.responseHandlers.delete(command);
          reject(error);
        }
      });

      // Set a timeout for the response
      setTimeout(() => {
        if (this.responseHandlers.has(command)) {
          this.responseHandlers.delete(command);
          reject(new Error("Response timeout"));
        }
      }, 30000); // 30 second timeout for payment commands
    });
  }

  async waitForResponse(command) {
    return new Promise((resolve, reject) => {
      this.responseHandlers.set(command, { resolve, reject });
    });
  }

  async setExtendedMode(enabled) {
    const command = enabled ? 0x95 : 0x94;
    const response = await this.sendCommand(command);
    this.extendedMode = enabled;
    return response;
  }

  async setECRMode() {
    return this.sendCommand(0x97); // ECR only mode
  }

  async checkTerminalStatus() {
    console.log("Checking terminal status...");
    return this.sendCommand(0x05); // ENQ command
  }

  async initiatePayment(amount, ecrRef, merchantRef, printTickets = 0) {
    const content = `${amount
      .toString()
      .padStart(12, "0")}|${ecrRef}|${merchantRef}|${printTickets}`;
    return this.sendCommand(0x01, content);
  }

  close() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}

module.exports = { SepayClient };

// Example usage
if (require.main === module) {
  async function main() {
    const client = new SepayClient("192.168.0.105", 1234);

    try {
      await client.connect();
      console.log("Connected to terminal");

      // First check terminal status
      const status = await client.checkTerminalStatus();
      console.log("Terminal status:", status);

      // Then try a payment
      const payment = await client.initiatePayment(1234, "ECR123", "MRCHT45");
      console.log("Payment result:", payment);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      client.close();
    }
  }

  main().catch(console.error);
}
