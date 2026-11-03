/**
 * Marco legal de Reverde (Colombia).
 *
 * Contiene los textos de Términos y Condiciones, Política de Tratamiento de
 * Datos Personales y la Autorización de Habeas Data que el titular acepta
 * antes de usar la plataforma, conforme a la Ley 1581 de 2012, el Decreto
 * 1074 de 2015 y los artículos 15 y 20 de la Constitución Política.
 *
 * ⚠️ DATOS POR COMPLETAR ANTES DE PRODUCCIÓN: los campos de `RESPONSABLE`
 * (NIT, dirección, correo y teléfono) son marcadores del prototipo. Deben
 * reemplazarse por los datos reales de la entidad responsable del
 * tratamiento; de lo contrario los canales de atención al titular que exige
 * el artículo 17 de la Ley 1581 de 2012 no son efectivos.
 */

/** Versión del paquete legal. Súbela cada vez que cambie algún texto: los
 *  consentimientos otorgados con una versión anterior se vuelven a solicitar. */
export const LEGAL_VERSION = '1.0';

/** Fecha de la última actualización, visible en cada documento. */
export const LEGAL_UPDATED_AT = '3 de noviembre de 2026';

/** Meses que conservamos los datos tras la última interacción del titular. */
export const RETENTION_MONTHS = 24;

export const RESPONSABLE = {
  name: 'Reverde',
  legalName: 'Reverde S.A.S. (prototipo académico)',
  nit: 'NIT por definir',
  address: 'Bogotá D.C., Colombia',
  email: 'privacidad@reverde.com',
  phone: '+57 (601) 000 0000',
  hours: 'Lunes a viernes, 8:00 a.m. a 5:00 p.m.',
} as const;

/* ── Estructura de los documentos ──────────────────────────────────────── */

export interface LegalBlock {
  kind: 'p' | 'ul' | 'ol' | 'note';
  text?: string;
  items?: string[];
}

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export type LegalSlug = 'terminos' | 'privacidad' | 'habeas-data';

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  /** Resumen de una línea para encabezados y tarjetas. */
  summary: string;
  sections: LegalSection[];
}

/* ── Finalidades del tratamiento ───────────────────────────────────────────
 * Lista única: se muestra en la autorización, en la política y en el perfil,
 * para que el titular vea siempre las mismas finalidades autorizadas.
 * ────────────────────────────────────────────────────────────────────────── */

export const PURPOSES: { id: string; label: string; detail: string }[] = [
  {
    id: 'cuenta',
    label: 'Crear y administrar tu cuenta',
    detail: 'Identificarte, autenticarte y asociar tu rol (establecimiento, cliente o administrador).',
  },
  {
    id: 'pedidos',
    label: 'Gestionar pedidos y reservas',
    detail: 'Procesar tu compra o reserva, coordinar la entrega o recogida y atender devoluciones.',
  },
  {
    id: 'pagos',
    label: 'Procesar el pago',
    detail: 'Validar la transacción con la pasarela de pagos y conservar el soporte contable.',
  },
  {
    id: 'operacion',
    label: 'Operar el marketplace',
    detail: 'Mostrar los establecimientos cercanos, su inventario disponible y los precios vigentes.',
  },
  {
    id: 'analitica',
    label: 'Medir y mejorar el servicio',
    detail: 'Elaborar estadísticas de uso, desperdicio evitado e impacto ambiental de forma agregada.',
  },
  {
    id: 'ia',
    label: 'Alimentar las recomendaciones de la plataforma',
    detail: 'Usar datos de rotación y ventas, no de identificación, para sugerir acciones sobre el inventario.',
  },
  {
    id: 'soporte',
    label: 'Atender tus solicitudes',
    detail: 'Responder consultas, reclamos, peticiones de supresión y requerimientos de autoridades.',
  },
  {
    id: 'legal',
    label: 'Cumplir obligaciones legales',
    detail: 'Atender deberes tributarios, contables y de protección al consumidor.',
  },
];

/** Finalidad adicional, opcional y revocable de forma independiente. */
export const MARKETING_PURPOSE = {
  id: 'marketing',
  label: 'Enviarte comunicaciones comerciales',
  detail:
    'Avisarte por correo o notificación cuando haya productos rescatados cerca de ti, promociones y novedades de Reverde.',
} as const;

