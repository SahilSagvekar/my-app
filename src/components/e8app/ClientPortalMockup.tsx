'use client';

import { useState } from 'react';
import {
  Search, CheckSquare, ExternalLink, HardDrive, LogIn, FileText,
  Cloud, Check, Download, Share, Youtube, Instagram, BarChart2,
  Folder, Image, Video, Music, Receipt, CreditCard, Shield, Facebook,
} from 'lucide-react';

type Filter   = 'pending' | 'approved' | 'posted';
type NavPage  = 'review' | 'posted-nav' | 'files' | 'logins' | 'billing';

/* ── Consistent color per deliverable type ─────────────────────── */
const typeColors: Record<string, string> = {
  'Long Form':      'from-blue-400 to-blue-600',
  'Short Form':     'from-orange-400 to-orange-500',
  'Motion Graphic': 'from-violet-500 to-violet-700',
  'UGC Pack':       'from-pink-400 to-pink-600',
};
function thumbFor(type: string) {
  return typeColors[type] ?? 'from-zinc-500 to-zinc-700';
}

/* ── Card data ─────────────────────────────────────────────────── */
const cardData: Record<Filter, { type: string; title: string; files: number; thumbnail?: string }[]> = {
  pending: [
    { type: 'Long Form',      title: 'Brand Video — Feb', files: 2, thumbnail: '/assets/blind-date-thumbnail.jpg' },
    { type: 'Short Form',     title: 'Reels Pack #5',     files: 3 },
    { type: 'Short Form',     title: 'UGC Pack — March',  files: 4 },
    { type: 'Motion Graphic', title: 'Logo Refresh',      files: 1, thumbnail: '/assets/kirgo-thumbnail.jpg' },
  ],
  approved: [
    { type: 'Long Form',      title: 'Brand Video — Jan', files: 2, thumbnail: '/assets/blind-date-thumbnail.jpg' },
    { type: 'Short Form',     title: 'Reels Pack #4',     files: 5 },
    { type: 'Short Form',     title: 'Holiday Ad Cut',    files: 3 },
    { type: 'Motion Graphic', title: 'Logo Intro',        files: 1, thumbnail: '/assets/kirgo-thumbnail.jpg' },
  ],
  posted: [
    { type: 'Short Form',     title: 'Reels Pack #3',      files: 3 },
    { type: 'Long Form',      title: 'Brand Story — Dec',  files: 2, thumbnail: '/assets/blind-date-thumbnail.jpg' },
    { type: 'Short Form',     title: 'Product Launch',     files: 4 },
    { type: 'Motion Graphic', title: 'Intro Animation',    files: 1, thumbnail: '/assets/kirgo-thumbnail.jpg' },
  ],
};

const counts = { pending: 2, approved: 39, posted: 100 };

