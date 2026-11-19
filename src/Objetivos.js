import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './utils/supabase';

const BRAND = '#00208F', AMBAR = '#FFB81C', OK = '#10b981', ROJO = '#dc2626';
const eur0 = v => Math.round(Number(v) || 0).toLocaleString('es-ES') + ' €';
const mesKey = d => (d || '').slice(0, 7);
const hoy = () => new Date();
const ymd = d => d.toISOString().slice(0, 10);
const addMes = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const nombreMes = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); };
const nombreMesCorto = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') + ' ' + String(y).slice(2); };
const diasHabilesRestantes = () => {
  const d = hoy(), fin = new Date(d.getFullYear(), d.getMonth() + 1, 0); let n = 0;
  for (let x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x <= fin; x.setDate(x.getDate() + 1)) if (x.getDay() % 6 !== 0) n++;
  return Math.max(n, 1);
};

const PROB_ENERGIA = { factura_recibida: 30, enviada_partner: 40, opciones_recibidas: 55, seleccionada: 70, docs_solicitados: 85 };
const ETAPA_LBL = { factura_recibida: 'Factura recibida', enviada_partner: 'Enviada al partner', opciones_recibidas: 'Opciones recibidas', seleccionada: 'Seleccionada', docs_solicitados: 'Docs solicitados' };

const Card = ({ children, style }) => <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)', padding: 18, ...style }}>{children}</div>;
const Lbl = ({ children }) => <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>{children}</div>;
const Big = ({ children, color = '#0B1233', size = 26 }) => <div style={{ fontFamily: "'Poppins',sans-serif", fontWeight: 700, fontSize: size, letterSpacing: '-.03em', color, lineHeight: 1.15 }}>{children}</div>;
const inp = { padding: '7px 9px', border: '1px solid #dde1ea', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box' };

function Barra({ conseguido, previsto, objetivo, alto = 14 }) {
  const max = Math.max(objetivo, conseguido + previsto, 1);
  const pc = Math.min(100, conseguido / max * 100), pp = Math.min(100 - pc, previsto / max * 100), po = objetivo / max * 100;
  return (
    <div style={{ position: 'relative', height: alto, background: '#eef0f6', borderRadius: alto }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pc + '%', background: conseguido >= objetivo ? OK : BRAND, borderRadius: alto }} />
      <div style={{ position: 'absolute', left: pc + '%', top: 0, bottom: 0, width: pp + '%', background: `repeating-linear-gradient(45deg, ${AMBAR}, ${AMBAR} 4px, #ffd36b 4px, #ffd36b 8px)`, borderRadius: alto, opacity: .9 }} />
      <div style={{ position: 'absolute', left: `calc(${po}% - 1px)`, top: -4, bottom: -4, width: 2, background: '#0B1233' }} title={'Objetivo ' + eur0(objetivo)} />
    </div>
  );
}

