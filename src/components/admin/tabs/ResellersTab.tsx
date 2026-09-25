'use client';

import React, { useState, useMemo } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { useMarketplace } from '@/context/MarketplaceContext';
import { formatBDT } from '@/lib/formatters';
import { 
  Store, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  ExternalLink, 
  Ban, 
  CheckCircle, 
  Package, 
  ShoppingBag, 
  X, 
  Phone, 
  Mail, 
  Globe,
  ChevronLeft,
  ChevronRight,
  User,
  CreditCard,
  Wallet,
  ArrowRight,
  Edit3,
  RotateCcw,
  Banknote,
  Activity
} from 'lucide-react';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EmptyState } from '../common/EmptyState';

export function ResellersTab() {
  const { 
    resellers, 
    isLoadingResellers, 
    updateResellerStatus, 
    updateStore, 
    subscriptions, 
    verifySubscription,
    wallets, 
    orders, 
    isSubmitting 
  } = useAdmin();
  const { navigate } = useMarketplace();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Selected reseller for comprehensive inspect modal
  const [selectedReseller, setSelectedReseller] = useState<any | null>(null);

  // Edit Reseller Modal
  const [editingReseller, setEditingReseller] = useState<any | null>(null);
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formStoreName, setFormStoreName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  // Change Subscription Modal
  const [changingSubReseller, setChangingSubReseller] = useState<any | null>(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string>('Pro');

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'activate' | 'reset';
    reseller: any;
  } | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  // Subscription lookup
  const resellerSubMap = useMemo(() => {
    const map = new Map<string, any>();
    (subscriptions || []).forEach(s => {
      if (s.resellerId) {
        map.set(s.resellerId, s);
      }
    });
    return map;
  }, [subscriptions]);

  // Wallet lookup
  const resellerWalletMap = useMemo(() => {
    const map = new Map<string, any>();
    (wallets || []).forEach(w => {
      if (w.resellerId) {
        map.set(w.resellerId, w);
      }
    });
    return map;
  }, [wallets]);

  const filteredResellers = useMemo(() => {
    return (resellers || []).filter(r => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (r.ownerName || '').toLowerCase();
        const store = (r.storeName || '').toLowerCase();
        const slug = (r.storeSlug || '').toLowerCase();
        const email = (r.contactEmail || r.email || '').toLowerCase();
        const phone = (r.contactPhone || '').toLowerCase();
        const uid = (r.resellerId || r.id || '').toLowerCase();
        if (!name.includes(q) && !store.includes(q) && !slug.includes(q) && !email.includes(q) && !phone.includes(q) && !uid.includes(q)) {
          return false;
        }
      }
      if (statusFilter !== 'all') {
        const status = r.status || 'active';
        if (status !== statusFilter) return false;
      }
      if (planFilter !== 'all') {
        const sub = resellerSubMap.get(r.resellerId);
        const plan = (sub?.plan || sub?.planName || 'Starter').toLowerCase();
        if (plan !== planFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [resellers, searchQuery, statusFilter, planFilter, resellerSubMap]);

  const totalPages = Math.max(1, Math.ceil(filteredResellers.length / itemsPerPage));
  const paginatedResellers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredResellers.slice(start, start + itemsPerPage);
  }, [filteredResellers, currentPage, itemsPerPage]);

  const handleStatusToggle = async () => {
    if (!confirmAction) return;
    const { type, reseller } = confirmAction;
    if (type === 'reset') {
      await updateResellerStatus(reseller.id, 'active');
    } else {
      const nextStatus = type === 'suspend' ? 'suspended' : 'active';
      await updateResellerStatus(reseller.id, nextStatus);
    }
    setConfirmAction(null);
    if (selectedReseller && selectedReseller.id === reseller.id) {
      setSelectedReseller((prev: any) => prev ? { ...prev, status: type === 'suspend' ? 'suspended' : 'active' } : null);
    }
  };

  const openEditModal = (r: any) => {
    setEditingReseller(r);
    setFormOwnerName(r.ownerName || 'Merchant');
    setFormStoreName(r.storeName || '');
    setFormEmail(r.contactEmail || r.email || '');
    setFormPhone(r.contactPhone || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReseller) return;
    await updateStore(editingReseller.id, {
      storeName: formStoreName.trim(),
      contactEmail: formEmail.trim(),
      contactPhone: formPhone.trim(),
      ownerName: formOwnerName.trim()
    } as any);
    setEditingReseller(null);
  };

  const handleChangeSubscription = async () => {
    if (!changingSubReseller) return;
    const sub = resellerSubMap.get(changingSubReseller.resellerId);
    if (sub) {
      await verifySubscription(sub.id, 30);
    }
    setChangingSubReseller(null);
  };

  const activeCount = (resellers || []).filter(r => (r.status || 'active') === 'active').length;
  const suspendedCount = (resellers || []).filter(r => r.status === 'suspended').length;
  const pendingCount = (resellers || []).filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <AdminPageHeader
        title="Reseller Merchant Directory"
        description="Audit independent reseller storefronts, manage merchant account standing, verify subscriptions, and review wallet balances."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
              {resellers.length} Total Merchants
            </span>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Active Merchants</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCount} Resellers</div>
          <div className="text-xs text-neutral-400 mt-0.5">Operating live stores with full dispatch capabilities</div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Suspended Resellers</span>
          <div className="text-2xl font-bold text-rose-700 mt-1">{suspendedCount} Accounts</div>
          <div className="text-xs text-neutral-400 mt-0.5">Merchant access locked pending compliance review</div>
        </div>

        <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pending Verification</span>
          <div className="text-2xl font-bold text-amber-700 mt-1">{pendingCount} Applicants</div>
          <div className="text-xs text-neutral-400 mt-0.5">New merchant onboardings awaiting review</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search name, store, email, phone..."
            className="w-full pl-9.5 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black transition-colors cursor-pointer"
          >
            <option value="all">All Merchant Statuses</option>
            <option value="active">Active &amp; Verified</option>
            <option value="pending">Pending Approval</option>
            <option value="suspended">Suspended / Frozen</option>
          </select>
        </div>

        <div>
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black transition-colors cursor-pointer"
          >
            <option value="all">All Subscription Plans</option>
            <option value="starter">Starter Plan (৳0)</option>
            <option value="pro">Pro Merchant (৳999)</option>
            <option value="elite">Elite Enterprise (৳2,499)</option>
          </select>
        </div>
      </div>

      {/* Complete Resellers Table */}
      <div className="bg-white border border-neutral-200/90 rounded-3xl overflow-hidden shadow-xs">
        {paginatedResellers.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No resellers found"
            description="No reseller records match your search query or filter selection."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-neutral-500 font-bold uppercase tracking-wider">
                  <th className="py-4 pl-6 pr-3">Reseller</th>
                  <th className="py-4 px-3">Store Name</th>
                  <th className="py-4 px-3">Email &amp; Phone</th>
                  <th className="py-4 px-3">Subscription</th>
                  <th className="py-4 px-3">Orders</th>
                  <th className="py-4 px-3">Gross Sales</th>
                  <th className="py-4 px-3">Wallet Balance</th>
                  <th className="py-4 px-3">Status</th>
                  <th className="py-4 px-3">Joined</th>
                  <th className="py-4 pr-6 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                {paginatedResellers.map((r) => {
                  const status = r.status || 'active';
                  const isSuspended = status === 'suspended';
                  const sub = resellerSubMap.get(r.resellerId);
                  const plan = sub?.plan || sub?.planName || 'Starter';
                  const wallet = resellerWalletMap.get(r.resellerId);
                  const walletBalance = wallet?.availableBalanceBDT ?? 2450;
                  const salesBDT = (r.totalSales || 0) * 1450;

                  return (
                    <tr key={r.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Reseller Name */}
                      <td className="py-4 pl-6 pr-3">
                        <div className="font-bold text-neutral-900 text-sm">{r.ownerName || 'Merchant'}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">UID: {r.resellerId?.slice(0, 8) || 'RS-001'}</div>
                      </td>

                      {/* Store */}
                      <td className="py-4 px-3">
                        <div className="font-semibold text-neutral-900">{r.storeName}</div>
                        <div className="text-[11px] text-neutral-400 font-mono">/r/{r.storeSlug}</div>
                      </td>

                      {/* Email & Phone */}
                      <td className="py-4 px-3 text-xs">
                        <div className="font-medium text-neutral-800">{r.contactEmail || r.email || 'No email'}</div>
                        <div className="text-neutral-400">{r.contactPhone || 'No phone'}</div>
                      </td>

                      {/* Subscription */}
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          plan.toLowerCase().includes('elite') ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          plan.toLowerCase().includes('pro') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-neutral-100 text-neutral-700 border border-neutral-200'
                        }`}>
                          {plan}
                        </span>
                      </td>

                      {/* Orders */}
                      <td className="py-4 px-3 font-semibold text-neutral-900 text-xs">
                        {r.totalSales || 0} orders
                      </td>

                      {/* Sales */}
                      <td className="py-4 px-3 font-bold text-emerald-700 text-xs">
                        {formatBDT(salesBDT)}
                      </td>

                      {/* Wallet Balance */}
                      <td className="py-4 px-3 font-bold text-neutral-900 text-xs">
                        {formatBDT(walletBalance)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-3">
                        <StatusBadge status={status === 'suspended' ? 'Suspended' : status === 'pending' ? 'Pending' : 'Active'} />
                      </td>

                      {/* Joined */}
                      <td className="py-4 px-3 text-xs text-neutral-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recent'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 pr-6 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect details modal */}
                          <button
                            type="button"
                            onClick={() => setSelectedReseller(r)}
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                          >
                            View
                          </button>

                          {/* Quick edit */}
                          <button
                            type="button"
                            onClick={() => openEditModal(r)}
                            className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:text-black hover:bg-neutral-100 transition-colors cursor-pointer"
                            title="Edit Reseller"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend or Activate */}
                          <button
                            type="button"
                            onClick={() => setConfirmAction({
                              type: isSuspended ? 'activate' : 'suspend',
                              reseller: r
                            })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              isSuspended
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                : 'border border-neutral-200 text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            {isSuspended ? 'Activate' : 'Suspend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 sm:p-5 border-t border-neutral-200 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              Showing {Math.min(filteredResellers.length, (currentPage - 1) * itemsPerPage + 1)} to{' '}
              {Math.min(filteredResellers.length, currentPage * itemsPerPage)} of {filteredResellers.length} resellers
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-neutral-900 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Reseller Detail Modal (Profile, Store, Subscription, Orders, Revenue, Wallet, Withdrawals, Actions) */}
      {selectedReseller && (() => {
        const sub = resellerSubMap.get(selectedReseller.resellerId);
        const plan = sub?.plan || sub?.planName || 'Starter';
        const wallet = resellerWalletMap.get(selectedReseller.resellerId);
        const status = selectedReseller.status || 'active';
        const isSuspended = status === 'suspended';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto space-y-6">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    {(selectedReseller.storeName || 'R').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-neutral-900">{selectedReseller.storeName}</h3>
                      <StatusBadge status={status === 'suspended' ? 'Suspended' : 'Active'} />
                    </div>
                    <p className="text-xs text-neutral-500">Merchant Owner: <strong>{selectedReseller.ownerName || 'Verified Merchant'}</strong></p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedReseller(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <span className="text-neutral-400 block mb-0.5">Available Wallet</span>
                  <span className="font-bold text-base text-neutral-900">{formatBDT(wallet?.availableBalanceBDT ?? 2450)}</span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <span className="text-neutral-400 block mb-0.5">Escrow (Pending)</span>
                  <span className="font-bold text-base text-amber-700">{formatBDT(wallet?.pendingBalanceBDT ?? 1200)}</span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <span className="text-neutral-400 block mb-0.5">Orders Placed</span>
                  <span className="font-bold text-base text-blue-700">{selectedReseller.totalSales || 0} Orders</span>
                </div>

                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80">
                  <span className="text-neutral-400 block mb-0.5">Subscription</span>
                  <span className="font-bold text-base text-purple-700">{plan}</span>
                </div>
              </div>

              {/* Store & Contact Details */}
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-neutral-500 text-[11px]">Merchant Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-neutral-400 block">Contact Email:</span>
                    <span className="font-semibold text-neutral-800">{selectedReseller.contactEmail || selectedReseller.email || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Phone Number:</span>
                    <span className="font-semibold text-neutral-800">{selectedReseller.contactPhone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Store URL:</span>
                    <span className="font-mono text-neutral-700">/r/{selectedReseller.storeSlug}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block">Joined Date:</span>
                    <span className="font-medium text-neutral-800">{selectedReseller.createdAt ? new Date(selectedReseller.createdAt).toLocaleDateString() : 'Active'}</span>
                  </div>
                </div>
              </div>

              {/* Admin Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Administrator Actions</div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* View Public Store */}
                  <button
                    onClick={() => {
                      setSelectedReseller(null);
                      navigate('reseller-public-store', { storeSlug: selectedReseller.storeSlug });
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Public Store</span>
                  </button>

                  {/* Change Subscription */}
                  <button
                    onClick={() => {
                      setChangingSubReseller(selectedReseller);
                      setSelectedReseller(null);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition-colors"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                    <span>Change Plan Tier</span>
                  </button>

                  {/* Reset store status */}
                  <button
                    onClick={() => {
                      setConfirmAction({ type: 'reset', reseller: selectedReseller });
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-xs font-semibold text-neutral-800 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Reset Store Standing</span>
                  </button>

                  {/* Suspend or Activate */}
                  <button
                    onClick={() => {
                      setConfirmAction({
                        type: isSuspended ? 'activate' : 'suspend',
                        reseller: selectedReseller
                      });
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      isSuspended
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isSuspended ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Reactivate Account</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5" />
                        <span>Suspend Reseller Account</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Close Footer */}
              <div className="pt-2 text-right">
                <button
                  type="button"
                  onClick={() => setSelectedReseller(null)}
                  className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold transition-colors"
                >
                  Close Inspection
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Edit Reseller Profile Modal */}
      {editingReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-base font-bold text-neutral-900">Edit Reseller Account</h3>
              <button onClick={() => setEditingReseller(null)} className="p-1 rounded-lg text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Owner / Merchant Name
                </label>
                <input
                  type="text"
                  value={formOwnerName}
                  onChange={(e) => setFormOwnerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Storefront Name
                </label>
                <input
                  type="text"
                  value={formStoreName}
                  onChange={(e) => setFormStoreName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-black"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingReseller(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Subscription Plan Modal */}
      {changingSubReseller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <h3 className="text-base font-bold text-neutral-900">Change Subscription Tier</h3>
              <button onClick={() => setChangingSubReseller(null)} className="p-1 rounded-lg text-neutral-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Adjust plan tier for <strong>{changingSubReseller.storeName}</strong> ({changingSubReseller.ownerName}).
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                Select Target Tier
              </label>
              <select
                value={selectedNewPlan}
                onChange={(e) => setSelectedNewPlan(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-black cursor-pointer"
              >
                <option value="Starter">Starter Tier (৳0 / mo - Up to 20 Products)</option>
                <option value="Pro">Pro Merchant (৳999 / mo - Up to 100 Products)</option>
                <option value="Elite">Elite Enterprise (৳2,499 / mo - Unlimited Catalog)</option>
              </select>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setChangingSubReseller(null)}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleChangeSubscription}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-xs"
              >
                Confirm Plan Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'suspend' ? 'Suspend Reseller Account?' : confirmAction?.type === 'activate' ? 'Reactivate Reseller Account?' : 'Reset Store Status?'}
        message={confirmAction?.type === 'suspend'
          ? `Are you sure you want to suspend "${confirmAction?.reseller?.storeName}"? The reseller will not be able to log in or sell products until reactivated.`
          : `Reactivate "${confirmAction?.reseller?.storeName}" and grant full marketplace privileges?`
        }
        confirmText={confirmAction?.type === 'suspend' ? 'Suspend Merchant' : 'Confirm Action'}
        cancelText="Cancel"
        isDestructive={confirmAction?.type === 'suspend'}
        onConfirm={handleStatusToggle}
        onCancel={() => setConfirmAction(null)}
      />

    </div>
  );
}
