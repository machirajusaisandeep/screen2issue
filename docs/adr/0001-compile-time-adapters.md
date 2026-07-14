# ADR 0001: Compile-time adapter registries

Status: accepted for v1.0

Screen2Issue accepts contributor analyzers and exporters through typed compile-time registries. It does not load arbitrary runtime plugins.

This keeps the offline and no-account model auditable, allows TypeScript and CI to validate contracts, and avoids introducing a remote-code execution boundary. The tradeoff is that installing an adapter requires rebuilding the application. A runtime plugin model may be reconsidered only with a signed-package model, explicit permissions, sandboxing, and a public threat assessment.
