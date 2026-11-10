import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setAnalyticsConsent } from '../lib/analytics';
import {
  buildConsent,
  clearConsent,
  isConsentValid,
  loadConsent,
  saveConsent,
  type ConsentChoices,
  type ConsentRecord,
} from '../lib/consent';

interface ConsentApi {
  consent: ConsentRecord | null;
  /** El titular autorizó las dos casillas obligatorias en la versión vigente. */
  hasConsent: boolean;
  /** Registra la autorización inicial o una nueva versión de la misma. */
  accept: (choices: ConsentChoices, subject?: ConsentRecord['subject']) => ConsentRecord;
  /** Cambia solo la finalidad opcional de comunicaciones comerciales. */
  setMarketing: (value: boolean) => void;
  /** Revoca la autorización y elimina el registro del consentimiento. */
  revoke: () => void;
}

const ConsentContext = createContext<ConsentApi | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentRecord | null>(() => loadConsent());

  const accept = useCallback<ConsentApi['accept']>((choices, subject) => {
    const record = buildConsent(choices, subject, loadConsent());
    saveConsent(record);
    setConsent(record);
    return record;
  }, []);

  const setMarketing = useCallback((value: boolean) => {
    setConsent((prev) => {
      if (!prev) return prev;
      const at = new Date().toISOString();
      const next: ConsentRecord = {
        ...prev,
        marketing: value,
        log: [
          ...prev.log,
          {
            at,
            action: 'actualizado',
            detail: value
              ? 'Autorizó el envío de comunicaciones comerciales.'
              : 'Retiró la autorización de comunicaciones comerciales.',
            version: prev.version,
          },
        ],
      };
      saveConsent(next);
      return next;
    });
  }, []);

  const revoke = useCallback(() => {
    clearConsent();
    setConsent(null);
  }, []);

  const hasConsent = isConsentValid(consent);

  /**
   * La medición de producto sigue a la autorización del titular: sin
   * consentimiento vigente no se registra ningún evento, y al revocarlo se
   * apaga de inmediato (Ley 1581 de 2012). Ver src/lib/analytics.ts.
   */
  useEffect(() => {
    setAnalyticsConsent(hasConsent);
  }, [hasConsent]);

  const value = useMemo<ConsentApi>(
    () => ({ consent, hasConsent, accept, setMarketing, revoke }),
    [consent, hasConsent, accept, setMarketing, revoke],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConsent(): ConsentApi {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent debe usarse dentro de <ConsentProvider>');
  return ctx;
}
