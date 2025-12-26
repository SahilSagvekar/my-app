'use client';

import React from 'react';
import { Play, ArrowRight, Link } from 'lucide-react';
import blindDateImage from '../../../public/assets/dfbfcb4ef7475b451e2c0943ae8cc34504b65021.png';
import missbehaveImage from '../../../public/assets/c8100524ea3926b19a0c5342d6bf18a813da6dea.png';
import Image from 'next/image';
import { useRouter } from 'next/navigation';



const shows = [
  {
    title: 'The Dating Blind Show',
    description: 'A modern dating series where singles form real connections before appearances are revealed—proving chemistry starts with conversation, not looks.',
    image: blindDateImage,
    videoUrl: 'https://youtu.be/Z7Ucs-JjmcY?si=h-LK1wQqqseLpJE9',
    tagline: 'Love is more than what meets the eye',
  },
  {
    title: 'MissBehaveTV',
    description: 'Bold, unapologetic, and unfiltered. Join us for conversations that break boundaries and challenge the status quo in dating and culture.',
    image: missbehaveImage,
    videoUrl: 'https://youtu.be/0_lGz3rAVr4?si=5GvmwEOaXEOu_nMN',
    tagline: 'Breaking rules, making waves',
  },
];

export function OriginalShows() {

  const router = useRouter();
  return (
    <section id="shows" className="pt-16 pb-24 px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h1 className="text-black mb-4">Original Shows</h1>
          <p className="text-black/60 max-w-2xl mx-auto">
            Premium entertainment produced by E8 Productions. Watch what happens
            when creativity meets innovation.
          </p>
        </div>

        {/* Shows Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {shows.map((show, index) => (
            <div
              key={index}
              className="group bg-white border border-black/5 rounded-3xl overflow-hidden transition-all hover:border-black/20 hover:shadow-2xl hover:-translate-y-2"
            >
              {/* Show Image */}
              <div className="relative aspect-[16/9] overflow-hidden bg-black/5">
                <Image
                  src={show.image}
                  alt={show.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <Play className="w-7 h-7 text-black ml-1" fill="black" />
                  </div>
                </div>
                {/* Tagline Badge */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm inline-block">
                    {show.tagline}
                  </div>
                </div>
              </div>

              {/* Show Info */}
              <div className="p-8">
                <h3 className="text-black mb-3">{show.title}</h3>
                <p className="text-black/60 mb-6">{show.description}</p>
                <button
                  // onClick={() => router.push("https://youtu.be/Z7Ucs-JjmcY?si=h-LK1wQqqseLpJE9")}
                  onClick={() => router.push(show.videoUrl)}
                  className="group/btn inline-flex items-center gap-2 text-black transition-all hover:gap-3"
                >
                  <span>Watch Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-black/60 mb-6">
            Want to produce your own original content with us?
          </p>
          <button className="inline-flex items-center gap-2 px-8 py-4 bg-black text-white rounded-full transition-all hover:bg-black/90 hover:scale-105">
            Pitch Your Show
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}