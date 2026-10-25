# MedAssist interface screenshots

Captured from the compiled application using entirely fictional records. These are real application screenshots, not design mockups or evidence of clinical deployment.

| Screen | Preview |
| --- | --- |
| Public product homepage | [home.png](home.png) |
| Patient overview, light theme | [patient.png](patient.png) |
| Split-panel professional review | [doctor-review.png](doctor-review.png) |
| Administrator overview, dark theme | [admin-dark.png](admin-dark.png) |
| Patient overview, 390px mobile viewport | [patient-mobile.png](patient-mobile.png) |

To regenerate from `frontend` after installing Chromium:

```bash
npm run build
npm run screenshots
```

The script starts a temporary local preview server on port 4174, captures the seeded UI and closes the browser/server. It does not submit data or enable unavailable features.
