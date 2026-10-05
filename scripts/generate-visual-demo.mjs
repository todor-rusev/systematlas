                                                                               
                                                                                              
                                                                    
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SHAPES, ICONS, ICON_NAMES, LINE_STYLES, END_MARKERS } from '../src/core/visual-vocabulary.ts';
import { ICON_PATHS } from '../src/core/icon-paths.ts';
import { validateDoc } from '../src/core/validate-doc.ts';

const actors = [
  { id: 'customer', label: 'Customer', kind: 'human' },
  { id: 'shop', label: 'Online shop', kind: 'service' },
  { id: 'payment', label: 'Payments', kind: 'service' },
  { id: 'data', label: 'Data', kind: 'infra' },
  { id: 'warehouse', label: 'Warehouse', kind: 'system' },
  { id: 'delivery', label: 'Courier', kind: 'service' },
];
const docs = [];
function flow(id, title, nodes, edges, overview, layout = 'TB') {
  const owners = new Set(nodes.map(n => n.owner));
  const doc = {
    $schema: '../../schema/flow.schema.json', version: '1', id, title, layout,
    overview: [overview], actors: actors.filter(a => owners.has(a.id)), nodes, edges,
  };
  docs.push(doc);
  return doc;
}
const node = (id, label, owner, extra, description) =>
  ({ id, type: 'step', label, owner, description: [description], ...extra });
const builtin = (name) => ({ kind: 'builtin', name });
const edge = (from, to, extra = {}) => ({ from, to, type: 'flow', ...extra });

                                                                                                 
                                                                                         
