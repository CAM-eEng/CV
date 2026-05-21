import { useState, useEffect } from 'react';
import { ConnectSheet } from './ConnectSheet';
import { ProviderStatus } from './ProviderStatus';
import { readSession, SESSION_CHANGED_EVENT, REQUEST_CONNECT_EVENT } from '~/lib/ai/session';

export function ConnectBar() {
  const [hasSession, setHasSession] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setHasSession(readSession() !== null);
      setTick((t) => t + 1);
    };
    refresh();
    window.addEventListener(SESSION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const open = () => setSheetOpen(true);
    window.addEventListener(REQUEST_CONNECT_EVENT, open);
    return () => window.removeEventListener(REQUEST_CONNECT_EVENT, open);
  }, []);

  return (
    <>
      {hasSession ? (
        <ProviderStatus key={tick} onChange={() => setHasSession(false)} />
      ) : (
        <button
          onClick={() => setSheetOpen(true)}
          className="shrink-0 px-3 py-1.5 rounded-md bg-neutral-900 dark:bg-neutral-100 text-neutral-100 dark:text-neutral-900 text-sm font-medium hover:opacity-90"
        >
          Connect ▸
        </button>
      )}
      <ConnectSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConnected={() => setSheetOpen(false)}
      />
    </>
  );
}
