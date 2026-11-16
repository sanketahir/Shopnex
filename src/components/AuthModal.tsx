import React, { useState } from 'react';
import { KeyRound, ShieldCheck, Store, User as UserIcon, X } from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import type { User, UserRole } from '../types/techora';

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    apiFetch,
    refreshAll,
    loginWithDemoRole,
    showToast,
    setActiveView,
    effectiveSettings,
  } = useTechora();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [registerRole, setRegisterRole] = useState<'customer' | 'seller'>('customer');

  // OTP Authentication states
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSendOtp = async () => {
    const contact = email.trim() || phone.trim();
    if (!contact) {
      setFormError('Enter your email or phone number first to request an OTP.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await apiFetch<{ verificationCodePreview: string }>('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ contact }),
      });
      setOtpSent(true);
      setOtpPreview(res.verificationCodePreview);
      showToast('6-digit OTP verification code sent');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const contact = email.trim() || phone.trim();
    setBusy(true);
    setFormError(null);
    try {
      await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ contact, code: otpCode.trim() }),
      });
      setOtpVerified(true);
      showToast('OTP verified successfully');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (tab === 'login') {
        const res = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        localStorage.setItem('techora_auth_token', res.token);
        setAuthModalOpen(false);
        await refreshAll();
        if (res.user.role === 'seller') setActiveView('seller');
        else if (res.user.role === 'admin' || res.user.role === 'super_admin') {
          setActiveView('admin');
        }
        showToast(`Welcome back, ${res.user.name}`);
      } else {
        const res = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            role: registerRole,
            otpVerified,
          }),
        });
        localStorage.setItem('techora_auth_token', res.token);
        setAuthModalOpen(false);
        await refreshAll();
        if (res.user.role === 'seller') setActiveView('seller');
        showToast(`Account created for ${res.user.name}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const demoRoles: Array<{ role: UserRole; label: string; sub: string }> = [
    { role: 'customer', label: 'Customer', sub: 'Sophia Patel' },
    { role: 'seller', label: 'Seller / Shopkeeper', sub: 'Devon Brooks' },
    { role: 'admin', label: 'Admin', sub: 'Marcus Chen' },
    { role: 'super_admin', label: 'Super Admin', sub: 'Elena Vance' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-zinc-950">
              {tab === 'login'
                ? `Sign in to ${effectiveSettings.appDisplayName}`
                : `Create ${effectiveSettings.appDisplayName} Account`}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Role-based access with OTP authentication
            </p>
          </div>
          <button
            type="button"
            aria-label="Close sign in dialog"
            onClick={() => setAuthModalOpen(false)}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setFormError(null);
            }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              tab === 'login' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setFormError(null);
            }}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              tab === 'register'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Register
          </button>
        </div>

        {formError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {tab === 'register' && (
            <>
              <div>
                <span className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Account Role
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegisterRole('customer')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      registerRole === 'customer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <UserIcon className="h-4 w-4" /> Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegisterRole('seller')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      registerRole === 'seller'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <Store className="h-4 w-4" /> Seller / Shop
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-zinc-700">
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="auth-phone" className="block text-xs font-medium text-zinc-700">
                  Mobile Number
                </label>
                <input
                  id="auth-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 555 0140"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-700">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-700">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          {/* OTP Verification Section */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-800">
                <KeyRound className="h-4 w-4 text-blue-600" />
                <span>OTP Verification</span>
                {otpVerified && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={busy}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                {otpSent ? 'Resend OTP' : 'Send 6-digit OTP'}
              </button>
            </div>
            {otpSent && !otpVerified && (
              <div className="mt-2.5 space-y-2">
                {otpPreview && (
                  <p className="text-xs text-zinc-600">
                    Verification code: <span className="font-mono-num font-semibold text-zinc-950">{otpPreview}</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-mono-num focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={busy}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                  >
                    Verify OTP
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: effectiveSettings.primaryColor }}
          >
            {busy
              ? 'Processing...'
              : tab === 'login'
                ? 'Sign In'
                : `Register as ${registerRole === 'seller' ? 'Seller' : 'Customer'}`}
          </button>
        </form>

        {/* Quick Demo Access */}
        <div className="mt-6 border-t border-zinc-200 pt-4">
          <p className="text-xs font-medium text-zinc-500">
            Instant Demo Role Access (password for manual login: <span className="font-mono-num">techora123</span>)
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {demoRoles.map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => void loginWithDemoRole(item.role)}
                className="flex flex-col items-start rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-blue-600 hover:bg-blue-50/40 transition-colors"
              >
                <span className="text-xs font-semibold text-zinc-900">{item.label}</span>
                <span className="text-xs text-zinc-500">{item.sub}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
