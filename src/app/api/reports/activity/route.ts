// // app/api/reports/activity/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma';
// import { generateDailyActivityReport } from '@/lib/activity-report';

// export async function GET(req: NextRequest) {
//     try {
//         const reports = await prisma.activityReport.findMany({
//             orderBy: { generatedAt: 'desc' },
//             take: 30
//         });

//         return NextResponse.json(reports);
//     } catch (error: any) {
//         return NextResponse.json({ message: error.message }, { status: 500 });
//     }
// }

// /**
//  * Manual trigger for report generation
//  */
// export async function POST(req: NextRequest) {
//     try {
//         // Trigger report and always send email
//         const report = await generateDailyActivityReport({
//             sendEmail: true
//         });

//         console.log('Report data:', report);

//         // Handle case where no logs found
//         if (!report) {
//             return NextResponse.json(
//                 { message: "No activity logs found for today's period. Report cannot be generated." },
//                 { status: 404 }
//             );
//         }

//         return NextResponse.json(report);
//     } catch (error: any) {
//         console.error('Report generation error:', error);
//         return NextResponse.json({ message: error.message || 'Failed to generate report' }, { status: 500 });
//     }
// }
