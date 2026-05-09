# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Screen2Issue, please **do not open a public GitHub issue**.

Instead, email: **machirajusaisandeep@gmail.com**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive a response within 72 hours. Once the issue is confirmed, a fix will be prioritized and a patched release will be made before public disclosure.

## Scope

Security reports are most relevant for:

- API key storage or leakage in the browser or desktop app
- Content injection via maliciously crafted video, OCR output, or HAR files leading to script execution
- Tauri IPC surface exposing unintended capabilities to the webview
- Data sent to unintended external services

## Out of Scope

- Vulnerabilities in third-party AI provider APIs (Claude, Gemini, OpenAI, DeepSeek) — report those to the respective vendors
- Issues requiring physical access to the machine
- Social engineering attacks

## Notes on API Key Storage

Browser and PWA builds store API keys in `localStorage` — this is an accepted trade-off given the lack of secure browser storage APIs. Do not use Screen2Issue on a shared or public device if you have API keys configured. The macOS desktop build uses the OS-native keychain for key storage.
