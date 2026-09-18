import { pgTable, uniqueIndex, text, timestamp, foreignKey, integer, boolean, serial, numeric, varchar, type AnyPgColumn, index, jsonb, bigint, doublePrecision, date, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const bidStatus = pgEnum("BidStatus", ['PENDING', 'ACCEPTED', 'REJECTED'])
export const clientExpenseStatus = pgEnum("ClientExpenseStatus", ['PENDING', 'INVOICED', 'PAID'])
export const contractStatus = pgEnum("ContractStatus", ['DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED'])
export const employeeStatus = pgEnum("EmployeeStatus", ['ACTIVE', 'INACTIVE', 'TERMINATED'])
export const feedbackCategory = pgEnum("FeedbackCategory", ['GENERAL', 'TECHNICAL', 'WORKFLOW', 'SUGGESTION', 'BUG_REPORT'])
export const feedbackPriority = pgEnum("FeedbackPriority", ['LOW', 'MEDIUM', 'HIGH'])
export const feedbackStatus = pgEnum("FeedbackStatus", ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED'])
export const fileDeletionRequestStatus = pgEnum("FileDeletionRequestStatus", ['PENDING', 'APPROVED', 'REJECTED'])
export const hiringCandidateStatus = pgEnum("HiringCandidateStatus", ['NEW', 'CONTACTED', 'TEST_SENT', 'TEST_SUBMITTED', 'IN_REVIEW', 'HIRED', 'REJECTED'])
export const hiringTestTaskStatus = pgEnum("HiringTestTaskStatus", ['PENDING', 'SENT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'])
export const invoiceStatus = pgEnum("InvoiceStatus", ['DRAFT', 'PENDING', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELED', 'REFUNDED'])
export const jobStatus = pgEnum("JobStatus", ['OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED'])
export const leaveStatus = pgEnum("LeaveStatus", ['PENDING', 'APPROVED', 'REJECTED'])
export const logEntryStatus = pgEnum("LogEntryStatus", ['PLANNED', 'COMPLETED'])
export const logEntryType = pgEnum("LogEntryType", ['CALL', 'MEETING', 'ANALYTICS_REVIEW'])
export const paymentStatus = pgEnum("PaymentStatus", ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'REFUNDED'])
export const payrollStatus = pgEnum("PayrollStatus", ['PENDING', 'PAID'])
export const periodType = pgEnum("PeriodType", ['DAILY', 'WEEKLY', 'MONTHLY'])
export const portalAccessStatus = pgEnum("PortalAccessStatus", ['ONBOARDING', 'CONTRACT_PENDING', 'PAYMENT_PENDING', 'ACTIVE', 'LOCKED', 'ADMIN_UNLOCKED'])
export const preClientStatus = pgEnum("PreClientStatus", ['QUALIFIED', 'QUOTED', 'QUOTE_ACCEPTED', 'PROVISIONING', 'CONVERTED'])
export const quoteStatus = pgEnum("QuoteStatus", ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED'])
export const rawFootageFolderCode = pgEnum("RawFootageFolderCode", ['SF', 'LF'])
export const role = pgEnum("Role", ['admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'sales', 'sales_manager'])
export const signerStatus = pgEnum("SignerStatus", ['PENDING', 'VIEWED', 'SIGNED', 'DECLINED'])
export const subscriptionStatus = pgEnum("SubscriptionStatus", ['ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'TRIALING', 'PAUSED'])
export const syncStatus = pgEnum("SyncStatus", ['PENDING', 'SYNCING', 'COMPLETED', 'FAILED'])
export const taskStatus = pgEnum("TaskStatus", ['PENDING', 'IN_PROGRESS', 'READY_FOR_QC', 'QC_IN_PROGRESS', 'COMPLETED', 'SCHEDULED', 'ON_HOLD', 'REJECTED_BY_QC', 'REJECTED_BY_CLIENT', 'CLIENT_REVIEW', 'VIDEOGRAPHER_ASSIGNED', 'POSTED', 'HIDDEN', 'CANCELLED'])


export const verificationToken = pgTable("VerificationToken", {
	identifier: text().notNull(),
	token: text().notNull(),
	expires: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("VerificationToken_identifier_token_key").using("btree", table.identifier.asc().nullsLast().op("text_ops"), table.token.asc().nullsLast().op("text_ops")),
	uniqueIndex("VerificationToken_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
]);

export const monthlyDeliverable = pgTable("MonthlyDeliverable", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	type: text().notNull(),
	quantity: integer().notNull(),
	videosPerDay: integer().notNull(),
	postingSchedule: text().notNull(),
	postingDays: text().array(),
	postingTimes: text().array(),
	platforms: text().array(),
	description: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	isTrial: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "MonthlyDeliverable_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const brandAsset = pgTable("BrandAsset", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	fileUrl: text().notNull(),
	fileName: text().notNull(),
	fileSize: text().notNull(),
	uploadedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	uploadedBy: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "BrandAsset_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const monthlyRun = pgTable("MonthlyRun", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	month: integer().notNull(),
	year: integer().notNull(),
	runAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "MonthlyRun_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const bonus = pgTable("Bonus", {
	id: serial().primaryKey().notNull(),
	employeeId: integer().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	addedBy: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [user.id],
			name: "Bonus_employeeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const notificationPreference = pgTable("NotificationPreference", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	channel: text().notNull(),
	enabled: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("NotificationPreference_userId_channel_key").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.channel.asc().nullsLast().op("int4_ops")),
]);

export const leave = pgTable("Leave", {
	id: serial().primaryKey().notNull(),
	employeeId: integer().notNull(),
	startDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	reason: text(),
	status: leaveStatus().default('PENDING').notNull(),
	numberOfDays: integer().notNull(),
	approvedBy: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [user.id],
			name: "Leave_employeeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const account = pgTable("Account", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	type: text().default('pending').notNull(),
	provider: text().notNull(),
	providerAccountId: text().notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
}, (table) => [
	uniqueIndex("Account_provider_providerAccountId_key").using("btree", table.provider.asc().nullsLast().op("text_ops"), table.providerAccountId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Account_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const deduction = pgTable("Deduction", {
	id: serial().primaryKey().notNull(),
	employeeId: integer().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	leaveId: integer(),
	month: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("Deduction_leaveId_key").using("btree", table.leaveId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [user.id],
			name: "Deduction_employeeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.leaveId],
			foreignColumns: [leave.id],
			name: "Deduction_leaveId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const payroll = pgTable("Payroll", {
	id: serial().primaryKey().notNull(),
	employeeId: integer().notNull(),
	periodStart: timestamp({ precision: 3, mode: 'string' }).notNull(),
	periodEnd: timestamp({ precision: 3, mode: 'string' }).notNull(),
	baseSalary: numeric({ precision: 12, scale:  2 }).notNull(),
	totalBonuses: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	totalDeductions: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	netPay: numeric({ precision: 12, scale:  2 }).notNull(),
	status: payrollStatus().default('PENDING').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	paidAt: timestamp({ precision: 3, mode: 'string' }),
	hidden: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [user.id],
			name: "Payroll_employeeId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const prismaMigrations = pgTable("_prisma_migrations", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	checksum: varchar({ length: 64 }).notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	migrationName: varchar("migration_name", { length: 255 }).notNull(),
	logs: text(),
	rolledBackAt: timestamp("rolled_back_at", { withTimezone: true, mode: 'string' }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	appliedStepsCount: integer("applied_steps_count").default(0).notNull(),
});

export const session = pgTable("Session", {
	id: text().primaryKey().notNull(),
	sessionToken: text().notNull(),
	userId: integer().notNull(),
	expires: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("Session_sessionToken_key").using("btree", table.sessionToken.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Session_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const user = pgTable("User", {
	id: serial().primaryKey().notNull(),
	name: text(),
	email: text().notNull(),
	password: text(),
	image: text(),
	role: role(),
	hourlyRate: numeric({ precision: 10, scale:  2 }),
	monthlyBaseHours: integer(),
	employeeStatus: employeeStatus().default('ACTIVE'),
	joinedAt: timestamp({ precision: 3, mode: 'string' }),
	worksOnSaturday: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	resetOtp: text(),
	resetOtpExpiry: timestamp({ precision: 3, mode: 'string' }),
	hoursPerWeek: numeric({ precision: 5, scale:  2 }).default('0'),
	phone: text(),
	monthlyRate: integer(),
	linkedClientId: text(),
	emailNotifications: boolean().default(true).notNull(),
	slackNotifications: boolean().default(false).notNull(),
	slackUserId: text(),
	loginOtp: text(),
	loginOtpExpiry: timestamp({ precision: 3, mode: 'string' }),
	// TODO: failed to parse database type 'Role"[]'
	roles: role("roles").array(),
}, (table) => [
	index("User_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("User_employeeStatus_idx").using("btree", table.employeeStatus.asc().nullsLast().op("enum_ops")),
	index("User_linkedClientId_idx").using("btree", table.linkedClientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("User_phone_key").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("User_role_idx").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.linkedClientId],
			foreignColumns: [client.id],
			name: "User_linkedClientId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const auditLog = pgTable("AuditLog", {
	id: serial().primaryKey().notNull(),
	userId: integer(),
	action: text().notNull(),
	entity: text(),
	entityId: text(),
	details: text(),
	metadata: jsonb(),
	ipAddress: text(),
	userAgent: text(),
	timestamp: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("AuditLog_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("AuditLog_entity_entityId_idx").using("btree", table.entity.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("AuditLog_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	index("AuditLog_userId_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "AuditLog_userId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const feedback = pgTable("Feedback", {
	id: text().primaryKey().notNull(),
	subject: text().notNull(),
	message: text().notNull(),
	category: text().notNull(),
	priority: text().notNull(),
	status: text().default('pending').notNull(),
	senderId: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("Feedback_senderId_idx").using("btree", table.senderId.asc().nullsLast().op("int4_ops")),
	index("Feedback_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [user.id],
			name: "Feedback_senderId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const feedbackResponse = pgTable("FeedbackResponse", {
	id: text().primaryKey().notNull(),
	message: text().notNull(),
	feedbackId: text().notNull(),
	senderId: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("FeedbackResponse_feedbackId_idx").using("btree", table.feedbackId.asc().nullsLast().op("text_ops")),
	index("FeedbackResponse_senderId_idx").using("btree", table.senderId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.feedbackId],
			foreignColumns: [feedback.id],
			name: "FeedbackResponse_feedbackId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [user.id],
			name: "FeedbackResponse_senderId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const recurringTask = pgTable("RecurringTask", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	deliverableId: text().notNull(),
	templateTaskId: text(),
	nextRunDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	lastRunDate: timestamp({ precision: 3, mode: 'string' }),
	scheduleType: text().notNull(),
	active: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	defaultAssignedTo: integer(),
	defaultQcSpecialist: integer(),
	defaultScheduler: integer(),
	defaultVideographer: integer(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "RecurringTask_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.deliverableId],
			foreignColumns: [monthlyDeliverable.id],
			name: "RecurringTask_deliverableId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.templateTaskId],
			foreignColumns: [task.id],
			name: "RecurringTask_templateTaskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const qcAchievement = pgTable("QCAchievement", {
	id: text().primaryKey().notNull(),
	qcSpecialistId: integer().notNull(),
	achievementType: text().notNull(),
	unlockedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	achievementData: jsonb(),
}, (table) => [
	index("QCAchievement_achievementType_idx").using("btree", table.achievementType.asc().nullsLast().op("text_ops")),
	uniqueIndex("QCAchievement_qcSpecialistId_achievementType_key").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops"), table.achievementType.asc().nullsLast().op("text_ops")),
	index("QCAchievement_qcSpecialistId_idx").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.qcSpecialistId],
			foreignColumns: [user.id],
			name: "QCAchievement_qcSpecialistId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const userSecurityPin = pgTable("UserSecurityPin", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	pinHash: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	lastVerifiedAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	uniqueIndex("UserSecurityPin_userId_key").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserSecurityPin_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const loginAuditLog = pgTable("LoginAuditLog", {
	id: text().primaryKey().notNull(),
	action: text().notNull(),
	loginId: text(),
	userId: integer().notNull(),
	details: text(),
	ipAddress: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("LoginAuditLog_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("LoginAuditLog_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("LoginAuditLog_loginId_idx").using("btree", table.loginId.asc().nullsLast().op("text_ops")),
	index("LoginAuditLog_userId_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.loginId],
			foreignColumns: [socialLogin.id],
			name: "LoginAuditLog_loginId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "LoginAuditLog_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const qcAnalytics = pgTable("QCAnalytics", {
	id: text().primaryKey().notNull(),
	qcSpecialistId: integer().notNull(),
	avgReviewTime: numeric({ precision: 10, scale:  2 }).notNull(),
	approvalRate: numeric({ precision: 10, scale:  2 }).notNull(),
	firstPassRate: numeric({ precision: 10, scale:  2 }).notNull(),
	totalReviews: integer().default(0).notNull(),
	approvedCount: integer().default(0).notNull(),
	rejectedCount: integer().default(0).notNull(),
	period: text().default('month').notNull(),
	startDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	calculatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("QCAnalytics_calculatedAt_idx").using("btree", table.calculatedAt.asc().nullsLast().op("timestamp_ops")),
	index("QCAnalytics_period_idx").using("btree", table.period.asc().nullsLast().op("text_ops")),
	index("QCAnalytics_qcSpecialistId_idx").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("QCAnalytics_qcSpecialistId_period_startDate_key").using("btree", table.qcSpecialistId.asc().nullsLast().op("timestamp_ops"), table.period.asc().nullsLast().op("int4_ops"), table.startDate.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.qcSpecialistId],
			foreignColumns: [user.id],
			name: "QCAnalytics_qcSpecialistId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const qcRejectionReason = pgTable("QCRejectionReason", {
	id: text().primaryKey().notNull(),
	qcSpecialistId: integer().notNull(),
	reason: text().notNull(),
	caseCount: integer().default(1).notNull(),
	taskIds: text().array(),
	firstOccurrence: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	lastOccurrence: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("QCRejectionReason_qcSpecialistId_idx").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("QCRejectionReason_qcSpecialistId_reason_key").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops"), table.reason.asc().nullsLast().op("text_ops")),
	index("QCRejectionReason_reason_idx").using("btree", table.reason.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.qcSpecialistId],
			foreignColumns: [user.id],
			name: "QCRejectionReason_qcSpecialistId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const qcMonthlyTrend = pgTable("QCMonthlyTrend", {
	id: text().primaryKey().notNull(),
	qcSpecialistId: integer().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	reviewCount: integer().default(0).notNull(),
	approvedCount: integer().default(0).notNull(),
	rejectedCount: integer().default(0).notNull(),
	avgReviewTime: numeric({ precision: 10, scale:  2 }).notNull(),
	approvalRate: numeric({ precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("QCMonthlyTrend_qcSpecialistId_idx").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("QCMonthlyTrend_qcSpecialistId_year_month_key").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops"), table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops")),
	index("QCMonthlyTrend_year_month_idx").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.qcSpecialistId],
			foreignColumns: [user.id],
			name: "QCMonthlyTrend_qcSpecialistId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const qcCategoryMetrics = pgTable("QCCategoryMetrics", {
	id: text().primaryKey().notNull(),
	qcSpecialistId: integer().notNull(),
	category: text().notNull(),
	reviewCount: integer().default(0).notNull(),
	approvedCount: integer().default(0).notNull(),
	rejectedCount: integer().default(0).notNull(),
	approvalRate: numeric({ precision: 10, scale:  2 }).notNull(),
	avgReviewTime: numeric({ precision: 10, scale:  2 }).notNull(),
	period: text().default('month').notNull(),
	startDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("QCCategoryMetrics_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	uniqueIndex("QCCategoryMetrics_qcSpecialistId_category_period_startDate_key").using("btree", table.qcSpecialistId.asc().nullsLast().op("timestamp_ops"), table.category.asc().nullsLast().op("text_ops"), table.period.asc().nullsLast().op("timestamp_ops"), table.startDate.asc().nullsLast().op("timestamp_ops")),
	index("QCCategoryMetrics_qcSpecialistId_idx").using("btree", table.qcSpecialistId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.qcSpecialistId],
			foreignColumns: [user.id],
			name: "QCCategoryMetrics_qcSpecialistId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const task = pgTable("Task", {
	id: text().primaryKey().notNull(),
	title: text(),
	description: text().notNull(),
	taskType: text(),
	status: taskStatus().default('PENDING'),
	dueDate: timestamp({ precision: 3, mode: 'string' }),
	clientUserId: integer(),
	folderType: text(),
	assignedTo: integer().notNull(),
	qcSpecialist: integer("qc_specialist"),
	scheduler: integer(),
	videographer: integer(),
	createdBy: integer(),
	clientId: text(),
	monthlyDeliverableId: text(),
	driveFolderId: text(),
	attachments: jsonb(),
	driveLinks: text().array(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	priority: text(),
	taskCategory: text(),
	nextDestination: text(),
	clientReview: boolean().default(false),
	requiresClientReview: boolean().default(false),
	workflowStep: text(),
	feedback: text(),
	qcNotes: text(),
	qcResult: text(),
	route: text(),
	monthFolder: text(),
	outputFolderId: text(),
	deliverableType: text(),
	hasCovers: boolean().default(false).notNull(),
	hasMainFile: boolean().default(false).notNull(),
	hasMusicLicense: boolean().default(false).notNull(),
	hasThumbnails: boolean().default(false).notNull(),
	hasTiles: boolean().default(false).notNull(),
	socialMediaLinks: jsonb().default([]).notNull(),
	platform: text(),
	suggestedTitles: jsonb(),
	titlingError: text(),
	titlingStatus: text().default('NONE').notNull(),
	transcript: text(),
	transcriptSummary: text(),
	qcReviewedAt: timestamp({ precision: 3, mode: 'string' }),
	qcReviewedBy: integer(),
	oneOffDeliverableId: text(),
	recurringMonth: text(),
	billedAt: timestamp({ precision: 3, mode: 'string' }),
	invoiceId: text(),
	isTrial: boolean().default(false).notNull(),
	extraSequence: integer(),
	isExtra: boolean().default(false).notNull(),
	relatedTaskId: text(),
	titleSetByQc: boolean().default(false).notNull(),
	postingTitle: text(),
	isSponsored: boolean().default(false).notNull(),
	noActionRequired: boolean().default(false).notNull(),
	titleSetByClient: boolean().default(false).notNull(),
	postingDescriptions: jsonb(),
	postingTags: jsonb(),
	postingTitles: jsonb(),
	textContent: text(),
	clientReviewStartedAt: timestamp({ precision: 3, mode: 'string' }),
	lastReminderSentAt: timestamp({ precision: 3, mode: 'string' }),
	shootScriptRef: text(),
	linkedRawFootagePaths: text().array(),
}, (table) => [
	index("Task_assignedTo_idx").using("btree", table.assignedTo.asc().nullsLast().op("int4_ops")),
	index("Task_assignedTo_status_idx").using("btree", table.assignedTo.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("int4_ops")),
	index("Task_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("Task_clientId_monthlyDeliverableId_monthFolder_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.monthlyDeliverableId.asc().nullsLast().op("text_ops"), table.monthFolder.asc().nullsLast().op("text_ops")),
	index("Task_clientId_status_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("Task_clientReviewStartedAt_idx").using("btree", table.clientReviewStartedAt.asc().nullsLast().op("timestamp_ops")),
	index("Task_clientUserId_idx").using("btree", table.clientUserId.asc().nullsLast().op("int4_ops")),
	index("Task_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("Task_dueDate_status_idx").using("btree", table.dueDate.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("timestamp_ops")),
	index("Task_isExtra_idx").using("btree", table.isExtra.asc().nullsLast().op("bool_ops")),
	index("Task_monthFolder_idx").using("btree", table.monthFolder.asc().nullsLast().op("text_ops")),
	index("Task_qcReviewedBy_idx").using("btree", table.qcReviewedBy.asc().nullsLast().op("int4_ops")),
	index("Task_qc_specialist_idx").using("btree", table.qcSpecialist.asc().nullsLast().op("int4_ops")),
	index("Task_scheduler_idx").using("btree", table.scheduler.asc().nullsLast().op("int4_ops")),
	index("Task_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("Task_videographer_idx").using("btree", table.videographer.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.monthlyDeliverableId],
			foreignColumns: [monthlyDeliverable.id],
			name: "Task_monthlyDeliverableId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.assignedTo],
			foreignColumns: [user.id],
			name: "Task_assignedTo_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "Task_clientId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.clientUserId],
			foreignColumns: [user.id],
			name: "Task_clientUserId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.qcReviewedBy],
			foreignColumns: [user.id],
			name: "Task_qcReviewedBy_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.oneOffDeliverableId],
			foreignColumns: [oneOffDeliverable.id],
			name: "Task_oneOffDeliverableId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoice.id],
			name: "Task_invoiceId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.relatedTaskId],
			foreignColumns: [table.id],
			name: "Task_relatedTaskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const userTwoFactorAuth = pgTable("UserTwoFactorAuth", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	totpSecret: text().notNull(),
	isEnabled: boolean().default(false).notNull(),
	backupCodes: text().array(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	lastVerifiedAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	index("UserTwoFactorAuth_userId_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("UserTwoFactorAuth_userId_key").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserTwoFactorAuth_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const shareableReview = pgTable("ShareableReview", {
	id: text().primaryKey().notNull(),
	taskId: text().notNull(),
	shareToken: text().notNull(),
	createdBy: integer().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
	viewCount: integer().default(0).notNull(),
	lastViewedAt: timestamp({ precision: 3, mode: 'string' }),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("ShareableReview_createdBy_idx").using("btree", table.createdBy.asc().nullsLast().op("int4_ops")),
	index("ShareableReview_expiresAt_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamp_ops")),
	index("ShareableReview_shareToken_idx").using("btree", table.shareToken.asc().nullsLast().op("text_ops")),
	uniqueIndex("ShareableReview_shareToken_key").using("btree", table.shareToken.asc().nullsLast().op("text_ops")),
]);

export const socialLogin = pgTable("SocialLogin", {
	id: text().primaryKey().notNull(),
	clientId: text(),
	platform: text().notNull(),
	username: text().notNull(),
	encryptedPassword: text().notNull(),
	recoveryEmail: text(),
	recoveryPhone: text(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	updatedById: integer().notNull(),
	adminOnly: boolean().default(false).notNull(),
	backupCodesLocation: text(),
	loginUrl: text(),
	passwordChangedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	allowedRoles: text().array(),
	allowedUserIds: integer().array(),
	accessRole: text(),
}, (table) => [
	index("SocialLogin_adminOnly_idx").using("btree", table.adminOnly.asc().nullsLast().op("bool_ops")),
	index("SocialLogin_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SocialLogin_clientId_platform_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.platform.asc().nullsLast().op("text_ops")),
	index("SocialLogin_platform_idx").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "SocialLogin_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.updatedById],
			foreignColumns: [user.id],
			name: "SocialLogin_updatedById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const titlingJob = pgTable("TitlingJob", {
	id: text().primaryKey().notNull(),
	taskId: text().notNull(),
	status: text().default('PENDING').notNull(),
	assemblyId: text(),
	error: text(),
	attempts: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	startedAt: timestamp({ precision: 3, mode: 'string' }),
	completedAt: timestamp({ precision: 3, mode: 'string' }),
	videoFileId: text(),
	videoFileName: text(),
	videoDuration: integer(),
}, (table) => [
	index("TitlingJob_assemblyId_idx").using("btree", table.assemblyId.asc().nullsLast().op("text_ops")),
	index("TitlingJob_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("TitlingJob_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("TitlingJob_taskId_key").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "TitlingJob_taskId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const activityReport = pgTable("ActivityReport", {
	id: text().primaryKey().notNull(),
	fileName: text().notNull(),
	fileUrl: text(),
	reportDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	generatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	metadata: jsonb(),
	status: text().default('completed').notNull(),
}, (table) => [
	index("ActivityReport_generatedAt_idx").using("btree", table.generatedAt.asc().nullsLast().op("timestamp_ops")),
	index("ActivityReport_reportDate_idx").using("btree", table.reportDate.asc().nullsLast().op("timestamp_ops")),
]);

export const shareableFile = pgTable("ShareableFile", {
	id: text().primaryKey().notNull(),
	s3Key: text().notNull(),
	fileName: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSize: bigint({ mode: "number" }),
	mimeType: text(),
	shareToken: text().notNull(),
	createdBy: integer().notNull(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
	viewCount: integer().default(0).notNull(),
	lastViewedAt: timestamp({ precision: 3, mode: 'string' }),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("ShareableFile_createdBy_idx").using("btree", table.createdBy.asc().nullsLast().op("int4_ops")),
	index("ShareableFile_shareToken_idx").using("btree", table.shareToken.asc().nullsLast().op("text_ops")),
	uniqueIndex("ShareableFile_shareToken_key").using("btree", table.shareToken.asc().nullsLast().op("text_ops")),
]);

export const notification = pgTable("Notification", {
	id: text().primaryKey().notNull(),
	userId: integer(),
	type: text().notNull(),
	title: text().notNull(),
	body: text(),
	payload: jsonb(),
	channel: text().array(),
	delivered: boolean().default(false).notNull(),
	read: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("Notification_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("Notification_userId_createdAt_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("Notification_userId_read_idx").using("btree", table.userId.asc().nullsLast().op("bool_ops"), table.read.asc().nullsLast().op("bool_ops")),
]);

export const youTubeSnapshot = pgTable("YouTubeSnapshot", {
	id: text().primaryKey().notNull(),
	channelId: text().notNull(),
	clientId: text().notNull(),
	subscriberCount: integer().default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	views: bigint({ mode: "number" }).default(0).notNull(),
	watchTimeHours: doublePrecision().default(0).notNull(),
	estimatedRevenue: doublePrecision(),
	likes: integer().default(0).notNull(),
	comments: integer().default(0).notNull(),
	shares: integer().default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	impressions: bigint({ mode: "number" }).default(0).notNull(),
	impressionsCtr: doublePrecision(),
	avgViewDuration: doublePrecision(),
	subscribersGained: integer().default(0).notNull(),
	subscribersLost: integer().default(0).notNull(),
	geographyData: jsonb(),
	deviceData: jsonb(),
	periodStart: timestamp({ precision: 3, mode: 'string' }).notNull(),
	periodEnd: timestamp({ precision: 3, mode: 'string' }).notNull(),
	periodType: periodType().default('DAILY').notNull(),
	snapshotDate: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	dateRange: text().default('28d').notNull(),
}, (table) => [
	uniqueIndex("YouTubeSnapshot_channelId_dateRange_key").using("btree", table.channelId.asc().nullsLast().op("text_ops"), table.dateRange.asc().nullsLast().op("text_ops")),
	index("YouTubeSnapshot_channelId_idx").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	index("YouTubeSnapshot_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("YouTubeSnapshot_dateRange_idx").using("btree", table.dateRange.asc().nullsLast().op("text_ops")),
	index("YouTubeSnapshot_snapshotDate_idx").using("btree", table.snapshotDate.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [youTubeChannel.id],
			name: "YouTubeSnapshot_channelId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "YouTubeSnapshot_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const youTubeVideoStat = pgTable("YouTubeVideoStat", {
	id: text().primaryKey().notNull(),
	channelId: text().notNull(),
	videoId: text().notNull(),
	title: text().notNull(),
	publishedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	thumbnailUrl: text(),
	duration: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	views: bigint({ mode: "number" }).default(0).notNull(),
	likes: integer().default(0).notNull(),
	comments: integer().default(0).notNull(),
	shares: integer().default(0).notNull(),
	watchTimeHours: doublePrecision().default(0).notNull(),
	avgViewDuration: doublePrecision(),
	estimatedRevenue: doublePrecision(),
	lastUpdated: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("YouTubeVideoStat_channelId_idx").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	uniqueIndex("YouTubeVideoStat_channelId_videoId_key").using("btree", table.channelId.asc().nullsLast().op("text_ops"), table.videoId.asc().nullsLast().op("text_ops")),
	index("YouTubeVideoStat_publishedAt_idx").using("btree", table.publishedAt.asc().nullsLast().op("timestamp_ops")),
	index("YouTubeVideoStat_videoId_idx").using("btree", table.videoId.asc().nullsLast().op("text_ops")),
	index("YouTubeVideoStat_views_idx").using("btree", table.views.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [youTubeChannel.id],
			name: "YouTubeVideoStat_channelId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const youTubeChannel = pgTable("YouTubeChannel", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	channelId: text().notNull(),
	channelTitle: text(),
	channelAvatar: text(),
	accessToken: text().notNull(),
	refreshToken: text().notNull(),
	tokenExpiry: timestamp({ precision: 3, mode: 'string' }).notNull(),
	scope: text(),
	subscriberCount: integer().default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalViews: bigint({ mode: "number" }).default(0).notNull(),
	totalVideos: integer().default(0).notNull(),
	lastSyncedAt: timestamp({ precision: 3, mode: 'string' }),
	syncStatus: syncStatus().default('PENDING').notNull(),
	syncError: text(),
	isActive: boolean().default(true).notNull(),
	connectedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("YouTubeChannel_channelId_idx").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	uniqueIndex("YouTubeChannel_channelId_key").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	index("YouTubeChannel_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("YouTubeChannel_clientId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("YouTubeChannel_syncStatus_idx").using("btree", table.syncStatus.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "YouTubeChannel_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const shootDetail = pgTable("ShootDetail", {
	id: text().primaryKey().notNull(),
	taskId: text().notNull(),
	location: text(),
	shootDate: timestamp({ precision: 3, mode: 'string' }),
	referenceLinks: text().array(),
	referenceFiles: jsonb(),
	camera: text(),
	quality: text(),
	frameRate: text(),
	lighting: text(),
	exclusions: text(),
	videographerNotes: text(),
	videographerId: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	hostName: text(),
	equipmentIds: text().array(),
	equipmentReturnedAt: timestamp({ precision: 3, mode: 'string' }),
	equipmentReturnedPhotoUrl: text(),
	equipmentReturnedBy: integer(),
	equipmentReturnedPhotoUrls: text().array(),
	scriptContent: text(),
	scriptStatus: text().default('draft').notNull(),
	scriptSentAt: timestamp({ precision: 3, mode: 'string' }),
	scriptSentBy: integer(),
	scriptLastEditedAt: timestamp({ precision: 3, mode: 'string' }),
	scriptLastEditedBy: integer(),
	plannedStartTime: timestamp({ precision: 3, mode: 'string' }),
	plannedEndTime: timestamp({ precision: 3, mode: 'string' }),
	actualStartTime: timestamp({ precision: 3, mode: 'string' }),
	actualEndTime: timestamp({ precision: 3, mode: 'string' }),
	cancelledAt: timestamp({ precision: 3, mode: 'string' }),
	cancelledBy: integer(),
	cancellationReason: text(),
	// Points to the newly-created Task that replaces this cancelled shoot.
	replacementTaskId: text(),
	// Set on the replacement shoot itself, pointing back at the one it replaced.
	replacesTaskId: text(),
}, (table) => [
	uniqueIndex("ShootDetail_taskId_key").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "ShootDetail_taskId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.videographerId],
			foreignColumns: [user.id],
			name: "ShootDetail_videographerId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.cancelledBy],
			foreignColumns: [user.id],
			name: "ShootDetail_cancelledBy_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.replacementTaskId],
			foreignColumns: [task.id],
			name: "ShootDetail_replacementTaskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.replacesTaskId],
			foreignColumns: [task.id],
			name: "ShootDetail_replacesTaskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const metaAccount = pgTable("MetaAccount", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	instagramId: text(),
	facebookPageId: text(),
	username: text(),
	profilePicture: text(),
	accessToken: text().notNull(),
	tokenExpiry: timestamp({ precision: 3, mode: 'string' }).notNull(),
	followerCount: integer().default(0).notNull(),
	followingCount: integer().default(0).notNull(),
	mediaCount: integer().default(0).notNull(),
	lastSyncedAt: timestamp({ precision: 3, mode: 'string' }),
	syncStatus: syncStatus().default('PENDING').notNull(),
	syncError: text(),
	isActive: boolean().default(true).notNull(),
	connectedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("MetaAccount_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("MetaAccount_clientId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("MetaAccount_instagramId_idx").using("btree", table.instagramId.asc().nullsLast().op("text_ops")),
	uniqueIndex("MetaAccount_instagramId_key").using("btree", table.instagramId.asc().nullsLast().op("text_ops")),
	index("MetaAccount_syncStatus_idx").using("btree", table.syncStatus.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "MetaAccount_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const metaSnapshot = pgTable("MetaSnapshot", {
	id: text().primaryKey().notNull(),
	metaAccountId: text().notNull(),
	clientId: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	impressions: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reach: bigint({ mode: "number" }).default(0).notNull(),
	profileViews: integer().default(0).notNull(),
	websiteClicks: integer().default(0).notNull(),
	followerCount: integer().default(0).notNull(),
	followersGained: integer().default(0).notNull(),
	engagement: integer().default(0).notNull(),
	topPosts: jsonb(),
	demographics: jsonb(),
	periodStart: timestamp({ precision: 3, mode: 'string' }).notNull(),
	periodEnd: timestamp({ precision: 3, mode: 'string' }).notNull(),
	dateRange: text().default('28d').notNull(),
	snapshotDate: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("MetaSnapshot_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("MetaSnapshot_metaAccountId_dateRange_key").using("btree", table.metaAccountId.asc().nullsLast().op("text_ops"), table.dateRange.asc().nullsLast().op("text_ops")),
	index("MetaSnapshot_metaAccountId_idx").using("btree", table.metaAccountId.asc().nullsLast().op("text_ops")),
	index("MetaSnapshot_snapshotDate_idx").using("btree", table.snapshotDate.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.metaAccountId],
			foreignColumns: [metaAccount.id],
			name: "MetaSnapshot_metaAccountId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "MetaSnapshot_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const clientRevenue = pgTable("ClientRevenue", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	platform: text().notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	currency: text().default('INR').notNull(),
	period: timestamp({ precision: 3, mode: 'string' }).notNull(),
	source: text().notNull(),
	isAutomatic: boolean().default(false).notNull(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("ClientRevenue_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("ClientRevenue_clientId_platform_period_source_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.platform.asc().nullsLast().op("text_ops"), table.period.asc().nullsLast().op("timestamp_ops"), table.source.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "ClientRevenue_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const rolePermission = pgTable("RolePermission", {
	id: text().primaryKey().notNull(),
	role: role().notNull(),
	navigationItems: jsonb().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("RolePermission_role_key").using("btree", table.role.asc().nullsLast().op("enum_ops")),
]);

export const job = pgTable("Job", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	location: text(),
	startDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	endDate: timestamp({ precision: 3, mode: 'string' }),
	equipment: text(),
	camera: text(),
	quality: text(),
	frameRate: text(),
	lighting: text(),
	exclusions: text(),
	referenceLinks: text().array(),
	budget: numeric({ precision: 10, scale:  2 }),
	status: jobStatus().default('OPEN').notNull(),
	createdById: integer().notNull(),
	assignedToId: integer(),
	clientId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("Job_assignedToId_idx").using("btree", table.assignedToId.asc().nullsLast().op("int4_ops")),
	index("Job_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("Job_createdById_idx").using("btree", table.createdById.asc().nullsLast().op("int4_ops")),
	index("Job_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "Job_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.assignedToId],
			foreignColumns: [user.id],
			name: "Job_assignedToId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "Job_clientId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const bid = pgTable("Bid", {
	id: text().primaryKey().notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	note: text(),
	status: bidStatus().default('PENDING').notNull(),
	jobId: text().notNull(),
	userId: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Bid_jobId_idx").using("btree", table.jobId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Bid_jobId_userId_key").using("btree", table.jobId.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("text_ops")),
	index("Bid_userId_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [job.id],
			name: "Bid_jobId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Bid_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const slackConfig = pgTable("SlackConfig", {
	id: text().primaryKey().notNull(),
	webhookUrl: text().notNull(),
	channelName: text(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
});

export const guideline = pgTable("Guideline", {
	id: text().primaryKey().notNull(),
	category: text().notNull(),
	title: text().notNull(),
	content: text().notNull(),
	role: role(),
	clientId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "Guideline_clientId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const editorClientPermission = pgTable("EditorClientPermission", {
	id: text().primaryKey().notNull(),
	editorId: integer().notNull(),
	clientId: text().notNull(),
}, (table) => [
	uniqueIndex("EditorClientPermission_editorId_clientId_key").using("btree", table.editorId.asc().nullsLast().op("int4_ops"), table.clientId.asc().nullsLast().op("int4_ops")),
	index("EditorClientPermission_editorId_idx").using("btree", table.editorId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.editorId],
			foreignColumns: [user.id],
			name: "EditorClientPermission_editorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "EditorClientPermission_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const file = pgTable("File", {
	id: text().primaryKey().notNull(),
	taskId: text().notNull(),
	name: text().notNull(),
	url: text().notNull(),
	mimeType: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	size: bigint({ mode: "number" }).notNull(),
	uploadedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	uploadedBy: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	folderType: text(),
	isActive: boolean().default(true).notNull(),
	replacedAt: timestamp({ precision: 3, mode: 'string' }),
	replacedBy: text(),
	revisionNote: text(),
	s3Key: text(),
	version: integer().default(1).notNull(),
	codec: text(),
	archivedToNas: boolean().default(false).notNull(),
	nasArchivedAt: timestamp({ precision: 3, mode: 'string' }),
	nasPath: text(),
	proxyUrl: text(),
	optimizationError: text(),
	optimizationStatus: text().default('NONE').notNull(),
	reviewDriveUrl: text(),
	deletedFromCloud: boolean().default(false).notNull(),
	deletedFromCloudAt: timestamp({ precision: 3, mode: 'string' }),
	youtubeUploadedAt: timestamp({ precision: 3, mode: 'string' }),
	youtubeVideoId: text(),
}, (table) => [
	index("File_taskId_folderType_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops"), table.folderType.asc().nullsLast().op("text_ops")),
	index("File_taskId_isActive_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "File_taskId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const trainingCourse = pgTable("TrainingCourse", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().default('').notNull(),
	role: role().notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("TrainingCourse_role_idx").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	index("TrainingCourse_role_order_idx").using("btree", table.role.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
]);

export const trainingVideo = pgTable("TrainingVideo", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().default('').notNull(),
	videoUrl: text().notNull(),
	role: role().notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	courseId: text(),
}, (table) => [
	index("TrainingVideo_courseId_order_idx").using("btree", table.courseId.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("text_ops")),
	index("TrainingVideo_role_idx").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	index("TrainingVideo_role_order_idx").using("btree", table.role.asc().nullsLast().op("enum_ops"), table.order.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [trainingCourse.id],
			name: "TrainingVideo_courseId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const portfolioSubcategory = pgTable("PortfolioSubcategory", {
	id: text().primaryKey().notNull(),
	categoryId: text().notNull(),
	key: text().notNull(),
	label: text().notNull(),
	iconName: text().default('Video').notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("PortfolioSubcategory_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [portfolioCategory.id],
			name: "PortfolioSubcategory_categoryId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const salesDashboardColumn = pgTable("SalesDashboardColumn", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	name: text().notNull(),
	label: text().notNull(),
	type: text().notNull(),
	width: text().default('w-[150px]'),
	order: integer().default(0).notNull(),
	isVisible: boolean().default(true).notNull(),
	isCustom: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("SalesDashboardColumn_userId_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("SalesDashboardColumn_userId_name_key").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.name.asc().nullsLast().op("int4_ops")),
]);

export const portfolioLead = pgTable("PortfolioLead", {
	id: text().primaryKey().notNull(),
	firstName: text().notNull(),
	lastName: text().notNull(),
	phone: text().notNull(),
	email: text().notNull(),
	serviceNeeded: text().notNull(),
	ipAddress: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("PortfolioLead_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("PortfolioLead_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const portfolioVideo = pgTable("PortfolioVideo", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().default('').notNull(),
	videoUrl: text().notNull(),
	thumbnailUrl: text(),
	category: text().notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("PortfolioVideo_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("PortfolioVideo_category_order_idx").using("btree", table.category.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
	index("PortfolioVideo_isActive_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
]);

export const portfolioCategory = pgTable("PortfolioCategory", {
	id: text().primaryKey().notNull(),
	key: text().notNull(),
	label: text().notNull(),
	iconName: text().default('Film').notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("PortfolioCategory_key_key").using("btree", table.key.asc().nullsLast().op("text_ops")),
]);

export const socialPost = pgTable("SocialPost", {
	id: text().primaryKey().notNull(),
	socialAccountId: text().notNull(),
	platformPostId: text().notNull(),
	postType: text().notNull(),
	title: text(),
	description: text(),
	thumbnailUrl: text(),
	postUrl: text().notNull(),
	publishedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	views: integer().default(0).notNull(),
	likes: integer().default(0).notNull(),
	comments: integer().default(0).notNull(),
	shares: integer().default(0).notNull(),
	saves: integer(),
	watchTime: integer(),
	engagementRate: doublePrecision(),
	taskId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("SocialPost_publishedAt_idx").using("btree", table.publishedAt.asc().nullsLast().op("timestamp_ops")),
	index("SocialPost_socialAccountId_idx").using("btree", table.socialAccountId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SocialPost_socialAccountId_platformPostId_key").using("btree", table.socialAccountId.asc().nullsLast().op("text_ops"), table.platformPostId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.socialAccountId],
			foreignColumns: [socialAccount.id],
			name: "SocialPost_socialAccountId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "SocialPost_taskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const socialAnalytics = pgTable("SocialAnalytics", {
	id: text().primaryKey().notNull(),
	socialAccountId: text().notNull(),
	date: date().notNull(),
	followers: integer().default(0).notNull(),
	followersGained: integer().default(0).notNull(),
	followersLost: integer().default(0).notNull(),
	views: integer().default(0).notNull(),
	likes: integer().default(0).notNull(),
	comments: integer().default(0).notNull(),
	shares: integer().default(0).notNull(),
	impressions: integer(),
	reach: integer(),
	engagementRate: doublePrecision(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("SocialAnalytics_socialAccountId_date_idx").using("btree", table.socialAccountId.asc().nullsLast().op("date_ops"), table.date.asc().nullsLast().op("date_ops")),
	uniqueIndex("SocialAnalytics_socialAccountId_date_key").using("btree", table.socialAccountId.asc().nullsLast().op("date_ops"), table.date.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.socialAccountId],
			foreignColumns: [socialAccount.id],
			name: "SocialAnalytics_socialAccountId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const contractTemplate = pgTable("ContractTemplate", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	s3Key: text().notNull(),
	fileName: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSize: bigint({ mode: "number" }).notNull(),
	createdById: integer().notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("ContractTemplate_createdById_idx").using("btree", table.createdById.asc().nullsLast().op("int4_ops")),
	index("ContractTemplate_isActive_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
]);

export const contractAuditLog = pgTable("ContractAuditLog", {
	id: text().primaryKey().notNull(),
	contractId: text().notNull(),
	action: text().notNull(),
	performedBy: text(),
	ipAddress: text(),
	userAgent: text(),
	details: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("ContractAuditLog_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("ContractAuditLog_contractId_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
	index("ContractAuditLog_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contract.id],
			name: "ContractAuditLog_contractId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);


export const affiliateCommission = pgTable("AffiliateCommission", {
	id: text().primaryKey().notNull(),
	salesUserId: integer().notNull(),
	leadId: text().notNull(),
	clientName: text().default('').notNull(),
	dealValue: numeric({ precision: 12, scale:  2 }).notNull(),
	commissionRate: numeric({ precision: 5, scale:  4 }).default('0.15').notNull(),
	commissionAmt: numeric({ precision: 12, scale:  2 }).notNull(),
	month: timestamp({ precision: 3, mode: 'string' }).notNull(),
	status: text().default('PENDING').notNull(),
	paidAt: timestamp({ precision: 3, mode: 'string' }),
	approvedAt: timestamp({ precision: 3, mode: 'string' }),
	approvedBy: integer(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	currency: text().default('usd').notNull(),
	holdUntil: timestamp({ precision: 3, mode: 'string' }),
	payoutId: text(),
}, (table) => [
	uniqueIndex("AffiliateCommission_leadId_key").using("btree", table.leadId.asc().nullsLast().op("text_ops")),
	index("AffiliateCommission_month_idx").using("btree", table.month.asc().nullsLast().op("timestamp_ops")),
	index("AffiliateCommission_payoutId_idx").using("btree", table.payoutId.asc().nullsLast().op("text_ops")),
	index("AffiliateCommission_salesUserId_idx").using("btree", table.salesUserId.asc().nullsLast().op("int4_ops")),
	index("AffiliateCommission_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.salesUserId],
			foreignColumns: [user.id],
			name: "AffiliateCommission_salesUserId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.leadId],
			foreignColumns: [salesLead.id],
			name: "AffiliateCommission_leadId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.payoutId],
			foreignColumns: [commissionPayout.id],
			name: "AffiliateCommission_payoutId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const socialAccount = pgTable("SocialAccount", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	platform: text().notNull(),
	platformId: text().notNull(),
	platformName: text().notNull(),
	accessToken: text().notNull(),
	refreshToken: text(),
	tokenExpiry: timestamp({ precision: 3, mode: 'string' }),
	profileUrl: text(),
	profileImage: text(),
	followerCount: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	lastSyncAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("SocialAccount_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SocialAccount_clientId_platform_platformId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.platform.asc().nullsLast().op("text_ops"), table.platformId.asc().nullsLast().op("text_ops")),
	index("SocialAccount_platform_idx").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "SocialAccount_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const contractSigner = pgTable("ContractSigner", {
	id: text().primaryKey().notNull(),
	contractId: text().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	role: text().default('signer').notNull(),
	status: signerStatus().default('PENDING').notNull(),
	signToken: text().notNull(),
	signedAt: timestamp({ precision: 3, mode: 'string' }),
	viewedAt: timestamp({ precision: 3, mode: 'string' }),
	declinedAt: timestamp({ precision: 3, mode: 'string' }),
	declineReason: text(),
	signatureS3Key: text(),
	signatureType: text(),
	order: integer().default(0).notNull(),
	ipAddress: text(),
	userAgent: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	isVariableSigner: boolean().default(false).notNull(),
	smsVerified: boolean().default(false).notNull(),
}, (table) => [
	index("ContractSigner_contractId_idx").using("btree", table.contractId.asc().nullsLast().op("text_ops")),
	index("ContractSigner_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ContractSigner_signToken_idx").using("btree", table.signToken.asc().nullsLast().op("text_ops")),
	uniqueIndex("ContractSigner_signToken_key").using("btree", table.signToken.asc().nullsLast().op("text_ops")),
	index("ContractSigner_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.contractId],
			foreignColumns: [contract.id],
			name: "ContractSigner_contractId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const oneOffDeliverable = pgTable("OneOffDeliverable", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	type: text().notNull(),
	quantity: integer().notNull(),
	videosPerDay: integer().notNull(),
	postingSchedule: text().notNull(),
	postingDays: text().array(),
	postingTimes: text().array(),
	platforms: text().array(),
	description: text(),
	status: text().default('PENDING').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	billedAt: timestamp({ precision: 3, mode: 'string' }),
	invoiceId: text(),
	unitPrice: integer(),
}, (table) => [
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "OneOffDeliverable_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoice.id],
			name: "OneOffDeliverable_invoiceId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const paymentMethod = pgTable("PaymentMethod", {
	id: text().primaryKey().notNull(),
	stripeCustomerId: text().notNull(),
	stripePaymentMethodId: text().notNull(),
	type: text().notNull(),
	isDefault: boolean().default(false).notNull(),
	cardBrand: text(),
	cardLast4: text(),
	cardExpMonth: integer(),
	cardExpYear: integer(),
	bankName: text(),
	bankLast4: text(),
	bankAccountType: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("PaymentMethod_stripeCustomerId_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	uniqueIndex("PaymentMethod_stripePaymentMethodId_key").using("btree", table.stripePaymentMethodId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.stripeCustomerId],
			foreignColumns: [stripeCustomer.id],
			name: "PaymentMethod_stripeCustomerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const subscription = pgTable("Subscription", {
	id: text().primaryKey().notNull(),
	stripeCustomerId: text().notNull(),
	stripeSubscriptionId: text().notNull(),
	stripePriceId: text().notNull(),
	status: subscriptionStatus().default('ACTIVE').notNull(),
	currentPeriodStart: timestamp({ precision: 3, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp({ precision: 3, mode: 'string' }).notNull(),
	cancelAtPeriodEnd: boolean().default(false).notNull(),
	canceledAt: timestamp({ precision: 3, mode: 'string' }),
	amount: integer().notNull(),
	currency: text().default('usd').notNull(),
	interval: text().default('month').notNull(),
	metadata: jsonb(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("Subscription_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("Subscription_stripeCustomerId_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	index("Subscription_stripeSubscriptionId_idx").using("btree", table.stripeSubscriptionId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Subscription_stripeSubscriptionId_key").using("btree", table.stripeSubscriptionId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.stripeCustomerId],
			foreignColumns: [stripeCustomer.id],
			name: "Subscription_stripeCustomerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const payment = pgTable("Payment", {
	id: text().primaryKey().notNull(),
	invoiceId: text().notNull(),
	stripePaymentIntentId: text(),
	stripeChargeId: text(),
	amount: integer().notNull(),
	currency: text().default('usd').notNull(),
	status: paymentStatus().default('PENDING').notNull(),
	paymentMethod: text(),
	failureReason: text(),
	receiptUrl: text(),
	metadata: jsonb(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("Payment_invoiceId_idx").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("Payment_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("Payment_stripePaymentIntentId_idx").using("btree", table.stripePaymentIntentId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Payment_stripePaymentIntentId_key").using("btree", table.stripePaymentIntentId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoice.id],
			name: "Payment_invoiceId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const stripeCustomer = pgTable("StripeCustomer", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	stripeCustomerId: text().notNull(),
	defaultPaymentMethod: text(),
	currency: text().default('usd').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("StripeCustomer_clientId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("StripeCustomer_stripeCustomerId_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	uniqueIndex("StripeCustomer_stripeCustomerId_key").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "StripeCustomer_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const billingPlan = pgTable("BillingPlan", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	stripePriceId: text().notNull(),
	stripeProductId: text().notNull(),
	amount: integer().notNull(),
	currency: text().default('usd').notNull(),
	interval: text().default('month').notNull(),
	isActive: boolean().default(true).notNull(),
	features: jsonb(),
	metadata: jsonb(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("BillingPlan_isActive_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	uniqueIndex("BillingPlan_stripePriceId_key").using("btree", table.stripePriceId.asc().nullsLast().op("text_ops")),
]);

export const invoice = pgTable("Invoice", {
	id: text().primaryKey().notNull(),
	stripeCustomerId: text().notNull(),
	stripeInvoiceId: text(),
	invoiceNumber: text().notNull(),
	status: invoiceStatus().default('DRAFT').notNull(),
	amount: integer().notNull(),
	amountPaid: integer().default(0).notNull(),
	currency: text().default('usd').notNull(),
	dueDate: timestamp({ precision: 3, mode: 'string' }),
	paidAt: timestamp({ precision: 3, mode: 'string' }),
	description: text(),
	lineItems: jsonb().notNull(),
	notes: text(),
	isRecurring: boolean().default(false).notNull(),
	subscriptionId: text(),
	stripePaymentIntentId: text(),
	stripeHostedInvoiceUrl: text(),
	stripePdfUrl: text(),
	metadata: jsonb(),
	createdBy: integer(),
	sentAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("Invoice_dueDate_idx").using("btree", table.dueDate.asc().nullsLast().op("timestamp_ops")),
	index("Invoice_invoiceNumber_idx").using("btree", table.invoiceNumber.asc().nullsLast().op("text_ops")),
	uniqueIndex("Invoice_invoiceNumber_key").using("btree", table.invoiceNumber.asc().nullsLast().op("text_ops")),
	index("Invoice_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("Invoice_stripeCustomerId_idx").using("btree", table.stripeCustomerId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Invoice_stripeInvoiceId_key").using("btree", table.stripeInvoiceId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.stripeCustomerId],
			foreignColumns: [stripeCustomer.id],
			name: "Invoice_stripeCustomerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "Invoice_createdBy_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const facebookPage = pgTable("FacebookPage", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	pageId: text().notNull(),
	pageName: text().notNull(),
	pageAccessToken: text().notNull(),
	category: text(),
	profilePicture: text(),
	followerCount: integer().default(0).notNull(),
	likeCount: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	lastSyncAt: timestamp({ precision: 3, mode: 'string' }),
	syncStatus: syncStatus().default('PENDING').notNull(),
	syncError: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("FacebookPage_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("FacebookPage_clientId_pageId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.pageId.asc().nullsLast().op("text_ops")),
	index("FacebookPage_pageId_idx").using("btree", table.pageId.asc().nullsLast().op("text_ops")),
	index("FacebookPage_syncStatus_idx").using("btree", table.syncStatus.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "FacebookPage_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const facebookSnapshot = pgTable("FacebookSnapshot", {
	id: text().primaryKey().notNull(),
	facebookPageId: text().notNull(),
	clientId: text().notNull(),
	date: date().notNull(),
	followers: integer().default(0).notNull(),
	likes: integer().default(0).notNull(),
	followersGained: integer().default(0).notNull(),
	impressions: integer().default(0).notNull(),
	reach: integer().default(0).notNull(),
	engagement: integer().default(0).notNull(),
	views: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("FacebookSnapshot_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("FacebookSnapshot_date_idx").using("btree", table.date.asc().nullsLast().op("date_ops")),
	uniqueIndex("FacebookSnapshot_facebookPageId_date_key").using("btree", table.facebookPageId.asc().nullsLast().op("date_ops"), table.date.asc().nullsLast().op("text_ops")),
	index("FacebookSnapshot_facebookPageId_idx").using("btree", table.facebookPageId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.facebookPageId],
			foreignColumns: [facebookPage.id],
			name: "FacebookSnapshot_facebookPageId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const postedContent = pgTable("PostedContent", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	title: text(),
	platform: text().notNull(),
	url: text().notNull(),
	postedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	deliverableType: text(),
	taskId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("PostedContent_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("PostedContent_clientId_postedAt_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.postedAt.asc().nullsLast().op("timestamp_ops")),
	index("PostedContent_platform_idx").using("btree", table.platform.asc().nullsLast().op("text_ops")),
	index("PostedContent_postedAt_idx").using("btree", table.postedAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "PostedContent_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const salesLeadGenerationJob = pgTable("SalesLeadGenerationJob", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	provider: text().default('LINKEDIN').notNull(),
	status: text().default('QUEUED').notNull(),
	externalJobId: text(),
	totalLeads: integer().default(0).notNull(),
	importedLeads: integer().default(0).notNull(),
	duplicateLeads: integer().default(0).notNull(),
	requestedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	startedAt: timestamp({ precision: 3, mode: 'string' }),
	completedAt: timestamp({ precision: 3, mode: 'string' }),
	importedAt: timestamp({ precision: 3, mode: 'string' }),
	errorMessage: text(),
	providerMessage: text(),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("SalesLeadGenerationJob_externalJobId_key").using("btree", table.externalJobId.asc().nullsLast().op("text_ops")),
	index("SalesLeadGenerationJob_provider_userId_idx").using("btree", table.provider.asc().nullsLast().op("int4_ops"), table.userId.asc().nullsLast().op("text_ops")),
	index("SalesLeadGenerationJob_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("SalesLeadGenerationJob_userId_createdAt_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SalesLeadGenerationJob_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const postingTarget = pgTable("PostingTarget", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	platform: text().notNull(),
	deliverableType: text().notNull(),
	count: integer().notNull(),
	frequency: text().default('daily').notNull(),
	extras: jsonb(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("PostingTarget_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("PostingTarget_clientId_platform_deliverableType_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.platform.asc().nullsLast().op("text_ops"), table.deliverableType.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "PostingTarget_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const editorEodReport = pgTable("EditorEodReport", {
	id: text().primaryKey().notNull(),
	editorId: integer().notNull(),
	reportDate: text().notNull(),
	slackChannel: text(),
	slackTs: text(),
	status: text().default('DRAFT').notNull(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("EditorEodReport_editorId_idx").using("btree", table.editorId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("EditorEodReport_editorId_reportDate_key").using("btree", table.editorId.asc().nullsLast().op("int4_ops"), table.reportDate.asc().nullsLast().op("text_ops")),
	index("EditorEodReport_reportDate_idx").using("btree", table.reportDate.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.editorId],
			foreignColumns: [user.id],
			name: "EditorEodReport_editorId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const editorEodReportItem = pgTable("EditorEodReportItem", {
	id: text().primaryKey().notNull(),
	reportId: text().notNull(),
	taskId: text().notNull(),
	taskTitle: text().notNull(),
	proofLinks: jsonb().default([]).notNull(),
	statusAtSend: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("EditorEodReportItem_reportId_idx").using("btree", table.reportId.asc().nullsLast().op("text_ops")),
	uniqueIndex("EditorEodReportItem_reportId_taskId_key").using("btree", table.reportId.asc().nullsLast().op("text_ops"), table.taskId.asc().nullsLast().op("text_ops")),
	index("EditorEodReportItem_taskId_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.reportId],
			foreignColumns: [editorEodReport.id],
			name: "EditorEodReportItem_reportId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "EditorEodReportItem_taskId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const nasSyncLog = pgTable("NasSyncLog", {
	id: text().primaryKey().notNull(),
	status: text().notNull(),
	completedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	bucketName: text(),
	paths: jsonb().default([]).notNull(),
	filesCount: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bytesCount: bigint({ mode: "number" }),
	errorMessage: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("NasSyncLog_completedAt_idx").using("btree", table.completedAt.asc().nullsLast().op("timestamp_ops")),
	index("NasSyncLog_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const salesLead = pgTable("SalesLead", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	name: text().default('').notNull(),
	email: text().default('').notNull(),
	socials: text().default('').notNull(),
	snapchatShow: text().default('').notNull(),
	igDm: boolean().default(false).notNull(),
	meetingBooked: boolean().default(false).notNull(),
	emailed: boolean().default(false).notNull(),
	called: boolean().default(false).notNull(),
	texted: boolean().default(false).notNull(),
	notes: text().default('').notNull(),
	emailTemplate: text().default('').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	calledAt: timestamp({ precision: 3, mode: 'string' }),
	dmAt: timestamp({ precision: 3, mode: 'string' }),
	dmPlatform: text().default('').notNull(),
	emailedAt: timestamp({ precision: 3, mode: 'string' }),
	meetingAt: timestamp({ precision: 3, mode: 'string' }),
	textedAt: timestamp({ precision: 3, mode: 'string' }),
	company: text().default('').notNull(),
	phone: text().default('').notNull(),
	source: text().default('').notNull(),
	status: text().default('NEW').notNull(),
	value: doublePrecision(),
	facebook: boolean().default(false).notNull(),
	instagram: boolean().default(false).notNull(),
	linkedin: boolean().default(false).notNull(),
	metadata: jsonb().default({}).notNull(),
	priority: text().default('').notNull(),
	tiktok: boolean().default(false).notNull(),
	twitter: boolean().default(false).notNull(),
	externalId: text(),
	externalSource: text(),
	externalUrl: text(),
	postUrl: varchar({ length: 500 }),
	profileUrl: varchar({ length: 500 }),
	convertedAt: timestamp({ precision: 3, mode: 'string' }),
	convertedToClientId: text(),
}, (table) => [
	index("SalesLead_externalSource_externalId_idx").using("btree", table.externalSource.asc().nullsLast().op("text_ops"), table.externalId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SalesLead_externalSource_externalId_key").using("btree", table.externalSource.asc().nullsLast().op("text_ops"), table.externalId.asc().nullsLast().op("text_ops")),
	index("SalesLead_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("SalesLead_userId_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SalesLead_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const onboardingToken = pgTable("OnboardingToken", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	token: text().notNull(),
	used: boolean().default(false).notNull(),
	usedAt: timestamp({ precision: 3, mode: 'string' }),
	expiresAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("OnboardingToken_clientId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("OnboardingToken_token_key").using("btree", table.token.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "OnboardingToken_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const leads = pgTable("leads", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 200 }).notNull(),
	niche: varchar({ length: 100 }),
	status: varchar({ length: 20 }).default('new').notNull(),
	notes: text(),
	contactedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	detectedNeed: varchar({ length: 300 }),
	matchedService: varchar({ length: 200 }),
	postText: text(),
	postUrl: varchar({ length: 500 }),
	profileUrl: varchar({ length: 500 }).notNull(),
	suggestedMessage: text(),
}, (table) => [
	index("leads_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("leads_profileUrl_idx").using("btree", table.profileUrl.asc().nullsLast().op("text_ops")),
	index("leads_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const client = pgTable("Client", {
	id: text().primaryKey().notNull(),
	userId: integer(),
	name: text().notNull(),
	email: text().notNull(),
	companyName: text(),
	phone: text().notNull(),
	createdBy: text(),
	status: text().default('active').notNull(),
	accountManagerId: text(),
	startDate: timestamp({ precision: 3, mode: 'string' }),
	renewalDate: timestamp({ precision: 3, mode: 'string' }),
	lastActivity: timestamp({ precision: 3, mode: 'string' }),
	requiresClientReview: boolean().default(false).notNull(),
	requiresVideographer: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	uploadedFiles: jsonb(),
	brandGuidelines: jsonb(),
	projectSettings: jsonb(),
	billing: jsonb(),
	postingSchedule: jsonb(),
	currentProgress: jsonb(),
	driveFolderId: text(),
	rawFootageFolderId: text(),
	essentialsFolderId: text(),
	emails: text().array(),
	phones: text().array(),
	outputsFolderId: text(),
	slackChannelName: text(),
	slackEnabled: boolean().default(false).notNull(),
	slackWebhookUrl: text(),
	hasPostingServices: boolean().default(true).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rawFootageStorageUsed: bigint({ mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rawFootageStorageLimit: bigint({ mode: "number" }).default(sql`'3298534883328'`),
	storageAlert90Sent: boolean().default(false),
	storageAlert95Sent: boolean().default(false),
	storageLastCalculated: timestamp({ mode: 'string' }),
	isTrial: boolean().default(false).notNull(),
	clientReviewDeliverableTypes: text().array(),
	rawFootageLinks: jsonb().default([]).notNull(),
	portalPasswordSet: boolean().default(false).notNull(),
	preClientId: text(),
	welcomeVideoWatched: boolean().default(false).notNull(),
	requiresCoverImage: boolean().default(false).notNull(),
	templateHashtags: text().array(),
	address: text(),
	shootDaysPerMonth: integer().default(0).notNull(),
	// When true, staff expect scripts for this client's SF/LF slots.
	// Scripts are still created manually via the Link Scripts panel.
	scriptsRequired: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("Client_preClientId_key").using("btree", table.preClientId.asc().nullsLast().op("text_ops")),
	index("Client_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("Client_userId_key").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Client_userId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const contract = pgTable("Contract", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	status: contractStatus().default('DRAFT').notNull(),
	s3Key: text().notNull(),
	signedS3Key: text(),
	fileName: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fileSize: bigint({ mode: "number" }).notNull(),
	createdById: integer().notNull(),
	clientId: text(),
	templateId: text(),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
	completedAt: timestamp({ precision: 3, mode: 'string' }),
	cancelledAt: timestamp({ precision: 3, mode: 'string' }),
	message: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	annotations: jsonb(),
	allowVariableSigners: boolean().default(false).notNull(),
	preClientId: text(),
	signwellDocumentId: text(),
	signwellRequestId: text(),
	requiresSignature: boolean().default(true).notNull(),
}, (table) => [
	index("Contract_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("Contract_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("Contract_createdById_idx").using("btree", table.createdById.asc().nullsLast().op("int4_ops")),
	index("Contract_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "Contract_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
	foreignKey({
			columns: [table.templateId],
			foreignColumns: [contractTemplate.id],
			name: "Contract_templateId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const employeeDocument = pgTable("EmployeeDocument", {
	id: text().primaryKey().notNull(),
	employeeId: integer().notNull(),
	title: text().notNull(),
	s3Key: text().notNull(),
	fileName: text().notNull(),
	fileSize: integer().notNull(),
	uploadedById: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("EmployeeDocument_employeeId_idx").using("btree", table.employeeId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.employeeId],
			foreignColumns: [user.id],
			name: "EmployeeDocument_employeeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedById],
			foreignColumns: [user.id],
			name: "EmployeeDocument_uploadedById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const quote = pgTable("Quote", {
	id: text().primaryKey().notNull(),
	preClientId: text().notNull(),
	version: integer().default(1).notNull(),
	status: quoteStatus().default('DRAFT').notNull(),
	services: jsonb().notNull(),
	totalAmount: integer().notNull(),
	notes: text(),
	validDays: integer().default(30).notNull(),
	shareToken: text().notNull(),
	sentAt: timestamp({ precision: 3, mode: 'string' }),
	viewedAt: timestamp({ precision: 3, mode: 'string' }),
	acceptedAt: timestamp({ precision: 3, mode: 'string' }),
	rejectedAt: timestamp({ precision: 3, mode: 'string' }),
	rejectionReason: text(),
	changeRequest: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	acceptanceText: text(),
	inclusions: jsonb().default([]).notNull(),
	preparedBy: text(),
	terms: jsonb().default([]).notNull(),
}, (table) => [
	index("Quote_preClientId_idx").using("btree", table.preClientId.asc().nullsLast().op("text_ops")),
	index("Quote_shareToken_idx").using("btree", table.shareToken.asc().nullsLast().op("text_ops")),
	uniqueIndex("Quote_shareToken_key").using("btree", table.shareToken.asc().nullsLast().op("text_ops")),
	index("Quote_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.preClientId],
			foreignColumns: [preClient.id],
			name: "Quote_preClientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const trainingDocument = pgTable("TrainingDocument", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().default('').notNull(),
	s3Key: text().notNull(),
	fileName: text().notNull(),
	fileSize: integer().notNull(),
	role: role().notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	courseId: text(),
}, (table) => [
	index("TrainingDocument_courseId_order_idx").using("btree", table.courseId.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("text_ops")),
	index("TrainingDocument_role_idx").using("btree", table.role.asc().nullsLast().op("enum_ops")),
	index("TrainingDocument_role_order_idx").using("btree", table.role.asc().nullsLast().op("enum_ops"), table.order.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.courseId],
			foreignColumns: [trainingCourse.id],
			name: "TrainingDocument_courseId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const preClient = pgTable("PreClient", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	companyName: text(),
	status: preClientStatus().default('QUALIFIED').notNull(),
	createdById: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	address: text(),
}, (table) => [
	index("PreClient_createdById_idx").using("btree", table.createdById.asc().nullsLast().op("int4_ops")),
	index("PreClient_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "PreClient_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const commissionAdjustment = pgTable("CommissionAdjustment", {
	id: text().primaryKey().notNull(),
	commissionId: text().notNull(),
	editedById: integer().notNull(),
	adjustmentType: text().notNull(),
	previousAmount: numeric({ precision: 12, scale:  2 }).notNull(),
	newAmount: numeric({ precision: 12, scale:  2 }).notNull(),
	reason: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("CommissionAdjustment_commissionId_idx").using("btree", table.commissionId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.commissionId],
			foreignColumns: [affiliateCommission.id],
			name: "CommissionAdjustment_commissionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.editedById],
			foreignColumns: [user.id],
			name: "CommissionAdjustment_editedById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const salesManagerPermission = pgTable("SalesManagerPermission", {
	id: text().primaryKey().notNull(),
	managerId: integer().notNull(),
	salesRepId: integer().notNull(),
}, (table) => [
	index("SalesManagerPermission_managerId_idx").using("btree", table.managerId.asc().nullsLast().op("int4_ops")),
	uniqueIndex("SalesManagerPermission_managerId_salesRepId_key").using("btree", table.managerId.asc().nullsLast().op("int4_ops"), table.salesRepId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [user.id],
			name: "SalesManagerPermission_managerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.salesRepId],
			foreignColumns: [user.id],
			name: "SalesManagerPermission_salesRepId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const helpVideo = pgTable("HelpVideo", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	youtubeUrl: text().notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdById: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("HelpVideo_isActive_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("HelpVideo_order_idx").using("btree", table.order.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "HelpVideo_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const salesActivityLog = pgTable("SalesActivityLog", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	type: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("SalesActivityLog_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	index("SalesActivityLog_userId_createdAt_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.createdAt.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SalesActivityLog_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const payoutBatchRun = pgTable("PayoutBatchRun", {
	id: text().primaryKey().notNull(),
	runDate: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	status: text().default('RUNNING').notNull(),
	totalAmount: numeric({ precision: 12, scale:  2 }).default('0').notNull(),
	totalPayouts: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	completedAt: timestamp({ precision: 3, mode: 'string' }),
});

export const salesRepPayoutProfile = pgTable("SalesRepPayoutProfile", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	stripeConnectAccountId: text(),
	onboardingStatus: text().default('NOT_STARTED').notNull(),
	payoutsEnabled: boolean().default(false).notNull(),
	taxFormType: text(),
	taxFormCollectedAt: timestamp({ precision: 3, mode: 'string' }),
	country: text(),
	currency: text().default('usd').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	taxFormS3Key: text(),
	commissionRate: numeric({ precision: 5, scale:  4 }),
}, (table) => [
	index("SalesRepPayoutProfile_stripeConnectAccountId_idx").using("btree", table.stripeConnectAccountId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SalesRepPayoutProfile_stripeConnectAccountId_key").using("btree", table.stripeConnectAccountId.asc().nullsLast().op("text_ops")),
	uniqueIndex("SalesRepPayoutProfile_userId_key").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SalesRepPayoutProfile_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const payoutConfig = pgTable("PayoutConfig", {
	id: text().primaryKey().notNull(),
	minimumThresholdCents: integer().default(2500).notNull(),
	holdWindowDays: integer().default(5).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	updatedById: integer(),
});

export const commissionPayout = pgTable("CommissionPayout", {
	id: text().primaryKey().notNull(),
	batchId: text(),
	salesUserId: integer().notNull(),
	stripeTransferId: text(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	currency: text().default('usd').notNull(),
	status: text().default('PENDING').notNull(),
	failureReason: text(),
	idempotencyKey: text().notNull(),
	sentAt: timestamp({ precision: 3, mode: 'string' }),
	paidAt: timestamp({ precision: 3, mode: 'string' }),
	failedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("CommissionPayout_batchId_idx").using("btree", table.batchId.asc().nullsLast().op("text_ops")),
	uniqueIndex("CommissionPayout_idempotencyKey_key").using("btree", table.idempotencyKey.asc().nullsLast().op("text_ops")),
	index("CommissionPayout_salesUserId_idx").using("btree", table.salesUserId.asc().nullsLast().op("int4_ops")),
	index("CommissionPayout_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("CommissionPayout_stripeTransferId_key").using("btree", table.stripeTransferId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [payoutBatchRun.id],
			name: "CommissionPayout_batchId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.salesUserId],
			foreignColumns: [user.id],
			name: "CommissionPayout_salesUserId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const tag = pgTable("Tag", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("Tag_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const folderStatus = pgTable("FolderStatus", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	s3KeyPrefix: text().notNull(),
	status: text().notNull(),
	updatedById: integer(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("FolderStatus_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("FolderStatus_clientId_s3KeyPrefix_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.s3KeyPrefix.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "FolderStatus_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.updatedById],
			foreignColumns: [user.id],
			name: "FolderStatus_updatedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const hiringCandidate = pgTable("HiringCandidate", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	phone: text(),
	portfolioUrl: text(),
	resumeUrl: text(),
	source: text(),
	notes: text(),
	status: hiringCandidateStatus().default('NEW').notNull(),
	createdById: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	convertedAt: timestamp({ precision: 3, mode: 'string' }),
	convertedUserId: integer(),
}, (table) => [
	uniqueIndex("HiringCandidate_convertedUserId_key").using("btree", table.convertedUserId.asc().nullsLast().op("int4_ops")),
	index("HiringCandidate_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("HiringCandidate_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "HiringCandidate_createdById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.convertedUserId],
			foreignColumns: [user.id],
			name: "HiringCandidate_convertedUserId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const hiringTestTask = pgTable("HiringTestTask", {
	id: text().primaryKey().notNull(),
	candidateId: text().notNull(),
	title: text().notNull(),
	instructions: text().notNull(),
	rawFootageUrl: text(),
	submissionToken: text().notNull(),
	status: hiringTestTaskStatus().default('PENDING').notNull(),
	submissionUrl: text(),
	submissionS3Key: text(),
	sentAt: timestamp({ precision: 3, mode: 'string' }),
	submittedAt: timestamp({ precision: 3, mode: 'string' }),
	reviewedById: integer(),
	reviewNotes: text(),
	reviewedAt: timestamp({ precision: 3, mode: 'string' }),
	expiresAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("HiringTestTask_candidateId_idx").using("btree", table.candidateId.asc().nullsLast().op("text_ops")),
	index("HiringTestTask_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	uniqueIndex("HiringTestTask_submissionToken_key").using("btree", table.submissionToken.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.candidateId],
			foreignColumns: [hiringCandidate.id],
			name: "HiringTestTask_candidateId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.reviewedById],
			foreignColumns: [user.id],
			name: "HiringTestTask_reviewedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const meetingNote = pgTable("MeetingNote", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	driveDocId: text().notNull(),
	driveDocUrl: text().notNull(),
	title: text().notNull(),
	meetingDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	status: text().default('draft').notNull(),
	sentAt: timestamp({ precision: 3, mode: 'string' }),
	sentBy: text(),
	createdBy: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("MeetingNote_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "MeetingNote_clientId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const schedulerActivityDailySummary = pgTable("SchedulerActivityDailySummary", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	date: timestamp({ precision: 3, mode: 'string' }).notNull(),
	activeMinutes: integer().default(0).notNull(),
	idleMinutes: integer().default(0).notNull(),
	clickCount: integer().default(0).notNull(),
	sessionCount: integer().default(0).notNull(),
	firstEventAt: timestamp({ precision: 3, mode: 'string' }),
	lastEventAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	index("SchedulerActivityDailySummary_userId_date_idx").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.date.asc().nullsLast().op("int4_ops")),
	uniqueIndex("SchedulerActivityDailySummary_userId_date_key").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.date.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SchedulerActivityDailySummary_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const portfolioJourneyClient = pgTable("PortfolioJourneyClient", {
	id: text().primaryKey().notNull(),
	label: text().notNull(),
	sublabel: text(),
	iconKey: text(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
});

export const portfolioJourneyStep = pgTable("PortfolioJourneyStep", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	imageUrl: text().notNull(),
	caption: text().notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("PortfolioJourneyStep_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [portfolioJourneyClient.id],
			name: "PortfolioJourneyStep_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const youtubeQuotaUsage = pgTable("YoutubeQuotaUsage", {
	id: text().primaryKey().notNull(),
	date: text().notNull(),
	unitsUsed: integer().default(0).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("YoutubeQuotaUsage_date_key").using("btree", table.date.asc().nullsLast().op("text_ops")),
]);

export const nasMirrorJob = pgTable("NasMirrorJob", {
	id: text().primaryKey().notNull(),
	clientName: text().notNull(),
	monthFolder: text().notNull(),
	status: text().default('pending').notNull(),
	scannedCount: integer().default(0).notNull(),
	copiedCount: integer().default(0).notNull(),
	verifiedCount: integer().default(0).notNull(),
	deletedCount: integer().default(0).notNull(),
	failedCount: integer().default(0).notNull(),
	currentFile: text(),
	errorMessage: text(),
	triggeredById: integer(),
	startedAt: timestamp({ precision: 3, mode: 'string' }),
	completedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	folderPath: text(),
	folderType: text().default('outputs').notNull(),
}, (table) => [
	index("NasMirrorJob_clientName_monthFolder_idx").using("btree", table.clientName.asc().nullsLast().op("text_ops"), table.monthFolder.asc().nullsLast().op("text_ops")),
	index("NasMirrorJob_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("NasMirrorJob_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.triggeredById],
			foreignColumns: [user.id],
			name: "NasMirrorJob_triggeredById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const schedulerActivityEvent = pgTable("SchedulerActivityEvent", {
	id: text().primaryKey().notNull(),
	userId: integer().notNull(),
	sessionId: text().notNull(),
	eventType: text().notNull(),
	path: text(),
	targetLabel: text(),
	targetTag: text(),
	metadata: jsonb(),
	timestamp: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("SchedulerActivityEvent_eventType_idx").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	index("SchedulerActivityEvent_sessionId_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
	index("SchedulerActivityEvent_userId_timestamp_idx").using("btree", table.userId.asc().nullsLast().op("timestamp_ops"), table.timestamp.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SchedulerActivityEvent_userId_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const clientPortalAccess = pgTable("ClientPortalAccess", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	status: portalAccessStatus().default('ONBOARDING').notNull(),
	billingAnchorDate: timestamp({ precision: 3, mode: 'string' }),
	nextBillingDate: timestamp({ precision: 3, mode: 'string' }),
	arrearsPolicy: text().default('current_only').notNull(),
	adminUnlockedById: integer(),
	adminUnlockedAt: timestamp({ precision: 3, mode: 'string' }),
	lockedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	autoInvoiceActive: boolean().default(false).notNull(),
	dueDays: integer().default(15).notNull(),
	recurringAmount: integer(),
	recurringDescription: text(),
}, (table) => [
	index("ClientPortalAccess_autoInvoiceActive_idx").using("btree", table.autoInvoiceActive.asc().nullsLast().op("bool_ops")),
	uniqueIndex("ClientPortalAccess_clientId_key").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("ClientPortalAccess_nextBillingDate_idx").using("btree", table.nextBillingDate.asc().nullsLast().op("timestamp_ops")),
	index("ClientPortalAccess_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "ClientPortalAccess_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.adminUnlockedById],
			foreignColumns: [user.id],
			name: "ClientPortalAccess_adminUnlockedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const stripeWebhookEvent = pgTable("StripeWebhookEvent", {
	id: text().primaryKey().notNull(),
	type: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("StripeWebhookEvent_createdAt_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
]);

export const portfolioChannel = pgTable("PortfolioChannel", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	channelUrl: text().notNull(),
	avatarUrl: text(),
	followerCount: text().default('').notNull(),
	category: text().notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("PortfolioChannel_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("PortfolioChannel_category_order_idx").using("btree", table.category.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
	index("PortfolioChannel_isActive_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
]);

export const portfolioImage = pgTable("PortfolioImage", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text().default('').notNull(),
	imageUrl: text().notNull(),
	thumbnailUrl: text(),
	category: text().default('photography').notNull(),
	order: integer().default(0).notNull(),
	isActive: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("PortfolioImage_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("PortfolioImage_category_order_idx").using("btree", table.category.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
	index("PortfolioImage_isActive_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
]);

export const portfolioUiSetting = pgTable("PortfolioUiSetting", {
	id: text().primaryKey().notNull(),
	howItWorksVisible: boolean().default(true).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
});

export const expenseTrip = pgTable("ExpenseTrip", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	name: text().notNull(),
	createdById: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("ExpenseTrip_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "ExpenseTrip_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "ExpenseTrip_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const clientExpense = pgTable("ClientExpense", {
	id: text().primaryKey().notNull(),
	tripId: text().notNull(),
	description: text().notNull(),
	amount: integer().notNull(),
	expenseDate: timestamp({ precision: 3, mode: 'string' }).notNull(),
	receiptS3Key: text().notNull(),
	receiptUrl: text().notNull(),
	receiptFileName: text().notNull(),
	status: clientExpenseStatus().default('PENDING').notNull(),
	invoiceId: text(),
	createdById: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("ClientExpense_invoiceId_idx").using("btree", table.invoiceId.asc().nullsLast().op("text_ops")),
	index("ClientExpense_tripId_idx").using("btree", table.tripId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tripId],
			foreignColumns: [expenseTrip.id],
			name: "ClientExpense_tripId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.invoiceId],
			foreignColumns: [invoice.id],
			name: "ClientExpense_invoiceId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "ClientExpense_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const taskFeedback = pgTable("TaskFeedback", {
	id: text().primaryKey().notNull(),
	taskId: text().notNull(),
	fileId: text(),
	folderType: text().notNull(),
	feedback: text().notNull(),
	status: text().default('needs_revision').notNull(),
	timestamp: text(),
	category: text(),
	createdBy: integer().notNull(),
	resolvedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	acknowledgedAt: timestamp({ precision: 3, mode: 'string' }),
	acknowledgedBy: integer(),
	screenshotUrl: text(),
	annotations: jsonb(),
	voiceUrl: text(),
	voiceDurationSec: integer(),
	attachments: jsonb(),
}, (table) => [
	index("TaskFeedback_fileId_idx").using("btree", table.fileId.asc().nullsLast().op("text_ops")),
	index("TaskFeedback_taskId_folderType_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops"), table.folderType.asc().nullsLast().op("text_ops")),
	index("TaskFeedback_taskId_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "TaskFeedback_taskId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [file.id],
			name: "TaskFeedback_fileId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "TaskFeedback_createdBy_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const equipment = pgTable("Equipment", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	category: text(),
	notes: text(),
	isActive: boolean().default(true).notNull(),
	createdById: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "Equipment_createdById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const driveNote = pgTable("DriveNote", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	s3Key: text().notNull(),
	isFolder: boolean().default(false).notNull(),
	content: text().notNull(),
	createdById: integer().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("DriveNote_clientId_s3Key_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.s3Key.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "DriveNote_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [user.id],
			name: "DriveNote_createdById_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const mediaPreview = pgTable("MediaPreview", {
	id: text().primaryKey().notNull(),
	s3Key: text().notNull(),
	fileId: text(),
	taskId: text(),
	previewS3Key: text(),
	status: text().default('PENDING').notNull(),
	width: integer(),
	height: integer(),
	durationSeconds: doublePrecision(),
	frameTimestampSeconds: doublePrecision(),
	sourceEtag: text(),
	attempts: integer().default(0).notNull(),
	errorMessage: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("MediaPreview_fileId_idx").using("btree", table.fileId.asc().nullsLast().op("text_ops")),
	index("MediaPreview_previewS3Key_idx").using("btree", table.previewS3Key.asc().nullsLast().op("text_ops")),
	uniqueIndex("MediaPreview_s3Key_key").using("btree", table.s3Key.asc().nullsLast().op("text_ops")),
	index("MediaPreview_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("MediaPreview_taskId_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
]);

export const shareRecipient = pgTable("ShareRecipient", {
	id: text().primaryKey().notNull(),
	shareId: text().notNull(),
	email: text().notNull(),
	status: text().default('invited').notNull(),
	otpCode: text(),
	otpExpiresAt: timestamp({ precision: 3, mode: 'string' }),
	lastAccessedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	uniqueIndex("ShareRecipient_shareId_email_key").using("btree", table.shareId.asc().nullsLast().op("text_ops"), table.email.asc().nullsLast().op("text_ops")),
	index("ShareRecipient_shareId_idx").using("btree", table.shareId.asc().nullsLast().op("text_ops")),
]);

export const nasBackupRecord = pgTable("NasBackupRecord", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	folderType: text().notNull(),
	s3Key: text().notNull(),
	fileName: text().notNull(),
	fileSize: bigint({ mode: "number" }),
	archivedToNas: boolean().default(false).notNull(),
	nasArchivedAt: timestamp({ precision: 3, mode: 'string' }),
	nasPath: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
	deletedFromCloud: boolean().default(false).notNull(),
	deletedFromCloudAt: timestamp({ precision: 3, mode: 'string' }),
}, (table) => [
	index("NasBackupRecord_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	uniqueIndex("NasBackupRecord_s3Key_key").using("btree", table.s3Key.asc().nullsLast().op("text_ops")),
]);

export const fileDeletionRequest = pgTable("FileDeletionRequest", {
	id: text().primaryKey().notNull(),
	fileId: text().notNull(),
	taskId: text().notNull(),
	requestedBy: integer().notNull(),
	reason: text(),
	status: fileDeletionRequestStatus().default('PENDING').notNull(),
	reviewedBy: integer(),
	reviewedAt: timestamp({ precision: 3, mode: 'string' }),
	batchId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("FileDeletionRequest_batchId_idx").using("btree", table.batchId.asc().nullsLast().op("text_ops")),
	index("FileDeletionRequest_fileId_idx").using("btree", table.fileId.asc().nullsLast().op("text_ops")),
	index("FileDeletionRequest_requestedBy_idx").using("btree", table.requestedBy.asc().nullsLast().op("int4_ops")),
	index("FileDeletionRequest_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("FileDeletionRequest_taskId_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
]);

export const monthlyShootGeneration = pgTable("MonthlyShootGeneration", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	month: text().notNull(),
	shootsCreated: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("MonthlyShootGeneration_clientId_month_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.month.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "MonthlyShootGeneration_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const logEntry = pgTable("LogEntry", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	type: logEntryType().notNull(),
	title: text(),
	date: timestamp({ precision: 3, mode: 'string' }).notNull(),
	location: text(),
	attendees: text().array(),
	plannedMinutes: integer(),
	actualMinutes: integer(),
	status: logEntryStatus().default('PLANNED').notNull(),
	noteLabel: text(),
	noteBody: text(),
	reportFileUrl: text(),
	reportFileName: text(),
	createdBy: integer(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("LogEntry_clientId_date_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.date.asc().nullsLast().op("text_ops")),
	index("LogEntry_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "LogEntry_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [user.id],
			name: "LogEntry_createdBy_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const scriptShootLink = pgTable("ScriptShootLink", {
	id: text().primaryKey().notNull(),
	sourceShootTaskId: text().notNull(),
	scriptId: text().notNull(),
	targetShootTaskId: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("ScriptShootLink_scriptId_target_key").using("btree", table.scriptId.asc().nullsLast().op("text_ops"), table.targetShootTaskId.asc().nullsLast().op("text_ops")),
	index("ScriptShootLink_targetShootTaskId_idx").using("btree", table.targetShootTaskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.sourceShootTaskId],
			foreignColumns: [task.id],
			name: "ScriptShootLink_sourceShootTaskId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.targetShootTaskId],
			foreignColumns: [task.id],
			name: "ScriptShootLink_targetShootTaskId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const rawFootageFolder = pgTable("RawFootageFolder", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	monthFolder: text().notNull(),
	code: rawFootageFolderCode().notNull(),
	number: integer().notNull(),
	folderPath: text().notNull(),
	taskId: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("RawFootageFolder_client_month_code_number_key").using("btree", table.clientId.asc().nullsLast().op("int4_ops"), table.monthFolder.asc().nullsLast().op("enum_ops"), table.code.asc().nullsLast().op("text_ops"), table.number.asc().nullsLast().op("text_ops")),
	index("RawFootageFolder_taskId_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "RawFootageFolder_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "RawFootageFolder_taskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

// One script per (clientId, monthFolder, code, number) deliverable slot —
// 1:1 with RawFootageFolder via rawFootageFolderId. Created manually via
// the Script Linking panel / generate endpoint.
export const deliverableScript = pgTable("DeliverableScript", {
	id: text().primaryKey().notNull(),
	clientId: text().notNull(),
	monthFolder: text().notNull(),
	code: rawFootageFolderCode().notNull(),
	number: integer().notNull(),
	rawFootageFolderId: text().notNull(),
	taskId: text(),
	title: text().notNull(),
	content: text().default('').notNull(),
	template: text().default('overall').notNull(),
	status: text().default('draft').notNull(),
	versions: jsonb().default([]).notNull(),
	clientFeedback: text(),
	reviewTaskId: text(),
	completedAt: timestamp({ precision: 3, mode: 'string' }),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("DeliverableScript_client_month_code_number_key").using("btree", table.clientId.asc().nullsLast().op("text_ops"), table.monthFolder.asc().nullsLast().op("text_ops"), table.code.asc().nullsLast().op("text_ops"), table.number.asc().nullsLast().op("int4_ops")),
	uniqueIndex("DeliverableScript_rawFootageFolderId_key").using("btree", table.rawFootageFolderId.asc().nullsLast().op("text_ops")),
	index("DeliverableScript_taskId_idx").using("btree", table.taskId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [client.id],
			name: "DeliverableScript_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.rawFootageFolderId],
			foreignColumns: [rawFootageFolder.id],
			name: "DeliverableScript_rawFootageFolderId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.taskId],
			foreignColumns: [task.id],
			name: "DeliverableScript_taskId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const tagToTask = pgTable("_TagToTask", {
	a: text("A").notNull(),
	b: text("B").notNull(),
}, (table) => [
	index().using("btree", table.b.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.a],
			foreignColumns: [tag.id],
			name: "_TagToTask_A_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.b],
			foreignColumns: [task.id],
			name: "_TagToTask_B_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	primaryKey({ columns: [table.a, table.b], name: "_TagToTask_AB_pkey"}),
]);

