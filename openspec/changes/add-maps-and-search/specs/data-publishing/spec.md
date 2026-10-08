## ADDED Requirements

### Requirement: Map boundaries come from storage
The protected publish workflow SHALL stage IBGE's 2025 municipal boundaries, simplified
to TopoJSON, from a source file pinned by its SHA-512. It SHALL publish them under
`assets/geo/ibge-2025/` with a `SHA256SUMS` list, by the same rules as the DuckDB assets:
a publish SHALL NOT overwrite or delete a file there, and a retry SHALL resume an
interrupted upload only when the files there equal the staged ones. The boundaries SHALL
keep IBGE's municipality code for each area. A production build of the app SHALL fail
when a boundary file that the Worker serves differs from its pinned SHA-256.
`DATA_LICENSE.md` SHALL record IBGE's terms and credit line before the first publish.

#### Scenario: A different source file
- **WHEN** the IBGE file that the workflow downloads differs from its pinned SHA-512
- **THEN** the workflow fails and stages nothing

#### Scenario: A published boundary file differs
- **WHEN** a production build finds that the Worker serves a boundary file that differs from its pin
- **THEN** the build fails

#### Scenario: A complete boundary path
- **WHEN** a publish finds `SHA256SUMS` already under `assets/geo/ibge-2025/`
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
- **WHEN** a browser requests a file that exists under `assets/geo/ibge-2025/`
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
- **WHEN** the Worker returns a file under `assets/geo/ibge-2025/`
- **THEN** the response has `Cache-Control: public, max-age=31536000, immutable`
