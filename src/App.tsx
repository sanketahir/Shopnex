import { useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { CustomerAccountView } from './components/CustomerAccountView';
import { CustomerStorefront } from './components/CustomerStorefront';
import { Navbar } from './components/Navbar';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SellerDashboard } from './components/SellerDashboard';
import { SplashAndOnboarding } from './components/SplashAndOnboarding';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { TechoraProvider, useTechora } from './context/TechoraContext';

function TechoraShell() {
  const {
    loading,
    error,
    clearError,
    toast,
    activeView,
    setActiveView,
    effectiveSettings,
    previewSettings,
    setPreviewSettings,
  } = useTechora();

  const [splashDone, setSplashDone] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    try {
      return sessionStorage.getItem('techora_intro_seen') === '1';
    } catch {
      return false;
    }
  });

  const handleFinishIntro = () => {
    try {
      sessionStorage.setItem('techora_intro_seen', '1');
    } catch {
      // ignore
    }
    setSplashDone(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600" />
          <p className="mt-3 text-xs font-medium text-zinc-500">Loading TECHORA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {!splashDone && effectiveSettings.splashEnabled && (
        <SplashAndOnboarding onDone={handleFinishIntro} />
      )}

      {previewSettings && (
        <div className="bg-blue-600 px-4 py-2 text-center text-xs font-medium text-white flex items-center justify-center gap-4">
          <span>Customization Preview Mode Active</span>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className="underline font-semibold"
          >
            Return to Customization Studio
          </button>
          <button
            type="button"
            onClick={() => setPreviewSettings(null)}
            className="rounded bg-white/20 px-2 py-0.5 text-xs"
          >
            Exit Preview
          </button>
        </div>
      )}

      <Navbar />

      {error && (
        <div
          role="alert"
          className="mx-auto mt-4 flex w-full max-w-7xl items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={clearError} aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <main className="flex-1">
        {activeView === 'home' && <CustomerStorefront />}
        {activeView === 'shops' && <CustomerStorefront shopsOnly />}
        {activeView === 'orders' && <CustomerAccountView initialTab="orders" />}
        {activeView === 'account' && <CustomerAccountView initialTab="orders" />}
        {activeView === 'support' && <CustomerAccountView initialTab="support" />}
        {activeView === 'seller' && <SellerDashboard />}
        {activeView === 'admin' && <SuperAdminDashboard />}
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-950 text-zinc-400">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div>
            <p className="font-display text-base font-bold text-white">
              {effectiveSettings.appDisplayName}
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              {effectiveSettings.splashTagline}
            </p>
          </div>
          <div className="text-xs space-y-1.5">
            <p className="font-semibold text-white">Contact</p>
            <p>{effectiveSettings.contactAddress}</p>
            <p>Email: {effectiveSettings.supportEmail}</p>
            <p>WhatsApp: {effectiveSettings.whatsappNumber}</p>
          </div>
          <div className="text-xs space-y-1.5">
            <p className="font-semibold text-white">Platform</p>
            <button
              type="button"
              onClick={() => setActiveView('shops')}
              className="block hover:text-white"
            >
              Local Shop Directory
            </button>
            <button
              type="button"
              onClick={() => setActiveView('seller')}
              className="block hover:text-white"
            >
              Seller Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveView('support')}
              className="block hover:text-white"
            >
              Help & Legal Policies
            </button>
          </div>
          <div className="text-xs space-y-1.5">
            <p className="font-semibold text-white">Connect</p>
            <a
              href={effectiveSettings.socialInstagram}
              target="_blank"
              rel="noreferrer"
              className="block hover:text-white"
            >
              Instagram
            </a>
            <a
              href={effectiveSettings.socialTwitter}
              target="_blank"
              rel="noreferrer"
              className="block hover:text-white"
            >
              X / Twitter
            </a>
            <a
              href={effectiveSettings.socialLinkedIn}
              target="_blank"
              rel="noreferrer"
              className="block hover:text-white"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </footer>

      <ProductDetailModal />
      <CartCheckoutDrawer />
      <AuthModal />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-xs font-medium text-white shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <TechoraProvider>
      <TechoraShell />
    </TechoraProvider>
  );
}
