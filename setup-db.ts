import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable is not set.");
  console.error("Please add DATABASE_URL=postgres://postgres:[PASSWORD]@[HOST]:5432/postgres to your .env file.");
  process.exit(1);
}

const sql = `
-- Create Users Table if not exists
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  phone_number TEXT,
  balance NUMERIC DEFAULT 0,
  usn TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Ledger Table
CREATE TABLE IF NOT EXISTS public.ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  type TEXT CHECK (type IN ('earned', 'spent')),
  amount NUMERIC NOT NULL,
  weight_grams NUMERIC,
  description TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  coupon_id UUID
);

-- Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  code TEXT NOT NULL,
  tier NUMERIC NOT NULL,
  value TEXT NOT NULL,
  expiry TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Used QR Table
CREATE TABLE IF NOT EXISTS public.used_qr (
  nonce TEXT PRIMARY KEY,
  bin_id TEXT,
  user_id UUID REFERENCES public.users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.used_qr ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts on rerun
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own ledger" ON public.ledger;
DROP POLICY IF EXISTS "Users can view their own coupons" ON public.coupons;

CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view their own ledger" ON public.ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own coupons" ON public.coupons FOR SELECT USING (auth.uid() = user_id);

-- Setup Trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, phone_number, balance)
  VALUES (new.id, new.email, new.phone, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Supabase connections
    }
  });

  try {
    console.log("Connecting to Supabase PostgreSQL database...");
    await client.connect();
    console.log("Connected successfully. Executing SQL schema...");
    await client.query(sql);
    console.log("Database schema setup completed successfully!");
  } catch (err: any) {
    console.error("Database setup failed:", err.message);
  } finally {
    await client.end();
  }
}

main();
