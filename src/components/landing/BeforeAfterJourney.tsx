"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Youtube, Facebook, TrendingUp } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";

interface JourneyStep {
  src: string;
  caption: string;
}

interface JourneyClient {
  id: string;
  label: string;
  sublabel?: string;
  icon?: typeof Youtube;
  images: JourneyStep[];
}

const STEP_CAPTIONS = ["Month 1", "Month 3", "Month 6", "Month 9", "Today"];

function buildSteps(seed: string): JourneyStep[] {
  return STEP_CAPTIONS.map((caption, i) => ({
    src: `https://picsum.photos/seed/${seed}-${i}/900/560`,
    caption,
  }));
}

const CLIENTS: JourneyClient[] = [
  { id: "cole-yt", label: "Cole", sublabel: "YouTube", icon: Youtube, images: buildSteps("cole-yt") },
  { id: "cole-fb", label: "Cole", sublabel: "Facebook", icon: Facebook, images: buildSteps("cole-fb") },
  { id: "investment-joy", label: "Investment Joy", images: buildSteps("investment-joy") },
  { id: "peter-mayberry", label: "Peter Mayberry", images: buildSteps("peter-mayberry") },
  { id: "cla", label: "CLA", images: buildSteps("cla") },
  { id: "following-keenan", label: "Following Keenan", images: buildSteps("following-keenan") },
  { id: "danny-dangelo", label: "Danny D'Angelo", images: buildSteps("danny-dangelo") },
  { id: "tdbs", label: "The Dating Blind Show", images: buildSteps("tdbs") },
];

export function BeforeAfterJourney() {
  const [activeClientId, setActiveClientId] = useState(CLIENTS[0].id);
  const [step, setStep] = useState(0);

  const activeClient = useMemo(
    () => CLIENTS.find((c) => c.id === activeClientId) ?? CLIENTS[0],
    [activeClientId]
  );

  function selectClient(id: string) {
    setActiveClientId(id);
    setStep(0);
  }

  function prevStep() {
    setStep((s) => (s - 1 + activeClient.images.length) % activeClient.images.length);
  }

  function nextStep() {
    setStep((s) => (s + 1) % activeClient.images.length);
  }

  const current = activeClient.images[step];

  return (
    <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black text-white text-xs sm:text-sm rounded-full mb-4">
            <TrendingUp className="w-3.5 h-3.5" />
            The Journey
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-black mb-3 sm:mb-4">
            Where We Started, Where We Are Now
          </h2>
          <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto leading-relaxed">
            Pick a client to see their content and growth evolve month over month.
          </p>
        </div>

        {/* Client picker */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-8 sm:mb-10 px-1">
          {CLIENTS.map((client) => {
            const isActive = client.id === activeClientId;
            const Icon = client.icon;
            return (
              <button
                key={client.id}
                onClick={() => selectClient(client.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium border transition-all active:scale-95 ${
                  isActive
                    ? "bg-black text-white border-black shadow-md shadow-black/10"
                    : "bg-white text-black/70 border-black/10 hover:border-black/30 hover:text-black"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {client.label}
                {client.sublabel && (
                  <span className={isActive ? "text-white/60" : "text-black/40"}>
                    · {client.sublabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Slider */}
        <div className="relative">
          <div className="relative aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-black/5">
            <ImageWithFallback
              key={current.src}
              src={current.src}
              alt={`${activeClient.label} — ${current.caption}`}
              className="w-full h-full object-cover"
            />

            {/* Caption */}
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-sm sm:text-base">
                  {current.caption}
                </span>
                <span className="text-white/70 text-xs sm:text-sm">
                  {step + 1} / {activeClient.images.length}
                </span>
              </div>
            </div>
          </div>

          {/* Arrows */}
          <button
            onClick={prevStep}
            aria-label="Previous"
            className="absolute left-2 sm:-left-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-black/10 shadow-md flex items-center justify-center text-black hover:bg-black/5 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={nextStep}
            aria-label="Next"
            className="absolute right-2 sm:-right-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-black/10 shadow-md flex items-center justify-center text-black hover:bg-black/5 active:scale-95 transition-all"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-5 sm:mt-6">
          {activeClient.images.map((img, i) => (
            <button
              key={img.caption}
              onClick={() => setStep(i)}
              aria-label={`Go to ${img.caption}`}
              className={`transition-all rounded-full ${
                i === step ? "w-6 h-2 bg-black" : "w-2 h-2 bg-black/15 hover:bg-black/30"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
