import { createContext, useContext } from "react";

// HeaderLayout wraps every authenticated route and already owns the single
// canonical fetch of /me/wallet and /me/hearts (plus the SSE connection and
// hay_wallet/hay_hearts event listeners that keep them live). Page-level
// components (e.g. Dashboard's KpiStrip/ChestCard) used to each fetch the
// same endpoints again on mount, sending duplicate requests. Consuming this
// context instead means there is exactly one fetch per session, not one per
// component that happens to need gems/hearts/chests.
export const WalletContext = createContext({ gems: null, chests: 0, hearts: null });

export function useWallet() {
  return useContext(WalletContext);
}
