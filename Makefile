test:
	deno run --check --allow-read --allow-net src/ldpl.ts examples/99bottles.ldpl

build:
	deno bundle --check src/ldpl.ts > lib/ldpl.js
	cp lib/ldpl.js docs/src
