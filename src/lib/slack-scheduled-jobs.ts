import {
  type SlackChannel,
  type SlackChannelSendResult,
  type SlackNotification,
  sendToChannel,
} from "@/lib/slack";

export const SLACK_SCHEDULED_TIMEZONE = "America/New_York";

export type SlackScheduledJobKey =
  | "attendance_sod"
  | "attendance_eod"
  | "attendance_export_reminder_am"
  | "attendance_export_reminder_pm"
  | "editor_file_naming_reminder";

export interface SlackScheduledJobDefinition {
  key: SlackScheduledJobKey;
  name: string;
  schedule: string;
  channel: SlackChannel;
  message: string;
  enabledEnvVar: string;
}

export interface SlackScheduledJobRunResult {
  job: SlackScheduledJobDefinition;
  enabled: boolean;
  skipped: boolean;
  reason?: string;
  delivery?: SlackChannelSendResult;
}

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;

  const normalized = raw.trim().toLowerCase();
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) {
    return false;
  }
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) {
    return true;
  }

  return defaultValue;
}

function areScheduledSlackNotificationsEnabled(): boolean {
  return readBooleanEnv("SLACK_SCHEDULED_NOTIFICATIONS_ENABLED", true);
}

export const SLACK_SCHEDULED_JOBS: SlackScheduledJobDefinition[] = [
  {
    key: "attendance_sod",
    name: "Slack Attendance SOD Reminder",
    schedule: "0 9 * * *",
    channel: "attendance",
    message:
      "Good morning! Please send your SOD check-in now to mark attendance.",
    enabledEnvVar: "SLACK_ATTENDANCE_SOD_ENABLED",
  },
  {
    key: "attendance_eod",
    name: "Slack Attendance EOD Reminder",
    schedule: "0 17 * * *",
    channel: "attendance",
    message: "Wrapping up? Please send your EOD check-in now.",
    enabledEnvVar: "SLACK_ATTENDANCE_EOD_ENABLED",
  },
  {
    key: "attendance_export_reminder_am",
    name: "Slack Attendance Export Reminder (AM)",
    schedule: "0 10 * * *",
    channel: "attendance",
    message:
      "Reminder: Export your videos and upload them to the E8 App so QC can review and provide feedback. Stay on track to hit deliverables!",
    enabledEnvVar: "SLACK_ATTENDANCE_EXPORT_REMINDER_AM_ENABLED",
  },
  {
    key: "attendance_export_reminder_pm",
    name: "Slack Attendance Export Reminder (PM)",
    schedule: "30 15 * * *",
    channel: "attendance",
    message:
      "Reminder: Export your videos and upload them to the E8 App so QC can review and provide feedback. Stay on track to hit deliverables!",
    enabledEnvVar: "SLACK_ATTENDANCE_EXPORT_REMINDER_PM_ENABLED",
  },
  {
    key: "editor_file_naming_reminder",
    name: "Slack Editor File Naming Reminder",
    schedule: "0 9 * * *",
    channel: "editors",
    message: [
      "Good morning! Please ensure all videos exported to the E8 App are named using the correct format:",
      "{ClientName_MM-DD-YYYY_FormatCode}",
      "Example: CoinLaundryAssociation_04-01-2026_SF3",
    ].join("\n"),
    enabledEnvVar: "SLACK_EDITOR_FILE_NAMING_REMINDER_ENABLED",
  },
];

function isJobEnabled(job: SlackScheduledJobDefinition): boolean {
  return (
    areScheduledSlackNotificationsEnabled() &&
    readBooleanEnv(job.enabledEnvVar, true)
  );
}

export function getEnabledSlackScheduledJobs(): SlackScheduledJobDefinition[] {
  return SLACK_SCHEDULED_JOBS.filter(isJobEnabled);
}

export function getSlackScheduledJob(
  jobKey: SlackScheduledJobKey,
): SlackScheduledJobDefinition | undefined {
  return SLACK_SCHEDULED_JOBS.find((job) => job.key === jobKey);
}

export async function runSlackScheduledJob(
  jobKey: SlackScheduledJobKey,
): Promise<SlackScheduledJobRunResult> {
  const job = getSlackScheduledJob(jobKey);

  if (!job) {
    throw new Error(`Unknown Slack scheduled job: ${jobKey}`);
  }

  if (!areScheduledSlackNotificationsEnabled()) {
    return {
      job,
      enabled: false,
      skipped: true,
      reason: "Global scheduled Slack notifications are disabled.",
    };
  }

  if (!readBooleanEnv(job.enabledEnvVar, true)) {
    return {
      job,
      enabled: false,
      skipped: true,
      reason: `${job.enabledEnvVar} is disabled.`,
    };
  }

  const notification: SlackNotification = {
    type: "scheduled_reminder",
    title: job.name,
    message: job.message,
    payload: {
      scheduledJobKey: job.key,
      scheduledChannelGroup: job.channel,
      scheduledTimezone: SLACK_SCHEDULED_TIMEZONE,
    },
  };

  const delivery = await sendToChannel(job.channel, notification);

  return {
    job,
    enabled: true,
    skipped: false,
    delivery,
  };
}
