## ADDED Requirements

### Requirement: Map boundaries come from storage
The protected publish workflow SHALL stage IBGE's 2025 municipal boundaries, simplified
to TopoJSON, from a source file pinned by its SHA-512. Each staging run SHALL publish to
its own path, `assets/geo/ibge-2025/<YYYYMMDD>-<short commit>-<run id>/`, with a
`manifest.json` that records the source URL and SHA-512, the commit, the `mapshaper`
version, the simplification settings and every polygon part it dropped. A `SHA256SUMS`
list goes last. A publish SHALL NOT overwrite or delete a file there, and a retry SHALL
resume an interrupted upload only when the files there equal the staged ones. The
boundaries SHALL keep IBGE's municipality code for each area.

Before the upload, the staging job SHALL check the boundaries against the pinned data
version's municipality list. Every municipality with an IBGE code needs a boundary, and
every boundary needs a municipality, except IBGE's two lagoon areas in Rio Grande do Sul.
The job SHALL also fail when it drops a polygon part that is not on the written list of
expected parts.

A production build of the app SHALL fail when a boundary file that the Worker serves
differs from its pinned SHA-256. Before the first publish, `DATA_LICENSE.md` SHALL record
IBGE's terms and a credit line that says the boundaries were simplified, and SHALL keep
the boundaries out of this project's own CC BY grant.

#### Scenario: A different source file
- **WHEN** the IBGE file that the workflow downloads differs from its pinned SHA-512
- **THEN** the workflow fails and stages nothing

#### Scenario: A municipality lost in simplification
- **WHEN** a staged boundary build has no area for a municipality in the pinned data version
- **THEN** the staging job fails before any upload, and names the municipality

#### Scenario: An unexpected dropped island
- **WHEN** the staging script drops a polygon part that is not on the written list
- **THEN** the staging job fails before any upload, and names the municipality and the part

#### Scenario: A published boundary file differs
- **WHEN** a production build finds that the Worker serves a boundary file that differs from its pin
- **THEN** the build fails

#### Scenario: A complete boundary path
- **WHEN** a publish finds `SHA256SUMS` already under its boundary build path
- **THEN** it fails without writing

## MODIFIED Requirements

### Requirement: The Worker serves versioned files only
The Worker SHALL answer `GET` and `HEAD` for files inside a data version, a DuckDB
asset path or a map boundary path, and `OPTIONS` for CORS preflight. It SHALL accept a
key only when every path segment uses safe characters, with no `..` segment and no
encoded slash. It SHALL return 404 for anything else and SHALL NOT list directories.
Other methods SHALL get 405.

#### Scenario: A file in a version
- **WHEN** a browser requests a file that exists in a version
- **THEN** the Worker returns it with its content type

#### Scenario: A boundary file
- **WHEN** a browser requests a file that exists under a boundary build path in `assets/geo/`
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

### Requirement: Versions are cached forever
Because a version never changes, the Worker SHALL mark files inside a version, a DuckDB
asset path or a map boundary path as immutable and cacheable for one year.

#### Scenario: Cache headers on a data file
- **WHEN** the Worker returns a file inside a version
- **THEN** the response has `Cache-Control: public, max-age=31536000, immutable`

#### Scenario: Cache headers on a boundary file
- **WHEN** the Worker returns a file under a boundary build path in `assets/geo/`
- **THEN** the response has `Cache-Control: public, max-age=31536000, immutable`
