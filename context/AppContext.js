import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  authApi,
  cartApi,
  clearSession,
  getStoredRefreshToken,
  notificationApi,
  saveSession,
  setSessionExpiredHandler,
  userApi,
} from "../services/api";
import { registerForPush, unregisterPush } from "../services/push";

const AppContext = createContext(null);

const EMPTY_CART = { items: [], summary: null, warnings: [] };

/**
 * Uygulama genel durumu: oturum, sunucudaki sepet ve okunmamış bildirim sayısı.
 * Sepet tek doğru kaynak olarak sunucuda tutulur; cihaz değişse de kaybolmaz.
 */
export function AppProvider({ children }) {
  const [status, setStatus] = useState("loading"); // loading | offline | signedOut | signedIn
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(EMPTY_CART);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const resetLocalState = useCallback(() => {
    setUser(null);
    setCart(EMPTY_CART);
    setUnreadNotifications(0);
    setStatus("signedOut");
  }, []);

  const refreshCart = useCallback(async () => {
    const data = await cartApi.get();
    setCart(data);
    return data;
  }, []);

  const refreshUnread = useCallback(async () => {
    const data = await notificationApi.list(1);
    setUnreadNotifications(data.unreadCount);
  }, []);

  const afterSignIn = useCallback(
    async (signedInUser) => {
      setUser(signedInUser);
      setStatus("signedIn");
      refreshCart().catch(() => {});
      refreshUnread().catch(() => {});
      registerForPush().catch(() => {});
    },
    [refreshCart, refreshUnread],
  );

  // Açılışta kayıtlı oturumu geri yükle. Ağ yoksa oturum silinmez, "offline" durumunda tekrar denenir.
  const bootstrap = useCallback(async () => {
    setStatus("loading");
    if (!(await getStoredRefreshToken())) return setStatus("signedOut");
    try {
      const { user: me } = await userApi.me();
      await afterSignIn(me);
    } catch (e) {
      if (e?.status === 401) {
        await clearSession();
        setStatus("signedOut");
      } else {
        setStatus("offline");
      }
    }
  }, [afterSignIn]);

  useEffect(() => {
    setSessionExpiredHandler(resetLocalState);
    bootstrap();
  }, [bootstrap, resetLocalState]);

  const signIn = useCallback(
    async (email, password) => {
      const data = await authApi.login(email, password);
      await saveSession(data);
      await afterSignIn(data.user);
    },
    [afterSignIn],
  );

  const signUp = useCallback(
    async (form) => {
      const data = await authApi.register(form);
      await saveSession(data);
      await afterSignIn(data.user);
    },
    [afterSignIn],
  );

  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => {});
    const refreshToken = await getStoredRefreshToken();
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    await clearSession();
    resetLocalState();
  }, [resetLocalState]);

  const deleteAccount = useCallback(
    async (password) => {
      await userApi.deleteAccount(password);
      await clearSession();
      resetLocalState();
    },
    [resetLocalState],
  );

  const refreshUser = useCallback(async () => {
    const { user: me } = await userApi.me();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(() => {
    const cartItems = cart.items.map((i) => ({ ...i.product, quantity: i.quantity, lineTotal: i.lineTotal }));
    return {
      status,
      user,
      cart,
      unreadNotifications,
      // Mevcut ekranlarla uyumlu kısayollar
      state: { user, isLoggedIn: status === "signedIn", cartItems, cartCount: cart.summary?.itemCount ?? 0 },
      actions: {
        bootstrap,
        signIn,
        signUp,
        signOut,
        deleteAccount,
        refreshUser,
        setUser,
        refreshCart,
        refreshUnread,
        setUnreadNotifications,
        addToCart: async (productId, quantity = 1) => setCart(await cartApi.add(productId, quantity)),
        updateCartQuantity: async (productId, quantity) => setCart(await cartApi.setQuantity(productId, quantity)),
        removeFromCart: async (productId) => setCart(await cartApi.remove(productId)),
        clearCart: async () => setCart(await cartApi.clear()),
      },
    };
  }, [
    status,
    user,
    cart,
    unreadNotifications,
    bootstrap,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    refreshUser,
    refreshCart,
    refreshUnread,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}

export default AppContext;