export default function Objetivos({ user }) {
  const isBoss = ['admin', 'socio'].includes(user?.role);
  const [cfg, setCfg] = useState(null);
  const [ener, setEner] = useState([]);
  const [props, setProps] = useState([]);
  const [llam, setLlam] = useState([]);
  const [modo, setModo] = useState('neto');
  const [edit, setEdit] = useState(false);
  const [vivo, setVivo] = useState(false);
  const [ultima, setUltima] = useState(null);
  const tRef = useRef();

  const cargar = async () => {
    const [c, e, p, l] = await Promise.all([
      supabase.from('objetivos_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('energia_procesos').select('id,estado,tipo_suministro,fecha_alta,fecha_contrato,comision_eur,comision_qnh_eur,comision_estado,fecha_liquidacion,created_at,comercial_id,direccion_suministro,referencia,contact_id'),
      supabase.from('properties').select('id,referencia,titulo,estado_venta,precio,precio_venta_acordado,comision_pct,reparto_pct,beneficio_estimado,beneficio_final,fecha_cierre_prevista,fecha_escritura,updated_at,localidad'),
      supabase.from('llamadas').select('estado,ultima_llamada_at,proxima_llamada'),
    ]);
    if (c.data) setCfg(c.data);
    setEner(e.data || []); setProps(p.data || []); setLlam(l.data || []); setUltima(new Date());
  };
  useEffect(() => {
    cargar();
    const ch = supabase.channel('objetivos-rt');
    ['energia_procesos', 'properties', 'llamadas', 'objetivos_config'].forEach(t =>
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => { clearTimeout(tRef.current); tRef.current = setTimeout(cargar, 600); }));
    ch.subscribe(st => setVivo(st === 'SUBSCRIBED'));
    const iv = setInterval(cargar, 5 * 60 * 1000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); clearTimeout(tRef.current); };
  }, []); // eslint-disable-line

  const S = cfg?.supuestos || {};
  const mesActual = ymd(hoy()).slice(0, 7);

  const calc = useMemo(() => {
    if (!cfg) return null;
    const val = r => Number(modo === 'neto' ? (r.comision_qnh_eur ?? (r.comision_eur != null ? r.comision_eur / 2 : null)) : r.comision_eur) || 0;
    // medias históricas por contrato
    const hist = ener.filter(r => r.estado === 'contratado' && r.comision_estado !== 'retrocedida' && (r.comision_eur || r.comision_qnh_eur));
    const media = tipo => { const h = hist.filter(r => (r.tipo_suministro || 'luz') === tipo); return h.length ? h.reduce((s, r) => s + val(r), 0) / h.length : (modo === 'neto' ? 45 : 90); };
    const medLuz = media('luz'), medGas = media('gas'), medEner = hist.length ? hist.reduce((s, r) => s + val(r), 0) / hist.length : medLuz;
    const comPct = Number(S.comision_inmo_pct_defecto) || 3;
    const benProp = p => {
      const precio = Number(p.precio_venta_acordado || p.precio) || 0;
      const auto = precio * (Number(p.comision_pct) || comPct) / 100 * (Number(p.reparto_pct ?? 100)) / 100;
      const bruto = Number(p.beneficio_final ?? p.beneficio_estimado) || auto;
      return modo === 'neto' ? bruto : bruto; // inmobiliaria ya es lo que corresponde a la empresa
    };
    const meses = {};
    const M = k => (meses[k] = meses[k] || { energia: { ok: 0, prev: 0, n: 0, liq: 0, items: [], prevItems: [] }, inmo: { ok: 0, prev: 0, n: 0, items: [], prevItems: [] } });
    // energía conseguida (devengada por fecha de alta)
    ener.forEach(r => {
      if (r.estado === 'contratado' && r.comision_estado !== 'retrocedida') {
        const k = mesKey(r.fecha_alta || r.fecha_contrato || r.created_at); if (!k) return;
        const v = (r.comision_eur || r.comision_qnh_eur) ? val(r) : (r.tipo_suministro === 'gas' ? medGas : medLuz);
        const m = M(k).energia; m.ok += v; m.n++; m.items.push({ ...r, v, estimada: !(r.comision_eur || r.comision_qnh_eur) });
        if (r.comision_estado === 'liquidada') m.liq += v;
      } else if (r.estado === 'baja' && r.comision_estado === 'retrocedida') {
        const k = mesKey(r.fecha_liquidacion || r.fecha_alta); if (k) { const v = val(r); M(k).energia.ok -= v; M(k).energia.items.push({ ...r, v: -v }); }
      } else if (PROB_ENERGIA[r.estado]) {
        const prob = PROB_ENERGIA[r.estado], v = (r.tipo_suministro === 'gas' ? medGas : medLuz);
        const k = prob >= 55 ? mesActual : addMes(mesActual, 1);
        const m = M(k).energia; m.prev += v * prob / 100; m.prevItems.push({ ...r, v, prob });
      }
    });
    // inmobiliaria
    const cartera = [];
    props.forEach(p => {
      const v = benProp(p);
      if (p.estado_venta === 'Vendido') {
        const k = mesKey(p.fecha_escritura || p.updated_at); if (!k) return;
        const m = M(k).inmo; m.ok += v; m.n++; m.items.push({ ...p, v });
      } else if (p.estado_venta === 'Reservado' || p.estado_venta === 'Contrato arras') {
        const prob = p.estado_venta === 'Contrato arras' ? (Number(S.prob_arras) || 95) : (Number(S.prob_reservado) || 80);
        let f = p.fecha_cierre_prevista;
        if (!f) { const d = new Date(p.updated_at || Date.now()); d.setDate(d.getDate() + (Number(S.dias_cierre_reserva) || 60)); f = ymd(d); }
        let k = mesKey(f); if (k < mesActual) k = mesActual;
        const m = M(k).inmo; m.prev += v * prob / 100; m.prevItems.push({ ...p, v, prob, fprev: f, sinFecha: !p.fecha_cierre_prevista });
      } else if (p.estado_venta === 'Disponible') cartera.push({ ...p, v });
    });
    const objMes = k => {
      const o = cfg.por_mes?.[k]; const tot = Number(o?.total ?? cfg.objetivo_mes) || 0;
      const rep = o?.reparto || cfg.reparto || {}; const re = Number(rep.energia) || 0, ri = Number(rep.inmobiliaria) || 0;
      const f = (re + ri) ? tot / (re + ri) : 0;
      return { total: tot, energia: re * f, inmo: ri * f };
    };
    const ventaMedia = (() => { const xs = [...cartera, ...props.filter(p => p.estado_venta !== 'Disponible').map(p => ({ v: benProp(p) }))].map(x => x.v).filter(Boolean); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 3000; })();
    return { meses, M, objMes, medLuz, medGas, medEner, cartera, ventaMedia };
  }, [cfg, ener, props, modo, S, mesActual]);

  if (!cfg || !calc) return <div style={{ padding: 30 }}>Cargando objetivos…</div>;

  const keys = [-3, -2, -1, 0, 1, 2, 3].map(n => addMes(mesActual, n));
  const fila = k => {
    const m = calc.meses[k] || { energia: { ok: 0, prev: 0, n: 0, liq: 0, items: [], prevItems: [] }, inmo: { ok: 0, prev: 0, n: 0, items: [], prevItems: [] } };
    const o = calc.objMes(k); const ok = m.energia.ok + m.inmo.ok, prev = m.energia.prev + m.inmo.prev;
    return { k, m, o, ok, prev, pend: Math.max(0, o.total - ok), pendTrasPrev: Math.max(0, o.total - ok - prev) };
  };
  const act = fila(mesActual);
  const pendE = Math.max(0, act.o.energia - act.m.energia.ok), pendI = Math.max(0, act.o.inmo - act.m.inmo.ok);
  // si una línea supera su objetivo, el exceso reduce lo pendiente de la otra
  const excesoE = Math.max(0, act.m.energia.ok - act.o.energia), excesoI = Math.max(0, act.m.inmo.ok - act.o.inmo);
  const pendEaj = Math.max(0, pendE - excesoI), pendIaj = Math.max(0, pendI - excesoE);
  const contratosFalta = Math.ceil(Math.max(0, pendEaj - act.m.energia.prev) / (calc.medEner || 1));
  const facturasFalta = Math.ceil(contratosFalta / ((Number(S.factura_a_contrato) || 50) / 100));
  const prospectosFalta = Math.ceil(facturasFalta / ((Number(S.prospecto_a_factura) || 60) / 100));
  const llamadasFalta = Math.ceil(prospectosFalta / ((Number(S.llamadas_a_prospecto) || 8) / 100));
  const dias = diasHabilesRestantes();
  const llamadasHoy = llam.filter(l => (l.ultima_llamada_at || '').slice(0, 10) === ymd(hoy())).length;
  const porLlamar = llam.filter(l => ['pendiente', 'no_contesta'].includes(l.estado)).length;
  const rellamadas = llam.filter(l => l.estado === 'volver_llamar').length;
  const ventasFalta = Math.max(0, pendIaj - act.m.inmo.prev) > 0 ? Math.ceil(Math.max(0, pendIaj - act.m.inmo.prev) / calc.ventaMedia) : 0;
  const pct = Math.round(act.ok / (act.o.total || 1) * 100);
  const diaMes = hoy().getDate(), diasMes = new Date(hoy().getFullYear(), hoy().getMonth() + 1, 0).getDate();
  const ritmo = Math.round(diaMes / diasMes * 100);

  const guardarCfg = async c => {
    const { error } = await supabase.from('objetivos_config').update({ objetivo_mes: c.objetivo_mes, reparto: c.reparto, supuestos: c.supuestos, por_mes: c.por_mes, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) alert(error.message); else { setEdit(false); cargar(); }
  };

  return (
    <div style={{ padding: '18px 20px', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: BRAND, margin: 0 }}>🎯 Objetivos</h1>
        <span style={{ fontSize: 12, color: vivo ? '#059669' : '#94a3b8', fontWeight: 700 }}>{vivo ? '● En directo' : '○ Conectando…'}{ultima ? ` · ${ultima.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        {!isBoss && <span style={{ fontSize: 12, color: '#64748b' }}>Mostrando tus operaciones</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {[['neto', 'Neto empresa'], ['bruto', 'Comisión bruta']].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: '7px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: modo === k ? BRAND : '#eef0f6', color: modo === k ? 'white' : '#334' }}>{l}</button>)}
          {isBoss && <button onClick={() => setEdit(true)} style={{ padding: '7px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: '#eef0f6' }}>⚙️ Ajustar objetivos</button>}
        </div>
      </div>

      {/* MES ACTUAL */}
      <Card style={{ borderTop: `4px solid ${AMBAR}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Lbl>{nombreMes(mesActual)} · objetivo {eur0(act.o.total)}</Lbl>
            <Big size={40} color={act.ok >= act.o.total ? OK : BRAND}>{eur0(act.ok)} <span style={{ fontSize: 18, color: '#64748b' }}>conseguido ({pct}%)</span></Big>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Llevamos el {ritmo}% del mes · {pct >= ritmo ? <b style={{ color: OK }}>vamos por delante del ritmo</b> : <b style={{ color: ROJO }}>vamos {ritmo - pct} puntos por detrás del ritmo</b>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Lbl>Pendiente este mes</Lbl>
            <Big size={40} color={act.pend ? ROJO : OK}>{act.pend ? eur0(act.pend) : '¡Conseguido! 🎉'}</Big>
            <div style={{ fontSize: 13, color: '#64748b' }}>Previsión ponderada en curso: <b style={{ color: '#b45309' }}>+{eur0(act.prev)}</b> → {act.pendTrasPrev ? <>faltarían <b style={{ color: ROJO }}>{eur0(act.pendTrasPrev)}</b></> : <b style={{ color: OK }}>se cubriría</b>}</div>
          </div>
        </div>
        <div style={{ margin: '14px 0 6px' }}><Barra conseguido={act.ok} previsto={act.prev} objetivo={act.o.total} alto={18} /></div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}><span><b style={{ color: BRAND }}>■</b> Conseguido</span><span><b style={{ color: AMBAR }}>■</b> Previsto (ponderado por probabilidad)</span><span><b>|</b> Objetivo</span></div>
      </Card>

      {/* POR LÍNEA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Lbl>⚡ Suministros (luz y gas)</Lbl><span style={{ fontSize: 12, color: '#64748b' }}>objetivo {eur0(act.o.energia)}</span></div>
          <Big>{eur0(act.m.energia.ok)} <span style={{ fontSize: 14, color: '#64748b' }}>· {act.m.energia.n} contratos · {eur0(act.m.energia.liq)} liquidado</span></Big>
          <div style={{ margin: '10px 0' }}><Barra conseguido={act.m.energia.ok} previsto={act.m.energia.prev} objetivo={act.o.energia} /></div>
          <div style={{ fontSize: 13, color: '#334', lineHeight: 1.7 }}>
            Comisión media por contrato: <b>{eur0(calc.medLuz)}</b> luz · <b>{eur0(calc.medGas)}</b> gas<br />
            En curso: <b>{act.m.energia.prevItems.length + (calc.meses[addMes(mesActual, 1)]?.energia.prevItems.length || 0)}</b> estudios → aportan <b style={{ color: '#b45309' }}>{eur0(act.m.energia.prev)}</b> previstos este mes
          </div>
          {pendEaj > 0 && <div style={{ background: '#fff7ed', borderRadius: 12, padding: 12, marginTop: 10 }}>
            <div style={{ fontWeight: 800, color: '#9a3412', marginBottom: 4 }}>Para cubrir {eur0(Math.max(0, pendEaj - act.m.energia.prev))} con suministros faltan:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
              {[[contratosFalta, 'contratos'], [facturasFalta, 'facturas'], [prospectosFalta, 'prospectos'], [llamadasFalta, 'llamadas']].map(([n, l]) => <div key={l}><Big size={22} color="#9a3412">{n}</Big><div style={{ fontSize: 11, color: '#9a3412' }}>{l}</div></div>)}
            </div>
            <div style={{ fontSize: 12, color: '#9a3412', marginTop: 8 }}>≈ <b>{Math.ceil(llamadasFalta / dias)} llamadas/día</b> en los {dias} días hábiles que quedan · hoy llevas <b>{llamadasHoy}</b> · en lista: {porLlamar} por llamar, {rellamadas} rellamadas</div>
          </div>}
        </Card>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><Lbl>🏠 Inmobiliaria</Lbl><span style={{ fontSize: 12, color: '#64748b' }}>objetivo {eur0(act.o.inmo)}</span></div>
          <Big>{eur0(act.m.inmo.ok)} <span style={{ fontSize: 14, color: '#64748b' }}>· {act.m.inmo.n} escrituras</span></Big>
          <div style={{ margin: '10px 0' }}><Barra conseguido={act.m.inmo.ok} previsto={act.m.inmo.prev} objetivo={act.o.inmo} /></div>
          {act.m.inmo.prevItems.map(p => <div key={p.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid #f1f5f9' }}>
            <span>{p.estado_venta === 'Contrato arras' ? '🤝' : '📌'} {p.titulo || p.referencia} · escritura {p.fprev.split('-').reverse().join('/')}{p.sinFecha && <span style={{ color: ROJO }}> (estimada)</span>}</span><b>{eur0(p.v)} × {p.prob}%</b></div>)}
          <div style={{ fontSize: 13, color: '#334', marginTop: 8 }}>Cartera disponible: <b>{calc.cartera.length}</b> inmuebles · potencial <b>{eur0(calc.cartera.reduce((s, p) => s + p.v, 0))}</b> · beneficio medio por venta <b>{eur0(calc.ventaMedia)}</b></div>
          {pendIaj > 0 && <div style={{ background: '#eff6ff', borderRadius: 12, padding: 12, marginTop: 10, color: '#1e3a8a', fontSize: 13 }}>
            {ventasFalta ? <>Faltan <b>{eur0(Math.max(0, pendIaj - act.m.inmo.prev))}</b>: equivale a <b>{ventasFalta} venta{ventasFalta > 1 ? 's' : ''}</b> de beneficio medio. Las ventas se cierran a 2-3 meses: hay que tener <b>reservas firmadas ya</b> para los próximos meses y captar en exclusiva.</> : <>Lo previsto cubre el objetivo inmobiliario del mes si se firman las escrituras.</>}
          </div>}
        </Card>
      </div>

      {/* MESES */}
      <Card>
        <Lbl>Evolución y pendiente por mes</Lbl>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 13, minWidth: 720 }}>
            <thead><tr>{['Mes', 'Objetivo', 'Suministros', 'Inmobiliaria', 'Conseguido', 'Previsto', 'Pendiente', ''].map(h => <th key={h} style={{ textAlign: h === 'Mes' || h === '' ? 'left' : 'right', padding: '6px 8px', fontSize: 11, color: '#64748b' }}>{h}</th>)}</tr></thead>
            <tbody>{keys.map(k => {
              const f = fila(k), pasado = k < mesActual;
              return <tr key={k} style={{ background: k === mesActual ? '#fffbeb' : 'white', borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px', fontWeight: k === mesActual ? 800 : 600, textTransform: 'capitalize' }}>{nombreMesCorto(k)}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{eur0(f.o.total)}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{eur0(f.m.energia.ok)}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{eur0(f.m.inmo.ok)}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: f.ok >= f.o.total ? OK : '#0B1233' }}>{eur0(f.ok)}</td>
                <td style={{ padding: '8px', textAlign: 'right', color: '#b45309' }}>{pasado ? '—' : f.prev ? '+' + eur0(f.prev) : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: f.pend ? ROJO : OK }}>{f.pend ? (pasado ? '−' : '') + eur0(f.pend) : '✓'}</td>
                <td style={{ padding: '8px', width: 200 }}><Barra conseguido={f.ok} previsto={pasado ? 0 : f.prev} objetivo={f.o.total} alto={10} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
          Suministros cuentan en el mes de <b>alta</b> del contrato (comisión devengada); las bajas con retrocesión restan. Inmobiliaria cuenta en el mes de <b>escritura</b>.
          Previsto = estudios en curso × probabilidad de la etapa ({Object.entries(PROB_ENERGIA).map(([k, v]) => `${ETAPA_LBL[k]} ${v}%`).join(', ')}) y reservas/arras × probabilidad en el mes de escritura prevista.
        </div>
      </Card>

      {/* PIPELINE */}
      <Card>
        <Lbl>Estudios de suministro en curso</Lbl>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginTop: 8 }}>
          {Object.keys(PROB_ENERGIA).map(e => {
            const xs = ener.filter(r => r.estado === e);
            return <div key={e} style={{ background: '#f8fafc', borderRadius: 12, padding: 10 }}><div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{ETAPA_LBL[e]} · {PROB_ENERGIA[e]}%</div><Big size={22}>{xs.length}</Big><div style={{ fontSize: 11, color: '#b45309' }}>≈ {eur0(xs.reduce((s, r) => s + (r.tipo_suministro === 'gas' ? calc.medGas : calc.medLuz) * PROB_ENERGIA[e] / 100, 0))}</div></div>;
          })}
        </div>
      </Card>

      {edit && <EditarObjetivos cfg={cfg} mesActual={mesActual} onClose={() => setEdit(false)} onSave={guardarCfg} />}
    </div>
  );
}

const F = ({ l, v, on, suf }) => <div><label style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{l}</label><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><input style={inp} type="number" value={v ?? ''} onChange={e => on(e.target.value)} />{suf && <span style={{ fontSize: 12, color: '#64748b' }}>{suf}</span>}</div></div>;

function EditarObjetivos({ cfg, mesActual, onClose, onSave }) {
  const [c, setC] = useState(() => JSON.parse(JSON.stringify(cfg)));
  const setS = (k, v) => setC(x => ({ ...x, supuestos: { ...x.supuestos, [k]: v } }));
  const meses = [0, 1, 2, 3, 4, 5].map(n => addMes(mesActual, n));
  const setPM = (k, v) => setC(x => { const pm = { ...(x.por_mes || {}) }; if (v === '' || v == null) delete pm[k]; else pm[k] = { ...(pm[k] || {}), total: Number(v) }; return { ...x, por_mes: pm }; });
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(11,18,51,.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 12px', overflowY: 'auto' }}>
      <Card style={{ width: 'min(760px,100%)' }}>
        <h3 style={{ margin: '0 0 12px', color: BRAND }}>Ajustar objetivos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <F l="Objetivo mensual (neto empresa)" v={c.objetivo_mes} on={v => setC(x => ({ ...x, objetivo_mes: Number(v) }))} suf="€" />
          <F l="Parte suministros" v={c.reparto?.energia} on={v => setC(x => ({ ...x, reparto: { ...x.reparto, energia: Number(v) } }))} suf="€" />
          <F l="Parte inmobiliaria" v={c.reparto?.inmobiliaria} on={v => setC(x => ({ ...x, reparto: { ...x.reparto, inmobiliaria: Number(v) } }))} suf="€" />
        </div>
        <div style={{ fontSize: 12, color: '#64748b', margin: '4px 0 14px' }}>El reparto se escala al objetivo total. Si una línea supera su parte, el exceso cubre lo pendiente de la otra.</div>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Objetivo distinto para un mes concreto (vacío = el general)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginBottom: 14 }}>
          {meses.map(k => <F key={k} l={nombreMesCorto(k)} v={c.por_mes?.[k]?.total ?? ''} on={v => setPM(k, v)} />)}
        </div>
        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>Supuestos de conversión</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <F l="Llamadas que acaban en prospecto" v={c.supuestos.llamadas_a_prospecto} on={v => setS('llamadas_a_prospecto', Number(v))} suf="%" />
          <F l="Prospectos que envían factura" v={c.supuestos.prospecto_a_factura} on={v => setS('prospecto_a_factura', Number(v))} suf="%" />
          <F l="Facturas que se contratan" v={c.supuestos.factura_a_contrato} on={v => setS('factura_a_contrato', Number(v))} suf="%" />
          <F l="Probabilidad reserva → escritura" v={c.supuestos.prob_reservado} on={v => setS('prob_reservado', Number(v))} suf="%" />
          <F l="Probabilidad arras → escritura" v={c.supuestos.prob_arras} on={v => setS('prob_arras', Number(v))} suf="%" />
          <F l="Comisión inmobiliaria por defecto" v={c.supuestos.comision_inmo_pct_defecto} on={v => setS('comision_inmo_pct_defecto', Number(v))} suf="%" />
          <F l="Días reserva → escritura (si no hay fecha)" v={c.supuestos.dias_cierre_reserva} on={v => setS('dias_cierre_reserva', Number(v))} suf="días" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: '#eef0f6', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(c)} style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: BRAND, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
        </div>
      </Card>
    </div>
  );
}