const picture = (icon) => ({ kind: 'svg', viewBox: [-6, -6, 36, 36], paths: [
  { d: 'M-6 12a18 18 0 1 0 36 0a18 18 0 1 0 -36 0', fill: '#FFFFFF', stroke: 'none' },
  ...ICON_PATHS[icon].map(d => ({ d, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 })),
] });

                                                                                            
flow('demo-01-order', '01 · Online shop order', [
  { ...node('order', 'Customer orders', 'customer', { icon: builtin('user') }, 'The customer picks products and presses “Order”.'), type: 'terminal' },
  node('checkout', 'Cart and address', 'shop', { icon: builtin('browser') }, 'The shop collects the cart, the address and the delivery method.'),
  node('pay', 'Payment', 'payment', { type: 'subflow', subflow: 'demo-02-payment', icon: builtin('lock') }, 'Payment is a separate process: Open shows its steps.'),
  { ...node('approved', 'Approved?', 'payment', {}, 'The payment result decides the path.'), type: 'decision' },
  { ...node('declined', 'Declined', 'customer', { icon: builtin('error') }, 'The customer sees the reason and can try again.'), type: 'terminal' },
  node('fulfil', 'Warehouse and delivery', 'warehouse', { type: 'subflow', subflow: 'demo-03-fulfilment', icon: builtin('package') }, 'Packing and delivery: Open shows the pictures of the process.'),
  node('mail', 'Email: order shipped', 'shop', { icon: builtin('mail') }, 'Sent asynchronously; it does not hold up the process.'),
  { ...node('done', 'Delivered', 'customer', { icon: builtin('check') }, 'The customer receives the parcel.'), type: 'terminal' },
], [
  edge('order', 'checkout'),
  edge('checkout', 'pay'),
  edge('pay', 'approved'),
  { from: 'approved', to: 'fulfil', type: 'branch', label: 'yes' },
  { from: 'approved', to: 'declined', type: 'branch', label: 'no' },
  edge('fulfil', 'done'),
  edge('fulfil', 'mail', { label: 'async', style: { line: 'dotted' } }),
], 'A complete six-step process: a decision, a rejection, an asynchronous notification and two drill-downs into sub-processes (Payment also leads to a Sequence; the database and the queue live there).');

                                                                                                
flow('demo-02-payment', '02 · Payment', [
  { ...node('start', 'Amount to pay', 'shop', { icon: builtin('play') }, 'The amount and currency come from the cart.'), type: 'terminal' },
  node('token', 'Card token', 'payment', { shape: 'cache', icon: builtin('cache') }, 'A saved token, so the card is not entered again.'),
  node('fraud', 'Fraud check', 'payment', { shape: 'hex', icon: builtin('shield') }, 'Rules and limits before the request goes to the bank.'),
  node('gateway', 'Bank API', 'payment', { shape: 'api', icon: builtin('api'), sequence: 'demo-18-execution' }, 'Request to the payment provider; Open shows the exact calls.'),
  { ...node('ok', 'Success?', 'payment', {}, 'The bank’s response.'), type: 'decision' },
  node('ledger', 'Ledger entry', 'data', { shape: 'cyl', icon: builtin('database') }, 'The payment is recorded in the accounting database.'),
  node('events', 'Event queue', 'data', { shape: 'queue', icon: builtin('queue') }, 'The “paid” event goes to the warehouse and accounting.'),
  { ...node('end', 'Paid', 'shop', { icon: builtin('check') }, 'Returns to the main process.'), type: 'terminal' },
], [
  edge('start', 'token'), edge('token', 'fraud'), edge('fraud', 'gateway'), edge('gateway', 'ok'),
  { from: 'ok', to: 'ledger', type: 'branch', label: 'yes' },
  { from: 'ok', to: 'gateway', type: 'return', label: 'retry' },
  edge('ledger', 'events', { label: 'async', style: { line: 'dotted' } }),
  edge('ledger', 'end'),
], 'The payment sub-process: a cache, rules, an external API with retry, a database and a queue.');

                                                                                              
flow('demo-03-fulfilment', '03 · Warehouse and delivery', [
  node('pick', 'Pick from shelf', 'warehouse', { shape: 'image', icon: picture('archive') }, 'The warehouse picks the products on the list.'),
  node('pack', 'Packing', 'warehouse', { shape: 'image', icon: picture('package') }, 'The products are packed and the parcel is labelled.'),
  node('label', 'Shipping label', 'delivery', { shape: 'doc', icon: builtin('file') }, 'The courier generates the shipping label.'),
  node('courier', 'Courier departs', 'delivery', { shape: 'image', icon: picture('send') }, 'The parcel is on its way.'),
  node('track', 'Tracking', 'customer', { shape: 'image', icon: picture('eye') }, 'The customer tracks the parcel.'),
  node('handover', 'Handover', 'customer', { shape: 'icon', icon: { kind: 'emoji', text: '🎉' } }, 'The parcel reaches the customer.'),
], [
  edge('pick', 'pack'), edge('pack', 'label'), edge('label', 'courier'),
  edge('courier', 'track', { label: 'notification', style: { line: 'dotted' } }), edge('courier', 'handover'),
], 'Pictures: duotone illustrations in the same geometry as the icons, an emoji and a document.', 'LR');

                                                                                            
const sample = (id, label, shape, icon, index) => ({ id, type: 'step', label, shape, owner: actors[index % actors.length].id,
  ...(icon ? { icon } : {}), description: [`Demo element: ${label.replaceAll('\n', ' / ')}.`] });
const grid = (nodes, columns = 3) => nodes.slice(columns).map((n, i) => ({ from: nodes[i].id, to: n.id, type: 'flow',
  style: { line: 'invisible', end: 'none' }, description: ['Only arranges the gallery; it does not describe a real process.'] }));
const number = () => String(docs.length + 1).padStart(2, '0');

