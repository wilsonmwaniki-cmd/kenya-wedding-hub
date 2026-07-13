import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const SITE_ORIGIN = 'https://www.planwithzania.com';

const routes = [
  {
    path: '/',
    title: 'Zania | Wedding Planning for Kenya & the Diaspora',
    description: 'Plan your Kenyan wedding with one shared workspace for budgets, guests, vendors, contributions, timelines, and your planning team.',
    heading: 'Plan your wedding with clarity',
    intro: 'Zania brings couples, families, planners, and trusted Kenyan wedding vendors into one beautifully organised planning workspace.',
    sections: [
      ['Everything in one place', 'Manage your wedding budget, guest list, tasks, contributions, vendors, seating plan, and event timeline without losing decisions across spreadsheets and chats.'],
      ['Built for Kenya and the diaspora', 'Plan locally or from abroad with Kenyan locations, KES-aware budgeting, collaborative roles, and practical wedding workflows.'],
      ['Start free', 'Create your wedding workspace, invite your partner or committee, and build a plan that grows with your celebration.'],
    ],
  },
  {
    path: '/pricing',
    title: 'Zania Pricing | Plans for Couples, Planners & Vendors',
    description: 'Compare Zania wedding planning plans for couples, professional planners, committees, and Kenyan wedding vendors.',
    heading: 'Simple plans for every wedding team',
    intro: 'Start with Zania for free, then upgrade when your wedding or professional workflow needs deeper collaboration and operational tools.',
    sections: [
      ['Couples', 'Organise the core wedding plan, then unlock advanced collaboration, exports, and planning tools as your wedding grows.'],
      ['Wedding planners', 'Manage client weddings, documents, timelines, vendors, and planning operations from one professional workspace.'],
      ['Wedding vendors', 'Run enquiries, bookings, documents, payments, and a discoverable vendor profile built for high-intent couples.'],
    ],
  },
  {
    path: '/planners',
    title: 'Wedding Planners in Kenya | Zania',
    description: 'Discover Kenyan wedding planners and connect with professionals who match your location, budget, and wedding needs.',
    heading: 'Find a wedding planner in Kenya',
    intro: 'Browse experienced wedding planners and find the right professional to guide your celebration from the first decision to the wedding day.',
    sections: [
      ['Search by fit', 'Compare planners by service area, location, specialties, and typical wedding budget.'],
      ['Plan together', 'Connect your Zania wedding workspace so an accepted planner can collaborate with the right context.'],
      ['Kenyan wedding expertise', 'Find professionals who understand local venues, vendors, traditions, logistics, and diaspora planning.'],
    ],
  },
  {
    path: '/vendors-directory',
    title: 'Kenyan Wedding Vendors Directory | Zania',
    description: 'Discover wedding venues, photographers, caterers, decorators, entertainers, and other trusted wedding vendors across Kenya.',
    heading: 'Discover wedding vendors across Kenya',
    intro: 'Explore Kenyan wedding businesses by category and location, then shortlist the right team for your celebration.',
    sections: [
      ['Browse wedding categories', 'Find venues, photographers, videographers, caterers, decorators, florists, entertainment, beauty, transport, attire, and more.'],
      ['Compare practical details', 'Review locations, services, business profiles, and portfolio information before making contact.'],
      ['Build your vendor team', 'Bring selected vendors into your Zania workspace so contracts, payments, tasks, and decisions stay organised.'],
    ],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Zania',
    description: 'Read how Zania collects, uses, protects, and manages personal data for couples, wedding professionals, vendors, and guests.',
    heading: 'Zania privacy policy',
    intro: 'Learn how Zania handles personal data, wedding information, account security, privacy choices, and data requests.',
    sections: [
      ['Your information', 'Zania processes account and wedding information to provide planning, collaboration, directory, and communication features.'],
      ['Your choices', 'You can manage profile visibility, marketing preferences, and eligible data access or deletion requests.'],
    ],
  },
  {
    path: '/terms',
    title: 'Terms of Service | Zania',
    description: 'Read the terms governing use of Zania wedding planning, professional, vendor, directory, collaboration, and payment features.',
    heading: 'Zania terms of service',
    intro: 'These terms explain the rules and responsibilities that apply when using Zania and its wedding planning services.',
    sections: [
      ['Using Zania', 'Accounts must be used lawfully and with accurate information appropriate to the selected couple, planner, committee, or vendor role.'],
      ['Platform responsibilities', 'The terms cover subscriptions, directory content, collaboration, communications, acceptable use, and service availability.'],
    ],
  },
];

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function snapshotMarkup(route) {
  const sections = route.sections.map(([title, copy]) => `
      <section>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(copy)}</p>
      </section>`).join('');

  return `<main data-prerendered="true" style="max-width:72rem;margin:0 auto;padding:4rem 1.5rem;font-family:Georgia,serif;color:#2f221d">
    <header>
      <p style="letter-spacing:.22em;text-transform:uppercase;color:#9a5b3c">Zania · Kenya &amp; Diaspora Planning</p>
      <h1 style="font-size:clamp(2.5rem,7vw,5.5rem);line-height:1.02;margin:.75rem 0 1rem">${escapeHtml(route.heading)}</h1>
      <p style="max-width:48rem;font:1.2rem/1.7 system-ui,sans-serif;color:#68584f">${escapeHtml(route.intro)}</p>
    </header>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:1rem;margin-top:3rem">${sections}
    </div>
    <nav aria-label="Public pages" style="margin-top:3rem;font:1rem system-ui,sans-serif">
      <a href="/">Home</a> · <a href="/pricing">Pricing</a> · <a href="/planners">Wedding planners</a> · <a href="/vendors-directory">Wedding vendors</a>
    </nav>
  </main>`;
}

function replaceMeta(html, route) {
  const canonicalUrl = `${SITE_ORIGIN}${route.path === '/' ? '' : route.path}`;
  return html
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(route.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(route.description)}" />`)
    .replace('<meta name="robots" content="noindex, nofollow" />', '<meta name="robots" content="index, follow, max-image-preview:large" />')
    .replace(/<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(route.description)}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(route.title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(route.description)}" />`)
    .replace('</head>', `    <link rel="canonical" href="${canonicalUrl}" />\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${snapshotMarkup(route)}</div>`);
}

const baseHtml = await readFile(path.join(DIST_DIR, 'index.html'), 'utf8');
// Keep a noindex SPA shell for authenticated, tokenized, and unknown routes.
// Public static directories take precedence over the Vercel fallback rewrite.
await writeFile(path.join(DIST_DIR, 'spa.html'), baseHtml);

for (const route of routes) {
  const outputDirectory = route.path === '/'
    ? DIST_DIR
    : path.join(DIST_DIR, route.path.slice(1));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'index.html'), replaceMeta(baseHtml, route));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${SITE_ORIGIN}${route.path}</loc></url>`).join('\n')}
</urlset>
`;

await writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
console.log(`Prerendered ${routes.length} public routes and generated sitemap.xml`);
