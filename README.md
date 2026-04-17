# CAD Assembly Instructions

Pierwszy mały etap projektu:

- ekran uploadu plików `STEP` / `STP`
- walidacja rozszerzenia i limitu `50 MB`
- zapis pliku do lokalnego `storage/uploads`
- in-memory job store
- `SSE` pod `GET /api/progress/[jobId]/stream`

## Start

```bash
npm install
npm run dev
```

## Aktualny zakres

Endpoint `POST /api/step/upload` przyjmuje `multipart/form-data` z polem `file`.

Przykładowa odpowiedź:

```json
{
  "ok": true,
  "jobId": "uuid",
  "fileName": "szafka.step",
  "fileSizeBytes": 123456,
  "uploadPath": "storage/uploads/1713341111111-szafka.step",
  "geometry": {
    "vertices": [],
    "normals": [],
    "indices": []
  },
  "parts": [],
  "note": "To jest pierwszy etap: upload, kolejka i stream postępu są gotowe. Triangulacja STEP zostanie dodana w następnym kroku."
}
```

Następny krok: podpięcie faktycznego backendu CAD do triangulacji i ekstrakcji części.
