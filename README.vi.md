# web-clone — xưởng clone theo chuẩn 80/100

> 🇻🇳 Tiếng Việt · [🇬🇧 English](./README.md)

Một [skill của Claude Code](https://claude.com/claude-code) clone **frontend một website đang chạy về đúng stack của repo BẠN** — kể cả màn hình sau đăng nhập — và cho ra code đọc như chính repo bạn viết, chứ không phải bản chép lại DOM của site gốc.

Được thiết kế và "đánh trận" trên `exam.flyer.us` (site Vue có đăng nhập) cho một repo Next.js 16 / TypeScript strict / Tailwind v4 / shadcn-ui. Bản thân quy trình skill là trung lập với stack; chỉ `scripts/gates.ts` và vài chỗ tham chiếu `.claude/rules/coding.md` giả định repo TS + Tailwind.

---

## "80/100" nghĩa là gì (triết lý lõi)

| Nguyên tắc | Ý nghĩa |
|---|---|
| **~80% độ giống thị giác** | Đủ gần để không ai phải nhìn lần hai. Không gần hơn — pixel-perfect bị loại khỏi phạm vi một cách có chủ đích. |
| **100% code idiom** | Output pass lint của bạn, gates cấu trúc của bạn, quy ước component của bạn. Ưu tiên tái sử dụng (shadcn/ui / component sẵn có) hơn là copy CSS tự viết. |
| **Budget thắng fidelity** | Route vượt budget JS (mặc định < 300 KB gzip) ⇒ giảm trọng lượng animation và độ giống — không bao giờ đánh đổi ngược lại. |
| **Máy hơn lời hứa** | Thứ gì máy kiểm tra được là HARD GATE (`scripts/gates.ts`), không bao giờ chỉ là lời khuyên. Terminal xanh, chứ không phải "tôi đã theo đúng quy tắc". |
| **Spec trước code** | Không section nào được build khi chưa có spec được duyệt. Không ngoại lệ. |
| **Pixel-diff = cảm biến, không phải gate** | `visual-diff.mjs` chỉ cho mắt người biết NHÌN ĐÂU (cụm lệch, vùng nghi ngờ trống). Phán quyết 80% thuộc về con người. |

## Tầng media (tính năng đợt 2026-08)

Phần đa số công cụ clone làm sai: media về **đầy đủ** và **hiểu được**.

```
capture ──► stage ──────► name ──────────► promote ──────► build ──► sense ──► fix
(orchestrator) (download)  (AI ở Phase 2)   (promote)               (visual-diff)
```

1. **Capture TOÀN BỘ** — `orchestrator.mjs` đi qua mọi route × trạng thái tương tác × viewport, ghi lại *mọi network request* (sự kiện Playwright) **∪** *quét media từ DOM* (img/srcset/picture/video/audio/poster/inline SVG/background-image tính toán kể cả `::before`/`::after`/@font-face qua CSSOM). Asset lazy-load, background, font, video, JSON Lottie — tất cả đều về.
2. **Stage một lần** — `download.mjs` là một pass *riêng*, replay `storageState` của lần crawl (asset CDN sau đăng nhập vẫn tải được) vào **kho băm theo nội dung**: `_webclone/staging/{hash2}/{sha256}.{ext}`. Một file cho một asset duy nhất, dedup xuyên suốt các route. sha256 là định danh ổn định — đổi tên slot không bao giờ phải tải lại.
3. **Đặt tên ngữ nghĩa** — script không bao giờ tự đặt tên. Script chỉ ghi evidence thô cho từng item: route, states, tag, CSS selector, toạ độ box trên trang, alt, section gần nhất, kích thước natural, bytes/content-type từ network. AI (hoặc người) đọc `media-index.md` được sinh tự động rồi viết `media-selections.json` với **tên slot ngữ nghĩa** — `hero-main`, `practice-card-thumb` — không bao giờ "ảnh thứ 3 trong div thứ 7".
4. **Ship có chọn lọc** — capture-all ≠ ship-all. `promote.mjs` chỉ copy những slot spec đã duyệt vào `public/clone-assets/{route}/{slot}.{ext}` (chính filesystem là manifest khi ship) và cảnh báo từng route khi vượt 300 KB.
5. **Cảm biết lỗ hổng** — `visual-diff.mjs` gom lệch pixel thành các cụm có toạ độ trang và đánh dấu **vùng nghi ngờ render trống** (bản clone phẳng lừ nơi bản gốc có kết cấu = khả năng thiếu media slot). Mỗi cụm đối chiếu được với box trong `media.json` của route, nên một "lỗ" được chẩn đoán deterministic: *thiếu selection / promote lỗi / TODO đã chấp nhận*.

Slot media không có asset nào thu được sẽ render **placeholder `TODO` có đánh dấu** — không bao giờ bị thay im lặng bằng icon chế ra (lỗi class D).

## Pipeline (chặt chẽ, một phase một lúc)

| Phase | Việc gì xảy ra | Tài liệu |
|---|---|---|
| **0 Setup** | cài deps, chromium cho Playwright, browser MCP, `.env` credentials, gitignore, smoke test | `references/phase-0-setup.md` |
| **1 Recon** | MCP khám phá/đăng nhập/phân loại màn hình → `routes.json` (kèm trạng thái tương tác) → `orchestrator.mjs` capture → `download.mjs` stage + sinh `media-index.md` | `references/phase-1-recon.md` |
| **2 Design Model** | design tokens + một spec mỗi section (ý đồ layout, ánh xạ component, state 3 tầng, loại effect, request budget) + **media selections** (đặt tên slot). PR cho người duyệt — rồi đóng băng | `references/phase-2-design-model.md` |
| **3 Build** | nền trước (tokens → promote media → primitive shadcn → inventory dùng chung → motion primitive → mocks), sau đó N builder theo section trong git worktree cách ly | `references/phase-3-build.md` |
| **4 Assembly** | thứ tự merge deterministic, chạy gates sau mỗi lần merge, nối ROUTES/sitemap/metadata | `references/phase-4-assembly.md` |
| **5 QA** | hard gates → quét tương tác → báo cáo cảm biến visual-diff → album song song cho người phán 80% | `references/phase-5-qa.md` |

## Danh mục script

Script harvest là **`.mjs` chạy độc lập** — `node` thuần, không build step, không deps ngoài Playwright. Kiểm chứng là TypeScript (`gates.ts`) chạy bằng `tsx` của repo bạn.

| Script | Việc nó làm |
|---|---|
| `scripts/orchestrator.mjs` | Pass capture CHÍNH. Mỗi route × state × viewport: settle (quét scroll), ghi lại mọi request, quét media DOM, screenshot/HTML/text, screenshot chuỗi state. Ra từng route `media.json`, `storage-state.json`, `recon.json` |
| `scripts/download.mjs` | Pass tải riêng, có auth → kho sha256 → ghi chú ngược vào `media.json` → sinh lại `media-index.md` |
| `scripts/promote.mjs` | Đưa `media-selections.json` vào ship → `public/clone-assets/{route}/{slot}.{ext}` + `manifest.json`; cảnh báo bytes từng route |
| `scripts/visual-diff.mjs` | Cảm biến chẩn đoán: diff pixel canvas → cụm lệch (toạ độ trang) + heuristic render-trống → JSON + PNG diff + báo cáo markdown |
| `scripts/network-capture.mjs` | Bắt fixture XHR/fetch (nguồn mock-data cho API của SPA) |
| `scripts/interaction-probe.mjs` | Tự động quét scroll/hover/click an toàn/kéo canvas kèm bằng chứng đổi trạng thái — cho màn hình chưa rõ |
| `scripts/sourcemap-hunt.mjs` | Tìm + tải source map từ các URL script đã ghi nhận |
| `scripts/gates.ts` | Các lệnh cấm cấu trúc class A, A1–A8 (arbitrary variants, inline style, độ dài file, nesting, reuse-first, animation chỉ transform/opacity, reduced-motion, màu chỉ qua token) |

### routes.json — kế hoạch crawl (output Phase 1)

```json
[
  { "slug": "home", "path": "/", "auth": true, "type": "static" },
  { "slug": "practice", "path": "/practice", "auth": true, "type": "static",
    "states": [
      { "name": "tab-missions", "action": "click", "selector": "button:has-text('Nhiệm vụ')" }
    ] }
]
```

**Khóa slot = route × state.** Một trang là một chuỗi trạng thái — media chỉ xuất hiện sau khi bấm tab sẽ được thu dưới đúng state đó, nên manifest không bao giờ "nói dối" bằng cách gộp nhiều state vào một bucket.

### Dạng một item trong media.json (evidence thô)

```json
{
  "url": "https://cdn.site/hero.webp",
  "kind": "image",
  "states": ["initial"],
  "dom": { "tag": "img", "selector": "main > section:nth-of-type(1) > img", "box": { "x": 0, "y": 96, "w": 1440, "h": 520 },
            "naturalW": 2880, "naturalH": 1040, "alt": "Hero illustration", "inSection": "Luyện tập", "origin": "attr" },
  "network": { "status": 200, "resourceType": "image", "contentType": "image/webp", "bytes": 184320 },
  "hash": "ab12…", "localPath": "_webclone/staging/ab/ab12….webp"
}
```

## Cấu trúc thư mục sau khi cài vào repo

```
your-repo/.claude/skills/web-clone/
├── SKILL.md                    # entry point Claude nạp
├── references/                 # playbook từng phase, nạp theo nhu cầu
│   ├── phase-0-setup.md … phase-5-qa.md
│   ├── failure-gates.md        # 4 class lỗi (A/B/C/D) + bảng gates
│   ├── animation-matrix.md     # bảng quyết định loại effect → công nghệ (CSS-first)
│   ├── assessment.md           # độ phức tạp L1–L6 + chấm điểm sau clone
│   └── effect-extraction.md    # kỷ luật bằng chứng (SOURCE/PARTIAL/GUESS) + baseline gate cho WebGL/Canvas
├── scripts/                    # công cụ harvest .mjs + gates.ts
│   └── lib/playwright-loader.mjs
└── templates/                  # khung design-tokens.json, section-spec.md

# output khi chạy (trong repo bạn)
_webclone/captures/    # screenshot, HTML, media.json từng route, media-index.md   (git-ignore)
_webclone/staging/     # kho media sha256                                          (git-ignore)
_webclone/design-model/# tokens, spec từng section, media-selections.json, chunks.md  (ĐƯỢC COMMIT — duyệt qua PR)
_webclone/album/       # trang so sánh gốc–clone                                   (git-ignore)
public/clone-assets/   # file slot đã promote + manifest.json                      (ĐƯỢC COMMIT)
```

## Cài đặt

1. Copy thư mục này vào `<your-repo>/.claude/skills/web-clone/`.
2. Đảm bảo repo có Playwright: `npm i -D playwright && npx playwright install chromium`.
3. Thêm vào `.gitignore`:
   ```
   _webclone/captures/
   _webclone/staging/
   _webclone/album/
   ```
4. Tạo `.env` (git-ignore) — credentials KHÔNG BAO GIỜ in ra, log, hay commit:
   ```
   CLONE_TARGET_URL=https://example.com
   CLONE_LOGIN_PHONE=…        # tuỳ chọn — bỏ qua nếu chỉ capture phần public
   CLONE_LOGIN_PASSWORD=…
   ```
5. **Verify các selector `LOGIN`** ở đầu `scripts/orchestrator.mjs` với form đăng nhập của target (chúng mang dấu `// VERIFY` — đây là đoạn code duy nhất trong script gắn với target cụ thể).
6. Với gates TS: `npm i -D tsx` và script package.json `"gates": "tsx .claude/skills/web-clone/scripts/gates.ts"` (điều chỉnh A1–A8 theo quy ước repo nếu stack khác).

### Một lần chạy điển hình

```bash
# Phase 1 — sau khi viết routes.json từ exploration bằng MCP:
node .claude/skills/web-clone/scripts/orchestrator.mjs
node .claude/skills/web-clone/scripts/download.mjs

# Phase 2 — AI đặt tên slot từ index, viết media-selections.json, specs, PR…

# Phase 3 — dispatcher promote media một lần, rồi các builder làm trong worktree:
node .claude/skills/web-clone/scripts/promote.mjs

# Phase 5 — báo cáo cảm biến mỗi màn hình:
node .claude/skills/web-clone/scripts/visual-diff.mjs \
  --original _webclone/captures/home/desktop.png --clone <clone-shot.png> \
  --out _webclone/captures/home/diff.json --diff _webclone/captures/home/diff.png \
  --report _webclone/captures/home/diff.md
```

## Các class lỗi skill này tồn tại để ngăn

| Class | Bệnh | Thực thi |
|---|---|---|
| **A** | Chép / phạm DRY (build lại cái đã có, arbitrary variants, inline style, nesting sâu) | HARD gates A1–A8 trong `gates.ts` |
| **B** | Kiến trúc nửa vời (state không khai báo, thiếu validation) | SOFT ở spec (Phase 2 từ chối) + HARD ở review 2 tầng |
| **C** | Giảm chất lượng âm thầm (sót a11y, `any`, nợ lint) | HARD: jsx-a11y + lint + tsc sạch |
| **D** | Chế media (đ substitute icon vào chỗ thiếu asset) | SOFT: spec phải ánh xạ mọi bề mặt vào slot; HARD: các TODO được liệt kê, mọi cụm "nghi trống" từ cảm biến đều được giải trình |

## Nguồn gốc & quyết định thiết kế

- **Quy trình** (phases, gates, specs, builder worktree): xây 17–18/08/2026 cho repo `english-learning-app-fe`.
- **Công cụ harvest**: chuyển thể từ `claude-skill-web-clone` v1.6 mã nguồn mở của jane/xiaoer (giữ và port 4 script: network-capture, interaction-probe, sourcemap-hunt, visual-diff; bỏ 4 script ngoài mục tiêu 80/100: init-clone, dna-scaffold, mirror-site, audit-clone). Upstream không có file LICENSE — attribution được giữ lại ở đây một cách có chủ đích; đừng trình bày fork này như tác phẩm của upstream.
- **Tầng media + việc gộp skill**: hội tụ qua 2 buổi brainstorm BMAD ngày 19/08/2026 (manifest slot-first, capture-all/ship-select, kho hash, sensor-not-gate). Hồ sơ quyết định đầy đủ: `brain-webclone-media-manifest-2026-08-19/brainstorm-intent.md` trong workspace gốc.
- **Chưa kiểm chứng thực tế**: selector đăng nhập (`// VERIFY`) và bộ từ vựng `states[]` được viết riêng cho từng target ở Phase 1 — tầng này đã pass kiểm tra cú pháp/khởi động (`node --check`, `--help`) nhưng lần chạy thật đầu tiên là milestone tiếp theo.

## Bản quyền

Chưa tuyên bố — mặc định giữ toàn bộ quyền. Attribution upstream ở trên áp dụng cho các script đã port. Quyết định license trước khi phân phối.
