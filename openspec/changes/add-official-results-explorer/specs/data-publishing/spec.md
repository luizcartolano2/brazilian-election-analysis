## Purpose

Publishes each dataset build as an immutable, verifiable version, and serves those
versions to browsers, so every number on the site traces back to one commit and one set
of TSE source files.

## ADDED Requirements

### Requirement: Only the publish workflow writes data
Data SHALL reach storage only through one manually triggered GitHub Actions workflow
that runs on `main`. Write credentials SHALL exist only as repository secrets available
to that workflow.

#### Scenario: Triggered on another branch
- **WHEN** the publish workflow is started on any branch other than `main`
- **THEN** it stops before building, and uploads nothing

#### Scenario: Pull request runs
- **WHEN** CI runs for a pull request
- **THEN** no job has access to the storage write credentials

### Requirement: Nothing uploads unless the build passes
The publish workflow SHALL run the pipeline's tests and its reconciliation before
uploading. If either fails, it SHALL upload nothing.

#### Scenario: Reconciliation fails during publish
- **WHEN** the pipeline reports a mismatch with TSE's aggregates
- **THEN** the workflow fails and storage is unchanged

### Requirement: Every publish is a new immutable version
Each successful publish SHALL write to a new version path, named from the publish date
and the short commit hash. A publish SHALL NOT overwrite or delete any file in an
existing version.

#### Scenario: The version path already exists
- **WHEN** a publish computes a version path that already holds files
- **THEN** it fails without writing

### Requirement: The manifest completes a version
Each version SHALL contain a `manifest.json` that lists every data file with its size and
SHA-256, every TSE source with its URL, SHA-512 and download time, the pipeline commit,
the publish time and the TSE credit line. The manifest SHALL be uploaded last, so a
version without a manifest is incomplete and SHALL NOT be pinned by the app.

#### Scenario: Verifying a published version
- **WHEN** anyone downloads a version's files and its manifest
- **THEN** every file's SHA-256 matches the manifest entry

#### Scenario: An upload is interrupted
- **WHEN** a publish stops after some data files were uploaded but before the manifest
- **THEN** that version has no manifest, and the next publish uses a new version path

### Requirement: The Worker serves versioned files only
The Worker SHALL answer `GET` and `HEAD` for files inside a version path, and
`OPTIONS` for CORS preflight. It SHALL return 404 for anything else that is not a file in
a version, and SHALL NOT list directories. Other methods SHALL get 405.

#### Scenario: A file in a version
- **WHEN** a browser requests a file that exists in a version
- **THEN** the Worker returns it with its content type

#### Scenario: A listing request
- **WHEN** a browser requests a version path itself, or the root
- **THEN** the Worker returns 404 and no listing

#### Scenario: A write method
- **WHEN** a request uses `PUT`, `POST` or `DELETE`
- **THEN** the Worker returns 405 and storage is unchanged

### Requirement: Byte ranges
The Worker SHALL honor single `Range` requests, because the browser reads Parquet files
in parts.

#### Scenario: A range request
- **WHEN** a request asks for a byte range inside a file
- **THEN** the Worker returns 206 with exactly those bytes and a matching `Content-Range`

#### Scenario: A range past the end
- **WHEN** a request asks for a range that starts after the end of the file
- **THEN** the Worker returns 416

### Requirement: CORS for the app's origins only
The Worker SHALL send CORS headers only to the production origin, the project's Vercel
preview origins, and local development origins.

#### Scenario: The production app
- **WHEN** a request comes from `https://eleicoes.luizcartolano.com`
- **THEN** the response allows that origin and exposes the headers range reads need

#### Scenario: Another site
- **WHEN** a request comes from an origin that is not on the list
- **THEN** the response carries no CORS allow header

### Requirement: Versions are cached forever
Because a version never changes, the Worker SHALL mark files inside a version as
immutable and cacheable for one year.

#### Scenario: Cache headers on a data file
- **WHEN** the Worker returns a file inside a version
- **THEN** the response has `Cache-Control: public, max-age=31536000, immutable`
