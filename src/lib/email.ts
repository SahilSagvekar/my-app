// src/lib/email.ts
import nodemailer from "nodemailer";

export async function sendTaskAssignedEmail(to: string, taskTitle: string) {
  const transporter = nodemailer.createTransport({
    service: "Gmail", // or use your SMTP provider
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Task Manager" <${process.env.EMAIL_USER}>`,
    to,
    subject: "New Task Assigned",
    text: `You have been assigned a new task: ${taskTitle}`,
    html: `<p>You have been assigned a new task: <b>${taskTitle}</b></p>`,
  });
}
