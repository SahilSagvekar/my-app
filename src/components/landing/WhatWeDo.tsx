// // import React from 'react';
// // import { Video, Lightbulb, Share2, Cpu, Scissors, DollarSign, Tv, Camera } from 'lucide-react';

// // const services = [
// //   {
// //     icon: Lightbulb,
// //     title: 'Content Strategy',
// //     description: 'Smart planning that helps you stand out in your market and connect with your customers.',
// //   },
// //   {
// //     icon: Video,
// //     title: 'Video Production',
// //     description: 'Professional video content that makes your business look bigger than it is. From ads to brand stories.',
// //   },
// //   {
// //     icon: Scissors,
// //     title: 'Video Editing',
// //     description: 'Polished, professional editing that transforms raw footage into compelling stories.',
// //   },
// //   {
// //     icon: Share2,
// //     title: 'Social Media Management',
// //     description: 'Strategic management of your social presence across all platforms to maximize engagement.',
// //   },
// //   {
// //     icon: Cpu,
// //     title: 'Posting & Distribution',
// //     description: 'Automated scheduling and distribution to ensure your content reaches the right audience at the right time.',
// //   },
// //   {
// //     icon: DollarSign,
// //     title: 'Monetized Accounts',
// //     description: 'Build and grow revenue-generating social media accounts that turn followers into income.',
// //   },
// //   {
// //     icon: Tv,
// //     title: 'Original Show Production',
// //     description: 'Full-scale production of original content series and shows that captivate audiences.',
// //   },
// //   {
// //     icon: Camera,
// //     title: 'UGC Content',
// //     description: 'Authentic user-generated style content that resonates with audiences and drives engagement.',
// //   },
// // ];

// // export function WhatWeDo() {
// //   return (
// //     <section id="services" className="pt-12 sm:pt-14 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50">
// //       <div className="max-w-6xl mx-auto">
// //         {/* Section Header */}
// //         <div className="text-center mb-6 sm:mb-10">
// //           <h1 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
// //             What We Do
// //           </h1>
// //           <p className="text-sm sm:text-base text-black/60 max-w-2xl mx-auto px-4 sm:px-0">
// //             Everything your business needs to create content that drives results.
// //           </p>
// //         </div>

// //         {/* Service Grid */}
// //         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
// //           {services.map((service, index) => (
// //             <div
// //               key={index}
// //               className="group relative p-6 sm:p-8 bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-gray-200"
// //             >
// //               <div className="flex items-start gap-4 sm:gap-5">
// //                 <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 bg-gradient-to-br from-gray-900 to-black rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
// //                   <service.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
// //                 </div>
// //                 <div className="flex-1">
// //                   <h3 className="text-base sm:text-lg text-black mb-1.5 sm:mb-2">
// //                     {service.title}
// //                   </h3>
// //                   <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
// //                     {service.description}
// //                   </p>
// //                 </div>
// //               </div>
// //             </div>
// //           ))}
// //         </div>
// //       </div>
// //     </section>
// //   );
// // }


import React from 'react';
import { Video, Lightbulb, Share2, Cpu, Scissors, DollarSign, Tv, Camera } from 'lucide-react';

const services = [
  {
    icon: Lightbulb,
    title: 'Content Strategy',
    description: 'Smart planning that helps you stand out in your market and connect with your customers.',
  },
  {
    icon: Video,
    title: 'Video Production',
    description: 'Professional video content that makes your business look bigger than it is. From ads to brand stories.',
  },
  {
    icon: Scissors,
    title: 'Video Editing',
    description: 'Polished, professional editing that transforms raw footage into compelling stories.',
  },
  {
    icon: Share2,
    title: 'Social Media Management',
    description: 'Strategic management of your social presence across all platforms to maximize engagement.',
  },
  {
    icon: Cpu,
    title: 'Posting & Distribution',
    description: 'Automated scheduling and distribution to ensure your content reaches the right audience at the right time.',
  },
  {
    icon: DollarSign,
    title: 'Monetized Accounts',
    description: 'Build and grow revenue-generating social media accounts that turn views into income.',
  },
  {
    icon: Tv,
    title: 'Original Show Production',
    description: 'Full-scale production of original content series and shows that captivate audiences.',
  },
  {
    icon: Camera,
    title: 'UGC Content',
    description: 'Authentic user-generated style content that resonates with audiences and drives engagement.',
  },
];

