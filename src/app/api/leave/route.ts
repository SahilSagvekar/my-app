// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { z } from "zod";
// import { isEmployee } from "@/lib/auth";
// import { countWorkingDaysBetween } from "@/lib/workdays";
// import type { NextRequest } from "next/server";
// import jwt from 'jsonwebtoken';
// import { Console } from "console";

// const LeaveSchema = z.object({
//   startDate: z.string().datetime().or(z.string()), // we'll parse manually
//   endDate: z.string().datetime().or(z.string()),
//   reason: z.string().optional(),
// });

// // Helper function to get and verify token
// function getUserFromToken(req: NextRequest) {
//   try {
//     const token = req.cookies.get('authToken')?.value;
    
//     if (!token) {
//       return null;
//     }

//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//     return decoded.user || decoded.currentUser || decoded; // Handle different token structures
//   } catch (error) {
//     console.error('Token verification failed:', error);
//     return null;
//   }
// }

// export async function POST(
//   req: NextRequest,
//   context: { params: { employeeId: string } }
// ) {
//   try {
//     // Get and verify user from token
//     const currentUser = getUserFromToken(req);
//     if (!currentUser) {
//       return NextResponse.json(
//         { ok: false, message: "Unauthorized" },
//         { status: 401 }
//       );
//     }

//     const { params } = await Promise.resolve(context);
//     console.log('Creating leave for employeeId:', params, 'by user:', currentUser);

//     // const employeeId = Number(params.employeeId);
//     const employeeId = currentUser.userId;

//     if (!employeeId || Number.isNaN(employeeId)) {
//       return NextResponse.json(
//         { ok: false, message: "Invalid employee id" },
//         { status: 400 }
//       );
//     }

//     // Only admin or the employee themself can create this leave
//     // if (
//     //   currentUser.role !== "admin" &&
//     //   !(isEmployee(currentUser) && currentUser.id === employeeId)
//     // ) {
//     //   return NextResponse.json(
//     //     { ok: false, message: "Forbidden" },
//     //     { status: 403 }
//     //   );
//     // }

//     const bodyRaw = await req.json();
//     const body = LeaveSchema.parse(bodyRaw);

//     const start = new Date(body.startDate);
//     const end = new Date(body.endDate);

//     if (isNaN(start.getTime()) || isNaN(end.getTime())) {
//       return NextResponse.json(
//         { ok: false, message: "Invalid dates" },
//         { status: 400 }
//       );
//     }

//     if (end < start) {
//       return NextResponse.json(
//         { ok: false, message: "endDate cannot be before startDate" },
//         { status: 400 }
//       );
//     }

//     // Fetch employee to know worksOnSaturday
//     const employee = await prisma.user.findUnique({
//       where: { id: employeeId },
//       select: { id: true, worksOnSaturday: true },
//     });

//     if (!employee) {
//       return NextResponse.json(
//         { ok: false, message: "Employee not found" },
//         { status: 404 }
//       );
//     }

//     const days = countWorkingDaysBetween(
//       start,
//       end,
//       employee.worksOnSaturday ?? false
//     );

//     if (days <= 0) {
//       return NextResponse.json(
//         {
//           ok: false,
//           message:
//             "Selected date range includes no working days; leave not required.",
//         },
//         { status: 400 }
//       );
//     }

//     const leave = await prisma.leave.create({
//       data: {
//         employeeId,
//         startDate: start,
//         endDate: end,
//         numberOfDays: days,
//         reason: body.reason ?? null,
//         status: "PENDING",
//       },
//     });

//     // hook: notify admin later (Slack, in-app, whatever)
//     return NextResponse.json({ ok: true, leave });
//   } catch (err: any) {
//     console.error('POST /api/employee/[id]/leave error:', err);
    
//     // Handle Zod validation errors
//     if (err.name === 'ZodError') {
//       return NextResponse.json(
//         { ok: false, message: "Invalid request data", errors: err.errors },
//         { status: 400 }
//       );
//     }
    
//     const status = err?.status || 500;
//     return NextResponse.json(
//       { ok: false, message: err?.message || "Something went wrong" },
//       { status }
//     );
//   }
// }

// export async function GET(
//   req: NextRequest,
//   context: { params: { employeeId: string } }
// ) {
//   try {
//     // Get and verify user from token
//     const user = getUserFromToken(req);
    
//     if (!user) {
//       return NextResponse.json(
//         { ok: false, message: "Unauthorized" },
//         { status: 401 }
//       );
//     }

//     const { params } = await Promise.resolve(context);
//     const employeeId = Number(params.employeeId);

//     if (!employeeId || Number.isNaN(employeeId)) {
//       return NextResponse.json(
//         { ok: false, message: "Invalid employee id" },
//         { status: 400 }
//       );
//     }

