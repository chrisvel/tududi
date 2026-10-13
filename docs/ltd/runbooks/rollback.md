# برگشت نسخه

## قاعده

تصویر و همان snapshot پایگاه که درست پیش از به‌روزرسانی گرفته شد، با هم برمی‌گردند. **برگرداندن تصویر به‌تنهایی ممنوع است.** migrationها هنگام شروع اجرا می‌شوند و برگشت‌پذیر نیستند؛ تصویر قدیم روی پایگاهِ migrate‌شده یا بالا نمی‌آید یا داده را بد می‌خواند.

## خودکار: `deploy.sh`

```bash
./deploy.sh 1.2.3
```

| وضعیت | چه می‌کند | خروج |
| --- | --- | --- |
| بکاپ پیش از به‌روزرسانی ساخته نشد | هیچ چیز را عوض نمی‌کند، برنامه را نمی‌ایستاند | ۲ |
| نسخهٔ تازه pull نشد یا `ready` نشد | فایل‌های زنده (با WAL و SHM) به `data/failed-*` می‌روند، snapshot جای پایگاه می‌نشیند، شناسهٔ تصویر قبلی دوباره tag و با `--pull never` روشن می‌شود | ۱ |
| snapshot پیش از برگشت پاک شده | برنامه ایستاده می‌ماند، فایل‌های زنده سر جایشان می‌مانند، تصویر برنمی‌گردد | ۱ |

خروج ۱ یعنی به‌روزرسانی شکست خورد، حتی اگر برگشت سالم بود. نوشته‌های بین snapshot و شکست در `data/failed-*` برای بررسی می‌مانند و replay نمی‌شوند.

درستی این رفتار بدون سرور و بدون Docker امتحان می‌شود:

```bash
bash scripts/test-deploy.sh
```

## دستی

وقتی `deploy.sh` برنامه را ایستاده رها کرد یا به‌روزرسانی دستی بود:

```bash
cd /srv/life-to-day
previous=1.2.2                                   # نسخهٔ پیش از به‌روزرسانی
snapshot=data/backups/ltd-YYYYMMDDTHHMMSSZ.sqlite3  # همان که deploy.sh چاپ کرد
[ -s "$snapshot" ] || { echo "snapshot نیست: برنگرد" >&2; exit 1; }
compose="docker compose -f docker-compose.yml --env-file .env --env-file .env.version --profile production"

$compose stop app
failed="data/failed-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$failed"
for f in data/db/production.sqlite3 data/db/production.sqlite3-wal data/db/production.sqlite3-shm; do
    [ -f "$f" ] && mv "$f" "$failed/"
done
cp "$snapshot" data/db/production.sqlite3
printf 'LTD_VERSION=%s\n' "$previous" > .env.version
$compose up -d --no-build --pull never --scale app=1 app
curl -fsS "https://${LTD_DOMAIN}/api/health/ready"
```

اگر snapshot همان لحظهٔ پیش از به‌روزرسانی پیدا نمی‌شود، برنگرد. برنامه را ایستاده نگه دار و از [restore-sqlite.md](restore-sqlite.md) با آگاهی از دادهٔ از دست رفته تصمیم بگیر.
