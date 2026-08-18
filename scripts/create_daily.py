import json
import ssl
import urllib.request
from datetime import date, timedelta
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
# 현재 회사 PC 테스트용
#
# GitHub Actions에서는 나중에 제거 예정
# ==========================================

SSL_CONTEXT = ssl._create_unverified_context()


# ==========================================
# 날짜 설정
# ==========================================

END_DATE = date.today()

# 오늘 포함 최근 30일
START_DATE = END_DATE - timedelta(days=29)

# 현재 월
CURRENT_MONTH = END_DATE.strftime("%Y-%m")


# ==========================================
# 설정파일 읽기
# ==========================================

print()
print("=" * 60)
print("환율 일간 데이터 및 현재 월평균 갱신")
print("=" * 60)

print(f"조회 기간 : {START_DATE} ~ {END_DATE}")
print(f"현재 월   : {CURRENT_MONTH}")
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
    # API 요청
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
    # 데이터 확인
    # --------------------------------------

    print()
    print(
        f"조회된 데이터 : "
        f"{len(rows):,}건"
    )


    if not rows:

        print("데이터가 없습니다.")

        continue


    # --------------------------------------
    # 일간 데이터 생성
    # --------------------------------------

    daily_data = []


    for row in rows:

        daily_data.append({

            "date": row["date"],

            "rate": round(
                float(row["rate"]),
                6
            )

        })


    # 날짜순 정렬
    daily_data.sort(
        key=lambda x: x["date"]
    )


    # ======================================
    # 1. daily.json 저장
    # ======================================

    daily_result = {

        "currency_pair": pair,

        "base_currency": base_currency,

        "quote_currency": quote_currency,

        "unit": 1,

        "period": "daily",

        "range_days": 30,

        "source": "Frankfurter",

        "data": daily_data

    }


    output_dir = (
        DATA_DIR
        / pair
    )


    output_dir.mkdir(
        parents=True,
        exist_ok=True
    )


    daily_file = (
        output_dir
        / "daily.json"
    )


    with open(
        daily_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            daily_result,
            file,
            ensure_ascii=False,
            indent=2
        )


    print()
    print("[Daily]")

    print(
        f"데이터 : "
        f"{len(daily_data):,}건"
    )

    print(
        f"저장 : "
        f"{daily_file}"
    )


    # ======================================
    # 2. 현재 월 데이터 추출
    # ======================================

    current_month_rates = []


    for row in daily_data:

        if row["date"].startswith(
            CURRENT_MONTH
        ):

            current_month_rates.append(
                row["rate"]
            )


    # --------------------------------------
    # 현재 월 데이터가 없는 경우
    # --------------------------------------

    if not current_month_rates:

        print()
        print(
            f"[Monthly] "
            f"{CURRENT_MONTH} 데이터 없음"
        )

        continue


    # ======================================
    # 현재 월 평균 계산
    # ======================================

    current_month_average = (
        sum(current_month_rates)
        / len(current_month_rates)
    )


    current_month_average = round(
        current_month_average,
        6
    )


    print()
    print("[Monthly]")

    print(
        f"월 : {CURRENT_MONTH}"
    )

    print(
        f"거래일 : "
        f"{len(current_month_rates):,}일"
    )

    print(
        f"평균 : "
        f"{current_month_average}"
    )


    # ======================================
    # 3. 기존 monthly.json 읽기
    # ======================================

    monthly_file = (
        output_dir
        / "monthly.json"
    )


    if monthly_file.exists():

        try:

            with open(
                monthly_file,
                "r",
                encoding="utf-8"
            ) as file:

                monthly_result = json.load(
                    file
                )

        except Exception as e:

            print(
                f"monthly.json 읽기 실패 : {e}"
            )

            continue

    else:

        # 파일이 없는 경우 새로 생성
        monthly_result = {

            "currency_pair": pair,

            "base_currency": base_currency,

            "quote_currency": quote_currency,

            "unit": 1,

            "period": "monthly",

            "calculation":
                "Arithmetic mean of available daily rates",

            "source": "Frankfurter",

            "data": []

        }


    # ======================================
    # 4. 현재 월 데이터 업데이트
    # ======================================

    updated = False


    for item in monthly_result["data"]:

        if item["month"] == CURRENT_MONTH:

            item["rate"] = (
                current_month_average
            )

            item["days"] = (
                len(current_month_rates)
            )

            updated = True

            break


    # ======================================
    # 현재 월 데이터가 없으면 추가
    # ======================================

    if not updated:

        monthly_result["data"].append({

            "month": CURRENT_MONTH,

            "rate": current_month_average,

            "days": len(
                current_month_rates
            )

        })


    # ======================================
    # 월 순서 정렬
    # ======================================

    monthly_result["data"].sort(
        key=lambda x: x["month"]
    )


    # ======================================
    # 5. monthly.json 저장
    # ======================================

    with open(
        monthly_file,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            monthly_result,
            file,
            ensure_ascii=False,
            indent=2
        )


    print(
        f"저장 : "
        f"{monthly_file}"
    )


# ==========================================
# 완료
# ==========================================

print()
print("=" * 60)
print("모든 환율 처리 완료")
print("=" * 60)
print()