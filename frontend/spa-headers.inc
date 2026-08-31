# OBLIGATORIAS para el login con Google: el popup de GIS necesita poder comunicarse
# con la ventana que lo abrió. Sin COOP=same-origin-allow-popups el login falla en
# silencio, y COEP debe quedar en unsafe-none para no bloquear recursos de Google.
add_header Cross-Origin-Opener-Policy   "same-origin-allow-popups" always;
add_header Cross-Origin-Embedder-Policy "unsafe-none" always;
add_header X-Content-Type-Options       "nosniff" always;
