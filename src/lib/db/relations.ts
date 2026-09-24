import { relations } from "drizzle-orm/relations";
import { client, monthlyDeliverable, brandAsset, monthlyRun, user, bonus, leave, account, deduction, payroll, session, auditLog, feedback, feedbackResponse, recurringTask, task, qcAchievement, userSecurityPin, socialLogin, loginAuditLog, qcAnalytics, qcRejectionReason, qcMonthlyTrend, taskFeedback, file, qcCategoryMetrics, oneOffDeliverable, invoice, userTwoFactorAuth, titlingJob, youTubeChannel, youTubeSnapshot, youTubeVideoStat, shootDetail, metaAccount, metaSnapshot, clientRevenue, job, bid, guideline, editorClientPermission, trainingCourse, trainingVideo, portfolioCategory, portfolioSubcategory, socialAccount, socialPost, socialAnalytics, contract, contractAuditLog, affiliateCommission, salesLead, commissionPayout, contractSigner, stripeCustomer, paymentMethod, subscription, payment, facebookPage, facebookSnapshot, postedContent, salesLeadGenerationJob, postingTarget, editorEodReport, editorEodReportItem, roleEodReport, roleEodReportItem, onboardingToken, contractTemplate, employeeDocument, preClient, quote, trainingDocument, commissionAdjustment, salesManagerPermission, helpVideo, salesActivityLog, salesRepPayoutProfile, payoutBatchRun, folderStatus, hiringCandidate, hiringTestTask, meetingNote, schedulerActivityDailySummary, portfolioJourneyClient, portfolioJourneyStep, nasMirrorJob, schedulerActivityEvent, clientPortalAccess, tag, tagToTask } from "./schema";

export const monthlyDeliverableRelations = relations(monthlyDeliverable, ({one, many}) => ({
	client: one(client, {
		fields: [monthlyDeliverable.clientId],
		references: [client.id]
	}),
	recurringTasks: many(recurringTask),
	tasks: many(task),
}));

export const clientRelations = relations(client, ({one, many}) => ({
	monthlyDeliverables: many(monthlyDeliverable),
	brandAssets: many(brandAsset),
	monthlyRuns: many(monthlyRun),
	users: many(user, {
		relationName: "user_linkedClientId_client_id"
	}),
	recurringTasks: many(recurringTask),
	tasks: many(task),
	socialLogins: many(socialLogin),
	youTubeSnapshots: many(youTubeSnapshot),
	youTubeChannels: many(youTubeChannel),
	metaAccounts: many(metaAccount),
	metaSnapshots: many(metaSnapshot),
	clientRevenues: many(clientRevenue),
	jobs: many(job),
	guidelines: many(guideline),
	editorClientPermissions: many(editorClientPermission),
	socialAccounts: many(socialAccount),
	oneOffDeliverables: many(oneOffDeliverable),
	stripeCustomers: many(stripeCustomer),
	facebookPages: many(facebookPage),
	postedContents: many(postedContent),
	postingTargets: many(postingTarget),
	onboardingTokens: many(onboardingToken),
	user: one(user, {
		fields: [client.userId],
		references: [user.id],
		relationName: "client_userId_user_id"
	}),
	folderStatuses: many(folderStatus),
	meetingNotes: many(meetingNote),
	clientPortalAccesses: many(clientPortalAccess),
}));

export const brandAssetRelations = relations(brandAsset, ({one}) => ({
	client: one(client, {
		fields: [brandAsset.clientId],
		references: [client.id]
	}),
}));

export const monthlyRunRelations = relations(monthlyRun, ({one}) => ({
	client: one(client, {
		fields: [monthlyRun.clientId],
		references: [client.id]
	}),
}));