export function WhatWeDo() {
  return (
    <section id="services" className="pt-14 sm:pt-16 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl text-black mb-4 sm:mb-5">
            What We Do
          </h2>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            Everything your business needs to create content that drives results.
          </p>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className="group relative p-6 sm:p-8 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-300 cursor-pointer"
              >
                <div className="flex flex-col items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-bold text-black mb-2 sm:mb-3">
                      {service.title}
                    </h3>
                    <p className="text-sm sm:text-base text-black/60 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </div>
                
                {/* Bottom Border Accent */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}





// 'use client';

// import React, { useState } from 'react';
// import { Video, Lightbulb, Share2, Cpu, Scissors, DollarSign, Tv, Camera } from 'lucide-react';

// const services = [
//   {
//     icon: Lightbulb,
//     title: 'Content Strategy',
//     description: 'Smart planning that helps you stand out in your market and connect with your customers.',
//   },
//   {
//     icon: Video,
//     title: 'Video Production',
//     description: 'Professional video content that makes your business look bigger than it is. From ads to brand stories.',
//   },
//   {
//     icon: Scissors,
//     title: 'Video Editing',
//     description: 'Polished, professional editing that transforms raw footage into compelling stories.',
//   },
//   {
//     icon: Share2,
//     title: 'Social Media Management',
//     description: 'Strategic management of your social presence across all platforms to maximize engagement.',
//   },
//   {
//     icon: Cpu,
//     title: 'Posting & Distribution',
//     description: 'Automated scheduling and distribution to ensure your content reaches the right audience at the right time.',
//   },
//   {
//     icon: DollarSign,
//     title: 'Monetized Accounts',
//     description: 'Build and grow revenue-generating social media accounts that turn followers into income.',
//   },
//   {
//     icon: Tv,
//     title: 'Original Show Production',
//     description: 'Full-scale production of original content series and shows that captivate audiences.',
//   },
//   {
//     icon: Camera,
//     title: 'UGC Content',
//     description: 'Authentic user-generated style content that resonates with audiences and drives engagement.',
//   },
// ];

// export function WhatWeDo() {
//   const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
//   const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

//   const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
//     if (hoveredIndex !== index) return;
    
//     const rect = e.currentTarget.getBoundingClientRect();
//     const x = e.clientX - rect.left;
//     const y = e.clientY - rect.top;
    
//     const centerX = rect.width / 2;
//     const centerY = rect.height / 2;
    
//     const rotateX = (y - centerY) / 10;
//     const rotateY = (centerX - x) / 10;
    
//     setMousePos({ x: rotateY, y: rotateX });
//   };

//   const handleMouseLeave = () => {
//     setHoveredIndex(null);
//     setMousePos({ x: 0, y: 0 });
//   };

//   return (
//     <section id="services" className="pt-16 sm:pt-24 pb-16 sm:pb-32 px-4 sm:px-6 lg:px-8 bg-white">
//       <div className="max-w-7xl mx-auto">
//         {/* Section Header */}
//         <div className="text-center mb-12 sm:mb-16">
//           <h1 className="text-2xl sm:text-3xl lg:text-3xl text-black mb-4 sm:mb-5">
//             What We Do
//           </h1>
//           <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
//             Everything your business needs to create content that drives results.
//           </p>
//         </div>

//         {/* Service Grid with 3D Effect */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective">
//           {services.map((service, index) => {
//             const Icon = service.icon;
//             const isHovered = hoveredIndex === index;
            
//             return (
//               <div
//                 key={index}
//                 className="h-full"
//                 style={{
//                   perspective: '1200px',
//                 }}
//                 onMouseMove={(e) => handleMouseMove(e, index)}
//                 onMouseEnter={() => setHoveredIndex(index)}
//                 onMouseLeave={handleMouseLeave}
//               >
//                 <div
//                   className="group relative p-6 sm:p-8 bg-white rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 cursor-pointer h-full overflow-hidden"
//                   style={{
//                     transformStyle: 'preserve-3d',
//                     transform: isHovered
//                       ? `rotateX(${mousePos.y}deg) rotateY(${mousePos.x}deg) translateZ(20px)`
//                       : 'rotateX(0) rotateY(0) translateZ(0)',
//                     transitionProperty: isHovered ? 'none' : 'transform',
//                     transitionDuration: isHovered ? '0s' : '0.3s',
//                     boxShadow: isHovered
//                       ? `0 20px 40px rgba(0, 0, 0, 0.15), 0 0 30px rgba(0, 0, 0, 0.1)`
//                       : '0 1px 3px rgba(0, 0, 0, 0.1)',
//                   }}
//                 >
//                   {/* Gradient Overlay on Hover */}
//                   <div
//                     className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
//                     style={{
//                       transformStyle: 'preserve-3d',
//                       transform: 'translateZ(1px)',
//                     }}
//                   />

//                   {/* Light Reflection */}
//                   <div
//                     className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"
//                     style={{
//                       background: `radial-gradient(circle at ${mousePos.x * 2}% ${mousePos.y * 2}%, rgba(255,255,255,0.8) 0%, transparent 50%)`,
//                       transformStyle: 'preserve-3d',
//                       transform: 'translateZ(2px)',
//                     }}
//                   />

//                   <div className="relative z-10" style={{ transformStyle: 'preserve-3d', transform: 'translateZ(10px)' }}>
//                     {/* Icon */}
//                     <div
//                       className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300"
//                       style={{
//                         transformStyle: 'preserve-3d',
//                         transform: isHovered ? 'scale(1.2) translateZ(10px)' : 'scale(1) translateZ(0)',
//                       }}
//                     >
//                       <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
//                     </div>

//                     {/* Content */}
//                     <div className="mt-4">
//                       <h3 className="text-lg sm:text-xl font-bold text-black mb-2 sm:mb-3">
//                         {service.title}
//                       </h3>
//                       <p className="text-sm sm:text-base text-black/60 leading-relaxed">
//                         {service.description}
//                       </p>
//                     </div>
//                   </div>

//                   {/* Bottom Border Accent */}
//                   <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" style={{ transformStyle: 'preserve-3d', transform: isHovered ? 'scaleX(1) translateZ(2px)' : 'scaleX(0) translateZ(0)' }} />
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </div>
//     </section>
//   );
// }