const groups = [
  ['Processes and decisions', ['rect', 'rounded', 'stadium', 'diam', 'fr-rect', 'hex', 'odd']],
  ['Data and storage', ['lean-r', 'lean-l', 'cyl', 'h-cyl', 'lin-cyl', 'bow-rect', 'datastore', 'cache']],
  ['Documents and folders', ['doc', 'docs', 'lin-doc', 'tag-doc', 'notch-rect', 'folder', 'flag']],
  ['Operations and input', ['st-rect', 'lin-rect', 'div-rect', 'tag-rect', 'win-pane', 'sl-rect', 'trap-t', 'trap-b', 'notch-pent']],
  ['Events and integrations', ['delay', 'tri', 'flip-tri', 'hourglass', 'queue', 'timer', 'api']],
  ['Circles and symbols', ['circle', 'dbl-circ', 'fr-circ', 'cross-circ', 'sm-circ', 'f-circ', 'fork', 'bolt', 'bang']],
  ['Comments and context', ['brace', 'brace-r', 'braces', 'text', 'cloud', 'curv-trap']],
  ['Interfaces and pictures', ['browser', 'console', 'bucket', 'person', 'icon', 'image']],
];
                                                                             
                                                                      
const shapeCaptions = {
  rect: 'Process', rounded: 'Event', stadium: 'Start / end', diam: 'Decision',
  'fr-rect': 'Subprocess', hex: 'Preparation', odd: 'Asymmetric process',
  'lean-r': 'Input / output', 'lean-l': 'Output / input', cyl: 'Database',
  'h-cyl': 'Direct access', 'lin-cyl': 'Disk storage', 'bow-rect': 'Stored data',
  datastore: 'Data store', cache: 'Cache', doc: 'Document', docs: 'Documents',
  'lin-doc': 'Lined document', 'tag-doc': 'Tagged document', 'notch-rect': 'Card',
  folder: 'Folder', flag: 'Paper tape', 'st-rect': 'Multiple processes',
  'lin-rect': 'Lined process', 'div-rect': 'Divided process', 'tag-rect': 'Tagged process',
  'win-pane': 'Internal storage', 'sl-rect': 'Manual input', 'trap-t': 'Manual operation',
  'trap-b': 'Priority', 'notch-pent': 'Loop limit', delay: 'Delay',
  tri: 'Extract', 'flip-tri': 'Manual file', hourglass: 'Collate', queue: 'Queue',
  timer: 'Timer', api: 'API', circle: 'Start', 'dbl-circ': 'End', 'fr-circ': 'Stop',
  'cross-circ': 'Summary', 'sm-circ': 'Small start', 'f-circ': 'Junction', fork: 'Fork',
  bolt: 'Communication', bang: 'Attention', brace: 'Comment on the left',
  'brace-r': 'Comment on the right', braces: 'Comment', text: 'Free text',
  cloud: 'Cloud', 'curv-trap': 'Display', browser: 'Browser', console: 'Console',
  bucket: 'Object storage', person: 'Person', icon: 'Icon', image: 'Picture',
};
if (Object.keys(shapeCaptions).sort().join() !== Object.keys(SHAPES).sort().join())
  throw new Error('Every vocabulary shape needs a human demo caption.');
for (const [title, shapes] of groups) {
  const n = number();
  const nodes = shapes.map((shape, i) => ({
    ...sample(shape, shapeCaptions[shape], shape,
      shape === 'image' ? picture('globe') : shape === 'icon' ? { kind: 'emoji', text: '🎨' } : undefined, i),
    description: [SHAPES[shape], `Exact value: shape: "${shape}".`],
  }));
  flow(`demo-${n}-shapes`, `${n} · Shapes: ${title}`, nodes, grid(nodes),
    'Semantic shapes with short captions. Select an element to see its exact shape value in Details. Invisible links only arrange the gallery.');
}

{
  const n = number();
  const lineNodes = LINE_STYLES.flatMap((line, i) => [
    sample(`${line}-from`, line, 'rounded', builtin('send'), i),
    sample(`${line}-to`, line === 'invisible' ? 'Layout only' : 'Receiver', 'rounded', builtin('check'), i),
  ]);
  flow(`demo-${n}-lines`, `${n} · Lines, widths and ends`, lineNodes, LINE_STYLES.map((line, i) => ({
    from: `${line}-from`, to: `${line}-to`, type: i === 3 ? 'return' : i === 2 ? 'branch' : 'flow',
    label: line, style: { line, width: i % 2 ? 'thick' : 'normal', start: END_MARKERS[i % 4], end: END_MARKERS[(i + 1) % 4] },
  })), 'All six styles, normal/thick and arrow/none/circle/cross. Invisible arranges elements without a visible line.', 'LR');
}

