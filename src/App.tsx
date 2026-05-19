/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { motion, AnimatePresence } from "motion/react";
import { 
  Scan, 
  History, 
  Ticket, 
  LogOut, 
  User, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Smartphone,
  Mail,
  Loader2,
  Trash2
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { UserProfile, LedgerEntry, Coupon, QRPayload } from "./types";

// Components
const USNVerification = ({ user, onSuccess }: { user: any, onSuccess: () => void }) => {
  const [usn, setUsn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn.trim()) return;
    setLoading(true);
    try {
      const { error: dbError } = await supabase
        .from('users')
        .update({ usn: usn.toUpperCase().trim() })
        .eq('id', user.id);
      
      if (dbError) throw dbError;
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md w-full p-12 bg-white rounded-[3.5rem] shadow-2xl border-8 border-white flex flex-col items-center text-center"
    >
      <div className="w-16 h-16 bg-brand-green/10 text-brand-green rounded-full flex items-center justify-center mb-6">
        <User size={32} />
      </div>
      <h2 className="text-3xl font-black text-brand-dark mb-2 uppercase italic tracking-tighter">Registration</h2>
      <p className="text-stone-500 font-medium text-xs mb-8 leading-relaxed max-w-[240px]">Initialize your campus profile by verifying your student ID number.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4 w-full">
        <div>
          <input
            type="text"
            value={usn}
            onChange={(e) => setUsn(e.target.value)}
            placeholder="COLLEGE USN"
            className="w-full px-6 py-4 bg-stone-50 border-2 border-stone-100 rounded-3xl focus:border-brand-green focus:outline-none transition-all font-bold text-sm tracking-tight text-center"
            required
          />
        </div>
        {error && <p className="text-red-500 text-[10px] font-bold uppercase flex items-center justify-center gap-1"><AlertCircle size={12} /> {error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-dark hover:bg-black text-white font-black uppercase italic tracking-widest text-xs p-4 rounded-3xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : "Finalize Profile"}
        </button>
      </form>
    </motion.div>
  );
};

const QRScanner = ({ onScan, onClose }: { onScan: (data: QRPayload) => void, onClose: () => void }) => {
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    const initializeScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode("reader");
        
        // Use facingMode 'environment' for back camera, or 'user' for front/webcam
        // This automatically handles permissions and camera selection in one go
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            try {
              const data = JSON.parse(decodedText);
              onScan(data);
            } catch (e) {
              console.error("Invalid QR format", e);
            }
          },
          () => {} // silent feedback
        );
      } catch (err: any) {
        console.error("Scanner Error:", err);
        if (isMounted) {
          const msg = err.toString().toLowerCase();
          if (msg.includes("permission") || msg.includes("notallowed")) {
            setPermissionError("Camera permission denied. Please allow access in your browser settings.");
          } else if (msg.includes("in use") || msg.includes("notreadable")) {
            setPermissionError("Camera is currently being used by another application or tab.");
          } else {
            setPermissionError("Failed to access camera. Please ensure your device has a working camera.");
          }
        }
      }
    };

    // Small delay to ensure the DOM element 'reader' is fully ready and stable
    const timer = setTimeout(initializeScanner, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop()
            .then(() => {
              try { html5QrCode?.clear(); } catch(e) {}
            })
            .catch(e => console.warn("Cleanup error:", e));
        } else {
          try { html5QrCode.clear(); } catch(e) {}
        }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden relative border-8 border-white shadow-2xl"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-10 p-2 bg-brand-dark text-white hover:bg-brand-green transition-colors rounded-full"
        >
          <X size={24} />
        </button>
        <div className="p-10">
          <h2 className="text-2xl font-black mb-1 text-brand-dark uppercase italic tracking-tighter">Scanner Interface</h2>
          <p className="text-[10px] font-extrabold uppercase text-stone-400 tracking-widest mb-8">Ready to receive bin transmission</p>
          
          {permissionError ? (
            <div className="p-8 bg-red-50 rounded-[2rem] border-2 border-red-100 text-center">
              <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
              <p className="text-red-800 font-bold text-sm mb-4">{permissionError}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-red-500 text-white font-black rounded-2xl uppercase text-xs tracking-widest"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div id="reader" className="w-full overflow-hidden rounded-[2rem] bg-stone-900 aspect-square flex items-center justify-center relative shadow-inner">
                <div className="absolute inset-0 border-[3px] border-white/20 rounded-[2rem] pointer-events-none z-10"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-brand-green border-dashed rounded-3xl animate-pulse z-10"></div>
                <div className="text-white/30 text-[10px] font-black uppercase tracking-widest">Initializing Optics...</div>
              </div>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse"></div>
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Awaiting digital handshake...</p>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const Header = ({ user, profile, onLogout }: { user: any, profile: UserProfile | null, onLogout: () => void }) => (
  <header className="p-4 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-brand-dark/5 bg-brand-bg/50 backdrop-blur-sm sticky top-0 z-40">
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 bg-brand-green rounded-full"></div>
        <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-stone-400">Verified Student Status</span>
      </div>
      <h1 className="text-4xl font-black tracking-tighter uppercase italic text-brand-dark">
        BinCredit <span className="text-brand-green">+</span>
      </h1>
    </div>
    
    <div className="flex items-center gap-4 mt-4 md:mt-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-brand-dark/5 pt-4 md:pt-0">
      <div className="text-left md:text-right">
        <p className="text-sm font-bold uppercase tracking-tight">{user.email || user.displayName || user.phone || "Student"}</p>
        <p className="text-[10px] text-stone-500 font-mono font-bold">USN: {profile?.usn || "NOT_VERIFIED"}</p>
      </div>
      <button 
        onClick={onLogout}
        className="p-2 hover:bg-brand-dark hover:text-white rounded-full transition-all border border-brand-dark/10 shadow-sm"
      >
        <LogOut size={18} />
      </button>
    </div>
  </header>
);

const HistoryTab = ({ ledger }: { ledger: LedgerEntry[] }) => (
  <div className="space-y-3">
    {ledger.length === 0 ? (
      <div className="text-center py-16 border-2 border-dashed border-stone-200 rounded-3xl">
        <History className="mx-auto text-stone-300 mb-3" size={32} />
        <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">No recent activity detected</p>
      </div>
    ) : (
      ledger.map((entry) => (
        <div key={entry.id} className="flex justify-between items-center border-b border-stone-100 pb-3 group">
          <div className="flex flex-col">
            <span className="text-sm font-extrabold uppercase tracking-tight group-hover:text-brand-green transition-colors">{entry.description}</span>
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
              {new Date(entry.timestamp || Date.now()).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })} 
              {entry.weight_grams ? ` • ${entry.weight_grams}g` : ""}
            </span>
          </div>
          <span className={`font-black italic text-lg ${entry.type === 'earned' ? 'text-brand-green' : 'text-red-500'}`}>
            {entry.type === 'earned' ? '+' : '-'}{entry.amount}
          </span>
        </div>
      ))
    )}
  </div>
);

