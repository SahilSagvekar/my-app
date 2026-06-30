'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* ── Shared browser chrome ─────────────────────────────────────── */
function BrowserShell({ url, title, children }: { url: string; title: string; children: React.ReactNode }) {
  return (
    <div className="w-full rounded-xl border border-black/8 shadow-xl overflow-hidden bg-white">
      <div className="grid grid-cols-3 items-center px-4 py-2.5 bg-white border-b border-zinc-100">
        {/* Left: traffic lights + logo + name */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <img src="/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png" alt="E8" className="w-4 h-4 object-contain block flex-shrink-0" />
            <span className="text-[11px] font-semibold text-zinc-800 whitespace-nowrap">{title}</span>
          </div>
        </div>
        {/* Center: URL bar */}
        <div className="bg-zinc-100 rounded-full px-3 py-1 text-[10px] text-zinc-400 text-center">
          {url}
        </div>
        {/* Right: spacer */}
        <div />
      </div>
      <div className="flex" style={{ minHeight: 340 }}>
        {children}
      </div>
    </div>
  );
}

/* ── Shared light sidebar (matches client portal style) ─────────── */
function Sidebar({ items, active, storage = false }: { items: string[]; active: string; storage?: boolean }) {
  return (
    <div className="w-36 flex-shrink-0 bg-white border-r border-zinc-100 flex flex-col">
      <div className="flex-1 p-2 pt-3 space-y-0.5">
        {items.map((item) => (
          <div
            key={item}
            className={`px-2.5 py-1.5 rounded-lg text-[9px] font-medium cursor-pointer ${
              item === active ? 'bg-zinc-900 text-white font-semibold' : 'text-zinc-500'
            }`}
          >
            {item}
          </div>
        ))}
      </div>
      {storage && (
        <div className="p-2.5 border-t border-zinc-100">
          <p className="text-[8px] font-semibold text-zinc-600 mb-1">Storage</p>
          <div className="w-full h-1 bg-zinc-200 rounded-full mb-1">
            <div className="w-[8%] h-full bg-blue-500 rounded-full" />
          </div>
          <p className="text-[7px] text-zinc-400">261.86 GB of 3.00 TB</p>
        </div>
      )}
    </div>
  );
}

/* ── Badge helper ──────────────────────────────────────────────── */
function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${color}`}>{label}</span>;
}

/* ─────────────────────────────────────────────────────────────── */
/* ROLE SLIDES                                                      */
/* ─────────────────────────────────────────────────────────────── */

/* 1. Admin */
function AdminSlide() {
  const clients = [
    { name: 'TDBS',            mrr: '$6.2K', tasks: 38, pct: 92, bar: 'w-[92%]',  color: 'bg-emerald-400' },
    { name: 'Kirgo',           mrr: '$4.8K', tasks: 21, pct: 78, bar: 'w-[78%]',  color: 'bg-blue-400'    },
    { name: 'StayFit305',      mrr: '$3.1K', tasks: 14, pct: 65, bar: 'w-[65%]',  color: 'bg-violet-400'  },
    { name: 'ContractorPlus',  mrr: '$2.4K', tasks: 9,  pct: 50, bar: 'w-[50%]',  color: 'bg-orange-400'  },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/admin" title="Admin Portal">
      <Sidebar items={['Overview','Clients','Tasks','Team','Finance','Reports','Settings']} active="Overview" />
      <div className="flex-1 p-5 bg-gray-50 space-y-4 overflow-hidden">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Platform Overview</h2>
          <p className="text-[10px] text-zinc-500">All clients, tasks, and team activity in one place</p>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'MRR',             value: '$48K', bg: 'bg-emerald-500', val: 'text-white', sub: 'text-emerald-100' },
            { label: 'Completion Rate', value: '94%',  bg: 'bg-blue-500',    val: 'text-white', sub: 'text-blue-100'    },
            { label: 'Tasks This Month',value: '847',  bg: 'bg-violet-500',  val: 'text-white', sub: 'text-violet-100'  },
            { label: 'Active Clients',  value: '24',   bg: 'bg-orange-400',  val: 'text-white', sub: 'text-orange-100'  },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-xl font-bold ${s.val}`}>{s.value}</p>
              <p className={`text-[9px] mt-0.5 ${s.sub}`}>{s.label}</p>
            </div>
          ))}
        </div>
        {/* Client Revenue Breakdown */}
        <div className="bg-white rounded-xl border border-black/5 p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Client Revenue</p>
            <p className="text-[9px] font-semibold text-zinc-400">MRR · Tasks</p>
          </div>
          <div className="space-y-2.5">
            {clients.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-zinc-800">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-zinc-700">{c.mrr}</span>
                    <span className="text-[8px] text-zinc-400">{c.tasks} tasks</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full">
                  <div className={`${c.bar} ${c.color} h-full rounded-full`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BrowserShell>
  );
}

