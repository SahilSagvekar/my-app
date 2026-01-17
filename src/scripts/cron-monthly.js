// scripts/cron-recurring-tasks.js
const API_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runRecurringTasks() {
  console.log(`🔄 [${new Date().toISOString()}] Running recurring tasks...`);
  
  try {
    const response = await fetch(`${API_URL}/api/tasks/recurring/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
        dryRun: false
      })
    });

    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ Created ${data.created} tasks, skipped ${data.skipped}`);
      console.log('📋 Details:', JSON.stringify(data.details, null, 2));
    } else {
      console.error('❌ Failed:', data.message);
    }
  } catch (error) {
    console.error('❌ Error calling API:', error.message);
  }
}

runRecurringTasks();