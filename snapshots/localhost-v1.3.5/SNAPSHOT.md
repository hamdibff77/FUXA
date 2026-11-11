# FUXA localhost snapshot

This directory contains the FUXA `@frangoteam/fuxa` v1.3.5 package files from the installation used at `http://localhost:1882`, plus 127 SVG controls in `_images/SVG Controls` (including 83 additional supplied SVGs numbered `SVG_045.svg` through `SVG_127.svg`) and the supplied PNG image in `_images/User Images`.

Runtime data and machine-specific files are intentionally excluded: application settings and databases, logs, cached packages, installed dependencies, local widgets, and local PostgreSQL test scripts. Install dependencies in this directory with `npm install`, then start FUXA with `npm start -- --port 1882`.
