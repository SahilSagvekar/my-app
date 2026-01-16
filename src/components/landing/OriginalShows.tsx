"use client";

import React from "react";
import { Play, ArrowRight } from "lucide-react";
import Link from "next/link";
import blindDateImage from "../../../public/assets/dfbfcb4ef7475b451e2c0943ae8cc34504b65021.png";
import missbehaveImage from "../../../public/assets/c8100524ea3926b19a0c5342d6bf18a813da6dea.png";
import Image from "next/image";

const shows = [
  {
    title: "The Dating Blind Show",
    description:
      "A modern dating series where singles form real connections before appearances are revealed—proving chemistry starts with conversation, not looks.",
    image: blindDateImage,
    videoUrl: "https://youtu.be/Z7Ucs-JjmcY?si=h-LK1wQqqseLpJE9",
  },
  {
    title: "MissBehaveTV",
    description:
      "Bold, unapologetic, and unfiltered. Join us for conversations that break boundaries and challenge the status quo in dating and culture.",
    image: missbehaveImage,
    videoUrl: "https://youtu.be/0_lGz3rAVr4?si=5GvmwEOaXEOu_nMN",
  },
];

export function OriginalShows() {
  return (
    <section
      id="shows"
      className="pt-14 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-white"
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4 px-4 sm:px-0">
            Original Shows
          </h1>
          <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
            Premium entertainment produced by E8 Productions. Watch what happens
            when creativity meets innovation.
          </p>
        </div>

        {/* Shows Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-8 max-w-6xl mx-auto px-4 sm:px-0">
          {shows.map((show, index) => (
            <div
              key={index}
              className="group bg-white border border-black/5 rounded-2xl sm:rounded-3xl overflow-hidden transition-all hover:border-black/20 hover:shadow-2xl hover:-translate-y-2"
            >
              {/* Show Image */}
              <div className="relative aspect-video overflow-hidden bg-black/5">
                <Image
                  src={show.image}
                  alt={show.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center">
                    <Play
                      className="w-5 h-5 sm:w-7 sm:h-7 text-black ml-1"
                      fill="black"
                    />
                  </div>
                </div>
              </div>

              {/* Show Info */}
              <div className="p-5 sm:p-6 lg:p-8">
                <h3 className="text-lg sm:text-xl text-black mb-2 sm:mb-3 font-semibold">
                  {show.title}
                </h3>
                <p className="text-sm sm:text-base text-black/60 mb-4 sm:mb-6 leading-relaxed">
                  {show.description}
                </p>
                <button
                  onClick={() =>
                    window.open(show.videoUrl, "_blank", "noopener,noreferrer")
                  }
                  className="group/btn inline-flex items-center gap-2 text-sm sm:text-base text-black transition-all hover:gap-3 font-medium"
                >
                  <span>Watch Now</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 sm:mt-16 text-center px-4 sm:px-0">
          <p className="text-sm sm:text-base text-black/60 mb-4 sm:mb-6">
            Want to produce your own original content with us?
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base bg-black text-white rounded-full transition-all hover:bg-black/90 hover:scale-105 w-full sm:w-auto justify-center"
          >
            Pitch Your Show
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
