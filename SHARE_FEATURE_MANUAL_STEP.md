# Share Feature Implementation - Manual Steps

Due to file size limitations, please manually add the following component usage to FullScreenReviewModalFrameIO.tsx:

## Location:
Add this RIGHT BEFORE the closing `);` at the end of the return statement (around line 1091)

## Code to Add:
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

## The section should look like this:
```tsx
            </DialogContent>
        </Dialog>

        {/* Share Link Dialog */}
        <ShareDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          shareLink={shareLink}
          onCopy={handleCopyLink}
          copied={linkCopied}
        />
    );
}
```

Make sure to place it BEFORE the final `);` that closes the component's return statement.