const CouponTab = ({ coupons }: { coupons: Coupon[] }) => (
  <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
    {coupons.filter(c => !c.used).map((coupon) => (
      <div key={coupon.id} className="flex-shrink-0 w-64 p-6 border-2 border-brand-dark rounded-3xl bg-brand-cream relative overflow-hidden snap-start">
        <div className="absolute -right-6 -top-6 w-20 h-20 bg-stone-100/50 rounded-full blur-xl"></div>
        <p className="text-[10px] font-bold uppercase text-stone-400 mb-1 tracking-widest">Active Reward</p>
        <p className="text-lg font-black leading-tight uppercase italic">{coupon.value} Discount</p>
        <div className="mt-5 flex flex-col">
          <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mb-1">Redemption Code</span>
          <span className="text-xl font-mono font-black tracking-[0.2em] text-brand-dark bg-white border border-brand-dark/5 py-2 px-3 rounded-xl text-center">
            {coupon.code}
          </span>
        </div>
        <p className="mt-3 text-[9px] text-brand-green font-bold uppercase tracking-tighter">
          Expires: {new Date(coupon.expiry || Date.now()).toLocaleDateString()}
        </p>
      </div>
    ))}
    {coupons.filter(c => !c.used).length === 0 && (
      <div className="flex-1 text-center py-12 border-2 border-dashed border-stone-200 rounded-3xl">
        <Ticket className="mx-auto text-stone-300 mb-3" size={32} />
        <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">No active coupons available</p>
      </div>
    )}
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  
  // Phone Auth
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setupSubscriptions(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setupSubscriptions(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setupSubscriptions = async (uid: string) => {
    // Fetch Profile
    const fetchProfile = async () => {
      const { data } = await supabase.from('users').select('*').eq('id', uid).single();
      if (data) setProfile(data as unknown as UserProfile);
    };
    await fetchProfile();

    // Fetch Ledger
    const fetchLedger = async () => {
      const { data } = await supabase.from('ledger').select('*').eq('user_id', uid).order('timestamp', { ascending: false }).limit(10);
      if (data) setLedger(data as unknown as LedgerEntry[]);
    };
    await fetchLedger();

    // Fetch Coupons
    const fetchCoupons = async () => {
      const { data } = await supabase.from('coupons').select('*').eq('user_id', uid).order('created_at', { ascending: false });
      if (data) setCoupons(data as unknown as Coupon[]);
    };
    await fetchCoupons();

    const profileSub = supabase.channel('profile_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${uid}` }, () => fetchProfile())
      .subscribe();

    const ledgerSub = supabase.channel('ledger_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger', filter: `user_id=eq.${uid}` }, () => fetchLedger())
      .subscribe();

    const couponsSub = supabase.channel('coupons_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coupons', filter: `user_id=eq.${uid}` }, () => fetchCoupons())
      .subscribe();
    
    setLoading(false);
    return () => {
      supabase.removeChannel(profileSub);
      supabase.removeChannel(ledgerSub);
      supabase.removeChannel(couponsSub);
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) alert(error.message);
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone
    });
    if (error) {
      alert(error.message);
    } else {
      setShowOtp(true);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms'
    });
    if (error) alert(error.message);
  };

  const handleScan = async (payload: QRPayload) => {
    setIsScanning(false);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const idToken = session?.access_token;
      
      const res = await fetch("/api/verify-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setScanStatus({ type: "success", message: `Successfully earned ${data.credits_earned} credits!` });
      } else {
        setScanStatus({ type: "error", message: data.error || "Failed to verify QR" });
      }
    } catch (err: any) {
      setScanStatus({ type: "error", message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (tier: number) => {
    setIsRedeeming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const idToken = session?.access_token;
      
      const res = await fetch("/api/redeem-coupon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ tier })
      });
      const data = await res.json();
      if (data.success) {
        setRedeemSuccess(data.code);
      } else {
        alert(data.error || "Redemption failed");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleAddTestCredits = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const targetId = (profile as any).id || profile.uid;
      
      const { error: pErr } = await supabase
        .from('users')
        .update({ balance: (profile.balance || 0) + 100 })
        .eq('id', targetId);

      if (pErr) throw pErr;
      
      const { error: lErr } = await supabase
        .from('ledger')
        .insert({
          user_id: targetId,
          type: "earned",
          amount: 100,
          description: "Demo Credit Injection"
        });
        
      if (lErr) throw lErr;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-brand-bg">
        <Loader2 className="animate-spin text-brand-green" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-12 rounded-[3.5rem] border-8 border-white shadow-2xl text-center flex flex-col items-center"
        >
          <div className="w-20 h-20 bg-brand-green rounded-full flex items-center justify-center mb-8 shadow-lg shadow-brand-green/20">
            <Scan className="text-white" size={32} />
          </div>
          <h1 className="text-5xl font-black text-brand-dark mb-2 tracking-tighter uppercase italic">
            BinCredit <span className="text-brand-green">+</span>
          </h1>
          <p className="text-stone-500 font-medium mb-12 text-sm max-w-[240px] leading-relaxed">
            The digital infrastructure for a greener campus economy.
          </p>
          
          <div className="space-y-4 w-full">
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-stone-200 hover:border-brand-green hover:bg-stone-50 text-stone-700 font-bold tracking-tight py-4 rounded-3xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Sign in with Google
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // USN Verification skipped for demo
  if (false && !profile?.usn) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <USNVerification user={user} onSuccess={() => {}} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-brand-bg">
        <Loader2 className="animate-spin text-brand-green" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <Header user={user} profile={profile} onLogout={handleLogout} />
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-full md:w-1/3 p-6 md:p-8 border-b md:border-b-0 md:border-r border-brand-dark/5 flex flex-col justify-between bg-white overflow-y-auto">
          <div className="space-y-3 mb-12">
            <h2 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-stone-400">Wealth accumulation</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-8xl font-black tracking-tighter text-brand-dark">{profile?.balance?.toLocaleString() || "0"}</span>
              <span className="text-xl font-black italic text-brand-green uppercase">cr.</span>
            </div>
            <p className="text-xs text-stone-500 max-w-[240px] leading-relaxed font-medium">
              You've diverted approximately <span className="font-bold text-brand-dark">{(ledger.filter(l => l.type === 'earned').reduce((acc, curr) => acc + (curr.weight_grams || 0), 0) / 1000).toFixed(1)}kg</span> of waste from landfills this semester.
            </p>
          </div>

          <div className="space-y-8">
            <button 
              onClick={() => setIsScanning(true)}
              className="w-full aspect-square border-4 border-brand-dark rounded-[3.5rem] flex flex-col items-center justify-center gap-4 hover:bg-brand-dark hover:text-white transition-all group relative overflow-hidden active:scale-95"
            >
              <div className="absolute top-6 right-6 bg-brand-green text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest italic animate-pulse">
                Earn now
              </div>
              <Scan className="w-16 h-16" strokeWidth={1} />
              <span className="text-2xl font-black uppercase italic tracking-tighter">Scan QR Code</span>
            </button>
            
            <button 
              onClick={handleAddTestCredits}
              className="w-full flex items-center justify-center gap-2 border-2 border-brand-green/20 text-brand-green font-bold uppercase text-[10px] py-2 rounded-xl hover:bg-brand-green/5 transition-all"
            >
              + Inject 100 Demo Credits
            </button>
            
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest opacity-20 border-t border-brand-dark/5 pt-4">
              <p>Campus Sustainability Network</p>
              <p>PRO v2.4.0</p>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <section className="flex-1 flex flex-col overflow-y-auto">
          {/* Active Redemptions */}
          <div className="p-6 md:p-10 space-y-8 border-b border-brand-dark/5">
            <div className="flex justify-between items-center">
              <h2 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-stone-400">Active Redemptions</h2>
              <span className="text-[9px] font-black px-2.5 py-1 bg-stone-100 rounded-lg uppercase tracking-widest">
                {coupons.filter(c => !c.used).length} UNUSED
              </span>
            </div>
            <CouponTab coupons={coupons} />
          </div>

          {/* Activity & Redeem Grid */}
          <div className="flex-1 flex flex-col md:flex-row">
            {/* Recent Activity */}
            <div className="w-full md:w-1/2 p-6 md:p-10 border-b md:border-b-0 md:border-r border-brand-dark/5 space-y-6">
              <h2 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-stone-400">Recent Activity</h2>
              <HistoryTab ledger={ledger} />
            </div>

            {/* Redeem Actions */}
            <div className="w-full md:w-1/2 p-6 md:p-10 bg-brand-dark text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-stone-500">Fast Rewards</h2>
                  <Ticket className="text-brand-green" size={16} />
                </div>
                
                <div className="space-y-4">
                  <button 
                    onClick={() => handleRedeem(50)}
                    disabled={(profile?.balance || 0) < 50 || isRedeeming}
                    className="w-full flex justify-between items-center p-4 border border-white/10 rounded-2xl hover:bg-white/5 transition-all disabled:opacity-30 group"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-black uppercase italic tracking-tighter">10% OFF VOUCHER</span>
                      <span className="text-[10px] font-bold text-stone-500">Universal Campus Cafe Access</span>
                    </div>
                    <span className="text-xs font-mono font-black bg-white/10 group-hover:bg-brand-green group-hover:text-brand-dark px-3 py-1.5 rounded-xl transition-all">50 CR</span>
                  </button>

                  <button 
                    onClick={() => handleRedeem(100)}
                    disabled={(profile?.balance || 0) < 100 || isRedeeming}
                    className="w-full flex justify-between items-center p-4 border border-white/10 rounded-2xl hover:bg-white/5 transition-all disabled:opacity-30 group"
                  >
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-black uppercase italic tracking-tighter">25% OFF VOUCHER</span>
                      <span className="text-[10px] font-bold text-stone-500">Books & Stationery Shop</span>
                    </div>
                    <span className="text-xs font-mono font-black bg-white/10 group-hover:bg-brand-green group-hover:text-brand-dark px-3 py-1.5 rounded-xl transition-all">100 CR</span>
                  </button>

                  <div className="flex justify-between items-center p-4 border border-brand-green/30 bg-brand-green/5 rounded-2xl opacity-40">
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-black uppercase italic tracking-tighter text-brand-green">AMAZON GIFT CARD</span>
                      <span className="text-[10px] font-bold text-stone-600">Exclusive Premium Reward</span>
                    </div>
                    <span className="text-xs font-mono font-black bg-brand-green text-brand-dark px-3 py-1.5 rounded-xl">500 CR</span>
                  </div>
                </div>
              </div>

              <div className="pt-12 flex justify-between items-end">
                <div className="text-[8px] text-stone-500 font-bold uppercase tracking-[0.2em] leading-relaxed">
                  Decentralized Recycling<br/>Incentive Protocol
                </div>
                <div className="text-xs font-black italic text-brand-green tracking-widest uppercase">
                  ACTIVE_PLAN
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isScanning && (
          <QRScanner onScan={handleScan} onClose={() => setIsScanning(false)} />
        )}
        
        {scanStatus && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              className="bg-white border-4 border-brand-dark p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-green/10 rounded-full blur-2xl"></div>
              <div className={`w-20 h-20 mx-auto mb-8 rounded-full flex items-center justify-center shadow-lg ${scanStatus.type === 'success' ? 'bg-brand-green text-white' : 'bg-red-500 text-white'}`}>
                {scanStatus.type === 'success' ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
              </div>
              <h2 className="text-3xl font-black mb-2 uppercase italic tracking-tighter text-brand-dark">
                {scanStatus.type === 'success' ? "MISSION_SUCCESS" : "SYSTEM_ERROR"}
              </h2>
              <p className="text-stone-500 mb-10 font-bold text-sm tracking-tight">{scanStatus.message}</p>
              <button 
                onClick={() => setScanStatus(null)}
                className="w-full py-4 bg-brand-dark text-white font-black uppercase italic tracking-widest text-xs rounded-2xl hover:bg-black transition-all active:scale-95"
              >
                Continue Protocol
              </button>
            </motion.div>
          </div>
        )}
        {redeemSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white border-4 border-brand-green p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-brand-green text-white mx-auto mb-8 rounded-full flex items-center justify-center">
                <Ticket size={40} />
              </div>
              <h2 className="text-3xl font-black mb-2 uppercase italic tracking-tighter text-brand-dark">Coupon Issued</h2>
              <p className="text-stone-500 mb-8 font-bold text-sm tracking-tight">Your reward has been generated and added to your wallet.</p>
              
              <div className="bg-stone-50 p-6 rounded-2xl border-2 border-dashed border-stone-200 mb-8">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Voucher Code</p>
                <p className="text-2xl font-mono font-black tracking-[0.3em] text-brand-dark">{redeemSuccess}</p>
              </div>

              <button 
                onClick={() => setRedeemSuccess(null)}
                className="w-full py-4 bg-brand-green text-white font-black uppercase italic tracking-widest text-xs rounded-2xl hover:bg-brand-green/90 transition-all"
              >
                Go to Wallet
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
