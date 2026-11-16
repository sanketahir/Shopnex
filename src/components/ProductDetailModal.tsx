import React, { useMemo, useState } from 'react';
import { Heart, ShoppingCart, Star, Store, X } from 'lucide-react';
import { useTechora } from '../context/TechoraContext';
import { calculateDiscountedPrice } from '../utils/commerce';

export function ProductDetailModal() {
  const {
    selectedProductId,
    setSelectedProductId,
    products,
    shops,
    reviews,
    effectiveSettings,
    addToCart,
    toggleWishlist,
    customerData,
    currentUser,
    setAuthModalOpen,
    setSelectedShopId,
    apiFetch,
    refreshAll,
    showToast,
  } = useTechora();

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const product = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  if (!product) return null;

  const shop = shops.find((s) => s.id === product.shopId);
  const productReviews = reviews.filter((r) => r.productId === product.id);
  const finalPrice = calculateDiscountedPrice(product.price, product.discountPercent);
  const currency = effectiveSettings.paymentSettings.currencySymbol;
  const isWishlisted = customerData.wishlist.includes(product.id);
  const mainImage = product.images[activeImageIdx] || product.images[0];

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          rating: reviewRating,
          comment: reviewComment,
        }),
      });
      setReviewComment('');
      await refreshAll();
      showToast('Review published');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to post review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <button
          type="button"
          aria-label="Close product details"
          onClick={() => {
            setSelectedProductId(null);
            setActiveImageIdx(0);
            setQty(1);
          }}
          className="sticky float-right right-4 top-4 z-10 m-4 rounded-lg bg-white/95 p-2 text-zinc-600 border border-zinc-200 hover:text-zinc-950"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-12">
          {/* Left: Product Gallery */}
          <div className="lg:col-span-6 space-y-3">
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100">
              <img
                src={mainImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="flex gap-2.5">
                {product.images.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setActiveImageIdx(i)}
                    className={`h-16 w-20 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === activeImageIdx ? 'border-blue-600' : 'border-zinc-200'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} view ${i + 1}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="lg:col-span-6 flex flex-col">
            <p className="text-xs font-medium text-zinc-500">
              {product.category} · {shop?.name || 'Local Store'}
            </p>
            <h2 id="pdp-title" className="mt-1.5 font-display text-2xl font-bold text-zinc-950">
              {product.name}
            </h2>

            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
              <span className="inline-flex items-center gap-1 font-mono-num font-semibold text-zinc-900">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {product.rating.toFixed(1)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{productReviews.length} verified reviews</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">
                {product.stock > 0 ? `${product.stock} units available` : 'Out of stock'}
              </span>
            </div>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-mono-num text-3xl font-bold text-zinc-950">
                {currency}
                {finalPrice.toFixed(2)}
              </span>
              {product.discountPercent > 0 && (
                <>
                  <span className="font-mono-num text-base text-zinc-400 line-through">
                    {currency}
                    {product.price.toFixed(2)}
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {product.discountPercent}% off
                  </span>
                </>
              )}
            </div>

            <p className="mt-4 text-sm text-zinc-600 leading-relaxed">{product.description}</p>

            {product.specs.length > 0 && (
              <div className="mt-5 border-t border-zinc-200 pt-4">
                <h3 className="text-xs font-semibold text-zinc-900">Specifications</h3>
                <ul className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                  {product.specs.map((spec) => (
                    <li key={spec} className="truncate">
                      · {spec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quantity + Purchase CTA */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-zinc-300">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  -
                </button>
                <span className="px-3 py-2 font-mono-num text-sm font-semibold">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  className="px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={product.stock <= 0 || (shop ? !shop.isOpen : false)}
                onClick={() => {
                  addToCart(product.id, qty);
                  setSelectedProductId(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:bg-zinc-300"
                style={
                  product.stock > 0 && (!shop || shop.isOpen)
                    ? { backgroundColor: effectiveSettings.primaryColor }
                    : undefined
                }
              >
                <ShoppingCart className="h-4 w-4" />
                {shop && !shop.isOpen
                  ? 'Shop Currently Closed'
                  : product.stock <= 0
                    ? 'Out of Stock'
                    : 'Add to Cart'}
              </button>

              <button
                type="button"
                onClick={() => void toggleWishlist(product.id)}
                aria-label="Toggle wishlist"
                className="rounded-lg border border-zinc-300 p-2.5 text-zinc-700 hover:bg-zinc-50"
              >
                <Heart
                  className={`h-4 w-4 ${isWishlisted ? 'fill-red-600 text-red-600' : ''}`}
                />
              </button>
            </div>

            {shop && (
              <div className="mt-5 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Store className="h-4 w-4 text-zinc-700" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-950">{shop.name}</p>
                    <p className="text-xs text-zinc-500">
                      {shop.city} · {shop.isOpen ? 'Accepting orders' : 'Closed'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedShopId(shop.id);
                    setSelectedProductId(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  View Storefront
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Product Reviews Section */}
        <div className="border-t border-zinc-200 bg-zinc-50/60 p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-3">
              <h3 className="font-display text-lg font-bold text-zinc-950">
                Customer Reviews ({productReviews.length})
              </h3>
              {productReviews.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No reviews yet. Be the first customer to review this item.
                </p>
              ) : (
                productReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-950">{rev.customerName}</span>
                      <span className="font-mono-num text-amber-600 font-semibold">
                        {rev.rating}.0 / 5.0
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-700 leading-relaxed">{rev.comment}</p>
                  </div>
                ))
              )}
            </div>

            {effectiveSettings.productSettings.allowCustomerReviews && (
              <div className="lg:col-span-5">
                <form
                  onSubmit={handleSubmitReview}
                  className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3"
                >
                  <h4 className="text-sm font-semibold text-zinc-950">Write a Review</h4>
                  {reviewError && (
                    <p className="text-xs text-red-600">{reviewError}</p>
                  )}
                  <div>
                    <label htmlFor="rev-rating" className="block text-xs font-medium text-zinc-700">
                      Rating
                    </label>
                    <select
                      id="rev-rating"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    >
                      <option value={5}>5 Stars — Excellent</option>
                      <option value={4}>4 Stars — Very Good</option>
                      <option value={3}>3 Stars — Satisfactory</option>
                      <option value={2}>2 Stars — Fair</option>
                      <option value={1}>1 Star — Needs Improvement</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rev-comment" className="block text-xs font-medium text-zinc-700">
                      Comment
                    </label>
                    <textarea
                      id="rev-comment"
                      rows={3}
                      required
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share build quality, delivery speed, and shop experience..."
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full rounded-lg bg-zinc-950 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
