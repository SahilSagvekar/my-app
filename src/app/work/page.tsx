"use client";

import { Navigation } from "@/components/landing/Navigation";
import { Footer } from "@/components/landing/Footer";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import {
  Play,
  TrendingUp,
  Users,
  Eye,
  Building2,
  Dumbbell,
  User,
  Heart,
  Music,
  ShoppingBag,
  Store,
  Rocket,
  ShoppingCart,
  Wrench,
  UtensilsCrossed,
  Shirt,
  Code,
  Coffee,
  Sparkles,
} from "lucide-react";

const clients = [
  {
    id: 1,
    name: "Coin Laundry Association",
    category: "Association",
    icon: Building2,
    description:
      "National content partnership showcasing top laundromat owners and industry success stories.",
    image: "/assets/landing/CLA RESULTS IMAGE.jpeg",
  },
  {
    id: 2,
    name: "StayFit305",
    category: "Event Company",
    icon: Dumbbell,
    description:
      "High-energy fitness event content highlighting workouts, seasonal events, and community engagement.",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
  },
  {
    id: 3,
    name: "Cole Simpson",
    category: "Influencer",
    icon: User,
    description: "",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
  },
  {
    id: 4,
    name: "The Dating Blind Show",
    category: "Original Show",
    icon: Heart,
    description:
      "Original dating series built for viral engagement, audience growth, and monetized entertainment.",
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
  },
  {
    id: 5,
    name: "Collegiate Nightlife",
    category: "Promotion Company",
    icon: Music,
    description:
      "High-impact promotional content for clubs and nightlife brands through cinematic montages and event photography.",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800",
  },
  {
    id: 6,
    name: "Turpone",
    category: "Retail",
    icon: ShoppingBag,
    description:
      "Branded product content designed to drive awareness and sales for a consumer pizza oven in retail markets.",
    image: "/assets/TURPONE RESULTS.jpeg",
  },
];

const brandLogos = [
  {
    name: "TDBS",
    logo: "/assets/CAROUSEL/PROFILE PIC TEMPLATE TDBS (8).png",
    fallbackIcon: Store,
  },
  {
    name: "Turpone",
    logo: "/assets/CAROUSEL/TURPONE.png",
    fallbackIcon: ShoppingBag,
  },
  {
    name: "YouTube",
    logo: "/assets/CAROUSEL/YT 1.png",
    fallbackIcon: Music,
  },
  {
    name: "Collegiate",
    logo: "/assets/CAROUSEL/COLLEGIATE.jpeg",
    fallbackIcon: Music,
  },
  {
    name: "Bare Knuckle Fighting Championship",
    logo: "/assets/CAROUSEL/BKFC---Logo-badge-_Nov2020_207614f6-8a80-49fe-b5de-0eb116826438_1200x1200 (1).webp",
    fallbackIcon: Music,
  },
  {
    name: "StayFit305",
    logo: "/assets/CAROUSEL/5fb058d2177e60b05fff035a_stayfi- 305-opengraph-03 (1).png",
    fallbackIcon: Dumbbell,
  },
  {
    name: "ContractorPlus",
    logo: "/assets/CAROUSEL/ContractorPlus-04-01.png",
    fallbackIcon: Wrench,
  },
  {
    name: "Client",
    logo: "/assets/CAROUSEL/IMG_5681.PNG",
    fallbackIcon: Store,
  },
  {
    name: "Connect AI",
    logo: "/assets/CAROUSEL/INSTA_POST - 02-100.jpg",
    fallbackIcon: Code,
  },
  {
    name: "Kirgo",
    logo: "/assets/CAROUSEL/Kirgo Black Box White Text Mint Horns.png",
    fallbackIcon: Rocket,
  },
];

const videoShowcase = [
  {
    title: "Brand Story Series",
    description:
      "A 5-part documentary series showcasing local business founders",
    thumbnail:
      "https://images.unsplash.com/photo-1683770997177-0603bd44d070?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBvZmZpY2UlMjB0ZWFtfGVufDF8fHx8MTc2NTg0ODMyOHww&ixlib=rb-4.1.0&q=80&w=1080",
    duration: "3:45",
  },
  {
    title: "Product Launch Campaign",
    description:
      "Multi-platform video campaign for a tech startup product launch",
    thumbnail:
      "https://images.unsplash.com/photo-1654288891700-95f67982cbcc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2aWRlbyUyMHByb2R1Y3Rpb24lMjBjYW1lcmF8ZW58MXx8fHwxNzY1ODMwMTczfDA&ixlib=rb-4.1.0&q=80&w=1080",
    duration: "2:30",
  },
];

