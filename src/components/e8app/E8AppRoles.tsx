import { ClientPortalMockup } from './ClientPortalMockup';
import {
  Users,
  Scissors,
  ShieldCheck,
  Calendar,
  Camera,
  LayoutDashboard,
  TrendingUp,
  CheckCircle,
  Play,
  BarChart2,
  FileText,
  Download,
} from 'lucide-react';

const clientHighlights = [
  {
    icon: Play,
    label: 'Watch & review every video before it goes live',
  },
  {
    icon: CheckCircle,
    label: 'Approve deliverables or request revisions with one click',
  },
  {
    icon: BarChart2,
    label: 'See your YouTube, Instagram, and TikTok analytics in one place',
  },
  {
    icon: FileText,
    label: 'Access your contracts and invoices anytime',
  },
  {
    icon: Download,
    label: 'Bulk download your approved content files',
  },
  {
    icon: Calendar,
    label: 'Track every piece of content: Pending → Approved → Posted',
  },
];

const internalRoles = [
  {
    icon: Scissors,
    title: 'Editors',
    tag: 'Editor Tools',
    description:
      'Kanban task board (Pending → In Progress → QC → Revisions), section-based file uploads, weekly quota tracking, and version-tagged revision feedback.',
    iconBg: 'bg-purple-600',
    accent: 'border-purple-100 bg-purple-50',
  },
  {
    icon: ShieldCheck,
    title: 'QC Team',
    tag: 'QC Dashboard',
    description:
      'Review every deliverable before clients see it. Approve to client or scheduler, add timestamped comments, set posting titles and tags, bulk-approve tasks, and flag codec issues.',
    iconBg: 'bg-emerald-600',
    accent: 'border-emerald-100 bg-emerald-50',
  },
  {
    icon: Calendar,
    title: 'Schedulers',
    tag: 'Scheduler',
    description:
      'Approved queue sidebar, full production calendar, one-click scheduling, and the ability to send content back to editors with feedback before it goes live.',
    iconBg: 'bg-orange-500',
    accent: 'border-orange-100 bg-orange-50',
  },
  {
    icon: Camera,
    title: 'Videographers',
    tag: 'Videographer',
    description:
      'Job board with open shoot requests, bid submission with custom rates, technical specs per shoot, shooting calendar, and direct file upload on completion.',
    iconBg: 'bg-rose-500',
    accent: 'border-rose-100 bg-rose-50',
  },
  {
    icon: TrendingUp,
    title: 'Sales',
    tag: 'CRM',
    description:
      'Built-in lead tracker with a full pipeline: New → Contacted → Working → Qualified → Won/Lost. Track deal value, log activity (calls, emails, texts, meetings), and manage contacts across all platforms.',
    iconBg: 'bg-sky-600',
    accent: 'border-sky-100 bg-sky-50',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin & Managers',
    tag: 'Admin',
    description:
      'Full-company oversight: revenue KPIs, monthly deliverables per client, team workload heatmap, project health, billing, user permissions, system health, and audit logs.',
    iconBg: 'bg-gray-900',
    accent: 'border-gray-200 bg-gray-50',
  },
];

export function E8AppRoles() {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-14 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
            One App. Every Role.
          </h2>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            Clients, editors, QC, schedulers, videographers, sales, and admins — everyone has their own tailored view inside E8 App.
          </p>
        </div>

        {/* CLIENT — prominent featured card */}
        <div className="mb-10 sm:mb-14 rounded-2xl sm:rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left: copy */}
            <div className="p-8 sm:p-10 lg:p-12">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider border border-blue-200 rounded-full px-3 py-1 bg-white">
                  Client Portal
                </span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-black mb-3">For Clients</h3>
              <p className="text-black/60 text-sm sm:text-base leading-relaxed mb-8">
                When you work with E8, you get your own login. Review every video before it goes live, leave feedback, approve content, and track your results — all from one clean dashboard.
              </p>

              <ul className="space-y-3">
                {clientHighlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm text-black/70 leading-snug">{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Right: interactive mockup */}
            <div className="lg:border-l border-zinc-800 p-6 sm:p-8 lg:p-10 flex items-center justify-center rounded-b-2xl lg:rounded-b-none lg:rounded-r-2xl animated-dark-gradient">
              <ClientPortalMockup />
            </div>
          </div>
        </div>

        {/* Internal roles grid */}
        <div className="mb-8">
          <h3 className="text-xl sm:text-2xl font-bold text-black mb-2">Built for the Whole Team</h3>
          <p className="text-sm sm:text-base text-black/60 mb-8">
            Every person in the production pipeline has their own dedicated workspace.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {internalRoles.map((role) => {
              const Icon = role.icon;
              return (
                <div
                  key={role.title}
                  className={`rounded-2xl border p-6 ${role.accent} transition-all hover:shadow-lg hover:-translate-y-0.5 duration-300`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 ${role.iconBg} rounded-xl flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-black/40 uppercase tracking-wider border border-black/10 rounded-full px-2.5 py-1 bg-white/70">
                      {role.tag}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-black mb-2">{role.title}</h4>
                  <p className="text-sm text-black/60 leading-relaxed">{role.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
