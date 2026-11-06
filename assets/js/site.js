/* Multihall: núcleo do site. Sem dependência para o essencial (menu, abas, pedido, formulários,
   revelações, história em 3D); o Lenis (scroll suave) entra depois do load, só no computador. */
(() => {
  const d = document, h = d.documentElement, w = window;
  const mob = w.matchMedia('(max-width:860px)');
  const rm = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const B3D = '/assets/js/build3d.js?v=d429546d22';
  const params = new URLSearchParams(location.search);
  const poster = params.get('poster') === '1';
  if (poster) h.classList.add('poster');
  let lenis = null;

  /* ---------- cabeçalho e menu ---------- */
  const top = d.querySelector('.top'), burger = d.querySelector('.burger');
  if (burger) burger.addEventListener('click', () => {
    const open = !h.classList.contains('menu-open');
    h.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  d.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => {
    h.classList.remove('menu-open');
    burger && burger.setAttribute('aria-expanded', 'false');
  }));

  /* ---------- abas do catálogo ---------- */
  const tabs = [...d.querySelectorAll('.tab')], panels = [...d.querySelectorAll('.panel')];
  const abrirAba = id => {
    if (!tabs.length) return false;
    const t = tabs.find(x => x.dataset.tab === id);
    if (!t) return false;
    tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
    panels.forEach(p => p.classList.toggle('on', p.dataset.tab === id));
    return true;
  };
  tabs.forEach(t => t.addEventListener('click', () => abrirAba(t.dataset.tab)));
  d.querySelector('.tabs') && d.querySelector('.tabs').addEventListener('keydown', e => {
    const i = tabs.indexOf(d.activeElement);
    if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    abrirAba(tabs[j].dataset.tab); tabs[j].focus(); e.preventDefault();
  });
  const abaDoHash = () => { const m = /^#pedido-([a-z]+)$/.exec(location.hash); return m && abrirAba(m[1]); };
  abaDoHash();

  /* âncoras da mesma página passam pelo Lenis quando ele existe; data-tab abre a aba certa antes de rolar */
  const rolarAte = (alvo, hash) => {
    if (lenis) lenis.scrollTo(alvo, { offset: -76 });
    else alvo.scrollIntoView({ behavior: rm ? 'auto' : 'smooth' });
    if (hash) history.replaceState(null, '', hash);
  };
  d.addEventListener('click', e => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '') || !url.hash) return;
    let alvo = d.querySelector(url.hash);
    const m = /^#pedido-([a-z]+)$/.exec(url.hash);
    if (m && abrirAba(m[1])) alvo = d.getElementById('pedido');
    if (a.dataset.tab) { abrirAba(a.dataset.tab); alvo = d.getElementById('pedido') || alvo; }
    if (!alvo) return;
    e.preventDefault();
    rolarAte(alvo, url.hash);
    const modelo = a.dataset.modelo;
    if (modelo) { const sel = d.querySelector('#f-modelo'); if (sel) sel.value = modelo; }
  });

  /* ---------- revelações (com reserva: nada fica invisível) ---------- */
  const rvs = [...d.querySelectorAll('.rv, .mosaico figure')];
  const mostrar = el => el.classList.add('in');
  if ('IntersectionObserver' in w) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { mostrar(en.target); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    rvs.forEach(el => io.observe(el));
  } else rvs.forEach(mostrar);
  const reserva = () => rvs.forEach(el => { if (el.getBoundingClientRect().top < innerHeight) mostrar(el); });
  setTimeout(reserva, 2500);

  /* ---------- história em 3D ---------- */
  /* fundo parado das seções só pinta por perto; o mapa só anima quando está na tela */
  if ('IntersectionObserver' in w) {
    const ioFixo = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('perto', en.isIntersecting)), { rootMargin: '30% 0px' });
    d.querySelectorAll('.fixo').forEach(el => ioFixo.observe(el));
    const ioMira = new IntersectionObserver(es => es.forEach(en => en.target.classList.toggle('in', en.isIntersecting)), { rootMargin: '0px 0px -10% 0px' });
    d.querySelectorAll('.mira').forEach(el => ioMira.observe(el));
  } else {
    d.querySelectorAll('.fixo').forEach(el => el.classList.add('perto'));
    d.querySelectorAll('.mira').forEach(el => el.classList.add('in'));
  }

  /* a bolinha do WhatsApp entra depois da história, para não cobrir texto nem etapas */
  const bolinha = d.querySelector('.zap'), palco = d.querySelector('.story');
  if (bolinha) {
    const verZap = () => bolinha.classList.toggle('ver', !palco || palco.getBoundingClientRect().bottom < innerHeight * 1.02);
    w.addEventListener('scroll', verZap, { passive: true });
    w.addEventListener('resize', verZap, { passive: true });
    verZap();
  }

  const story = d.querySelector('.story');
  let st = null;
  if (story) {
    const beats = [...story.querySelectorAll('.beat')].map(b => ({ el: b, a: +b.dataset.a, z: +b.dataset.b }));
    const steps = [...story.querySelectorAll('.story__steps li')].map(li => ({ el: li, a: +li.dataset.a, z: +li.dataset.b }));
    const canvas = story.querySelector('.story__canvas');
    const [m0, m1] = (story.dataset.map || '0,1').split(',').map(Number);
    let build = null, montou = false, ultimo = -1;
    st = {
      p: 0,
      medir() {
        const r = story.getBoundingClientRect(), total = story.offsetHeight - innerHeight;
        this.p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      },
      aplicar() {
        const p = this.p;
        if (Math.abs(p - ultimo) < 0.0005) return;
        ultimo = p;
        beats.forEach((b, i) => {
          const on = p >= b.a && p < b.z;
          b.el.classList.toggle('on', on && i > 0);
          b.el.classList.toggle('out', !on && p >= b.z);
        });
        const q = m0 + (m1 - m0) * p;
        steps.forEach(s => { s.el.classList.toggle('on', q >= s.a && q < s.z); s.el.classList.toggle('done', q >= s.z); });
        story.classList.toggle('moved', p > 0.01);
        if (build) build.setProgress(q);
      },
    };
    const montar = () => {
      if (montou || !canvas) return;
      montou = true;
      gatilhos.forEach(ev => w.removeEventListener(ev, montar));
      import(B3D)
        .then(m => m.mountBuild(canvas, { mobile: mob.matches, reducedMotion: rm, poster, start: m0, debug: params.has('debug') }))
        .then(b => { build = b; w.__mh3d = b; ultimo = -1; st.medir(); st.aplicar(); return b.ready; })
        .then(() => story.classList.add('live'))
        .catch(err => console.warn('3D indisponível, fica o pôster', err));
    };
    const gatilhos = ['pointermove', 'touchstart', 'scroll', 'wheel', 'keydown'];
    if (poster || params.has('3d')) montar();
    else { gatilhos.forEach(ev => w.addEventListener(ev, montar, { passive: true })); setTimeout(montar, 12000); }
    if (poster && params.get('p')) { const pp = +params.get('p'); st.medir = () => { st.p = pp; }; }
  }

  /* ---------- para quem compra: a foto acompanha o perfil que está no meio da tela ---------- */
  const perfis = [...d.querySelectorAll('.perfil')], fotos = [...d.querySelectorAll('.quem__foto .ph')];
  let perfilAtivo = -1;
  const moverQuem = () => {
    if (!perfis.length) return;
    const meio = innerHeight * 0.45;
    let k = 0, melhor = Infinity;
    perfis.forEach((p, i) => { const r = p.getBoundingClientRect(); const dist = Math.abs((r.top + r.bottom) / 2 - meio); if (dist < melhor) { melhor = dist; k = i; } });
    if (k === perfilAtivo) return;
    perfilAtivo = k;
    perfis.forEach((p, i) => p.classList.toggle('on', i === k));
    fotos.forEach((f, i) => f.classList.toggle('on', i === k));
  };

  /* ---------- régua das etapas da franquia ---------- */
  const etapas = d.querySelector('.etapas');
  const moverEtapas = () => {
    if (!etapas) return;
    const r = etapas.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (innerHeight * 0.78 - r.top) / (r.height + innerHeight * 0.2)));
    etapas.style.setProperty('--p', p.toFixed(3));
  };

  /* ---------- um único laço de scroll ---------- */
  let pendente = false;
  const quadro = () => {
    pendente = false;
    top && top.classList.toggle('solid', w.scrollY > 40);
    if (st) { st.medir(); st.aplicar(); }
    moverQuem(); moverEtapas(); moverPill();
  };
  const pedir = () => { if (!pendente) { pendente = true; requestAnimationFrame(quadro); } };
  w.addEventListener('scroll', pedir, { passive: true });
  w.addEventListener('resize', pedir, { passive: true });

  /* ---------- monte seu pedido ---------- */
  const CHAVE = 'mh_pedido';
  const carrinho = d.querySelector('.carrinho');
  const itens = [...d.querySelectorAll('.item')];
  const pill = d.querySelector('.pedido__pill');
  let pedido = {};
  const ler = () => { try { pedido = JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch (_) { pedido = {}; } };
  const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(pedido)); } catch (_) {} };
  const dados = id => { const el = itens.find(i => i.dataset.id === id); return el ? { nome: el.dataset.nome, un: el.dataset.un.split('|'), grupo: el.dataset.grupo, ordem: itens.indexOf(el) } : null; };
  const unidade = (n, un) => `${n} ${n === 1 ? un[0] : un[1]}`;
  const X = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6"/></svg>';
  function moverPill() {
    if (!pill || !carrinho) return;
    const n = Object.keys(pedido).length;
    const r = carrinho.getBoundingClientRect(), sec = d.getElementById('pedido');
    const visivel = r.top < innerHeight && r.bottom > 0;
    const perto = sec && sec.getBoundingClientRect().top < innerHeight * 0.6 && sec.getBoundingClientRect().bottom > 0;
    pill.classList.toggle('on', n > 0 && mob.matches && !visivel && perto);
  }
  function render() {
    const ids = Object.keys(pedido).filter(id => dados(id) && pedido[id] > 0).sort((a, b) => dados(a).ordem - dados(b).ordem);
    itens.forEach(el => {
      const q = pedido[el.dataset.id] || 0;
      el.classList.toggle('no', q > 0);
      const inp = el.querySelector('.qty input'); if (inp && +inp.value !== q && q > 0) inp.value = q;
    });
    if (carrinho) {
      const lista = carrinho.querySelector('.carrinho__lista'), n = carrinho.querySelector('.carrinho__n');
      carrinho.classList.toggle('tem', ids.length > 0);
      if (n) n.textContent = ids.length ? `${ids.length} ${ids.length === 1 ? 'item' : 'itens'}` : '';
      let grupo = '', html = '';
      ids.forEach(id => {
        const it = dados(id);
        if (it.grupo !== grupo) { grupo = it.grupo; html += `<li class="carrinho__grupo">${grupo.toUpperCase()}</li>`; }
        html += `<li><span>${it.nome}</span><em>${unidade(pedido[id], it.un)}</em><button type="button" data-tira="${id}" aria-label="Tirar ${it.nome} do pedido">${X}</button></li>`;
      });
      lista.innerHTML = html;
    }
    if (pill) pill.querySelector('b').textContent = ids.length;
    moverPill();
  }
  const definir = (id, q) => { q = Math.max(0, Math.min(9999, Math.round(q) || 0)); if (q) pedido[id] = q; else delete pedido[id]; gravar(); render(); };
  itens.forEach(el => {
    const id = el.dataset.id, inp = el.querySelector('.qty input');
    el.querySelector('.item__add').addEventListener('click', () => { definir(id, 1); inp && inp.focus(); });
    el.querySelector('[data-mais]').addEventListener('click', () => definir(id, (pedido[id] || 0) + 1));
    el.querySelector('[data-menos]').addEventListener('click', () => definir(id, (pedido[id] || 0) - 1));
    inp && inp.addEventListener('change', () => definir(id, +inp.value));
    inp && inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  });
  carrinho && carrinho.addEventListener('click', e => {
    const b = e.target.closest('[data-tira]'); if (b) definir(b.dataset.tira, 0);
    if (e.target.closest('.carrinho__limpar')) { pedido = {}; gravar(); render(); }
  });
  const mensagemPedido = () => {
    const ids = Object.keys(pedido).filter(id => dados(id) && pedido[id] > 0).sort((a, b) => dados(a).ordem - dados(b).ordem);
    const linhas = ['Olá! Quero um orçamento pelo site da Multihall.', ''];
    let grupo = '';
    ids.forEach(id => {
      const it = dados(id);
      if (it.grupo !== grupo) { grupo = it.grupo; if (linhas.length > 2) linhas.push(''); linhas.push(`*${grupo}*`); }
      linhas.push(`- ${it.nome}: ${unidade(pedido[id], it.un)}`);
    });
    const v = k => ((carrinho.querySelector(`[name="${k}"]`) || {}).value || '').trim();
    const extras = [];
    if (v('nome')) extras.push(`Nome: ${v('nome')}`);
    if (v('cidade')) extras.push(`Cidade da obra: ${v('cidade')}`);
    if (v('obs')) extras.push(`Observações: ${v('obs')}`);
    if (extras.length) linhas.push('', ...extras);
    return linhas.join('\n');
  };
  const irParaObrigado = (msg, c) => {
    try { sessionStorage.setItem('mh_msg', msg); } catch (_) {}
    location.href = `/obrigado?c=${encodeURIComponent(c)}`;
  };
  carrinho && carrinho.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!Object.keys(pedido).length) return;
    irParaObrigado(mensagemPedido(), 'pedido');
  });
  w.__mhMensagem = mensagemPedido;
  ler(); render();

  /* ---------- formulários: mensagem pronta para o WhatsApp ---------- */
  const ABERTURA = {
    contato: 'Olá! Vim pelo site da Multihall.',
    franquia: 'Olá! Quero ser franqueado Multihall.',
    empreendimento: 'Olá! Quero uma cotação de fornecimento por obra com a Multihall.',
  };
  const ROTULOS = { nome: 'Nome', empresa: 'Empresa', whatsapp: 'WhatsApp', cidade: 'Cidade', interesse: 'Interesse', tipo: 'Tipo de obra', unidades: 'Unidades', mensagem: 'Mensagem' };
  d.querySelectorAll('form.form').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const f = new FormData(form), c = form.dataset.c || 'form';
    const linhas = [ABERTURA[c] || ABERTURA.contato, ''];
    for (const [k, val] of f.entries()) {
      const v = (val || '').toString().trim();
      if (v) linhas.push(`${ROTULOS[k] || k}: ${v}`);
    }
    irParaObrigado(linhas.join('\n'), c);
  }));

  /* ---------- Lenis depois do load (não disputa com a primeira pintura) ---------- */
  const depoisDoLoad = () => {
    pedir();
    if (rm || mob.matches || poster) return;
    const s = d.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.min.js';
    s.async = false;
    s.onload = () => {
      if (typeof w.Lenis !== 'function') return;
      lenis = new w.Lenis({ duration: 1.05, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    };
    d.head.appendChild(s);
  };
  quadro();
  if (d.readyState === 'complete') depoisDoLoad(); else w.addEventListener('load', depoisDoLoad);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(pedir);
})();