/** Derechos del titular (artículo 8 de la Ley 1581 de 2012). */
export const SUBJECT_RIGHTS: string[] = [
  'Conocer, actualizar y rectificar tus datos personales frente a Reverde.',
  'Solicitar prueba de la autorización que otorgaste, salvo cuando la ley no la exija.',
  'Ser informado, previa solicitud, sobre el uso que le hemos dado a tus datos.',
  'Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la ley.',
  'Revocar la autorización y solicitar la supresión de tus datos cuando no exista un deber legal o contractual que obligue a conservarlos.',
  'Acceder de forma gratuita a los datos que hayan sido objeto de tratamiento.',
];

/* ── Autorización de Habeas Data ───────────────────────────────────────── */

/** Texto que el titular acepta de forma expresa en la compuerta de consentimiento. */
export const HABEAS_DATA_STATEMENT =
  `Autorizo de manera previa, expresa, informada y voluntaria a ${RESPONSABLE.name} para recolectar, ` +
  'almacenar, usar, circular y suprimir mis datos personales con las finalidades descritas en la Política ' +
  'de Tratamiento de Datos Personales, en los términos de la Ley 1581 de 2012 y del Decreto 1074 de 2015. ' +
  'Declaro que conozco mi derecho a conocer, actualizar, rectificar y suprimir mis datos, y a revocar ' +
  'esta autorización en cualquier momento.';

export const HABEAS_DATA: LegalDocument = {
  slug: 'habeas-data',
  title: 'Autorización de tratamiento de datos personales',
  summary: 'El texto exacto que autorizas al entrar a Reverde (Habeas Data · Ley 1581 de 2012).',
  sections: [
    {
      id: 'declaracion',
      title: 'Declaración de autorización',
      blocks: [
        { kind: 'note', text: HABEAS_DATA_STATEMENT },
        {
          kind: 'p',
          text:
            `Esta autorización se otorga a ${RESPONSABLE.legalName}, con domicilio en ${RESPONSABLE.address} ` +
            `y correo de contacto ${RESPONSABLE.email}, en calidad de responsable del tratamiento.`,
        },
      ],
    },
    {
      id: 'finalidades',
      title: 'Finalidades autorizadas',
      blocks: [
        { kind: 'p', text: 'Al aceptar, autorizas el tratamiento de tus datos para:' },
        { kind: 'ul', items: PURPOSES.map((p) => `${p.label}: ${p.detail.toLowerCase()}`) },
        {
          kind: 'p',
          text:
            `El envío de comunicaciones comerciales (${MARKETING_PURPOSE.detail.toLowerCase()}) es una ` +
            'finalidad opcional: puedes aceptarla o rechazarla por separado sin que ello afecte tu uso de la plataforma.',
        },
      ],
    },
    {
      id: 'datos',
      title: 'Datos que autorizas tratar',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Datos de identificación y contacto: nombre, correo electrónico y, si lo entregas, teléfono.',
            'Datos de la cuenta: rol, establecimiento asociado y preferencias de uso.',
            'Datos transaccionales: pedidos, reservas, productos rescatados, montos y punto de recogida.',
            'Datos de ubicación aproximada, solo para mostrarte establecimientos cercanos.',
            'Datos técnicos del dispositivo y registros de actividad necesarios para la seguridad del servicio.',
          ],
        },
        {
          kind: 'note',
          text:
            'Reverde no solicita datos sensibles (salud, origen étnico, convicciones políticas o religiosas, ' +
            'datos biométricos) ni datos de niñas, niños y adolescentes. Si los recibimos por error, los suprimimos.',
        },
      ],
    },
    {
      id: 'voluntariedad',
      title: 'Carácter facultativo de tus respuestas',
      blocks: [
        {
          kind: 'p',
          text:
            'Entregar tus datos es voluntario. No estás obligado a autorizar el tratamiento de datos sensibles ' +
            'ni a responder preguntas que versen sobre ellos. Sin embargo, sin la autorización de los datos ' +
            'básicos no es posible crear tu cuenta ni procesar pedidos o reservas, porque son necesarios para ' +
            'ejecutar el servicio que solicitas.',
        },
      ],
    },
    {
      id: 'revocatoria',
      title: 'Revocatoria y supresión',
      blocks: [
        {
          kind: 'p',
          text:
            'Puedes revocar esta autorización y solicitar la supresión de tus datos en cualquier momento, ' +
            'desde Perfil → Privacidad y datos personales, o escribiendo a ' +
            `${RESPONSABLE.email}. La revocatoria procede siempre que no exista un deber legal o contractual ` +
            'que nos obligue a conservar la información, como los soportes contables de una compra.',
        },
      ],
    },
  ],
};

