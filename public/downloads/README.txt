Place your signed release APK here. Two filenames are currently referenced
by the app, so drop a copy of the same signed build under BOTH names
(or make one a symlink/copy of the other in your build step):

    app-release-signed.apk
        referenced by src/components/DownloadApkMenuItem.jsx
        (account menu -> "Download App")
        served at /downloads/app-release-signed.apk

    rentapay.apk
        referenced by src/components/DownloadAppSection.jsx
        (landing page -> "Download RentaPay App" card)
        served at /downloads/rentapay.apk

Both are just static-file links to the same Bubblewrap-built APK - there's
no functional difference, they just got added at different times. Feel
free to consolidate to one filename later and update whichever component
still points at the old one.

After copying the real APK(s) in, delete this README (or leave it - it
won't be linked to from anywhere) and redeploy.
