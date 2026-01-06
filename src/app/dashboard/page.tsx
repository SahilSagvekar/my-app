import App from "../App"

export default function DashboardPage() {
   return <App />;
}


// "use client";

// import { useEffect, useState } from "react";
// import { AdminDashboard } from "../../components/dashboards/AdminDashboard";
// // import ManagerDashboard from "@/components/ManagerDashboard";
// // import EditorDashboard from "@/components/EditorDashboard";
// // import QCDashboard from "@/components/QCDashboard";
// // import SchedulerDashboard from "@/components/SchedulerDashboard";
// // import ClientDashboard from "@/components/ClientDashboard";
// // import VideographerDashboard from "@/components/VideographerDashboard";

// export default function Dashboard() {
//   const [userRole, setUserRole] = useState<string | null>(null);

//   useEffect(() => {
//     async function fetchUser() {
//       try {
//         const res = await fetch("/api/auth/me", {
//           credentials: "include", // send cookies
//         });
//         const data = await res.json();

//         if (res.ok && data.role) {
//           setUserRole(data.role);
//         } else {
//           window.location.href = "/login";
//         }
//       } catch (err) {
//         console.error("Auth error:", err);
//         window.location.href = "/login";
//       }
//     }

//     fetchUser();
//   }, []);

//   if (!userRole) {
//     return (
//       <div className="flex items-center justify-center h-screen">
//         <p>Loading your dashboard...</p>
//       </div>
//     );
//   }

//   switch (userRole) {
//     case "admin":
//       return <AdminDashboard />;
//     // case "manager":
//     //   return <ManagerDashboard />;
//     // case "editor":
//     //   return <EditorDashboard />;
//     // case "qc_specialist":
//     //   return <QCDashboard />;
//     // case "scheduler":
//     //   return <SchedulerDashboard />;
//     // case "videographer":
//     //   return <VideographerDashboard />;
//     // case "client":
//     //   return <ClientDashboard />;
//     default:
//       return <div>No dashboard found for your role.</div>;
//   }
// }


