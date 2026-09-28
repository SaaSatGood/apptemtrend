import { problems, transformation, profiles, products, workflow, benefits, faqs, peoplePhotos } from './components/landing/data.js';

const el = (id) => document.getElementById(id);
const render = (id, html) => { const node = el(id); if (node) node.innerHTML = html; };

render('problem-cards', problems.map((text, index) => `<article class="question-card progress-card" style="--step:${index}"><span>0${index + 1}</span><h3>${text}</h3></article>`).join(''));
render('transformation-flow', transformation.map((text, index) => `<div class="flow-step"><span>0${index + 1}</span><strong>${text}</strong></div>${index < transformation.length - 1 ? '<i>→</i>' : ''}`).join(''));
render('profile-cards', profiles.map(([number, title, body]) => `<article><span>${number}</span><div><h3>${title}</h3><p>${body}</p></div></article>`).join(''));
render('product-grid', products.map(({ category, name, image }, index) => `<article class="landing-product reveal" style="--delay:${index * 70}ms"><img class="product-visual" src="${image}" alt="${name}" loading="lazy" decoding="async"><small>${category}</small><h3>${name}</h3><a class="product-status" href="./app.html?mode=signup">Ver Content Kit →</a></article>`).join(''));
render('workflow-list', workflow.map(([number, title, body]) => `<article><span>${number}</span><h3>${title}</h3><p>${body}</p></article>`).join(''));
render('benefit-grid', benefits.map(([icon, title]) => `<article class="reveal"><i>${icon}</i><h3>${title}</h3></article>`).join(''));
document.querySelectorAll('.float-product').forEach((card, index) => { const photo = peoplePhotos[index]; if (photo) card.innerHTML = `<img src="${photo.src}" alt="${photo.alt}" loading="${index === 0 ? 'eager' : 'lazy'}" decoding="async">`; });
render('audience-grid', profiles.map(([, title, body], index) => `<article class="audience-card reveal"><img src="${peoplePhotos[index]?.src||''}" alt="${title} criando um vídeo; imagem editorial ilustrativa" loading="lazy" decoding="async"><div><small>PARA COMEÇAR</small><h3>${title}</h3><p>${body}</p></div></article>`).join(''));
render('faq-list', faqs.map(([question, answer]) => `<details class="reveal"><summary>${question}<span>+</span></summary><p>${answer}</p></details>`).join(''));
render('kit-mockup', `<div class="kit-sidebar"><span class="kit-badge">CONTENT KIT</span><div class="kit-product"><div class="product-art coral">◎</div><div><small>PRODUTO</small><strong>Massageador facial</strong></div></div><nav><a class="active">Conceito</a><a>Hook</a><a>Cenas</a><a>Roteiro</a><a>Copy e CTA</a></nav></div><div class="kit-content"><section><small>CONCEITO</small><h3>Transforme uma característica simples do produto em um vídeo que desperta curiosidade.</h3></section><section class="hook-card"><small>HOOK</small><strong>“Você precisa ver isso antes de comprar...”</strong></section><section><small>CENAS</small><div class="kit-scenes"><span><b>01</b> Hook</span><span><b>02</b> Demonstração</span><span><b>03</b> Benefício</span><span><b>04</b> CTA</span></div></section><div class="kit-grid"><section><small>ROTEIRO</small><p>Comece mostrando o problema. Aproxime o produto e demonstre como ele funciona em poucos segundos.</p></section><section><small>COPY</small><p>Uma descoberta simples para transformar sua rotina.</p></section><section><small>CTA</small><p>Confira o produto no TikTok Shop.</p></section></div><div class="kit-footer"><div><small>HASHTAGS</small><p>#tiktokshop &nbsp; #achadinhos &nbsp; #produtos</p></div><div><small>ÁUDIO E DURAÇÃO</small><p>Som em alta · 27 segundos</p></div><button id="copy-kit" aria-live="polite">Copiar Content Kit</button></div></div>`);

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('visible')), { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((node) => observer.observe(node));

const menuButton = el('menu-button');
const navLinks = el('nav-links');
if (menuButton && navLinks) {
  menuButton.setAttribute('aria-controls', 'nav-links');
  menuButton.addEventListener('click', () => { const open = navLinks.classList.toggle('open'); menuButton.setAttribute('aria-expanded', String(open)); });
  document.querySelectorAll('.nav-links a').forEach((link) => link.addEventListener('click', () => { navLinks.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { navLinks.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); } });
}
document.querySelectorAll('details').forEach((item) => item.addEventListener('toggle', () => { if (item.open) document.querySelectorAll('details[open]').forEach((other) => other !== item && other.removeAttribute('open')); }));
const copyKit = el('copy-kit');
if (copyKit) copyKit.addEventListener('click', async () => { await navigator.clipboard?.writeText('Hook: Você precisa ver isso antes de comprar...\nCenas: Hook, demonstração, benefício e CTA.'); copyKit.textContent = 'Content Kit copiado ✓'; setTimeout(() => copyKit.textContent = 'Copiar Content Kit', 1800); });
