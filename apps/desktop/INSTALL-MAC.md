# Installing E8 App on macOS

E8 App is ad-hoc signed but **not** notarized by Apple (that requires a paid Apple
Developer account). macOS will therefore block it the first time you open it. This is
a one-time step — after you approve it once, the app opens normally forever.

## Which download do I need?

Click the Apple menu → **About This Mac** and look at **Chip** / **Processor**:

| What it says | Download |
| --- | --- |
| Apple M1 / M2 / M3 / M4 | `E8 App-<version>-arm64.dmg` |
| Intel Core i5 / i7 / i9 | `E8 App-<version>-x64.dmg` |

## Install

1. Open the `.dmg` you downloaded.
2. Drag **E8 App** into your **Applications** folder.
3. Open **Applications** and double-click **E8 App**.
4. macOS shows *"Apple could not verify 'E8 App' is free of malware..."* — click **Done**.
5. Open **System Settings → Privacy & Security**, scroll to the **Security** section.
   You'll see *"E8 App was blocked to protect your Mac."* Click **Open Anyway**.
6. Confirm with **Open Anyway** and your password / Touch ID.

That's it. E8 App now opens by double-clicking like any other app.

> On macOS 14 (Sonoma) and earlier you can instead right-click the app → **Open** →
> **Open**. macOS 15 (Sequoia) removed that shortcut, so use the steps above.

## Faster alternative (Terminal)

If you'd rather not click through System Settings, run this once after dragging the app
to Applications:

```sh
xattr -dr com.apple.quarantine "/Applications/E8 App.app"
```

This removes the download quarantine flag, and the app opens with no prompt at all.

## Troubleshooting

**"E8 App is damaged and can't be opened. You should move it to the Trash."**

This means the copy you have was built before ad-hoc signing was added, or the `.app`
was modified after signing (some unzip tools and cloud-sync clients do this). Delete it
and download a fresh `.dmg` — always distribute the DMG rather than a loose `.app`.

**Nothing appears in Privacy & Security**

The "Open Anyway" button only shows for about an hour after a blocked launch attempt.
Double-click the app again, then go straight to System Settings.
