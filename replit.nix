{pkgs}: {
  deps = [
    pkgs.chromium
    pkgs.alsa-lib
    pkgs.expat
    pkgs.mesa
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.gdk-pixbuf
    pkgs.cairo
    pkgs.pango
    pkgs.at-spi2-core
    pkgs.dbus
    pkgs.libxkbcommon
    pkgs.xorg.libxcb
    pkgs.libdrm
    pkgs.cups
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
