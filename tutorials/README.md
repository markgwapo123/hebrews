# HEBREWS real-interface tutorial recorder

This tool records the **actual Angular interface** using Playwright. It does not fabricate mock screens. It currently records **read-only module navigation and safe hover/date interactions**; it does **not** perform product saves, stock-in, checkout, void, or resets. Those operations require separate controlled fixtures and are intentionally not simulated as completed transactions.

## Safety

- The recorder refuses to start if port 5000 is already occupied. **Stop the normal backend first.**
- It launches a separate backend process explicitly configured with MongoDB database **hebrews_tutorial_db**, not hebrews_db.
- It uses credentials dedicated to the tutorial database. Never record on real business data.
- The frontend must be running on localhost:4200, and its API must target localhost:5000.
- A failed demo-owner creation may mean the tutorial database already has an owner. If the demo login then fails, manually remove only the isolated tutorial database and retry.

## Run on your own Windows laptop

1. Stop the regular backend (Ctrl+C in its terminal). Keep Angular running on port 4200.
2. In a **new terminal** run:

   ```powershell
   cd tutorials
   npm install
   npx playwright install chromium
   npm run record
   ```

3. Generated WebM files and manifest will appear under `frontend/src/assets/tutorials/`.
4. Restart the normal backend when done (`cd backend; npm run dev`).

To publish recordings, convert WebM to MP4 with ffmpeg if necessary, review for sensitive data, and commit the chosen assets to Git. The Help page only plays a file if that file has been placed in the public assets directory. Never commit secrets or backend .env files.

**Note:** This is a real UI screen recording tool, not a fully automated video editor. Advanced cursor overlays, zoom edits and voiceover are not yet generated. Browser recording cannot run against your local laptop from ChatGPT.
