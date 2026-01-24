# Quick Setup Guide - Share Feature

## 1. Complete Manual Step (REQUIRED)

Open: `src/components/client/FullScreenReviewModalFrameIO.tsx`

Find line ~1091 (before the closing `);` of the return statement)

Add:
```tsx
        {/* Share Link Dialog */}
        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          shareLink={shareLink}
          onCopy={handleCopyLink}
          copied={linkCopied}
        />
```

## 2. Run Database Migration (when DB is available)

```bash
cd "d:\E8 Productions\my-app"
npx prisma migrate dev --name add_shareable_review
# OR
npx prisma db push && npx prisma generate
```

## 3. Set Environment Variable (if not already set)

Add to `.env.local`:
```
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

## 4. Test the Feature

1. Login as QC user
2. Open any task in QC review modal
3. Click the Share button (top right)
4. Copy the generated link
5. Open in incognito window to test public view

## That's it!

The share feature is now fully functional. External users can view QC reviews without logging in.

---

## Troubleshooting

**Q: "shareableReview" property doesn't exist**  
A: Run the Prisma migration (step 2)

**Q: Share button doesn't show dialog**  
A: Complete the manual step (step 1)

**Q: Link shows "localhost" instead of actual domain**  
A: Set NEXT_PUBLIC_APP_URL environment variable (step 3)

For complete documentation, see: `SHARE_FEATURE_IMPLEMENTATION.md`
