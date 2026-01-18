// client/src/lib/purchases.ts
//
// RevenueCat integration for Capacitor
// Native-only — web builds must not crash

import { Capacitor } from "@capacitor/core";

// ============================================
// Constants
// ============================================

export const ENTITLEMENT_ID = "premium";

// ============================================
// Types
// ============================================

export interface Package {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price: number;
    currencyCode: string;
  };
}

export interface CustomerInfo {
  entitlements: {
    active: Record<string, {
      identifier: string;
      isActive: boolean;
      willRenew: boolean;
      expirationDate: string | null;
    }>;
  };
  activeSubscriptions: string[];
  originalAppUserId: string;
}

export interface Offering {
  identifier: string;
  availablePackages: Package[];
  monthly?: Package;
  annual?: Package;
  lifetime?: Package;
}

// ============================================
// Platform check
// ============================================

export function isNativePlatform(): boolean {
  const isNative = Capacitor.isNativePlatform();
  console.log("[Purchases] isNativePlatform check:", isNative, "platform:", Capacitor.getPlatform());
  return isNative;
}

export function getPlatform(): "ios" | "android" | "web" {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return "ios";
  if (platform === "android") return "android";
  return "web";
}

// ============================================
// RevenueCat SDK (lazy loaded for native only)
// ============================================

let Purchases: typeof import("@revenuecat/purchases-capacitor").Purchases | null = null;
let LOG_LEVEL: typeof import("@revenuecat/purchases-capacitor").LOG_LEVEL | null = null;

async function loadPurchasesSDK() {
  console.log("[Purchases] loadPurchasesSDK called");
  
  if (!Capacitor.isNativePlatform()) {
    console.log("[Purchases] loadPurchasesSDK - not native, returning null");
    return null;
  }
  
  if (!Purchases) {
    console.log("[Purchases] loadPurchasesSDK - importing module...");
    try {
      const module = await import("@revenuecat/purchases-capacitor");
      Purchases = module.Purchases;
      LOG_LEVEL = module.LOG_LEVEL;
      console.log("[Purchases] loadPurchasesSDK - module imported successfully, Purchases:", !!Purchases);
    } catch (error) {
      console.error("[Purchases] loadPurchasesSDK - import failed:", error);
      return null;
    }
  } else {
    console.log("[Purchases] loadPurchasesSDK - Purchases already loaded");
  }
  
  console.log("[Purchases] loadPurchasesSDK - returning Purchases:", !!Purchases);
  return Purchases;
}

// ============================================
// Initialization
// ============================================

let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

export async function initializePurchases(): Promise<boolean> {
  console.log("[Purchases] initializePurchases called");
  console.log("[Purchases] Capacitor.isNativePlatform():", Capacitor.isNativePlatform());
  console.log("[Purchases] Capacitor.getPlatform():", Capacitor.getPlatform());
  
  if (!Capacitor.isNativePlatform()) {
    console.log("[Purchases] Skipping init — not on native platform");
    return false;
  }

  if (isInitialized) {
    console.log("[Purchases] Already initialized");
    return true;
  }

  // If initialization is already in progress, wait for it
  if (initializationPromise) {
    console.log("[Purchases] Initialization already in progress, waiting...");
    return initializationPromise;
  }

  // Start initialization
  initializationPromise = doInitialize();
  const result = await initializationPromise;
  initializationPromise = null;
  return result;
}

