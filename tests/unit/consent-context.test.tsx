import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConsentProvider, useConsent } from '../../src/store/ConsentContext';
import { buildConsent, loadConsent, saveConsent } from '../../src/lib/consent';
import { LEGAL_VERSION } from '../../src/data/legal';

type Api = ReturnType<typeof useConsent>;

function renderConsent() {
  const ref: { current: Api | null } = { current: null };
  function Probe() {
    ref.current = useConsent();
    return null;
  }
  render(
    <ConsentProvider>
      <Probe />
    </ConsentProvider>,
  );
  return () => {
    if (!ref.current) throw new Error('El provider no se montó');
    return ref.current;
  };
}

const obligatorias = { terms: true, dataProcessing: true, marketing: false };

describe('ConsentProvider', () => {
  it('arranca sin consentimiento en la primera visita', () => {
    const api = renderConsent();
    expect(api().consent).toBeNull();
    expect(api().hasConsent).toBe(false);
  });

  it('recupera el consentimiento ya otorgado', () => {
    saveConsent(buildConsent(obligatorias));
    const api = renderConsent();
    expect(api().hasConsent).toBe(true);
    expect(api().consent?.version).toBe(LEGAL_VERSION);
  });

  it('vuelve a pedir autorización si cambió la versión legal', () => {
    saveConsent({ ...buildConsent(obligatorias), version: '0.1' });
    const api = renderConsent();
    expect(api().consent).not.toBeNull();
    expect(api().hasConsent).toBe(false);
  });

  it('accept registra y persiste la autorización', () => {
    const api = renderConsent();
    act(() => { api().accept({ terms: true, dataProcessing: true, marketing: true }, { email: 'cliente1@reverde.com' }); });

    expect(api().hasConsent).toBe(true);
    expect(api().consent).toMatchObject({ marketing: true, subject: { email: 'cliente1@reverde.com' } });
    expect(loadConsent()?.acceptedAt).toBe(api().consent?.acceptedAt);
  });

  it('aceptar solo las obligatorias habilita el uso sin comunicaciones comerciales', () => {
    const api = renderConsent();
    act(() => { api().accept(obligatorias); });
    expect(api().hasConsent).toBe(true);
    expect(api().consent?.marketing).toBe(false);
  });

  it('no habilita el uso si falta una casilla obligatoria', () => {
    const api = renderConsent();
    act(() => { api().accept({ terms: true, dataProcessing: false, marketing: true }); });
    expect(api().hasConsent).toBe(false);
  });

  it('setMarketing cambia solo la finalidad opcional y deja rastro', () => {
    const api = renderConsent();
    act(() => { api().accept(obligatorias); });
    act(() => api().setMarketing(true));

    expect(api().consent?.marketing).toBe(true);
    expect(api().hasConsent).toBe(true);
    expect(api().consent?.log.at(-1)).toMatchObject({ action: 'actualizado' });
    expect(api().consent?.log.at(-1)?.detail).toContain('Autorizó');
    expect(loadConsent()?.marketing).toBe(true);

    act(() => api().setMarketing(false));
    expect(api().consent?.log.at(-1)?.detail).toContain('Retiró');
  });

  it('setMarketing no hace nada si no hay consentimiento previo', () => {
    const api = renderConsent();
    act(() => api().setMarketing(true));
    expect(api().consent).toBeNull();
  });

  it('revoke elimina la autorización y su registro', () => {
    const api = renderConsent();
    act(() => { api().accept(obligatorias); });
    act(() => api().revoke());

    expect(api().consent).toBeNull();
    expect(api().hasConsent).toBe(false);
    expect(loadConsent()).toBeNull();
  });

  it('reautorizar tras revocar reabre la bitácora', () => {
    const api = renderConsent();
    act(() => { api().accept(obligatorias); });
    act(() => api().revoke());
    act(() => { api().accept(obligatorias); });
    expect(api().consent?.log.at(-1)?.action).toBe('otorgado');
  });

  it('useConsent exige estar dentro del provider', () => {
    function Suelto() {
      useConsent();
      return null;
    }
    expect(() => render(<Suelto />)).toThrow(/ConsentProvider/);
  });
});