function InfiniteScrollCarousel() {
  return (
    <div className="relative overflow-hidden">
      <div className="flex animate-scroll gap-4 sm:gap-6">
        {/* First set */}
        {brandLogos.map((brand, index) => {
          const IconComponent = brand.fallbackIcon;
          const isFullCover = brand.name === "StayFit305" || brand.name === "ContractorPlus" || brand.name === "Turpone";
          return (
            <div
              key={`first-${index}`}
              className={`shrink-0 w-48 sm:w-56 lg:w-64 h-32 sm:h-36 lg:h-40 ${isFullCover ? "bg-transparent border-0 relative" : "bg-white border border-black/5"} rounded-xl sm:rounded-2xl flex flex-col items-center justify-center ${isFullCover ? "p-0" : "p-4 sm:p-6"} transition-all ${isFullCover ? "" : "hover:border-black/20 hover:shadow-lg"} overflow-hidden`}
            >
              {brand.logo ? (
                <div className={`${brand.name === "StayFit305" || brand.name === "ContractorPlus" || brand.name === "Turpone" ? "absolute inset-0 w-full h-full" : "w-full h-full flex items-center justify-center mb-2"}`}>
                  <ImageWithFallback
                    src={brand.logo}
                    alt={brand.name}
                    className={brand.name === "StayFit305" || brand.name === "ContractorPlus" || brand.name === "Turpone" ? "w-full h-full object-cover rounded-xl sm:rounded-2xl" : "max-w-full max-h-full object-contain"}
                  />
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                    <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
                  </div>
                  <p className="text-black/70 text-sm sm:text-sm font-medium text-center">
                    {brand.name}
                  </p>
                </>
              )}
            </div>
          );
        })}
        {/* Duplicate set for seamless loop */}
        {brandLogos.map((brand, index) => {
          const IconComponent = brand.fallbackIcon;
          const isFullCover = brand.name === "StayFit305" || brand.name === "ContractorPlus" || brand.name === "Turpone";
          return (
            <div
              key={`second-${index}`}
              className={`shrink-0 w-48 sm:w-56 lg:w-64 h-32 sm:h-36 lg:h-40 ${isFullCover ? "bg-transparent border-0 relative" : "bg-white border border-black/5"} rounded-xl sm:rounded-2xl flex flex-col items-center justify-center ${isFullCover ? "p-0" : "p-4 sm:p-6"} transition-all ${isFullCover ? "" : "hover:border-black/20 hover:shadow-lg"} overflow-hidden`}
            >
              {brand.logo ? (
                <div className={`${brand.name === "StayFit305" || brand.name === "ContractorPlus" || brand.name === "Turpone" ? "absolute inset-0 w-full h-full" : "w-full h-full flex items-center justify-center mb-2"}`}>
                  <ImageWithFallback
                    src={brand.logo}
                    alt={brand.name}
                    className={brand.name === "StayFit305" || brand.name === "ContractorPlus" || brand.name === "Turpone" ? "w-full h-full object-cover rounded-xl sm:rounded-2xl" : "max-w-full max-h-full object-contain"}
                  />
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4">
                    <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-black" />
                  </div>
                  <p className="text-black/70 text-sm sm:text-sm font-medium text-center">
                    {brand.name}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 15s linear infinite;
          will-change: transform;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

export default function WorkPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="pt-12 sm:pt-14">
        {/* Hero Section */}
        <section className="pt-12 sm:pt-14 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4 px-4 sm:px-0">
              Results That Speak for Themselves
            </h1>
            <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
              Real businesses. Real growth. See how our content strategies and
              production services have helped small businesses achieve remarkable
              results.
            </p>
          </div>
        </section>

        {/* Clients Section */}
        <section className="pt-14 pb-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          {/* <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
              Clients
            </h2>
            <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto">
              Trusted partners who&apos;ve achieved remarkable growth with our
              content solutions.
            </p>
          </div> */}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {clients.map((client) => (
              <div
                key={client.id}
                className="group bg-white border border-black/5 rounded-2xl sm:rounded-3xl overflow-hidden hover:shadow-2xl hover:border-black/10 active:scale-[0.98] transition-all duration-300"
              >
                {/* Image */}
                <div className="relative aspect-video overflow-hidden bg-black/5">
                  <ImageWithFallback
                    src={client.image}
                    alt={client.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-black text-sm sm:text-sm rounded-full font-medium">
                      {client.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 sm:p-6 lg:p-8">
                  <div className="flex items-center gap-3 mb-2 sm:mb-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-black/5 rounded-xl sm:rounded-2xl flex items-center justify-center">
                      {(() => {
                        const IconComponent = client.icon;
                        return (
                          <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                        );
                      })()}
                    </div>
                    <h3 className="text-xl sm:text-xl text-black font-semibold">
                      {client.name}
                    </h3>
                  </div>
                  {client.description && (
                    <p className="text-base sm:text-base text-black/60 leading-relaxed">
                      {client.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

        {/* Who We Work With - Infinite Scroll Carousel */}
        <section className="pt-14 pb-20 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
              Who We Work With
            </h2>
            <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
              Small businesses and growing brands that want to make a big
              impact.
            </p>
          </div>

          <InfiniteScrollCarousel />

          {/* Trust Badge */}
          <div className="mt-10 sm:mt-12 text-center">
            <p className="text-black/40 text-sm sm:text-sm">
              Helping small businesses compete and win in their markets.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Projects */}
      {/* <section className="py-16 sm:py-16 px-5 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
              Featured Projects
            </h2>
            <p className="text-base sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
              A selection of our video production work across different
              industries
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
            {videoShowcase.map((video, index) => (
              <div
                key={index}
                className="group bg-white border border-black/5 rounded-2xl sm:rounded-3xl overflow-hidden hover:shadow-2xl hover:border-black/10 active:scale-[0.98] transition-all duration-300 cursor-pointer"
              >
                <div className="relative aspect-video overflow-hidden bg-black/5">
                  <ImageWithFallback
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center transition-transform group-hover:scale-110">
                      <Play
                        className="w-5 h-5 sm:w-6 sm:h-6 text-black ml-1"
                        fill="black"
                      />
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <span className="px-3 py-1 bg-black/80 backdrop-blur-sm text-white text-sm sm:text-sm rounded-full">
                      {video.duration}
                    </span>
                  </div>
                </div>
                <div className="p-6 sm:p-6">
                  <h3 className="text-lg sm:text-lg text-black mb-1.5 sm:mb-2 font-semibold">
                    {video.title}
                  </h3>
                  <p className="text-sm sm:text-sm text-black/60">
                    {video.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

        {/* Impact By Numbers */}
        <section className="pt-14 pb-20 px-4 sm:px-6 lg:px-8 bg-black/[0.02]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
                Impact by the Numbers
              </h2>
              <p className="text-base sm:text-base text-black/60">
                Aggregate results across our client portfolio
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
              <div className="text-center p-6 sm:p-6 bg-white rounded-2xl sm:rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-lg transition-all">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-lg sm:text-xl text-black mb-1.5 sm:mb-2 font-semibold">
                  285%
                </div>
                <div className="text-sm sm:text-sm text-black/60">
                  Average Growth
                </div>
              </div>

              <div className="text-center p-6 sm:p-6 bg-white rounded-2xl sm:rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-lg transition-all">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                  <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-lg sm:text-xl text-black mb-1.5 sm:mb-2 font-semibold">
                  12.5M+
                </div>
                <div className="text-sm sm:text-sm text-black/60">
                  Total Video Views
                </div>
              </div>

              <div className="text-center p-6 sm:p-6 bg-white rounded-2xl sm:rounded-3xl border border-black/5 hover:border-black/10 hover:shadow-lg transition-all">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-black rounded-xl sm:rounded-2xl mb-3 sm:mb-4">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="text-lg sm:text-xl text-black mb-1.5 sm:mb-2 font-semibold">
                  50+
                </div>
                <div className="text-sm sm:text-sm text-black/60">
                  Happy Clients
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
}