//     // admin OR that employee
//     if (
//       user.role !== "admin" &&
//       !(isEmployee(user) && user.id === employeeId)
//     ) {
//       return NextResponse.json(
//         { ok: false, message: "Forbidden" },
//         { status: 403 }
//       );
//     }

//     const url = new URL(req.url);
//     const year = url.searchParams.get("year");
//     const month = url.searchParams.get("month");

//     let where: any = { employeeId };

//     if (year && month) {
//       const y = Number(year);
//       const m = Number(month);
//       const start = new Date(Date.UTC(y, m - 1, 1));
//       const end = new Date(Date.UTC(y, m, 0));
//       where.startDate = {
//         gte: start,
//         lte: end,
//       };
//     }

//     const leaves = await prisma.leave.findMany({
//       where,
//       orderBy: { startDate: "desc" },
//       include: {
//         deduction: true,
//       },
//     });

//     return NextResponse.json({ ok: true, leaves });
//   } catch (err: any) {
//     console.error('GET /api/employee/[id]/leave error:', err);
//     const status = err?.status || 500;
//     return NextResponse.json(
//       { ok: false, message: err?.message || "Something went wrong" },
//       { status }
//     );
//   }
// }


import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { isEmployee } from "@/lib/auth";
import { countWorkingDaysBetween } from "@/lib/workdays";
import type { NextRequest } from "next/server";
import jwt from 'jsonwebtoken';

const LeaveSchema = z.object({
  startDate: z.string().datetime().or(z.string()),
  endDate: z.string().datetime().or(z.string()),
  reason: z.string().optional(),
});

/**
 * Helper function to get and verify token
 */
function getUserFromToken(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    
    if (!token) {
      return null;
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * POST /api/leave
 * Create a new leave request (ORIGINAL + UPDATED)
 * 
 * Body:
 * {
 *   "startDate": "2026-02-01",
 *   "endDate": "2026-02-05",
 *   "reason": "Personal leave" (optional)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const employeeId = currentUser.userId || currentUser.id;

    if (!employeeId || Number.isNaN(Number(employeeId))) {
      return NextResponse.json(
        { ok: false, message: "Invalid employee id" },
        { status: 400 }
      );
    }

    const bodyRaw = await req.json();
    const body = LeaveSchema.parse(bodyRaw);

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { ok: false, message: "Invalid dates" },
        { status: 400 }
      );
    }

    if (end < start) {
      return NextResponse.json(
        { ok: false, message: "endDate cannot be before startDate" },
        { status: 400 }
      );
    }

    // Fetch employee to know worksOnSaturday
    const employee = await prisma.user.findUnique({
      where: { id: Number(employeeId) },
      select: { id: true, worksOnSaturday: true },
    });

    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "Employee not found" },
        { status: 404 }
      );
    }

    const days = countWorkingDaysBetween(
      start,
      end,
      employee.worksOnSaturday ?? false
    );

    if (days <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Selected date range includes no working days; leave not required.",
        },
        { status: 400 }
      );
    }

    const leave = await prisma.leave.create({
      data: {
        employeeId: Number(employeeId),
        startDate: start,
        endDate: end,
        numberOfDays: days,
        reason: body.reason ?? null,
        status: "PENDING",
      },
    });

    console.log(`Leave request created: ${leave.id} for employee ${employeeId}`);

    return NextResponse.json({ ok: true, leave });
  } catch (err: any) {
    console.error('POST /api/leave error:', err);
    
    if (err.name === 'ZodError') {
      return NextResponse.json(
        { ok: false, message: "Invalid request data", errors: err.errors },
        { status: 400 }
      );
    }
    
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}

/**
 * GET /api/leave
 * Get employee's own leave requests with statistics
 * 
 * Query params:
 * ?status=PENDING|APPROVED|REJECTED
 * ?year=2026&month=1 (optional - filter by month)
 * ?sortBy=createdAt|startDate (default: createdAt)
 * ?sortOrder=asc|desc (default: desc)
 */
