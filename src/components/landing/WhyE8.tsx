// import React from 'react';
// import { Zap, Boxes, Award, TrendingUp } from 'lucide-react';

// const values = [
//   {
//     icon: Boxes,
//     title: 'Built to Scale',
//     description: 'Infrastructure and processes designed to handle projects of any size, anywhere.',
//   },
//   {
//     icon: Zap,
//     title: 'E8 App | System Driven ',
//     description: 'Automated workflows and smart tools that ensure consistency and speed.',
//   },
//   {
//     icon: Award,
//     title: 'Uncompromising Quality',
//     description: 'Creativity paired with technical precision on every deliverable.',
//   },
//   {
//     icon: TrendingUp,
//     title: 'Results-Focused',
//     description: 'Strategic alignment with your KPIs. We measure what matters.',
//   },
// ];

// export function WhyE8() {
//   return (
//     <section className="pt-14 pb-20 px-4 sm:px-6 lg:px-8 bg-white">
//       <div className="max-w-7xl mx-auto">
//         {/* Section Header */}
//         <div className="max-w-2xl mx-auto text-center mb-8 sm:mb-12">
//           <h2 className="text-2xl sm:text-3xl lg:text-4xl text-black mb-3 sm:mb-4">
//           Why E8 Productions? 
//           </h2>
//           <p className="text-base sm:text-base text-black/60 px-4 sm:px-0">
//             Small business pricing. Real results.
//           </p>
//         </div>

//         {/* Value Props Grid */}
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 max-w-5xl mx-auto px-4 sm:px-0">
//           {values.map((value, index) => (
//             <div
//               key={index}
//               className="flex gap-5 sm:gap-6 group p-4 sm:p-0 rounded-2xl hover:bg-black/5 transition-all"
//             >
//               <div className="flex-shrink-0">
//                 <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black rounded-xl sm:rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
//                   <value.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
//                 </div>
//               </div>
//               <div>
//                 <h3 className="text-lg sm:text-lg text-black mb-1.5 sm:mb-2">
//                   {value.title}
//                 </h3>
//                 <p className="text-base sm:text-base text-black/60">
//                   {value.description}
//                 </p>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </section>
//   );
// }

import React from 'react';
import { Zap, Boxes, Award, TrendingUp } from 'lucide-react';

const values = [
  {
    icon: Boxes,
    title: 'Built to Scale',
    description: 'Infrastructure and processes designed to handle projects of any size, anywhere.',
  },
  {
    icon: Zap,
    title: 'E8 App | System Driven',
    description: 'Automated workflows and smart tools that ensure consistency and speed.',
  },
  {
    icon: Award,
    title: 'Uncompromising Quality',
    description: 'Creativity paired with technical precision on every deliverable.',
  },
  {
    icon: TrendingUp,
    title: 'Results-Focused',
    description: 'Strategic alignment with your KPIs. We measure what matters.',
  },
];

export function WhyE8() {
  return (
    <section className="pt-4 sm:pt-8 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl text-black mb-4 sm:mb-5">
            Why E8 Productions?
          </h2>
          <p className="text-base sm:text-lg text-black/60 max-w-2xl mx-auto">
            Small business pricing. Real results.
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <div
                key={index}
                className="group relative p-6 sm:p-8 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start gap-4 sm:gap-6">
                  {/* Icon */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-gray-900 to-black rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-black mb-2 sm:mb-3">
                      {value.title}
                    </h3>
                    <p className="text-sm sm:text-base text-black/60 leading-relaxed">
                      {value.description}
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