async function doInitialize(): Promise<boolean> {
  console.log("[Purchases] doInitialize starting...");
  
  console.log("[Purchases] Loading SDK...");
  let SDK;
  try {
    console.log("[Purchases] About to await loadPurchasesSDK...");
    SDK = await loadPurchasesSDK();
    console.log("[Purchases] loadPurchasesSDK returned, SDK exists:", !!SDK);
  } catch (loadError) {
    console.error("[Purchases] loadPurchasesSDK threw error:", loadError);
    return false;
  }
  
  if (!SDK) {
    console.error("[Purchases] Failed to load SDK - SDK is null");
    return false;
  }

  const platform = getPlatform();
  const apiKey = platform === "ios"
    ? import.meta.env.VITE_REVENUECAT_IOS_API_KEY
    : import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;

  console.log("[Purchases] Platform:", platform);
  console.log("[Purchases] API Key exists:", !!apiKey);
  console.log("[Purchases] API Key prefix:", apiKey?.substring(0, 10) + "...");

  if (!apiKey) {
    console.error(`[Purchases] Missing API key for ${platform}`);
    return false;
  }

  try {
    // Enable debug logs
    if (LOG_LEVEL) {
      console.log("[Purchases] Setting log level to DEBUG");
      await SDK.setLogLevel({ level: LOG_LEVEL.DEBUG });
    }

    console.log("[Purchases] Calling SDK.configure...");
    await SDK.configure({
      apiKey,
    });

    isInitialized = true;
    console.log("[Purchases] Initialized successfully");
    return true;
  } catch (error) {
    console.error("[Purchases] Init failed:", error);
    return false;
  }
}

// ============================================
// User identification
// ============================================

export async function loginUser(userId: string): Promise<CustomerInfo | null> {
  console.log("[Purchases] loginUser called for:", userId);
  
  if (!Capacitor.isNativePlatform()) {
    console.log("[Purchases] loginUser - not native platform");
    return null;
  }

  const SDK = await loadPurchasesSDK();
  if (!SDK) {
    console.log("[Purchases] loginUser - SDK not loaded");
    return null;
  }

  try {
    console.log("[Purchases] loginUser - calling SDK.logIn...");
    const { customerInfo } = await SDK.logIn({ appUserID: userId });
    console.log("[Purchases] loginUser - success, customerInfo:", customerInfo);
    return customerInfo as CustomerInfo;
  } catch (error) {
    console.error("[Purchases] Login failed:", error);
    return null;
  }
}

export async function logoutUser(): Promise<CustomerInfo | null> {
  console.log("[Purchases] logoutUser called");
  
  if (!Capacitor.isNativePlatform()) return null;

  const SDK = await loadPurchasesSDK();
  if (!SDK) return null;

  try {
    const { customerInfo } = await SDK.logOut();
    console.log("[Purchases] logoutUser - success");
    return customerInfo as CustomerInfo;
  } catch (error) {
    console.error("[Purchases] Logout failed:", error);
    return null;
  }
}

// ============================================
// Customer info & entitlements
// ============================================

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  console.log("[Purchases] getCustomerInfo called");
  
  if (!Capacitor.isNativePlatform()) {
    console.log("[Purchases] getCustomerInfo - not native platform");
    return null;
  }

  const SDK = await loadPurchasesSDK();
  if (!SDK) {
    console.log("[Purchases] getCustomerInfo - SDK not loaded");
    return null;
  }

  try {
    console.log("[Purchases] getCustomerInfo - calling SDK.getCustomerInfo...");
    const { customerInfo } = await SDK.getCustomerInfo();
    console.log("[Purchases] getCustomerInfo - success:", customerInfo);
    return customerInfo as CustomerInfo;
  } catch (error) {
    console.error("[Purchases] Get customer info failed:", error);
    return null;
  }
}

export function hasEntitlement(customerInfo: CustomerInfo | null, entitlementId: string = ENTITLEMENT_ID): boolean {
  if (!customerInfo) return false;
  
  const entitlement = customerInfo.entitlements?.active?.[entitlementId];
  return entitlement?.isActive === true;
}

// ============================================
// Offerings & packages
// ============================================

