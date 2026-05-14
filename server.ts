import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

// Initialize Firebase Admin
// On Cloud Run, it should pick up the default service account
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // QR Verification Endpoint
  app.post("/api/verify-qr", async (req, res) => {
    try {
      const { bin_id, weight_grams, credits, issued_at, nonce, hmac_signature } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      // 1. Verify Expiry (60 seconds)
      const now = Math.floor(Date.now() / 1000);
      if (now - issued_at > 60) {
        return res.status(400).json({ error: "QR code has expired" });
      }

      // 2. Verify HMAC
      const secret = process.env.QR_HMAC_SECRET || "default_secret";
      const hmacData = JSON.stringify({ bin_id, weight_grams, credits, issued_at, nonce });
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(hmacData)
        .digest("hex");

      if (hmac_signature !== expectedSignature) {
        return res.status(400).json({ error: "Invalid QR signature" });
      }

      // 3. Check if QR already used
      const qrRef = db.collection("used_qr").doc(nonce);
      const qrDoc = await qrRef.get();
      if (qrDoc.exists) {
        return res.status(400).json({ error: "QR code has already been used" });
      }

      // 4. Atomic transaction to update balance and used_qr
      await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User profile not found");
        }

        const currentBalance = userDoc.data()?.balance || 0;
        transaction.update(userRef, {
          balance: currentBalance + credits
        });

        // Record in used_qr
        transaction.set(qrRef, {
          nonce,
          bin_id,
          userId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // Record in ledger
        const ledgerRef = db.collection("ledger").doc();
        transaction.set(ledgerRef, {
          userId,
          type: "earned",
          amount: credits,
          weight_grams,
          description: `Earned from Bin ${bin_id}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      res.json({ success: true, credits_earned: credits });
    } catch (error: any) {
      console.error("QR Verification Error:", error);
      res.status(500).json({ error: error.message || "Verification failed" });
    }
  });

  // Coupon Redemption Endpoint
  app.post("/api/redeem-coupon", async (req, res) => {
    try {
      const { tier } = req.body; // e.g., 50 or 100
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const tierMap: Record<number, { cost: number; value: string }> = {
        50: { cost: 50, value: "10% off" },
        100: { cost: 100, value: "25% off" }
      };

      const selectedTier = tierMap[tier];
      if (!selectedTier) {
        return res.status(400).json({ error: "Invalid coupon tier" });
      }

      let generatedCode = "";

      await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error("User profile not found");
        }

        const currentBalance = userDoc.data()?.balance || 0;
        if (currentBalance < selectedTier.cost) {
          throw new Error("Insufficient credits");
        }

        // Generate Code
        generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        transaction.update(userRef, {
          balance: currentBalance - selectedTier.cost
        });

        // Record in coupons
        const couponRef = db.collection("coupons").doc();
        transaction.set(couponRef, {
          userId,
          code: generatedCode,
          tier,
          value: selectedTier.value,
          expiry: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days
          used: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Record in ledger
        const ledgerRef = db.collection("ledger").doc();
        transaction.set(ledgerRef, {
          userId,
          type: "spent",
          amount: selectedTier.cost,
          description: `Redeemed ${selectedTier.value} coupon`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          couponId: couponRef.id
        });
      });

      res.json({ success: true, code: generatedCode });
    } catch (error: any) {
      console.error("Coupon Redemption Error:", error);
      res.status(500).json({ error: error.message || "Redemption failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
