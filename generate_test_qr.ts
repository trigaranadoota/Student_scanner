import crypto from "crypto";
import dotenv from "dotenv";

// Load environment variables (ensure this runs in the root where .env is located)
dotenv.config();

function generateTestQR() {
  const secret = process.env.QR_HMAC_SECRET || "default_secret";
  
  // 1. Create the base payload
  const payload = {
    bin_id: "BIN_" + Math.floor(Math.random() * 1000), // Random Bin ID
    weight_grams: 500, // E.g., 500g of waste
    credits: 50, // 50 credits earned
    issued_at: Math.floor(Date.now() / 1000), // Current time in Unix seconds
    nonce: crypto.randomBytes(8).toString("hex"), // Unique random string
  };

  // 2. Generate the HMAC signature based on the payload
  const hmacData = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(hmacData)
    .digest("hex");

  // 3. Assemble the final QR code data
  const finalQrData = {
    ...payload,
    hmac_signature: signature,
  };

  console.log("\n✅ QR Code Data Generated successfully!\n");
  console.log("Use any QR code generator website (like qr-code-generator.com) and paste this EXACT text into it to generate a scannable QR code:\n");
  console.log(JSON.stringify(finalQrData, null, 2));
  console.log("\nNote: You have exactly 60 seconds to scan this before it expires!");
}

generateTestQR();
