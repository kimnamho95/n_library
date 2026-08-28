import json
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
# ------------------------------------------
# Naver 모바일 증권 API는 시가총액순으로 개별 종목을
# 페이지 단위로 제공하며, 우선주도 별도 종목으로 포함됨
# ==========================================

MARKETS = ["KOSPI", "KOSDAQ"]

PAGE_SIZE = 100


def fetch_market(market):
    items = []
    page = 1

    while True:
        url = (
            "https://m.stock.naver.com/api/stocks/marketValue/"
            f"{market}?page={page}&pageSize={PAGE_SIZE}"
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

            data = json.load(response)

        stocks = data.get("stocks", [])

        if not stocks:
            break

        for stock in stocks:
            if stock.get("stockEndType") != "stock":
                continue

            ticker = stock.get("itemCode")
            name = stock.get("stockName")

            if not ticker or not name:
                continue

            items.append({"ticker": ticker, "name": name, "market": market})

        if page * PAGE_SIZE >= data.get("totalCount", 0):
            break

        page += 1

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
    print(f"조회 시작 : {market}")

    items = fetch_market(market)

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
