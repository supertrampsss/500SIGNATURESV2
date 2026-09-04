import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { socialSVG } from "../src/mandats/sharing.ts";
import { lirePolices, rasteriser } from "./rasteriser.ts";
const directory = fileURLToPath(new URL("../dist/mandats/", import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(`${directory}og.png`, await rasteriser(socialSVG(null), await lirePolices()));
