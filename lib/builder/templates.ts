import type { Files, ProjectType } from './files'
export const templates = [
  {
    id: 'studio',
    name: 'Forma Studio',
    category: 'Portfolio',
    description: 'An editorial home for your work.',
    color: '#c4bea9'
  },
  {
    id: 'business',
    name: 'Evergreen',
    category: 'Business',
    description: 'A thoughtful start for a small business.',
    color: '#a6c7ae'
  },
  {
    id: 'store',
    name: 'Objects & Co.',
    category: 'Store',
    description: 'A product collection with a working cart.',
    color: '#d6b69b'
  },
  {
    id: 'dashboard',
    name: 'Daylight',
    category: 'Dashboard',
    description: 'A calm dashboard with interactive tasks.',
    color: '#b3bce1'
  },
  {
    id: 'personal',
    name: 'Little Things',
    category: 'Personal',
    description: 'A personal space for notes and ideas.',
    color: '#d7bec9'
  }
] as const
export function templateFiles(
  id: string,
  type: ProjectType = 'website'
): Files {
  const item = templates.find(t => t.id === id)
  if (!item) throw new Error('Template not found.')
  const content =
    id === 'studio'
      ? `<nav><b>FORMA®</b><a href="#work">Selected work ↗</a></nav><section class="hero"><small>INDEPENDENT DESIGN STUDIO · TEMPLATE</small><h1>Good things<br>take <em>shape.</em></h1><p>A considered home for ideas, objects and the people behind them.</p><a class="button" href="#work">Explore the work ↗</a></section><section id="work" class="grid"><article class="sculpture"><div class="orb"></div><h2>Objects in motion</h2><p>Example project · Replace with your work</p></article><article class="sculpture second"><div class="arch"></div><h2>A different perspective</h2><p>Example project · Your story starts here</p></article></section>`
      : id === 'store'
        ? `<nav><b>OBJECTS & CO.</b><button id="cart">Bag <span id="count">0</span></button></nav><section class="hero"><small>THOUGHTFUL OBJECTS · STORE TEMPLATE</small><h1>Less, but<br><em>lovelier.</em></h1><p>A demonstration collection. No payments or real orders are processed.</p></section><section class="grid">${['The everyday cup', 'The soft light', 'The quiet vase'].map((x, i) => `<article><div class="product p${i}"><div class="orb"></div></div><h2>${x}</h2><p>Sample product · ₹${[450, 1200, 850][i]}</p><button class="button add">Add to bag +</button></article>`).join('')}</section><dialog id="bag"><h2>Your sample bag</h2><p id="bagtext">Your bag is empty.</p><button onclick="document.querySelector('dialog').close()">Keep exploring</button></dialog>`
        : id === 'dashboard'
          ? `<nav><b>☀ DAYLIGHT</b><span>Your personal overview</span></nav><section class="hero"><small>DASHBOARD TEMPLATE · SAMPLE DATA</small><h1>A little focus.<br><em>A better day.</em></h1></section><section class="grid"><article class="panel"><h2>Today's intentions</h2>${['Make room for a good idea', 'Finish one small thing', 'Step outside for a moment'].map(x => `<label><input type="checkbox"> ${x}</label>`).join('')}<form id="taskform"><input id="task" placeholder="Add your own intention" required><button>Add</button></form><div id="tasks"></div></article><article class="panel"><small>YOUR MOMENT</small><h2 id="clock"></h2><p>These intentions stay in this preview until it is reloaded.</p></article></section>`
          : id === 'personal'
            ? `<nav><b>LITTLE THINGS</b><span>A space for your thoughts</span></nav><section class="hero"><small>PERSONAL JOURNAL · TEMPLATE</small><h1>Some ideas<br>need <em>a home.</em></h1><p>Write a thought. Keep it for this visit.</p></section><form id="noteform"><textarea id="note" placeholder="What's on your mind?" required></textarea><button class="button">Add a note ↗</button></form><section id="notes" class="grid"></section>`
            : `<nav><b>EVERGREEN</b><a href="#contact">Let's talk ↗</a></nav><section class="hero"><small>LOCAL BUSINESS · TEMPLATE</small><h1>Built on care.<br><em>Made to last.</em></h1><p>Introduce your business with clarity, warmth and a little personality.</p><a class="button" href="#contact">Start a conversation ↗</a></section><section class="grid"><article class="panel"><small>WHAT WE DO</small><h2>Thoughtful service</h2><p>Replace this example with what makes your business useful.</p></article><article class="panel"><small>HOW WE WORK</small><h2>People come first</h2><p>Tell visitors what they can expect, in your own words.</p></article></section><section id="contact" class="panel"><h2>Let's make something good.</h2><p>Add your verified contact details here before publishing.</p></section>`
  const css = `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;padding:0 6%;background:#f0ede5;color:#24302e;font-family:Arial,sans-serif}nav{display:flex;justify-content:space-between;align-items:center;padding:28px 0;border-bottom:1px solid #24302e30;font-size:12px}nav b{letter-spacing:.14em}a{color:inherit;text-decoration:none}.hero{padding:64px 0 42px;max-width:880px}small{font-size:10px;letter-spacing:.18em}h1{font-weight:400;font-size:clamp(45px,9vw,96px);line-height:1.02;letter-spacing:-.065em;margin:28px 0}em{font-family:Georgia,serif;color:#617a64}p{font-size:14px;line-height:1.7;color:#58635d;max-width:430px}.button{display:inline-block;background:#2b4439;color:#f1f4ed;padding:14px 22px;border:0;border-radius:30px;margin-top:15px;font-size:12px}button{cursor:pointer;border:1px solid #24302e30;padding:10px 16px;background:transparent;border-radius:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin:10px 0 55px}h2{font-size:21px;font-weight:400}.sculpture,.panel{padding:28px;background:#e1e2d7;border-radius:12px}.second{background:#d5dce1}.orb{width:110px;height:110px;border-radius:50%;margin:25px auto;background:linear-gradient(140deg,#faf6e9,#7b8a75);box-shadow:20px 22px 25px #24302e20}.arch{width:110px;height:130px;border:22px solid #8797a2;border-bottom:0;border-radius:70px 70px 0 0;margin:20px auto}.product{padding:20px;background:#e3d8c8;border-radius:12px}.p1{background:#d6dfd5}.p2{background:#ddccd0}.p1 .orb{border-radius:60px 60px 10px 10px}.p2 .orb{border-radius:20% 20% 45% 45%}.panel label{display:block;padding:12px 0;border-bottom:1px solid #24302e20}label:has(input:checked){text-decoration:line-through;opacity:.6}input,textarea{font:inherit;padding:12px;border:1px solid #24302e30;border-radius:8px;background:#ffffff55;max-width:100%}textarea{width:100%;min-height:100px}form{margin:20px 0}dialog{border:0;border-radius:20px;padding:32px;max-width:90%}:focus-visible{outline:3px solid #617a64;outline-offset:4px}@media(max-width:500px){nav span{font-size:10px}.hero{padding-top:45px}.grid{grid-template-columns:1fr}.sculpture{min-height:230px}}`
  const js =
    id === 'store'
      ? `let count=0;document.querySelectorAll('.add').forEach(b=>b.onclick=()=>{count++;document.querySelector('#count').textContent=count;b.textContent='Added ✓'});document.querySelector('#cart').onclick=()=>{document.querySelector('#bagtext').textContent=count?count+' sample items in your bag. Checkout is not connected.':'Your bag is empty.';document.querySelector('#bag').showModal()};`
      : id === 'dashboard'
        ? `document.querySelector('#clock').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});document.querySelector('#taskform').onsubmit=e=>{e.preventDefault();const label=document.createElement('label');const box=document.createElement('input');box.type='checkbox';label.append(box,document.createTextNode(' '+document.querySelector('#task').value));document.querySelector('#tasks').append(label);e.target.reset()};`
        : id === 'personal'
          ? `document.querySelector('#noteform').onsubmit=e=>{e.preventDefault();const card=document.createElement('article');card.className='panel';card.textContent=document.querySelector('#note').value;document.querySelector('#notes').prepend(card);e.target.reset()};`
          : ''
  const files: Files = {
    'index.html': `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${item.name}</title><link rel="stylesheet" href="style.css"></head><body>${content}<footer><p>${item.name} · A NOVA starter template</p></footer><script src="app.js"></script></body></html>`,
    'style.css': css,
    'app.js': js,
    'README.md': `# ${item.name}\n\nCreated from a NOVA template. Sample content is clearly labelled. Edit the HTML, CSS and JavaScript, then serve this folder with any static web server. No dependencies are required.\n\nNo backend, payments or email delivery is included.\n`
  }
  if (type === 'pwa') {
    files['manifest.json'] = JSON.stringify(
      {
        name: item.name,
        short_name: item.name,
        start_url: './',
        display: 'standalone',
        background_color: '#f0ede5',
        theme_color: '#2b4439',
        icons: [
          {
            src:
              'data:image/svg+xml,' +
              encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="40" fill="#2b4439"/><text x="96" y="125" text-anchor="middle" font-size="90" fill="#f0ede5">N</text></svg>'
              ),
            sizes: '192x192',
            type: 'image/svg+xml'
          }
        ]
      },
      null,
      2
    )
    files['sw.js'] = "self.addEventListener('fetch',()=>{});"
    files['README.md'] +=
      '\nPWA source: add the manifest link and register sw.js when deploying on your own HTTPS origin. NOVA preview is sandboxed and does not install a native app. Native signing and app-store publishing are not included.\n'
  }
  return files
}
