# Release Workflow Documentation

This document outlines the standardized procedure for deploying new versions of TakeoutFixer via the automated CI/CD pipeline.

---

## 1. Version Increment
Before initiating a release, update the version identifiers in the following configuration files to ensure consistency across the application and the updater system.

*   **Frontend**: `package.json`
    ```json
    "version": "1.0.1"
    ```
*   **Backend/Tauri**: `src-tauri/tauri.conf.json`
    ```json
    "version": "1.0.1"
    ```

## 2. Commit Changes
Ensure all feature updates and version increments are staged and committed to the `main` branch.

```powershell
git add .
git commit -m "chore: bump version to 1.0.1"
git push origin main
```

## 3. Create Semantic Tag
The GitHub Actions release pipeline is triggered specifically by tags prefixed with the letter `v`.

```powershell
# Create a local annotated tag
git tag -a v1.0.1 -m "Release v1.0.1"

# Push the tag to the remote repository
git push origin v1.0.1
```

## 4. Automated Build Process
Once the tag is pushed, the **GitHub Actions Release Workflow** will automatically initiate:

1.  **Environment Provisioning**: Three virtual runners (Windows, macOS, Ubuntu) are initialized.
2.  **Compilation**: The Rust backend and React frontend are compiled for production.
3.  **Bundling**: Installers are generated (`.exe`, `.dmg`, `.deb`, `.AppImage`).
4.  **Artifact Upload**: Binaries are attached to a new Draft Release on GitHub.

## 5. Finalizing the Release
1.  Navigate to the **Releases** section of the GitHub repository.
2.  Locate the new **Draft** release created by the `github-actions` bot.
3.  Review the automated changelog.
4.  Click **Publish Release** to make the binaries available to the public.

---
*Note: Ensure the `GITHUB_TOKEN` secrets are configured in the repository settings if the pipeline fails with authentication errors.*
