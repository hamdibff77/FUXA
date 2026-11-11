# FUXA localhost snapshot

This directory contains the FUXA 1.3.6-3007 server package and production browser client currently used at `http://localhost:1882`. It includes SVG widget appearance controls and raster image placement, 127 supplied SVG controls in `_images/SVG Controls`, and 81 raster images in `_images/User Images`.

Runtime data and machine-specific files are intentionally excluded: application settings and databases, logs, cached packages, installed dependencies, local widgets, and local test scripts. Install dependencies in this directory with `npm install`, then start FUXA with `npm start -- --port 1882`.
