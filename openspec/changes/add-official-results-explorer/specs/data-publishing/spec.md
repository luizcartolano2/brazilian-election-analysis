## Purpose

Publishes each dataset build as an immutable, verifiable version, and serves those
versions to browsers, so every number on the site traces back to one commit and one set
of TSE source files.

## ADDED Requirements

### Requirement: Only the publish workflow writes data
Data SHALL reach storage only through one manually triggered GitHub Actions workflow
that runs on `main`. Write credentials SHALL be secrets of a protected environment that
only `main` can use and that waits for Luiz's approval on every run. The job that runs
third-party code to build the data SHALL NOT have access to them.

#### Scenario: Triggered on another branch
- **WHEN** the publish workflow is started on any branch other than `main`
- **THEN** it stops before building, and uploads nothing

#### Scenario: Pull request runs
- **WHEN** CI runs for a pull request
- **THEN** no job has access to the storage write credentials

#### Scenario: The build job
- **WHEN** the publish workflow's build job runs the pipeline and its dependencies
- **THEN** no storage credential is available to that job

#### Scenario: Waiting for approval
- **WHEN** a publish run reaches its upload job
- **THEN** the job waits until Luiz approves it, and uploads nothing before that

### Requirement: Nothing uploads unless the build passes
The publish workflow SHALL run the pipeline's tests and its reconciliation before
uploading. If either fails, it SHALL upload nothing. Before uploading, it SHALL check
every file against the checksums in the manifest.

#### Scenario: Reconciliation fails during publish
- **WHEN** the pipeline reports a mismatch with TSE's totals
- **THEN** the workflow fails and storage is unchanged

#### Scenario: A partial build or one from other URLs
- **WHEN** the manifest says the build covered only some states, or read files from anywhere other than TSE's own URLs
- **THEN** the upload stops before writing anything

#### Scenario: A file changed between build and upload
- **WHEN** a file's SHA-256 at upload time differs from the manifest
- **THEN** the upload stops before writing anything

### Requirement: Every publish is a new immutable version
Each successful publish SHALL write to a new version path, named from the publish date,
the short commit hash and the workflow run's ID. A publish SHALL NOT overwrite or delete
any file in an existing version. Only one publish SHALL run at a time.

#### Scenario: The version path already exists
- **WHEN** a publish computes a version path that already holds files
- **THEN** it fails without writing

#### Scenario: Publishing the same commit twice in a day
- **WHEN** the workflow runs again on the same commit on the same day
- **THEN** it writes to a new version path, because the run's ID differs

#### Scenario: Two publishes at once
- **WHEN** a publish starts while another is running
- **THEN** it waits until the first one finishes

### Requirement: The manifest completes a version
Each version SHALL contain a `manifest.json` that lists every data file with its size and
SHA-256, every TSE source with its URL, SHA-512 and download time, the pipeline commit,
the time the publish run built the data, and the TSE credit line. The manifest SHALL be uploaded last, so a
version without a manifest is incomplete and SHALL NOT be pinned by the app.

#### Scenario: Verifying a published version
- **WHEN** anyone downloads a version's files and its manifest
- **THEN** every file's SHA-256 matches the manifest entry

#### Scenario: An upload is interrupted
- **WHEN** a publish stops after some data files were uploaded but before the manifest
- **THEN** that version has no manifest, and the next publish uses a new version path

### Requirement: The browser engine's WebAssembly file comes from storage
The DuckDB-WASM WebAssembly file SHALL be published to storage under a path named for its
package version, by the same protected workflow, and SHALL be immutable like a data
version.

#### Scenario: The app loads the query engine
- **WHEN** a drill-down view starts the query engine
- **THEN** the WebAssembly file comes through the Worker, not from the app's host

### Requirement: The Worker serves versioned files only
The Worker SHALL answer `GET` and `HEAD` for files inside a data version or a WebAssembly
asset path, and `OPTIONS` for CORS preflight. It SHALL accept a key only when every path
segment uses safe characters, with no `..` segment and no encoded slash. It SHALL return
404 for anything else and SHALL NOT list directories. Other methods SHALL get 405.

#### Scenario: A file in a version
- **WHEN** a browser requests a file that exists in a version
- **THEN** the Worker returns it with its content type

#### Scenario: A listing request
- **WHEN** a browser requests a version path itself, or the root
- **THEN** the Worker returns 404 and no listing

#### Scenario: A path traversal attempt
- **WHEN** the path the Worker receives contains a `..` segment, an encoded slash, or a key outside the allowed prefixes
- **THEN** the Worker returns 404 without reading storage

#### Scenario: A `..` segment the runtime resolves
- **WHEN** a request line holds `..` segments that the Workers runtime resolves before the Worker runs
- **THEN** the Worker applies the same checks to the resolved path

#### Scenario: A write method
- **WHEN** a request uses `PUT`, `POST` or `DELETE`
- **THEN** the Worker returns 405 and storage is unchanged

### Requirement: Byte ranges
The Worker SHALL honor a single byte range in the forms `bytes=a-b`, `bytes=a-` and
`bytes=-n`, because the browser reads Parquet files in parts. It SHALL ignore a malformed
`Range` header or one with several ranges, and return the whole file.

#### Scenario: A range request
- **WHEN** a request asks for a byte range inside a file
- **THEN** the Worker returns 206 with exactly those bytes and a matching `Content-Range`

#### Scenario: A suffix range
- **WHEN** a request asks for the last 1,024 bytes of a file with `bytes=-1024`
- **THEN** the Worker returns 206 with those bytes

#### Scenario: A range past the end
- **WHEN** a request asks for a range that starts after the end of the file
- **THEN** the Worker returns 416

#### Scenario: Several ranges or a malformed header
- **WHEN** the `Range` header lists several ranges or cannot be parsed
- **THEN** the Worker returns 200 with the whole file

### Requirement: CORS for the app's origins only
The Worker SHALL send CORS headers only to the exact production origin and the local
development origin. It SHALL NOT allow any Vercel preview origin, because anyone can claim
a free `vercel.app` alias that looks like this project's previews.
Every response SHALL carry `Vary: Origin`. A preflight SHALL allow `GET` and `HEAD` and
the `Range` header. Responses SHALL expose `Content-Range`, `Content-Length`,
`Accept-Ranges` and `ETag`.

#### Scenario: The production app
- **WHEN** a request comes from `https://eleicoes.luizcartolano.com`
- **THEN** the response allows that origin and exposes `Content-Range`, `Content-Length`, `Accept-Ranges` and `ETag`

#### Scenario: Local development
- **WHEN** a request comes from `http://localhost:3000`
- **THEN** the response allows that origin

#### Scenario: A Vercel origin
- **WHEN** a request comes from any `vercel.app` origin, a preview of this project included
- **THEN** the response carries no CORS allow header

#### Scenario: A preflight for a range read
- **WHEN** an allowed origin sends `OPTIONS` asking for `GET` with a `Range` header
- **THEN** the response allows the method and the header

### Requirement: Versions are cached forever
Because a version never changes, the Worker SHALL mark files inside a version or a
WebAssembly asset path as immutable and cacheable for one year.

#### Scenario: Cache headers on a data file
- **WHEN** the Worker returns a file inside a version
- **THEN** the response has `Cache-Control: public, max-age=31536000, immutable`