/* 2. Videographer */
function VideographerSlide() {
  const jobs = [
    { title: 'Brand Video Shoot — Kirgo',     budget: '$800', date: 'Jan 28', location: 'Miami, FL',          bid: false },
    { title: 'Social Content Day — TDBS',      budget: '$600', date: 'Feb 3',  location: 'Fort Lauderdale, FL', bid: true  },
    { title: 'Product Shoot — StayFit305',     budget: '$500', date: 'Feb 10', location: 'Remote',              bid: false },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/videographer" title="Videographer Portal">
      <Sidebar items={['Job Board','My Jobs','Schedule','Profile','Settings']} active="Job Board" />
      <div className="flex-1 p-5 bg-gray-50 space-y-3 overflow-hidden">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Job Board</h2>
          <p className="text-[10px] text-zinc-500">Open shoot requests — submit your bid to be assigned</p>
        </div>
        <div className="space-y-2.5">
          {jobs.map((j) => (
            <div key={j.title} className="bg-white rounded-xl border border-black/5 p-3 flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{j.title}</p>
                <div className="flex flex-wrap gap-2 text-[9px] text-zinc-500">
                  <span>📅 {j.date}</span>
                  <span>📍 {j.location}</span>
                  <span className="text-green-600 font-semibold">💲{j.budget.replace('$','')} budget</span>
                </div>
              </div>
              {j.bid
                ? <Badge label="Bid Placed" color="bg-blue-100 text-blue-700" />
                : <button className="flex-shrink-0 px-3 py-1.5 rounded-full bg-zinc-900 text-white text-[9px] font-semibold">Submit Bid</button>
              }
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

/* 3. Editor */
function EditorSlide() {
  const tasks = [
    { name: 'Brand Video — Kirgo',        type: 'Long Form',  status: 'In Progress', color: 'bg-blue-100 text-blue-700'       },
    { name: 'Reels Pack #5 — StayFit',    type: 'Short Form', status: 'In QC',       color: 'bg-violet-100 text-violet-700'   },
    { name: 'Holiday Ad Cut — Kirgo',      type: 'Short Form', status: 'Revisions',   color: 'bg-red-100 text-red-700'         },
    { name: 'UGC Pack — ContractorPlus',   type: 'Short Form', status: 'Uploading',   color: 'bg-purple-100 text-purple-700'   },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/editor" title="Editor Portal">
      <Sidebar items={['My Tasks','In Progress','QC Queue','History','Settings']} active="My Tasks" />
      <div className="flex-1 p-5 bg-gray-50 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">My Tasks</h2>
            <p className="text-[10px] text-zinc-500">Manage your active deliverables and upload finished files</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-zinc-400">Weekly Quota</p>
            <p className="text-xs font-bold text-zinc-900">8 / 12</p>
          </div>
        </div>
        <div className="w-full h-1.5 bg-zinc-200 rounded-full">
          <div className="w-2/3 h-full bg-zinc-900 rounded-full" />
        </div>
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.name} className="bg-white rounded-xl border border-black/5 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">{t.name}</p>
                <p className="text-[9px] text-zinc-400 mt-0.5">{t.type}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge label={t.status} color={t.color} />
                <button className="px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[9px] font-semibold">Upload</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

/* 4. QC */
function QCSlide() {
  const cards = [
    { title: 'Brand Video — Kirgo',   type: 'Long Form',      thumb: 'from-blue-400 to-blue-600',     files: 2 },
    { title: 'Reels Pack #4',         type: 'Short Form',     thumb: 'from-orange-400 to-orange-500', files: 4 },
    { title: 'Holiday Ad Cut',        type: 'Short Form',     thumb: 'from-orange-400 to-orange-500', files: 3 },
    { title: 'Logo Intro',            type: 'Motion Graphic', thumb: 'from-violet-500 to-violet-700', files: 1 },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/qc" title="QC Portal">
      <Sidebar items={['Review Queue','Approved','Reports','Settings']} active="Review Queue" />
      <div className="flex-1 p-5 bg-gray-50 space-y-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Review Queue</h2>
            <p className="text-[10px] text-zinc-500">Review submitted work and approve or reject with feedback</p>
          </div>
          <Badge label="6 Pending" color="bg-blue-100 text-blue-700" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {cards.map((c) => (
            <div key={c.title} className="bg-white rounded-xl border border-black/5 overflow-hidden">
              <div className={`h-16 bg-gradient-to-br ${c.thumb} relative`}>
                <span className="absolute top-1.5 right-1.5 text-[8px] bg-white/80 px-1.5 py-0.5 rounded font-semibold text-zinc-700">📄 {c.files}</span>
              </div>
              <div className="p-2">
                <p className="text-[8px] font-bold text-zinc-900 leading-tight mb-1.5">{c.type}</p>
                <div className="flex gap-1">
                  <button className="flex-1 py-0.5 rounded bg-emerald-500 text-white text-[7px] font-bold">✓ Approve</button>
                  <button className="flex-1 py-0.5 rounded bg-red-100 text-red-600 text-[7px] font-bold">✕ Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

/* 5. Scheduler */
function SchedulerSlide() {
  const queue = [
    { title: 'Brand Video — Kirgo',   platform: 'YouTube',   due: 'Jan 22' },
    { title: 'Reels Pack #4',         platform: 'Instagram', due: 'Jan 23' },
    { title: 'Holiday Ad Cut',        platform: 'Instagram', due: 'Jan 24' },
    { title: 'Show Ep. 4 — TDBS',     platform: 'YouTube',   due: 'Jan 25' },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/scheduler" title="Scheduler Portal">
      <Sidebar items={['Approved Queue','Calendar','Posted','Settings']} active="Approved Queue" />
      <div className="flex-1 flex gap-3 p-4 bg-gray-50 overflow-hidden">
        {/* Left: queue */}
        <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-black/5 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-100 flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-900">Approved Queue</p>
            <Badge label="4" color="bg-blue-100 text-blue-700" />
          </div>
          <div className="divide-y divide-zinc-50">
            {queue.map((q, i) => (
              <div key={q.title} className={`px-3 py-2 cursor-pointer transition-colors ${i === 1 ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-zinc-50'}`}>
                <p className="text-[9px] font-semibold text-zinc-900 truncate">{q.title}</p>
                <p className="text-[8px] text-zinc-400 mt-0.5">{q.platform} · Due {q.due}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Right: detail */}
        <div className="flex-1 bg-white rounded-xl border border-black/5 p-3 space-y-3 overflow-hidden">
          <p className="text-xs font-bold text-zinc-900">Task Details — Reels Pack #4</p>
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            {[['Type','Short Form'],['Platform','Instagram'],['Frequency','4× / week'],['Schedule','Wed Thu Fri Sat']].map(([k,v]) => (
              <div key={k}>
                <p className="text-zinc-400 uppercase tracking-wide font-semibold text-[7px]">{k}</p>
                <p className="text-zinc-900 font-medium mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          <div className="border border-orange-200 bg-orange-50 rounded-lg px-2.5 py-2 text-[8px] text-orange-700 font-medium">
            ⚠️ Social media link required before scheduling
          </div>
          <button className="w-full py-2 rounded-lg bg-zinc-900 text-white text-[9px] font-semibold">Mark as Scheduled</button>
        </div>
      </div>
    </BrowserShell>
  );
}

/* 6. Client */
function ClientSlide() {
  const cards = [
    { type: 'Long Form',      thumb: 'from-blue-400 to-blue-600',     img: '/assets/blind-date-thumbnail.jpg', files: 2, status: 'Approved', badge: 'bg-emerald-100 text-emerald-600' },
    { type: 'Short Form',     thumb: 'from-orange-400 to-orange-500', img: null,                                files: 5, status: 'Approved', badge: 'bg-emerald-100 text-emerald-600' },
    { type: 'Short Form',     thumb: 'from-orange-400 to-orange-500', img: null,                                files: 3, status: 'Approved', badge: 'bg-emerald-100 text-emerald-600' },
    { type: 'Motion Graphic', thumb: 'from-violet-500 to-violet-700', img: '/assets/kirgo-thumbnail.jpg',       files: 1, status: 'Approved', badge: 'bg-emerald-100 text-emerald-600' },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/client" title="Client Portal">
      <Sidebar items={['Content Review','Posted Content','Files & Drive','Logins','Contracts & Billing']} active="Content Review" storage />
      <div className="flex-1 p-4 bg-white space-y-3 overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Content Review</h2>
            <p className="text-[9px] text-zinc-400">Review content and approve or request revisions</p>
          </div>
          <div className="flex gap-1">
            {['Pending 2','Approved 39','Posted 100'].map((tab, i) => (
              <span key={tab} className={`px-2 py-1 rounded-full border text-[8px] font-semibold ${i === 1 ? 'border-emerald-300 bg-emerald-100 text-emerald-700' : 'border-zinc-200 text-zinc-400'}`}>{tab}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {cards.map((c) => (
            <div key={c.type + c.files} className="rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-zinc-100">
              <div className={`aspect-video bg-gradient-to-br ${c.thumb} relative`}>
                {c.img && <img src={c.img} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <span className="absolute top-1 right-1 text-[7px] bg-white/80 px-1 py-0.5 rounded font-semibold text-zinc-700">📄 {c.files}</span>
              </div>
              <div className="p-1.5">
                <p className="text-[8px] font-bold text-zinc-900 leading-tight mb-1">{c.type}</p>
                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${c.badge}`}>✓ {c.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

/* 7. Sales */
function SalesSlide() {
  const columns = [
    { label: 'NEW',       color: 'bg-blue-500',    leads: ['TurboLaundry', 'Miami Growth Co.']         },
    { label: 'CONTACTED', color: 'bg-orange-400',  leads: ['SodaCitySimpson', 'Heal Plan Invest']       },
    { label: 'WORKING',   color: 'bg-purple-500',  leads: ['StayFit305']                               },
    { label: 'QUALIFIED', color: 'bg-emerald-500', leads: ['Kirgo']                                    },
    { label: 'WON',       color: 'bg-green-600',   leads: ['TDBS', 'ContractorPlus']                   },
  ];
  return (
    <BrowserShell url="e8productions.com/dashboard/sales" title="Sales Portal">
      <Sidebar items={['Pipeline','Leads','Contacts','Reports','Settings']} active="Pipeline" />
      <div className="flex-1 p-4 bg-gray-50 space-y-3 overflow-hidden">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Sales Pipeline</h2>
          <p className="text-[10px] text-zinc-500">Track every lead from first contact to closed won</p>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {columns.map((col) => (
            <div key={col.label} className="flex-1 min-w-0">
              <div className={`${col.color} text-white text-[8px] font-bold px-2 py-1 rounded-t-lg flex items-center justify-between`}>
                <span>{col.label}</span>
                <span className="bg-white/25 rounded-full px-1.5 py-0.5">{col.leads.length}</span>
              </div>
              <div className="bg-white rounded-b-lg border border-t-0 border-zinc-100 p-1.5 space-y-1.5 min-h-[160px]">
                {col.leads.map((lead) => (
                  <div key={lead} className="bg-white rounded-lg border border-zinc-100 px-2 py-1.5 shadow-sm">
                    <p className="text-[9px] font-semibold text-zinc-900 truncate">{lead}</p>
                    <p className="text-[8px] text-zinc-400 mt-0.5">Social Media</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BrowserShell>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* CAROUSEL                                                        */
/* ─────────────────────────────────────────────────────────────── */

const slides = [
  { role: 'Admin',         color: 'bg-indigo-500',  component: AdminSlide       },
  { role: 'Videographer',  color: 'bg-rose-500',    component: VideographerSlide},
  { role: 'Editor',        color: 'bg-purple-500',  component: EditorSlide      },
  { role: 'QC',            color: 'bg-emerald-500', component: QCSlide          },
  { role: 'Scheduler',     color: 'bg-orange-500',  component: SchedulerSlide   },
  { role: 'Client',        color: 'bg-blue-500',    component: ClientSlide      },
  { role: 'Sales',         color: 'bg-amber-500',   component: SalesSlide       },
];

export function RoleCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent((c) => (c + 1) % slides.length);

  const Slide = slides[current].component;

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      {/* Slide */}
      <div className="relative px-14 sm:px-16">
        <Slide />

        {/* Arrows */}
        <button
          onClick={prev}
          className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-black/10 shadow-md flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-black/10 shadow-md flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors z-10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Role label */}
      <div className="flex items-center justify-center gap-2 mt-5">
        <span className={`w-2.5 h-2.5 rounded-full ${slides[current].color}`} />
        <span className="text-sm font-semibold text-zinc-500">{slides[current].role} Portal</span>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-3 pb-6">
        {slides.map((s, i) => (
          <button
            key={s.role}
            onClick={() => setCurrent(i)}
            className={`transition-all rounded-full ${
              i === current
                ? `w-6 h-2 ${s.color}`
                : 'w-2 h-2 bg-zinc-200 hover:bg-zinc-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
