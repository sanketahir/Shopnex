import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, ShieldCheck, Store, Truck } from 'lucide-react';
import { useTechora } from '../context/TechoraContext';

const STEPS = [
  {
    title: 'Discover Independent Local Shops',
    description:
      'Browse verified neighborhood electronics, audio, kitchen craft, and workspace studios inside one unified storefront.',
    icon: Store,
  },
  {
    title: 'Unified Cart & Transparent Payments',
    description:
      'Pay with Cash on Delivery or secure tokenized card checkout with instant order confirmation and receipts.',
    icon: ShieldCheck,
  },
  {
    title: 'Live Courier Tracking & Seller Hub',
    description:
      'Follow every milestone from shop acceptance to courier handoff, or launch your own storefront in minutes.',
    icon: Truck,
  },
];

export function SplashAndOnboarding({ onDone }: { onDone: () => void }) {
  const { effectiveSettings } = useTechora();
  const [phase, setPhase] = useState<'splash' | 'onboarding'>('splash');
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('onboarding');
    }, 1100);
    return () => clearTimeout(timer);
  }, []);

  if (phase === 'splash') {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-white"
        style={{ backgroundColor: effectiveSettings.secondaryColor }}
        data-testid="techora-splash"
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-bold tracking-tight text-white shadow-lg"
            style={{ backgroundColor: effectiveSettings.primaryColor }}
          >
            {effectiveSettings.appIconText || effectiveSettings.appDisplayName.slice(0, 1)}
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight">
            {effectiveSettings.appDisplayName}
          </h1>
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            {effectiveSettings.splashTagline}
          </p>
          <button
            type="button"
            onClick={onDone}
            className="mt-8 text-xs font-medium text-zinc-400 hover:text-white underline underline-offset-4"
          >
            Enter Storefront
          </button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/95 p-4 text-white"
      data-testid="techora-onboarding"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight text-white">
            {effectiveSettings.appDisplayName}
          </span>
          <button
            type="button"
            onClick={onDone}
            className="text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Skip
          </button>
        </div>

        <div className="mt-8">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl text-white"
            style={{ backgroundColor: effectiveSettings.primaryColor }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            {current.description}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Step ${idx + 1}`}
                onClick={() => setStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === step ? 'w-7 bg-blue-500' : 'w-2 bg-zinc-700'
                }`}
              />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: effectiveSettings.primaryColor }}
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: effectiveSettings.primaryColor }}
            >
              Start Shopping <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
