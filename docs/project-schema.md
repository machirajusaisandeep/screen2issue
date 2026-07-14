# Project schema and migrations

`ProjectDocumentV1` is the persisted draft contract. It contains schema version, project metadata, report content, derived-frame asset references, analysis results, current workflow step, and timestamps.

It intentionally excludes the original recording and API keys. Derived frame pixels are stored as separate IndexedDB blobs referenced by asset keys; object URLs are reconstructed only while loading a draft.

Every incompatible change must increment `schemaVersion` and add a pure migration before changing the current writer. Migrations must preserve user-authored text, tolerate missing optional fields, reject unsupported future versions, and have fixture-based tests. Corrupt documents must offer clear/recovery controls rather than being silently overwritten.
