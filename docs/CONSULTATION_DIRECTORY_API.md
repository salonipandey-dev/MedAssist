# Consultation directory API (MA-01/02)

`GET /api/v1/consultations` is a read-only search over consultation listings
stored in PostgreSQL. The seeded records are the nine fictional options from
`frontend/src/data/mock/consultations.ts`. Nothing in the seed is a real
provider, price or free service.

Find Consultations (`/app/patient/consultations`) reads from this endpoint when
the frontend is built with `VITE_API_BASE_URL` (batch MA-03). The mapping below
is what `frontend/src/features/consultations/listing.ts` implements.
This batch is engineering evidence toward FR12 / VT13. Validation against real
sources belongs to MA-06.

## Request

All parameters are optional and combine with AND.

| Parameter | Values | Behaviour |
| --- | --- | --- |
| `q` | text, up to 60 characters | Split on whitespace. Every term must appear, ignoring case, in the provider name, specialty or area. `%` and `_` are plain characters. Blank means no search. |
| `specialty` | text, 1–60 characters | Exact specialty, ignoring case. An unlisted specialty returns an empty page. |
| `mode` | `in_person`, `video`, `phone` | Listings that offer this mode. |
| `fee_state` | `known`, `free`, `unknown` | Listings whose fee is in this state. |
| `max_fee_minor` | integer, 0–100000000 | Inclusive maximum in paise. Matches `free` listings and `known` amounts up to the limit. `unknown` fees never match. |
| `limit` | 1–50, default 20 | Page size. |
| `offset` | 0–10000, default 0 | Rows to skip. |

Results are ordered by listing ID, so the same request returns the same body.

## Response

`200 OK` with a page. A valid search with no matches returns
`{"items": [], "total": 0, "limit": 20, "offset": 0}`.

```json
{
  "items": [
    {
      "id": "c-03",
      "provider_name": "Sample Community Health Camp (fictional)",
      "provider_type": "community_camp",
      "specialty": "General practice",
      "modes": ["in_person"],
      "area": "Old Market, Sample City",
      "fee": {
        "state": "free",
        "amount_minor": 0,
        "currency": "INR",
        "basis": "Shown as free for demonstration only. A real free service would need a verified source."
      },
      "access_conditions": "Fictional example: walk-in on camp days only.",
      "languages": ["Hindi"],
      "hours": "First Saturday of the month (illustrative)",
      "notes": "Shown as free for demonstration only. A real free service would need a verified source.",
      "is_fictional": true,
      "source": {
        "kind": "fictional_seed",
        "id": "medassist-fictional-seed",
        "name": "MedAssist fictional demonstration directory",
        "version": "1.0.0",
        "url": null,
        "last_checked_on": null
      }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

Every field is always present; optional values are `null`, never omitted.

### Fee states

| `fee.state` | `amount_minor` | `currency` | `basis` | Meaning |
| --- | --- | --- | --- | --- |
| `known` | positive integer (paise) | `INR` | text | A listed amount. 30000 is ₹300. |
| `free` | `0` | `INR` | text | Explicitly free. The basis says what that rests on. |
| `unknown` | `null` | `null` | `null` | No fee is listed. This is not free and not zero. |

Decide on `fee.state`, not on the amount. A database CHECK constraint and the
response model both reject any other combination, so a free listing cannot
exist without a basis and an unknown fee cannot carry an amount.

### Source and verification

`is_fictional` is `true` and `source.kind` is `fictional_seed` for every seeded
record. For those records `source.url` and `source.last_checked_on` are always
`null`; the database refuses a check date on a fictional listing. The
`reviewed_external` kind is reserved for MA-06 and no record uses it yet.

`hours` is `null` for the two fixtures whose text was "Not listed in this
sample" (`c-06`, `c-09`). `access_conditions` is `null` when none are recorded.

## Errors

| Status | When | Body |
| --- | --- | --- |
| `422` | A parameter is out of range or not an allowed value. | FastAPI validation body: `{"detail": [{"loc": ["query", "mode"], "msg": "...", "type": "..."}]}` |
| `503` | PostgreSQL is unreachable, not migrated, or `MEDASSIST_DATABASE_URL` is unset. | `{"detail": "The consultation directory is temporarily unavailable. Please try again later.", "request_id": "<uuid>"}` with `Cache-Control: no-store` |

Every response carries `X-Request-ID`. On a 503 the same value is in the body
and in one server log line, which records the kind of failure and nothing from
the request or the database. `/`, `/health` and `/openapi.json` do not use the
database and keep responding during an outage.

## Mapping the Find Consultations screen

| Screen control | Selected value | Query |
| --- | --- | --- |
| Search box | any text | `q=<text>` (send as typed; omit when blank) |
| Specialty | All specialties | omit `specialty` |
| Specialty | e.g. Dermatology | `specialty=Dermatology` |
| Mode | All modes | omit `mode` |
| Mode | In person / Video / Phone | `mode=in_person` / `mode=video` / `mode=phone` |
| Fee | Any | omit both fee parameters |
| Fee | Free (illustrative) | `fee_state=free` |
| Fee | Up to ₹300 | `max_fee_minor=30000` |
| Fee | Fee not listed | `fee_state=unknown` |

"Up to ₹300" returns `c-01` (₹300 exactly), `c-02` (₹199) and the two free
examples `c-03` and `c-08`, the same four the current screen shows.

| Fixture field | API field |
| --- | --- |
| `id` | `id` (unchanged: `c-01` … `c-09`) |
| `name` | `provider_name` |
| `providerType` `'Clinic'`, `'Hospital outpatient'`, `'Teleconsultation'`, `'Community camp'` | `provider_type` `clinic`, `hospital_outpatient`, `teleconsultation`, `community_camp` |
| `modes` `'In person'`, `'Video'`, `'Phone'` | `modes` `in_person`, `video`, `phone` |
| `fee.kind` `illustrative` + `amountInr` | `fee.state` `known` + `amount_minor / 100` |
| `fee.kind` `free-illustrative` | `fee.state` `free` |
| `fee.kind` `unavailable` | `fee.state` `unknown` |
| `hours` `'Not listed in this sample'` | `hours` `null` |
| `note` | `notes` |

The nine seeded listings fit in one default page. Read `total` for the
"N of M" count instead of the page length.

## Examples

```powershell
curl.exe -s "http://127.0.0.1:8000/api/v1/consultations"
curl.exe -s "http://127.0.0.1:8000/api/v1/consultations?q=riverside%20clinic"
curl.exe -s "http://127.0.0.1:8000/api/v1/consultations?max_fee_minor=30000"
curl.exe -s "http://127.0.0.1:8000/api/v1/consultations?specialty=Dermatology&mode=video&fee_state=unknown"
curl.exe -i "http://127.0.0.1:8000/api/v1/consultations?mode=fax"
```

More requests are in [backend/requests.http](../backend/requests.http). Setup
steps are in the [README](../Readme.md#set-up-the-consultation-directory).
