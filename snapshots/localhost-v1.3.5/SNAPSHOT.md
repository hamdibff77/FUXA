# FUXA localhost snapshot

This directory contains the FUXA `@frangoteam/fuxa` v1.3.5 package files from the installation used at `http://localhost:1882`, plus the 44 supplied SVG controls in `_images/SVG Controls`.

Runtime data and machine-specific files are intentionally excluded: application settings and databases, logs, cached packages, installed dependencies, local widgets, and local PostgreSQL test scripts. Install dependencies in this directory with `npm install`, then start FUXA with `npm start -- --port 1882`.