/* ── Política de tratamiento de datos ─────────────────────────────────── */

export const PRIVACY_POLICY: LegalDocument = {
  slug: 'privacidad',
  title: 'Política de tratamiento de datos personales',
  summary: 'Qué datos recogemos, para qué los usamos y cómo ejerces tus derechos.',
  sections: [
    {
      id: 'responsable',
      title: '1. Responsable del tratamiento',
      blocks: [
        {
          kind: 'ul',
          items: [
            `Responsable: ${RESPONSABLE.legalName}`,
            `NIT: ${RESPONSABLE.nit}`,
            `Domicilio: ${RESPONSABLE.address}`,
            `Correo para el ejercicio de derechos: ${RESPONSABLE.email}`,
            `Teléfono: ${RESPONSABLE.phone}`,
            `Horario de atención: ${RESPONSABLE.hours}`,
          ],
        },
      ],
    },
    {
      id: 'marco',
      title: '2. Marco legal',
      blocks: [
        {
          kind: 'p',
          text:
            'Esta política se expide en cumplimiento de los artículos 15 y 20 de la Constitución Política, ' +
            'la Ley Estatutaria 1581 de 2012, el Decreto 1074 de 2015 (que compiló el Decreto 1377 de 2013) ' +
            'y las instrucciones de la Superintendencia de Industria y Comercio en materia de protección de ' +
            'datos personales y de derecho fundamental de habeas data.',
        },
      ],
    },
    {
      id: 'datos',
      title: '3. Datos personales que tratamos',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Identificación y contacto: nombre, correo electrónico y teléfono si lo suministras.',
            'Datos de la cuenta: rol, establecimiento asociado, preferencias de notificación y de distancia.',
            'Datos transaccionales: pedidos, reservas, productos, montos, ahorro y punto de recogida.',
            'Datos de ubicación aproximada para calcular establecimientos cercanos.',
            'Datos técnicos: dispositivo, navegador y registros de actividad, con fines de seguridad.',
          ],
        },
        {
          kind: 'note',
          text:
            'No tratamos datos sensibles ni datos de menores de edad. Los datos de pago se procesan ' +
            'directamente con la pasarela de pagos: Reverde no almacena el número completo de la tarjeta ni el CVV.',
        },
      ],
    },
    {
      id: 'finalidades',
      title: '4. Finalidades del tratamiento',
      blocks: [
        { kind: 'ul', items: PURPOSES.map((p) => `${p.label}: ${p.detail.toLowerCase()}`) },
        {
          kind: 'p',
          text:
            `Adicionalmente, si lo autorizas de forma separada: ${MARKETING_PURPOSE.detail.toLowerCase()} ` +
            'Esta finalidad es opcional y puedes retirarla sin perder acceso al servicio.',
        },
      ],
    },
    {
      id: 'autorizacion',
      title: '5. Autorización del titular',
      blocks: [
        {
          kind: 'p',
          text:
            'Solicitamos tu autorización previa, expresa e informada antes de tratar tus datos, mediante una ' +
            'ventana de consentimiento con casillas que no vienen marcadas de antemano. De cada autorización ' +
            'guardamos la versión de la política aceptada, la fecha y la hora, como prueba del consentimiento.',
        },
        {
          kind: 'p',
          text:
            'Cuando realizas un pedido volvemos a pedirte una autorización específica para esa transacción, ' +
            'y la conservamos junto con el soporte de la compra.',
        },
      ],
    },
    {
      id: 'derechos',
      title: '6. Derechos del titular',
      blocks: [
        { kind: 'p', text: 'Como titular de los datos tienes derecho a:' },
        { kind: 'ul', items: SUBJECT_RIGHTS },
      ],
    },
    {
      id: 'procedimiento',
      title: '7. Consultas y reclamos',
      blocks: [
        {
          kind: 'p',
          text:
            `Puedes ejercer tus derechos desde Perfil → Privacidad y datos personales o escribiendo a ` +
            `${RESPONSABLE.email} con tu nombre, el canal de respuesta y una descripción de tu solicitud.`,
        },
        {
          kind: 'ol',
          items: [
            'Consultas: respondemos en un término máximo de diez (10) días hábiles, prorrogable por cinco (5) días hábiles más.',
            'Reclamos: respondemos en un término máximo de quince (15) días hábiles, prorrogable por ocho (8) días hábiles más.',
            'Si el reclamo está incompleto, te lo informamos dentro de los cinco (5) días siguientes para que lo subsanes.',
            'Mientras el reclamo esté en trámite, incluimos la leyenda «reclamo en trámite» en el registro del dato.',
          ],
        },
        {
          kind: 'p',
          text:
            'Puedes presentar queja ante la Superintendencia de Industria y Comercio una vez hayas agotado ' +
            'el trámite de consulta o reclamo ante Reverde.',
        },
      ],
    },
    {
      id: 'terceros',
      title: '8. Transmisión y transferencia a terceros',
      blocks: [
        {
          kind: 'p',
          text:
            'Compartimos únicamente los datos necesarios con: el establecimiento donde recoges tu pedido, ' +
            'la pasarela de pagos, los proveedores de infraestructura tecnológica y las autoridades que lo ' +
            'requieran por ley. Con los encargados suscribimos cláusulas de confidencialidad y de tratamiento ' +
            'limitado a nuestras instrucciones. No vendemos tus datos personales.',
        },
      ],
    },
    {
      id: 'seguridad',
      title: '9. Seguridad de la información',
      blocks: [
        {
          kind: 'p',
          text:
            'Aplicamos medidas técnicas, humanas y administrativas razonables para proteger los datos contra ' +
            'acceso no autorizado, pérdida, alteración o uso fraudulento: cifrado en tránsito, control de ' +
            'acceso por rol y registro de actividad. Ningún sistema es infalible; si ocurre un incidente que ' +
            'afecte tus datos, lo reportaremos a la autoridad y te informaremos.',
        },
      ],
    },
    {
      id: 'vigencia',
      title: '10. Vigencia y conservación',
      blocks: [
        {
          kind: 'p',
          text:
            `Conservamos los datos mientras exista una relación activa contigo y hasta ${RETENTION_MONTHS} meses ` +
            'después de tu última interacción, salvo que un deber legal, contable o tributario exija un plazo mayor. ' +
            'Vencido el plazo, los suprimimos o los anonimizamos de forma irreversible.',
        },
        { kind: 'p', text: `Esta política rige desde el ${LEGAL_UPDATED_AT} y mientras no sea sustituida.` },
      ],
    },
    {
      id: 'cambios',
      title: '11. Cambios en la política',
      blocks: [
        {
          kind: 'p',
          text:
            'Si modificamos las finalidades o los canales de atención, publicaremos la nueva versión en esta ' +
            'misma página y te solicitaremos de nuevo tu autorización antes de seguir usando tus datos bajo ' +
            'las condiciones actualizadas.',
        },
      ],
    },
  ],
};

