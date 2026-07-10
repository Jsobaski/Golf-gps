# Project Specification: Live Golf GPS & Environmental Plays-Like Calculator

## Tech Stack
Next.js (App Router), TypeScript, Tailwind CSS, deployable on Vercel. 
Target UI matches Arccos layout using an ultra-clean, high-visibility dark mode palette (#121212) with bright electric green (#00E676) numbers.

## Features
1. Geolocation tracking using `navigator.geolocation.watchPosition` with high accuracy.
2. Auto-detect closest Las Vegas course from data bank within a 5-mile radius, allowing manual overrides.
3. Split screen metric layout: Left displays raw white/gray GPS yardages; Right displays bold vibrant green "Plays-Like" yardages.
4. Integrate Open-Meteo API using course coordinates to pull real-time wind and temperature.
5. Create a global UI toggle switch to fully turn Slope calculations ON/OFF.
