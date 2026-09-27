# OneTake Mocap (Unity package)

## Install

- Local (recommended while developing): Package Manager → **+** → **Add package from disk…** → pick this folder's `package.json`. Unity then writes `.meta` files here — commit them.
- From git (after `.meta` files are committed): Package Manager → **+** → **Add package from git URL…** → `https://github.com/<owner>/<repo>.git?path=/unity/com.onetake.mocap`

## Use

1. Put OneTake FBX files (with their `.onetake.json` sidecars) under `Assets/OneTake/`. They import as Humanoid with clip name and loop settings applied.
2. Drag a clip onto any Humanoid character's Animator Controller state and tick **Foot IK** on that state.
