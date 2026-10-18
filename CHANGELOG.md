# Changelog

All notable changes to this project are documented in this file.

## [0.1.0] - 2026-10-18

### Added

- Japanese copy for the Advisor settings page: the Settings, Budget, History, and Connection test tabs, their fields, hints, buttons, status messages, outcomes, and errors.
- The Japanese Advisor dictionary registers against the Advisor's existing `settings.advisor` namespace, so a key that has no Japanese translation keeps rendering in English.
- The `日本語` language is added to Settings → General → Language when no other language pack provides it, and is left alone when one does. The add-on therefore works both standalone and alongside `@fang2hou/dsh-locale-ja`.
- Installation directly from GitHub: `dsh plugin --profile <profile> add github:KnameSk/dsh-advisor-locale-ja`.
- A release guide, so published versions stay reproducible and immutable: tag an install with a version instead of tracking `main`.