export async function getCurrentOffering(): Promise<Offering | null> {
  console.log("[Purchases] getCurrentOffering called");
  
  if (!Capacitor.isNativePlatform()) {
    console.log("[Purchases] getCurrentOffering - not native platform");
    return null;
  }

  // Ensure SDK is initialized first
  if (!isInitialized) {
    console.log("[Purchases] getCurrentOffering - SDK not initialized, initializing now...");
    const initResult = await initializePurchases();
    if (!initResult) {
      console.error("[Purchases] getCurrentOffering - initialization failed");
      return null;
    }
  }

  const SDK = await loadPurchasesSDK();
  if (!SDK) {
    console.log("[Purchases] getCurrentOffering - SDK not loaded");
    return null;
  }

  try {
    console.log("[Purchases] getCurrentOffering - calling SDK.getOfferings...");
    const offerings = await SDK.getOfferings() as any;
    console.log("[Purchases] getCurrentOffering - raw offerings:", JSON.stringify(offerings));
    console.log("[Purchases] getCurrentOffering - current offering:", offerings?.current);
    return offerings?.current as Offering | null;
  } catch (error) {
    console.error("[Purchases] Get offerings failed:", error);
    return null;
  }
}

// ============================================
// Purchases
// ============================================

export async function purchasePackage(pkg: Package): Promise<{
  success: boolean;
  customerInfo: CustomerInfo | null;
  error?: string;
}> {
  console.log("[Purchases] purchasePackage called for:", pkg.identifier);
  
  if (!Capacitor.isNativePlatform()) {
    return { success: false, customerInfo: null, error: "Not on native platform" };
  }

  const SDK = await loadPurchasesSDK();
  if (!SDK) {
    return { success: false, customerInfo: null, error: "SDK not loaded" };
  }

  try {
    console.log("[Purchases] purchasePackage - calling SDK.purchasePackage...");
    const { customerInfo } = await SDK.purchasePackage({
      aPackage: pkg as any,
    });
    
    console.log("[Purchases] purchasePackage - success");
    return {
      success: true,
      customerInfo: customerInfo as CustomerInfo,
    };
  } catch (error: any) {
    // User cancelled
    if (error?.code === "1" || error?.userCancelled) {
      console.log("[Purchases] purchasePackage - user cancelled");
      return { success: false, customerInfo: null, error: "cancelled" };
    }
    
    console.error("[Purchases] Purchase failed:", error);
    return {
      success: false,
      customerInfo: null,
      error: error?.message || "Purchase failed",
    };
  }
}

// ============================================
// Restore purchases
// ============================================

export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo: CustomerInfo | null;
  error?: string;
}> {
  console.log("[Purchases] restorePurchases called");
  
  if (!Capacitor.isNativePlatform()) {
    return { success: false, customerInfo: null, error: "Not on native platform" };
  }

  const SDK = await loadPurchasesSDK();
  if (!SDK) {
    return { success: false, customerInfo: null, error: "SDK not loaded" };
  }

  try {
    console.log("[Purchases] restorePurchases - calling SDK.restorePurchases...");
    const { customerInfo } = await SDK.restorePurchases();
    console.log("[Purchases] restorePurchases - success");
    return {
      success: true,
      customerInfo: customerInfo as CustomerInfo,
    };
  } catch (error: any) {
    console.error("[Purchases] Restore failed:", error);
    return {
      success: false,
      customerInfo: null,
      error: error?.message || "Restore failed",
    };
  }
}

// ============================================
// Listener for customer info updates
// ============================================

export async function addCustomerInfoListener(
  callback: (customerInfo: CustomerInfo) => void
): Promise<(() => void) | null> {
  console.log("[Purchases] addCustomerInfoListener called");
  
  if (!Capacitor.isNativePlatform()) return null;

  const SDK = await loadPurchasesSDK();
  if (!SDK) return null;

  try {
    // The listener callback receives { customerInfo: CustomerInfo }
    // The returned handle has a remove() method
    const handle = await SDK.addCustomerInfoUpdateListener((info: any) => {
      console.log("[Purchases] Customer info update received");
      callback(info.customerInfo as CustomerInfo);
    });
    
    // Return cleanup function
    return () => {
      (handle as any)?.remove?.();
    };
  } catch (error) {
    console.error("[Purchases] Failed to add listener:", error);
    return null;
  }
}