import React, { useEffect, useState } from 'react';
import { Download, Eye, Palette, RotateCcw, Save, Settings } from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import type { AppSettings } from '../types/techora';
import { ConfirmDialog } from './ConfirmDialog';

type SettingsSection =
  | 'general'
  | 'branding'
  | 'shop'
  | 'product'
  | 'payment'
  | 'delivery'
  | 'notification'
  | 'permissions'
  | 'security'
  | 'database'
  | 'backup';

const MEDIA_OPTIONS = [
  { label: 'TECHORA Flagship Hardware', url: '/src/assets/images/hero_techora_flagship_1794818827475.jpg' },
  { label: 'Urban Audio Showroom', url: '/src/assets/images/shop_banner_urban_audio_1794818828912.jpg' },
  { label: 'Studio Headphones', url: '/src/assets/images/product_wireless_headphones_1794818826813.jpg' },
  { label: 'Espresso Brewer', url: '/src/assets/images/product_espresso_brewer_1794818828636.jpg' },
  { label: 'Mechanical Keyboard', url: '/src/assets/images/product_mechanical_keyboard_1794818827796.jpg' },
];

export function AdminCustomizationStudio({ mode }: { mode: 'customization' | 'settings' }) {
  const {
    appSettings,
    previewSettings,
    setPreviewSettings,
    apiFetch,
    refreshAll,
    showToast,
    setActiveView,
  } = useTechora();

  const [draft, setDraft] = useState<AppSettings>(appSettings);
  const [section, setSection] = useState<SettingsSection>(
    mode === 'customization' ? 'branding' : 'general',
  );
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setDraft(previewSettings || appSettings);
  }, [appSettings, previewSettings]);

  const handlePreview = () => {
    setPreviewSettings(draft);
    showToast('Live preview applied — review storefront or save when ready');
  };

  const handleDiscardPreview = () => {
    setPreviewSettings(null);
    setDraft(appSettings);
    showToast('Preview discarded');
  };

  const handleSave = async () => {
    setBusy(true);
    setErrMsg(null);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(draft),
      });
      setPreviewSettings(null);
      await refreshAll();
      showToast('Platform settings saved and published');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleBackupDownload = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<{ backup: unknown }>('/api/admin/backup');
      const blob = new Blob([JSON.stringify(res.backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `techora-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await refreshAll();
      showToast('Database backup downloaded');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Backup export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/admin/reset-demo', { method: 'POST' });
      setPreviewSettings(null);
      setConfirmReset(false);
      await refreshAll();
      showToast('Platform restored to clean initial demo dataset');
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  };

  const allTabs: Array<{ id: SettingsSection; label: string }> =
    mode === 'customization'
      ? [
          { id: 'branding', label: 'Branding & Theme' },
          { id: 'general', label: 'Layout, Banners & Navigation' },
        ]
      : [
          { id: 'general', label: 'General' },
          { id: 'branding', label: 'Branding' },
          { id: 'shop', label: 'Shop' },
          { id: 'product', label: 'Product' },
          { id: 'payment', label: 'Payment' },
          { id: 'delivery', label: 'Delivery' },
          { id: 'notification', label: 'Notification' },
          { id: 'permissions', label: 'Permissions' },
          { id: 'security', label: 'Security' },
          { id: 'database', label: 'Database' },
          { id: 'backup', label: 'Backup' },
        ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center gap-3">
          {mode === 'customization' ? (
            <Palette className="h-5 w-5 text-blue-600" />
          ) : (
            <Settings className="h-5 w-5 text-blue-600" />
          )}
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-950">
              {mode === 'customization'
                ? 'App Customization Studio'
                : 'Central Admin Settings'}
            </h2>
            <p className="text-xs text-zinc-500">
              {previewSettings
                ? 'Live preview active — save to persist across all users'
                : 'Configure branding, layouts, commerce policies, and backups'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Eye className="h-3.5 w-3.5" /> Preview Changes
          </button>
          {previewSettings && (
            <>
              <button
                type="button"
                onClick={() => setActiveView('home')}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700"
              >
                Inspect Storefront
              </button>
              <button
                type="button"
                onClick={handleDiscardPreview}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-xs font-medium text-zinc-600"
              >
                Discard
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {busy ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {errMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errMsg}
        </div>
      )}

      {/* Live Preview Mini Card */}
      {previewSettings && (
        <div
          className="rounded-xl border border-blue-200 p-5"
          style={{
            backgroundColor: draft.backgroundColor,
            fontFamily: `"${draft.fontStyle}", sans-serif`,
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-3">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: draft.primaryColor }}
              >
                {draft.appIconText || draft.appDisplayName.slice(0, 1)}
              </span>
              <span className="font-bold text-zinc-950">{draft.appDisplayName}</span>
            </div>
            <span
              className="rounded-md px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: draft.primaryColor }}
            >
              Layout: {draft.homeLayout}
            </span>
          </div>
          <p className="mt-3 text-base font-bold" style={{ color: draft.secondaryColor }}>
            {draft.heroHeadline}
          </p>
          <p className="mt-1 text-xs text-zinc-600">{draft.promoBannerText}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {allTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSection(t.id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 ${
              section === t.id
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Branding & Colors & Fonts & Splash */}
      {section === 'branding' && (
        <div className="grid gap-6 rounded-xl border border-zinc-200 bg-white p-6 md:grid-cols-2">
          <div>
            <label htmlFor="set-app-name" className="block text-xs font-medium text-zinc-700">
              1. App Display Name
            </label>
            <input
              id="set-app-name"
              type="text"
              value={draft.appDisplayName}
              onChange={(e) => setDraft({ ...draft, appDisplayName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-app-icon" className="block text-xs font-medium text-zinc-700">
              2. App Icon Letter / Monogram
            </label>
            <input
              id="set-app-icon"
              type="text"
              maxLength={2}
              value={draft.appIconText}
              onChange={(e) => setDraft({ ...draft, appIconText: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-logo-url" className="block text-xs font-medium text-zinc-700">
              3. App Logo Image URL (optional)
            </label>
            <input
              id="set-logo-url"
              type="text"
              placeholder="Leave empty for monogram badge"
              value={draft.appLogoUrl}
              onChange={(e) => setDraft({ ...draft, appLogoUrl: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-splash-tag" className="block text-xs font-medium text-zinc-700">
              4. Splash Screen Tagline
            </label>
            <input
              id="set-splash-tag"
              type="text"
              value={draft.splashTagline}
              onChange={(e) => setDraft({ ...draft, splashTagline: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="set-primary-col" className="block text-xs font-medium text-zinc-700">
              5. Primary Color
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="set-primary-col"
                type="color"
                value={draft.primaryColor}
                onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                className="h-9 w-12 rounded border border-zinc-300"
              />
              <input
                type="text"
                value={draft.primaryColor}
                onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label htmlFor="set-secondary-col" className="block text-xs font-medium text-zinc-700">
              6. Secondary Color
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="set-secondary-col"
                type="color"
                value={draft.secondaryColor}
                onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })}
                className="h-9 w-12 rounded border border-zinc-300"
              />
              <input
                type="text"
                value={draft.secondaryColor}
                onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label htmlFor="set-bg-col" className="block text-xs font-medium text-zinc-700">
              7. Background Color
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="set-bg-col"
                type="color"
                value={draft.backgroundColor}
                onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
                className="h-9 w-12 rounded border border-zinc-300"
              />
              <input
                type="text"
                value={draft.backgroundColor}
                onChange={(e) => setDraft({ ...draft, backgroundColor: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
              />
            </div>
          </div>
          <div>
            <label htmlFor="set-font" className="block text-xs font-medium text-zinc-700">
              8. Display Font Style
            </label>
            <select
              id="set-font"
              value={draft.fontStyle}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  fontStyle: e.target.value as AppSettings['fontStyle'],
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="Outfit">Outfit (Architectural Sans)</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="Manrope">Manrope</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Playfair Display">Playfair Display (Editorial Serif)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-zinc-800 md:col-span-2">
            <input
              type="checkbox"
              checked={draft.splashEnabled}
              onChange={(e) => setDraft({ ...draft, splashEnabled: e.target.checked })}
            />
            Show Splash & Onboarding screen on first visit
          </label>
        </div>
      )}

      {/* General: Home Layout, Banners, Contact, Legal, Nav */}
      {section === 'general' && (
        <div className="grid gap-6 rounded-xl border border-zinc-200 bg-white p-6 md:grid-cols-2">
          <div>
            <label htmlFor="set-layout" className="block text-xs font-medium text-zinc-700">
              9. Home Screen Layout
            </label>
            <select
              id="set-layout"
              value={draft.homeLayout}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  homeLayout: e.target.value as AppSettings['homeLayout'],
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="editorial">Editorial Split Hero</option>
              <option value="catalog">Catalog Showcase</option>
              <option value="compact">Compact Header Strip</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-banner-img" className="block text-xs font-medium text-zinc-700">
              10. Hero Banner Image
            </label>
            <select
              id="set-banner-img"
              value={draft.heroBannerUrl}
              onChange={(e) => setDraft({ ...draft, heroBannerUrl: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {MEDIA_OPTIONS.map((m) => (
                <option key={m.url} value={m.url}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="set-hero-h" className="block text-xs font-medium text-zinc-700">
              Hero Headline
            </label>
            <input
              id="set-hero-h"
              type="text"
              value={draft.heroHeadline}
              onChange={(e) => setDraft({ ...draft, heroHeadline: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="set-promo" className="block text-xs font-medium text-zinc-700">
              11. Promotional Banner Text
            </label>
            <div className="mt-1 flex items-center gap-3">
              <input
                id="set-promo"
                type="text"
                value={draft.promoBannerText}
                onChange={(e) => setDraft({ ...draft, promoBannerText: e.target.value })}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-1.5 text-xs text-zinc-700 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={draft.promoBannerEnabled}
                  onChange={(e) => setDraft({ ...draft, promoBannerEnabled: e.target.checked })}
                />
                Active
              </label>
            </div>
          </div>

          <div className="md:col-span-2 border-t border-zinc-100 pt-4">
            <p className="text-xs font-semibold text-zinc-900 mb-2">13. Navigation Menu Labels</p>
            <div className="grid gap-3 sm:grid-cols-4">
              {draft.navigationMenu.map((item, idx) => (
                <div key={item.id} className="rounded-lg border border-zinc-200 p-2.5 space-y-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => {
                      const next = [...draft.navigationMenu];
                      next[idx] = { ...item, label: e.target.value };
                      setDraft({ ...draft, navigationMenu: next });
                    }}
                    className="w-full rounded border border-zinc-300 px-2 py-1 text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        const next = [...draft.navigationMenu];
                        next[idx] = { ...item, enabled: e.target.checked };
                        setDraft({ ...draft, navigationMenu: next });
                      }}
                    />
                    Visible
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700">14. Contact Address</label>
            <input
              type="text"
              value={draft.contactAddress}
              onChange={(e) => setDraft({ ...draft, contactAddress: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">15. WhatsApp Number</label>
            <input
              type="text"
              value={draft.whatsappNumber}
              onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">16. Support Email</label>
            <input
              type="email"
              value={draft.supportEmail}
              onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">17. Instagram / Social URL</label>
            <input
              type="text"
              value={draft.socialInstagram}
              onChange={(e) => setDraft({ ...draft, socialInstagram: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-700">18. Terms & Conditions</label>
            <textarea
              rows={2}
              value={draft.termsAndConditions}
              onChange={(e) => setDraft({ ...draft, termsAndConditions: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-700">19. Privacy Policy</label>
            <textarea
              rows={2}
              value={draft.privacyPolicy}
              onChange={(e) => setDraft({ ...draft, privacyPolicy: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Shop Settings */}
      {section === 'shop' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.shopSettings.autoApproveSellers}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  shopSettings: { ...draft.shopSettings, autoApproveSellers: e.target.checked },
                })
              }
            />
            Auto-approve new shop applications without manual Super Admin review
          </label>
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.shopSettings.allowSellerSelfClose}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  shopSettings: { ...draft.shopSettings, allowSellerSelfClose: e.target.checked },
                })
              }
            />
            Allow sellers to toggle their shop Open / Closed status
          </label>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-zinc-700">Max Products Per Shop</label>
            <input
              type="number"
              value={draft.shopSettings.maxProductsPerShop}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  shopSettings: { ...draft.shopSettings, maxProductsPerShop: Number(e.target.value) },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
            />
          </div>
        </div>
      )}

      {/* Product Settings */}
      {section === 'product' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.productSettings.requireStockTracking}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  productSettings: {
                    ...draft.productSettings,
                    requireStockTracking: e.target.checked,
                  },
                })
              }
            />
            Enforce real-time stock tracking on checkout
          </label>
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.productSettings.allowCustomerReviews}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  productSettings: {
                    ...draft.productSettings,
                    allowCustomerReviews: e.target.checked,
                  },
                })
              }
            />
            Allow verified customer product reviews
          </label>
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-zinc-700">Max Allowed Discount (%)</label>
            <input
              type="number"
              min={0}
              max={90}
              value={draft.productSettings.maxDiscountPercent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  productSettings: {
                    ...draft.productSettings,
                    maxDiscountPercent: Number(e.target.value),
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
            />
          </div>
        </div>
      )}

      {/* Payment Settings */}
      {section === 'payment' && (
        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-6 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.paymentSettings.codEnabled}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  paymentSettings: { ...draft.paymentSettings, codEnabled: e.target.checked },
                })
              }
            />
            Enable Cash on Delivery (COD)
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.paymentSettings.onlinePaymentEnabled}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  paymentSettings: {
                    ...draft.paymentSettings,
                    onlinePaymentEnabled: e.target.checked,
                  },
                })
              }
            />
            Enable Tokenized Online Card Payment
          </label>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Payment Gateway</label>
            <select
              value={draft.paymentSettings.gatewayProvider}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  paymentSettings: {
                    ...draft.paymentSettings,
                    gatewayProvider: e.target.value as AppSettings['paymentSettings']['gatewayProvider'],
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="Stripe Connect">Stripe Connect</option>
              <option value="Razorpay Marketplace">Razorpay Marketplace</option>
              <option value="Adyen MarketPay">Adyen MarketPay</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Platform Commission (%)
            </label>
            <input
              type="number"
              min={0}
              max={40}
              value={draft.paymentSettings.platformCommissionPercent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  paymentSettings: {
                    ...draft.paymentSettings,
                    platformCommissionPercent: Number(e.target.value),
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
            />
          </div>
        </div>
      )}

      {/* Delivery Settings */}
      {section === 'delivery' && (
        <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-6 md:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Base Delivery Charge ({draft.paymentSettings.currencySymbol})
            </label>
            <input
              type="number"
              min={0}
              value={draft.deliverySettings.baseDeliveryCharge}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deliverySettings: {
                    ...draft.deliverySettings,
                    baseDeliveryCharge: Number(e.target.value),
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">
              Free Delivery Threshold ({draft.paymentSettings.currencySymbol})
            </label>
            <input
              type="number"
              min={0}
              value={draft.deliverySettings.freeDeliveryThreshold}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deliverySettings: {
                    ...draft.deliverySettings,
                    freeDeliveryThreshold: Number(e.target.value),
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono-num"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Default Courier Partner</label>
            <input
              type="text"
              value={draft.deliverySettings.defaultPartnerName}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deliverySettings: {
                    ...draft.deliverySettings,
                    defaultPartnerName: e.target.value,
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Partner Support Phone</label>
            <input
              type="text"
              value={draft.deliverySettings.defaultPartnerPhone}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  deliverySettings: {
                    ...draft.deliverySettings,
                    defaultPartnerPhone: e.target.value,
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {section === 'notification' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-3">
          {(
            [
              ['notifyOnNewOrder', 'Notify Admins when new orders are placed'],
              ['notifySellerOnOrder', 'Notify Sellers immediately on incoming order'],
              ['notifyCustomerOnStatusChange', 'Notify Customers on order confirmation & shipping updates'],
              ['promotionalPushEnabled', 'Allow promotional broadcast notifications'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={draft.notificationSettings[key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    notificationSettings: {
                      ...draft.notificationSettings,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Permissions Settings */}
      {section === 'permissions' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-3">
          {(
            [
              ['adminCanEditBranding', 'Allow Admins to modify global app branding & theme'],
              ['adminCanApproveSellers', 'Allow Admins to approve or reject seller shop applications'],
              ['adminCanIssueRefunds', 'Allow Admins to process customer payment refunds'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2.5 text-sm text-zinc-800">
              <input
                type="checkbox"
                checked={draft.permissionSettings[key]}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    permissionSettings: {
                      ...draft.permissionSettings,
                      [key]: e.target.checked,
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* Security Settings */}
      {section === 'security' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.securitySettings.requireOtpForCheckout}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  securitySettings: {
                    ...draft.securitySettings,
                    requireOtpForCheckout: e.target.checked,
                  },
                })
              }
            />
            Require OTP verification before high-value checkout
          </label>
          <label className="flex items-center gap-2.5 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.securitySettings.requireEmailVerification}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  securitySettings: {
                    ...draft.securitySettings,
                    requireEmailVerification: e.target.checked,
                  },
                })
              }
            />
            Enforce verified email status for sellers and admins
          </label>
        </div>
      )}

      {/* Database Settings */}
      {section === 'database' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 space-y-3 text-sm">
          <p className="font-semibold text-zinc-950">Storage Engine Status</p>
          <p className="text-xs text-zinc-600">
            Active Backend: Server-side persistent JSON store with atomic file writes and role-based REST authorization.
          </p>
          <p className="font-mono-num text-xs text-zinc-500">
            Last Backup: {new Date(draft.databaseSettings.lastBackupAt).toLocaleString()}
          </p>
        </div>
      )}

      {/* Backup Settings */}
      {section === 'backup' && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-zinc-950">Export & Maintenance</p>
            <p className="text-xs text-zinc-600 mt-1">
              Download a full JSON snapshot of shops, products, orders, payments, and settings.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBackupDownload()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-semibold text-white"
            >
              <Download className="h-3.5 w-3.5" /> Export Backup JSON
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Demo Data
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Reset Platform to Initial Demo Data"
        description="This replaces all custom shops, orders, and settings with the default TECHORA seed dataset. Export a backup first if you want to keep your changes."
        confirmLabel="Reset Data"
        busy={busy}
        onConfirm={() => void handleResetDemo()}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
