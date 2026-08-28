import json
import re
import ssl
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


# ==========================================
# 경로 설정
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "public" / "data" / "stocks"


# ==========================================
# SSL 인증서 검증 우회
# ------------------------------------------
# 현재 회사 PC 테스트용
#
# GitHub Actions에서는 나중에 제거 예정
# ==========================================

SSL_CONTEXT = ssl._create_unverified_context()


# ==========================================
# 대상 시장
# ==========================================

MARKETS = [
    {"marketType": "stockMkt", "label": "KOSPI"},
    {"marketType": "kosdaqMkt", "label": "KOSDAQ"},
]

TICKER_CODE_PATTERN = re.compile(r"^\d{6}$")


def fetch_market(market_type):
    url = (
        "https://kind.krx.co.kr/corpgeneral/corpList.do"
        f"?method=download&marketType={market_type}"
    )

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0"}
    )

    with urllib.request.urlopen(
        request,
        timeout=30,
        context=SSL_CONTEXT
    ) as response:

        raw = response.read()

    return raw.decode("euc-kr", errors="replace")


def parse_rows(html):
    rows = re.findall(r"<tr>([\s\S]*?)</tr>", html)
    items = []

    for row in rows:
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row)

        if len(cells) < 3:
            continue

        name = re.sub(r"<[^>]+>", "", cells[0]).strip()
        ticker = re.sub(r"<[^>]+>", "", cells[2]).strip()

        if not name or not TICKER_CODE_PATTERN.match(ticker):
            continue

        items.append({"ticker": ticker, "name": name})

    return items


# ==========================================
# 안내
# ==========================================

print()
print("=" * 60)
print("상장기업 목록 갱신")
print("=" * 60)


# ==========================================
# 시장별 처리
# ==========================================

all_items = []

for market in MARKETS:

    print()
    print(f"조회 시작 : {market['label']}")

    html = fetch_market(market["marketType"])
    items = parse_rows(html)

    for item in items:
        item["market"] = market["label"]

    print(f"조회된 종목 : {len(items):,}개")

    all_items.extend(items)


# ==========================================
# 중복 제거 및 정렬
# ==========================================

seen = set()
deduped = []

for item in all_items:
    if item["ticker"] in seen:
        continue
    seen.add(item["ticker"])
    deduped.append(item)

deduped.sort(key=lambda x: x["name"])

print()
print(f"전체 종목 : {len(deduped):,}개")


# ==========================================
# 저장
# ==========================================

DATA_DIR.mkdir(parents=True, exist_ok=True)

output_file = DATA_DIR / "list.json"

result = {
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "count": len(deduped),
    "items": deduped
}

with open(output_file, "w", encoding="utf-8", newline="\n") as file:
    json.dump(result, file, ensure_ascii=False, indent=2)

print()
print(f"저장 : {output_file}")

print()
print("=" * 60)
print("완료")
print("=" * 60)
print()
