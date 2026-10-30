// Worldframe · palco "diorama": um CENÁRIO de verdade que ocupa a tela toda (mar, cidade, armazém, campo),
// com atores low-poly animados. Sem plataforma flutuante (pedido do Lucas, 30/10).
// Tudo é função do tempo (o HyperFrames busca quadro a quadro): nada de relógio, nada de Math.random sem semente.
//
// Atores (cena.atores = [{tipo, qtd, acao}]):
//   pessoas (acao: andar | multidao | fila | protesto), navios, avioes, drones, tanques, misseis,
//   barras (barras de ouro empilhando), dinheiro (notas caindo), predios, fabrica, barris, carros,
//   bonecos (manequins de madeira com placa de nome: cena.atores[].nomes = ["TRUMP", "LULA"])
// Terreno (cena.terreno): mar | cidade | campo | cofre (armazém)   (padrão: escolhido pelos atores)

const TAU = Math.PI * 2;
const R = 1.55; // raio útil da plataforma

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export class Diorama {
  constructor(THREE, scene, SCENES, cores) {
    this.T = THREE;
    this.S = SCENES;
    this.c = cores; // {cor, funda, hi, tx, sec, bg}
    this.root = new THREE.Group();
    scene.add(this.root);
    const T = THREE;
    this.mat = {
      plat: new T.MeshLambertMaterial({ color: new T.Color(cores.funda) }),
      top: new T.MeshLambertMaterial({ color: new T.Color(cores.bg).lerp(new T.Color(cores.funda), 0.55) }),
      cor: new T.MeshLambertMaterial({ color: new T.Color(cores.cor), flatShading: true }),
      funda: new T.MeshLambertMaterial({ color: new T.Color(cores.funda), flatShading: true }),
      tx: new T.MeshLambertMaterial({ color: new T.Color(cores.tx), flatShading: true }),
      sec: new T.MeshLambertMaterial({ color: new T.Color(cores.sec), flatShading: true }),
      hi: new T.MeshLambertMaterial({ color: new T.Color(cores.hi), emissive: new T.Color(cores.hi), emissiveIntensity: 0.35, flatShading: true }),
      glow: new T.MeshBasicMaterial({ color: new T.Color(cores.cor), transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false }),
      hiGlow: new T.MeshBasicMaterial({ color: new T.Color(cores.hi), transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false }),
      sombra: new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
      agua: new T.MeshLambertMaterial({ color: new T.Color(cores.funda).lerp(new T.Color(cores.cor), 0.25), transparent: true, opacity: 0.95 }),
      fumaca: new T.MeshLambertMaterial({ color: new T.Color(cores.sec), transparent: true, opacity: 0.5, depthWrite: false }),
    };
    // luz própria do diorama (o globo usa materiais sem luz)
    const hemi = new T.HemisphereLight(0xdfe6ff, 0x0b1030, 1.1);
    const sol = new T.DirectionalLight(0xffffff, 1.4);
    sol.position.set(2, 4, 3);
    this.root.add(hemi, sol);
    this.base = this.chao();
    this.cenas = SCENES.map((s, i) => this.montar(s, i));
    this.root.visible = false;
    this.fog = new T.Fog(new T.Color(cores.bg), 3.2, 13);   // horizonte some na névoa: cenário até o fim da tela
    this.scene = scene;
  }

  chao() { // chão sem bordas até o horizonte
    const T = this.T;
    const m = new T.Mesh(new T.PlaneGeometry(80, 80), this.mat.top);
    m.rotation.x = -Math.PI / 2; m.position.y = -0.001;
    this.root.add(m);
    return m;
  }
  texto(txt, w = 0.5, h = 0.12, fundo = "#EDE6D6", cor = "#16130F") { // placa com texto (canvas)
    const T = this.T, c = document.createElement("canvas"); c.width = 512; c.height = Math.round(512 * h / w);
    const g = c.getContext("2d"); g.fillStyle = fundo; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = cor; g.font = `700 ${Math.round(c.height * 0.55)}px Barlow, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(txt, c.width / 2, c.height / 2 + 2);
    return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.DoubleSide }));
  }
  boneco(mat, nome) { // manequim articulado de madeira, de terno, com placa de nome
    const T = this.T, b = new T.Group(), pele = this._pele || (this._pele = new T.MeshLambertMaterial({ color: new T.Color("#D8C3A0"), flatShading: true }));
    const tronco = new T.Mesh(new T.CylinderGeometry(0.07, 0.06, 0.22, 10), mat); tronco.position.y = 0.33;
    const gravata = new T.Mesh(new T.BoxGeometry(0.018, 0.12, 0.005), this.mat.hi); gravata.position.set(0, 0.35, 0.068);
    const cab = new T.Mesh(new T.SphereGeometry(0.055, 14, 10), pele); cab.position.y = 0.5;
    const pesc = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.04, 6), pele); pesc.position.y = 0.45;
    const pernas = [-1, 1].map((sx) => { const l = new T.Mesh(new T.CylinderGeometry(0.022, 0.02, 0.22, 6), mat); l.position.set(sx * 0.03, 0.11, 0); return l; });
    const bracos = [-1, 1].map((sx) => { const a = new T.Group(); a.position.set(sx * 0.085, 0.43, 0);
      const m = new T.Mesh(new T.CylinderGeometry(0.016, 0.014, 0.2, 6), mat); m.position.y = -0.1; a.add(m);
      const mao = new T.Mesh(new T.SphereGeometry(0.018, 6, 4), pele); mao.position.y = -0.21; a.add(mao); return a; });
    b.add(tronco, gravata, cab, pesc, ...pernas, ...bracos, this.sombraDe(0.2, 0.2));
    if (nome) { const p = this.texto(nome, 0.3, 0.07, "#2A2622", "#EDE6D6"); p.position.set(0, 0.035, 0.16); p.rotation.x = -0.5; b.add(p); }
    b.userData = { bracos, cab };
    return b;
  }
  carro(rand) {
    const T = this.T, c = new T.Group(), cores = ["#D7261E", "#E8B21A", "#EDE6D6", "#3B3B44", "#8C7B5E"];
    const mat = new T.MeshLambertMaterial({ color: new T.Color(cores[Math.floor(rand() * cores.length)]), flatShading: true });
    const base = new T.Mesh(new T.BoxGeometry(0.1, 0.03, 0.05), mat); base.position.y = 0.025;
    const cab = new T.Mesh(new T.BoxGeometry(0.05, 0.025, 0.045), this.mat.funda); cab.position.set(-0.005, 0.05, 0);
    c.add(base, cab);
    return c;
  }

  // ---------- peças ----------
  sombraDe(w, d) {
    const m = new this.T.Mesh(new this.T.PlaneGeometry(w, d), this.mat.sombra);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.012;
    return m;
  }
  pessoaGeo() {
    if (this._pg) return this._pg;
    const T = this.T;
    this._pg = { corpo: new T.CylinderGeometry(0.022, 0.03, 0.11, 6), cabeca: new T.IcosahedronGeometry(0.024, 0), braco: new T.BoxGeometry(0.012, 0.06, 0.012) };
    return this._pg;
  }
  pessoa(mat) {
    const T = this.T, G = this.pessoaGeo(), p = new T.Group();
    const corpo = new T.Mesh(G.corpo, mat); corpo.position.y = 0.075;
    const cab = new T.Mesh(G.cabeca, this.mat.tx); cab.position.y = 0.155;
    const be = new T.Mesh(G.braco, mat), bd = new T.Mesh(G.braco, mat);
    be.position.set(-0.03, 0.1, 0); bd.position.set(0.03, 0.1, 0);
    p.add(corpo, cab, be, bd, this.sombraDe(0.07, 0.07));
    p.userData = { be, bd };
    return p;
  }
  navio() {
    const T = this.T, n = new T.Group();
    const casco = new T.Mesh(new T.BoxGeometry(0.42, 0.06, 0.1), this.mat.cor); casco.position.y = 0.03;
    const proa = new T.Mesh(new T.ConeGeometry(0.05, 0.1, 4), this.mat.cor); proa.rotation.z = -Math.PI / 2; proa.rotation.x = Math.PI / 4; proa.position.set(0.26, 0.03, 0);
    const deck = new T.Mesh(new T.BoxGeometry(0.3, 0.012, 0.08), this.mat.funda); deck.position.set(-0.02, 0.066, 0);
    const ponte = new T.Mesh(new T.BoxGeometry(0.07, 0.07, 0.08), this.mat.tx); ponte.position.set(-0.15, 0.1, 0);
    const chamine = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.05, 6), this.mat.hi); chamine.position.set(-0.17, 0.16, 0);
    const esteira = new T.Mesh(new T.PlaneGeometry(0.5, 0.06), this.mat.glow); esteira.rotation.x = -Math.PI / 2; esteira.position.set(-0.45, 0.004, 0);
    n.add(casco, proa, deck, ponte, chamine, esteira);
    return n;
  }
  aviao() {
    const T = this.T, a = new T.Group();
    const fus = new T.Mesh(new T.CylinderGeometry(0.018, 0.012, 0.26, 8), this.mat.tx); fus.rotation.z = Math.PI / 2;
    const asa = new T.Mesh(new T.BoxGeometry(0.06, 0.006, 0.26), this.mat.cor); asa.position.x = 0.01;
    const cauda = new T.Mesh(new T.BoxGeometry(0.03, 0.05, 0.006), this.mat.cor); cauda.position.set(-0.12, 0.025, 0);
    const lem = new T.Mesh(new T.BoxGeometry(0.03, 0.004, 0.09), this.mat.cor); lem.position.set(-0.12, 0, 0);
    a.add(fus, asa, cauda, lem);
    return a;
  }
  drone() {
    const T = this.T, d = new T.Group(), rot = [];
    const corpo = new T.Mesh(new T.BoxGeometry(0.06, 0.02, 0.06), this.mat.funda);
    d.add(corpo);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const braco = new T.Mesh(new T.BoxGeometry(0.07, 0.006, 0.008), this.mat.sec); braco.position.set(x * 0.03, 0, z * 0.03); braco.rotation.y = Math.atan2(z, x);
      const h = new T.Mesh(new T.BoxGeometry(0.07, 0.002, 0.01), this.mat.tx); h.position.set(x * 0.055, 0.012, z * 0.055);
      d.add(braco, h); rot.push(h);
    }
    const luz = new T.Mesh(new T.SphereGeometry(0.008, 6, 4), this.mat.hiGlow); luz.position.y = -0.014; d.add(luz);
    d.userData.rot = rot;
    return d;
  }
  tanque() {
    const T = this.T, t = new T.Group();
    const casco = new T.Mesh(new T.BoxGeometry(0.2, 0.05, 0.12), this.mat.funda); casco.position.y = 0.04;
    const est = new T.Mesh(new T.BoxGeometry(0.22, 0.03, 0.14), this.mat.sec); est.position.y = 0.015;
    const torre = new T.Group(); torre.position.y = 0.08;
    const cupula = new T.Mesh(new T.CylinderGeometry(0.045, 0.05, 0.035, 8), this.mat.cor);
    const cano = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.16, 6), this.mat.cor); cano.rotation.z = Math.PI / 2; cano.position.x = 0.09;
    torre.add(cupula, cano);
    t.add(est, casco, torre, this.sombraDe(0.24, 0.16));
    t.userData.torre = torre;
    return t;
  }
  missil() {
    const T = this.T, m = new T.Group();
    const corpo = new T.Mesh(new T.CylinderGeometry(0.01, 0.01, 0.1, 6), this.mat.tx); corpo.rotation.z = -Math.PI / 2;
    const ponta = new T.Mesh(new T.ConeGeometry(0.01, 0.03, 6), this.mat.hi); ponta.rotation.z = -Math.PI / 2; ponta.position.x = 0.065;
    const fogo = new T.Mesh(new T.ConeGeometry(0.016, 0.07, 6), this.mat.hiGlow); fogo.rotation.z = Math.PI / 2; fogo.position.x = -0.085;
    m.add(corpo, ponta, fogo);
    return m;
  }
  predio(rand) {
    const T = this.T, h = 0.14 + rand() * 0.34, w = 0.12 + rand() * 0.08;
    const g = new T.Group();
    const b = new T.Mesh(new T.BoxGeometry(w, h, w), rand() < 0.3 ? this.mat.cor : this.mat.funda); b.position.y = h / 2;
    g.add(b);
    const jan = new T.Mesh(new T.PlaneGeometry(w * 0.7, h * 0.8), this.mat.glow); jan.position.set(0, h / 2, w / 2 + 0.001);
    g.add(jan, this.sombraDe(w * 1.3, w * 1.3));
    g.userData.jan = jan;
    return g;
  }
  barra() {
    const T = this.T;
    if (!this._bg) { this._bg = new T.BoxGeometry(0.12, 0.035, 0.055); }
    // ouro é sempre dourado, seja qual for a paleta
    if (!this._ouro) this._ouro = new T.MeshLambertMaterial({ color: new T.Color("#E2B33C"), emissive: new T.Color("#7A5410"), emissiveIntensity: 0.25, flatShading: true });
    return new T.Mesh(this._bg, this._ouro);
  }
  nota() {
    const T = this.T;
    if (!this._ng) { this._ng = new T.PlaneGeometry(0.1, 0.05); }
    const m = new T.Mesh(this._ng, new T.MeshLambertMaterial({ color: new T.Color(this.c.tx), side: T.DoubleSide }));
    const faixa = new T.Mesh(new T.PlaneGeometry(0.03, 0.05), this.mat.hi); faixa.position.z = 0.0005; m.add(faixa);
    return m;
  }
  barril() {
    const T = this.T, b = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.08, 10), this.mat.cor);
    const aro = new T.Mesh(new T.TorusGeometry(0.031, 0.004, 4, 16), this.mat.tx); aro.rotation.x = Math.PI / 2; b.add(aro);
    return b;
  }

  terreno(tipo, rand, g) {
    const T = this.T;
    const preencher = (fn, x0, x1, z0, z1, passo, vazio) => { // espalha objetos em grade até o horizonte
      for (let x = x0; x <= x1; x += passo) for (let z = z0; z <= z1; z += passo) {
        if (vazio && vazio(x, z)) continue; fn(x + (rand() - 0.5) * passo * 0.3, z + (rand() - 0.5) * passo * 0.3); } };
    if (tipo === "mar") { // oceano/estreito até o horizonte, margens com cidades acesas
      const agua = new T.Mesh(new T.PlaneGeometry(80, 80), this.mat.agua); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.012; g.add(agua);
      for (const sz of [-1, 1]) {
        const m = new T.Mesh(new T.BoxGeometry(60, 0.1, 8), this.mat.funda); m.position.set(0, 0.05, sz * (1.15 + 4)); g.add(m);
        preencher((x, z) => { const p = this.predio(rand); p.scale.setScalar(0.6); p.position.set(x, 0.1, z); g.add(p); }, -10, 10, sz > 0 ? 1.4 : -10, sz > 0 ? 9 : -1.4, 0.7, (x, z) => Math.hypot(x, z) < 4.2);
      }
      const ondas = [];
      for (let k = 0; k < 60; k++) { const o = new T.Mesh(new T.PlaneGeometry(0.22, 0.008), this.mat.glow); o.rotation.x = -Math.PI / 2; o.position.set(-6 + rand() * 12, 0.02, -1 + rand() * 2); g.add(o); ondas.push(o); }
      return (lt) => ondas.forEach((o, k) => { o.position.x = ((o.position.x + 6 + 0.006) % 12) - 6; o.material.opacity = 0.2 + 0.2 * Math.sin(lt * 2 + k); });
    }
    if (tipo === "cidade") { // quarteirões até o horizonte, ruas com carros
      const ruas = [-0.4, 0.4, -2.6, 2.4];
      for (const z of ruas) { const rua = new T.Mesh(new T.PlaneGeometry(80, 0.3), this.mat.funda); rua.rotation.x = -Math.PI / 2; rua.position.set(0, 0.006, z); g.add(rua); }
      for (const x of [-3, 3]) { const rua = new T.Mesh(new T.PlaneGeometry(0.3, 80), this.mat.funda); rua.rotation.x = -Math.PI / 2; rua.position.set(x, 0.007, 0); g.add(rua); }
      const jan = [];
      preencher((x, z) => { const p = this.predio(rand); const k = 1 + Math.min(2.5, Math.abs(z) * 0.25); p.scale.set(k, k * (1 + rand()), k); p.position.set(x, 0, z); g.add(p); jan.push(p.userData.jan); },
        -11, 11, -12, 11, 0.55, (x, z) => Math.hypot(x, z) < 4.4 || ruas.some((r) => Math.abs(z - r) < 0.3) || Math.abs(Math.abs(x) - 3) < 0.3);
      const carros = [];
      for (let k = 0; k < 26; k++) { const c = this.carro(rand); const z = ruas[k % 4] + (k % 2 ? 0.07 : -0.07); c.position.set(-6 + rand() * 12, 0.006, z); if (k % 2) c.rotation.y = Math.PI; g.add(c); carros.push({ c, x0: c.position.x, sp: (0.35 + rand() * 0.3) * (k % 2 ? -1 : 1) }); }
      return (lt) => { jan.forEach((j, k) => { j.material.opacity = 0.25 + 0.2 * (Math.sin(lt * 1.3 + k * 1.7) > 0.6 ? 1 : 0); });
        carros.forEach((q) => { q.c.position.x = ((q.x0 + q.sp * lt + 6) % 12 + 12) % 12 - 6; }); };
    }
    if (tipo === "cofre") { // armazém: corredor de paletes até o fundo, luzes no teto
      const palete = new T.BoxGeometry(0.34, 0.3, 0.34), mp = new T.MeshLambertMaterial({ color: new T.Color("#B9AE7E"), flatShading: true });
      preencher((x, z) => { const m = new T.Mesh(palete, mp); m.position.set(x, 0.15, z); g.add(m); }, -9, 9, -12, 9, 0.42, (x, z) => Math.hypot(x, z) < 3.8 || Math.abs(x) < 0.5);
      const lampada = new T.MeshBasicMaterial({ color: 0xffffff });
      for (let z = -12; z < 3; z += 1.2) for (const x of [-2, 0, 2]) { const l = new T.Mesh(new T.BoxGeometry(0.5, 0.02, 0.08), lampada); l.position.set(x, 2.4, z); g.add(l); }
      const teto = new T.Mesh(new T.PlaneGeometry(40, 40), this.mat.plat); teto.rotation.x = Math.PI / 2; teto.position.y = 2.45; g.add(teto);
      return () => {};
    }
    // campo: lotes e árvores até o horizonte
    preencher((x, z) => { const l = new T.Mesh(new T.PlaneGeometry(0.8, 0.6), rand() < 0.5 ? this.mat.funda : this.mat.plat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.004, z); g.add(l); }, -9, 9, -10, 4, 0.9);
    const arv = new T.ConeGeometry(0.06, 0.18, 6);
    preencher((x, z) => { const a = new T.Mesh(arv, this.mat.cor); a.position.set(x, 0.09, z); g.add(a); }, -8, 8, -9, 3, 0.6, (x, z) => Math.abs(x) < 1.6 && Math.abs(z) < 0.8);
    const rua = new T.Mesh(new T.PlaneGeometry(80, 0.22), this.mat.funda); rua.rotation.x = -Math.PI / 2; rua.position.set(0, 0.008, 0.1); g.add(rua);
    return () => {};
  }

  // ---------- montagem de uma cena ----------
  montar(S, i) {
    const T = this.T, g = new T.Group(), rand = rng(1000 + i * 97), up = [];
    g.visible = false;
    this.root.add(g);
    if (S.palco !== "diorama") return { g, up };
    const tipos = (S.atores || []).map((a) => a.tipo);
    const terreno = S.terreno || (tipos.includes("navios") ? "mar" : tipos.some((t) => ["predios", "pessoas", "dinheiro", "carros", "bonecos"].includes(t)) ? "cidade" : tipos.some((t) => ["barras", "barris"].includes(t)) ? "cofre" : "campo");
    up.push(this.terreno(terreno, rand, g));
    for (const a of S.atores || []) {
      const n = Math.max(1, Math.min(a.qtd || 1, 80));
      const destaque = a.destaque ? this.mat.hi : null;
      if (a.tipo === "pessoas") {
        const ps = [];
        for (let k = 0; k < n; k++) {
          const p = this.pessoa(k === 0 && destaque ? destaque : rand() < 0.25 ? this.mat.cor : this.mat.sec);
          const x = -1.2 + rand() * 2.4, z = -0.25 + rand() * 0.5 + (a.acao === "fila" ? 0 : (rand() - 0.5) * 0.9);
          p.position.set(a.acao === "fila" ? -1.2 + (k / n) * 2.0 : x, 0.014, a.acao === "fila" ? 0.35 : z);
          p.rotation.y = a.acao === "andar" ? (rand() < 0.5 ? 0 : Math.PI) : rand() * TAU;
          g.add(p); ps.push({ p, x0: p.position.x, dir: p.rotation.y === 0 ? 1 : -1, ph: rand() * TAU, sp: 0.12 + rand() * 0.1 });
        }
        up.push((lt) => ps.forEach((q) => {
          const { be, bd } = q.p.userData;
          if (a.acao === "andar") { q.p.position.x = ((q.x0 + q.dir * q.sp * lt + 1.4) % 2.8 + 2.8) % 2.8 - 1.4; q.p.rotation.y = q.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
          if (a.acao === "fila") q.p.position.x = q.x0 + Math.min(0.4, lt * 0.05) * (Math.sin(lt * 2 + q.ph) > 0 ? 1 : 0.6);
          const bob = Math.abs(Math.sin(lt * 7 + q.ph)) * 0.012;
          q.p.position.y = 0.014 + (a.acao === "multidao" || a.acao === "protesto" ? bob * 1.6 : bob);
          const braco = a.acao === "protesto" ? -2.6 + Math.sin(lt * 5 + q.ph) * 0.4 : Math.sin(lt * 7 + q.ph) * 0.5;
          be.rotation.z = braco; bd.rotation.z = a.acao === "protesto" ? -braco : -Math.sin(lt * 7 + q.ph) * 0.5;
        }));
      } else if (a.tipo === "navios") {
        const ns = [];
        for (let k = 0; k < n; k++) { const v = this.navio(); const lane = -0.45 + (k % 3) * 0.45; v.position.set(-1.4 + rand() * 2.8, 0.014, lane); v.scale.setScalar(k === 0 && destaque ? 1.25 : 1); g.add(v); ns.push({ v, x0: v.position.x, sp: (0.07 + rand() * 0.05) * (k % 2 ? -1 : 1) }); if (ns[k].sp < 0) v.rotation.y = Math.PI; }
        up.push((lt) => ns.forEach((q, k) => { q.v.position.x = ((q.x0 + q.sp * lt + 1.5) % 3 + 3) % 3 - 1.5; q.v.position.y = 0.014 + Math.sin(lt * 2 + k) * 0.004; q.v.rotation.x = Math.sin(lt * 1.6 + k) * 0.03; }));
      } else if (a.tipo === "avioes") {
        const as = [];
        for (let k = 0; k < n; k++) { const v = this.aviao(); g.add(v); as.push({ v, r: 0.9 + rand() * 0.6, h: 0.7 + rand() * 0.5, ph: rand() * TAU, sp: 0.35 + rand() * 0.2 }); }
        up.push((lt) => as.forEach((q) => { const a2 = q.ph + lt * q.sp; q.v.position.set(Math.cos(a2) * q.r, q.h, Math.sin(a2) * q.r * 0.6); q.v.rotation.y = -a2 - Math.PI / 2; q.v.rotation.x = 0.25; }));
      } else if (a.tipo === "drones") {
        const ds = [];
        for (let k = 0; k < n; k++) { const v = this.drone(); g.add(v); ds.push({ v, x: -1 + rand() * 2, z: -0.6 + rand() * 1.2, h: 0.45 + rand() * 0.4, ph: rand() * TAU }); }
        up.push((lt) => ds.forEach((q) => { q.v.position.set(q.x + Math.sin(lt * 0.7 + q.ph) * 0.15, q.h + Math.sin(lt * 2.2 + q.ph) * 0.03, q.z + Math.cos(lt * 0.6 + q.ph) * 0.1); q.v.userData.rot.forEach((h, j) => { h.rotation.y = lt * 40 + j; }); }));
      } else if (a.tipo === "tanques") {
        const ts = [];
        for (let k = 0; k < n; k++) { const v = this.tanque(); v.position.set(-1.3 + (k / n) * 2.2, 0.014, 0.1 + (k % 2) * 0.25 - 0.12); g.add(v); ts.push({ v, x0: v.position.x, ph: rand() * TAU }); }
        up.push((lt) => ts.forEach((q) => { q.v.position.x = q.x0 + lt * 0.06; q.v.userData.torre.rotation.y = Math.sin(lt * 0.8 + q.ph) * 0.6; q.v.position.y = 0.014 + Math.abs(Math.sin(lt * 9 + q.ph)) * 0.004; }));
      } else if (a.tipo === "misseis") {
        const ms = [];
        for (let k = 0; k < n; k++) { const v = this.missil(); g.add(v); ms.push({ v, ph: k / n, x0: -1.4 + rand() * 0.4, z: -0.5 + rand(), x1: 0.9 + rand() * 0.5 }); }
        const flash = new T.Mesh(new T.SphereGeometry(0.12, 12, 8), this.mat.hiGlow); g.add(flash);
        up.push((lt) => {
          let fl = 0;
          ms.forEach((q) => {
            const u = ((lt * 0.45 + q.ph) % 1);
            const x = q.x0 + (q.x1 - q.x0) * u, y = 0.05 + Math.sin(u * Math.PI) * 0.9;
            const dx = q.x1 - q.x0, dy = Math.cos(u * Math.PI) * Math.PI * 0.9;
            q.v.position.set(x, y, q.z); q.v.rotation.z = Math.atan2(dy, dx);
            if (u > 0.9) { fl = Math.max(fl, (u - 0.9) * 10); flash.position.set(q.x1, 0.06, q.z); }
          });
          flash.scale.setScalar(0.3 + fl * 1.2); flash.material.opacity = fl * 0.8;
        });
      } else if (a.tipo === "barras") {
        const bs = [];
        // empilha num CUBO: quantas barras em x, z e altura para os três lados ficarem parecidos
        const BX = 0.125, BY = 0.037, BZ = 0.06, lado = Math.cbrt(n * BX * BY * BZ);
        const nx = Math.max(1, Math.round(lado / BX)), nz = Math.max(1, Math.round(lado / BZ)), por = nx * nz;
        for (let k = 0; k < n; k++) {
          const b = this.barra(); const camada = Math.floor(k / por), r2 = k % por;
          b.userData.alvo = new T.Vector3((r2 % nx - (nx - 1) / 2) * BX, 0.035 + camada * BY, (Math.floor(r2 / nx) - (nz - 1) / 2) * BZ);
          bs.push(b);
        }
        // o cubo ocupa a plataforma (~0.95 de largura), seja qual for o número de barras
        const pilha = new T.Group(); pilha.scale.setScalar(0.95 / (nx * BX)); bs.forEach((b) => pilha.add(b)); g.add(pilha);
        up.push((lt) => bs.forEach((b, k) => { const u = smooth((lt * 1.6 - k * (2.4 / n)) / 0.6); b.position.copy(b.userData.alvo); b.position.y += (1 - u) * 0.5; b.visible = u > 0; b.rotation.y = (1 - u) * 1.5; }));
      } else if (a.tipo === "dinheiro") {
        const ns = [];
        for (let k = 0; k < n; k++) { const m = this.nota(); g.add(m); ns.push({ m, x: -1.2 + rand() * 2.4, z: -0.7 + rand() * 1.4, ph: rand(), sp: 0.25 + rand() * 0.2 }); }
        up.push((lt) => ns.forEach((q, k) => { const u = (lt * q.sp + q.ph) % 1; q.m.position.set(q.x + Math.sin(lt * 2 + k) * 0.08, 0.75 - u * 0.73, q.z); q.m.rotation.set(lt * 2 + k, lt * 1.3 + k, 0); }));
      } else if (a.tipo === "predios") {
        for (let k = 0; k < n; k++) { const p = this.predio(rand); p.position.set(-1.2 + rand() * 2.4, 0, -0.9 + rand() * 0.5); g.add(p); }
      } else if (a.tipo === "fabrica") {
        const fum = [];
        for (let k = 0; k < Math.min(n, 4); k++) {
          const f = new T.Group(); f.position.set(-0.8 + k * 0.55, 0, -0.55);
          const corpo = new T.Mesh(new T.BoxGeometry(0.35, 0.18, 0.25), this.mat.funda); corpo.position.y = 0.09;
          const cham = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.35, 8), this.mat.cor); cham.position.set(0.1, 0.18, 0);
          f.add(corpo, cham, this.sombraDe(0.4, 0.3)); g.add(f);
          for (let j = 0; j < 6; j++) { const s = new T.Mesh(new T.IcosahedronGeometry(0.04, 0), this.mat.fumaca); g.add(s); fum.push({ s, x: f.position.x + 0.1, z: f.position.z, ph: j / 6 }); }
        }
        up.push((lt) => fum.forEach((q) => { const u = (lt * 0.35 + q.ph) % 1; q.s.position.set(q.x + u * 0.2, 0.38 + u * 0.7, q.z); q.s.scale.setScalar(0.6 + u * 1.6); q.s.material.opacity = 0.45 * (1 - u); }));
      } else if (a.tipo === "bonecos") {
        const nomes = a.nomes || [], bs = [];
        for (let k = 0; k < Math.min(n, 7); k++) {
          const b = this.boneco(k === 0 && destaque ? this.mat.funda : this.mat.funda, nomes[k]);
          b.position.set((k - (Math.min(n, 7) - 1) / 2) * 0.42, 0, k % 2 ? -0.18 : 0.05); b.rotation.y = (rand() - 0.5) * 0.5; g.add(b); bs.push({ b, ph: rand() * TAU });
        }
        up.push((lt) => bs.forEach((q, k) => { const { bracos, cab } = q.b.userData;
          bracos[0].rotation.z = -0.15 - Math.max(0, Math.sin(lt * 1.2 + q.ph)) * 0.9; bracos[1].rotation.z = 0.15;
          cab.rotation.y = Math.sin(lt * 0.9 + q.ph) * 0.35; }));
      } else if (a.tipo === "carros") {
        const cs = [];
        for (let k = 0; k < n; k++) { const c = this.carro(rand); c.position.set(-1.4 + rand() * 2.8, 0.006, k % 2 ? 0.25 : 0.4); if (k % 2) c.rotation.y = Math.PI; g.add(c); cs.push({ c, x0: c.position.x, sp: (0.3 + rand() * 0.3) * (k % 2 ? -1 : 1) }); }
        up.push((lt) => cs.forEach((q) => { q.c.position.x = ((q.x0 + q.sp * lt + 1.6) % 3.2 + 3.2) % 3.2 - 1.6; }));
      } else if (a.tipo === "barris") {
        const bs = [];
        for (let k = 0; k < n; k++) { const b = this.barril(); const r2 = Math.floor(k / 6), c2 = k % 6; b.userData.alvo = new T.Vector3(-0.2 + c2 * 0.07, 0.054 + r2 * 0.082, 0.4); g.add(b); bs.push(b); }
        up.push((lt) => bs.forEach((b, k) => { const u = smooth((lt * 1.4 - k * 0.05) / 0.5); b.position.copy(b.userData.alvo); b.position.x -= (1 - u) * 1.2; b.rotation.x = (1 - u) * 6; b.visible = u > 0; }));
      }
    }
    return { g, up };
  }

  // ---------- quadro ----------
  esconder() { this.root.visible = false; this.scene.fog = null; }
  render(t, i, lt, camera, back, z0) {
    this.root.visible = true;
    this.scene.fog = this.fog;
    this.cenas.forEach((c, k) => { c.g.visible = k === i; });
    this.cenas[i].up.forEach((f) => f(lt));
    // câmera do diorama: vista 3/4 com órbita contínua, push-in e um segundo plano no meio da cena
    const S = this.S[i];
    const mid = smooth((lt - S.d * 0.5) / 0.7);
    const az = (S.cam && S.cam.lon ? S.cam.lon : 30) * Math.PI / 180 + lt * 0.12 + mid * 0.5;
    const el = (17 + mid * 6) * Math.PI / 180;   // câmera baixa, dentro do cenário: o chão ocupa a tela toda
    const dist = this.dist(S) * (1 - lt * 0.012 - mid * 0.08);
    let x = Math.cos(az) * Math.cos(el) * dist, y = Math.sin(el) * dist, zz = Math.sin(az) * Math.cos(el) * dist;
    if (back > 0 && z0) { x += (z0.x - x) * back; y += (z0.y - y) * back; zz += (z0.z - zz) * back; }
    camera.position.set(x, y, zz);
    camera.lookAt(0, 0.22, 0);
    return { x, y, z: zz };
  }
  dist(S) { return Math.min(3.6, Math.max(2.2, (S.cam && S.cam.dist ? S.cam.dist : 3.0) * 0.95)); }
  pose0() { // câmera do frame 0 (para o loop)
    const S = this.S[0];
    const az = (S.cam && S.cam.lon ? S.cam.lon : 30) * Math.PI / 180, el = 17 * Math.PI / 180, d = this.dist(S);
    return { x: Math.cos(az) * Math.cos(el) * d, y: Math.sin(el) * d, z: Math.sin(az) * Math.cos(el) * d };
  }
}
