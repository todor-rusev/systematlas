                                                                               
                                                                                              
                                                                    
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { SHAPES, ICONS, ICON_NAMES, LINE_STYLES, END_MARKERS } from '../src/core/visual-vocabulary.ts';
import { ICON_PATHS } from '../src/core/icon-paths.ts';
import { validateDoc } from '../src/core/validate-doc.ts';

const actors = [
  { id: 'customer', label: 'Клиент', kind: 'human' },
  { id: 'shop', label: 'Онлайн магазин', kind: 'service' },
  { id: 'payment', label: 'Плащания', kind: 'service' },
  { id: 'data', label: 'Данни', kind: 'infra' },
  { id: 'warehouse', label: 'Склад', kind: 'system' },
  { id: 'delivery', label: 'Куриер', kind: 'service' },
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

                                                                                            
flow('demo-01-order', '01 · Поръчка в онлайн магазин', [
  { ...node('order', 'Клиентът поръчва', 'customer', { icon: builtin('user') }, 'Клиентът избира продукти и натиска „Поръчай“.'), type: 'terminal' },
  node('checkout', 'Количка и адрес', 'shop', { icon: builtin('browser') }, 'Магазинът събира количката, адреса и начина на доставка.'),
  node('pay', 'Плащане', 'payment', { type: 'subflow', subflow: 'demo-02-payment', icon: builtin('lock') }, 'Плащането е отделен процес: Open показва стъпките му.'),
  { ...node('approved', 'Одобрено?', 'payment', {}, 'Резултатът от плащането решава пътя.'), type: 'decision' },
  { ...node('declined', 'Отказано', 'customer', { icon: builtin('error') }, 'Клиентът вижда причината и може да опита пак.'), type: 'terminal' },
  node('fulfil', 'Склад и доставка', 'warehouse', { type: 'subflow', subflow: 'demo-03-fulfilment', icon: builtin('package') }, 'Опаковане и доставка: Open показва картинките на процеса.'),
  node('mail', 'Имейл: пратката е тръгнала', 'shop', { icon: builtin('mail') }, 'Изпраща се асинхронно; не спира процеса.'),
  { ...node('done', 'Доставено', 'customer', { icon: builtin('check') }, 'Клиентът получава пратката.'), type: 'terminal' },
], [
  edge('order', 'checkout'),
  edge('checkout', 'pay'),
  edge('pay', 'approved'),
  { from: 'approved', to: 'fulfil', type: 'branch', label: 'да' },
  { from: 'approved', to: 'declined', type: 'branch', label: 'не' },
  edge('fulfil', 'done'),
  edge('fulfil', 'mail', { label: 'async', style: { line: 'dotted' } }),
], 'Завършен процес в шест стъпки: решение, отказ, асинхронно известие и два drill-down към под-процеси (Плащане води и до Sequence; базата и опашката са там).');

                                                                                                
flow('demo-02-payment', '02 · Плащане', [
  { ...node('start', 'Сума за плащане', 'shop', { icon: builtin('play') }, 'Сумата и валутата идват от количката.'), type: 'terminal' },
  node('token', 'Токен на картата', 'payment', { shape: 'cache', icon: builtin('cache') }, 'Запазен токен — картата не се въвежда повторно.'),
  node('fraud', 'Проверка за измама', 'payment', { shape: 'hex', icon: builtin('shield') }, 'Правила и лимити преди изпращане към банката.'),
  node('gateway', 'Банков API', 'payment', { shape: 'api', icon: builtin('api'), sequence: 'demo-18-execution' }, 'Заявка към платежния доставчик; Open показва точните извиквания.'),
  { ...node('ok', 'Успех?', 'payment', {}, 'Отговорът на банката.'), type: 'decision' },
  node('ledger', 'Счетоводен запис', 'data', { shape: 'cyl', icon: builtin('database') }, 'Плащането се записва в счетоводната база.'),
  node('events', 'Опашка за събития', 'data', { shape: 'queue', icon: builtin('queue') }, 'Събитието „платено“ отива към склада и счетоводството.'),
  { ...node('end', 'Платено', 'shop', { icon: builtin('check') }, 'Връща се към основния процес.'), type: 'terminal' },
], [
  edge('start', 'token'), edge('token', 'fraud'), edge('fraud', 'gateway'), edge('gateway', 'ok'),
  { from: 'ok', to: 'ledger', type: 'branch', label: 'да' },
  { from: 'ok', to: 'gateway', type: 'return', label: 'повтори' },
  edge('ledger', 'events', { label: 'async', style: { line: 'dotted' } }),
  edge('ledger', 'end'),
], 'Под-процесът на плащането: кеш, правила, външен API с повторен опит, база и опашка.');

                                                                                              
flow('demo-03-fulfilment', '03 · Склад и доставка', [
  node('pick', 'Събиране от рафта', 'warehouse', { shape: 'image', icon: picture('archive') }, 'Складът събира продуктите по списъка.'),
  node('pack', 'Опаковане', 'warehouse', { shape: 'image', icon: picture('package') }, 'Продуктите се опаковат и пратката се етикетира.'),
  node('label', 'Товарителница', 'delivery', { shape: 'doc', icon: builtin('file') }, 'Куриерът генерира товарителница.'),
  node('courier', 'Куриерът тръгва', 'delivery', { shape: 'image', icon: picture('send') }, 'Пратката е на път.'),
  node('track', 'Проследяване', 'customer', { shape: 'image', icon: picture('eye') }, 'Клиентът следи пратката.'),
  node('handover', 'Предаване', 'customer', { shape: 'icon', icon: { kind: 'emoji', text: '🎉' } }, 'Пратката е при клиента.'),
], [
  edge('pick', 'pack'), edge('pack', 'label'), edge('label', 'courier'),
  edge('courier', 'track', { label: 'известие', style: { line: 'dotted' } }), edge('courier', 'handover'),
], 'Картинки: duotone илюстрации в същата геометрия като иконките, emoji и документ.', 'LR');

                                                                                            
const sample = (id, label, shape, icon, index) => ({ id, type: 'step', label, shape, owner: actors[index % actors.length].id,
  ...(icon ? { icon } : {}), description: [`Демонстрационен елемент: ${label.replaceAll('\n', ' / ')}.`] });
const grid = (nodes, columns = 3) => nodes.slice(columns).map((n, i) => ({ from: nodes[i].id, to: n.id, type: 'flow',
  style: { line: 'invisible', end: 'none' }, description: ['Само за подреждане на галерията; не описва реален процес.'] }));
const number = () => String(docs.length + 1).padStart(2, '0');

const groups = [
  ['Процеси и решения', ['rect', 'rounded', 'stadium', 'diam', 'fr-rect', 'hex', 'odd']],
  ['Данни и съхранение', ['lean-r', 'lean-l', 'cyl', 'h-cyl', 'lin-cyl', 'bow-rect', 'datastore', 'cache']],
  ['Документи и папки', ['doc', 'docs', 'lin-doc', 'tag-doc', 'notch-rect', 'folder', 'flag']],
  ['Операции и въвеждане', ['st-rect', 'lin-rect', 'div-rect', 'tag-rect', 'win-pane', 'sl-rect', 'trap-t', 'trap-b', 'notch-pent']],
  ['Събития и интеграции', ['delay', 'tri', 'flip-tri', 'hourglass', 'queue', 'timer', 'api']],
  ['Кръгове и символи', ['circle', 'dbl-circ', 'fr-circ', 'cross-circ', 'sm-circ', 'f-circ', 'fork', 'bolt', 'bang']],
  ['Коментари и контекст', ['brace', 'brace-r', 'braces', 'text', 'cloud', 'curv-trap']],
  ['Интерфейси и картинки', ['browser', 'console', 'bucket', 'person', 'icon', 'image']],
];
                                                                             
                                                                      
const shapeCaptions = {
  rect: 'Процес', rounded: 'Събитие', stadium: 'Начало / край', diam: 'Решение',
  'fr-rect': 'Подпроцес', hex: 'Подготовка', odd: 'Асиметричен процес',
  'lean-r': 'Вход / изход', 'lean-l': 'Изход / вход', cyl: 'База данни',
  'h-cyl': 'Пряк достъп', 'lin-cyl': 'Дисково съхранение', 'bow-rect': 'Запазени данни',
  datastore: 'Хранилище', cache: 'Кеш', doc: 'Документ', docs: 'Документи',
  'lin-doc': 'Документ с поле', 'tag-doc': 'Маркиран документ', 'notch-rect': 'Карта',
  folder: 'Папка', flag: 'Хартиена лента', 'st-rect': 'Няколко процеса',
  'lin-rect': 'Процес с поле', 'div-rect': 'Разделен процес', 'tag-rect': 'Маркиран процес',
  'win-pane': 'Вътрешна памет', 'sl-rect': 'Ръчно въвеждане', 'trap-t': 'Ръчна операция',
  'trap-b': 'Приоритет', 'notch-pent': 'Граница на цикъл', delay: 'Изчакване',
  tri: 'Извличане', 'flip-tri': 'Ръчен архив', hourglass: 'Съпоставяне', queue: 'Опашка',
  timer: 'Таймер', api: 'API', circle: 'Начало', 'dbl-circ': 'Край', 'fr-circ': 'Стоп',
  'cross-circ': 'Обобщение', 'sm-circ': 'Старт', 'f-circ': 'Възел', fork: 'Разклоняване',
  bolt: 'Комуникация', bang: 'Внимание', brace: 'Коментар отляво',
  'brace-r': 'Коментар отдясно', braces: 'Коментар', text: 'Свободен текст',
  cloud: 'Облак', 'curv-trap': 'Екран', browser: 'Браузър', console: 'Console',
  bucket: 'Обектно хранилище', person: 'Човек', icon: 'Иконка', image: 'Картинка',
};
if (Object.keys(shapeCaptions).sort().join() !== Object.keys(SHAPES).sort().join())
  throw new Error('Every vocabulary shape needs a human demo caption.');
for (const [title, shapes] of groups) {
  const n = number();
  const nodes = shapes.map((shape, i) => ({
    ...sample(shape, shapeCaptions[shape], shape,
      shape === 'image' ? picture('globe') : shape === 'icon' ? { kind: 'emoji', text: '🎨' } : undefined, i),
    description: [SHAPES[shape], `Точна стойност: shape: "${shape}".`],
  }));
  flow(`demo-${n}-shapes`, `${n} · Форми: ${title}`, nodes, grid(nodes),
    'Смислови форми с кратки надписи. Изберете елемент за точната shape стойност в Details. Невидимите връзки само подреждат галерията.');
}

{
  const n = number();
  const lineNodes = LINE_STYLES.flatMap((line, i) => [
    sample(`${line}-from`, line, 'rounded', builtin('send'), i),
    sample(`${line}-to`, line === 'invisible' ? 'Само подреждане' : 'Приемник', 'rounded', builtin('check'), i),
  ]);
  flow(`demo-${n}-lines`, `${n} · Линии, дебелини и краища`, lineNodes, LINE_STYLES.map((line, i) => ({
    from: `${line}-from`, to: `${line}-to`, type: i === 3 ? 'return' : i === 2 ? 'branch' : 'flow',
    label: line, style: { line, width: i % 2 ? 'thick' : 'normal', start: END_MARKERS[i % 4], end: END_MARKERS[(i + 1) % 4] },
  })), 'Всичките шест стила, normal/thick и arrow/none/circle/cross. Invisible подрежда елементите, без видима линия.', 'LR');
}

for (let page = 0; page < 5; page++) {
  const n = number();
  const nodes = ICON_NAMES.slice(page * 10, page * 10 + 10).map((name, i) => ({
    ...sample(name, name, 'rounded', builtin(name), i),
    description: [ICONS[name].description, `icon: {kind: "builtin", name: "${name}"}`],
  }));
  flow(`demo-${n}-icons`, `${n} · Иконки ${page * 10 + 1}–${page * 10 + nodes.length}`, nodes, grid(nodes),
    'Галерия на вградените иконки (Lucide). Надписът е точният icon.name; значението е в Details.');
}

docs.push({
  $schema: '../../schema/sequence.schema.json', version: '1', kind: 'sequence',
  id: 'demo-18-execution', title: '18 · Sequence: заявка към банковия API', actors: actors.slice(1, 4),
  overview: ['Drill от „Банков API“. Nested calls, self-call, async известие, request/response, две фази.'],
  phases: [{ id: 'authorize', label: 'Оторизация' }, { id: 'record', label: 'Запис' }],
  calls: [{ id: 'charge', from: 'shop', to: 'payment', method: 'charge', phase: 'authorize',
    description: ['Магазинът иска плащане.'], request: '{ amount: 4990, currency: "BGN" }', response: '{ status: "approved" }',
    returnType: 'Charge', children: [
      { id: 'validate', from: 'payment', to: 'payment', method: 'validateToken', phase: 'authorize', description: ['Self-call: проверка на токена.'] },
      { id: 'limits', from: 'payment', to: 'data', method: 'readLimits', phase: 'authorize', description: ['Лимити на клиента.'], returnType: 'Limits' },
      { id: 'persist', from: 'payment', to: 'data', method: 'saveCharge', phase: 'record', description: ['Запис на плащането.'], returnType: 'ChargeId' },
      { id: 'notify', from: 'payment', to: 'shop', method: 'chargeSucceeded', phase: 'record', async: true, description: ['Асинхронно събитие към магазина.'] },
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
