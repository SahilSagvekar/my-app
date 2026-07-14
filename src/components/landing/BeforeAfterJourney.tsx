"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Youtube, Facebook, TrendingUp } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";

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
  const [api, setApi] = useState<CarouselApi>();
  const [step, setStep] = useState(0);

  const activeClient = useMemo(
    () => CLIENTS.find((c) => c.id === activeClientId) ?? CLIENTS[0],
    [activeClientId]
  );

  function selectClient(id: string) {
    setActiveClientId(id);
  }

  // Keep the dot indicators + step count in sync with embla's own state
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setStep(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  const scrollTo = useCallback((i: number) => api?.scrollTo(i), [api]);

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
        <Carousel key={activeClientId} setApi={setApi} opts={{ align: "start" }} className="relative px-1 sm:px-6">
          <CarouselContent>
            {activeClient.images.map((img, i) => (
              <CarouselItem key={img.caption}>
                <div className="relative aspect-video rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl bg-black/5">
                  <ImageWithFallback
                    src={img.src}
                    alt={`${activeClient.label} — ${img.caption}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/70 via-black/20 to-transparent">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-semibold text-sm sm:text-base">{img.caption}</span>
                      <span className="text-white/70 text-xs sm:text-sm">{i + 1} / {activeClient.images.length}</span>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="left-2 sm:left-0 w-9 h-9 sm:w-10 sm:h-10 bg-white border-black/10 shadow-md text-black hover:bg-black/5" />
          <CarouselNext className="right-2 sm:right-0 w-9 h-9 sm:w-10 sm:h-10 bg-white border-black/10 shadow-md text-black hover:bg-black/5" />
        </Carousel>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-5 sm:mt-6">
          {activeClient.images.map((img, i) => (
            <button
              key={img.caption}
              onClick={() => scrollTo(i)}
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
