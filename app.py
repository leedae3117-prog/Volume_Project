import streamlit as st
import pandas as pd
from pathlib import Path
from datetime import date
import calendar

st.set_page_config(page_title="볼륨 캘린더", page_icon="🏋️", layout="centered")

DATA_PATH = Path("workout_log.csv")
PARTS = ["가슴", "등", "하체", "어깨", "이두", "삼두", "복근", "기타"]


def load_data():
    if DATA_PATH.exists():
        df = pd.read_csv(DATA_PATH)
        df["날짜"] = pd.to_datetime(df["날짜"]).dt.date
        return df
    return pd.DataFrame(columns=["날짜", "부위", "운동명", "세트번호", "무게", "횟수", "볼륨"])


def save_data(df):
    df.to_csv(DATA_PATH, index=False, encoding="utf-8-sig")


df = load_data()
today = date.today()

if "selected_date" not in st.session_state:
    st.session_state.selected_date = None

if "set_count" not in st.session_state:
    st.session_state.set_count = 3

st.title("🏋️ 볼륨 캘린더")
st.caption("날짜를 누르고 운동을 기록하세요.")


# =========================
# 캘린더
# =========================

with st.expander("📅 월별 캘린더", expanded=st.session_state.selected_date is None):
    col1, col2 = st.columns(2)

    with col1:
        year = st.number_input("연도", value=today.year, step=1)

    with col2:
        month = st.selectbox("월", list(range(1, 13)), index=today.month - 1)

    st.subheader(f"{year}년 {month}월")

    weekdays = ["월", "화", "수", "목", "금", "토", "일"]
    cols = st.columns(7)

    for i, day_name in enumerate(weekdays):
        cols[i].markdown(f"**{day_name}**")

    cal = calendar.Calendar(firstweekday=0)
    month_days = cal.monthdatescalendar(year, month)

    for week in month_days:
        cols = st.columns(7)

        for i, d in enumerate(week):
            if d.month == month:
                day_df = df[df["날짜"] == d]
                day_volume = day_df["볼륨"].sum()

                button_label = f"{d.day}\n\n\n"

                if day_volume > 0:
                    button_label += f"{day_volume:,.0f}kg"
                else:
                    button_label += " "

                if cols[i].button(button_label, key=f"day_{d}", use_container_width=True):
                    st.session_state.selected_date = d
                    st.rerun()
            else:
                cols[i].write("")


# =========================
# 날짜 선택 전
# =========================

if st.session_state.selected_date is None:
    st.info("캘린더에서 날짜를 선택해줘.")
    st.stop()


selected_date = st.session_state.selected_date

st.divider()

# =========================
# 선택 날짜 기록
# =========================

col_a, col_b = st.columns([3, 1])

with col_a:
    st.subheader(f"📌 {selected_date} 운동 기록")

with col_b:
    if st.button("날짜 변경"):
        st.session_state.selected_date = None
        st.rerun()

day_df = df[df["날짜"] == selected_date]

if day_df.empty:
    st.info("이 날짜에는 아직 기록이 없습니다.")
else:
    summary = (
        day_df.groupby(["부위", "운동명"])
        .agg(
            세트수=("세트번호", "count"),
            총볼륨=("볼륨", "sum")
        )
        .reset_index()
    )

    st.dataframe(
        summary.style.format({"총볼륨": "{:,.0f} kg"}),
        use_container_width=True
    )

    with st.expander("세트별 상세 기록"):
        st.dataframe(
            day_df[["부위", "운동명", "세트번호", "무게", "횟수", "볼륨"]]
            .style.format({"무게": "{:.1f}", "볼륨": "{:,.0f} kg"}),
            use_container_width=True
        )


# =========================
# 운동 추가
# =========================

st.markdown("### 운동 추가")

part = st.selectbox("부위", PARTS)
exercise = st.text_input("운동명", placeholder="예: 벤치프레스")

st.markdown("#### 세트 입력")

col1, col2 = st.columns(2)

with col1:
    if st.button("세트 추가 +"):
        st.session_state.set_count += 1
        st.rerun()

with col2:
    if st.button("세트 제거 -") and st.session_state.set_count > 1:
        st.session_state.set_count -= 1
        st.rerun()

set_rows = []

for i in range(st.session_state.set_count):
    st.markdown(f"**{i + 1}세트**")
    c1, c2 = st.columns(2)

    with c1:
        weight = st.number_input(
            f"{i + 1}세트 무게 kg",
            min_value=0.0,
            step=2.5,
            key=f"weight_{i}"
        )

    with c2:
        reps = st.number_input(
            f"{i + 1}세트 횟수",
            min_value=0,
            step=1,
            key=f"reps_{i}"
        )

    volume = weight * reps
    st.caption(f"세트 볼륨: {volume:,.0f} kg")

    set_rows.append({
        "세트번호": i + 1,
        "무게": weight,
        "횟수": reps,
        "볼륨": volume
    })

total_volume = sum(row["볼륨"] for row in set_rows)
st.metric("이 종목 총 볼륨", f"{total_volume:,.0f} kg")

if st.button("운동 기록 저장", use_container_width=True):
    if exercise.strip() == "":
        st.warning("운동명을 입력해줘.")
    elif total_volume <= 0:
        st.warning("최소 1개 세트의 무게와 횟수를 입력해줘.")
    else:
        valid_rows = [
            row for row in set_rows
            if row["무게"] > 0 and row["횟수"] > 0
        ]

        new_rows = []

        for row in valid_rows:
            new_rows.append({
                "날짜": selected_date,
                "부위": part,
                "운동명": exercise.strip(),
                "세트번호": row["세트번호"],
                "무게": row["무게"],
                "횟수": row["횟수"],
                "볼륨": row["볼륨"]
            })

        df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
        save_data(df)

        st.session_state.set_count = 3
        st.success(f"{exercise} 저장 완료: {total_volume:,.0f} kg")
        st.rerun()