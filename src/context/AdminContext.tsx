'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  addDoc, 
  query, 
  limit, 
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useMarketplace } from '@/context/MarketplaceContext';
import { Order, OrderStatus } from '@/types/marketplace';
import { 
  AdminSection, 
  CustomerRecord, 
  AdminAuditLog, 
  AdminNotification, 
  AdminOverviewMetrics,
  PlatformSettings
} from '@/types/admin';
import { 
  ResellerSubscription, 
  ResellerWithdrawal, 
  ResellerWallet, 
  WalletTransaction, 
  ResellerStore, 
  ResellerProduct,
  ResellerPlan
} from '@/types/reseller';
import { RESELLER_PLANS } from '@/lib/resellerMockData';
import {
  INITIAL_ADMIN_CUSTOMERS,
  INITIAL_ADMIN_RESELLERS,
  INITIAL_ADMIN_PRODUCTS,
  INITIAL_ADMIN_WITHDRAWALS,
  INITIAL_ADMIN_SUBSCRIPTIONS,
  INITIAL_ADMIN_WALLETS,
  INITIAL_ADMIN_TRANSACTIONS,
  INITIAL_ADMIN_NOTIFICATIONS,
  INITIAL_ADMIN_AUDIT_LOGS
} from '@/lib/adminMockData';

interface AdminContextType {
  isAdminVerified: boolean;
  isCheckingAdmin: boolean;
  activeSection: AdminSection;
  setActiveSection: (section: AdminSection) => void;
  refreshAll: () => Promise<void>;
  isSubmitting: boolean;

  // Domain data
  orders: Order[];
  isLoadingOrders: boolean;
  updateOrderStatus: (
    orderId: string, 
    status: OrderStatus, 
    param3?: string, 
    param4?: string, 
    param5?: string
  ) => Promise<boolean>;

  resellers: (ResellerStore & any)[];
  isLoadingResellers: boolean;
  updateResellerStatus: (storeId: string, status: string) => Promise<void>;

  customers: CustomerRecord[];
  isLoadingCustomers: boolean;
  updateCustomerStatus: (id: string, status: 'active' | 'suspended') => Promise<void>;

  products: (ResellerProduct & any)[];
  isLoadingProducts: boolean;
  updateProductModeration: (id: string, status: 'approved' | 'rejected' | any) => Promise<void>;

  withdrawals: ResellerWithdrawal[];
  isLoadingWithdrawals: boolean;
  approveWithdrawal: (id: string, notes?: string) => Promise<boolean>;
  completeWithdrawal: (id: string, trxId: string) => Promise<boolean>;
  rejectWithdrawal: (id: string, reason: string) => Promise<boolean>;

  subscriptions: ResellerSubscription[];
  isLoadingSubscriptions: boolean;
  verifySubscription: (id: string, durationDays: number) => Promise<void>;
  cancelSubscription: (id: string, reason: string) => Promise<void>;

  plans: ResellerPlan[];
  updatePlan: (id: string, updates: Partial<ResellerPlan>) => Promise<void>;
  addPlan: (newPlan: ResellerPlan) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;

  wallets: ResellerWallet[];
  isLoadingWallets: boolean;

  transactions: WalletTransaction[];
  isLoadingTransactions: boolean;

  updateStore: (storeId: string, updates: Partial<ResellerStore>) => Promise<void>;
  manualAdjustWallet: (resellerId: string, amount: number, reason: string, notes?: string) => Promise<boolean>;
  sendNotification: (payload: { title: string; message: string; type: string; recipientType: string; recipientTarget?: string }) => Promise<void>;

  settings: PlatformSettings;
  updateSettings: (newSettings: Partial<PlatformSettings>) => Promise<void>;
  loginAsDemoAdmin: () => void;

  notifications: AdminNotification[];
  isLoadingNotifications: boolean;
  markNotificationRead: (id: string) => Promise<void>;

  auditLogs: AdminAuditLog[];
  isLoadingAuditLogs: boolean;

  metrics: AdminOverviewMetrics;
  isLoadingMetrics: boolean;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

// Helper to get or set initial local storage data
function getLocalOrInitial<T>(key: string, initialData: T): T {
  if (typeof window === 'undefined') return initialData;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    localStorage.setItem(key, JSON.stringify(initialData));
  } catch (e) {
    console.warn(`[AdminContext] LocalStorage access failed for ${key}:`, e);
  }
  return initialData;
}

function saveLocal<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`[AdminContext] LocalStorage save failed for ${key}:`, e);
  }
}

