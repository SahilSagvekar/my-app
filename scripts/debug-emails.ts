
import { prisma } from '../src/lib/prisma';
import { sendEditorStartedEmail, sendTaskReadyForReviewEmail } from '../src/lib/email-notifications';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function debug() {
    console.log('--- 📧 Email Notification Debugger ---');

    // 1. Find a task to test with
    const task = await prisma.task.findFirst({
        include: { client: true }
    });

    if (!task) {
        console.error('❌ No tasks found in database. Please create a task first.');
        return;
    }

    console.log(`\n🔍 Found Task: "${task.title || 'Untitled'}" (ID: ${task.id})`);

    if (!task.client) {
        console.error('❌ This task is not associated with a client.');
        return;
    }

    console.log(`🏢 Client: ${task.client.name}`);
    console.log(`📧 Primary Email: ${task.client.email}`);
    console.log(`📧 Additional Emails: ${JSON.stringify(task.client.emails)}`);

    // Find linked users
    const linkedUsers = await prisma.user.findMany({
        where: { linkedClientId: task.client.id }
    });
    console.log(`👥 Linked Users found: ${linkedUsers.length}`);
    linkedUsers.forEach(u => console.log(`   - ${u.email}`));

    console.log('\n--- 🚀 Sending Test Emails ---');

    console.log('1️⃣ Sending "Editor Started" notification...');
    await sendEditorStartedEmail(task.id, 'Test Debugger');

    console.log('\n2️⃣ Sending "Ready for Review" notification...');
    await sendTaskReadyForReviewEmail(task.id);

    console.log('\n✅ Debugging script finished.');
    process.exit(0);
}

debug().catch(err => {
    console.error('❌ Debugging failed:', err);
    process.exit(1);
});
