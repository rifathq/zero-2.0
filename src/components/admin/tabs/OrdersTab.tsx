'use client';

import React, { useState, useMemo } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { Order, OrderStatus } from '@/types/marketplace';
import { formatBDT } from '@/lib/formatters';
import { 
  Search, 
  ShoppingBag, 
  CheckCircle2, 
  Truck, 
  Clock, 
  Eye, 
  FileText,
  AlertCircle,
  MapPin,
  Phone,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { StatusBadge } from '../common/StatusBadge';
import { EmptyState } from '../common/EmptyState';

const COURIER_OPTIONS = [
  'Steadfast Courier',
  'Pathao Courier',
  'RedX Delivery',
  'Paperfly',
  'Sundarban Courier Service',
  'SA Paribahan',
  'eCourier',
  'Direct / In-House Delivery'
];

export function OrdersTab() {
  const { orders, isLoadingOrders, updateOrderStatus, isSubmitting } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');

  // Selected order for inspection & status update modal
  const [selectedOrder, setSelectedOrder] = useState<Order | any | null>(null);
  const [modalStatus, setModalStatus] = useState<OrderStatus>('Pending');
  const [modalCourier, setModalCourier] = useState<string>('');
  const [modalTracking, setModalTracking] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;

  const openOrderModal = (order: any) => {
    setSelectedOrder(order);
    setModalStatus(order.status || 'Pending');
    setModalCourier(order.courier || order.carrier || 'Steadfast Courier');
    setModalTracking(order.trackingNumber || '');
    setModalNotes('');
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    await updateOrderStatus(selectedOrder.id, modalStatus, modalCourier, modalTracking, modalNotes);
    setSelectedOrder(null);
  };

  const filteredOrders = useMemo(() => {
    return (orders || []).filter(o => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = (o.id || '').toLowerCase().includes(q) || (o.orderNumber || '').toLowerCase().includes(q);
        const custMatch = (o.customerName || '').toLowerCase().includes(q) || (o.customerEmail || '').toLowerCase().includes(q);
        const trackMatch = (o.trackingNumber || '').toLowerCase().includes(q);
        if (!idMatch && !custMatch && !trackMatch) return false;
      }
      if (statusFilter !== 'all') {
        if (o.status !== statusFilter) return false;
      }
      if (courierFilter !== 'all') {
        const courier = o.courier || o.carrier || '';
        if (courier !== courierFilter) return false;
      }
      return true;
    });
  }, [orders, searchQuery, statusFilter, courierFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const pendingCount = (orders || []).filter(o => o.status === 'Pending').length;
  const processingCount = (orders || []).filter(o => o.status === 'Processing').length;
  const shippedCount = (orders || []).filter(o => o.status === 'Shipped').length;
  const deliveredCount = (orders || []).filter(o => o.status === 'Delivered').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <AdminPageHeader
        title="Orders &amp; Nationwide Fulfillment"
        description="Monitor multi-vendor checkout orders, assign courier dispatches (Steadfast & Pathao), track deliveries, and manage COD collection."
      />

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pending Orders</span>
          <div className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">In Processing</span>
          <div className="text-2xl font-bold text-blue-700 mt-1">{processingCount}</div>
        </div>
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Out for Delivery</span>
          <div className="text-2xl font-bold text-purple-700 mt-1">{shippedCount}</div>
        </div>
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Delivered</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{deliveredCount}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search Order #, customer, tracking code..."
            className="w-full pl-9.5 pr-4 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black transition-colors"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black transition-colors cursor-pointer"
          >
            <option value="all">All Fulfillment Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped / Dispatched</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <select
            value={courierFilter}
            onChange={(e) => { setCourierFilter(e.target.value); setCurrentPage(1); }}
            className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:border-black transition-colors cursor-pointer"
          >
            <option value="all">All Couriers</option>
            {COURIER_OPTIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-neutral-200/90 rounded-3xl overflow-hidden shadow-xs">
        {paginatedOrders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders found"
            description="No customer orders match your search query or filter selection."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/70 text-xs font-bold uppercase tracking-wider text-neutral-500">
                  <th className="py-4 pl-6 pr-4">Order #</th>
                  <th className="py-4 px-4">Customer &amp; Phone</th>
                  <th className="py-4 px-4">Delivery Area</th>
                  <th className="py-4 px-4">Amount</th>
                  <th className="py-4 px-4">Courier Details</th>
                  <th className="py-4 px-4">Status</th>
                  <th className="py-4 pr-6 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm">
                {paginatedOrders.map((order) => {
                  const itemsCount = (order.items || []).length;
                  const courier = order.courier || order.carrier;
                  const tracking = order.trackingNumber;

                  return (
                    <tr key={order.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Order Number & Items */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="font-mono font-bold text-neutral-900">
                          #{order.orderNumber || order.id?.substring(0, 8)}
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {itemsCount} {itemsCount === 1 ? 'item' : 'items'} · {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Recent'}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-neutral-900">
                          {order.customerName || 'Customer'}
                        </div>
                        <div className="text-xs text-neutral-400">
                          {order.shippingAddress?.phone || order.customerEmail || 'Direct Buyer'}
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="py-4 px-4 text-neutral-600 text-xs">
                        <div className="font-medium text-neutral-800 line-clamp-1">
                          {order.shippingAddress?.city || (order.shippingAddress as any)?.district || 'Dhaka Metro'}
                        </div>
                        <div className="text-neutral-400 line-clamp-1">
                          {order.shippingAddress?.street || (order.shippingAddress as any)?.address || 'Standard Delivery'}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-neutral-900">
                          {formatBDT(order.total || 0)}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-semibold uppercase">
                          {order.paymentMethod || 'COD'}
                        </div>
                      </td>

                      {/* Courier & Tracking */}
                      <td className="py-4 px-4">
                        {courier ? (
                          <div>
                            <div className="text-xs font-semibold text-neutral-800 flex items-center gap-1">
                              <Truck className="w-3.5 h-3.5 text-neutral-500" />
                              <span>{courier}</span>
                            </div>
                            {tracking && (
                              <span className="text-[11px] font-mono text-neutral-500 mt-0.5 block select-all">
                                {tracking}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <StatusBadge status={order.status} />
                      </td>

                      {/* Action */}
                      <td className="py-4 pr-6 pl-4 text-right">
                        <button
                          type="button"
                          onClick={() => openOrderModal(order)}
                          className="px-3.5 py-1.5 rounded-xl border border-neutral-300 hover:border-black bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-800 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-600" />
                          <span>Fulfill</span>
                        </button>
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
              Showing {Math.min(filteredOrders.length, (currentPage - 1) * itemsPerPage + 1)} to{' '}
              {Math.min(filteredOrders.length, currentPage * itemsPerPage)} of {filteredOrders.length} orders
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

      {/* =========================================================================
          ORDER FULFILLMENT & INSPECTION MODAL
         ========================================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full border border-neutral-200 shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">
                  Fulfill Order #{selectedOrder.orderNumber || selectedOrder.id?.substring(0, 8)}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Update fulfillment status, assign courier delivery, and log tracking notes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusUpdate} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Customer & Shipping Details */}
              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                  Delivery Destination
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-neutral-900">{selectedOrder.customerName || 'Customer'}</div>
                      <div className="text-neutral-500">{selectedOrder.customerEmail}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                    <div className="font-mono font-bold text-neutral-900">
                      {selectedOrder.shippingAddress?.phone || 'No phone provided'}
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-start gap-2 border-t border-neutral-200/60 pt-2">
                    <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                    <div className="text-neutral-700">
                      {selectedOrder.shippingAddress?.address || 'Standard Address'},{' '}
                      {selectedOrder.shippingAddress?.city || selectedOrder.shippingAddress?.district || 'Bangladesh'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block">
                  Order Items ({selectedOrder.items?.length || 0})
                </span>
                <div className="border border-neutral-200 rounded-2xl divide-y divide-neutral-100 overflow-hidden">
                  {(selectedOrder.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-neutral-900">{it.productName || it.name}</div>
                        <div className="text-neutral-400">Qty: {it.quantity || 1} · Unit: {formatBDT(it.price || 0)}</div>
                      </div>
                      <div className="font-bold text-neutral-900">
                        {formatBDT((it.price || 0) * (it.quantity || 1))}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-neutral-50 flex items-center justify-between text-xs font-bold text-neutral-900">
                    <span>Total Payable (COD):</span>
                    <span>{formatBDT(selectedOrder.total || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Courier & Status Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    Fulfillment Status *
                  </label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-sm font-semibold focus:outline-none focus:border-black cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing / Packed</option>
                    <option value="Shipped">Shipped / In Transit</option>
                    <option value="Delivered">Delivered (Funds Cleared)</option>
                    <option value="Cancelled">Cancelled / Returned</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    Assigned Courier Service
                  </label>
                  <select
                    value={modalCourier}
                    onChange={(e) => setModalCourier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-sm focus:outline-none focus:border-black cursor-pointer"
                  >
                    {COURIER_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    Courier Consignment / Tracking Code
                  </label>
                  <input
                    type="text"
                    value={modalTracking}
                    onChange={(e) => setModalTracking(e.target.value)}
                    placeholder="e.g. PTH-884920 or STEAD-991823"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-sm font-mono focus:outline-none focus:border-black"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    Internal Fulfillment Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="e.g. Handed to Steadfast rider at Motijheel hub."
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white text-xs focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs sm:text-sm font-bold rounded-xl bg-neutral-900 hover:bg-black text-white shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Updating...' : 'Save Fulfillment Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
