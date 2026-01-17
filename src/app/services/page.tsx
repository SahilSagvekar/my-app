// import { Navigation } from '@/components/landing/Navigation';
// import { Footer } from '@/components/landing/Footer';
import { Navigation } from "@/components/landing/Navigation";
import { WhatWeDo } from "@/components/landing/WhatWeDo";
import { WhyE8 } from "@/components/landing/WhyE8";
import { CallToAction } from "@/components/landing/CallToAction";
import { Footer } from "@/components/landing/Footer";

export default function OriginalShowsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <div className="pt-12 sm:pt-14">
        <WhatWeDo />
        <WhyE8 />
        <CallToAction />
      </div>
      <Footer />
    </div>
  );
}



// // import { Navigation } from '@/components/landing/Navigation';
// // import { Footer } from '@/components/landing/Footer';
// import { Navigation } from "@/components/landing/Navigation";
// import { WhatWeDo } from "@/components/landing/WhatWeDo";
// import { WhyE8 } from "@/components/landing/WhyE8";
// import { CallToAction } from "@/components/landing/CallToAction";
// import { Footer } from "@/components/landing/Footer";

// export default function ServicesPage() {
//   return (
//     <div className="min-h-screen bg-white">
//       <Navigation />
//       <main className="pt-24 pb-16 px-6">
//         <div className="max-w-7xl mx-auto">
//           <h1 className="text-5xl font-bold text-black mb-6">Our Services</h1>
//           <p className="text-xl text-black/60 mb-12">
//             Comprehensive content solutions for modern businesses
//           </p>
//           {/* Add your services content here */}
//           <div className="min-h-screen bg-white">
//             <Navigation />
//             <div className="pt-16">
//               <WhatWeDo />
//               <WhyE8 />
//               <CallToAction />
//             </div>
//             {/* <Footer /> */}
//           </div>
//         </div>
//       </main>
//       <Footer />
//     </div>
//   );
// }
