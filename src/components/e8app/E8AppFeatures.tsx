import {
  Play,
  CheckCircle,
  BarChart2,
  FileText,
  Bell,
  Upload,
  Kanban,
  Lock,
  TrendingUp,
  MessageSquare,
  Layers,
  Flag,
} from 'lucide-react';

const features = [
  {
    icon: Play,
    title: 'Video Review Portal',
    description:
      "Clients watch deliverables with full playback controls — speed adjustment, seek forward/back, and volume. Keyboard shortcuts (Space, J, L) for power users. Timestamped comments mark exact moments for revision.",
  },
  {
    icon: Kanban,
    title: 'Editor Task Board',
    description:
      "Kanban-style workflow: Pending → In Progress → Ready for QC → Revisions Needed. Editors upload by section (Main, Thumbnail, Music License, Tiles) and must acknowledge all revision feedback before re-submitting.",
  },
  {
    icon: ShieldCheckIcon,
    title: 'QC Review Queue',
    description:
      "QC reviews work before clients see anything. Approve and route to client or scheduler, reject with annotated feedback, set posting titles and tags, bulk-approve multiple tasks, and flag codec issues.",
  },
  {
    icon: BarChart2,
    title: 'Social Media Analytics',
    description:
      "Clients see real performance data pulled from their connected accounts — YouTube, Instagram, TikTok, Facebook. Views, followers, likes, comments, engagement rate, and top posts all in one dashboard.",
  },
  {
    icon: FileText,
    title: 'Contracts & Invoices',
    description:
      "Agreements are signed digitally inside the app. Invoices are tracked and accessible at any time. No more hunting through emails for your paperwork.",
  },
  {
    icon: MessageSquare,
    title: 'Timestamped Feedback',
    description:
      "Comments are pinned to exact moments in the video. Each comment has a category tag (design, content, timing, technical, spelling) and is tied to a specific file version so nothing gets lost between revisions.",
  },
  {
    icon: TrendingUp,
    title: 'Built-In CRM',
    description:
      "Sales tracks leads through a full pipeline: New → Contacted → Working → Qualified → Won/Lost. Log calls, emails, texts, and meetings. Track deal value, priority, and social profiles per contact.",
  },
  {
    icon: Layers,
    title: 'Thumbnail Comparison',
    description:
      "Clients and QC can compare multiple thumbnail versions side-by-side before approving. Each version is tracked with upload date, file size, and uploader — no guessing which one was final.",
  },
  {
    icon: Bell,
    title: 'Automated Notifications',
    description:
      "Alerts fire when a video is ready for review, a deadline is approaching, a change request is submitted, or a task status changes. Everyone stays in the loop without manual follow-up.",
  },
  {
    icon: Upload,
    title: 'Videographer Job Board',
    description:
      "Videographers browse open shoot requests, submit bids with custom rates, and view full technical specs (camera, quality, frame rate, lighting, exclusions). Upload completed files directly to the job.",
  },
  {
    icon: Flag,
    title: 'Weekly Quota System',
    description:
      "Editor task boards automatically distribute monthly deliverables across 4 weeks so workloads stay balanced. Editors see exactly how many tasks should be in their queue each week.",
  },
  {
    icon: Lock,
    title: 'Role-Based Permissions',
    description:
      "Clients only see their content. Editors only see their tasks. QC sees everything in the queue. Admins control it all. Permissions are fully configurable and locked down by role.",
  },
];

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

export function E8AppFeatures() {
  return (
    <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
            Everything in One Place
          </h2>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            We built the tools we wished existed — so no project falls through the cracks and no one has to chase anyone over email.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group bg-white rounded-2xl p-6 sm:p-7 border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-300 relative overflow-hidden"
              >
                <div className="w-11 h-11 bg-gradient-to-br from-gray-900 to-black rounded-xl flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-black mb-2">{feature.title}</h3>
                <p className="text-sm text-black/60 leading-relaxed">{feature.description}</p>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </div>
            );
          })}
        </div>

        {/* Workflow visual */}
        <div className="mt-16 sm:mt-24 bg-black rounded-2xl sm:rounded-3xl p-8 sm:p-12 text-white">
          <div className="text-center mb-10 sm:mb-14">
            <h3 className="text-2xl sm:text-3xl font-bold mb-3">How a Video Task Flows</h3>
            <p className="text-white/60 text-sm sm:text-base max-w-xl mx-auto">
              From kickoff to published — every step tracked inside E8 App.
            </p>
          </div>

          {/* Desktop: flex row with arrows between. Mobile: stacked list */}
          <div className="hidden sm:flex items-stretch gap-0">
            {[
              { step: '01', label: 'Task Created',    sub: 'Admin assigns to editor with deadline, client, and required sections', color: 'bg-violet-500',  border: 'border-violet-500/30'  },
              { step: '02', label: 'Editor Delivers', sub: 'Editor uploads all required files and submits to QC',                  color: 'bg-blue-500',    border: 'border-blue-500/30'    },
              { step: '03', label: 'QC Reviews',      sub: 'QC checks quality, sets posting content, and routes the task',         color: 'bg-emerald-500', border: 'border-emerald-500/30' },
              { step: '04', label: 'Client Approves', sub: 'Client reviews, leaves feedback or approves inside their portal',      color: 'bg-orange-500',  border: 'border-orange-500/30'  },
              { step: '05', label: 'Scheduler Posts', sub: 'Scheduler schedules the approved content to go live',                  color: 'bg-rose-500',    border: 'border-rose-500/30'    },
            ].map((item, i) => (
              <div key={item.step} className="flex items-stretch flex-1 min-w-0">
                {/* Step card */}
                <div className={`flex-1 min-w-0 rounded-xl border ${item.border} bg-white/5 p-4 flex flex-col items-center text-center`}>
                  <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center shadow-md mb-3`}>
                    <span className="text-white font-bold text-sm">{item.step}</span>
                  </div>
                  <div className="text-sm font-semibold text-white mb-1.5">{item.label}</div>
                  <div className="text-xs text-white/50 leading-relaxed">{item.sub}</div>
                </div>
                {/* Arrow between steps */}
                {i < 4 && (
                  <div className="flex-shrink-0 flex items-center justify-center w-8">
                    <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                      <path d="M0 5h13M9 1l5 4-5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile: vertical list */}
          <div className="flex sm:hidden flex-col gap-4">
            {[
              { step: '01', label: 'Task Created',    sub: 'Admin assigns to editor with deadline, client, and required sections', color: 'bg-violet-500'  },
              { step: '02', label: 'Editor Delivers', sub: 'Editor uploads all required files and submits to QC',                  color: 'bg-blue-500'    },
              { step: '03', label: 'QC Reviews',      sub: 'QC checks quality, sets posting content, and routes the task',         color: 'bg-emerald-500' },
              { step: '04', label: 'Client Approves', sub: 'Client reviews, leaves feedback or approves inside their portal',      color: 'bg-orange-500'  },
              { step: '05', label: 'Scheduler Posts', sub: 'Scheduler schedules the approved content to go live',                  color: 'bg-rose-500'    },
            ].map((item, i) => (
              <div key={item.step} className="flex gap-4 items-start">
                <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center shadow-md flex-shrink-0 mt-0.5`}>
                  <span className="text-white font-bold text-sm">{item.step}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-1">{item.label}</div>
                  <div className="text-xs text-white/50 leading-relaxed">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
