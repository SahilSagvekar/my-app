// src/app/api/meta/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { MetaService } from "@/lib/meta";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    if (error || !code) {
        console.error("Meta OAuth Error:", error);
        return NextResponse.redirect(`${baseUrl}/dashboard?meta_error=${error || "no_code"}`);
    }

    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.redirect(`${baseUrl}/login`);
        }

        // 1. Get client ID from state or user profile
        let clientId: string | null = null;
        if (state && state !== "self") {
            clientId = state;
        } else if (user.role === "client") {
            const client = await prisma.client.findUnique({
                where: { userId: user.id },
                select: { id: true },
            });
            clientId = client?.id || null;
        }

        if (!clientId) {
            console.error("No client ID found for Meta connection");
            return NextResponse.redirect(`${baseUrl}/dashboard?meta_error=no_client`);
        }

        // 2. Exchange code for short-lived token
        const tokenRes = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(`${baseUrl}/api/meta/callback`)}&client_secret=${process.env.META_APP_SECRET}&code=${code}`
        );

        if (!tokenRes.ok) {
            const err = await tokenRes.json();
            throw new Error(err.error?.message || "Token exchange failed");
        }

        const tokenData = await tokenRes.json();
        const shortToken = tokenData.access_token;

        // 3. Exchange for long-lived token (60 days)
        const longTokenData = await MetaService.getLongLivedToken(shortToken);
        const accessToken = longTokenData.access_token;
        const expiry = new Date(Date.now() + (longTokenData.expires_in || 5184000) * 1000);

        // 4. Find linked Instagram Business Account
        const pagesData = await MetaService.getPages(accessToken);
        const pages = pagesData.data || [];

        let igAccountId: string | null = null;
        let fbPageId: string | null = null;

        for (const page of pages) {
            igAccountId = await MetaService.getInstagramAccount(page.id, accessToken);
            if (igAccountId) {
                fbPageId = page.id;
                break;
            }
        }

        if (!igAccountId) {
            return NextResponse.redirect(`${baseUrl}/dashboard?meta_error=no_ig_business_account`);
        }

        // 5. Get Instagram Profile Info
        const profile = await MetaService.getProfile(igAccountId, accessToken);

        // 6. Store in Database
        await prisma.metaAccount.upsert({
            where: { clientId },
            create: {
                clientId,
                instagramId: igAccountId,
                facebookPageId: fbPageId,
                username: profile.username,
                profilePicture: profile.profile_picture_url,
                accessToken,
                tokenExpiry: expiry,
                followerCount: profile.followers_count,
                followingCount: profile.follows_count,
                mediaCount: profile.media_count,
                syncStatus: "COMPLETED",
                lastSyncedAt: new Date(),
            },
            update: {
                instagramId: igAccountId,
                facebookPageId: fbPageId,
                username: profile.username,
                profilePicture: profile.profile_picture_url,
                accessToken,
                tokenExpiry: expiry,
                followerCount: profile.followers_count,
                followingCount: profile.follows_count,
                mediaCount: profile.media_count,
                lastSyncedAt: new Date(),
                syncStatus: "COMPLETED",
            }
        });

        // 7. Initial Data Sync
        await MetaService.syncAccount(clientId);

        return NextResponse.redirect(`${baseUrl}/dashboard/meta-studio?connected=true`);
    } catch (err: any) {
        console.error("Meta callback failed:", err);
        return NextResponse.redirect(`${baseUrl}/dashboard?meta_error=callback_failed&message=${encodeURIComponent(err.message)}`);
    }
}
