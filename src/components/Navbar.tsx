import { useState } from 'react';
import { Menu, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { useTechora, type AppView } from '../context/TechoraContext';

export function Navbar() {
  const {
    effectiveSettings,
    currentUser,
    activeView,
    setActiveView,
    cartCount,
    setCartOpen,
    setAuthModalOpen,
    setSelectedShopId,
  } = useTechora();

  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (view: AppView) => {
    if (view === 'home' || view === 'shops') {
      setSelectedShopId(null);
    }
    setActiveView(view);
    setMobileOpen(false);
  };

  const navItems: Array<{ id: string; label: string; target: AppView }> = effectiveSettings.navigationMenu
    .filter((m) => m.enabled)
    .map((m) => ({
      id: m.id,
      label: m.label,
      target: m.target,
    }));

  if (currentUser?.role === 'seller') {
    navItems.push({ id: 'nav-seller', label: 'Seller Hub', target: 'seller' });
  }
  if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
    navItems.push({ id: 'nav-admin', label: 'Admin Panel', target: 'admin' });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => navigate('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded-md"
        >
          {effectiveSettings.appLogoUrl ? (
            <img
              src={effectiveSettings.appLogoUrl}
              alt={effectiveSettings.appDisplayName}
              referrerPolicy="no-referrer"
              className="h-7 w-7 rounded-md object-cover"
            />
          ) : (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ backgroundColor: effectiveSettings.primaryColor }}
            >
              {effectiveSettings.appIconText || effectiveSettings.appDisplayName.slice(0, 1)}
            </span>
          )}
          <span className="font-display text-lg font-bold tracking-tight text-zinc-950">
            {effectiveSettings.appDisplayName}
          </span>
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {navItems.slice(0, 5).map((item) => {
            const isActive = activeView === item.target;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.target)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-zinc-950'
                    : 'border-transparent text-zinc-600 hover:text-zinc-950'
                }`}
                style={isActive ? { borderColor: effectiveSettings.primaryColor } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Cart & Account Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open shopping cart with ${cartCount} items`}
            className="relative inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            <span className="font-mono-num text-xs font-semibold text-blue-600">
              {cartCount}
            </span>
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={() => navigate('account')}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
              style={{ backgroundColor: effectiveSettings.secondaryColor }}
            >
              <UserIcon className="h-4 w-4" />
              <span className="max-w-[120px] truncate">{currentUser.name.split(' ')[0]}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
              style={{ backgroundColor: effectiveSettings.primaryColor }}
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            aria-label="Toggle mobile menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-700 hover:bg-zinc-100 md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="border-t border-zinc-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.target)}
                className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                  activeView === item.target
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
