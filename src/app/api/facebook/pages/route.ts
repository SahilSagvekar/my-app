// src/app/api/facebook/pages/route.ts
// GET - List available Facebook Pages for connection
// POST - Connect a Facebook Page to a client

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { FacebookService } from '@/lib/social/facebook';
import { encrypt } from '@/lib/encryption';

// GET - List Facebook Pages user can manage
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Get Meta account for this client (to get the access token)
    const metaAccount = await prisma.metaAccount.findUnique({
      where: { clientId },
    });

    if (!metaAccount) {
      return NextResponse.json({ 
        error: 'No Meta account connected. Please connect Instagram first.',
        needsConnection: true 
      }, { status: 404 });
    }

    // Fetch pages from Facebook
    const fbService = new FacebookService(metaAccount.accessToken);
    const pages = await fbService.getPages();

    // Check which pages are already connected
    const connectedPages = await prisma.facebookPage.findMany({
      where: { clientId },
      select: { pageId: true },
    });

    const connectedPageIds = new Set(connectedPages.map(p => p.pageId));

    return NextResponse.json({
      ok: true,
      pages: pages.map(page => ({
        ...page,
        isConnected: connectedPageIds.has(page.id),
      })),
    });
  } catch (error: any) {
    console.error('[FACEBOOK PAGES] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Connect a Facebook Page
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager', 'client'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { clientId, pageId, pageName, pageAccessToken, category, picture } = body;

    if (!clientId || !pageId || !pageAccessToken) {
      return NextResponse.json({ 
        error: 'clientId, pageId, and pageAccessToken are required' 
      }, { status: 400 });
    }

    // Check if already connected
    const existing = await prisma.facebookPage.findUnique({
      where: { clientId_pageId: { clientId, pageId } },
    });

    if (existing) {
      return NextResponse.json({ error: 'Page already connected' }, { status: 409 });
    }

    // Get page info
    const fbService = new FacebookService(pageAccessToken, pageId, pageAccessToken);
    const pageInfo = await fbService.getPageInfo();

    // Save to database
    const facebookPage = await prisma.facebookPage.create({
      data: {
        clientId,
        pageId,
        pageName: pageName || pageInfo.name,
        pageAccessToken: encrypt(pageAccessToken),
        category: category || pageInfo.category,
        profilePicture: picture || pageInfo.picture,
        followerCount: pageInfo.followers,
        likeCount: pageInfo.likes,
        isActive: true,
      },
    });

    // Also update MetaAccount if not already linked
    await prisma.metaAccount.updateMany({
      where: { clientId, facebookPageId: null },
      data: { facebookPageId: pageId },
    });

    console.log(`[FACEBOOK] Connected page ${pageName} for client ${clientId}`);

    return NextResponse.json({
      ok: true,
      page: {
        id: facebookPage.id,
        pageId: facebookPage.pageId,
        pageName: facebookPage.pageName,
        category: facebookPage.category,
        followerCount: facebookPage.followerCount,
        likeCount: facebookPage.likeCount,
      },
    });
  } catch (error: any) {
    console.error('[FACEBOOK PAGES POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Disconnect a Facebook Page
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager', 'client'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get('pageId');
    const clientId = searchParams.get('clientId');

    if (!pageId || !clientId) {
      return NextResponse.json({ error: 'pageId and clientId required' }, { status: 400 });
    }

    await prisma.facebookPage.delete({
      where: { clientId_pageId: { clientId, pageId } },
    });

    // Remove from MetaAccount if linked
    await prisma.metaAccount.updateMany({
      where: { clientId, facebookPageId: pageId },
      data: { facebookPageId: null },
    });

    return NextResponse.json({ ok: true, message: 'Page disconnected' });
  } catch (error: any) {
    console.error('[FACEBOOK PAGES DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}