for (let page = 0; page < 5; page++) {
  const n = number();
  const nodes = ICON_NAMES.slice(page * 10, page * 10 + 10).map((name, i) => ({
    ...sample(name, name, 'rounded', builtin(name), i),
    description: [ICONS[name].description, `icon: {kind: "builtin", name: "${name}"}`],
  }));
  flow(`demo-${n}-icons`, `${n} · Icons ${page * 10 + 1}–${page * 10 + nodes.length}`, nodes, grid(nodes),
    'A gallery of the built-in icons (Lucide). The caption is the exact icon.name; its meaning is in Details.');
}

docs.push({
  $schema: '../../schema/sequence.schema.json', version: '1', kind: 'sequence',
  id: 'demo-18-execution', title: '18 · Sequence: bank API request', actors: actors.slice(1, 4),
  overview: ['Drill-down from “Bank API”. Nested calls, a self-call, an async notification, request/response and two phases.'],
  phases: [{ id: 'authorize', label: 'Authorization' }, { id: 'record', label: 'Recording' }],
  calls: [{ id: 'charge', from: 'shop', to: 'payment', method: 'charge', phase: 'authorize',
    description: ['The shop requests a payment.'], request: '{ amount: 4990, currency: "EUR" }', response: '{ status: "approved" }',
    returnType: 'Charge', children: [
      { id: 'validate', from: 'payment', to: 'payment', method: 'validateToken', phase: 'authorize', description: ['Self-call: token validation.'] },
      { id: 'limits', from: 'payment', to: 'data', method: 'readLimits', phase: 'authorize', description: ['The customer’s limits.'], returnType: 'Limits' },
      { id: 'persist', from: 'payment', to: 'data', method: 'saveCharge', phase: 'record', description: ['Records the payment.'], returnType: 'ChargeId' },
      { id: 'notify', from: 'payment', to: 'shop', method: 'chargeSucceeded', phase: 'record', async: true, description: ['Asynchronous event to the shop.'] },
    ],
  }],
});
if (docs.at(-1).id !== `demo-${String(docs.length).padStart(2, '0')}-execution`) throw new Error('Sequence number drifted from the document count');

const root = new URL('../', import.meta.url);
const folder = new URL('examples/visual-demo/', root);
const fileOf = doc => `${doc.id}.${doc.kind === 'sequence' ? 'sequence' : 'flow'}.json`;
const outputs = docs.map(doc => [new URL(fileOf(doc), folder), JSON.stringify(doc, null, 2) + '\n']);
outputs.push([new URL('src/data/visual-demo.ts', root),
  docs.map((doc, i) => `import doc${i} from "../../examples/visual-demo/${fileOf(doc)}";`).join('\n') +
  `\n\nexport const visualDemoDocs = [${docs.map((_, i) => `doc${i}`).join(', ')}];\n`]);
for (const doc of docs) {
  const result = validateDoc(doc, docs);
  if (!result.ok) throw new Error(`${doc.id}: ${JSON.stringify(result)}`);
}
const checking = process.argv.includes('--check');
if (!checking) await mkdir(folder, { recursive: true });
                                                                                
const expected = new Set(docs.map(fileOf));
const stale = (await readdir(folder)).filter(name => /^demo-.*\.json$/.test(name) && !expected.has(name));
if (checking && stale.length) throw new Error(`Stale demo files: ${stale.join(', ')}`);
for (const name of stale) await unlink(new URL(name, folder));
for (const [url, content] of outputs) {
  if (checking) {
                                                                                   
    if ((await readFile(url, 'utf8')).replaceAll('\r\n', '\n') !== content)
      throw new Error(`Stale demo: ${fileURLToPath(url)}`);
  } else await writeFile(url, content);
}
console.log(`${checking ? 'Checked' : 'Generated'} ${docs.length} documents and the dev catalogue.`);
