DO $$
DECLARE
    -- ⬇️ ⬇️ ⬇️ SET TARGET CLIENT ID OR EMAIL HERE ⬇️ ⬇️ ⬇️
    target_identifier TEXT := 'cmk2dnle8001konnsenjlhuw7';
    
    -- Set to TRUE if you also want to delete the Client's portal User login account:
    delete_portal_user BOOLEAN := FALSE;

    v_client_id TEXT;
    v_client_name TEXT;
    v_portal_user_id INT;
BEGIN
    -- 1. Resolve client ID
    SELECT id, name, "userId" INTO v_client_id, v_client_name, v_portal_user_id
    FROM "Client"
    WHERE id = target_identifier OR email = target_identifier
    LIMIT 1;

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION '❌ No client found matching identifier "%"', target_identifier;
    END IF;

    RAISE NOTICE '🔥 Starting deletion for client: % (ID: %)', v_client_name, v_client_id;

    -- 2. Unlink team members
    UPDATE "User"
    SET "linkedClientId" = NULL
    WHERE "linkedClientId" = v_client_id;

    -- 3. Delete Task-dependent records
    DELETE FROM "EditorEodReportItem"
    WHERE "taskId" IN (SELECT id FROM "Task" WHERE "clientId" = v_client_id);

    DELETE FROM "TaskFeedback"
    WHERE "taskId" IN (SELECT id FROM "Task" WHERE "clientId" = v_client_id);

    DELETE FROM "TitlingJob"
    WHERE "taskId" IN (SELECT id FROM "Task" WHERE "clientId" = v_client_id);

    DELETE FROM "ShootDetail"
    WHERE "taskId" IN (SELECT id FROM "Task" WHERE "clientId" = v_client_id);

    DELETE FROM "File"
    WHERE "taskId" IN (SELECT id FROM "Task" WHERE "clientId" = v_client_id);

    -- 4. Delete Social Media Posts & Analytics
    DELETE FROM "SocialPost"
    WHERE "taskId" IN (SELECT id FROM "Task" WHERE "clientId" = v_client_id)
       OR "socialAccountId" IN (SELECT id FROM "SocialAccount" WHERE "clientId" = v_client_id);

    DELETE FROM "SocialAnalytics"
    WHERE "socialAccountId" IN (SELECT id FROM "SocialAccount" WHERE "clientId" = v_client_id);

    DELETE FROM "SocialAccount"
    WHERE "clientId" = v_client_id;

    -- 5. Delete Recurring Tasks, Tasks & Deliverables
    DELETE FROM "RecurringTask"
    WHERE "clientId" = v_client_id;

    DELETE FROM "Task"
    WHERE "clientId" = v_client_id;

    DELETE FROM "MonthlyRun"
    WHERE "clientId" = v_client_id;

    DELETE FROM "MonthlyDeliverable"
    WHERE "clientId" = v_client_id;

    DELETE FROM "OneOffDeliverable"
    WHERE "clientId" = v_client_id;

    -- 6. Delete Brand Assets & Guidelines
    DELETE FROM "BrandAsset"
    WHERE "clientId" = v_client_id;

    DELETE FROM "Guideline"
    WHERE "clientId" = v_client_id;

    -- 7. Delete Jobs & Bids
    DELETE FROM "Bid"
    WHERE "jobId" IN (SELECT id FROM "Job" WHERE "clientId" = v_client_id);

    DELETE FROM "Job"
    WHERE "clientId" = v_client_id;

    -- 8. Delete Social Integrations & Snapshots
    DELETE FROM "SocialLogin"
    WHERE "clientId" = v_client_id;

    DELETE FROM "YouTubeSnapshot"
    WHERE "clientId" = v_client_id;

    DELETE FROM "YouTubeChannel"
    WHERE "clientId" = v_client_id;

    -- 9. Delete Contracts & Signers
    DELETE FROM "ContractSigner"
    WHERE "contractId" IN (SELECT id FROM "Contract" WHERE "clientId" = v_client_id);

    DELETE FROM "Contract"
    WHERE "clientId" = v_client_id;

    -- 10. Delete Meeting Notes
    DELETE FROM "MeetingNote"
    WHERE "clientId" = v_client_id;

    -- 11. Delete Marketing & Access Records
    DELETE FROM "ClientRevenue"
    WHERE "clientId" = v_client_id;

    DELETE FROM "EditorClientPermission"
    WHERE "clientId" = v_client_id;

    DELETE FROM "PostedContent"
    WHERE "clientId" = v_client_id;

    DELETE FROM "PostingTarget"
    WHERE "clientId" = v_client_id;

    DELETE FROM "ClientPortalAccess"
    WHERE "clientId" = v_client_id;

    DELETE FROM "OnboardingToken"
    WHERE "clientId" = v_client_id;

    -- 12. Delete Stripe
END $$;