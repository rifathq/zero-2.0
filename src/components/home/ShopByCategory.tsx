import React from 'react';
import { useMarketplace } from '@/context/MarketplaceContext';
import { CATEGORIES } from '@/lib/mockData';
import { ArrowRight, Grid } from 'lucide-react';

export function ShopByCategory() {
  const { navigate } = useMarketplace();

  return (
    <section className="py-8 bg-white border-b border-[#E6E4E0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">Explore by Category</h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">Find top wholesale and retail products</p>
          </div>
          <button 
            onClick={() => navigate('categories')}
            className="text-xs sm:text-sm font-semibold text-neutral-800 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
          >
            All Categories <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {CATEGORIES.slice(0, 6).map((cat) => (
            <div
              key={cat.id}
              onClick={() => navigate('shop', { category: cat.name })}
              className="group p-4 bg-[#FAF9F5] hover:bg-white rounded-2xl border border-[#E6E4E0] hover:border-neutral-400 hover:shadow-md transition-all cursor-pointer text-center flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-[#E6E4E0] flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <Grid className="w-5 h-5 text-neutral-600" />
                )}
              </div>
              <span className="text-xs font-bold text-neutral-800 group-hover:text-neutral-900 line-clamp-1">
                {cat.name}
              </span>
              <span className="text-[11px] text-neutral-400">
                {cat.productCount} items
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
