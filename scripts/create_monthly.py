# ==========================================
# 필요할때만 실행해서 10년치 월별 평균 데이터를 생성해서 교체해줄수 있음
# ==========================================

import json
import ssl
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path


# ==========================================
# 경로 설정
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent

CONFIG_FILE = (
    Path(__file__).resolve().parent
    / "rate_config.json"
)

DATA_DIR = BASE_DIR / "public" / "data" / "rate_info"


# ==========================================
# SSL 인증서 검증 우회
# ------------------------------------------
# 회사 네트워크의 SSL 인증서 문제를
# 테스트하기 위해 사용
#
# GitHub Actions에서는 나중에 제거 예정
# ==========================================

SSL_CONTEXT = ssl._create_unverified_context()


# ==========================================
# 최근 10년 기간
# ==========================================

END_DATE = date.today()

START_DATE = END_DATE.replace(
    year=END_DATE.year - 10
)


# ==========================================
# 설정파일 읽기
# ==========================================

print()
print("=" * 60)
print("환율 월평균 데이터 생성")
print("=" * 60)

print(f"조회 기간 : {START_DATE} ~ {END_DATE}")
print(f"설정 파일 : {CONFIG_FILE}")


with open(
    CONFIG_FILE,
    "r",
    encoding="utf-8"
) as file:

    config = json.load(file)


currency_pairs = config["currency_pairs"]


print(f"환율 종류 : {len(currency_pairs)}개")


# ==========================================
# 환율별 처리
# ==========================================

for pair_info in currency_pairs:

    pair = pair_info["pair"]

    base_currency = pair_info["base_currency"]

    quote_currency = pair_info["quote_currency"]


    print()
    print("=" * 60)
    print(f"처리 시작 : {pair}")
    print("=" * 60)


    # --------------------------------------
    # API URL
    # --------------------------------------

    api_url = (
        "https://api.frankfurter.dev/v2/rates"
        f"?base={base_currency}"
        f"&quotes={quote_currency}"
        f"&from={START_DATE.isoformat()}"
        f"&to={END_DATE.isoformat()}"
    )


    print()
    print("API :")
    print(api_url)


    # --------------------------------------
    # Frankfurter 데이터 조회
    # --------------------------------------

    try:

        request = urllib.request.Request(
            api_url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            }
        )

        with urllib.request.urlopen(
            request,
            timeout=30,
            context=SSL_CONTEXT
        ) as response:

            rows = json.load(response)


    except Exception as e:

        print()
        print("ERROR :")
        print(e)

        continue


    # --------------------------------------
    # 조회 결과 확인
    # --------------------------------------

    print()
    print(f"일별 데이터 : {len(rows):,}건")


    if not rows:

        print("데이터가 없습니다.")

        continue


    # --------------------------------------
    # 월별 데이터 그룹화
    # --------------------------------------

    monthly_rates = defaultdict(list)


    for row in rows:

        date_value = row["date"]

        rate_value = float(row["rate"])


        # YYYY-MM
        month = date_value[:7]


        monthly_rates[month].append(
            rate_value
        )


    # --------------------------------------
    # 월평균 계산
    # --------------------------------------

    monthly_data = []


    for month in sorted(monthly_rates):

        rates = monthly_rates[month]


        # 산술평균
        average_rate = (
            sum(rates) / len(rates)
        )


        monthly_data.append({

            "month": month,

            "rate": round(
                average_rate,
                6
            ),

            "days": len(rates)

        })


    # --------------------------------------
    # JSON 데이터 생성
    # --------------------------------------

    result = {

        "currency_pair": pair,

        "base_currency": base_currency,

        "quote_currency": quote_currency,

        "unit": 1,

        "period": "monthly",

        "calculation":
            "Arithmetic mean of available daily rates",

        "source": "Frankfurter",

        "data": monthly_data

    }


    # --------------------------------------
    # 저장 폴더
    # --------------------------------------

    output_dir = (
        DATA_DIR
        / pair
    )


    output_dir.mkdir(
        parents=True,
        exist_ok=True
    )


    # --------------------------------------
    # 저장 파일
    # --------------------------------------

    output_file = (
        output_dir
        / "monthly.json"
    )


    # --------------------------------------
    # JSON 저장
    # --------------------------------------

    with open(
        output_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            result,
            file,
            ensure_ascii=False,
            indent=2
        )


    # --------------------------------------
    # 결과 출력
    # --------------------------------------

    print()
    print("처리 완료")

    print(
        f"월 데이터 : "
        f"{len(monthly_data):,}건"
    )

    print(
        f"저장 위치 : "
        f"{output_file}"
    )


# ==========================================
# 전체 완료
# ==========================================

print()
print("=" * 60)
print("모든 환율 처리 완료")
print("=" * 60)
print()