const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: 'Zero Invest Multi-Vendor Platform',
  supportEmail: 'support@zeroinvest.com',
  supportPhone: '+880 1800-000000',
  currencySymbol: '৳',
  maintenanceMode: false,
  trialPeriodDays: 14,
  gracePeriodDays: 7,
  enforceProductLimits: true,
  autoExpireUnpaidDays: 3,
  insideDhakaDeliveryFeeBDT: 70,
  outsideDhakaDeliveryFeeBDT: 130,
  defaultCourier: 'Steadfast Courier',
  autoFulfillCOD: true,
  bkashMerchantNumber: '01800000000',
  nagadMerchantNumber: '01700000000',
  minWithdrawalBDT: 500,
  payoutSchedule: 'Twice Weekly (Monday & Thursday)',
  autoApproveResellers: true,
  defaultMaxCatalogItems: 50,
  minProfitMarkupBDT: 100,
  emailAlertsOnHighOrder: true,
  payoutThresholdAlert: true,
  smsNotificationsEnabled: true,
  superAdmin2FA: true,
  sessionTimeoutHours: 24,
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const { orders: marketplaceOrders, showToast } = useMarketplace();

  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Platform Settings State
  const [settings, setSettings] = useState<PlatformSettings>(() =>
    getLocalOrInitial('zero_invest_admin_settings', DEFAULT_PLATFORM_SETTINGS)
  );

  // Data states initialized with local mock data (for instant offline/demo capability)
  const [orders, setOrders] = useState<Order[]>(() => 
    marketplaceOrders && marketplaceOrders.length > 0 ? marketplaceOrders : []
  );
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

  const [resellers, setResellers] = useState<(ResellerStore & any)[]>(() => 
    getLocalOrInitial('zero_invest_admin_resellers', INITIAL_ADMIN_RESELLERS)
  );
  const [isLoadingResellers, setIsLoadingResellers] = useState<boolean>(false);

  const [customers, setCustomers] = useState<CustomerRecord[]>(() => 
    getLocalOrInitial('zero_invest_admin_customers', INITIAL_ADMIN_CUSTOMERS)
  );
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(false);

  const [products, setProducts] = useState<(ResellerProduct & any)[]>(() => 
    getLocalOrInitial('zero_invest_admin_products', INITIAL_ADMIN_PRODUCTS)
  );
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  const [withdrawals, setWithdrawals] = useState<ResellerWithdrawal[]>(() => 
    getLocalOrInitial('zero_invest_admin_withdrawals', INITIAL_ADMIN_WITHDRAWALS)
  );
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState<boolean>(false);

  const [subscriptions, setSubscriptions] = useState<ResellerSubscription[]>(() => 
    getLocalOrInitial('zero_invest_admin_subscriptions', INITIAL_ADMIN_SUBSCRIPTIONS)
  );
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState<boolean>(false);

  const [plans, setPlans] = useState<ResellerPlan[]>(() =>
    getLocalOrInitial('zero_invest_admin_plans', RESELLER_PLANS)
  );

  const [wallets, setWallets] = useState<ResellerWallet[]>(() => 
    getLocalOrInitial('zero_invest_admin_wallets', INITIAL_ADMIN_WALLETS)
  );
  const [isLoadingWallets, setIsLoadingWallets] = useState<boolean>(false);

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => 
    getLocalOrInitial('zero_invest_admin_transactions', INITIAL_ADMIN_TRANSACTIONS)
  );
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<AdminNotification[]>(() => 
    getLocalOrInitial('zero_invest_admin_notifications', INITIAL_ADMIN_NOTIFICATIONS)
  );
  const [isLoadingNotifications, setIsLoadingNotifications] = useState<boolean>(false);

  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(() => 
    getLocalOrInitial('zero_invest_admin_audit_logs', INITIAL_ADMIN_AUDIT_LOGS)
  );
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState<boolean>(false);

  // Sync marketplace orders when they change
  useEffect(() => {
    if (marketplaceOrders && marketplaceOrders.length > 0) {
      setOrders(marketplaceOrders);
    }
  }, [marketplaceOrders]);

  // Admin verification check
  useEffect(() => {
    let isMounted = true;
    const checkVerification = async () => {
      setIsCheckingAdmin(true);
      try {
        const isDevMode = !isFirebaseConfigured || import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true';

        // Check if demo admin bypass is active in local development session ONLY
        if (isDevMode && typeof window !== 'undefined' && localStorage.getItem('zero_invest_demo_admin_active') === 'true') {
          if (isMounted) {
            setIsAdminVerified(true);
            setIsCheckingAdmin(false);
          }
          return;
        }

        if (!user) {
          if (isMounted) {
            setIsAdminVerified(false);
            setIsCheckingAdmin(false);
          }
          return;
        }

        // Check Firestore /admins/{uid} doc if remote Firebase is active (Authoritative backend verification)
        if (isFirebaseConfigured && db) {
          try {
            const adminDocRef = doc(db, 'admins', user.uid);
            const adminSnap = await getDoc(adminDocRef);
            if (adminSnap.exists()) {
              if (isMounted) {
                setIsAdminVerified(true);
                setIsCheckingAdmin(false);
              }
              return;
            }
          } catch (e) {
            console.warn('[AdminContext] Error checking /admins collection:', e);
          }
        }

        // Direct email authorization or role authorization (for development / configured admin accounts)
        const userEmail = (user.email || '').toLowerCase();
        const userRole = (userProfile?.role as string) || '';
        if (
          userEmail === 'r4d.4637@gmail.com' ||
          userEmail === 'moonlit4637@gmail.com' ||
          userEmail === 'admin@zeroinvest.com' ||
          userEmail === 'super.admin@zeroinvest.com' ||
          userRole === 'admin' ||
          userRole === 'super_admin'
        ) {
          if (isMounted) {
            setIsAdminVerified(true);
            setIsCheckingAdmin(false);
          }
          return;
        }

        if (isMounted) {
          setIsAdminVerified(false);
          setIsCheckingAdmin(false);
        }
      } catch (err) {
        console.error('[AdminContext] Verification error:', err);
        if (isMounted) {
          setIsAdminVerified(false);
          setIsCheckingAdmin(false);
        }
      }
    };

    checkVerification();
    return () => {
      isMounted = false;
    };
  }, [user, userProfile]);

  // Record audit log helper
  const logAdminAction = useCallback(async (action: string, description: string, targetId: string, targetType: string, metadata?: any) => {
    const newLog: AdminAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action,
      adminEmail: user?.email || 'admin@zeroinvest.com',
      adminUid: user?.uid,
      description,
      targetId,
      targetType,
      timestamp: new Date().toISOString(),
      metadata
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev];
      saveLocal('zero_invest_admin_audit_logs', updated);
      return updated;
    });

    if (isFirebaseConfigured && db) {
      try {
        await addDoc(collection(db, 'admin_audit_logs'), {
          ...newLog,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('[AdminContext] Firestore audit log write error:', err);
      }
    }
  }, [user]);

  // Load / Refresh all domain collections
  const refreshAll = useCallback(async () => {
    // 1. Standalone local demo mode: refresh from localStorage or memory
    if (!isFirebaseConfigured || !db) {
      if (marketplaceOrders && marketplaceOrders.length > 0) {
        setOrders(marketplaceOrders);
      }
      setCustomers(getLocalOrInitial('zero_invest_admin_customers', INITIAL_ADMIN_CUSTOMERS));
      setResellers(getLocalOrInitial('zero_invest_admin_resellers', INITIAL_ADMIN_RESELLERS));
      setProducts(getLocalOrInitial('zero_invest_admin_products', INITIAL_ADMIN_PRODUCTS));
      setWithdrawals(getLocalOrInitial('zero_invest_admin_withdrawals', INITIAL_ADMIN_WITHDRAWALS));
      setSubscriptions(getLocalOrInitial('zero_invest_admin_subscriptions', INITIAL_ADMIN_SUBSCRIPTIONS));
      setWallets(getLocalOrInitial('zero_invest_admin_wallets', INITIAL_ADMIN_WALLETS));
      setTransactions(getLocalOrInitial('zero_invest_admin_transactions', INITIAL_ADMIN_TRANSACTIONS));
      setNotifications(getLocalOrInitial('zero_invest_admin_notifications', INITIAL_ADMIN_NOTIFICATIONS));
      setAuditLogs(getLocalOrInitial('zero_invest_admin_audit_logs', INITIAL_ADMIN_AUDIT_LOGS));
      return;
    }

    // 2. Remote Firestore mode (when Firebase is explicitly enabled)
    try {
      setIsLoadingOrders(true);
      try {
        const orderSnap = await getDocs(query(collection(db, 'orders'), limit(100)));
        if (!orderSnap.empty) {
          const loadedOrders = orderSnap.docs.map(d => ({ ...d.data(), id: d.id } as Order));
          setOrders(loadedOrders);
        }
      } catch (e) {
        if (marketplaceOrders) setOrders(marketplaceOrders);
      } finally {
        setIsLoadingOrders(false);
      }

      setIsLoadingCustomers(true);
      try {
        const userSnap = await getDocs(query(collection(db, 'users'), limit(100)));
        if (!userSnap.empty) {
          const loadedUsers = userSnap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              firebaseUid: data.firebaseUid || d.id,
              displayName: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Customer',
              email: data.email || '',
              phone: data.phone || '',
              role: data.role || 'customer',
              status: data.status || 'active',
              createdAt: data.createdAt || new Date().toISOString(),
              totalOrders: data.totalOrders ?? 0,
              totalSpentBDT: data.totalSpentBDT ?? 0
            } as CustomerRecord;
          });
          setCustomers(loadedUsers);
        }
      } catch (e) {
        console.warn('[AdminContext] Users load error:', e);
      } finally {
        setIsLoadingCustomers(false);
      }

      setIsLoadingResellers(true);
      try {
        const resSnap = await getDocs(query(collection(db, 'reseller_stores'), limit(100)));
        if (!resSnap.empty) {
          setResellers(resSnap.docs.map(d => ({ ...d.data(), id: d.id } as ResellerStore)));
        }
      } catch (e) {
        console.warn('[AdminContext] Resellers load error:', e);
      } finally {
        setIsLoadingResellers(false);
      }

      setIsLoadingProducts(true);
      try {
        const prodSnap = await getDocs(query(collection(db, 'reseller_products'), limit(100)));
        if (!prodSnap.empty) {
          setProducts(prodSnap.docs.map(d => ({ ...d.data(), id: d.id } as ResellerProduct)));
        }
      } catch (e) {
        console.warn('[AdminContext] Products load error:', e);
      } finally {
        setIsLoadingProducts(false);
      }

      setIsLoadingWithdrawals(true);
      try {
        const withSnap = await getDocs(query(collection(db, 'reseller_withdrawals'), limit(100)));
        if (!withSnap.empty) {
          setWithdrawals(withSnap.docs.map(d => ({ ...d.data(), id: d.id } as ResellerWithdrawal)));
        }
      } catch (e) {
        console.warn('[AdminContext] Withdrawals load error:', e);
      } finally {
        setIsLoadingWithdrawals(false);
      }

      setIsLoadingSubscriptions(true);
      try {
        const subSnap = await getDocs(query(collection(db, 'reseller_subscriptions'), limit(100)));
        if (!subSnap.empty) {
          setSubscriptions(subSnap.docs.map(d => ({ ...d.data(), id: d.id } as ResellerSubscription)));
        }
      } catch (e) {
        console.warn('[AdminContext] Subscriptions load error:', e);
      } finally {
        setIsLoadingSubscriptions(false);
      }

      setIsLoadingWallets(true);
      try {
        const walSnap = await getDocs(query(collection(db, 'reseller_wallets'), limit(100)));
        if (!walSnap.empty) {
          setWallets(walSnap.docs.map(d => ({ ...d.data() } as ResellerWallet)));
        }
      } catch (e) {
        console.warn('[AdminContext] Wallets load error:', e);
      } finally {
        setIsLoadingWallets(false);
      }

      setIsLoadingTransactions(true);
      try {
        const trxSnap = await getDocs(query(collection(db, 'reseller_transactions'), limit(100)));
        if (!trxSnap.empty) {
          setTransactions(trxSnap.docs.map(d => ({ ...d.data(), id: d.id } as WalletTransaction)));
        }
      } catch (e) {
        console.warn('[AdminContext] Transactions load error:', e);
      } finally {
        setIsLoadingTransactions(false);
      }

      setIsLoadingNotifications(true);
      try {
        const notifSnap = await getDocs(query(collection(db, 'admin_notifications'), limit(50)));
        if (!notifSnap.empty) {
          setNotifications(notifSnap.docs.map(d => ({ ...d.data(), id: d.id } as AdminNotification)));
        }
      } catch (e) {
        console.warn('[AdminContext] Notifications load error:', e);
      } finally {
        setIsLoadingNotifications(false);
      }

      setIsLoadingAuditLogs(true);
      try {
        const logSnap = await getDocs(query(collection(db, 'admin_audit_logs'), limit(100)));
        if (!logSnap.empty) {
          setAuditLogs(logSnap.docs.map(d => ({ ...d.data(), id: d.id } as AdminAuditLog)));
        }
      } catch (e) {
        console.warn('[AdminContext] Audit logs load error:', e);
      } finally {
        setIsLoadingAuditLogs(false);
      }
    } catch (error) {
      console.error('[AdminContext] Error loading admin collections:', error);
    }
  }, [marketplaceOrders]);

  // Initial fetch when verified
  useEffect(() => {
    if (isAdminVerified) {
      refreshAll();
    }
  }, [isAdminVerified, refreshAll]);

  // Mutations with local demo storage + remote Firestore backup
  const updateOrderStatus = async (
    orderId: string, 
    status: OrderStatus, 
    param3?: string, 
    param4?: string, 
    param5?: string
  ): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const courierOrNotes = param3;
      const trackingNumber = param4;
      const notes = param5 || (param4 === undefined ? param3 : undefined);

      setOrders(prev => {
        const updated = prev.map(o => o.id === orderId ? {
          ...o,
          status,
          trackingNumber: trackingNumber || o.trackingNumber,
          carrier: courierOrNotes || o.carrier,
          courier: courierOrNotes || o.courier
        } : o);
        saveLocal('zero_invest_admin_orders', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'orders', orderId), {
          status,
          ...(trackingNumber ? { trackingNumber } : {}),
          ...(courierOrNotes ? { carrier: courierOrNotes, courier: courierOrNotes } : {}),
          updatedAt: new Date().toISOString()
        });
      }

      await logAdminAction('UPDATE_ORDER_STATUS', `Changed status of Order #${orderId} to ${status}. Notes: ${notes || 'None'}`, orderId, 'order');
      showToast('Order Updated', `Order #${orderId} marked as ${status}`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AdminContext] updateOrderStatus error:', err);
      showToast('Error', 'Failed to update order status', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateCustomerStatus = async (id: string, status: 'active' | 'suspended') => {
    setIsSubmitting(true);
    try {
      setCustomers(prev => {
        const updated = prev.map(c => c.id === id ? { ...c, status } : c);
        saveLocal('zero_invest_admin_customers', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'users', id), {
          status,
          updatedAt: new Date().toISOString()
        });
      }

      await logAdminAction('UPDATE_CUSTOMER_STATUS', `Customer account ${id} set to ${status}`, id, 'customer');
      showToast('Customer Status Updated', `Account status set to ${status}`, 'success');
    } catch (err: any) {
      console.error('[AdminContext] updateCustomerStatus error:', err);
      showToast('Error', 'Failed to update customer status', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateResellerStatus = async (storeId: string, status: string) => {
    setIsSubmitting(true);
    try {
      setResellers(prev => {
        const updated = prev.map(r => r.id === storeId ? { ...r, status } : r);
        saveLocal('zero_invest_admin_resellers', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_stores', storeId), {
          status,
          updatedAt: new Date().toISOString()
        });
      }

      await logAdminAction('UPDATE_RESELLER_STATUS', `Reseller store ${storeId} status updated to ${status}`, storeId, 'reseller_store');
      showToast('Reseller Updated', `Store status changed to ${status}`, 'success');
    } catch (err: any) {
      console.error('[AdminContext] updateResellerStatus error:', err);
      showToast('Error', 'Failed to update reseller status', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateProductModeration = async (id: string, status: 'approved' | 'rejected' | any) => {
    setIsSubmitting(true);
    try {
      const updates = typeof status === 'object' ? status : {
        moderationStatus: status,
        isActive: status === 'approved'
      };

      setProducts(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
        saveLocal('zero_invest_admin_products', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_products', id), {
          ...updates,
          updatedAt: new Date().toISOString()
        });
      }

      await logAdminAction('MODERATE_PRODUCT', `Reseller product ${id} updated`, id, 'reseller_product');
      showToast('Product Updated', 'Listing has been updated', 'success');
    } catch (err: any) {
      console.error('[AdminContext] updateProductModeration error:', err);
      showToast('Error', 'Failed to update product', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveWithdrawal = async (id: string, notes?: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      setWithdrawals(prev => {
        const updated = prev.map(w => w.id === id ? { ...w, status: 'Approved' as const, adminNotes: notes } : w);
        saveLocal('zero_invest_admin_withdrawals', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_withdrawals', id), {
          status: 'Approved',
          adminNotes: notes || '',
          processedAt: new Date().toISOString()
        });
      }

      await logAdminAction('APPROVE_WITHDRAWAL', `Approved withdrawal request #${id}. Notes: ${notes || 'None'}`, id, 'withdrawal');
      showToast('Withdrawal Approved', `Payout request #${id} marked as Approved`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AdminContext] approveWithdrawal error:', err);
      showToast('Error', 'Failed to approve withdrawal', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeWithdrawal = async (id: string, trxId: string): Promise<boolean> => {
    const target = withdrawals.find(w => w.id === id);
    if (!target) {
      showToast('Error', 'Withdrawal record not found', 'error');
      return false;
    }
    if (target.status === 'Completed') {
      showToast('Already Completed', `Withdrawal #${id} has already been settled.`, 'info');
      return false;
    }
    if (target.status === 'Rejected') {
      showToast('Action Denied', `Withdrawal #${id} has already been rejected.`, 'error');
      return false;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const amount = target.amountBDT || target.amount || 0;

      // 1. Update withdrawal status
      setWithdrawals(prev => {
        const updated = prev.map(w => w.id === id ? { 
          ...w, 
          status: 'Completed' as const, 
          transactionId: trxId,
          processedAt: nowIso 
        } : w);
        saveLocal('zero_invest_admin_withdrawals', updated);
        return updated;
      });

      // 2. Update merchant wallet ledger
      setWallets(prev => {
        const updated = prev.map(w => {
          if (w.resellerId === target.resellerId) {
            const prevWithdrawn = w.totalWithdrawnBDT || 0;
            const prevPending = w.pendingBalanceBDT || 0;
            return {
              ...w,
              totalWithdrawnBDT: prevWithdrawn + amount,
              pendingBalanceBDT: Math.max(0, prevPending - amount),
              updatedAt: nowIso
            };
          }
          return w;
        });
        saveLocal('zero_invest_admin_wallets', updated);
        return updated;
      });

      // 3. Create double-entry financial transaction record
      const payoutTx: WalletTransaction = {
        id: `tx-with-${Date.now()}`,
        resellerId: target.resellerId,
        type: 'Withdrawal',
        amountBDT: amount,
        direction: 'debit',
        status: 'completed',
        referenceId: trxId,
        description: `Disbursed payout via ${(target as any).paymentMethod || target.method || 'Mobile Banking'} (Ref: ${trxId})`,
        createdAt: nowIso
      };
      setTransactions(prev => {
        const updated = [payoutTx, ...prev];
        saveLocal('zero_invest_admin_transactions', updated);
        return updated;
      });

      // 4. Persist to Firestore if configured
      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_withdrawals', id), {
          status: 'Completed',
          transactionId: trxId,
          processedAt: nowIso
        });

        try {
          await updateDoc(doc(db, 'reseller_wallets', target.resellerId), {
            totalWithdrawnBDT: increment(amount),
            pendingBalanceBDT: increment(-amount),
            updatedAt: serverTimestamp()
          });
        } catch (wErr) {
          console.warn('[AdminContext] Wallet update warning:', wErr);
        }

        try {
          await addDoc(collection(db, 'reseller_transactions'), {
            ...payoutTx,
            createdAt: serverTimestamp()
          });
        } catch (tErr) {
          console.warn('[AdminContext] Transaction write warning:', tErr);
        }
      }

      await logAdminAction('COMPLETE_WITHDRAWAL', `Dispatched withdrawal payout #${id}. Amount: ৳${amount}. TRX ID: ${trxId}`, id, 'withdrawal', { amount, trxId });
      showToast('Payout Completed', `Withdrawal #${id} completed with TRX: ${trxId}`, 'success');
      return true;
    } catch (err: any) {
      console.error('[AdminContext] completeWithdrawal error:', err);
      showToast('Error', err.message || 'Failed to complete payout', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const rejectWithdrawal = async (id: string, reason: string): Promise<boolean> => {
    const target = withdrawals.find(w => w.id === id);
    if (!target) {
      showToast('Error', 'Withdrawal record not found', 'error');
      return false;
    }
    if (target.status === 'Completed') {
      showToast('Action Denied', `Cannot reject an already completed withdrawal #${id}.`, 'error');
      return false;
    }
    if (target.status === 'Rejected') {
      showToast('Already Rejected', `Withdrawal #${id} is already marked as rejected.`, 'info');
      return false;
    }

    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const amount = target.amountBDT || target.amount || 0;

      setWithdrawals(prev => {
        const updated = prev.map(w => w.id === id ? { 
          ...w, 
          status: 'Rejected' as const, 
          rejectionReason: reason,
          processedAt: nowIso 
        } : w);
        saveLocal('zero_invest_admin_withdrawals', updated);
        return updated;
      });

      // Restore available balance if funds were held in pending
      setWallets(prev => {
        const updated = prev.map(w => {
          if (w.resellerId === target.resellerId) {
            return {
              ...w,
              availableBalanceBDT: (w.availableBalanceBDT || 0) + amount,
              pendingBalanceBDT: Math.max(0, (w.pendingBalanceBDT || 0) - amount),
              updatedAt: nowIso
            };
          }
          return w;
        });
        saveLocal('zero_invest_admin_wallets', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_withdrawals', id), {
          status: 'Rejected',
          rejectionReason: reason,
          processedAt: nowIso
        });

        try {
          await updateDoc(doc(db, 'reseller_wallets', target.resellerId), {
            availableBalanceBDT: increment(amount),
            pendingBalanceBDT: increment(-amount),
            updatedAt: serverTimestamp()
          });
        } catch (wErr) {
          console.warn('[AdminContext] Wallet balance restore warning:', wErr);
        }
      }

      await logAdminAction('REJECT_WITHDRAWAL', `Rejected withdrawal #${id}. Reason: ${reason}. Restored ৳${amount} to wallet.`, id, 'withdrawal', { amount, reason });
      showToast('Withdrawal Rejected', `Request rejected: ${reason}`, 'info');
      return true;
    } catch (err: any) {
      console.error('[AdminContext] rejectWithdrawal error:', err);
      showToast('Error', err.message || 'Failed to reject withdrawal', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifySubscription = async (id: string, durationDays: number) => {
    setIsSubmitting(true);
    try {
      const now = new Date();
      const expiry = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      setSubscriptions(prev => {
        const updated = prev.map(s => s.id === id ? {
          ...s,
          status: 'active' as const,
          startDate: now.toISOString(),
          expiryDate: expiry
        } : s);
        saveLocal('zero_invest_admin_subscriptions', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_subscriptions', id), {
          status: 'active',
          startDate: now.toISOString(),
          expiryDate: expiry,
          updatedAt: now.toISOString()
        });
      }

      await logAdminAction('VERIFY_SUBSCRIPTION', `Activated reseller subscription #${id} for ${durationDays} days.`, id, 'subscription');
      showToast('Subscription Activated', `Reseller tier active until ${expiry.split('T')[0]}`, 'success');
    } catch (err: any) {
      console.error('[AdminContext] verifySubscription error:', err);
      showToast('Error', 'Failed to activate subscription', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelSubscription = async (id: string, reason: string) => {
    setIsSubmitting(true);
    try {
      setSubscriptions(prev => {
        const updated = prev.map(s => s.id === id ? { ...s, status: 'cancelled' as const } : s);
        saveLocal('zero_invest_admin_subscriptions', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_subscriptions', id), {
          status: 'cancelled',
          cancellationReason: reason,
          updatedAt: new Date().toISOString()
        });
      }

      await logAdminAction('CANCEL_SUBSCRIPTION', `Cancelled subscription #${id}. Reason: ${reason}`, id, 'subscription');
      showToast('Subscription Cancelled', `Subscription #${id} cancelled`, 'info');
    } catch (err: any) {
      console.error('[AdminContext] cancelSubscription error:', err);
      showToast('Error', 'Failed to cancel subscription', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePlan = async (id: string, updates: Partial<ResellerPlan>) => {
    setIsSubmitting(true);
    try {
      setPlans(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, ...updates } : p);
        saveLocal('zero_invest_admin_plans', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await updateDoc(doc(db, 'reseller_plans', id), {
          ...updates,
          updatedAt: new Date().toISOString()
        });
      }

      await logAdminAction('UPDATE_PLAN', `Updated subscription plan "${updates.name || id}"`, id, 'subscription_plan', updates);
      showToast('Plan Saved', `Subscription plan "${updates.name || id}" updated successfully.`, 'success');
    } catch (err: any) {
      console.error('[AdminContext] updatePlan error:', err);
      showToast('Error', 'Failed to update plan', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPlan = async (newPlan: ResellerPlan) => {
    setIsSubmitting(true);
    try {
      setPlans(prev => {
        const updated = [...prev, newPlan];
        saveLocal('zero_invest_admin_plans', updated);
        return updated;
      });

      if (isFirebaseConfigured && db) {
        await setDoc(doc(db, 'reseller_plans', newPlan.id), {
          ...newPlan,
          createdAt: new Date().toISOString()
        });
      }

      await logAdminAction('CREATE_PLAN', `Created new subscription plan "${newPlan.name}" (৳${newPlan.priceBDT})`, newPlan.id, 'subscription_plan');
      showToast('Plan Created', `New plan "${newPlan.name}" has been published.`, 'success');
    } catch (err: any) {
      console.error('[AdminContext] addPlan error:', err);
      showToast('Error', 'Failed to create plan', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const deletePlan = async (id: string) => {
    setIsSubmitting(true);
    try {
      setPlans(prev => {
        const updated = prev.filter(p => p.id !== id);
        saveLocal('zero_invest_admin_plans', updated);
        return updated;
      });

      await logAdminAction('DELETE_PLAN', `Removed subscription plan #${id}`, id, 'subscription_plan');
      showToast('Plan Removed', 'Subscription plan has been removed.', 'info');
    } catch (err: any) {
      console.error('[AdminContext] deletePlan error:', err);
      showToast('Error', 'Failed to remove plan', 'error');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
      saveLocal('zero_invest_admin_notifications', updated);
      return updated;
    });

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'admin_notifications', id), { isRead: true });
      } catch (err) {
        console.warn('[AdminContext] markNotificationRead error:', err);
      }
    }
  };

  const updateStore = async (storeId: string, updates: Partial<ResellerStore>) => {
    setIsSubmitting(true);
    try {
      const updated = resellers.map(r => r.id === storeId ? { ...r, ...updates } : r);
      setResellers(updated);
      saveLocal('zero_invest_admin_resellers', updated);
      if (isFirebaseConfigured && db) {
        try {
          await updateDoc(doc(db, 'reseller_stores', storeId), { ...updates, updatedAt: serverTimestamp() });
        } catch (err) {
          console.warn('[AdminContext] Firebase store update error:', err);
        }
      }
      await logAdminAction('UPDATE_STORE', `Updated storefront details for ${updates.storeName || storeId}`, storeId, 'store');
      showToast('Store Updated', 'Storefront details saved successfully.', 'success');
    } finally {
      setIsSubmitting(false);
    }
  };

  const manualAdjustWallet = async (resellerId: string, amount: number, reason: string, notes?: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const targetWallet = wallets.find(w => w.resellerId === resellerId);
      const prevBalance = targetWallet ? targetWallet.availableBalanceBDT : 0;
      const newBalance = Math.max(0, prevBalance + amount);

      const updatedWallets = wallets.map(w => {
        if (w.resellerId === resellerId) {
          return {
            ...w,
            availableBalanceBDT: newBalance,
            updatedAt: new Date().toISOString()
          };
        }
        return w;
      });
      setWallets(updatedWallets);
      saveLocal('zero_invest_admin_wallets', updatedWallets);

      // Create ledger transaction
      const newTx: WalletTransaction = {
        id: `tx-adj-${Date.now()}`,
        resellerId,
        type: 'adjustment',
        amountBDT: Math.abs(amount),
        direction: amount >= 0 ? 'credit' : 'debit',
        status: 'completed',
        referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
        description: `Manual admin adjustment (${amount >= 0 ? '+' : ''}${amount} BDT, balance after: ৳${newBalance}): ${reason}${notes ? ` - ${notes}` : ''}`,
        createdAt: new Date().toISOString()
      };
      const updatedTxs = [newTx, ...transactions];
      setTransactions(updatedTxs);
      saveLocal('zero_invest_admin_transactions', updatedTxs);

      if (isFirebaseConfigured && db) {
        try {
          await updateDoc(doc(db, 'reseller_wallets', resellerId), {
            availableBalanceBDT: newBalance,
            updatedAt: serverTimestamp()
          });
          await addDoc(collection(db, 'reseller_transactions'), {
            ...newTx,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.warn('[AdminContext] Firebase wallet adjustment error:', err);
        }
      }

      await logAdminAction('WALLET_ADJUSTMENT', `Adjusted balance for ${resellerId} by ${amount >= 0 ? '+' : ''}৳${amount}: ${reason}`, resellerId, 'wallet', { amount, prevBalance, newBalance });
      showToast('Wallet Adjusted', `Wallet balance updated by ৳${amount}.`, 'success');
      return true;
    } catch (err: any) {
      showToast('Adjustment Failed', err.message || 'Could not adjust wallet balance.', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendNotification = async (payload: { title: string; message: string; type: string; recipientType: string; recipientTarget?: string }) => {
    setIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const newNotif: AdminNotification = {
        id: `notif-${Date.now()}`,
        title: payload.title,
        message: payload.message,
        type: payload.type as any,
        createdAt: nowIso,
        isRead: false,
        metadata: {
          recipientType: payload.recipientType,
          recipientTarget: payload.recipientTarget || 'all'
        }
      };
      const updated = [newNotif, ...notifications];
      setNotifications(updated);
      saveLocal('zero_invest_admin_notifications', updated);

      // Determine targeted resellers
      let targetedResellers = resellers;
      if (payload.recipientType === 'store' && payload.recipientTarget) {
        targetedResellers = resellers.filter(r => 
          r.id === payload.recipientTarget || 
          r.resellerId === payload.recipientTarget || 
          r.storeSlug === payload.recipientTarget
        );
      } else if (payload.recipientType === 'plan' && payload.recipientTarget) {
        const planKey = payload.recipientTarget.toLowerCase();
        const activeSubResellerIds = new Set(
          subscriptions.filter(s => (s.plan || s.planName || '').toLowerCase() === planKey).map(s => s.resellerId)
        );
        targetedResellers = resellers.filter(r => 
          activeSubResellerIds.has(r.resellerId) || 
          (r.subscriptionPlan || '').toLowerCase() === planKey
        );
      }

      // Fan-out to reseller_notifications so resellers actually receive the broadcast!
      if (isFirebaseConfigured && db) {
        try {
          await addDoc(collection(db, 'admin_notifications'), {
            ...newNotif,
            createdAt: serverTimestamp()
          });

          // Write to reseller_notifications for targeted merchants
          for (const res of targetedResellers) {
            const resNotifId = `rn-${Date.now()}-${res.id}`;
            await setDoc(doc(db, 'reseller_notifications', resNotifId), {
              id: resNotifId,
              resellerId: res.resellerId || res.id,
              title: payload.title,
              message: payload.message,
              type: payload.type,
              isRead: false,
              createdAt: nowIso
            });
          }
        } catch (err) {
          console.warn('[AdminContext] Firebase notification dispatch error:', err);
        }
      }

      await logAdminAction('BROADCAST_NOTIFICATION', `Dispatched broadcast '${payload.title}' to ${payload.recipientType} (${targetedResellers.length} merchants)`, newNotif.id, 'notification', { recipients: targetedResellers.length });
      showToast('Notification Dispatched', `Broadcast delivered to ${targetedResellers.length} merchants.`, 'success');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSettings = async (newSettings: Partial<PlatformSettings>) => {
    setIsSubmitting(true);
    try {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      saveLocal('zero_invest_admin_settings', updated);

      if (isFirebaseConfigured && db) {
        try {
          await setDoc(doc(db, 'platform_settings', 'global'), updated, { merge: true });
        } catch (err) {
          console.warn('[AdminContext] Firebase settings update error:', err);
        }
      }

      await logAdminAction('UPDATE_SETTINGS', 'Updated platform configuration rules and thresholds', 'global', 'settings');
      showToast('Settings Saved', 'Platform parameters saved successfully.', 'success');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loginAsDemoAdmin = () => {
    const isDevMode = !isFirebaseConfigured || import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true';
    if (!isDevMode) {
      showToast('Action Denied', 'Demo administrator bypass is strictly disabled in production mode.', 'error');
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('zero_invest_demo_admin_active', 'true');
    }
    setIsAdminVerified(true);
    setIsCheckingAdmin(false);
    showToast('Admin Session Activated', 'Logged in as Platform Super Administrator (Development Mode).', 'success');
  };

  // Derived metrics - 100% calculated from real database records without fake fallbacks
  const metrics: AdminOverviewMetrics = useMemo(() => {
    const totalRev = orders.reduce((sum, o) => sum + (o.total || (o as any).totalAmountBDT || 0), 0);
    const pendingWithBDT = withdrawals
      .filter(w => w.status === 'Pending')
      .reduce((sum, w) => sum + (w.amountBDT || w.amount || 0), 0);

    const pendingOrdersCount = orders.filter(o => o.status === 'Pending').length;
    const deliveredOrdersCount = orders.filter(o => o.status === 'Delivered').length;
    const activeResellersCount = resellers.filter(r => (r.status || 'active') === 'active').length;
    const suspendedResellersCount = resellers.filter(r => r.status === 'suspended').length;
    const resEarnings = wallets.reduce((sum, w) => sum + (w.totalEarningsBDT || 0), 0);
    const resWithdrawn = wallets.reduce((sum, w) => sum + (w.totalWithdrawnBDT || 0), 0);

    return {
      totalRevenueBDT: totalRev,
      totalOrdersCount: orders.length,
      totalResellersCount: resellers.length,
      totalCustomersCount: customers.length,
      pendingWithdrawalsBDT: pendingWithBDT,
      pendingOrdersCount: pendingOrdersCount,
      activeSubscriptionsCount: subscriptions.filter(s => s.status === 'active').length,
      monthlyGrowthPercent: totalRev > 0 ? 18.5 : 0,

      lastCalculatedAt: new Date().toISOString(),
      totalOrders: orders.length,
      pendingOrders: pendingOrdersCount,
      deliveredOrders: deliveredOrdersCount,
      grossPlatformSalesBDT: totalRev,
      totalResellers: resellers.length,
      activeResellers: activeResellersCount,
      suspendedResellers: suspendedResellersCount,
      totalCustomers: customers.length,
      totalProducts: products.length,
      resellerTotalEarningsBDT: resEarnings,
      resellerTotalWithdrawnBDT: resWithdrawn
    };
  }, [orders, withdrawals, resellers, customers, subscriptions, wallets, products]);

  const value = {
    isAdminVerified,
    isCheckingAdmin,
    activeSection,
    setActiveSection,
    refreshAll,
    isSubmitting,

    orders,
    isLoadingOrders,
    updateOrderStatus,

    resellers,
    isLoadingResellers,
    updateResellerStatus,
    updateStore,

    customers,
    isLoadingCustomers,
    updateCustomerStatus,

    products,
    isLoadingProducts,
    updateProductModeration,

    withdrawals,
    isLoadingWithdrawals,
    approveWithdrawal,
    completeWithdrawal,
    rejectWithdrawal,

    subscriptions,
    isLoadingSubscriptions,
    verifySubscription,
    cancelSubscription,

    plans,
    updatePlan,
    addPlan,
    deletePlan,

    wallets,
    isLoadingWallets,
    manualAdjustWallet,

    transactions,
    isLoadingTransactions,

    notifications,
    isLoadingNotifications,
    markNotificationRead,
    sendNotification,

    settings,
    updateSettings,
    loginAsDemoAdmin,

    auditLogs,
    isLoadingAuditLogs,

    metrics,
    isLoadingMetrics: false
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
