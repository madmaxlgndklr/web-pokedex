# PokeAPI Nginx Static Asset Serving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve custom local sprite assets (3D GIFs, Gen 1 retro sprites, Gen 5 DS animations) through the self-hosted PokeAPI nginx instance so both web and Android clients can load them by URL.

**Architecture:** Add a bind-mount of `/home/madmaxlgndklr/Git/Assets` into the nginx container at `/assets`. Add a single `location /assets/` block that serves the directory tree as static files with caching and CORS headers. No Django/app container changes — nginx serves files directly from the host filesystem.

**Tech Stack:** nginx 1.27 (alpine), docker-compose bind mount, existing PokeAPI stack at `/home/madmaxlgndklr/Git/sandbox/pokeapi`

---

## File Map

| File | Change |
|---|---|
| `docker-compose.yml` | Add bind mount `~/Git/Assets:/assets:ro` to `web` service volumes |
| `Resources/nginx/nginx.conf` | Add `location /assets/` static-serving block inside the server block |

## Asset URL Scheme (clients use these to construct requests)

| Mode | URL Pattern | Valid ID range |
|---|---|---|
| Modern GIF | `https://madmaxlgndklrpokeapi.com/assets/pokemon_generation_{gen}_gifs/{name}.gif` | Gen 1–8 |
| Retro (Gen 1/2) | `https://madmaxlgndklrpokeapi.com/assets/pokemon_gen1sprites/crystal-jp-{padded3}.png` | IDs 1–251 |
| DS Anim (Gen 5) | `https://madmaxlgndklrpokeapi.com/assets/pokemon_gen5_anim_sprites/{padded3}.gif` | IDs 1–649 |

Where `{gen}` is 1–8 (the Pokémon's home generation derived from its ID), `{padded3}` is the ID zero-padded to 3 digits (e.g. `001`), and `{name}` is the Pokémon's lowercase hyphenated name as returned by PokeAPI (e.g. `bulbasaur`, `mr.-mime`). Files not present in an asset folder return 404; clients must fall back to the GitHub CDN sprite on error.

---

### Task 1: Add asset bind mount to docker-compose web service

**Files:**
- Modify: `/home/madmaxlgndklr/Git/sandbox/pokeapi/docker-compose.yml`

- [ ] **Step 1: Add the volume line**

The `web` service volumes block currently reads:
```yaml
volumes:
  - ./Resources/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./Resources/nginx/ssl:/ssl:ro
  - graphql_cache:/tmp/cache
```

Change it to:
```yaml
volumes:
  - ./Resources/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
  - ./Resources/nginx/ssl:/ssl:ro
  - graphql_cache:/tmp/cache
  - /home/madmaxlgndklr/Git/Assets:/assets:ro
```

- [ ] **Step 2: Validate compose file syntax**

Run: `docker compose -f /home/madmaxlgndklr/Git/sandbox/pokeapi/docker-compose.yml config --quiet`
Expected: exits 0 with no output.

- [ ] **Step 3: Commit**

```bash
cd /home/madmaxlgndklr/Git/sandbox/pokeapi
git add docker-compose.yml
git commit -m "feat: mount local Assets directory into nginx for sprite serving"
```

---

### Task 2: Add nginx location block for /assets/

**Files:**
- Modify: `/home/madmaxlgndklr/Git/sandbox/pokeapi/Resources/nginx/nginx.conf`

- [ ] **Step 1: Add the location block**

Inside the `server { ... }` block in `nginx.conf`, add the following **after** the `location /api/` block and **before** `location / { return 404; }`:

```nginx
location /assets/ {
    alias /assets/;
    expires 30d;
    add_header Cache-Control "public";
    add_header Access-Control-Allow-Origin * always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
}
```

The final ordering of location blocks inside the server block should be:
1. `/v1beta2/admin/`
2. `/v1beta2/console`
3. `/v1beta2`
4. `/api/`
5. `/assets/`   ← new
6. `/` (return 404)

- [ ] **Step 2: Commit**

```bash
cd /home/madmaxlgndklr/Git/sandbox/pokeapi
git add Resources/nginx/nginx.conf
git commit -m "feat: add /assets/ location block for static sprite serving"
```

---

### Task 3: Restart and smoke-test

**Files:** None

- [ ] **Step 1: Recreate the web service**

Run: `docker compose -f /home/madmaxlgndklr/Git/sandbox/pokeapi/docker-compose.yml up -d --no-build web`
Expected: `Container pokeapi-web-1 Recreated` (or Started).

- [ ] **Step 2: Test nginx config syntax inside the running container**

Run: `docker compose -f /home/madmaxlgndklr/Git/sandbox/pokeapi/docker-compose.yml exec web nginx -t`
Expected: `nginx: configuration file /etc/nginx/nginx.conf syntax is ok` and `nginx: configuration file /etc/nginx/nginx.conf test is successful`

- [ ] **Step 3: Smoke-test retro sprite**

Run: `curl -sI "https://madmaxlgndklrpokeapi.com/assets/pokemon_gen1sprites/crystal-jp-001.png"`
Expected: status `200`, `content-type: image/png`, `cache-control: public`

- [ ] **Step 4: Smoke-test modern GIF**

Run: `curl -sI "https://madmaxlgndklrpokeapi.com/assets/pokemon_generation_1_gifs/bulbasaur.gif"`
Expected: status `200`, `content-type: image/gif`

- [ ] **Step 5: Smoke-test DS animation**

Run: `curl -sI "https://madmaxlgndklrpokeapi.com/assets/pokemon_gen5_anim_sprites/001.gif"`
Expected: status `200`, `content-type: image/gif`

- [ ] **Step 6: Smoke-test CORS header**

Run: `curl -sI -H "Origin: https://web-pokedex.vercel.app" "https://madmaxlgndklrpokeapi.com/assets/pokemon_gen1sprites/crystal-jp-001.png"`
Expected: response includes `access-control-allow-origin: *`

- [ ] **Step 7: Confirm 404 for missing file**

Run: `curl -sI "https://madmaxlgndklrpokeapi.com/assets/does-not-exist.gif"`
Expected: status `404`
