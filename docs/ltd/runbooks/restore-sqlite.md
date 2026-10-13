# بازیابی از بکاپ SQLite

وقتی پایگاه داده خراب شده، داده اشتباه نوشته شده، یا migration بیرون از `deploy.sh` شکسته است. برای برگشت نسخه بعد از به‌روزرسانی، [rollback.md](rollback.md) را ببین.

## قاعده

فایل بکاپ هرگز کنار یک `-wal` یا `-shm` کهنه گذاشته نمی‌شود. SQLite آن WAL را روی فایل تازه replay می‌کند و نتیجه ترکیبی از صفحه‌های قدیم و جدید است. پس اول هر سه فایل زنده کنار می‌روند (پاک نمی‌شوند)، بعد بکاپ کپی می‌شود.

بکاپ‌های `backup.sh` (`data/backups/ltd-*.sqlite3`) و بکاپ‌های شروع برنامه (`/app/db/db-backup-*.sqlite3`) هر دو یک فایل مستقل‌اند و WAL ندارند.

## گام‌ها (میزبان compose)

```bash
cd /srv/life-to-day
compose="docker compose -f docker-compose.yml --env-file .env --profile production"
if [ -f .env.version ]; then compose="$compose --env-file .env.version"; fi

# ۱. اول بکاپ را روی یک کپی دورریختنی امتحان کن؛ پایگاه زنده دست نمی‌خورد.
./restore-drill.sh data/backups/ltd-YYYYMMDDTHHMMSSZ.sqlite3

# ۲. برنامه را بایست. SQLite فقط یک نویسنده دارد.
$compose stop app

# ۳. هر سه فایل زنده را کنار بگذار، پاک نکن.
failed="data/failed-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$failed"
for f in data/db/production.sqlite3 data/db/production.sqlite3-wal data/db/production.sqlite3-shm; do
    [ -f "$f" ] && mv "$f" "$failed/"
done
ls data/db/   # نباید production.sqlite3-wal یا -shm دیده شود

# ۴. بکاپ را جای پایگاه بگذار و برنامه را روشن کن.
cp data/backups/ltd-YYYYMMDDTHHMMSSZ.sqlite3 data/db/production.sqlite3
$compose up -d --no-build --scale app=1 app
curl -fsS "https://${LTD_DOMAIN}/api/health/ready"
```

entrypoint مالک فایل را هنگام شروع درست می‌کند. بعد از `ready`، وارد شو و آخرین کاری را که می‌شناسی ببین.

## چیزهایی که در این فایل نیستند

| چیز | کجاست | اگر نباشد |
| --- | --- | --- |
| پیوست‌ها و آواتارها | `data/uploads` | جدا کپی کن؛ `restic-backup.sh` هر دو را می‌برد |
| کلید امضای OAuth برای MCP | `data/db/ltd-oauth-jwks.json` | دوباره ساخته می‌شود؛ کلاینت‌های OAuth باید دوباره وصل شوند |
| `TUDUDI_SESSION_SECRET` | `.env` | رازهای رمزشده برنمی‌گردند؛ [session-secret.md](session-secret.md) |

اگر بکاپ فقط روی restic است، اول `restic restore` را در یک پوشهٔ خالی بزن و فایل را به `data/backups/` بیاور. بعد از گام ۱ شروع کن.

PostgreSQL این مسیر را ندارد؛ `pg_dump` و بازیابی آن در `docs/backups.md` است.
