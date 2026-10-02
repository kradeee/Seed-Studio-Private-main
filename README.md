<div align="center">

# 🌱 SEED STUDIO

### Build the Minecraft world you actually want to play.

**Explore, compose and discover Minecraft Java Edition seeds through an interactive map, structure filters and a real first-person world preview.**

[![Minecraft Java](https://img.shields.io/badge/Minecraft-Java%20Edition-62B47A?style=for-the-badge&logo=minecraft&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-654FF0?style=for-the-badge&logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Tests](https://img.shields.io/github/actions/workflow/status/kradeee/Seed-Studio-Private-main/test.yml?style=for-the-badge&label=engine%20tests)](https://github.com/kradeee/Seed-Studio-Private-main/actions)

</div>

---

![Seed Studio landscape](public/landscape.webp)

## What is Seed Studio?

Most Minecraft seed tools start with a number and tell you what is inside it.

**Seed Studio works the other way around.**

You describe the world you want, choose biomes, structures, dimensions and generation preferences, then explore seeds that match those constraints.

It combines a fast browser-based world engine with an interactive map and an optional local Minecraft preview service, so a seed can go from **search result → map → actual first-person world** without leaving the project.

## ✨ Highlights

<table>
<tr>
<td width="50%" valign="top">

### 🗺️ Interactive world map

- Pan, zoom and pinch navigation
- Overworld, Nether and End
- Biome visualization at multiple heights
- Chunk grid and slime chunks
- Visible biome legend
- Shareable map URLs

</td>
<td width="50%" valign="top">

### 🔎 Seed search

- Required and excluded biomes
- Up to 8 structure constraints
- Spawn-island searches
- Nether and End criteria
- Large Biomes support
- Parallel seed evaluation

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🏰 Structure explorer

Villages, ancient cities, trial chambers, strongholds, fortresses, bastions, monuments, woodland mansions, ruined portals, End cities and many more.

Structure details can include variants, portal eyes, End ships, blaze spawners and ready-to-copy `/tp` commands.

</td>
<td width="50%" valign="top">

### 👁️ First-person preview

Generate a real Minecraft Java world locally and inspect the area around spawn directly from Seed Studio using the optional preview service and Prismarine Viewer.

Currently supported by the preview service:

- Java 1.21.1
- Java 1.21.4

</td>
</tr>
</table>

## 🧠 How it works

Seed Studio uses **Cubiomes / Seeder logic compiled to WebAssembly** for fast seed and biome calculations directly in the browser.

```text
Your world criteria
        ↓
Seed search engine
        ↓
Cubiomes / WebAssembly
        ↓
Interactive world map
        ↓
Optional real Minecraft preview
```

The browser map does not need a remote Minecraft server for normal exploration. The optional first-person preview is separate and runs locally because generating an actual Minecraft world is, unsurprisingly, slightly heavier than drawing some colored squares on a map.

## 🚀 Quick start

### Requirements

- Node.js 22+
- npm

Clone the repository and install the dependencies:

```bash
git clone https://github.com/kradeee/Seed-Studio-Private-main.git
cd Seed-Studio-Private-main
npm install
npm run dev
```

Then open the local address printed by the development server.

### Production build

```bash
npm run build
```

## 👁️ First-person Minecraft preview

The first-person preview is optional and lives in [`preview-service/`](preview-service/).

It requires **Java 21** and runs alongside the web app.

For the complete setup, EULA step and troubleshooting guide, read:

### → [PRIMO_AVVIO_PREVIEW.md](PRIMO_AVVIO_PREVIEW.md)

The preview service downloads the official Minecraft server JAR when required, generates a temporary world for the selected seed and exposes the spawn area to the embedded viewer.

Generated worlds, downloaded JARs and local service data are intentionally excluded from Git.

## 🧱 Main project structure

```text
Seed-Studio-Private-main/
├── app/                    # App entry points and global styles
├── components/studio/      # Main Seed Studio UI
│   ├── Studio.tsx
│   ├── Composer.tsx
│   ├── WorldMap.tsx
│   └── MinecraftPreview.tsx
├── public/engine/          # WebAssembly seed / biome engine
├── preview-service/        # Local real-world Minecraft preview
├── engine/                 # Engine build and version tooling
├── tests/                  # Engine verification tests
├── scripts/                # Build and development helpers
└── .github/workflows/      # Tests and engine rebuild automation
```

## ⚙️ Engine verification

Run the engine tests with:

```bash
npm run test:engine
```

The test suite checks known in-game positions and verifies structure calculations across multiple seeds and Minecraft versions.

GitHub Actions runs the engine tests automatically on pushes.

## 🔄 Updating the Minecraft engine

The WebAssembly engine can be rebuilt from Cubiomes.

On GitHub:

```text
Actions → Rebuild engine → Run workflow
```

The workflow downloads Cubiomes, compiles the engine with Emscripten, runs the verification suite and can prepare an update when upstream generation logic changes.

The exact Cubiomes revision used by the current engine is recorded in:

[`public/engine/ENGINE_VERSION.txt`](public/engine/ENGINE_VERSION.txt)

## 🧪 Verification data

Seed Studio includes known positions that can be checked directly in Minecraft using `/locate` and related commands.

See:

- [`VERIFICA.md`](VERIFICA.md) — in-game verification data
- [`PREVIEW_VERIFICA.md`](PREVIEW_VERIFICA.md) — preview checks
- [`README_SEED_STUDIO.md`](README_SEED_STUDIO.md) — extended technical notes

## 🛠️ Tech stack

- **TypeScript**
- **React**
- **Vinext / Vite**
- **WebAssembly**
- **Cubiomes / Seeder**
- **Prismarine Viewer**
- **Node.js**
- **GitHub Actions**

## 🧭 Project direction

Seed Studio is being developed toward a simple goal:

> **Don't hunt through random Minecraft seeds. Describe your ideal world and find it.**

Planned areas of work include improving the seed composer, richer result ranking, more visual world previews, better mobile interaction and expanding the real-world preview experience.

---

<div align="center">

### 🌱 Seed Studio

**Compose. Search. Explore. Spawn.**

Made for Minecraft players who have spent far too long typing random numbers into world creation screens.

<sub>Minecraft is a trademark of Microsoft / Mojang Studios. Seed Studio is an independent project and is not affiliated with or endorsed by Mojang Studios or Microsoft.</sub>

</div>
