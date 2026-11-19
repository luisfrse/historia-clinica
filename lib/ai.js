'use strict';
/* IA con la API de Claude (Anthropic), SOLO desde el servidor. La clave vive en la variable ANTHROPIC_API_KEY (Coolify); nunca llega al navegador.
   Toda llamada queda registrada en ai_usage (para el tope mensual y para saber qué se gasta). La IA solo propone: nada de esto cambia datos por sí solo.
   AI_MODEL           modelo (por defecto claude-sonnet-5-5)
   AI_MONTHLY_USD     tope mensual estimado en dólares (por defecto 25); al alcanzarlo se rechazan nuevas llamadas
   AI_PRICE_IN/OUT    dólares por millón de tokens de entrada/salida, SOLO para estimar (por defecto 3 y 15; el gasto real está en la Consola de Anthropic) */
const API = 'https://api.anthropic.com/v1/messages';

function create({ db, env = process.env, fetchImpl = fetch } = {}) {
  const key = () => String(env.ANTHROPIC_API_KEY || '').trim();
  const model = () => String(env.AI_MODEL || 'claude-sonnet-5-5').trim();
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };
  const cap = () => num(env.AI_MONTHLY_USD, 25);
  const price = () => ({ i: num(env.AI_PRICE_IN, 3), o: num(env.AI_PRICE_OUT, 15) });
  const cost = (inTok, outTok) => { const p = price(); return (inTok * p.i + outTok * p.o) / 1e6; };
  const monthStart = () => new Date().toISOString().slice(0, 7) + '-01T00:00:00.000Z';

  function usage() {
    const r = db.get('SELECT COUNT(*) calls, COALESCE(SUM(usd),0) usd, COALESCE(SUM(in_tok),0) in_tok, COALESCE(SUM(out_tok),0) out_tok FROM ai_usage WHERE at >= ?', monthStart());
    return { calls: r.calls, usd: Math.round(r.usd * 10000) / 10000, inTok: r.in_tok, outTok: r.out_tok, cap: cap() };
  }
  const configured = () => key().length > 20;
  /* tokens aproximados de un texto (≈ 3,5 caracteres por token en castellano/catalán) */
  const approxTokens = (s) => Math.ceil(String(s || '').length / 3.5);
  const estimate = (inTok, outTok) => ({ inTok, outTok, usd: Math.round(cost(inTok, outTok) * 10000) / 10000 });

  /* Una llamada con salida estructurada: el modelo debe rellenar la herramienta «informe» con el esquema dado. */
  async function call({ purpose, system, user, schema, maxTokens = 4000, who = 'admin' }) {
    if (!configured()) throw Object.assign(new Error('IA sin configurar'), { code: 'ai-off' });
    const est = cost(approxTokens(system) + approxTokens(user), maxTokens);
    if (usage().usd + est > cap()) throw Object.assign(new Error('Tope mensual de IA alcanzado'), { code: 'ai-cap' });
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 150000);
    let r;
    try {
      r = await fetchImpl(env.ANTHROPIC_API_URL || API, {
        method: 'POST', signal: ac.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: model(), max_tokens: maxTokens, system,
          tools: [{ name: 'informe', description: 'Entrega el resultado final.', input_schema: schema }], tool_choice: { type: 'tool', name: 'informe' },
          messages: [{ role: 'user', content: user }]
        })
      });
    } catch (e) { throw Object.assign(new Error('La IA no responde'), { code: 'ai-net' }); } finally { clearTimeout(timer); }
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Clave de IA no válida'), { code: 'ai-key' });
    if (r.status === 429 || r.status === 529) throw Object.assign(new Error('IA saturada, reintenta en un rato'), { code: 'ai-busy' });
    if (!r.ok) {          // se cuenta el motivo real que devuelve la API (nunca incluye la clave), para poder arreglarlo
      let why = ''; try { const b = await r.json(); why = [b && b.error && b.error.type, b && b.error && b.error.message].filter(Boolean).join(': '); } catch (_) { /* sin cuerpo */ }
      why = String(why).replace(/sk-[A-Za-z0-9_-]+/g, '[clave]').slice(0, 240); console.error('[ia] la API respondió ' + r.status + (why ? ' · ' + why : ''));
      throw Object.assign(new Error('Error de la IA (' + r.status + (why ? ': ' + why : '') + ')'), { code: 'ai-error' });
    }
    const d = await r.json();
    const inTok = (d.usage && d.usage.input_tokens) || 0, outTok = (d.usage && d.usage.output_tokens) || 0;
    db.run('INSERT INTO ai_usage (at, purpose, model, in_tok, out_tok, usd, who) VALUES (?,?,?,?,?,?,?)', new Date().toISOString(), String(purpose).slice(0, 40), model(), inTok, outTok, cost(inTok, outTok), String(who).slice(0, 40));
    const blk = (d.content || []).find((b) => b.type === 'tool_use');
    if (!blk || typeof blk.input !== 'object') throw Object.assign(new Error('Respuesta de la IA no válida'), { code: 'ai-error' });
    return { data: blk.input, inTok, outTok, truncated: d.stop_reason === 'max_tokens' };
  }
  return { configured, model, usage, estimate, approxTokens, call, cap };
}
module.exports = { create };
