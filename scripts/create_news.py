import json
import re
import ssl
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from xml.etree import ElementTree


# ==========================================
# 경로 설정
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "public" / "data" / "news"


# ==========================================
# SSL 인증서 검증 우회
# ------------------------------------------
# 현재 회사 PC 테스트용
#
# GitHub Actions에서는 나중에 제거 예정
# ==========================================

SSL_CONTEXT = ssl._create_unverified_context()


# ==========================================
# 피드 설정
# ==========================================

FEED_URL = "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko"

MAX_ITEMS = 30


# ==========================================
# 안내
# ==========================================

print()
print("=" * 60)
print("주요 뉴스 갱신")
print("=" * 60)

print(f"피드 URL : {FEED_URL}")


# ==========================================
# RSS 요청
# ==========================================

request = urllib.request.Request(
    FEED_URL,
    headers={
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/rss+xml, application/xml"
    }
)

with urllib.request.urlopen(
    request,
    timeout=30,
    context=SSL_CONTEXT
) as response:

    xml_bytes = response.read()


# ==========================================
# XML 파싱
# ==========================================

root = ElementTree.fromstring(xml_bytes)

raw_items = root.findall("./channel/item")

print(f"조회된 항목 : {len(raw_items):,}건")


# ==========================================
# 항목 정리
# ==========================================

TITLE_SOURCE_SUFFIX = re.compile(r"\s+-\s+[^-]+$")

items = []

for raw_item in raw_items[:MAX_ITEMS]:

    title = (raw_item.findtext("title") or "").strip()

    link = (raw_item.findtext("link") or "").strip()

    source_el = raw_item.find("source")

    source_name = (
        source_el.text.strip()
        if source_el is not None and source_el.text
        else None
    )

    # 제목 끝의 " - 매체명" 표기를 제거 (source는 별도 필드로 표시)
    if source_name and title.endswith(f" - {source_name}"):
        title = title[: -len(f" - {source_name}")].strip()
    elif not source_name:
        title = TITLE_SOURCE_SUFFIX.sub("", title)

    pub_date_text = raw_item.findtext("pubDate")

    published = None

    if pub_date_text:
        try:
            published = (
                parsedate_to_datetime(pub_date_text)
                .astimezone(timezone.utc)
                .isoformat()
            )
        except (TypeError, ValueError):
            published = None

    if not title or not link:
        continue

    items.append({
        "title": title,
        "link": link,
        "source": source_name,
        "published": published
    })


print(f"저장할 항목 : {len(items):,}건")


# ==========================================
# 저장
# ==========================================

DATA_DIR.mkdir(parents=True, exist_ok=True)

output_file = DATA_DIR / "latest.json"

result = {
    "source": "Google News (KR)",
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "items": items
}

with open(output_file, "w", encoding="utf-8") as file:
    json.dump(result, file, ensure_ascii=False, indent=2)

print()
print(f"저장 : {output_file}")

print()
print("=" * 60)
print("뉴스 갱신 완료")
print("=" * 60)
print()
