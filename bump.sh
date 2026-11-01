#!/bin/sh
# bump cache version: sw.js + ?v= on app.js/style.css in every entry page
V=$(date +%s)
sed -i "s/const VERSION = \"bandup-[^\"]*\"/const VERSION = \"bandup-$V\"/" sw.js
for f in index.html u/*/index.html beta/index.html; do
  sed -i -E "s#(app\.js|style\.css)(\?v=[0-9]+)?\"#\1?v=$V\"#g" "$f"
done
echo $V
