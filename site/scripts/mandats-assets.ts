import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { socialSVG } from "../src/mandats/sharing.ts";
import { lirePolices, rasteriser } from "./rasteriser.ts";
const directory = fileURLToPath(new URL("../dist/mandats/", import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(`${directory}og.png`, await rasteriser(socialSVG(null), await lirePolices()));

const icon = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0c2029"/><path fill="#f5f0df" d="M88 128h64v216H88z"/><path fill="#b74d31" d="M168 72h64v272h-64z"/><path fill="#b28a35" d="M248 112h64v232h-64z"/><path fill="#f5f0df" d="M328 152h64v192h-64z"/><path fill="#f5f0df" d="M72 360h368v24H72z"/></svg>`;
for (const size of [192,512]) await writeFile(`${directory}icon-${size}.png`, await rasteriser(icon(size),await lirePolices()));
