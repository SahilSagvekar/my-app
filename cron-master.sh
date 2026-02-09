#!/bin/bash

# ==============================================================================
# E8 PRODUCTIONS - MASTER CRON SCHEDULER
# ==============================================================================
# This script handles all scheduled tasks for the E8 Productions platform.
# Site is hosted on AWS.
# ==============================================================================

# 1. SETUP ENVIRONMENT
# Resolve the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( dirname "$SCRIPT_DIR" )"

# Load environment variables if .env exists
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Fallback values
API_URL=${BASE_URL:-"http://localhost:3000"}
SECRET=${CRON_SECRET:-""}

# Log file
LOG_FILE="$PROJECT_DIR/logs/cron.log"
mkdir -p "$PROJECT_DIR/logs"

# Logger function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ------------------------------------------------------------------------------
# JOB 1: CHECK TITLING JOBS (Stuck transcription/AI tasks)
# Schedule: Every 30 minutes
# ------------------------------------------------------------------------------
check_titling() {
    log "⏰ Running titling jobs check..."
    RESPONSE=$(curl -s -X GET "$API_URL/api/cron/check-titling-jobs" \
        -H "x-cron-secret: $SECRET")
    log "   Result: $RESPONSE"
}

# ------------------------------------------------------------------------------
# JOB 2: RECURRING TASK GENERATION (Monthly rollover)
# Schedule: Daily at 1:00 AM
# ------------------------------------------------------------------------------
run_recurring() {
    log "🔄 Running recurring task generation..."
    RESPONSE=$(curl -s -X POST "$API_URL/api/tasks/recurring/run" \
        -H "Content-Type: application/json" \
        -H "x-cron-secret: $SECRET")
    log "   Result: $RESPONSE"
}

# ------------------------------------------------------------------------------
# JOB 3: DAILY ACTIVITY REPORT
# Schedule: Daily at 8:00 PM
# ------------------------------------------------------------------------------
run_activity_report() {
    log "📈 Generating daily activity report..."
    RESPONSE=$(curl -s -X POST "$API_URL/api/reports/activity" \
        -H "x-cron-secret: $SECRET")
    log "   Result: $RESPONSE"
}

# ------------------------------------------------------------------------------
# JOB 4: META ANALYTICS SYNC
# Schedule: Daily at 2:00 AM
# ------------------------------------------------------------------------------
run_meta_sync() {
    log "📸 Running Meta daily sync..."
    RESPONSE=$(curl -s -X GET "$API_URL/api/cron/meta-sync" \
        -H "x-cron-secret: $SECRET")
    log "   Result: $RESPONSE"
}

# ------------------------------------------------------------------------------
# JOB 5: YOUTUBE ANALYTICS SYNC
# Schedule: Daily at 3:00 AM
# ------------------------------------------------------------------------------
run_youtube_sync() {
    log "📺 Running YouTube daily sync..."
    RESPONSE=$(curl -s -X POST "$API_URL/api/cron/youtube-sync" \
        -H "x-cron-secret: $SECRET")
    log "   Result: $RESPONSE"
}

# ------------------------------------------------------------------------------
# MAIN COMMAND DISPATCHER
# ------------------------------------------------------------------------------

case "$1" in
    titling)
        check_titling
        ;;
    recurring)
        run_recurring
        ;;
    report)
        run_activity_report
        ;;
    meta)
        run_meta_sync
        ;;
    youtube)
        run_youtube_sync
        ;;
    all)
        check_titling
        run_recurring
        run_activity_report
        run_meta_sync
        run_youtube_sync
        ;;
    *)
        echo "Usage: $0 {titling|recurring|report|meta|youtube|all}"
        exit 1
esac

