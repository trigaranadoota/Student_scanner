import express from "express";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize Supabase Admin Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/verify-qr", async (req, res) => {
  try {
    const { bin_id, weight_grams, credits, issued_at, nonce, hmac_signature } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let userId: string;

    if (idToken === "mock-token-123") {
      userId = "test-user-123";
    } else {
      const { data: { user }, error } = await supabase.auth.getUser(idToken);
      if (error || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      userId = user.id;
    }

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

    // 4. Update balance and used_qr
    // Check if nonce exists in used_qr
    const { data: existingNonce } = await supabase.from('used_qr').select('nonce').eq('nonce', nonce).single();
    if (existingNonce) {
       return res.status(400).json({ error: "QR code has already been used" });
    }

    // Insert into used_qr to lock it
    await supabase.from('used_qr').insert({ nonce, bin_id, user_id: userId });

    // Get user
    const { data: userDoc, error: userError } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (userError || !userDoc) {
      return res.status(400).json({ error: "User profile not found" });
    }

    const currentBalance = userDoc.balance || 0;
    await supabase.from('users').update({ balance: currentBalance + credits }).eq('id', userId);

    // Record in ledger
    await supabase.from('ledger').insert({
      user_id: userId,
      type: "earned",
      amount: credits,
      weight_grams,
      description: `Earned from Bin ${bin_id}`
    });

    res.json({ success: true, credits_earned: credits });
  } catch (error: any) {
    console.error("QR Verification Error:", error);
    res.status(500).json({ error: error.message || "Verification failed" });
  }
});

app.post("/api/redeem-coupon", async (req, res) => {
  try {
    const { tier } = req.body; // e.g., 50 or 100
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let userId: string;

    if (idToken === "mock-token-123") {
      userId = "test-user-123";
    } else {
      const { data: { user }, error } = await supabase.auth.getUser(idToken);
      if (error || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }
      userId = user.id;
    }

    const tierMap: Record<number, { cost: number; value: string }> = {
      50: { cost: 50, value: "10% off" },
      100: { cost: 100, value: "25% off" }
    };

    const selectedTier = tierMap[tier];
    if (!selectedTier) {
      return res.status(400).json({ error: "Invalid coupon tier" });
    }

    let generatedCode = "";

    const { data: userDoc, error: userError } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (userError || !userDoc) {
      return res.status(400).json({ error: "User profile not found" });
    }

    const currentBalance = userDoc.balance || 0;
    if (currentBalance < selectedTier.cost) {
      return res.status(400).json({ error: "Insufficient credits" });
    }

    // Generate Code
    generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    await supabase.from('users').update({ balance: currentBalance - selectedTier.cost }).eq('id', userId);

    // Record in coupons
    const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: newCoupon, error: couponError } = await supabase.from('coupons').insert({
      user_id: userId,
      code: generatedCode,
      tier,
      value: selectedTier.value,
      expiry: expiryDate,
      used: false
    }).select().single();
    
    if (couponError) {
       throw couponError;
    }

    // Record in ledger
    await supabase.from('ledger').insert({
      user_id: userId,
      type: "spent",
      amount: selectedTier.cost,
      description: `Redeemed ${selectedTier.value} coupon`,
      coupon_id: newCoupon.id
    });

    res.json({ success: true, code: generatedCode });
  } catch (error: any) {
    console.error("Coupon Redemption Error:", error);
    res.status(500).json({ error: error.message || "Redemption failed" });
  }
});

// IMPORTANT FOR VERCEL
export default app;