export async function GET(req: NextRequest) {
  try {
    const user = getUserFromToken(req);
    
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const employeeId = user.userId || user.id;

    if (!employeeId || Number.isNaN(Number(employeeId))) {
      return NextResponse.json(
        { ok: false, message: "Invalid employee id" },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const year = url.searchParams.get("year");
    const month = url.searchParams.get("month");
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";

    // 🔒 SECURITY: Employees can only see their own leaves
    let where: any = { employeeId: Number(employeeId) };

    // Filter by status if provided
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    // Filter by month/year if provided
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      where.startDate = {
        gte: start,
        lte: end,
      };
    }

    // Build order by
    const orderBy: any = {};
    if (["createdAt", "startDate", "endDate"].includes(sortBy)) {
      orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";
    } else {
      orderBy.createdAt = "desc";
    }

    // Fetch leave requests
    const leaves = await prisma.leave.findMany({
      where,
      orderBy,
      include: {
        deduction: true,
      },
    });

    // Calculate stats for all leaves (not just filtered)
    const allLeaves = await prisma.leave.findMany({
      where: { employeeId: Number(employeeId) },
      select: { status: true },
    });

    const stats = {
      total: allLeaves.length,
      pending: allLeaves.filter((l) => l.status === "PENDING").length,
      approved: allLeaves.filter((l) => l.status === "APPROVED").length,
      rejected: allLeaves.filter((l) => l.status === "REJECTED").length,
    };

    return NextResponse.json({
      ok: true,
      leaves,
      stats,
    });
  } catch (err: any) {
    console.error('GET /api/leave error:', err);
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}

/**
 * DELETE /api/leave/[leaveId]
 * Delete/cancel a leave request
 * 
 * Security:
 * - Only PENDING requests can be deleted
 * - Employees can only delete their own requests
 * - Admins can delete pending requests
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = getUserFromToken(req);
    
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const employeeId = user.userId || user.id;

    if (!employeeId || Number.isNaN(Number(employeeId))) {
      return NextResponse.json(
        { ok: false, message: "Invalid employee id" },
        { status: 400 }
      );
    }

    // Extract leaveId from URL path: /api/leave/[leaveId]
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const leaveId = pathParts[pathParts.length - 1];

    if (!leaveId || leaveId === 'leave') {
      return NextResponse.json(
        { ok: false, message: "Leave ID is required" },
        { status: 400 }
      );
    }

    // Verify leave exists
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!existingLeave) {
      return NextResponse.json(
        { ok: false, message: "Leave request not found" },
        { status: 404 }
      );
    }

    // 🔒 SECURITY: Employees can only delete their own leaves (unless admin)
    if (user.role !== "admin" && existingLeave.employeeId !== Number(employeeId)) {
      return NextResponse.json(
        { ok: false, message: "You can only delete your own leave requests" },
        { status: 403 }
      );
    }

    // Can only delete PENDING leaves
    if (existingLeave.status !== "PENDING") {
      return NextResponse.json(
        { 
          ok: false, 
          message: `Only pending leave requests can be deleted. This request is ${existingLeave.status.toLowerCase()}.` 
        },
        { status: 400 }
      );
    }

    // Delete the leave request
    await prisma.leave.delete({
      where: { id: leaveId },
    });

    console.log(`Leave request ${leaveId} deleted by user ${employeeId}`);

    return NextResponse.json({
      ok: true,
      message: "Leave request cancelled successfully",
    });
  } catch (err: any) {
    console.error("DELETE /api/leave error:", err);
    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}

/**
 * PATCH /api/leave/[leaveId]
 * Update leave request status (Admin only)
 * 
 * Body:
 * {
 *   "status": "APPROVED" | "REJECTED" | "PENDING",
 *   "rejectionReason": "string (required if status is REJECTED)"
 * }
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = getUserFromToken(req);
    
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🔒 SECURITY: Only admins can update leave status
    if (user.role !== "admin") {
      return NextResponse.json(
        { ok: false, message: "Only admins can update leave request status" },
        { status: 403 }
      );
    }

    // Extract leaveId from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const leaveId = pathParts[pathParts.length - 1];

    if (!leaveId || leaveId === 'leave') {
      return NextResponse.json(
        { ok: false, message: "Leave ID is required" },
        { status: 400 }
      );
    }

    const bodyRaw = await req.json();
    const UpdateLeaveStatusSchema = z.object({
      status: z.enum(["APPROVED", "REJECTED", "PENDING"]),
      rejectionReason: z.string().optional(),
    });

    const body = UpdateLeaveStatusSchema.parse(bodyRaw);

    // Verify leave exists
    const existingLeave = await prisma.leave.findUnique({
      where: { id: leaveId },
    });

    if (!existingLeave) {
      return NextResponse.json(
        { ok: false, message: "Leave request not found" },
        { status: 404 }
      );
    }

    // Update the leave request
    const updatedLeave = await prisma.leave.update({
      where: { id: leaveId },
      data: {
        status: body.status,
        rejectionReason: body.rejectionReason || null,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
      include: {
        deduction: true,
      },
    });

    console.log(`Leave request ${leaveId} updated to ${body.status} by admin ${user.id}`);

    return NextResponse.json({
      ok: true,
      message: `Leave request ${body.status.toLowerCase()}`,
      leave: updatedLeave,
    });
  } catch (err: any) {
    console.error("PATCH /api/leave error:", err);

    if (err.name === "ZodError") {
      return NextResponse.json(
        { ok: false, message: "Invalid request data", errors: err.errors },
        { status: 400 }
      );
    }

    const status = err?.status || 500;
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status }
    );
  }
}