import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { socialSVG } from "../src/mandats/sharing.ts";
import { lirePolices, rasteriser } from "./rasteriser.ts";
const directory = fileURLToPath(new URL("../dist/mandats/", import.meta.url));
await mkdir(directory, { recursive: true });
await writeFile(`${directory}og.png`, await rasteriser(socialSVG(null), await lirePolices()));

const icon = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#09151b"/><circle cx="256" cy="256" r="158" fill="#17323a" stroke="#e8c69b" stroke-width="5"/><path d="M157 338V187H193L256 266L319 187H355V338H317V251L256 320L195 251V338Z" fill="#e8c69b"/></svg>`;
for (const size of [192,512]) await writeFile(`${directory}icon-${size}.png`, await rasteriser(icon(size),await lirePolices()));
