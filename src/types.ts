export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  usn?: string;
  balance: number;
  createdAt: any;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  type: "earned" | "spent";
  amount: number;
  weight_grams?: number;
  description: string;
  timestamp: any;
  couponId?: string;
}

export interface Coupon {
  id: string;
  userId: string;
  code: string;
  tier: number;
  value: string;
  expiry: any;
  used: boolean;
  createdAt: any;
}

export interface QRPayload {
  bin_id: string;
  weight_grams: number;
  credits: number;
  issued_at: number;
  nonce: string;
  hmac_signature: string;
}
