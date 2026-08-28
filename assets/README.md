# MCraft Assets

Use `.glb` files for 3D world assets. Each asset can have a `config.json` describing how the world generator may spawn it.

Recommended folders:

- `trees/`
- `water/pond/`
- `water/sea/`
- `water/river/`
- `buildings/`
- `villages/`
- `structures/`
- `rocks/`
- `decorations/`

Example:

```text
assets/trees/oak/model.glb
assets/trees/oak/config.json
```

When the engine is upgraded to the asset loader, replace the placeholder generated geometry with your own Blender `.glb` models.