/* ── Términos y condiciones ───────────────────────────────────────────── */

export const TERMS: LegalDocument = {
  slug: 'terminos',
  title: 'Términos y condiciones de uso',
  summary: 'Las reglas de uso de la plataforma y las responsabilidades de cada parte.',
  sections: [
    {
      id: 'objeto',
      title: '1. Objeto',
      blocks: [
        {
          kind: 'p',
          text:
            `${RESPONSABLE.name} es una plataforma que ayuda a supermercados y restaurantes a identificar ` +
            'alimentos con riesgo de convertirse en desperdicio y a conectarlos con compradores cercanos ' +
            'mediante un marketplace. Estos términos regulan el acceso y uso de la plataforma.',
        },
      ],
    },
    {
      id: 'naturaleza',
      title: '2. Naturaleza del servicio',
      blocks: [
        {
          kind: 'note',
          text:
            'Esta versión es un prototipo académico: los inventarios, ventas y pagos son simulaciones y no ' +
            'generan cobros reales ni obligaciones comerciales exigibles. Los datos que ingreses se guardan ' +
            'en tu propio navegador.',
        },
        {
          kind: 'p',
          text:
            'Reverde actúa como intermediario tecnológico entre el establecimiento y el comprador. La ' +
            'propiedad, la calidad, el estado de conservación y la información de cada producto son ' +
            'responsabilidad del establecimiento que lo publica.',
        },
      ],
    },
    {
      id: 'cuenta',
      title: '3. Cuenta de usuario',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Debes ser mayor de edad y entregar información veraz y actualizada.',
            'Eres responsable de la custodia de tus credenciales y de la actividad realizada con tu cuenta.',
            'Podemos suspender cuentas que incumplan estos términos o que realicen un uso fraudulento del servicio.',
          ],
        },
      ],
    },
    {
      id: 'publicaciones',
      title: '4. Obligaciones del establecimiento',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Publicar únicamente alimentos aptos para el consumo humano, dentro de su fecha de vencimiento.',
            'Informar con exactitud el precio, la cantidad, la fecha de vencimiento y el estado del producto.',
            'Cumplir la normativa sanitaria aplicable, incluida la cadena de frío y el rotulado.',
            'Mantener disponible el producto durante la ventana de recogida informada al comprador.',
          ],
        },
      ],
    },
    {
      id: 'pedidos',
      title: '5. Pedidos, reservas y precios',
      blocks: [
        {
          kind: 'p',
          text:
            'Los precios se expresan en pesos colombianos (COP) e incluyen los descuentos vigentes al momento ' +
            'de la compra. Una reserva aparta el producto hasta el cierre del establecimiento y se paga al ' +
            'recogerlo. Si el producto no está disponible al momento de la entrega, el establecimiento debe ' +
            'ofrecer un reemplazo equivalente o la devolución del dinero.',
        },
        {
          kind: 'p',
          text:
            'Se respetan los derechos de retracto y de reversión del pago en los casos y plazos previstos en ' +
            'la Ley 1480 de 2011, salvo en productos perecederos cuando la ley exceptúa su aplicación.',
        },
      ],
    },
    {
      id: 'conducta',
      title: '6. Usos prohibidos',
      blocks: [
        {
          kind: 'ul',
          items: [
            'Suplantar la identidad de otra persona o de un establecimiento.',
            'Extraer datos de la plataforma de forma automatizada sin autorización escrita.',
            'Interferir con la seguridad, la disponibilidad o la integridad del servicio.',
            'Publicar contenido ilícito, engañoso o que infrinja derechos de terceros.',
          ],
        },
      ],
    },
    {
      id: 'propiedad',
      title: '7. Propiedad intelectual',
      blocks: [
        {
          kind: 'p',
          text:
            `La marca, el software, la interfaz y los contenidos de ${RESPONSABLE.name} son de su titularidad ` +
            'o se usan con licencia. El acceso a la plataforma no transfiere ningún derecho de propiedad ' +
            'intelectual sobre ellos.',
        },
      ],
    },
    {
      id: 'responsabilidad',
      title: '8. Limitación de responsabilidad',
      blocks: [
        {
          kind: 'p',
          text:
            'Reverde no responde por el estado de los alimentos, por el incumplimiento del establecimiento ni ' +
            'por interrupciones del servicio ajenas a su control. Nada en esta cláusula limita los derechos ' +
            'irrenunciables que la ley colombiana reconoce al consumidor.',
        },
      ],
    },
    {
      id: 'datos',
      title: '9. Protección de datos personales',
      blocks: [
        {
          kind: 'p',
          text:
            'El tratamiento de datos personales se rige por la Política de tratamiento de datos personales y ' +
            'por la autorización de habeas data que otorgas al ingresar, documentos que forman parte ' +
            'integral de estos términos.',
        },
      ],
    },
    {
      id: 'ley',
      title: '10. Ley aplicable y contacto',
      blocks: [
        {
          kind: 'p',
          text:
            'Estos términos se rigen por la ley colombiana. Cualquier controversia se someterá a los jueces ' +
            `de la República de Colombia. Para notificaciones: ${RESPONSABLE.email}.`,
        },
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalSlug, LegalDocument> = {
  terminos: TERMS,
  privacidad: PRIVACY_POLICY,
  'habeas-data': HABEAS_DATA,
};

export const LEGAL_INDEX: LegalDocument[] = [TERMS, PRIVACY_POLICY, HABEAS_DATA];
