import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ReportDialog } from '../components/ReportDialog';

/**
 * Canal de reporte disponible en toda la aplicación.
 *
 * Vive en la raíz para que cualquier pantalla pueda abrirlo con
 * `useReport().open()` sin tener que cargar con el estado del diálogo. Antes
 * el canal solo existía como una tarjeta dentro del perfil del cliente: quien
 * administraba un establecimiento no tenía dónde reportar nada.
 */
interface ReportApi {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<ReportApi | null>(null);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const api = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <ReportDialog open={isOpen} onClose={close} />
    </Ctx.Provider>
  );
}

/**
 * Fuera del provider devuelve una API inerte en vez de reventar: un canal de
 * reporte que tumba la pantalla al abrirlo sería una broma de mal gusto.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useReport(): ReportApi {
  return useContext(Ctx) ?? { open: () => {}, close: () => {}, isOpen: false };
}
