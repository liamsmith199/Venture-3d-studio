# Handoff Manifest Schema

`model-manifest.json` describes the contents of `Venture_3D_Confirmed_Handoff.zip`.

**Current `schemaVersion`:** `venture3d.handoff/1.0`

Readers should check `schemaVersion` first. Fields may be added within 1.x, but removing or changing the meaning of a field requires version 2.0.

## Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | string | Always `venture3d.handoff/1.0` for this version |
| `projectName` | string | Student's project name |
| `modelName` | string | Name of the model |
| `modelType` | string | `physical-product`, `brand-mascot`, `merchandise`, `service-environment` or `symbolic-object` |
| `modelVersion` | integer | Starts at 1 and rises with each confirmation of the project |
| `confirmedAt` | string | ISO 8601 UTC timestamp |
| `generator` | string | `Venture 3D Studio` |
| `description` | string | Product or brand description |
| `sourceNote` | string | Where the geometry came from |
| `dimensions` | object | `width`, `height`, `depth` and `unit` (`cm`), measured from the reloaded GLB, plus `center` in metres |
| `coordinateSystem` | object | `up: +Y`, `front: +Z`, `units: metres` |
| `camera` | object | Preferred view: `projection`, `position` and `target` (metres, in GLB space), `fovDegrees` |
| `scene` | object | `backgroundTop`, `backgroundBottom`, `lighting`, `lightingLabel`, `lightIntensity`, `shadows` |
| `hotspots` | array | Optional features: `id`, `label`, `description`, `part`, and `position` (metres, or null) |
| `stats` | object | `meshes`, `triangles`, `embeddedImages` |
| `files` | object | `model`, `project` and `preview`, each with a relative `path`, `bytes` and `sha256`; `readme` has `path` only |

## Example

```json
{
  "schemaVersion": "venture3d.handoff/1.0",
  "projectName": "My Venture Project",
  "modelName": "Doctor Mascot",
  "modelType": "brand-mascot",
  "modelVersion": 1,
  "confirmedAt": "2026-11-04T12:00:00.000Z",
  "dimensions": { "width": 53.1, "height": 120, "depth": 37.2, "unit": "cm" },
  "camera": { "projection": "perspective", "position": [0.5, 0.8, 3.2], "target": [0, 0.6, 0], "fovDegrees": 35 },
  "files": {
    "model": { "path": "model.glb", "bytes": 3500000, "sha256": "..." },
    "readme": { "path": "README.txt" }
  }
}
```

The numbers above are illustrative, and some fields are left out for length.

## Checking integrity

Hash `model.glb` with SHA-256 and compare the result to `files.model.sha256`. The manifest cannot list a checksum of itself. The README is plain instructions and has no checksum.

## project.json

`project.json` is an editable snapshot with the schema `venture3d.project/1`. It includes all parts, images, saved versions, and the immutable `confirmed` history, which is separate from the parts still being edited.
