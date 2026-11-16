import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Heart,
  MapPin,
  Search,
  ShoppingCart,
  Star,
  Store,
  X,
} from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import { calculateDiscountedPrice } from '../utils/commerce';

export function CustomerStorefront({ shopsOnly = false }: { shopsOnly?: boolean }) {
  const {
    effectiveSettings,
    categories,
    shops,
    products,
    customerData,
    selectedShopId,
    setSelectedShopId,
    setSelectedProductId,
    addToCart,
    toggleWishlist,
    setActiveView,
  } = useTechora();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [promoDismissed, setPromoDismissed] = useState(false);

  const selectedShop = useMemo(
    () => shops.find((s) => s.id === selectedShopId) || null,
    [shops, selectedShopId],
  );

  const filteredShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shops.filter((shop) => {
      if (!q) return true;
      return (
        shop.name.toLowerCase().includes(q) ||
        shop.city.toLowerCase().includes(q) ||
        shop.category.toLowerCase().includes(q) ||
        shop.description.toLowerCase().includes(q)
      );
    });
  }, [shops, searchQuery]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedShopId && product.shopId !== selectedShopId) return false;
      if (selectedCategory !== 'All' && product.category !== selectedCategory) return false;
      if (!q) return true;
      const shopName = shops.find((s) => s.id === product.shopId)?.name.toLowerCase() || '';
      return (
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        shopName.includes(q)
      );
    });
  }, [products, shops, selectedShopId, selectedCategory, searchQuery]);

  const currency = effectiveSettings.paymentSettings.currencySymbol;

  return (
    <div className="min-h-screen" style={{ backgroundColor: effectiveSettings.backgroundColor }}>
      {/* Slim Dismissible Promo Strip */}
      {effectiveSettings.promoBannerEnabled && !promoDismissed && (
        <div
          className="flex items-center justify-between px-3 py-1.5 text-[11px] sm:text-xs font-medium text-white sm:px-6"
          style={{ backgroundColor: effectiveSettings.secondaryColor }}
        >
          <div className="mx-auto flex max-w-7xl flex-1 items-center justify-center text-center">
            <span>{effectiveSettings.promoBannerText}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => setPromoDismissed(true)}
            className="ml-3 rounded p-1 text-zinc-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Hero Section (adapts to homeLayout setting, omitted on dedicated shopsOnly view) */}
      {!shopsOnly && !selectedShop && (
        <section className="border-b border-zinc-200 bg-zinc-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
            {effectiveSettings.homeLayout === 'compact' ? (
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div className="max-w-2xl">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                    {effectiveSettings.heroHeadline}
                  </h1>
                  <p className="mt-2.5 text-sm text-zinc-300">
                    {effectiveSettings.heroSubheadline}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('shops')}
                  className="inline-flex items-center gap-2 self-start rounded-lg px-5 py-3 text-sm font-semibold text-white whitespace-nowrap shrink-0"
                  style={{ backgroundColor: effectiveSettings.primaryColor }}
                >
                  Explore Local Shops <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : effectiveSettings.homeLayout === 'catalog' ? (
              <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
                    {effectiveSettings.heroHeadline}
                  </h1>
                  <p className="mt-4 max-w-xl text-base text-zinc-300 leading-relaxed">
                    {effectiveSettings.heroSubheadline}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                    <span>{shops.length} Verified Local Shops</span>
                    <span aria-hidden="true">·</span>
                    <span>{products.length} Active Products</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Free delivery above {currency}
                      {effectiveSettings.deliverySettings.freeDeliveryThreshold}
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <div className="aspect-[16/9] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    <img
                      src={effectiveSettings.heroBannerUrl}
                      alt={`${effectiveSettings.appDisplayName} featured hardware`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
                <div className="flex flex-col justify-between lg:col-span-6 py-2">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-blue-400">
                      Local Multi-Vendor Marketplace
                    </p>
                    <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl leading-[1.1]">
                      {effectiveSettings.heroHeadline}
                    </h1>
                    <p className="mt-4 max-w-lg text-base text-zinc-300 leading-relaxed">
                      {effectiveSettings.heroSubheadline}
                    </p>
                  </div>
                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <a
                      href="#catalog-section"
                      className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                      style={{ backgroundColor: effectiveSettings.primaryColor }}
                    >
                      Browse Catalog <ArrowRight className="h-4 w-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveView('shops')}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-900 transition-colors"
                    >
                      View All Shops ({shops.length})
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="relative h-64 sm:h-80 lg:h-full min-h-[280px] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    <img
                      src={effectiveSettings.heroBannerUrl}
                      alt={`${effectiveSettings.appDisplayName} flagship showcase`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-zinc-200">
                      <span>Verified neighborhood storefronts</span>
                      <span className="font-mono-num">
                        {shops.filter((s) => s.isOpen).length} Open Now
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Selected Shop Banner */}
      {selectedShop && (
        <section className="border-b border-zinc-200 bg-zinc-950 text-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <button
              type="button"
              onClick={() => setSelectedShopId(null)}
              className="text-xs font-medium text-zinc-400 hover:text-white underline underline-offset-4"
            >
              Back to all shops and products
            </button>
            <div className="mt-4 grid gap-6 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-7">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ backgroundColor: effectiveSettings.primaryColor }}
                  >
                    {selectedShop.logoText}
                  </span>
                  <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                      {selectedShop.name}
                    </h1>
                    <p className="text-xs text-zinc-400">
                      {selectedShop.category} · {selectedShop.city} ·{' '}
                      {selectedShop.isOpen ? 'Open for Orders' : 'Currently Closed'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 max-w-2xl text-sm text-zinc-300 leading-relaxed">
                  {selectedShop.description}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedShop.address}, {selectedShop.city} · {selectedShop.phone}
                </p>
              </div>
              <div className="lg:col-span-5">
                <div className="aspect-[16/9] overflow-hidden rounded-xl border border-zinc-800">
                  <img
                    src={selectedShop.bannerUrl}
                    alt={selectedShop.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Search & Filters Toolbar */}
      <section id="catalog-section" className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              aria-label="Search shops or products"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search local shops, products, or categories..."
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-950 placeholder:text-zinc-500 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          {!shopsOnly && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('All')}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === 'All'
                    ? 'bg-zinc-950 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat.name
                      ? 'bg-zinc-950 text-white'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Local Shops Directory */}
      {!selectedShop && (
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
                {shopsOnly ? 'Local Shop Directory' : 'Featured Local Shops'}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Select any verified storefront to browse its independent catalog.
              </p>
            </div>
            {!shopsOnly && shops.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveView('shops')}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                All {shops.length} shops
              </button>
            )}
          </div>

          {filteredShops.length === 0 ? (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center">
              <Store className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-3 text-sm font-medium text-zinc-900">No matching local shops</p>
              <p className="mt-1 text-xs text-zinc-500">
                Try clearing your search filter to see all active storefronts.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredShops.map((shop) => {
                const shopProductCount = products.filter((p) => p.shopId === shop.id).length;
                return (
                  <article
                    key={shop.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:border-zinc-400"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-zinc-100">
                      <img
                        src={shop.bannerUrl}
                        alt={shop.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>
                          {shop.category} · {shop.city}
                        </span>
                        <span
                          className={`font-medium ${
                            shop.isOpen ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {shop.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-bold text-zinc-950">
                        {shop.name}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-zinc-600 leading-relaxed">
                        {shop.description}
                      </p>
                      <div className="mt-auto pt-4 flex items-center justify-between border-t border-zinc-100 text-xs text-zinc-600">
                        <span className="inline-flex items-center gap-1 font-mono-num">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {shop.rating.toFixed(1)} · {shopProductCount} items
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShopId(shop.id);
                            setActiveView('home');
                          }}
                          className="font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                        >
                          Visit Shop
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Product Catalog Grid */}
      {!shopsOnly && (
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6">
          <div className="flex items-end justify-between gap-4 border-t border-zinc-200 pt-8">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-950">
                {selectedShop ? `Catalog from ${selectedShop.name}` : 'Marketplace Products'}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Showing <span className="font-mono-num font-semibold">{filteredProducts.length}</span>{' '}
                products available for local dispatch.
              </p>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-12 text-center">
              <p className="text-sm font-medium text-zinc-900">No products match your current filter</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setSelectedShopId(null);
                }}
                className="mt-3 rounded-lg bg-zinc-950 px-4 py-2 text-xs font-medium text-white"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((product) => {
                const shop = shops.find((s) => s.id === product.shopId);
                const finalPrice = calculateDiscountedPrice(
                  product.price,
                  product.discountPercent,
                );
                const isWishlisted = customerData.wishlist.includes(product.id);
                const isClosed = shop ? !shop.isOpen : false;

                return (
                  <article
                    key={product.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
                      <button
                        type="button"
                        onClick={() => setSelectedProductId(product.id)}
                        className="h-full w-full block text-left"
                        aria-label={`View details for ${product.name}`}
                      >
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleWishlist(product.id)}
                        aria-label={
                          isWishlisted
                            ? `Remove ${product.name} from wishlist`
                            : `Save ${product.name} to wishlist`
                        }
                        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-zinc-700 shadow-xs hover:text-red-600 transition-colors"
                      >
                        <Heart
                          className={`h-4 w-4 ${isWishlisted ? 'fill-red-600 text-red-600' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span className="truncate">
                          {product.category} · {shop?.name || 'Local Shop'}
                        </span>
                        <span className="font-mono-num shrink-0">
                          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedProductId(product.id)}
                        className="mt-2 text-left"
                      >
                        <h3 className="font-display text-base font-semibold text-zinc-950 group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </h3>
                      </button>

                      <p className="mt-1.5 line-clamp-2 text-xs text-zinc-600 leading-relaxed">
                        {product.description}
                      </p>

                      <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-zinc-100">
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="font-mono-num text-base font-bold text-zinc-950">
                              {currency}
                              {finalPrice.toFixed(2)}
                            </span>
                            {product.discountPercent > 0 && (
                              <span className="font-mono-num text-xs text-zinc-400 line-through">
                                {currency}
                                {product.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {product.discountPercent > 0 && (
                            <span className="text-xs font-medium text-blue-600">
                              Save {product.discountPercent}%
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={product.stock <= 0 || isClosed}
                          onClick={() => addToCart(product.id, 1)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-zinc-300 whitespace-nowrap shrink-0"
                          style={
                            product.stock > 0 && !isClosed
                              ? { backgroundColor: effectiveSettings.primaryColor }
                              : undefined
                          }
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          {isClosed ? 'Shop Closed' : product.stock <= 0 ? 'Sold Out' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