/* ── Task card ─────────────────────────────────────────────────── */
function TaskCard({ card, status }: { card: { type: string; title: string; files: number; thumbnail?: string }; status: Filter }) {
  const badge =
    status === 'approved'
      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-bold"><Check className="w-2 h-2"/>Approved</span>
      : status === 'posted'
      ? <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[8px] font-bold"><ExternalLink className="w-2 h-2"/>Posted</span>
      : <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-600 text-[8px] font-bold">Pending</span>;

  return (
    <div className="rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-zinc-100/80 flex flex-col cursor-pointer hover:shadow-md hover:ring-zinc-200 transition-all group">
      <div className={`aspect-video w-full bg-gradient-to-br ${thumbFor(card.type)} relative flex items-center justify-center overflow-hidden`}>
        {card.thumbnail ? (
          <img
            src={card.thumbnail}
            alt={card.title}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <span className="text-white/20 text-[7px] font-bold uppercase tracking-widest">No preview</span>
        )}
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/5 transition-colors" />
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/85 backdrop-blur-sm text-zinc-700 text-[8px] font-semibold border border-zinc-200/60 shadow-sm z-10">
          <FileText className="w-2 h-2" />{card.files}
        </div>
      </div>
      <div className="p-2 flex flex-col gap-1.5">
        <p className="text-[9px] font-bold text-zinc-900 leading-tight">{card.type}</p>
        <div className="flex items-center justify-between gap-1 flex-wrap">
          {badge}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button className="w-4 h-4 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center hover:bg-zinc-50">
              <Share className="w-2 h-2 text-zinc-500" />
            </button>
            <button className="w-4 h-4 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center hover:bg-zinc-50">
              <Download className="w-2 h-2 text-zinc-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Posted Content screen ─────────────────────────────────────── */
function PostedContentScreen() {
  const posts = [
    { title: 'Brand Story — Dec', platform: 'YouTube',   views: '182K', date: 'Dec 14',  color: 'text-red-500'   },
    { title: 'Reels Pack #3',     platform: 'Instagram', views: '94K',  date: 'Dec 18',  color: 'text-pink-500'  },
    { title: 'Product Launch',    platform: 'Instagram', views: '61K',  date: 'Jan 2',   color: 'text-pink-500'  },
    { title: 'Intro Animation',   platform: 'YouTube',   views: '37K',  date: 'Jan 9',   color: 'text-red-500'   },
    { title: 'UGC Pack — Feb',    platform: 'Instagram', views: '28K',  date: 'Jan 22',  color: 'text-pink-500'  },
  ];
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-zinc-900">Posted Content</h2>
        <p className="text-[9px] text-zinc-500 mt-0.5">All published content across your channels</p>
      </div>
      <div className="border-t border-zinc-100 mb-3" />
      <div className="space-y-1.5">
        {posts.map((p) => (
          <div key={p.title} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white ring-1 ring-zinc-100 hover:ring-zinc-200 cursor-pointer transition-all">
            <div className={`w-5 h-5 rounded-md flex items-center justify-center bg-zinc-100 ${p.color} flex-shrink-0`}>
              {p.platform === 'YouTube' ? <Youtube className="w-3 h-3" /> : <Instagram className="w-3 h-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold text-zinc-900 truncate">{p.title}</p>
              <p className="text-[8px] text-zinc-400">{p.platform} · {p.date}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <BarChart2 className="w-2.5 h-2.5 text-zinc-400" />
              <span className="text-[8px] font-semibold text-zinc-600">{p.views}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Files & Drive screen ──────────────────────────────────────── */
function FilesScreen() {
  const sections = [
    {
      label: 'Main Files', icon: '📁', headerColor: 'bg-blue-50 text-blue-800 border-blue-200',
      files: [
        { name: 'Brand_Video_Jan_v2.mp4',  type: 'Video', size: '2.4 GB', version: 2, icon: Video,  iconColor: 'text-blue-600' },
        { name: 'Brand_Story_Dec_v1.mp4',  type: 'Video', size: '1.8 GB', version: 1, icon: Video,  iconColor: 'text-blue-600' },
      ],
    },
    {
      label: 'Thumbnails', icon: '🖼️', headerColor: 'bg-green-50 text-green-800 border-green-200',
      files: [
        { name: 'BlindDate_EP12_thumb.jpg', type: 'Image', size: '842 KB', version: 1, icon: Image, iconColor: 'text-green-600' },
        { name: 'BlindDate_EP11_thumb.jpg', type: 'Image', size: '794 KB', version: 1, icon: Image, iconColor: 'text-green-600' },
      ],
    },
    {
      label: 'Music License', icon: '🎵', headerColor: 'bg-orange-50 text-orange-800 border-orange-200',
      files: [
        { name: 'Track_License_Jan.pdf', type: 'PDF', size: '218 KB', version: 1, icon: FileText, iconColor: 'text-orange-600' },
      ],
    },
  ];

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-zinc-900">Files & Drive</h2>
        <p className="text-[9px] text-zinc-500 mt-0.5">All your content files organized by type</p>
      </div>
      <div className="border-t border-zinc-100 mb-3" />
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.label} className="rounded-xl border border-zinc-100 overflow-hidden">
            {/* Section header */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border-b ${section.headerColor}`}>
              <span className="text-[10px]">{section.icon}</span>
              <span className="text-[9px] font-bold">{section.label}</span>
              <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full bg-white/60 font-semibold">
                {section.files.length} file{section.files.length !== 1 ? 's' : ''}
              </span>
            </div>
            {/* File rows */}
            <div className="divide-y divide-zinc-50">
              {section.files.map((file) => (
                <div key={file.name} className="flex items-center gap-2 px-2.5 py-2 hover:bg-zinc-50 cursor-pointer transition-colors">
                  <file.icon className={`w-3.5 h-3.5 flex-shrink-0 ${file.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] font-semibold text-zinc-900 truncate">{file.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[7px] px-1 py-0.5 rounded bg-zinc-900 text-white font-bold">V{file.version}</span>
                      <span className="text-[7px] px-1 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">{file.type}</span>
                      <span className="text-[7px] text-zinc-400">{file.size}</span>
                    </div>
                  </div>
                  <button className="flex items-center gap-0.5 px-1.5 py-1 rounded-md bg-zinc-900 text-white text-[7px] font-semibold flex-shrink-0 hover:bg-zinc-700 transition-colors">
                    <Download className="w-2 h-2" /> DL
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Logins screen ─────────────────────────────────────────────── */
function LoginsScreen() {
  const platforms = [
    {
      id: 'youtube',
      label: 'YouTube',
      account: '@TheDailyBlindSpot',
      connected: true,
      iconBg: 'bg-red-100',
      icon: <Youtube className="w-3.5 h-3.5 text-red-600" />,
    },
    {
      id: 'instagram',
      label: 'Instagram',
      account: '@thedailyblindspot',
      connected: true,
      iconBg: 'bg-pink-100',
      icon: <Instagram className="w-3.5 h-3.5 text-pink-600" />,
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      account: '@blindspotshow',
      connected: true,
      iconBg: 'bg-zinc-100',
      icon: (
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-zinc-900">
          <path d="M19.6 3.3A4.5 4.5 0 0 1 15.2 0h-3.4v15.7a2.7 2.7 0 0 1-2.7 2.4 2.7 2.7 0 0 1-2.7-2.7 2.7 2.7 0 0 1 2.7-2.7c.3 0 .5 0 .8.1V9.3a6.1 6.1 0 0 0-.8-.1 6.1 6.1 0 0 0-6.1 6.1 6.1 6.1 0 0 0 6.1 6.1 6.1 6.1 0 0 0 6.1-6.1V7.7a7.8 7.8 0 0 0 4.5 1.4V5.7a4.5 4.5 0 0 1-2.1-.4z"/>
        </svg>
      ),
    },
    {
      id: 'facebook',
      label: 'Facebook',
      account: 'Not connected',
      connected: false,
      iconBg: 'bg-blue-50',
      icon: <Facebook className="w-3.5 h-3.5 text-blue-600" />,
    },
  ];

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-zinc-900">Social Logins</h2>
        <p className="text-[9px] text-zinc-500 mt-0.5">Connected accounts used for auto-posting your content</p>
      </div>
      <div className="border-t border-zinc-100 mb-3" />
      <div className="space-y-2">
        {platforms.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white ring-1 ring-zinc-100 hover:ring-zinc-200 transition-all">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${p.iconBg}`}>
              {p.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold text-zinc-900">{p.label}</p>
              <p className={`text-[8px] ${p.connected ? 'text-zinc-500' : 'text-zinc-400'}`}>{p.account}</p>
            </div>
            {p.connected ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-bold flex-shrink-0">
                <Check className="w-2 h-2" /> Connected
              </span>
            ) : (
              <button className="px-2 py-1 rounded-full bg-zinc-900 text-white text-[8px] font-semibold flex-shrink-0 hover:bg-zinc-700 transition-colors">
                Connect
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Contracts & Billing screen ────────────────────────────────── */
function BillingScreen() {
  const invoices = [
    { label: 'Monthly Retainer — Jan', amount: '$2,400', status: 'Paid',   color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Monthly Retainer — Feb', amount: '$2,400', status: 'Paid',   color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Monthly Retainer — Mar', amount: '$2,400', status: 'Due',    color: 'text-orange-600 bg-orange-50'   },
    { label: 'Production Agreement',   amount: '$0',     status: 'Signed', color: 'text-blue-600 bg-blue-50'       },
  ];
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-zinc-900">Contracts & Billing</h2>
        <p className="text-[9px] text-zinc-500 mt-0.5">Your invoices and signed agreements</p>
      </div>
      <div className="border-t border-zinc-100 mb-3" />
      <div className="space-y-1.5">
        {invoices.map((inv) => (
          <div key={inv.label} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white ring-1 ring-zinc-100 hover:ring-zinc-200 cursor-pointer transition-all">
            <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0">
              {inv.status === 'Signed' ? <FileText className="w-3 h-3 text-zinc-500" /> : <CreditCard className="w-3 h-3 text-zinc-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-semibold text-zinc-900 truncate">{inv.label}</p>
              <p className="text-[8px] text-zinc-400">{inv.amount}</p>
            </div>
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${inv.color}`}>{inv.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Content Review screen ─────────────────────────────────────── */
function ReviewScreen() {
  const [activeTab, setActiveTab] = useState<Filter>('approved');
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 leading-tight">Content Review</h2>
          <p className="text-[9px] text-zinc-500 mt-0.5 hidden sm:block">
            Review content from your team and approve or request revisions
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {(['pending', 'approved', 'posted'] as Filter[]).map((tab) => {
            const activeStyles = {
              pending:  'bg-yellow-100 border-yellow-300 text-yellow-700',
              approved: 'bg-emerald-100 border-emerald-300 text-emerald-700',
              posted:   'bg-blue-100 border-blue-300 text-blue-700',
            }[tab];
            const countStyles = {
              pending:  'text-yellow-500',
              approved: 'text-emerald-500',
              posted:   'text-blue-500',
            }[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[8px] font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? activeStyles
                    : 'border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:text-zinc-600'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {counts[tab] > 0 && (
                  <span className={`font-normal ${activeTab === tab ? countStyles : 'text-zinc-400'}`}>
                    {counts[tab]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border-t border-zinc-100 mb-3" />
      <div className="grid grid-cols-4 gap-2 overflow-hidden">
        {cardData[activeTab].map((card) => (
          <TaskCard key={card.title} card={card} status={activeTab} />
        ))}
      </div>
    </div>
  );
}

/* ── Nav config ────────────────────────────────────────────────── */
const navItems: { icon: React.ElementType; label: string; key: NavPage }[] = [
  { icon: CheckSquare,  label: 'Content Review',      key: 'review'      },
  { icon: ExternalLink, label: 'Posted Content',       key: 'posted-nav'  },
  { icon: HardDrive,    label: 'Files & Drive',        key: 'files'       },
  { icon: LogIn,        label: 'Logins',               key: 'logins'      },
  { icon: FileText,     label: 'Contracts & Billing',  key: 'billing'     },
];

/* ── Main export ───────────────────────────────────────────────── */
export function ClientPortalMockup() {
  const [activePage, setActivePage] = useState<NavPage>('review');

  const renderScreen = () => {
    switch (activePage) {
      case 'review':     return <ReviewScreen />;
      case 'posted-nav': return <PostedContentScreen />;
      case 'files':      return <FilesScreen />;
      case 'logins':     return <LoginsScreen />;
      case 'billing':    return <BillingScreen />;
    }
  };

  return (
    <div className="w-full rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden bg-white select-none">

      {/* ── Top bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-zinc-100">
        <div className="flex gap-1 flex-shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pl-1">
          <img
            src="/assets/575743c7bd0af4189cb4a7349ecfe505c6699243.png"
            alt="E8"
            className="w-6 h-6 object-contain flex-shrink-0"
          />
          <span className="text-[10px] font-bold text-zinc-900 hidden sm:block">Client Portal</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 bg-zinc-100 rounded-full px-3 py-1">
          <Search className="w-2.5 h-2.5 text-zinc-400 flex-shrink-0" />
          <span className="text-[9px] text-zinc-400 truncate">e8productions.com/dashboard</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <img
            src="/assets/tdbs-avatar.png"
            alt="TDBS"
            className="w-6 h-6 rounded-full object-cover flex-shrink-0"
          />
          <span className="text-[9px] font-medium text-zinc-700 hidden sm:block whitespace-nowrap">TDBS Client</span>
        </div>
      </div>

      {/* ── App body ───────────────────────────────────────────── */}
      <div className="flex" style={{ minHeight: '300px' }}>

        {/* Sidebar */}
        <div className="w-36 flex-shrink-0 border-r border-zinc-100 bg-white flex-col hidden sm:flex">
          <nav className="flex-1 p-1.5 pt-2 space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px] font-semibold transition-colors text-left ${
                  activePage === item.key
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
                }`}
              >
                <item.icon className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
          {/* Storage */}
          <div className="p-2.5 border-t border-zinc-100">
            <div className="flex items-center gap-1 mb-1.5">
              <Cloud className="w-3 h-3 text-zinc-500" />
              <span className="text-[9px] font-semibold text-zinc-700">Storage</span>
            </div>
            <div className="w-full h-1 bg-zinc-200 rounded-full mb-1">
              <div className="w-[8%] h-full bg-blue-500 rounded-full" />
            </div>
            <p className="text-[8px] text-zinc-400 mb-2">261.86 GB of 3.00 TB used</p>
            <button className="w-full py-1 rounded-full border border-blue-500 text-blue-500 text-[8px] font-semibold hover:bg-blue-50 transition-colors">
              Get more storage
            </button>
            <p className="text-[8px] text-zinc-300 text-center mt-1.5">Client Portal v2.1</p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 bg-white p-3 min-w-0 overflow-hidden w-0">
          {renderScreen()}
        </div>
      </div>
    </div>
  );
}