export const bonusRelations = relations(bonus, ({one}) => ({
	user: one(user, {
		fields: [bonus.employeeId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({one, many}) => ({
	bonuses: many(bonus),
	leaves: many(leave),
	accounts: many(account),
	deductions: many(deduction),
	payrolls: many(payroll),
	sessions: many(session),
	client: one(client, {
		fields: [user.linkedClientId],
		references: [client.id],
		relationName: "user_linkedClientId_client_id"
	}),
	auditLogs: many(auditLog),
	feedbacks: many(feedback),
	feedbackResponses: many(feedbackResponse),
	qcAchievements: many(qcAchievement),
	userSecurityPins: many(userSecurityPin),
	loginAuditLogs: many(loginAuditLog),
	qcAnalytics: many(qcAnalytics),
	qcRejectionReasons: many(qcRejectionReason),
	qcMonthlyTrends: many(qcMonthlyTrend),
	taskFeedbacks: many(taskFeedback),
	qcCategoryMetrics: many(qcCategoryMetrics),
	tasks_assignedTo: many(task, {
		relationName: "task_assignedTo_user_id"
	}),
	tasks_clientUserId: many(task, {
		relationName: "task_clientUserId_user_id"
	}),
	tasks_qcReviewedBy: many(task, {
		relationName: "task_qcReviewedBy_user_id"
	}),
	userTwoFactorAuths: many(userTwoFactorAuth),
	socialLogins: many(socialLogin),
	shootDetails: many(shootDetail),
	jobs_createdById: many(job, {
		relationName: "job_createdById_user_id"
	}),
	jobs_assignedToId: many(job, {
		relationName: "job_assignedToId_user_id"
	}),
	bids: many(bid),
	editorClientPermissions: many(editorClientPermission),
	affiliateCommissions: many(affiliateCommission),
	invoices: many(invoice),
	salesLeadGenerationJobs: many(salesLeadGenerationJob),
	editorEodReports: many(editorEodReport),
	roleEodReports: many(roleEodReport),
	salesLeads: many(salesLead),
	contracts: many(contract),
	employeeDocuments_employeeId: many(employeeDocument, {
		relationName: "employeeDocument_employeeId_user_id"
	}),
	employeeDocuments_uploadedById: many(employeeDocument, {
		relationName: "employeeDocument_uploadedById_user_id"
	}),
	preClients: many(preClient),
	clients: many(client, {
		relationName: "client_userId_user_id"
	}),
	commissionAdjustments: many(commissionAdjustment),
	salesManagerPermissions_managerId: many(salesManagerPermission, {
		relationName: "salesManagerPermission_managerId_user_id"
	}),
	salesManagerPermissions_salesRepId: many(salesManagerPermission, {
		relationName: "salesManagerPermission_salesRepId_user_id"
	}),
	helpVideos: many(helpVideo),
	salesActivityLogs: many(salesActivityLog),
	salesRepPayoutProfiles: many(salesRepPayoutProfile),
	commissionPayouts: many(commissionPayout),
	folderStatuses: many(folderStatus),
	hiringCandidates_createdById: many(hiringCandidate, {
		relationName: "hiringCandidate_createdById_user_id"
	}),
	hiringCandidates_convertedUserId: many(hiringCandidate, {
		relationName: "hiringCandidate_convertedUserId_user_id"
	}),
	hiringTestTasks: many(hiringTestTask),
	schedulerActivityDailySummaries: many(schedulerActivityDailySummary),
	nasMirrorJobs: many(nasMirrorJob),
	schedulerActivityEvents: many(schedulerActivityEvent),
	clientPortalAccesses: many(clientPortalAccess),
}));

export const leaveRelations = relations(leave, ({one, many}) => ({
	user: one(user, {
		fields: [leave.employeeId],
		references: [user.id]
	}),
	deductions: many(deduction),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const deductionRelations = relations(deduction, ({one}) => ({
	user: one(user, {
		fields: [deduction.employeeId],
		references: [user.id]
	}),
	leave: one(leave, {
		fields: [deduction.leaveId],
		references: [leave.id]
	}),
}));

export const payrollRelations = relations(payroll, ({one}) => ({
	user: one(user, {
		fields: [payroll.employeeId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const auditLogRelations = relations(auditLog, ({one}) => ({
	user: one(user, {
		fields: [auditLog.userId],
		references: [user.id]
	}),
}));

export const feedbackRelations = relations(feedback, ({one, many}) => ({
	user: one(user, {
		fields: [feedback.senderId],
		references: [user.id]
	}),
	feedbackResponses: many(feedbackResponse),
}));

export const feedbackResponseRelations = relations(feedbackResponse, ({one}) => ({
	feedback: one(feedback, {
		fields: [feedbackResponse.feedbackId],
		references: [feedback.id]
	}),
	user: one(user, {
		fields: [feedbackResponse.senderId],
		references: [user.id]
	}),
}));

export const recurringTaskRelations = relations(recurringTask, ({one}) => ({
	client: one(client, {
		fields: [recurringTask.clientId],
		references: [client.id]
	}),
	monthlyDeliverable: one(monthlyDeliverable, {
		fields: [recurringTask.deliverableId],
		references: [monthlyDeliverable.id]
	}),
	task: one(task, {
		fields: [recurringTask.templateTaskId],
		references: [task.id]
	}),
}));

export const taskRelations = relations(task, ({one, many}) => ({
	recurringTasks: many(recurringTask),
	taskFeedbacks: many(taskFeedback),
	monthlyDeliverable: one(monthlyDeliverable, {
		fields: [task.monthlyDeliverableId],
		references: [monthlyDeliverable.id]
	}),
	user_assignedTo: one(user, {
		fields: [task.assignedTo],
		references: [user.id],
		relationName: "task_assignedTo_user_id"
	}),
	user_thumbnailEditor: one(user, {
		fields: [task.thumbnailEditor],
		references: [user.id],
		relationName: "task_thumbnailEditor_user_id"
	}),
	client: one(client, {
		fields: [task.clientId],
		references: [client.id]
	}),
	user_clientUserId: one(user, {
		fields: [task.clientUserId],
		references: [user.id],
		relationName: "task_clientUserId_user_id"
	}),
	user_qcReviewedBy: one(user, {
		fields: [task.qcReviewedBy],
		references: [user.id],
		relationName: "task_qcReviewedBy_user_id"
	}),
	oneOffDeliverable: one(oneOffDeliverable, {
		fields: [task.oneOffDeliverableId],
		references: [oneOffDeliverable.id]
	}),
	invoice: one(invoice, {
		fields: [task.invoiceId],
		references: [invoice.id]
	}),
	task: one(task, {
		fields: [task.relatedTaskId],
		references: [task.id],
		relationName: "task_relatedTaskId_task_id"
	}),
	tasks: many(task, {
		relationName: "task_relatedTaskId_task_id"
	}),
	titlingJobs: many(titlingJob),
	shootDetails: many(shootDetail),
	files: many(file),
	socialPosts: many(socialPost),
	editorEodReportItems: many(editorEodReportItem),
	roleEodReportItems: many(roleEodReportItem),
	tagToTasks: many(tagToTask),
}));

export const qcAchievementRelations = relations(qcAchievement, ({one}) => ({
	user: one(user, {
		fields: [qcAchievement.qcSpecialistId],
		references: [user.id]
	}),
}));

export const userSecurityPinRelations = relations(userSecurityPin, ({one}) => ({
	user: one(user, {
		fields: [userSecurityPin.userId],
		references: [user.id]
	}),
}));

export const loginAuditLogRelations = relations(loginAuditLog, ({one}) => ({
	socialLogin: one(socialLogin, {
		fields: [loginAuditLog.loginId],
		references: [socialLogin.id]
	}),
	user: one(user, {
		fields: [loginAuditLog.userId],
		references: [user.id]
	}),
}));

export const socialLoginRelations = relations(socialLogin, ({one, many}) => ({
	loginAuditLogs: many(loginAuditLog),
	client: one(client, {
		fields: [socialLogin.clientId],
		references: [client.id]
	}),
	user: one(user, {
		fields: [socialLogin.updatedById],
		references: [user.id]
	}),
}));

export const qcAnalyticsRelations = relations(qcAnalytics, ({one}) => ({
	user: one(user, {
		fields: [qcAnalytics.qcSpecialistId],
		references: [user.id]
	}),
}));

export const qcRejectionReasonRelations = relations(qcRejectionReason, ({one}) => ({
	user: one(user, {
		fields: [qcRejectionReason.qcSpecialistId],
		references: [user.id]
	}),
}));

export const qcMonthlyTrendRelations = relations(qcMonthlyTrend, ({one}) => ({
	user: one(user, {
		fields: [qcMonthlyTrend.qcSpecialistId],
		references: [user.id]
	}),
}));

export const taskFeedbackRelations = relations(taskFeedback, ({one}) => ({
	task: one(task, {
		fields: [taskFeedback.taskId],
		references: [task.id]
	}),
	file: one(file, {
		fields: [taskFeedback.fileId],
		references: [file.id]
	}),
	user: one(user, {
		fields: [taskFeedback.createdBy],
		references: [user.id]
	}),
}));

export const fileRelations = relations(file, ({one, many}) => ({
	taskFeedbacks: many(taskFeedback),
	task: one(task, {
		fields: [file.taskId],
		references: [task.id]
	}),
}));

export const qcCategoryMetricsRelations = relations(qcCategoryMetrics, ({one}) => ({
	user: one(user, {
		fields: [qcCategoryMetrics.qcSpecialistId],
		references: [user.id]
	}),
}));

export const oneOffDeliverableRelations = relations(oneOffDeliverable, ({one, many}) => ({
	tasks: many(task),
	client: one(client, {
		fields: [oneOffDeliverable.clientId],
		references: [client.id]
	}),
	invoice: one(invoice, {
		fields: [oneOffDeliverable.invoiceId],
		references: [invoice.id]
	}),
}));

export const invoiceRelations = relations(invoice, ({one, many}) => ({
	tasks: many(task),
	oneOffDeliverables: many(oneOffDeliverable),
	payments: many(payment),
	stripeCustomer: one(stripeCustomer, {
		fields: [invoice.stripeCustomerId],
		references: [stripeCustomer.id]
	}),
	user: one(user, {
		fields: [invoice.createdBy],
		references: [user.id]
	}),
}));

export const userTwoFactorAuthRelations = relations(userTwoFactorAuth, ({one}) => ({
	user: one(user, {
		fields: [userTwoFactorAuth.userId],
		references: [user.id]
	}),
}));

export const titlingJobRelations = relations(titlingJob, ({one}) => ({
	task: one(task, {
		fields: [titlingJob.taskId],
		references: [task.id]
	}),
}));

export const youTubeSnapshotRelations = relations(youTubeSnapshot, ({one}) => ({
	youTubeChannel: one(youTubeChannel, {
		fields: [youTubeSnapshot.channelId],
		references: [youTubeChannel.id]
	}),
	client: one(client, {
		fields: [youTubeSnapshot.clientId],
		references: [client.id]
	}),
}));

export const youTubeChannelRelations = relations(youTubeChannel, ({one, many}) => ({
	youTubeSnapshots: many(youTubeSnapshot),
	youTubeVideoStats: many(youTubeVideoStat),
	client: one(client, {
		fields: [youTubeChannel.clientId],
		references: [client.id]
	}),
}));

export const youTubeVideoStatRelations = relations(youTubeVideoStat, ({one}) => ({
	youTubeChannel: one(youTubeChannel, {
		fields: [youTubeVideoStat.channelId],
		references: [youTubeChannel.id]
	}),
}));

export const shootDetailRelations = relations(shootDetail, ({one, many}) => ({
	task: one(task, {
		fields: [shootDetail.taskId],
		references: [task.id]
	}),
	user: one(user, {
		fields: [shootDetail.videographerId],
		references: [user.id]
	}),
}));

export const metaAccountRelations = relations(metaAccount, ({one, many}) => ({
	client: one(client, {
		fields: [metaAccount.clientId],
		references: [client.id]
	}),
	metaSnapshots: many(metaSnapshot),
}));

export const metaSnapshotRelations = relations(metaSnapshot, ({one}) => ({
	metaAccount: one(metaAccount, {
		fields: [metaSnapshot.metaAccountId],
		references: [metaAccount.id]
	}),
	client: one(client, {
		fields: [metaSnapshot.clientId],
		references: [client.id]
	}),
}));

export const clientRevenueRelations = relations(clientRevenue, ({one}) => ({
	client: one(client, {
		fields: [clientRevenue.clientId],
		references: [client.id]
	}),
}));

export const jobRelations = relations(job, ({one, many}) => ({
	user_createdById: one(user, {
		fields: [job.createdById],
		references: [user.id],
		relationName: "job_createdById_user_id"
	}),
	user_assignedToId: one(user, {
		fields: [job.assignedToId],
		references: [user.id],
		relationName: "job_assignedToId_user_id"
	}),
	client: one(client, {
		fields: [job.clientId],
		references: [client.id]
	}),
	bids: many(bid),
}));

export const bidRelations = relations(bid, ({one}) => ({
	job: one(job, {
		fields: [bid.jobId],
		references: [job.id]
	}),
	user: one(user, {
		fields: [bid.userId],
		references: [user.id]
	}),
}));

export const guidelineRelations = relations(guideline, ({one}) => ({
	client: one(client, {
		fields: [guideline.clientId],
		references: [client.id]
	}),
}));

export const editorClientPermissionRelations = relations(editorClientPermission, ({one}) => ({
	user: one(user, {
		fields: [editorClientPermission.editorId],
		references: [user.id]
	}),
	client: one(client, {
		fields: [editorClientPermission.clientId],
		references: [client.id]
	}),
}));

export const trainingVideoRelations = relations(trainingVideo, ({one}) => ({
	trainingCourse: one(trainingCourse, {
		fields: [trainingVideo.courseId],
		references: [trainingCourse.id]
	}),
}));

export const trainingCourseRelations = relations(trainingCourse, ({many}) => ({
	trainingVideos: many(trainingVideo),
	trainingDocuments: many(trainingDocument),
}));

export const portfolioSubcategoryRelations = relations(portfolioSubcategory, ({one}) => ({
	portfolioCategory: one(portfolioCategory, {
		fields: [portfolioSubcategory.categoryId],
		references: [portfolioCategory.id]
	}),
}));

export const portfolioCategoryRelations = relations(portfolioCategory, ({many}) => ({
	portfolioSubcategories: many(portfolioSubcategory),
}));

export const socialPostRelations = relations(socialPost, ({one}) => ({
	socialAccount: one(socialAccount, {
		fields: [socialPost.socialAccountId],
		references: [socialAccount.id]
	}),
	task: one(task, {
		fields: [socialPost.taskId],
		references: [task.id]
	}),
}));

export const socialAccountRelations = relations(socialAccount, ({one, many}) => ({
	socialPosts: many(socialPost),
	socialAnalytics: many(socialAnalytics),
	client: one(client, {
		fields: [socialAccount.clientId],
		references: [client.id]
	}),
}));

export const socialAnalyticsRelations = relations(socialAnalytics, ({one}) => ({
	socialAccount: one(socialAccount, {
		fields: [socialAnalytics.socialAccountId],
		references: [socialAccount.id]
	}),
}));

export const contractAuditLogRelations = relations(contractAuditLog, ({one}) => ({
	contract: one(contract, {
		fields: [contractAuditLog.contractId],
		references: [contract.id]
	}),
}));

export const contractRelations = relations(contract, ({one, many}) => ({
	contractAuditLogs: many(contractAuditLog),
	contractSigners: many(contractSigner),
	user: one(user, {
		fields: [contract.createdById],
		references: [user.id]
	}),
	contractTemplate: one(contractTemplate, {
		fields: [contract.templateId],
		references: [contractTemplate.id]
	}),
}));

export const affiliateCommissionRelations = relations(affiliateCommission, ({one, many}) => ({
	user: one(user, {
		fields: [affiliateCommission.salesUserId],
		references: [user.id]
	}),
	salesLead: one(salesLead, {
		fields: [affiliateCommission.leadId],
		references: [salesLead.id]
	}),
	commissionPayout: one(commissionPayout, {
		fields: [affiliateCommission.payoutId],
		references: [commissionPayout.id]
	}),
	commissionAdjustments: many(commissionAdjustment),
}));

export const salesLeadRelations = relations(salesLead, ({one, many}) => ({
	affiliateCommissions: many(affiliateCommission),
	user: one(user, {
		fields: [salesLead.userId],
		references: [user.id]
	}),
}));

export const commissionPayoutRelations = relations(commissionPayout, ({one, many}) => ({
	affiliateCommissions: many(affiliateCommission),
	payoutBatchRun: one(payoutBatchRun, {
		fields: [commissionPayout.batchId],
		references: [payoutBatchRun.id]
	}),
	user: one(user, {
		fields: [commissionPayout.salesUserId],
		references: [user.id]
	}),
}));

export const contractSignerRelations = relations(contractSigner, ({one}) => ({
	contract: one(contract, {
		fields: [contractSigner.contractId],
		references: [contract.id]
	}),
}));

export const paymentMethodRelations = relations(paymentMethod, ({one}) => ({
	stripeCustomer: one(stripeCustomer, {
		fields: [paymentMethod.stripeCustomerId],
		references: [stripeCustomer.id]
	}),
}));

export const stripeCustomerRelations = relations(stripeCustomer, ({one, many}) => ({
	paymentMethods: many(paymentMethod),
	subscriptions: many(subscription),
	client: one(client, {
		fields: [stripeCustomer.clientId],
		references: [client.id]
	}),
	invoices: many(invoice),
}));

export const subscriptionRelations = relations(subscription, ({one}) => ({
	stripeCustomer: one(stripeCustomer, {
		fields: [subscription.stripeCustomerId],
		references: [stripeCustomer.id]
	}),
}));

export const paymentRelations = relations(payment, ({one}) => ({
	invoice: one(invoice, {
		fields: [payment.invoiceId],
		references: [invoice.id]
	}),
}));

export const facebookPageRelations = relations(facebookPage, ({one, many}) => ({
	client: one(client, {
		fields: [facebookPage.clientId],
		references: [client.id]
	}),
	facebookSnapshots: many(facebookSnapshot),
}));

export const facebookSnapshotRelations = relations(facebookSnapshot, ({one}) => ({
	facebookPage: one(facebookPage, {
		fields: [facebookSnapshot.facebookPageId],
		references: [facebookPage.id]
	}),
}));

export const postedContentRelations = relations(postedContent, ({one}) => ({
	client: one(client, {
		fields: [postedContent.clientId],
		references: [client.id]
	}),
}));

export const salesLeadGenerationJobRelations = relations(salesLeadGenerationJob, ({one}) => ({
	user: one(user, {
		fields: [salesLeadGenerationJob.userId],
		references: [user.id]
	}),
}));

export const postingTargetRelations = relations(postingTarget, ({one}) => ({
	client: one(client, {
		fields: [postingTarget.clientId],
		references: [client.id]
	}),
}));

export const editorEodReportRelations = relations(editorEodReport, ({one, many}) => ({
	user: one(user, {
		fields: [editorEodReport.editorId],
		references: [user.id]
	}),
	editorEodReportItems: many(editorEodReportItem),
}));

export const editorEodReportItemRelations = relations(editorEodReportItem, ({one}) => ({
	editorEodReport: one(editorEodReport, {
		fields: [editorEodReportItem.reportId],
		references: [editorEodReport.id]
	}),
	task: one(task, {
		fields: [editorEodReportItem.taskId],
		references: [task.id]
	}),
}));

export const roleEodReportRelations = relations(roleEodReport, ({one, many}) => ({
	user: one(user, {
		fields: [roleEodReport.userId],
		references: [user.id]
	}),
	roleEodReportItems: many(roleEodReportItem),
}));

export const roleEodReportItemRelations = relations(roleEodReportItem, ({one}) => ({
	roleEodReport: one(roleEodReport, {
		fields: [roleEodReportItem.reportId],
		references: [roleEodReport.id]
	}),
	task: one(task, {
		fields: [roleEodReportItem.taskId],
		references: [task.id]
	}),
}));

export const onboardingTokenRelations = relations(onboardingToken, ({one}) => ({
	client: one(client, {
		fields: [onboardingToken.clientId],
		references: [client.id]
	}),
}));

export const contractTemplateRelations = relations(contractTemplate, ({many}) => ({
	contracts: many(contract),
}));

export const employeeDocumentRelations = relations(employeeDocument, ({one}) => ({
	user_employeeId: one(user, {
		fields: [employeeDocument.employeeId],
		references: [user.id],
		relationName: "employeeDocument_employeeId_user_id"
	}),
	user_uploadedById: one(user, {
		fields: [employeeDocument.uploadedById],
		references: [user.id],
		relationName: "employeeDocument_uploadedById_user_id"
	}),
}));

export const quoteRelations = relations(quote, ({one}) => ({
	preClient: one(preClient, {
		fields: [quote.preClientId],
		references: [preClient.id]
	}),
}));

export const preClientRelations = relations(preClient, ({one, many}) => ({
	quotes: many(quote),
	user: one(user, {
		fields: [preClient.createdById],
		references: [user.id]
	}),
}));

export const trainingDocumentRelations = relations(trainingDocument, ({one}) => ({
	trainingCourse: one(trainingCourse, {
		fields: [trainingDocument.courseId],
		references: [trainingCourse.id]
	}),
}));

export const commissionAdjustmentRelations = relations(commissionAdjustment, ({one}) => ({
	affiliateCommission: one(affiliateCommission, {
		fields: [commissionAdjustment.commissionId],
		references: [affiliateCommission.id]
	}),
	user: one(user, {
		fields: [commissionAdjustment.editedById],
		references: [user.id]
	}),
}));

export const salesManagerPermissionRelations = relations(salesManagerPermission, ({one}) => ({
	user_managerId: one(user, {
		fields: [salesManagerPermission.managerId],
		references: [user.id],
		relationName: "salesManagerPermission_managerId_user_id"
	}),
	user_salesRepId: one(user, {
		fields: [salesManagerPermission.salesRepId],
		references: [user.id],
		relationName: "salesManagerPermission_salesRepId_user_id"
	}),
}));

export const helpVideoRelations = relations(helpVideo, ({one}) => ({
	user: one(user, {
		fields: [helpVideo.createdById],
		references: [user.id]
	}),
}));

export const salesActivityLogRelations = relations(salesActivityLog, ({one}) => ({
	user: one(user, {
		fields: [salesActivityLog.userId],
		references: [user.id]
	}),
}));

export const salesRepPayoutProfileRelations = relations(salesRepPayoutProfile, ({one}) => ({
	user: one(user, {
		fields: [salesRepPayoutProfile.userId],
		references: [user.id]
	}),
}));

export const payoutBatchRunRelations = relations(payoutBatchRun, ({many}) => ({
	commissionPayouts: many(commissionPayout),
}));

export const folderStatusRelations = relations(folderStatus, ({one}) => ({
	client: one(client, {
		fields: [folderStatus.clientId],
		references: [client.id]
	}),
	user: one(user, {
		fields: [folderStatus.updatedById],
		references: [user.id]
	}),
}));

export const hiringCandidateRelations = relations(hiringCandidate, ({one, many}) => ({
	user_createdById: one(user, {
		fields: [hiringCandidate.createdById],
		references: [user.id],
		relationName: "hiringCandidate_createdById_user_id"
	}),
	user_convertedUserId: one(user, {
		fields: [hiringCandidate.convertedUserId],
		references: [user.id],
		relationName: "hiringCandidate_convertedUserId_user_id"
	}),
	hiringTestTasks: many(hiringTestTask),
}));

export const hiringTestTaskRelations = relations(hiringTestTask, ({one}) => ({
	hiringCandidate: one(hiringCandidate, {
		fields: [hiringTestTask.candidateId],
		references: [hiringCandidate.id]
	}),
	user: one(user, {
		fields: [hiringTestTask.reviewedById],
		references: [user.id]
	}),
}));

export const meetingNoteRelations = relations(meetingNote, ({one}) => ({
	client: one(client, {
		fields: [meetingNote.clientId],
		references: [client.id]
	}),
}));

export const schedulerActivityDailySummaryRelations = relations(schedulerActivityDailySummary, ({one}) => ({
	user: one(user, {
		fields: [schedulerActivityDailySummary.userId],
		references: [user.id]
	}),
}));

export const portfolioJourneyStepRelations = relations(portfolioJourneyStep, ({one}) => ({
	portfolioJourneyClient: one(portfolioJourneyClient, {
		fields: [portfolioJourneyStep.clientId],
		references: [portfolioJourneyClient.id]
	}),
}));

export const portfolioJourneyClientRelations = relations(portfolioJourneyClient, ({many}) => ({
	portfolioJourneySteps: many(portfolioJourneyStep),
}));

export const nasMirrorJobRelations = relations(nasMirrorJob, ({one}) => ({
	user: one(user, {
		fields: [nasMirrorJob.triggeredById],
		references: [user.id]
	}),
}));

export const schedulerActivityEventRelations = relations(schedulerActivityEvent, ({one}) => ({
	user: one(user, {
		fields: [schedulerActivityEvent.userId],
		references: [user.id]
	}),
}));

export const clientPortalAccessRelations = relations(clientPortalAccess, ({one}) => ({
	client: one(client, {
		fields: [clientPortalAccess.clientId],
		references: [client.id]
	}),
	user: one(user, {
		fields: [clientPortalAccess.adminUnlockedById],
		references: [user.id]
	}),
}));

export const tagToTaskRelations = relations(tagToTask, ({one}) => ({
	tag: one(tag, {
		fields: [tagToTask.a],
		references: [tag.id]
	}),
	task: one(task, {
		fields: [tagToTask.b],
		references: [task.id]
	}),
}));

export const tagRelations = relations(tag, ({many}) => ({
	tagToTasks: many(tagToTask),
}));