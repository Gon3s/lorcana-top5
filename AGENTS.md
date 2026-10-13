# Maintaining Lorcana Top 5

- Each user-requested site update is one release. Run `npm run release -- patch "Change delivered"` (or `minor` for new features) once for the update. Commit `package.json` and `CHANGELOG.json` together with the implementation.
- Use meaningful French changelog notes describing the resulting user experience. Do not bump again for intermediate fixes within the same release.
- Catalogue refreshes and image-cache updates do not increment the application version.
- `package.json` is the version source. The build must refuse a mismatched latest changelog version. Do not hardcode the current version into web pages.
- Preserve local-storage keys and existing shared-link formats unless migration is explicitly part of the task.
- Run the existing tests and appropriate UI checks, publish through the Pages workflow and verify the final deployment. No additional approval is needed when publication is already authorized in the conversation.
